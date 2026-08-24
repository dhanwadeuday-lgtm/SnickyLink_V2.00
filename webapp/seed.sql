-- ============================================================
-- SNICKYLINK — Development Seed Data
-- Populates a realistic demo dataset so the dev build looks
-- populated immediately: users, a demo couple with existing
-- XP/level/streak, a full Daily/Weekly/Monthly Snicks journey,
-- pre-approved completions, achievements, leagues, rewards,
-- rival couples for the leaderboard, and community posts.
--
-- Demo login credentials (password hashes match src/lib/crypto.ts
-- PBKDF2-HMAC-SHA256, 100,000 iterations, 32-byte output):
--   demo1@snickylink.app / Demo1234!   (couple creator "Ari")
--   demo2@snickylink.app / Demo1234!   (couple partner "Sam")
--   admin@snickylink.app / Admin1234!  (role = admin)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- APP CONFIG ----------
INSERT INTO app_config (key, value) VALUES
  ('xp_level_base', '500'),
  ('xp_pillar_level_base', '150'),
  ('streak_grace_hours', '6');

-- ---------- USERS ----------
INSERT INTO users (id, email, password_hash, password_salt, display_name, avatar_seed, role, theme_pref, email_verified_at, status, created_at, last_active_at) VALUES
  ('usr_demo1', 'demo1@snickylink.app', 'WRmrNRKNWuDyx82a3uWyUqfayBOoHFGz1f+wCF3FiGI=', 'WF1LCdzV7Sf5CT037EBWrA==', 'Ari', 'avatar_ari', 'user', 'system', datetime('now', '-40 day'), 'active', datetime('now', '-40 day'), datetime('now', '-1 hour')),
  ('usr_demo2', 'demo2@snickylink.app', 'sXM7INNLsx2CF11tPo4sC92HSWb1543KwiI8B+osSgs=', 'ukcbiK2An6Ovwkt6d3cmuA==', 'Sam', 'avatar_sam', 'user', 'system', datetime('now', '-40 day'), 'active', datetime('now', '-40 day'), datetime('now', '-2 hour')),
  ('usr_admin', 'admin@snickylink.app', 'Vpd3Beux/WoCfPxONTvtghOYsk6hCCZGfqzO+0xP83g=', '5ZKTlsSXPWJYiDAhhc+vSA==', 'SnickyLink Admin', 'avatar_admin', 'admin', 'dark', datetime('now', '-60 day'), 'active', datetime('now', '-60 day'), datetime('now', '-1 day')),
  -- rival couple users (no login needed for demo, but valid rows for FK integrity)
  ('usr_riv1a', 'riv1a@snickylink.app', 'WRmrNRKNWuDyx82a3uWyUqfayBOoHFGz1f+wCF3FiGI=', 'WF1LCdzV7Sf5CT037EBWrA==', 'Priya', 'avatar_priya', 'user', 'system', datetime('now', '-90 day'), 'active', datetime('now', '-90 day'), datetime('now', '-3 hour')),
  ('usr_riv1b', 'riv1b@snickylink.app', 'WRmrNRKNWuDyx82a3uWyUqfayBOoHFGz1f+wCF3FiGI=', 'WF1LCdzV7Sf5CT037EBWrA==', 'Rohan', 'avatar_rohan', 'user', 'system', datetime('now', '-90 day'), 'active', datetime('now', '-90 day'), datetime('now', '-5 hour')),
  ('usr_riv2a', 'riv2a@snickylink.app', 'WRmrNRKNWuDyx82a3uWyUqfayBOoHFGz1f+wCF3FiGI=', 'WF1LCdzV7Sf5CT037EBWrA==', 'Maya', 'avatar_maya', 'user', 'system', datetime('now', '-70 day'), 'active', datetime('now', '-70 day'), datetime('now', '-6 hour')),
  ('usr_riv2b', 'riv2b@snickylink.app', 'WRmrNRKNWuDyx82a3uWyUqfayBOoHFGz1f+wCF3FiGI=', 'WF1LCdzV7Sf5CT037EBWrA==', 'Dev', 'avatar_dev', 'user', 'system', datetime('now', '-70 day'), 'active', datetime('now', '-70 day'), datetime('now', '-7 hour')),
  ('usr_riv3a', 'riv3a@snickylink.app', 'WRmrNRKNWuDyx82a3uWyUqfayBOoHFGz1f+wCF3FiGI=', 'WF1LCdzV7Sf5CT037EBWrA==', 'Noah', 'avatar_noah', 'user', 'system', datetime('now', '-50 day'), 'active', datetime('now', '-50 day'), datetime('now', '-8 hour')),
  ('usr_riv3b', 'riv3b@snickylink.app', 'WRmrNRKNWuDyx82a3uWyUqfayBOoHFGz1f+wCF3FiGI=', 'WF1LCdzV7Sf5CT037EBWrA==', 'Zara', 'avatar_zara', 'user', 'system', datetime('now', '-50 day'), 'active', datetime('now', '-50 day'), datetime('now', '-9 hour')),
  ('usr_riv4a', 'riv4a@snickylink.app', 'WRmrNRKNWuDyx82a3uWyUqfayBOoHFGz1f+wCF3FiGI=', 'WF1LCdzV7Sf5CT037EBWrA==', 'Leo', 'avatar_leo', 'user', 'system', datetime('now', '-30 day'), 'active', datetime('now', '-30 day'), datetime('now', '-10 hour')),
  ('usr_riv4b', 'riv4b@snickylink.app', 'WRmrNRKNWuDyx82a3uWyUqfayBOoHFGz1f+wCF3FiGI=', 'WF1LCdzV7Sf5CT037EBWrA==', 'Ivy', 'avatar_ivy', 'user', 'system', datetime('now', '-30 day'), 'active', datetime('now', '-30 day'), datetime('now', '-11 hour'));

