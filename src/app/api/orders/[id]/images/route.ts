import { NextResponse } from "next/server";
import path from "node:path";
import JSZip from "jszip";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readStoredFile } from "@/lib/files";

const APPROVED = ["APPROVED", "COMPLETED"];
const isImage = (mime: string) => mime.startsWith("image/");

/** GET /api/orders/:id/images -> zip of the original slide images. Customers only after approval. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const order = await prisma.order.findUnique({ where: { id }, include: { files: { where: { kind: "DELIVERABLE" }, orderBy: { createdAt: "asc" } } } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isStaff(user)) {
    if (order.customerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!APPROVED.includes(order.status)) return NextResponse.json({ error: "Approve the order to download the files" }, { status: 403 });
  }

  const images = order.files.filter((f) => isImage(f.mimeType));
  if (images.length === 0) return NextResponse.json({ error: "No slide images" }, { status: 404 });

  const zip = new JSZip();
  for (const f of images) {
    const ext = path.extname(f.originalName) || ".png";
    const name = f.label ? `${f.label.toLowerCase().replace(/\s+/g, "-")}${ext}` : f.originalName;
    zip.file(name, await readStoredFile(f.storedPath));
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${order.orderNumber}-slides.zip"`,
      "Content-Length": String(buffer.length),
    },
  });
}
