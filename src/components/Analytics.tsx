import { ConsentEffects } from "./ConsentEffects";

/**
 * Google Tag Manager and Microsoft Clarity, behind the CookieYes banner.
 *
 * The order of the first four tags is the whole point:
 *
 *  1. noscript iframe — Google documents it as the first child of <body>. An
 *     <iframe> is invalid in <head> and the parser would silently relocate it.
 *  2. consent default — Google is explicit that consent commands run out of
 *     order simply do not apply. This tag also creates window.dataLayer, which
 *     CookieYes needs: its push helper checks for an existing array and returns
 *     silently when there is none, logging nothing.
 *  3. CookieYes.
 *  4. the GTM loader.
 *
 * Why CookieYes BEFORE the loader: CookieYes installs a MutationObserver as the
 * last statement of its script, and an observer never sees mutations that
 * predate it. With the loader third, gtm.js is inserted before the observer
 * exists and is not blocked, while everything the container injects afterwards
 * is — which presents as "GTM loads, Tag Assistant looks alive, no data ever
 * arrives". With CookieYes third, the behaviour is deterministic either way.
 * The cost is one CDN round trip ahead of the loader.
 *
 * All four are raw tags rather than next/script. In the App Router,
 * beforeInteractive does not emit a script element at all; it queues the script
 * for Next's runtime to drain after boot, which is strictly later than parse.
 * Mixing a raw tag with a <Script> would put two of these under different
 * injection mechanisms with no ordering contract between them.
 *
 * Clarity is deliberately NOT here. See ClarityTag.
 */

/**
 * Blanket denied, with no region parameter.
 *
 * wait_for_update is what makes the banner's answer count for the first page
 * view. 3000ms rather than Google's example 500ms, because CookieYes needs two
 * CDN round trips plus a macrotask before it can push. This is a measurement
 * and latency trade, not a privacy control: when it expires, tags evaluate
 * against the denied default, which is the safe direction.
 *
 * ads_data_redaction in, url_passthrough out. The first redacts ad identifiers
 * while consent is denied; the second appends click ids to URLs so that denied
 * visitors stay measurable, which is a workaround rather than a control.
 */
const CONSENT_DEFAULT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied",functionality_storage:"denied",personalization_storage:"denied",security_storage:"granted",wait_for_update:3000});
gtag("set","ads_data_redaction",true);`;

/** Google's published loader, unchanged but for the container id. */
const gtmLoader = (id: string) =>
  `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;

export function Analytics({ gtmId, cookieYesId, clarityId }: { gtmId: string; cookieYesId: string; clarityId: string | null }) {
  return (
    <>
      {/* dangerouslySetInnerHTML rather than JSX children: with scripting on,
          the browser parses noscript content as text and hydration disagrees
          with it. This iframe is NOT consent-gated and cannot be — it renders
          only when JavaScript is off, which is exactly when neither Consent
          Mode nor CookieYes exists. The privacy policy has to say so. */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
        }}
      />
      <script id="sb-consent-default" dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULT }} />
      {/* No async, on purpose: React 19 hoists a script carrying src plus async
          into <head>, and a hoisted CookieYes would race the tags around it.
          The rule below exists to stop render-blocking scripts, which is a
          performance concern; here the ordering is a correctness one, and the
          consent banner is the one thing that should block. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script id="cookieyes" src={`https://cdn-cookieyes.com/client_data/${cookieYesId}/script.js`} />
      <script id="sb-gtm" dangerouslySetInnerHTML={{ __html: gtmLoader(gtmId) }} />
      <ConsentEffects clarityId={clarityId} />
    </>
  );
}
