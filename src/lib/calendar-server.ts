import "server-only";
import { prisma } from "./db";
import { DEFAULT_CALENDAR, type BusinessCalendar } from "./calendar";

const NON_WORKING_KEY = "nonWorkingWeekdays";

/** Load the admin-managed business calendar. Falls back to Saturday + Sunday off. */
export async function loadCalendar(): Promise<BusinessCalendar> {
  const [setting, holidays] = await Promise.all([
    prisma.setting.findUnique({ where: { key: NON_WORKING_KEY } }),
    prisma.holiday.findMany({ select: { date: true } }),
  ]);
  const nonWorkingDays = setting
    ? setting.value
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : DEFAULT_CALENDAR.nonWorkingDays;
  return { nonWorkingDays, holidays: holidays.map((h) => h.date) };
}

export async function saveNonWorkingDays(days: number[]) {
  const value = Array.from(new Set(days.filter((n) => n >= 0 && n <= 6))).sort().join(",");
  await prisma.setting.upsert({ where: { key: NON_WORKING_KEY }, create: { key: NON_WORKING_KEY, value }, update: { value } });
}

export async function addHoliday(date: string, name: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date must be YYYY-MM-DD");
  await prisma.holiday.upsert({ where: { date }, create: { date, name }, update: { name } });
}

export async function removeHoliday(id: string) {
  await prisma.holiday.delete({ where: { id } });
}
