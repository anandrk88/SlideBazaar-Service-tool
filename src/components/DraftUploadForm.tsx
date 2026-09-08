"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { bytes } from "@/lib/format";
import { UploadIcon, FileIcon } from "@/components/Icons";

const DECK_ACCEPT = ".pptx,.ppt,.potx,.pptm,.key,.pdf,.zip";
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function DraftUploadForm({
  orderId,
  version,
  revisionRequested,
  action,
}: {
  orderId: string;
  version: number;
  revisionRequested: boolean;
  action: (fd: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [decks, setDecks] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedImages = useMemo(() => [...images].sort((a, b) => naturalCompare(a.name, b.name)), [images]);

  async function submit() {
    if (decks.length === 0) return setError("Add the PPTX file");
    if (images.length === 0) return setError("Add the slide images");
    setError(null);
    setBusy(true);
    const fd = new FormData();
    fd.append("orderId", orderId);
    fd.append("note", note);
    decks.forEach((f) => fd.append("files", f));
    sortedImages.forEach((f) => fd.append("previews", f));
    try {
      await action(fd);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5">
      <h3 className="font-semibold text-fuchsia-950">Submit draft {version} for quality check</h3>
      {revisionRequested && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-orange-800 ring-1 ring-orange-200">The customer asked for changes. See their feedback in the messages below.</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DropZone
          title="PPTX file"
          hint="The design file. Unlocked for the customer after approval."
          accept={DECK_ACCEPT}
          files={decks}
          onChange={setDecks}
          render={(f, remove) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileIcon width={18} height={18} className="shrink-0 text-fuchsia-700" />
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-muted">{bytes(f.size)}</span>
              </span>
              <button type="button" onClick={remove} className="text-xs text-rose-600 hover:underline">
                Remove
              </button>
            </li>
          )}
        />
        <DropZone
          title="Slide images"
          hint="One PNG or JPG per slide. Shown to the customer with a watermark."
          accept={IMAGE_ACCEPT}
          files={sortedImages}
          onChange={setImages}
          grid
          render={(f, remove, i) => <Thumb key={`${f.name}-${f.size}`} file={f} index={i + 1} onRemove={remove} />}
        />
      </div>

      <input value={note} onChange={(e) => setNote(e.target.value)} className="input mt-4" placeholder="Note for the QC manager (optional)" />
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={submit} disabled={busy} className="btn-primary !bg-fuchsia-700 hover:!bg-fuchsia-800">
          {busy ? "Uploading..." : "Submit for QC"}
        </button>
        <span className="text-xs text-muted">
          {decks.length} file{decks.length === 1 ? "" : "s"} · {images.length} slide image{images.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function DropZone({
  title,
  hint,
  accept,
  files,
  onChange,
  grid,
  render,
}: {
  title: string;
  hint: string;
  accept: string;
  files: File[];
  onChange: (f: File[]) => void;
  grid?: boolean;
  render: (f: File, remove: () => void, i: number) => React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function add(list: FileList | null) {
    if (!list) return;
    const merged = [...files];
    for (const f of Array.from(list)) if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
    onChange(merged);
  }

  return (
    <div className="rounded-xl border border-fuchsia-200 bg-white p-4">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-3 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed px-4 py-6 text-sm transition ${drag ? "border-fuchsia-500 bg-fuchsia-50" : "border-slate-300 bg-surface hover:border-fuchsia-400"}`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-fuchsia-700 text-white">
          <UploadIcon width={18} height={18} />
        </span>
        <p className="mt-2 font-medium">Drop files here or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 &&
        (grid ? (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{files.map((f, i) => render(f, () => onChange(files.filter((x) => x !== f)), i))}</ul>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">{files.map((f, i) => render(f, () => onChange(files.filter((x) => x !== f)), i))}</ul>
        ))}
    </div>
  );
}

function Thumb({ file, index, onRemove }: { file: File; index: number; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <li className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={file.name} className="aspect-video w-full object-cover" />}
      <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 text-[10px] font-bold text-white">{index}</span>
      <button type="button" onClick={onRemove} className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-[10px] font-semibold text-rose-600 opacity-0 transition group-hover:opacity-100">
        Remove
      </button>
      <p className="truncate px-1.5 py-1 text-[10px] text-muted">{file.name}</p>
    </li>
  );
}
