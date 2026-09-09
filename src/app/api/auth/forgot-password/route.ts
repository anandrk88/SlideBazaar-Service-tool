import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emailOnlySchema } from "@/lib/validation";
import { sendPasswordResetEmail } from "@/lib/account-email";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot-password
 *
 * Always answers the same way, in the same time. Telling the caller whether an
 * address is registered turns this into a way to enumerate customers, and the
 * information is of no use to somebody who genuinely owns the mailbox.
 */
export async function POST(req: Request) {
  const generic = () => NextResponse.json({ ok: true });

  // Two limits. The address limit stops a mail bomb and, more importantly,
  // stops an attacker repeatedly re-issuing tokens to invalidate a victim's
  // in-flight reset link and deny them recovery. The IP limit stops one script
  // walking a list of addresses.
  if (!rateLimit(`forgot:ip:${clientKey(req)}`, 10, 15 * 60).allowed) return generic();

  const parsed = emailOnlySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return generic();
  if (!rateLimit(`forgot:email:${parsed.data.email}`, 3, 15 * 60).allowed) return generic();

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, name: true },
  });

  if (user) {
    // Not awaited on purpose. Awaiting an SMTP round trip only when the address
    // exists makes the response time itself the answer, which is exactly what
    // the identical response body was written to hide.
    void sendPasswordResetEmail(user).catch((err) => {
      console.error("[forgot-password] could not send the email:", err instanceof Error ? err.message : err);
    });
  }

  return generic();
}
