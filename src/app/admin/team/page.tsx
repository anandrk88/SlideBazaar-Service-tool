import { revalidatePath } from "next/cache";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Team | SlideBazaar Admin" };

export default async function TeamPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { orders: true, assignedOrders: true } } },
  });

  async function createStaff(formData: FormData) {
    "use server";
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const requested = String(formData.get("role"));
    const role = ["ADMIN", "MANAGER", "DESIGNER"].includes(requested) ? requested : "DESIGNER";
    if (!name || !email || password.length < 8) throw new Error("Name, email and an 8+ character password are required");
    await prisma.user.upsert({
      where: { email },
      update: { role, name },
      create: { name, email, role, passwordHash: await hashPassword(password) },
    });
    revalidatePath("/admin/team");
  }

  const staff = users.filter((u) => u.role !== "CUSTOMER");
  const customers = users.filter((u) => u.role === "CUSTOMER");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Team</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {staff.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="px-4 py-2 text-xs uppercase text-muted">{u.role}</td>
                  <td className="px-4 py-2 text-right text-xs text-muted">{u._count.assignedOrders} assigned orders</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Customers ({customers.length})</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {customers.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium">
                      {u.name}
                      {u.company ? <span className="text-muted"> · {u.company}</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {u.email}
                      {u.phone ? ` · ${u.phone}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">Joined {dateTime(u.createdAt)}</td>
                  <td className="px-4 py-2 text-right text-xs text-muted">{u._count.orders} orders</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <aside className="card h-fit p-6">
        <h2 className="font-semibold">Add a team member</h2>
        <form action={createStaff} className="mt-4 space-y-3">
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" required />
          </div>
          <div>
            <label className="label">Temporary password</label>
            <input name="password" type="text" className="input" minLength={8} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue="DESIGNER">
              <option value="DESIGNER">Designer (no pricing visible)</option>
              <option value="MANAGER">QC manager (reviews drafts, sees pricing)</option>
              <option value="ADMIN">Admin (everything)</option>
            </select>
          </div>
          <button className="btn-primary w-full">Create account</button>
        </form>
      </aside>
    </div>
  );
}
