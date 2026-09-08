import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Log in | SlideBazaar Design Services" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Log in to your account" subtitle="Track your orders, review drafts and talk to your designer.">
      <AuthForm mode="login" next={next} inline />
    </AuthShell>
  );
}
