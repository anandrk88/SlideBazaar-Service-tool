/**
 * Order lifecycle.
 *
 *  PENDING_PAYMENT --pay--> PAID (escrow HELD) --start--> IN_PROGRESS --designer uploads--> QC_REVIEW
 *      |                                                      ^                                |
 *      +--cancel--> CANCELLED                                 |<----- QC sends back -----------+
 *                                                             |                                | QC approves
 *                                                             |                                v
 *                                                             +<---- customer revision --- DELIVERED
 *                                                                                              | customer approves
 *                                                                                              v
 *                                                                        APPROVED (escrow RELEASED) --> COMPLETED
 *  Any paid state --refund (admin)--> REFUNDED (escrow REFUNDED)
 */
export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "IN_PROGRESS",
  "QC_REVIEW",
  "DELIVERED",
  "REVISION_REQUESTED",
  "APPROVED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid, in queue",
  IN_PROGRESS: "In progress",
  QC_REVIEW: "Quality check",
  DELIVERED: "Draft delivered, awaiting review",
  REVISION_REQUESTED: "Revision requested",
  APPROVED: "Approved, payment released",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  PAID: "bg-sky-100 text-sky-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  QC_REVIEW: "bg-fuchsia-100 text-fuchsia-800",
  DELIVERED: "bg-violet-100 text-violet-800",
  REVISION_REQUESTED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  REFUNDED: "bg-rose-100 text-rose-800",
};

export const ESCROW_LABELS: Record<string, string> = {
  NONE: "Not paid",
  HELD: "Held by SlideBazaar",
  RELEASED: "Released to SlideBazaar",
  PARTIALLY_RELEASED: "Released, balance refunded",
  REFUNDED: "Refunded to customer",
};

export const ESCROW_COLORS: Record<string, string> = {
  NONE: "bg-slate-100 text-slate-600",
  HELD: "bg-amber-100 text-amber-800",
  RELEASED: "bg-emerald-100 text-emerald-800",
  PARTIALLY_RELEASED: "bg-emerald-100 text-emerald-800",
  REFUNDED: "bg-rose-100 text-rose-800",
};

/** Statuses in which money is sitting in escrow. */
export const ESCROW_HELD_STATUSES: OrderStatus[] = ["PAID", "IN_PROGRESS", "QC_REVIEW", "DELIVERED", "REVISION_REQUESTED"];

export const ACTIVE_STATUSES: OrderStatus[] = ["PAID", "IN_PROGRESS", "QC_REVIEW", "DELIVERED", "REVISION_REQUESTED"];

/** Statuses where a designer can upload a draft for QC. */
export const DESIGNING_STATUSES: OrderStatus[] = ["PAID", "IN_PROGRESS", "REVISION_REQUESTED"];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["IN_PROGRESS", "QC_REVIEW", "REFUNDED", "CANCELLED"],
  IN_PROGRESS: ["QC_REVIEW", "REFUNDED"],
  QC_REVIEW: ["DELIVERED", "IN_PROGRESS", "REFUNDED"],
  DELIVERED: ["REVISION_REQUESTED", "APPROVED", "REFUNDED"],
  REVISION_REQUESTED: ["IN_PROGRESS", "QC_REVIEW", "REFUNDED"],
  APPROVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: string, to: OrderStatus) {
  return (TRANSITIONS[from as OrderStatus] ?? []).includes(to);
}

export function assertTransition(from: string, to: OrderStatus) {
  if (!canTransition(from, to)) throw new Error(`Cannot move order from ${from} to ${to}`);
}

export function isOrderStatus(s: string): s is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(s);
}

/** Progress steps shown to the customer on the order page. */
export const PROGRESS_STEPS: { key: string; label: string; reached: OrderStatus[] }[] = [
  { key: "paid", label: "Paid and held", reached: ["PAID", "IN_PROGRESS", "QC_REVIEW", "DELIVERED", "REVISION_REQUESTED", "APPROVED", "COMPLETED"] },
  { key: "design", label: "Designing", reached: ["IN_PROGRESS", "QC_REVIEW", "DELIVERED", "REVISION_REQUESTED", "APPROVED", "COMPLETED"] },
  { key: "review", label: "Your review", reached: ["DELIVERED", "REVISION_REQUESTED", "APPROVED", "COMPLETED"] },
  { key: "released", label: "Approved and released", reached: ["APPROVED", "COMPLETED"] },
];
