"use client";

import { useState } from "react";
import Link from "next/link";

export function ConfirmEmailButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "That link did not work.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
          Your email address is confirmed. You can connect a Google account from your account settings whenever you want.
        </p>
        <Link href="/dashboard" className="btn-accent w-full !py-3">
          Go to my orders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Click below to confirm this is your address.</p>
      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p>{error}</p>
          <p className="mt-1">Confirmation links last 24 hours and work once. Sign in and request a new one from your account page.</p>
        </div>
      )}
      <button onClick={confirm} disabled={state === "busy"} className="btn-accent w-full !py-3">
        {state === "busy" ? "Confirming..." : "Confirm my email address"}
      </button>
      <Link href="/login" className="btn-outline w-full">
        Log in instead
      </Link>
    </div>
  );
}
