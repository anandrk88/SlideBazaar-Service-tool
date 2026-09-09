import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "./db";

/**
 * The __Host- prefix binds the cookie to this exact origin: the browser refuses
 * it unless it is Secure, path=/ and has no Domain attribute. That matters here
 * because slidebazaar.com and design.slidebazaar.com share a registrable
 * domain, so without the prefix a script on the WordPress site could set a
 * cookie scoped to .slidebazaar.com and shadow this one.
 */
export const SESSION_COOKIE = "__Host-sb_session";

/** Attributes the __Host- prefix requires. Used for both set and clear. */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  path: "/",
} as const;
const SESSION_DAYS = 14;

/**
 * CUSTOMER  places orders, reviews and approves deliveries.
 * DESIGNER  works assigned orders: brief, files, deadline, customer name. Never sees money.
 * MANAGER   QC: reviews designer drafts and releases them to the customer. Sees money.
 * ADMIN     everything, plus assignments, refunds and team management.
 */
export type Role = "CUSTOMER" | "ADMIN" | "MANAGER" | "DESIGNER";

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: "Customer",
  DESIGNER: "Designer",
  MANAGER: "QC manager",
  ADMIN: "Admin",
};

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Incremented to revoke outstanding tokens. Absent on old cookies. */
  sessionVersion?: number;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/**
 * Accounts created through Google have no password hash. Compare against a
 * dummy so the work done is the same either way and the response time does not
 * reveal whether an account has a password.
 */
export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ email: user.email, name: user.name, role: user.role, sv: user.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      sessionVersion: typeof payload.sv === "number" ? payload.sv : 0,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const sessionVersion =
    user.sessionVersion ?? (await prisma.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } }))?.sessionVersion ?? 0;
  const token = await createSessionToken({ ...user, sessionVersion });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

/**
 * Expire the cookie explicitly rather than calling delete(). A __Host- cookie
 * is only removed by a Set-Cookie carrying the same attributes it was written
 * with, and delete() does not reproduce them, so the session would survive.
 */
export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

/** The logged-in user from the cookie, re-validated against the database. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, role: true, sessionVersion: true },
  });
  if (!user) return null;
  // A bumped version means the password changed or an identity was unlinked
  // since this token was issued, so it is no longer good.
  if ((session.sessionVersion ?? 0) !== user.sessionVersion) return null;
  return { ...user, role: user.role as Role };
}

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export const STAFF_ROLES: Role[] = ["ADMIN", "MANAGER", "DESIGNER"];

export function isStaff(user: { role: string } | null | undefined) {
  return STAFF_ROLES.includes(user?.role as Role);
}

/** Who may see prices, escrow balances, payments and billing. */
export function canSeeMoney(user: { role: string } | null | undefined) {
  return user?.role === "ADMIN" || user?.role === "MANAGER";
}

/** Who may approve or reject a designer's draft. */
export function canReviewQc(user: { role: string } | null | undefined) {
  return user?.role === "ADMIN" || user?.role === "MANAGER";
}

export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!isStaff(user)) redirect("/dashboard");
  return user;
}

export async function requireMoneyAccess(): Promise<SessionUser> {
  const user = await requireStaff();
  if (!canSeeMoney(user)) redirect("/admin");
  return user;
}

export async function requireQcReviewer(): Promise<SessionUser> {
  const user = await requireStaff();
  if (!canReviewQc(user)) throw new Error("Only a QC manager or admin can review drafts");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/admin");
  return user;
}
