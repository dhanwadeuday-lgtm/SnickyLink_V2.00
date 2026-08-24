-- ============================================================
-- SNICKYLINK — Migration 0002: Verification & Habit Algorithm
-- See docs/habit-algorithm.md for the full design rationale.
--
-- Changes:
--   1. snicks: add CHALLENGE to frequency enum + richer verification
--      metadata columns (verification_method/level/safety_status/privacy_rule)
--      surfaced from the Excel dataset (kept alongside the existing
--      functional verification_type enum, not replacing it).
--   2. snick_completions: add SKIPPED status (for CONSENT_SKIP_OPTION
--      Snicks) + a consent_given flag (for REVIEW_CONSENT_SAFETY Snicks).
-- SQLite cannot ALTER a CHECK constraint in place, so both tables are
-- recreated (standard SQLite 12-step pattern) preserving all data.
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ---------- 1. snicks ----------
CREATE TABLE snicks_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id TEXT REFERENCES snick_categories(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('DAILY','WEEKLY','MONTHLY','SPECIAL','MYSTERY','CHALLENGE')),
  difficulty TEXT NOT NULL DEFAULT 'EASY' CHECK (difficulty IN ('EASY','MEDIUM','HARD')),
  xp_reward INTEGER NOT NULL DEFAULT 50,
  communication_percentage INTEGER NOT NULL DEFAULT 0,
  emotional_connection_percentage INTEGER NOT NULL DEFAULT 0,
  efforts_percentage INTEGER NOT NULL DEFAULT 0,
  trust_percentage INTEGER NOT NULL DEFAULT 0,
  verification_type TEXT NOT NULL DEFAULT 'SELF_CONFIRMATION' CHECK (verification_type IN ('SELF_CONFIRMATION','PARTNER_CONFIRMATION','MUTUAL_COMPLETION','OPTIONAL_NON_SENSITIVE_EVIDENCE')),
  verification_method TEXT,                  -- raw human-readable label from source data, e.g. "Simultaneous answer reveal"
  verification_level TEXT DEFAULT 'LOW' CHECK (verification_level IN ('LOW','MEDIUM')),
  safety_status TEXT DEFAULT 'OK' CHECK (safety_status IN ('OK','REVIEW_CONSENT_SAFETY','CONSENT_SKIP_OPTION')),
  privacy_rule TEXT,                         -- shown verbatim in detail modal / consent sheet
  duration_minutes INTEGER NOT NULL DEFAULT 10,
  long_distance_supported INTEGER NOT NULL DEFAULT 1 CHECK (long_distance_supported IN (0,1)),
  location_requirement TEXT,
  sequence_index INTEGER NOT NULL DEFAULT 0,
  map_label TEXT NOT NULL DEFAULT 'Day 1',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO snicks_new (
  id, title, description, category_id, frequency, difficulty, xp_reward,
  communication_percentage, emotional_connection_percentage, efforts_percentage, trust_percentage,
  verification_type, duration_minutes, long_distance_supported, location_requirement,
  sequence_index, map_label, active, created_at, updated_at
)
SELECT
  id, title, description, category_id, frequency, difficulty, xp_reward,
  communication_percentage, emotional_connection_percentage, efforts_percentage, trust_percentage,
  verification_type, duration_minutes, long_distance_supported, location_requirement,
  sequence_index, map_label, active, created_at, updated_at
FROM snicks;

DROP TABLE snicks;
ALTER TABLE snicks_new RENAME TO snicks;

CREATE INDEX idx_snicks_frequency ON snicks(frequency, sequence_index);
CREATE INDEX idx_snicks_active ON snicks(active);

-- ---------- 2. snick_completions ----------
CREATE TABLE snick_completions_new (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  snick_id TEXT NOT NULL REFERENCES snicks(id),
  started_by_user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED','DISPUTED','SKIPPED')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  verified_at TEXT,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  consent_given INTEGER NOT NULL DEFAULT 0 CHECK (consent_given IN (0,1))
);

INSERT INTO snick_completions_new (
  id, couple_id, snick_id, started_by_user_id, status, started_at, completed_at, verified_at, xp_awarded, note
)
SELECT
  id, couple_id, snick_id, started_by_user_id, status, started_at, completed_at, verified_at, xp_awarded, note
FROM snick_completions;

DROP TABLE snick_completions;
ALTER TABLE snick_completions_new RENAME TO snick_completions;

CREATE INDEX idx_completions_couple ON snick_completions(couple_id);
CREATE INDEX idx_completions_snick ON snick_completions(snick_id);
CREATE UNIQUE INDEX idx_completions_couple_snick_active ON snick_completions(couple_id, snick_id, status) WHERE status IN ('PENDING','APPROVED');

PRAGMA foreign_keys = ON;