INSERT INTO notification_preferences (user_id) VALUES
  ('usr_demo1'), ('usr_demo2'), ('usr_admin'),
  ('usr_riv1a'), ('usr_riv1b'), ('usr_riv2a'), ('usr_riv2b'),
  ('usr_riv3a'), ('usr_riv3b'), ('usr_riv4a'), ('usr_riv4b');

-- ---------- LEAGUES (Bronze -> Diamond) ----------
INSERT INTO leagues (id, name, min_xp, order_index, icon_key) VALUES
  ('lg_bronze', 'Bronze League', 0, 1, 'medal'),
  ('lg_silver', 'Silver League', 2000, 2, 'medal'),
  ('lg_gold', 'Gold League', 6000, 3, 'trophy'),
  ('lg_platinum', 'Platinum League', 9000, 4, 'crown'),
  ('lg_diamond', 'Diamond League', 12000, 5, 'gem');

-- ---------- REWARDS ----------
INSERT INTO rewards (id, league_id, title, description, icon_key, unlock_xp, active) VALUES
  ('rwd_frame_bronze', 'lg_bronze', 'Bronze Couple Frame', 'A warm bronze border for your couple avatar.', 'image', 0, 1),
  ('rwd_theme_pack1', 'lg_silver', 'Sunset Doodle Pack', 'Unlock exclusive sunset-themed Snick map doodles.', 'palette', 2000, 1),
  ('rwd_badge_gold', 'lg_gold', 'Golden Hearts Badge', 'Show off a golden hearts badge on your profile.', 'award', 6000, 1),
  ('rwd_frame_platinum', 'lg_platinum', 'Platinum Couple Frame', 'A shimmering platinum border for your couple avatar.', 'image', 9000, 1),
  ('rwd_mystery_diamond', 'lg_diamond', 'Diamond Mystery Snick Pack', 'Unlocks a rotating set of rare Mystery Snicks.', 'gift', 12000, 1),
  ('rwd_streak_charm', NULL, 'Streak Flame Charm', 'A special profile charm for keeping a 7-day streak.', 'fire', 500, 1);

