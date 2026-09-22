import "server-only";
import { isProduction, isStaging } from "./env";

/**
 * Whether the third-party tags load at all.
 *
 * The host gate is the load-bearing one, and it is checked against the host the
 * BROWSER actually used, never against APP_URL. CookieYes' script.js opens by
 * comparing window.location.hostname against the domain registered on the
 * account and throwing if it does not match. A throw in one script tag does not
 * stop the next one, so on a preview host the banner would die while GTM and
 * Clarity carried on: analytics running with no way to refuse it. Comparing
 * APP_URL to a constant cannot catch that, because APP_URL is usually the
 * production domain on a preview, which is exactly how you reach that state.
 */

export interface AnalyticsConfig {
  gtmId: string;
  cookieYesId: string;
  /** Optional: session replay is useful but not required for the rest to work. */
  clarityId: string | null;
}

/** CookieYes registers one domain per account; any subdomain of it passes. */
const CONSENT_DOMAIN = "slidebazaar.com";

/** Mirrors CookieYes' own suffix walk over window.location.hostname. */
export function hostRegistered(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0].trim().toLowerCase().replace(/^www\./, "");
  if (!h) return false;
  return h === CONSENT_DOMAIN || h.endsWith(`.${CONSENT_DOMAIN}`);
}

/**
 * The live customer deployment, as opposed to a preview of it.
 *
 * NODE_ENV is "production" for every Vercel build, previews included, so
 * isProduction alone excludes nothing. VERCEL_TARGET_ENV is the discriminator.
 * Off Vercel there is no preview concept, so isProduction stands.
 */
export function isLiveTarget(): boolean {
  const target = process.env.VERCEL_TARGET_ENV;
  if (target) return target === "production";
  return isProduction;
}

export function analyticsConfig(host: string | null | undefined): AnalyticsConfig | null {
  const gtmId = process.env.GTM_ID?.trim() ?? "";
  const cookieYesId = process.env.COOKIEYES_ID?.trim() ?? "";
  const clarityId = process.env.CLARITY_ID?.trim() ?? "";
  // Both or neither: GTM without the banner is measurement nobody agreed to.
  if (!gtmId || !cookieYesId) return null;
  if (!isProduction || isStaging) return null;
  if (!isLiveTarget()) return null;
  if (!hostRegistered(host)) return null;
  return { gtmId, cookieYesId, clarityId: clarityId || null };
}

/**
 * Whether the wizard tracker must wait for an explicit opt-in.
 *
 * Deliberately NOT derived from analyticsConfig(). Tying it to the banner's
 * presence would mean removing the banner also removes the duty to ask, which is
 * backwards: no banner means nobody can agree, so nothing may be collected. Not
 * knowing counts as no. CONSENT_REQUIRED=yes exercises the gated path in
 * development; there is deliberately no value that turns the duty off.
 */
export function consentRequired(): boolean {
  return isProduction || process.env.CONSENT_REQUIRED === "yes";
}
