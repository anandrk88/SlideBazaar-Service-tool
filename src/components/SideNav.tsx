"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarIcon, GridIcon, ListIcon, LockIcon, PencilIcon, ShieldCheckIcon, TagIcon, TasksIcon, UsersIcon } from "@/components/Icons";

export type SideNavIcon = "grid" | "list" | "tasks" | "shield" | "lock" | "users" | "calendar" | "tag" | "pencil";

export interface SideNavItem {
  href: string;
  label: string;
  icon: SideNavIcon;
  exact?: boolean;
  /** Small counter shown on the right, for example drafts waiting for QC. */
  badge?: number;
}

const ICONS: Record<SideNavIcon, (p: { width: number; height: number; className?: string }) => React.ReactElement> = {
  grid: GridIcon,
  list: ListIcon,
  tasks: TasksIcon,
  shield: ShieldCheckIcon,
  lock: LockIcon,
  users: UsersIcon,
  calendar: CalendarIcon,
  tag: TagIcon,
  pencil: PencilIcon,
};

export function SideNav({ items, title, subtitle }: { items: SideNavItem[]; title: string; subtitle: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  /** Items may carry a query string (e.g. a saved filter); those win over the plain path item. */
  const queryMatches = (query: string) => Array.from(new URLSearchParams(query).entries()).every(([k, v]) => search.get(k) === v);
  const isActive = (item: SideNavItem) => {
    const [path, query] = item.href.split("?");
    const pathMatch = item.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
    if (!pathMatch) return false;
    if (query) return queryMatches(query);
    // Plain path item: not active when a sibling with a query matches the current URL.
    return !items.some((o) => o !== item && o.href.startsWith(`${path}?`) && queryMatches(o.href.split("?")[1]));
  };
  return (
    <aside className="lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-60 lg:shrink-0 lg:border-r lg:border-slate-200 lg:bg-white">
      <div className="hidden px-5 pb-3 pt-6 lg:block">
        <p className="eyebrow">{title}</p>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:flex-col lg:overflow-visible lg:border-0 lg:px-3 lg:py-0">
        {items.map((item) => {
          const active = isActive(item);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-ink text-white" : "text-ink/80 hover:bg-surface hover:text-ink"
              }`}
            >
              <Icon width={18} height={18} className={active ? "text-accent-400" : "text-muted"} />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.badge ? (
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-accent-500 text-white" : "bg-accent-100 text-accent-700"}`}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
