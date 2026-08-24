// ============================================================
// SNICKYLINK API client
// ============================================================
const BASE = '/api/v1';

function getTokens() {
  return {
    accessToken: localStorage.getItem('sl_access_token'),
    refreshToken: localStorage.getItem('sl_refresh_token'),
  };
}

function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem('sl_access_token', accessToken);
  if (refreshToken) localStorage.setItem('sl_refresh_token', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('sl_access_token');
  localStorage.removeItem('sl_refresh_token');
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const { refreshToken } = getTokens();
    if (!refreshToken) throw new Error('No refresh token');
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      throw new Error('Refresh failed');
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function request(method, path, body, opts = {}) {
  const { accessToken } = getTokens();
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken && !opts.noAuth) headers['Authorization'] = `Bearer ${accessToken}`;

  const doFetch = async (token) => {
    const h = { ...headers };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE}${path}`, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch(accessToken);

  if (res.status === 401 && !opts.noAuth && getTokens().refreshToken) {
    try {
      const newToken = await refreshAccessToken();
      res = await doFetch(newToken);
    } catch {
      clearTokens();
      window.dispatchEvent(new CustomEvent('sl:unauthorized'));
    }
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // auth
  register: (body) => request('POST', '/auth/register', body, { noAuth: true }),
  login: (body) => request('POST', '/auth/login', body, { noAuth: true }),
  logout: (refreshToken) => request('POST', '/auth/logout', { refreshToken }),
  me: () => request('GET', '/auth/me'),
  updateMe: (body) => request('PATCH', '/auth/me', body),

  // couples
  createCouple: (body) => request('POST', '/couples', body),
  joinCouple: (code) => request('POST', '/couples/join', { code }),
  newInvite: () => request('POST', '/couples/invites'),
  myCouple: () => request('GET', '/couples/me'),
  updateCouple: (body) => request('PATCH', '/couples/me', body),

  // snicks
  getTodaysMission: () => request('GET', '/snicks/today'),
  listSnicks: (frequency) => request('GET', `/snicks?frequency=${frequency}`),
  getSnick: (id) => request('GET', `/snicks/${id}`),
  startSnick: (id) => request('POST', `/snicks/${id}/start`),
  completeSnick: (id, opts = {}) => request('POST', `/snicks/${id}/complete`, opts),
  verifyCompletion: (completionId, decision, note) =>
    request('POST', `/snicks/completions/${completionId}/verify`, { decision, note }),

  // chat
  getConversations: () => request('GET', '/chat/conversations'),
  getMessages: (convId, before) => request('GET', `/chat/conversations/${convId}/messages${before ? `?before=${before}` : ''}`),
  sendMessage: (convId, ciphertext, iv) => request('POST', `/chat/conversations/${convId}/messages`, { ciphertext, iv }),
  markRead: (convId) => request('POST', `/chat/conversations/${convId}/read`),
  setDisappearing: (convId, seconds) => request('PATCH', `/chat/conversations/${convId}`, { disappearingSeconds: seconds }),

  // community
  listPosts: (sort) => request('GET', `/community/posts?sort=${sort || 'popular'}`),
  createPost: (content, imageMeta) => request('POST', '/community/posts', { content, ...(imageMeta || {}) }),
  uploadPostImage: async (file) => {
    const { accessToken } = getTokens();
    const res = await fetch(`${BASE}/community/media`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: file,
    });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error(data?.message || data?.error || `Upload failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
  deletePost: (id) => request('DELETE', `/community/posts/${id}`),
  likePost: (id) => request('POST', `/community/posts/${id}/like`),
  savePost: (id) => request('POST', `/community/posts/${id}/save`),
  getComments: (id) => request('GET', `/community/posts/${id}/comments`),
  addComment: (id, content) => request('POST', `/community/posts/${id}/comments`, { content }),
  reportContent: (targetType, targetId, reason) => request('POST', '/community/reports', { targetType, targetId, reason }),

  // leaderboard
  getLeaderboard: (scope) => request('GET', `/leaderboard?scope=${scope}`),
  getLeagues: () => request('GET', '/leaderboard/leagues'),
  getRewards: () => request('GET', '/leaderboard/rewards'),

  // profile
  getPillars: () => request('GET', '/profile/pillars'),
  getStats: () => request('GET', '/profile/stats'),
  getAchievements: () => request('GET', '/profile/achievements'),

  // notifications
  getNotifications: () => request('GET', '/notifications'),
  markNotificationRead: (id) => request('POST', `/notifications/${id}/read`),
  markAllRead: () => request('POST', '/notifications/read-all'),

  // analytics
  trackEvent: (eventType, meta) => request('POST', '/analytics/events', { eventType, meta }).catch(() => {}),
};

export { getTokens, setTokens, clearTokens };
