import Link from "next/link";
import { Suspense } from "react";
import { canSeeMoney, requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { escrowSummary } from "@/lib/orders";
import { money, shortDate, dateTime } from "@/lib/format";
import { lookups } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { ACTIVE_STATUSES, ORDER_STATUSES, STATUS_LABELS, isOrderStatus, type OrderStatus } from "@/lib/order-status";
import { adminAttention, TONE_CLASSES } from "@/lib/tasks";
import { EscrowBadge, StatusBadge } from "@/components/Badges";
import { OrdersFilterBar } from "@/components/OrdersFilterBar";

export const metadata = { title: "All orders | SlideBazaar Admin" };
export const dynamic = "force-dynamic";

const DONE_STATUSES: OrderStatus[] = ["APPROVED", "COMPLETED"];

type Params = { q?: string; stage?: string; status?: string; designer?: string; scope?: string; sort?: string };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireStaff();
  const p = await searchParams;
  const showMoney = canSeeMoney(user);
  const isDesigner = user.role === "DESIGNER";

  const q = (p.q ?? "").trim();
  const status = p.status && isOrderStatus(p.status) ? p.status : "";
  const stage = status ? "all" : p.stage && ["active", "attention", "done", "all"].includes(p.stage) ? p.stage : "active";
  const designer = p.designer ?? "";
  // Designers default to their own work; everyone else to the whole queue.
  const scope = p.scope ? p.scope : isDesigner ? "mine" : "everyone";
  const sort = p.sort ?? "deadline";

  const scopeWhere = scope === "mine" ? { designerId: user.id } : {};
  const designerWhere = designer === "unassigned" ? { designerId: null } : designer ? { designerId: designer } : {};
  const searchWhere = q
    ? { OR: [{ orderNumber: { contains: q } }, { customer: { name: { contains: q } } }, { customer: { company: { contains: q } } }, { customer: { email: { contains: q } } }] }
    : {};
  const stageWhere =
    status ? { status } : stage === "active" || stage === "attention" ? { status: { in: ACTIVE_STATUSES } } : stage === "done" ? { status: { in: DONE_STATUSES } } : {};
  // Designers never see unpaid, cancelled or refunded orders.
  const roleWhere = isDesigner ? { status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] } } : {};

  const orderBy =
    sort === "newest" ? { createdAt: "desc" as const } : sort === "oldest" ? { createdAt: "asc" as const } : sort === "amount" ? { totalCents: "desc" as const } : { deadlineAt: "asc" as const };

  const base = { ...scopeWhere, ...designerWhere, ...searchWhere, ...roleWhere };
  const [rows, counts, designers, summary, lk] = await Promise.all([
    prisma.order.findMany({
      where: { ...base, ...stageWhere },
      include: { customer: { select: { name: true, company: true } }, designer: { select: { name: true } } },
      orderBy,
    }),
    prisma.order.groupBy({ by: ["status"], _count: true, where: base }),
    prisma.user.findMany({ where: { role: { in: ["DESIGNER", "MANAGER", "ADMIN"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    showMoney ? escrowSummary() : Promise.resolve(null),
    loadCatalog().then(lookups),
  ]);

  const now = Date.now();
  const orders = stage === "attention" && !status ? rows.filter((o) => adminAttention(o, now)) : rows;
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const activeCount = ACTIVE_STATUSES.reduce((s, x) => s + countOf(x), 0);
  const attentionCount = stage === "attention" ? orders.length : (await prisma.order.findMany({ where: { ...base, status: { in: ACTIVE_STATUSES } }, select: { status: true, designerId: true, deadlineAt: true, deliveredAt: true, updatedAt: true } })).filter((o) => adminAttention(o, now)).length;
  const stageCounts = {
    active: activeCount,
    attention: attentionCount,
    done: DONE_STATUSES.reduce((s, x) => s + countOf(x), 0),
    all: counts.reduce((s, c) => s + c._count, 0),
  };
  const statuses = ORDER_STATUSES.filter((s) => showMoney || !["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(s)).map((s) => ({ id: s, label: STATUS_LABELS[s], count: countOf(s) }));

  return (
    <div>
      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <Stat label="Held in escrow" value={money(summary.heldCents)} hint="Owed to customers until approval" />
          <Stat label="Released (earned)" value={money(summary.releasedCents)} />
          <Stat label="Awaiting QC" value={String(countOf("QC_REVIEW"))} hint="Drafts waiting for a manager" accent={countOf("QC_REVIEW") > 0} />
          <Stat label="Awaiting customer" value={String(countOf("DELIVERED"))} hint="Delivered, not yet approved" />
        </div>
      )}

      <Suspense>
        <OrdersFilterBar current={{ q, stage, status, designer, scope, sort }} stageCounts={stageCounts} statuses={statuses} designers={designers} total={orders.length} showScope />
      </Suspense>

      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Designer</th>
                <th className="px-4 py-3">Status</th>
                {showMoney && <th className="px-4 py-3">Escrow</th>}
                {showMoney && <th className="px-4 py-3 text-right">Amount</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    {stage === "attention" && !q && !status ? "Nothing needs attention right now." : "No orders match these filters."}
                  </td>
                </tr>
              )}
              {orders.map((o) => {
                const hint = adminAttention(o, now);
                return (
                  <tr key={o.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                        {o.orderNumber}
                      </Link>
                      <p className="text-xs text-muted">{dateTime(o.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {o.customer.name}
                      {o.customer.company && <p className="text-xs text-muted">{o.customer.company}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {lk.treatment(o.finalTreatment ?? o.treatment)?.name}
                      <p className="text-xs text-muted">{o.slideCount} slides</p>
                    </td>
                    <td className={`px-4 py-3 ${hint?.tone === "alert" ? "font-semibold text-rose-600" : ""}`}>
                      {shortDate(o.deadlineAt)}
                      {hint && <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[hint.tone]}`}>{hint.label}</p>}
                    </td>
                    <td className="px-4 py-3">{o.designer?.name ?? <span className="text-amber-700">Unassigned</span>}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    {showMoney && (
                      <td className="px-4 py-3">
                        <EscrowBadge status={o.escrowStatus} />
                      </td>
                    )}
                    {showMoney && <td className="px-4 py-3 text-right font-semibold">{money(o.finalTotalCents ?? o.totalCents)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-accent-600" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
