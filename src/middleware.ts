import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Must match SESSION_COOKIE in src/lib/auth.ts.
const COOKIE = "__Host-sb_session";

async function readSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET ?? ""));
    return { id: payload.sub, role: String(payload.role) };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await readSession(req);

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/admin") && !["ADMIN", "MANAGER", "DESIGNER"].includes(session.role)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Deliberately no "already logged in, bounce away from /login" rule here.
  // This runs on the edge with no database, so it cannot compare sessionVersion
  // and would treat a revoked cookie as a live session. Combined with a page
  // that disagrees, that is an endless redirect between /login and /dashboard.
  // The login and signup pages make that call themselves via getCurrentUser().
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
