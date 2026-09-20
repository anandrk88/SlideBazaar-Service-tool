import Image from "next/image";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { CheckIcon, LockIcon, PencilIcon, ShieldCheckIcon, TasksIcon, UploadIcon } from "@/components/Icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type Step = {
  number: number;
  title: string;
  body: string;
  note: string;
  Icon: IconComponent;
};

const STEPS: Step[] = [
  {
    number: 1,
    title: "Tell us what you need",
    body: "Choose your design level, style direction, slide count, and delivery date in the wizard. The quote updates live as you click, so you see the total cost before you commit.",
    note: "Pick the turnaround you need. The wizard shows the exact delivery date, skipping weekends and public holidays.",
    Icon: TasksIcon,
  },
  {
    number: 2,
    title: "Send your deck and brief",
    body: "Upload your presentation file or paste a link, then add your brief in the notes. Tell us what the deck is for and specify anything you want left untouched, such as logos, exact wording, or data tables.",
    note: "PowerPoint, Google Slides, Keynote, PDF, Word and images are all accepted.",
    Icon: UploadIcon,
  },
  {
    number: 3,
    title: "Pay and we start",
    body: "You pay the estimate upfront and SlideBazaar holds it. The payment is released only when you approve the finished slides, and refunded in full if you do not.",
    note: "Design work begins as soon as the payment is confirmed.",
    Icon: LockIcon,
  },
  {
    number: 4,
    title: "We design and quality check",
    body: "A designer is assigned and works to the deadline you picked. Every draft then goes through an internal review by a quality manager before it reaches you.",
    note: "Nothing is sent to you until it has passed that check.",
    Icon: PencilIcon,
  },
  {
    number: 5,
    title: "Review and approve",
    body: "You see watermarked previews of the slides. If something is not right, request changes from your order page and tell us what to fix.",
    note: "Approving unlocks the original PowerPoint file and the full quality slide images for download.",
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

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 text-2xl font-bold">Five steps from your deck to finished slides</h2>
        <p className="mt-2 max-w-2xl text-muted">The whole order runs in one place. You see the price before you pay, the progress while we work, and the finished slides before payment is released.</p>

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-16">
          {/* The five steps */}
          <ol className="relative ml-4 space-y-8 border-l border-slate-200 pl-8">
            {STEPS.map(({ number, title, body, note, Icon }) => (
              <li key={number} className="relative">
                <span className="absolute -left-12 top-0 grid h-8 w-8 place-items-center rounded-full bg-accent-500 text-sm font-bold text-white ring-4 ring-white" aria-hidden="true">
                  {number}
                </span>
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <Icon width={20} height={20} className="shrink-0 text-brand-500" aria-hidden="true" />
                  <span>
                    <span className="sr-only">Step {number}. </span>
                    {title}
                  </span>
                </h3>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
                <p className="mt-1.5 text-sm text-ink/70">{note}</p>
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
              An illustration of the order page. The status runs from Paid to Designing to Your review to Approved. Previews stay watermarked until you approve, and the original files unlock after that.
            </figcaption>
          </figure>
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href="/order" className="btn-accent shrink-0 !px-7 !py-3 !text-base">
            Start your order
          </Link>
          <p className="text-sm text-muted sm:ml-2">No account is needed to get started, and nothing is charged until you confirm.</p>
        </div>
      </div>
    </section>
  );
}
