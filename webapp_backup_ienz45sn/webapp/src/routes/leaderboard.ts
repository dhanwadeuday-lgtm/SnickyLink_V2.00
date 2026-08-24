import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { requireAuth, requireCouple } from '../middleware/auth'

const leaderboard = new Hono<AppEnv>()

// ---------- LEADERBOARD (city / country scope) ----------
leaderboard.get('/', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const scope = c.req.query('scope') === 'country' ? 'country' : 'city'

  const myCouple = await c.env.DB.prepare('SELECT * FROM couples WHERE id = ?').bind(user.coupleId).first<any>()

  let query = `SELECT id, nickname, avatar_seed, xp_total, level, city, country, league_id FROM couples WHERE status = 'active'`
  const params: any[] = []
  if (scope === 'city' && myCouple?.city) {
    query += ' AND city = ?'
    params.push(myCouple.city)
  } else if (scope === 'country' && myCouple?.country) {
    query += ' AND country = ?'
    params.push(myCouple.country)
  }
  query += ' ORDER BY xp_total DESC LIMIT 50'

  const rows = await c.env.DB.prepare(query).bind(...params).all<any>()
  const ranked = (rows.results ?? []).map((r: any, idx: number) => ({
    rank: idx + 1,
    coupleId: r.id,
    nickname: r.nickname,
    avatarSeed: r.avatar_seed,
    xpTotal: r.xp_total,
    level: r.level,
    isMine: r.id === user.coupleId,
  }))

  const myRank = ranked.find((r) => r.isMine)?.rank ?? null

  const league = myCouple?.league_id ? await c.env.DB.prepare('SELECT * FROM leagues WHERE id = ?').bind(myCouple.league_id).first<any>() : null

  return c.json({
    scope,
    location: scope === 'city' ? myCouple?.city : myCouple?.country,
    entries: ranked,
    myRank,
    myLeague: league ? { id: league.id, name: league.name, iconKey: league.icon_key } : null,
  })
})

// ---------- LEAGUES ----------
leaderboard.get('/leagues', requireAuth, async (c) => {
  const leagues = await c.env.DB.prepare('SELECT * FROM leagues ORDER BY order_index ASC').all<any>()
  return c.json({
    leagues: (leagues.results ?? []).map((l: any) => ({ id: l.id, name: l.name, minXp: l.min_xp, iconKey: l.icon_key })),
  })
})

// ---------- REWARDS ----------
leaderboard.get('/rewards', requireAuth, requireCouple, async (c) => {
  const user = c.get('user')
  const couple = await c.env.DB.prepare('SELECT xp_total FROM couples WHERE id = ?').bind(user.coupleId).first<any>()
  const rewards = await c.env.DB.prepare('SELECT * FROM rewards WHERE active = 1 ORDER BY unlock_xp ASC').all<any>()
  return c.json({
    rewards: (rewards.results ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      iconKey: r.icon_key,
      unlockXp: r.unlock_xp,
      unlocked: couple.xp_total >= r.unlock_xp,
    })),
  })
})

export default leaderboard
