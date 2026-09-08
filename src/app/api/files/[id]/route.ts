import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { openStoredFile } from "@/lib/files";

const APPROVED_STATUSES = ["APPROVED", "COMPLETED"];

/**
 * GET /api/files/:id  -> streams a file.
 * Staff: everything. Customers: their own uploads always; delivered design
 * files only once they have approved the order (before that they get
 * watermarked previews via /api/previews).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const file = await prisma.orderFile.findUnique({ where: { id }, include: { order: true } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isStaff(user)) {
    if (file.order.customerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // Allow-list rather than deny-list: a new file kind must be opted in.
    if (file.kind === "SOURCE" || file.kind === "STYLE_REFERENCE") {
      // The customer's own upload, always theirs to fetch.
    } else if (file.kind === "DELIVERABLE") {
      if (!APPROVED_STATUSES.includes(file.order.status)) {
        return NextResponse.json({ error: "Approve the order to download the design files" }, { status: 403 });
      }
    } else {
      // DRAFT (awaiting QC) and SUPERSEDED (replaced by a later revision).
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { stream, size } = await openStoredFile(file.storedPath);
  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    },
  });
}
