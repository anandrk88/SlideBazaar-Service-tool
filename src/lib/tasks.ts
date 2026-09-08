/** Helpers that turn an order's status into "what should happen next" for each role. */

export interface TaskHint {
  label: string;
  tone: "todo" | "waiting" | "done" | "alert";
}

/** What the designer should do next. */
export function designerNextAction(status: string): TaskHint {
  switch (status) {
    case "PAID":
      return { label: "Start work", tone: "todo" };
    case "IN_PROGRESS":
      return { label: "Upload draft for QC", tone: "todo" };
    case "REVISION_REQUESTED":
      return { label: "Customer wants changes: revise and resubmit", tone: "alert" };
    case "QC_REVIEW":
      return { label: "Waiting for QC", tone: "waiting" };
    case "DELIVERED":
      return { label: "With the customer", tone: "waiting" };
    case "APPROVED":
    case "COMPLETED":
      return { label: "Approved", tone: "done" };
    default:
      return { label: status.replace(/_/g, " ").toLowerCase(), tone: "waiting" };
  }
}

/** Why an order needs an admin's attention, or null if it is healthy. */
export function adminAttention(order: {
  status: string;
  designerId: string | null;
  deadlineAt: Date;
  deliveredAt: Date | null;
  updatedAt: Date;
}, now = Date.now()): TaskHint | null {
  const active = ["PAID", "IN_PROGRESS", "QC_REVIEW", "DELIVERED", "REVISION_REQUESTED"].includes(order.status);
  if (!active) return null;
  const hoursSinceUpdate = (now - order.updatedAt.getTime()) / 36e5;
  if (["PAID", "IN_PROGRESS", "REVISION_REQUESTED", "QC_REVIEW"].includes(order.status) && order.deadlineAt.getTime() < now && !order.deliveredAt) {
    return { label: "Overdue: first draft not delivered", tone: "alert" };
  }
  if (["IN_PROGRESS", "REVISION_REQUESTED", "QC_REVIEW"].includes(order.status) && order.deadlineAt.getTime() < now) {
    return { label: "Past deadline: revision still open", tone: "alert" };
  }
  if (order.status === "PAID" && !order.designerId) return { label: "Paid but no designer assigned", tone: "alert" };
  if (order.status === "QC_REVIEW" && hoursSinceUpdate > 4) return { label: `In QC for ${Math.round(hoursSinceUpdate)}h`, tone: "alert" };
  if (order.status === "REVISION_REQUESTED" && hoursSinceUpdate > 24) return { label: "Revision waiting over a day", tone: "alert" };
  const hoursToDeadline = (order.deadlineAt.getTime() - now) / 36e5;
  if (["PAID", "IN_PROGRESS", "REVISION_REQUESTED"].includes(order.status) && hoursToDeadline < 24) {
    return { label: "Due within 24 hours", tone: "todo" };
  }
  return null;
}

/** Human countdown to a deadline. */
export function countdown(deadline: Date, now = Date.now()) {
  const diff = deadline.getTime() - now;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 36e5);
  const days = Math.round(abs / 864e5);
  const text = hours < 48 ? `${hours}h` : `${days}d`;
  return diff < 0 ? `${text} overdue` : `${text} left`;
}

export const TONE_CLASSES: Record<TaskHint["tone"], string> = {
  todo: "bg-accent-100 text-accent-700",
  waiting: "bg-slate-100 text-slate-600",
  done: "bg-emerald-100 text-emerald-800",
  alert: "bg-rose-100 text-rose-700",
};
