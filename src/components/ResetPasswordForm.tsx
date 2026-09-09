"use client";

import { useState } from "react";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, next: String(form.get("next") ?? ""), confirm: String(form.get("confirm") ?? "") }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        return;
      }
      // The reset signs them in, so send them somewhere useful.
      window.location.href = json.user?.role === "CUSTOMER" ? "/dashboard" : "/admin";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">Choose a new password. This also signs you out everywhere else.</p>

      <div>
        <label className="label" htmlFor="next">
          New password *
        </label>
        <div className="relative">
          <input
            id="next"
            name="next"
            type={show ? "text" : "password"}
            className="input pr-16"
            placeholder="At least 8 characters"
            minLength={8}
            required
            autoComplete="new-password"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted hover:text-ink"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="confirm">
          Confirm new password *
        </label>
        <input id="confirm" name="confirm" type={show ? "text" : "password"} className="input" minLength={8} required autoComplete="new-password" />
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p>{error}</p>
          <Link href="/forgot-password" className="mt-1 inline-block font-semibold underline">
            Request a new link
          </Link>
        </div>
      )}

      <button className="btn-accent w-full !py-3" disabled={busy}>
        {busy ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}
