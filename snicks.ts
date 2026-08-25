import { Hono } from 'hono'
import { newId } from '../lib/crypto'
import type { AppEnv } from '../lib/types'
import { requireAuth, requireCouple } from '../middleware/auth'
import { awardXp, notifyCouplePartners } from '../lib/game'
import { pickTodaysDaily, computePillarDeficit, evaluateWeeklyGate, evaluateMonthlyGate, todayUtcDate } from '../lib/habit'

const snicks = new Hono<AppEnv>()

const VALID_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'SPECIAL', 'MYSTERY', 'CHALLENGE']

function serializeSnick(s: any) {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    frequency: s.frequency,
    difficulty: s.difficulty,
    xpReward: s.xp_reward,
    mapLabel: s.map_label,
    sequenceIndex: s.sequence_index,
    verificationType: s.verification_type,
    verificationMethod: s.verification_method,
    verificationLevel: s.verification_level,
    safetyStatus: s.safety_status,
    privacyRule: s.privacy_rule,
    durationMinutes: s.duration_minutes,
    longDistanceSupported: !!s.long_distance_supported,
    pillars: {
      communication: s.communication_percentage,
      emotional: s.emotional_connection_percentage,
      efforts: s.efforts_percentage,
      trust: s.trust_percentage,
    },
  }
}

/**
 * Habit-formation gate check (docs/habit-algorithm.md §2). Returns whether a
 * given frequency tier is currently unlocked for this couple, plus progress info.
 * DAILY and CHALLENGE are always unlocked (Daily = the obvious daily cue;
 * Challenge = the always-available variable-reward pool).
 */
async function evaluateTierGate(db: D1Database, coupleId: string, frequency: string) {
  if (frequency === 'DAILY' || frequency === 'CHALLENGE' || frequency === 'SPECIAL' || frequency === 'MYSTERY') {
    return { unlocked: true, reason: '', progress: null as any }
  }
  const couple = await db.prepare('SELECT streak_count FROM couples WHERE id = ?').bind(coupleId).first<any>()
  const streakCount = couple?.streak_count ?? 0

  if (frequency === 'WEEKLY') {
    return evaluateWeeklyGate(streakCount)
  }
  if (frequency === 'MONTHLY') {
    const approvedWeeklyRow = await db
      .prepare(
        `SELECT COUNT(*) as cnt FROM snick_completions sc JOIN snicks s ON s.id = sc.snick_id
         WHERE sc.couple_id = ? AND s.frequency = 'WEEKLY' AND sc.status = 'APPROVED'`
      )
      .bind(coupleId)
      .first<any>()
    return evaluateMonthlyGate(streakCount, approvedWeeklyRow?.cnt ?? 0)
  }
  return { unlocked: true, reason: '', progress: null as any }
}

