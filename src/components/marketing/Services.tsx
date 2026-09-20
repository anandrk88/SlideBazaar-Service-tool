import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { BroomIcon, BulbIcon, ChevronDownIcon, GridIcon, PaletteIcon, PencilIcon, UsersIcon } from "@/components/Icons";

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

const SERVICES: ServiceCard[] = [
  {
    id: "presentation-design",
    title: "Presentation design",
    description: "Our core service. Send us the deck you have, choose how much you want changed, and a designer works through it slide by slide.",
    href: "/order",
    cta: "Start an order",
    tint: "bg-amber-100 text-amber-700",
    Icon: PaletteIcon,
  },
  {
    id: "clean-up",
    title: "Deck clean-up and brand alignment",
    description: "We make an existing deck consistent: fonts, colours, spacing and alignment on every slide. Useful when the content is right but the deck looks like several people built it.",
    href: "/order",
    cta: "Start an order",
    tint: "bg-sky-100 text-sky-700",
    Icon: BroomIcon,
  },
  {
    id: "from-scratch",
    title: "Build from scratch",
    description: "Send notes, a sketch, a Word document or a PDF and we turn it into a finished deck. Tell us the story you want to tell and we lay it out.",
    href: "/order",
    cta: "Start an order",
    tint: "bg-violet-100 text-violet-700",
    Icon: PencilIcon,
  },
  {
    id: "your-template",
    title: "Work in your template",
    description: "Upload your own brand template and we design inside it, using your layouts, fonts and colours. If you do not have one, we can follow a deck that already matches your brand.",
    href: "/order",
    cta: "Start an order",
    tint: "bg-rose-100 text-rose-700",
    Icon: GridIcon,
  },
  {
    id: "large-decks",
    title: "Large decks and rebrands",
    description: "Hundreds of slides, or several decks at once. Tell us the scope and our team will plan the work and agree on a schedule with you first.",
    href: BIG_JOB_MAILTO,
    cta: "Email the team",
    tint: "bg-emerald-100 text-emerald-700",
    Icon: UsersIcon,
  },
  {
    id: "something-else",
    title: "Something else",
    description: "Infographics, icon sets, chart makeovers and master templates for your team. Describe what you need and we’ll give you a quote.",
    href: OTHER_WORK_MAILTO,
    cta: "Email the team",
    tint: "bg-slate-200 text-slate-700",
    Icon: BulbIcon,
  },
];

function isExternal(href: string): boolean {
  return href.startsWith("mailto:");
}

export function Services() {
  return (
    <section id="services" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <p className="eyebrow">What we do</p>
      <h2 className="mt-2 text-2xl font-bold">Six ways we can help with a deck</h2>
      <p className="mt-2 max-w-2xl text-muted">
        Every slide is designed by a person and checked by our quality manager before you see it. You review watermarked previews, and get the final files once you approve.
      </p>

      <ul className="mt-8 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map(({ id, title, description, href, cta, tint, Icon }) => {
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
        Anything not listed here can be quoted on request. Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">{SUPPORT_EMAIL}</a> and tell us what you have in
        mind. Rates for the standard treatments appear as you build an{" "}
        <Link href="/order" className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
          order
        </Link>
        . SlideBazaar has been making presentation templates for over ten years, with a library of more than 50,000 templates.
      </p>
    </section>
  );
}

