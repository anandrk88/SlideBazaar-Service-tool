import Link from "next/link";
import { CheckIcon } from "@/components/Icons";
import { money } from "@/lib/format";

/**
 * Homepage hero: value proposition on the left, an angled collage of slide
 * mock-ups on the right.
 *
 * The collage is drawn entirely in markup. We deliberately use abstract
 * compositions rather than screenshots of real decks, because we have no
 * customer artwork we are allowed to publish and anything resembling a real
 * client would be misleading. It is decorative, so it is hidden from
 * assistive technology.
 */
export function Hero({ fromCents, fastestLabel }: { fromCents: number | null; fastestLabel: string | null }) {
  const points = [
    fromCents ? `Priced per slide, from ${money(fromCents)}` : "Priced per slide, no minimum order",
    fastestLabel ? `First draft ${fastestLabel.toLowerCase()}` : "First draft in a few business days",
    "Every draft checked by our quality team",
    "Approve before we are paid, or get a full refund",
  ];

  return (
    <section className="relative overflow-hidden bg-brand-900 text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 left-1/3 h-[28rem] w-[28rem] rounded-full bg-accent-500/20 blur-3xl" />

      {/* Collage occupies the right half of the viewport and bleeds off the edge.
          Positioned against the section, not the text, so it can never overlap the copy. */}
      <SlideCollage />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        {/* Copy */}
        <div className="max-w-xl lg:max-w-[34rem]">
          <p className="eyebrow !text-accent-400">Custom design services</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.1] sm:text-5xl">
            Professional presentation design,
            <span className="mt-1 block font-serif text-4xl italic text-accent-400 sm:text-5xl">without the agency wait.</span>
          </h1>
          <p className="mt-5 text-lg text-brand-100">
            Send us the deck you have, or the notes you have not turned into one yet. Our designers rebuild it, our quality team checks it, and you only pay once you are happy.
          </p>

          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-brand-50">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/20">
                  <CheckIcon width={13} height={13} strokeWidth={3} className="text-emerald-400" />
                </span>
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/order" className="btn-accent !px-8 !py-3 !text-base">
              Start your order
            </Link>
            <Link href="#how-it-works" className="btn !px-7 !py-3 !text-base border border-brand-500 text-white hover:bg-brand-800">
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-sm text-brand-300">No account needed to get a price. You can see the full estimate before you pay.</p>
        </div>
      </div>
    </section>
  );
}

/** Decorative, angled grid of abstract slide mock-ups filling the right half. */
function SlideCollage() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[52%] hidden select-none lg:block xl:left-1/2">
      <div className="absolute left-0 top-1/2 w-[58rem] -translate-y-1/2 rotate-[-11deg]">
        <div className="grid grid-cols-3 gap-4">
          <SlideCard variant="bigStat" tone="light" />
          <SlideCard variant="photo" tone="teal" />
          <SlideCard variant="title" tone="navy" />
          <SlideCard variant="bars" tone="mint" />
          <SlideCard variant="donut" tone="violet" />
          <SlideCard variant="timeline" tone="light" />
          <SlideCard variant="bullets" tone="light" />
          <SlideCard variant="quote" tone="peach" />
          <SlideCard variant="bars" tone="navy" />
        </div>
      </div>
    </div>
  );
}

type Tone = "light" | "navy" | "teal" | "mint" | "violet" | "peach";
type Variant = "bigStat" | "bars" | "donut" | "timeline" | "bullets" | "title" | "quote" | "photo";

const TONES: Record<Tone, { bg: string; fg: string; dim: string; accent: string }> = {
  light: { bg: "bg-white", fg: "bg-brand-900", dim: "bg-slate-300", accent: "bg-accent-500" },
  navy: { bg: "bg-gradient-to-br from-brand-800 to-brand-950", fg: "bg-white", dim: "bg-white/30", accent: "bg-accent-400" },
  teal: { bg: "bg-gradient-to-br from-teal-400 to-cyan-600", fg: "bg-white", dim: "bg-white/40", accent: "bg-white" },
  mint: { bg: "bg-gradient-to-br from-emerald-100 to-teal-200", fg: "bg-emerald-900", dim: "bg-emerald-700/30", accent: "bg-emerald-600" },
  violet: { bg: "bg-gradient-to-br from-violet-500 to-fuchsia-600", fg: "bg-white", dim: "bg-white/40", accent: "bg-yellow-300" },
  peach: { bg: "bg-gradient-to-br from-orange-200 to-rose-300", fg: "bg-rose-900", dim: "bg-rose-800/30", accent: "bg-rose-700" },
};

