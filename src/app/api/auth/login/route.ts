import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSessionCookie, verifyPassword, type Role } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter your email and password" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  // Compare before the null check, not after. Returning early for an unknown
  // address skips bcrypt entirely and makes the 401 measurably faster, which
  // is the enumeration signal verifyPassword's dummy hash exists to remove.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !passwordOk) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }
  const session = { id: user.id, email: user.email, name: user.name, role: user.role as Role };
  await setSessionCookie(session);
  return NextResponse.json({ user: session });
}
