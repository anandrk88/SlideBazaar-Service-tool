import Link from "next/link";
import { requireMoneyAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { escrowSummary } from "@/lib/orders";
import { money, dateTime } from "@/lib/format";

export const metadata = { title: "Escrow ledger | SlideBazaar Admin" };

export default async function EscrowPage() {
  await requireMoneyAccess();
  const summary = await escrowSummary();
  const entries = await prisma.escrowEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { order: { select: { orderNumber: true, id: true, customer: { select: { name: true } } } }, createdBy: { select: { name: true } } },
  });
  const heldOrders = await prisma.order.findMany({
    where: { escrowStatus: "HELD" },
    select: { id: true, orderNumber: true, totalCents: true, status: true, customer: { select: { name: true } } },
    orderBy: { paidAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Escrow ledger</h1>
      <p className="text-sm text-muted">
        Append-only record of every movement of customer funds. Held balance must always equal collected minus released
        minus refunded.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Collected" value={money(summary.collectedCents)} />
        <Stat label="Currently held" value={money(summary.heldCents)} hint={`${heldOrders.length} orders`} />
        <Stat label="Released to SlideBazaar" value={money(summary.releasedCents)} />
        <Stat label="Refunded" value={money(summary.refundedCents)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Funds currently held</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {heldOrders.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted">Nothing held.</td>
                </tr>
              )}
              {heldOrders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                      {o.orderNumber}
                    </Link>
                    <p className="text-xs text-muted">{o.customer.name}</p>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">{o.status.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-4 py-2 text-right font-semibold">{money(o.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Recent entries</h2>
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      <span
                        className={`chip ${
                          e.type === "HOLD" ? "bg-amber-100 text-amber-800" : e.type === "RELEASE" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/admin/orders/${e.order.id}`} className="font-semibold text-brand-700 hover:underline">
                        {e.order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted">
                        {dateTime(e.createdAt)}
                        {e.createdBy ? ` · ${e.createdBy.name}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">{money(e.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
