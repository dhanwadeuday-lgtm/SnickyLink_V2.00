import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'
import type { AppEnv } from './lib/types'

import authRoutes from './routes/auth'
import couplesRoutes from './routes/couples'
import snicksRoutes from './routes/snicks'
import chatRoutes from './routes/chat'
import communityRoutes from './routes/community'
import leaderboardRoutes from './routes/leaderboard'
import profileRoutes from './routes/profile'
import notificationsRoutes from './routes/notifications'
import adminRoutes from './routes/admin'
import analyticsRoutes from './routes/analytics'

const app = new Hono<AppEnv>()

// ---------- Global middleware ----------
app.use('/api/*', cors())
app.use('/api/*', async (c, next) => {
  // basic security headers
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'no-referrer')
})

// simple in-memory-per-request rate limit guard placeholder is not persistent on Workers;
// real throttling should be added via Cloudflare's built-in rate limiting rules on the zone.

// ---------- API v1 ----------
const v1 = new Hono<AppEnv>()
v1.route('/auth', authRoutes)
v1.route('/couples', couplesRoutes)
v1.route('/snicks', snicksRoutes)
v1.route('/chat', chatRoutes)
v1.route('/community', communityRoutes)
v1.route('/leaderboard', leaderboardRoutes)
v1.route('/profile', profileRoutes)
v1.route('/notifications', notificationsRoutes)
v1.route('/admin', adminRoutes)
v1.route('/analytics', analyticsRoutes)

app.route('/api/v1', v1)

// ---------- OpenAPI / Swagger doc (static JSON served + Swagger UI via CDN) ----------
app.get('/api/v1/openapi.json', async (c) => {
  const { openApiSpec } = await import('./lib/openapi')
  return c.json(openApiSpec)
})

app.get('/api/docs', (c) => {
  return c.html(`<!DOCTYPE html>
<html><head><title>SnickyLink API Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
window.onload = () => { window.ui = SwaggerUIBundle({ url: '/api/v1/openapi.json', dom_id: '#swagger-ui' }); };
</script>
</body></html>`)
})

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'snickylink-api', time: new Date().toISOString() }))

// ---------- Static assets ----------
app.use('/static/*', serveStatic({ root: './public' }))
app.use('/manifest.json', serveStatic({ path: './public/manifest.json' }))
app.use('/sw.js', serveStatic({ path: './public/sw.js' }))

// ---------- SPA shell (catch-all, must be last) ----------
app.use(renderer)
app.get('*', (c) => {
  return c.render(<div id="app">Loading SnickyLink…</div>)
})

export default app
