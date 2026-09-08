/**
 * Retry any refund that has not settled with Stripe yet.
 * Run on a schedule (every 15 minutes is plenty):
 *   npm run refunds:settle
 *
 * Refunds are attempted inline when they are created; this sweeper is the
 * safety net for the case where that call failed, so a customer is never left
 * waiting on money we said we had returned.
 */
import { settlePendingRefunds } from "../src/lib/orders";

async function main() {
  const result = await settlePendingRefunds();
  console.log(`Refund sweep: ${result.settled} settled of ${result.attempted} attempted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
