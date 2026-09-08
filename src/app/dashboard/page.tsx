import Link from "next/link";
import { redirect } from "next/navigation";
import { isStaff, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money, shortDate, dateTime } from "@/lib/format";
import { lookups } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { EscrowBadge, StatusBadge } from "@/components/Badges";

export const metadata = { title: "My orders | SlideBazaar Design Services" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  if (isStaff(user)) redirect("/admin");
  const lk = lookups(await loadCatalog());

  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { messages: { where: { authorId: { not: user.id } }, orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { name: true } } } } },
  });

  const held = orders.filter((o) => o.escrowStatus === "HELD").reduce((s, o) => s + o.totalCents, 0);
  const unpaid = orders.filter((o) => o.status === "PENDING_PAYMENT");
  const toReview = orders.filter((o) => o.status === "DELIVERED");
  const inProgress = orders.filter((o) => ["PAID", "IN_PROGRESS", "QC_REVIEW", "REVISION_REQUESTED"].includes(o.status));
  const recentMessages = orders
    .flatMap((o) => o.messages.map((m) => ({ ...m, order: o })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold">Welcome back, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted">Send us a new deck, follow your orders, and talk to your designer.</p>
        </div>
        <Link href="/order" className="btn-accent">
          New order
        </Link>
      </div>

      {(unpaid.length > 0 || toReview.length > 0) && (
        <section className="mt-6 space-y-3">
          <h2 className="font-semibold">Needs your attention</h2>
          {toReview.map((o) => (
            <div key={o.id} className="card flex flex-wrap items-center justify-between gap-3 border-emerald-200 bg-emerald-50 px-5 py-4 text-sm">
              <span>
                <span className="font-semibold">{o.orderNumber}</span>: your draft is ready. Review it and approve or request changes.
              </span>
              <Link href={`/dashboard/orders/${o.id}`} className="btn-primary !bg-emerald-600 !py-2 hover:!bg-emerald-700">
                Review designs
              </Link>
            </div>
          ))}
          {unpaid.map((o) => (
            <div key={o.id} className="card flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 px-5 py-4 text-sm">
              <span>
                <span className="font-semibold">{o.orderNumber}</span> is waiting for payment of {money(o.totalCents)}. Work starts once payment is received.
              </span>
              <Link href={`/dashboard/orders/${o.id}`} className="btn-accent !py-2">
                Pay now
              </Link>
            </div>
          ))}
        </section>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="In progress" value={String(inProgress.length)} hint="Being designed or checked" />
        <Stat label="Held by SlideBazaar" value={money(held)} hint="Released only when you approve" />
        <Stat label="Awaiting your review" value={String(toReview.length)} accent={toReview.length > 0} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Your orders</h2>
          {orders.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted">
              You have not placed an order yet.{" "}
              <Link href="/order" className="font-semibold text-brand-600 hover:underline">
                Send us your first deck
              </Link>
              .
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">First draft</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-surface/60">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                          {o.orderNumber}
                        </Link>
                        <p className="text-xs text-muted">{dateTime(o.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {lk.treatment(o.finalTreatment ?? o.treatment)?.name}
                        <p className="text-xs text-muted">{o.slideCount} slides</p>
                      </td>
                      <td className="px-4 py-3">{shortDate(o.deadlineAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3">
                        <EscrowBadge status={o.escrowStatus} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{money(o.finalTotalCents ?? o.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="font-semibold">Messages from the team</h2>
            {recentMessages.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No messages yet. Your designer will write here with questions.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {recentMessages.map((m) => (
                  <li key={m.id} className="rounded-xl bg-surface p-3">
                    <p className="line-clamp-3">{m.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      {m.author.name} on{" "}
                      <Link href={`/dashboard/orders/${m.order.id}`} className="font-semibold text-brand-600 hover:underline">
                        {m.order.orderNumber}
                      </Link>{" "}
                      · {dateTime(m.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card p-5 text-sm">
            <h2 className="font-semibold">How it works</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>Send your deck and brief, and pay.</li>
              <li>A designer works on it and our QC team checks it.</li>
              <li>Review the draft, request changes or approve.</li>
              <li>Only your approval releases the payment. Otherwise you are refunded.</li>
            </ol>
          </section>
        </aside>
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
