"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { findBlock } from "@/lib/blocks";
import { clearBlock, saveBlock } from "@/lib/blocks-server";

const back: (msg: string) => never = (msg) => redirect(`/admin/homepage?msg=${encodeURIComponent(msg)}`);
const fail: (msg: string) => never = (msg) => redirect(`/admin/homepage?error=${encodeURIComponent(msg)}`);

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/homepage");
}

export async function saveBlockAction(id: string, fd: FormData) {
  await requireAdmin();
  const block = findBlock(id);
  if (!block) fail("That section does not exist.");

  const html = String(fd.get("html") ?? "");
  const result = await saveBlock(id, html);
  refresh();

  if (result.cleared) {
    back(result.removedSomething ? `${block.label}: nothing usable was left after cleaning, so the designed version is showing again.` : `${block.label} is back to the designed version.`);
  }
  back(
    result.removedSomething
      ? `${block.label} saved. Some tags or attributes were removed because they are not allowed.`
      : `${block.label} saved.`,
  );
}

export async function clearBlockAction(id: string) {
  await requireAdmin();
  const block = findBlock(id);
  if (!block) fail("That section does not exist.");
  await clearBlock(id);
  refresh();
  back(`${block.label} is back to the designed version.`);
}
