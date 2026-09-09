/**
 * DEVELOPMENT ONLY. Wipes every row and every uploaded file, then restores the
 * default service catalogue so the app is usable again.
 *
 *   npm run db:reset              wipe, restore catalogue, recreate the four test logins
 *   npm run db:reset -- --no-users   wipe, restore catalogue, create nobody
 *
 * This deletes customer orders, files, payments and the ledger. It refuses to
 * run against anything that looks like production; override deliberately with
 * ALLOW_DESTRUCTIVE_RESET=yes if you really mean it.
 */
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATALOG } from "../src/lib/catalog";

const prisma = new PrismaClient();
const PASSWORD = "Password123!";

const TEST_USERS = [
  { email: "admin@slidebazaar.com", name: "SlideBazaar Admin", role: "ADMIN" },
  { email: "manager@slidebazaar.com", name: "Quality Manager", role: "MANAGER" },
  { email: "designer@slidebazaar.com", name: "Priya Designer", role: "DESIGNER" },
  { email: "customer@example.com", name: "Demo Customer", role: "CUSTOMER" },
];

function assertNotProduction() {
  const url = process.env.DATABASE_URL ?? "";
  const looksProduction = process.env.NODE_ENV === "production" || (!url.startsWith("file:") && !/localhost|127\.0\.0\.1/.test(url));
  if (looksProduction && process.env.ALLOW_DESTRUCTIVE_RESET !== "yes") {
    throw new Error(
      "Refusing to reset: this looks like a production database.\n" +
        `DATABASE_URL=${url.replace(/:[^:@/]*@/, ":***@")}\n` +
        "This would delete every customer order, file and ledger row.\n" +
        "Set ALLOW_DESTRUCTIVE_RESET=yes only if you are certain.",
    );
  }
}

/** Children before parents, so this works whether or not cascades are set. */
async function wipeDatabase() {
  const steps: [string, () => Promise<{ count: number }>][] = [
    ["Notification", () => prisma.notification.deleteMany()],
    ["OrderMessage", () => prisma.orderMessage.deleteMany()],
    ["OrderEvent", () => prisma.orderEvent.deleteMany()],
    ["RefundAttempt", () => prisma.refundAttempt.deleteMany()],
    ["EscrowEntry", () => prisma.escrowEntry.deleteMany()],
    ["Payment", () => prisma.payment.deleteMany()],
    ["SlidePreview", () => prisma.slidePreview.deleteMany()],
    ["OrderFile", () => prisma.orderFile.deleteMany()],
    ["Order", () => prisma.order.deleteMany()],
    ["SavedCard", () => prisma.savedCard.deleteMany()],
    ["AuthIdentity", () => prisma.authIdentity.deleteMany()],
    ["VerificationToken", () => prisma.verificationToken.deleteMany()],
    ["User", () => prisma.user.deleteMany()],
    ["Holiday", () => prisma.holiday.deleteMany()],
    ["Setting", () => prisma.setting.deleteMany()],
    ["TreatmentOption", () => prisma.treatmentOption.deleteMany()],
    ["StyleOption", () => prisma.styleOption.deleteMany()],
    ["DeliveryTierOption", () => prisma.deliveryTierOption.deleteMany()],
    ["TextServiceOption", () => prisma.textServiceOption.deleteMany()],
  ];
  let total = 0;
  for (const [name, run] of steps) {
    const { count } = await run();
    total += count;
    if (count > 0) console.log(`  deleted ${String(count).padStart(4)}  ${name}`);
  }
  console.log(`  ${total} rows deleted in total`);
}

/** Uploaded files live outside the database, so they have to go separately. */
async function wipeUploads() {
  const root = process.env.UPLOAD_DIR || "./uploads";
  const dir = path.isAbsolute(root) ? root : path.join(process.cwd(), root);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    console.log(`  ${dir} does not exist, nothing to remove`);
    return;
  }
  // Leave dotfiles alone: .gitkeep is tracked and keeps the directory in git.
  const removable = entries.filter((e) => !e.startsWith("."));
  for (const entry of removable) {
    await rm(path.join(dir, entry), { recursive: true, force: true });
  }
  console.log(`  removed ${removable.length} entries from ${dir}`);
  if (process.env.S3_BUCKET) {
    console.log(`  NOTE: S3_BUCKET is set (${process.env.S3_BUCKET}). Objects in the bucket were NOT touched; clear them yourself if you want a true clean slate.`);
  }
}

/** The app needs a catalogue to render, so put the defaults back. */
async function restoreCatalog() {
  await prisma.$transaction([
    ...DEFAULT_CATALOG.treatments.map((t) => prisma.treatmentOption.create({ data: { ...t, badge: t.badge ?? null } })),
    ...DEFAULT_CATALOG.styles.map((s) => prisma.styleOption.create({ data: s })),
    ...DEFAULT_CATALOG.tiers.map((t) => prisma.deliveryTierOption.create({ data: t })),
    ...DEFAULT_CATALOG.textServices.map((p) => prisma.textServiceOption.create({ data: p })),
  ]);
  console.log(
    `  restored ${DEFAULT_CATALOG.treatments.length} treatments, ${DEFAULT_CATALOG.styles.length} styles, ` +
      `${DEFAULT_CATALOG.tiers.length} delivery tiers, ${DEFAULT_CATALOG.textServices.length} text services`,
  );
}

async function createTestUsers() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  for (const u of TEST_USERS) {
    await prisma.user.create({ data: { ...u, passwordHash } });
    console.log(`  ${u.role.padEnd(9)} ${u.email}`);
  }
  console.log(`  password for all four: ${PASSWORD}`);
}

async function main() {
  assertNotProduction();
  const noUsers = process.argv.includes("--no-users");

  console.log("Wiping database...");
  await wipeDatabase();

  console.log("Wiping uploaded files...");
  await wipeUploads();

  console.log("Restoring the default catalogue...");
  await restoreCatalog();

  if (noUsers) {
    console.log("Skipping test logins (--no-users). Create one with: npm run admin:create");
  } else {
    console.log("Creating test logins...");
    await createTestUsers();
  }

  console.log("\nClean slate. No orders, no files, no notifications.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  await prisma.$disconnect();
  process.exit(1);
});
