import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Create account | SlideBazaar Design Services" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Create your account" subtitle="Takes a minute. You can place your first order straight away.">
      <AuthForm mode="signup" next={next} inline />
    </AuthShell>
  );
}
