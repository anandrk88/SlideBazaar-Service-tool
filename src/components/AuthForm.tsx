"use client";

import { useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

interface Props {
  mode: "login" | "signup";
  /** Called after a successful login/signup. If omitted, the page is redirected to `next`. */
  onSuccess?: (user: SessionUser) => void;
  next?: string;
  /** Inline mode hides the page title and the switch link renders as a button. */
  inline?: boolean;
  onSwitchMode?: (mode: "login" | "signup") => void;
}

export function AuthForm({ mode, onSuccess, next, inline, onSwitchMode }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form.entries());
    body.agree = form.get("agree") === "on";
    body.marketingOptIn = form.get("marketingOptIn") === "on";
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        return;
      }
      if (onSuccess) onSuccess(json.user);
      else window.location.href = next || (json.user.role === "CUSTOMER" ? "/dashboard" : "/admin");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const switchLink =
    mode === "login" ? (
      <>
        New to SlideBazaar?{" "}
        {onSwitchMode ? (
          <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => onSwitchMode("signup")}>
            Create an account
          </button>
        ) : (
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-600 hover:underline">
            Create an account
          </Link>
        )}
      </>
    ) : (
      <>
        Already have an account?{" "}
        {onSwitchMode ? (
          <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => onSwitchMode("login")}>
            Log in
          </button>
        ) : (
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-600 hover:underline">
            Log in
          </Link>
        )}
      </>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      {!inline && <h1 className="text-2xl font-bold">{mode === "login" ? "Log in" : "Create your account"}</h1>}
      <p className="text-sm text-muted">{switchLink}</p>

      {mode === "signup" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Full name *
            </label>
            <input id="name" name="name" className="input" placeholder="Enter your full name" required autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="company">
              Company
            </label>
            <input id="company" name="company" className="input" placeholder="Optional" autoComplete="organization" />
          </div>
        </div>
      )}

      <div className={`grid gap-4 ${mode === "signup" ? "sm:grid-cols-2" : ""}`}>
        <div>
          <label className="label" htmlFor="email">
            Email *
          </label>
          <input id="email" name="email" type="email" className="input" placeholder="Enter your email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password *
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              className="input pr-16"
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              required
              minLength={mode === "signup" ? 8 : 1}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>

      {mode === "signup" && (
        <>
          <div className="sm:w-1/2 sm:pr-2">
            <label className="label" htmlFor="phone">
              Phone number
            </label>
            <input id="phone" name="phone" className="input" placeholder="+1 555 555 55 55" autoComplete="tel" />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="agree" className="mt-1" required />
            <span>
              I agree to the{" "}
              <a href="https://slidebazaar.com/terms-and-conditions/" target="_blank" className="text-brand-600 hover:underline">
                Terms and Conditions
              </a>{" "}
              and{" "}
              <a href="https://slidebazaar.com/privacy-policy/" target="_blank" className="text-brand-600 hover:underline">
                Privacy Policy
              </a>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="marketingOptIn" className="mt-1" />
            <span>I would like to receive occasional emails with information on new services and offers</span>
          </label>
        </>
      )}

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <button className="btn-accent w-full" disabled={busy}>
        {busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  );
}
