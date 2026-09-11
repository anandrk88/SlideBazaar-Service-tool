/**
 * Editable homepage HTML blocks.
 *
 * Each section of the homepage can be overridden with hand-written HTML from
 * Admin > Homepage. A section with no override renders the designed React
 * version it always has; a section with one renders the team's HTML inside the
 * same band and width, styled by `.rich` in globals.css.
 *
 * Why HTML in the database rather than editing the component files: on Vercel
 * the filesystem is read-only at runtime and components are compiled at build
 * time, so nothing written to a .tsx file would take effect without a redeploy.
 *
 * Why semantic HTML rather than Tailwind classes: Tailwind generates CSS by
 * scanning source files at build time. A class that exists only in a database
 * row is never generated, so it would silently do nothing. `.rich` styles plain
 * h2/h3/p/ul/ol/a/strong/em to match the site, which is why the team can write
 * ordinary HTML and have it look right.
 */

export interface BlockDefinition {
  id: string;
  label: string;
  /** Which part of the page this replaces, in plain language. */
  description: string;
  /** Starting point offered in the editor when the block is empty. */
  starter: string;
}

export const BLOCKS: BlockDefinition[] = [
  {
    id: "hero",
    label: "Hero",
    description: "The headline block at the very top. Replaces the wording only; the dark background and the artwork on the right stay.",
    starter: `<p class="eyebrow">Custom design services</p>
<h1>Professional presentation design, without the agency wait.</h1>
<p>Send us the deck you have, or the notes you have not turned into one yet. Our designers rebuild it, our quality team checks it, and you only pay once you are happy.</p>
<ul>
  <li>Priced per slide</li>
  <li>First draft in a few business days</li>
  <li>Every draft checked by our quality team</li>
  <li>Approve before we are paid, or get a full refund</li>
</ul>
<p><a class="btn-accent" href="/order">Start your order</a></p>`,
  },
  {
    id: "beforeafter",
    label: "Before and after",
    description: "The section with the two example slides. Replaces the whole section, including the examples.",
    starter: `<p class="eyebrow">Before and after</p>
<h2>The same slide, rebuilt</h2>
<p>Your own deck keeps your words, your numbers and anything you tell us to leave alone.</p>`,
  },
  {
    id: "howitworks",
    label: "How it works",
    description: "The five-step explainer. Replaces the whole section, including the numbered steps and the illustration.",
    starter: `<p class="eyebrow">How it works</p>
<h2>Five steps from your deck to finished slides</h2>
<ol>
  <li><strong>Tell us what you need.</strong> Pick the treatment, the look and the deadline in the order wizard.</li>
  <li><strong>Send your deck and brief.</strong> Upload your file or share a link.</li>
  <li><strong>Pay and we start.</strong> We hold the payment until you approve.</li>
  <li><strong>We design and quality check.</strong> Every draft passes a quality manager.</li>
  <li><strong>Review and approve.</strong> Approving unlocks the original files.</li>
</ol>`,
  },
  {
    id: "services",
    label: "Services",
    description: "The grid of things you offer. Replaces the whole section, including the cards and their icons.",
    starter: `<p class="eyebrow">What we do</p>
<h2>Six ways we can help with a deck</h2>
<ul>
  <li><strong>Presentation design.</strong> Send us the deck you have and choose how much you want changed.</li>
  <li><strong>Deck clean-up.</strong> Fonts, colours, spacing and alignment made consistent.</li>
  <li><strong>Build from scratch.</strong> Notes, a sketch or a document turned into a finished deck.</li>
</ul>
<p>Anything not listed can be quoted on request. Email <a href="mailto:support@slidebazaar.com">support@slidebazaar.com</a>.</p>`,
  },
  {
    id: "guarantee",
    label: "Money-back guarantee",
    description: "The section explaining how the payment is held. Take care with the wording here: it is a promise to customers.",
    starter: `<p class="eyebrow">Your money</p>
<h2>Your money is protected</h2>
<p>Your order total is charged upfront and held by SlideBazaar. No third party holds it, and we do not treat it as earned until you click Approve on your final designs. If you do not approve, or we cannot deliver what you asked for, it is refunded in full to your original payment method.</p>
<p><a class="btn-accent" href="/order">Get an instant estimate</a></p>`,
  },
  {
    id: "faq",
    label: "Questions and answers",
    description: "The FAQ section. Replaces the whole section, including the grouped accordions.",
    starter: `<p class="eyebrow">Questions</p>
<h2>Answers before you order</h2>
<h3>How much does it cost?</h3>
<p>Every order is priced per slide. You see the exact estimate in the order wizard before you pay anything.</p>
<h3>When am I charged?</h3>
<p>When you place the order. We hold your payment while the work is in progress.</p>`,
  },
];

