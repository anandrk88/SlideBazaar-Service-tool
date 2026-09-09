import { NextResponse, type NextRequest } from "next/server";
import { appUrl, googleEnabled } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { buildAuthorizeUrl, challengeFor, randomToken, OAUTH_COOKIES, OAUTH_COOKIE_OPTIONS } from "@/lib/oauth";
import { googleProvider, googleRedirectUri } from "@/lib/oauth-google";
import { safeNext } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google/start
 *
 * Begins the Google flow. The state, PKCE verifier and nonce are held in
 * short-lived httpOnly cookies rather than server state, so this works on
 * serverless with no shared store.
 *
 * ?link=1 marks the flow as "attach this Google account to the account I am
 * already signed in as", which the callback treats very differently from a
 * plain sign-in.
 */
export async function GET(req: NextRequest) {
  if (!googleEnabled()) {
    return NextResponse.redirect(new URL("/login?error=google-unavailable", appUrl()));
  }

  const linking = req.nextUrl.searchParams.get("link") === "1";
  // Linking only makes sense with a session; without one it would silently
  // degrade into a sign-in, which is the confused-deputy shape we are avoiding.
  const current = linking ? await getCurrentUser() : null;
  if (linking && !current) {
    return NextResponse.redirect(new URL("/login?next=%2Faccount", appUrl()));
  }

  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const next = safeNext(req.nextUrl.searchParams.get("next"), appUrl());

  const url = buildAuthorizeUrl(googleProvider(), {
    redirectUri: googleRedirectUri(),
    state,
    codeChallenge: challengeFor(verifier),
    nonce,
    // Ask Google to show the account chooser rather than silently reusing a
    // single signed-in account, which matters on shared machines.
    extra: { prompt: "select_account" },
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIES.state, state, OAUTH_COOKIE_OPTIONS);
  res.cookies.set(OAUTH_COOKIES.nonce, nonce, OAUTH_COOKIE_OPTIONS);
  res.cookies.set(OAUTH_COOKIES.verifier, verifier, OAUTH_COOKIE_OPTIONS);
  // The mode carries the id of the account that started a link, so a flow begun
  // by one person cannot finish against whoever happens to be signed in when
  // the callback lands. That matters on a shared machine.
  res.cookies.set(OAUTH_COOKIES.mode, current ? `link:${current.id}` : "signin", OAUTH_COOKIE_OPTIONS);
  // Written on every flow, cleared when there is no destination, so an
  // abandoned flow cannot leave a `next` behind for the following one.
  res.cookies.set(OAUTH_COOKIES.next, next ?? "", next ? OAUTH_COOKIE_OPTIONS : { ...OAUTH_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
