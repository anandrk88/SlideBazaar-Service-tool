import "server-only";

/**
 * A small fixed-window rate limiter held in process memory.
 *
 * Be clear about what this is and is not. It counts per process, so on a
 * platform that runs several instances each one keeps its own tally and the
 * effective limit is the configured one multiplied by the instance count. It is
 * enough to stop a single script hammering an endpoint, and it is not a defence
 * against a distributed attacker. If this app ever needs a real limit, back it
 * with Redis or the platform's own edge rate limiting and delete this file.
 *
 * It exists because the unauthenticated endpoints below send email, and an
 * unthrottled endpoint that sends email is both a mail bomb and a way to keep
 * invalidating somebody's reset link so they can never recover their account.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Stop the map growing without bound in a long-lived process. */
function sweep(now: number) {
  if (windows.size < 5_000) return;
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may try again. Zero when allowed. */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

/**
 * Best-effort client address. Behind a proxy this is a header the client cannot
 * normally set but a misconfigured deployment could, so treat it as a coarse
 * grouping key rather than an identity.
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
