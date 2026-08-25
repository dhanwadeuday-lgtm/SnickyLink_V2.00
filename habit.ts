// ============================================================
// SNICKYLINK — Habit-formation scheduling algorithm
// Implements docs/habit-algorithm.md section 2 (Atomic Habits-informed
// Daily rotation + Weekly/Monthly consistency-gated unlocks).
// Pure functions where possible so this is easy to unit-reason-about.
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000

/** Small deterministic string hash (djb2), stable across requests/runtimes. */
function hashString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return Math.abs(hash >>> 0)
}

export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export type PillarKey = 'communication' | 'emotional' | 'efforts' | 'trust'

/**
 * §2.1 — Pick today's single Daily Snick for this couple.
 * Deterministic per (coupleId, date): same inputs always return the same Snick,
 * so this is safe to call from multiple endpoints/re-renders without side effects.
 *
 * Rules:
 *  - Never repeat a Snick the couple completed in the last 14 days (spaced repetition
 *    keeps the daily cue/ritual feeling fresh instead of robotic).
 *  - Prefer Snicks whose dominant pillar matches whichever of the four pillars this
 *    couple has earned the LEAST xp in over the trailing 7 days (keeps the relationship
 *    well-rounded instead of over-training one pillar).
 *  - Falls back to the full Daily pool if the above filters leave nothing.
 */
export function pickTodaysDaily(
  coupleId: string,
  allDaily: Array<{
    id: string
    communication_percentage: number
    emotional_connection_percentage: number
    efforts_percentage: number
    trust_percentage: number
  }>,
  recentlyCompletedIds: Set<string>,
  pillarDeficit: PillarKey | null
): { id: string } | null {
  if (allDaily.length === 0) return null

  const todayKey = hashString(`${coupleId}:${todayUtcDate()}`)

  const notRecent = allDaily.filter((s) => !recentlyCompletedIds.has(s.id))
  const pool = notRecent.length > 0 ? notRecent : allDaily

  let candidates = pool
  if (pillarDeficit) {
    const dominantMatches = pool.filter((s) => dominantPillar(s) === pillarDeficit)
    if (dominantMatches.length > 0) candidates = dominantMatches
  }

  const chosen = candidates[todayKey % candidates.length]
  return chosen ? { id: chosen.id } : null
}

function dominantPillar(s: {
  communication_percentage: number
  emotional_connection_percentage: number
  efforts_percentage: number
  trust_percentage: number
}): PillarKey {
  const entries: [PillarKey, number][] = [
    ['communication', s.communication_percentage],
    ['emotional', s.emotional_connection_percentage],
    ['efforts', s.efforts_percentage],
    ['trust', s.trust_percentage],
  ]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

/** Find which pillar this couple has earned the least XP in over the trailing 7 days. */
export function computePillarDeficit(
  xpEventsLast7Days: Array<{ communication_amount: number; emotional_amount: number; efforts_amount: number; trust_amount: number }>
): PillarKey | null {
  if (xpEventsLast7Days.length === 0) return null
  const totals: Record<PillarKey, number> = { communication: 0, emotional: 0, efforts: 0, trust: 0 }
  for (const e of xpEventsLast7Days) {
    totals.communication += e.communication_amount
    totals.emotional += e.emotional_amount
    totals.efforts += e.efforts_amount
    totals.trust += e.trust_amount
  }
  let minKey: PillarKey = 'communication'
  let minVal = totals.communication
  for (const k of Object.keys(totals) as PillarKey[]) {
    if (totals[k] < minVal) {
      minVal = totals[k]
      minKey = k
    }
  }
  return minKey
}

// ---------- §2.2 / §2.3 — Tier unlock thresholds ----------
export const HABIT_THRESHOLDS = {
  /** Streak (days) required before the FIRST Weekly Snick unlocks. */
  WEEKLY_UNLOCK_STREAK: 6,
  /** Streak (days) required (in addition to weekly count) before Monthly unlocks. */
  MONTHLY_UNLOCK_STREAK: 14,
  /** Number of approved Weeklies required before Monthly unlocks. */
  MONTHLY_UNLOCK_WEEKLY_COUNT: 2,
}

export type TierGateResult = {
  unlocked: boolean
  reason: string
  progress: { current: number; required: number; label: string }
}

/** §2.2 — Is the Weekly tier unlocked for this couple right now? */
export function evaluateWeeklyGate(streakCount: number): TierGateResult {
  const required = HABIT_THRESHOLDS.WEEKLY_UNLOCK_STREAK
  const unlocked = streakCount >= required
  return {
    unlocked,
    reason: unlocked
      ? 'Unlocked — your daily streak has built the habit foundation for a bigger Snick.'
      : `Keep your daily streak alive! Weekly Snicks unlock at a ${required}-day streak (Atomic Habits: a habit needs about a week of repetition before layering something bigger).`,
    progress: { current: Math.min(streakCount, required), required, label: 'day streak' },
  }
}

/** §2.3 — Is the Monthly tier unlocked for this couple right now? */
export function evaluateMonthlyGate(streakCount: number, approvedWeeklyCount: number): TierGateResult {
  const reqStreak = HABIT_THRESHOLDS.MONTHLY_UNLOCK_STREAK
  const reqWeekly = HABIT_THRESHOLDS.MONTHLY_UNLOCK_WEEKLY_COUNT
  const unlocked = streakCount >= reqStreak && approvedWeeklyCount >= reqWeekly
  const streakOk = streakCount >= reqStreak
  const weeklyOk = approvedWeeklyCount >= reqWeekly
  let reason: string
  if (unlocked) {
    reason = 'Unlocked — sustained weekly commitment + a strong streak means you\'re ready for a bigger challenge.'
  } else if (!streakOk && !weeklyOk) {
    reason = `Complete ${reqWeekly} Weekly Snicks and reach a ${reqStreak}-day streak to unlock Monthly.`
  } else if (!streakOk) {
    reason = `Reach a ${reqStreak}-day streak to unlock Monthly (you've completed enough Weeklies already).`
  } else {
    reason = `Complete ${reqWeekly} Weekly Snicks to unlock Monthly (your streak is strong enough already).`
  }
  return {
    unlocked,
    reason,
    progress: { current: Math.min(approvedWeeklyCount, reqWeekly), required: reqWeekly, label: 'Weeklies completed' },
  }
}
