import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { bytes, dateTime } from "@/lib/format";
import { storageIsEphemeral } from "@/lib/storage";
import { ACCEPTED_MEDIA, MEDIA_SLOTS, mediaUrl } from "@/lib/media";
import { loadMedia } from "@/lib/media-server";
import { clearMediaAction, uploadMediaAction } from "./actions";

export const metadata = { title: "Homepage media | SlideBazaar Admin" };
export const dynamic = "force-dynamic";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireAdmin();
  const { msg, error } = await searchParams;
  const media = await loadMedia();

  const groups = [...new Set(MEDIA_SLOTS.map((s) => s.group))];

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Website</p>
        <h1 className="mt-1 text-2xl font-bold">Homepage media</h1>
        <p className="max-w-3xl text-sm text-muted">
          The pictures and video on the homepage. Every slot has a drawing built in, so the page looks finished while a slot is empty. Upload a file to replace the drawing, or remove it to go back.{" "}
          <Link href="/admin/content" className="font-medium text-accent-700 underline underline-offset-2">
            Wording is edited separately
          </Link>
          .
        </p>
        {msg && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}
        {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {storageIsEphemeral() && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Object storage is not configured, so anything uploaded here is written to local disk and will disappear on the next deploy. Set the R2 variables first.
          </p>
        )}
      </div>

      {groups.map((group) => (
        <section key={group} className="space-y-4">
          <h2 className="text-lg font-bold">{group}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {MEDIA_SLOTS.filter((s) => s.group === group).map((slot) => {
              const current = media[slot.id];
              const rules = ACCEPTED_MEDIA[slot.kind];
              return (
                <div key={slot.id} className="card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{slot.label}</h3>
                    <span className="chip bg-slate-100 text-slate-600">{slot.kind}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{slot.help}</p>

                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-surface">
                    {current ? (
                      slot.kind === "video" ? (
                        <video src={mediaUrl(slot.id, current.version)} className="aspect-video w-full object-cover" muted playsInline controls />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(slot.id, current.version)} alt="" className="aspect-video w-full object-cover" />
                      )
                    ) : (
                      <p className="grid aspect-video place-items-center px-4 text-center text-xs text-muted">Nothing uploaded. {slot.fallback}</p>
                    )}
                  </div>

                  {current && (
                    <p className="mt-2 text-xs text-muted">
                      {current.originalName} · {bytes(current.sizeBytes)} · uploaded {dateTime(new Date(current.uploadedAt))}
                    </p>
                  )}

                  <form action={uploadMediaAction.bind(null, slot.id)} className="mt-4 flex flex-wrap items-center gap-2">
                    <input type="file" name={`file:${slot.id}`} accept={rules.accept} required className="input !py-1.5 text-xs" />
                    <button className="btn-primary !px-3 !py-1.5 !text-xs">{current ? "Replace" : "Upload"}</button>
                  </form>

                  {current && (
                    <form action={clearMediaAction.bind(null, slot.id)} className="mt-2">
                      <button className="text-xs font-medium text-rose-700 hover:underline">Remove and go back to the drawing</button>
                    </form>
                  )}

                  <p className="mt-2 text-[11px] text-muted">
                    {rules.extensions.join(", ")} · up to {rules.maxBytes / 1024 / 1024} MB
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="max-w-3xl text-xs text-muted">
        A note on video: uploads travel through the app, and on Vercel a request body cannot exceed 4.5 MB. Pictures are normally well under that, but most video is not. Until uploads go straight to
        storage, a large video has to be put in the bucket another way.
      </p>
    </div>
  );
}
