"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { billingSchema, passwordSchema, profileSchema } from "@/lib/validation";
import { addCardUrl, addTestCard, removeCard, setDefaultCard } from "@/lib/cards";

// Explicit type annotations let TypeScript treat these as never-returning for narrowing.
const back: (msg: string) => never = (msg) => redirect(`/account?msg=${encodeURIComponent(msg)}`);
const fail: (msg: string) => never = (msg) => redirect(`/account?error=${encodeURIComponent(msg)}`);

export async function saveProfileAction(fd: FormData) {
  const user = await requireUser("/account");
  const parsed = profileSchema.safeParse({ ...Object.fromEntries(fd.entries()), marketingOptIn: fd.get("marketingOptIn") === "on" });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the form");
  const d = parsed.data;
  await prisma.user.update({ where: { id: user.id }, data: { name: d.name, phone: d.phone || null, company: d.company || null, marketingOptIn: Boolean(d.marketingOptIn) } });
  revalidatePath("/account");
  back("Profile saved.");
}

export async function saveBillingAction(fd: FormData) {
  const user = await requireUser("/account");
  const parsed = billingSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the form");
  const d = parsed.data;
  await prisma.user.update({
    where: { id: user.id },
    data: { billingAddress: d.billingAddress || null, billingCity: d.billingCity || null, billingCountry: d.billingCountry || null, billingVat: d.billingVat || null },
  });
  revalidatePath("/account");
  back("Billing details saved.");
}

export async function changePasswordAction(fd: FormData) {
  const user = await requireUser("/account");
  const parsed = passwordSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the form");
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(parsed.data.current, full.passwordHash))) fail("Your current password is incorrect");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  back("Password changed.");
}

export async function addCardAction() {
  const user = await requireUser("/account");
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  let url: string;
  try {
    url = await addCardUrl(full);
  } catch (err) {
    fail(err instanceof Error ? err.message : "Could not start card setup");
    return;
  }
  redirect(url);
}

export async function addTestCardAction(fd: FormData) {
  const user = await requireUser("/account");
  const brand = String(fd.get("brand") ?? "Visa");
  const last4 = String(fd.get("last4") ?? "4242").replace(/\D/g, "").slice(-4).padStart(4, "4");
  const expMonth = Math.min(12, Math.max(1, Number(fd.get("expMonth") ?? 12)));
  const expYear = Math.max(new Date().getFullYear(), Number(fd.get("expYear") ?? new Date().getFullYear() + 3));
  try {
    await addTestCard(user.id, brand, last4, expMonth, expYear);
  } catch (err) {
    fail(err instanceof Error ? err.message : "Could not add card");
  }
  revalidatePath("/account");
  back("Test card added.");
}

export async function setDefaultCardAction(fd: FormData) {
  const user = await requireUser("/account");
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  await setDefaultCard(full, String(fd.get("cardId")));
  revalidatePath("/account");
  back("Default card updated.");
}

export async function removeCardAction(fd: FormData) {
  const user = await requireUser("/account");
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  await removeCard(full, String(fd.get("cardId")));
  revalidatePath("/account");
  back("Card removed.");
}
