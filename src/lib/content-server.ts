import "server-only";
import { prisma } from "./db";
import { CONTENT_DEFAULTS, CONTENT_SETTING_PREFIX, contentGetter, type Content } from "./content";

/**
 * Loading and saving the editable homepage copy.
 *
 * Overrides live in the Setting table under a `content.` prefix. Only strings
 * that actually differ from the default are stored, so resetting a field is a
 * delete rather than a row holding a copy of the default — which means changing
 * a default in code takes effect for everyone who never edited that field.
 */

export async function loadContentOverrides(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: CONTENT_SETTING_PREFIX } } });
  return Object.fromEntries(rows.map((r) => [r.key.slice(CONTENT_SETTING_PREFIX.length), r.value]));
}

/** The getter the homepage renders from. */
export async function loadContent(): Promise<Content> {
  return contentGetter(await loadContentOverrides());
}

/**
 * Apply edits. A value equal to the default, or blank, removes the override.
 * Unknown keys are ignored rather than stored, so a stale form cannot fill the
 * table with rows nothing reads.
 */
export async function saveContent(entries: Record<string, string>) {
  const writes: Promise<unknown>[] = [];
  const removals: string[] = [];

  for (const [key, raw] of Object.entries(entries)) {
    if (!(key in CONTENT_DEFAULTS)) continue;
    const value = raw.trim();
    const settingKey = `${CONTENT_SETTING_PREFIX}${key}`;
    if (value.length === 0 || value === CONTENT_DEFAULTS[key]) {
      removals.push(settingKey);
      continue;
    }
    writes.push(
      prisma.setting.upsert({ where: { key: settingKey }, create: { key: settingKey, value }, update: { value } }),
    );
  }

  if (removals.length > 0) writes.push(prisma.setting.deleteMany({ where: { key: { in: removals } } }));
  await Promise.all(writes);
  return { changed: writes.length };
}

/** Put every field back to the wording that ships with the app. */
export async function resetAllContent() {
  const { count } = await prisma.setting.deleteMany({ where: { key: { startsWith: CONTENT_SETTING_PREFIX } } });
  return count;
}
