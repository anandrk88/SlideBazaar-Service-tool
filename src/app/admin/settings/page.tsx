import { requireAdmin } from "@/lib/auth";
import { loadCatalog } from "@/lib/catalog-server";
import { ICON_PRESETS, NO_TEXT_SERVICE_ID, RANGE_TREATMENT_ID, SWATCH_PRESETS, TINT_PRESETS } from "@/lib/catalog";
import { TreatmentIcon } from "@/components/Icons";
import { addStyle, addTreatment, saveStyle, saveTextService, saveTier, saveTreatment } from "./actions";

export const metadata = { title: "Pricing & services | SlideBazaar Admin" };
export const dynamic = "force-dynamic";

const dollars = (cents: number) => (cents / 100).toFixed(2);

export default async function SettingsPage() {
  await requireAdmin();
  const cat = await loadCatalog();

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-1 text-2xl font-bold">Pricing &amp; services</h1>
        <p className="text-sm text-muted">
          What the order wizard offers and what it charges. Prices are per slide at the standard delivery speed; faster speeds multiply them. Changes apply to new orders only. Turn an option off instead
          of deleting it so past orders keep their labels. The homepage screenshot in the &ldquo;How it works&rdquo; section shows these treatments and prices, so it needs re-taking when they change.
        </p>
      </div>

      {/* Treatments */}
      <section>
        <h2 className="text-lg font-bold">Treatments</h2>
        <p className="text-sm text-muted">Step 1 of the wizard. &ldquo;Let us decide&rdquo; has a price range; the upper bound is held in escrow.</p>
        <div className="mt-4 space-y-3">
          {cat.treatments.map((t) => (
            <form key={t.id} action={saveTreatment} className={`card p-5 ${t.enabled ? "" : "opacity-70"}`}>
              <input type="hidden" name="id" value={t.id} />
              <div className="grid gap-4 lg:grid-cols-[56px_1fr_1fr]">
                <span className={`grid h-14 w-14 place-items-center rounded-2xl ${t.tint}`}>
                  <TreatmentIcon icon={t.icon} width={28} height={28} />
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Name</label>
                    <input name="name" defaultValue={t.name} className="input" required />
                  </div>
                  <div>
                    <label className="label">Badge (optional)</label>
                    <input name="badge" defaultValue={t.badge ?? ""} className="input" placeholder="Most popular" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Tagline</label>
                    <input name="tagline" defaultValue={t.tagline} className="input" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Description</label>
                    <textarea name="description" defaultValue={t.description} rows={2} className="input" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">{t.id === RANGE_TREATMENT_ID ? "From, $ per slide" : "$ per slide"}</label>
                    <input name="min" type="number" step="0.01" min="0" defaultValue={dollars(t.minCents)} className="input" required />
                  </div>
                  {t.id === RANGE_TREATMENT_ID ? (
                    <div>
                      <label className="label">To, $ per slide (held in escrow)</label>
                      <input name="max" type="number" step="0.01" min="0" defaultValue={dollars(t.maxCents)} className="input" required />
                    </div>
                  ) : (
                    <div />
                  )}
                  <div>
                    <label className="label">Order</label>
                    <input name="sortOrder" type="number" defaultValue={t.sortOrder} className="input" />
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="enabled" defaultChecked={t.enabled} className="accent-accent-500" /> Offered
                    </label>
                    <button className="btn-primary !py-2">Save</button>
                  </div>
                  <p className="text-xs text-muted sm:col-span-2">Code: {t.id}</p>
                </div>
              </div>
            </form>
          ))}
        </div>

        <details className="card mt-4 p-5">
          <summary className="cursor-pointer font-semibold">Add a treatment</summary>
          <form action={addTreatment} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input name="name" className="input" required placeholder="Animation" />
            </div>
            <div>
              <label className="label">$ per slide</label>
              <input name="price" type="number" step="0.01" min="0.01" className="input" required />
            </div>
            <div>
              <label className="label">Tagline</label>
              <input name="tagline" className="input" placeholder="Bring your slides to life" />
            </div>
            <div>
              <label className="label">Icon</label>
              <select name="icon" className="input" defaultValue="palette">
                {ICON_PRESETS.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea name="description" rows={2} className="input" />
            </div>
            <div>
              <label className="label">Colour</label>
              <select name="tint" className="input" defaultValue={TINT_PRESETS[2].id}>
                {TINT_PRESETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn-accent">Add treatment</button>
            </div>
          </form>
        </details>
      </section>

      {/* Styles */}
      <section>
        <h2 className="text-lg font-bold">Styles</h2>
        <p className="text-sm text-muted">Step 2 of the wizard. A style that requires an upload asks the customer for their own template.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {cat.styles.map((s) => (
            <form key={s.id} action={saveStyle} className={`card p-5 ${s.enabled ? "" : "opacity-70"}`}>
              <input type="hidden" name="id" value={s.id} />
              <div className="flex gap-4">
                <div className={`relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${s.swatch}`}>
                  <span className={`absolute left-2 top-2 h-1.5 w-6 rounded ${s.accent}`} />
                </div>
                <div className="grid flex-1 gap-3">
                  <div>
                    <label className="label">Name</label>
                    <input name="name" defaultValue={s.name} className="input" required />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea name="description" defaultValue={s.description} rows={2} className="input" />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="requiresUpload" defaultChecked={s.requiresUpload} className="accent-accent-500" /> Customer uploads template
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="enabled" defaultChecked={s.enabled} className="accent-accent-500" /> Offered
                    </label>
                    <label className="flex items-center gap-2">
                      Order <input name="sortOrder" type="number" defaultValue={s.sortOrder} className="input !w-20 !py-1" />
                    </label>
                    <button className="btn-primary !py-2">Save</button>
                  </div>
                </div>
              </div>
            </form>
          ))}
        </div>
        <details className="card mt-4 p-5">
          <summary className="cursor-pointer font-semibold">Add a style</summary>
          <form action={addStyle} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input name="name" className="input" required placeholder="Minimal" />
            </div>
            <div>
              <label className="label">Colour swatch</label>
              <select name="swatch" className="input" defaultValue={SWATCH_PRESETS[0].id}>
                {SWATCH_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea name="description" rows={2} className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requiresUpload" className="accent-accent-500" /> Customer uploads their own template
            </label>
            <div className="flex justify-end">
              <button className="btn-accent">Add style</button>
            </div>
          </form>
        </details>
      </section>

      {/* Delivery */}
      <section>
        <h2 className="text-lg font-bold">Delivery speeds</h2>
        <p className="text-sm text-muted">Step 3 of the wizard. Multiplier 1.5 means 50% on top of the standard per-slide price. Days are business days from the order.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {cat.tiers.map((t) => (
            <form key={t.id} action={saveTier} className={`card grid gap-3 p-5 ${t.enabled ? "" : "opacity-70"}`}>
              <input type="hidden" name="id" value={t.id} />
              <div>
                <label className="label">Name</label>
                <input name="name" defaultValue={t.name} className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Business days</label>
                  <input name="days" type="number" min="1" max="30" defaultValue={t.days} className="input" required />
                </div>
                <div>
                  <label className="label">Multiplier</label>
                  <input name="multiplier" type="number" step="0.05" min="0.1" max="5" defaultValue={t.multiplier} className="input" required />
                </div>
              </div>
              <div>
                <label className="label">Note shown on the card</label>
                <input name="note" defaultValue={t.note} className="input" />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="enabled" defaultChecked={t.enabled} className="accent-accent-500" /> Offered
                </label>
                <label className="flex items-center gap-2">
                  Order <input name="sortOrder" type="number" defaultValue={t.sortOrder} className="input !w-20 !py-1" />
                </label>
                <button className="btn-primary ml-auto !py-2">Save</button>
              </div>
            </form>
          ))}
        </div>
      </section>

      {/* Text services */}
      <section>
        <h2 className="text-lg font-bold">Text services</h2>
        <p className="text-sm text-muted">Optional add-ons in step 3, priced per slide. &ldquo;No thanks&rdquo; is always available.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {cat.textServices.map((p) => (
            <form key={p.id} action={saveTextService} className={`card grid gap-3 p-5 ${p.enabled ? "" : "opacity-70"}`}>
              <input type="hidden" name="id" value={p.id} />
              <div>
                <label className="label">Name</label>
                <input name="name" defaultValue={p.name} className="input" required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea name="description" defaultValue={p.description} rows={2} className="input" />
              </div>
              {p.id !== NO_TEXT_SERVICE_ID && (
                <div>
                  <label className="label">$ per slide</label>
                  <input name="price" type="number" step="0.01" min="0" defaultValue={dollars(p.perSlideCents)} className="input" required />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {p.id !== NO_TEXT_SERVICE_ID && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="enabled" defaultChecked={p.enabled} className="accent-accent-500" /> Offered
                  </label>
                )}
                <label className="flex items-center gap-2">
                  Order <input name="sortOrder" type="number" defaultValue={p.sortOrder} className="input !w-20 !py-1" />
                </label>
                <button className="btn-primary ml-auto !py-2">Save</button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
