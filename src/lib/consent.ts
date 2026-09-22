"use client";

import { useEffect, useState } from "react";

/**
 * The visitor's analytics choice, as CookieYes reports it.
 *
 * THE ONE RULE: gate on isUserActionCompleted, never on the category alone.
 * CookieYes grants every category with no user action on at least two paths —
 * when the geo ruleset matches no banner, and from each category's configured
 * default before anybody answers. Both dispatch the same update event with the
 * categories populated, so reading the categories alone would resolve "was
 * never asked" to "said yes" and start recording somebody's brief.
 *
 * isUserActionCompleted is the only field that separates "not asked" from
 * "answered".
 *
 * Both events are handled by RE-READING getCkyConsent() rather than by parsing
 * their payloads: the two events carry different shapes, and two handlers that
 * each parse one of them is a bug waiting to happen. The store is authoritative
 * and is written before every dispatch.
 *
 * Three states, not a boolean. "Has not answered" and "said no" both mean
 * collect nothing, but only the second means delete what was already collected.
 */

const CATEGORY = "analytics";

export type ConsentState = "unknown" | "granted" | "denied";

interface CkyConsent {
  categories?: Record<string, boolean>;
  isUserActionCompleted?: boolean;
}

declare global {
  interface Window {
    getCkyConsent?: () => CkyConsent;
    revisitCkyConsent?: () => void;
  }
}

function readConsent(): ConsentState {
  try {
    const c = window.getCkyConsent?.();
    if (!c || c.isUserActionCompleted !== true) return "unknown";
    return c.categories?.[CATEGORY] === true ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

export function useAnalyticsConsent(required: boolean): ConsentState {
  // Denied by default, and never feature-detected. "window.getCkyConsent is
  // missing, so carry on" is what happens every time an ad blocker eats the
  // banner, and ad-blocker users are the population least likely to want this.
  // Whether a banner is expected is a decision the server makes from the
  // environment, not a guess the browser makes from the DOM.
  const [state, setState] = useState<ConsentState>(required ? "unknown" : "granted");

  useEffect(() => {
    if (!required) return;
    const settle = () => setState(readConsent());
    // Already decided: the script landed before this mounted, or they answered
    // on an earlier visit and CookieYes restored it without showing anything.
    settle();
    document.addEventListener("cookieyes_banner_load", settle);
    document.addEventListener("cookieyes_consent_update", settle);
    return () => {
      document.removeEventListener("cookieyes_banner_load", settle);
      document.removeEventListener("cookieyes_consent_update", settle);
    };
  }, [required]);

  return state;
}
