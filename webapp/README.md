# 💕 SnickyLink

**A gamified relationship platform for couples.** Partners complete "Snicks" (relationship missions), earn XP, build streaks, level up, grow four gameplay pillars — **Communication, Emotional Connection, Efforts, Trust** — and compete on city/country leaderboards.

> ⚠️ **Platform note**: This build targets **Cloudflare Pages/Workers** (the sandbox's deployment platform), not the originally-requested Expo/NestJS/Postgres/Redis stack. See [Architecture Substitutions](#architecture-substitutions) below for the full mapping and rationale.

---

## ✅ Currently Completed Features

### Backend (Hono + Cloudflare D1, `/api/v1/*`)
- **Auth**: register, login, refresh (rotating refresh tokens), logout, `/me` get/patch — JWT (HS256, hand-rolled via Web Crypto), PBKDF2-HMAC-SHA256 password hashing (100k iterations)
- **Couples**: create, invite-code generation, join-by-code, get/update couple profile
- **Snicks**: journey-map listing (per frequency, with computed `completed/current/locked/future` state), detail, start, complete, partner-verify — full `PENDING → APPROVED/REJECTED` state machine with 4 verification-type branches
- **XP Engine** (`src/lib/game.ts`): atomic `awardXp()` — splits XP into 4 pillar shares, updates couple level (`500·L·(L-1)` formula), pillar levels (`150·L·(L-1)` formula), streak (UTC day-continuity), league assignment, achievement unlocking — all in one D1 batch
- **Chat**: genuinely **end-to-end encrypted** — ECDH P-256 + AES-GCM 256 via native browser Web Crypto; server stores **ciphertext + iv only**, never plaintext; disappearing messages, read receipts, typing state
- **Community**: posts, likes, comments, saves, reports, blocks
- **Leaderboard**: city/country scope, league system, rewards unlock teaser
- **Profile**: pillar breakdown, stats, achievements
- **Notifications**: list, mark-read, preferences, device registration (push-token placeholder)
- **Admin**: full CRUD on snicks/categories/achievements/leagues/rewards, user/couple moderation, report moderation, analytics summary, audit log — all behind `requireAdmin`
- **Analytics**: privacy-whitelisted event ingestion only (`dau_ping`, `snick_viewed`, `leaderboard_viewed`, `community_viewed`) — chat content never reaches analytics
- **Security**: RBAC (`requireAuth`/`requireAdmin`/`requireCouple`), CORS, security headers, input validation, audit logging on every admin mutation
- **Docs**: hand-written OpenAPI 3.0 spec at `/api/v1/openapi.json`, rendered via Swagger UI at `/api/docs`

### Frontend (PWA — vanilla JS ES modules, hash-router SPA)
- 5-tab bottom nav: **Home · Chat · Snicks · Leaderboard · Profile**
- **Home**: community feed (text-first posts), like/comment/report/delete, FAB for new post
- **Chat**: chat list + conversation view, real E2EE encrypt/decrypt in-browser, bubbles, typing indicator, read ticks
- **Snicks**: visual journey map, Daily(gold)/Weekly(purple)/Monthly(orange) color coding, doodles (mountains/sun/clouds/stars), node states, detail modal, completion celebration
- **Leaderboard**: city/country toggle, top-3 podium, league banner, rewards teaser
- **Profile**: couple card with XP bar, 4 pillar cards, settings list (theme toggle, logout, help)
- **Day/Night theme**: CSS custom properties (`--sl-*`), `[data-theme='dark']` attribute switch — exact palette from the reference design
- **PWA**: installable via `manifest.json` + `sw.js` (service worker explicitly never caches `/api/*`)

### Data
- 30-table D1/SQLite schema (`migrations/0001_init.sql`) covering every domain in the spec
- Full seed dataset (`seed.sql`): 3 real login accounts + 8 rival-couple placeholder users, 1 fully-populated demo couple (Level 5, 12,650 XP, 6-day streak, Diamond league) + 5 rival couples for the leaderboard, 14 Snicks across Daily/Weekly/Monthly journeys, pre-approved completions, 11 achievements, 5 leagues, 6 rewards, 6 community posts + comments

## 🔗 API Entry Points (all under `/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET/PATCH /auth/me` |
| Couples | `POST /couples`, `POST /couples/invites`, `POST /couples/join`, `GET/PATCH /couples/me` |
| Snicks | `GET /snicks?frequency=DAILY\|WEEKLY\|MONTHLY`, `GET /snicks/:id`, `POST /snicks/:id/start`, `POST /snicks/:id/complete`, `POST /snicks/completions/:id/verify` |
| Chat | `GET /chat/conversations`, `GET/POST /chat/conversations/:id/messages`, `POST /chat/conversations/:id/read`, `PATCH /chat/conversations/:id` |
| Community | `GET/POST /community/posts`, `PATCH/DELETE /community/posts/:id`, `POST /community/posts/:id/like`, `POST /community/posts/:id/save`, `GET/POST /community/posts/:id/comments`, `POST /community/reports`, `POST /community/blocks` |
| Leaderboard | `GET /leaderboard?scope=city\|country`, `GET /leaderboard/leagues`, `GET /leaderboard/rewards` |
| Profile | `GET /profile/pillars`, `GET /profile/stats`, `GET /profile/achievements` |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET/PATCH /notifications/preferences`, `POST /notifications/devices` |
| Admin (requires `role=admin`) | `/admin/users`, `/admin/couples`, `/admin/snicks`, `/admin/snick-categories`, `/admin/achievements`, `/admin/leagues`, `/admin/rewards`, `/admin/reports`, `/admin/analytics/summary`, `/admin/audit-logs` |
| Analytics | `POST /analytics/events` (whitelist-only) |
| Docs | `GET /api/v1/openapi.json`, `GET /api/docs` (Swagger UI) |
| Health | `GET /api/health` |

Full request/response contracts: see [`docs/api.md`](docs/api.md) and the live Swagger UI at `/api/docs`.

## 🌐 URLs
- **Local dev**: `http://localhost:3000` (via PM2 + `wrangler pages dev`)
- **Production**: not yet deployed — see [Deployment](#deployment) below

## 🗄️ Data Architecture
- **Storage**: Cloudflare D1 (SQLite-compatible), 30 tables — see [`docs/database.md`](docs/database.md) for the full ERD-style breakdown
- **Chat storage**: `encrypted_messages` table stores **ciphertext + iv only** — no plaintext column exists anywhere in the schema
- **Data flow**: Hono API routes → D1 prepared statements / `db.batch()` for atomic multi-table writes (XP engine) → JSON responses. Frontend never talks to D1 directly; all access goes through `/api/v1/*`.

## 👤 User Guide (Demo Accounts)

| Email | Password | Role | Notes |
|---|---|---|---|
| `demo1@snickylink.app` | `Demo1234!` | user | "Ari" — half of couple **UsForever** |
| `demo2@snickylink.app` | `Demo1234!` | user | "Sam" — half of couple **UsForever** |
| `admin@snickylink.app` | `Admin1234!` | admin | Access `/api/docs` and all `/api/v1/admin/*` routes |

1. Open the app → log in with `demo1@snickylink.app` / `Demo1234!`
2. **Home**: browse the community feed, like/comment, tap the FAB to post
3. **Snicks**: switch Daily/Weekly/Monthly tabs, tap a map node to see detail, start/complete a Snick
4. **Chat**: open the conversation with "Sam" — messages are encrypted client-side before ever leaving the browser
5. **Leaderboard**: toggle City/Country, see UsForever ranked among rival couples in Pune
6. **Profile**: view XP bar, 4 pillar cards, tap the settings gear to toggle Day/Night theme

## 🚀 Deployment

**Status**: ✅ Running in sandbox dev mode (PM2 + `wrangler pages dev --local`) — not yet deployed to production Cloudflare.

- **Tech stack**: Hono + TypeScript + Cloudflare D1 + vanilla-JS PWA frontend + Tailwindless custom CSS design system
- **Local dev**: `npm run build && pm2 start ecosystem.config.cjs`
- **Production deploy**: requires choosing a Cloudflare deploy path (BYOK vs Genspark-hosted) — see [`docs/architecture.md`](docs/architecture.md) for details
- **Last updated**: 2026-08-23

## 📚 Further Documentation
- [`docs/architecture.md`](docs/architecture.md) — stack substitutions, request lifecycle, XP engine internals
- [`docs/api.md`](docs/api.md) — full endpoint reference with request/response shapes
- [`docs/database.md`](docs/database.md) — schema, table relationships, indexing strategy
- [`docs/security.md`](docs/security.md) — auth, E2EE, RBAC, privacy architecture, threat model notes

## ⏭️ Not Yet Implemented / Next Steps
- Real push notifications (Firebase/Expo equivalent) — currently a device-token registration stub only; in-app notification list works fully
- File/media attachments in chat (schema supports `attachment_ref` + R2 key, but R2 upload endpoint not yet wired)
- Rate limiting is a Cloudflare-zone-level concern (not enforceable in-app on Workers) — documented but not configured
- Production Cloudflare deployment (D1 remote migration + `wrangler pages deploy`) — pending user's choice of deploy path
- Automated test suite (unit/integration) — currently validated via manual curl-based end-to-end journey testing
