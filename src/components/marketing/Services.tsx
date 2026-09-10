import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { BroomIcon, BulbIcon, ChevronDownIcon, GridIcon, PaletteIcon, PencilIcon, UsersIcon } from "@/components/Icons";
import type { Content } from "@/lib/content";

type ServiceCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  tint: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const SUPPORT_EMAIL = "support@slidebazaar.com";
const BIG_JOB_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=Large%20deck%20or%20rebrand%20enquiry`;
const OTHER_WORK_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=Custom%20slide%20design%20request`;

function services(t: Content): ServiceCard[] {
  return [
    {
      id: "presentation-design",
      title: t("services.card1.title"),
      description: t("services.card1.description"),
      href: "/order",
      cta: t("services.card1.cta"),
      tint: "bg-amber-100 text-amber-700",
      Icon: PaletteIcon,
    },
    {
      id: "clean-up",
      title: t("services.card2.title"),
      description: t("services.card2.description"),
      href: "/order",
      cta: t("services.card2.cta"),
      tint: "bg-sky-100 text-sky-700",
      Icon: BroomIcon,
    },
    {
      id: "from-scratch",
      title: t("services.card3.title"),
      description: t("services.card3.description"),
      href: "/order",
      cta: t("services.card3.cta"),
      tint: "bg-violet-100 text-violet-700",
      Icon: PencilIcon,
    },
    {
      id: "your-template",
      title: t("services.card4.title"),
      description: t("services.card4.description"),
      href: "/order",
      cta: t("services.card4.cta"),
      tint: "bg-rose-100 text-rose-700",
      Icon: GridIcon,
    },
    {
      id: "large-decks",
      title: t("services.card5.title"),
      description: t("services.card5.description"),
      href: BIG_JOB_MAILTO,
      cta: t("services.card5.cta"),
      tint: "bg-emerald-100 text-emerald-700",
      Icon: UsersIcon,
    },
    {
      id: "something-else",
      title: t("services.card6.title"),
      description: t("services.card6.description"),
      href: OTHER_WORK_MAILTO,
      cta: t("services.card6.cta"),
      tint: "bg-slate-200 text-slate-700",
      Icon: BulbIcon,
    },
  ];
}

function isExternal(href: string): boolean {
  return href.startsWith("mailto:");
}

export function Services({ t }: { t: Content }) {
  return (
    <section id="services" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <p className="eyebrow">{t("services.eyebrow")}</p>
      <h2 className="mt-2 text-2xl font-bold">{t("services.title")}</h2>
      <p className="mt-2 max-w-2xl text-muted">
        {t("services.intro")}
      </p>

      <ul className="mt-8 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {services(t).map(({ id, title, description, href, cta, tint, Icon }) => {
          const label = `${title}: ${cta.toLowerCase()}`;
          const linkClass = "after:absolute after:inset-0 after:rounded-2xl focus:outline-none";
          return (
            <li key={id} className="relative flex">
              <div className="card flex w-full flex-col p-6 transition focus-within:ring-2 focus-within:ring-accent-500 hover:-translate-y-0.5 hover:shadow-md">
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${tint}`} aria-hidden="true">
                  <Icon width={28} height={28} />
                </span>
                <h3 className="mt-4 text-lg font-bold">
                  {isExternal(href) ? (
                    <a href={href} aria-label={label} className={linkClass}>
                      {title}
                    </a>
                  ) : (
                    <Link href={href} aria-label={label} className={linkClass}>
                      {title}
                    </Link>
                  )}
                </h3>
                <p className="mt-2 flex-1 text-sm text-muted">{description}</p>
                <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-700">
                  {cta}
                  <ChevronDownIcon width={16} height={16} className="-rotate-90" aria-hidden="true" />
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 max-w-3xl text-sm text-muted">
        {t("services.closing.beforeEmail")}{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">{SUPPORT_EMAIL}</a>{" "}
        {t("services.closing.afterEmail")}{" "}
        <Link href="/order" className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
          {t("services.closing.orderLink")}
        </Link>
        {t("services.closing.afterOrderLink")}
      </p>
    </section>
  );
}
