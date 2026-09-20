import Link from "next/link";

/**
 * How the money is held and released. Extracted from page.tsx so it can be
 * rendered on its own, which is what lets Admin > Homepage show the section's
 * real markup in the editor.
 */
export function Guarantee() {
  return (
    <section id="guarantee" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <p className="eyebrow">Your money</p>
          <h2 className="mt-2 text-2xl font-bold">Your money is protected</h2>
          <p className="mt-3 text-muted">
            Your payment is held securely by SlideBazaar and is never released until you click &ldquo;Approve&rdquo; on the final designs. If you decline the work or we fall short of your brief, you
            get a 100% refund to your original payment method.
          </p>
          <p className="mt-3 text-muted">
            Not sure about your requirements? Choose &ldquo;Let us decide&rdquo; and we will review your deck to pick the best treatment for you. We hold the upper estimate and refund the difference
            once you approve.
          </p>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            ["Held", "Charged when you place the order, and held by us."],
            ["Released", "Funds move to SlideBazaar when you approve."],
            ["Refunded", "Funds return to you if the work is not accepted."],
            ["Audited", "Every movement is recorded in our internal ledger."],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-surface p-4">
              <p className="font-semibold text-accent-700">{k}</p>
              <p className="mt-1 text-muted">{v}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-10 text-center">
        <Link href="/order" className="btn-accent !px-8 !py-3 !text-base">
          Get an instant estimate
        </Link>
        <p className="mt-3 text-sm text-muted">The wizard prices your deck as you build it. Nothing is charged until you confirm.</p>
      </div>
      </div>
    </section>
  );
}
