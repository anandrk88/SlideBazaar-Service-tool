/**
 * Runs once when the server starts. Fails fast on a misconfigured production
 * environment rather than serving free orders or dropping customer emails.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnv } = await import("./lib/env");
    checkEnv();
  }
}
