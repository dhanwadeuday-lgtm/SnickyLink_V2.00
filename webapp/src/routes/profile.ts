import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { requireAuth, requireCouple } from '../middleware/auth'
import { levelFromXp, pillarLevelFromXp } from '../lib/game'

const profile = new Hono<AppEnv>()

// ---------- PILLARS DETAIL ----------
profile.get('/pillars', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const pillars = await c.env.DB.prepare('SELECT * FROM couple_pillar_stats WHERE couple_id = ?').bind(user.coupleId).first<any>()
  if (!pillars) return c.json({ error: 'NotFound' }, 404)

  const comm = pillarLevelFromXp(pillars.communication_xp)
  const emo = pillarLevelFromXp(pillars.emotional_xp)
  const eff = pillarLevelFromXp(pillars.efforts_xp)
  const trust = pillarLevelFromXp(pillars.trust_xp)

  return c.json({
    communication: { level: comm.level, percentage: comm.percentage, currentXp: comm.currentLevelXp, xpForNext: comm.xpForNextLevel },
    emotionalConnection: { level: emo.level, percentage: emo.percentage, currentXp: emo.currentLevelXp, xpForNext: emo.xpForNextLevel },
    efforts: { level: eff.level, percentage: eff.percentage, currentXp: eff.currentLevelXp, xpForNext: eff.xpForNextLevel },
    trust: { level: trust.level, percentage: trust.percentage, currentXp: trust.currentLevelXp, xpForNext: trust.xpForNextLevel },
  })
})

// ---------- STATS ----------
profile.get('/stats', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const couple = await c.env.DB.prepare('SELECT * FROM couples WHERE id = ?').bind(user.coupleId).first<any>()
  const levelInfo = levelFromXp(couple.xp_total)

  const completedCount = await c.env.DB
    .prepare("SELECT COUNT(*) as cnt FROM snick_completions WHERE couple_id = ? AND status = 'APPROVED'")
    .bind(user.coupleId)
    .first<any>()
  const byFrequency = await c.env.DB
    .prepare(
      `SELECT s.frequency, COUNT(*) as cnt FROM snick_completions sc JOIN snicks s ON s.id = sc.snick_id
       WHERE sc.couple_id = ? AND sc.status = 'APPROVED' GROUP BY s.frequency`
    )
    .bind(user.coupleId)
    .all<any>()

  return c.json({
    xpTotal: couple.xp_total,
    level: levelInfo.level,
    currentLevelXp: levelInfo.currentLevelXp,
    xpForNextLevel: levelInfo.xpForNextLevel,
    streakCount: couple.streak_count,
    longestStreak: couple.longest_streak,
    totalSnicksCompleted: completedCount?.cnt ?? 0,
    byFrequency: (byFrequency.results ?? []).reduce((acc: any, r: any) => ({ ...acc, [r.frequency]: r.cnt }), {}),
  })
})

// ---------- ACHIEVEMENTS ----------
profile.get('/achievements', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const all = await c.env.DB.prepare('SELECT * FROM achievements WHERE active = 1').all<any>()
  const unlocked = await c.env.DB.prepare('SELECT achievement_id, unlocked_at FROM couple_achievements WHERE couple_id = ?').bind(user.coupleId).all<any>()
  const unlockedMap = new Map((unlocked.results ?? []).map((u: any) => [u.achievement_id, u.unlocked_at]))

  return c.json({
    achievements: (all.results ?? []).map((a: any) => ({
      id: a.id,
      code: a.code,
      title: a.title,
      description: a.description,
      iconKey: a.icon_key,
      xpBonus: a.xp_bonus,
      unlocked: unlockedMap.has(a.id),
      unlockedAt: unlockedMap.get(a.id) ?? null,
    })),
  })
})

export default profile
