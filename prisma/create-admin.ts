/**
 * Create (or promote) a single admin account. This is the supported way to
 * bootstrap production; the demo seed must never run there.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a strong password' ADMIN_NAME='Your Name' npm run admin:create
 *
 * If ADMIN_PASSWORD is omitted a strong one is generated and printed once.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function generatePassword() {
  // 24 URL-safe characters, ample entropy for a bootstrap credential.
  return randomBytes(18).toString("base64url");
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? "SlideBazaar Admin").trim();
  let password = process.env.ADMIN_PASSWORD ?? "";
  let generated = false;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Set ADMIN_EMAIL to a valid email address.");
  }
  if (!password) {
    password = generatePassword();
    generated = true;
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, _count: { select: { identities: true, orders: true } } },
  });

  // Upserting on email meant that pointing ADMIN_EMAIL at any existing address
  // promoted that account to admin and reset its password. That is a way to
  // take over a customer account, not a way to bootstrap an admin.
  if (existing && existing.role !== "ADMIN") {
    throw new Error(
      `${email} already has a ${existing.role} account` +
        (existing._count.orders ? ` with ${existing._count.orders} order(s)` : "") +
        ".\nRefusing to promote it. Use a fresh address for the admin account, or change the role deliberately in Admin > Team.",
    );
  }
  if (existing && existing._count.identities > 0) {
    throw new Error(
      `${email} has an external sign-in connected. Refusing to overwrite its password.\n` +
        "Disconnect it from the account page first, or use a different address.",
    );
  }

  const user = existing
    ? await prisma.user.update({
        where: { email },
        // Resetting an admin's own password must also end their old sessions.
        data: { passwordHash, name, sessionVersion: { increment: 1 } },
      })
    : await prisma.user.create({ data: { email, name, role: "ADMIN", passwordHash } });

  console.log(`${existing ? "Updated" : "Created"} admin: ${user.email}`);
  if (generated) {
    console.log(`Password: ${password}`);
    console.log("Store it in your password manager now. It is not shown again.");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
