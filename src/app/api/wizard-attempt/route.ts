import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { type WizardAttemptInput, wizardAttemptSchema, wizardEraseSchema } from "@/lib/validation";
import { modeFor, sendPabbly } from "@/lib/pabbly";
import { startedEvent } from "@/lib/pabbly-events";
import { sweepAbandoned } from "@/lib/pabbly-sweep";
import { sweepIfDue } from "@/lib/wizard-attempts";

/**
 * POST /api/wizard-attempt   (application/json, usually via navigator.sendBeacon)
 *
 * Records how far somebody got through the order wizard and what they had typed
 * when they stopped, so we can see which step loses people.
 *
 * Unauthenticated by design: the people who never sign in are the entire point.
 * That makes it the only endpoint here that stores free text on behalf of a
 * request with no session behind it, so every cheap rejection happens before
 * anything is parsed or written, and the reply is always 204 with no body. A
 * beacon cannot read a response anyway, and an endpoint that reports what it
 * rejected is an endpoint that teaches someone how to get past it.
 */

/** The zod caps sum to roughly 21 KB of text; this is the hard stop above it. */
const MAX_BODY = 64_000;

const BOT_UA =
  /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|curl|wget|python-requests|axios|scrapy|lighthouse|pagespeed|uptime|monitor/i;

const ok = () => new NextResponse(null, { status: 204 });

/**
 * Is this a same-origin POST from our own pages?
 *
 * Compared against the host the request actually arrived on, NOT against
 * appUrl(). An earlier version of this used appUrl(), and because APP_URL in
 * the deployment did not match the domain people actually visit, every beacon
 * from every real browser was silently discarded: browsers always send Origin
 * on a POST, so the check rejected 100% of genuine traffic and 0% of anything
 * else. The host header cannot drift from reality the way a config value can.
 *
 * A missing Origin is allowed: some non-browser clients omit it, and this
 * endpoint is not a mutation anybody else's account can feel.
 */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  // Vercel puts the domain the visitor used in x-forwarded-host.
  const self = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (self && originHost === self) return true;

  try {
    if (originHost === new URL(appUrl()).host) return true;
  } catch {
    /* a malformed APP_URL must not be able to reject real traffic */
  }

  // Never silent again: a rejection here used to look exactly like no traffic.
  console.warn(`[wizard-attempt] origin ${originHost} did not match host ${self ?? "(none)"}`);
  return false;
}

/** The payload as database columns. billingFilled is a list on the wire. */
function toColumns(p: WizardAttemptInput) {
  return {
    step: p.step,
    maxStep: p.maxStep,
    blocker: p.blocker,
    blockedCount: p.blockedCount,
    submitCount: p.submitCount,
    lastField: p.lastField ?? null,
    stepSeconds: p.stepSeconds ?? null,
    resumed: p.resumed,
    reloads: p.reloads,
    openedExtras: p.openedExtras,
    treatment: p.treatment ?? null,
    style: p.style ?? null,
    slideCount: p.slideCount ?? null,
    deliveryTier: p.deliveryTier ?? null,
    proofreading: p.proofreading ?? null,
    grammar: p.grammar ?? null,
    useGoogleSlides: p.useGoogleSlides,
    estimateCents: p.estimateCents ?? null,
    brief: p.brief,
    audience: p.audience,
    brandNotes: p.brandNotes,
    fontsColors: p.fontsColors,
    extraNotes: p.extraNotes,
    billingFilled: p.billingFilled.length ? p.billingFilled.join(",") : null,
    googleSlidesFilled: p.googleSlidesFilled,
    fileCount: p.fileCount,
    fileMb: p.fileMb,
    styleFileCount: p.styleFileCount,
    detectedSlides: p.detectedSlides ?? null,
  };
}

/**
 * Flagged rather than dropped, so the report can exclude these and still say
 * how many it excluded. A silent drop would look like a quiet week.
 */
