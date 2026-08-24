import { createMiddleware } from 'hono/factory'
import { verifyJwt } from '../lib/crypto'
import type { AppEnv } from '../lib/types'

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing access token' }, 401)
  }
  const token = header.slice('Bearer '.length)
  const payload = await verifyJwt<{ sub: string; email: string; role: 'user' | 'admin'; coupleId: string | null }>(
    token,
    c.env.JWT_ACCESS_SECRET
  )
  if (!payload) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired access token' }, 401)
  }
  c.set('user', { id: payload.sub, email: payload.email, role: payload.role, coupleId: payload.coupleId })
  await next()
})

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user')
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403)
  }
  await next()
})

export const requireCouple = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user')
  if (!user?.coupleId) {
    return c.json({ error: 'NoCouple', message: 'You must join or create a couple first' }, 409)
  }
  await next()
})
