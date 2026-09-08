import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addHoliday, loadCalendar, removeHoliday, saveNonWorkingDays } from "@/lib/calendar-server";
import { WEEKDAYS, addBusinessDays, isoDate } from "@/lib/calendar";
import { activeCatalog } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";

export const metadata = { title: "Business calendar | SlideBazaar Admin" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const { saved } = await searchParams;
  const calendar = await loadCalendar();
  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });
  const today = isoDate(new Date());

  async function saveWeekdays(formData: FormData) {
    "use server";
    await requireAdmin();
    const days = formData.getAll("off").map((v) => Number(v));
    if (days.length >= 7) throw new Error("At least one weekday must be a working day");
    await saveNonWorkingDays(days);
    revalidatePath("/admin/calendar");
    revalidatePath("/order");
  }

  async function createHoliday(formData: FormData) {
    "use server";
    await requireAdmin();
    const date = String(formData.get("date") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim() || "Public holiday";
    await addHoliday(date, name);
    revalidatePath("/admin/calendar");
    revalidatePath("/order");
  }

  async function deleteHoliday(formData: FormData) {
    "use server";
    await requireAdmin();
    await removeHoliday(String(formData.get("id")));
    revalidatePath("/admin/calendar");
    revalidatePath("/order");
  }

  const tiers = activeCatalog(await loadCatalog()).tiers;
  const preview = tiers.map((t) => ({ tier: t, date: addBusinessDays(new Date(), t.days, calendar) }));

  return (
    <div>
      <p className="eyebrow">Settings</p>
      <h1 className="mt-1 text-2xl font-bold">Business calendar</h1>
      <p className="text-sm text-muted">
        Delivery dates shown to customers (&ldquo;First draft by&rdquo;) skip the weekdays and holidays set here. Changes apply to new orders immediately;
        existing deadlines are not moved.
      </p>
      {saved && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Saved.</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="card p-6">
          <h2 className="font-semibold">Weekly days off</h2>
          <p className="mt-1 text-sm text-muted">Tick the days the design team does not work.</p>
          <form action={saveWeekdays} className="mt-4">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WEEKDAYS.map((d) => (
                <li key={d.n}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-surface">
                    <input type="checkbox" name="off" value={d.n} defaultChecked={calendar.nonWorkingDays.includes(d.n)} className="accent-accent-500" />
                    {d.name}
                  </label>
                </li>
              ))}
            </ul>
            <button className="btn-primary mt-4">Save weekly days off</button>
          </form>

          <h3 className="mt-8 text-sm font-semibold">Preview: an order placed right now</h3>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {preview.map(({ tier, date }) => (
              <li key={tier.id} className="flex justify-between px-3 py-2">
                <span>
                  {tier.name} <span className="text-muted">({tier.note.toLowerCase()})</span>
                </span>
                <span className="font-medium">{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6">
          <h2 className="font-semibold">Public holidays and closures</h2>
          <p className="mt-1 text-sm text-muted">Add any date the studio is closed. Past dates are kept for reference.</p>
          <form action={createHoliday} className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr_auto]">
            <input type="date" name="date" className="input" required min={today} />
            <input name="name" className="input" placeholder="Holiday name (e.g. Onam, Diwali, Christmas)" />
            <button className="btn-accent">Add</button>
          </form>
          <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {holidays.length === 0 && <li className="px-3 py-6 text-center text-muted">No holidays added yet.</li>}
            {holidays.map((h) => {
              const past = h.date < today;
              return (
                <li key={h.id} className={`flex items-center justify-between px-3 py-2 ${past ? "opacity-50" : ""}`}>
                  <span>
                    <span className="font-medium">{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${h.date}T12:00:00`))}</span>
                    <span className="ml-2 text-muted">{h.name}</span>
                  </span>
                  <form action={deleteHoliday}>
                    <input type="hidden" name="id" value={h.id} />
                    <button className="text-xs text-rose-600 hover:underline">Remove</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
