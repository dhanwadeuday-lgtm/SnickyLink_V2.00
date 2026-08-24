import { Hono } from 'hono'
import { newId, hashPassword, verifyPassword, signJwt, verifyJwt, sha256Hex } from '../lib/crypto'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../middleware/auth'

const auth = new Hono<AppEnv>()

const ACCESS_TOKEN_TTL = 60 * 15 // 15 min
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30 // 30 days

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function issueTokens(c: any, userId: string, email: string, role: string, coupleId: string | null) {
  const accessToken = await signJwt({ sub: userId, email, role, coupleId }, c.env.JWT_ACCESS_SECRET, ACCESS_TOKEN_TTL)
  const refreshTokenRaw = newId('rft') + newId('')
  const refreshTokenHash = await sha256Hex(refreshTokenRaw)
  const sessionId = newId('sess')
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000).toISOString()
  await c.env.DB
    .prepare('INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, userId, refreshTokenHash, expiresAt)
    .run()
  return { accessToken, refreshToken: `${sessionId}.${refreshTokenRaw}` }
}

// ---------- REGISTER ----------
auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'BadRequest', message: 'Invalid JSON body' }, 400)
  const { email, password, displayName } = body
  if (!email || !isValidEmail(email)) return c.json({ error: 'ValidationError', message: 'Valid email required' }, 422)
  if (!password || password.length < 8) return c.json({ error: 'ValidationError', message: 'Password must be at least 8 characters' }, 422)
  if (!displayName || displayName.trim().length < 2) return c.json({ error: 'ValidationError', message: 'Display name required' }, 422)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first()
  if (existing) return c.json({ error: 'Conflict', message: 'Email already registered' }, 409)

  const { hash, salt } = await hashPassword(password)
  const userId = newId('usr')
  const avatarSeed = newId('')

  await c.env.DB
    .prepare(
      `INSERT INTO users (id, email, password_hash, password_salt, display_name, avatar_seed, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(userId, email.toLowerCase(), hash, salt, displayName.trim(), avatarSeed)
    .run()

  await c.env.DB.prepare('INSERT INTO notification_preferences (user_id) VALUES (?)').bind(userId).run()

  const { accessToken, refreshToken } = await issueTokens(c, userId, email.toLowerCase(), 'user', null)

  return c.json(
    {
      user: { id: userId, email: email.toLowerCase(), displayName: displayName.trim(), role: 'user', coupleId: null },
      accessToken,
      refreshToken,
    },
    201
  )
})

// ---------- LOGIN ----------
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'BadRequest', message: 'Invalid JSON body' }, 400)
  const { email, password } = body
  if (!email || !password) return c.json({ error: 'ValidationError', message: 'Email and password required' }, 422)

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(String(email).toLowerCase()).first<any>()
  if (!user || user.status !== 'active') return c.json({ error: 'Unauthorized', message: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(password, user.password_hash, user.password_salt)
  if (!valid) return c.json({ error: 'Unauthorized', message: 'Invalid credentials' }, 401)

  const membership = await c.env.DB.prepare('SELECT couple_id FROM couple_members WHERE user_id = ?').bind(user.id).first<any>()
  const coupleId = membership?.couple_id ?? null

  await c.env.DB.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").bind(user.id).run()

  const { accessToken, refreshToken } = await issueTokens(c, user.id, user.email, user.role, coupleId)

  return c.json({
    user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role, coupleId, themePref: user.theme_pref },
    accessToken,
    refreshToken,
  })
})

// ---------- REFRESH ----------
auth.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => null)
  const refreshToken = body?.refreshToken
  if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken.includes('.')) {
    return c.json({ error: 'BadRequest', message: 'Invalid refresh token format' }, 400)
  }
  const [sessionId, raw] = refreshToken.split(/\.(.*)/s)
  const session = await c.env.DB.prepare('SELECT * FROM user_sessions WHERE id = ?').bind(sessionId).first<any>()
  if (!session || session.revoked_at) return c.json({ error: 'Unauthorized', message: 'Session revoked' }, 401)
  if (new Date(session.expires_at).getTime() < Date.now()) return c.json({ error: 'Unauthorized', message: 'Session expired' }, 401)

  const hash = await sha256Hex(raw)
  if (hash !== session.refresh_token_hash) return c.json({ error: 'Unauthorized', message: 'Invalid refresh token' }, 401)

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<any>()
  if (!user || user.status !== 'active') return c.json({ error: 'Unauthorized', message: 'User inactive' }, 401)

  const membership = await c.env.DB.prepare('SELECT couple_id FROM couple_members WHERE user_id = ?').bind(user.id).first<any>()
  const coupleId = membership?.couple_id ?? null

  // rotate: revoke old, issue new
  await c.env.DB.prepare("UPDATE user_sessions SET revoked_at = datetime('now') WHERE id = ?").bind(sessionId).run()
  const { accessToken, refreshToken: newRefresh } = await issueTokens(c, user.id, user.email, user.role, coupleId)

  return c.json({ accessToken, refreshToken: newRefresh })
})

// ---------- LOGOUT ----------
auth.post('/logout', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const refreshToken = body?.refreshToken
  if (refreshToken && typeof refreshToken === 'string' && refreshToken.includes('.')) {
    const [sessionId] = refreshToken.split('.')
    await c.env.DB.prepare("UPDATE user_sessions SET revoked_at = datetime('now') WHERE id = ?").bind(sessionId).run()
  }
  return c.json({ success: true })
})

// ---------- ME ----------
auth.get('/me', requireAuth, async (c) => {
  const authUser = c.get('user')
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(authUser.id).first<any>()
  if (!user) return c.json({ error: 'NotFound' }, 404)
  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarSeed: user.avatar_seed,
    role: user.role,
    themePref: user.theme_pref,
    coupleId: authUser.coupleId,
    createdAt: user.created_at,
  })
})

// ---------- UPDATE THEME PREF / PUBLIC KEY (for E2EE) ----------
auth.patch('/me', requireAuth, async (c) => {
  const authUser = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const updates: string[] = []
  const values: any[] = []
  if (body.themePref && ['light', 'dark', 'system'].includes(body.themePref)) {
    updates.push('theme_pref = ?')
    values.push(body.themePref)
  }
  if (body.displayName && String(body.displayName).trim().length >= 2) {
    updates.push('display_name = ?')
    values.push(String(body.displayName).trim())
  }
  if (body.publicKeyJwk) {
    updates.push('public_key_jwk = ?')
    values.push(JSON.stringify(body.publicKeyJwk))
  }
  if (updates.length === 0) return c.json({ error: 'BadRequest', message: 'No valid fields to update' }, 400)
  updates.push("updated_at = datetime('now')")
  values.push(authUser.id)
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  return c.json({ success: true })
})

export default auth
