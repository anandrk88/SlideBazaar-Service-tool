import Image from "next/image";
import type { OrderEvent, OrderFile, OrderMessage, SlidePreview, User } from "@prisma/client";
import { bytes, dateTime } from "@/lib/format";
import { PROGRESS_STEPS, type OrderStatus } from "@/lib/order-status";
import { CheckIcon, FileIcon } from "@/components/Icons";

export function ProgressBar({ status }: { status: string }) {
  const s = status as OrderStatus;
  if (s === "CANCELLED" || s === "REFUNDED" || s === "PENDING_PAYMENT") return null;
  return (
    <ol className="grid grid-cols-4 gap-2 text-xs">
      {PROGRESS_STEPS.map((step, i) => {
        const reached = step.reached.includes(s);
        const current = reached && !(PROGRESS_STEPS[i + 1]?.reached.includes(s) ?? false);
        return (
          <li key={step.key} className="flex flex-col gap-2">
            <div className={`h-1.5 rounded-full ${reached ? "bg-accent-500" : "bg-slate-200"}`} />
            <span className={`flex items-center gap-1 ${reached ? "font-semibold text-ink" : "text-slate-400"}`}>
              {reached && !current && <CheckIcon width={12} height={12} strokeWidth={3} className="text-accent-600" />}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ events }: { events: (OrderEvent & { actor: Pick<User, "name" | "role"> | null })[] }) {
  if (events.length === 0) return <p className="text-sm text-muted">No activity yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5 text-sm">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-accent-500" />
          <p className="text-ink">{e.message}</p>
          <p className="text-xs text-muted">
            {dateTime(e.createdAt)}
            {e.actor ? ` by ${e.actor.name}${e.actor.role !== "CUSTOMER" ? " (SlideBazaar)" : ""}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function FileList({ files, empty = "No files", downloadable = true }: { files: OrderFile[]; empty?: string; downloadable?: boolean }) {
  if (files.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
      {files.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <FileIcon width={18} height={18} className="shrink-0 text-accent-500" />
            <span className="truncate">
              {f.label ? <span className="mr-1 font-semibold">{f.label}:</span> : null}
              {f.originalName}
            </span>
            <span className="shrink-0 text-xs text-muted">{bytes(f.sizeBytes)}</span>
          </span>
          {downloadable && (
            <a href={`/api/files/${f.id}`} className="shrink-0 text-xs font-semibold text-brand-600 hover:underline">
              Download
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

const isImageFile = (f: OrderFile) => f.mimeType.startsWith("image/");

/** Approved deliverables: design files plus the original slide images with a one-click zip. */
export function DeliverableDownloads({ orderId, files }: { orderId: string; files: OrderFile[] }) {
  const designFiles = files.filter((f) => !isImageFile(f));
  const images = files.filter(isImageFile);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Design files</h3>
        <div className="mt-2">
          <FileList files={designFiles} empty="No design file attached." />
        </div>
      </div>
      {images.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Slide images ({images.length})</h3>
            <a href={`/api/orders/${orderId}/images`} className="btn-outline !py-1.5 !text-xs">
              Download all as zip
            </a>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-brand-600">Individual images</summary>
            <div className="mt-2">
              <FileList files={images} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

export function MessageList({ messages, meId }: { messages: (OrderMessage & { author: Pick<User, "name" | "role"> })[]; meId: string }) {
  if (messages.length === 0) return <p className="text-sm text-muted">No messages yet.</p>;
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const mine = m.authorId === meId;
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-ink text-white" : "bg-surface text-ink"}`}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 text-[11px] ${mine ? "text-brand-200" : "text-muted"}`}>
                {m.author.name}
                {m.author.role !== "CUSTOMER" ? " (SlideBazaar)" : ""} &middot; {dateTime(m.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Grid of watermarked slide images. Click opens the full-size preview in a new tab. */
export function PreviewGallery({ previews, empty = "No previews yet." }: { previews: SlidePreview[]; empty?: string }) {
  if (previews.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {previews.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <a href={`/api/previews/${p.id}`} target="_blank" rel="noreferrer" className="block">
            <Image src={`/api/previews/${p.id}`} alt={`Slide ${p.index}`} width={640} height={360} unoptimized className="aspect-video w-full object-cover" />
          </a>
          <p className="px-3 py-1.5 text-xs text-muted">Slide {p.index}</p>
        </li>
      ))}
    </ul>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
