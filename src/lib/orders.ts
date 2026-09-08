import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { assertTransition, type OrderStatus } from "./order-status";
import { clampSlides, finalTotalFor, quote, type QuoteInput } from "./pricing";
import { stripe, stripeEnabled } from "./stripe";
import { loadCalendar } from "./calendar-server";
import { loadCatalog } from "./catalog-server";
import { notifyRoles, notifyUsers } from "./notify";
import { releasePreviews } from "./previews";
import { money } from "./format";
import { RANGE_TREATMENT_ID, type GrammarId } from "./catalog";

type Tx = Prisma.TransactionClient;

/** Human-friendly order number, e.g. SB-260906-4F2A */
function newOrderNumber() {
  const d = new Date();
  const yymmdd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `SB-${yymmdd}-${rand}`;
}

export async function addEvent(
  tx: Tx | typeof prisma,
  orderId: string,
  type: string,
  message: string,
  actorId?: string | null,
  internal = false,
) {
  return tx.orderEvent.create({ data: { orderId, type, message, actorId: actorId ?? null, internal } });
}

const customerLink = (id: string) => `/dashboard/orders/${id}`;
const staffLink = (id: string) => `/admin/orders/${id}`;

/**
 * Conditional status change. The status is part of the WHERE clause, so two
 * concurrent callers cannot both succeed: the loser gets count 0 and returns
 * null. Every money and workflow transition goes through this.
 */
async function transition(tx: Tx, orderId: string, from: OrderStatus[], to: OrderStatus, data: Prisma.OrderUpdateManyMutationInput = {}) {
  const res = await tx.order.updateMany({ where: { id: orderId, status: { in: from } }, data: { ...data, status: to } });
  if (res.count === 0) return null;
  return tx.order.findUniqueOrThrow({ where: { id: orderId } });
}

/** Thrown when a conditional transition loses the race or the order moved on. */
export class ConcurrentUpdateError extends Error {
  constructor(message = "That order was updated by someone else. Reload the page and try again.") {
    super(message);
    this.name = "ConcurrentUpdateError";
  }
}

/**
 * Write a ledger entry at most once. The idempotency key makes a duplicate
 * write (webhook racing the success redirect, or a double-submitted action)
 * a no-op instead of double-counting the money.
 */
async function writeLedger(
  tx: Tx,
  entry: { orderId: string; type: "HOLD" | "RELEASE" | "REFUND"; amountCents: number; note: string; createdById?: string | null; idempotencyKey: string },
) {
  const existing = await tx.escrowEntry.findUnique({ where: { idempotencyKey: entry.idempotencyKey } });
  if (existing) return existing;
  return tx.escrowEntry.create({ data: { ...entry, createdById: entry.createdById ?? null } });
}

export interface CreateOrderInput extends QuoteInput {
  customerId: string;
  style: string;
  grammar: GrammarId;
  brief: string;
  googleSlidesUrl?: string | null;
  audience?: string | null;
  brandNotes?: string | null;
  fontsColors?: string | null;
  extraNotes?: string | null;
}

export async function createOrder(input: CreateOrderInput) {
  const [catalog, calendar] = await Promise.all([loadCatalog(), loadCalendar()]);
  const q = quote(input, catalog, calendar);
  const order = await prisma.order.create({
    data: {
      orderNumber: newOrderNumber(),
      customerId: input.customerId,
      status: "PENDING_PAYMENT",
      treatment: input.treatment,
      style: input.style,
      slideCount: clampSlides(input.slideCount),
      deliveryTier: input.deliveryTier,
      deadlineAt: q.deadlineAt,
      proofreading: input.proofreading,
      grammar: input.grammar,
      brief: input.brief,
      googleSlidesUrl: input.googleSlidesUrl || null,
      audience: input.audience || null,
      brandNotes: input.brandNotes || null,
      fontsColors: input.fontsColors || null,
      extraNotes: input.extraNotes || null,
      perSlideMinCents: q.perSlideMinCents,
      perSlideMaxCents: q.perSlideMaxCents,
      addonPerSlideCents: q.addonPerSlideCents,
      subtotalMinCents: q.subtotalMinCents,
      subtotalMaxCents: q.subtotalMaxCents,
      totalCents: q.totalCents,
    },
  });
  await addEvent(prisma, order.id, "CREATED", `Order ${order.orderNumber} created. Awaiting payment.`, input.customerId);
  return order;
}