-- ---------- ACHIEVEMENTS ----------
INSERT INTO achievements (id, code, title, description, icon_key, xp_bonus, criteria_type, criteria_value, active) VALUES
  ('ach_first_snick', 'FIRST_SNICK', 'First Steps Together', 'Complete your very first Snick as a couple.', 'shoe-prints', 20, 'SNICKS_COMPLETED', 1, 1),
  ('ach_five_snicks', 'FIVE_SNICKS', 'Getting Into Rhythm', 'Complete 5 Snicks together.', 'star', 50, 'SNICKS_COMPLETED', 5, 1),
  ('ach_ten_snicks', 'TEN_SNICKS', 'Snick Streakers', 'Complete 10 Snicks together.', 'star', 75, 'SNICKS_COMPLETED', 10, 1),
  ('ach_streak_3', 'STREAK_3', 'Warming Up', 'Reach a 3-day streak.', 'fire', 30, 'STREAK_DAYS', 3, 1),
  ('ach_streak_7', 'STREAK_7', 'One Week Strong', 'Reach a 7-day streak.', 'fire', 75, 'STREAK_DAYS', 7, 1),
  ('ach_streak_30', 'STREAK_30', 'Unbreakable Bond', 'Reach a 30-day streak.', 'fire', 300, 'STREAK_DAYS', 30, 1),
  ('ach_xp_1000', 'XP_1000', 'Rising Couple', 'Earn 1,000 total XP.', 'bolt', 0, 'XP_TOTAL', 1000, 1),
  ('ach_xp_5000', 'XP_5000', 'Power Couple', 'Earn 5,000 total XP.', 'bolt', 0, 'XP_TOTAL', 5000, 1),
  ('ach_xp_10000', 'XP_10000', 'Legendary Duo', 'Earn 10,000 total XP.', 'bolt', 0, 'XP_TOTAL', 10000, 1),
  ('ach_pillar_5', 'PILLAR_LEVEL_5', 'Pillar Builder', 'Reach level 5 in any pillar.', 'chart-line', 40, 'PILLAR_LEVEL', 5, 1),
  ('ach_pillar_10', 'PILLAR_LEVEL_10', 'Pillar Master', 'Reach level 10 in any pillar.', 'chart-line', 80, 'PILLAR_LEVEL', 10, 1);

-- ---------- SNICK CATEGORIES ----------
-- (already inserted by migrations/0003_snicks_data.sql; OR IGNORE keeps this file
-- runnable standalone too, e.g. against a freshly-migrated-but-not-yet-seeded DB)
INSERT OR IGNORE INTO snick_categories (id, name, description, color_key) VALUES
  ('cat_communication', 'Communication', 'Snicks focused on talking, listening & expressing.', 'daily'),
  ('cat_emotional', 'Emotional Connection', 'Snicks focused on empathy, vulnerability & closeness.', 'weekly'),
  ('cat_efforts', 'Efforts', 'Snicks focused on thoughtful gestures & acts of care.', 'monthly'),
  ('cat_trust', 'Trust', 'Snicks focused on honesty, reliability & security.', 'daily');

-- ============================================================
-- SNICKS — the real 365-mission dataset is loaded separately by
-- migrations/0003_snicks_data.sql (Excel import — see docs/habit-algorithm.md).
-- This seed file only inserts demo completions that REFERENCE those real
-- Snick IDs (snk_d001..snk_d163, snk_w001..snk_w046, snk_m001..snk_m030,
-- snk_c001..snk_c126) so migration 0003 MUST run before this seed file.
-- ============================================================

-- ============================================================
-- DEMO COUPLE: "UsForever" (Ari + Sam) — the logged-in demo couple
-- Pre-populated with real XP history so the app looks alive on first login.
-- ============================================================

