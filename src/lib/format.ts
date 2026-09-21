export function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function moneyRange(minCents: number, maxCents: number, currency = "USD") {
  return minCents === maxCents
    ? money(minCents, currency)
    : `${money(minCents, currency)} - ${money(maxCents, currency)}`;
}

export function shortDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(d));
}

/**
 * A deadline shown to a customer. The zone is named because the reader has to
 * know whose 18:00 it is: Intl renders in the READER's zone, so the same stored
 * instant reads differently to a customer in Mumbai and a designer in London.
 */
export function longDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(d));
}

export function dateTime(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(d));
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
