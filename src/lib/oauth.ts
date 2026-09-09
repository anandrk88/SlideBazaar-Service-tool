import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A small OAuth 2.0 Authorization Code + PKCE client.
 *
 * Deliberately not a library. The app already has a working session layer
 * (src/lib/auth.ts) that middleware and every permission helper depend on;
 * adopting an auth framework would replace that layer and touch every call
 * site for the sake of one sign-in button. This adds a way to *establish* the
 * existing session, and changes nothing about how it is verified.
 *
 * Provider-specific details live in oauth-google.ts (and later
 * oauth-amember.ts). This file only knows the shape of the protocol.
 */

export interface OAuthProviderConfig {
  /** Stable id stored on AuthIdentity.provider, e.g. "GOOGLE". */
  id: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Expected `iss`, stored on AuthIdentity.issuer. */
  issuer: string;
}

export interface TokenResponse {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
}

function base64url(buf: Buffer) {
  return buf.toString("base64url");
}

export function randomToken() {
  return base64url(randomBytes(32));
}

/** S256 challenge for a verifier, per RFC 7636. */
export function challengeFor(verifier: string) {
  return base64url(createHash("sha256").update(verifier).digest());
}

/**
 * Constant-time comparison for the state parameter. A plain === leaks how much
 * of the value matched through timing, which is a needless gift to an attacker
 * probing a CSRF defence.
 */
export function safeEquals(a: string | undefined | null, b: string | undefined | null) {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function buildAuthorizeUrl(
  provider: OAuthProviderConfig,
  opts: { redirectUri: string; state: string; codeChallenge: string; nonce?: string; extra?: Record<string, string> },
) {
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scope);
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (opts.nonce) url.searchParams.set("nonce", opts.nonce);
  for (const [k, v] of Object.entries(opts.extra ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

/** Exchange the authorization code. Throws with the provider's error text. */
export async function exchangeCode(
  provider: OAuthProviderConfig,
  opts: { code: string; redirectUri: string; codeVerifier: string },
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code_verifier: opts.codeVerifier,
  });

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    // Never let a slow provider hold a request open indefinitely.
    signal: AbortSignal.timeout(10_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${provider.id} token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as TokenResponse;
  } catch {
    throw new Error(`${provider.id} token endpoint returned a non-JSON body`);
  }
}

/** Names of the short-lived cookies that carry the flow across the redirect. */
export const OAUTH_COOKIES = {
  state: "__Host-oauth_state",
  verifier: "__Host-oauth_verifier",
  nonce: "__Host-oauth_nonce",
  next: "__Host-oauth_next",
  mode: "__Host-oauth_mode",
} as const;

/** Attributes for those cookies. lax, not strict: strict is dropped on the
 * cross-site redirect back from the provider, which breaks every login. */
export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  path: "/",
  maxAge: 10 * 60,
} as const;
