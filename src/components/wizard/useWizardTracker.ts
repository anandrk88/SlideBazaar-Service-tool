"use client";

import { useEffect, useMemo, useRef } from "react";
import type { DRAFT_FIELDS } from "@/lib/validation";

/**
 * Records how far somebody gets through the order wizard, and what they had
 * typed when they stopped.
 *
 * Three rules this file exists to keep:
 *
 *  1. It can never break the wizard. Every storage access and every send is
 *     wrapped. With the endpoint returning 500 to everything, the form behaves
 *     exactly as it does now.
 *  2. It sends an allow-list, never the draft. Billing values and the Google
 *     Slides link are reduced to "this box was filled in", and the sign-in form
 *     keeps the email and password inside its own component, out of scope here.
 *     A blacklist would let a future field drift into the payload silently.
 *  3. Nothing is sent until somebody actually interacts. A crawler that renders
 *     the page and clicks nothing creates no row and writes no storage.
 */

const ENDPOINT = "/api/wizard-attempt";
const ATTEMPT_KEY = "sb-wz-attempt-v1";
const VISITOR_KEY = "sb-wz-visitor-v1";

/** 4s after they stop, but never more than 20s into a continuous stretch. */
const IDLE_MS = 4_000;
const MAX_WAIT_MS = 20_000;

type DraftField = (typeof DRAFT_FIELDS)[number];

/** Exactly the draft fields the tracker is allowed to see. */
export interface TrackedDraft {
  treatment: string | null;
  style: string | null;
  slideCount: number;
  deliveryTier: string;
  proofreading: string;
  grammar: string;
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

export interface WizardSnapshot {
  step: number;
  draft: TrackedDraft;
  files: { size: number }[];
  styleFiles: unknown[];
  detected: { count: number } | null;
  showOptional: boolean;
  signedIn: boolean;
  estimateCents: number | null;
}

export interface WizardTracker {
  readonly attemptId: string | null;
  sync(snapshot: WizardSnapshot): void;
  touch(field?: DraftField): void;
  flush(override?: Partial<{ step: number; signedIn: boolean }>): void;
  blocked(step: number, message: string): void;
  submitted(): void;
  finish(): void;
}

const NOOP: WizardTracker = {
  attemptId: null,
  sync() {},
  touch() {},
  flush() {},
  blocked() {},
  submitted() {},
  finish() {},
};

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "";
  }
}

