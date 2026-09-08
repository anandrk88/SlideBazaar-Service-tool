"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "@/components/Icons";

export interface MenuLink {
  href: string;
  label: string;
}

export function UserMenu({ name, email, roleLabel, links }: { name: string; email: string; roleLabel: string; links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm hover:bg-surface"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-bold text-white">{initials}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight">{name.split(" ")[0]}</span>
          <span className="block text-[11px] leading-tight text-muted">{roleLabel}</span>
        </span>
        <ChevronDownIcon width={16} height={16} className={`text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
            <span className="chip mt-2 bg-surface text-muted">{roleLabel}</span>
          </div>
          <ul className="py-1 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-surface">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <form action="/api/auth/logout" method="post" className="border-t border-slate-100">
            <button className="block w-full px-4 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50">Log out</button>
          </form>
        </div>
      )}
    </div>
  );
}
