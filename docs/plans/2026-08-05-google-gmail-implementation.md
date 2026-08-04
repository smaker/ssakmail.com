# Google Login and Gmail Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add secure Google authentication and interactive Gmail read, trash, and permanent-delete functionality to both deployed applications.

**Architecture:** Add shared Auth.js and Gmail REST packages, then expose thin app-local route handlers and responsive screens. Deploy each Next.js app through its own OpenNext Cloudflare Worker and keep secrets outside Git.

**Tech Stack:** Next.js 16, React 19, TypeScript, Auth.js 4, Axios, TanStack Query, PostCSS, Biome, Vitest, OpenNext Cloudflare, Wrangler

---

### Task 1: Lock authentication and Gmail contracts

**Files:**
- Create: `packages/auth/src/index.test.ts`
- Create: `packages/auth/src/index.ts`
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/gmail/src/index.test.ts`
- Create: `packages/gmail/src/index.ts`
- Create: `packages/gmail/package.json`
- Create: `packages/gmail/tsconfig.json`
- Modify: `tsconfig.json`

1. Write failing tests for Gmail scope detection, token refresh success/failure, message mapping, and Gmail error normalization.
2. Run `pnpm test` and confirm the new tests fail because the shared modules do not exist.
3. Implement the minimum shared Auth.js callbacks and Axios Gmail client required by the tests.
4. Run `pnpm test` and confirm the contract tests pass.

### Task 2: Add app-local authentication routes

**Files:**
- Create: `apps/web/auth.ts`
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/types/next-auth.d.ts`
- Create: `apps/mobile/auth.ts`
- Create: `apps/mobile/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/mobile/types/next-auth.d.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/mobile/package.json`

1. Add Auth.js and shared workspace dependencies.
2. Configure identity-only Google login plus a second consent request for `https://mail.google.com/`.
3. Store provider tokens only in the encrypted JWT session and refresh access tokens server-side.
4. Add route-handler tests for unauthenticated, missing-scope, and connected states.
5. Run targeted tests and TypeScript checks.

### Task 3: Add Gmail server routes

**Files:**
- Create: `apps/web/app/api/gmail/messages/route.ts`
- Create: `apps/web/app/api/gmail/messages/[id]/route.ts`
- Create: `apps/web/app/api/gmail/messages/[id]/trash/route.ts`
- Create: `apps/web/app/api/gmail/messages/[id]/delete/route.ts`
- Create corresponding files under `apps/mobile/app/api/gmail/`
- Test: app-local `*.test.ts` files beside route handlers

1. Write failing authorization and Axios request tests.
2. Add thin route handlers that delegate to `@ssakmail/gmail`.
3. Return consistent `401`, `403`, `404`, `429`, and `502` responses.
4. Run route tests and TypeScript checks.

### Task 4: Build the shared mail UI

**Files:**
- Create: `packages/ui/src/mail.test.ts`
- Create: `packages/ui/src/mail.tsx`
- Modify: `packages/ui/src/index.tsx`
- Modify: `packages/ui/package.json`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/styles.css`
- Modify: `apps/mobile/app/page.tsx`
- Modify: `apps/mobile/app/styles.css`

1. Write failing tests for login, Gmail-connect, list/detail, mutation-pending, and permanent-delete confirmation states.
2. Add the minimum shared components and TanStack Query hooks.
3. Keep web as a split list/detail layout and mobile as list-to-detail navigation.
4. Verify keyboard focus, accessible labels, and live status announcements.
5. Run UI tests, Biome, and TypeScript.

### Task 5: Configure Cloudflare per application

**Files:**
- Create: `apps/web/open-next.config.ts`
- Create: `apps/web/wrangler.jsonc`
- Create: `apps/mobile/open-next.config.ts`
- Create: `apps/mobile/wrangler.jsonc`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/mobile/next.config.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/mobile/package.json`
- Modify: `.gitignore`
- Modify: `README.md`

1. Add `@opennextjs/cloudflare` and Wrangler to each app without adding a root deployment abstraction.
2. Configure `ssakmail-web` and `ssakmail-mobile` Workers with `nodejs_compat` and app-local build/deploy scripts.
3. Run both OpenNext builds and Wrangler dry-runs from the app directories.
4. Document required callback URLs, test users, and secret names without recording secret values.

### Task 6: Review, publish, and deploy

1. Run `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
2. Run an independent code/security/accessibility review and close every finding.
3. Commit only intended files and push `main`; prove local and remote SHA equality.
4. Create or update both Cloudflare Workers and add `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` as secrets when credentials exist.
5. Deploy both Workers and verify production HTML, static assets, auth endpoints, browser consoles, and mobile viewport behavior.
6. Report the credential-gated Google consent/Gmail live-check gap if the OAuth client is still unavailable.
