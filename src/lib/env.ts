import "server-only";

/**
 * Environment validation.
 *
 * The app has two dangerous fallbacks that are fine in development and must
 * never happen in production:
 *   - an empty STRIPE_SECRET_KEY serves the mock payment page, which marks
 *     orders paid with no money;
 *   - an empty SMTP_HOST writes customer emails to a local log file.
 * checkEnv() refuses to start production if either would apply, or if the
 * session secret or public URL are still development placeholders.
 */

export const isProduction = process.env.NODE_ENV === "production";

/**
 * A deployed environment that is NOT open to real customers.
 *
 * Without this, the production checks below make it impossible to put the app
 * on a URL at all until live Stripe keys and an SMTP provider exist, which is
 * the wrong order to do things in. STAGING=yes downgrades the checks that only
 * protect real customers to warnings, and keeps the ones that would be unsafe
 * anywhere as hard failures.
 *
 * Never set this on the deployment customers actually use: with it, orders can
 * be paid with test cards and no email reaches anyone.
 */
export const isStaging = process.env.STAGING === "yes";

/** Placeholders shipped in .env.example that must never reach production. */
const PLACEHOLDER_SECRETS = [
  "change-me-to-a-long-random-string-at-least-32-chars",
  "sb-dev-secret-9f3c2a7e5b1d4c8a6f0e2b9d7c5a3f1e",
];

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * The app's own public origin, with no trailing slash. Lives here rather than
 * in stripe.ts so the OAuth code can use it without importing the Stripe SDK.
 */
export function appUrl() {
  const raw = process.env.APP_URL ?? "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/** Google sign-on is offered only when both halves of the client are present. */
export function googleEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * True only when it is safe to simulate payments. Production never qualifies,
 * so a missing Stripe key becomes a hard failure instead of free orders.
 */
export function mockPaymentsAllowed() {
  return !isProduction && !stripeConfigured();
}

export interface EnvProblem {
  key: string;
  message: string;
}

/** Collect configuration problems. Returns an empty array when all is well. */
export function envProblems(): EnvProblem[] {
  const problems: EnvProblem[] = [];
  const secret = process.env.AUTH_SECRET ?? "";
  const appUrl = process.env.APP_URL ?? "";

  if (!secret) problems.push({ key: "AUTH_SECRET", message: "is not set" });
  else if (secret.length < 32) problems.push({ key: "AUTH_SECRET", message: "must be at least 32 characters" });
  else if (PLACEHOLDER_SECRETS.includes(secret)) {
    problems.push({ key: "AUTH_SECRET", message: "is still the example value from .env.example; generate a fresh random secret" });
  }

  if (!process.env.DATABASE_URL) problems.push({ key: "DATABASE_URL", message: "is not set" });

  const hasGoogleId = Boolean(process.env.GOOGLE_CLIENT_ID);
  const hasGoogleSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
  if (hasGoogleId !== hasGoogleSecret) {
    problems.push({
      key: hasGoogleId ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID",
      message: "is missing while the other half is set; Google sign-on stays hidden until both are present",
    });
  }

  if (!isProduction) return problems;

  // Requirements for any deployed environment, staging included. These are not
  // about protecting customers; a guessable session secret or a database that
  // vanishes on redeploy is wrong everywhere.
  if (!appUrl) problems.push({ key: "APP_URL", message: "is not set; Stripe redirects and email links would point at localhost" });
  else if (!/^https:\/\//.test(appUrl)) problems.push({ key: "APP_URL", message: "must be an https URL in production" });
  else if (/localhost|127\.0\.0\.1/.test(appUrl)) problems.push({ key: "APP_URL", message: "must not point at localhost in production" });

  if (process.env.DATABASE_URL?.startsWith("file:")) {
    problems.push({ key: "DATABASE_URL", message: "points at a SQLite file; use Postgres so data survives redeploys" });
  }

  // Everything below protects real customers, so staging may proceed without it.
  const customerFacing = (p: EnvProblem) => {
    if (isStaging) return;
    problems.push(p);
  };

  if (!stripeConfigured()) {
    customerFacing({ key: "STRIPE_SECRET_KEY", message: "is not set; without it the app would serve the mock payment page and mark orders paid with no money" });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    customerFacing({ key: "STRIPE_WEBHOOK_SECRET", message: "is not set; every Stripe webhook would be rejected and payments would not be recorded" });
  }
  // Presence is not enough. A sandbox key in production takes test cards and
  // collects nothing, so the orders look paid and no money ever arrives.
  if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    customerFacing({ key: "STRIPE_SECRET_KEY", message: "is a sandbox key (sk_test_); real cards would be declined and no money collected. Use the live key, or set STAGING=yes if this is not a customer-facing deployment" });
  }
  if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") && process.env.STRIPE_WEBHOOK_SECRET.length < 20) {
    customerFacing({ key: "STRIPE_WEBHOOK_SECRET", message: "looks too short to be a live signing secret" });
  }
  if (!smtpConfigured()) {
    customerFacing({ key: "SMTP_HOST", message: "is not set; customer emails would be written to a local log file instead of being sent" });
  }
  // Same class of silent fallback as the Stripe and SMTP checks above: without
  // a bucket the app writes customer decks to the container filesystem, which
  // most hosting wipes on the next deploy.
  if (!process.env.S3_BUCKET) {
    customerFacing({ key: "S3_BUCKET", message: "is not set; customer files would be written to local disk and lost on the next deploy" });
  } else if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    problems.push({ key: "S3_ACCESS_KEY_ID", message: "and S3_SECRET_ACCESS_KEY must both be set when S3_BUCKET is; check with npm run storage:check" });
  }
  return problems;
}

/** Throws with every problem listed at once. Called from instrumentation.ts at boot. */
export function checkEnv() {
  if (isProduction && isStaging) {
    console.warn(
      "[env] STAGING=yes: this deployment is not safe for real customers. " +
        "Test cards may be accepted, email may go nowhere, and files may be lost on redeploy. " +
        "Remove STAGING before taking real orders.",
    );
  }
  const problems = envProblems();
  if (problems.length === 0) return;
  const lines = problems.map((p) => `  - ${p.key} ${p.message}`).join("\n");
  const message = `Invalid environment configuration:\n${lines}\n\nSee .env.example. Fix these before starting the app.`;
  if (isProduction) throw new Error(message);
  console.warn(`[env] ${message}`);
}
