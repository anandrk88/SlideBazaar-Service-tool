import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationList } from "@/components/NotificationList";

export const metadata = { title: "Notifications | SlideBazaar" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const rows = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
  const items = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Inbox</p>
      <h1 className="mt-1 text-2xl font-bold">Notifications</h1>
      <p className="mb-6 text-sm text-muted">Updates about your orders. The same messages go to {user.email}.</p>
      <NotificationList initial={items} />
    </div>
  );
}
