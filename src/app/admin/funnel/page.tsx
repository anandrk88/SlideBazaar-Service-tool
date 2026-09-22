import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { RETENTION, SETTLE_MS, STEPS, lastPurgeAt } from "@/lib/wizard-attempts";

export const metadata = { title: "Order form drop-off | SlideBazaar Admin" };
export const dynamic = "force-dynamic";

/**
 * Where people stop filling in the order form.
 *
 * Two counting rules hold this whole page up, and both are stated on the page
 * itself, because a funnel whose denominators are a mystery gets acted on
 * wrongly:
 *
 *  1. SETTLED. An attempt is finished when it converted, or when nothing has
 *     happened on it for thirty minutes. Anything newer is still in progress and
 *     is shown in its own column only, never inside a ratio. Without this,
 *     everyone currently mid-form is scored as having given up at whatever step
 *     they are on right now, and on a quiet site, which is the site this page
 *     exists to diagnose, that is most of the table.
 *
 *  2. CAME BACK AND BOUGHT. The draft is saved per browser and the attempt id is
 *     per tab, so writing half a brief, closing the tab, and coming back
 *     tomorrow to pay is genuinely two rows. Counting the first as a step 4
 *     loss would blame the brief step for a sale that happened.
 */

const WINDOWS = [7, 30, 90];
/** A guard, not a page size: past this the aggregates would be a lie by omission. */
const MAX_ROWS = 20_000;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function clock(secs: number | null) {
  if (secs === null) return "—";
  const m = Math.floor(secs / 60);
  return `${m}:${String(secs % 60).padStart(2, "0")}`;
}

