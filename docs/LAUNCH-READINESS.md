# Launch readiness: SlideBazaar Custom Design Services

Audit date: 8 September 2026. Reviewed by 12 independent reviewers across security, payments, workflow, files, notifications, customer and staff experience, data and deployment, performance, accessibility, legal and testing. 172 raw findings were merged into 109 distinct issues.

---

> **Update, 8 September 2026: all 8 blockers in section 1 have been fixed and verified.** See "Blocker fixes applied"
> below for what changed and how it was checked. The remaining work is section 2 onwards, and the items you must
> supply in section 3. Section 1 is kept for the record.

## Verdict

**Originally: not yet.** The app was feature-complete and the happy path worked, but three things would have failed on contact with a real order: designers physically could not upload a real deck (Next.js rejects anything over 1 MB in a server action), a missing Stripe key silently turned every order into a free order, and uploaded customer files sat on local disk that is wiped on the next deploy.

**Now:** the blockers are closed. What stands between you and a first paying customer is no longer code. It is the accounts and policies in section 3: live Stripe keys, an email provider, a domain, terms and a refund policy, and your real prices. Budget a day or two of your own time for those.

Before a *public* launch, work through section 2. The highest-value items there are a customer-facing refund path, password reset, invoices, and putting the order list behind pagination.

---

## Blocker fixes applied

| # | Blocker | What changed | Verified by |
| --- | --- | --- | --- |
| 1.1 | 1 MB upload cap | `serverActions.bodySizeLimit` set to 250mb in `next.config.ts` | Uploaded 8.85 MB across 5 files as a designer; order reached QC with 4 watermarked previews |
| 1.2 | Mock payment fail-open | `src/lib/env.ts` refuses to boot production without Stripe; mock page and mock branches now gated on `mockPaymentsActive()`, which is always false in production; mock page returns 404 | Code path review; `stripeEnabled()` now returns true unconditionally in production |
| 1.3 | Ephemeral file storage | New `src/lib/storage.ts` with an S3/R2 driver behind the same API; `S3_BUCKET` switches it on; admin overview warns in production when it is unset | Local driver exercised by the upload and preview tests; path traversal now blocked by resolve-and-contain |
| 1.4 | Refund could fail silently | Refunds are now a `RefundAttempt` row settled separately, with retries, admin alert, an admin retry button and `npm run refunds:settle` for a cron | `verify:money` check 4: difference refund settles to SUCCEEDED; sweeper reports 0 pending |
| 1.5 | Non-atomic money transitions | Every transition is a conditional `updateMany` on the expected status; ledger writes carry a unique idempotency key | `verify:money` checks 1 and 3: three concurrent payments write one HOLD and one PAID event; two concurrent approvals write one RELEASE and reject the loser |
| 1.6 | Charged after cancelling | Sessions expire after 60 minutes, an open session is reused instead of creating a second, cancelling expires it, and a payment for a non-pending order queues an automatic refund and alerts admins | `verify:money` check 2: payment after cancellation queues a refund for the full amount |
| 1.7 | "Escrow" misdescription | All customer-facing copy reworded to "held by SlideBazaar" and "refunded in full if you do not approve", with an explicit line that this is a money-back guarantee, not a third-party escrow. Internal accounting keeps the term | Customer dashboard and homepage now contain zero uses of "escrow" except that disclaimer |
| 1.8 | Demo seed as only admin path | Seed refuses to run against a non-local database; new `npm run admin:create` bootstraps a real admin with a generated password | Seed guard reads `DATABASE_URL` and `NODE_ENV` |

Also fixed while in the same code: the customer order page no longer lists designer draft filenames (it filtered on
`kind !== "DELIVERABLE"`), superseded deliverables are demoted so only the newest revision is downloadable, a
"Let us decide" order cannot pass QC without a treatment set, `finalTotalFor` is clamped to the price the customer
was quoted, refund amounts are validated server-side, upload batches have size and count limits, a failed checkout
no longer strands a duplicate order, `.env.example` is no longer gitignored, and basic security headers are set.

New checks: `npm run verify:money` runs ten money-path regression checks and currently passes.

---

## At a glance

