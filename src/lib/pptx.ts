/**
 * Browser-side PPTX reader. Extracts the slide count, slide titles and the
 * presentation title from a .pptx File without uploading it anywhere.
 */
import JSZip from "jszip";

export interface DeckSummary {
  title: string;
  slides: { n: number; title: string }[];
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Text of the title placeholder, falling back to the first text run on the slide. */
function slideTitle(xml: string): string {
  const shapes = xml.split("<p:sp>").slice(1);
  const textOf = (shape: string) =>
    decodeXml(
      Array.from(shape.matchAll(/<a:t>([^<]*)<\/a:t>/g))
        .map((m) => m[1])
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  const titled = shapes.find((s) => /<p:ph[^>]*type="(title|ctrTitle)"/.test(s));
  if (titled) {
    const t = textOf(titled);
    if (t) return t;
  }
  for (const s of shapes) {
    const t = textOf(s);
    if (t) return t.slice(0, 80);
  }
  return "";
}

export async function readPptx(file: File): Promise<DeckSummary> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const presentation = await zip.file("ppt/presentation.xml")?.async("string");
  if (!presentation) throw new Error("This does not look like a PowerPoint (.pptx) file");

  // Slide order comes from sldIdLst -> relationship ids -> slide part names.
  const rels = (await zip.file("ppt/_rels/presentation.xml.rels")?.async("string")) ?? "";
  const relMap = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\s+[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"[^>]*?\/>/g)) {
    relMap.set(m[1], m[2]);
  }
  // Attributes may appear in any order; handle Target before Id too.
  for (const m of rels.matchAll(/<Relationship\s+[^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"[^>]*?\/>/g)) {
    if (!relMap.has(m[2])) relMap.set(m[2], m[1]);
  }

  const ids = Array.from(presentation.matchAll(/<p:sldId\s+[^>]*r:id="([^"]+)"/g)).map((m) => m[1]);
  let paths = ids.map((id) => relMap.get(id)).filter((p): p is string => Boolean(p)).map((p) => `ppt/${p.replace(/^\/?ppt\//, "")}`);

  if (paths.length === 0) {
    paths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  }

  const slides: DeckSummary["slides"] = [];
  for (let i = 0; i < paths.length; i++) {
    const xml = (await zip.file(paths[i])?.async("string")) ?? "";
    slides.push({ n: i + 1, title: slideTitle(xml) });
  }

  const core = (await zip.file("docProps/core.xml")?.async("string")) ?? "";
  const docTitle = decodeXml(core.match(/<dc:title>([^<]*)<\/dc:title>/)?.[1] ?? "");
  return { title: docTitle || slides[0]?.title || file.name.replace(/\.pptx?$/i, ""), slides };
}