/**
 * Record a successful upfront payment. Funds are now HELD.
 *
 * Safe to call concurrently: the status change is conditional and the ledger
 * write is keyed, so the Stripe webhook and the post-payment redirect racing
 * each other produce exactly one HOLD and one notification.
 *
 * If the payment arrives for an order that is no longer awaiting payment (the
 * customer cancelled, or paid twice through two checkout sessions), the money
 * is queued for an automatic refund and admins are alerted, instead of being
 * silently kept.
 */
export async function markOrderPaid(opts: {
  orderId: string;
  provider: "STRIPE" | "MOCK";
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  amountCents: number;
  currency?: string;
}) {
  const sessionKey = opts.providerSessionId ?? `mock-${opts.orderId}`;

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.order.findUniqueOrThrow({ where: { id: opts.orderId }, include: { customer: { select: { name: true } } } });

    await tx.payment.upsert({
      where: { providerSessionId: sessionKey },
      create: {
        orderId: before.id,
        provider: opts.provider,
        providerSessionId: sessionKey,
        providerPaymentId: opts.providerPaymentId ?? null,
        amountCents: opts.amountCents,
        currency: opts.currency ?? "usd",
        status: "SUCCEEDED",
      },
      update: { status: "SUCCEEDED", providerPaymentId: opts.providerPaymentId ?? null },
    });

    const updated = await transition(tx, before.id, ["PENDING_PAYMENT"], "PAID", { escrowStatus: "HELD", paidAt: new Date() });

    if (!updated) {
      // The order already moved on. Either this is a duplicate delivery of the
      // same payment, or the customer was charged for an order we can no
      // longer fulfil. Only the second case needs a refund.
      const payment = await tx.payment.findUnique({ where: { providerSessionId: sessionKey } });
      const alreadyHeld = await tx.escrowEntry.findUnique({ where: { idempotencyKey: `hold:${before.id}` } });
      const duplicateOfRecordedPayment = alreadyHeld?.amountCents === opts.amountCents && before.status !== "PENDING_PAYMENT" && before.paidAt !== null;
      const unwanted = !duplicateOfRecordedPayment;

      if (unwanted) {
        await tx.refundAttempt.create({
          data: {
            orderId: before.id,
            paymentId: payment?.id ?? null,
            amountCents: opts.amountCents,
            reason: `Payment received for ${before.orderNumber} while the order was ${before.status.replace(/_/g, " ").toLowerCase()}. Refunded automatically.`,
          },
        });
        await addEvent(tx, before.id, "PAYMENT_UNEXPECTED", `A payment of ${money(opts.amountCents)} arrived while the order was ${before.status.replace(/_/g, " ").toLowerCase()}. It is queued for an automatic refund.`, null, true);
      }
      return { order: { ...before }, changed: false, unwanted };
    }

    await writeLedger(tx, {
      orderId: before.id,
      type: "HOLD",
      amountCents: opts.amountCents,
      note: `Upfront payment received via ${opts.provider}. Held until customer approval.`,
      idempotencyKey: `hold:${before.id}`,
    });
    await addEvent(tx, before.id, "PAID", "Payment received. It is held by SlideBazaar and released only when you approve your designs.");
    return { order: { ...updated, customer: before.customer }, changed: true, unwanted: false };
  });

  if (result.changed) {
    const o = result.order;
    await notifyUsers([o.customerId], {
      type: "ORDER_PAID",
      title: `Payment received for ${o.orderNumber}`,
      body: `${money(opts.amountCents)} is held by SlideBazaar. A designer will be assigned shortly and your first draft is due by ${o.deadlineAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`,
      href: customerLink(o.id),
    });
    await notifyRoles(["ADMIN"], {
      type: "ORDER_PAID",
      title: `New paid order ${o.orderNumber}`,
      body: `${o.customer.name} paid ${money(opts.amountCents)}. ${o.slideCount} slides, due ${o.deadlineAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Assign a designer.`,
      href: staffLink(o.id),
    });
  } else if (result.unwanted) {
    await settlePendingRefunds(opts.orderId);
    await notifyRoles(["ADMIN"], {
      type: "REFUNDED",
      title: `Unexpected payment on ${result.order.orderNumber}`,
      body: `${money(opts.amountCents)} was captured while the order was ${result.order.status.replace(/_/g, " ").toLowerCase()}. It has been queued for an automatic refund. Check the order.`,
      href: staffLink(opts.orderId),
    });
  }
  return result.order;
}

