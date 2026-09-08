import {
  ESCROW_COLORS,
  ESCROW_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";

export function StatusBadge({ status }: { status: string }) {
  const s = status as OrderStatus;
  return <span className={`chip ${STATUS_COLORS[s] ?? "bg-slate-100 text-slate-700"}`}>{STATUS_LABELS[s] ?? status}</span>;
}

export function EscrowBadge({ status }: { status: string }) {
  return (
    <span className={`chip ${ESCROW_COLORS[status] ?? "bg-slate-100 text-slate-700"}`}>
      {ESCROW_LABELS[status] ?? status}
    </span>
  );
}
