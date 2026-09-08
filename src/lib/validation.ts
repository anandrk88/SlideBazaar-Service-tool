import { z } from "zod";
import { MAX_SLIDES, MIN_SLIDES } from "./catalog";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  marketingOptIn: z.coerce.boolean().optional(),
  agree: z.coerce.boolean().refine((v) => v, "You must accept the terms to continue"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

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
