import { Hono } from 'hono'
import { newId } from '../lib/crypto'
import type { AppEnv } from '../lib/types'
import { requireAuth, requireAdmin } from '../middleware/auth'

const admin = new Hono<AppEnv>()
admin.use('*', requireAuth, requireAdmin)

async function audit(db: D1Database, adminUserId: string, action: string, targetType: string, targetId?: string, meta?: any) {
  await db
    .prepare('INSERT INTO audit_logs (id, admin_user_id, action, target_type, target_id, meta_json) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(newId('audit'), adminUserId, action, targetType, targetId ?? null, meta ? JSON.stringify(meta) : null)
    .run()
}

// ---------- USERS ----------
admin.get('/users', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, email, display_name, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 200').all<any>()
  return c.json({ users: rows.results ?? [] })
})

admin.patch('/users/:id/status', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  if (!['active', 'banned', 'deleted'].includes(body.status)) return c.json({ error: 'ValidationError' }, 422)
  await c.env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(body.status, id).run()
  await audit(c.env.DB, user.id, 'update_user_status', 'user', id, { status: body.status })
  return c.json({ success: true })
})

// ---------- COUPLES ----------
admin.get('/couples', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM couples ORDER BY xp_total DESC LIMIT 200').all<any>()
  return c.json({ couples: rows.results ?? [] })
})

// ---------- SNICKS (full CRUD — snicks must be admin-configurable) ----------
admin.get('/snicks', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM snicks ORDER BY frequency, sequence_index').all<any>()
  return c.json({ snicks: rows.results ?? [] })
})

admin.post('/snicks', async (c) => {
  const user = c.get('user')
  const b = await c.req.json().catch(() => null)
  if (!b?.title || !b?.description || !b?.frequency) return c.json({ error: 'ValidationError', message: 'title, description, frequency required' }, 422)

  const id = newId('snk')
  await c.env.DB
    .prepare(
      `INSERT INTO snicks (id, title, description, category_id, frequency, difficulty, xp_reward,
        communication_percentage, emotional_connection_percentage, efforts_percentage, trust_percentage,
        verification_type, duration_minutes, long_distance_supported, location_requirement, sequence_index, map_label, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      b.title,
      b.description,
      b.categoryId ?? null,
      b.frequency,
      b.difficulty ?? 'EASY',
      b.xpReward ?? 50,
      b.communicationPercentage ?? 0,
      b.emotionalConnectionPercentage ?? 0,
      b.effortsPercentage ?? 0,
      b.trustPercentage ?? 0,
      b.verificationType ?? 'SELF_CONFIRMATION',
      b.durationMinutes ?? 10,
      b.longDistanceSupported === false ? 0 : 1,
      b.locationRequirement ?? null,
      b.sequenceIndex ?? 0,
      b.mapLabel ?? 'Day 1',
      b.active === false ? 0 : 1
    )
    .run()
  await audit(c.env.DB, user.id, 'create_snick', 'snick', id, b)
  return c.json({ id }, 201)
})

admin.patch('/snicks/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const b = await c.req.json().catch(() => ({}))
  const fieldMap: Record<string, string> = {
    title: 'title',
    description: 'description',
    categoryId: 'category_id',
    frequency: 'frequency',
    difficulty: 'difficulty',
    xpReward: 'xp_reward',
    communicationPercentage: 'communication_percentage',
    emotionalConnectionPercentage: 'emotional_connection_percentage',
    effortsPercentage: 'efforts_percentage',
    trustPercentage: 'trust_percentage',
    verificationType: 'verification_type',
    durationMinutes: 'duration_minutes',
    longDistanceSupported: 'long_distance_supported',
    locationRequirement: 'location_requirement',
    sequenceIndex: 'sequence_index',
    mapLabel: 'map_label',
    active: 'active',
  }
  const updates: string[] = []
  const values: any[] = []
  for (const [k, col] of Object.entries(fieldMap)) {
    if (k in b) {
      updates.push(`${col} = ?`)
      values.push(typeof b[k] === 'boolean' ? (b[k] ? 1 : 0) : b[k])
    }
  }
  if (updates.length === 0) return c.json({ error: 'BadRequest' }, 400)
  updates.push("updated_at = datetime('now')")
  values.push(id)
  await c.env.DB.prepare(`UPDATE snicks SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  await audit(c.env.DB, user.id, 'update_snick', 'snick', id, b)
  return c.json({ success: true })
})

admin.delete('/snicks/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE snicks SET active = 0 WHERE id = ?').bind(id).run()
  await audit(c.env.DB, user.id, 'deactivate_snick', 'snick', id)
  return c.json({ success: true })
})

// ---------- SNICK CATEGORIES ----------
admin.get('/snick-categories', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM snick_categories').all<any>()
  return c.json({ categories: rows.results ?? [] })
})
admin.post('/snick-categories', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!b.name) return c.json({ error: 'ValidationError' }, 422)
  const id = newId('cat')
  await c.env.DB.prepare('INSERT INTO snick_categories (id, name, description, color_key) VALUES (?, ?, ?, ?)').bind(id, b.name, b.description ?? null, b.colorKey ?? 'daily').run()
  return c.json({ id }, 201)
})