INSERT INTO couples (id, nickname, tagline, avatar_seed, city, country, xp_total, level, streak_count, streak_last_date, longest_streak, league_id, status, created_at, updated_at) VALUES
('cpl_demo', 'UsForever', 'We''re better together', 'avatar_usforever', 'Pune', 'India', 12450, 4, 6, date('now'), 9, 'lg_diamond', 'active', datetime('now', '-38 day'), datetime('now'));

INSERT INTO couple_members (id, couple_id, user_id, role, joined_at) VALUES
('cm_demo1', 'cpl_demo', 'usr_demo1', 'creator', datetime('now', '-38 day')),
('cm_demo2', 'cpl_demo', 'usr_demo2', 'partner', datetime('now', '-38 day'));

INSERT INTO couple_pillar_stats (couple_id, communication_xp, emotional_xp, efforts_xp, trust_xp, communication_level, emotional_level, efforts_level, trust_level, updated_at) VALUES
('cpl_demo', 4200, 3900, 2650, 1700, 11, 10, 12, 9, datetime('now'));

INSERT INTO couple_invites (id, couple_id, code, created_by, status, created_at, expires_at, accepted_by, accepted_at) VALUES
('inv_demo_used', 'cpl_demo', 'ARISAM01', 'usr_demo1', 'accepted', datetime('now', '-38 day'), datetime('now', '-31 day'), 'usr_demo2', datetime('now', '-38 day')),
('inv_demo_active', 'cpl_demo', 'LOVE2026', 'usr_demo1', 'pending', datetime('now', '-1 day'), datetime('now', '+6 day'), NULL, NULL);

-- Chat conversation shell for the demo couple
INSERT INTO conversations (id, couple_id, title, type, disappearing_seconds, created_at) VALUES
('conv_demo', 'cpl_demo', 'My Person', 'PRIVATE', 0, datetime('now', '-38 day'));

INSERT INTO conversation_members (id, conversation_id, user_id, joined_at) VALUES
('cvm_demo1', 'conv_demo', 'usr_demo1', datetime('now', '-38 day')),
('cvm_demo2', 'conv_demo', 'usr_demo2', datetime('now', '-38 day'));

-- Note: NO seeded plaintext-derived messages are inserted here, since encrypted_messages
-- must ONLY ever contain genuine client-encrypted ciphertext+iv pairs produced by the
-- browser's own ECDH+AES-GCM keys. Seeding fake ciphertext would be undecryptable by the
-- demo account's real device keys and would misrepresent the E2EE guarantee. The chat list
-- will correctly show "No messages yet — say hi!" until Ari/Sam log in and chat for real.

-- ---------- Snick completions for the demo couple (builds up their XP/level/streak history) ----------
-- Daily: last 3 days completed & approved (feeds the 6-day streak that unlocks Weekly below)
INSERT INTO snick_completions (id, couple_id, snick_id, started_by_user_id, status, started_at, completed_at, verified_at, xp_awarded, note) VALUES
('cmpl_d1', 'cpl_demo', 'snk_d001', 'usr_demo1', 'APPROVED', datetime('now', '-6 day', '+8 hour'), datetime('now', '-6 day', '+8 hour', '+2 minute'), datetime('now', '-6 day', '+8 hour', '+2 minute'), 5, 'Told her about the new coffee place!'),
('cmpl_d2', 'cpl_demo', 'snk_d002', 'usr_demo2', 'APPROVED', datetime('now', '-5 day', '+9 hour'), datetime('now', '-5 day', '+9 hour', '+5 minute'), datetime('now', '-5 day', '+9 hour', '+5 minute'), 5, NULL),
('cmpl_d3', 'cpl_demo', 'snk_d003', 'usr_demo1', 'APPROVED', datetime('now', '-4 day', '+19 hour'), datetime('now', '-4 day', '+19 hour', '+3 minute'), datetime('now', '-3 day', '+8 hour'), 5, 'Sent a voice note about how proud I am of him.');

