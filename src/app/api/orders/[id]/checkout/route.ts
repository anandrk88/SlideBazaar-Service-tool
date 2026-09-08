import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCheckoutUrl } from "@/lib/checkout";

/** POST /api/orders/:id/checkout  -> { checkoutUrl } for an unpaid order. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const [order, customer] = await Promise.all([prisma.order.findUnique({ where: { id } }), prisma.user.findUnique({ where: { id: user.id } })]);
  if (!order || !customer || order.customerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const checkoutUrl = await createCheckoutUrl(order, customer);
    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 400 });
  }
}
