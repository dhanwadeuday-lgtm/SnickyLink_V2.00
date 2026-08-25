# SnickyLink deployment fix

The app is a Hono + Cloudflare Pages application. The runtime entry point is
`src/index.tsx`; it is not a conventional React/Vite static SPA.

The Vite build is explicitly configured with:
- `@hono/vite-build/cloudflare-pages`
- entry: `./src/index.tsx`
- output: `./dist`

The root `index.html` is only a static fallback for build environments that
inspect the repository as a conventional Vite project. The Hono renderer in
`src/renderer.tsx` remains the real production HTML shell.

Cloudflare Pages:
- Build command: `npm run build`
- Build output directory: `dist`

After deploying, verify:
- `/api/health`
- `/api/docs`
- `/`
- `/static/style.css`
- `/manifest.json`
