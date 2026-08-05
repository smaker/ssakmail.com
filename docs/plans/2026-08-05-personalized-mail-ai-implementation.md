# Personalized Mail AI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add consented, privacy-preserving personalized mail recommendations using Cloudflare D1, Vectorize, and Workers AI.

**Architecture:** A shared preference package masks mail content, validates model results, and provides a deterministic fallback. App-local routes use authenticated sessions and Cloudflare bindings for consent, recommendations, feedback, and deletion. Shared UI exposes privacy, consent, explanations, corrections, and existing user-confirmed deletion actions.

**Tech Stack:** Next.js, TypeScript, Vitest, Cloudflare D1, Vectorize, Workers AI, Axios, TanStack Query, Biome.

---

### Task 1: Privacy-safe preference core

**Files:**
- Create: `packages/preference/src/index.ts`
- Create: `packages/preference/src/index.test.ts`
- Create: `packages/preference/package.json`
- Create: `packages/preference/tsconfig.json`

1. Write failing tests for masking, fallback scoring, and untrusted model-output validation.
2. Run the focused test and confirm it fails for missing exports.
3. Implement the minimum pure TypeScript functions.
4. Run focused tests and typecheck.

### Task 2: D1 schema and Cloudflare bindings

**Files:**
- Create: `database/migrations/0001_preferences.sql`
- Modify: `apps/web/wrangler.jsonc`
- Modify: `apps/mobile/wrangler.jsonc`

1. Define consent, feedback, and recommendation tables with per-user indexes.
2. Create one production D1 database and one Vectorize index.
3. Bind the same resources plus Workers AI to both apps.
4. Apply the migration remotely and regenerate binding types.

### Task 3: Authenticated preference services and routes

**Files:**
- Create: `packages/preference/src/cloudflare.ts`
- Create: `apps/{web,mobile}/lib/preference-route.ts`
- Create: `apps/{web,mobile}/app/api/preferences/**/route.ts`

1. Write failing tests for consent gates, feedback weights, namespace isolation, and fallback behavior.
2. Implement user-key derivation, D1 prepared statements, masked AI analysis, Vectorize retrieval/upsert, and structured validation.
3. Add GET/POST/DELETE routes for consent, recommendations, feedback, and learned-data deletion.
4. Verify unauthorized, non-consented, success, and degraded paths.

### Task 4: Privacy policy and consent UI

**Files:**
- Create: `packages/ui/src/privacy.tsx`
- Create: `apps/{web,mobile}/app/privacy/page.tsx`
- Modify: `apps/{web,mobile}/app/page.tsx`
- Modify: `apps/{web,mobile}/app/styles.css`

1. Add a public Korean privacy policy with current processing details and legal-review disclaimer.
2. Add a visible privacy link, optional AI consent, withdrawal, and learned-data deletion controls.
3. Ensure declining AI leaves Gmail and manual deletion fully usable.

### Task 5: Personalized recommendation and feedback UI

**Files:**
- Modify: `packages/ui/src/mail.tsx`
- Modify: `packages/ui/src/mail.test.ts`
- Modify: `apps/{web,mobile}/app/styles.css`

1. Write failing tests for recommendation labels and feedback state.
2. Add confidence, explanation, `선호함`, `선호하지 않음`, and delete-review actions.
3. Invalidate recommendation and message queries after feedback or deletion.
4. Keep every destructive action behind the existing confirmation dialog.

### Task 6: Verification, review, delivery

1. Run focused tests, full tests, Biome, typecheck, audit, Next builds, OpenNext builds, and Wrangler dry-runs.
2. Review the complete diff for privacy, authorization, data isolation, accessibility, and failure modes; fix every finding and repeat checks.
3. Commit and push only intended files; verify local and remote SHA parity.
4. Deploy both Cloudflare Workers.
5. Verify privacy page, consent, recommendation fallback/AI behavior, feedback, withdrawal, learned-data deletion, and delete confirmation without deleting a real message.

