"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  DEFAULT_CATALOG,
  MAX_SLIDES,
  MIN_SLIDES,
  NO_TEXT_SERVICE_ID,
  activeCatalog,
  type Catalog,
  type GrammarId,
} from "@/lib/catalog";
import { clampSlides, deliveryDate, productionDays, quote, tierRanges } from "@/lib/pricing";
import { DEFAULT_CALENDAR, upcomingHolidays, type BusinessCalendar } from "@/lib/calendar";
import { useWizardTracker } from "./useWizardTracker";
import { readPptx } from "@/lib/pptx";
import { bytes, longDate, money, moneyRange } from "@/lib/format";
import { AuthForm } from "@/components/AuthForm";
import { CheckIcon, ChevronDownIcon, LockIcon, TreatmentIcon, UploadIcon } from "@/components/Icons";

const STEPS = ["Treatment", "Style", "Delivery", "Files & details", "Payment"];
const DRAFT_KEY = "sb-order-draft-v4";

interface Draft {
  treatment: string | null;
  style: string | null;
  slideCount: number;
  deliveryTier: string;
  proofreading: string;
  grammar: GrammarId;
  useGoogleSlides: boolean;
  googleSlidesUrl: string;
  brief: string;
  audience: string;
  brandNotes: string;
  fontsColors: string;
  extraNotes: string;
  billingAddress: string;
  billingCity: string;
  billingCountry: string;
  billingVat: string;
}

const EMPTY: Draft = {
  treatment: null,
  style: null,
  slideCount: 0,
  deliveryTier: "",
  proofreading: NO_TEXT_SERVICE_ID,
  grammar: "US",
  useGoogleSlides: false,
  googleSlidesUrl: "",
  brief: "",
  audience: "",
  brandNotes: "",
  fontsColors: "",
  extraNotes: "",
  billingAddress: "",
  billingCity: "",
  billingCountry: "",
  billingVat: "",
};

const TIER_CHIPS = ["bg-rose-100 text-rose-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700"];

