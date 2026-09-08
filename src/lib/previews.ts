import "server-only";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "./db";
import { removeStoredFile } from "./files";
import { putObject } from "./storage";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const MAX_WIDTH = 1280;

export function isPreviewImage(name: string) {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

/** Natural sort so "slide2.png" comes before "slide10.png". */
function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function escapeXml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/** SVG overlay: diagonal repeated text plus a bottom banner. */
function watermarkSvg(width: number, height: number, label: string) {
  const text = escapeXml(`PREVIEW  ·  SlideBazaar  ·  ${label}`);
  const fontSize = Math.max(18, Math.round(width / 26));
  const stepX = fontSize * 16;
  const stepY = fontSize * 5;
  const lines: string[] = [];
  for (let y = -height; y < height * 2; y += stepY) {
    const row = Math.round(y / stepY);
    const offset = row % 2 ? stepX / 2 : 0;
    for (let x = -width + offset; x < width * 2; x += stepX) {
      lines.push(`<text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#16244f" fill-opacity="0.22">${text}</text>`);
    }
  }
  const bannerH = Math.max(30, Math.round(height / 16));
  const bannerFont = Math.max(12, Math.round(bannerH * 0.45));
  const banner = escapeXml(`Watermarked preview. Approve the order to download the original files.  ${label}`);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g transform="rotate(-30 ${width / 2} ${height / 2})">${lines.join("")}</g>
    <rect x="0" y="${height - bannerH}" width="${width}" height="${bannerH}" fill="#16244f" fill-opacity="0.85"/>
    <text x="14" y="${height - bannerH / 2 + bannerFont / 3}" font-size="${bannerFont}" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#ffffff">${banner}</text>
  </svg>`);
}

/**
 * Watermark the slide images a designer uploaded for one draft version and
 * store them as SlidePreview rows (unreleased until QC approves). Any
 * unreleased previews for the same version are replaced.
 */
export async function createPreviewsFromImages(orderId: string, version: number, images: File[], label: string) {
  const relDir = path.posix.join(orderId, "previews", `v${version}`);
  const sorted = [...images].filter((f) => isPreviewImage(f.name)).sort((a, b) => naturalCompare(a.name, b.name));

  // Drop the previous unreleased attempt, files included, so a resubmission
  // with fewer slides cannot leave orphans behind.
  const stale = await prisma.slidePreview.findMany({ where: { orderId, version, released: false }, select: { id: true, storedPath: true } });
  await prisma.slidePreview.deleteMany({ where: { orderId, version, released: false } });
  await Promise.all(stale.map((p) => removeStoredFile(p.storedPath)));

  let index = 0;
  for (const img of sorted) {
    index += 1;
    const input = Buffer.from(await img.arrayBuffer());
    const base = sharp(input, { failOn: "none" }).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).flatten({ background: "#ffffff" });
    const { width = MAX_WIDTH, height = Math.round(MAX_WIDTH * 0.5625) } = await base.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
    const png = await base.composite([{ input: watermarkSvg(width, height, label), top: 0, left: 0 }]).png({ compressionLevel: 8 }).toBuffer();
    const name = `slide-${String(index).padStart(3, "0")}.png`;
    const key = `${relDir}/${name}`;
    await putObject(key, png, "image/png");
    await prisma.slidePreview.create({ data: { orderId, version, index, originalName: img.name, storedPath: key } });
  }
  return index;
}

/** Make a draft version's previews visible to the customer (QC approved). */
export async function releasePreviews(orderId: string, version: number) {
  await prisma.slidePreview.updateMany({ where: { orderId, version }, data: { released: true } });
}
