import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { normalizeEmail } from "./validation";
import { isStaff, type Role, type SessionUser } from "./auth";

/**
 * Turning a provider identity into a local account.
 *
 * The rules here are the security boundary for federated sign-in, so they are
 * written out rather than inlined into a route.
 *
 * The governing rule: identity is keyed on (provider, providerAccountId) and
 * NEVER on the email address. Emails are mutable, providers reassign them, and
 * this app has accounts whose address nobody has ever verified. Matching a new
 * provider subject onto an existing row because the addresses look the same is
 * exactly how account takeover happens, so it is refused and routed through an
 * explicit, authenticated link instead.
 */

export interface ProviderIdentity {
  provider: string;
  providerAccountId: string;
  issuer: string;
  email: string;
  emailVerifiedByProvider: boolean;
  name: string;
  image?: string;
}

export type SignInFailure =
  /** Provider will not vouch for the address, so we cannot create an account from it. */
  | "PROVIDER_EMAIL_UNVERIFIED"
  /** A local account already holds this address. Must be linked while signed in. */
  | "EMAIL_ALREADY_REGISTERED";

export type SignInResult = { ok: true; user: SessionUser; created: boolean } | { ok: false; reason: SignInFailure; email: string };

export type LinkFailure =
  /** Somebody else's account already owns this provider identity. */
  | "IDENTITY_OWNED_BY_ANOTHER_USER"
  /** This account already has an identity for this provider. */
  | "PROVIDER_ALREADY_CONNECTED"
  /** Staff may only connect a provider account with their own address. */
  | "STAFF_EMAIL_MISMATCH";

export type LinkResult = { ok: true } | { ok: false; reason: LinkFailure };

function toSessionUser(u: { id: string; email: string; name: string; role: string; sessionVersion: number }): SessionUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role as Role, sessionVersion: u.sessionVersion };
}

const USER_FIELDS = { id: true, email: true, name: true, role: true, sessionVersion: true } as const;

/**
 * Sign in with a provider identity, creating an account if this is genuinely a
 * new person.
 */
export async function signInWithIdentity(identity: ProviderIdentity): Promise<SignInResult> {
  const email = normalizeEmail(identity.email);

  // 1. Known identity. This is the only path that logs an existing user in.
  const existing = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider: identity.provider, providerAccountId: identity.providerAccountId } },
    select: { id: true, user: { select: USER_FIELDS } },
  });
  if (existing) {
    await prisma.authIdentity.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } });
    return { ok: true, user: toSessionUser(existing.user), created: false };
  }

  // 2. Creating an account from a provider requires the provider to actually
  //    vouch for the mailbox. Google sets email_verified; without it the
  //    address is an unproven claim.
  if (!identity.emailVerifiedByProvider) {
    return { ok: false, reason: "PROVIDER_EMAIL_UNVERIFIED", email };
  }

  // 3. Address already spoken for. Refuse. Linking happens from the account
  //    page, where the user has already proved they hold the local account.
  const collision = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (collision) {
    return { ok: false, reason: "EMAIL_ALREADY_REGISTERED", email };
  }

  // 4. New person. Role is hardcoded: nothing a provider says may grant staff
  //    access, and there is no domain shortcut into ADMIN.
  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: identity.name,
        role: "CUSTOMER",
        passwordHash: null,
        emailVerified: new Date(),
        image: identity.image ?? null,
        identities: {
          create: {
            provider: identity.provider,
            providerAccountId: identity.providerAccountId,
            issuer: identity.issuer,
            emailAtLink: email,
            emailVerifiedByProvider: identity.emailVerifiedByProvider,
            lastLoginAt: new Date(),
          },
        },
      },
      select: USER_FIELDS,
    });
    return { ok: true, user: toSessionUser(user), created: true };
  } catch (err) {
    // Two tabs finishing the same first-time sign-in at once. Whoever lost the
    // race re-reads the row the winner created rather than erroring.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await prisma.authIdentity.findUnique({
        where: { provider_providerAccountId: { provider: identity.provider, providerAccountId: identity.providerAccountId } },
        select: { user: { select: USER_FIELDS } },
      });
      if (raced) return { ok: true, user: toSessionUser(raced.user), created: false };
      return { ok: false, reason: "EMAIL_ALREADY_REGISTERED", email };
    }
    throw err;
  }
}

/**
 * Attach a provider identity to an account the caller is already signed in as.
 * This is the only way an existing account gains a provider login.
 */
export async function linkIdentity(user: SessionUser, identity: ProviderIdentity): Promise<LinkResult> {
  const email = normalizeEmail(identity.email);

  const owner = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider: identity.provider, providerAccountId: identity.providerAccountId } },
    select: { userId: true },
  });
  if (owner && owner.userId !== user.id) return { ok: false, reason: "IDENTITY_OWNED_BY_ANOTHER_USER" };
  if (owner) return { ok: true };

  const already = await prisma.authIdentity.findUnique({
    where: { userId_provider: { userId: user.id, provider: identity.provider } },
    select: { id: true },
  });
  if (already) return { ok: false, reason: "PROVIDER_ALREADY_CONNECTED" };

  // Staff hold refund and QC powers, so their provider account must be the
  // same address as the staff account itself. A designer connecting a personal
  // address would widen who can reach the admin area.
  if (isStaff(user) && normalizeEmail(user.email) !== email) {
    return { ok: false, reason: "STAFF_EMAIL_MISMATCH" };
  }

  try {
    await prisma.authIdentity.create({
      data: {
        userId: user.id,
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
        issuer: identity.issuer,
        emailAtLink: email,
        emailVerifiedByProvider: identity.emailVerifiedByProvider,
        lastLoginAt: new Date(),
      },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, reason: "IDENTITY_OWNED_BY_ANOTHER_USER" };
    }
    throw err;
  }
}

/**
 * Detach a provider identity. Refuses to leave an account with no way back in:
 * a user with no password and no other identity would be locked out.
 */
export async function unlinkIdentity(userId: string, identityId: string): Promise<{ ok: true } | { ok: false; reason: "LAST_CREDENTIAL" | "NOT_FOUND" }> {
  const [user, identities] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
    prisma.authIdentity.findMany({ where: { userId }, select: { id: true } }),
  ]);
  if (!user) return { ok: false, reason: "NOT_FOUND" };
  if (!identities.some((i) => i.id === identityId)) return { ok: false, reason: "NOT_FOUND" };
  if (!user.passwordHash && identities.length <= 1) return { ok: false, reason: "LAST_CREDENTIAL" };

  await prisma.$transaction([
    prisma.authIdentity.delete({ where: { id: identityId } }),
    // Sessions established through that identity should not outlive it.
    prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }),
  ]);
  return { ok: true };
}

/** Human wording for each refusal, shown on the login page. */
export const SIGN_IN_FAILURE_MESSAGES: Record<SignInFailure, string> = {
  PROVIDER_EMAIL_UNVERIFIED: "Google has not verified that email address, so we cannot create an account from it. Sign up with an email and password instead.",
  EMAIL_ALREADY_REGISTERED:
    "An account already uses that email address. Log in with your password, then connect Google from your account settings.",
};

export const LINK_FAILURE_MESSAGES: Record<LinkFailure, string> = {
  IDENTITY_OWNED_BY_ANOTHER_USER: "That Google account is already connected to a different SlideBazaar account.",
  PROVIDER_ALREADY_CONNECTED: "This account already has a Google account connected. Disconnect it first.",
  STAFF_EMAIL_MISMATCH: "Staff accounts can only connect a Google account with the same email address.",
};
