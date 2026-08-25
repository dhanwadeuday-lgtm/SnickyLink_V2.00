# SnickyLink Database Schema

Storage: **Cloudflare D1** (SQLite-compatible), defined in `migrations/0001_init.sql` (30 tables).
Local dev uses `wrangler`'s automatic local SQLite emulation (`--local` flag) — no separate local
database setup required.

## Table Groups

### App / Users
- `app_config` — admin-tunable key/value settings (e.g. XP curve constants)
- `users` — email, PBKDF2 password hash+salt, display name, avatar seed, `role` (user/admin), theme pref, E2EE `public_key_jwk`, status
- `user_devices` — push-token registrations (platform: web/ios/android)
- `user_sessions` — refresh-token session hashes with expiry + revocation

### Couples & Pillars
- `couples` — nickname, tagline, city/country, `xp_total`, `level`, streak fields, `league_id`
- `couple_members` — join table (max 2 per couple, enforced in route logic, not schema)
- `couple_invites` — invite codes with 7-day expiry, status lifecycle (pending/accepted/expired/revoked)
- `couple_pillar_stats` — per-couple XP + level for each of the 4 pillars (communication/emotional/efforts/trust)
- `couple_xp_events` — append-only XP ledger; every `awardXp()` call writes one row here — single source of truth for auditability

### Snicks
- `snick_categories` — grouping metadata + `color_key` (daily/weekly/monthly)
- `snicks` — title, description, frequency (DAILY/WEEKLY/MONTHLY/SPECIAL/MYSTERY), difficulty, `xp_reward`, 4 pillar percentage columns, `verification_type` (4 variants), `sequence_index` + `map_label` for journey-map ordering
- `snick_completions` — one row per attempt; `status` (PENDING/APPROVED/REJECTED/EXPIRED/DISPUTED); **partial unique index** `idx_completions_couple_snick_active` ensures a couple can't have two simultaneously-active (PENDING or APPROVED) completions for the same snick
- `snick_verifications` — audit trail of partner approve/reject decisions
- `couple_streak_log` — one row per active day, unique per `(couple_id, streak_date)` — used for retention analytics, separate from the denormalized `couples.streak_count` cache

### Chat (E2EE)
- `conversations` — one private conversation per couple, optional `disappearing_seconds`
- `conversation_members` — join table
- `encrypted_messages` — **`ciphertext` + `iv` columns only — no plaintext column exists anywhere in this schema.** Server-side code never has access to decrypted content. `expires_at` supports disappearing messages; `delivered_at`/`read_at` support receipts.

### Achievements / Leagues / Rewards
- `achievements` — `criteria_type` (SNICKS_COMPLETED/STREAK_DAYS/XP_TOTAL/PILLAR_LEVEL) + `criteria_value`, optional `xp_bonus`
- `couple_achievements` — unlock join table, unique per `(couple_id, achievement_id)`
- `leagues` — ordered tiers by `min_xp` threshold (Bronze→Diamond in seed data)
- `rewards` — optionally tied to a league, `unlock_xp` threshold

### Community
- `posts`, `comments`, `likes` (unique per post+user), `saved_posts` (unique per post+user)
- `reports` — polymorphic `target_type` (post/comment/user), moderation `status` lifecycle
- `blocks` — unique per `(blocker, blocked)`

### Notifications
- `notifications` — typed (9 enum values matching every game event), `data_json` for structured payload, `read_at`
- `notification_preferences` — per-user opt-in/out per notification type

### Admin / Analytics
- `audit_logs` — every admin mutation recorded with `admin_user_id`, `action`, `target_type/id`, `meta_json`
- `analytics_events` — `event_type` + optional `user_id`/`couple_id`/`meta_json`; **only privacy-whitelisted event types are ever inserted** (enforced in `src/routes/analytics.ts`, not at the DB layer)

## Key Design Decisions

- **IDs**: all primary keys are prefixed random hex strings generated via `newId(prefix)` (Web Crypto `getRandomValues`), e.g. `usr_...`, `cpl_...`, `snk_...` — no auto-increment integers, avoiding enumeration and simplifying D1 batch inserts
- **Timestamps**: stored as SQLite `datetime('now')` strings (ISO-ish, UTC) rather than Unix epoch, for readability during development
- **Denormalized level caches**: `couples.level` and `couple_pillar_stats.*_level` are caches of what `levelFromXp()`/`pillarLevelFromXp()` would compute from the XP totals — kept in sync by `awardXp()` on every write. Seed data must independently satisfy this invariant (see the `LEVEL CONSISTENCY FIX` section at the bottom of `seed.sql`).
- **No plaintext chat storage anywhere** — this is a hard architectural invariant, not just a route-level check; there is no column in `encrypted_messages` that could hold plaintext.
- **Foreign keys**: `PRAGMA foreign_keys = ON` at the top of the migration; all child tables reference parents with `ON DELETE CASCADE` where deletion should cascade (e.g. couple deletion cascades to members/pillar-stats/invites).

## Indexes

Indexes are placed on every foreign-key-style lookup column and on sort-critical columns:
`couples(xp_total DESC)` for leaderboard queries, `posts(status, created_at DESC)` and
`posts(like_count DESC)` for the community feed's two sort modes, `snicks(frequency, sequence_index)`
for journey-map ordering, `encrypted_messages(conversation_id, created_at)` for message pagination.
