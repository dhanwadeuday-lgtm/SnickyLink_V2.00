import { Hono } from 'hono'
import { newId } from '../lib/crypto'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../middleware/auth'
import { createNotification } from '../lib/game'

const couples = new Hono<AppEnv>()

// ---------- CREATE COUPLE ----------
couples.post('/', requireAuth, async (c) => {
  const user = c.get('user')
  if (user.coupleId) return c.json({ error: 'Conflict', message: 'You are already in a couple' }, 409)

  const body = await c.req.json().catch(() => ({}))
  const nickname = String(body.nickname ?? '').trim()
  const tagline = String(body.tagline ?? "We're better together").trim()
  const city = body.city ? String(body.city).trim() : null
  const country = body.country ? String(body.country).trim() : null

  if (nickname.length < 2) return c.json({ error: 'ValidationError', message: 'Couple nickname must be at least 2 characters' }, 422)

  const existingNickname = await c.env.DB.prepare('SELECT id FROM couples WHERE nickname = ?').bind(nickname).first()
  if (existingNickname) return c.json({ error: 'Conflict', message: 'Nickname already taken, try another' }, 409)

  const coupleId = newId('cpl')
  const avatarSeed = newId('')

  await c.env.DB
    .prepare(
      `INSERT INTO couples (id, nickname, tagline, avatar_seed, city, country) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(coupleId, nickname, tagline, avatarSeed, city, country)
    .run()

  await c.env.DB.prepare('INSERT INTO couple_pillar_stats (couple_id) VALUES (?)').bind(coupleId).run()
  await c.env.DB
    .prepare('INSERT INTO couple_members (id, couple_id, user_id, role) VALUES (?, ?, ?, ?)')
    .bind(newId('cm'), coupleId, user.id, 'creator')
    .run()

  // create the couple's private chat conversation shell (member added when partner joins)
  const conversationId = newId('conv')
  await c.env.DB
    .prepare('INSERT INTO conversations (id, couple_id, title) VALUES (?, ?, ?)')
    .bind(conversationId, coupleId, 'My Person')
    .run()
  await c.env.DB
    .prepare('INSERT INTO conversation_members (id, conversation_id, user_id) VALUES (?, ?, ?)')
    .bind(newId('cvm'), conversationId, user.id)
    .run()

  // generate an invite code right away
  const code = newId('').slice(0, 8).toUpperCase()
  const inviteId = newId('inv')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await c.env.DB
    .prepare('INSERT INTO couple_invites (id, couple_id, code, created_by, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(inviteId, coupleId, code, user.id, expiresAt)
    .run()

  return c.json({ coupleId, nickname, tagline, inviteCode: code }, 201)
})

// ---------- CREATE NEW INVITE CODE ----------
couples.post('/invites', requireAuth, async (c) => {
  const user = c.get('user')
  if (!user.coupleId) return c.json({ error: 'NoCouple' }, 409)
  const code = newId('').slice(0, 8).toUpperCase()
  const inviteId = newId('inv')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await c.env.DB
    .prepare('INSERT INTO couple_invites (id, couple_id, code, created_by, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(inviteId, user.coupleId, code, user.id, expiresAt)
    .run()
  return c.json({ inviteCode: code, expiresAt }, 201)
})

// ---------- JOIN COUPLE VIA INVITE CODE ----------
couples.post('/join', requireAuth, async (c) => {
  const user = c.get('user')
  if (user.coupleId) return c.json({ error: 'Conflict', message: 'You are already in a couple' }, 409)

  const body = await c.req.json().catch(() => ({}))
  const code = String(body.code ?? '').trim().toUpperCase()
  if (!code) return c.json({ error: 'ValidationError', message: 'Invite code required' }, 422)

  const invite = await c.env.DB.prepare("SELECT * FROM couple_invites WHERE code = ? AND status = 'pending'").bind(code).first<any>()
  if (!invite) return c.json({ error: 'NotFound', message: 'Invalid or expired invite code' }, 404)
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await c.env.DB.prepare("UPDATE couple_invites SET status = 'expired' WHERE id = ?").bind(invite.id).run()
    return c.json({ error: 'Gone', message: 'Invite code has expired' }, 410)
  }
  if (invite.created_by === user.id) return c.json({ error: 'BadRequest', message: 'You cannot join your own invite' }, 400)

  const memberCount = await c.env.DB
    .prepare('SELECT COUNT(*) as cnt FROM couple_members WHERE couple_id = ?')
    .bind(invite.couple_id)
    .first<any>()
  if ((memberCount?.cnt ?? 0) >= 2) return c.json({ error: 'Conflict', message: 'This couple already has two members' }, 409)

  await c.env.DB
    .prepare('INSERT INTO couple_members (id, couple_id, user_id, role) VALUES (?, ?, ?, ?)')
    .bind(newId('cm'), invite.couple_id, user.id, 'partner')
    .run()
  await c.env.DB
    .prepare("UPDATE couple_invites SET status = 'accepted', accepted_by = ?, accepted_at = datetime('now') WHERE id = ?")
    .bind(user.id, invite.id)
    .run()

  // add to conversation
  const conversation = await c.env.DB.prepare('SELECT id FROM conversations WHERE couple_id = ?').bind(invite.couple_id).first<any>()
  if (conversation) {
    await c.env.DB
      .prepare('INSERT OR IGNORE INTO conversation_members (id, conversation_id, user_id) VALUES (?, ?, ?)')
      .bind(newId('cvm'), conversation.id, user.id)
      .run()
  }

  await createNotification(c.env.DB, invite.created_by, 'COUPLE_INVITE', 'Your partner joined! 💕', 'You are now officially a SnickyLink couple. Time to start your first Snick!')

  const couple = await c.env.DB.prepare('SELECT * FROM couples WHERE id = ?').bind(invite.couple_id).first<any>()

  return c.json({ coupleId: couple.id, nickname: couple.nickname, tagline: couple.tagline })
})

// ---------- GET MY COUPLE ----------
couples.get('/me', requireAuth, async (c) => {
  const user = c.get('user')
  if (!user.coupleId) return c.json({ error: 'NoCouple' }, 409)

  const couple = await c.env.DB.prepare('SELECT * FROM couples WHERE id = ?').bind(user.coupleId).first<any>()
  const pillars = await c.env.DB.prepare('SELECT * FROM couple_pillar_stats WHERE couple_id = ?').bind(user.coupleId).first<any>()
  const members = await c.env.DB
    .prepare(
      `SELECT u.id, u.display_name, u.avatar_seed FROM couple_members cm JOIN users u ON u.id = cm.user_id WHERE cm.couple_id = ?`
    )
    .bind(user.coupleId)
    .all<any>()
  const league = couple.league_id ? await c.env.DB.prepare('SELECT * FROM leagues WHERE id = ?').bind(couple.league_id).first<any>() : null

  return c.json({
    id: couple.id,
    nickname: couple.nickname,
    tagline: couple.tagline,
    avatarSeed: couple.avatar_seed,
    city: couple.city,
    country: couple.country,
    xpTotal: couple.xp_total,
    level: couple.level,
    streakCount: couple.streak_count,
    longestStreak: couple.longest_streak,
    league: league ? { id: league.id, name: league.name } : null,
    members: (members.results ?? []).map((m: any) => ({ id: m.id, displayName: m.display_name, avatarSeed: m.avatar_seed })),
    pillars: pillars
      ? {
          communication: { xp: pillars.communication_xp, level: pillars.communication_level },
          emotional: { xp: pillars.emotional_xp, level: pillars.emotional_level },
          efforts: { xp: pillars.efforts_xp, level: pillars.efforts_level },
          trust: { xp: pillars.trust_xp, level: pillars.trust_level },
        }
      : null,
  })
})

// ---------- UPDATE COUPLE (nickname / tagline / location) ----------
couples.patch('/me', requireAuth, async (c) => {
  const user = c.get('user')
  if (!user.coupleId) return c.json({ error: 'NoCouple' }, 409)
  const body = await c.req.json().catch(() => ({}))
  const updates: string[] = []
  const values: any[] = []
  if (body.nickname && String(body.nickname).trim().length >= 2) {
    const dup = await c.env.DB.prepare('SELECT id FROM couples WHERE nickname = ? AND id != ?').bind(String(body.nickname).trim(), user.coupleId).first()
    if (dup) return c.json({ error: 'Conflict', message: 'Nickname already taken' }, 409)
    updates.push('nickname = ?')
    values.push(String(body.nickname).trim())
  }
  if (body.tagline) {
    updates.push('tagline = ?')
    values.push(String(body.tagline).trim())
  }
  if (body.city) {
    updates.push('city = ?')
    values.push(String(body.city).trim())
  }
  if (body.country) {
    updates.push('country = ?')
    values.push(String(body.country).trim())
  }
  if (updates.length === 0) return c.json({ error: 'BadRequest', message: 'No valid fields' }, 400)
  updates.push("updated_at = datetime('now')")
  values.push(user.coupleId)
  await c.env.DB.prepare(`UPDATE couples SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  return c.json({ success: true })
})

export default couples