-- Weekly: Week 1 completed, Week 2 currently pending partner confirmation
INSERT INTO snick_completions (id, couple_id, snick_id, started_by_user_id, status, started_at, completed_at, verified_at, xp_awarded, note) VALUES
('cmpl_w1', 'cpl_demo', 'snk_w001', 'usr_demo2', 'APPROVED', datetime('now', '-10 day'), datetime('now', '-10 day', '+2 hour'), datetime('now', '-9 day'), 30, 'Watched the same movie over video call!'),
('cmpl_w2', 'cpl_demo', 'snk_w002', 'usr_demo1', 'PENDING', datetime('now', '-1 day'), datetime('now', '-1 day', '+25 minute'), NULL, 0, 'Had our Sunday deep talk about next year''s plans.');

-- Monthly: Month 1 completed
INSERT INTO snick_completions (id, couple_id, snick_id, started_by_user_id, status, started_at, completed_at, verified_at, xp_awarded, note) VALUES
('cmpl_m1', 'cpl_demo', 'snk_m001', 'usr_demo1', 'APPROVED', datetime('now', '-25 day'), datetime('now', '-25 day', '+40 minute'), datetime('now', '-24 day'), 100, 'Great retrospective, decided to travel more next month.');

INSERT INTO snick_verifications (id, completion_id, verifying_user_id, decision, note, created_at) VALUES
('ver_d3', 'cmpl_d3', 'usr_demo2', 'APPROVED', 'That was so sweet, love you!', datetime('now', '-3 day', '+8 hour')),
('ver_w1', 'cmpl_w1', 'usr_demo1', 'APPROVED', 'Best long distance date night yet!', datetime('now', '-9 day')),
('ver_m1', 'cmpl_m1', 'usr_demo2', 'APPROVED', 'So proud of how far we''ve come.', datetime('now', '-24 day'));

-- XP ledger events matching the approved completions above (for audit trail / analytics realism)
INSERT INTO couple_xp_events (id, couple_id, source, source_id, amount, communication_amount, emotional_amount, efforts_amount, trust_amount, created_at) VALUES
('xpevt_d1', 'cpl_demo', 'snick_completion', 'cmpl_d1', 5, 3, 0, 2, 0, datetime('now', '-6 day', '+8 hour', '+2 minute')),
('xpevt_d2', 'cpl_demo', 'snick_completion', 'cmpl_d2', 5, 3, 2, 0, 0, datetime('now', '-5 day', '+9 hour', '+5 minute')),
('xpevt_d3', 'cpl_demo', 'snick_completion', 'cmpl_d3', 5, 3, 2, 0, 0, datetime('now', '-3 day', '+8 hour')),
('xpevt_w1', 'cpl_demo', 'snick_completion', 'cmpl_w1', 30, 0, 0, 30, 0, datetime('now', '-9 day')),
('xpevt_m1', 'cpl_demo', 'snick_completion', 'cmpl_m1', 100, 0, 0, 100, 0, datetime('now', '-24 day'));

-- Streak log (6-day active streak leading up to today)
INSERT INTO couple_streak_log (id, couple_id, streak_date, created_at) VALUES
('sl_1', 'cpl_demo', date('now', '-5 day'), datetime('now', '-5 day')),
('sl_2', 'cpl_demo', date('now', '-4 day'), datetime('now', '-4 day')),
('sl_3', 'cpl_demo', date('now', '-3 day'), datetime('now', '-3 day')),
('sl_4', 'cpl_demo', date('now', '-2 day'), datetime('now', '-2 day')),
('sl_5', 'cpl_demo', date('now', '-1 day'), datetime('now', '-1 day')),
('sl_6', 'cpl_demo', date('now'), datetime('now'));