export async function assignDesigner(orderId: string, designerId: string | null, actorId: string) {
  const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { designerId: true } });
  const order = await prisma.order.update({ where: { id: orderId }, data: { designerId } });
  const [designer, previous] = await Promise.all([
    designerId ? prisma.user.findUnique({ where: { id: designerId } }) : null,
    before.designerId && before.designerId !== designerId ? prisma.user.findUnique({ where: { id: before.designerId } }) : null,
  ]);
  await addEvent(prisma, orderId, "ASSIGNED", designer ? `Assigned to designer ${designer.name}.` : "Designer unassigned.", actorId);
  if (designer) {
    await notifyUsers([designer.id], {
      type: "ASSIGNED",
      title: `New assignment: ${order.orderNumber}`,
      body: `${order.slideCount} slides, first draft due ${order.deadlineAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Open the brief to get started.`,
      href: staffLink(orderId),
    });
  }
  if (previous) {
    await notifyUsers([previous.id], {
      type: "ASSIGNED",
      title: `${order.orderNumber} was reassigned`,
      body: designer ? `This order is now with ${designer.name}. No further action needed from you.` : "This order is no longer assigned to you.",
      href: staffLink(orderId),
    });
  }
  return order;
}

export async function setFinalTreatment(orderId: string, finalTreatment: string, actorId: string) {
  const order = await prisma.order.update({ where: { id: orderId }, data: { finalTreatment } });
  await addEvent(prisma, orderId, "NOTE", `Treatment set to ${finalTreatment.replace(/_/g, " ").toLowerCase()}.`, actorId);
  return order;
}

export async function startWork(orderId: string, actorId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    assertTransition(order.status, "IN_PROGRESS");
    const u = await transition(tx, orderId, ["PAID", "REVISION_REQUESTED", "QC_REVIEW"], "IN_PROGRESS", { startedAt: order.startedAt ?? new Date() });
    if (!u) throw new ConcurrentUpdateError();
    await addEvent(tx, orderId, "STARTED", "Design work has started.", actorId);
    return u;
  });
  return updated;
}

/** Designer has uploaded DRAFT files and slide images. The order moves to QC_REVIEW. */
export async function submitForQc(orderId: string, actorId: string, note?: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    assertTransition(order.status, "QC_REVIEW");
    const u = await transition(tx, orderId, ["PAID", "IN_PROGRESS", "REVISION_REQUESTED"], "QC_REVIEW", { startedAt: order.startedAt ?? new Date() });
    if (!u) throw new ConcurrentUpdateError();
    await addEvent(tx, orderId, "QC_SUBMITTED", `Draft submitted for quality check${note ? `: ${note}` : "."}`, actorId, true);
    await addEvent(tx, orderId, "STATUS", "Your draft is with our quality team for a final check.", actorId);
    return u;
  });
  const designer = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
  await notifyRoles(["MANAGER", "ADMIN"], {
    type: "QC_SUBMITTED",
    title: `Draft ready for QC: ${updated.orderNumber}`,
    body: `${designer?.name ?? "A designer"} submitted draft ${updated.revisionCount + 1}${note ? `: ${note}` : "."} Customer expects it by ${updated.deadlineAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`,
    href: staffLink(orderId),
  });
  return updated;
}

/**
 * QC manager approves the draft: DRAFT files become DELIVERABLE, previews are
 * released and the order moves to DELIVERED. Superseded deliverables from an
 * earlier revision are demoted so the customer only ever sees the newest set.
 */
