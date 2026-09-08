import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie, type Role } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";

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

  const session = { id: user.id, email: user.email, name: user.name, role: user.role as Role };
  await setSessionCookie(session);
  return NextResponse.json({ user: session });
}
