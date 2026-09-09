import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie, type Role } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validation";
import { consumeToken, revokeTokens } from "@/lib/tokens";
import { notifyPasswordChanged } from "@/lib/account-email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset-password
 *
 * Redeeming the link proves the person reads that mailbox, so this both sets
 * the password and marks the address verified.
 */
export async function POST(req: Request) {
  const parsed = resetPasswordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const userId = await consumeToken(parsed.data.token, "PASSWORD_RESET");
  if (!userId) {
    return NextResponse.json({ error: "That reset link is invalid or has expired. Please request a new one." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(parsed.data.next),
      emailVerified: new Date(),
      // Anyone holding an old session, including whoever prompted the reset,
      // is signed out.
      sessionVersion: { increment: 1 },
    },
    select: { id: true, email: true, name: true, role: true, sessionVersion: true },
  });

  await revokeTokens(userId, "PASSWORD_RESET");

  // Connected sign-ins are deliberately left in place, so the owner is told
  // they exist rather than being left to assume the reset closed every door.
  try {
    await notifyPasswordChanged(userId);
  } catch (err) {
    console.error("[reset-password] could not send the confirmation email:", err instanceof Error ? err.message : err);
  }

  const session = { id: user.id, email: user.email, name: user.name, role: user.role as Role, sessionVersion: user.sessionVersion };
  await setSessionCookie(session);
  return NextResponse.json({ user: session });
}
