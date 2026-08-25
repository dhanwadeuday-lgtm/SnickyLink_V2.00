# SnickyLink — Architecture

## Architecture Substitutions

The user's original spec requested Expo/React Native, NestJS, PostgreSQL+Prisma, Redis+BullMQ,
Firebase/Expo push, S3, and Docker Compose. This sandbox environment deploys exclusively to
**Cloudflare Pages/Workers**, which cannot run any of the above (no Node.js runtime APIs, no
persistent servers, no Docker). The following substitutions were made and communicated to the
user before implementation began:

| Requested | Used Instead | Why |
|---|---|---|
| Expo / React Native | Installable PWA (vanilla JS ES modules) | Workers can only serve static assets + edge functions; no native mobile build pipeline available |
| NestJS | Hono | Lightweight, purpose-built for the Workers edge runtime; NestJS depends on Node.js reflection/DI internals unavailable on Workers |
| PostgreSQL + Prisma | Cloudflare D1 (SQLite) | D1 is Cloudflare's first-party edge database; Prisma's engine binary can't run in Workers |
| Redis + BullMQ | Synchronous D1 operations | No persistent background-worker runtime on Workers; all XP/notification logic runs synchronously inside the request that triggers it |
| Firebase/Expo push | In-app notification list + push-token registration stub | Full push delivery requires a persistent push gateway; the schema and API are ready to wire up FCM via a Workers-compatible HTTP call in the future |
| S3 | Cloudflare R2 (planned, not yet wired for chat attachments) | R2 is the Workers-native S3-compatible object store |
| Docker Compose | `wrangler pages dev --local` + PM2 | No container runtime in this sandbox; wrangler's local D1 emulation is the Workers-native equivalent |

## Request Lifecycle

```
Browser (PWA)
  → hash router (public/static/app.js) dispatches to screen module
  → screen module calls api.* (public/static/api.js) — fetch wrapper w/ JWT + auto-refresh
  → Hono app (src/index.tsx) → CORS + security headers → /api/v1/* sub-router
  → route handler (src/routes/*.ts) → D1 prepared statements / db.batch()
  → JSON response back to browser
```

Static assets (`/static/*`, `manifest.json`, `sw.js`) are served via `hono/cloudflare-workers`'s
`serveStatic` directly from the `public/` directory — no filesystem reads at runtime.

The SPA shell itself is a single Hono JSX-rendered `<div id="app">` (see `src/renderer.tsx`)
that the router mounts into; there is no server-side per-route rendering — everything past the
initial HTML shell is client-side JS.

## XP Engine (`src/lib/game.ts`)

Central single-entry-point for all XP awards: `awardXp(db, coupleId, amount, pillarShare, source, sourceId)`.

1. Reads current couple + pillar-stats rows
2. Splits `amount` into 4 pillar amounts by percentage share (remainder absorbed by `trust` to avoid rounding loss)
3. Computes new couple level via `levelFromXp()` — cumulative-XP formula `xpForLevel(L) = 500·L·(L-1)`
4. Computes new pillar levels via `pillarLevelFromXp()` — gentler curve `xpForPillarLevel(L) = 150·L·(L-1)`
5. Updates streak using **UTC date continuity**: same day → no change; yesterday → +1; gap → reset to 1
6. Assigns league by XP threshold (`SELECT ... WHERE min_xp <= ? ORDER BY min_xp DESC LIMIT 1`)
7. Writes all of the above as one `db.batch()` — XP ledger insert, couple update, pillar-stats upsert, streak-log insert — so the operation is atomic within D1's batch semantics
8. Runs achievement checks (`checkAndUnlockAchievements`) in a second pass, applying any achievement XP bonus as a separate simple update (not recursive back into `awardXp`)
9. Returns a structured result (`XpAwardResult`) so callers (snick verification routes) can fire the right notifications (level-up, achievement-unlocked, partner-completed)

This function is the **only** place XP is ever written — both the auto-approve path
(`SELF_CONFIRMATION` / `OPTIONAL_NON_SENSITIVE_EVIDENCE`) and the partner-verification path
(`PARTNER_CONFIRMATION` / `MUTUAL_COMPLETION`) call the same `approveCompletion()` helper in
`src/routes/snicks.ts`, which in turn calls `awardXp()`.

## Snicks State Machine

```
snick_completions.status:
  PENDING ──(auto-approve if SELF_CONFIRMATION/OPTIONAL_NON_SENSITIVE_EVIDENCE)──> APPROVED
  PENDING ──(partner verifies, decision=APPROVED)──> APPROVED
  PENDING ──(partner verifies, decision=REJECTED)──> REJECTED
  PENDING ──(never verified in time)──> EXPIRED  [not yet automated — would need a cron trigger]
  APPROVED ──(disputed after the fact)──> DISPUTED [schema supports; no route currently transitions here]
```

Journey-map **display state** (`completed | current | locked | future`) is derived, not stored:
- `completed` — latest completion for this snick has `status = APPROVED`
- `current` — latest completion has `status = PENDING` (awaiting partner action), OR this is the
  first snick in `sequence_index` order with no completion yet whose prior siblings are all `APPROVED`
- `locked` — a prior sibling in the same frequency is not yet `APPROVED`

## Deployment Path (Cloudflare)

Two supported paths once the user is ready to go live:
1. **BYOK** (`cf-byok-deploy` skill) — user's own Cloudflare account, direct `wrangler pages deploy`
2. **Genspark-hosted** (`gsk-hosted-deploy` skill) — Genspark-managed Cloudflare account via `gsk hosted_*` commands, D1/R2 bindings only (no `kv_namespaces` — this project does not use KV, so it is hosted-deploy compatible as-is)

Neither has been run yet; the app is currently only verified in sandbox dev mode.