export function OrderWizard({
  initialUser,
  calendar = DEFAULT_CALENDAR,
  catalog = DEFAULT_CATALOG,
  consentRequired = false,
}: {
  initialUser: SessionUser | null;
  calendar?: BusinessCalendar;
  catalog?: Catalog;
  /** Decided on the server: where a cookie banner is expected, nothing is
   *  recorded until the visitor has actually opted in. */
  consentRequired?: boolean;
}) {
  const cat = useMemo(() => activeCatalog(catalog), [catalog]);
  const defaultTier = cat.tiers[cat.tiers.length - 1]?.id ?? "";

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY, deliveryTier: defaultTier });
  const [files, setFiles] = useState<File[]>([]);
  const [styleFiles, setStyleFiles] = useState<File[]>([]);
  const [detected, setDetected] = useState<{ name: string; count: number } | null>(null);
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = { ...EMPTY, deliveryTier: defaultTier, ...JSON.parse(raw) } as Draft;
        // Drop selections that are no longer offered.
        if (saved.treatment && !cat.treatments.some((t) => t.id === saved.treatment)) saved.treatment = null;
        if (saved.style && !cat.styles.some((s) => s.id === saved.style)) saved.style = null;
        if (!cat.tiers.some((t) => t.id === saved.deliveryTier)) saved.deliveryTier = defaultTier;
        if (!cat.textServices.some((t) => t.id === saved.proofreading)) saved.proofreading = NO_TEXT_SERVICE_ID;
        setDraft(saved);
      }
    } catch {}
    setHydrated(true);
  }, [cat, defaultTier]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft, hydrated]);

  const track = useWizardTracker(consentRequired);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    track.touch(key);
  };

  const estimate = useMemo(() => {
    if (!draft.treatment || !draft.deliveryTier || draft.slideCount < MIN_SLIDES) return null;
    try {
      return quote({ treatment: draft.treatment, deliveryTier: draft.deliveryTier, slideCount: draft.slideCount, proofreading: draft.proofreading }, catalog, calendar);
    } catch {
      return null;
    }
  }, [draft.treatment, draft.deliveryTier, draft.slideCount, draft.proofreading, catalog, calendar]);

  // Keeps the tracker's payload current. It never sends on its own: sending is
  // driven by touch/flush/blocked/submitted, so rendering the page without
  // touching it records nothing. The snapshot is built from named fields rather
  // than spreading the draft, so billing values and the Google Slides link
  // cannot drift into it later.
  useEffect(() => {
    if (!hydrated) return;
    track.sync({
      step,
      draft,
      files,
      styleFiles,
      detected,
      showOptional,
      signedIn: Boolean(user),
      estimateCents: estimate?.totalCents ?? null,
    });
  }, [step, draft, files, styleFiles, detected, showOptional, user, estimate, hydrated, track]);

  const holidaysAhead = useMemo(() => upcomingHolidays(calendar).slice(0, 3), [calendar]);
  const selectedTreatment = cat.treatments.find((t) => t.id === draft.treatment);
  const selectedStyle = cat.styles.find((s) => s.id === draft.style);
  const textServices = cat.textServices;
  const hasTextChoice = textServices.some((t) => t.id !== NO_TEXT_SERVICE_ID);

  async function onFiles(next: File[]) {
    setFiles(next);
    track.touch("files");
    const pptx = next.find((f) => /\.pptx$/i.test(f.name));
    if (!pptx) return setDetected(null);
    try {
      const summary = await readPptx(pptx);
      setDetected({ name: pptx.name, count: summary.slides.length });
    } catch {
      setDetected(null);
    }
  }

  function validate(s: number): string | null {
    if (s === 1 && !draft.treatment) return "Please select a treatment";
    if (s === 2) {
      if (!draft.style) return "Please choose a style";
      if (selectedStyle?.requiresUpload && styleFiles.length === 0) return "Please upload your own template";
    }
    if (s === 3) {
      if (draft.slideCount < MIN_SLIDES) return "Please tell us how many slides you need designed";
      if (!draft.deliveryTier) return "Please choose a delivery date";
    }
    if (s === 4) {
      if (!draft.useGoogleSlides && files.length === 0) return "Please upload your presentation";
      if (draft.useGoogleSlides && !/^https?:\/\//.test(draft.googleSlidesUrl)) return "Please paste your Google Slides link";
      if (draft.brief.trim().length < 10) return "Please write a short brief for our designers";
    }
    return null;
  }

  function next() {
    const err = validate(step);
    if (err) {
      track.blocked(step, err);
      return setError(err);
    }
    setError(null);
    const to = Math.min(5, step + 1);
    setStep(to);
    // The step is passed explicitly: the sync effect only refreshes the payload
    // after the re-render, so a bare flush() would report the previous step, and
    // the step change is the entire point of this.
    track.flush({ step: to });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setError(null);
    const to = Math.max(1, step - 1);
    setStep(to);
    track.flush({ step: to });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitOrder() {
    track.submitted();
    for (let s = 1; s <= 4; s++) {
      const err = validate(s);
      if (err) {
        setStep(s);
        track.blocked(s, err);
        return setError(err);
      }
    }
    if (!user) {
      track.blocked(5, "Not signed in");
      return setError("Please log in or create an account to place your order");
    }
    setSubmitting(true);
    setError(null);
    const fd = new FormData();
    const entries: Record<string, string> = {
      treatment: draft.treatment!,
      style: draft.style!,
      slideCount: String(draft.slideCount),
      deliveryTier: draft.deliveryTier,
      proofreading: draft.proofreading,
      grammar: draft.grammar,
      brief: draft.brief,
      googleSlidesUrl: draft.useGoogleSlides ? draft.googleSlidesUrl : "",
      audience: draft.audience,
      brandNotes: draft.brandNotes,
      fontsColors: draft.fontsColors,
      extraNotes: draft.extraNotes,
      billingAddress: draft.billingAddress,
      billingCity: draft.billingCity,
      billingCountry: draft.billingCountry,
      billingVat: draft.billingVat,
    };
    // Lets the server close this attempt out as converted. Null when the browser
    // refuses storage, in which case the order is simply untracked.
    if (track.attemptId) entries.attemptId = track.attemptId;
    for (const [k, v] of Object.entries(entries)) fd.append(k, v);
    files.forEach((f) => fd.append("files", f));
    styleFiles.forEach((f) => fd.append("styleFiles", f));
    try {
      const res = await fetch("/api/orders", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        // The CODE, never json.error. Two of the order endpoint's messages
        // embed the uploaded file's name, and a name like "Falcon board deck
        // v4.pptx" is a confidential project belonging to somebody who never
        // became a customer. The schema promises it is never stored.
        track.blocked(5, typeof json.code === "string" ? json.code : "ORDER_FAILED");
        setError(json.error ?? "Could not create your order");
        setSubmitting(false);
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      // The server marks this converted while handling the order. Stop tracking
      // here so the beacon fired into the checkout navigation cannot recreate a
      // row for somebody who just paid.
      track.finish();
      window.location.href = json.checkoutUrl;
    } catch {
      track.blocked(5, "Network error");
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-28">
      {/* Progress header */}
      <div className="sticky top-16 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
          <div className="hidden min-w-[140px] lg:block">
            <p className="eyebrow">New order</p>
            <p className="text-sm font-semibold">{STEPS[step - 1]}</p>
          </div>
          <ol className="flex flex-1 gap-2">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <li key={label} className="flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!done) return;
                      setStep(n);
                      track.flush({ step: n });
                    }}
                    className={`w-full text-left ${done ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className={`h-1.5 rounded-full transition ${done || active ? "bg-accent-500" : "bg-slate-200"}`} />
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                      <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${done ? "bg-accent-500 text-white" : active ? "bg-ink text-white" : "bg-slate-200 text-slate-500"}`}>
                        {done ? <CheckIcon width={10} height={10} strokeWidth={4} /> : n}
                      </span>
                      <span className={`hidden sm:inline ${active ? "font-semibold text-ink" : done ? "text-ink" : "text-slate-400"}`}>{label}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="rounded-full bg-cream px-4 py-2 text-right ring-1 ring-accent-100">
            <p className="text-lg font-bold leading-tight text-accent-600">{estimate ? moneyRange(estimate.subtotalMinCents, estimate.subtotalMaxCents) : "$0"}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">Estimate</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {error && <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        {/* ---------------- STEP 1 ---------------- */}
        {step === 1 && (
          <section>
            <StepHeading n={1} title="How much should we change?" subtitle={`Every treatment is priced per slide at standard delivery. Faster delivery is priced in step${"\u00a0"}3.`} />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cat.treatments.map((t) => (
                <button type="button" key={t.id} data-selected={draft.treatment === t.id} onClick={() => set("treatment", t.id)} className="option-card">
                  <span className={`grid h-14 w-14 place-items-center rounded-2xl ${t.tint}`}>
                    <TreatmentIcon icon={t.icon} width={30} height={30} />
                  </span>
                  <h3 className="mt-4 flex flex-wrap items-center gap-2 text-lg font-bold">
                    {t.name}
                    {t.badge && <span className="chip bg-accent-100 text-accent-700">{t.badge}</span>}
                  </h3>
                  <p className="text-sm font-medium text-ink/80">{t.tagline}</p>
                  <p className="mt-2 flex-1 text-sm text-muted">{t.description}</p>
                  <div className="mt-4 rounded-xl bg-surface px-3 py-2">
                    <span className="text-xl font-bold">{moneyRange(t.minCents, t.maxCents)}</span>
                    <span className="ml-1 text-xs text-muted">per slide</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-4 text-sm">
              <p>
                <span className="font-semibold">Something else?</span> <span className="text-muted">Infographics, icons, logos, master slides or animation are quoted on request.</span>
              </p>
              <a href="mailto:support@slidebazaar.com?subject=Custom%20design%20request" className="btn-outline !py-2">
                Ask for a quote
              </a>
            </div>
          </section>
        )}

        {/* ---------------- STEP 2 ---------------- */}
        {step === 2 && (
          <section>
            <StepHeading n={2} title="Which look should we design in?" subtitle={`Pick a direction. You can still send brand files and references in step${"\u00a0"}4.`} />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cat.styles.map((s) => (
                <div key={s.id} role="button" tabIndex={0} data-selected={draft.style === s.id} onClick={() => set("style", s.id)} onKeyDown={(e) => e.key === "Enter" && set("style", s.id)} className="option-card !p-0">
                  {s.requiresUpload ? (
                    <label onClick={(e) => e.stopPropagation()} className="m-3 grid h-28 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-accent-200 bg-accent-50 text-xs text-accent-700">
                      <span className="flex flex-col items-center gap-1 text-center">
                        <UploadIcon width={22} height={22} />
                        {styleFiles.length ? `${styleFiles.length} file(s) added` : "Upload your template"}
                      </span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept={ACCEPTED_UPLOAD_EXTENSIONS.join(",")}
                        onChange={(e) => {
                          setStyleFiles(Array.from(e.target.files ?? []));
                          track.touch("styleFiles");
                          set("style", s.id);
                        }}
                      />
                    </label>
                  ) : (
                    <div className={`relative m-3 h-28 overflow-hidden rounded-xl bg-gradient-to-br ${s.swatch} p-3`}>
                      <span className={`absolute left-3 top-3 h-1.5 w-8 rounded ${s.accent}`} />
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Strategy</p>
                        <p className="text-base font-bold text-white">Presentation</p>
                      </div>
                    </div>
                  )}
                  <div className="px-5 pb-5">
                    <h3 className="text-lg font-bold">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---------------- STEP 3 ---------------- */}
        {step === 3 && draft.treatment && (
          <section className="space-y-6">
            <StepHeading n={3} title="How many slides, and by when?" subtitle="The date is when your first draft lands. Revisions are turned around within one business day." />

            <div className="card grid gap-6 p-6 sm:p-8 lg:grid-cols-[260px_1fr]">
              <div>
                <h3 className="font-semibold">Slides to design</h3>
                <div className="mt-3 inline-flex items-center rounded-full border border-slate-300 bg-white">
                  <button type="button" className="px-4 py-2.5 text-xl text-slate-500 hover:text-ink" onClick={() => set("slideCount", Math.max(0, draft.slideCount - 1))} aria-label="Fewer slides">
                    &minus;
                  </button>
                  <input
                    type="number"
                    min={MIN_SLIDES}
                    max={MAX_SLIDES}
                    value={draft.slideCount || ""}
                    placeholder="0"
                    onChange={(e) => set("slideCount", e.target.value === "" ? 0 : clampSlides(Number(e.target.value)))}
                    className="w-20 border-x border-slate-200 py-2.5 text-center text-lg font-bold focus:outline-none"
                  />
                  <button type="button" className="px-4 py-2.5 text-xl text-slate-500 hover:text-ink" onClick={() => set("slideCount", clampSlides(draft.slideCount + 1))} aria-label="More slides">
                    +
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">Not sure? We count the slides when you upload the file in step 4.</p>
                {draft.slideCount > 40 && <p className="mt-2 text-xs text-muted">Large deck: production takes {productionDays(draft.deliveryTier, draft.slideCount, catalog)} business days at this speed.</p>}
              </div>

              <div>
                <h3 className="font-semibold">First draft by</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {tierRanges(draft.treatment, catalog).map(({ tier, min, max }, i) => {
                    const date = deliveryDate(tier.id, draft.slideCount, catalog, calendar);
                    const selected = draft.deliveryTier === tier.id;
                    return (
                      <button type="button" key={tier.id} data-selected={selected} onClick={() => set("deliveryTier", tier.id)} className="option-card !items-center !text-center">
                        <span className={`chip ${TIER_CHIPS[i % TIER_CHIPS.length]}`}>{tier.name}</span>
                        <span className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">{new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date)}</span>
                        <span className="text-3xl font-bold leading-tight">{date.getDate()}</span>
                        <span className="text-sm text-muted">{new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date)}</span>
                        <span className="mt-3 rounded-full bg-surface px-3 py-1 text-sm font-semibold">{moneyRange(min, max)} / slide</span>
                        <span className="mt-1 text-[11px] text-muted">{tier.note}</span>
                      </button>
                    );
                  })}
                </div>
                {estimate && (
                  <p className="mt-3 text-sm text-muted">
                    First draft delivered by <span className="font-semibold text-ink">{longDate(estimate.deadlineAt)}</span>.
                  </p>
                )}
                {holidaysAhead.length > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    Dates skip weekends and our upcoming holidays ({holidaysAhead.map((h) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${h}T12:00:00`))).join(", ")}).
                  </p>
                )}
              </div>
            </div>

            {hasTextChoice && (
              <div className="card p-6 sm:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">Want us to fix the words too?</h3>
                  <span className="text-xs text-muted">Optional. English only.</span>
                </div>
                <p className="mt-1 text-sm text-muted">Without proofreading or editing we leave your text exactly as it is, typos included.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {textServices.map((p) => (
                    <button type="button" key={p.id} data-selected={draft.proofreading === p.id} onClick={() => set("proofreading", p.id)} className="option-card">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface text-ink">
                        <TreatmentIcon icon={p.icon} width={24} height={24} />
                      </span>
                      <h4 className="mt-3 font-bold">{p.name}</h4>
                      <p className="mt-1 flex-1 text-sm text-muted">{p.description}</p>
                      <p className="mt-3 text-sm">
                        {p.perSlideCents > 0 ? (
                          <>
                            <span className="text-lg font-bold">{money(p.perSlideCents)}</span> <span className="text-muted">per slide</span>
                          </>
                        ) : (
                          <span className="font-semibold text-muted">Free</span>
                        )}
                      </p>
                    </button>
                  ))}
                </div>
                {draft.proofreading !== NO_TEXT_SERVICE_ID && (
                  <div className="mt-5 flex items-center gap-3">
                    <span className="text-sm font-medium">Spelling</span>
                    <div className="inline-flex rounded-full border border-slate-300 bg-white p-0.5 text-sm font-semibold">
                      {(["UK", "US"] as GrammarId[]).map((g) => (
                        <button type="button" key={g} onClick={() => set("grammar", g)} className={`rounded-full px-4 py-1.5 ${draft.grammar === g ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}>
                          {g} English
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ---------------- STEP 4 ---------------- */}
        {step === 4 && (
          <section className="space-y-6">
            <StepHeading n={4} title="Send us the deck and your brief" subtitle="The clearer your brief, the closer the draft is to what you want. Mention the slide numbers where you can." />

            <div className="card p-6 sm:p-8">
              <h3 className="font-semibold">Your files</h3>
              <FileDrop files={files} onChange={onFiles} disabled={draft.useGoogleSlides} />
              {detected && detected.count !== draft.slideCount && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-700 ring-1 ring-accent-100">
                  <span>
                    We counted <span className="font-semibold">{detected.count} slides</span> in {detected.name}. You entered {draft.slideCount}.
                  </span>
                  <button type="button" className="btn-accent !py-1.5 !text-xs" onClick={() => set("slideCount", clampSlides(detected.count))}>
                    Use {detected.count}
                  </button>
                </div>
              )}
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-accent-500" checked={draft.useGoogleSlides} onChange={(e) => set("useGoogleSlides", e.target.checked)} />
                My deck is in Google Slides, I will share a link instead
              </label>
              {draft.useGoogleSlides && <input className="input mt-3" placeholder="https://docs.google.com/presentation/d/..." value={draft.googleSlidesUrl} onChange={(e) => set("googleSlidesUrl", e.target.value)} />}
              {styleFiles.length > 0 && <p className="mt-3 text-xs text-muted">Template from step 2: {styleFiles.map((f) => f.name).join(", ")}</p>}
            </div>

            <div className="card p-6 sm:p-8">
              <h3 className="font-semibold">Your brief</h3>
              <textarea
                rows={5}
                className="input mt-3"
                placeholder="Example: keep slides 8 and 11 untouched. The colours on 27 must not change. Find a stronger illustration for slide 26..."
                value={draft.brief}
                onChange={(e) => set("brief", e.target.value)}
                data-clarity-mask="true"
              />
              <p className="mt-2 text-xs text-muted">
                We save your answers as you go, so you can come back to them and so we can see where this form gets in the way.{" "}
                <a href="https://slidebazaar.com/privacy-policy/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  How we use them
                </a>
              </p>
              {/* Reads as a control rather than a heading: a bordered row, a
                  chevron that turns, and hover feedback, so it is obvious the
                  extras are hidden behind it rather than simply absent. */}
              <button
                type="button"
                onClick={() => {
                  setShowOptional((s) => !s);
                  track.touch("extras");
                }}
                aria-expanded={showOptional}
                aria-controls="helpful-extras"
                className="mt-5 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold transition hover:border-slate-300 hover:bg-surface"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronDownIcon width={16} height={16} aria-hidden="true" className={`shrink-0 text-muted transition-transform duration-200 ${showOptional ? "rotate-180" : ""}`} />
                  Helpful extras
                </span>
                <span className="shrink-0 text-xs font-normal text-muted">{showOptional ? "Hide" : "Audience, brand, fonts and colours"}</span>
              </button>
              {showOptional && (
                <div id="helpful-extras" className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Who is the audience?</label>
                    <input className="input" value={draft.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Investors, sales prospects, internal team..." data-clarity-mask="true" />
                  </div>
                  <div>
                    <label className="label">Fonts and colours</label>
                    <input className="input" value={draft.fontsColors} onChange={(e) => set("fontsColors", e.target.value)} placeholder="Montserrat, #16244F and #FF6A3D" data-clarity-mask="true" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Brand guidelines or references</label>
                    <textarea rows={2} className="input" value={draft.brandNotes} onChange={(e) => set("brandNotes", e.target.value)} placeholder="Links to your website, brand book or decks you like" data-clarity-mask="true" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Anything else?</label>
                    <textarea rows={2} className="input" value={draft.extraNotes} onChange={(e) => set("extraNotes", e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---------------- STEP 5 ---------------- */}
        {step === 5 && (
          <section>
            <StepHeading n={5} title="Confirm payment and we get started" subtitle="Your card is charged now and the money is held by SlideBazaar until you approve the final designs." />
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <div className="card p-6 sm:p-8">
                  <h3 className="font-semibold">Your details</h3>
                  {user ? (
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm">
                      <span>
                        Ordering as <span className="font-semibold">{user.name}</span> ({user.email})
                      </span>
                      <CheckIcon width={20} height={20} className="text-emerald-600" />
                    </div>
                  ) : (
                    <div className="mt-4">
                      <AuthForm mode={authMode} inline onSwitchMode={setAuthMode} onSuccess={(u) => { setUser(u); track.flush({ signedIn: true }); }} />
                    </div>
                  )}
                </div>

                <div className="card p-6 sm:p-8">
                  <h3 className="font-semibold">
                    Billing <span className="font-normal text-muted">(for your invoice)</span>
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="label">Address</label>
                      <input className="input" value={draft.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} />
                    </div>
                    <div>
                      <label className="label">City</label>
                      <input className="input" value={draft.billingCity} onChange={(e) => set("billingCity", e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Country</label>
                      <input className="input" value={draft.billingCountry} onChange={(e) => set("billingCountry", e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">VAT / Tax ID (optional)</label>
                      <input className="input" value={draft.billingVat} onChange={(e) => set("billingVat", e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-100 bg-brand-50 p-6 text-sm text-brand-900">
                  <div className="flex items-start gap-3">
                    <LockIcon width={28} height={28} className="shrink-0 text-brand-600" />
                    <div>
                      <p className="font-semibold">Approval-protected payment</p>
                      <ol className="mt-2 list-decimal space-y-1 pl-5">
                        <li>{estimate ? money(estimate.totalCents) : "The estimate"} is charged to your card and held by SlideBazaar.</li>
                        <li>A designer is assigned and your first draft lands by {estimate ? longDate(estimate.deadlineAt) : "the deadline"}.</li>
                        <li>You request revisions or approve. Only approval releases the money to SlideBazaar.</li>
                        <li>Not satisfied, or we cannot deliver? You get a full refund to your card.</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="card h-fit overflow-hidden lg:sticky lg:top-24">
                <div className="bg-ink p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">Your order</p>
                  <p className="mt-1 text-3xl font-bold">{estimate ? moneyRange(estimate.subtotalMinCents, estimate.subtotalMaxCents) : "$0"}</p>
                  <p className="text-xs text-brand-200">
                    {draft.slideCount} slides, {selectedTreatment?.name.toLowerCase()}
                  </p>
                </div>
                <dl className="space-y-2 p-5 text-sm">
                  <Row k="Treatment" v={selectedTreatment?.name ?? "-"} />
                  <Row k="Style" v={selectedStyle?.name ?? "-"} />
                  <Row k="Delivery" v={cat.tiers.find((t) => t.id === draft.deliveryTier)?.name ?? "-"} />
                  <Row k="First draft by" v={estimate ? longDate(estimate.deadlineAt) : "-"} />
                  <Row k="Text service" v={textServices.find((p) => p.id === draft.proofreading)?.name ?? "-"} />
                  {estimate && (
                    <>
                      <Row k="Per slide" v={moneyRange(estimate.perSlideMinCents + estimate.addonPerSlideCents, estimate.perSlideMaxCents + estimate.addonPerSlideCents)} />
                      <div className="rounded-xl bg-cream px-3 py-2 text-xs text-accent-700 ring-1 ring-accent-100">
                        <span className="font-semibold">Charged now and held: {money(estimate.totalCents)}</span>
                        {estimate.isRange && ". Any difference is refunded once the treatment is confirmed."}
                      </div>
                    </>
                  )}
                </dl>
                <div className="px-5 pb-5">
                  <button type="button" onClick={submitOrder} disabled={submitting || !user} className="btn-accent w-full">
                    {submitting ? "Creating your order..." : `Pay ${estimate ? money(estimate.totalCents) : ""}`}
                  </button>
                  {!user && <p className="mt-2 text-center text-xs text-muted">Log in or create an account to continue.</p>}
                </div>
              </aside>
            </div>
          </section>
        )}
      </div>

      {/* Footer nav */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="w-28">
            {step > 1 && (
              <button type="button" onClick={back} className="btn-ghost">
                &larr; Back
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            Step {step} of {STEPS.length}
          </p>
          <div className="flex w-28 justify-end sm:w-auto">
            {step < 5 ? (
              <button type="button" onClick={next} className="btn-accent !px-8">
                {step === 4 ? "Review & pay" : "Next"}
              </button>
            ) : (
              <button type="button" onClick={submitOrder} disabled={submitting || !user} className="btn-accent !px-8">
                {submitting ? "Please wait..." : "Submit order"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepHeading({ n, title, subtitle }: { n: number; title: string; subtitle: string }) {
  return (
    <header className="max-w-2xl">
      <p className="eyebrow">Step {n} of 5</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
      {/* text-pretty keeps a subtitle from ending on a single short word. */}
      <p className="mt-2 text-pretty text-muted">{subtitle}</p>
    </header>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function FileDrop({ files, onChange, disabled }: { files: File[]; onChange: (f: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function add(list: FileList | null) {
    if (!list) return;
    const merged = [...files];
    for (const f of Array.from(list)) if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
    onChange(merged);
  }

  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`mt-4 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-4 py-10 text-sm transition ${drag ? "border-accent-500 bg-accent-50" : "border-accent-200 bg-cream hover:border-accent-400"}`}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-500 text-white shadow-md shadow-accent-500/30">
          <UploadIcon width={22} height={22} />
        </span>
        <p className="mt-3 font-semibold">Drop your presentation here, or click to browse</p>
        <p className="mt-1 text-xs text-muted">PowerPoint, Keynote, PDF, Word, images or a zip. Up to 200 MB per file.</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ACCEPTED_UPLOAD_EXTENSIONS.join(",")}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center justify-between px-3 py-2">
              <span className="truncate">
                {f.name} <span className="text-muted">({bytes(f.size)})</span>
              </span>
              <button type="button" className="text-xs text-rose-600 hover:underline" onClick={() => onChange(files.filter((x) => x !== f))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
