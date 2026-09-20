import Image from "next/image";
import type { ReactNode } from "react";
import { LockIcon, ShieldCheckIcon } from "@/components/Icons";

/**
 * Real screenshots for the before and after slides.
 *
 * Drop image files into public/marketing/ and name them here, for example
 * "/marketing/before.png". Leave a src null and the drawn mock-up is used
 * instead, so the page renders correctly with none, one or both in place.
 * Landscape images work best; anything else is cropped to 16:9.
 *
 * Edit the caption alongside the src. The captions below describe the drawn
 * mock-ups, so they will be wrong once a real image takes their place.
 */
const PAIR: { before: { src: string | null; caption: string }; after: { src: string | null; caption: string } } = {
  before: { src: null, caption: "A wall of body text with two placeholder boxes doing the work of a diagram." },
  after: { src: null, caption: "One idea per slide, with a data graphic that carries the point." },
};

/* ------------------------------------------------------------------ */
/* Slide mock-ups.                                                     */
/* This is an abstract illustration drawn in SVG for this page only.   */
/* No customer artwork, no real company names, no image files.         */
/* ------------------------------------------------------------------ */

const SLIDE = "h-auto w-full";
const VIEW_BOX = "0 0 320 180";

function Before() {
  const lines = [
    { y: 34, w: 284 },
    { y: 44, w: 276 },
    { y: 54, w: 282 },
    { y: 64, w: 268 },
    { y: 74, w: 284 },
    { y: 84, w: 272 },
    { y: 94, w: 258 },
    { y: 104, w: 280 },
    { y: 114, w: 214 },
  ];
  return (
    <svg viewBox={VIEW_BOX} className={SLIDE} role="img" aria-label="Abstract mock-up of a slide carrying a wall of body text and two misaligned placeholder boxes">
      <rect width="320" height="180" fill="#ffffff" />
      <rect x="18" y="12" width="190" height="9" fill="#94a3b8" />
      {lines.map((l) => (
        <rect key={l.y} x="18" y={l.y} width={l.w} height="4" fill="#e2e8f0" />
      ))}
      <rect x="18" y="132" width="128" height="34" fill="#f1f5f9" stroke="#cbd5e1" strokeDasharray="4 3" />
      <rect x="164" y="126" width="138" height="40" fill="#f1f5f9" stroke="#cbd5e1" strokeDasharray="4 3" />
      <path d="M60 149h44M212 146h42" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function After() {
  const legend = [
    { y: 84, dot: "#ff6a3d", w: 84, sub: 56 },
    { y: 106, dot: "#5f7ad8", w: 74, sub: 64 },
    { y: 128, dot: "#b9c6f4", w: 92, sub: 48 },
  ];
  return (
    <svg viewBox={VIEW_BOX} className={SLIDE} role="img" aria-label="Abstract mock-up of the same slide rebuilt on a navy ground: one headline, three labelled points and a ring chart">
      <rect width="320" height="180" fill="#16244f" />
      <rect x="24" y="26" width="34" height="4" rx="2" fill="#ff6a3d" />
      <rect x="24" y="38" width="118" height="11" rx="2" fill="#ffffff" />
      <rect x="24" y="56" width="88" height="6" rx="3" fill="#8ea2e8" />
      {legend.map((l) => (
        <g key={l.y}>
          <circle cx="28" cy={l.y + 2} r="4" fill={l.dot} />
          <rect x="40" y={l.y - 3} width={l.w} height="5" rx="2.5" fill="#dde4fb" />
          <rect x="40" y={l.y + 5} width={l.sub} height="4" rx="2" fill="#3d5bc7" />
        </g>
      ))}
      <g fill="none" strokeWidth="18" transform="rotate(-90 238 92)">
        <circle cx="238" cy="92" r="38" stroke="#1b2c66" />
        <circle cx="238" cy="92" r="38" stroke="#ff6a3d" pathLength={100} strokeDasharray="55 45" />
        <circle cx="238" cy="92" r="38" stroke="#5f7ad8" pathLength={100} strokeDasharray="27 73" strokeDashoffset={-55} />
        <circle cx="238" cy="92" r="38" stroke="#b9c6f4" pathLength={100} strokeDasharray="18 82" strokeDashoffset={-82} />
      </g>
      <rect x="222" y="88" width="32" height="8" rx="4" fill="#ffffff" />
    </svg>
  );
}

function SlideFrame({ src, alt, children }: { src: string | null; alt: string; children: ReactNode }) {
  if (src) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Image src={src} alt={alt} fill sizes="(min-width: 640px) 45vw, 90vw" className="object-cover" />
      </div>
    );
  }
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{children}</div>;
}

export function BeforeAfter() {
  return (
    <section id="before-after" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Before and after</p>
      <h2 className="mt-2 text-2xl font-bold">The same slide, rebuilt</h2>
      <p className="mt-2 max-w-2xl text-muted">
        We redesign the layout, not your message. Your words and data stay intact, and we don&rsquo;t touch anything you tell us to leave alone.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <figure className="card min-w-0 p-3">
          <SlideFrame src={PAIR.before.src} alt="A slide before our designers worked on it">
            <Before />
          </SlideFrame>
          <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted">
            <span className="chip bg-slate-200 text-slate-700">Before</span>
            <span className="min-w-0">{PAIR.before.caption}</span>
          </figcaption>
        </figure>
        <figure className="card min-w-0 p-3">
          <SlideFrame src={PAIR.after.src} alt="The same slide after our designers rebuilt it">
            <After />
          </SlideFrame>
          <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted">
            <span className="chip bg-accent-50 text-accent-700">After</span>
            <span className="min-w-0">{PAIR.after.caption}</span>
          </figcaption>
        </figure>
      </div>

      {/* Reassurance */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <p className="flex items-start gap-3 text-sm text-muted">
          <ShieldCheckIcon width={22} height={22} className="mt-0.5 shrink-0 text-accent-500" aria-hidden="true" />
          <span>A quality check happens inside SlideBazaar before any draft reaches you, and you can request changes from your order page.</span>
        </p>
        <p className="flex items-start gap-3 text-sm text-muted">
          <LockIcon width={22} height={22} className="mt-0.5 shrink-0 text-accent-500" aria-hidden="true" />
          <span>Previews are watermarked until you approve. Payment is held securely and only released upon your approval, with a full refund if you do not.</span>
        </p>
      </div>
    </section>
  );
}
