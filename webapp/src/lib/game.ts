// ============================================================
// SNICKYLINK Game Engine — Level math, XP awarding, streaks,
// pillar progression, achievements, league assignment.
// All formulas are gameplay constructs, not scientific/clinical.
// ============================================================
import { newId } from './crypto'

// ---------- Level math (derived purely from cumulative XP, no separate storage) ----------
// Cumulative XP required to BE at the start of `level` (level 1 => 0 xp)
export function xpForLevel(level: number): number {
  return 500 * level * (level - 1)
}

export function levelFromXp(xpTotal: number): { level: number; currentLevelXp: number; xpForNextLevel: number } {
  let level = 1
  while (xpForLevel(level + 1) <= xpTotal) level++
  const currentLevelXp = xpTotal - xpForLevel(level)
  const xpForNextLevel = xpForLevel(level + 1) - xpForLevel(level)
  return { level, currentLevelXp, xpForNextLevel }
}

// Pillar level uses a gentler curve since each pillar only accrues a % share of total XP
export function xpForPillarLevel(level: number): number {
  return 150 * level * (level - 1)
}

export function pillarLevelFromXp(xp: number): { level: number; currentLevelXp: number; xpForNextLevel: number; percentage: number } {
  let level = 1
  while (xpForPillarLevel(level + 1) <= xp) level++
  const currentLevelXp = xp - xpForPillarLevel(level)
  const xpForNextLevel = xpForPillarLevel(level + 1) - xpForPillarLevel(level)
  const percentage = xpForNextLevel > 0 ? Math.min(100, Math.round((currentLevelXp / xpForNextLevel) * 100)) : 100
  return { level, currentLevelXp, xpForNextLevel, percentage }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayUtc(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export type PillarShare = {
  communication_percentage: number
  emotional_connection_percentage: number
  efforts_percentage: number
  trust_percentage: number
}

export type XpAwardResult = {
  xpAwarded: number
  newXpTotal: number
  levelBefore: number
  levelAfter: number
  leveledUp: boolean
  streakCount: number
  streakIncreased: boolean
  pillars: {
    communication: ReturnType<typeof pillarLevelFromXp>
    emotional: ReturnType<typeof pillarLevelFromXp>
    efforts: ReturnType<typeof pillarLevelFromXp>
    trust: ReturnType<typeof pillarLevelFromXp>
  }
  unlockedAchievements: { id: string; code: string; title: string; description: string; icon_key: string; xp_bonus: number }[]
  leagueId: string | null
}

/**
 * Central XP awarding routine. Call this whenever a couple earns XP
 * (snick completion approval, achievement bonus). Idempotency for
 * snick completions is enforced by the caller (one completion row per snick).
 */
export async function awardXp(
  db: D1Database,
  coupleId: string,
  amount: number,
  pillarShare: PillarShare,
  source: 'snick_completion' | 'achievement' | 'bonus' | 'streak',
  sourceId: string | null
): Promise<XpAwardResult> {
  const couple = await db.prepare('SELECT * FROM couples WHERE id = ?').bind(coupleId).first<any>()
  if (!couple) throw new Error('Couple not found')

  const communicationAmount = Math.round((amount * pillarShare.communication_percentage) / 100)
  const emotionalAmount = Math.round((amount * pillarShare.emotional_connection_percentage) / 100)
  const effortsAmount = Math.round((amount * pillarShare.efforts_percentage) / 100)
  const trustAmount = amount - communicationAmount - emotionalAmount - effortsAmount // remainder absorbs rounding

  const levelBefore = levelFromXp(couple.xp_total).level
  const newXpTotal = couple.xp_total + amount

  // Streak update
  const today = todayUtc()
  const yesterday = yesterdayUtc()
  let streakCount = couple.streak_count
  let streakIncreased = false
  if (couple.streak_last_date === today) {
    // already active today, no change
  } else if (couple.streak_last_date === yesterday) {
    streakCount = couple.streak_count + 1
    streakIncreased = true
  } else {
    streakCount = 1
    streakIncreased = true
  }
  const longestStreak = Math.max(couple.longest_streak, streakCount)
  const levelAfter = levelFromXp(newXpTotal).level

  // Pillar stats
  const pillarRow = await db.prepare('SELECT * FROM couple_pillar_stats WHERE couple_id = ?').bind(coupleId).first<any>()
  const newCommXp = (pillarRow?.communication_xp ?? 0) + communicationAmount
  const newEmoXp = (pillarRow?.emotional_xp ?? 0) + emotionalAmount
  const newEffXp = (pillarRow?.efforts_xp ?? 0) + effortsAmount
  const newTrustXp = (pillarRow?.trust_xp ?? 0) + trustAmount

  const commLvl = pillarLevelFromXp(newCommXp)
  const emoLvl = pillarLevelFromXp(newEmoXp)
  const effLvl = pillarLevelFromXp(newEffXp)
  const trustLvl = pillarLevelFromXp(newTrustXp)

  // League assignment
  const league = await db
    .prepare('SELECT id FROM leagues WHERE min_xp <= ? ORDER BY min_xp DESC LIMIT 1')
    .bind(newXpTotal)
    .first<any>()
  const leagueId = league?.id ?? null

  const eventId = newId('xpevt')
  const batch: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO couple_xp_events (id, couple_id, source, source_id, amount, communication_amount, emotional_amount, efforts_amount, trust_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(eventId, coupleId, source, sourceId, amount, communicationAmount, emotionalAmount, effortsAmount, trustAmount),
    db
      .prepare(
        `UPDATE couples SET xp_total = ?, level = ?, streak_count = ?, streak_last_date = ?, longest_streak = ?, league_id = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(newXpTotal, levelAfter, streakCount, today, longestStreak, leagueId, coupleId),
    db
      .prepare(
        `INSERT INTO couple_pillar_stats (couple_id, communication_xp, emotional_xp, efforts_xp, trust_xp, communication_level, emotional_level, efforts_level, trust_level, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(couple_id) DO UPDATE SET
           communication_xp=excluded.communication_xp, emotional_xp=excluded.emotional_xp,
           efforts_xp=excluded.efforts_xp, trust_xp=excluded.trust_xp,
           communication_level=excluded.communication_level, emotional_level=excluded.emotional_level,
           efforts_level=excluded.efforts_level, trust_level=excluded.trust_level, updated_at=datetime('now')`
      )
      .bind(coupleId, newCommXp, newEmoXp, newEffXp, newTrustXp, commLvl.level, emoLvl.level, effLvl.level, trustLvl.level),
    db
      .prepare(`INSERT OR IGNORE INTO couple_streak_log (id, couple_id, streak_date) VALUES (?, ?, ?)`)
      .bind(newId('streaklog'), coupleId, today),
  ]
  await db.batch(batch)

  // Achievement checks (single pass; achievement bonus XP applied as separate simple event, not recursive)
  const unlocked = await checkAndUnlockAchievements(db, coupleId, {
    xpTotal: newXpTotal,
    streakCount,
    pillarLevels: [commLvl.level, emoLvl.level, effLvl.level, trustLvl.level],
  })

  return {
    xpAwarded: amount,
    newXpTotal,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    streakCount,
    streakIncreased,
    pillars: { communication: commLvl, emotional: emoLvl, efforts: effLvl, trust: trustLvl },
    unlockedAchievements: unlocked,
    leagueId,
  }
}

async function checkAndUnlockAchievements(
  db: D1Database,
  coupleId: string,
  ctx: { xpTotal: number; streakCount: number; pillarLevels: number[] }
) {
  const achievements = await db.prepare('SELECT * FROM achievements WHERE active = 1').all<any>()
  const already = await db
    .prepare('SELECT achievement_id FROM couple_achievements WHERE couple_id = ?')
    .bind(coupleId)
    .all<any>()
  const alreadySet = new Set((already.results ?? []).map((r: any) => r.achievement_id))

  const completedCountRow = await db
    .prepare("SELECT COUNT(*) as cnt FROM snick_completions WHERE couple_id = ? AND status = 'APPROVED'")
    .bind(coupleId)
    .first<any>()
  const completedCount = completedCountRow?.cnt ?? 0

  const unlocked: any[] = []
  for (const a of achievements.results ?? []) {
    if (alreadySet.has(a.id)) continue
    let met = false
    if (a.criteria_type === 'SNICKS_COMPLETED') met = completedCount >= a.criteria_value
    else if (a.criteria_type === 'STREAK_DAYS') met = ctx.streakCount >= a.criteria_value
    else if (a.criteria_type === 'XP_TOTAL') met = ctx.xpTotal >= a.criteria_value
    else if (a.criteria_type === 'PILLAR_LEVEL') met = ctx.pillarLevels.some((l) => l >= a.criteria_value)

    if (met) {
      await db
        .prepare('INSERT INTO couple_achievements (id, couple_id, achievement_id) VALUES (?, ?, ?)')
        .bind(newId('cach'), coupleId, a.id)
        .run()
      if (a.xp_bonus > 0) {
        await db
          .prepare('UPDATE couples SET xp_total = xp_total + ? WHERE id = ?')
          .bind(a.xp_bonus, coupleId)
          .run()
      }
      unlocked.push(a)
    }
  }
  return unlocked
}

export async function createNotification(
  db: D1Database,
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, data_json) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(newId('notif'), userId, type, title, body, data ? JSON.stringify(data) : null)
    .run()
}

export async function notifyCouplePartners(db: D1Database, coupleId: string, excludeUserId: string | null, type: string, title: string, body: string, data?: Record<string, any>) {
  const members = await db.prepare('SELECT user_id FROM couple_members WHERE couple_id = ?').bind(coupleId).all<any>()
  for (const m of members.results ?? []) {
    if (excludeUserId && m.user_id === excludeUserId) continue
    await createNotification(db, m.user_id, type, title, body, data)
  }
}
