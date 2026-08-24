import { Hono } from 'hono'
import { newId } from '../lib/crypto'
import type { AppEnv } from '../lib/types'
import { requireAuth, requireCouple } from '../middleware/auth'

const chat = new Hono<AppEnv>()

// ---------- GET MY CONVERSATION (couples have exactly one private conversation) ----------
chat.get('/conversations', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const conv = await c.env.DB.prepare('SELECT * FROM conversations WHERE couple_id = ?').bind(user.coupleId).first<any>()
  if (!conv) return c.json({ conversations: [] })

  const lastMessage = await c.env.DB
    .prepare('SELECT * FROM encrypted_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(conv.id)
    .first<any>()

  const unreadCount = await c.env.DB
    .prepare('SELECT COUNT(*) as cnt FROM encrypted_messages WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL')
    .bind(conv.id, user.id)
    .first<any>()

  const partner = await c.env.DB
    .prepare(
      `SELECT u.id, u.display_name, u.avatar_seed, u.public_key_jwk FROM conversation_members cvm
       JOIN users u ON u.id = cvm.user_id WHERE cvm.conversation_id = ? AND cvm.user_id != ?`
    )
    .bind(conv.id, user.id)
    .first<any>()

  return c.json({
    conversations: [
      {
        id: conv.id,
        title: conv.title,
        disappearingSeconds: conv.disappearing_seconds,
        // NOTE: lastMessage content is ciphertext only — the server literally cannot show a plaintext preview.
        // The client decrypts locally and renders its own preview once messages sync.
        lastMessageAt: lastMessage?.created_at ?? null,
        lastMessageCiphertext: lastMessage?.ciphertext ?? null,
        lastMessageIv: lastMessage?.iv ?? null,
        lastMessageSenderId: lastMessage?.sender_id ?? null,
        unreadCount: unreadCount?.cnt ?? 0,
        partner: partner ? { id: partner.id, displayName: partner.display_name, avatarSeed: partner.avatar_seed, publicKeyJwk: partner.public_key_jwk ? JSON.parse(partner.public_key_jwk) : null } : null,
      },
    ],
  })
})

// ---------- LIST MESSAGES (ciphertext only) ----------
chat.get('/conversations/:id/messages', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const convId = c.req.param('id')
  const member = await c.env.DB
    .prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .bind(convId, user.id)
    .first()
  if (!member) return c.json({ error: 'Forbidden' }, 403)

  const before = c.req.query('before')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 100)

  let query = 'SELECT * FROM encrypted_messages WHERE conversation_id = ?'
  const params: any[] = [convId]
  if (before) {
    query += ' AND created_at < ?'
    params.push(before)
  }
  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  const messages = await c.env.DB.prepare(query).bind(...params).all<any>()

  // mark delivered for messages not sent by me
  await c.env.DB
    .prepare("UPDATE encrypted_messages SET delivered_at = datetime('now') WHERE conversation_id = ? AND sender_id != ? AND delivered_at IS NULL")
    .bind(convId, user.id)
    .run()

  return c.json({
    messages: (messages.results ?? [])
      .map((m: any) => ({
        id: m.id,
        senderId: m.sender_id,
        ciphertext: m.ciphertext,
        iv: m.iv,
        messageType: m.message_type,
        attachmentKey: m.attachment_key,
        createdAt: m.created_at,
        deliveredAt: m.delivered_at,
        readAt: m.read_at,
        expiresAt: m.expires_at,
      }))
      .reverse(),
  })
})

// ---------- SEND MESSAGE (server stores ciphertext + iv ONLY — never sees plaintext) ----------
chat.post('/conversations/:id/messages', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const convId = c.req.param('id')
  const member = await c.env.DB
    .prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .bind(convId, user.id)
    .first()
  if (!member) return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.json().catch(() => null)
  if (!body?.ciphertext || !body?.iv) {
    return c.json({ error: 'ValidationError', message: 'ciphertext and iv are required (client-side encrypted payload)' }, 422)
  }
  if (String(body.ciphertext).length > 20000) {
    return c.json({ error: 'PayloadTooLarge', message: 'Message ciphertext exceeds size limit' }, 413)
  }

  const conv = await c.env.DB.prepare('SELECT * FROM conversations WHERE id = ?').bind(convId).first<any>()
  const messageId = newId('msg')
  const expiresAt = conv.disappearing_seconds > 0 ? new Date(Date.now() + conv.disappearing_seconds * 1000).toISOString() : null

  await c.env.DB
    .prepare(
      `INSERT INTO encrypted_messages (id, conversation_id, sender_id, ciphertext, iv, message_type, attachment_key, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(messageId, convId, user.id, String(body.ciphertext), String(body.iv), body.messageType === 'attachment_ref' ? 'attachment_ref' : 'text', body.attachmentKey ?? null, expiresAt)
    .run()

  return c.json({ id: messageId, createdAt: new Date().toISOString(), expiresAt }, 201)
})

// ---------- MARK READ ----------
chat.post('/conversations/:id/read', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const convId = c.req.param('id')
  await c.env.DB
    .prepare("UPDATE encrypted_messages SET read_at = datetime('now') WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL")
    .bind(convId, user.id)
    .run()
  return c.json({ success: true })
})

// ---------- SET DISAPPEARING MESSAGES ----------
chat.patch('/conversations/:id', requireAuth, requireCouple, async (c) => {
  const convId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const seconds = Number.isFinite(body.disappearingSeconds) ? Math.max(0, Math.min(604800, parseInt(body.disappearingSeconds, 10))) : null
  if (seconds === null) return c.json({ error: 'ValidationError' }, 422)
  await c.env.DB.prepare('UPDATE conversations SET disappearing_seconds = ? WHERE id = ?').bind(seconds, convId).run()
  return c.json({ success: true, disappearingSeconds: seconds })
})

export default chat
