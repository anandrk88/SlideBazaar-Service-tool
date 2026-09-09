import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { appUrl } from "./env";
import type { OAuthProviderConfig } from "./oauth";

/**
 * Google as an OpenID Connect provider.
 *
 * Endpoints are Google's published discovery values. They are pinned rather
 * than fetched at runtime so a sign-in cannot fail because a discovery
 * document was briefly unreachable.
 */

export const GOOGLE_ISSUER = "https://accounts.google.com";

export function googleProvider(): OAuthProviderConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google sign-on is not configured");
  return {
    id: "GOOGLE",
    clientId,
    clientSecret,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    issuer: GOOGLE_ISSUER,
  };
}

export function googleRedirectUri() {
  return `${appUrl()}/api/auth/google/callback`;
}

const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleProfile {
  /** Google's stable subject id. The only safe join key. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/**
 * Verify the id_token and pull out the claims we use.
 *
 * Everything here is a hard failure rather than a fallback. An id_token whose
 * signature, issuer, audience or nonce does not check out is an attack, not a
 * degraded login, and a missing `sub` must never be coerced into a string:
 * with a unique index on (provider, providerAccountId), a literal "undefined"
 * would collapse every such login onto one shared account.
 */
export async function verifyGoogleIdToken(idToken: string, expectedNonce: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: [GOOGLE_ISSUER, "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  if (typeof payload.nonce !== "string" || payload.nonce !== expectedNonce) {
    throw new Error("Google id_token nonce did not match the one we issued");
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Google id_token has no subject claim");
  }
  if (typeof payload.email !== "string" || payload.email.length === 0) {
    throw new Error("Google id_token has no email claim");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : payload.email.split("@")[0],
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