export async function qcApprove(orderId: string, actorId: string, note?: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    assertTransition(order.status, "DELIVERED");
    // A range-priced order must have its treatment decided before it can be
    // delivered, otherwise the customer is charged the top of the estimate.
    if (order.treatment === RANGE_TREATMENT_ID && !order.finalTreatment) {
      throw new Error("Set the treatment that was actually applied before approving. Without it the customer is charged the top of the estimate.");
    }
    const version = order.revisionCount + 1;
    // Retire the previous version's deliverables, then publish this one.
    await tx.orderFile.updateMany({ where: { orderId, kind: "DELIVERABLE", version: { lt: version } }, data: { kind: "SUPERSEDED" } });
    await tx.orderFile.updateMany({ where: { orderId, kind: "DRAFT" }, data: { kind: "DELIVERABLE" } });
    const u = await transition(tx, orderId, ["QC_REVIEW"], "DELIVERED", { deliveredAt: order.deliveredAt ?? new Date() });
    if (!u) throw new ConcurrentUpdateError();
    await addEvent(tx, orderId, "QC_APPROVED", `Quality check passed${note ? `: ${note}` : "."}`, actorId, true);
    await addEvent(tx, orderId, "DELIVERED", "Draft delivered. Please review and approve, or request a revision.", actorId);
    return u;
  });
  await releasePreviews(orderId, updated.revisionCount + 1);
  await notifyUsers([updated.customerId], {
    type: "DELIVERED",
    title: `Your draft for ${updated.orderNumber} is ready`,
    body: "Take a look at the slide previews. Approve to unlock the files and release your payment, or request changes.",
    href: customerLink(orderId),
  });
  await notifyUsers([updated.designerId], {
    type: "QC_APPROVED",
    title: `QC approved ${updated.orderNumber}`,
    body: `Your draft passed quality check and is with the customer${note ? `. Note: ${note}` : "."}`,
    href: staffLink(orderId),
  });
  return updated;
}

/** QC manager sends the draft back to the designer with internal feedback. */
export async function qcReject(orderId: string, actorId: string, feedback: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    assertTransition(order.status, "IN_PROGRESS");
    await tx.orderFile.updateMany({ where: { orderId, kind: "DRAFT" }, data: { label: "Rejected by QC" } });
    const u = await transition(tx, orderId, ["QC_REVIEW"], "IN_PROGRESS");
    if (!u) throw new ConcurrentUpdateError();
    await addEvent(tx, orderId, "QC_REJECTED", `Sent back by QC: ${feedback}`, actorId, true);
    return u;
  });
  await notifyUsers([updated.designerId], {
    type: "QC_RETURNED",
    title: `QC sent ${updated.orderNumber} back`,
    body: feedback,
    href: staffLink(orderId),
  });
  return updated;
}

export async function requestRevision(orderId: string, customerId: string, feedback: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.customerId !== customerId) throw new Error("Not your order");
    assertTransition(order.status, "REVISION_REQUESTED");
    const u = await transition(tx, orderId, ["DELIVERED"], "REVISION_REQUESTED", { revisionCount: { increment: 1 } });
    if (!u) throw new ConcurrentUpdateError();
    await addEvent(tx, orderId, "REVISION_REQUESTED", `Revision requested: ${feedback}`, customerId);
    await tx.orderMessage.create({ data: { orderId, authorId: customerId, body: `Revision request: ${feedback}` } });
    return u;
  });
  await notifyUsers([updated.designerId], {
    type: "REVISION",
    title: `Changes requested on ${updated.orderNumber}`,
    body: feedback,
    href: staffLink(orderId),
  });
  await notifyRoles(["MANAGER"], {
    type: "REVISION",
    title: `Customer wants changes on ${updated.orderNumber}`,
    body: feedback,
    href: staffLink(orderId),
  });
  return updated;
}

/**
 * Customer approves the delivery: the payment is released to SlideBazaar and
 * the design files unlock. If the final treatment costs less than the amount
 * held, the difference is queued for refund and settled against Stripe.
 */
