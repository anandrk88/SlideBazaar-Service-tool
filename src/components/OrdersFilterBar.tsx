"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/Icons";

export interface FilterState {
  q: string;
  stage: string;
  status: string;
  designer: string;
  scope: string;
  sort: string;
}

export const STAGES = [
  { id: "active", label: "Active" },
  { id: "attention", label: "Needs attention" },
  { id: "done", label: "Completed" },
  { id: "all", label: "All" },
];

export function OrdersFilterBar({
  current,
  stageCounts,
  statuses,
  designers,
  total,
  showScope,
}: {
  current: FilterState;
  stageCounts: Record<string, number>;
  statuses: { id: string; label: string; count: number }[];
  designers: { id: string; name: string }[];
  total: number;
  showScope: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(current.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(patch: Partial<FilterState>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "all" && !(k === "scope" && v === "everyone") && !(k === "sort" && v === "deadline")) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    router.push(`${pathname}${s ? `?${s}` : ""}`);
  }

  useEffect(() => {
    if (q === current.q) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ q }), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = current.q || current.status || current.designer || current.scope === "mine" || (current.stage && current.stage !== "active");

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Stage tabs */}
        <div className="inline-flex rounded-full bg-surface p-1 text-sm">
          {STAGES.map((s) => {
            const active = (current.stage || "active") === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => apply({ stage: s.id, status: "" })}
                className={`rounded-full px-3.5 py-1.5 font-medium transition ${active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {s.label}
                <span className={`ml-1.5 text-xs ${active ? "text-accent-600" : "text-slate-400"}`}>{stageCounts[s.id] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <label className="relative min-w-[220px] flex-1">
          <SearchIcon width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order number or customer" className="input !pl-9" />
        </label>

        {showScope && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={current.scope === "mine"} onChange={(e) => apply({ scope: e.target.checked ? "mine" : "everyone" })} className="accent-accent-500" />
            Assigned to me
          </label>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <select value={current.status} onChange={(e) => apply({ status: e.target.value, stage: e.target.value ? "all" : current.stage })} className="input !w-auto !py-2">
          <option value="">Any status</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.count})
            </option>
          ))}
        </select>
        <select value={current.designer} onChange={(e) => apply({ designer: e.target.value })} className="input !w-auto !py-2">
          <option value="">Any designer</option>
          <option value="unassigned">Unassigned</option>
          {designers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={current.sort || "deadline"} onChange={(e) => apply({ sort: e.target.value })} className="input !w-auto !py-2">
          <option value="deadline">Deadline, soonest first</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount">Amount, highest first</option>
        </select>
        <span className="ml-auto text-xs text-muted">
          {total} order{total === 1 ? "" : "s"}
          {filtered && (
            <>
              {" "}
              ·{" "}
              <button type="button" onClick={() => router.push(pathname)} className="font-semibold text-brand-600 hover:underline">
                Clear filters
              </button>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
