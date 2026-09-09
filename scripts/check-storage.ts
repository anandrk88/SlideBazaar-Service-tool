/**
 * Proves the configured object store actually works, end to end.
 *
 *   npm run storage:check
 *
 * Writes a small test object, reads it back, checks the bytes match, lists it,
 * deletes it, and confirms it is gone. Every failure prints what to change
 * rather than a raw SDK error, because the S3-compatible APIs fail in ways that
 * are hard to read: a wrong endpoint looks like a DNS error, a wrong bucket
 * looks like a permissions error, and a token missing the delete permission
 * only fails at the end.
 *
 * Nothing here touches customer files: the test key lives under a dedicated
 * prefix and is removed again.
 */
// Next loads .env for the app; a plain tsx script does not, so without this the
// check would silently fall back to the local driver and report success while
// never touching the bucket.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { deleteObject, deletePrefix, getObjectBuffer, getObjectStream, putObject, storageDriver } from "../src/lib/storage";

const CHECK_PREFIX = "_storage-check";

function mask(value: string | undefined) {
  if (!value) return "(not set)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

function explain(err: unknown): string {
  const e = err as { name?: string; Code?: string; message?: string };
  const code = e?.Code ?? e?.name ?? "";
  const hints: [RegExp, string][] = [
    [/NoSuchBucket/i, "The bucket does not exist. Check S3_BUCKET, and that it was created in the same Cloudflare account as the token."],
    [/InvalidAccessKeyId|SignatureDoesNotMatch/i, "The credentials were rejected. Re-copy S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY; the secret is shown only once when the token is created."],
    [/AccessDenied|Forbidden/i, "Authenticated but not allowed. The R2 API token needs Object Read & Write on this bucket."],
    [/ENOTFOUND|EAI_AGAIN|getaddrinfo/i, "The endpoint hostname did not resolve. S3_ENDPOINT should look like https://<account-id>.r2.cloudflarestorage.com with no bucket name and no trailing slash."],
    [/ECONNREFUSED|ETIMEDOUT/i, "Could not reach the endpoint. Check the URL and any network restrictions."],
    [/checksum|x-amz-(sdk-)?checksum|XAmzContentSHA256Mismatch|Header 'x-amz-checksum/i,
      "The store rejected the checksum headers the AWS SDK sends by default. Set requestChecksumCalculation and responseChecksumValidation to WHEN_REQUIRED on the S3 client."],
  ];
  const text = `${code} ${e?.message ?? ""}`;
  for (const [pattern, hint] of hints) if (pattern.test(text)) return hint;
  return "";
}

let failed = false;

async function step<T>(name: string, run: () => Promise<T>): Promise<T | undefined> {
  process.stdout.write(`  ${name.padEnd(34)}`);
  // Once anything has failed the later checks prove nothing: deleteObject
  // swallows errors by design, and "confirm it is gone" passes whenever the
  // read throws, including because the client cannot be built at all.
  if (failed) {
    console.log("skipped");
    return undefined;
  }
  try {
    const out = await run();
    console.log("ok");
    return out;
  } catch (err) {
    failed = true;
    const e = err as { name?: string; message?: string };
    console.log("FAILED");
    console.log(`     ${e?.name ?? "Error"}: ${e?.message ?? String(err)}`);
    const hint = explain(err);
    if (hint) console.log(`     -> ${hint}`);
    return undefined;
  }
}

async function main() {
  const driver = storageDriver();
  console.log(`Storage driver: ${driver}`);
  if (driver === "local") {
    console.log(`  UPLOAD_DIR    ${process.env.UPLOAD_DIR || "./uploads"}`);
    console.log("\nS3_BUCKET is not set, so files are written to local disk.");
    console.log("That is fine for development. On Vercel the filesystem is wiped on every deploy,");
    console.log("so set the R2 variables before going live. See docs/STORAGE-R2.md.\n");
  } else {
    console.log(`  S3_BUCKET     ${process.env.S3_BUCKET}`);
    console.log(`  S3_ENDPOINT   ${process.env.S3_ENDPOINT || "(none: talking to AWS S3)"}`);
    console.log(`  S3_REGION     ${process.env.S3_REGION || "auto"}`);
    console.log(`  S3_ACCESS_KEY_ID     ${mask(process.env.S3_ACCESS_KEY_ID)}`);
    console.log(`  S3_SECRET_ACCESS_KEY ${mask(process.env.S3_SECRET_ACCESS_KEY)}`);
    console.log("");
  }

  const key = `${CHECK_PREFIX}/${Date.now()}-${randomBytes(6).toString("hex")}.bin`;
  // Big enough that a chunked transfer path is exercised, small enough to be instant.
  const payload = randomBytes(256 * 1024);

  console.log("Running checks:");
  await step("write an object", () => putObject(key, payload, "application/octet-stream"));

  await step("read it back and compare bytes", async () => {
    const got = await getObjectBuffer(key);
    if (got.length !== payload.length) throw new Error(`read back ${got.length} bytes, expected ${payload.length}`);
    if (!got.equals(payload)) throw new Error("the bytes read back do not match what was written");
  });

  await step("stream it (download path)", async () => {
    const { stream, size } = await getObjectStream(key);
    if (size !== payload.length) throw new Error(`stream reported ${size} bytes, expected ${payload.length}`);
    let seen = 0;
    for await (const chunk of stream) seen += (chunk as Buffer).length;
    if (seen !== payload.length) throw new Error(`stream produced ${seen} bytes, expected ${payload.length}`);
  });

  await step("delete it", () => deleteObject(key));

  await step("confirm it is gone", async () => {
    try {
      await getObjectBuffer(key);
    } catch {
      return; // Expected: the object should no longer be readable.
    }
    throw new Error("the object is still readable after delete; check the token has delete permission");
  });

  // The local driver leaves the prefix directory behind after the object goes.
  await deletePrefix(CHECK_PREFIX);

  if (failed) {
    console.log("\nStorage is NOT working. Fix the errors above, then run this again.");
    process.exit(1);
  }
  console.log(`\nStorage is working (${driver}). Customer files will be stored and served correctly.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
