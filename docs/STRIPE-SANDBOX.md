# Testing payments with a Stripe sandbox

The app has two payment modes and picks between them automatically:

| `STRIPE_SECRET_KEY` | What happens |
| --- | --- |
| empty, `NODE_ENV` not production | Mock payment page at `/pay/mock/[id]`. No money, no Stripe account needed. Orders are marked paid instantly. |
| set | Real Stripe Checkout. In a sandbox, test cards only. |
| empty, `NODE_ENV=production` | The app refuses to start. This is deliberate: a missing key in production would hand out free orders. |

So switching to Stripe is only a matter of filling in two variables.

## 1. Get the sandbox keys

1. Sign in at <https://dashboard.stripe.com>.
2. Make sure you are in a **sandbox** (top-left account switcher, or the Test mode toggle).
   Sandbox keys start with `sk_test_` and `pk_test_`. A key starting `sk_live_` moves real money.
3. Go to **Developers > API keys** and copy the **Secret key**.

Only the secret key is needed. The app never renders a Stripe form itself: it redirects
to Stripe-hosted Checkout, so there is no publishable key in the front end.

## 2. Put it in `.env`

```
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET=""     # filled in by step 3
APP_URL="http://localhost:3000"
```

`APP_URL` is what Stripe sends the customer back to after paying, so it must match
where you are actually running the app.

Restart `npm run dev` after editing `.env`. Next.js only reads it at boot.

## 3. Forward webhooks to your machine

This is the step people miss. Stripe cannot reach `localhost`, so without it the customer
pays, gets redirected back, and the order stays stuck on "pending payment" forever. The
order is only marked paid by `POST /api/webhooks/stripe`.

Install the Stripe CLI (<https://stripe.com/docs/stripe-cli>), then in a second terminal:

```bash
stripe login
```

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

It prints a signing secret that looks like `whsec_...`. Put that in `.env` as
`STRIPE_WEBHOOK_SECRET` and restart the dev server.

Leave `stripe listen` running for the whole test session. The secret changes each time you
start it, so if payments stop being recorded, check that value first.

The app handles `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
Everything else is acknowledged and ignored.

## 4. Test cards

Use these on the Stripe Checkout page. Any future expiry, any CVC, any postcode.

| Card number | Result |
| --- | --- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Declined, insufficient funds |
| `4000 0000 0000 0002` | Declined, generic |

Full list: <https://stripe.com/docs/testing>

## 5. What to walk through

Placing and paying for an order exercises Checkout in `payment` mode:

1. Log in as the customer, place an order, pay with `4242 4242 4242 4242`.
2. Watch the `stripe listen` terminal for `checkout.session.completed`.
3. The order should move to **Paid** and the ledger should show a `COLLECT` entry.

Saving a card exercises Checkout in `setup` mode, which is a separate flow:

4. Go to **Account > billing and cards** and add a card. This creates a Stripe
   customer and a saved payment method, with no charge.

Refunds go through the Stripe API directly, not Checkout:

5. As admin, refund an order. Confirm the refund appears in the Stripe dashboard
   under **Payments**, and that `npm run verify:money` still passes.

Try the decline card too. The order should stay unpaid rather than half-transitioning.

## Going live later

Swap `sk_test_` for `sk_live_`, register a real webhook endpoint at
`https://design.slidebazaar.com/api/webhooks/stripe` under **Developers > Webhooks**
(subscribe to `checkout.session.completed` and `checkout.session.async_payment_succeeded`),
and use the signing secret that page gives you. Set `APP_URL` to the live URL.

The startup check in `src/lib/env.ts` will refuse to boot in production if either Stripe
variable is missing, so a half-finished switchover fails loudly instead of quietly.
