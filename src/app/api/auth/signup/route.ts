import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie, type Role } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";
import { sendVerificationEmail } from "@/lib/account-email";

export async function POST(req: Request) {
  const parsed = signupSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, password, phone, company, marketingOptIn } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists. Please log in." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      company: company || null,
      marketingOptIn: Boolean(marketingOptIn),
      passwordHash: await hashPassword(password),
      role: "CUSTOMER",
    },
  });

  // Verification does not gate access, but it records that this person really
  // holds the address, which is what later decides whether a Google account on
  // the same address may be connected.
  try {
    await sendVerificationEmail(user);
  } catch (err) {
    // A mail failure must not cost somebody their new account. They can ask
    // for the link again from the account page.
    console.error("[signup] could not send the verification email:", err instanceof Error ? err.message : err);
  }

  const session = { id: user.id, email: user.email, name: user.name, role: user.role as Role };
  await setSessionCookie(session);
  return NextResponse.json({ user: session });
}
