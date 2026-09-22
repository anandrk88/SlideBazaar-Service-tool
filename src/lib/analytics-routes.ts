/**
 * Which pages may load analytics.
 *
 * An allow-list, not a block-list, and deliberately so. A block-list fails open:
 * somebody adds /admin/invoices next year, nobody remembers to exclude it, and
 * analytics quietly starts collecting on a page full of customer data. This
 * fails closed instead — a new route gets nothing until it is named here.
 *
 * Three separate reasons a route is left out, in order of how badly it would go:
 *
 *  1. The auth routes put single-use credentials in the query string:
 *     /reset-password?token=... and /verify-email?token=... Tag managers report
 *     the full page URL, so loading one there would send a live, working
 *     password-reset token to Google and to whatever else the container fires.
 *  2. /admin and /dashboard have order values, customer names and email
 *     addresses on screen, and a tag manager can run arbitrary JavaScript on any
 *     page it loads on.
 *  3. Staff traffic is not customer traffic. Counting our own clicks would make
 *     every number on the way to a decision slightly wrong.
 */

/**
 * Exact paths.
 *
 * /order/success is deliberately absent, although it is the obvious place to
 * measure a purchase. Two independent reasons:
 *
 *  1. It never renders. Every branch of src/app/order/success/page.tsx calls
 *     redirect(), so a tag placed there would not run even once.
 *  2. Stripe sends the visitor back to it as
 *     ?order=...&session_id={CHECKOUT_SESSION_ID}, and a tag manager reports the
 *     full page URL. That would hand a live Checkout Session id to Google.
 *
 * Purchases are therefore not measurable in the browser. They are already
 * counted in Admin > Order form drop-off and sent to Pabbly as order.placed,
 * which is server side and does not depend on anybody's tag.
 */
const EXACT = new Set(["/", "/order"]);

export function analyticsAllowed(pathname: string): boolean {
  // Normalise a trailing slash, so /order/ behaves like /order.
  const p = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return EXACT.has(p);
}

/** The allow-listed paths, for the admin page and for tests. */
export const ANALYTICS_ROUTES = Array.from(EXACT);
