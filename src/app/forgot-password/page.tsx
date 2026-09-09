import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata = { title: "Reset your password | SlideBazaar Design Services" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="We will email you a link to set a new one.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