// ---------- TODAY'S MISSION (Home hero card — Atomic Habits "make it obvious": ONE clear cue) ----------
snicks.get('/today', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const coupleId = user.coupleId!

  const allDaily = await c.env.DB
    .prepare(
      `SELECT id, communication_percentage, emotional_connection_percentage, efforts_percentage, trust_percentage
       FROM snicks WHERE frequency = 'DAILY' AND active = 1`
    )
    .all<any>()
  if (!allDaily.results?.length) {
    return c.json({ mission: null })
  }

  const recentCompletions = await c.env.DB
    .prepare(
      `SELECT sc.snick_id FROM snick_completions sc JOIN snicks s ON s.id = sc.snick_id
       WHERE sc.couple_id = ? AND s.frequency = 'DAILY' AND sc.status = 'APPROVED'
       AND sc.started_at >= datetime('now', '-14 day')`
    )
    .bind(coupleId)
    .all<any>()
  const recentlyCompletedIds = new Set((recentCompletions.results ?? []).map((r: any) => r.snick_id))

  const xpEvents = await c.env.DB
    .prepare(
      `SELECT communication_amount, emotional_amount, efforts_amount, trust_amount FROM couple_xp_events
       WHERE couple_id = ? AND created_at >= datetime('now', '-7 day')`
    )
    .bind(coupleId)
    .all<any>()
  const pillarDeficit = computePillarDeficit(xpEvents.results ?? [])

  const picked = pickTodaysDaily(coupleId, allDaily.results as any[], recentlyCompletedIds, pillarDeficit)
  if (!picked) return c.json({ mission: null })

  const snick = await c.env.DB.prepare('SELECT * FROM snicks WHERE id = ?').bind(picked.id).first<any>()
  const completion = await c.env.DB
    .prepare(
      `SELECT * FROM snick_completions WHERE couple_id = ? AND snick_id = ? AND started_at >= datetime('now', 'start of day')
       ORDER BY started_at DESC LIMIT 1`
    )
    .bind(coupleId, picked.id)
    .first<any>()

  return c.json({
    mission: {
      ...serializeSnick(snick),
      completionId: completion?.id ?? null,
      completionStatus: completion?.status ?? null,
    },
    date: todayUtcDate(),
  })
})

// ---------- LIST SNICKS AS JOURNEY MAP (grouped by frequency, with couple progress state) ----------
snicks.get('/', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const frequency = c.req.query('frequency')?.toUpperCase() || 'DAILY'
  if (!VALID_FREQUENCIES.includes(frequency)) {
    return c.json({ error: 'ValidationError', message: 'Invalid frequency' }, 422)
  }

  const gate = await evaluateTierGate(c.env.DB, user.coupleId!, frequency)

  const list = await c.env.DB
    .prepare(`SELECT * FROM snicks WHERE frequency = ? AND active = 1 ORDER BY sequence_index ASC`)
    .bind(frequency)
    .all<any>()

  const completions = await c.env.DB
    .prepare(
      `SELECT sc.*, s.frequency FROM snick_completions sc JOIN snicks s ON s.id = sc.snick_id
       WHERE sc.couple_id = ? AND s.frequency = ?`
    )
    .bind(user.coupleId, frequency)
    .all<any>()

  const completionMap = new Map<string, any>()
  for (const row of completions.results ?? []) {
    const existing = completionMap.get(row.snick_id)
    if (!existing || new Date(row.started_at) > new Date(existing.started_at)) completionMap.set(row.snick_id, row)
  }

  // CHALLENGE tier: no sequencing/locking at all — always fully available (variable-reward pool, §2.4).
  const isFreeForAll = frequency === 'CHALLENGE' || frequency === 'MYSTERY' || frequency === 'SPECIAL'

  const allRows = list.results ?? []
  const allItems = allRows.map((s: any, idx: number) => {
    const completion = completionMap.get(s.id)
    let state: 'completed' | 'current' | 'locked' | 'future' = 'future'

    if (!gate.unlocked) {
      state = 'locked'
    } else if (completion?.status === 'APPROVED') {
      state = 'completed'
    } else if (completion?.status === 'PENDING') {
      state = 'current'
    } else if (isFreeForAll) {
      state = 'current'
    } else {
      const priorSnicks = allRows.slice(0, idx)
      const allPriorCompleted = priorSnicks.every((p: any) => completionMap.get(p.id)?.status === 'APPROVED')
      state = allPriorCompleted ? 'current' : 'locked'
    }

    return {
      ...serializeSnick(s),
      state,
      completionId: completion?.id ?? null,
      completionStatus: completion?.status ?? null,
    }
  })

  // ---- Windowing (Atomic Habits "make it obvious" — a wall of 100+ future-locked
  // Snicks is overwhelming and demotivating). For sequential tiers (Daily/Weekly/
  // Monthly) we only ever surface a small batch of ~5 around today's actionable
  // Snick: a couple of recently-completed ones for context, the current one, and
  // ONE locked preview of what's coming next — never the whole far-future queue.
  // Challenge/Mystery/Special stay free-for-all (no sequence to window).
  const WINDOW_SIZE = 5
  const LOCKED_PREVIEW_COUNT = 1 // how many "next day locked" items to reveal beyond current
  let items = allItems
  let hiddenCompletedCount = 0
  let hiddenLockedCount = 0

  if (!isFreeForAll && allItems.length > WINDOW_SIZE) {
    let currentIdx = allItems.findIndex((it: any) => it.state === 'current')
    if (currentIdx === -1) {
      // Nothing currently actionable (gate locked, or everything completed) —
      // anchor the window at the first non-completed item, else the very end.
      currentIdx = allItems.findIndex((it: any) => it.state !== 'completed')
      if (currentIdx === -1) currentIdx = allItems.length - 1
    }
    const afterCount = Math.min(LOCKED_PREVIEW_COUNT, allItems.length - 1 - currentIdx)
    const beforeCount = Math.max(0, WINDOW_SIZE - 1 - afterCount)
    let startIdx = Math.max(0, currentIdx - beforeCount)
    let endIdx = Math.min(allItems.length, currentIdx + afterCount + 1)
    // If we're near the very start of the list (few/no completed items before
    // "current"), extend forward so the window still shows a full batch of 5
    // instead of a short 1-2 item preview.
    if (endIdx - startIdx < WINDOW_SIZE) {
      endIdx = Math.min(allItems.length, startIdx + WINDOW_SIZE)
    }

    hiddenCompletedCount = startIdx
    hiddenLockedCount = allItems.length - endIdx
    items = allItems.slice(startIdx, endIdx)
  }

  return c.json({
    frequency,
    items,
    totalCount: allItems.length,
    hiddenCompletedCount,
    hiddenLockedCount,
    gate: { unlocked: gate.unlocked, reason: gate.reason, progress: gate.progress },
  })
})

