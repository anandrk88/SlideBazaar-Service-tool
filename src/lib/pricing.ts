import { DEFAULT_CATALOG, MAX_SLIDES, MIN_SLIDES, RANGE_TREATMENT_ID, SLIDES_PER_EXTRA_DAY, activeCatalog, lookups, type Catalog } from "./catalog";
import { DEFAULT_CALENDAR, addBusinessDays, type BusinessCalendar } from "./calendar";

export { addBusinessDays };

export interface QuoteInput {
  treatment: string;
  deliveryTier: string;
  slideCount: number;
  proofreading: string;
}

export interface Quote {
  perSlideMinCents: number;
  perSlideMaxCents: number;
  addonPerSlideCents: number;
  subtotalMinCents: number;
  subtotalMaxCents: number;
  /** Amount charged into escrow: the upper bound of the estimate. */
  totalCents: number;
  isRange: boolean;
  deadlineAt: Date;
  productionDays: number;
}

/** Round cents to the nearest whole dollar (matches how the estimate is shown). */
export const roundToDollar = (cents: number) => Math.round(cents / 100) * 100;

export function perSlideRange(treatment: string, deliveryTier: string, cat: Catalog = DEFAULT_CATALOG) {
  const lk = lookups(cat);
  const t = lk.treatment(treatment);
  const tier = lk.tier(deliveryTier);
  if (!t || !tier) throw new Error("Unknown treatment or delivery tier");
  return { min: roundToDollar(t.minCents * tier.multiplier), max: roundToDollar(t.maxCents * tier.multiplier) };
}

export function productionDays(deliveryTier: string, slideCount: number, cat: Catalog = DEFAULT_CATALOG) {
  const tier = lookups(cat).tier(deliveryTier);
  const base = tier?.days ?? 3;
  const extra = Math.max(0, Math.ceil(slideCount / SLIDES_PER_EXTRA_DAY) - 1);
  return base + extra;
}

export function clampSlides(n: number) {
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Math.floor(n || 0)));
}

/** Delivery date for a tier and deck size, honouring the business calendar. */
export function deliveryDate(deliveryTier: string, slideCount: number, cat: Catalog = DEFAULT_CATALOG, cal: BusinessCalendar = DEFAULT_CALENDAR, now = new Date()) {
  return addBusinessDays(now, productionDays(deliveryTier, Math.max(1, slideCount), cat), cal);
}

export function quote(input: QuoteInput, cat: Catalog = DEFAULT_CATALOG, cal: BusinessCalendar = DEFAULT_CALENDAR, now = new Date()): Quote {
  const slideCount = clampSlides(input.slideCount);
  const { min, max } = perSlideRange(input.treatment, input.deliveryTier, cat);
  const addon = lookups(cat).text(input.proofreading)?.perSlideCents ?? 0;
  const subtotalMin = (min + addon) * slideCount;
  const subtotalMax = (max + addon) * slideCount;
  const days = productionDays(input.deliveryTier, slideCount, cat);
  return {
    perSlideMinCents: min,
    perSlideMaxCents: max,
    addonPerSlideCents: addon,
    subtotalMinCents: subtotalMin,
    subtotalMaxCents: subtotalMax,
    totalCents: subtotalMax,
    isRange: min !== max,
    deadlineAt: addBusinessDays(now, days, cal),
    productionDays: days,
  };
}

/** Per-slide ranges for every enabled tier, for the delivery step cards. */
export function tierRanges(treatment: string, cat: Catalog = DEFAULT_CATALOG) {
  return activeCatalog(cat).tiers.map((tier) => ({ tier, ...perSlideRange(treatment, tier.id, cat) }));
}

/**
 * What the order actually costs once the treatment is known. Used when the
 * customer chose "Let us decide" and the team has set the final treatment.
 *
 * The result is clamped to the range the customer was quoted, taken from the
 * order's own price snapshot. A later edit to the catalogue therefore cannot
 * move the charge outside what they agreed to, in either direction.
 */
export function finalTotalFor(order: {
  treatment: string;
  finalTreatment: string | null;
  deliveryTier: string;
  slideCount: number;
  perSlideMinCents: number;
  addonPerSlideCents: number;
  totalCents: number;
}, cat: Catalog = DEFAULT_CATALOG) {
  const ceiling = order.totalCents;
  const floor = (order.perSlideMinCents + order.addonPerSlideCents) * order.slideCount;
  const t = order.finalTreatment ?? order.treatment;
  // No treatment decided yet: the customer would pay the top of the estimate,
  // so callers must not settle an order in this state (see qcApprove).
  if (t === RANGE_TREATMENT_ID || !lookups(cat).treatment(t)) return ceiling;
  try {
    const { max } = perSlideRange(t, order.deliveryTier, cat);
    const computed = (max + order.addonPerSlideCents) * order.slideCount;
    return Math.min(ceiling, Math.max(floor, computed));
  } catch {
    return ceiling;
  }
}
