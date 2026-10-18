/**
 * Derives an Amazon SES SMTP password from an existing IAM secret access key.
 *
 *   npm run ses:smtp-password -- <SECRET_ACCESS_KEY> <region>
 *   npm run ses:smtp-password -- wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY us-west-2
 *
 * Why this exists: the SES console shows you an IAM access key pair, and the
 * secret key is NOT the SMTP password. Pasting it as SMTP_PASS fails
 * authentication with no useful error. AWS documents a derivation instead, so
 * if you already have IAM credentials with SES sending permission you do not
 * need to create a second user:
 *
 *   SMTP username = the IAM access key id, unchanged
 *   SMTP password = derived here
 *
 * The password is region specific, because the region is an input to the
 * derivation. A password derived for us-west-2 will not work against the
 * eu-west-1 endpoint.
 *
 * Run this locally. It prints to your terminal and sends nothing anywhere, so
 * the secret never leaves your machine.
 *
 * Two AWS rules this cannot work around:
 *   - Temporary credentials (an assumed role, anything with a session token)
 *     cannot be used. The derivation only works for a long-lived IAM user.
 *   - The IAM user still needs ses:SendRawEmail permission.
 */
import { createHmac } from "node:crypto";

// Fixed by AWS. These are not dates or messages in any meaningful sense; they
// are constants in the published derivation.
const DATE = "11111111";
const SERVICE = "ses";
const TERMINAL = "aws4_request";
const MESSAGE = "SendRawEmail";
const VERSION = 0x04;

function sign(key: Buffer, msg: string): Buffer {
  return createHmac("sha256", key).update(msg, "utf8").digest();
}

export function sesSmtpPassword(secretAccessKey: string, region: string): string {
  let sig = sign(Buffer.from(`AWS4${secretAccessKey}`, "utf8"), DATE);
  sig = sign(sig, region);
  sig = sign(sig, SERVICE);
  sig = sign(sig, TERMINAL);
  sig = sign(sig, MESSAGE);
  return Buffer.concat([Buffer.from([VERSION]), sig]).toString("base64");
}

function main() {
  const [secret, region] = process.argv.slice(2);
  if (!secret || !region) {
    console.error("\nUsage:\n  npm run ses:smtp-password -- <SECRET_ACCESS_KEY> <region>\n\nExample:\n  npm run ses:smtp-password -- wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY us-west-2\n");
    process.exitCode = 1;
    return;
  }
  if (secret.length < 20) {
    console.error("\nThat does not look like a secret access key (they are 40 characters).\nDid you pass the access key id by mistake? That is the USERNAME, not the secret.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`\nSMTP password for region ${region}:\n`);
  console.log(`  ${sesSmtpPassword(secret, region)}\n`);
  console.log("Use it with:");
  console.log(`  SMTP_HOST=email-smtp.${region}.amazonaws.com`);
  console.log("  SMTP_PORT=587");
  console.log("  SMTP_USER=<your IAM access key id, the AKIA... one>");
  console.log("  SMTP_PASS=<the password above>");
  console.log("  SMTP_FROM=SlideBazaar <no-reply@slidebazaar.com>\n");
  console.log("Then prove it: npm run email:check -- you@example.com\n");
}

if (process.argv[1]?.includes("ses-smtp-password")) main();
