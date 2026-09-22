/**
 * Proves the analytics gates hold.
 *
 *   npm run verify:analytics
 *
 * Three gates decide whether a third-party tag loads at all, and every one of
 * them fails in a way that is invisible in a browser: the tags either appear or
 * do not, and "did not appear on a preview" looks identical to "did not appear
 * because it is broken". This asserts each one instead.
 */
import { analyticsAllowed } from "../src/lib/analytics-routes";
import { hostRegistered } from "../src/lib/analytics";

let bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
  if (got === want) console.log(`  ok    ${what}`);
  else {
    console.error(`  FAIL  ${what}: got ${String(got)}, wanted ${String(want)}`);
    bad += 1;
  }
};

console.log("\nRoutes that may load a tag");
for (const p of ["/", "/order", "/order/"]) check(`allow ${p}`, analyticsAllowed(p), true);
console.log("\nRoutes that may not");
for (const p of [
  "/order/success", // never renders, and its URL carries a live Stripe session id
  "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", // tokens in the URL
  "/admin", "/admin/orders", "/admin/funnel", "/dashboard", "/dashboard/orders/x", "/account", "/notifications",
  "/pay/mock/x", "/orders", "/ordering", "/order-history",
]) check(`deny ${p}`, analyticsAllowed(p), false);

console.log("\nHosts CookieYes is registered for");
for (const h of ["slidebazaar.com", "design.slidebazaar.com", "www.slidebazaar.com", "design.slidebazaar.com:443"]) check(`allow ${h}`, hostRegistered(h), true);
console.log("\nHosts it is not (CookieYes throws on these, so nothing may load)");
for (const h of [
  "slidebazaar-service.vercel.app",
  "slidebazaar-service-git-main.vercel.app",
  "localhost:3000",
  "slidebazaar.com.evil.example",   // suffix-confusion
  "notslidebazaar.com",
  "",
]) check(`deny ${h || "(empty)"}`, hostRegistered(h), false);

console.log(bad === 0 ? "\nAll analytics gate checks passed.\n" : `\n${bad} check(s) FAILED.\n`);
process.exitCode = bad === 0 ? 0 : 1;