// ---------- GET SINGLE SNICK DETAIL ----------
snicks.get('/:id', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const s = await c.env.DB.prepare('SELECT * FROM snicks WHERE id = ? AND active = 1').bind(id).first<any>()
  if (!s) return c.json({ error: 'NotFound' }, 404)

  const completion = await c.env.DB
    .prepare(
      `SELECT * FROM snick_completions WHERE couple_id = ? AND snick_id = ? ORDER BY started_at DESC LIMIT 1`
    )
    .bind(user.coupleId, id)
    .first<any>()

  return c.json({
    ...serializeSnick(s),
    locationRequirement: s.location_requirement,
    completion: completion
      ? { id: completion.id, status: completion.status, startedAt: completion.started_at, completedAt: completion.completed_at }
      : null,
  })
})

// ---------- START SNICK ----------
snicks.post('/:id/start', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const s = await c.env.DB.prepare('SELECT * FROM snicks WHERE id = ? AND active = 1').bind(id).first<any>()
  if (!s) return c.json({ error: 'NotFound' }, 404)

  const existingActive = await c.env.DB
    .prepare(`SELECT * FROM snick_completions WHERE couple_id = ? AND snick_id = ? AND status IN ('PENDING','APPROVED')`)
    .bind(user.coupleId, id)
    .first<any>()
  if (existingActive) return c.json({ error: 'Conflict', message: 'This Snick is already started or completed' }, 409)

  const completionId = newId('cmpl')
  await c.env.DB
    .prepare(`INSERT INTO snick_completions (id, couple_id, snick_id, started_by_user_id, status) VALUES (?, ?, ?, ?, 'PENDING')`)
    .bind(completionId, user.coupleId, id, user.id)
    .run()

  await c.env.DB.prepare('INSERT INTO analytics_events (id, event_type, user_id, couple_id, meta_json) VALUES (?, ?, ?, ?, ?)')
    .bind(newId('ae'), 'snick_started', user.id, user.coupleId, JSON.stringify({ snickId: id }))
    .run()

  await notifyCouplePartners(
    c.env.DB,
    user.coupleId!,
    user.id,
    'NEW_SNICK',
    'Your partner started a Snick! 🎯',
    `They're working on "${s.title}" — join in!`,
    { snickId: id }
  )

  return c.json({ completionId, status: 'PENDING' }, 201)
})

