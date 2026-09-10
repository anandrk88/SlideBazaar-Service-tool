"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { findMediaSlot } from "@/lib/media";
import { clearMedia, saveMedia } from "@/lib/media-server";

const back: (msg: string) => never = (msg) => redirect(`/admin/media?msg=${encodeURIComponent(msg)}`);
const fail: (msg: string) => never = (msg) => redirect(`/admin/media?error=${encodeURIComponent(msg)}`);

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/media");
}

export async function uploadMediaAction(slot: string, fd: FormData) {
  await requireAdmin();
  const definition = findMediaSlot(slot);
  if (!definition) fail("That slot does not exist.");

  const file = fd.get(`file:${slot}`);
  if (!(file instanceof File) || file.size === 0) fail("Choose a file first.");

  try {
    await saveMedia(slot, file);
  } catch (err) {
    fail(err instanceof Error ? err.message : "That upload did not work.");
  }
  refresh();
  back(`${definition.label} updated.`);
}

export async function clearMediaAction(slot: string) {
  await requireAdmin();
  const definition = findMediaSlot(slot);
  if (!definition) fail("That slot does not exist.");
  await clearMedia(slot);
  refresh();
  back(`${definition.label} removed. The drawn version is showing again.`);
}
