# ssakmail.com

Next.js monorepo for the ssakmail.com web and mobile experiences.

## Apps

- `apps/web`: desktop-first responsive web app
- `apps/mobile`: mobile-first web app

## Google OAuth

Create one Google OAuth web client in testing mode and register the owner and designated test users. Add these authorized redirect URIs:

- `https://ssakmail-web.dowon2308.workers.dev/api/auth/callback/google`
- `https://ssakmail-mobile.dowon2308.workers.dev/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3001/api/auth/callback/google`

Store `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` with `wrangler secret put` for each Worker. Never commit `.dev.vars` or OAuth credentials.

The app requests Google identity scopes at login, then requests `https://mail.google.com/` only when the user connects Gmail. Permanent deletion cannot be undone.

## Microsoft OAuth

Register an Entra ID application and add these redirect URIs:

- `https://ssakmail-web.dowon2308.workers.dev/api/auth/callback/azure-ad`
- `https://ssakmail-mobile.dowon2308.workers.dev/api/auth/callback/azure-ad`
- `http://localhost:3000/api/auth/callback/azure-ad`
- `http://localhost:3001/api/auth/callback/azure-ad`

Store `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`, plus `MICROSOFT_TENANT_ID` when the app is single tenant; it defaults to `common`. The Microsoft sign-in button appears only while both credentials are set. Mailbox access uses `https://graph.microsoft.com/Mail.ReadWrite`, requested when the user connects the mailbox.

## IMAP accounts

Naver, Daum, Kakao and any other IMAP host connect with a mail address and an app password. The password is verified with an IMAP `LOGIN` and then kept only inside the NextAuth session cookie, which is encrypted with `AUTH_SECRET`; it is never written to the database.

IMAP needs raw TCP, which exists only in the Cloudflare Workers runtime (`cloudflare:sockets`). `pnpm dev` runs on Node, so IMAP sign-in fails there; use `pnpm --dir apps/web preview` to exercise it locally.

## Payments (PortOne V2)

Paid plans go through PortOne, so the underlying PG can be swapped by changing the channel key alone. Store these on the web Worker with `wrangler secret put`:

- `PORTONE_STORE_ID` — store identifier from the PortOne console
- `PORTONE_CHANNEL_KEY` — channel key of the PG contract in use
- `PORTONE_API_SECRET` — V2 API secret, used for server-side payment lookup
- `PORTONE_WEBHOOK_SECRET` — signing secret for webhook verification

Register `https://ssakmail-web.dowon2308.workers.dev/api/payments/webhook` as the webhook endpoint. Until all four values exist, `/api/payments/prepare` answers `503` and no checkout starts.

Prices live in `packages/billing` and are never read from the client: `prepare` writes a `PENDING` row, the browser opens the PortOne window, then `complete` (and the webhook) re-reads the payment from PortOne and approves it only when status, amount and currency all match. Both approval paths update the same `PENDING` row, so a duplicate arrival cannot extend a subscription twice.

Known IMAP limits: message ids change when a message moves between folders, and the list view classifies on headers alone because IMAP has no cheap body preview.

## Commands

```bash
pnpm install
pnpm dev
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

Cloudflare commands run from the specific application directory:

```bash
pnpm --dir apps/web preview
pnpm --dir apps/web deploy
pnpm --dir apps/mobile preview
pnpm --dir apps/mobile deploy
```
