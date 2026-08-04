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