// ---------- ACHIEVEMENTS ----------
admin.get('/achievements', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM achievements').all<any>()
  return c.json({ achievements: rows.results ?? [] })
})
admin.post('/achievements', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!b.code || !b.title || !b.criteriaType || b.criteriaValue == null) return c.json({ error: 'ValidationError' }, 422)
  const id = newId('ach')
  await c.env.DB
    .prepare('INSERT INTO achievements (id, code, title, description, icon_key, xp_bonus, criteria_type, criteria_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, b.code, b.title, b.description ?? '', b.iconKey ?? 'star', b.xpBonus ?? 0, b.criteriaType, b.criteriaValue)
    .run()
  return c.json({ id }, 201)
})

// ---------- LEAGUES ----------
admin.get('/leagues', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM leagues ORDER BY order_index').all<any>()
  return c.json({ leagues: rows.results ?? [] })
})
admin.post('/leagues', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!b.name || b.minXp == null || b.orderIndex == null) return c.json({ error: 'ValidationError' }, 422)
  const id = newId('lg')
  await c.env.DB.prepare('INSERT INTO leagues (id, name, min_xp, order_index, icon_key) VALUES (?, ?, ?, ?, ?)').bind(id, b.name, b.minXp, b.orderIndex, b.iconKey ?? 'gem').run()
  return c.json({ id }, 201)
})

// ---------- REWARDS ----------
admin.get('/rewards', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM rewards').all<any>()
  return c.json({ rewards: rows.results ?? [] })
})
admin.post('/rewards', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!b.title || b.unlockXp == null) return c.json({ error: 'ValidationError' }, 422)
  const id = newId('rwd')
  await c.env.DB
    .prepare('INSERT INTO rewards (id, league_id, title, description, icon_key, unlock_xp) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, b.leagueId ?? null, b.title, b.description ?? '', b.iconKey ?? 'gift', b.unlockXp)
    .run()
  return c.json({ id }, 201)
})

// ---------- COMMUNITY MODERATION ----------
admin.get('/reports', async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM reports WHERE status = 'open' ORDER BY created_at DESC").all<any>()
  return c.json({ reports: rows.results ?? [] })
})
admin.patch('/reports/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const b = await c.req.json().catch(() => ({}))
  if (!['reviewed', 'dismissed', 'actioned'].includes(b.status)) return c.json({ error: 'ValidationError' }, 422)
  await c.env.DB.prepare("UPDATE reports SET status = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?").bind(b.status, user.id, id).run()
  if (b.status === 'actioned' && b.removeContent) {
    const report = await c.env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first<any>()
    if (report?.target_type === 'post') {
      await c.env.DB.prepare("UPDATE posts SET status = 'removed' WHERE id = ?").bind(report.target_id).run()
    }
  }
  await audit(c.env.DB, user.id, 'moderate_report', 'report', id, b)
  return c.json({ success: true })
})

// ---------- ANALYTICS ----------
admin.get('/analytics/summary', async (c) => {
  const db = c.env.DB
  const [dau, wau, mau, couplesCreated, couplesActivated, snicksCompleted, snicksStarted, snicksViewed] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM analytics_events WHERE created_at >= datetime('now', '-1 day')").first<any>(),
    db.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM analytics_events WHERE created_at >= datetime('now', '-7 day')").first<any>(),
    db.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM analytics_events WHERE created_at >= datetime('now', '-30 day')").first<any>(),
    db.prepare('SELECT COUNT(*) as cnt FROM couples').first<any>(),
    db.prepare("SELECT COUNT(DISTINCT couple_id) as cnt FROM snick_completions WHERE status = 'APPROVED'").first<any>(),
    db.prepare("SELECT COUNT(*) as cnt FROM analytics_events WHERE event_type = 'snick_completed'").first<any>(),
    db.prepare("SELECT COUNT(*) as cnt FROM analytics_events WHERE event_type = 'snick_started'").first<any>(),
    db.prepare("SELECT COUNT(*) as cnt FROM analytics_events WHERE event_type = 'snick_viewed'").first<any>(),
  ])
  const completionRate = (snicksStarted?.cnt ?? 0) > 0 ? Math.round(((snicksCompleted?.cnt ?? 0) / snicksStarted.cnt) * 100) : 0

  const approvedRow = await db.prepare("SELECT COUNT(*) as cnt FROM snick_completions WHERE status = 'APPROVED'").first<any>()
  const totalCompletionsRow = await db.prepare("SELECT COUNT(*) as cnt FROM snick_completions WHERE status != 'PENDING'").first<any>()
  const verificationRate = (totalCompletionsRow?.cnt ?? 0) > 0 ? Math.round(((approvedRow?.cnt ?? 0) / totalCompletionsRow.cnt) * 100) : 0

  const totalCouples = couplesCreated?.cnt ?? 0
  const avgSnicksPerCouple = totalCouples > 0 ? Math.round(((approvedRow?.cnt ?? 0) / totalCouples) * 10) / 10 : 0

  const communityEngagement = await db.prepare('SELECT COUNT(*) as cnt FROM posts').first<any>()

  return c.json({
    dau: dau?.cnt ?? 0,
    wau: wau?.cnt ?? 0,
    mau: mau?.cnt ?? 0,
    couplesCreated: totalCouples,
    couplesActivated: couplesActivated?.cnt ?? 0,
    snicksViewed: snicksViewed?.cnt ?? 0,
    snicksStarted: snicksStarted?.cnt ?? 0,
    snicksCompleted: snicksCompleted?.cnt ?? 0,
    completionRate,
    verificationRate,
    avgSnicksPerCouple,
    communityPosts: communityEngagement?.cnt ?? 0,
  })
})

admin.get('/audit-logs', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200').all<any>()
  return c.json({ logs: rows.results ?? [] })
})

export default admin
