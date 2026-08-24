import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../middleware/auth'

const notifications = new Hono<AppEnv>()

notifications.get('/', requireAuth, async (c) => {
  const user = c.get('user')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '30', 10) || 30, 100)
  const rows = await c.env.DB
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(user.id, limit)
    .all<any>()
  const unreadCount = await c.env.DB
    .prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND read_at IS NULL')
    .bind(user.id)
    .first<any>()
  return c.json({
    notifications: (rows.results ?? []).map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data_json ? JSON.parse(n.data_json) : null,
      read: !!n.read_at,
      createdAt: n.created_at,
    })),
    unreadCount: unreadCount?.cnt ?? 0,
  })
})

notifications.post('/:id/read', requireAuth, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?").bind(id, user.id).run()
  return c.json({ success: true })
})

notifications.post('/read-all', requireAuth, async (c) => {
  const user = c.get('user')
  await c.env.DB.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").bind(user.id).run()
  return c.json({ success: true })
})

notifications.get('/preferences', requireAuth, async (c) => {
  const user = c.get('user')
  const prefs = await c.env.DB.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').bind(user.id).first<any>()
  return c.json({ preferences: prefs ?? {} })
})

notifications.patch('/preferences', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const fields = ['new_snick', 'partner_completed', 'streak_warning', 'achievement_unlocked', 'level_up', 'leaderboard_change', 'couple_invite', 'reward_unlocked']
  const updates: string[] = []
  const values: any[] = []
  for (const f of fields) {
    if (f in body) {
      updates.push(`${f} = ?`)
      values.push(body[f] ? 1 : 0)
    }
  }
  if (updates.length === 0) return c.json({ error: 'BadRequest' }, 400)
  values.push(user.id)
  await c.env.DB.prepare(`UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = ?`).bind(...values).run()
  return c.json({ success: true })
})

// device registration for push notifications (Expo/FCM token would be posted here in a native build)
notifications.post('/devices', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  if (!body.pushToken || !body.platform) return c.json({ error: 'ValidationError' }, 422)
  const { newId } = await import('../lib/crypto')
  await c.env.DB
    .prepare('INSERT INTO user_devices (id, user_id, push_token, platform) VALUES (?, ?, ?, ?)')
    .bind(newId('dev'), user.id, body.pushToken, body.platform)
    .run()
  return c.json({ success: true }, 201)
})

export default notifications
