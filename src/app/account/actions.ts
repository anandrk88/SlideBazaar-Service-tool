"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser, setSessionCookie, verifyPassword, type Role } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { billingSchema, passwordSchema, profileSchema, setPasswordSchema } from "@/lib/validation";
import { addCardUrl, addTestCard, removeCard, setDefaultCard } from "@/lib/cards";
import { unlinkIdentity } from "@/lib/auth-federated";
import { notifyPasswordChanged, sendVerificationEmail } from "@/lib/account-email";

// Explicit type annotations let TypeScript treat these as never-returning for narrowing.
const back: (msg: string) => never = (msg) => redirect(`/account?msg=${encodeURIComponent(msg)}`);
const fail: (msg: string) => never = (msg) => redirect(`/account?error=${encodeURIComponent(msg)}`);

/**
 * Re-issue the current browser's session cookie after sessionVersion has been
 * bumped. Without this the action that revoked other sessions also signs the
 * person doing it out.
 */
async function refreshOwnSession(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, sessionVersion: true },
  });
  await setSessionCookie({ ...u, role: u.role as Role });
}

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
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  // An account created through Google has no password to confirm, so setting
  // the first one uses a different form and a different schema.
  if (!full.passwordHash) {
    const parsed = setPasswordSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the form");
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.next), sessionVersion: { increment: 1 } },
    });
    await refreshOwnSession(user.id);
    await notifyPasswordChanged(user.id);
    revalidatePath("/account");
    back("Password set. You can now log in with your email as well as Google. Other devices have been signed out.");
    return;
  }

  const parsed = passwordSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the form");
  if (!(await verifyPassword(parsed.data.current, full.passwordHash))) fail("Your current password is incorrect");
  await prisma.user.update({
    where: { id: user.id },
    // Changing a password should end sessions elsewhere. The current browser
    // gets a fresh cookie below so this one stays signed in.
    data: { passwordHash: await hashPassword(parsed.data.next), sessionVersion: { increment: 1 } },
  });
  await refreshOwnSession(user.id);
  await notifyPasswordChanged(user.id);
  back("Password changed. Any other devices have been signed out.");
}

/** Detach a connected sign-in, unless it is the only way back into the account. */
export async function unlinkIdentityAction(fd: FormData) {
  const user = await requireUser("/account");
  const identityId = String(fd.get("identityId") ?? "");
  const result = await unlinkIdentity(user.id, identityId);
  if (!result.ok) {
    fail(
      result.reason === "LAST_CREDENTIAL"
        ? "That is the only way you can sign in. Set a password first, then disconnect it."
        : "That connected account no longer exists.",
    );
  }
  // unlinkIdentity bumps sessionVersion to kill sessions started through that
  // identity, which would otherwise include this one.
  await refreshOwnSession(user.id);
  revalidatePath("/account");
  back("Disconnected.");
}

/** Send a fresh confirmation link to the address on the account. */
export async function resendVerificationAction() {
  const user = await requireUser("/account");
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, email: true, name: true, emailVerified: true } });
  if (full.emailVerified) back("That address is already confirmed.");
  try {
    await sendVerificationEmail(full);
  } catch {
    fail("We could not send that email just now. Please try again shortly.");
  }
  back("Confirmation email sent.");
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
