import "server-only";
import Stripe from "stripe";
import { isProduction, mockPaymentsAllowed, stripeConfigured } from "./env";

let client: Stripe | null = null;

/**
 * True when real card payments are in use. In production this is always true:
 * the app refuses to start without a Stripe key (see src/lib/env.ts), so an
 * accidentally empty key can never fall back to free mock orders.
 */
export function stripeEnabled() {
  if (isProduction) return true;
  return stripeConfigured();
}

/** True only in development with no Stripe key, where payments are simulated. */
export function mockPaymentsActive() {
  return mockPaymentsAllowed();
}

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    client = new Stripe(key);
  }
  return client;
}

// Re-exported so existing importers (cards, checkout, notify, logout) are unchanged.
export { appUrl } from "./env";