/** Storage can throw outright in a locked-down browser, not merely return null. */
function read(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(store: Storage, key: string, value: string) {
  try {
    store.setItem(key, value);
  } catch {
    /* private mode, blocked site data: tracking is simply off */
  }
}

interface AttemptEntry {
  id: string;
  seq: number;
  reloads: number;
  startedAt: number;
}

/**
 * seq lives beside the id, in storage, on purpose. Held only in memory it would
 * restart at 1 after a refresh; the server's strictly-greater guard would then
 * reject every later write and the row would be frozen at its pre-refresh state
 * for good. Refreshing is exactly what a confused person does, and because the
 * step is not part of the saved draft it visibly throws them back to step 1, so
 * this is a common path rather than an edge case.
 */
function loadAttempt(): AttemptEntry | null {
  const raw = read(sessionStorage, ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<AttemptEntry>;
    if (typeof v.id !== "string" || !v.id) return null;
    return { id: v.id, seq: Number(v.seq) || 0, reloads: Number(v.reloads) || 0, startedAt: Number(v.startedAt) || Date.now() };
  } catch {
    return null;
  }
}

export function useWizardTracker(): WizardTracker {
  // Honour an explicit opt-out. globalPrivacyControl is absent from the DOM
  // typings, hence the cast; this repo runs tsc as a build step.
  const optedOut =
    typeof navigator !== "undefined" &&
    ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === "1");

  const snap = useRef<WizardSnapshot | null>(null);
  const attempt = useRef<AttemptEntry | null>(null);
  const lastField = useRef<DraftField | null>(null);
  const counts = useRef({ blockedCount: 0, submitCount: 0 });
  const blocker = useRef<string | null>(null);
  const finished = useRef(false);
  const dirty = useRef(false);
  const sending = useRef(false);
  const lastBody = useRef<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstTouchAt = useRef(0);

  // Rough active seconds per step, for telling "left after twenty seconds"
  // apart from "fought with this step for six minutes".
  const stepSeconds = useRef<Record<number, number>>({});
  const stepSince = useRef({ step: 1, at: Date.now() });

  const tracker = useMemo<WizardTracker>(() => {
    if (optedOut || typeof window === "undefined") return NOOP;

    /** Mint on first genuine interaction, never on mount. */
    function ensure(): AttemptEntry | null {
      if (finished.current) return null;
      if (attempt.current) return attempt.current;

      const existing = loadAttempt();
      if (existing) {
        // Same tab, fresh mount: they refreshed.
        existing.reloads += 1;
        attempt.current = existing;
        write(sessionStorage, ATTEMPT_KEY, JSON.stringify(existing));
        return existing;
      }

      const id = uuid();
      if (!id) return null;
      const entry: AttemptEntry = { id, seq: 0, reloads: 0, startedAt: Date.now() };
      attempt.current = entry;
      write(sessionStorage, ATTEMPT_KEY, JSON.stringify(entry));
      if (!read(localStorage, VISITOR_KEY)) {
        const v = uuid();
        if (v) write(localStorage, VISITOR_KEY, v);
      }
      return entry;
    }

    function accrueStepTime(now: number) {
      const { step, at } = stepSince.current;
      const secs = Math.round((now - at) / 1000);
      if (secs > 0 && secs < 86_400) stepSeconds.current[step] = (stepSeconds.current[step] ?? 0) + secs;
    }

    function serialiseStepSeconds(): string | null {
      const parts = Object.entries(stepSeconds.current)
        .filter(([s, v]) => Number(s) >= 1 && Number(s) <= 5 && v > 0)
        .map(([s, v]) => `${s}:${Math.min(999_999, v)}`);
      return parts.length ? parts.join(",") : null;
    }

    function build(entry: AttemptEntry, override?: Partial<{ step: number; signedIn: boolean }>) {
      const s = snap.current;
      if (!s) return null;
      const d = s.draft;
      const step = override?.step ?? s.step;

      const billingFilled = (
        [
          ["address", d.billingAddress],
          ["city", d.billingCity],
          ["country", d.billingCountry],
          ["vat", d.billingVat],
        ] as const
      )
        .filter(([, v]) => v.trim().length > 0)
        .map(([k]) => k);

      const text = (v: string) => (v.trim().length ? v : null);

      return {
        attemptId: entry.id,
        visitorId: read(localStorage, VISITOR_KEY),
        step,
        maxStep: step,
        blocker: blocker.current,
        blockedCount: counts.current.blockedCount,
        submitCount: counts.current.submitCount,
        lastField: lastField.current,
        stepSeconds: serialiseStepSeconds(),
        // A draft restored long after it was written is a return visit, not a
        // refresh; without this the person looks like they typed a full brief in
        // three seconds and vanished.
        resumed: entry.reloads === 0 && Boolean(text(d.brief) || d.treatment),
        reloads: entry.reloads,
        openedExtras: s.showOptional,

        treatment: d.treatment,
        style: d.style,
        slideCount: d.slideCount || null,
        deliveryTier: d.deliveryTier || null,
        proofreading: d.proofreading || null,
        grammar: d.grammar === "UK" || d.grammar === "US" ? d.grammar : null,
        useGoogleSlides: d.useGoogleSlides,
        estimateCents: s.estimateCents,

        brief: text(d.brief),
        audience: text(d.audience),
        brandNotes: text(d.brandNotes),
        fontsColors: text(d.fontsColors),
        extraNotes: text(d.extraNotes),

        billingFilled,
        googleSlidesFilled: d.googleSlidesUrl.trim().length > 0,
        fileCount: s.files.length,
        fileMb: Math.round(s.files.reduce((n, f) => n + f.size, 0) / 1_048_576),
        styleFileCount: s.styleFiles.length,
        detectedSlides: s.detected?.count ?? null,
      };
    }

    function send(override?: Partial<{ step: number; signedIn: boolean }>, beacon = false) {
      if (finished.current) return;
      const entry = ensure();
      if (!entry) return;

      accrueStepTime(Date.now());
      const payload = build(entry, override);
      if (!payload) return;
      stepSince.current = { step: payload.step, at: Date.now() };

      // Dedupe on everything but seq, so tab-switching writes nothing.
      const body = JSON.stringify(payload);
      if (body === lastBody.current) {
        dirty.current = false;
        return;
      }

      entry.seq += 1;
      write(sessionStorage, ATTEMPT_KEY, JSON.stringify(entry));
      const json = JSON.stringify({ ...payload, seq: entry.seq });
      lastBody.current = body;
      dirty.current = false;

      try {
        if (beacon && navigator.sendBeacon) {
          const queued = navigator.sendBeacon(ENDPOINT, new Blob([json], { type: "application/json" }));
          if (queued) return;
        }
        if (sending.current && !beacon) {
          dirty.current = true;
          return;
        }
        sending.current = true;
        void fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: json, keepalive: true })
          .catch(() => {})
          .finally(() => {
            sending.current = false;
          });
      } catch {
        /* never surfaces to the person filling the form */
      }
    }

    function arm() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      const now = Date.now();
      if (!firstTouchAt.current) firstTouchAt.current = now;
      // The ceiling is the real governor: someone writing a long brief never
      // stops for four seconds, so without it nothing would be sent until they
      // finished.
      const wait = Math.min(IDLE_MS, Math.max(0, firstTouchAt.current + MAX_WAIT_MS - now));
      idleTimer.current = setTimeout(() => {
        firstTouchAt.current = 0;
        send();
      }, wait);
    }

    return {
      get attemptId() {
        return attempt.current?.id ?? null;
      },
      sync(next) {
        snap.current = next;
      },
      touch(field) {
        if (finished.current) return;
        if (field) lastField.current = field;
        ensure();
        dirty.current = true;
        arm();
      },
      flush(override) {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        firstTouchAt.current = 0;
        send(override);
      },
      blocked(step, message) {
        counts.current.blockedCount += 1;
        blocker.current = `Step ${step}: ${message}`.slice(0, 200);
        if (idleTimer.current) clearTimeout(idleTimer.current);
        firstTouchAt.current = 0;
        send({ step });
      },
      submitted() {
        counts.current.submitCount += 1;
        if (idleTimer.current) clearTimeout(idleTimer.current);
        firstTouchAt.current = 0;
        send();
      },
      finish() {
        finished.current = true;
        if (idleTimer.current) clearTimeout(idleTimer.current);
        try {
          sessionStorage.removeItem(ATTEMPT_KEY);
        } catch {}
      },
    };
  }, [optedOut]);

  // Leaving the page. pagehide and a hidden visibilitychange, never unload:
  // unload is unreliable on mobile Safari and it disqualifies the page from the
  // back/forward cache. The cleanup flushes rather than merely clearing the
  // timer, which is what covers in-app navigation, because clicking the header
  // logo unmounts the wizard without firing either event.
  useEffect(() => {
    if (optedOut) return;
    const leave = () => {
      if (dirty.current) tracker.flush();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") leave();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onHide);
      leave();
    };
  }, [tracker, optedOut]);

  return tracker;
}
