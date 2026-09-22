import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { modeFor, sendPabbly } from "@/lib/pabbly";
import { orderPlacedEvent } from "@/lib/pabbly-events";
import { sweepAbandoned } from "@/lib/pabbly-sweep";
import { removeOrderFiles, storeUpload, validateUploadBatch } from "@/lib/files";
import { createOrder } from "@/lib/orders";
import { createCheckoutUrl } from "@/lib/checkout";
import { orderSchema } from "@/lib/validation";
import { loadCatalog } from "@/lib/catalog-server";
import { activeCatalog } from "@/lib/catalog";

/**
 * POST /api/orders  (multipart/form-data)
 * Creates the order from the wizard, stores uploaded files and returns the
 * checkout URL the customer must be redirected to.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in or create an account first", code: "NOT_SIGNED_IN" }, { status: 401 });

  const form = await req.formData();
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") fields[k] = v;

  const parsed = orderSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid order", code: "INVALID_ORDER" }, { status: 400 });
  }
  const data = parsed.data;

  // Only options that are currently offered may be ordered.
  const cat = activeCatalog(await loadCatalog());
  const style = cat.styles.find((s) => s.id === data.style);
  if (!cat.treatments.some((t) => t.id === data.treatment)) return NextResponse.json({ error: "That treatment is not available", code: "TREATMENT_UNAVAILABLE" }, { status: 400 });
  if (!style) return NextResponse.json({ error: "That style is not available", code: "STYLE_UNAVAILABLE" }, { status: 400 });
  if (!cat.tiers.some((t) => t.id === data.deliveryTier)) return NextResponse.json({ error: "That delivery option is not available", code: "DELIVERY_UNAVAILABLE" }, { status: 400 });
  if (!cat.textServices.some((t) => t.id === data.proofreading)) return NextResponse.json({ error: "That text service is not available", code: "TEXT_SERVICE_UNAVAILABLE" }, { status: 400 });

  const sourceFiles = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const styleFiles = form.getAll("styleFiles").filter((f): f is File => f instanceof File && f.size > 0);

  if (sourceFiles.length === 0 && !data.googleSlidesUrl) {
    return NextResponse.json({ error: "Please upload your presentation or provide a Google Slides link", code: "NO_SOURCE" }, { status: 400 });
  }
  if (style.requiresUpload && styleFiles.length === 0) {
    return NextResponse.json({ error: `Please upload your template for the ${style.name} option`, code: "NO_TEMPLATE" }, { status: 400 });
  }

  // Validate the whole batch before creating anything, so a rejected upload
  // never leaves a half-built order behind.
  try {
    validateUploadBatch([...sourceFiles, ...styleFiles]);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Those files were not accepted", code: "FILE_REJECTED" }, { status: 400 });
  }

  const customer = await prisma.user.update({
    where: { id: user.id },
    data: {
      billingAddress: data.billingAddress || undefined,
      billingCity: data.billingCity || undefined,
      billingCountry: data.billingCountry || undefined,
      billingVat: data.billingVat || undefined,
    },
  });

  const order = await createOrder({ ...data, customerId: user.id });

  try {
    for (const f of sourceFiles) {
      const stored = await storeUpload(order.id, f);
      await prisma.orderFile.create({ data: { ...stored, orderId: order.id, uploadedById: user.id, kind: "SOURCE" } });
    }
    for (const f of styleFiles) {
      const stored = await storeUpload(order.id, f);
      await prisma.orderFile.create({ data: { ...stored, orderId: order.id, uploadedById: user.id, kind: "STYLE_REFERENCE" } });
    }
  } catch (err) {
    await prisma.order.delete({ where: { id: order.id } });
    await removeOrderFiles(order.id);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed", code: "UPLOAD_FAILED" }, { status: 400 });
  }

  // Close out the wizard attempt this order came from.
  //
  // Here rather than from the browser, because the wizard navigates to checkout
  // the moment it has this response and a beacon fired into a navigation is the
  // one you cannot rely on. After the upload block rather than straight after
  // createOrder, because a rejected upload deletes the order again, and that is
  // a drop-off worth seeing rather than a conversion.
  //
  // The text is cleared in the same statement: the order now holds it, and one
  // copy is enough. Everything structural survives, because converted attempts
  // are the denominator of every percentage on the report. Wrapped whole, since
  // tracking must never be able to fail an order somebody has paid for.
  try {
    const attemptId = fields.attemptId;
    if (attemptId) {
      const now = new Date();
      await prisma.wizardAttempt.updateMany({
        where: { attemptId, outcome: "OPEN" },
        data: {
          outcome: "CONVERTED",
          orderId: order.id,
          convertedAt: now,
          contentPurgedAt: now,
          lastSeenAt: now,
          step: 5,
          maxStep: 5,
          blocker: null,
          brief: null,
          audience: null,
          brandNotes: null,
          fontsColors: null,
          extraNotes: null,
        },
      });
    }
  } catch (err) {
    console.error("[orders] wizard attempt close-out failed", err);
  }

  // After the upload block, not straight after createOrder: the upload failure
  // path deletes the order again, and a webhook there would announce orders
  // that no longer exist.
  after(async () => {
    if ((await modeFor("order.placed")) !== "off") {
      await sendPabbly(
        orderPlacedEvent({
          id: order.id,
          orderNumber: order.orderNumber,
          treatment: data.treatment,
          style: data.style,
          slideCount: data.slideCount,
          deliveryTier: data.deliveryTier,
          totalCents: order.totalCents,
          deadlineAt: order.deadlineAt,
          createdAt: order.createdAt,
          customerEmail: user.email,
          customerName: user.name,
        }),
      );
    }
    // A conversion is traffic, so it is also a chance to notice abandonments.
    await sweepAbandoned();
  });

  // If checkout cannot be created the order still exists and is payable from
  // the dashboard, so tell the customer that rather than leaving them to retry
  // the whole wizard and create a duplicate order.
  try {
    const checkoutUrl = await createCheckoutUrl(order, customer);
    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber, checkoutUrl });
  } catch (err) {
    console.error("checkout creation failed", err);
    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutUrl: `/dashboard/orders/${order.id}`,
        warning: `Your order ${order.orderNumber} was saved but we could not open the payment page. Open it from your dashboard to pay.`,
      },
      { status: 200 },
    );
  }
}
