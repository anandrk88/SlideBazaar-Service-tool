import "server-only";
import { prisma } from "./db";
import { DEFAULT_CATALOG, type Catalog } from "./catalog";

/** Load the catalogue from the database, seeding the defaults on first use. */
export async function loadCatalog(): Promise<Catalog> {
  const count = await prisma.treatmentOption.count();
  if (count === 0) await seedCatalog();
  const [treatments, styles, tiers, textServices] = await Promise.all([
    prisma.treatmentOption.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.styleOption.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.deliveryTierOption.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.textServiceOption.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return { treatments, styles, tiers, textServices };
}

export async function seedCatalog() {
  await prisma.$transaction([
    ...DEFAULT_CATALOG.treatments.map((t) => prisma.treatmentOption.upsert({ where: { id: t.id }, create: { ...t, badge: t.badge ?? null }, update: {} })),
    ...DEFAULT_CATALOG.styles.map((s) => prisma.styleOption.upsert({ where: { id: s.id }, create: s, update: {} })),
    ...DEFAULT_CATALOG.tiers.map((t) => prisma.deliveryTierOption.upsert({ where: { id: t.id }, create: t, update: {} })),
    ...DEFAULT_CATALOG.textServices.map((p) => prisma.textServiceOption.upsert({ where: { id: p.id }, create: p, update: {} })),
  ]);
}

/** Turn a display name into a stable id: "Motion graphics" -> MOTION_GRAPHICS */
export function toOptionId(name: string) {
  const id = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!id) throw new Error("Please give the option a name");
  return id;
}
