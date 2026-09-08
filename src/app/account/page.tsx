import { ROLE_LABELS, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listCards } from "@/lib/cards";
import { mockPaymentsActive } from "@/lib/stripe";
import { LockIcon } from "@/components/Icons";
import { addCardAction, addTestCardAction, changePasswordAction, removeCardAction, saveBillingAction, saveProfileAction, setDefaultCardAction } from "./actions";

export const metadata = { title: "Account | SlideBazaar" };
export const dynamic = "force-dynamic";

const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover", diners: "Diners Club", jcb: "JCB", unionpay: "UnionPay" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string; card?: string }> }) {
  const session = await requireUser("/account");
  const { msg, error, card } = await searchParams;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  const cards = await listCards(user);
  const live = !mockPaymentsActive();
  const isCustomer = user.role === "CUSTOMER";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Account</p>
      <h1 className="mt-1 text-2xl font-bold">Your profile</h1>
      <p className="text-sm text-muted">
        {user.email} · {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
      </p>

      {msg && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}
      {card === "added" && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Card saved.</p>}
      {card === "cancelled" && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Card setup was cancelled.</p>}
      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <form action={saveProfileAction} className="card p-6">
          <h2 className="font-semibold">Personal details</h2>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="label">Full name</label>
              <input name="name" defaultValue={user.name} className="input" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={user.email} className="input bg-surface" readOnly />
              <p className="mt-1 text-xs text-muted">Contact support to change the email on your account.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Phone</label>
                <input name="phone" defaultValue={user.phone ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Company</label>
                <input name="company" defaultValue={user.company ?? ""} className="input" />
              </div>
            </div>
            {isCustomer && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="marketingOptIn" defaultChecked={user.marketingOptIn} className="accent-accent-500" /> Send me occasional emails about new services and offers
              </label>
            )}
          </div>
          <button className="btn-primary mt-5">Save details</button>
        </form>

        {/* Password */}
        <form action={changePasswordAction} className="card p-6">
          <h2 className="font-semibold">Password</h2>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="label">Current password</label>
              <input name="current" type="password" className="input" required autoComplete="current-password" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">New password</label>
                <input name="next" type="password" className="input" required minLength={8} autoComplete="new-password" />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input name="confirm" type="password" className="input" required minLength={8} autoComplete="new-password" />
              </div>
            </div>
          </div>
          <button className="btn-outline mt-5">Change password</button>
        </form>

        {isCustomer && (
          <>
            {/* Billing */}
            <form action={saveBillingAction} className="card p-6">
              <h2 className="font-semibold">Billing details</h2>
              <p className="text-xs text-muted">Printed on your invoices. Pre-filled on your next order.</p>
              <div className="mt-4 grid gap-4">
                <div>
                  <label className="label">Address</label>
                  <input name="billingAddress" defaultValue={user.billingAddress ?? ""} className="input" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">City</label>
                    <input name="billingCity" defaultValue={user.billingCity ?? ""} className="input" />
                  </div>
                  <div>
                    <label className="label">Country</label>
                    <input name="billingCountry" defaultValue={user.billingCountry ?? ""} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">VAT / Tax ID</label>
                  <input name="billingVat" defaultValue={user.billingVat ?? ""} className="input" />
                </div>
              </div>
              <button className="btn-primary mt-5">Save billing details</button>
            </form>

            {/* Cards */}
            <section className="card p-6">
              <div className="flex items-center gap-2">
                <LockIcon width={18} height={18} className="text-accent-600" />
                <h2 className="font-semibold">Payment methods</h2>
              </div>
              <p className="text-xs text-muted">
                {live
                  ? "Cards are stored securely by Stripe. SlideBazaar never sees your card number. Your default card is offered first at checkout."
                  : "Test mode: Stripe is not configured, so these are placeholder cards for trying the flow. No card numbers are stored."}
              </p>

              <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {cards.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No saved cards yet.</li>}
                {cards.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="grid h-8 w-12 place-items-center rounded-md bg-ink text-[10px] font-bold uppercase text-white">{(BRANDS[c.brand.toLowerCase()] ?? c.brand).slice(0, 4)}</span>
                    <span>
                      <span className="font-semibold">{BRANDS[c.brand.toLowerCase()] ?? c.brand}</span> ending {c.last4}
                      <span className="ml-2 text-muted">
                        exp {String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}
                      </span>
                    </span>
                    {c.isDefault ? (
                      <span className="chip bg-emerald-100 text-emerald-800">Default</span>
                    ) : (
                      <form action={setDefaultCardAction}>
                        <input type="hidden" name="cardId" value={c.id} />
                        <button className="text-xs font-semibold text-brand-600 hover:underline">Make default</button>
                      </form>
                    )}
                    <form action={removeCardAction} className="ml-auto">
                      <input type="hidden" name="cardId" value={c.id} />
                      <button className="text-xs text-rose-600 hover:underline">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>

              {live ? (
                <form action={addCardAction} className="mt-4">
                  <button className="btn-accent">Add a card</button>
                  <p className="mt-2 text-xs text-muted">Opens a secure Stripe page and returns you here.</p>
                </form>
              ) : (
                <form action={addTestCardAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_80px_90px_auto]">
                  <select name="brand" className="input" defaultValue="Visa">
                    <option>Visa</option>
                    <option>Mastercard</option>
                    <option>Amex</option>
                  </select>
                  <input name="last4" className="input" placeholder="Last 4" maxLength={4} defaultValue="4242" />
                  <input name="expMonth" type="number" min="1" max="12" className="input" defaultValue={12} />
                  <input name="expYear" type="number" min={new Date().getFullYear()} className="input" defaultValue={new Date().getFullYear() + 3} />
                  <button className="btn-accent">Add test card</button>
                </form>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
