import "server-only";
import sanitizeHtml from "sanitize-html";
import { prisma } from "./db";
import { ALLOWED_ATTRIBUTES, ALLOWED_SCHEMES, ALLOWED_TAGS, BLOCK_SETTING_PREFIX, findBlock } from "./blocks";

/**
 * Storing and cleaning the hand-written homepage blocks.
 *
 * Sanitising happens on the way in AND on the way out. On the way in so the
 * admin sees immediately what was removed; on the way out because a row could
 * have been written before a rule tightened, or by a direct database edit, and
 * the public page must never depend on that having gone well.
 */

const settingKey = (id: string) => `${BLOCK_SETTING_PREFIX}${id}`;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: ALLOWED_SCHEMES,
  // Relative links such as /order must keep working.
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  // style is not in the allowlist, but be explicit: an attacker-controlled
  // style attribute can position an invisible overlay over the whole page.
  allowedStyles: {},
  transformTags: {
    // Anything opening a new tab must not be able to reach back through
    // window.opener.
    a: (tagName, attribs) => {
      const out: Record<string, string> = { ...attribs };
      if (out.target === "_blank") out.rel = "noopener noreferrer";
      return { tagName, attribs: out };
    },
  },
  // Drop the contents of anything removed, rather than leaving stray text.
  nonTextTags: ["style", "script", "textarea", "option", "noscript", "iframe", "object", "embed"],
};

export function sanitizeBlock(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

/** True when cleaning would change the input, so the admin can be told. */
export function blockWasModified(html: string): boolean {
  return sanitizeBlock(html) !== html.trim();
}

export async function loadBlocks(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: BLOCK_SETTING_PREFIX } } });
  const out: Record<string, string> = {};
  for (const row of rows) {
    const id = row.key.slice(BLOCK_SETTING_PREFIX.length);
    // Clean again on read. A row is only trusted as far as this function.
    const clean = sanitizeBlock(row.value);
    if (clean.length > 0) out[id] = clean;
  }
  return out;
}

export async function getBlock(id: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: settingKey(id) } });
  if (!row) return null;
  const clean = sanitizeBlock(row.value);
  return clean.length > 0 ? clean : null;
}

/** Empty removes the override, so the section goes back to the designed version. */
export async function saveBlock(id: string, html: string) {
  if (!findBlock(id)) throw new Error("Unknown block");
  const clean = sanitizeBlock(html);

  if (clean.length === 0) {
    await prisma.setting.deleteMany({ where: { key: settingKey(id) } });
    return { cleared: true, removedSomething: html.trim().length > 0 };
  }

  await prisma.setting.upsert({
    where: { key: settingKey(id) },
    create: { key: settingKey(id), value: clean },
    update: { value: clean },
  });
  return { cleared: false, removedSomething: clean !== html.trim() };
}

export async function clearBlock(id: string) {
  if (!findBlock(id)) throw new Error("Unknown block");
  await prisma.setting.deleteMany({ where: { key: settingKey(id) } });
}