export async function approveAndRelease(orderId: string, customerId: string) {
  const catalog = await loadCatalog();
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    if (order.customerId !== customerId) throw new Error("Not your order");
    assertTransition(order.status, "APPROVED");

    const finalTotal = finalTotalFor(order, catalog);
    const refundCents = Math.max(0, order.totalCents - finalTotal);

    const updated = await transition(tx, orderId, ["DELIVERED"], "APPROVED", {
      escrowStatus: refundCents > 0 ? "PARTIALLY_RELEASED" : "RELEASED",
      finalTotalCents: finalTotal,
      approvedAt: new Date(),
    });
    if (!updated) throw new ConcurrentUpdateError();

    await writeLedger(tx, {
      orderId,
      type: "RELEASE",
      amountCents: finalTotal,
      note: "Customer approved final designs. Funds released to SlideBazaar.",
      createdById: customerId,
      idempotencyKey: `release:${orderId}`,
    });
    if (refundCents > 0) {
      await writeLedger(tx, {
        orderId,
        type: "REFUND",
        amountCents: refundCents,
        note: "Difference between the estimate held and the final price.",
        createdById: customerId,
        idempotencyKey: `refund-difference:${orderId}`,
      });
      await tx.refundAttempt.create({
        data: {
          orderId,
          paymentId: order.payments.find((p) => p.status === "SUCCEEDED")?.id ?? null,
          amountCents: refundCents,
          reason: "Difference between the estimate held and the final price.",
        },
      });
    }

    await addEvent(tx, orderId, "APPROVED", "Customer approved the final designs.", customerId);
    await addEvent(
      tx,
      orderId,
      "RELEASED",
      refundCents > 0 ? `Payment released. ${money(finalTotal)} paid to SlideBazaar, ${money(refundCents)} refunded.` : "Payment released to SlideBazaar.",
      customerId,
    );
    return { updated, finalTotal, refundCents };
  });

  if (result.refundCents > 0) await settlePendingRefunds(orderId);
  await completeOrder(orderId);

  const o = result.updated;
  await notifyUsers([o.customerId], {
    type: "APPROVED",
    title: `Thank you! ${o.orderNumber} is complete`,
    body: `Your design files are now unlocked for download. ${money(result.finalTotal)} was released to SlideBazaar${result.refundCents > 0 ? ` and ${money(result.refundCents)} is being refunded to your card` : ""}.`,
    href: customerLink(orderId),
  });
  await notifyUsers([o.designerId], {
    type: "APPROVED",
    title: `Customer approved ${o.orderNumber}`,
    body: "Nice work. The customer approved the final designs.",
    href: staffLink(orderId),
  });
  await notifyRoles(["ADMIN"], {
    type: "APPROVED",
    title: `Payment released for ${o.orderNumber}`,
    body: `${money(result.finalTotal)} released${result.refundCents > 0 ? `, ${money(result.refundCents)} refunded` : ""}.`,
    href: staffLink(orderId),
  });
  return o;
}

export async function completeOrder(orderId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const u = await transition(tx, orderId, ["APPROVED"], "COMPLETED", { completedAt: new Date() });
    if (!u) return null;
    await addEvent(tx, orderId, "STATUS", "Order completed. Thank you for working with SlideBazaar.");
    return u;
  });
  return updated ?? prisma.order.findUniqueOrThrow({ where: { id: orderId } });
}

