import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { openStoredFile } from "@/lib/files";

/**
 * GET /api/previews/:id  -> the watermarked PNG of one slide.
 * Staff may see every preview. Customers only see released previews
 * (those that passed quality check) on their own orders.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const preview = await prisma.slidePreview.findUnique({ where: { id }, include: { order: { select: { customerId: true } } } });
  if (!preview) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owner = preview.order.customerId === user.id;
  if (!isStaff(user) && !(owner && preview.released)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { stream, size } = await openStoredFile(preview.storedPath);
  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(size),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="slide-${preview.index}.png"`,
    },
  });
}
