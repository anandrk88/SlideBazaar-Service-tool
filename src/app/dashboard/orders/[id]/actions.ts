"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { approveAndRelease, cancelUnpaidOrder, postMessage, requestRevision } from "@/lib/orders";
import { createCheckoutUrl } from "@/lib/checkout";

async function ownOrder(orderId: string) {
  const user = await requireUser();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.customerId !== user.id) throw new Error("Order not found");
  return { user, order };
}

export async function approveAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const { user } = await ownOrder(orderId);
  await approveAndRelease(orderId, user.id);
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}?approved=1`);
}

export async function revisionAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const feedback = String(formData.get("feedback") ?? "").trim();
  if (feedback.length < 5) throw new Error("Please describe the changes you need");
  const { user } = await ownOrder(orderId);
  await requestRevision(orderId, user.id, feedback);
  revalidatePath(`/dashboard/orders/${orderId}`);
}

export async function customerMessageAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const { user } = await ownOrder(orderId);
  await postMessage(orderId, user.id, body);
  revalidatePath(`/dashboard/orders/${orderId}`);
}

export async function payNowAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const { user, order } = await ownOrder(orderId);
  const customer = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const url = await createCheckoutUrl(order, customer);
  redirect(url);
}

export async function cancelAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const { user } = await ownOrder(orderId);
  await cancelUnpaidOrder(orderId, user.id);
  revalidatePath(`/dashboard/orders/${orderId}`);
}
