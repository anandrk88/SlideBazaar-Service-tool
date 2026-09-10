import Link from "next/link";
import { activeCatalog } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { loadContent } from "@/lib/content-server";
import { loadMedia } from "@/lib/media-server";
import { mediaUrl } from "@/lib/media";
import { roundToDollar } from "@/lib/pricing";
import { Hero } from "@/components/marketing/Hero";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Services } from "@/components/marketing/Services";
import { Faq } from "@/components/marketing/Faq";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [cat, t, media] = await Promise.all([loadCatalog().then(activeCatalog), loadContent(), loadMedia()]);
  // A slot that has never been filled is simply absent, and each section falls
  // back to the drawing it ships with.
  const url = (slot: string) => (media[slot] ? mediaUrl(slot, media[slot].version) : null);

  // Cheapest per-slide price actually orderable today, and the quickest turnaround.
  const combos = cat.treatments.flatMap((t) => cat.tiers.map((tier) => roundToDollar(t.minCents * tier.multiplier)));
  const fromCents = combos.length ? Math.min(...combos) : null;
  const fastest = cat.tiers.reduce<(typeof cat.tiers)[number] | null>((best, t) => (!best || t.days < best.days ? t : best), null);
  const fastestLabel = fastest ? fastest.note : null;

  return (
    <div>
      <Hero fromCents={fromCents} fastestLabel={fastestLabel} t={t} media={{ image: url("hero.image"), video: url("hero.video") }} />

      <BeforeAfter t={t} media={{ before: url("beforeafter.before"), after: url("beforeafter.after") }} />

      <HowItWorks t={t} />

      <Services t={t} />

      {/* Guarantee */}
      <section id="guarantee" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="eyebrow">{t("guarantee.eyebrow")}</p>
              <h2 className="mt-2 text-2xl font-bold">{t("guarantee.title")}</h2>
              <p className="mt-3 text-muted">
                {t("guarantee.body")}
              </p>
              <p className="mt-3 text-muted">{t("guarantee.bodyEstimate")}</p>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["guarantee.card1.title", "guarantee.card1.body"],
                ["guarantee.card2.title", "guarantee.card2.body"],
                ["guarantee.card3.title", "guarantee.card3.body"],
                ["guarantee.card4.title", "guarantee.card4.body"],
              ].map(([titleKey, bodyKey]) => (
                <div key={titleKey} className="rounded-2xl bg-surface p-4">
                  <p className="font-semibold text-accent-700">{t(titleKey)}</p>
                  <p className="mt-1 text-muted">{t(bodyKey)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link href="/order" className="btn-accent !px-8 !py-3 !text-base">
              {t("guarantee.cta")}
            </Link>
            <p className="mt-3 text-sm text-muted">{t("guarantee.ctaNote")}</p>
          </div>
        </div>
      </section>

      <Faq t={t} />
    </div>
  );
}
