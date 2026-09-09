import { NextResponse, type NextRequest } from "next/server";
import { appUrl, googleEnabled } from "@/lib/env";
import { getCurrentUser, setSessionCookie } from "@/lib/auth";
import { exchangeCode, safeEquals, OAUTH_COOKIES, OAUTH_COOKIE_OPTIONS } from "@/lib/oauth";
import { googleProvider, googleRedirectUri, verifyGoogleIdToken, GOOGLE_ISSUER } from "@/lib/oauth-google";
import { linkIdentity, signInWithIdentity, LINK_FAILURE_MESSAGES, SIGN_IN_FAILURE_MESSAGES } from "@/lib/auth-federated";
import { safeNext } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Clear the short-lived flow cookies on every exit path, success or not. */
function clearFlowCookies(res: NextResponse) {
  for (const name of Object.values(OAUTH_COOKIES)) {
    res.cookies.set(name, "", { ...OAUTH_COOKIE_OPTIONS, maxAge: 0 });
  }
  return res;
}

function back(path: string, params: Record<string, string> = {}) {
  const url = new URL(path, appUrl());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return clearFlowCookies(NextResponse.redirect(url));
}

/**
 * GET /api/auth/google/callback
 *
 * Order matters here. State is checked before anything is spent on a token
 * exchange, and the id_token is fully verified before any database work, so a
 * forged callback costs an attacker nothing and achieves nothing.
 */
export async function GET(req: NextRequest) {
  if (!googleEnabled()) return back("/login", { error: "google-unavailable" });

  const params = req.nextUrl.searchParams;
  const jar = req.cookies;
  const rawMode = jar.get(OAUTH_COOKIES.mode)?.value ?? "signin";
  const linkingUserId = rawMode.startsWith("link:") ? rawMode.slice("link:".length) : null;
  const mode = linkingUserId ? "link" : "signin";
  // Re-validated rather than trusted: the cookie is ours, but a destination
  // that survived from an earlier flow should not be followed blindly.
  const next = safeNext(jar.get(OAUTH_COOKIES.next)?.value, appUrl());
  const landing = mode === "link" ? "/account" : "/login";

  // The user pressed cancel, or Google refused. Not an error worth shouting about.
  const providerError = params.get("error");
  if (providerError) {
    return back(landing, { error: providerError === "access_denied" ? "google-cancelled" : "google-failed" });
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = jar.get(OAUTH_COOKIES.state)?.value;
  const nonce = jar.get(OAUTH_COOKIES.nonce)?.value;
  const verifier = jar.get(OAUTH_COOKIES.verifier)?.value;

  if (!code || !state || !expectedState || !nonce || !verifier) {
    return back(landing, { error: "google-expired" });
  }
  if (!safeEquals(state, expectedState)) {
    return back(landing, { error: "google-state" });
  }

  let profile;
  try {
    const tokens = await exchangeCode(googleProvider(), { code, redirectUri: googleRedirectUri(), codeVerifier: verifier });
    if (!tokens.id_token) throw new Error("Google returned no id_token");
    profile = await verifyGoogleIdToken(tokens.id_token, nonce);
  } catch (err) {
    console.error("[google] callback failed:", err instanceof Error ? err.message : err);
    return back(landing, { error: "google-failed" });
  }

  const identity = {
    provider: "GOOGLE",
    providerAccountId: profile.sub,
    issuer: GOOGLE_ISSUER,
    email: profile.email,
    emailVerifiedByProvider: profile.emailVerified,
    name: profile.name,
    image: profile.picture,
  };

  if (mode === "link") {
    // Re-read the session here rather than trusting the cookie set at /start:
    // the user may have logged out or switched accounts in between.
    const current = await getCurrentUser();
    if (!current) return back("/login", { next: "/account" });
    // The session may have changed while the user was at Google. Attaching the
    // identity to whoever is signed in now would hand it to the wrong account.
    if (current.id !== linkingUserId) {
      return back("/account", { error: "You signed in as someone else while that was in progress. Start the connection again." });
    }
    const result = await linkIdentity(current, identity);
    if (!result.ok) return back("/account", { error: LINK_FAILURE_MESSAGES[result.reason] });
    return back("/account", { linked: "google" });
  }

  const result = await signInWithIdentity(identity);
  if (!result.ok) {
    return back("/login", { error: SIGN_IN_FAILURE_MESSAGES[result.reason] });
  }

  await setSessionCookie(result.user);
  const destination = next ?? (result.user.role === "CUSTOMER" ? "/dashboard" : "/admin");
  return back(destination);
}