function isSuspect(p: WizardAttemptInput, existing: { createdAt: Date } | null, now: Date) {
  // Nobody reads five steps of a form in three seconds.
  if (existing && p.maxStep >= 5 && now.getTime() - existing.createdAt.getTime() < 3_000) return true;
  // Counters only climb through real interaction; these are scripted numbers.
  if (p.reloads > 100 || p.blockedCount > 200 || p.submitCount > 50) return true;
  return false;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return ok();

  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return ok();

  // A missing Content-Length means a chunked body, which would be buffered
  // before any cap could apply. Require it.
  const len = Number(req.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(len) || len <= 0 || len > MAX_BODY) return ok();

  const ip = clientKey(req);
  if (!rateLimit(`wz:ip:${ip}`, 240, 60).allowed) return ok();

  const parsed = wizardAttemptSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return ok();
  const p = parsed.data;

  if (!rateLimit(`wz:att:${p.attemptId}`, 120, 60).allowed) return ok();

  const existing = await prisma.wizardAttempt.findUnique({
    where: { attemptId: p.attemptId },
    select: { seq: true, maxStep: true, outcome: true, userId: true, createdAt: true, contentPurgedAt: true },
  });

  // A converted or purged row is finished. A zombie tab must not resurrect it,
  // and a late beacon must not refill the text the conversion just scrubbed.
  if (existing && (existing.outcome !== "OPEN" || existing.contentPurgedAt)) return ok();
  if (existing && existing.seq >= p.seq) return ok();

  // Identity comes from the verified cookie, never from the payload. The verify
  // plus user lookup runs only when a cookie is actually present and this row
  // has not been stamped yet, so at most once per attempt.
  const hasCookie = Boolean((await cookies()).get(SESSION_COOKIE)?.value);
  const userId = hasCookie ? (existing?.userId ?? (await getCurrentUser())?.id ?? null) : (existing?.userId ?? null);

  const now = new Date();
  const row = {
    ...toColumns(p),
    signedIn: hasCookie,
    userId,
    lastSeenAt: now,
    seq: p.seq,
    suspect: isSuspect(p, existing, now),
  };

  if (!existing) {
    // Minting rows is the expensive operation, so it gets a far tighter limit of
    // its own. Per hour rather than per minute, and generous, because one office
    // behind one address is a single key here and an untracked visitor is
    // invisible to us as well as to them.
    if (!rateLimit(`wz:new:${ip}`, 40, 3600).allowed) return ok();
    // "We minted the row", not merely "we took the !existing branch": two first
    // beacons can race and only the winner should announce a new visitor.
    const minted = await prisma.wizardAttempt
      .create({ data: { attemptId: p.attemptId, visitorId: p.visitorId ?? null, createdAt: now, ...row } })
      .then(() => true)
      .catch(() => false);
    if (minted && !row.suspect) {
      after(async () => {
        if ((await modeFor("wizard.started")) === "off") return;
        await sendPabbly(startedEvent(p.attemptId, p.visitorId ?? null, row.signedIn, p.resumed, now));
      });
    }
  } else {
    // seq in the WHERE is what makes the read-modify-write above safe: if a
    // higher-seq beacon landed in between, this matches nothing and is correctly
    // a no-op. maxStep is monotonic and computed here, never trusted from the
    // client.
    await prisma.wizardAttempt.updateMany({
      where: { attemptId: p.attemptId, seq: { lt: p.seq }, outcome: "OPEN" },
      data: { ...row, maxStep: Math.max(existing.maxStep, p.maxStep) },
    });
  }

  // Both rides on traffic, because the project has no scheduler. Registered
  // separately so a surprise in one cannot stop the other, and written as
  // explicit async bodies so there is always a promise for after() to await.
  after(async () => {
    await sweepIfDue();
  });
  after(async () => {
    await sweepAbandoned();
  });
  return ok();
}

/**
 * DELETE /api/wizard-attempt — the visitor withdrew consent.
 *
 * Deletes outright rather than clearing the text: they are saying they did not
 * agree to any of it, so the row goes, not merely its contents.
 *
 * Uses sameOrigin for the same reason the POST does. An earlier version of that
 * check compared against appUrl(), which does not necessarily match the host
 * somebody actually visited, and a mismatch here would mean silently refusing
 * to honour an erasure — the worst possible thing to get wrong quietly.
 *
 * Converted attempts are kept: that data now belongs to a real order, and the
 * order is the lawful record of a transaction they did agree to.
 */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return ok();

  const ip = clientKey(req);
  if (!rateLimit(`wz:del:${ip}`, 60, 3600).allowed) return ok();

  const parsed = wizardEraseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return ok();
  const { attemptId, visitorId } = parsed.data;

  const or: { attemptId?: string; visitorId?: string }[] = [];
  if (attemptId) or.push({ attemptId });
  if (visitorId) or.push({ visitorId });

  try {
    const { count } = await prisma.wizardAttempt.deleteMany({ where: { OR: or, outcome: "OPEN" } });
    if (count) console.info(`[wizard-attempt] erased ${count} row(s) on withdrawal of consent`);
  } catch (err) {
    console.error("[wizard-attempt] erasure failed:", err instanceof Error ? err.message : err);
  }
  return ok();
}
