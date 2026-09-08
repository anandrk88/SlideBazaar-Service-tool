"use client";

import { usePathname } from "next/navigation";

const BARE_ROUTES = ["/login", "/signup"];

/** Hides the site header and footer on full-screen pages such as login and signup. */
export function SiteChrome({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (bare) return <main className="min-h-screen">{children}</main>;
  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </>
  );
}
