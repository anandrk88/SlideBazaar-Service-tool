import { ROLE_LABELS, canSeeMoney, requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SideNav, type SideNavItem } from "@/components/SideNav";

/** Staff area: left sidebar navigation, content on the right. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  const [qcWaiting, myTodo] = await Promise.all([
    canSeeMoney(user) ? prisma.order.count({ where: { status: "QC_REVIEW" } }) : Promise.resolve(0),
    user.role === "DESIGNER"
      ? prisma.order.count({ where: { designerId: user.id, status: { in: ["PAID", "IN_PROGRESS", "REVISION_REQUESTED"] } } })
      : Promise.resolve(0),
  ]);

  const items: SideNavItem[] =
    user.role === "DESIGNER"
      ? [
          { href: "/admin", label: "My tasks", icon: "tasks", exact: true, badge: myTodo },
          { href: "/admin/orders", label: "All orders", icon: "list" },
          { href: "/admin/orders?stage=done&scope=mine", label: "Completed work", icon: "shield" },
        ]
      : user.role === "MANAGER"
        ? [
            { href: "/admin", label: "QC queue", icon: "shield", exact: true, badge: qcWaiting },
            { href: "/admin/orders", label: "All orders", icon: "list" },
            { href: "/admin/escrow", label: "Escrow ledger", icon: "lock" },
          ]
        : [
            { href: "/admin", label: "Overview", icon: "grid", exact: true },
            { href: "/admin/orders", label: "All orders", icon: "list", badge: qcWaiting },
            { href: "/admin/escrow", label: "Escrow ledger", icon: "lock" },
            { href: "/admin/team", label: "Team & customers", icon: "users" },
            { href: "/admin/calendar", label: "Calendar", icon: "calendar" },
            { href: "/admin/settings", label: "Pricing & services", icon: "tag" },
          ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <SideNav items={items} title="Workspace" subtitle={`${user.name} · ${ROLE_LABELS[user.role]}`} />
      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</div>
    </div>
  );
}
