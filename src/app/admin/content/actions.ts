"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { CONTENT_FIELDS } from "@/lib/content";
import { resetAllContent, saveContent } from "@/lib/content-server";

const back: (msg: string) => never = (msg) => redirect(`/admin/content?msg=${encodeURIComponent(msg)}`);

/** The homepage is cached, so an edit has to invalidate it or nothing appears to change. */
function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/content");
}

export async function saveContentAction(fd: FormData) {
  await requireAdmin();

  // Read from the known field list rather than iterating the form, so a crafted
  // request cannot write settings this page was never meant to touch.
  const entries: Record<string, string> = {};
  for (const field of CONTENT_FIELDS) {
    const value = fd.get(field.key);
    if (typeof value === "string") entries[field.key] = value;
  }

  await saveContent(entries);
  refresh();
  back("Homepage text saved.");
}

/**
 * Put a single field back to the wording that ships with the app.
 *
 * The key is bound at the call site rather than read from the form: React does
 * not pass a submit button's name/value through to a server action the way a
 * plain HTML form does, so `<button name="key" value={...}>` arrives empty.
 */
export async function resetFieldAction(key: string) {
  await requireAdmin();
  if (!CONTENT_FIELDS.some((f) => f.key === key)) back("That field does not exist.");

  // saveContent treats an empty value as "remove the override".
  await saveContent({ [key]: "" });
  refresh();
  back("Reset to the original wording.");
}

export async function resetAllContentAction() {
  await requireAdmin();
  const count = await resetAllContent();
  refresh();
  back(count === 0 ? "Nothing to reset; every field was already the original." : `Reset ${count} field${count === 1 ? "" : "s"} to the original wording.`);
}