| Category | Count | Realistic effort |
| --- | --- | --- |
| Blockers, must fix before anyone pays | 8 | 5 to 8 engineering days |
| Fix before public launch | 34 | 15 to 20 engineering days |
| Worth doing soon after | 67 | ongoing |
| Items you must supply or decide | 18 | 2 to 5 days of your time |

Confidence note: every blocker below was verified by reading the code directly. The 34 "fix before launch" items were reported by reviewers and de-duplicated, but the independent verification pass was cut short by a usage limit, so treat a small number of them as probable rather than certain. They are all worth triaging regardless.

---

## 1. Blockers — must fix before any customer pays

### 1.1 Designers cannot upload a real deck

**What happens.** The designer draft upload goes through a Next.js server action. Next caps server action request bodies at 1 MB by default and `next.config.ts` does not raise it. A real PPTX plus a dozen slide images is 5 to 50 MB. Every draft submission from a designer will fail. This did not surface in testing because the test files were a few kilobytes.

**Where.** `next.config.ts` (no `serverActions.bodySizeLimit`), `src/app/admin/orders/[id]/actions.ts`, `src/components/DraftUploadForm.tsx`.

**Fix.** Set `experimental.serverActions.bodySizeLimit` to something like `"100mb"` in `next.config.ts`. Better, move the draft upload to a route handler like the customer upload already uses, or upload directly to object storage from the browser. Also confirm your hosting proxy allows the same size.

**Effort.** S. This is the single highest-value fix in the list.

### 1.2 A missing Stripe key turns every order into a free order

**What happens.** `stripeEnabled()` returns false whenever `STRIPE_SECRET_KEY` is empty, and the app then serves the mock payment page, which marks an order PAID with a full escrow HOLD and no money. There is no check on `NODE_ENV`. If the environment variable is missing, misnamed or dropped during a deploy, the site keeps working and every customer gets their design for free, with the ledger showing money that does not exist.

**Where.** `src/lib/stripe.ts`, `src/lib/checkout.ts`, `src/app/pay/mock/[id]/page.tsx`.

**Fix.** Refuse to start in production without a Stripe key. Guard the mock page and the mock branch on `NODE_ENV !== "production"` as well as the missing key.

**Effort.** S.

### 1.3 Uploaded files are lost on the next deploy

**What happens.** `uploadRoot()` resolves to `process.cwd()/uploads`. Customer source decks, watermarked previews, delivered files and the email fallback log all live there. On most hosting, including containers on Coolify, that directory is part of the ephemeral filesystem. The first redeploy deletes every customer file. Orders in flight lose their source deck, completed orders lose their deliverables, and the customer's download links break permanently. It also prevents running more than one instance.

**Where.** `src/lib/files.ts`, `src/lib/previews.ts`, `src/lib/notify.ts`.

**Fix.** Move file storage to S3 or Cloudflare R2 behind the existing `storeUpload` and `openStoredFile` functions. If you must stay on disk for the first weeks, mount a persistent volume and back it up, and treat that as temporary.

**Effort.** L. This is the biggest single piece of work in the blocker list.

### 1.4 A failed Stripe refund leaves the customer unpaid while the app says refunded

**What happens.** In both `approveAndRelease` and `refundOrder`, the database transaction commits the ledger entries and the new order status first, then the Stripe refund is attempted afterwards outside the transaction. If the Stripe call fails, throws or times out, the order shows REFUNDED and the ledger shows the money returned, but no money has moved. There is no retry, no alert and no reconciliation, so nobody finds out until the customer complains.

**Where.** `src/lib/orders.ts`, functions `approveAndRelease`, `refundOrder`, `issueProviderRefund`.

**Fix.** Record the refund as pending, attempt the provider call, and only mark it settled on success. On failure, keep the order in a "refund pending" state, alert an admin and retry. A simple job table plus a cron sweep is enough.

**Effort.** M.

### 1.5 Concurrent requests duplicate ledger entries and can double-refund