-- Achievements already unlocked by the demo couple
INSERT INTO couple_achievements (id, couple_id, achievement_id, unlocked_at) VALUES
('cach_1', 'cpl_demo', 'ach_first_snick', datetime('now', '-6 day')),
('cach_2', 'cpl_demo', 'ach_five_snicks', datetime('now', '-9 day')),
('cach_3', 'cpl_demo', 'ach_streak_3', datetime('now', '-3 day')),
('cach_4', 'cpl_demo', 'ach_xp_1000', datetime('now', '-24 day')),
('cach_5', 'cpl_demo', 'ach_xp_5000', datetime('now', '-24 day')),
('cach_6', 'cpl_demo', 'ach_xp_10000', datetime('now', '-2 day')),
('cach_7', 'cpl_demo', 'ach_pillar_5', datetime('now', '-9 day')),
('cach_8', 'cpl_demo', 'ach_pillar_10', datetime('now', '-2 day'));

-- ============================================================
-- RIVAL COUPLES — populate the leaderboard (same city Pune + others in India)
-- ============================================================

INSERT INTO couples (id, nickname, tagline, avatar_seed, city, country, xp_total, level, streak_count, streak_last_date, longest_streak, league_id, status, created_at, updated_at) VALUES
('cpl_riv1', 'SoulMates', 'Two hearts, one journey', 'avatar_soulmates', 'Pune', 'India', 10230, 3, 4, date('now'), 12, 'lg_diamond', 'active', datetime('now', '-90 day'), datetime('now')),
('cpl_riv2', 'Heartstrings', 'Tied together forever', 'avatar_heartstrings', 'Pune', 'India', 9450, 3, 2, date('now', '-1 day'), 15, 'lg_diamond', 'active', datetime('now', '-70 day'), datetime('now')),
('cpl_riv3', 'TogetherWeWin', 'Every day is a win with you', 'avatar_togetherwewin', 'Mumbai', 'India', 7530, 2, 5, date('now'), 8, 'lg_gold', 'active', datetime('now', '-50 day'), datetime('now')),
('cpl_riv4', 'EndlessUs', 'No distance too far', 'avatar_endlessus', 'Bengaluru', 'India', 6890, 2, 1, date('now', '-2 day'), 6, 'lg_gold', 'active', datetime('now', '-30 day'), datetime('now')),
('cpl_riv5', 'BondBeyond', 'Growing stronger every Snick', 'avatar_bondbeyond', 'Pune', 'India', 6120, 2, 3, date('now'), 10, 'lg_gold', 'active', datetime('now', '-45 day'), datetime('now'));

INSERT INTO couple_members (id, couple_id, user_id, role, joined_at) VALUES
('cm_riv1a', 'cpl_riv1', 'usr_riv1a', 'creator', datetime('now', '-90 day')),
('cm_riv1b', 'cpl_riv1', 'usr_riv1b', 'partner', datetime('now', '-90 day')),
('cm_riv2a', 'cpl_riv2', 'usr_riv2a', 'creator', datetime('now', '-70 day')),
('cm_riv2b', 'cpl_riv2', 'usr_riv2b', 'partner', datetime('now', '-70 day')),
('cm_riv3a', 'cpl_riv3', 'usr_riv3a', 'creator', datetime('now', '-50 day')),
('cm_riv3b', 'cpl_riv3', 'usr_riv3b', 'partner', datetime('now', '-50 day')),
('cm_riv4a', 'cpl_riv4', 'usr_riv4a', 'creator', datetime('now', '-30 day')),
('cm_riv4b', 'cpl_riv4', 'usr_riv4b', 'partner', datetime('now', '-30 day'));
-- cpl_riv5 (BondBeyond) intentionally has only the demo-adjacent placeholder members omitted (not required for leaderboard display)