/** Refund back to the customer, in full or in part. Admin only. */
export async function refundOrder(orderId: string, actorId: string, reason: string, amountCents?: number) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    assertTransition(order.status, "REFUNDED");
    const held = order.totalCents;

    // Validate the amount here rather than trusting the caller: an unparseable
    // or out-of-range figure must not reach the ledger.
    let amount = held;
    if (amountCents !== undefined) {
      if (!Number.isFinite(amountCents) || !Number.isInteger(amountCents) || amountCents < 1) {
        throw new Error("Enter a refund amount between 0.01 and the amount held.");
      }
      if (amountCents > held) throw new Error(`The refund cannot be more than the ${money(held)} held on this order.`);
      amount = amountCents;
    }
    const full = amount >= held;

    const updated = await transition(tx, orderId, ["PAID", "IN_PROGRESS", "QC_REVIEW", "DELIVERED", "REVISION_REQUESTED"], "REFUNDED", {
      escrowStatus: full ? "REFUNDED" : "PARTIALLY_RELEASED",
      finalTotalCents: held - amount,
      cancelledAt: new Date(),
    });
    if (!updated) throw new ConcurrentUpdateError();

    await writeLedger(tx, { orderId, type: "REFUND", amountCents: amount, note: reason, createdById: actorId, idempotencyKey: `refund-admin:${orderId}` });
    if (!full) {
      await writeLedger(tx, {
        orderId,
        type: "RELEASE",
        amountCents: held - amount,
        note: "Balance retained for work completed.",
        createdById: actorId,
        idempotencyKey: `release-partial:${orderId}`,
      });
    }
    await tx.refundAttempt.create({
      data: { orderId, paymentId: order.payments.find((p) => p.status === "SUCCEEDED")?.id ?? null, amountCents: amount, reason },
    });
    await addEvent(tx, orderId, "REFUNDED", `${full ? "Full" : "Partial"} refund of ${money(amount)} issued. ${reason}`, actorId);
    return { updated, amount, full };
  });

  await settlePendingRefunds(orderId);
  await notifyUsers([result.updated.customerId], {
    type: "REFUNDED",
    title: `${result.full ? "Refund" : "Partial refund"} issued for ${result.updated.orderNumber}`,
    body: `${money(result.amount)} is on its way back to your original payment method. ${reason}`,
    href: customerLink(orderId),
  });
  await notifyUsers([result.updated.designerId], {
    type: "REFUNDED",
    title: `${result.updated.orderNumber} was closed with a refund`,
    body: reason,
    href: staffLink(orderId),
  });
  return result.updated;
}

/**
 * Cancel an order that was never paid for, expiring any open Stripe checkout
 * session first so the customer cannot complete a payment we would not record.
 */
export async function cancelUnpaidOrder(orderId: string, actorId: string) {
  const pending = await prisma.payment.findMany({ where: { orderId, status: "PENDING", provider: "STRIPE" } });
  for (const p of pending) {
    if (!p.providerSessionId || !stripeEnabled()) continue;
    try {
      await stripe().checkout.sessions.expire(p.providerSessionId);
    } catch (err) {
      // Already expired, already paid, or unreachable. If it was paid, the
      // webhook path queues an automatic refund, so cancelling is still safe.
      console.warn(`[cancel] could not expire session ${p.providerSessionId}:`, err instanceof Error ? err.message : err);
    }
    await prisma.payment.update({ where: { id: p.id }, data: { status: "FAILED" } });
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    assertTransition(order.status, "CANCELLED");
    if (order.status !== "PENDING_PAYMENT") throw new Error("Only unpaid orders can be cancelled; refund paid orders instead.");
    const u = await transition(tx, orderId, ["PENDING_PAYMENT"], "CANCELLED", { cancelledAt: new Date() });
    if (!u) throw new ConcurrentUpdateError();
    await addEvent(tx, orderId, "CANCELLED", "Order cancelled before payment.", actorId);
    return u;
  });
}

/* ---------------- Refund settlement ---------------- */

const MAX_REFUND_ATTEMPTS = 5;

/**
 * Push every pending refund for an order to Stripe. Each attempt is recorded,
 * so a failure leaves a retryable row and an alert rather than a customer who
 * was told they were refunded while the money never moved.
 */
