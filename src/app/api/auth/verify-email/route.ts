import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-email
 *
 * A POST rather than a link target, so a mail scanner following the URL cannot
 * spend the single-use token before the person clicks.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const token = typeof body.token === "string" ? body.token : "";

  const userId = await consumeToken(token, "EMAIL_VERIFY");
  if (!userId) {
    return NextResponse.json({ error: "That confirmation link is invalid or has expired." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return NextResponse.json({ ok: true });
}
