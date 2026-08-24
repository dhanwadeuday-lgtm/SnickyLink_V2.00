# SnickyLink API Reference

Base URL: `/api/v1`. All endpoints (except `register`/`login`/`refresh`) require
`Authorization: Bearer <accessToken>`. Full machine-readable spec: `GET /api/v1/openapi.json`
(rendered at `/api/docs` via Swagger UI).

Access tokens expire after **15 minutes**; refresh tokens after **30 days** and rotate on every
use (`POST /auth/refresh` revokes the old session and issues a new one).

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, displayName }` | Password ≥ 8 chars. Returns `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | `{ email, password }` | Returns same shape as register |
| POST | `/auth/refresh` | `{ refreshToken }` | Rotates the session, returns new token pair |
| POST | `/auth/logout` | `{ refreshToken }` | Revokes the given session |
| GET | `/auth/me` | — | Current user profile |
| PATCH | `/auth/me` | `{ themePref?, displayName?, publicKeyJwk? }` | `publicKeyJwk` is the client's E2EE public key, synced on every login |

## Couples

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/couples` | `{ nickname, tagline?, city?, country? }` | Creates couple, pillar-stats row, chat conversation shell, and a 7-day invite code |
| POST | `/couples/invites` | — | Generates a fresh 8-char invite code |
| POST | `/couples/join` | `{ code }` | Joins via invite code; rejects self-invites and already-full couples |
| GET | `/couples/me` | — | Full couple detail incl. members, pillars, league |
| PATCH | `/couples/me` | `{ nickname?, tagline?, city?, country? }` | Nickname uniqueness enforced |

## Snicks

| Method | Path | Notes |
|---|---|---|
| GET | `/snicks?frequency=DAILY\|WEEKLY\|MONTHLY\|SPECIAL\|MYSTERY` | Journey map with computed `state` per item |
| GET | `/snicks/:id` | Detail + latest completion for this couple |
| POST | `/snicks/:id/start` | Creates a `PENDING` completion; notifies partner |
| POST | `/snicks/:id/complete` | `{ note? }` — auto-approves for `SELF_CONFIRMATION`/`OPTIONAL_NON_SENSITIVE_EVIDENCE`, else stays `PENDING` awaiting partner |
| POST | `/snicks/completions/:completionId/verify` | `{ decision: 'APPROVED'\|'REJECTED', note? }` — the starter cannot self-verify `PARTNER_CONFIRMATION`/`MUTUAL_COMPLETION` snicks |

`awardXp()` result (returned on approval) shape:
```json
{
  "xpAwarded": 40, "newXpTotal": 12490, "levelBefore": 5, "levelAfter": 5, "leveledUp": false,
  "streakCount": 6, "streakIncreased": false,
  "pillars": { "communication": {...}, "emotional": {...}, "efforts": {...}, "trust": {...} },
  "unlockedAchievements": [...], "leagueId": "lg_diamond"
}
```

## Chat (E2EE)

| Method | Path | Notes |
|---|---|---|
| GET | `/chat/conversations` | Couple's single conversation; last message is ciphertext-only |
| GET | `/chat/conversations/:id/messages?before=&limit=` | Ciphertext + iv only; marks delivered |
| POST | `/chat/conversations/:id/messages` | `{ ciphertext, iv, messageType?, attachmentKey? }` — server never decrypts |
| POST | `/chat/conversations/:id/read` | Marks partner's messages read |
| PATCH | `/chat/conversations/:id` | `{ disappearingSeconds: 0-604800 }` |

## Community

| Method | Path | Notes |
|---|---|---|
| GET | `/community/posts?sort=popular\|recent` | |
| POST | `/community/posts` | `{ content }` (3-1000 chars) |
| PATCH / DELETE | `/community/posts/:id` | Ownership-checked (couple must match) |
| POST | `/community/posts/:id/like` | Toggle |
| POST | `/community/posts/:id/save` | Toggle |
| GET / POST | `/community/posts/:id/comments` | |
| POST | `/community/reports` | `{ targetType, targetId, reason }` |
| POST | `/community/blocks` | `{ userId }` |

## Leaderboard

| Method | Path | Notes |
|---|---|---|
| GET | `/leaderboard?scope=city\|country` | Ranked by `xp_total DESC`, scoped to the caller's own city/country |
| GET | `/leaderboard/leagues` | All league tiers |
| GET | `/leaderboard/rewards` | Rewards with `unlocked` flag based on couple XP |

## Profile

| Method | Path | Notes |
|---|---|---|
| GET | `/profile/pillars` | Per-pillar level/percentage/xp |
| GET | `/profile/stats` | Total snicks completed, breakdown by frequency, streaks |
| GET | `/profile/achievements` | All achievements with `unlocked`/`unlockedAt` |

## Notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?limit=` | |
| POST | `/notifications/:id/read` | |
| POST | `/notifications/read-all` | |
| GET / PATCH | `/notifications/preferences` | |
| POST | `/notifications/devices` | `{ pushToken, platform }` — stub for future FCM/Expo push |

## Admin (`role = admin` required)

All under `/admin/*`: `users` (list/status), `couples` (list), `snicks` (full CRUD),
`snick-categories`, `achievements`, `leagues`, `rewards`, `reports` (moderate), `analytics/summary`,
`audit-logs`. Every mutation is recorded via `audit(db, adminUserId, action, targetType, targetId, meta)`.

## Analytics

| Method | Path | Notes |
|---|---|---|
| POST | `/analytics/events` | `{ eventType, meta? }` — **whitelist enforced**: only `dau_ping`, `snick_viewed`, `leaderboard_viewed`, `community_viewed` are accepted; anything else is rejected |

## Error Shape

All errors return `{ "error": "<ErrorCode>", "message"?: "<human readable>" }` with an
appropriate HTTP status (`400/401/403/404/409/410/413/422`).
