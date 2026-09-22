import { headers } from "next/headers";
import { analyticsConfig } from "@/lib/analytics";
import { Analytics } from "./Analytics";

/**
 * Renders the analytics tags, or nothing.
 *
 * Deliberately NOT in the root layout. The layout renders on every page in the
 * app, including /admin and the auth routes, and the auth routes put live
 * single-use tokens in the query string. Putting it in the two pages that are
 * allowed to have it means a route added later gets nothing until somebody
 * deliberately adds this component, which is the same fail-closed reasoning as
 * the allow-list in analytics-routes.ts.
 *
 * The host comes from the request, not from APP_URL, because it decides whether
 * CookieYes will work at all: its script throws on a domain that is not
 * registered to the account, and a throw in one tag does not stop the next.
 */
export async function AnalyticsSlot() {
  const h = await headers();
  const config = analyticsConfig(h.get("x-forwarded-host") ?? h.get("host"));
  if (!config) return null;
  return <Analytics gtmId={config.gtmId} cookieYesId={config.cookieYesId} clarityId={config.clarityId} />;
}
