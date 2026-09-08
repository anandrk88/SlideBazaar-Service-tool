import Link from "next/link";
import { activeCatalog, NO_TEXT_SERVICE_ID } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { roundToDollar } from "@/lib/pricing";
import { money, moneyRange } from "@/lib/format";
import { TreatmentIcon, LockIcon, CheckIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cat = activeCatalog(await loadCatalog());
  const addons = cat.textServices.filter((p) => p.id !== NO_TEXT_SERVICE_ID && p.perSlideCents > 0);
  return (
    <div>
      {/* Hero */}
      <section className="bg-brand-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow !text-accent-400">Custom design services</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Your slides, designed by people, delivered in as little as a day.</h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">Pick a treatment, choose a look, tell us when you need it. We hold your payment until you approve the finished deck, and refund it in full if you do not.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/order" className="btn-accent !px-7 !py-3 !text-base">
                Start your order
              </Link>
              <Link href="#pricing" className="btn !px-7 !py-3 !text-base border border-brand-500 text-white hover:bg-brand-800">
                See pricing
              </Link>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-brand-100 sm:grid-cols-2">
              {["Priced per slide, no minimums", "Unlimited revisions within the brief", "First draft in 1 to 3 business days", "PowerPoint, Google Slides and Keynote"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckIcon width={18} height={18} className="mt-0.5 shrink-0 text-accent-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-brand-700 bg-white/5 p-6 text-sm text-brand-100">
            <div className="mb-4 flex items-center gap-2 text-white">
              <LockIcon width={22} height={22} className="text-accent-400" />
              <span className="font-semibold">How payment works</span>
            </div>
            <ol className="space-y-4">
              {[
                ["1", "You pay upfront", "The estimate is charged to your card and held by SlideBazaar."],
                ["2", "We design", "A designer is assigned and your first draft is delivered by the deadline."],
                ["3", "You review", "Request revisions until it is right. Nothing is released yet."],
                ["4", "You approve", "Only then is the payment released to us. Not happy? You get refunded."],
              ].map(([n, title, body]) => (
                <li key={n} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-500 text-xs font-bold text-white">{n}</span>
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="eyebrow">Treatments</p>
        <h2 className="mt-2 text-2xl font-bold">How much should we change?</h2>
        <p className="mt-2 text-muted">Every order is priced per slide. Pick the level of work, we do the rest.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cat.treatments.map((t) => (
            <div key={t.id} className="card p-6">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl ${t.tint}`}>
                <TreatmentIcon icon={t.icon} width={30} height={30} />
              </span>
              <h3 className="mt-4 text-lg font-bold">{t.name}</h3>
              <p className="text-sm font-medium text-ink/80">{t.tagline}</p>
              <p className="mt-2 text-sm text-muted">{t.description}</p>
              <p className="mt-4 text-2xl font-bold">{moneyRange(t.minCents, t.maxCents)}</p>
              <p className="text-xs text-muted">per slide, standard delivery</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-2 text-2xl font-bold">Transparent, per slide</h2>
          <p className="mt-2 text-muted">The price depends on the treatment and how fast you need it. Get a live estimate in the order wizard.</p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-muted">
                  <th className="py-3 pr-4 font-medium">Treatment</th>
                  {cat.tiers.map((tier) => (
                    <th key={tier.id} className="py-3 pr-4 font-medium">
                      {tier.name} <span className="font-normal">({tier.note.toLowerCase()})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cat.treatments.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold">{t.name}</td>
                    {cat.tiers.map((tier) => (
                      <td key={tier.id} className="py-3 pr-4">
                        {moneyRange(roundToDollar(t.minCents * tier.multiplier), roundToDollar(t.maxCents * tier.multiplier))} <span className="text-muted">/ slide</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {addons.length > 0 && <p className="mt-4 text-sm text-muted">Optional add-ons: {addons.map((p) => `${p.name} ${money(p.perSlideCents)} per slide`).join(", ")}.</p>}
        </div>
      </section>

      {/* Guarantee */}
      <section id="guarantee" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="card grid gap-8 p-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Your money</p>
            <h2 className="mt-2 text-2xl font-bold">Your money is protected</h2>
            <p className="mt-3 text-muted">
              Your order total is charged upfront and held by SlideBazaar. We do not treat it as earned until you click Approve on your final designs. If you do not approve, or we cannot deliver what you
              asked for, it is refunded in full to your original payment method. This is our own money-back guarantee, not a third-party escrow service.
            </p>
            <p className="mt-3 text-muted">Chose &ldquo;Let us decide&rdquo;? We hold the upper estimate and refund the difference when you approve.</p>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Held", "Charged when you place the order, and held by us."],
              ["Released", "Funds move to SlideBazaar when you approve."],
              ["Refunded", "Funds return to you if the work is not accepted."],
              ["Audited", "Every movement is recorded in our internal ledger."],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-surface p-4">
                <p className="font-semibold text-accent-600">{k}</p>
                <p className="mt-1 text-muted">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 text-center">
          <Link href="/order" className="btn-accent !px-8 !py-3 !text-base">
            Get an instant estimate
          </Link>
        </div>
      </section>
    </div>
  );
}
