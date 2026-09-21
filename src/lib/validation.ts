import { z } from "zod";
import { MAX_SLIDES, MIN_SLIDES } from "./catalog";

/**
 * One canonical form for an address, so "A@x.com" and "a@x.com" cannot become
 * two accounts that later collide during provider linking.
 *
 * Deliberately conservative: no plus-address stripping, because a+b@gmail.com
 * and a@gmail.com are the same inbox on Gmail but genuinely different mailboxes
 * elsewhere, and guessing wrong merges two people.
 */
export function normalizeEmail(raw: string): string {
  const trimmed = raw.normalize("NFKC").trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return trimmed.toLowerCase();
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  let asciiDomain = domain.toLowerCase();
  try {
    // Punycode the domain so a unicode homograph cannot masquerade as an
    // existing one. URL does the IDNA conversion for us.
    asciiDomain = new URL(`http://${asciiDomain}`).hostname;
  } catch {
    /* leave it lowercased; the email validator rejects it anyway */
  }
  return `${local.toLowerCase()}@${asciiDomain}`;
}

/**
 * Only ever redirect to a path on this site.
 *
 * Pattern matching is not enough here. "/\evil.com" starts with a single
 * slash but browsers normalise the backslash and treat it as protocol-relative,
 * so a regex that just checks the first character is an open redirect. Resolve
 * against our own origin and require the result to still be on it.
 */
export function safeNext(next: string | null | undefined, appUrl: string): string | undefined {
  if (!next) return undefined;
  // Control characters and backslashes are stripped or rewritten by browsers,
  // so anything containing them cannot be reasoned about. Refuse outright.
  if (next.includes("\\")) return undefined;
  for (const ch of next) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return undefined;
  }
  try {
    const base = new URL(appUrl);
    const resolved = new URL(next, base);
    if (resolved.origin !== base.origin) return undefined;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return undefined;
  }
}

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(120),
  email: z.string().trim().transform(normalizeEmail).pipe(z.string().email("Please enter a valid email")),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  marketingOptIn: z.coerce.boolean().optional(),
  agree: z.coerce.boolean().refine((v) => v, "You must accept the terms to continue"),
});

export const loginSchema = z.object({
  email: z.string().trim().transform(normalizeEmail).pipe(z.string().email()),
  password: z.string().min(1),
});

export const emailOnlySchema = z.object({
  email: z.string().trim().transform(normalizeEmail).pipe(z.string().email("Please enter a valid email")),
});

/** Setting a first password: no current password to confirm. */
export const setPasswordSchema = z
  .object({
    next: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "The passwords do not match", path: ["confirm"] });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    next: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "The passwords do not match", path: ["confirm"] });

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionId = z.string().trim().regex(/^[A-Z0-9_]{1,40}$/, "Invalid option");

/** Option ids are validated against the live catalogue in the API route. */
export const orderSchema = z.object({
  treatment: optionId,
  style: optionId,
  slideCount: z.coerce.number().int().min(MIN_SLIDES).max(MAX_SLIDES),
  deliveryTier: optionId,
  proofreading: optionId.default("NONE"),
  grammar: z.enum(["UK", "US"]).default("US"),
  brief: z.string().trim().min(10, "Please give us at least a sentence of instructions").max(10000),
  googleSlidesUrl: z.string().trim().url().optional().or(z.literal("")),
  audience: optionalText(2000),
  brandNotes: optionalText(2000),
  fontsColors: optionalText(2000),
  extraNotes: optionalText(5000),
  billingAddress: optionalText(300),
  billingCity: optionalText(120),
  billingCountry: optionalText(120),
  billingVat: optionalText(60),
});

export type OrderInput = z.infer<typeof orderSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  phone: optionalText(40),
  company: optionalText(120),
  marketingOptIn: z.coerce.boolean().optional(),
});

export const billingSchema = z.object({
  billingAddress: optionalText(300),
  billingCity: optionalText(120),
  billingCountry: optionalText(120),
  billingVat: optionalText(60),
});

export const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(8, "New password must be at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "The new passwords do not match", path: ["confirm"] });

/// ---------- Wizard drop-off tracking ----------

/** Like optionalText, but an unfilled box is stored as null rather than "". */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

/**
 * Every field of the wizard draft, as an allowlist. lastField is reported by the
 * browser and the admin report groups by it, so it has to be an enum: free text
 * there would be unbounded, visitor-controlled label cardinality on the page.
 */
export const DRAFT_FIELDS = [
  "treatment",
  "style",
  "slideCount",
  "deliveryTier",
  "proofreading",
  "grammar",
  "useGoogleSlides",
  "googleSlidesUrl",
  "brief",
  "audience",
  "brandNotes",
  "fontsColors",
  "extraNotes",
  "billingAddress",
  "billingCity",
  "billingCountry",
  "billingVat",
  "files",
  "styleFiles",
  "extras",
] as const;

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "Invalid id");

/**
 * A half-finished wizard.
 *
 * Nothing is required except the ids and the step, because the whole point is
 * the form somebody did not finish. Every cap matches orderSchema above, so this
 * unauthenticated endpoint is never a wider write surface than the authenticated
 * one it shadows, and zod strips unknown keys, so a payload cannot reach a
 * column named nowhere here. Note what is deliberately absent: the billing
 * values and the Google Slides URL, which are recorded only as "this box was
 * filled in".
 */
export const wizardAttemptSchema = z.object({
  attemptId: uuid,
  visitorId: uuid.nullish(),
  seq: z.number().int().min(1).max(100_000),
  step: z.number().int().min(1).max(5),
  maxStep: z.number().int().min(1).max(5),

  blocker: nullableText(200),
  blockedCount: z.number().int().min(0).max(1000).default(0),
  submitCount: z.number().int().min(0).max(1000).default(0),

  lastField: z.enum(DRAFT_FIELDS).nullish(),
  stepSeconds: z
    .string()
    .regex(/^([1-5]:\d{1,6})(,[1-5]:\d{1,6})*$/)
    .nullish(),
  resumed: z.boolean().default(false),
  reloads: z.number().int().min(0).max(500).default(0),
  openedExtras: z.boolean().default(false),

  treatment: optionId.nullish(),
  style: optionId.nullish(),
  slideCount: z.number().int().min(0).max(MAX_SLIDES).nullish(),
  deliveryTier: optionId.nullish(),
  proofreading: optionId.nullish(),
  grammar: z.enum(["UK", "US"]).nullish(),
  useGoogleSlides: z.boolean().default(false),
  estimateCents: z.number().int().min(0).max(100_000_000).nullish(),

  brief: nullableText(10_000),
  audience: nullableText(2_000),
  brandNotes: nullableText(2_000),
  fontsColors: nullableText(2_000),
  extraNotes: nullableText(5_000),

  billingFilled: z.array(z.enum(["address", "city", "country", "vat"])).max(4).default([]),
  googleSlidesFilled: z.boolean().default(false),
  fileCount: z.number().int().min(0).max(50).default(0),
  fileMb: z.number().int().min(0).max(100_000).default(0),
  styleFileCount: z.number().int().min(0).max(50).default(0),
  detectedSlides: z.number().int().min(0).max(MAX_SLIDES).nullish(),
});

export type WizardAttemptInput = z.infer<typeof wizardAttemptSchema>;
