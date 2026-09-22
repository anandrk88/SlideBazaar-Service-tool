import "server-only";
import { prisma } from "./db";
import { modeFor, sendPabbly } from "./pabbly";
import { ATTEMPT_SELECT, type AttemptRow, abandonedEvent } from "./pabbly-events";
import { SETTLE_MS } from "./wizard-attempts";

/**
 * Noticing that somebody gave up.
 *
 * Abandonment is not an event the server can observe: nobody tells it a tab
 * closed. It can only notice, later, that nothing has happened on an attempt
 * for thirty minutes. Something has to do that noticing, and this project has
 * no scheduler, so this runs from after() on ordinary request traffic and,
 * properly, from a Pabbly Schedule workflow hitting /api/pabbly-sweep.
 *
 * Abandonment stays derived and is never written to WizardAttempt.outcome. The
 * drop-off report counts "left here" as outcome OPEN while counting "reached"
 * regardless, so stamping a third value would zero every numerator on that page
 * while leaving the denominators intact: it would read "nobody is abandoning"
 * at the exact moment these alerts said otherwise.
 */

const STATE_KEY = "pabblyAbandonState";
/** Doubles as the lease: an instance that dies mid-sweep blocks nothing longer. */
const COOLDOWN_MS = 5 * 60_000;
const MAX_PER_SWEEP = 10;
/** A floor on replay, so re-enabling after a month does not announce a month. */
const LOOKBACK_MS = 6 * 3_600_000;

interface State {
  v: 1;
  mark: string;
  sweptAt: string;
}

/**
 * Compare and swap on one Setting row. Prisma emits
 * UPDATE "Setting" SET value=$1 WHERE key=$2 AND value=$3, and Postgres locks
 * the row, so exactly one of any number of concurrent callers sees count === 1.
 */
async function cas(prev: string, next: State): Promise<boolean> {
  const r = await prisma.setting.updateMany({ where: { key: STATE_KEY, value: prev }, data: { value: JSON.stringify(next) } });
  return r.count === 1;
}

export async function sweepAbandoned(opts: { force?: boolean } = {}): Promise<{ sent: number; skipped: string | null }> {
  try {
    if ((await modeFor("wizard.abandoned")) === "off") return { sent: 0, skipped: "off" };
    if (!process.env.PABBLY_WEBHOOK_URL) return { sent: 0, skipped: "not_configured" };

    const now = Date.now();
    const cutoff = new Date(now - SETTLE_MS);

    // The only query on the hot path. Everything below runs when work is due.
    const row = await prisma.setting.findUnique({ where: { key: STATE_KEY } });

    if (!row) {
      // First run. Seed at the cutoff and send nothing: a fresh deployment must
      // not announce ninety days of history. Setting.key is the primary key, so
      // exactly one racing instance wins the create.
      const seed: State = { v: 1, mark: cutoff.toISOString(), sweptAt: new Date(now).toISOString() };
      await prisma.setting.create({ data: { key: STATE_KEY, value: JSON.stringify(seed) } }).catch(() => {});
      return { sent: 0, skipped: "seeded" };
    }

    const state = JSON.parse(row.value) as State;
    if (!opts.force && now - Date.parse(state.sweptAt) < COOLDOWN_MS) return { sent: 0, skipped: "cooldown" };

    // Claim the lease before reading a single attempt. The loser sends nothing.
    let prev = row.value;
    const claimed: State = { v: 1, mark: state.mark, sweptAt: new Date(now).toISOString() };
    if (!(await cas(prev, claimed))) return { sent: 0, skipped: "claimed_elsewhere" };
    prev = JSON.stringify(claimed);

    const from = new Date(Math.max(Date.parse(state.mark), now - LOOKBACK_MS));
    if (!(from < cutoff)) return { sent: 0, skipped: "no_window" };

    const rows = (await prisma.wizardAttempt.findMany({
      where: { outcome: "OPEN", suspect: false, lastSeenAt: { gt: from, lte: cutoff } },
      orderBy: { lastSeenAt: "asc" },
      take: MAX_PER_SWEEP,
      select: ATTEMPT_SELECT,
    })) as AttemptRow[];

    if (rows.length === 0) {
      // Nothing is sent. Advance the mark anyway, so the window is not rescanned.
      await cas(prev, { v: 1, mark: cutoff.toISOString(), sweptAt: new Date().toISOString() });
      return { sent: 0, skipped: null };
    }

    // The order endpoint only closes an attempt out when the browser supplied an
    // attempt id. When storage was blocked it did not, and the row stays OPEN
    // for good. Without these two checks a customer who actually paid would be
    // reported as having given up.
    const visitorIds = rows.map((r) => r.visitorId).filter((v): v is string => Boolean(v));
    const userIds = rows.map((r) => r.userId).filter((v): v is string => Boolean(v));
    const [buyerRows, orderRows] = await Promise.all([
      visitorIds.length
        ? prisma.wizardAttempt.findMany({
            where: { visitorId: { in: visitorIds }, outcome: "CONVERTED", convertedAt: { gte: new Date(now - 86_400_000) } },
            select: { visitorId: true },
          })
        : Promise.resolve([] as { visitorId: string | null }[]),
      userIds.length
        ? prisma.order.findMany({ where: { customerId: { in: userIds }, createdAt: { gte: from } }, select: { customerId: true } })
        : Promise.resolve([] as { customerId: string }[]),
    ]);
    const buyers = new Set(buyerRows.map((b) => b.visitorId));
    const ordered = new Set(orderRows.map((o) => o.customerId));

    let sent = 0;
    for (const r of rows) {
      const bought = (r.visitorId && buyers.has(r.visitorId)) || (r.userId && ordered.has(r.userId));

      if (!bought) {
        // Re-read the outcome immediately before posting, so a conversion that
        // landed during this pass is caught. Narrows the race to one HTTP call.
        const live = await prisma.wizardAttempt.findUnique({ where: { attemptId: r.attemptId }, select: { outcome: true } });
        if (live?.outcome === "OPEN") {
          if (!(await sendPabbly(abandonedEvent(r, now)))) {
            // Pabbly is down. Stop, leave the mark where the last success put
            // it, and retry this row on the next sweep.
            return { sent, skipped: "send_failed" };
          }
          sent += 1;
        }
      }

      // Advance past this row either way, or a converted one blocks the mark
      // forever.
      const next: State = { v: 1, mark: r.lastSeenAt.toISOString(), sweptAt: new Date().toISOString() };
      if (!(await cas(prev, next))) return { sent, skipped: "lease_lost" };
      prev = JSON.stringify(next);
    }

    // Fewer than the cap came back, so the window is drained: jump to the cutoff.
    if (rows.length < MAX_PER_SWEEP) {
      await cas(prev, { v: 1, mark: cutoff.toISOString(), sweptAt: new Date().toISOString() });
    }
    return { sent, skipped: null };
  } catch (err) {
    console.error("[pabbly] abandoned sweep failed:", err instanceof Error ? err.message : err);
    return { sent: 0, skipped: "error" };
  }
}

/** Whether the owner has set up the scheduled ping. Read by the admin page. */
export function sweepScheduled() {
  return (process.env.PABBLY_SWEEP_TOKEN ?? "").length >= 24;
}
