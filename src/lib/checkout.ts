import "server-only";
import type { Order, User } from "@prisma/client";
import { prisma } from "./db";
import { appUrl, stripe, mockPaymentsActive } from "./stripe";
import { markOrderPaid } from "./orders";
import { ensureStripeCustomer } from "./cards";

type CustomerLike = Pick<User, "id" | "email" | "name" | "stripeCustomerId">;

/** How long a checkout session stays payable. Kept short so a stale tab cannot be paid days later. */
const SESSION_MINUTES = 60;

/**
 * Returns the URL the customer should be sent to in order to pay the order
 * upfront. With Stripe configured this is a hosted Checkout page that offers
 * the customer's saved cards. The mock page is only ever used in development
 * (see src/lib/env.ts: production refuses to start without a Stripe key).
 *
 * An existing open session is reused rather than creating a second one, so a
 * customer cannot end up with two payable sessions for the same order.
 */
export async function createCheckoutUrl(order: Order, customer: CustomerLike) {
  if (order.status !== "PENDING_PAYMENT") throw new Error("Order is not awaiting payment");

  if (mockPaymentsActive()) {
    return `${appUrl()}/pay/mock/${order.id}`;
  }

  const open = await prisma.payment.findFirst({
    where: { orderId: order.id, status: "PENDING", provider: "STRIPE" },
    orderBy: { createdAt: "desc" },
  });
  if (open?.providerSessionId) {
    try {
      const existing = await stripe().checkout.sessions.retrieve(open.providerSessionId);
      if (existing.status === "open" && existing.url) return existing.url;
      // Expired or already completed: stop tracking it as payable.
      await prisma.payment.update({ where: { id: open.id }, data: { status: existing.status === "complete" ? "SUCCEEDED" : "FAILED" } });
    } catch {
      await prisma.payment.update({ where: { id: open.id }, data: { status: "FAILED" } });
    }
  }

  const customerId = await ensureStripeCustomer(customer);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : customer.email,
    client_reference_id: order.id,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
    saved_payment_method_options: { payment_method_save: "enabled" },
    payment_intent_data: {
      description: `SlideBazaar custom design ${order.orderNumber}`,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      setup_future_usage: "off_session",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: order.currency,
          unit_amount: order.totalCents,
          product_data: {
            name: `Custom slide design ${order.orderNumber} (${order.slideCount} slides)`,
            description: "Held by SlideBazaar and released only when you approve the final designs. Refunded in full if you do not.",
          },
        },
      },
    ],
    expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
    success_url: `${appUrl()}/order/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/dashboard/orders/${order.id}?cancelled=1`,
  });

  await prisma.payment.upsert({
    where: { providerSessionId: session.id },
    create: { orderId: order.id, provider: "STRIPE", providerSessionId: session.id, amountCents: order.totalCents, currency: order.currency, status: "PENDING" },
    update: {},
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Verify a Stripe Checkout session server-side and mark the order paid if settled. */
export async function confirmStripeSession(orderId: string, sessionId: string) {
  if (mockPaymentsActive()) return false;
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  if (session.metadata?.orderId !== orderId) return false;
  if (session.payment_status !== "paid") return false;
  await markOrderPaid({
    orderId,
    provider: "STRIPE",
    providerSessionId: session.id,
    providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  });
  return true;
}
