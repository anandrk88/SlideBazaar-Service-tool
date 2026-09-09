import "server-only";
import { prisma } from "./db";
import { appUrl } from "./env";
import { sendTransactionalEmail } from "./notify";
import { issueToken } from "./tokens";

/**
 * The two emails that let somebody prove they hold a mailbox: address
 * verification at signup, and a password reset.
 *
 * Both matter beyond their obvious use. Whether an address has been verified
 * decides what federated sign-in is allowed to do with it (see
 * src/lib/auth-federated.ts), and the reset link is the only route back into an
 * account whose password is gone.
 */

export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  const link = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendTransactionalEmail(user, {
    type: "EMAIL_VERIFY",
    title: "Confirm your email address",
    body: `Hi ${user.name}, please confirm this is your email address so we can send you order updates. The link is good for 24 hours: ${link}`,
    href: `/verify-email?token=${encodeURIComponent(token)}`,
  });
}

export async function sendPasswordResetEmail(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "PASSWORD_RESET");
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendTransactionalEmail(user, {
    type: "PASSWORD_RESET",
    title: "Reset your password",
    body:
      `Hi ${user.name}, use this link to set a new password. It expires in an hour and can only be used once: ${link}` +
      " If you did not ask for this, you can ignore this email and nothing will change.",
    href: `/reset-password?token=${encodeURIComponent(token)}`,
  });
}

/**
 * Tell the account holder out of band that their password changed, and remind
 * them what else can sign in. An attacker who completed a reset can delete the
 * reset email from a mailbox they control, so this is often the only signal the
 * real owner gets, and connected accounts survive a password change.
 */
export async function notifyPasswordChanged(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, identities: { select: { provider: true, emailAtLink: true } } },
  });
  if (!user) return;

  const connected = user.identities.map((i) => `${i.provider.toLowerCase()} (${i.emailAtLink})`).join(", ");
  await sendTransactionalEmail(user, {
    type: "PASSWORD_CHANGED",
    title: "Your password was changed",
    body:
      `Hi ${user.name}, the password on your SlideBazaar account was just changed and every other device has been signed out.` +
      (connected ? ` These connected sign-ins still work: ${connected}. Remove any you do not recognise from your account page.` : "") +
      " If this was not you, reset your password again straight away and contact us.",
    href: "/account",
  });
}
