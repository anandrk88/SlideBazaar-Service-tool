import Image from "next/image";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { CheckIcon, LockIcon, PencilIcon, ShieldCheckIcon, TasksIcon, UploadIcon } from "@/components/Icons";
import type { Content } from "@/lib/content";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type Step = {
  number: number;
  titleKey: string;
  bodyKey: string;
  noteKey: string;
  Icon: IconComponent;
};

const STEPS: Step[] = [
  {
    number: 1,
    titleKey: "howitworks.step1.title",
    bodyKey: "howitworks.step1.body",
    noteKey: "howitworks.step1.note",
    Icon: TasksIcon,
  },
  {
    number: 2,
    titleKey: "howitworks.step2.title",
    bodyKey: "howitworks.step2.body",
    noteKey: "howitworks.step2.note",
    Icon: UploadIcon,
  },
  {
    number: 3,
    titleKey: "howitworks.step3.title",
    bodyKey: "howitworks.step3.body",
    noteKey: "howitworks.step3.note",
    Icon: LockIcon,
  },
  {
    number: 4,
    titleKey: "howitworks.step4.title",
    bodyKey: "howitworks.step4.body",
    noteKey: "howitworks.step4.note",
    Icon: PencilIcon,
  },
  {
    number: 5,
    titleKey: "howitworks.step5.title",
    bodyKey: "howitworks.step5.body",
    noteKey: "howitworks.step5.note",
    Icon: ShieldCheckIcon,
  },
];

type StageStatus = "done" | "active" | "todo";

const STAGES: { label: string; status: StageStatus }[] = [
  { label: "Paid", status: "done" },
  { label: "Designing", status: "active" },
  { label: "Your review", status: "todo" },
  { label: "Approved", status: "todo" },
];

const DOT_STYLE: Record<StageStatus, string> = {
  done: "bg-accent-500",
  active: "bg-accent-500 ring-4 ring-accent-100",
  todo: "border border-slate-300 bg-white",
};

const LABEL_STYLE: Record<StageStatus, string> = {
  done: "text-muted",
  active: "font-semibold text-ink",
  todo: "text-muted",
};

/**
 * Real screenshots for the two draft previews in the illustration.
 *
 * Drop image files into public/marketing/ and name them here, for example
 * "/marketing/draft-1.png". Leave an entry null and the drawn placeholder is
 * used instead, so the page renders correctly with none, one or both in place.
 * Landscape images work best; anything else is cropped to 16:9.
 */
const DRAFT_PREVIEWS: { src: string | null; chart: boolean }[] = [
  { src: null, chart: false },
  { src: null, chart: true },
];

function PreviewThumb({ src, chart = false }: { src?: string | null; chart?: boolean }) {
  if (src) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Image src={src} alt="" fill sizes="(min-width: 1024px) 220px, 45vw" className="object-cover" />
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="-rotate-[18deg] text-[11px] font-bold uppercase tracking-[0.28em] text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.55)]">Preview</span>
        </span>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="h-1.5 w-2/3 rounded-full bg-slate-300" />
      <div className="mt-1.5 h-1 w-1/2 rounded-full bg-slate-200" />
      {chart ? (
        <div className="mt-3 flex h-9 items-end gap-1.5">
          <div className="h-1/2 w-full rounded-sm bg-brand-100" />
          <div className="h-full w-full rounded-sm bg-brand-200" />
          <div className="h-2/3 w-full rounded-sm bg-accent-200" />
          <div className="h-1/3 w-full rounded-sm bg-slate-200" />
        </div>
      ) : (
        <div className="mt-3 grid h-9 grid-cols-[1fr_1.2fr] gap-2">
          <div className="rounded-sm bg-slate-100" />
          <div className="space-y-1.5 pt-0.5">
            <div className="h-1 w-full rounded-full bg-slate-200" />
            <div className="h-1 w-5/6 rounded-full bg-slate-200" />
            <div className="h-1 w-2/3 rounded-full bg-slate-200" />
          </div>
        </div>
      )}
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <span className="-rotate-[18deg] text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Preview</span>
      </span>
    </div>
  );
}

export function HowItWorks({ t }: { t: Content }) {
  return (
    <section id="how-it-works" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="eyebrow">{t("howitworks.eyebrow")}</p>
        <h2 className="mt-2 text-2xl font-bold">{t("howitworks.title")}</h2>
        <p className="mt-2 max-w-2xl text-muted">{t("howitworks.intro")}</p>

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-16">
          {/* The five steps */}
          <ol className="relative ml-4 space-y-8 border-l border-slate-200 pl-8">
            {STEPS.map(({ number, titleKey, bodyKey, noteKey, Icon }) => (
              <li key={number} className="relative">
                <span className="absolute -left-12 top-0 grid h-8 w-8 place-items-center rounded-full bg-accent-500 text-sm font-bold text-white ring-4 ring-white" aria-hidden="true">
                  {number}
                </span>
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <Icon width={20} height={20} className="shrink-0 text-brand-500" aria-hidden="true" />
                  <span>
                    <span className="sr-only">Step {number}. </span>
                    {t(titleKey)}
                  </span>
                </h3>
                <p className="mt-1.5 text-sm text-muted">{t(bodyKey)}</p>
                <p className="mt-1.5 text-sm text-ink/70">{t(noteKey)}</p>
              </li>
            ))}
          </ol>

          {/* Supporting visual */}
          <figure className="m-0 lg:sticky lg:top-24">
            <div className="card p-5 sm:p-6" aria-hidden="true">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <LockIcon width={20} height={20} />
                  </span>
                  <div>
                    <p className="text-sm font-bold leading-tight">Your order</p>
                    <p className="text-xs text-muted">Payment held by SlideBazaar</p>
                  </div>
                </div>
                <span className="chip shrink-0 bg-accent-50 text-accent-700">In progress</span>
              </div>

              <ol className="mt-6 grid grid-cols-4">
                {STAGES.map((stage, i) => (
                  <li key={stage.label} className="relative flex flex-col items-center">
                    {i > 0 && <span className={`absolute -left-1/2 top-1.5 h-0.5 w-full ${stage.status === "todo" ? "bg-slate-200" : "bg-accent-500"}`} />}
                    <span className={`relative h-3.5 w-3.5 rounded-full ${DOT_STYLE[stage.status]}`} />
                    <span className={`mt-2.5 px-1 text-center text-[11px] leading-tight ${LABEL_STYLE[stage.status]}`}>{stage.label}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 rounded-xl bg-surface p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Draft previews</p>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  {DRAFT_PREVIEWS.map((p, i) => (
                    <PreviewThumb key={i} src={p.src} chart={p.chart} />
                  ))}
                </div>
                <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-muted">
                  <LockIcon width={13} height={13} className="mt-px shrink-0" />
                  Watermarked until you approve
                </p>
              </div>

              <p className="mt-4 flex items-start gap-2 text-xs text-ink/80">
                <CheckIcon width={15} height={15} className="mt-px shrink-0 text-accent-500" />
                Approve to release the payment and download the original file.
              </p>
            </div>
            <figcaption className="mt-3 text-xs text-muted">
              {t("howitworks.figureCaption")}
            </figcaption>
          </figure>
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href="/order" className="btn-accent shrink-0 !px-7 !py-3 !text-base">
            {t("howitworks.cta")}
          </Link>
          <p className="text-sm text-muted sm:ml-2">{t("howitworks.ctaNote")}</p>
        </div>
      </div>
    </section>
  );
}
