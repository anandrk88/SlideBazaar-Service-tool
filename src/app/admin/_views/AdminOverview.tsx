import Link from "next/link";
import { prisma } from "@/lib/db";
import { escrowSummary, unsettledRefunds } from "@/lib/orders";
import { isProduction } from "@/lib/env";
import { storageIsEphemeral } from "@/lib/storage";
import { retryRefundAction } from "../actions";
import { money, shortDate, dateTime } from "@/lib/format";
import { lookups } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { ACTIVE_STATUSES } from "@/lib/order-status";
import { adminAttention, countdown, TONE_CLASSES } from "@/lib/tasks";
import { StatusBadge } from "@/components/Badges";

export async function AdminOverview() {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 864e5);

  const [active, recentDelivered, events, summary, designers, monthReleased, unpaid] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      include: { customer: { select: { name: true } }, designer: { select: { name: true } } },
      orderBy: { deadlineAt: "asc" },
    }),
    prisma.order.findMany({ where: { deliveredAt: { gte: thirtyDaysAgo } }, select: { deliveredAt: true, deadlineAt: true } }),
    prisma.orderEvent.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: { order: { select: { id: true, orderNumber: true } }, actor: { select: { name: true } } },
    }),
    escrowSummary(),
    prisma.user.findMany({
      where: { role: { in: ["DESIGNER", "MANAGER", "ADMIN"] } },
      select: { id: true, name: true, role: true, assignedOrders: { where: { status: { in: ACTIVE_STATUSES } }, select: { status: true, deadlineAt: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.escrowEntry.aggregate({ _sum: { amountCents: true }, where: { type: "RELEASE", createdAt: { gte: thirtyDaysAgo } } }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT", createdAt: { gte: new Date(now - 7 * 864e5) } } }),
  ]);

  const [lk, unsettled] = await Promise.all([loadCatalog().then(lookups), unsettledRefunds()]);
  const storageWarning = isProduction && storageIsEphemeral();
  const attention = active
    .map((o) => ({ order: o, hint: adminAttention(o, now) }))
    .filter((x): x is { order: (typeof active)[number]; hint: NonNullable<ReturnType<typeof adminAttention>> } => x.hint !== null)
    .sort((a, b) => (a.hint.tone === "alert" ? -1 : 1) - (b.hint.tone === "alert" ? -1 : 1));

  const count = (s: string) => active.filter((o) => o.status === s).length;
  const overdue = active.filter((o) => o.deadlineAt.getTime() < now && !o.deliveredAt).length;
  const onTime = recentDelivered.filter((o) => o.deliveredAt && o.deliveredAt <= o.deadlineAt).length;
  const onTimeRate = recentDelivered.length ? Math.round((onTime / recentDelivered.length) * 100) : null;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Operations</p>
        <h1 className="mt-1 text-2xl font-bold">What is happening right now</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active orders" value={String(active.length)} hint={`${count("PAID")} in queue · ${count("IN_PROGRESS") + count("REVISION_REQUESTED")} designing`} />
        <Stat label="Overdue" value={String(overdue)} hint="First draft past deadline" accent={overdue > 0} />
        <Stat label="Awaiting QC" value={String(count("QC_REVIEW"))} hint="Drafts waiting for a manager" accent={count("QC_REVIEW") > 0} />
        <Stat label="With customers" value={String(count("DELIVERED"))} hint="Delivered, awaiting approval" />
        <Stat label="On-time delivery" value={onTimeRate === null ? "n/a" : `${onTimeRate}%`} hint={`${onTime} of ${recentDelivered.length} drafts, last 30 days`} accent={onTimeRate !== null && onTimeRate < 90} />
        <Stat label="Held in escrow" value={money(summary.heldCents)} hint="Owed to customers until approval" />
        <Stat label="Released, last 30 days" value={money(monthReleased._sum.amountCents ?? 0)} hint="Approved and earned" />
        <Stat label="Unpaid orders, 7 days" value={String(unpaid)} hint="Started checkout, not funded" />
      </div>

      {(unsettled.length > 0 || storageWarning) && (
        <div className="space-y-3">
          {storageWarning && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="font-semibold">Files are on local disk.</span> S3_BUCKET is not configured, so uploads and delivered files will be lost on the next deploy. Configure object storage before
              taking real orders.
            </p>
          )}
          {unsettled.length > 0 && (
            <section className="card overflow-hidden border-rose-300">
              <h2 className="border-b border-rose-100 bg-rose-50 px-5 py-3 font-semibold text-rose-900">Refunds that have not reached the customer ({unsettled.length})</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {unsettled.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className={`chip ${r.status === "FAILED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{r.status === "FAILED" ? "Failed" : "Pending"}</span>
                    <Link href={`/admin/orders/${r.order.id}`} className="font-semibold text-brand-700 hover:underline">
                      {r.order.orderNumber}
                    </Link>
                    <span className="font-semibold">{money(r.amountCents)}</span>
                    <span className="text-muted">{r.reason}</span>
                    {r.lastError && <span className="text-xs text-rose-600">{r.lastError}</span>}
                    <form action={retryRefundAction} className="ml-auto">
                      <input type="hidden" name="refundAttemptId" value={r.id} />
                      <button className="btn-outline !py-1.5 !text-xs">Retry now</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold">Needs attention</h2>
            <Link href="/admin/orders" className="text-xs font-semibold text-brand-600 hover:underline">
              All orders
            </Link>
          </div>
          {attention.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">Everything is on track. No overdue, unassigned or stuck orders.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map(({ order: o, hint }) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className={`chip ${TONE_CLASSES[hint.tone]}`}>{hint.label}</span>
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="text-muted">
                    {o.customer.name} · {lk.treatment(o.finalTreatment ?? o.treatment)?.name} · {o.slideCount} slides
                  </span>
                  <span className="ml-auto text-xs text-muted">
                    {o.designer?.name ?? "Unassigned"} · due {shortDate(o.deadlineAt)} ({countdown(o.deadlineAt, now)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Team workload</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {designers.map((d) => {
              const late = d.assignedOrders.filter((o) => o.deadlineAt.getTime() < now && ["PAID", "IN_PROGRESS", "REVISION_REQUESTED", "QC_REVIEW"].includes(o.status)).length;
              return (
                <li key={d.id} className="flex items-center justify-between px-5 py-2.5">
                  <span>
                    <span className="font-medium">{d.name}</span> <span className="text-xs text-muted">{d.role.toLowerCase()}</span>
                  </span>
                  <span className="text-xs">
                    <span className="font-semibold">{d.assignedOrders.length}</span> active
                    {late > 0 && <span className="ml-2 font-semibold text-rose-600">{late} late</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Active orders by deadline</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {active.slice(0, 12).map((o) => (
                  <tr key={o.id} className="hover:bg-surface/60">
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                        {o.orderNumber}
                      </Link>
                      <p className="text-xs text-muted">{o.customer.name}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{lk.treatment(o.finalTreatment ?? o.treatment)?.name}, {o.slideCount} slides</td>
                    <td className="px-3 py-2.5">{o.designer?.name ?? <span className="text-amber-700">Unassigned</span>}</td>
                    <td className={`px-3 py-2.5 ${o.deadlineAt.getTime() < now && !o.deliveredAt ? "font-semibold text-rose-600" : ""}`}>{shortDate(o.deadlineAt)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold">{money(o.finalTotalCents ?? o.totalCents)}</td>
                  </tr>
                ))}
                {active.length === 0 && (
                  <tr>
                    <td className="px-5 py-8 text-center text-muted">No active orders.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {active.length > 12 && (
            <Link href="/admin/orders" className="block border-t border-slate-100 px-5 py-2 text-center text-xs font-semibold text-brand-600 hover:underline">
              See all {active.length} active orders
            </Link>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Latest activity</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {events.map((e) => (
              <li key={e.id} className="px-5 py-2.5">
                <p className="line-clamp-2">
                  {e.internal && <span className="chip mr-1 bg-fuchsia-100 text-fuchsia-800">internal</span>}
                  {e.message}
                </p>
                <p className="text-xs text-muted">
                  <Link href={`/admin/orders/${e.order.id}`} className="font-semibold text-brand-600 hover:underline">
                    {e.order.orderNumber}
                  </Link>{" "}
                  · {dateTime(e.createdAt)}
                  {e.actor ? ` · ${e.actor.name}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-rose-600" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
