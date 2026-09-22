import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { dateTime } from "@/lib/format";
import { type Mode, NOTIFICATION_TYPES, TOP_EVENTS, clearSwitchCache, modeFor, pabblyConfigured, recentDeliveries, sendPabbly } from "@/lib/pabbly";
import { testEvent } from "@/lib/pabbly-events";
import { sweepScheduled } from "@/lib/pabbly-sweep";

export const metadata = { title: "Alerts | SlideBazaar Admin" };
export const dynamic = "force-dynamic";

const SWITCH_KEY = "pabblyEvents";
const MODES: { value: Mode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "staff", label: "Staff only" },
  { value: "all", label: "Everything" },
];

/**
 * Turning alerts on and off, and proving they work.
 *
 * Every switch lives in a Setting row rather than an env var, because the
 * realistic failure of this feature is not that it breaks: it is that it sends
 * one message too many at 11pm and gets muted forever. Turning one off has to
 * be quicker than muting the whole channel, which means no deploy.
 */
export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireAdmin();
  const { msg, error } = await searchParams;

  const configured = pabblyConfigured();
  const scheduled = sweepScheduled();
  const deliveries = await recentDeliveries();

  const topRows = await Promise.all(Object.entries(TOP_EVENTS).map(async ([key, def]) => ({ key, label: def.label, mode: await modeFor(key), audiences: null as string[] | null })));
  const appRows = await Promise.all(
    Object.entries(NOTIFICATION_TYPES).map(async ([type, def]) => ({ key: `app.${type}`, label: def.label, mode: await modeFor(`app.${type}`), audiences: [...def.audiences] })),
  );
  const rows = [...topRows, ...appRows];

  async function setMode(formData: FormData) {
    "use server";
    await requireAdmin();
    const key = String(formData.get("key") ?? "");
    const mode = String(formData.get("mode") ?? "");
    if (!key || !["off", "staff", "all"].includes(mode)) throw new Error("Unknown switch");

    const row = await prisma.setting.findUnique({ where: { key: SWITCH_KEY } });
    const map = new Map<string, string>();
    for (const part of (row?.value ?? "").split(",")) {
      const [k, v] = part.split("=").map((x) => x.trim());
      if (k) map.set(k, v);
    }
    map.set(key, mode);
    const value = Array.from(map.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    await prisma.setting.upsert({ where: { key: SWITCH_KEY }, create: { key: SWITCH_KEY, value }, update: { value } });
    clearSwitchCache();
    revalidatePath("/admin/notifications");
  }

  async function sendTest() {
    "use server";
    const me = await requireAdmin();
    if (!pabblyConfigured()) throw new Error("No webhook URL is set, so there is nowhere to send a test.");
    const okSent = await sendPabbly(testEvent(me.name, new Date()));
    revalidatePath("/admin/notifications");
    if (!okSent) throw new Error("Pabbly did not accept the test. Check the delivery log below.");
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Alerts</p>
        <h1 className="mt-1 text-2xl font-bold">Email and WhatsApp via Pabbly</h1>
        <p className="max-w-3xl text-sm text-muted">
          SlideBazaar posts an event to one Pabbly Connect webhook and Pabbly turns it into an email or a WhatsApp message. Nothing a visitor typed is ever sent: the brief, the audience and the brand
          notes stay here. Events carry the step, the choices, the estimate and a code for whatever blocked them.
        </p>
        {msg && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}
        {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      </div>

      {!configured ? (
        <section className="card border-amber-200 bg-amber-50 p-6 text-sm">
          <p className="font-semibold text-ink">No webhook is set up yet, so nothing is being sent.</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
            <li>In Pabbly Connect, create a workflow with a <strong className="text-ink">Webhook</strong> trigger and copy the URL it gives you.</li>
            <li>
              Add it to your environment as <code className="text-xs">PABBLY_WEBHOOK_URL</code> and redeploy. Treat that URL as a password: anyone holding it can post a fake order into your workflow.
            </li>
            <li>Come back here and press Send a test.</li>
          </ol>
        </section>
      ) : (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">The webhook is configured.</p>
              <p className="text-xs text-muted">Send a test to prove it reaches your phone before you rely on it.</p>
            </div>
            <form action={sendTest}>
              <button className="btn-primary !px-4 !py-2 !text-sm">Send a test</button>
            </form>
          </div>
        </section>
      )}

      {configured && !scheduled && (
        <section className="card border-rose-200 bg-rose-50 p-5 text-sm">
          <p className="font-semibold text-rose-800">&ldquo;Somebody gave up&rdquo; alerts are not scheduled.</p>
          <p className="mt-1 text-rose-700">
            Nothing tells this app that a person closed a tab. It can only notice, later, that an attempt has been quiet for thirty minutes, and it only gets the chance to look when somebody visits the
            site. On a quiet night that means the morning, or never.
          </p>
          <p className="mt-2 text-rose-700">
            Fix it with a second Pabbly workflow, which takes a minute: a <strong>Schedule</strong> trigger every 15 minutes, one <strong>HTTP GET</strong> to{" "}
            <code className="text-xs">{appUrl()}/api/pabbly-sweep</code> with the header <code className="text-xs">x-sweep-token</code> set to whatever you put in{" "}
            <code className="text-xs">PABBLY_SWEEP_TOKEN</code> (any 24+ character random string). Until that variable is set, that endpoint returns 404 to everyone.
          </p>
        </section>
      )}

      <section className="card overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-surface px-5 py-3">
          <p className="text-sm font-semibold">What gets sent</p>
          <p className="text-xs text-muted">
            &ldquo;Staff only&rdquo; sends one message when the alert reaches you or a manager, and nothing when it only reaches a customer. Each row says who it actually goes to.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted">
                  <code className="text-[11px]">{r.key}</code>
                  {r.audiences && <> &middot; goes to: {r.audiences.join(", ")}</>}
                  {r.audiences && r.mode === "staff" && !r.audiences.includes("staff") && <span className="ml-1 font-semibold text-rose-700">&mdash; never sent, nobody on staff receives this one</span>}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {MODES.map((m) => (
                  <form key={m.value} action={setMode}>
                    <input type="hidden" name="key" value={r.key} />
                    <input type="hidden" name="mode" value={m.value} />
                    <button className={`chip ${r.mode === m.value ? "bg-accent-50 text-accent-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{m.label}</button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <p className="text-sm font-semibold">Last 10 deliveries</p>
        <p className="text-xs text-muted">Status only. The payloads are never stored here, because they carry order values and customer names.</p>
        {deliveries.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing sent yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-xs">
            {deliveries.map((d, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2">
                <span className={`chip ${d.status === "200" || d.status === "204" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{d.status}</span>
                <code>{d.event}</code>
                <span className="text-muted">
                  {d.ms}ms &middot; {dateTime(d.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
