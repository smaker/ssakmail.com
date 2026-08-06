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