INSERT INTO couple_pillar_stats (couple_id, communication_xp, emotional_xp, efforts_xp, trust_xp, communication_level, emotional_level, efforts_level, trust_level, updated_at) VALUES
('cpl_riv1', 3400, 3200, 2400, 1230, 10, 10, 11, 8, datetime('now')),
('cpl_riv2', 3000, 3100, 2100, 1250, 9, 9, 10, 8, datetime('now')),
('cpl_riv3', 2400, 2200, 1830, 1100, 8, 8, 9, 7, datetime('now')),
('cpl_riv4', 2200, 2000, 1690, 1000, 8, 7, 9, 6, datetime('now')),
('cpl_riv5', 2000, 1800, 1620, 700, 7, 7, 8, 6, datetime('now'));

-- ============================================================
-- COMMUNITY POSTS — matching the exact reference feed examples
-- ============================================================

INSERT INTO posts (id, couple_id, user_id, content, like_count, comment_count, status, created_at, updated_at) VALUES
('post_1', 'cpl_demo', 'usr_demo1', 'What''s one small thing your partner did that made your day better?', 128, 32, 'published', datetime('now', '-2 day'), datetime('now', '-2 day')),
('post_2', 'cpl_riv3', 'usr_riv3a', 'Long distance wins! What''s your favourite way to feel close when you''re far?', 96, 18, 'published', datetime('now', '-3 day'), datetime('now', '-3 day')),
('post_3', 'cpl_riv1', 'usr_riv1a', 'Trust is built in the little moments. Share yours.', 74, 21, 'published', datetime('now', '-4 day'), datetime('now', '-4 day')),
('post_4', 'cpl_riv2', 'usr_riv2b', 'Date ideas that don''t need money, just effort and creativity!', 113, 27, 'published', datetime('now', '-5 day'), datetime('now', '-5 day')),
('post_5', 'cpl_riv4', 'usr_riv4a', 'Just hit a 6-day streak on SnickyLink together 🔥 Small consistent effort really does add up.', 61, 9, 'published', datetime('now', '-1 day'), datetime('now', '-1 day')),
('post_6', 'cpl_riv4', 'usr_riv4b', 'Reminder: "I''m fine" is not always the full answer. Ask again, gently.', 85, 14, 'published', datetime('now', '-6 day'), datetime('now', '-6 day'));

INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES
('cmt_1', 'post_1', 'usr_demo2', 'He made me coffee exactly the way I like it without asking 🥹', datetime('now', '-2 day', '+1 hour')),
('cmt_2', 'post_1', 'usr_riv1a', 'Left a sticky note on my laptop before I woke up!', datetime('now', '-2 day', '+2 hour')),
('cmt_3', 'post_2', 'usr_riv2a', 'We do a synced Spotify playlist every night, sounds simple but it works!', datetime('now', '-3 day', '+3 hour')),
('cmt_4', 'post_4', 'usr_demo1', 'We did a "cook from the pantry" cooking challenge, so much fun!', datetime('now', '-5 day', '+2 hour'));

