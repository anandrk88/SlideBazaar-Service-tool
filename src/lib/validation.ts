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