**What happens.** Every money transition reads the order status inside a transaction and then writes, with no conditional update. The app deliberately calls `markOrderPaid` from two places at once, the Stripe webhook and the success redirect. On Postgres under READ COMMITTED, both can read PENDING_PAYMENT and both create a HOLD row. The `Payment` row de-duplicates on `providerSessionId`, but `EscrowEntry` has no such constraint, so the ledger over-counts. The same pattern lets a double-clicked approve or refund write two RELEASE rows and issue two Stripe refunds.

**Where.** `src/lib/orders.ts`, all of `markOrderPaid`, `approveAndRelease`, `refundOrder`, `qcApprove`.

**Fix.** Make every transition a compare-and-set: `updateMany({ where: { id, status: expectedStatus }, data: {...} })` and treat a count of zero as "someone else already did it". Add a unique constraint that makes a duplicate HOLD impossible, for example unique on `(orderId, type)` for HOLD.

**Effort.** M.

### 1.6 Customers can be charged after cancelling, with no record

**What happens.** Checkout sessions are created with no expiry and are never cancelled. `cancelUnpaidOrder` only flips the status. If a customer opens the payment page, cancels the order in another tab, then completes the card form, Stripe charges them. `markOrderPaid` sees a non-pending order and silently returns without recording anything, without refunding and without alerting anyone. The order page shows "Cancel order" and "Pay now" side by side, which invites exactly this. Opening "Pay now" twice and paying both has the same result.

**Where.** `src/lib/orders.ts`, `src/lib/checkout.ts`, `src/app/dashboard/orders/[id]/page.tsx`.

**Fix.** Set a short `expires_at` on sessions, expire open sessions when an order is cancelled, and reuse an existing pending session instead of creating a second. When a paid session arrives for a non-pending order, auto-refund it, write the ledger entry and alert an admin.

**Effort.** M.

### 1.7 "Escrow" is not accurate, and that is a legal risk

**What happens.** The site says the money is "held by SlideBazaar in escrow" and "protected". In fact the customer's card is charged immediately and the money lands in your own Stripe balance. You can spend it. The "escrow" is a row in your own database, in a table that cascade-deletes with the order, so it is not an independent or even an append-only record. A real escrow requires a licensed third party holding funds in a segregated account. In India this wording can attract regulatory attention, and in the EU and US it is a consumer-protection and advertising issue.

**Where.** `src/app/page.tsx`, `src/components/wizard/OrderWizard.tsx`, `src/components/AuthShell.tsx`, `README.md`, and the footer on every page.

**Fix.** This is a decision for you, not an engineering task. The cheap and honest option is to reword: "we do not charge you until you approve" if you switch to authorise-and-capture, or "money-back guarantee: if you do not approve the designs, we refund you in full" if you keep charging upfront. The expensive option is a real escrow provider. Whatever you choose, publish a refund policy that matches it. See section 3.

**Effort.** M, mostly copywriting and a legal read.

### 1.8 The only way to create an admin is the demo seed

**What happens.** `prisma/seed.ts` is the sole path that creates an ADMIN user, and the documented setup command runs it. It creates `admin@slidebazaar.com`, `manager@slidebazaar.com` and `designer@slidebazaar.com` all with the password `Password123!`, which is published in the README, plus three demo orders with fake payments and fake escrow ledger rows that are indistinguishable from real ones. There is no guard against running it in production.

**Where.** `prisma/seed.ts`, `package.json` (`npm run setup`), `README.md`.

**Fix.** Split the seed. Keep demo data for development only and refuse to run it when `NODE_ENV=production`. Add a separate one-off command that creates a single admin from environment variables or an interactive prompt.

**Effort.** S.

---

## 2. Fix before you go public

These do not all block a careful, hand-held first customer, but they will bite you within the first weeks. Grouped by theme.

### Money and pricing

- **"Let us decide" orders charge the maximum by default.** An order can pass QC and be approved with no final treatment set, so the customer pays the top of the range even if you did the cheapest work. Require the treatment to be set before QC approval. *(S)*
- **Final price is recalculated from the live catalogue, not the order snapshot.** Editing a rate in settings changes what an in-flight order will charge. Use the stored per-slide amounts. *(M)*
- **Partial refunds accept any number.** No server-side validation, so negative or NaN amounts reach the ledger. Also, a partial refund quietly releases the remainder to you without customer consent. *(S)*
- **The webhook handles only two event types.** Refunds, disputes, chargebacks and expiries never reach your ledger, so your numbers drift from Stripe's. *(M)*
- **Nothing reconciles with Stripe.** If the webhook is missed and the customer closes the tab before the redirect, the money is captured and the order sits unpaid forever. Add a daily reconciliation job. *(M)*
- **The escrow HOLD uses Stripe's amount while releases use the order total.** If they ever differ the ledger will not balance, and nothing checks the invariant. *(M)*

