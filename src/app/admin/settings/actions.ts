"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toOptionId } from "@/lib/catalog-server";
import { ICON_PRESETS, RANGE_TREATMENT_ID, SWATCH_PRESETS, TINT_PRESETS } from "@/lib/catalog";

const refresh = () => {
  revalidatePath("/admin/settings");
  revalidatePath("/order");
  revalidatePath("/");
};

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(str(fd, k));
const dollarsToCents = (fd: FormData, k: string) => Math.round(num(fd, k) * 100);
const bool = (fd: FormData, k: string) => fd.get(k) === "on";

/* ---------- Treatments ---------- */

export async function saveTreatment(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const minCents = dollarsToCents(fd, "min");
  const maxCents = id === RANGE_TREATMENT_ID ? dollarsToCents(fd, "max") : minCents;
  if (!(minCents >= 0) || !(maxCents >= minCents)) throw new Error("Check the prices");
  await prisma.treatmentOption.update({
    where: { id },
    data: {
      name: str(fd, "name") || undefined,
      tagline: str(fd, "tagline"),
      description: str(fd, "description"),
      minCents,
      maxCents,
      badge: str(fd, "badge") || null,
      enabled: bool(fd, "enabled"),
      sortOrder: num(fd, "sortOrder") || 0,
    },
  });
  refresh();
}

export async function addTreatment(fd: FormData) {
  await requireAdmin();
  const name = str(fd, "name");
  const id = toOptionId(name);
  if (await prisma.treatmentOption.findUnique({ where: { id } })) throw new Error("A treatment with that name already exists");
  const cents = dollarsToCents(fd, "price");
  if (!(cents > 0)) throw new Error("Enter a per-slide price");
  const icon = ICON_PRESETS.some((i) => i.id === str(fd, "icon")) ? str(fd, "icon") : "palette";
  const tint = TINT_PRESETS.some((t) => t.id === str(fd, "tint")) ? str(fd, "tint") : TINT_PRESETS[2].id;
  const count = await prisma.treatmentOption.count();
  await prisma.treatmentOption.create({
    data: { id, name, tagline: str(fd, "tagline"), description: str(fd, "description"), minCents: cents, maxCents: cents, icon, tint, enabled: true, sortOrder: count + 1 },
  });
  refresh();
}

/* ---------- Styles ---------- */

export async function saveStyle(fd: FormData) {
  await requireAdmin();
  await prisma.styleOption.update({
    where: { id: str(fd, "id") },
    data: {
      name: str(fd, "name") || undefined,
      description: str(fd, "description"),
      requiresUpload: bool(fd, "requiresUpload"),
      enabled: bool(fd, "enabled"),
      sortOrder: num(fd, "sortOrder") || 0,
    },
  });
  refresh();
}

export async function addStyle(fd: FormData) {
  await requireAdmin();
  const name = str(fd, "name");
  const id = toOptionId(name);
  if (await prisma.styleOption.findUnique({ where: { id } })) throw new Error("A style with that name already exists");
  const swatch = SWATCH_PRESETS.find((s) => s.id === str(fd, "swatch")) ?? SWATCH_PRESETS[0];
  const count = await prisma.styleOption.count();
  await prisma.styleOption.create({
    data: { id, name, description: str(fd, "description"), swatch: swatch.id, accent: swatch.accent, requiresUpload: bool(fd, "requiresUpload"), enabled: true, sortOrder: count + 1 },
  });
  refresh();
}

/* ---------- Delivery tiers ---------- */

export async function saveTier(fd: FormData) {
  await requireAdmin();
  const days = Math.floor(num(fd, "days"));
  const multiplier = num(fd, "multiplier");
  if (!(days >= 1 && days <= 30)) throw new Error("Days must be between 1 and 30");
  if (!(multiplier > 0 && multiplier <= 5)) throw new Error("Multiplier must be between 0 and 5");
  await prisma.deliveryTierOption.update({
    where: { id: str(fd, "id") },
    data: { name: str(fd, "name") || undefined, days, multiplier, note: str(fd, "note"), enabled: bool(fd, "enabled"), sortOrder: num(fd, "sortOrder") || 0 },
  });
  refresh();
}

/* ---------- Text services ---------- */

export async function saveTextService(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  await prisma.textServiceOption.update({
    where: { id },
    data: {
      name: str(fd, "name") || undefined,
      description: str(fd, "description"),
      perSlideCents: id === "NONE" ? 0 : Math.max(0, dollarsToCents(fd, "price")),
      enabled: id === "NONE" ? true : bool(fd, "enabled"),
      sortOrder: num(fd, "sortOrder") || 0,
    },
  });
  refresh();
}