// ---------- COMPLETE SNICK (mark done, awaiting verification per verification_type) ----------
// Also enforces the safety/consent layer from docs/habit-algorithm.md §1.4:
//  - safety_status = REVIEW_CONSENT_SAFETY  -> requires body.consent === true, else 428
//  - safety_status = CONSENT_SKIP_OPTION    -> body.skip === true resolves as SKIPPED (no XP, no penalty)
snicks.post('/:id/complete', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const s = await c.env.DB.prepare('SELECT * FROM snicks WHERE id = ? AND active = 1').bind(id).first<any>()
  if (!s) return c.json({ error: 'NotFound' }, 404)

  const completion = await c.env.DB
    .prepare(`SELECT * FROM snick_completions WHERE couple_id = ? AND snick_id = ? AND status = 'PENDING' ORDER BY started_at DESC LIMIT 1`)
    .bind(user.coupleId, id)
    .first<any>()
  if (!completion) return c.json({ error: 'NotFound', message: 'No active Snick in progress. Start it first.' }, 404)

  // Consent/skip safety layer — never gated behind chat evidence, only an explicit in-app toggle.
  if (s.safety_status === 'CONSENT_SKIP_OPTION' && body.skip === true) {
    await c.env.DB
      .prepare(`UPDATE snick_completions SET status = 'SKIPPED', completed_at = datetime('now'), verified_at = datetime('now') WHERE id = ?`)
      .bind(completion.id)
      .run()
    return c.json({ completionId: completion.id, status: 'SKIPPED' })
  }
  if (s.safety_status === 'REVIEW_CONSENT_SAFETY' && body.consent !== true) {
    return c.json(
      {
        error: 'ConsentRequired',
        message: s.privacy_rule || 'This Snick needs both partners to confirm consent before completing.',
        privacyRule: s.privacy_rule,
      },
      428
    )
  }

  await c.env.DB.prepare('INSERT INTO analytics_events (id, event_type, user_id, couple_id, meta_json) VALUES (?, ?, ?, ?, ?)')
    .bind(newId('ae'), 'snick_completed', user.id, user.coupleId, JSON.stringify({ snickId: id }))
    .run()

  // SELF_CONFIRMATION -> auto approve immediately.
  // PARTNER_CONFIRMATION / MUTUAL_COMPLETION -> stays PENDING until partner verifies.
  // OPTIONAL_NON_SENSITIVE_EVIDENCE -> auto approve (evidence is optional, non-sensitive, informational only).
  const autoApprove = s.verification_type === 'SELF_CONFIRMATION' || s.verification_type === 'OPTIONAL_NON_SENSITIVE_EVIDENCE'
  const consentGiven = body.consent === true ? 1 : 0

  await c.env.DB
    .prepare(`UPDATE snick_completions SET completed_at = datetime('now'), note = ?, consent_given = ? WHERE id = ?`)
    .bind(body.note ? String(body.note).slice(0, 500) : null, consentGiven, completion.id)
    .run()

  if (!autoApprove) {
    await notifyCouplePartners(
      c.env.DB,
      user.coupleId!,
      user.id,
      'PARTNER_CONFIRMATION_NEEDED',
      'Confirmation needed 🙋',
      `Your partner marked "${s.title}" as done — confirm it to earn XP together!`,
      { snickId: id, completionId: completion.id }
    )
    return c.json({ completionId: completion.id, status: 'PENDING', requiresPartnerConfirmation: true })
  }

  const result = await approveCompletion(c.env.DB, completion.id, s, user.id)
  return c.json({ completionId: completion.id, status: 'APPROVED', requiresPartnerConfirmation: false, result })
})