-- ---------- ANALYTICS SEED (so the admin dashboard isn't empty on first view) ----------
INSERT INTO analytics_events (id, event_type, user_id, couple_id, meta_json, created_at) VALUES
('ae_seed_1', 'dau_ping', 'usr_demo1', 'cpl_demo', NULL, datetime('now', '-1 day')),
('ae_seed_2', 'dau_ping', 'usr_demo2', 'cpl_demo', NULL, datetime('now')),
('ae_seed_3', 'snick_viewed', 'usr_demo1', 'cpl_demo', '{"snickId":"snk_d004"}', datetime('now', '-1 day')),
('ae_seed_4', 'snick_started', 'usr_demo1', 'cpl_demo', '{"snickId":"snk_d001"}', datetime('now', '-6 day')),
('ae_seed_5', 'snick_completed', 'usr_demo1', 'cpl_demo', '{"snickId":"snk_d001"}', datetime('now', '-6 day')),
('ae_seed_6', 'snick_started', 'usr_demo2', 'cpl_demo', '{"snickId":"snk_d002"}', datetime('now', '-5 day')),
('ae_seed_7', 'snick_completed', 'usr_demo2', 'cpl_demo', '{"snickId":"snk_d002"}', datetime('now', '-5 day')),
('ae_seed_8', 'leaderboard_viewed', 'usr_demo1', 'cpl_demo', NULL, datetime('now', '-1 day')),
('ae_seed_9', 'community_viewed', 'usr_demo2', 'cpl_demo', NULL, datetime('now'));

-- ---------- SAMPLE NOTIFICATIONS (so the bell icon shows real history on first login) ----------
INSERT INTO notifications (id, user_id, type, title, body, data_json, read_at, created_at) VALUES
('notif_seed_1', 'usr_demo1', 'PARTNER_CONFIRMATION_NEEDED', 'Confirmation needed 🙋', 'Your partner marked their Weekly Snick as done — confirm it to earn XP together!', '{"snickId":"snk_w002","completionId":"cmpl_w2"}', NULL, datetime('now', '-1 day', '+25 minute')),
('notif_seed_2', 'usr_demo2', 'ACHIEVEMENT_UNLOCKED', 'Achievement Unlocked: Pillar Master 🌟', 'Reach level 10 in any pillar.', NULL, datetime('now', '-1 day'), datetime('now', '-2 day')),
('notif_seed_3', 'usr_demo1', 'LEVEL_UP', 'Level Up! You''re now Level 5 🏆', 'Your couple journey keeps getting stronger.', NULL, datetime('now', '-3 day'), datetime('now', '-4 day')),
('notif_seed_4', 'usr_demo2', 'REWARD_UNLOCKED', 'Reward Unlocked: Diamond Mystery Snick Pack 🎁', 'Unlocks a rotating set of rare Mystery Snicks.', NULL, NULL, datetime('now', '-2 day'));

-- ============================================================
-- LEVEL CONSISTENCY FIX
-- The `level` / `*_level` columns are denormalized caches of what
-- levelFromXp()/pillarLevelFromXp() (src/lib/game.ts) would compute
-- from the seeded xp_total / pillar xp values. Recompute explicitly
-- here so the seeded rows exactly match the runtime formulas
-- (500*level*(level-1) for couple level, 150*level*(level-1) for pillar level).
-- ============================================================
UPDATE couples SET level = 5 WHERE id = 'cpl_demo';
UPDATE couples SET level = 5 WHERE id = 'cpl_riv1';
UPDATE couples SET level = 4 WHERE id = 'cpl_riv2';
UPDATE couples SET level = 4 WHERE id = 'cpl_riv3';
UPDATE couples SET level = 4 WHERE id = 'cpl_riv4';
UPDATE couples SET level = 4 WHERE id = 'cpl_riv5';

UPDATE couple_pillar_stats SET communication_level = 5, emotional_level = 5, efforts_level = 4, trust_level = 3 WHERE couple_id = 'cpl_demo';
UPDATE couple_pillar_stats SET communication_level = 5, emotional_level = 5, efforts_level = 4, trust_level = 3 WHERE couple_id = 'cpl_riv1';
UPDATE couple_pillar_stats SET communication_level = 5, emotional_level = 5, efforts_level = 4, trust_level = 3 WHERE couple_id = 'cpl_riv2';
UPDATE couple_pillar_stats SET communication_level = 4, emotional_level = 4, efforts_level = 4, trust_level = 3 WHERE couple_id = 'cpl_riv3';
UPDATE couple_pillar_stats SET communication_level = 4, emotional_level = 4, efforts_level = 3, trust_level = 3 WHERE couple_id = 'cpl_riv4';
UPDATE couple_pillar_stats SET communication_level = 4, emotional_level = 4, efforts_level = 3, trust_level = 2 WHERE couple_id = 'cpl_riv5';
