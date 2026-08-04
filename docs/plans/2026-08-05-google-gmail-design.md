# Google Login and Gmail Integration Design

## Understanding summary

- Add Google login to both `apps/web` and `apps/mobile`.
- Let signed-in test users list recent Gmail messages and read message details.
- Support both moving a message to trash and permanently deleting it.
- Require a second explicit confirmation before permanent deletion.
- Use Cloudflare Workers as the primary deployment target and retain Vercel as backup.
- Keep the OAuth application in testing mode for the owner and named test users.
- Do not persist Gmail content or OAuth tokens in a database.

## Assumptions

- Gmail access is interactive only; there is no background synchronization or scheduled processing.
- Google profile scopes are requested at sign-in and `https://mail.google.com/` is requested in context when Gmail is connected.
- Access and refresh tokens live only in an encrypted, HttpOnly Auth.js JWT session cookie.
- Google OAuth credentials and the Auth.js secret are stored as Cloudflare Worker secrets and never committed.
- Both applications use the same Google OAuth client with distinct authorized callback URLs.
- Vercel deployments stay available but are not the release authority for this feature.

## Architecture

Use stable Auth.js for Next.js authentication, Axios for Gmail REST calls, TanStack Query for client state, and OpenNext for Cloudflare Workers. Shared authentication, Gmail request logic, types, and state presentation live in workspace packages. Each app keeps its own Auth.js route handler and responsive layout while reusing the shared behavior.

The Gmail permission grant is incremental. Initial login asks only for identity. Entering the mail experience asks for `https://mail.google.com/`, offline access, and explicit consent. Gmail API calls run only through server route handlers, so access and refresh tokens are never returned to browser JavaScript.

## Data flow

1. A user signs in with Google identity scopes.
2. The user selects **Gmail 연결** and approves the restricted Gmail scope.
3. Auth.js stores provider tokens in its encrypted JWT session.
4. The UI calls local Next.js route handlers.
5. Route handlers refresh an expired access token when possible, then call Gmail with Axios.
6. Query results remain in the browser cache and are not persisted by the application.
7. Trash and permanent-delete mutations invalidate or remove the affected cached message.

## Error and safety behavior

- Missing or revoked authorization returns `401` and shows a reconnect action.
- Missing Gmail scope returns `403` and disables Gmail actions until the user grants it.
- A stale message returns `404` and is removed from the visible list.
- Gmail `429` and transient `5xx` responses produce a retryable error without duplicating mutations.
- Permanent deletion requires an explicit warning dialog and a second destructive action.
- Destructive buttons are disabled while a request is active.
- Dialog focus, keyboard operation, and status announcements remain accessible.

## Verification

- Unit tests cover scope detection, token refresh outcomes, Gmail response mapping, and error mapping.
- Route tests mock Axios and cover authorization plus trash/delete calls.
- UI tests cover pending, connected, reconnect, trash, and permanent-delete confirmation states.
- Biome, TypeScript, Vitest, Next.js builds, OpenNext builds, Wrangler dry-runs, and deployed browser/API smoke checks must pass.
- Actual Google consent and Gmail actions remain a credential-gated final check after the OAuth client is created and test users are registered.

## Decision log

1. **Cloudflare Workers is primary.** Vercel remains a backup deployment only.
2. **Two Workers, one monorepo.** Web and mobile deploy independently from `apps/web` and `apps/mobile`.
3. **Auth.js over custom OAuth.** Reuse a maintained implementation for state, cookies, callbacks, and session handling.
4. **Incremental Gmail authorization.** Ask for restricted mailbox access only when a signed-in user enters Gmail functionality.
5. **No application database.** Interactive-only access makes encrypted session storage sufficient for the stated test-user scope.
6. **Both deletion modes.** Trash is the normal action; permanent deletion is separately confirmed and calls Gmail's irreversible delete endpoint.
