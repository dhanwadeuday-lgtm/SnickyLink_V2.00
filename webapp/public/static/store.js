// ============================================================
// SNICKYLINK lightweight state store (pub-sub, no framework)
// ============================================================
const listeners = new Set();

export const state = {
  user: null,
  couple: null,
  theme: localStorage.getItem('sl_theme') || 'light',
  route: '#/home',
};

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem('sl_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// initialize theme on load
applyTheme(state.theme);
