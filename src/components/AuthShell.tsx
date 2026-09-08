import Image from "next/image";
import Link from "next/link";
import { LockIcon, ShieldCheckIcon, TasksIcon } from "@/components/Icons";

/** Full-screen split layout for login and signup: brand panel left, form right. No site header. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-500/40 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        <div className="relative">
          <p className="eyebrow !text-accent-400">Custom design services</p>
          <h2 className="mt-4 max-w-lg text-4xl font-bold leading-tight xl:text-5xl">Your slides, designed by people.</h2>
          <p className="mt-2 max-w-lg text-4xl font-bold leading-tight text-accent-400 xl:text-5xl">Paid for only when you approve.</p>
          <p className="mt-6 max-w-md text-lg text-brand-100">Upload your deck, choose a treatment and a deadline. Our designers get to work while we hold your payment until you approve.</p>
        </div>

        <ul className="relative mt-12 space-y-6">
          {[
            { Icon: LockIcon, title: "Approval protected", body: "We hold your payment and treat it as earned only when you approve. Full refund if you do not." },
            { Icon: ShieldCheckIcon, title: "Quality checked", body: "Every draft passes a QC manager, and you preview it before you download." },
            { Icon: TasksIcon, title: "Fast turnaround", body: "First draft in one to three business days. Revisions within a day." },
          ].map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-accent-400 ring-1 ring-white/10">
                <Icon width={22} height={22} />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-brand-200">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="relative mt-12 text-xs text-brand-300">From the team behind SlideBazaar: ten years of presentation design and a library of 50,000+ templates.</p>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col bg-white">
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/slidebazaar-logo.svg" alt="SlideBazaar" width={152} height={32} priority className="h-8 w-auto" />
            <span className="hidden border-l border-slate-200 pl-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted sm:inline">Design Services</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-muted hover:text-ink">
            Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="mt-2 text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>

        <p className="px-6 py-5 text-center text-xs text-muted sm:px-10">
          Need help?{" "}
          <a href="mailto:support@slidebazaar.com" className="font-semibold text-brand-600 hover:underline">
            support@slidebazaar.com
          </a>
        </p>
      </section>
    </div>
  );
}