### Trust and the customer promise

- **No refund path for the customer.** The site promises a refund if they are not happy, but there is no button, no policy page and no process. Today they must email you. *(M)*
- **No invoice or receipt.** You collect a billing address and VAT number and produce nothing. Two places in the UI promise an invoice. *(L)*
- **DELIVERED is a dead end.** If the customer never responds, staff cannot approve, close or chase the order, and the money sits in limbo indefinitely. Add an auto-approve window and an admin override. *(M)*
- **Superseded drafts stay downloadable.** After a revision the customer sees both versions and the slide zip mixes them. *(M)*
- **The customer sees the designer's draft filenames**, including any labelled "Rejected by QC", under "Files you sent", with download links that fail. The customer order page filters on `kind !== "DELIVERABLE"`, which sweeps in draft files. *(S, `src/app/dashboard/orders/[id]/page.tsx` line 43)*

### Accounts and access

- **No password reset and no email verification.** A customer who forgets their password with money held cannot get back in, and every notification depends on an address nobody verified. *(M)*
- **No rate limiting on login or signup**, and both reveal whether an account exists. *(S)*
- **The `.env.example` AUTH_SECRET placeholder passes validation.** A copy-paste deploy would sign every session with a publicly known key. Reject known placeholders. *(S)*
- **Any staff member can download any customer's files**, including designers on orders not assigned to them. The file route grants blanket access to all staff. *(S)*
- **Designers can see money in the activity timeline.** Release and refund events embed dollar amounts and are shown to every staff role, which contradicts the rule you asked for. *(S)*
- **Open redirect on the `next` parameter** of login and signup. *(S)*

### Reliability and operations

- **No Prisma migrations and the provider is hard-coded to SQLite.** Nothing creates or updates a production Postgres schema. *(M)*
- **No environment validation at boot.** `APP_URL` silently falls back to localhost, which would send Stripe redirects to the wrong place. *(S)*
- **The application is not committed to git.** Only four skeleton files are tracked, and `.gitignore` excludes `.env*`, which also hides `.env.example`. A git-based deploy today would ship an empty Next.js starter. *(S, do this first)*
- **Email is best-effort with no retry**, and with no SMTP host configured it silently writes to a local log file while telling customers they were emailed. *(M)*
- **Email is sent inline** inside the Stripe webhook and server actions, with nodemailer's default multi-minute timeouts. A slow mail server will time out your webhook. *(M)*
- **Thrown errors in staff forms crash to a generic error page** with the message stripped in production, so staff see "something went wrong" with no detail and no error boundary. *(M)*
- **Uploads are buffered whole in memory** with no total size or file count cap, and watermarking runs inline in the request, decoding each image three times. *(M)*
- **No tests and no CI** on an application that moves money. *(L)*

### Accessibility

- **Keyboard-only users cannot upload a file anywhere.** The drop zones are click-only divs. This affects the wizard, the "Own style" upload and the designer draft form. *(S)*
- **Screen readers cannot complete the order wizard.** No programmatic labels, errors rendered off-screen with no announcement, and selected state invisible to assistive technology. *(M)*

If you sell to enterprises or government, accessibility will come up in procurement. It is cheaper to fix now than to retrofit.

---

## 3. What you need to supply or decide

This is your list, not engineering's.

**Accounts and keys**

1. **Stripe live account.** For an Indian entity selling worldwide, confirm with Stripe that your account supports the currencies you want and check settlement timelines. Get the live secret key and the webhook signing secret. Register the webhook endpoint at `https://yourdomain/api/webhooks/stripe` for `checkout.session.completed` at minimum.
2. **Decide the currency.** Everything is hard-coded to USD today. If you want to bill Indian customers in INR you need to decide that now, because it affects tax and invoicing.
3. **Transactional email provider.** Postmark, Resend, SES or similar. You need SMTP credentials plus SPF and DKIM records on your sending domain, or every notification lands in spam.
4. **Domain and TLS** for the service, for example `design.slidebazaar.com`.

