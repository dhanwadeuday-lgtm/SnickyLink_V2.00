import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0" />
        <meta name="theme-color" content="#9F6750" />
        <meta name="description" content="SnickyLink — a gamified relationship platform for couples. Complete Snicks, earn XP, build streaks, grow your bond." />
        <title>SnickyLink — For Couples. Built on Fun, Trust & Little Things.</title>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/static/img/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/static/img/icon-192.png" />

        {/* Fonts: elegant high-contrast italic serif (Playfair Display) for the
            SnickyLink wordmark/branding, rounded friendly sans (Nunito) for body text */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,600;1,700;1,800&family=Nunito:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body>
        {children}
        <script src="/static/app.js" type="module"></script>
      </body>
    </html>
  )
})
