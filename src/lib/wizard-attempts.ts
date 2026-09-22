import "server-only";
import { prisma } from "./db";

/**
 * Retention for the wizard drop-off table.
 *
 * WizardAttempt is the only table in this app that holds text typed by people
 * who are not customers and who agreed to nothing, so it is the only one with a
 * lifespan. Two stages, because the two halves of a row stop being useful at
 * very different times:
 *
 *   - The free text is diagnostic for about a fortnight. You read a handful of
 *     real briefs to understand why step 4 loses people, and after that the
 *     answer is an aggregate and nobody opens an individual brief again.
 *   - The funnel skeleton is what you compare across a release. "Did rewriting
 *     step 4 help?" needs last quarter's numbers to still exist.
 *
 * Converted rows age out on the same two clocks (their text was already cleared
 * the moment the order was created), so both halves of every ratio disappear
 * together. Otherwise a 60-day conversion rate is arithmetic nonsense and
 * somebody will act on it.
 */

/** A Setting row, so the sweep is idempotent across instances and cold starts. */
const PURGE_KEY = "wizardAttemptsPurgedAt";

const CONTENT_DAYS = 30;
const ROW_DAYS = 90;
const DAY_MS = 86_400_000;

/** The columns holding what somebody typed. Everything else is structural. */
const CONTENT = { brief: null, audience: null, brandNotes: null, fontsColors: null, extraNotes: null };

export const RETENTION = { contentDays: CONTENT_DAYS, rowDays: ROW_DAYS };

/**
 * An attempt counts as finished once it becomes an order, or once nothing has
 * happened on it for this long. Shared, because the drop-off report and the
 * abandonment webhook have to agree on what "gave up" means, or the page and
 * the alerts will contradict each other.
 */
export const SETTLE_MS = 30 * 60_000;

export const STEPS = [
  { n: 1, label: "Treatment" },
  { n: 2, label: "Style" },
  { n: 3, label: "Delivery" },
  { n: 4, label: "Files & details" },
  { n: 5, label: "Payment" },
];

export async function purgeWizardAttempts() {
  const now = Date.now();
  const [purged, deleted] = await Promise.all([
    prisma.wizardAttempt.updateMany({
      where: { lastSeenAt: { lt: new Date(now - CONTENT_DAYS * DAY_MS) }, contentPurgedAt: null },
      data: { ...CONTENT, contentPurgedAt: new Date() },
    }),
    prisma.wizardAttempt.deleteMany({ where: { lastSeenAt: { lt: new Date(now - ROW_DAYS * DAY_MS) } } }),
  ]);

  const at = new Date().toISOString();
  await prisma.setting.upsert({ where: { key: PURGE_KEY }, create: { key: PURGE_KEY, value: at }, update: { value: at } });
  return { contentPurged: purged.count, rowsDeleted: deleted.count, at };
}

/**
 * Run the purge if it has not run in the last six hours.
 *
 * This is the actual mechanism, not a backstop. The project has no scheduler of
 * any kind: no vercel.json, no GitHub workflow, no cron. The one job that says
 * "run on a schedule" is an npm script a person types. A retention rule that
 * depends on a cron nobody created is not a retention rule, and this window is
 * about to be published in a privacy policy.
 *
 * Called from after() on the collection endpoint, so it runs whenever the wizard
 * is being used, which is the only condition under which this table grows. The
 * module-level guard keeps it to one Setting read per process per quarter hour
 * rather than one per beacon; the Setting row is what stops two instances both
 * deciding it is due.
 */
let nextCheck = 0;

export async function sweepIfDue() {
  const now = Date.now();
  if (now < nextCheck) return null;
  nextCheck = now + 15 * 60_000;
  try {
    const row = await prisma.setting.findUnique({ where: { key: PURGE_KEY } });
    if (row && now - Date.parse(row.value) < 6 * 3_600_000) return null;
    return await purgeWizardAttempts();
  } catch {
    // Retention must never be able to fail a visitor's request.
    return null;
  }
}

export async function lastPurgeAt(): Promise<Date | null> {
  const row = await prisma.setting.findUnique({ where: { key: PURGE_KEY } });
  const t = row ? Date.parse(row.value) : NaN;
  return Number.isFinite(t) ? new Date(t) : null;
}

/** For an erasure request from someone who later signed in. */
export async function deleteWizardAttemptsForUser(userId: string) {
  return prisma.wizardAttempt.deleteMany({ where: { userId } });
}