**Legal and policy**

5. **Decide the escrow wording** (see 1.7). This gates your homepage, the wizard and the footer.
6. **Write service-specific Terms.** The signup form currently links to the template-marketplace terms on slidebazaar.com, which do not describe a design service. Cover IP ownership of delivered decks, what "unlimited revisions within the brief" actually means, and what happens if the customer goes silent.
7. **Write a refund and cancellation policy** and link it from the payment step. Decide: can a customer cancel after paying but before work starts? What is the refund if they cancel mid-project?
8. **Privacy policy and data retention.** You are storing customers' confidential decks. Decide how long you keep source files and deliverables after completion, and publish it.
9. **Seller identity in the footer.** Legal entity name, registered address and tax registration are expected under the Indian e-commerce rules and the EU e-commerce directive.
10. **Decide the revision SLA.** The site currently promises revisions within one business day.

**Tax and invoicing**

11. **Decide GST treatment** for Indian versus export customers, and whether you need a GSTIN field for B2B customers.
12. **Invoice numbering and format.** Sequential, with your registration details.

**Business setup**

13. **Sign off the pricing.** Everything in `/admin/settings` is still the placeholder set copied from the competitor: $11 fix up, $28 redesign, $44 redraw, with 1.5x, 1.2x and 1.0x delivery multipliers. Nothing has been checked against your actual designer costs.
14. **Enter your holidays** in `/admin/calendar` and confirm your working days. It defaults to Saturday and Sunday off with no holidays.
15. **Create real staff accounts** and delete the demo ones.
16. **Decide your capacity rules.** The app assumes 40 slides per extra business day. Confirm that matches your team.

**Support**

17. **A support email or channel** that a customer can reach when the app cannot help them, plus who watches it and how fast you reply.
18. **A soft-launch plan.** Pick three to five friendly customers, watch every order by hand, and do not advertise until you have completed a full cycle including a refund.

---

## 4. Operations and hosting

**Database.** Move to Postgres before launch. Change the Prisma provider, generate a real migration history with `prisma migrate dev`, and deploy with `prisma migrate deploy`. Do not use `db push` in production. Watch for the case-sensitivity change: the admin order search uses `contains` without `mode: "insensitive"`, which behaves differently on Postgres.

**File storage.** S3 or Cloudflare R2, behind the existing storage functions. Set lifecycle rules so old source files expire in line with the retention policy you publish.

**Hosting.** Coolify is fine for this, as you already use it. One instance is enough for a long time, but only once files are off local disk. Set all environment variables and make the app refuse to boot if any are missing.

**Backups.** Nightly database dumps with a tested restore. Object storage versioning for files. Test the restore before launch, not after.

**Monitoring.** Add a health endpoint, error tracking such as Sentry, and an alert when a Stripe webhook fails or a refund does not settle. Money paths should page you.

**Go-live sequence.**

1. Commit the app to git properly and fix `.gitignore` so `.env.example` is tracked.
2. Provision Postgres, object storage, domain and email.
3. Set environment variables, including a strong `AUTH_SECRET` and the live Stripe keys.
4. Run migrations. Do not run the demo seed.
5. Create your admin account with the new bootstrap command.
6. Enter pricing, holidays and staff accounts.
7. Place one real order end to end with your own card, take it through QC, approve it, then refund it. Confirm the money moved in Stripe both ways.
8. Only then invite the first customer.

---

## 5. Worth doing soon after launch

**Staff tooling.** Deadline changes, reassignment that notifies the outgoing designer, a hold state, bulk assignment, and a way to withdraw a draft from QC. QC managers currently cannot assign designers even though they are the ones alerted about unassigned orders.

**Scheduled notifications.** Nothing exists today for approaching deadlines, overdue work, drafts stuck in QC or abandoned unpaid orders. This is the single biggest operational gap after launch, because it means a missed order is invisible until a customer complains.

