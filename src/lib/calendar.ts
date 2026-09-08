/**
 * Business calendar used to compute delivery dates. Pure functions so the
 * same logic runs in the browser (live estimate) and on the server (stored
 * deadline). The calendar itself is loaded from the database in
 * calendar-server.ts and passed in.
 */

export interface BusinessCalendar {
  /** JavaScript weekday numbers that are not worked: 0 = Sunday ... 6 = Saturday */
  nonWorkingDays: number[];
  /** Closed dates as YYYY-MM-DD (local) */
  holidays: string[];
}

export const DEFAULT_CALENDAR: BusinessCalendar = { nonWorkingDays: [0, 6], holidays: [] };

export const WEEKDAYS = [
  { n: 1, name: "Monday" },
  { n: 2, name: "Tuesday" },
  { n: 3, name: "Wednesday" },
  { n: 4, name: "Thursday" },
  { n: 5, name: "Friday" },
  { n: 6, name: "Saturday" },
  { n: 0, name: "Sunday" },
];

/** Local YYYY-MM-DD for a date. */
export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isWorkingDay(d: Date, cal: BusinessCalendar = DEFAULT_CALENDAR) {
  if (cal.nonWorkingDays.includes(d.getDay())) return false;
  return !cal.holidays.includes(isoDate(d));
}

/**
 * The date `days` working days after `from`, at 18:00 local time.
 * Non-working weekdays and holidays are skipped entirely.
 */
export function addBusinessDays(from: Date, days: number, cal: BusinessCalendar = DEFAULT_CALENDAR): Date {
  const d = new Date(from);
  let remaining = Math.max(1, days);
  let guard = 0;
  while (remaining > 0 && guard < 400) {
    d.setDate(d.getDate() + 1);
    guard += 1;
    if (isWorkingDay(d, cal)) remaining -= 1;
  }
  d.setHours(18, 0, 0, 0);
  return d;
}

/** Holidays that fall on or after today, soonest first. */
export function upcomingHolidays(cal: BusinessCalendar, now = new Date()) {
  const today = isoDate(now);
  return cal.holidays.filter((h) => h >= today).sort();
}
