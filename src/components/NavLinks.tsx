"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  /** Match only the exact path (for section roots like /admin). */
  exact?: boolean;
}

export function NavLinks({ items, className = "" }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={`flex items-center gap-1 ${className}`}>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-ink text-white" : "text-ink/80 hover:bg-surface hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
