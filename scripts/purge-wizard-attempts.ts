/**
 * Applies the retention rule to the wizard drop-off table, by hand.
 *
 *   npm run wizard:purge
 *
 * The rule runs on its own: the collection endpoint calls sweepIfDue() in an
 * after() callback, so it happens whenever the wizard is being used, which is
 * the only time this table grows. This script exists for the case that
 * mechanism cannot cover, which is a real one: if nobody opens the order form
 * for a month, nothing sweeps, and rows that should have been cleared at 30
 * days sit there until the next visitor arrives.
 *
 * Run it after a quiet period, or whenever you want to be able to say in
 * writing that the published window has actually been applied.
 *
 * Nothing here touches orders, customers or files. It clears the free text on
 * attempts last seen over 30 days ago and deletes attempt rows last seen over
 * 90 days ago.
 */
// Next loads .env for the app; a plain tsx script does not, so without this the
// script would fail to find a database rather than purging anything.
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { RETENTION, purgeWizardAttempts } from "../src/lib/wizard-attempts";

async function main() {
  const before = await prisma.wizardAttempt.count();
  console.log(`WizardAttempt rows before: ${before}`);
  console.log(`Rule: clear typed content after ${RETENTION.contentDays} days, delete the row after ${RETENTION.rowDays}.\n`);

  const result = await purgeWizardAttempts();

  console.log(`${result.contentPurged} content cleared, ${result.rowsDeleted} rows deleted`);
  console.log(`Rows remaining: ${await prisma.wizardAttempt.count()}`);
  console.log(`Recorded as purged at ${result.at}`);
}

main()
  .catch((err) => {
    console.error("\nPurge failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
