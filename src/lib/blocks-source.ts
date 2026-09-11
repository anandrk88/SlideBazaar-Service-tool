import "server-only";
import { appUrl } from "./env";

/**
 * The markup each homepage section currently produces.
 *
 * This is read by fetching the homepage and slicing out the section, rather
 * than rendering the components to a string. Rendering them directly does not
 * work: several use next/link, which is a client component and cannot be
 * invoked from the server. Fetching also has the advantage of returning exactly
 * what a browser receives, so what the editor shows is genuinely what the page
 * is made of.
 */

/** Block id -> the id on the rendered <section>. */
const SECTION_IDS: Record<string, string> = {
  hero: "hero",
  beforeafter: "before-after",
  howitworks: "how-it-works",
  services: "services",
  guarantee: "guarantee",
  faq: "faq",
};

/**
 * Pull one <section id="..."> out of a document, matching nested sections
 * properly. A regex cannot do this: several sections contain sections.
 */
function extractSection(html: string, id: string): string | null {
  const open = new RegExp(`<section[^>]*\\sid="${id}"[^>]*>`, "i");
  const start = open.exec(html);
  if (!start) return null;

  let depth = 0;
  let i = start.index;
  const tag = /<(\/?)section\b[^>]*>/gi;
  tag.lastIndex = start.index;

  let match: RegExpExecArray | null;
  while ((match = tag.exec(html)) !== null) {
    depth += match[1] === "/" ? -1 : 1;
    if (depth === 0) {
      i = match.index + match[0].length;
      return html.slice(start.index, i);
    }
  }
  return null;
}

/** Indent block-level tags so the markup is readable in a textarea. */
const BLOCK_TAGS = new Set([
  "section", "div", "header", "footer", "nav", "main", "aside", "article",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "figure", "figcaption", "blockquote", "form", "details", "summary", "hr",
  "svg", "g", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse", "defs",
]);

function formatHtml(html: string): string {
  // Only break between two tags, and only when one of them is block level.
  // Breaking inside a run of inline content adds whitespace the browser would
  // render as a space, which would quietly change the page.
  const withBreaks = html.replace(/>\s*</g, (match, offset: number, full: string) => {
    const after = full.slice(offset + match.length - 1);
    const before = full.slice(0, offset + 1);
    const next = /^<\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(after)?.[1]?.toLowerCase();
    const prev = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^<>]*>$/.exec(before)?.[1]?.toLowerCase();
    const isBlock = (t?: string) => Boolean(t && BLOCK_TAGS.has(t));
    return isBlock(next) || isBlock(prev) ? ">\n<" : match;
  });

  const VOID = new Set(["br", "hr", "img", "input", "source", "col", "meta", "link"]);
  let depth = 0;
  return withBreaks
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (/^<\//.test(trimmed)) depth = Math.max(0, depth - 1);
      const out = "  ".repeat(depth) + trimmed;
      const opening = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(trimmed)?.[1]?.toLowerCase();
      const selfClosing = /\/>$/.test(trimmed);
      const closedOnSameLine = new RegExp(`</${opening}\\s*>$`, "i").test(trimmed);
      if (opening && !selfClosing && !closedOnSameLine && !VOID.has(opening)) depth += 1;
      return out;
    })
    .filter((l) => l.length > 0)
    .join("\n");
}

/**
 * Markup for every section, keyed by block id. Sections that could not be found
 * come back absent, and the editor falls back to its short starter example.
 */
export async function loadBlockSources(): Promise<Record<string, string>> {
  let html: string;
  try {
    const res = await fetch(`${appUrl()}/`, { cache: "no-store" });
    if (!res.ok) throw new Error(`homepage responded ${res.status}`);
    html = await res.text();
  } catch (err) {
    // The admin page must still open if the homepage is briefly unreachable.
    console.error("[blocks] could not read the homepage:", err instanceof Error ? err.message : err);
    return {};
  }

  const out: Record<string, string> = {};
  for (const [blockId, sectionId] of Object.entries(SECTION_IDS)) {
    const section = extractSection(html, sectionId);
    if (section) out[blockId] = formatHtml(section);
  }
  return out;
}
