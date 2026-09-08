import Link from "next/link";
import { notFound } from "next/navigation";
import { canReviewQc, canSeeMoney, requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money, moneyRange, longDate, dateTime } from "@/lib/format";
import { RANGE_TREATMENT_ID, lookups } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { finalTotalFor } from "@/lib/pricing";
import { DESIGNING_STATUSES, canTransition } from "@/lib/order-status";
import { EscrowBadge, StatusBadge } from "@/components/Badges";
import { DeliverableDownloads, Field, FileList, MessageList, PreviewGallery, ProgressBar, Timeline } from "@/components/OrderParts";
import { DraftUploadForm } from "@/components/DraftUploadForm";
import {
  assignAction,
  finalTreatmentAction,
  internalNoteAction,
  qcApproveAction,
  qcRejectAction,
  refundAction,
  staffMessageAction,
  startAction,
  submitDraftAction,
} from "./actions";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      designer: { select: { id: true, name: true } },
      files: { orderBy: [{ version: "asc" }, { createdAt: "asc" }] },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, role: true } } } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
      escrowEntries: { orderBy: { createdAt: "asc" } },
      payments: true,
      previews: { orderBy: [{ version: "desc" }, { index: "asc" }] },
    },
  });
  if (!order) notFound();
  const catalog = await loadCatalog();
  const lk = lookups(catalog);
  const currentVersion = order.revisionCount + 1;
  const currentPreviews = order.previews.filter((p) => p.version === currentVersion);
  const latestReleased = order.previews.filter((p) => p.released && p.version === order.previews.find((x) => x.released)?.version);

  const isAdmin = user.role === "ADMIN";
  const isDesigner = user.role === "DESIGNER";
  const showMoney = canSeeMoney(user);
  const reviewer = canReviewQc(user);
  const mine = order.designer?.id === user.id;
  const mayWork = !isDesigner || mine;

  const designers = isAdmin
    ? await prisma.user.findMany({ where: { role: { in: ["DESIGNER", "MANAGER", "ADMIN"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
    : [];

  const drafts = order.files.filter((f) => f.kind === "DRAFT");
  const deliverables = order.files.filter((f) => f.kind === "DELIVERABLE");
  const sources = order.files.filter((f) => f.kind === "SOURCE" || f.kind === "STYLE_REFERENCE");
  const canStart = mayWork && canTransition(order.status, "IN_PROGRESS") && order.status === "PAID";
  const canSubmitDraft = mayWork && DESIGNING_STATUSES.includes(order.status as never);
  const inQc = order.status === "QC_REVIEW";
  const canRefund = isAdmin && canTransition(order.status, "REFUNDED");
  const projectedFinal = finalTotalFor(order, catalog);
  const isRange = order.treatment === RANGE_TREATMENT_ID;
  const fixedTreatments = catalog.treatments.filter((t) => t.id !== RANGE_TREATMENT_ID && (t.enabled || t.id === order.finalTreatment));
  const internalEvents = order.events.filter((e) => e.internal);

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand-600 hover:underline">
        &larr; Back to queue
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-muted">
            {order.customer.name}
            {order.customer.company ? `, ${order.customer.company}` : ""}
            {showMoney ? (
              <>
                {" "}
                &middot; {order.customer.email}
                {order.customer.phone ? ` · ${order.customer.phone}` : ""}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          {showMoney && <EscrowBadge status={order.escrowStatus} />}
        </div>
      </div>

      {isDesigner && !mine && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This order is assigned to {order.designer?.name ?? "nobody yet"}. You can view it but not act on it.
        </p>
      )}

      {/* Key facts strip */}
      <div className="card mt-6 grid gap-4 p-6 sm:grid-cols-4">
        <Fact label="First draft due" value={longDate(order.deadlineAt)} highlight={order.deadlineAt.getTime() < Date.now() && !order.deliveredAt} />
        <Fact label="Treatment" value={lk.treatment(order.finalTreatment ?? order.treatment)?.name ?? order.treatment} />
        <Fact label="Slides" value={`${order.slideCount} · ${lk.style(order.style)?.name}`} />
        <Fact label="Designer" value={order.designer?.name ?? "Unassigned"} />
      </div>

      <div className="card mt-6 p-6">
        <ProgressBar status={order.status} />
        {order.status === "PENDING_PAYMENT" && <p className="text-sm text-muted">The customer has not paid yet. Work should not start until the escrow is funded.</p>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* QC review panel */}
          {inQc && reviewer && (
            <section className="rounded-2xl border-2 border-fuchsia-300 bg-fuchsia-50 p-6">
              <p className="eyebrow !text-fuchsia-700">Quality check</p>
              <h2 className="mt-1 text-lg font-bold text-fuchsia-950">
                Draft {order.revisionCount + 1} from {order.designer?.name ?? "the designer"} is waiting for your review
              </h2>
              <div className="mt-4">
                <FileList files={drafts.filter((f) => !f.mimeType.startsWith("image/"))} empty="No design file attached." downloadable={false} />
              </div>
              <h3 className="mt-5 text-sm font-semibold text-fuchsia-950">Slide previews the customer will see</h3>
              <div className="mt-2">
                <PreviewGallery previews={currentPreviews} empty="The designer did not attach slide images." />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <form action={qcApproveAction} className="rounded-xl border border-emerald-200 bg-white p-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <h3 className="font-semibold text-emerald-900">Approve and send to customer</h3>
                  <p className="mt-1 text-xs text-muted">The files become visible to the customer and they are asked to review.</p>
                  <input name="note" className="input mt-3" placeholder="Internal note (optional)" />
                  <button className="btn-primary mt-3 w-full !bg-emerald-600 hover:!bg-emerald-700">Approve and deliver</button>
                </form>
                <form action={qcRejectAction} className="rounded-xl border border-orange-200 bg-white p-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <h3 className="font-semibold text-orange-900">Send back to designer</h3>
                  <textarea name="feedback" rows={3} required minLength={5} className="input mt-3" placeholder="What needs to change? The customer will not see this." />
                  <button className="btn-outline mt-3 w-full !border-orange-400 !text-orange-800 hover:!bg-orange-50">Send back</button>
                </form>
              </div>
            </section>
          )}
          {inQc && !reviewer && (
            <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-6 text-sm text-fuchsia-900">
              <p className="font-semibold">Draft submitted for quality check.</p>
              <p className="mt-1">A QC manager will either send it to the customer or return it to you with notes.</p>
              <div className="mt-3">
                <FileList files={drafts.filter((f) => !f.mimeType.startsWith("image/"))} empty="No design file attached." downloadable={false} />
              </div>
              <div className="mt-3">
                <PreviewGallery previews={currentPreviews} empty="No slide images attached." />
              </div>
            </section>
          )}

          {/* Production */}
          <section className="card p-6">
            <h2 className="font-semibold">Production</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {isAdmin ? (
                <form action={assignAction} className="space-y-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <label className="label">Designer</label>
                  <div className="flex gap-2">
                    <select key={order.designer?.id ?? "none"} name="designerId" className="input" defaultValue={order.designer?.id ?? ""}>
                      <option value="">Unassigned</option>
                      {designers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.role.toLowerCase()})
                        </option>
                      ))}
                    </select>
                    <button className="btn-outline shrink-0">Assign</button>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="label">Designer</p>
                  <p className="text-sm">{order.designer?.name ?? "Unassigned"}</p>
                </div>
              )}

              <form action={finalTreatmentAction} className="space-y-2">
                <input type="hidden" name="orderId" value={order.id} />
                <label className="label">Treatment applied{isRange ? " (customer chose Let us decide)" : ""}</label>
                <div className="flex gap-2">
                  <select
                    key={order.finalTreatment ?? "none"}
                    name="finalTreatment"
                    className="input"
                    defaultValue={order.finalTreatment ?? (isRange ? "" : order.treatment)}
                    disabled={!mayWork || !isRange || order.status === "COMPLETED"}
                  >
                    <option value="">Not decided</option>
                    {fixedTreatments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {mayWork && isRange && order.status !== "COMPLETED" && <button className="btn-outline shrink-0">Save</button>}
                </div>
                {showMoney && isRange && (
                  <p className="text-xs text-muted">
                    Held {money(order.totalCents)}. Final charge at approval: {money(projectedFinal)}
                    {projectedFinal < order.totalCents ? `, refunding ${money(order.totalCents - projectedFinal)}` : ""}.
                  </p>
                )}
              </form>
            </div>

            {canStart && (
              <form action={startAction} className="mt-6 border-t border-slate-100 pt-4">
                <input type="hidden" name="orderId" value={order.id} />
                <button className="btn-primary">Start work</button>
              </form>
            )}

            {canSubmitDraft && (
              <div className="mt-6">
                <DraftUploadForm orderId={order.id} version={order.revisionCount + 1} revisionRequested={order.status === "REVISION_REQUESTED"} action={submitDraftAction} />
              </div>
            )}

            {canRefund && (
              <form action={refundAction} className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <input type="hidden" name="orderId" value={order.id} />
                <h3 className="font-semibold text-rose-900">Refund escrow to customer</h3>
                <p className="mt-1 text-xs text-rose-800">
                  {money(order.totalCents)} is held. Leave the amount blank for a full refund; a partial refund releases the remainder to SlideBazaar. This closes the order.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
                  <input name="amount" type="number" step="0.01" min="0.01" max={order.totalCents / 100} className="input" placeholder="Full" />
                  <input name="reason" className="input" placeholder="Reason shown to the customer" required />
                </div>
                <button className="btn-danger mt-3">Issue refund</button>
              </form>
            )}
          </section>

          {/* Delivered files */}
          <section className="card p-6">
            <h2 className="font-semibold">Files sent to the customer</h2>
            <p className="text-xs text-muted">The customer sees watermarked previews until they approve; then the PPTX and original slide images unlock for download.</p>
            <div className="mt-3">
              {deliverables.length === 0 ? <p className="text-sm text-muted">Nothing delivered to the customer yet.</p> : <DeliverableDownloads orderId={order.id} files={deliverables} />}
            </div>
            {latestReleased.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold">Previews the customer sees ({latestReleased.length} slides)</summary>
                <div className="mt-3">
                  <PreviewGallery previews={latestReleased} />
                </div>
              </details>
            )}
            {!inQc && drafts.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-semibold">Earlier drafts (internal)</h3>
                <div className="mt-2">
                  <FileList files={drafts.filter((f) => !f.mimeType.startsWith("image/"))} downloadable={false} />
                </div>
              </>
            )}
          </section>

          {/* Brief */}
          <section className="card p-6">
            <h2 className="font-semibold">Brief</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Treatment ordered">{lk.treatment(order.treatment)?.name}</Field>
              <Field label="Style">{lk.style(order.style)?.name}</Field>
              <Field label="Slides">{order.slideCount}</Field>
              <Field label="Deadline">
                {lk.tier(order.deliveryTier)?.name}, {longDate(order.deadlineAt)}
              </Field>
              <Field label="Text service">
                {lk.text(order.proofreading)?.name}
                {order.proofreading !== "NONE" ? ` (${order.grammar} English)` : ""}
              </Field>
              <Field label="Revisions">{order.revisionCount}</Field>
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
            <h3 className="mt-6 text-sm font-semibold">Customer files</h3>
            <div className="mt-2">
              <FileList files={sources} empty="No files uploaded." />
            </div>
          </section>

          {/* Messages */}
          <section className="card p-6">
            <h2 className="font-semibold">Messages with customer</h2>
            <div className="mt-4">
              <MessageList messages={order.messages} meId={user.id} />
            </div>
            {mayWork && (
              <form action={staffMessageAction} className="mt-4 flex gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input name="body" className="input" placeholder="Message the customer" required />
                <button className="btn-primary shrink-0">Send</button>
              </form>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {showMoney && (
            <>
              <section className="card p-6">
                <h2 className="font-semibold">Escrow and payment</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <Line k="Estimate" v={moneyRange(order.subtotalMinCents, order.subtotalMaxCents)} />
                  <Line k="Held" v={order.paidAt ? money(order.totalCents) : "Unpaid"} />
                  <Line k="Final charge" v={order.finalTotalCents !== null ? money(order.finalTotalCents) : `${money(projectedFinal)} (projected)`} />
                  <Line k="Paid at" v={order.paidAt ? dateTime(order.paidAt) : "-"} />
                  {order.payments.map((p) => (
                    <Line key={p.id} k={`${p.provider} payment`} v={`${p.status.toLowerCase()}${p.refundedCents ? `, refunded ${money(p.refundedCents)}` : ""}`} />
                  ))}
                </dl>
                <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Ledger</h3>
                {order.escrowEntries.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No entries.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-xs">
                    {order.escrowEntries.map((e) => (
                      <li key={e.id} className="rounded-xl bg-surface p-2">
                        <div className="flex justify-between font-semibold">
                          <span>{e.type}</span>
                          <span className={e.type === "REFUND" ? "text-rose-600" : e.type === "RELEASE" ? "text-emerald-600" : ""}>{money(e.amountCents)}</span>
                        </div>
                        <p className="text-muted">{e.note}</p>
                        <p className="text-muted">{dateTime(e.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card p-6">
                <h2 className="font-semibold">Billing</h2>
                <dl className="mt-3 space-y-1 text-sm">
                  <Line k="Address" v={order.customer.billingAddress ?? "-"} />
                  <Line k="City" v={order.customer.billingCity ?? "-"} />
                  <Line k="Country" v={order.customer.billingCountry ?? "-"} />
                  <Line k="VAT" v={order.customer.billingVat ?? "-"} />
                </dl>
              </section>
            </>
          )}

          <section className="card p-6">
            <h2 className="font-semibold">Team notes</h2>
            <p className="text-xs text-muted">QC feedback and internal notes. The customer never sees these.</p>
            <div className="mt-4">
              <Timeline events={internalEvents} />
            </div>
            {mayWork && (
              <form action={internalNoteAction} className="mt-4 flex gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input name="body" className="input" placeholder="Add an internal note" required />
                <button className="btn-outline shrink-0">Add</button>
              </form>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Activity</h2>
            <div className="mt-4">
              <Timeline events={order.events.filter((e) => !e.internal)} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${highlight ? "text-rose-600" : ""}`}>{value}</p>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