export async function settlePendingRefunds(orderId?: string) {
  const pending = await prisma.refundAttempt.findMany({
    where: { status: "PENDING", attempts: { lt: MAX_REFUND_ATTEMPTS }, ...(orderId ? { orderId } : {}) },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const settled: string[] = [];
  for (const attempt of pending) {
    const payment = attempt.paymentId ? await prisma.payment.findUnique({ where: { id: attempt.paymentId } }) : null;
    try {
      let providerRefundId: string | null = null;
      if (payment && payment.provider === "STRIPE" && stripeEnabled()) {
        if (!payment.providerPaymentId) throw new Error("The payment has no Stripe PaymentIntent to refund against.");
        const refund = await stripe().refunds.create(
          { payment_intent: payment.providerPaymentId, amount: attempt.amountCents },
          { idempotencyKey: `refund-${attempt.id}` },
        );
        providerRefundId = refund.id;
      }
      // Mock payments have no provider to call; the ledger is the record.
      await prisma.$transaction(async (tx) => {
        await tx.refundAttempt.update({
          where: { id: attempt.id },
          data: { status: "SUCCEEDED", attempts: { increment: 1 }, settledAt: new Date(), providerRefundId, lastError: null },
        });
        if (payment) {
          const refunded = payment.refundedCents + attempt.amountCents;
          await tx.payment.update({
            where: { id: payment.id },
            data: { refundedCents: refunded, status: refunded >= payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" },
          });
        }
      });
      settled.push(attempt.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attemptsNow = attempt.attempts + 1;
      const exhausted = attemptsNow >= MAX_REFUND_ATTEMPTS;
      await prisma.refundAttempt.update({
        where: { id: attempt.id },
        data: { status: exhausted ? "FAILED" : "PENDING", attempts: attemptsNow, lastError: message.slice(0, 500) },
      });
      const order = await prisma.order.findUnique({ where: { id: attempt.orderId }, select: { orderNumber: true } });
      await addEvent(prisma, attempt.orderId, "REFUND_FAILED", `Refund of ${money(attempt.amountCents)} failed: ${message}`, null, true);
      await notifyRoles(["ADMIN"], {
        type: "REFUNDED",
        title: `Refund failed on ${order?.orderNumber ?? attempt.orderId}`,
        body: `${money(attempt.amountCents)} could not be refunded: ${message}. ${exhausted ? "Retries are exhausted; refund this by hand in Stripe." : "It will be retried."}`,
        href: staffLink(attempt.orderId),
      });
    }
  }
  return { settled: settled.length, attempted: pending.length };
}

/** Admin action: put a failed refund back in the queue and try it again now. */
export async function retryRefund(refundAttemptId: string) {
  const attempt = await prisma.refundAttempt.findUniqueOrThrow({ where: { id: refundAttemptId } });
  if (attempt.status === "SUCCEEDED") return attempt;
  await prisma.refundAttempt.update({ where: { id: refundAttemptId }, data: { status: "PENDING", attempts: 0, lastError: null } });
  await settlePendingRefunds(attempt.orderId);
  return prisma.refundAttempt.findUniqueOrThrow({ where: { id: refundAttemptId } });
}

/** Refunds that need a human: shown on the admin overview. */
export async function unsettledRefunds() {
  return prisma.refundAttempt.findMany({
    where: { status: { in: ["PENDING", "FAILED"] } },
    include: { order: { select: { id: true, orderNumber: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Post a message on the order and notify the other side of the conversation. */
export async function postMessage(orderId: string, authorId: string, body: string) {
  const msg = await prisma.orderMessage.create({ data: { orderId, authorId, body } });
  const [order, author] = await Promise.all([
    prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { orderNumber: true, customerId: true, designerId: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: authorId }, select: { name: true, role: true } }),
  ]);
  const snippet = body.length > 140 ? `${body.slice(0, 137)}...` : body;
  if (author.role === "CUSTOMER") {
    await notifyUsers([order.designerId], { type: "MESSAGE", title: `Message from ${author.name} on ${order.orderNumber}`, body: snippet, href: staffLink(orderId) });
    if (!order.designerId) await notifyRoles(["MANAGER", "ADMIN"], { type: "MESSAGE", title: `Unassigned order ${order.orderNumber} has a new message`, body: snippet, href: staffLink(orderId) });
  } else {
    await notifyUsers([order.customerId], { type: "MESSAGE", title: `New message on ${order.orderNumber}`, body: snippet, href: customerLink(orderId) });
  }
  return msg;
}

/** Escrow totals for the admin overview. */
export async function escrowSummary() {
  const grouped = await prisma.escrowEntry.groupBy({ by: ["type"], _sum: { amountCents: true } });
  const sum = (t: string) => grouped.find((g) => g.type === t)?._sum.amountCents ?? 0;
  const hold = sum("HOLD");
  const release = sum("RELEASE");
  const refund = sum("REFUND");
  return { heldCents: hold - release - refund, releasedCents: release, refundedCents: refund, collectedCents: hold };
}
