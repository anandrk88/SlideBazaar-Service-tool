import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markOrderPaid } from "@/lib/orders";
import { mockPaymentsActive } from "@/lib/stripe";
import { money } from "@/lib/format";
import { LockIcon } from "@/components/Icons";

/**
 * Development-only stand-in for Stripe Checkout. Active when STRIPE_SECRET_KEY
 * is empty. Simulates a successful card payment.
 */
export default async function MockPayPage({ params }: { params: Promise<{ id: string }> }) {
  // Development only. Production refuses to start without a Stripe key, so
  // this page can never mark a real order paid with no money behind it.
  if (!mockPaymentsActive()) notFound();
  const user = await requireUser();
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.customerId !== user.id) redirect("/dashboard");
  if (order.status !== "PENDING_PAYMENT") redirect(`/dashboard/orders/${id}`);

  async function pay() {
    "use server";
    await markOrderPaid({ orderId: id, provider: "MOCK", amountCents: order!.totalCents, currency: order!.currency });
    revalidatePath("/dashboard");
    redirect(`/dashboard/orders/${id}?paid=1`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Test mode: Stripe is not configured, so this page simulates the card payment.
        </div>
        <h1 className="text-xl font-semibold">Pay {money(order.totalCents)}</h1>
        <p className="mt-1 text-sm text-muted">Order {order.orderNumber}</p>
        <form action={pay} className="mt-6 space-y-4">
          <div>
            <label className="label">Card number</label>
            <input className="input" defaultValue="4242 4242 4242 4242" readOnly />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Expiry</label>
              <input className="input" defaultValue="12/30" readOnly />
            </div>
            <div>
              <label className="label">CVC</label>
              <input className="input" defaultValue="123" readOnly />
            </div>
          </div>
          <button className="btn-primary w-full">
            <LockIcon width={16} height={16} /> Pay {money(order.totalCents)}
          </button>
        </form>
      </div>
    </div>
  );
}