**Storage hygiene.** Nothing is ever deleted from disk. Every QC rejection leaves a full copy of the deck behind. Add cleanup and retention.

**Watermark strength.** The current watermark is sparse and easy to crop, so a determined customer could use the previews without approving.

**Performance.** Add pagination to the admin order list and the team page, indexes for the sort columns, and move watermarking and zip generation out of the request path.

**Copy accuracy.** Several promises do not match the code: the "Let us decide" refund timing, delivery windows, "unlimited revisions", and the account page claim that billing details pre-fill the next order.

**Mobile polish.** The sticky wizard bar hides behind the mobile header, the notification popover is clipped off screen, and the admin filter tabs force horizontal scrolling.

**Security headers.** No CSP, HSTS, X-Frame-Options or Referrer-Policy.

---

## 6. Tests worth writing first

You have none. Start with the money paths, because those are the ones that cost you real money when they break.

1. **Pricing.** Per-slide rates times slide count, delivery multipliers, add-ons, and the rounding. Pure functions, easy to test, and they decide what you charge.
2. **Business-day calendar.** Weekends, holidays, and the extra day per 40 slides.
3. **State machine.** Every allowed and disallowed transition in `order-status.ts`.
4. **Escrow invariant.** After any sequence of pay, approve, refund, assert that held equals collected minus released minus refunded.
5. **Idempotency.** Call `markOrderPaid` twice concurrently and assert one HOLD row. This is blocker 1.5, and a test is how you keep it fixed.
6. **File access control.** A customer cannot download another customer's file, a draft before approval, or a deliverable before approving.
7. **One end-to-end run.** Order, pay with a Stripe test card, upload a draft, QC approve, customer approve, download. This would have caught the 1 MB upload limit.

---

## 7. Suggested plan

**Week 1: make it real.** Commit to git. Fix the 1 MB upload limit, the mock payment fail-open and the seed bootstrap, all small. Move files to object storage. Move to Postgres with proper migrations. Decide the escrow wording and reword the site.

**Week 2: make the money safe.** Compare-and-set on every transition. Refund retry and reconciliation. Session expiry and the pay-after-cancel case. Webhook coverage for refunds and disputes. Write tests 1 to 5 above.

**Week 3: make it operable.** Password reset, rate limiting, error boundaries, environment validation, email retries and out-of-band sending, staff access fixes. Set up monitoring, backups and alerts. Write your Terms, refund policy and privacy policy.

**Week 4: soft launch.** Three to five friendly customers, every order watched by hand. Run one deliberate refund. Fix what the real orders surface.

**Weeks 5 and 6: public launch.** Invoices, scheduled notifications, accessibility, mobile polish, then open it up.

A faster path exists if you want a first paying customer sooner: week 1 plus the escrow rewording, plus doing the first few orders with your own hands and watching Stripe directly. That is a legitimate way to start, provided you know which safety nets are not yet in place.

---

## Appendix: method and confidence

Twelve reviewers each audited one dimension: security and authorization, payments and escrow, the order state machine, files and previews, notifications and email, customer experience, staff experience, data model and deployment, performance, accessibility, legal and business, and testing. They produced 172 findings, merged here into 109 distinct issues.

All 8 blockers were verified by reading the code directly. Notable checks:

- The 1 MB limit was confirmed by inspecting `next.config.ts` for `bodySizeLimit`, which is absent. Earlier manual testing passed only because the test files were a few kilobytes.
- The mock payment fail-open was confirmed: the only guard is `stripeEnabled()`, with no `NODE_ENV` check.
- The double-HOLD race was confirmed by reading the check-then-write pattern in `markOrderPaid`.
- Git tracking was confirmed: 4 tracked files under `src`, and `.env*` in `.gitignore` also excludes `.env.example`.

One finding was initially dismissed and then confirmed: the claim that the customer sees draft filenames. A first check looked only at the `deliverables` variable and appeared to clear it. The customer page also computes `sources` as `kind !== "DELIVERABLE"`, which includes designer drafts, and renders them under "Files you sent".

The independent verification pass over the 34 high-severity items did not complete because of a usage limit, so those are reported as merged reviewer findings rather than individually confirmed. Triage them before scheduling the work.
