# SlideBazaar Custom Design Services

Ordering platform for SlideBazaar's custom presentation design service. Customers configure a job in a five-step
wizard and pay the estimate upfront. SlideBazaar holds the payment while designers work; the customer requests
revisions or approves. Only approval releases the payment to SlideBazaar. Otherwise it is refunded in full.

This is a money-back guarantee, not a legal escrow. See the wording note below before changing customer-facing copy.

## The flow

The step structure follows the industry-standard order wizard (the same one 24Slides uses) because customers find
it intuitive. The visual design is SlideBazaar's own.

1. **Treatment.** Let us decide, Fix up, Redesign or Redraw, priced per slide.
2. **Style.** Own style (upload your template), Corporate, Creative or Playful.
3. **Delivery.** Slide count, three delivery dates (Rush, Priority, Standard) with per-slide prices, optional
   proofreading or editing with UK/US spelling.
4. **Files & details.** Upload the deck (a `.pptx` is read in the browser and the slide count can be corrected in
   one click), or a Google Slides link, plus the brief and optional extras.
5. **Payment.** Inline signup or login, billing details, sticky order summary, pay.

## Stack

- Next.js 15 (App Router, server actions) + React 19 + TypeScript + Tailwind CSS 4
- Prisma 6 with SQLite for development (switch `provider` to `postgresql` for production)
- Stripe Checkout for card payments, with a built-in mock checkout when no Stripe key is configured
- `jszip` for browser-side PPTX reading, `jose` cookie sessions, `bcryptjs` password hashing
- File storage via `src/lib/storage.ts`: S3 or Cloudflare R2 when `S3_BUCKET` is set, local disk otherwise (development only)

## Quick start

```bash
npm install
cp .env.example .env        # set AUTH_SECRET for anything public
npm run setup               # prisma generate + db push + seed demo data
npm run dev                 # http://localhost:3000
```

Seeded logins (password `Password123!`):

| Email                     | Role     | Sees                                                                          |
| ------------------------- | -------- | ----------------------------------------------------------------------------- |
| admin@slidebazaar.com     | ADMIN    | Everything: queue, escrow ledger, team, assignments, refunds, QC approval      |
| manager@slidebazaar.com   | MANAGER  | Queue with pricing, escrow ledger, QC approval of designer drafts              |
| designer@slidebazaar.com  | DESIGNER | Own assignments only: brief, deadline, customer name, files, messages. No money |
| customer@example.com      | CUSTOMER | Own orders, approve/revise, messages                                          |

## Home pages per role

| Role     | Lands on          | Shows                                                                                      |
| -------- | ----------------- | ------------------------------------------------------------------------------------------ |
| Customer | `/dashboard`      | Needs-your-attention (pay, review), orders, amount held, latest messages from the team      |
| Designer | `/admin` (tasks)  | To-do cards with next action and countdown, waiting on QC/customer, recently approved       |
| Manager  | `/admin` (QC)     | Review queue, revisions coming back, with customers, recent QC decisions, amount held       |
| Admin    | `/admin`          | Needs-attention list, on-time rate, team workload, escrow, activity feed; `/admin/orders` for the full list |

## Roles and the quality-check step

Designers never see prices, escrow, payments, billing or the customer's contact details. Their queue defaults to
orders assigned to them and shows deadline, treatment, slide count and customer name.

A designer cannot send work straight to the customer. Uploading a draft moves the order to **Quality check**
(`QC_REVIEW`); the files are stored as `DRAFT` and are staff-only. A QC manager (or admin) then either:

- **Approves and delivers**: the files become `DELIVERABLE`, the order moves to `DELIVERED`, and the customer is
  asked to review; or
- **Sends it back** with feedback: the order returns to `IN_PROGRESS`. The feedback is an internal event the
  customer never sees.

Internal notes (QC feedback, staff notes) live on the order under "Team notes" and are filtered out of the
customer's activity timeline.

## Previews before approval, downloads after

When a designer submits a draft they upload two things: the design files (PPTX, PDF, source) and one image per
slide (PNG/JPG, exported from PowerPoint). The images are downscaled and watermarked with `sharp`
(`src/lib/previews.ts`) and stored as `SlidePreview` rows for that draft version.

