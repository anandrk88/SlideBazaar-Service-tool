"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { retryRefund } from "@/lib/orders";

/** Retry a refund that failed to settle with Stripe. */
export async function retryRefundAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("refundAttemptId"));
  await retryRefund(id);
  revalidatePath("/admin");
}
