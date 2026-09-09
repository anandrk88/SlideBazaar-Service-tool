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
  /**
   * Show the external sign-in buttons. Off by default because the order wizard
   * embeds this form mid-flow, where a full-page redirect to Google would throw
   * away the draft and the uploaded files.
   */
  showProviders?: boolean;
  googleEnabled?: boolean;
  /** Message to show above the form, e.g. after a failed Google callback. */
  notice?: string | null;
}

/** Accept a destination only if it stays on this origin. */
function sameOriginPath(next: string | undefined): string | undefined {
  if (!next) return undefined;
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export function AuthForm({ mode, onSuccess, next, inline, onSwitchMode, showProviders, googleEnabled, notice }: Props) {
  const [error, setError] = useState<string | null>(notice ?? null);
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
      else window.location.href = sameOriginPath(next) ?? (json.user.role === "CUSTOMER" ? "/dashboard" : "/admin");
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

      {showProviders && googleEnabled && (
        <>
          {/* A plain link, not a fetch: OAuth is a top-level navigation. */}
          <a
            href={`/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="btn-outline w-full !py-2.5"
          >
            <GoogleMark />
            Continue with Google
          </a>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

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
          <div className="flex items-baseline justify-between gap-3">
            <label className="label" htmlFor="password">
              Password *
            </label>
            {mode === "login" && (
              <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
                Forgot your password?
              </Link>
            )}
          </div>
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

/** Google's brand mark, inline so no external asset is fetched. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.77 24c0-1.6.27-3.15.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}
