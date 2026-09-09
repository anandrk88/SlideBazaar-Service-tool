/**
 * Service catalogue types and defaults. The live catalogue is stored in the
 * database (edited under Admin > Settings > Pricing & services) and loaded
 * with loadCatalog() from catalog-server.ts. The defaults below seed the
 * database the first time and act as a fallback.
 *
 * All prices are integer USD cents at the STANDARD delivery tier.
 */

export type TreatmentIcon = "bulb" | "broom" | "palette" | "pencil";
export type TextServiceIcon = "search" | "edit" | "none";
export type GrammarId = "UK" | "US";

export interface Treatment {
  id: string;
  name: string;
  tagline: string;
  description: string;
  minCents: number;
  maxCents: number;
  icon: string;
  tint: string;
  badge?: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface Style {
  id: string;
  name: string;
  description: string;
  swatch: string;
  accent: string;
  requiresUpload: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface DeliveryTier {
  id: string;
  name: string;
  days: number;
  multiplier: number;
  note: string;
  enabled: boolean;
  sortOrder: number;
}

export interface TextService {
  id: string;
  name: string;
  description: string;
  perSlideCents: number;
  icon: string;
  enabled: boolean;
  sortOrder: number;
}

export interface Catalog {
  treatments: Treatment[];
  styles: Style[];
  tiers: DeliveryTier[];
  textServices: TextService[];
}

/** The treatment whose price is a range decided by the team. */
export const RANGE_TREATMENT_ID = "LET_US_DECIDE";
/** The text-service option meaning "no text changes". */
export const NO_TEXT_SERVICE_ID = "NONE";

export const DEFAULT_TREATMENTS: Treatment[] = [
  {
    id: "LET_US_DECIDE",
    name: "Let us decide",
    tagline: "Our design leads pick the treatment",
    description:
      "Send the deck and we choose the treatment that gives the best result. We hold the upper estimate, and refund the difference when you approve.",
    minCents: 1100,
    maxCents: 4400,
    icon: "bulb",
    tint: "bg-amber-100 text-amber-700",
    enabled: true,
    sortOrder: 1,
  },
  {
    id: "FIX_UP",
    name: "Fix up",
    tagline: "Polish what you already have",
    description: "Alignment, spacing, fonts and colours made consistent and professional. Your layouts stay as they are.",
    minCents: 1100,
    maxCents: 1100,
    icon: "broom",
    tint: "bg-sky-100 text-sky-700",
    enabled: true,
    sortOrder: 2,
  },
  {
    id: "REDESIGN",
    name: "Redesign",
    tagline: "Same content, fresh design",
    description: "Every slide rebuilt with new layouts, visuals, icons and charts so the deck is engaging and effective.",
    minCents: 2800,
    maxCents: 2800,
    icon: "palette",
    tint: "bg-violet-100 text-violet-700",
    badge: "Most popular",
    enabled: true,
    sortOrder: 3,
  },
  {
    id: "REDRAW",
    name: "Redraw",
    tagline: "From sketches to finished slides",
    description: "Hand us sketches, whiteboard photos, a document or rough notes and we turn them into a complete presentation.",
    minCents: 4400,
    maxCents: 4400,
    icon: "pencil",
    tint: "bg-rose-100 text-rose-700",
    enabled: true,
    sortOrder: 4,
  },
];

export const DEFAULT_STYLES: Style[] = [
  {
    id: "OWN_STYLE",
    name: "Own style",
    description: "Upload your template or brand guide and we design strictly within it. Add supporting files in step 4.",
    swatch: "from-slate-100 to-slate-200",
    accent: "bg-slate-500",
    requiresUpload: true,
    enabled: true,
    sortOrder: 1,
  },
  { id: "CORPORATE", name: "Corporate", description: "Crisp and clean, putting your content and data as the focal point.", swatch: "from-brand-800 to-brand-950", accent: "bg-accent-500", requiresUpload: false, enabled: true, sortOrder: 2 },
  { id: "CREATIVE", name: "Creative", description: "Bold and vibrant design choices that highlight your ideas and data.", swatch: "from-rose-500 via-red-600 to-slate-900", accent: "bg-white", requiresUpload: false, enabled: true, sortOrder: 3 },
  { id: "PLAYFUL", name: "Playful", description: "Liven up rigid content with enjoyable illustrations and graphics.", swatch: "from-violet-500 via-fuchsia-500 to-orange-400", accent: "bg-yellow-300", requiresUpload: false, enabled: true, sortOrder: 4 },
];

export const DEFAULT_TIERS: DeliveryTier[] = [
  { id: "RUSH", name: "Rush", days: 1, multiplier: 1.5, note: "Next business day", enabled: true, sortOrder: 1 },
  { id: "EXPRESS", name: "Priority", days: 2, multiplier: 1.2, note: "2 business days", enabled: true, sortOrder: 2 },
  { id: "STANDARD", name: "Standard", days: 3, multiplier: 1.0, note: "3 business days", enabled: true, sortOrder: 3 },
];

export const DEFAULT_TEXT_SERVICES: TextService[] = [
  { id: "PROOFREADING", name: "Proofreading", description: "We check your content for grammar and misspelling.", perSlideCents: 100, icon: "search", enabled: true, sortOrder: 1 },
  { id: "EDITING", name: "Editing", description: "We rewrite any content on your slides that is unclear.", perSlideCents: 300, icon: "edit", enabled: true, sortOrder: 2 },
  { id: "NONE", name: "No thanks", description: "We will not change any of your text, including typos.", perSlideCents: 0, icon: "none", enabled: true, sortOrder: 3 },
];

export const DEFAULT_CATALOG: Catalog = {
  treatments: DEFAULT_TREATMENTS,
  styles: DEFAULT_STYLES,
  tiers: DEFAULT_TIERS,
  textServices: DEFAULT_TEXT_SERVICES,
};

/** Presets an admin can pick from when adding options. */
export const ICON_PRESETS: { id: TreatmentIcon; label: string }[] = [
  { id: "bulb", label: "Light bulb" },
  { id: "broom", label: "Broom" },
  { id: "palette", label: "Palette" },
  { id: "pencil", label: "Pencil" },
];
export const TINT_PRESETS: { id: string; label: string }[] = [
  { id: "bg-amber-100 text-amber-700", label: "Amber" },
  { id: "bg-sky-100 text-sky-700", label: "Sky" },
  { id: "bg-violet-100 text-violet-700", label: "Violet" },
  { id: "bg-rose-100 text-rose-700", label: "Rose" },
  { id: "bg-emerald-100 text-emerald-700", label: "Emerald" },
  { id: "bg-slate-100 text-slate-700", label: "Slate" },
];
export const SWATCH_PRESETS: { id: string; label: string; accent: string }[] = [
  { id: "from-brand-800 to-brand-950", label: "Navy", accent: "bg-accent-500" },
  { id: "from-rose-500 via-red-600 to-slate-900", label: "Red", accent: "bg-white" },
  { id: "from-violet-500 via-fuchsia-500 to-orange-400", label: "Vivid", accent: "bg-yellow-300" },
  { id: "from-emerald-500 to-teal-700", label: "Green", accent: "bg-white" },
  { id: "from-slate-100 to-slate-200", label: "Light", accent: "bg-slate-500" },
  { id: "from-amber-300 to-orange-500", label: "Warm", accent: "bg-ink" },
  { id: "from-indigo-900 via-purple-900 to-slate-900", label: "Dark", accent: "bg-cyan-400" },
];

/** Only enabled options, in display order. */
export function activeCatalog(cat: Catalog): Catalog {
  const on = <T extends { enabled: boolean; sortOrder: number }>(xs: T[]) => xs.filter((x) => x.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  return { treatments: on(cat.treatments), styles: on(cat.styles), tiers: on(cat.tiers), textServices: on(cat.textServices) };
}

/** Lookups by id, for labels on order pages (includes disabled options so old orders still render). */
export function lookups(cat: Catalog) {
  return {
    treatment: (id: string | null | undefined) => cat.treatments.find((t) => t.id === id),
    style: (id: string | null | undefined) => cat.styles.find((s) => s.id === id),
    tier: (id: string | null | undefined) => cat.tiers.find((t) => t.id === id),
    text: (id: string | null | undefined) => cat.textServices.find((p) => p.id === id),
  };
}

export const MIN_SLIDES = 1;
export const MAX_SLIDES = 300;

/** Slides per extra business day of production time on large decks. */
export const SLIDES_PER_EXTRA_DAY = 40;

export const ACCEPTED_UPLOAD_EXTENSIONS = [
  ".ppt", ".pptx", ".potx", ".key", ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ai", ".psd", ".zip", ".txt", ".md",
];
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB per file
