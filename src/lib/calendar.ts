/**
 * Business calendar used to compute delivery dates. Pure functions so the
 * same logic runs in the browser (live estimate) and on the server (stored
 * deadline). The calendar itself is loaded from the database in
 * calendar-server.ts and passed in.
 *
 * Everything here is anchored to BUSINESS_TIME_ZONE rather than to whatever
 * zone the code happens to be running in. That matters because this module
 * genuinely does run in two places: in the customer's browser for the live
 * estimate, and on the server (UTC on Vercel) when the order is stored. Using
 * the ambient zone made those two disagree, so a customer could be quoted 6pm
 * and then be shown a different time on their own order page.
 */

/**
 * The zone the working day belongs to. A deadline of 18:00 means 18:00 here,
 * for everyone, wherever they are reading it from. Change this one constant to
 * move the working day to another zone; nothing else needs to know.
 */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

/** The hour a first draft is due by, in BUSINESS_TIME_ZONE. */
export const END_OF_BUSINESS_HOUR = 18;

export interface BusinessCalendar {
  /** JavaScript weekday numbers that are not worked: 0 = Sunday ... 6 = Saturday */
  nonWorkingDays: number[];
  /** Closed dates as YYYY-MM-DD in BUSINESS_TIME_ZONE */
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

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * How far the zone is ahead of UTC at a given instant, in milliseconds.
 *
 * Read the instant back as wall-clock parts in the zone, reassemble those
 * parts as if they were UTC, and the difference is the offset. This is the
 * standard trick for doing zone maths without pulling in a date library, and
 * it follows daylight saving because Intl does.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const p: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = part.value;

  // Some ICU versions report midnight as hour 24 rather than 0.
  const asIfUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return asIfUtc - instant.getTime();
}

/**
 * The instant at which the given wall-clock time occurs in the zone.
 *
 * Two passes: the first offset is measured at the guessed instant, which sits
 * on the wrong side of the boundary when the clocks move that day, and the
 * second measurement corrects it.
 */
function instantAt(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const wallClock = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let ts = wallClock - zoneOffsetMs(new Date(wallClock), timeZone);
  ts = wallClock - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/** The calendar date in BUSINESS_TIME_ZONE, as YYYY-MM-DD. */
export function isoDate(d: Date, timeZone: string = BUSINESS_TIME_ZONE) {
  // en-CA formats as YYYY-MM-DD, which is what the holiday list stores.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The weekday in BUSINESS_TIME_ZONE, 0 = Sunday, to match nonWorkingDays. */
function weekdayIn(d: Date, timeZone: string): number {
  return WEEKDAY_INDEX[new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d)] ?? d.getUTCDay();
}

export function isWorkingDay(d: Date, cal: BusinessCalendar = DEFAULT_CALENDAR) {
  if (cal.nonWorkingDays.includes(weekdayIn(d, BUSINESS_TIME_ZONE))) return false;
  return !cal.holidays.includes(isoDate(d));
}

/**
 * The date `days` working days after `from`, at END_OF_BUSINESS_HOUR in
 * BUSINESS_TIME_ZONE. Non-working weekdays and holidays are skipped entirely.
 *
 * The walk is done on a bare calendar cursor held at midnight UTC, where a day
 * is exactly 24 hours and getUTCDay is the calendar weekday, so no daylight
 * saving change can make a day count twice or vanish. Only the final date is
 * turned into a real instant.
 */
export function addBusinessDays(from: Date, days: number, cal: BusinessCalendar = DEFAULT_CALENDAR): Date {
  const [y, m, d] = isoDate(from).split("-").map(Number);
  let cursor = Date.UTC(y, m - 1, d);
  let remaining = Math.max(1, days);
  let guard = 0;

  while (remaining > 0 && guard < 400) {
    cursor += 86_400_000;
    guard += 1;
    const c = new Date(cursor);
    const iso = `${c.getUTCFullYear()}-${pad(c.getUTCMonth() + 1)}-${pad(c.getUTCDate())}`;
    if (cal.nonWorkingDays.includes(c.getUTCDay())) continue;
    if (cal.holidays.includes(iso)) continue;
    remaining -= 1;
  }

  const end = new Date(cursor);
  return instantAt(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), END_OF_BUSINESS_HOUR, BUSINESS_TIME_ZONE);
}

/** Holidays that fall on or after today, soonest first. */
export function upcomingHolidays(cal: BusinessCalendar, now = new Date()) {
  const today = isoDate(now);
  return cal.holidays.filter((h) => h >= today).sort();
}
