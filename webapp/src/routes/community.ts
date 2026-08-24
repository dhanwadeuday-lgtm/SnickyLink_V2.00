import { Hono } from 'hono'
import { newId } from '../lib/crypto'
import type { AppEnv } from '../lib/types'
import { requireAuth, requireCouple } from '../middleware/auth'

const community = new Hono<AppEnv>()

// Images are stored as BLOBs directly in D1 (see post_media table) rather
// than R2 — this avoids requiring R2 to be enabled (which needs a payment
// method on file) on the deploying Cloudflare account. D1's free tier
// (5GB storage) comfortably covers a couples-app's photo volume, especially
// since the client compresses/resizes images before upload.
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024 // 1.5MB (post client-side compression)
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function imageUrl(imageKey: string | null | undefined) {
  return imageKey ? `/api/v1/community/media/${imageKey}` : null
}

// ---------- LIST POSTS (feed) ----------
community.get('/posts', requireAuth, async (c) => {
  const user = c.get('user')
  const sort = c.req.query('sort') === 'recent' ? 'recent' : 'popular'
  const orderBy = sort === 'popular' ? 'p.like_count DESC, p.created_at DESC' : 'p.created_at DESC'

  const posts = await c.env.DB
    .prepare(
      `SELECT p.*, co.nickname as couple_nickname, co.avatar_seed as couple_avatar_seed
       FROM posts p JOIN couples co ON co.id = p.couple_id
       WHERE p.status = 'published' ORDER BY ${orderBy} LIMIT 50`
    )
    .all<any>()

  const likedRows = await c.env.DB.prepare('SELECT post_id FROM likes WHERE user_id = ?').bind(user.id).all<any>()
  const likedSet = new Set((likedRows.results ?? []).map((r: any) => r.post_id))

  return c.json({
    posts: (posts.results ?? []).map((p: any) => ({
      id: p.id,
      content: p.content,
      imageUrl: imageUrl(p.image_key),
      imageWidth: p.image_width ?? null,
      imageHeight: p.image_height ?? null,
      likeCount: p.like_count,
      commentCount: p.comment_count,
      createdAt: p.created_at,
      isMine: p.couple_id === user.coupleId,
      likedByMe: likedSet.has(p.id),
      author: { coupleNickname: p.couple_nickname, avatarSeed: p.couple_avatar_seed },
    })),
  })
})

// ---------- UPLOAD IMAGE (for a post) ----------
// Client POSTs the raw (already-compressed) image bytes with a proper
// Content-Type header. Stored as a BLOB row in D1. Returns { imageKey }
// which is then passed to POST /posts as `imageKey`.
community.post('/media', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const contentType = c.req.header('Content-Type') || ''
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return c.json({ error: 'ValidationError', message: 'Unsupported image type. Use JPEG, PNG, WEBP or GIF.' }, 422)
  }
  const buf = await c.req.arrayBuffer()
  if (buf.byteLength === 0) return c.json({ error: 'ValidationError', message: 'Empty file' }, 422)
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    return c.json({ error: 'ValidationError', message: 'Image must be under 1.5MB after compression' }, 422)
  }
  const mediaId = newId('img')
  await c.env.DB
    .prepare('INSERT INTO post_media (id, couple_id, content_type, data, byte_size) VALUES (?, ?, ?, ?, ?)')
    .bind(mediaId, user.coupleId, contentType, buf, buf.byteLength)
    .run()
  return c.json({ imageKey: mediaId, url: imageUrl(mediaId) }, 201)
})

