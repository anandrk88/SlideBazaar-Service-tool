import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { normalizeEmail } from "@/lib/validation";

export const metadata = { title: "Team | SlideBazaar Admin" };

// Server actions that throw show an error page. These are ordinary "you typed
// something we cannot accept" outcomes, so they come back as a banner instead.
const back: (msg: string) => never = (msg) => redirect(`/admin/team?msg=${encodeURIComponent(msg)}`);
const fail: (msg: string) => never = (msg) => redirect(`/admin/team?error=${encodeURIComponent(msg)}`);

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireAdmin();
  const { msg, error } = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { orders: true, assignedOrders: true } },
      identities: { select: { provider: true, emailAtLink: true } },
    },
  });

  async function createStaff(formData: FormData) {
    "use server";
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const requested = String(formData.get("role"));
    const role = ["ADMIN", "MANAGER", "DESIGNER"].includes(requested) ? requested : "DESIGNER";
    if (!name || !email || password.length < 8) fail("Name, email and an 8+ character password are required");
    const normalized = normalizeEmail(email);

    // This form used to upsert on email, so typing an existing customer's
    // address silently promoted their account to staff and kept whatever
    // password and linked Google account they already had. Creating and
    // promoting are different decisions, so they are different actions now.
    const existing = await prisma.user.findUnique({ where: { email: normalized }, select: { role: true } });
    if (existing) {
      fail(`${normalized} already has an account (${existing.role}). Use the role control on their row to change it, rather than re-adding them here.`);
    }

    await prisma.user.create({ data: { name, email: normalized, role, passwordHash: await hashPassword(password) } });
    revalidatePath("/admin/team");
    back(`Created ${normalized} as ${role}.`);
  }

  /** Deliberately change one person's role. Separate from account creation. */
  async function changeRole(formData: FormData) {
    "use server";
    const admin = await requireAdmin();
    const userId = String(formData.get("userId") ?? "");
    const requested = String(formData.get("role"));
    if (!["CUSTOMER", "ADMIN", "MANAGER", "DESIGNER"].includes(requested)) fail("Unknown role");

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, identities: { select: { emailAtLink: true } } },
    });
    if (!target) fail("That account no longer exists");
    if (target.role === requested) return;

    // A customer may connect a Google account on any address. Once that
    // account is staff, a login on someone else's address would reach the
    // admin area, so promotion requires every linked identity to be on the
    // account's own address.
    const staffRoles = ["ADMIN", "MANAGER", "DESIGNER"];
    if (staffRoles.includes(requested)) {
      const mismatched = target.identities.filter((i) => i.emailAtLink !== normalizeEmail(target.email));
      if (mismatched.length > 0) {
        fail(
          `${target.email} has a connected sign-in on a different address (${mismatched.map((m) => m.emailAtLink).join(", ")}). ` +
            "Ask them to disconnect it before this account is given staff access.",
        );
      }
    }

    if (target.id === admin.id && requested !== "ADMIN") fail("You cannot remove your own admin access");

    // Counting and then writing in two statements lets two concurrent
    // demotions both see two admins and both proceed, leaving zero. The count
    // and the write go in one transaction, and the write is conditional on the
    // role still being what we read, so the loser changes nothing.
    const demotingAnAdmin = target.role === "ADMIN" && requested !== "ADMIN";
    const changed = await prisma.$transaction(async (tx) => {
      if (demotingAnAdmin) {
        const admins = await tx.user.count({ where: { role: "ADMIN" } });
        if (admins <= 1) return -1;
      }
      const res = await tx.user.updateMany({
        where: { id: target.id, role: target.role },
        // Bumping the version ends their current sessions, so a change of
        // powers takes effect immediately rather than at their next login.
        data: { role: requested, sessionVersion: { increment: 1 } },
      });
      return res.count;
    });

    if (changed === -1) fail("This is the only admin account. Promote someone else first.");
    if (changed === 0) fail("That account changed while you were looking at it. Reload and try again.");
    revalidatePath("/admin/team");
    back(`${target.email} is now ${requested}. They have been signed out and will need to log in again.`);
  }

  const staff = users.filter((u) => u.role !== "CUSTOMER");
  const customers = users.filter((u) => u.role === "CUSTOMER");

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
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
                  <td className="px-4 py-2 text-xs text-muted">
                    {u._count.assignedOrders} assigned
                    {u.identities.length > 0 && <span className="block">{u.identities.map((i) => i.provider.toLowerCase()).join(", ")} connected</span>}
                  </td>
                  <td className="px-4 py-2">
                    <form action={changeRole} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        Role for {u.name}
                      </label>
                      <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="input !w-auto !py-1 text-xs">
                        <option value="DESIGNER">Designer</option>
                        <option value="MANAGER">QC manager</option>
                        <option value="ADMIN">Admin</option>
                        <option value="CUSTOMER">Customer (revoke staff access)</option>
                      </select>
                      <button className="btn-outline !px-3 !py-1 !text-xs">Save</button>
                    </form>
                  </td>
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
                  <td className="px-4 py-2 text-xs text-muted">{u._count.orders} orders</td>
                  <td className="px-4 py-2">
                    <form action={changeRole} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        Role for {u.name}
                      </label>
                      <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="input !w-auto !py-1 text-xs">
                        <option value="DESIGNER">Designer</option>
                        <option value="MANAGER">QC manager</option>
                        <option value="ADMIN">Admin</option>
                        <option value="CUSTOMER">Customer (revoke staff access)</option>
                      </select>
                      <button className="btn-outline !px-3 !py-1 !text-xs">Save</button>
                    </form>
                  </td>
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
        <p className="mt-3 text-xs text-muted">This creates a new account. To change what an existing person can do, use the role control on their row.</p>
      </aside>
      </div>
    </div>
  );
}
