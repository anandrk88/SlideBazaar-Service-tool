"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BellIcon, CheckIcon, FileIcon, InboxIcon, LockIcon, MessageIcon, PencilIcon, ShieldCheckIcon, TasksIcon } from "@/components/Icons";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

type IconComp = (p: { width: number; height: number; className?: string }) => React.ReactElement;

const TYPE_STYLE: Record<string, { Icon: IconComp; tile: string; label: string }> = {
  ORDER_PAID: { Icon: LockIcon, tile: "bg-amber-100 text-amber-700", label: "Payment" },
  ASSIGNED: { Icon: TasksIcon, tile: "bg-sky-100 text-sky-700", label: "Assignment" },
  QC_SUBMITTED: { Icon: ShieldCheckIcon, tile: "bg-fuchsia-100 text-fuchsia-700", label: "Quality check" },
  QC_APPROVED: { Icon: ShieldCheckIcon, tile: "bg-emerald-100 text-emerald-700", label: "Quality check" },
  QC_RETURNED: { Icon: ShieldCheckIcon, tile: "bg-orange-100 text-orange-700", label: "Quality check" },
  DELIVERED: { Icon: FileIcon, tile: "bg-violet-100 text-violet-700", label: "Delivery" },
  REVISION: { Icon: PencilIcon, tile: "bg-orange-100 text-orange-700", label: "Revision" },
  APPROVED: { Icon: CheckIcon, tile: "bg-emerald-100 text-emerald-700", label: "Approved" },
  REFUNDED: { Icon: LockIcon, tile: "bg-rose-100 text-rose-700", label: "Refund" },
  MESSAGE: { Icon: MessageIcon, tile: "bg-brand-100 text-brand-700", label: "Message" },
};
const FALLBACK = { Icon: BellIcon as IconComp, tile: "bg-slate-100 text-slate-600", label: "Update" };

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(d);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" }).format(d);
}

function time(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const orderRef = (s: string) => s.match(/SB-[A-Z0-9-]+/)?.[0];

export function NotificationList({ initial }: { initial: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unread = items.filter((i) => !i.readAt).length;

  const visible = filter === "unread" ? items.filter((i) => !i.readAt) : items;
  const groups = useMemo(() => {
    const map = new Map<string, NotificationItem[]>();
    for (const n of visible) {
      const k = dayLabel(n.createdAt);
      map.set(k, [...(map.get(k) ?? []), n]);
    }
    return Array.from(map.entries());
  }, [visible]);

  async function markRead(id?: string) {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : {}) });
    const now = new Date().toISOString();
    setItems((xs) => xs.map((x) => (!x.readAt && (!id || x.id === id) ? { ...x, readAt: now } : x)));
    window.dispatchEvent(new Event("notifications:changed"));
  }

  async function open(n: NotificationItem) {
    if (!n.readAt) await markRead(n.id);
    if (n.href) router.push(n.href);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-white p-1 text-sm ring-1 ring-slate-200">
          {(["all", "unread"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 font-medium transition ${filter === f ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
              {f === "all" ? "All" : "Unread"}
              <span className={`ml-1.5 text-xs ${filter === f ? "text-accent-400" : "text-slate-400"}`}>{f === "all" ? items.length : unread}</span>
            </button>
          ))}
        </div>
        {unread > 0 && (
          <button type="button" onClick={() => markRead()} className="btn-outline !py-1.5 !text-xs">
            Mark all as read
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted">
            <InboxIcon width={28} height={28} />
          </span>
          <p className="mt-4 font-semibold">{filter === "unread" ? "You are all caught up" : "Nothing here yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted">{filter === "unread" ? "New activity on your orders will show up here." : "Updates about payments, drafts, reviews and messages will appear here and in your email."}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{day}</h2>
              <ul className="space-y-2">
                {list.map((n) => {
                  const s = TYPE_STYLE[n.type] ?? FALLBACK;
                  const ref = orderRef(n.title) ?? orderRef(n.body);
                  const isUnread = !n.readAt;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => open(n)}
                        className={`card flex w-full items-start gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${isUnread ? "border-l-4 border-l-accent-500" : ""}`}
                      >
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${s.tile}`}>
                          <s.Icon width={22} height={22} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isUnread ? "text-accent-600" : "text-muted"}`}>{s.label}</span>
                            {ref && <span className="chip bg-surface text-muted">{ref}</span>}
                            <span className="ml-auto text-xs text-muted">{time(n.createdAt)}</span>
                          </span>
                          <span className={`mt-1 block ${isUnread ? "font-semibold" : "font-medium"}`}>{n.title}</span>
                          <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                        </span>
                        {isUnread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-500" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
