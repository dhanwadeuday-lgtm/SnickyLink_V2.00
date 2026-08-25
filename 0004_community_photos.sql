-- Add photo support to community posts
ALTER TABLE posts ADD COLUMN image_key TEXT;
ALTER TABLE posts ADD COLUMN image_width INTEGER;
ALTER TABLE posts ADD COLUMN image_height INTEGER;
