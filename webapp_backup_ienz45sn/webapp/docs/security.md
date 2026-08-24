# SnickyLink Security & Privacy Architecture

## Authentication

- **Password storage**: PBKDF2-HMAC-SHA256, 100,000 iterations, random 16-byte salt, 256-bit
  derived key, base64-encoded — implemented in `src/lib/crypto.ts` using only the native
  `crypto.subtle` Web Crypto API (no external bcrypt/argon2 library, since those require
  Node-native bindings unavailable on Workers).
- **Comparison**: constant-time-ish XOR accumulation compare in `verifyPassword()`, avoiding
  short-circuit string comparison timing leaks.
- **Tokens**: hand-rolled JWT (HS256) via HMAC over base64url-encoded header+payload, signed with
  `JWT_ACCESS_SECRET` / a separate refresh-token hashing scheme (see below). Access tokens expire
  in **15 minutes**.
- **Refresh tokens**: never stored in plaintext server-side — only their SHA-256 hash is stored in
  `user_sessions.refresh_token_hash`. The token itself is `sessionId.rawSecret`; the raw secret is
  hashed and compared on every refresh. Refresh tokens **rotate** on use (old session revoked,
  new one issued) — a stolen-then-reused refresh token after rotation will fail, revealing replay.
- **Session revocation**: `POST /auth/logout` revokes a specific session by id; there's no
  "revoke all sessions" endpoint yet (documented gap, not implemented).

## RBAC

- `requireAuth` — verifies the Bearer JWT via `verifyJwt()`, populates `c.set('user', ...)`
- `requireAdmin` — checks `user.role === 'admin'` (role is embedded in the JWT payload at issuance, not re-fetched from DB per-request — meaning a role change won't take effect until the user's token is refreshed/re-issued; documented tradeoff for latency)
- `requireCouple` — checks `user.coupleId` is truthy, returning `409 NoCouple` otherwise — gates all couple-scoped features (snicks, chat, community posting, leaderboard, profile)

## End-to-End Encryption (Chat)

This is a **real** E2EE implementation, not a cosmetic label:

1. On first use, each device generates an ECDH P-256 key pair via `crypto.subtle.generateKey()`
   and persists it in **IndexedDB** (`public/static/e2ee.js`, `ensureKeyPair()`) — the private key
   **never leaves the device** and is never transmitted in any API call.
2. The public key (as JWK) is uploaded via `PATCH /auth/me { publicKeyJwk }` on every login —
   this is the only key material that ever reaches the server, and it's a public key by design.
3. To send a message, the client derives a shared secret via ECDH using its own private key +
   the partner's public key, then encrypts the plaintext with AES-GCM-256 using that shared key.
4. `POST /chat/conversations/:id/messages` requires `{ ciphertext, iv }` — the server validates
   presence and size only; **it has no way to decrypt this payload** since it never has either
   party's private key.
5. The `encrypted_messages` table schema physically has no plaintext column — this is enforced
   architecturally, not just by application logic.
6. Decryption happens symmetrically client-side when messages are fetched.
7. `selfEncrypt()` is a graceful fallback used only before a partner's public key has synced (so
   the sender's own device can still display its own sent message locally) — it is never used for
   the wire payload once a partner key is available.

**Support implication**: this means SnickyLink support staff — and SnickyLink's own admins —
genuinely cannot read couples' private messages, even to resolve support tickets. This is stated
explicitly in the in-app Help screen.

## Input Validation & Abuse Controls

- Every mutating route validates required fields and types before touching the database (see
  each `src/routes/*.ts` file — e.g. post content length 3-1000 chars, comment 1-500 chars,
  report reason ≥3 chars, chat ciphertext capped at 20,000 chars / `413 PayloadTooLarge`)
- Duplicate-prevention: unique constraints on nickname, email, invite code, likes/saves/blocks
  (composite unique indexes), and a partial unique index preventing two simultaneously-active
  completions of the same snick by the same couple
- **Rate limiting**: not implemented at the application layer — Cloudflare Workers has no
  persistent in-memory state across requests to build a token-bucket limiter reliably. The
  intended production mitigation is Cloudflare's zone-level WAF/rate-limiting rules (configured
  outside this codebase, in the Cloudflare dashboard) — documented as a deployment-time TODO,
  not a code gap.

## Security Headers & CORS

Applied globally to all `/api/*` responses in `src/index.tsx`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- CORS enabled via `hono/cors` middleware on `/api/*`

## Privacy-by-Design: Analytics

`src/routes/analytics.ts` enforces an explicit **allow-list** (`ALLOWED_EVENTS` Set):
`dau_ping`, `snick_viewed`, `leaderboard_viewed`, `community_viewed`. Any other `eventType` is
rejected outright. This is a deliberate architectural choice to guarantee chat content, private
snick notes, and other sensitive fields can never accidentally flow into `analytics_events` —
even a bug that tried to log message content would be rejected by this whitelist before an
INSERT is ever attempted.

## Audit Logging

Every admin mutation (`src/routes/admin.ts`) calls `audit(db, adminUserId, action, targetType, targetId, meta)`,
writing an immutable row to `audit_logs`. This covers: user status changes, snick CRUD,
report moderation. Admin *reads* (GET endpoints) are not audited, only mutations.

## Known Gaps (documented, not silently omitted)

- No "revoke all sessions" / "sign out everywhere" endpoint
- No email verification flow (the `users.email_verified_at` column exists and is set at
  registration time as a placeholder — no actual verification email is sent, since email
  delivery would require a third-party API integration not yet requested/configured)
- No automated `EXPIRED`/`DISPUTED` completion transitions (would require a scheduled Cron
  Trigger, which Cloudflare Workers supports but hasn't been configured in this build)
- No account-level 2FA
- Push notifications are a registration-stub only (see `docs/architecture.md`)
