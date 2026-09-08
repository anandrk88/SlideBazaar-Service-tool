"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellIcon } from "@/components/Icons";

interface Item {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 45_000;

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setUnread(json.unread);
      setItems(json.items);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("notifications:changed", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("notifications:changed", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAll() {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }

  async function openItem(item: Item) {
    if (!item.readAt) {
      await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      setUnread((n) => Math.max(0, n - 1));
      setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative grid h-10 w-10 place-items-center rounded-full text-ink/80 hover:bg-surface hover:text-ink"
      >
        <BellIcon width={20} height={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-accent-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs font-semibold text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">You are all caught up.</li>}
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => openItem(item)} className={`block w-full px-4 py-3 text-left hover:bg-surface ${item.readAt ? "" : "bg-accent-50/60"}`}>
                  <div className="flex items-start gap-2">
                    {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-500" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{ago(item.createdAt)}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-brand-600 hover:bg-surface">
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
