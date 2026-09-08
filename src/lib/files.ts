import "server-only";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ACCEPTED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from "./catalog";
import { deleteObject, deletePrefix, getObjectBuffer, getObjectStream, putObject } from "./storage";

/** Total bytes accepted in one submission, across all files. */
export const MAX_UPLOAD_TOTAL_BYTES = 500 * 1024 * 1024;
/** Files accepted in one submission. */
export const MAX_UPLOAD_FILES = 60;

export function validateUpload(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  if (!ACCEPTED_UPLOAD_EXTENSIONS.includes(ext)) {
    throw new Error(`File type ${ext || "(none)"} is not accepted: ${file.name}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is larger than the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`);
  }
}

/** Check a whole batch before writing any of it, so a rejected set stores nothing. */
export function validateUploadBatch(files: File[]) {
  if (files.length > MAX_UPLOAD_FILES) throw new Error(`Too many files at once. The limit is ${MAX_UPLOAD_FILES}.`);
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > MAX_UPLOAD_TOTAL_BYTES) {
    throw new Error(`Those files add up to ${(total / 1024 / 1024).toFixed(0)} MB. The limit for one submission is ${MAX_UPLOAD_TOTAL_BYTES / 1024 / 1024} MB.`);
  }
  files.forEach(validateUpload);
}

/** Persist an uploaded File under <orderId>/ and return its storage key. */
export async function storeUpload(orderId: string, file: File) {
  validateUpload(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const key = `${orderId}/${Date.now()}-${randomBytes(4).toString("hex")}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await putObject(key, buffer, file.type || "application/octet-stream");
  return {
    storedPath: key,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export async function openStoredFile(storedPath: string) {
  return getObjectStream(storedPath);
}

export async function readStoredFile(storedPath: string) {
  return getObjectBuffer(storedPath);
}

export async function removeStoredFile(storedPath: string) {
  return deleteObject(storedPath);
}

/** Delete every stored file for an order. Used when a half-created order is rolled back. */
export async function removeOrderFiles(orderId: string) {
  return deletePrefix(`${orderId}/`);
}
