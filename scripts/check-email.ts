/**
 * Proves email actually sends, and says what to change when it does not.
 *
 *   npm run email:check -- you@example.com
 *
 * Email fails in ways that are hard to read. Amazon SES in particular has three
 * separate traps that all look like "it just does not work":
 *
 *   1. IAM access keys are NOT SMTP credentials. The console shows you an
 *      AKIA... key and a secret, and pasting the secret as SMTP_PASS fails
 *      authentication with no clue as to why. SES SMTP credentials are a
 *      different pair, created under "SMTP settings".
 *   2. A new SES account is in the SANDBOX, where it can only send to addresses
 *      you have verified. Password resets to real customers silently bounce.
 *   3. The From address must itself be a verified identity, in the same region
 *      as the SMTP endpoint.
 *
 * This translates each of those into a sentence rather than an SMTP code.
 *
 * It sends a real message. Nothing is written to the database.
 */
import "dotenv/config";
import nodemailer from "nodemailer";

const RED = (s: string) => `  ${s}`;

function describe(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const msg = e?.message ?? String(err);
  const code = e?.responseCode;

  if (/not authorized|535|authentication/i.test(msg) || code === 535) {
    return [
      "Authentication was refused.",
      "On Amazon SES this almost always means IAM keys were used instead of SMTP credentials.",
      "They are not the same thing. In the SES console go to: Account dashboard > SMTP settings >",
      "Create SMTP credentials. That gives you a username (also starting AKIA) and a DIFFERENT",
      "password. The IAM secret key cannot be used as SMTP_PASS.",
    ].join("\n  ");
  }
  if (/not verified|MessageRejected|554/i.test(msg)) {
    return [
      "SES accepted the connection but refused the message.",
      "Either SMTP_FROM is not a verified identity, or the account is still in the SES sandbox,",
      "which can only send to addresses you have verified. Check: SES > Account dashboard. If it",
      "says 'Your account is in the sandbox', request production access before relying on this —",
      "password resets to real customers will silently fail until you do.",
    ].join("\n  ");
  }
  if (/greeting never received/i.test(msg)) {
    return [
      "The connection opened but the server never said hello.",
      "That is almost always a port and TLS mismatch: ports 465 and 2465 expect TLS from the",
      "first byte, while 25, 587 and 2587 expect a plaintext greeting and then STARTTLS. Talking",
      "plaintext to 465 produces exactly this silence.",
      "Fix: set SMTP_PORT=587. If you must use 465, set SMTP_SECURE=true as well.",
    ].join("\n  ");
  }
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(e?.code ?? msg)) {
    return [
      "Could not reach the SMTP host at all.",
      "Check SMTP_HOST and SMTP_PORT. For SES the host is region specific, for example",
      "email-smtp.us-west-2.amazonaws.com for US West (Oregon), on port 587.",
    ].join("\n  ");
  }
  return msg;
}

async function main() {
  const to = process.argv[2];
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  console.log("\nConfiguration (values hidden):");
  console.log(RED(`SMTP_HOST  ${SMTP_HOST ?? "(not set)"}`));
  console.log(RED(`SMTP_PORT  ${SMTP_PORT ?? "(not set, defaults to 587)"}`));
  console.log(RED(`SMTP_USER  ${SMTP_USER ? `${SMTP_USER.slice(0, 4)}... (${SMTP_USER.length} chars)` : "(not set)"}`));
  console.log(RED(`SMTP_PASS  ${SMTP_PASS ? `set, ${SMTP_PASS.length} chars` : "(NOT SET)"}`));
  console.log(RED(`SMTP_FROM  ${SMTP_FROM ?? "(not set, falls back to no-reply@slidebazaar.com)"}`));

  if (!SMTP_HOST) {
    console.error("\nSMTP_HOST is not set, so nothing can send. Every notification is silently dropped\nto a local outbox file instead. Set the five variables above and run this again.\n");
    process.exitCode = 1;
    return;
  }

  const port = Number(SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  console.log("\n1. Connecting and authenticating...");
  try {
    await transport.verify();
    console.log(RED("OK - the host accepted these credentials."));
  } catch (err) {
    console.error(RED("FAILED."));
    console.error(RED(describe(err)));
    process.exitCode = 1;
    return;
  }

  if (!to) {
    console.log("\nCredentials work. Pass an address to send a real test:\n  npm run email:check -- you@example.com\n");
    return;
  }

  console.log(`\n2. Sending a real message to ${to}...`);
  try {
    const info = await transport.sendMail({
      from: SMTP_FROM || "SlideBazaar <no-reply@slidebazaar.com>",
      to,
      subject: "[SlideBazaar] Email is working",
      text: "If you are reading this, password resets and order notifications will now reach people.",
      html: '<p style="font-family:Inter,Arial,sans-serif">If you are reading this, password resets and order notifications will now reach people.</p>',
    });
    console.log(RED(`Accepted for delivery. id: ${info.messageId}`));
    console.log("\nNow check the inbox. If it never arrives, the message was accepted but dropped,");
    console.log("which on SES usually means the sandbox: it only delivers to verified addresses.\n");
  } catch (err) {
    console.error(RED("FAILED."));
    console.error(RED(describe(err)));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Unexpected failure:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
