import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { appUrl, stripe, mockPaymentsActive } from "./stripe";

export interface CardSummary {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

type CustomerLike = Pick<User, "id" | "email" | "name" | "stripeCustomerId">;

/** Find or create the Stripe customer for a user. Returns null when Stripe is not configured. */
export async function ensureStripeCustomer(user: CustomerLike) {
  if (mockPaymentsActive()) return null;
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Saved cards: live from Stripe, or the test-mode table when Stripe is off. */
export async function listCards(user: CustomerLike): Promise<CardSummary[]> {
  if (mockPaymentsActive()) {
    const rows = await prisma.savedCard.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => ({ id: r.id, brand: r.brand, last4: r.last4, expMonth: r.expMonth, expYear: r.expYear, isDefault: r.isDefault }));
  }
  const customerId = await ensureStripeCustomer(user);
  if (!customerId) return [];
  const [methods, customer] = await Promise.all([
    stripe().paymentMethods.list({ customer: customerId, type: "card", limit: 20 }),
    stripe().customers.retrieve(customerId),
  ]);
  const defaultId = customer.deleted ? null : (customer.invoice_settings?.default_payment_method as string | null);
  return methods.data.map((m) => ({
    id: m.id,
    brand: m.card?.brand ?? "card",
    last4: m.card?.last4 ?? "????",
    expMonth: m.card?.exp_month ?? 0,
    expYear: m.card?.exp_year ?? 0,
    isDefault: m.id === defaultId,
  }));
}

/** URL of the Stripe-hosted page where the customer enters a new card. */
export async function addCardUrl(user: CustomerLike) {
  const customerId = await ensureStripeCustomer(user);
  if (!customerId) throw new Error("Card storage requires Stripe. Set STRIPE_SECRET_KEY in .env.");
  const session = await stripe().checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: `${appUrl()}/account?card=added`,
    cancel_url: `${appUrl()}/account?card=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a URL");
  return session.url;
}

export async function setDefaultCard(user: CustomerLike, cardId: string) {
  if (mockPaymentsActive()) {
    await prisma.$transaction([
      prisma.savedCard.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
      prisma.savedCard.updateMany({ where: { userId: user.id, id: cardId }, data: { isDefault: true } }),
    ]);
    return;
  }
  const customerId = await ensureStripeCustomer(user);
  if (!customerId) return;
  const method = await stripe().paymentMethods.retrieve(cardId);
  if (method.customer !== customerId) throw new Error("That card does not belong to you");
  await stripe().customers.update(customerId, { invoice_settings: { default_payment_method: cardId } });
}

export async function removeCard(user: CustomerLike, cardId: string) {
  if (mockPaymentsActive()) {
    await prisma.savedCard.deleteMany({ where: { userId: user.id, id: cardId } });
    return;
  }
  const customerId = await ensureStripeCustomer(user);
  const method = await stripe().paymentMethods.retrieve(cardId);
  if (method.customer !== customerId) throw new Error("That card does not belong to you");
  await stripe().paymentMethods.detach(cardId);
}

/** Test mode only: record a placeholder card so the UI can be exercised without Stripe. */
export async function addTestCard(userId: string, brand: string, last4: string, expMonth: number, expYear: number) {
  if (!mockPaymentsActive()) throw new Error("Use the Stripe page to add a real card");
  const count = await prisma.savedCard.count({ where: { userId } });
  await prisma.savedCard.create({ data: { userId, brand, last4, expMonth, expYear, isDefault: count === 0 } });
}
