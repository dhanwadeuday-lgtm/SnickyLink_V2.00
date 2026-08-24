-- ============================================================
-- SNICKYLINK — Initial Schema (Cloudflare D1 / SQLite)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- APP CONFIG (admin-configurable tuning values) ----------
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- USERS ----------
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_seed TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  theme_pref TEXT NOT NULL DEFAULT 'system' CHECK (theme_pref IN ('light','dark','system')),
  email_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted','banned')),
  public_key_jwk TEXT, -- E2EE ECDH public key (JWK JSON), uploaded by client
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE user_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web','ios','android')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_user_devices_user ON user_devices(user_id);

CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_info TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token_hash);

-- ---------- COUPLES ----------
CREATE TABLE couples (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL DEFAULT 'We''re better together',
  avatar_seed TEXT NOT NULL,
  city TEXT,
  country TEXT,
  xp_total INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_count INTEGER NOT NULL DEFAULT 0,
  streak_last_date TEXT,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  league_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disbanded')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_couples_xp ON couples(xp_total DESC);
CREATE INDEX idx_couples_city ON couples(city);
CREATE INDEX idx_couples_country ON couples(country);

CREATE TABLE couple_members (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_couple_members_couple ON couple_members(couple_id);

CREATE TABLE couple_invites (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  accepted_by TEXT REFERENCES users(id),
  accepted_at TEXT
);
CREATE INDEX idx_invites_code ON couple_invites(code);

-- ---------- FOUR PILLARS ----------
CREATE TABLE couple_pillar_stats (
  couple_id TEXT PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  communication_xp INTEGER NOT NULL DEFAULT 0,
  emotional_xp INTEGER NOT NULL DEFAULT 0,
  efforts_xp INTEGER NOT NULL DEFAULT 0,
  trust_xp INTEGER NOT NULL DEFAULT 0,
  communication_level INTEGER NOT NULL DEFAULT 1,
  emotional_level INTEGER NOT NULL DEFAULT 1,
  efforts_level INTEGER NOT NULL DEFAULT 1,
  trust_level INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- XP ledger — single source of truth for all XP awards (couple totals derived/validated from this)
CREATE TABLE couple_xp_events (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('snick_completion','achievement','bonus','streak')),
  source_id TEXT,
  amount INTEGER NOT NULL,
  communication_amount INTEGER NOT NULL DEFAULT 0,
  emotional_amount INTEGER NOT NULL DEFAULT 0,
  efforts_amount INTEGER NOT NULL DEFAULT 0,
  trust_amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_xp_events_couple ON couple_xp_events(couple_id, created_at);

-- ---------- SNICKS ----------
CREATE TABLE snick_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color_key TEXT NOT NULL DEFAULT 'daily'
);

CREATE TABLE snicks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id TEXT REFERENCES snick_categories(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('DAILY','WEEKLY','MONTHLY','SPECIAL','MYSTERY')),
  difficulty TEXT NOT NULL DEFAULT 'EASY' CHECK (difficulty IN ('EASY','MEDIUM','HARD')),
  xp_reward INTEGER NOT NULL DEFAULT 50,
  communication_percentage INTEGER NOT NULL DEFAULT 0,
  emotional_connection_percentage INTEGER NOT NULL DEFAULT 0,
  efforts_percentage INTEGER NOT NULL DEFAULT 0,
  trust_percentage INTEGER NOT NULL DEFAULT 0,
  verification_type TEXT NOT NULL DEFAULT 'SELF_CONFIRMATION' CHECK (verification_type IN ('SELF_CONFIRMATION','PARTNER_CONFIRMATION','MUTUAL_COMPLETION','OPTIONAL_NON_SENSITIVE_EVIDENCE')),
  duration_minutes INTEGER NOT NULL DEFAULT 10,
  long_distance_supported INTEGER NOT NULL DEFAULT 1 CHECK (long_distance_supported IN (0,1)),
  location_requirement TEXT,
  sequence_index INTEGER NOT NULL DEFAULT 0,
  map_label TEXT NOT NULL DEFAULT 'Day 1',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_snicks_frequency ON snicks(frequency, sequence_index);
CREATE INDEX idx_snicks_active ON snicks(active);

CREATE TABLE snick_completions (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  snick_id TEXT NOT NULL REFERENCES snicks(id),
  started_by_user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED','DISPUTED')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  verified_at TEXT,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
CREATE INDEX idx_completions_couple ON snick_completions(couple_id);
CREATE INDEX idx_completions_snick ON snick_completions(snick_id);
CREATE UNIQUE INDEX idx_completions_couple_snick_active ON snick_completions(couple_id, snick_id, status) WHERE status IN ('PENDING','APPROVED');

CREATE TABLE snick_verifications (
  id TEXT PRIMARY KEY,
  completion_id TEXT NOT NULL REFERENCES snick_completions(id) ON DELETE CASCADE,
  verifying_user_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_verifications_completion ON snick_verifications(completion_id);

-- ---------- STREAKS (log for retention analytics) ----------
CREATE TABLE couple_streak_log (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  streak_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_streak_log_unique ON couple_streak_log(couple_id, streak_date);

-- ---------- CHAT (E2EE) ----------
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'My Person',
  type TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (type IN ('PRIVATE')),
  disappearing_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_conversations_couple ON conversations(couple_id);

CREATE TABLE conversation_members (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_conv_members_unique ON conversation_members(conversation_id, user_id);

-- Server NEVER sees plaintext: ciphertext + iv only. Encrypted client-side via ECDH+AES-GCM.
CREATE TABLE encrypted_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  ciphertext TEXT NOT NULL,      -- base64 AES-GCM ciphertext
  iv TEXT NOT NULL,              -- base64 nonce
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','attachment_ref')),
  attachment_key TEXT,           -- R2 object key when message_type = attachment_ref (encrypted client-side too)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT,
  read_at TEXT,
  expires_at TEXT                -- disappearing messages
);
CREATE INDEX idx_messages_conversation ON encrypted_messages(conversation_id, created_at);

-- ---------- ACHIEVEMENTS / LEAGUES / REWARDS ----------
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_key TEXT NOT NULL DEFAULT 'star',
  xp_bonus INTEGER NOT NULL DEFAULT 0,
  criteria_type TEXT NOT NULL CHECK (criteria_type IN ('SNICKS_COMPLETED','STREAK_DAYS','XP_TOTAL','PILLAR_LEVEL')),
  criteria_value INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE couple_achievements (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_couple_achievements_unique ON couple_achievements(couple_id, achievement_id);

CREATE TABLE leagues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  min_xp INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  icon_key TEXT NOT NULL DEFAULT 'gem'
);

CREATE TABLE rewards (
  id TEXT PRIMARY KEY,
  league_id TEXT REFERENCES leagues(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_key TEXT NOT NULL DEFAULT 'gift',
  unlock_xp INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

-- ---------- COMMUNITY ----------
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','removed','flagged')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_posts_status ON posts(status, created_at DESC);
CREATE INDEX idx_posts_likes ON posts(like_count DESC);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_post ON comments(post_id, created_at);

CREATE TABLE likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_likes_unique ON likes(post_id, user_id);

CREATE TABLE saved_posts (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_saved_unique ON saved_posts(post_id, user_id);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','user')),
  target_id TEXT NOT NULL,
  reporter_user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','actioned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES users(id)
);
CREATE INDEX idx_reports_status ON reports(status);

CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_blocks_unique ON blocks(blocker_user_id, blocked_user_id);

-- ---------- NOTIFICATIONS ----------
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('NEW_SNICK','PARTNER_COMPLETED_SNICK','PARTNER_CONFIRMATION_NEEDED','STREAK_WARNING','ACHIEVEMENT_UNLOCKED','LEVEL_UP','LEADERBOARD_CHANGE','COUPLE_INVITE','REWARD_UNLOCKED')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_json TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_snick INTEGER NOT NULL DEFAULT 1,
  partner_completed INTEGER NOT NULL DEFAULT 1,
  streak_warning INTEGER NOT NULL DEFAULT 1,
  achievement_unlocked INTEGER NOT NULL DEFAULT 1,
  level_up INTEGER NOT NULL DEFAULT 1,
  leaderboard_change INTEGER NOT NULL DEFAULT 1,
  couple_invite INTEGER NOT NULL DEFAULT 1,
  reward_unlocked INTEGER NOT NULL DEFAULT 1
);

-- ---------- ADMIN / ANALYTICS ----------
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_logs_admin ON audit_logs(admin_user_id, created_at DESC);

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL, -- e.g. snick_viewed, snick_started, snick_completed, dau_ping
  user_id TEXT REFERENCES users(id),
  couple_id TEXT REFERENCES couples(id),
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_analytics_type_date ON analytics_events(event_type, created_at);
CREATE INDEX idx_analytics_user_date ON analytics_events(user_id, created_at);
