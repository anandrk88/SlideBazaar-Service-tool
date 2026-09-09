"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireQcReviewer, requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { removeStoredFile, storeUpload, validateUploadBatch } from "@/lib/files";
import { createPreviewsFromImages, isPreviewImage } from "@/lib/previews";
import { loadCatalog } from "@/lib/catalog-server";
import { RANGE_TREATMENT_ID } from "@/lib/catalog";
import { addEvent, assignDesigner, postMessage, qcApprove, qcReject, refundOrder, setFinalTreatment, startWork, submitForQc } from "@/lib/orders";

const refresh = (id: string) => {
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/admin");
};

/** Designers may only act on orders assigned to them. */
async function assertMayWork(user: { id: string; role: string }, orderId: string) {
  if (user.role !== "DESIGNER") return;
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { designerId: true } });
  if (order.designerId !== user.id) throw new Error("This order is not assigned to you");
}

export async function assignAction(formData: FormData) {
  const user = await requireAdmin();
  const orderId = String(formData.get("orderId"));
  const designerId = String(formData.get("designerId") ?? "");
  await assignDesigner(orderId, designerId || null, user.id);
  refresh(orderId);
}

export async function finalTreatmentAction(formData: FormData) {
  const user = await requireStaff();
  const orderId = String(formData.get("orderId"));
  await assertMayWork(user, orderId);
  const t = String(formData.get("finalTreatment"));
  const catalog = await loadCatalog();
  if (t === RANGE_TREATMENT_ID || !catalog.treatments.some((x) => x.id === t)) throw new Error("Invalid treatment");
  await setFinalTreatment(orderId, t, user.id);
  refresh(orderId);
}

export async function startAction(formData: FormData) {
  const user = await requireStaff();
  const orderId = String(formData.get("orderId"));
  await assertMayWork(user, orderId);
  await startWork(orderId, user.id);
  refresh(orderId);
}

/**
 * Designer uploads a draft: the design files (PPTX etc., unlocked for the
 * customer only after approval) plus one image per slide, which are
 * watermarked and shown to the customer as previews. Goes to quality check.
 */
export async function submitDraftAction(formData: FormData) {
  const user = await requireStaff();
  const orderId = String(formData.get("orderId"));
  await assertMayWork(user, orderId);
  const note = String(formData.get("note") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const images = formData.getAll("previews").filter((f): f is File => f instanceof File && f.size > 0 && isPreviewImage(f.name));
  if (files.length === 0) throw new Error("Attach the design file(s)");
  if (images.length === 0) throw new Error("Attach slide images (PNG or JPG, one per slide) for the customer preview");
  // Checks the count and the combined size, not just each file, so an oversized
  // submission is refused with a sentence about size.
  validateUploadBatch([...files, ...images]);

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const version = order.revisionCount + 1;
  // A resubmission after QC rejection replaces the previous unreleased draft
  // files. Deleting only the rows left the objects behind forever, so every
  // rejected round quietly kept paying for storage nothing pointed at. Take the
  // keys first, drop the rows, then remove the bytes.
  const superseded = await prisma.orderFile.findMany({ where: { orderId, kind: "DRAFT" }, select: { storedPath: true } });
  await prisma.orderFile.deleteMany({ where: { orderId, kind: "DRAFT" } });
  for (const old of superseded) await removeStoredFile(old.storedPath);
  for (const f of files) {
    const stored = await storeUpload(orderId, f);
    await prisma.orderFile.create({ data: { ...stored, orderId, uploadedById: user.id, kind: "DRAFT", version, label: `Draft ${version}` } });
  }
  // Keep the original (unwatermarked) slide images too; they unlock for the customer after approval.
  const ordered = [...images].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  for (let i = 0; i < ordered.length; i++) {
    const stored = await storeUpload(orderId, ordered[i]);
    await prisma.orderFile.create({ data: { ...stored, orderId, uploadedById: user.id, kind: "DRAFT", version, label: `Slide ${i + 1}` } });
  }
  const slides = await createPreviewsFromImages(orderId, version, images, order.orderNumber);
  await submitForQc(orderId, user.id, `${slides} slide preview${slides === 1 ? "" : "s"}${note ? `. ${note}` : ""}`);
  refresh(orderId);
}

export async function qcApproveAction(formData: FormData) {
  const user = await requireQcReviewer();
  const orderId = String(formData.get("orderId"));
  const note = String(formData.get("note") ?? "").trim();
  await qcApprove(orderId, user.id, note || undefined);
  refresh(orderId);
}

export async function qcRejectAction(formData: FormData) {
  const user = await requireQcReviewer();
  const orderId = String(formData.get("orderId"));
  const feedback = String(formData.get("feedback") ?? "").trim();
  if (feedback.length < 5) throw new Error("Tell the designer what to change");
  await qcReject(orderId, user.id, feedback);
  refresh(orderId);
}

export async function internalNoteAction(formData: FormData) {
  const user = await requireStaff();
  const orderId = String(formData.get("orderId"));
  await assertMayWork(user, orderId);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await addEvent(prisma, orderId, "NOTE", body, user.id, true);
  refresh(orderId);
}

export async function refundAction(formData: FormData) {
  const user = await requireAdmin();
  const orderId = String(formData.get("orderId"));
  const reason = String(formData.get("reason") ?? "").trim() || "Refund issued by SlideBazaar.";
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountCents = amountRaw ? Math.round(Number(amountRaw) * 100) : undefined;
  await refundOrder(orderId, user.id, reason, amountCents);
  refresh(orderId);
}

export async function staffMessageAction(formData: FormData) {
  const user = await requireStaff();
  const orderId = String(formData.get("orderId"));
  await assertMayWork(user, orderId);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await postMessage(orderId, user.id, body);
  refresh(orderId);
}
