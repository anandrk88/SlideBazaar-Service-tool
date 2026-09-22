import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markRead, unreadCount } from "@/lib/notify";
import { sweepAbandoned } from "@/lib/pabbly-sweep";

/** GET /api/notifications -> latest notifications for the bell dropdown. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    unreadCount(user.id),
  ]);
  after(async () => {
    await sweepAbandoned();
  });
  return NextResponse.json({ unread, items });
}

/** POST /api/notifications { id?: string } -> mark one (or all) as read. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  await markRead(user.id, body.id);
  return NextResponse.json({ ok: true, unread: await unreadCount(user.id) });
}
