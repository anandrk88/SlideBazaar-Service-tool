import "server-only";
import { after } from "next/server";
import { prisma } from "./db";
import { isProduction, isStaging } from "./env";
import { rateLimit } from "./rate-limit";

/**
 * Outbound webhooks to Pabbly Connect, which turns them into email or WhatsApp.
 *
 * Three rules:
 *
 *  1. Nothing a customer or visitor typed is ever in a payload. Not the brief,
 *     not a message body, not an uploaded file's name, not a raw error string
 *     that might embed one. Codes, counts and lengths only.
 *  2. Sending can never slow or fail the request that caused it. Everything goes
 *     through dispatch(), which runs after the response has gone out.
 *  3. With PABBLY_WEBHOOK_URL unset, every function here is a no-op and the app
 *     behaves exactly as it did before.
 */

const TIMEOUT_MS = 3_000;
const SWITCH_KEY = "pabblyEvents";
const LOG_KEY = "pabblyLog";
const SWITCH_TTL_MS = 60_000;

export interface PabblyEvent {
  event: string;
  eventId: string;
  occurredAt: string;
  app: "slidebazaar";
  env: "production" | "staging" | "development";
  summary: string;
  link: string;
  data: Record<string, unknown>;
}

export function pabblyConfigured() {
  return Boolean(process.env.PABBLY_WEBHOOK_URL);
}

/* ---------- switches, kept in a Setting row so one can be turned off ---------- */
/* ---------- without a deploy                                          ---------- */

export type Mode = "off" | "staff" | "all";

/**
 * Defaults come from the real call sites in src/lib/orders.ts, so that ticking a
 * box produces exactly one useful message rather than three or none.
 *
 * `audiences` is what the admin page prints beside each row, so choosing
 * "Staff only" on a type with no staff recipient reads as "never sent" instead
 * of silently sending nothing.
 */
export const NOTIFICATION_TYPES = {
  ORDER_PAID: { label: "Payment received", mode: "staff" as Mode, audiences: ["customer", "staff"] },
  QC_SUBMITTED: { label: "Draft ready for quality check", mode: "staff" as Mode, audiences: ["staff"] },
  REVISION: { label: "Customer asked for changes", mode: "staff" as Mode, audiences: ["designer", "staff"] },
  APPROVED: { label: "Customer approved the work", mode: "staff" as Mode, audiences: ["customer", "designer", "staff"] },
  REFUNDED: { label: "Refund issued, or one failed", mode: "all" as Mode, audiences: ["customer", "designer", "staff"] },
  MESSAGE: { label: "New message on an order", mode: "all" as Mode, audiences: ["customer", "designer", "staff"] },
  ASSIGNED: { label: "Designer assigned or changed", mode: "off" as Mode, audiences: ["designer"] },
  DELIVERED: { label: "Draft delivered to customer", mode: "off" as Mode, audiences: ["customer"] },
  QC_APPROVED: { label: "Quality check passed", mode: "off" as Mode, audiences: ["designer"] },
  QC_RETURNED: { label: "Quality check sent work back", mode: "off" as Mode, audiences: ["designer"] },
} as const;

export const TOP_EVENTS = {
  "wizard.started": { label: "Somebody started the order form", mode: "off" as Mode },
  "wizard.abandoned": { label: "Somebody gave up on the order form", mode: "all" as Mode },
  "order.placed": { label: "New order placed, not yet paid", mode: "all" as Mode },
} as const;

function codeDefault(key: string): Mode {
  if (key in TOP_EVENTS) return TOP_EVENTS[key as keyof typeof TOP_EVENTS].mode;
  const t = key.startsWith("app.") ? key.slice(4) : "";
  return t in NOTIFICATION_TYPES ? NOTIFICATION_TYPES[t as keyof typeof NOTIFICATION_TYPES].mode : "off";
}

let switchCache: { at: number; map: Map<string, Mode> } | null = null;

export async function switchMap(): Promise<Map<string, Mode>> {
  if (switchCache && Date.now() - switchCache.at < SWITCH_TTL_MS) return switchCache.map;
  const map = new Map<string, Mode>();
  try {
    const row = await prisma.setting.findUnique({ where: { key: SWITCH_KEY } });
    for (const part of (row?.value ?? "").split(",")) {
      const [k, v] = part.split("=").map((x) => x.trim());
      if (!k) continue;
      if (v === "0" || v === "off") map.set(k, "off");
      else if (v === "staff") map.set(k, "staff");
      else if (v === "1" || v === "all") map.set(k, "all");
    }
  } catch {
    // A missing row is not a failure: fall through to the code defaults.
  }
  switchCache = { at: Date.now(), map };
  return map;
}