// ---------- SERVE IMAGE ----------
community.get('/media/:id', requireAuth, async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT content_type, data FROM post_media WHERE id = ?').bind(id).first<any>()
  if (!row) return c.json({ error: 'NotFound' }, 404)
  // D1 can return BLOB columns as a plain number[] (not ArrayBuffer/Uint8Array)
  // depending on runtime — normalize to Uint8Array, a valid Response BodyInit.
  const bytes = new Uint8Array(row.data)
  return new Response(bytes, {
    headers: {
      'Content-Type': row.content_type || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

// ---------- CREATE POST ----------
community.post('/posts', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const content = String(body.content ?? '').trim()
  const imageKey = body.imageKey ? String(body.imageKey) : null
  const imageWidth = Number.isFinite(body.imageWidth) ? Math.round(body.imageWidth) : null
  const imageHeight = Number.isFinite(body.imageHeight) ? Math.round(body.imageHeight) : null

  // A post needs either text (>=3 chars) or a photo attached.
  if (!imageKey && (content.length < 3 || content.length > 1000)) {
    return c.json({ error: 'ValidationError', message: 'Post must be between 3 and 1000 characters, or include a photo' }, 422)
  }
  if (imageKey && content.length > 1000) {
    return c.json({ error: 'ValidationError', message: 'Caption is too long' }, 422)
  }
  // Ownership check: the uploaded media row must belong to this couple.
  if (imageKey) {
    const media = await c.env.DB.prepare('SELECT couple_id FROM post_media WHERE id = ?').bind(imageKey).first<any>()
    if (!media || media.couple_id !== user.coupleId) {
      return c.json({ error: 'Forbidden', message: 'Invalid image reference' }, 403)
    }
  }

  const postId = newId('post')
  await c.env.DB
    .prepare('INSERT INTO posts (id, couple_id, user_id, content, image_key, image_width, image_height) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(postId, user.coupleId, user.id, content, imageKey, imageWidth, imageHeight)
    .run()
  return c.json({ id: postId }, 201)
})

// ---------- EDIT POST ----------
community.patch('/posts/:id', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>()
  if (!post) return c.json({ error: 'NotFound' }, 404)
  if (post.couple_id !== user.coupleId) return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const content = String(body.content ?? '').trim()
  if (content.length < 3 || content.length > 1000) return c.json({ error: 'ValidationError' }, 422)
  await c.env.DB.prepare("UPDATE posts SET content = ?, updated_at = datetime('now') WHERE id = ?").bind(content, id).run()
  return c.json({ success: true })
})

// ---------- DELETE POST ----------
community.delete('/posts/:id', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>()
  if (!post) return c.json({ error: 'NotFound' }, 404)
  if (post.couple_id !== user.coupleId) return c.json({ error: 'Forbidden' }, 403)
  await c.env.DB.prepare("UPDATE posts SET status = 'removed' WHERE id = ?").bind(id).run()
  return c.json({ success: true })
})

// ---------- LIKE / UNLIKE ----------
community.post('/posts/:id/like', requireAuth, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM likes WHERE post_id = ? AND user_id = ?').bind(id, user.id).first<any>()
  if (existing) {
    await c.env.DB.prepare('DELETE FROM likes WHERE id = ?').bind(existing.id).run()
    await c.env.DB.prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(id).run()
    return c.json({ liked: false })
  }
  await c.env.DB.prepare('INSERT INTO likes (id, post_id, user_id) VALUES (?, ?, ?)').bind(newId('like'), id, user.id).run()
  await c.env.DB.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').bind(id).run()
  return c.json({ liked: true })
})

// ---------- SAVE / UNSAVE ----------
community.post('/posts/:id/save', requireAuth, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM saved_posts WHERE post_id = ? AND user_id = ?').bind(id, user.id).first<any>()
  if (existing) {
    await c.env.DB.prepare('DELETE FROM saved_posts WHERE id = ?').bind(existing.id).run()
    return c.json({ saved: false })
  }
  await c.env.DB.prepare('INSERT INTO saved_posts (id, post_id, user_id) VALUES (?, ?, ?)').bind(newId('sp'), id, user.id).run()
  return c.json({ saved: true })
})

// ---------- COMMENTS ----------
community.get('/posts/:id/comments', requireAuth, async (c) => {
  const id = c.req.param('id')
  const comments = await c.env.DB
    .prepare(
      `SELECT cm.*, co.nickname as couple_nickname FROM comments cm
       JOIN users u ON u.id = cm.user_id JOIN couple_members mem ON mem.user_id = u.id JOIN couples co ON co.id = mem.couple_id
       WHERE cm.post_id = ? ORDER BY cm.created_at ASC`
    )
    .bind(id)
    .all<any>()
  return c.json({
    comments: (comments.results ?? []).map((cm: any) => ({ id: cm.id, content: cm.content, createdAt: cm.created_at, author: cm.couple_nickname })),
  })
})

community.post('/posts/:id/comments', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const content = String(body.content ?? '').trim()
  if (content.length < 1 || content.length > 500) return c.json({ error: 'ValidationError' }, 422)
  const post = await c.env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(id).first()
  if (!post) return c.json({ error: 'NotFound' }, 404)
  const commentId = newId('cmt')
  await c.env.DB.prepare('INSERT INTO comments (id, post_id, user_id, content) VALUES (?, ?, ?, ?)').bind(commentId, id, user.id, content).run()
  await c.env.DB.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').bind(id).run()
  return c.json({ id: commentId }, 201)
})

// ---------- REPORT ----------
community.post('/reports', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const targetType = body.targetType
  const targetId = body.targetId
  const reason = String(body.reason ?? '').trim()
  if (!['post', 'comment', 'user'].includes(targetType) || !targetId || reason.length < 3) {
    return c.json({ error: 'ValidationError' }, 422)
  }
  await c.env.DB
    .prepare('INSERT INTO reports (id, target_type, target_id, reporter_user_id, reason) VALUES (?, ?, ?, ?, ?)')
    .bind(newId('rep'), targetType, targetId, user.id, reason.slice(0, 500))
    .run()
  return c.json({ success: true }, 201)
})

// ---------- BLOCK ----------
community.post('/blocks', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const blockedUserId = body.userId
  if (!blockedUserId || blockedUserId === user.id) return c.json({ error: 'ValidationError' }, 422)
  await c.env.DB
    .prepare('INSERT OR IGNORE INTO blocks (id, blocker_user_id, blocked_user_id) VALUES (?, ?, ?)')
    .bind(newId('blk'), user.id, blockedUserId)
    .run()
  return c.json({ success: true }, 201)
})

export default community
