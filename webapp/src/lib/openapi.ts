// Minimal hand-written OpenAPI 3.0 spec covering the SnickyLink v1 API surface.
// Served at /api/v1/openapi.json and rendered via Swagger UI at /api/docs.
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SnickyLink API',
    version: '1.0.0',
    description:
      'Gamified relationship platform for couples. REST API for auth, couples, snicks (missions), XP/pillars/levels/streaks, chat (E2EE), community, leaderboards, notifications, and admin.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': { post: { summary: 'Register a new user', security: [], tags: ['Auth'] } },
    '/auth/login': { post: { summary: 'Login with email + password', security: [], tags: ['Auth'] } },
    '/auth/refresh': { post: { summary: 'Rotate refresh token for new access token', security: [], tags: ['Auth'] } },
    '/auth/logout': { post: { summary: 'Revoke current session', tags: ['Auth'] } },
    '/auth/me': { get: { summary: 'Get current user', tags: ['Auth'] }, patch: { summary: 'Update profile / theme / E2EE public key', tags: ['Auth'] } },

    '/couples': { post: { summary: 'Create a couple', tags: ['Couples'] } },
    '/couples/invites': { post: { summary: 'Generate new invite code', tags: ['Couples'] } },
    '/couples/join': { post: { summary: 'Join a couple via invite code', tags: ['Couples'] } },
    '/couples/me': { get: { summary: 'Get my couple details', tags: ['Couples'] }, patch: { summary: 'Update couple nickname/tagline/location', tags: ['Couples'] } },

    '/snicks': { get: { summary: 'List Snicks journey map by frequency', tags: ['Snicks'] } },
    '/snicks/{id}': { get: { summary: 'Get Snick detail', tags: ['Snicks'] } },
    '/snicks/{id}/start': { post: { summary: 'Start a Snick', tags: ['Snicks'] } },
    '/snicks/{id}/complete': { post: { summary: 'Mark Snick as completed', tags: ['Snicks'] } },
    '/snicks/completions/{completionId}/verify': { post: { summary: 'Partner verifies a completion', tags: ['Snicks'] } },

    '/chat/conversations': { get: { summary: 'Get my couple conversation summary', tags: ['Chat (E2EE)'] } },
    '/chat/conversations/{id}/messages': {
      get: { summary: 'List ciphertext messages (server never decrypts)', tags: ['Chat (E2EE)'] },
      post: { summary: 'Send an E2EE encrypted message (ciphertext + iv only)', tags: ['Chat (E2EE)'] },
    },
    '/chat/conversations/{id}/read': { post: { summary: 'Mark conversation read', tags: ['Chat (E2EE)'] } },
    '/chat/conversations/{id}': { patch: { summary: 'Set disappearing message duration', tags: ['Chat (E2EE)'] } },

    '/community/posts': { get: { summary: 'List community feed', tags: ['Community'] }, post: { summary: 'Create post', tags: ['Community'] } },
    '/community/posts/{id}/like': { post: { summary: 'Like/unlike a post', tags: ['Community'] } },
    '/community/posts/{id}/save': { post: { summary: 'Save/unsave a post', tags: ['Community'] } },
    '/community/posts/{id}/comments': { get: { summary: 'List comments', tags: ['Community'] }, post: { summary: 'Add comment', tags: ['Community'] } },
    '/community/reports': { post: { summary: 'Report content', tags: ['Community'] } },
    '/community/blocks': { post: { summary: 'Block a user', tags: ['Community'] } },

    '/leaderboard': { get: { summary: 'Get city/country leaderboard', tags: ['Leaderboard'] } },
    '/leaderboard/leagues': { get: { summary: 'List leagues', tags: ['Leaderboard'] } },
    '/leaderboard/rewards': { get: { summary: 'List rewards with unlock status', tags: ['Leaderboard'] } },

    '/profile/pillars': { get: { summary: 'Get four-pillar detail', tags: ['Profile'] } },
    '/profile/stats': { get: { summary: 'Get Snick stats', tags: ['Profile'] } },
    '/profile/achievements': { get: { summary: 'List achievements with unlock status', tags: ['Profile'] } },

    '/notifications': { get: { summary: 'List notifications', tags: ['Notifications'] } },
    '/notifications/{id}/read': { post: { summary: 'Mark notification read', tags: ['Notifications'] } },
    '/notifications/read-all': { post: { summary: 'Mark all read', tags: ['Notifications'] } },
    '/notifications/preferences': { get: { summary: 'Get preferences', tags: ['Notifications'] }, patch: { summary: 'Update preferences', tags: ['Notifications'] } },
    '/notifications/devices': { post: { summary: 'Register push device token', tags: ['Notifications'] } },

    '/admin/users': { get: { summary: '[Admin] List users', tags: ['Admin'] } },
    '/admin/couples': { get: { summary: '[Admin] List couples', tags: ['Admin'] } },
    '/admin/snicks': { get: { summary: '[Admin] List Snicks', tags: ['Admin'] }, post: { summary: '[Admin] Create Snick', tags: ['Admin'] } },
    '/admin/snicks/{id}': { patch: { summary: '[Admin] Update Snick', tags: ['Admin'] }, delete: { summary: '[Admin] Deactivate Snick', tags: ['Admin'] } },
    '/admin/achievements': { get: { summary: '[Admin] List achievements', tags: ['Admin'] }, post: { summary: '[Admin] Create achievement', tags: ['Admin'] } },
    '/admin/leagues': { get: { summary: '[Admin] List leagues', tags: ['Admin'] }, post: { summary: '[Admin] Create league', tags: ['Admin'] } },
    '/admin/rewards': { get: { summary: '[Admin] List rewards', tags: ['Admin'] }, post: { summary: '[Admin] Create reward', tags: ['Admin'] } },
    '/admin/reports': { get: { summary: '[Admin] List open reports', tags: ['Admin'] } },
    '/admin/reports/{id}': { patch: { summary: '[Admin] Moderate report', tags: ['Admin'] } },
    '/admin/analytics/summary': { get: { summary: '[Admin] Privacy-conscious product analytics', tags: ['Admin'] } },
    '/admin/audit-logs': { get: { summary: '[Admin] View audit log', tags: ['Admin'] } },

    '/analytics/events': { post: { summary: 'Track privacy-safe client event', tags: ['Analytics'] } },
  },
}