/**
 * An absent key falls back to the code default rather than to off, so an event
 * type added in a later deploy arrives with its intended setting instead of
 * being silently disabled by an older saved string.
 */
export async function modeFor(key: string): Promise<Mode> {
  return (await switchMap()).get(key) ?? codeDefault(key);
}

export function clearSwitchCache() {
  switchCache = null;
}

/* ---------- transport ---------- */

function envName(): PabblyEvent["env"] {
  if (isStaging) return "staging";
  return isProduction ? "production" : "development";
}

export function envelope(event: string, eventId: string, occurredAt: Date, summary: string, link: string, data: Record<string, unknown>): PabblyEvent {
  return { event, eventId, occurredAt: occurredAt.toISOString(), app: "slidebazaar", env: envName(), summary, link, data };
}

/**
 * Post one event. Never throws, never retries, never blocks anything that
 * matters. Returns true when Pabbly accepted it.
 */
export async function sendPabbly(ev: PabblyEvent): Promise<boolean> {
  const url = process.env.PABBLY_WEBHOOK_URL;
  if (!url) return false;
  if (!url.startsWith("https://")) {
    console.error("[pabbly] PABBLY_WEBHOOK_URL is not https; nothing sent");
    return false;
  }
  // A breaker against a bug of ours, not a security control: rateLimit counts
  // per process, so the real ceiling is 60 times the instance count.
  if (!rateLimit("pabbly:send", 60, 3600).allowed) {
    await recordDelivery(ev.event, "rate_limited", 0);
    return false;
  }

  const startedAt = Date.now();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "idempotency-key": ev.eventId,
    "user-agent": "SlideBazaar/1 (+pabbly)",
  };
  const token = process.env.PABBLY_WEBHOOK_TOKEN;
  if (token) headers["x-slidebazaar-token"] = token;

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(ev), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    void res.arrayBuffer().catch(() => {}); // drain, so the socket is released
    const ms = Date.now() - startedAt;
    await recordDelivery(ev.event, String(res.status), ms);
    if (!res.ok) console.error(`[pabbly] ${ev.event} rejected ${res.status}`);
    return res.ok;
  } catch (err) {
    const ms = Date.now() - startedAt;
    await recordDelivery(ev.event, ms >= TIMEOUT_MS ? "timeout" : "error", ms);
    // The message only, never the error object: nothing that could carry the
    // webhook URL into a log line.
    console.error(`[pabbly] ${ev.event} failed: ${err instanceof Error ? err.message : "unknown"}`);
    return false;
  }
}

/**
 * Run work after the response, when there is a response.
 *
 * after() throws outside a request scope, and the notification helpers are
 * reachable from scripts/settle-refunds.ts, which is a bare tsx process. There
 * we await instead: a floating promise in a script is dropped the moment main()
 * resolves and the process exits.
 */
export async function dispatch(fn: () => Promise<unknown>): Promise<void> {
  try {
    after(async () => {
      await fn().catch(() => {});
    });
  } catch {
    await fn().catch(() => {});
  }
}

/* ---------- delivery log, for diagnosis only ---------- */

export interface Delivery {
  at: string;
  event: string;
  status: string;
  ms: number;
}

export async function recordDelivery(event: string, status: string, ms: number) {
  try {
    const row = await prisma.setting.findUnique({ where: { key: LOG_KEY } });
    const prev: Delivery[] = row ? (JSON.parse(row.value) as Delivery[]) : [];
    // Never the payload. This row lives in the database and payloads carry
    // order values and customer names.
    const value = JSON.stringify([{ at: new Date().toISOString(), event, status, ms }, ...prev].slice(0, 10));
    await prisma.setting.upsert({ where: { key: LOG_KEY }, create: { key: LOG_KEY, value }, update: { value } });
  } catch {
    // A failed diagnostic must never become the failure it was diagnosing.
  }
}

export async function recentDeliveries(): Promise<Delivery[]> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: LOG_KEY } });
    return row ? (JSON.parse(row.value) as Delivery[]) : [];
  } catch {
    return [];
  }
}
