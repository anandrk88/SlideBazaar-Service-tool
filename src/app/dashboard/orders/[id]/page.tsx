import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money, moneyRange, longDate, dateTime } from "@/lib/format";
import { lookups } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { finalTotalFor } from "@/lib/pricing";
import { EscrowBadge, StatusBadge } from "@/components/Badges";
import { DeliverableDownloads, Field, FileList, MessageList, PreviewGallery, ProgressBar, Timeline } from "@/components/OrderParts";
import { LockIcon } from "@/components/Icons";
import { approveAction, cancelAction, customerMessageAction, payNowAction, revisionAction } from "./actions";

export default async function CustomerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; approved?: string; cancelled?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const flags = await searchParams;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      files: { orderBy: [{ version: "asc" }, { createdAt: "asc" }] },
      events: { where: { internal: false }, orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, role: true } } } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
      escrowEntries: { orderBy: { createdAt: "asc" } },
      designer: { select: { name: true } },
      previews: { where: { released: true }, orderBy: [{ version: "desc" }, { index: "asc" }] },
    },
  });
  if (!order || order.customerId !== user.id) notFound();
  const catalog = await loadCatalog();
  const lk = lookups(catalog);

  const deliverables = order.files.filter((f) => f.kind === "DELIVERABLE");
  const latestVersion = order.previews[0]?.version;
  const previews = order.previews.filter((p) => p.version === latestVersion);
  const approved = ["APPROVED", "COMPLETED"].includes(order.status);
  // Only the customer's own uploads. Designer drafts and superseded versions
  // are staff-only and must never appear here.
  const sources = order.files.filter((f) => f.kind === "SOURCE" || f.kind === "STYLE_REFERENCE");
  const canReview = order.status === "DELIVERED";
  const treatment = lk.treatment(order.treatment);
  const finalTreatment = order.finalTreatment ? lk.treatment(order.finalTreatment) : null;
  const releaseAmount = order.finalTotalCents ?? finalTotalFor(order, catalog);
  const refundAtApproval = Math.max(0, order.totalCents - releaseAmount);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="text-sm text-brand-600 hover:underline">
        &larr; All orders
      </Link>

      {flags.paid && order.status !== "PENDING_PAYMENT" && (
        <Banner tone="success">Payment received and held. Your order is in the queue and a designer will be assigned shortly.</Banner>
      )}
      {flags.paid && order.status === "PENDING_PAYMENT" && <Banner tone="warn">We are waiting for the payment confirmation. Refresh in a moment.</Banner>}
      {flags.approved && <Banner tone="success">Thank you! Your approval released the payment to SlideBazaar.</Banner>}
      {flags.cancelled && order.status === "PENDING_PAYMENT" && <Banner tone="warn">Payment was cancelled. You can pay whenever you are ready.</Banner>}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-sm text-muted">Placed {dateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <EscrowBadge status={order.escrowStatus} />
        </div>
      </div>

      <div className="card mt-6 p-6">
        <ProgressBar status={order.status} />
        {order.status === "PENDING_PAYMENT" && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm">
              This order has not been paid yet. Pay <span className="font-semibold">{money(order.totalCents)}</span> to start the work.
            </p>
            <div className="flex gap-2">
              <form action={cancelAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <button className="btn-ghost">Cancel order</button>
              </form>
              <form action={payNowAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <button className="btn-accent">Pay now</button>
              </form>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Your designs</h2>
              {!approved && previews.length > 0 && (
                <span className="text-xs text-muted">
                  <LockIcon width={12} height={12} className="mr-1 inline text-accent-600" />
                  Watermarked preview. Downloads unlock when you approve.
                </span>
              )}
            </div>
            <div className="mt-3">
              {approved ? (
                <>
                  <p className="mb-3 text-sm text-emerald-800">Approved. Your files are unlocked for download.</p>
                  <DeliverableDownloads orderId={order.id} files={deliverables} />
                  {previews.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-semibold">Slide previews</summary>
                      <div className="mt-3">
                        <PreviewGallery previews={previews} />
                      </div>
                    </details>
                  )}
                </>
              ) : previews.length > 0 ? (
                <PreviewGallery previews={previews} />
              ) : (
                <p className="text-sm text-muted">
                  {order.status === "QC_REVIEW"
                    ? "Your draft is with our quality team for a final check. It will be with you shortly."
                    : ["IN_PROGRESS", "PAID", "REVISION_REQUESTED"].includes(order.status)
                      ? `Our designers are working on it. First draft due by ${longDate(order.deadlineAt)}.`
                      : "No designs delivered yet."}
                </p>
              )}
            </div>

            {canReview && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <form action={approveAction} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <h3 className="font-semibold text-emerald-900">Happy with the designs?</h3>
                  <p className="mt-1 text-sm text-emerald-800">
                    Approving releases {money(releaseAmount)} to SlideBazaar
                    {refundAtApproval > 0 ? ` and refunds ${money(refundAtApproval)} to your card` : ""}. This cannot be undone.
                  </p>
                  <button className="btn-primary mt-3 w-full !bg-emerald-600 hover:!bg-emerald-700">Approve and release payment</button>
                </form>
                <form action={revisionAction} className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <h3 className="font-semibold text-orange-900">Need changes?</h3>
                  <textarea name="feedback" rows={3} required minLength={5} className="input mt-2" placeholder="Tell us exactly what to change, slide by slide." />
                  <button className="btn-outline mt-3 w-full !border-orange-400 !text-orange-800 hover:!bg-orange-100">Request a revision</button>
                </form>
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Your brief</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Treatment">
                {treatment?.name}
                {finalTreatment && finalTreatment.id !== order.treatment ? ` (applied: ${finalTreatment.name})` : ""}
              </Field>
              <Field label="Style">{lk.style(order.style)?.name}</Field>
              <Field label="Slides">{order.slideCount}</Field>
              <Field label="Delivery">
                {lk.tier(order.deliveryTier)?.name}, first draft by {longDate(order.deadlineAt)}
              </Field>
              <Field label="Text service">
                {lk.text(order.proofreading)?.name}
                {order.proofreading !== "NONE" ? ` (${order.grammar} English)` : ""}
              </Field>
              <Field label="Designer">{order.designer?.name ?? "Not yet assigned"}</Field>
              <div className="sm:col-span-2">
                <Field label="Instructions">
                  <p className="whitespace-pre-wrap">{order.brief}</p>
                </Field>
              </div>
              {order.googleSlidesUrl && (
                <div className="sm:col-span-2">
                  <Field label="Google Slides">
                    <a href={order.googleSlidesUrl} target="_blank" className="text-brand-600 hover:underline">
                      {order.googleSlidesUrl}
                    </a>
                  </Field>
                </div>
              )}
              {order.audience && <Field label="Audience">{order.audience}</Field>}
              {order.fontsColors && <Field label="Fonts and colours">{order.fontsColors}</Field>}
              {order.brandNotes && (
                <div className="sm:col-span-2">
                  <Field label="Brand notes">{order.brandNotes}</Field>
                </div>
              )}
              {order.extraNotes && (
                <div className="sm:col-span-2">
                  <Field label="Other notes">{order.extraNotes}</Field>
                </div>
              )}
            </dl>
            <h3 className="mt-6 text-sm font-semibold">Files you sent</h3>
            <div className="mt-2">
              <FileList files={sources} empty="No files uploaded." />
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Messages</h2>
            <div className="mt-4">
              <MessageList messages={order.messages} meId={user.id} />
            </div>
            <form action={customerMessageAction} className="mt-4 flex gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <input name="body" className="input" placeholder="Write a message to your designer" required />
              <button className="btn-primary shrink-0">Send</button>
            </form>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-6">
            <div className="flex items-center gap-2">
              <LockIcon width={20} height={20} className="text-accent-600" />
              <h2 className="font-semibold">Payment</h2>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Estimate</dt>
                <dd>{moneyRange(order.subtotalMinCents, order.subtotalMaxCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Paid and held</dt>
                <dd className="font-semibold">{order.paidAt ? money(order.totalCents) : "Not yet"}</dd>
              </div>
              {order.finalTotalCents !== null && (
                <div className="flex justify-between">
                  <dt className="text-muted">Final charge</dt>
                  <dd className="font-semibold">{money(order.finalTotalCents)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Status</dt>
                <dd>
                  <EscrowBadge status={order.escrowStatus} />
                </dd>
              </div>
            </dl>
            {order.escrowEntries.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-muted">
                {order.escrowEntries.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span>
                      <span className="font-semibold text-ink">{e.type}</span> {dateTime(e.createdAt)}
                    </span>
                    <span className={e.type === "REFUND" ? "text-rose-600" : e.type === "RELEASE" ? "text-emerald-600" : ""}>
                      {e.type === "HOLD" ? "+" : "-"}
                      {money(e.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted">We release the payment to ourselves only when you approve the final designs. If you do not approve, or we cannot deliver, you are refunded in full.</p>
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Activity</h2>
            <div className="mt-4">
              <Timeline events={order.events} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "success" | "warn"; children: React.ReactNode }) {
  return <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{children}</div>;
}
