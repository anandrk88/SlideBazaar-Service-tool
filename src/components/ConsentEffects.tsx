"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { analyticsAllowed } from "@/lib/analytics-routes";
import { useAnalyticsConsent } from "@/lib/consent";
import { ATTEMPT_KEY, VISITOR_KEY, WIZARD_ENDPOINT } from "@/lib/wizard-storage";

/**
 * Everything that has to react to the visitor's choice, in one place.
 *
 * It lives beside the tags rather than inside the wizard because the root
 * layout decides once, at document load, whether the tags load, and cannot take
 * that back: layouts do not re-render on a soft navigation and there is no API
 * for unloading a tag manager. And because the footer's cookie-settings link
 * works on "/", where the wizard never mounts, so a withdrawal from there still
 * has to delete.
 */
export function ConsentEffects({ clarityId }: { clarityId: string | null }) {
  const pathname = usePathname();
  const consent = useAnalyticsConsent(true);
  const withdrawn = useRef(false);
  const clarityLoaded = useRef(false);

  // Tell the container which pages it may act on. A plain variable with no
  // `event` key, so it fires no trigger by itself: it is inert until paired
  // with a Data Layer Variable and a blocking exception in GTM.
  useEffect(() => {
    try {
      const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
      if (Array.isArray(dl)) dl.push({ "sb.analyticsAllowed": analyticsAllowed(pathname) });
    } catch {
      /* analytics never breaks navigation */
    }
  }, [pathname]);

  /**
   * Microsoft Clarity, loaded only once analytics consent is actually granted.
   *
   * Unlike GTM, this is not handed to Consent Mode and left to sort itself out.
   * Clarity records session replays — pointer movement, clicks, scrolling and
   * page content — so the failure mode is not a missing statistic, it is a
   * recording of somebody typing a confidential brief being sent to a third
   * party. The script is therefore simply not present until somebody has said
   * yes, which needs no trust in anyone else's consent handling.
   *
   * Also route-gated: there is no reason to record the marketing page and the
   * order form under the same rules as everything else in the allow-list.
   */
  useEffect(() => {
    if (!clarityId || clarityLoaded.current) return;
    if (consent !== "granted" || !analyticsAllowed(pathname)) return;
    clarityLoaded.current = true;
    try {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.clarity.ms/tag/${clarityId}`;
      document.head.appendChild(s);
    } catch {
      /* never breaks the page */
    }
  }, [clarityId, consent, pathname]);

  /**
   * They said no. Delete what was collected before they said it.
   *
   * Both handles are read before either is destroyed. visitorId is the only
   * thing that reaches rows from earlier visits, so wiping it first and then
   * deleting by attemptId alone would leave those rows alive and permanently
   * unreachable.
   */
  useEffect(() => {
    if (consent !== "denied") {
      // Somebody who rejects, then changes their mind, must be able to withdraw
      // again later.
      if (consent === "granted") withdrawn.current = false;
      return;
    }
    if (withdrawn.current) return;
    withdrawn.current = true;

    let attemptId: string | null = null;
    let visitorId: string | null = null;
    try {
      const raw = sessionStorage.getItem(ATTEMPT_KEY);
      if (raw) attemptId = (JSON.parse(raw) as { id?: string }).id ?? null;
    } catch {}
    try {
      visitorId = localStorage.getItem(VISITOR_KEY);
    } catch {}

    try {
      sessionStorage.removeItem(ATTEMPT_KEY);
    } catch {}
    try {
      localStorage.removeItem(VISITOR_KEY);
    } catch {}

    if (!attemptId && !visitorId) return;
    try {
      void fetch(WIZARD_ENDPOINT, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, visitorId }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* a failed erasure must not throw at somebody mid-page */
    }
  }, [consent]);

  return null;
}
