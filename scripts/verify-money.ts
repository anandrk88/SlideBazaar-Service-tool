/**
 * Money-path regression checks. Run against a DEVELOPMENT database only:
 *   npm run verify:money
 *
 * These cover the cases that cost real money when they break: concurrent
 * payment, double approval, payment arriving after cancellation, range-order
 * pricing, refund validation and the ledger invariant. Creates TEST- orders
 * and deletes them afterwards.
 */
import { PrismaClient } from "@prisma/client";
import { markOrderPaid, approveAndRelease, refundOrder, escrowSummary, settlePendingRefunds } from "../src/lib/orders";

const prisma = new PrismaClient();

/**
 * The header comment said "development only" and nothing enforced it. This
 * script creates orders, payments and ledger rows; run against production it
 * would put fake money in a real ledger. Refuse, exactly as prisma/seed.ts and
 * prisma/reset.ts do.
 */
function assertNotProduction() {
  const url = process.env.DATABASE_URL ?? "";
  const looksProduction = process.env.NODE_ENV === "production" || (!url.startsWith("file:") && !/localhost|127\.0\.0\.1/.test(url));
  if (looksProduction && process.env.ALLOW_TEST_ORDERS !== "yes") {
    throw new Error(
      "Refusing to run: this looks like a production database.\n" +
        `DATABASE_URL=${url.replace(/:[^:@/]*@/, ":***@")}\n` +
        "These checks create TEST- orders and escrow entries. Point DATABASE_URL at a development branch.\n" +
        "Set ALLOW_TEST_ORDERS=yes only if you are certain.",
    );
  }
}

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
  if (!ok) failures++;
}

async function makeOrder(totalCents: number, treatment = "REDESIGN", finalTreatment: string | null = null) {
  const customer = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER" } });
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return prisma.order.create({
    data: {
      orderNumber: `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      customerId: customer.id,
      status: "PENDING_PAYMENT",
      treatment,
      finalTreatment,
      style: "CORPORATE",
      slideCount: 10,
      deliveryTier: "STANDARD",
      deadlineAt: d,
      proofreading: "NONE",
      grammar: "US",
      brief: "verification order",
      perSlideMinCents: 1100,
      perSlideMaxCents: totalCents / 10,
      addonPerSlideCents: 0,
      subtotalMinCents: 11000,
      subtotalMaxCents: totalCents,
      totalCents,
    },
  });
}

async function main() {
  assertNotProduction();
  // 1. Concurrent markOrderPaid must produce exactly one HOLD.
  const o1 = await makeOrder(28000);
  const pay = () =>
    markOrderPaid({ orderId: o1.id, provider: "MOCK", providerSessionId: `sess-${o1.id}`, amountCents: 28000 }).catch((e) => e);
  await Promise.all([pay(), pay(), pay()]);
  const holds = await prisma.escrowEntry.count({ where: { orderId: o1.id, type: "HOLD" } });
  const paidEvents = await prisma.orderEvent.count({ where: { orderId: o1.id, type: "PAID" } });
  check("concurrent payment writes exactly one HOLD", holds === 1, `holds=${holds}`);
  check("concurrent payment writes one PAID event", paidEvents === 1, `events=${paidEvents}`);

  // 2. Payment for an order that is no longer pending queues a refund.
  const o2 = await makeOrder(15000);
  await prisma.order.update({ where: { id: o2.id }, data: { status: "CANCELLED" } });
  await markOrderPaid({ orderId: o2.id, provider: "MOCK", providerSessionId: `late-${o2.id}`, amountCents: 15000 });
  const queued = await prisma.refundAttempt.findMany({ where: { orderId: o2.id } });
  check("payment after cancellation queues a refund", queued.length === 1 && queued[0].amountCents === 15000, `attempts=${queued.length}`);

  // 3. Double approve must release once.
  const o3 = await makeOrder(28000);
  await markOrderPaid({ orderId: o3.id, provider: "MOCK", providerSessionId: `s3-${o3.id}`, amountCents: 28000 });
  await prisma.order.update({ where: { id: o3.id }, data: { status: "DELIVERED" } });
  const customer = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER" } });
  const results = await Promise.allSettled([approveAndRelease(o3.id, customer.id), approveAndRelease(o3.id, customer.id)]);
  const releases = await prisma.escrowEntry.count({ where: { orderId: o3.id, type: "RELEASE" } });
  const rejected = results.filter((r) => r.status === "rejected").length;
  check("double approve writes exactly one RELEASE", releases === 1, `releases=${releases}`);
  check("the losing approve is rejected, not silently duplicated", rejected === 1, `rejected=${rejected}`);

  // 4. "Let us decide" clamps to the quoted range, never above the amount held.
  const o4 = await makeOrder(44000, "LET_US_DECIDE", "FIX_UP");
  await markOrderPaid({ orderId: o4.id, provider: "MOCK", providerSessionId: `s4-${o4.id}`, amountCents: 44000 });
  await prisma.order.update({ where: { id: o4.id }, data: { status: "DELIVERED" } });
  await approveAndRelease(o4.id, customer.id);
  const after4 = await prisma.order.findUniqueOrThrow({ where: { id: o4.id } });
  const refund4 = await prisma.escrowEntry.findFirst({ where: { orderId: o4.id, type: "REFUND" } });
  check("range order charges less than the held maximum", (after4.finalTotalCents ?? 0) < 44000, `final=${after4.finalTotalCents}`);
  check("range order refunds the difference", !!refund4 && refund4.amountCents === 44000 - (after4.finalTotalCents ?? 0), `refund=${refund4?.amountCents}`);
  const settled4 = await prisma.refundAttempt.findFirst({ where: { orderId: o4.id } });
  check("difference refund is settled, not left pending", settled4?.status === "SUCCEEDED", `status=${settled4?.status}`);

  // 5. Refund validation rejects nonsense amounts.
  const o5 = await makeOrder(20000);
  await markOrderPaid({ orderId: o5.id, provider: "MOCK", providerSessionId: `s5-${o5.id}`, amountCents: 20000 });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  let rejectedBad = 0;
  for (const bad of [NaN, -500, 0, 999999]) {
    try {
      await refundOrder(o5.id, admin.id, "test", bad);
    } catch {
      rejectedBad++;
    }
  }
  check("refund rejects NaN, negative, zero and over-limit amounts", rejectedBad === 4, `rejected=${rejectedBad}/4`);

  // 6. Ledger invariant across everything above.
  const s = await escrowSummary();
  const grouped = await prisma.escrowEntry.groupBy({ by: ["type"], _sum: { amountCents: true } });
  const sum = (t: string) => grouped.find((g) => g.type === t)?._sum.amountCents ?? 0;
  check("held equals collected minus released minus refunded", s.heldCents === sum("HOLD") - sum("RELEASE") - sum("REFUND"), `held=${s.heldCents}`);

  await settlePendingRefunds();
  const stuck = await prisma.refundAttempt.count({ where: { status: "PENDING" } });
  check("no refund is left pending after a sweep", stuck === 0, `pending=${stuck}`);

  // Clean up the test orders.
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "TEST-" } } });
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
