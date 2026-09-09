import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isProduction } from "./env";

/**
 * File storage with two drivers.
 *
 * Local disk is for development only. Anything the app stores there is lost on
 * the next deploy, because most hosts give containers an ephemeral filesystem.
 * Set S3_BUCKET (plus credentials, and S3_ENDPOINT for Cloudflare R2 or another
 * S3-compatible service) and customer files live in object storage instead.
 *
 * Callers only ever see an opaque `key`. Nothing outside this file should join
 * paths or touch the filesystem.
 */

export type StorageDriver = "s3" | "local";

export function storageDriver(): StorageDriver {
  return process.env.S3_BUCKET ? "s3" : "local";
}

/** True when files would be lost on redeploy. Surfaced to admins as a warning. */
export function storageIsEphemeral() {
  return storageDriver() === "local";
}

export function localRoot() {
  const configured = process.env.UPLOAD_DIR || "./uploads";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

let s3: S3Client | null = null;
function client() {
  if (!s3) {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    // Failing loudly beats the alternative. Spreading these in conditionally
    // means one missing or misspelled variable drops the client through to the
    // AWS default credential chain, and a missing endpoint points it at real
    // AWS S3 - either way the failure surfaces as a confusing permissions
    // error against the wrong service rather than "you forgot a variable".
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3_BUCKET is set but S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are not both present. " +
          "Set them, or clear S3_BUCKET to use local disk. Check with: npm run storage:check",
      );
    }
    s3 = new S3Client({
      // R2 has no regions, but the SDK still requires a value.
      region: process.env.S3_REGION || "auto",
      // R2 and MinIO need an explicit endpoint; plain AWS S3 does not.
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
      credentials: { accessKeyId, secretAccessKey },
      // Since v3.729.0 the SDK attaches a CRC32 checksum to every upload and
      // validates one on every download. R2 has caught up for simple buffered
      // puts, but the same defaults still break streamed uploads (they switch
      // to aws-chunked, which R2 mishandles and then stores in the object's
      // Content-Encoding), multipart completion, and presigned PUTs, where the
      // signature covers a checksum header the browser never sends. Cloudflare
      // documents turning both off. Buffered writes pass either way, so this is
      // insurance against the paths we are one refactor away from using.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return s3;
}

const bucket = () => {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET is not configured");
  return b;
};

/** Reject anything that could escape the storage root. */
function assertSafeKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/") || key.startsWith("\\") || /^[a-zA-Z]:/.test(key)) {
    throw new Error("Invalid storage key");
  }
}

function localPath(key: string) {
  assertSafeKey(key);
  const root = localRoot();
  const full = path.resolve(root, key);
  // Resolve first, then confirm containment: a prefix check alone is not enough.
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Invalid storage key");
  return full;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  assertSafeKey(key);
  if (storageDriver() === "s3") {
    await client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
    return key;
  }
  const full = localPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  return key;
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  assertSafeKey(key);
  if (storageDriver() === "s3") {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return readFile(localPath(key));
}

/** A readable stream plus the byte length, for streaming downloads. */
export async function getObjectStream(key: string): Promise<{ stream: Readable; size: number }> {
  assertSafeKey(key);
  if (storageDriver() === "s3") {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return { stream: res.Body as Readable, size: Number(res.ContentLength ?? 0) };
  }
  const full = localPath(key);
  const info = await stat(full);
  return { stream: createReadStream(full), size: info.size };
}

export async function deleteObject(key: string) {
  assertSafeKey(key);
  try {
    if (storageDriver() === "s3") {
      await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
      return;
    }
    await rm(localPath(key), { force: true });
  } catch (err) {
    // Deleting storage must never break a user-facing action.
    console.warn(`[storage] could not delete ${key}:`, err instanceof Error ? err.message : err);
  }
}

/** Remove everything stored under a prefix, e.g. every file for one order. */
export async function deletePrefix(prefix: string) {
  assertSafeKey(prefix);
  try {
    if (storageDriver() === "s3") {
      let token: string | undefined;
      do {
        const listed = await client().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }));
        for (const obj of listed.Contents ?? []) {
          if (obj.Key) await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: obj.Key }));
        }
        token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (token);
      return;
    }
    await rm(localPath(prefix), { recursive: true, force: true });
  } catch (err) {
    console.warn(`[storage] could not delete prefix ${prefix}:`, err instanceof Error ? err.message : err);
  }
}

/** Warn loudly if production is about to store customer files on ephemeral disk. */
export function warnIfEphemeral() {
  if (isProduction && storageIsEphemeral()) {
    console.warn(
      "[storage] S3_BUCKET is not set, so uploads are being written to local disk. On most hosting this is wiped on the next deploy and customer files will be lost. Configure object storage.",
    );
  }
}
