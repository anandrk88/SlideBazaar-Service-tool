import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { appUrl, googleEnabled } from "@/lib/env";
import { safeNext } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Log in | SlideBazaar Design Services" };

/** Errors the Google callback can hand back, turned into something readable. */
const GENERIC_NOTICE = "Sign-in did not complete. Please try again.";

const NOTICES: Record<string, string> = {
  "google-unavailable": "Google sign-in is not configured on this site yet.",
  "google-cancelled": "Google sign-in was cancelled.",
  "google-failed": "Google sign-in did not complete. Please try again.",
  "google-expired": "That sign-in attempt timed out. Please try again.",
  "google-state": "That sign-in attempt could not be verified. Please start again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;

  // Done here rather than in middleware, which cannot tell a live session from
  // a revoked one.
  const user = await getCurrentUser();
  if (user) redirect(user.role === "CUSTOMER" ? "/dashboard" : "/admin");

  // Sanitised here rather than in the browser, so a crafted ?next= never
  // reaches the client at all.
  const safe = safeNext(next, appUrl());
  // Own-property check with a fixed fallback. Indexing a plain object with
  // user input returns inherited members for keys like "toString", and
  // echoing the raw value back would put attacker text on the page.
  const notice = error ? (Object.hasOwn(NOTICES, error) ? NOTICES[error] : GENERIC_NOTICE) : null;

  return (
    <AuthShell title="Log in to your account" subtitle="Track your orders, review drafts and talk to your designer.">
      <AuthForm mode="login" next={safe} inline showProviders googleEnabled={googleEnabled()} notice={notice} />
    </AuthShell>
  );
}
