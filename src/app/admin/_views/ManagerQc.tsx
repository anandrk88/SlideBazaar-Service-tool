import Link from "next/link";
import { prisma } from "@/lib/db";
import { escrowSummary } from "@/lib/orders";
import { money, shortDate, dateTime } from "@/lib/format";
import { lookups } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { countdown } from "@/lib/tasks";
import { StatusBadge } from "@/components/Badges";

export async function ManagerQc({ name }: { name: string }) {
  const now = Date.now();
  const [qc, delivered, revisions, designing, recentQc, summary] = await Promise.all([
    prisma.order.findMany({
      where: { status: "QC_REVIEW" },
      include: {
        customer: { select: { name: true, company: true } },
        designer: { select: { name: true } },
        files: { where: { kind: "DRAFT" }, select: { id: true, originalName: true } },
        events: { where: { type: "QC_SUBMITTED" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.order.findMany({ where: { status: "DELIVERED" }, include: { customer: { select: { name: true } }, designer: { select: { name: true } } }, orderBy: { deliveredAt: "asc" } }),
    prisma.order.findMany({
      where: { status: "REVISION_REQUESTED" },
      include: { customer: { select: { name: true } }, designer: { select: { name: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.order.count({ where: { status: { in: ["PAID", "IN_PROGRESS"] } } }),
    prisma.orderEvent.findMany({
      where: { type: { in: ["QC_APPROVED", "QC_REJECTED"] } },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { order: { select: { id: true, orderNumber: true } }, actor: { select: { name: true } } },
    }),
    escrowSummary(),
  ]);

  const lk = lookups(await loadCatalog());
  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Quality check</p>
        <h1 className="mt-1 text-2xl font-bold">Hello {name.split(" ")[0]}, {qc.length === 0 ? "nothing is waiting for review" : `${qc.length} draft${qc.length === 1 ? "" : "s"} waiting for your review`}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="To review" value={String(qc.length)} accent={qc.length > 0} hint="Drafts submitted by designers" />
        <Stat label="With customers" value={String(delivered.length)} hint="Delivered, awaiting approval" />
        <Stat label="Revisions requested" value={String(revisions.length)} hint="Coming back to designers" accent={revisions.length > 0} />
        <Stat label="Being designed" value={String(designing)} hint={`${money(summary.heldCents)} held in escrow overall`} />
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Review queue</h2>
        {qc.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No drafts to review. New submissions appear here the moment a designer uploads.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {qc.map((o) => {
              const submitted = o.events[0]?.createdAt ?? o.updatedAt;
              const late = o.deadlineAt.getTime() < now;
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-4 px-5 py-4 text-sm">
                  <div className="min-w-[200px]">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold text-ink hover:underline">
                      {o.orderNumber}
                    </Link>
                    <p className="text-muted">
                      {o.customer.name}
                      {o.customer.company ? `, ${o.customer.company}` : ""}
                    </p>
                  </div>
                  <div className="text-muted">
                    {lk.treatment(o.finalTreatment ?? o.treatment)?.name}, {o.slideCount} slides
                    <p className="text-xs">
                      {o.files.length} file{o.files.length === 1 ? "" : "s"} by {o.designer?.name ?? "unknown"} · submitted {dateTime(submitted)}
                    </p>
                  </div>
                  <div className={`ml-auto text-xs ${late ? "font-semibold text-rose-600" : "text-muted"}`}>
                    Customer expects it by {shortDate(o.deadlineAt)} ({countdown(o.deadlineAt, now)})
                  </div>
                  <Link href={`/admin/orders/${o.id}`} className="btn-primary !bg-fuchsia-700 !py-2 !text-xs hover:!bg-fuchsia-800">
                    Review draft
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Revisions requested by customers</h2>
          {revisions.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted">None open.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {revisions.map((o) => (
                <li key={o.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                      {o.orderNumber}
                    </Link>
                    <span className="text-xs text-muted">{o.designer?.name ?? "Unassigned"} · revision {o.revisionCount}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{o.messages[0]?.body ?? "No feedback text"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">With customers</h2>
          {delivered.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted">Nothing awaiting customer approval.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {delivered.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="text-muted">{o.customer.name}</span>
                  <span className="ml-auto text-xs text-muted">delivered {o.deliveredAt ? dateTime(o.deliveredAt) : "-"}</span>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Recent QC decisions</h2>
        {recentQc.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted">No decisions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recentQc.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <span className={`chip ${e.type === "QC_APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>
                  {e.type === "QC_APPROVED" ? "Approved" : "Sent back"}
                </span>
                <Link href={`/admin/orders/${e.order.id}`} className="font-semibold text-brand-700 hover:underline">
                  {e.order.orderNumber}
                </Link>
                <span className="line-clamp-1 text-muted">{e.message}</span>
                <span className="ml-auto text-xs text-muted">
                  {dateTime(e.createdAt)}
                  {e.actor ? ` · ${e.actor.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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
