import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { confirmStripeSession } from "@/lib/checkout";

/**
 * Stripe redirects here after Checkout. We verify the session server-side so
 * the order is marked paid even if the webhook has not arrived yet.
 */
export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; session_id?: string }>;
}) {
  const user = await requireUser();
  const { order: orderId, session_id: sessionId } = await searchParams;
  if (!orderId) redirect("/dashboard");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.customerId !== user.id) redirect("/dashboard");

  if (order.status === "PENDING_PAYMENT" && sessionId) {
    try {
      await confirmStripeSession(orderId, sessionId);
    } catch {
      // The webhook will settle it; fall through to the order page.
    }
  }
  redirect(`/dashboard/orders/${orderId}?paid=1`);
}