function SlideCard({ variant, tone }: { variant: Variant; tone: Tone }) {
  const t = TONES[tone];
  return (
    <div className={`aspect-video overflow-hidden rounded-lg p-4 shadow-xl shadow-brand-950/40 ring-1 ring-white/10 ${t.bg}`}>
      <SlideBody variant={variant} t={t} />
    </div>
  );
}

function SlideBody({ variant, t }: { variant: Variant; t: (typeof TONES)[Tone] }) {
  const line = (w: string, cls = t.dim) => <span className={`block h-1.5 rounded-full ${cls} ${w}`} />;

  switch (variant) {
    case "title":
      return (
        <div className="flex h-full flex-col justify-center gap-2">
          <span className={`block h-1 w-8 rounded-full ${t.accent}`} />
          <span className={`block h-3 w-4/5 rounded ${t.fg}`} />
          <span className={`block h-3 w-3/5 rounded ${t.fg}`} />
          {line("w-2/5")}
        </div>
      );
    case "bigStat":
      return (
        <div className="flex h-full flex-col justify-center">
          <span className={`block h-6 w-3/5 rounded ${t.fg}`} />
          <span className="mt-2 block space-y-1.5">
            {line("w-full")}
            {line("w-4/5")}
          </span>
          <span className={`mt-3 block h-1 w-10 rounded-full ${t.accent}`} />
        </div>
      );
    case "bars":
      return (
        <div className="flex h-full flex-col">
          {line("w-1/2", t.fg)}
          <div className="mt-auto flex h-2/3 items-end gap-1.5">
            {[40, 62, 48, 82, 70, 96].map((h, i) => (
              <span key={i} className={`flex-1 rounded-sm ${i === 3 ? t.accent : t.dim}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      );
    case "donut":
      return (
        <div className="flex h-full items-center gap-3">
          <svg viewBox="0 0 36 36" className="h-4/5 w-auto shrink-0">
            <circle cx="18" cy="18" r="14" fill="none" strokeWidth="6" className="stroke-white/30" />
            <circle cx="18" cy="18" r="14" fill="none" strokeWidth="6" strokeDasharray="62 88" strokeLinecap="round" transform="rotate(-90 18 18)" className="stroke-yellow-300" />
          </svg>
          <span className="flex-1 space-y-1.5">
            {line("w-full", t.fg)}
            {line("w-4/5")}
            {line("w-3/5")}
          </span>
        </div>
      );
    case "timeline":
      return (
        <div className="flex h-full flex-col justify-center">
          {line("w-2/5", t.fg)}
          <div className="mt-4 flex items-center">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="flex flex-1 items-center">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${i === 1 ? t.accent : t.dim}`} />
                {i < 3 && <span className={`h-0.5 flex-1 ${t.dim}`} />}
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${t.dim}`} />
            ))}
          </div>
        </div>
      );
    case "bullets":
      return (
        <div className="flex h-full flex-col">
          {line("w-1/2", t.fg)}
          <div className="mt-3 flex flex-1 gap-3">
            <div className="flex-1 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.accent}`} />
                  <span className={`h-1.5 flex-1 rounded-full ${t.dim}`} />
                </span>
              ))}
            </div>
            <span className={`w-1/3 rounded ${t.dim}`} />
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="flex h-full flex-col justify-center gap-2">
          <span className={`block h-4 w-4 rounded-sm ${t.accent}`} />
          {line("w-full", t.fg)}
          {line("w-5/6", t.fg)}
          {line("w-1/3")}
        </div>
      );
    case "photo":
      return (
        <div className="flex h-full flex-col justify-end">
          <span className={`block h-3 w-3/4 rounded ${t.fg}`} />
          <span className="mt-2 block space-y-1.5">
            {line("w-full")}
            {line("w-2/3")}
          </span>
        </div>
      );
  }
}
