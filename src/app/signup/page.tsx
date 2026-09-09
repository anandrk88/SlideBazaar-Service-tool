import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { appUrl, googleEnabled } from "@/lib/env";
import { safeNext } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Create account | SlideBazaar Design Services" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "CUSTOMER" ? "/dashboard" : "/admin");
  const safe = safeNext(next, appUrl());
  return (
    <AuthShell title="Create your account" subtitle="Takes a minute. You can place your first order straight away.">
      <AuthForm mode="signup" next={safe} inline showProviders googleEnabled={googleEnabled()} />
    </AuthShell>
  );
}
