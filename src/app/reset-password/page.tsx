import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata = { title: "Set a new password | SlideBazaar Design Services" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell title="Set a new password" subtitle="That link is missing its token.">
        <div className="space-y-4">
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            This page needs the link from your reset email. Copy the whole link, or request a new one.
          </p>
          <Link href="/forgot-password" className="btn-accent w-full !py-3">
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  // The token is not checked here on purpose. Validating it on a GET would let
  // an email scanner that follows links burn it before the person arrives.
  return (
    <AuthShell title="Set a new password" subtitle="Nearly done. Pick something you have not used elsewhere.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
