import { after, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sweepAbandoned } from "@/lib/pabbly-sweep";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sweepIfDue } from "@/lib/wizard-attempts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/pabbly-sweep — driven by a Pabbly Connect Schedule workflow.
 *
 * This is what makes "somebody gave up" arrive on time. Without it the sweep
 * only runs when a visitor happens to load a page, which on a quiet night means
 * the morning, or never.
 *
 * A bad token gets 404 rather than 401, matching the wizard endpoint: an
 * endpoint that reports what it rejected teaches somebody how to get past it.
 */
export async function GET(req: Request) {
  const want = process.env.PABBLY_SWEEP_TOKEN ?? "";
  const url = new URL(req.url);
  const got = req.headers.get("x-sweep-token") ?? url.searchParams.get("key") ?? "";

  // Compare lengths first: timingSafeEqual throws on a length mismatch.
  if (want.length < 24 || got.length !== want.length) return new NextResponse(null, { status: 404 });
  if (!timingSafeEqual(Buffer.from(got), Buffer.from(want))) return new NextResponse(null, { status: 404 });
  if (!rateLimit(`pabbly:sweep:${clientKey(req)}`, 30, 60).allowed) return new NextResponse(null, { status: 429 });

  const result = await sweepAbandoned({ force: true });
  // Retention rides along: this is the one call that happens on a schedule, so
  // it is also the one that covers a stretch with no visitors at all.
  after(async () => {
    await sweepIfDue();
  });
  return NextResponse.json(result);
}