// ---------- VERIFY (partner confirms / rejects) ----------
snicks.post('/completions/:completionId/verify', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const completionId = c.req.param('completionId')
  const body = await c.req.json().catch(() => ({}))
  const decision = body.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED'

  const completion = await c.env.DB.prepare('SELECT * FROM snick_completions WHERE id = ? AND couple_id = ?').bind(completionId, user.coupleId).first<any>()
  if (!completion) return c.json({ error: 'NotFound' }, 404)
  if (completion.status !== 'PENDING') return c.json({ error: 'Conflict', message: 'This Snick is not awaiting verification' }, 409)
  if (!completion.completed_at) return c.json({ error: 'Conflict', message: 'Snick has not been marked complete yet' }, 409)

  const s = await c.env.DB.prepare('SELECT * FROM snicks WHERE id = ?').bind(completion.snick_id).first<any>()

  // MUTUAL_COMPLETION requires the verifying user to be different from starter — partner confirms mutually
  if (s.verification_type === 'MUTUAL_COMPLETION' && completion.started_by_user_id === user.id) {
    return c.json({ error: 'Forbidden', message: 'The other partner must confirm mutual completion' }, 403)
  }
  if (s.verification_type === 'PARTNER_CONFIRMATION' && completion.started_by_user_id === user.id) {
    return c.json({ error: 'Forbidden', message: 'Your partner must confirm this Snick' }, 403)
  }

  await c.env.DB
    .prepare('INSERT INTO snick_verifications (id, completion_id, verifying_user_id, decision, note) VALUES (?, ?, ?, ?, ?)')
    .bind(newId('ver'), completionId, user.id, decision, body.note ? String(body.note).slice(0, 500) : null)
    .run()

  if (decision === 'REJECTED') {
    await c.env.DB.prepare("UPDATE snick_completions SET status = 'REJECTED', verified_at = datetime('now') WHERE id = ?").bind(completionId).run()
    return c.json({ completionId, status: 'REJECTED' })
  }

  const result = await approveCompletion(c.env.DB, completionId, s, user.id)
  return c.json({ completionId, status: 'APPROVED', result })
})

async function approveCompletion(db: D1Database, completionId: string, snick: any, verifyingUserId: string) {
  const completion = await db.prepare('SELECT * FROM snick_completions WHERE id = ?').bind(completionId).first<any>()
  const result = await awardXp(
    db,
    completion.couple_id,
    snick.xp_reward,
    {
      communication_percentage: snick.communication_percentage,
      emotional_connection_percentage: snick.emotional_connection_percentage,
      efforts_percentage: snick.efforts_percentage,
      trust_percentage: snick.trust_percentage,
    },
    'snick_completion',
    completionId
  )

  await db
    .prepare("UPDATE snick_completions SET status = 'APPROVED', verified_at = datetime('now'), xp_awarded = ? WHERE id = ?")
    .bind(result.xpAwarded, completionId)
    .run()

  await notifyCouplePartners(db, completion.couple_id, verifyingUserId, 'PARTNER_COMPLETED_SNICK', `Snick complete! +${result.xpAwarded} XP 🎉`, `"${snick.title}" is done. Your bond grows stronger!`, {
    snickId: snick.id,
  })

  if (result.leveledUp) {
    await notifyCouplePartners(db, completion.couple_id, null, 'LEVEL_UP', `Level Up! You're now Level ${result.levelAfter} 🏆`, 'Your couple journey keeps getting stronger.')
  }
  for (const ach of result.unlockedAchievements) {
    await notifyCouplePartners(db, completion.couple_id, null, 'ACHIEVEMENT_UNLOCKED', `Achievement Unlocked: ${ach.title} 🌟`, ach.description)
  }

  return result
}

export default snicks
