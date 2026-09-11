import { activeCatalog } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { roundToDollar } from "@/lib/pricing";
import { Hero } from "@/components/marketing/Hero";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Services } from "@/components/marketing/Services";
import { Faq } from "@/components/marketing/Faq";
import { Guarantee } from "@/components/marketing/Guarantee";
import { HtmlBlock } from "@/components/marketing/HtmlBlock";
import { loadBlocks } from "@/lib/blocks-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [cat, blocks] = await Promise.all([loadCatalog().then(activeCatalog), loadBlocks()]);

  // Cheapest per-slide price actually orderable today, and the quickest turnaround.
  const combos = cat.treatments.flatMap((t) => cat.tiers.map((tier) => roundToDollar(t.minCents * tier.multiplier)));
  const fromCents = combos.length ? Math.min(...combos) : null;
  const fastest = cat.tiers.reduce<(typeof cat.tiers)[number] | null>((best, t) => (!best || t.days < best.days ? t : best), null);
  const fastestLabel = fastest ? fastest.note : null;

  return (
    <div>
      {blocks.hero ? <HtmlBlock html={blocks.hero} invert /> : <Hero fromCents={fromCents} fastestLabel={fastestLabel} />}

      {blocks.beforeafter ? <HtmlBlock html={blocks.beforeafter} /> : <BeforeAfter />}

      {blocks.howitworks ? <HtmlBlock html={blocks.howitworks} /> : <HowItWorks />}

      {blocks.services ? <HtmlBlock html={blocks.services} /> : <Services />}

      {/* Guarantee */}
      {blocks.guarantee ? <HtmlBlock html={blocks.guarantee} /> : <Guarantee />}

      {blocks.faq ? <HtmlBlock html={blocks.faq} /> : <Faq />}
    </div>
  );
}
