# File storage on Cloudflare R2

Customer decks, the designer's uploads, the original slide images and the
watermarked previews all live in object storage. R2 is the chosen store.

The driver in `src/lib/storage.ts` speaks the S3 API, so AWS S3, Backblaze B2
and MinIO would also work. Nothing else in the app knows where files live: every
caller passes an opaque `key`.

## Why not local disk

With `S3_BUCKET` unset the app writes to `UPLOAD_DIR` on the container
filesystem. That is fine on your own machine and wrong everywhere else, because
most hosting gives each deploy a fresh filesystem. A customer who paid on Monday
would find their deck gone after Tuesday's deploy.

Production refuses to start without `S3_BUCKET`, alongside the same checks for
Stripe and SMTP. See `envProblems()` in `src/lib/env.ts`.

## Setting it up

1. Cloudflare dashboard, **R2 > Create bucket**. Any name; the app never
   assumes one. Choose a location hint near your customers.
2. **Manage API tokens > Create API token**, permission **Object Read & Write**,
   scoped to that single bucket. Cloudflare shows the secret once.
3. Copy the values into `.env`:

```
S3_BUCKET="your-bucket-name"
S3_REGION="auto"
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
```

The endpoint is the **account** endpoint. No bucket name in the host, no
trailing slash. R2 has no regions, but the SDK still wants a value, so `auto`.

4. Verify:

```bash
npm run storage:check
```

It writes an object, reads it back and compares the bytes, streams it the way
downloads do, deletes it and confirms it is gone. Each failure prints what to
change, because the S3 error codes are misleading on their own — a wrong
endpoint surfaces as a DNS error and a wrong bucket as a permissions error.

Set the same five variables in your host's environment before deploying.

## Keep the bucket private

The app streams every file through `src/app/api/files/[id]/route.ts`, which
enforces the rules that make the product work: a customer may fetch their own
uploads at any time, deliverables only once they have approved the order, and
drafts awaiting QC never.

That gate only holds while the bucket is unreachable any other way. So:

- no public access, and no `r2.dev` development domain enabled,
- no custom domain bound to this bucket,
- no bucket policy granting anonymous reads,
- the API token scoped to this one bucket, nothing wider.

Presigned URLs, if they are ever added, work against the S3 API hostname and do
not need public access either.

## The checksum settings

`src/lib/storage.ts` builds the client with:

```ts
requestChecksumCalculation: "WHEN_REQUIRED",
responseChecksumValidation: "WHEN_REQUIRED",
```

Do not remove these. Since `@aws-sdk/client-s3` v3.729.0 the SDK attaches a
CRC32 checksum to every upload and validates one on every download. R2 has since
implemented the simple buffered case, so plain writes work either way, but the
defaults still break three things we are one refactor away from:

- **Streamed uploads.** With a body of unknown length the SDK switches to
  `aws-chunked` transfer with a trailing checksum. R2 mishandles that, and it
  also stores `aws-chunked` in the object's `Content-Encoding`, which corrupts
  the object permanently.
- **Multipart uploads** (`@aws-sdk/lib-storage`), where the default CRC32
  full-object checksum is not one R2 implements.
- **Presigned PUT URLs**, where the signature would cover a checksum header the
  browser never sends, and R2 answers 403.

## What is stored, and where

Keys are `<orderId>/...`, so everything for one order shares a prefix and
`removeOrderFiles()` can delete it in one call.

| Key | What it is |
| --- | --- |
| `<orderId>/<timestamp>-<rand>-<name>` | Customer uploads and designer files |
| `<orderId>/previews/v<n>/slide-NNN.png` | Watermarked previews for that revision |

A QC resubmission deletes the previous round's draft rows **and** their objects,
so rejected rounds do not accumulate.

## Cost

R2 charges for stored bytes and operations, with no egress fee — which is the
reason to prefer it here, since customers download the same deck repeatedly.
A design service storing decks plus two copies of each slide image (the original
and the watermarked preview) sits in single-digit dollars per month at modest
volume. Check current prices before quoting them to anyone.

## Rotating credentials

Create the new token first, update the environment, run `npm run storage:check`
against it, then delete the old token. Keys already stored do not change, so
rotation is invisible to customers.

## Known limitation: upload size on Vercel

Vercel caps a serverless function's **request** body at 4.5 MB, and uploads
currently travel through the app. R2 does not change that: on Vercel a designer
still cannot submit a large deck.

Responses are streamed rather than buffered, so downloads are not subject to the
same cap — but that should be confirmed on a real deployment rather than
assumed.

The fix is uploading straight from the browser to R2 with a presigned URL and
having the app record the key afterwards. That work has a sharp edge worth
knowing before starting: **a presigned PUT can be replayed until it expires**, so
any check the server does after the upload can be invalidated by re-uploading to
the same URL. Signing `If-None-Match: *` into the URL makes the write
single-shot and closes that hole.
