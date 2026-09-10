import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getObjectStream } from "@/lib/storage";
import { getMedia } from "@/lib/media-server";
import { findMediaSlot } from "@/lib/media";

export const dynamic = "force-dynamic";

/**
 * GET /api/media/:slot  -> the picture or video for a homepage slot.
 *
 * Public on purpose: this is marketing artwork on a public page. It is still
 * served through the app rather than from the bucket directly, so the bucket
 * stays private and customer files can never be reached the same way.
 *
 * The caller names a SLOT, never an object key, and the slot must be one of the
 * fixed set. There is no path an arbitrary key can take through here.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slot: string }> }) {
  const { slot } = await ctx.params;
  if (!findMediaSlot(slot)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const record = await getMedia(slot);
  if (!record) return NextResponse.json({ error: "Not set" }, { status: 404 });

  try {
    const { stream, size } = await getObjectStream(record.key);
    return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
      headers: {
        "Content-Type": record.contentType,
        "Content-Length": String(size),
        // The URL carries a content hash, so a replacement gets a new URL and
        // this can be cached hard.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    console.error(`[media] could not read ${slot}:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
