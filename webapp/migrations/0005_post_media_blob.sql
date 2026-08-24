-- Store Community post photos directly in D1 (BLOB) instead of R2 —
-- avoids requiring R2 to be enabled (which needs a payment method on file)
-- on the deploying Cloudflare account. D1's free tier (5GB storage) is
-- more than enough for a couples-app's photo volume.
CREATE TABLE post_media (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_post_media_couple ON post_media(couple_id);
