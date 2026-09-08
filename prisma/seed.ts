/**
 * DEVELOPMENT ONLY. Seeds demo accounts with a well-known password and fake
 * paid orders whose ledger rows look exactly like real money.
 *   npm run db:seed
 *
 * Never run this against production. To create the first real admin, use:
 *   npm run admin:create
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Password123!";

function assertNotProduction() {
  const url = process.env.DATABASE_URL ?? "";
  const looksProduction = process.env.NODE_ENV === "production" || (!url.startsWith("file:") && !/localhost|127\.0\.0\.1/.test(url));
  if (looksProduction && process.env.ALLOW_DEMO_SEED !== "yes") {
    throw new Error(
      "Refusing to seed demo data: this looks like a production database.\n" +
        "The seed creates staff logins with a password published in the README and fake escrow entries.\n" +
        "Use `npm run admin:create` to create a real admin. Set ALLOW_DEMO_SEED=yes only if you are certain.",
    );
  }
}

async function main() {
  assertNotProduction();
  const hash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@slidebazaar.com" },
    update: {},
    create: { email: "admin@slidebazaar.com", name: "SlideBazaar Admin", role: "ADMIN", passwordHash: hash },
  });
  const designer = await prisma.user.upsert({
    where: { email: "designer@slidebazaar.com" },
    update: {},
    create: { email: "designer@slidebazaar.com", name: "Priya Designer", role: "DESIGNER", passwordHash: hash },
  });
  const manager = await prisma.user.upsert({
    where: { email: "manager@slidebazaar.com" },
    update: { role: "MANAGER" },
    create: { email: "manager@slidebazaar.com", name: "Ravi QC Manager", role: "MANAGER", passwordHash: hash },
  });
  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: { email: "customer@example.com", name: "Demo Customer", role: "CUSTOMER", company: "Acme Inc", phone: "+1 555 010 2030", passwordHash: hash },
  });

  const inDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(18, 0, 0, 0);
    return d;
  };

  // 4. Waiting for QC: designer has submitted a draft, manager must approve it.
  if (!(await prisma.order.findUnique({ where: { orderNumber: "SB-DEMO-0004" } }))) {
    await prisma.order.create({
      data: {
        orderNumber: "SB-DEMO-0004",
        customerId: customer.id,
        designerId: designer.id,
        status: "QC_REVIEW",
        escrowStatus: "HELD",
        treatment: "FIX_UP",
        style: "OWN_STYLE",
        slideCount: 15,
        deliveryTier: "RUSH",
        deadlineAt: inDays(1),
        proofreading: "NONE",
        grammar: "US",
        brief: "Board pack for Thursday. Fix alignment and fonts only, do not touch the numbers.",
        perSlideMinCents: 1700,
        perSlideMaxCents: 1700,
        addonPerSlideCents: 0,
        subtotalMinCents: 25500,
        subtotalMaxCents: 25500,
        totalCents: 25500,
        paidAt: new Date(Date.now() - 86400000),
        startedAt: new Date(Date.now() - 80000000),
        payments: { create: { provider: "MOCK", providerSessionId: "mock-demo-4", amountCents: 25500, status: "SUCCEEDED" } },
        escrowEntries: { create: { type: "HOLD", amountCents: 25500, note: "Upfront payment received via MOCK." } },
        events: {
          create: [
            { type: "CREATED", message: "Order SB-DEMO-0004 created. Awaiting payment.", actorId: customer.id },
            { type: "PAID", message: "Payment received and held in escrow." },
            { type: "ASSIGNED", message: "Assigned to designer Priya Designer.", actorId: admin.id },
            { type: "STARTED", message: "Design work has started.", actorId: designer.id },
            { type: "QC_SUBMITTED", message: "Draft submitted for quality check: all 15 slides aligned to the master grid.", actorId: designer.id, internal: true },
            { type: "STATUS", message: "Your draft is with our quality team for a final check.", actorId: designer.id },
          ],
        },
      },
    });
  }
  void manager;

  if ((await prisma.order.count()) > 1) {
    console.log("Orders already exist, skipping remaining demo orders.");
    console.log("  manager@slidebazaar.com    (MANAGER)");
    return;
  }

  // 1. Paid, in progress, assigned: 12 slides, redesign, priority (28 x 1.2 = 34) + proofreading 1 = 35 x 12 = 420
  await prisma.order.create({
    data: {
      orderNumber: "SB-DEMO-0001",
      customerId: customer.id,
      designerId: designer.id,
      status: "IN_PROGRESS",
      escrowStatus: "HELD",
      treatment: "REDESIGN",
      style: "CORPORATE",
      slideCount: 12,
      deliveryTier: "EXPRESS",
      deadlineAt: inDays(2),
      proofreading: "PROOFREADING",
      grammar: "US",
      brief: "Redesign our Q3 investor update. Keep the data on slides 4 to 7 exactly as is, but make the charts cleaner.",
      perSlideMinCents: 3400,
      perSlideMaxCents: 3400,
      addonPerSlideCents: 100,
      subtotalMinCents: 42000,
      subtotalMaxCents: 42000,
      totalCents: 42000,
      paidAt: new Date(),
      startedAt: new Date(),
      payments: { create: { provider: "MOCK", providerSessionId: "mock-demo-1", amountCents: 42000, status: "SUCCEEDED" } },
      escrowEntries: { create: { type: "HOLD", amountCents: 42000, note: "Upfront payment received via MOCK." } },
      events: {
        create: [
          { type: "CREATED", message: "Order SB-DEMO-0001 created. Awaiting payment.", actorId: customer.id },
          { type: "PAID", message: "Payment received and held in escrow." },
          { type: "ASSIGNED", message: "Assigned to designer Priya Designer.", actorId: admin.id },
          { type: "STARTED", message: "Design work has started.", actorId: designer.id },
        ],
      },
    },
  });

  // 2. Delivered, awaiting review: "Let us decide", upper bound held, team applied Fix up
  await prisma.order.create({
    data: {
      orderNumber: "SB-DEMO-0002",
      customerId: customer.id,
      designerId: designer.id,
      status: "DELIVERED",
      escrowStatus: "HELD",
      treatment: "LET_US_DECIDE",
      finalTreatment: "FIX_UP",
      style: "CREATIVE",
      slideCount: 8,
      deliveryTier: "STANDARD",
      deadlineAt: inDays(0),
      proofreading: "NONE",
      grammar: "US",
      brief: "Sales pitch for a SaaS product. Make it pop but keep our logo placement.",
      perSlideMinCents: 1100,
      perSlideMaxCents: 4400,
      addonPerSlideCents: 0,
      subtotalMinCents: 8800,
      subtotalMaxCents: 35200,
      totalCents: 35200,
      paidAt: new Date(Date.now() - 3 * 86400000),
      startedAt: new Date(Date.now() - 2 * 86400000),
      deliveredAt: new Date(),
      payments: { create: { provider: "MOCK", providerSessionId: "mock-demo-2", amountCents: 35200, status: "SUCCEEDED" } },
      escrowEntries: { create: { type: "HOLD", amountCents: 35200, note: "Upfront payment received via MOCK." } },
      events: {
        create: [
          { type: "CREATED", message: "Order SB-DEMO-0002 created. Awaiting payment.", actorId: customer.id },
          { type: "PAID", message: "Payment received and held in escrow." },
          { type: "ASSIGNED", message: "Assigned to designer Priya Designer.", actorId: admin.id },
          { type: "NOTE", message: "Treatment set to fix up.", actorId: designer.id },
          { type: "DELIVERED", message: "Draft delivered. Please review and approve, or request a revision.", actorId: designer.id },
        ],
      },
    },
  });

  // 3. Completed and released
  await prisma.order.create({
    data: {
      orderNumber: "SB-DEMO-0003",
      customerId: customer.id,
      designerId: designer.id,
      status: "COMPLETED",
      escrowStatus: "RELEASED",
      treatment: "FIX_UP",
      style: "PLAYFUL",
      slideCount: 20,
      deliveryTier: "STANDARD",
      deadlineAt: new Date(Date.now() - 7 * 86400000),
      proofreading: "EDITING",
      grammar: "UK",
      brief: "Tidy up our onboarding deck.",
      perSlideMinCents: 1100,
      perSlideMaxCents: 1100,
      addonPerSlideCents: 300,
      subtotalMinCents: 28000,
      subtotalMaxCents: 28000,
      totalCents: 28000,
      finalTotalCents: 28000,
      paidAt: new Date(Date.now() - 10 * 86400000),
      approvedAt: new Date(Date.now() - 6 * 86400000),
      completedAt: new Date(Date.now() - 6 * 86400000),
      payments: { create: { provider: "MOCK", providerSessionId: "mock-demo-3", amountCents: 28000, status: "SUCCEEDED" } },
      escrowEntries: {
        create: [
          { type: "HOLD", amountCents: 28000, note: "Upfront payment received via MOCK." },
          { type: "RELEASE", amountCents: 28000, note: "Customer approved final designs.", createdById: customer.id },
        ],
      },
      events: {
        create: [
          { type: "CREATED", message: "Order SB-DEMO-0003 created.", actorId: customer.id },
          { type: "PAID", message: "Payment received and held in escrow." },
          { type: "DELIVERED", message: "Draft delivered.", actorId: designer.id },
          { type: "APPROVED", message: "Customer approved the final designs.", actorId: customer.id },
          { type: "RELEASED", message: "Escrow released to SlideBazaar.", actorId: customer.id },
        ],
      },
    },
  });

  console.log(`Seeded users (password: ${PASSWORD}):`);
  console.log("  admin@slidebazaar.com      (ADMIN)");
  console.log("  manager@slidebazaar.com    (MANAGER, QC)");
  console.log("  designer@slidebazaar.com   (DESIGNER)");
  console.log("  customer@example.com       (CUSTOMER)");
  console.log("Seeded orders: SB-DEMO-0001 to SB-DEMO-0004");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
