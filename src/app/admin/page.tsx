import { requireStaff } from "@/lib/auth";
import { AdminOverview } from "./_views/AdminOverview";
import { DesignerTasks } from "./_views/DesignerTasks";
import { ManagerQc } from "./_views/ManagerQc";

export const metadata = { title: "Workspace | SlideBazaar" };
export const dynamic = "force-dynamic";

/** Each staff role gets a different home page. */
export default async function AdminHome() {
  const user = await requireStaff();
  if (user.role === "DESIGNER") return <DesignerTasks userId={user.id} name={user.name} />;
  if (user.role === "MANAGER") return <ManagerQc name={user.name} />;
  return <AdminOverview />;
}
