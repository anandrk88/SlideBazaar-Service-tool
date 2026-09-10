import "server-only";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { prisma } from "./db";
import { deleteObject, putObject } from "./storage";
import { ACCEPTED_MEDIA, MEDIA_SETTING_PREFIX, findMediaSlot, type MediaRecord } from "./media";

/**
 * Storing the homepage pictures and video.
 *
 * The object key is chosen by the server from the slot id and random bytes, so
 * an uploader never influences where the bytes land. What is stored against the
 * slot is a small JSON record in the Setting table; the public route reads that
 * to find the object, which is why no key ever reaches the browser.
 */

const settingKey = (slot: string) => `${MEDIA_SETTING_PREFIX}${slot}`;

export async function loadMedia(): Promise<Record<string, MediaRecord>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: MEDIA_SETTING_PREFIX } } });
  const out: Record<string, MediaRecord> = {};
  for (const row of rows) {
    try {
      out[row.key.slice(MEDIA_SETTING_PREFIX.length)] = JSON.parse(row.value) as MediaRecord;
    } catch {
      // A malformed row must not take the homepage down; the slot just looks empty.
      console.warn(`[media] ignoring unreadable record for ${row.key}`);
    }
  }
  return out;
}

export async function getMedia(slot: string): Promise<MediaRecord | null> {
  const row = await prisma.setting.findUnique({ where: { key: settingKey(slot) } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as MediaRecord;
  } catch {
    return null;
  }
}

/** Sniff the real type rather than trusting the browser's Content-Type. */
function looksLikeDeclaredType(bytes: Buffer, contentType: string): boolean {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (contentType === "image/png") return startsWith(0x89, 0x50, 0x4e, 0x47);
  if (contentType === "image/jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (contentType === "image/webp") return startsWith(0x52, 0x49, 0x46, 0x46) && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (contentType === "image/avif" || contentType === "video/mp4") {
    // Both are ISO base media files: a 4-byte size then "ftyp".
    return bytes.subarray(4, 8).toString("ascii") === "ftyp";
  }
  if (contentType === "video/webm") return startsWith(0x1a, 0x45, 0xdf, 0xa3);
  return false;
}

export async function saveMedia(slot: string, file: File): Promise<MediaRecord> {
  const definition = findMediaSlot(slot);
  if (!definition) throw new Error("Unknown media slot");

  const rules = ACCEPTED_MEDIA[definition.kind];
  const extension = path.extname(file.name).toLowerCase();

  if (!rules.extensions.includes(extension)) {
    throw new Error(`${definition.label} accepts ${rules.extensions.join(", ")}. That file is ${extension || "unrecognised"}.`);
  }
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > rules.maxBytes) {
    throw new Error(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit for a ${definition.kind} is ${rules.maxBytes / 1024 / 1024} MB.`);
  }

  const contentType = rules.contentTypes.includes(file.type) ? file.type : "";
  if (!contentType) throw new Error(`${definition.label} accepts ${rules.contentTypes.join(", ")}.`);

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLikeDeclaredType(bytes, contentType)) {
    throw new Error("That file's contents do not match its type. It may be renamed or corrupt.");
  }

  // The server picks the key. Slot id is sanitised because it becomes a path.
  const safeSlot = slot.replace(/[^a-z0-9.]/gi, "-");
  const key = `marketing/${safeSlot}/${randomBytes(8).toString("hex")}${extension}`;
  await putObject(key, bytes, contentType);

  const record: MediaRecord = {
    key,
    contentType,
    sizeBytes: bytes.length,
    originalName: file.name,
    uploadedAt: new Date().toISOString(),
    version: createHash("sha256").update(bytes).digest("hex").slice(0, 12),
  };

  const previous = await getMedia(slot);
  await prisma.setting.upsert({
    where: { key: settingKey(slot) },
    create: { key: settingKey(slot), value: JSON.stringify(record) },
    update: { value: JSON.stringify(record) },
  });
  // Only after the new record is committed, so a failure here leaves an
  // orphaned object rather than a slot pointing at nothing.
  if (previous?.key && previous.key !== key) await deleteObject(previous.key);

  return record;
}

export async function clearMedia(slot: string) {
  if (!findMediaSlot(slot)) throw new Error("Unknown media slot");
  const existing = await getMedia(slot);
  await prisma.setting.deleteMany({ where: { key: settingKey(slot) } });
  if (existing?.key) await deleteObject(existing.key);
}