- Until QC approves, only staff can see the previews.
- After QC approves, the customer sees the watermarked previews on the order page. The download API refuses
  design files for customers until the order is approved.
- When the customer approves, the files unlock for download and the payment is released.

## Notifications

Every important step creates an in-app notification (bell in the header, `/notifications` page) and sends an email
with the same content (`src/lib/notify.ts`). Recipients:

| Event                          | Customer | Designer | QC managers | Admins |
| ------------------------------ | -------- | -------- | ----------- | ------ |
| Payment received               | yes      |          |             | yes    |
| Designer assigned              |          | yes      |             |        |
| Draft submitted for QC         |          |          | yes         | yes    |
| QC approved / draft delivered  | yes      | yes      |             |        |
| QC sent back                   |          | yes      |             |        |
| Customer requested revision    |          | yes      | yes         |        |
| Customer approved              | yes      | yes      |             | yes    |
| Refund issued                  | yes      | yes      |             |        |
| New message                    | other side of the conversation                       |

Email goes through SMTP when `SMTP_HOST` is set in `.env`; otherwise each email is appended to `uploads/outbox.log`
so you can read it during development.

## How the payment hold works

```
PENDING_PAYMENT --pay--> PAID (escrow HELD) --start--> IN_PROGRESS --designer uploads--> QC_REVIEW
     |                                                     ^                                 |
     +--cancel--> CANCELLED                                |<------ QC sends back ------------+
                                                           |                                 | QC approves
                                                           +<---- customer revision ---- DELIVERED
                                                                                             | customer approves
                                                                                             v
                                                                       APPROVED (escrow RELEASED) --> COMPLETED
Any paid state --refund (admin)--> REFUNDED
```

- **HOLD**: the full estimate is charged when the customer pays. For "Let us decide" the upper bound is charged.
- **RELEASE**: on approval the final amount is recognised as earned. If the team applied a cheaper treatment than the
  amount held, the difference is refunded through Stripe.
- **REFUND**: admins can refund in full or in part from any paid state; a partial refund releases the remainder.
- Every movement is a row in `EscrowEntry` with an idempotency key, so a duplicate write is a no-op. The ledger page
  proves `held = collected - released - refunded`.
- Every status change is a conditional update (`updateMany` with the expected status in the WHERE clause), so two
  concurrent callers cannot both succeed. The loser raises `ConcurrentUpdateError`.
- Refunds are recorded as a `RefundAttempt` and settled against Stripe separately. A failure leaves a retryable row,
  alerts admins and appears on the admin overview; it never silently reports success. `npm run refunds:settle` is the
  sweeper, and it should run on a schedule.

**Wording note.** This is not a legal escrow: the money is charged to SlideBazaar's own Stripe balance. Customer-facing
copy therefore says the payment is *held by SlideBazaar* and *refunded in full if you do not approve*, which is a
money-back guarantee. Do not reintroduce the word "escrow" in customer-facing copy without legal advice. Internal
staff pages and the database still use "escrow" as accounting terminology.

## Pricing & services (admin settings)

Admins edit the catalogue at `/admin/settings`: each treatment's name, tagline, description, per-slide rate,
badge and whether it is offered; each style (name, description, whether the customer must upload a template,
offered); delivery speeds (name, business days, price multiplier, note); text services (name, description,
per-slide price). New treatments and styles can be added; existing ones are switched off rather than deleted so
past orders keep their labels. The catalogue lives in the database (`TreatmentOption`, `StyleOption`,
`DeliveryTierOption`, `TextServiceOption`), seeded from the defaults in `src/lib/catalog.ts` on first run.

Orders store a price snapshot, so changing rates never changes an existing order.

## Account page

Every user has `/account` (user menu, "Account settings"): name, phone, company, password change. Customers also
get billing details (pre-filled on the next order) and payment methods:

- With Stripe configured, cards are stored by Stripe. "Add a card" opens a Stripe-hosted setup page and returns to
  the account page; the list, default and remove actions call Stripe. Checkout then offers the saved cards and
  saves new ones for future orders.
- Without Stripe, the page runs in test mode with placeholder cards (brand, last four, expiry only) so the flow can
  be tried. No card numbers are ever stored by the app in either mode.

## Default prices

Defaults seeded into the settings (placeholders):

