import "server-only";
import { appUrl } from "./env";
import { money } from "./format";
import { type PabblyEvent, envelope } from "./pabbly";
import { STEPS } from "./wizard-attempts";
import { blockerCode } from "./wizard-blockers";

/**
 * Builders for the four event bodies.
 *
 * Every one of these is structural. The five free-text columns are not in
 * ATTEMPT_SELECT at all, so a later edit here cannot accidentally forward one:
 * it would not compile.
 */

const stepName = (n: number) => STEPS.find((s) => s.n === n)?.label ?? `Step ${n}`;

/**
 * Deliberately absent: brief, audience, brandNotes, fontsColors, extraNotes.
 * Not merely unused, but never fetched, so they cannot leak by accident.
 */
export const ATTEMPT_SELECT = {
  attemptId: true,
  visitorId: true,
  userId: true,
  createdAt: true,
  lastSeenAt: true,
  step: true,
  maxStep: true,
  blocker: true,
  blockedCount: true,
  submitCount: true,
  lastField: true,
  signedIn: true,
  reloads: true,
  resumed: true,
  openedExtras: true,
  stepSeconds: true,
  treatment: true,
  style: true,
  slideCount: true,
  deliveryTier: true,
  proofreading: true,
  grammar: true,
  useGoogleSlides: true,
  estimateCents: true,
  fileCount: true,
  fileMb: true,
  styleFileCount: true,
  detectedSlides: true,
  billingFilled: true,
  googleSlidesFilled: true,
  outcome: true,
} as const;

export interface AttemptRow {
  attemptId: string;
  visitorId: string | null;
  userId: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  step: number;
  maxStep: number;
  blocker: string | null;
  blockedCount: number;
  submitCount: number;
  lastField: string | null;
  signedIn: boolean;
  reloads: number;
  resumed: boolean;
  openedExtras: boolean;
  stepSeconds: string | null;
  treatment: string | null;
  style: string | null;
  slideCount: number | null;
  deliveryTier: string | null;
  proofreading: string | null;
  grammar: string | null;
  useGoogleSlides: boolean;
  estimateCents: number | null;
  fileCount: number;
  fileMb: number;
  styleFileCount: number;
  detectedSlides: number | null;
  billingFilled: string | null;
  googleSlidesFilled: boolean;
  outcome: string;
}

export function startedEvent(attemptId: string, visitorId: string | null, signedIn: boolean, resumed: boolean, at: Date): PabblyEvent {
  return envelope(
    "wizard.started",
    `started:${attemptId}`,
    at,
    resumed ? "Someone came back to the order form." : "Someone started the order form.",
    `${appUrl()}/admin/funnel`,
    { attemptId, visitorId, step: 1, stepName: stepName(1), signedIn, resumed },
  );
}

export function abandonedEvent(a: AttemptRow, now: number): PabblyEvent {
  const quiet = Math.round((now - a.lastSeenAt.getTime()) / 60_000);
  const est = a.estimateCents === null ? null : money(a.estimateCents);
  return envelope(
    "wizard.abandoned",
    // lastSeenAt is part of the id: a tab that comes back and then goes quiet
    // again is genuinely a second abandonment and must not be deduplicated away
    // downstream.
    `abandoned:${a.attemptId}:${a.lastSeenAt.getTime()}`,
    a.lastSeenAt,
    `Someone left the order form at step ${a.maxStep} of 5 (${stepName(a.maxStep)}) after ${quiet} minutes of silence${est ? `. Estimate on screen: ${est}` : ""}.`,
    `${appUrl()}/admin/funnel`,
    {
      attemptId: a.attemptId,
      visitorId: a.visitorId,
      startedAt: a.createdAt.toISOString(),
      lastSeenAt: a.lastSeenAt.toISOString(),
      quietForMinutes: quiet,
      step: a.step,
      maxStep: a.maxStep,
      stepName: stepName(a.maxStep),
      blockerCode: blockerCode(a.blocker),
      blockedCount: a.blockedCount,
      submitCount: a.submitCount,
      lastField: a.lastField,
      signedIn: a.signedIn,
      reloads: a.reloads,
      resumed: a.resumed,
      openedExtras: a.openedExtras,
      secondsOnStep: a.stepSeconds,
      choices: {
        treatment: a.treatment,
        style: a.style,
        slideCount: a.slideCount,
        deliveryTier: a.deliveryTier,
        proofreading: a.proofreading,
        grammar: a.grammar,
        useGoogleSlides: a.useGoogleSlides,
      },
      estimateCents: a.estimateCents,
      estimateText: est,
      files: { count: a.fileCount, mb: a.fileMb, styleCount: a.styleFileCount, detectedSlides: a.detectedSlides },
      billingFilled: a.billingFilled ? a.billingFilled.split(",") : [],
      googleSlidesFilled: a.googleSlidesFilled,
    },
  );
}

export function orderPlacedEvent(o: {
  id: string;
  orderNumber: string;
  treatment: string;
  style: string;
  slideCount: number;
  deliveryTier: string;
  totalCents: number;
  deadlineAt: Date;
  createdAt: Date;
  customerEmail: string;
  customerName: string;
}): PabblyEvent {
  return envelope(
    "order.placed",
    `order:${o.id}`,
    o.createdAt,
    `New order ${o.orderNumber}: ${o.slideCount} slides, ${money(o.totalCents)}. Not paid yet.`,
    `${appUrl()}/admin/orders/${o.id}`,
    {
      orderId: o.id,
      orderNumber: o.orderNumber,
      treatment: o.treatment,
      style: o.style,
      slideCount: o.slideCount,
      deliveryTier: o.deliveryTier,
      totalCents: o.totalCents,
      totalText: money(o.totalCents),
      deadlineAt: o.deadlineAt.toISOString(),
      // The customer's own details, which they gave us in order to be contacted
      // about this order. Unlike a visitor's brief, this is not somebody who
      // never agreed to anything.
      customerEmail: o.customerEmail,
      customerName: o.customerName,
    },
  );
}

export function appNotificationEvent(args: {
  type: string;
  title: string;
  href: string | null;
  bodyChars: number;
  recipients: number;
  audiences: string[];
  at: Date;
  key: string;
}): PabblyEvent {
  return envelope(
    `app.${args.type}`,
    `notif:${args.key}`,
    args.at,
    args.title,
    `${appUrl()}${args.href ?? "/admin"}`,
    {
      type: args.type,
      title: args.title,
      href: args.href,
      // The length only, never the body. Several notification bodies are a
      // verbatim slice of a message a customer typed.
      bodyChars: args.bodyChars,
      recipients: args.recipients,
      audiences: args.audiences,
    },
  );
}

/** Sent by the Test button, so the owner can prove the wiring on day one. */
export function testEvent(who: string, at: Date): PabblyEvent {
  return envelope("test", `test:${at.getTime()}`, at, `Test from SlideBazaar, sent by ${who}.`, `${appUrl()}/admin/notifications`, { sentBy: who });
}