function parseStepSeconds(v: string | null): Record<number, number> {
  const out: Record<number, number> = {};
  if (!v) return out;
  for (const part of v.split(",")) {
    const [s, n] = part.split(":");
    const step = Number(s);
    const secs = Number(n);
    if (step >= 1 && step <= 5 && Number.isFinite(secs)) out[step] = secs;
  }
  return out;
}

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const { days } = await searchParams;
  const windowDays = WINDOWS.includes(Number(days)) ? Number(days) : 30;

  const now = Date.now();
  const since = new Date(now - windowDays * 86_400_000);

  const rows = await prisma.wizardAttempt.findMany({
    where: { lastSeenAt: { gte: since } },
    select: {
      visitorId: true,
      maxStep: true,
      outcome: true,
      suspect: true,
      lastSeenAt: true,
      blocker: true,
      stepSeconds: true,
      treatment: true,
      createdAt: true,
      submitCount: true,
      signedIn: true,
      reloads: true,
    },
    take: MAX_ROWS + 1,
    orderBy: { lastSeenAt: "desc" },
  });
  const truncated = rows.length > MAX_ROWS;
  const all = truncated ? rows.slice(0, MAX_ROWS) : rows;

  const settled = (r: (typeof all)[number]) => r.outcome !== "OPEN" || now - r.lastSeenAt.getTime() > SETTLE_MS;

  const suspect = all.filter((r) => r.suspect).length;
  const real = all.filter((r) => !r.suspect);
  const inProgress = real.filter((r) => !settled(r));
  const done = real.filter(settled);

  // Browsers that bought at some point in this window. An unfinished attempt
  // from one of them is not a loss.
  const buyers = new Set(done.filter((r) => r.outcome === "CONVERTED" && r.visitorId).map((r) => r.visitorId));
  const unmatchable = done.filter((r) => !r.visitorId && r.outcome === "OPEN").length;

  const converted = done.filter((r) => r.outcome === "CONVERTED");
  const lost = done.filter((r) => r.outcome === "OPEN" && !(r.visitorId && buyers.has(r.visitorId)));

  const reached = (n: number) => done.filter((r) => r.maxStep >= n).length;
  const leftAt = (n: number) => lost.filter((r) => r.maxStep === n).length;
  const openAt = (n: number) => inProgress.filter((r) => r.maxStep === n).length;

  const medianAt = (n: number) => median(done.map((r) => parseStepSeconds(r.stepSeconds)[n]).filter((v): v is number => typeof v === "number" && v > 0));

  const topBlockerAt = (n: number) => {
    const counts = new Map<string, number>();
    for (const r of lost) if (r.maxStep === n && r.blocker) counts.set(r.blocker, (counts.get(r.blocker) ?? 0) + 1);
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? { text: best[0], n: best[1] } : null;
  };

  const funnel = STEPS.map((s) => {
    const r = reached(s.n);
    const l = leftAt(s.n);
    return { ...s, reached: r, left: l, pct: r ? Math.round((l / r) * 100) : null, open: openAt(s.n), secs: medianAt(s.n), blocker: topBlockerAt(s.n) };
  });
  const worst = funnel.reduce<number | null>((acc, f) => (f.pct !== null && (acc === null || f.pct > acc) ? f.pct : acc), null);

  const triedToPay = lost.filter((r) => r.submitCount > 0).length;
  const accountWall = lost.filter((r) => r.maxStep === 5 && !r.signedIn).length;
  const refreshers = lost.filter((r) => r.reloads > 0).length;

  const liveNow = [...inProgress]
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
    .slice(0, 10)
    .map((r) => ({
      step: r.maxStep,
      label: STEPS.find((s) => s.n === r.maxStep)?.label ?? `Step ${r.maxStep}`,
      treatment: r.treatment,
      agoMin: Math.max(0, Math.round((now - r.lastSeenAt.getTime()) / 60_000)),
      settlesInMin: Math.max(0, Math.ceil((SETTLE_MS - (now - r.lastSeenAt.getTime())) / 60_000)),
    }));

  const purged = await lastPurgeAt();

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Order form</p>
        <h1 className="mt-1 text-2xl font-bold">Where people stop</h1>
        <p className="max-w-3xl text-sm text-muted">
          Every run through the order form, including the ones that never became an order. An attempt counts as finished once it becomes an order, or once nothing has happened on it for thirty minutes;
          anything newer is still in progress and is kept out of the percentages.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {WINDOWS.map((d) => (
            <Link key={d} href={`/admin/funnel?days=${d}`} className={`chip ${d === windowDays ? "bg-accent-50 text-accent-700" : "bg-slate-100 text-slate-600"}`}>
              Last {d} days
            </Link>
          ))}
        </div>
      </div>

      {liveNow.length > 0 && (
        <section className="card overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-surface px-5 py-3">
            <p className="text-sm font-semibold">Happening now</p>
            <p className="text-xs text-muted">
              Attempts still in progress. They are not in any figure above yet: each one joins the table once it becomes an order, or once it has been quiet for thirty minutes.
            </p>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {liveNow.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
                <span>
                  <span className="font-medium">
                    Step {r.step} {r.label}
                  </span>
                  {r.treatment && <span className="ml-2 text-xs text-muted">{r.treatment}</span>}
                </span>
                <span className="text-xs text-muted">
                  last seen {r.agoMin === 0 ? "just now" : `${r.agoMin} min ago`} &middot; counts in {r.settlesInMin} min
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!done.length ? (
        // Two different empty states. Collecting-but-nothing-settled is the one
        // you hit the moment this ships, and calling it "nothing recorded" would
        // read as broken while it was in fact working.
        <div className="card p-6 text-sm text-muted">
          {inProgress.length ? (
            <>
              <p className="font-semibold text-ink">
                Collecting. {inProgress.length} {inProgress.length === 1 ? "attempt is" : "attempts are"} in progress, and nothing has settled yet.
              </p>
              <p className="mt-1">Your attempt is listed above. It joins the figures here once it becomes an order, or once it has been quiet for thirty minutes.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">Nothing recorded yet.</p>
              <p className="mt-1">
                An attempt appears once somebody touches the order form and then either orders or goes quiet for thirty minutes. Loading the form without touching it records nothing, and neither does a
                browser sending Do Not Track or Global Privacy Control.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <section className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="border-b border-slate-200 bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Step</th>
                    <th className="px-4 py-3 text-right font-semibold">Reached</th>
                    <th className="px-4 py-3 text-right font-semibold">Left here</th>
                    <th className="px-4 py-3 text-right font-semibold">Of those who reached</th>
                    <th className="px-4 py-3 text-right font-semibold">In progress</th>
                    <th className="px-4 py-3 text-right font-semibold">Median on step</th>
                    <th className="px-4 py-3 font-semibold">Most common reason</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.map((f) => (
                    <tr key={f.n} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-medium">
                        {f.n} {f.label}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{f.reached}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{f.left}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${f.pct !== null && f.pct === worst && f.pct > 0 ? "font-bold text-accent-600" : ""}`}>
                        {f.pct === null ? "—" : `${f.pct}%`}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{f.open || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{clock(f.secs)}</td>
                      <td className="px-4 py-3 text-xs text-muted">{f.blocker ? `${f.blocker.text} (${f.blocker.n})` : "—"}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface font-semibold">
                    <td className="px-4 py-3">Ordered</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{converted.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{done.length ? `${Math.round((converted.length / done.length) * 100)}%` : "—"}</td>
                    <td className="px-4 py-3" colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <Stat label="Pressed Pay and did not get through" value={triedToPay} of={lost.length} note="the most expensive loss here: they had decided" />
            <Stat label="Reached payment while signed out" value={accountWall} of={lost.length} note="the account wall, which shows no error message at all" />
            <Stat label="Refreshed the form" value={refreshers} of={lost.length} note="the step is not saved, so a refresh returns them to step 1" />
          </section>

          <section className="card p-5 text-xs text-muted">
            <p className="font-semibold text-ink">How to read this</p>
            <ul className="mt-2 space-y-1">
              <li>
                <strong className="text-ink">{done.length}</strong> finished attempts in this window, <strong className="text-ink">{inProgress.length}</strong> still in progress and excluded from every
                percentage above.
              </li>
              <li>
                &ldquo;Reached&rdquo; includes people who went on to order, because they are the denominator. &ldquo;Left here&rdquo; counts only attempts that ended without an order and whose browser
                did not order on another attempt in this window.
              </li>
              {unmatchable > 0 && (
                <li>
                  <strong className="text-ink">{unmatchable}</strong> unfinished attempts had no browser id, so if those people came back and bought in a different tab, this page cannot tell and counts
                  them as lost.
                </li>
              )}
              {suspect > 0 && (
                <li>
                  <strong className="text-ink">{suspect}</strong> attempts looked automated and were excluded from everything above.
                </li>
              )}
              {truncated && (
                <li className="text-rose-700">
                  More than {MAX_ROWS.toLocaleString()} attempts in this window. Only the most recent {MAX_ROWS.toLocaleString()} are counted, so these numbers are low. Narrow the window.
                </li>
              )}
              <li>
                What people typed is cleared {RETENTION.contentDays} days after they last used the form, and immediately when they order; the rest of the row goes at {RETENTION.rowDays} days.{" "}
                {purged ? `Last applied ${dateTime(purged)}.` : "Not applied yet: it runs when the form is used, or run npm run wizard:purge."}
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, of, note }: { label: string; value: number; of: number; note: string }) {
  return (
    <div className="card p-5">
      <p className="text-2xl font-bold tabular-nums">
        {value}
        {of > 0 && <span className="ml-2 text-sm font-normal text-muted">of {of} lost</span>}
      </p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