export function findBlock(id: string): BlockDefinition | undefined {
  return BLOCKS.find((b) => b.id === id);
}

export const BLOCK_SETTING_PREFIX = "block.";

/**
 * What the team may write. Anything outside this is removed rather than
 * escaped, so a mistake looks like missing formatting, never like broken
 * markup or a working script.
 */
export const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "div", "br", "hr", "section", "header", "footer", "nav", "main", "aside",
  "ul", "ol", "li", "dl", "dt", "dd", "strong", "b", "em", "i", "u", "s", "code", "pre",
  "a", "blockquote", "figure", "figcaption", "img", "picture", "source",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "video", "small", "sup", "sub", "details", "summary", "time", "label",
  // Presentational SVG only. Every section renders inline icons, so without
  // these a section's own markup would be stripped the moment it was saved
  // back. Deliberately absent: script, foreignObject, use, animate, set and
  // anything else that can execute or pull in a remote document.
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
  "defs", "linearGradient", "radialGradient", "stop", "text", "tspan", "clipPath", "mask",
];

/**
 * `class` is allowed so the team can reach the site's own component classes
 * (btn-accent, eyebrow, card, chip). Arbitrary Tailwind utilities will not
 * work — Tailwind only generates classes it finds in source files — which is
 * why `.rich` styles plain tags instead.
 */
export const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "target", "rel", "class"],
  // No style attribute anywhere: it is enough to position an invisible
  // element over the whole page and harvest clicks.
  img: ["src", "alt", "width", "height", "loading", "decoding", "class"],
  video: ["src", "poster", "controls", "muted", "loop", "playsinline", "autoplay", "class"],
  source: ["src", "srcset", "type", "media"],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
  details: ["open"],
  // SVG carries its geometry in attributes, so they have to be listed. None of
  // these can reference another document; href and xlink:href are absent on
  // purpose.
  svg: ["viewbox", "viewBox", "xmlns", "width", "height", "fill", "stroke", "class", "role", "focusable", "preserveaspectratio"],
  path: ["d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "fill-rule", "clip-rule", "opacity", "transform", "class", "pathlength"],
  circle: ["cx", "cy", "r", "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "opacity", "transform", "class", "pathlength"],
  ellipse: ["cx", "cy", "rx", "ry", "fill", "stroke", "stroke-width", "opacity", "transform", "class"],
  rect: ["x", "y", "width", "height", "rx", "ry", "fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "transform", "class"],
  line: ["x1", "y1", "x2", "y2", "stroke", "stroke-width", "stroke-linecap", "opacity", "transform", "class"],
  polyline: ["points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "transform", "class"],
  polygon: ["points", "fill", "stroke", "stroke-width", "opacity", "transform", "class"],
  g: ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "transform", "class"],
  text: ["x", "y", "dx", "dy", "fill", "font-size", "font-weight", "text-anchor", "dominant-baseline", "transform", "class"],
  tspan: ["x", "y", "dx", "dy", "fill", "class"],
  stop: ["offset", "stop-color", "stop-opacity"],
  linearGradient: ["id", "x1", "y1", "x2", "y2", "gradientunits", "gradientUnits"],
  radialGradient: ["id", "cx", "cy", "r", "gradientunits", "gradientUnits"],
  clipPath: ["id"],
  mask: ["id"],
  "*": ["class", "id", "aria-hidden", "aria-label", "aria-labelledby", "aria-describedby", "role", "title", "hidden", "lang", "dir"],
};

/** Only these can appear in href/src. No javascript:, no data: payloads. */
export const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel"];
