import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { ConfirmEmailButton } from "@/components/ConfirmEmailButton";

export const metadata = { title: "Confirm your email | SlideBazaar Design Services" };
export const dynamic = "force-dynamic";

/**
 * The token is deliberately NOT consumed while rendering this GET. Corporate
 * mail scanners (Defender Safe Links, Proofpoint and friends) pre-fetch every
 * link in an email, and a single-use token spent by a scanner leaves the real
 * person with a dead link they cannot reissue. Confirming takes a click, which
 * posts to the API route.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell title="Confirm your email" subtitle="That link is missing its token.">
        <div className="space-y-4">
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            This page needs the link from your confirmation email. Copy the whole link, or sign in and ask for a new one.
          </p>
          <Link href="/login" className="btn-accent w-full !py-3">
            Log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Confirm your email" subtitle="One click and we know this address is really yours.">
      <ConfirmEmailButton token={token} />
    </AuthShell>
  );
}
