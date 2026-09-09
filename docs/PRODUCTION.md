# Going to production

The database is Neon Postgres, files are on Cloudflare R2, and the app is meant
for Vercel at `design.slidebazaar.com`.

## What is already done

- `prisma/schema.prisma` uses `provider = "postgresql"`.
- The initial migration exists at `prisma/migrations/20260909000000_init/` and
  has been applied to Neon. All 19 tables are live.
- The service catalogue is seeded; there are no demo accounts and no orders.
- The R2 bucket is empty and verified with `npm run storage:check`.

## Before the first real customer

`checkEnv()` in `src/lib/env.ts` refuses to boot production when any of these is
wrong, so a half-finished switchover fails loudly rather than quietly taking
orders it cannot fulfil. Check with `NODE_ENV=production npx tsx --conditions=react-server -e "import('./src/lib/env').then(m=>console.log(m.envProblems()))"`.

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | 32+ random characters, unique to production |
| `APP_URL` | `https://design.slidebazaar.com` |
| `STRIPE_SECRET_KEY` | Must be `sk_live_`, not `sk_test_` |
| `STRIPE_WEBHOOK_SECRET` | From the live webhook endpoint, not the CLI |
| `SMTP_HOST` etc. | Customer email |
| `S3_BUCKET` and R2 keys | File storage |
| `GOOGLE_CLIENT_ID` / `SECRET` | Optional; the button hides without them |

### Two outstanding blockers

**Stripe is on a sandbox key.** `sk_test_` collects nothing. Real cards are
declined, and the escrow ledger records money that never arrived. Swap in the
live key, and register a real webhook endpoint at
`https://design.slidebazaar.com/api/webhooks/stripe` subscribed to
`checkout.session.completed` and `checkout.session.async_payment_succeeded`.
That page gives you the live signing secret. The CLI secret from
`stripe listen` does not work in production.

**No SMTP.** Without it, password resets, email verification, order updates and
QC notifications are written to a log file instead of being sent. A customer who
forgets their password has no way back in.

## Deploying

1. Set every variable above in Vercel, Production scope. Mark the secrets
   sensitive. Do not commit `.env`; it is gitignored and must stay that way.
2. Point `design.slidebazaar.com` at the Vercel project and wait for the
   certificate. Leave the apex `slidebazaar.com` on WordPress.
3. Deploy. `npm run build` runs `prisma generate`.
4. Run migrations against production: `npx prisma migrate deploy`. Never
   `migrate dev` and never `db push` against production — both can drop data.
5. Create your admin if it does not exist: `npm run bootstrap` with
   `ADMIN_EMAIL` set. It refuses to run on a database that already has orders,
   and refuses to promote an existing account.

## Local development after this change

There is one Prisma provider for all environments, so local development needs a
Postgres URL too. **Do not develop against the production database.**

Neon has branching for exactly this: Neon console, Branches, create one from
production, and put its URL in `.env.local` as `DATABASE_URL`. `.env.local` is
gitignored and takes precedence over `.env`.

`npm run db:reset` refuses any `DATABASE_URL` that is not local, so it cannot
wipe Neon by accident. It has been tested against the production URL and
correctly refuses.

Note that `.env` currently holds production values because they were needed to
run the migration. Once the variables are set in Vercel, the safest thing is to
point `.env` at a dev branch and let Vercel own the production values.

## Known limitation

Uploads pass through the app, and Vercel caps a function request body at 4.5 MB.
A designer cannot submit a large deck on Vercel until uploads go straight from
the browser to R2 with a presigned URL. Downloads stream, so they are not
affected by the same cap, though that is worth confirming on the real
deployment. See the end of `docs/STORAGE-R2.md`.

## Runbook

| Task | Command |
| --- | --- |
| Verify storage | `npm run storage:check` |
| Verify money paths | `npm run verify:money` |
| Verify auth helpers | `npm run verify:auth` |
| Apply migrations | `npx prisma migrate deploy` |
| Create an admin | `ADMIN_EMAIL=... npm run bootstrap` |
| Settle stuck refunds | `npm run refunds:settle` |

## Credentials to rotate

Anything pasted into a chat, an issue or a screenshot should be replaced before
launch: the Neon password, the R2 access key and secret, and any Cloudflare API
token. Rotation is invisible to customers — stored object keys and database rows
do not change.
