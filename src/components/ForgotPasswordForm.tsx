"use client";

import { useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // The endpoint answers the same way whether or not the account exists, so
      // there is nothing to branch on here either.
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Check your email</p>
          <p className="mt-1">
            If that address has an account, a link to set a new password is on its way. It expires in an hour and can only be used once.
          </p>
        </div>
        <p className="text-sm text-muted">
          Nothing arrived? Check the spam folder, or{" "}
          <button type="button" onClick={() => setSent(false)} className="font-semibold text-brand-600 hover:underline">
            try a different address
          </button>
          .
        </p>
        <Link href="/login" className="btn-outline w-full">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">
        Enter the email address on your account and we will send you a link.{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Back to log in
        </Link>
      </p>

      <div>
        <label className="label" htmlFor="email">
          Email *
        </label>
        <input id="email" name="email" type="email" className="input" placeholder="Enter your email" required autoComplete="email" autoFocus />
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <button className="btn-accent w-full !py-3" disabled={busy}>
        {busy ? "Sending..." : "Email me a reset link"}
      </button>
    </form>
  );
}
