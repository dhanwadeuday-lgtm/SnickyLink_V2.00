import { Hono } from 'hono'
import { newId } from '../lib/crypto'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../middleware/auth'

const analytics = new Hono<AppEnv>()

const ALLOWED_EVENTS = new Set(['dau_ping', 'snick_viewed', 'leaderboard_viewed', 'community_viewed'])

// Privacy-conscious client event tracking. Never accepts private chat content.
analytics.post('/events', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const eventType = body.eventType
  if (!ALLOWED_EVENTS.has(eventType)) return c.json({ error: 'ValidationError', message: 'Unsupported event type' }, 422)
  await c.env.DB
    .prepare('INSERT INTO analytics_events (id, event_type, user_id, couple_id, meta_json) VALUES (?, ?, ?, ?, ?)')
    .bind(newId('ae'), eventType, user.id, user.coupleId, body.meta ? JSON.stringify(body.meta).slice(0, 2000) : null)
    .run()
  return c.json({ success: true }, 201)
})

export default analytics
