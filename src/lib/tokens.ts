import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";

/**
 * Single-use tokens emailed to a user.
 *
 * Only the SHA-256 of the token is stored, so a database leak does not hand an
 * attacker working reset links. The raw value exists only in the email.
 */

export type TokenPurpose = "EMAIL_VERIFY" | "PASSWORD_RESET";

const TTL_MINUTES: Record<TokenPurpose, number> = {
  // Long enough to survive a mail queue, short enough that a forwarded old
  // email is not a standing key to the account.
  EMAIL_VERIFY: 60 * 24,
  // A reset link is a password equivalent, so it lives for an hour.
  PASSWORD_RESET: 60,
};

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a token and return the raw value for the link. Any outstanding token
 * for the same purpose is dropped, so the most recent email is the only one
 * that works.
 */
export async function issueToken(userId: string, purpose: TokenPurpose) {
  const raw = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.verificationToken.create({
      data: {
        tokenHash: hashToken(raw),
        userId,
        purpose,
        expiresAt: new Date(Date.now() + TTL_MINUTES[purpose] * 60_000),
      },
    }),
  ]);
  return raw;
}

/**
 * Redeem a token. Returns the user id, or null if it is unknown, expired, for
 * a different purpose, or already used.
 */
export async function consumeToken(raw: string, purpose: TokenPurpose): Promise<string | null> {
  if (!raw) return null;
  const row = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row) return null;
  if (row.purpose !== purpose) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  // Compare-and-set: two requests racing on the same link must not both win.
  const claimed = await prisma.verificationToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;
  return row.userId;
}

/** Drop every outstanding token for a user, e.g. once a password is set. */
export async function revokeTokens(userId: string, purpose?: TokenPurpose) {
  await prisma.verificationToken.deleteMany({ where: { userId, ...(purpose ? { purpose } : {}) } });
}
