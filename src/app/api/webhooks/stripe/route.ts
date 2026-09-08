import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/orders";

/**
 * POST /api/webhooks/stripe
 * Marks orders paid when Stripe confirms the Checkout session. Locally, run:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 */
export async function POST(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    if (!secret || !sig) throw new Error("Missing webhook secret or signature");
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${err instanceof Error ? err.message : err}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (orderId && session.payment_status === "paid") {
      await markOrderPaid({
        orderId,
        provider: "STRIPE",
        providerSessionId: session.id,
        providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
      });
    }
  }

  return NextResponse.json({ received: true });
}