| Treatment     | Standard (3 days) | Priority (2 days) | Rush (next day) |
| ------------- | ----------------- | ----------------- | --------------- |
| Fix up        | $11               | $13               | $17             |
| Redesign      | $28               | $34               | $42             |
| Redraw        | $44               | $53               | $66             |
| Let us decide | $11-44            | $13-53            | $17-66          |

Proofreading $1 per slide, editing $3 per slide. Decks over 40 slides add one business day per extra 40 slides.

## Business calendar (delivery dates)

"First draft by" dates count working days only. Admins manage the calendar at `/admin/calendar`:

- **Weekly days off**: tick the weekdays the studio does not work (default Saturday and Sunday).
- **Public holidays and closures**: add dated closures with a name. Dates skip them.

The same logic (`src/lib/calendar.ts`) runs in the browser for the live estimate and on the server when the order is
created, so the stored deadline always matches what the customer saw. Changing the calendar affects new orders only.

## Stripe

1. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `APP_URL` in `.env`.
2. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` locally, or register
   `https://<host>/api/webhooks/stripe` for `checkout.session.completed`.
3. `/order/success` also verifies the Checkout session server-side, so orders are marked paid even if the webhook is delayed.

Refunds call `stripe.refunds.create` against the original PaymentIntent. Without a Stripe key the mock page at
`/pay/mock/:id` simulates payment and refunds are ledger-only.

## Project layout

```
prisma/schema.prisma          users, orders, files, payments, escrow ledger, events, messages
prisma/seed.ts                demo accounts and orders
src/lib/catalog.ts            treatments, styles, delivery tiers, proofreading options
src/lib/pricing.ts            quote engine
src/lib/pptx.ts               browser-side PPTX reader (slide count and titles)
src/lib/order-status.ts       state machine and labels
src/lib/orders.ts             order service: pay, assign, start, deliver, revise, approve/release, refund
src/lib/checkout.ts           Stripe Checkout session creation and verification
src/lib/auth.ts               sessions, password hashing, role guards
src/middleware.ts             protects /dashboard and /admin
src/components/wizard         the five-step order wizard
src/app/dashboard             customer orders and order detail (approve, revise, message)
src/app/admin                 staff queue, order workflow, escrow ledger, team
src/app/api                   auth, order creation (multipart), checkout, Stripe webhook, file download
```

## Deploying to production

The app refuses to start in production if the environment is unsafe (`src/lib/env.ts`, wired in via
`src/instrumentation.ts`). It checks for a real `AUTH_SECRET` that is not the example value, an https `APP_URL`, a
Stripe secret and webhook secret, SMTP, and a non-SQLite `DATABASE_URL`. This is deliberate: without a Stripe key the
app would otherwise serve the mock payment page and mark orders paid with no money behind them.

1. **Database.** Set the Prisma provider to `postgresql`, generate a migration history with `npm run db:migrate:dev`
   once locally, then deploy with `npm run db:migrate`. Do not use `db push` in production. Note that the admin order
   search uses `contains`, which becomes case-sensitive on Postgres; add `mode: "insensitive"` when you switch.
2. **File storage.** Set `S3_BUCKET` and credentials (`S3_ENDPOINT` too for Cloudflare R2 or MinIO). Without it,
   uploads go to local disk and are lost on the next deploy; the admin overview shows a warning in production.
3. **Email.** Set `SMTP_HOST` and friends, with SPF and DKIM on the sending domain.
4. **First admin.** Do not run the demo seed; it refuses to run against a non-local database anyway. Use:
   `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run admin:create`
5. **Scheduled job.** Run `npm run refunds:settle` every 15 minutes so a failed refund is retried.
6. **Before the first real order.** Enter real prices in `/admin/settings`, holidays in `/admin/calendar`, and create
   real staff accounts. Then place one live order with your own card and refund it, to confirm money moves both ways.

See `docs/LAUNCH-READINESS.md` for the full audit and the remaining work.

## Checks

- `npm run typecheck` and `npm run lint`
- `npm run verify:money` runs money-path regression checks against the development database: concurrent payment,
  double approval, payment after cancellation, range-order pricing, refund validation and the ledger invariant.

## Not built yet

- Google and Microsoft sign-in; the session layer supports adding them.
- Password reset and email verification.
- Invoices and tax handling.
