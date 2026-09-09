/**
 * Prepares an empty production database for its first real order.
 *
 *   npm run bootstrap
 *
 * Unlike prisma/seed.ts this creates no demo accounts, no fake orders and no
 * ledger entries with a password published in the README. It does two things:
 * puts the service catalogue in place so the site can render, and creates the
 * first admin so somebody can log in.
 *
 * It is safe to run more than once. It refuses to touch a database that already
 * holds orders, so it can never be mistaken for a reset.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATALOG } from "../src/lib/catalog";

const prisma = new PrismaClient();

/** Readable but strong: 4 groups of 5 from an unambiguous alphabet. */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  return [pick(5), pick(5), pick(5), pick(5)].join("-");
}

async function seedCatalogue() {
  const existing = await prisma.treatmentOption.count();
  if (existing > 0) {
    console.log(`  catalogue already present (${existing} treatments), leaving it alone`);
    return;
  }
  await prisma.$transaction([
    ...DEFAULT_CATALOG.treatments.map((t) => prisma.treatmentOption.create({ data: { ...t, badge: t.badge ?? null } })),
    ...DEFAULT_CATALOG.styles.map((s) => prisma.styleOption.create({ data: s })),
    ...DEFAULT_CATALOG.tiers.map((t) => prisma.deliveryTierOption.create({ data: t })),
    ...DEFAULT_CATALOG.textServices.map((p) => prisma.textServiceOption.create({ data: p })),
  ]);
  console.log(
    `  seeded ${DEFAULT_CATALOG.treatments.length} treatments, ${DEFAULT_CATALOG.styles.length} styles, ` +
      `${DEFAULT_CATALOG.tiers.length} delivery tiers, ${DEFAULT_CATALOG.textServices.length} text services`,
  );
  console.log("  edit prices and options under Admin > Settings before taking orders");
}

async function createFirstAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    console.log(admins > 0 ? `  ${admins} admin account(s) already exist` : "  no ADMIN_EMAIL set, so no admin was created");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing) {
    // Promoting an existing account by pointing ADMIN_EMAIL at it is how a
    // customer accidentally becomes an admin. Refuse, as create-admin.ts does.
    console.log(`  ${email} already exists as ${existing.role}; not touching it`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD || generatePassword();
  const generated = !process.env.ADMIN_PASSWORD;
  await prisma.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME || "SlideBazaar Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
      // The person running this owns the mailbox they typed.
      emailVerified: new Date(),
    },
  });
  console.log(`  created admin ${email}`);
  if (generated) {
    console.log(`  password: ${password}`);
    console.log("  store it in your password manager now; it is not shown again");
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  console.log(`Database: ${url.replace(/:[^:@/]*@/, ":***@") || "(not set)"}\n`);

  const orders = await prisma.order.count();
  if (orders > 0) {
    console.log(`This database already holds ${orders} order(s). Bootstrap is for an empty database only.`);
    console.log("Nothing was changed.");
    await prisma.$disconnect();
    return;
  }

  console.log("Service catalogue:");
  await seedCatalogue();

  console.log("\nFirst admin:");
  await createFirstAdmin();

  const [users, treatments] = await Promise.all([prisma.user.count(), prisma.treatmentOption.count()]);
  console.log(`\nReady: ${users} user(s), ${treatments} treatments, 0 orders.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  await prisma.$disconnect();
  process.exit(1);
});
