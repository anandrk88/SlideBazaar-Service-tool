import Link from "next/link";
import Image from "next/image";
import type { SessionUser } from "@/lib/auth";
import { ROLE_LABELS, isStaff } from "@/lib/auth";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <Image src="/slidebazaar-logo.svg" alt="SlideBazaar" width={152} height={32} priority className="h-8 w-auto" />
      <span className="hidden border-l border-slate-200 pl-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted sm:inline">
        Design Services
      </span>
    </Link>
  );
}

/** Top navigation. Visitors get marketing links; customers their two pages; staff use the sidebar. */
function navFor(user: SessionUser | null): NavItem[] {
  if (!user) {
    return [
      { href: "/#services", label: "Services" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#faq", label: "FAQ" },
    ];
  }
  if (!isStaff(user)) {
    return [
      { href: "/dashboard", label: "My orders" },
      { href: "/order", label: "New order" },
    ];
  }
  return [];
}

export function Header({ user }: { user: SessionUser | null }) {
  const items = navFor(user);
  const staff = isStaff(user);
  const homeHref = !user ? "/" : staff ? "/admin" : "/dashboard";
  const container = staff ? "w-full px-5" : "mx-auto max-w-7xl px-4 sm:px-6";
  const menuLinks = user
    ? staff
      ? [
          { href: "/admin", label: "Workspace" },
          { href: "/account", label: "Account settings" },
          { href: "/notifications", label: "Notifications" },
        ]
      : [
          { href: "/dashboard", label: "My orders" },
          { href: "/order", label: "New order" },
          { href: "/account", label: "Account, billing & cards" },
          { href: "/notifications", label: "Notifications" },
        ]
    : [];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className={`flex h-16 items-center justify-between gap-6 ${container}`}>
        <div className="flex min-w-0 items-center gap-8">
          <Logo href={homeHref} />
          {items.length > 0 && <NavLinks items={items} className="hidden md:flex" />}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {user ? (
            <>
              <NotificationBell />
              <UserMenu name={user.name} email={user.email} roleLabel={ROLE_LABELS[user.role]} links={menuLinks} />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-surface hover:text-ink">
                Log in
              </Link>
              <Link href="/order" className="btn-accent !py-2">
                Order now
              </Link>
            </>
          )}
        </div>
      </div>
      {items.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          <NavLinks items={items} className="flex-wrap" />
        </div>
      )}
    </header>
  );
}
