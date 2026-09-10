import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CONTENT_GROUPS } from "@/lib/content";
import { loadContentOverrides } from "@/lib/content-server";
import { resetAllContentAction, resetFieldAction, saveContentAction } from "./actions";

export const metadata = { title: "Homepage text | SlideBazaar Admin" };
export const dynamic = "force-dynamic";

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const overrides = await loadContentOverrides();
  const editedCount = Object.keys(overrides).length;

  return (
    <form action={saveContentAction} className="space-y-8">
      <div>
        <p className="eyebrow">Website</p>
        <h1 className="mt-1 text-2xl font-bold">Homepage text</h1>
        <p className="max-w-3xl text-sm text-muted">
          Every piece of wording a visitor reads on the homepage. Edit a box and save; the page updates straight away. Leave a box empty to go back to the original wording. Prices, delivery speeds and
          treatment names are not here, because they come from{" "}
          <Link href="/admin/settings" className="font-medium text-accent-700 underline underline-offset-2">
            Pricing &amp; services
          </Link>
          .
        </p>
        {msg && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm">
        <span className="text-muted">
          {editedCount === 0 ? "Every field is currently the original wording." : `${editedCount} field${editedCount === 1 ? "" : "s"} changed from the original.`}
        </span>
        <span className="ml-auto flex gap-2">
          <Link href="/" target="_blank" rel="noreferrer" className="btn-outline !px-3 !py-1.5 !text-xs">
            View the homepage
          </Link>
          <button formAction={resetAllContentAction} className="btn-outline !px-3 !py-1.5 !text-xs" disabled={editedCount === 0}>
            Reset everything
          </button>
        </span>
      </div>

      {CONTENT_GROUPS.map((group) => (
        <section key={group.id} className="card p-6">
          <h2 className="text-lg font-bold">{group.title}</h2>
          <p className="text-sm text-muted">{group.description}</p>

          <div className="mt-5 space-y-5">
            {group.fields.map((field) => {
              const edited = field.key in overrides;
              const current = overrides[field.key] ?? field.value;
              return (
                <div key={field.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <label className="label" htmlFor={field.key}>
                      {field.label}
                      {edited && <span className="ml-2 chip bg-accent-50 text-accent-700">changed</span>}
                    </label>
                    {edited && (
                      // The key is bound rather than sent as a form value, because
                      // React drops a submit button's name/value for server
                      // actions. Unsaved edits in other boxes are lost, the same
                      // as any other navigation away from a form.
                      <button formAction={resetFieldAction.bind(null, field.key)} className="text-xs font-medium text-accent-700 hover:underline">
                        Reset this one
                      </button>
                    )}
                  </div>

                  {field.multiline ? (
                    <textarea id={field.key} name={field.key} defaultValue={current} rows={3} className="input min-h-[5rem]" />
                  ) : (
                    <input id={field.key} name={field.key} defaultValue={current} className="input" />
                  )}

                  <p className="mt-1 text-xs text-muted">
                    {field.help ? `${field.help} ` : ""}
                    {edited ? `Original: ${field.value}` : "This is the original wording."}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Sticky so the button is reachable without scrolling back up a long form. */}
      <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <button className="btn-primary">Save changes</button>
        <span className="text-xs text-muted">Saves every section on this page.</span>
      </div>
    </form>
  );
}
