import Link from "next/link";
import { prisma } from "@/lib/db";
import { longDate, shortDate } from "@/lib/format";
import { NO_TEXT_SERVICE_ID, lookups } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { ACTIVE_STATUSES } from "@/lib/order-status";
import { countdown, designerNextAction, TONE_CLASSES } from "@/lib/tasks";
import { StatusBadge } from "@/components/Badges";

export async function DesignerTasks({ userId, name }: { userId: string; name: string }) {
  const now = Date.now();
  const active = await prisma.order.findMany({
    where: { designerId: userId, status: { in: ACTIVE_STATUSES } },
    include: { customer: { select: { name: true, company: true } }, events: { where: { internal: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { deadlineAt: "asc" },
  });

  const lk = lookups(await loadCatalog());
  const todo = active.filter((o) => ["PAID", "IN_PROGRESS", "REVISION_REQUESTED"].includes(o.status));
  const waiting = active.filter((o) => ["QC_REVIEW", "DELIVERED"].includes(o.status));
  const dueSoon = todo.filter((o) => o.deadlineAt.getTime() - now < 24 * 36e5).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">My tasks</p>
        <h1 className="mt-1 text-2xl font-bold">Hello {name.split(" ")[0]}, here is your work</h1>
        <p className="text-sm text-muted">
          {todo.length} to do{dueSoon > 0 ? `, ${dueSoon} due within 24 hours` : ""} · {waiting.length} waiting on others
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">To do</h2>
        {todo.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">Nothing on your plate. New assignments appear here.</div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {todo.map((o) => {
              const hint = designerNextAction(o.status);
              const late = o.deadlineAt.getTime() < now;
              const lastNote = o.events[0];
              return (
                <li key={o.id} className={`card flex flex-col p-5 ${late ? "border-rose-300" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/admin/orders/${o.id}`} className="text-lg font-bold text-ink hover:underline">
                        {o.orderNumber}
                      </Link>
                      <p className="text-sm text-muted">
                        {o.customer.name}
                        {o.customer.company ? `, ${o.customer.company}` : ""}
                      </p>
                    </div>
                    <span className={`chip ${TONE_CLASSES[hint.tone]}`}>{hint.label}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Job</dt>
                      <dd>
                        {lk.treatment(o.finalTreatment ?? o.treatment)?.name}, {o.slideCount} slides
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Style</dt>
                      <dd>
                        {lk.style(o.style)?.name}
                        {o.proofreading !== NO_TEXT_SERVICE_ID ? ` · ${lk.text(o.proofreading)?.name}` : ""}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-muted">First draft due</dt>
                      <dd className={late ? "font-semibold text-rose-600" : "font-semibold"}>
                        {longDate(o.deadlineAt)} <span className="font-normal text-muted">({countdown(o.deadlineAt, now)})</span>
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 line-clamp-2 text-sm text-muted">{o.brief}</p>
                  {lastNote && o.status !== "PAID" && (
                    <p className="mt-3 rounded-xl bg-fuchsia-50 px-3 py-2 text-xs text-fuchsia-900">
                      <span className="font-semibold">Latest team note:</span> {lastNote.message}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <StatusBadge status={o.status} />
                    <Link href={`/admin/orders/${o.id}`} className="btn-accent !py-2 !text-xs">
                      Open task
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Waiting on others</h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted">Nothing in QC or with a customer right now.</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {waiting.map((o) => {
              const hint = designerNextAction(o.status);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="text-muted">
                    {o.customer.name} · {lk.treatment(o.finalTreatment ?? o.treatment)?.name}, {o.slideCount} slides
                  </span>
                  <span className={`chip ${TONE_CLASSES[hint.tone]}`}>{hint.label}</span>
                  <span className="ml-auto text-xs text-muted">due {shortDate(o.deadlineAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
}
