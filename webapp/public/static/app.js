// ============================================================
// SNICKYLINK — App entry point, router, shell, bottom nav
// ============================================================
import { api, getTokens, clearTokens } from './api.js';
import { state, setState, subscribe, applyTheme, toggleTheme } from './store.js';
import { toast, haptic } from './ui.js';
import { renderAuth } from './screens/auth.js';
import { renderHome } from './screens/home.js';
import { renderChat, renderConversation } from './screens/chat.js';
import { renderSnicks } from './screens/snicks.js';
import { renderLeaderboard } from './screens/leaderboard.js';
import { renderProfile } from './screens/profile.js';
import { renderNotifications } from './screens/notifications.js';

// Bottom nav uses plain line icons (matches the reference mockup's nav bar,
// which carries no special per-item icon-logo — branding lives in the
// "SnickyLink" wordmark alone). The custom snickLogo() SVG mark is kept and
// used only as a small accent next to the Snicks screen's own title.
const NAV_ITEMS = [
  { route: '#/home', icon: 'fa-house', label: 'Home' },
  { route: '#/chat', icon: 'fa-comment-dots', label: 'Chat' },
  { route: '#/snicks', icon: 'fa-gem', label: 'Snicks' },
  { route: '#/leaderboard', icon: 'fa-trophy', label: 'Leaderboard' },
  { route: '#/profile', icon: 'fa-user', label: 'Profile' },
];

const appEl = document.getElementById('app');

function shellHtml(screenHtml, activeRoute) {
  const showNav = !['#/login', '#/register', '#/couple-setup'].includes(baseRoute(activeRoute));
  return `
    <div class="sl-shell">
      <div id="screen-container" class="sl-screen">${screenHtml}</div>
      ${showNav ? bottomNavHtml(activeRoute) : ''}
    </div>
  `;
}

function baseRoute(route) {
  return '#/' + (route.split('/')[1] || 'home');
}

function bottomNavHtml(activeRoute) {
  const active = baseRoute(activeRoute);
  return `
    <nav class="sl-bottom-nav">
      ${NAV_ITEMS.map(
        (item) => `
        <button class="sl-nav-item ${active === item.route ? 'active' : ''}" data-route="${item.route}">
          <i class="fa-solid ${item.icon}"></i>
          <span>${item.label}</span>
        </button>`
      ).join('')}
    </nav>
  `;
}

async function ensureBootstrapped() {
  const { accessToken } = getTokens();
  if (!accessToken) {
    setState({ user: null, couple: null });
    return false;
  }
  try {
    const user = await api.me();
    setState({ user });
    if (user.coupleId) {
      try {
        const couple = await api.myCouple();
        setState({ couple });
      } catch {
        setState({ couple: null });
      }
    } else {
      setState({ couple: null });
    }
    return true;
  } catch {
    clearTokens();
    setState({ user: null, couple: null });
    return false;
  }
}

async function render() {
  const hash = window.location.hash || '#/home';
  const authed = !!state.user;

  // route guards
  if (!authed && !['#/login', '#/register'].includes(baseRoute(hash))) {
    window.location.hash = '#/login';
    return;
  }
  if (authed && !state.user.coupleId && baseRoute(hash) !== '#/couple-setup' && !['#/login', '#/register'].includes(baseRoute(hash))) {
    window.location.hash = '#/couple-setup';
    return;
  }
  if (authed && state.user.coupleId && ['#/login', '#/register', '#/couple-setup'].includes(baseRoute(hash))) {
    window.location.hash = '#/home';
    return;
  }

  let screenHtml = '<div class="sl-loading-spinner"></div>';
  appEl.innerHTML = shellHtml(screenHtml, hash);
  wireGlobalHandlers(hash);

  const container = document.getElementById('screen-container');

  try {
    if (hash.startsWith('#/login')) await renderAuth(container, 'login');
    else if (hash.startsWith('#/register')) await renderAuth(container, 'register');
    else if (hash.startsWith('#/couple-setup')) await renderAuth(container, 'couple-setup');
    else if (hash.startsWith('#/home')) await renderHome(container);
    else if (hash.startsWith('#/chat/')) await renderConversation(container, hash.split('/')[2]);
    else if (hash.startsWith('#/chat')) await renderChat(container);
    else if (hash.startsWith('#/snicks')) await renderSnicks(container);
    else if (hash.startsWith('#/leaderboard')) await renderLeaderboard(container);
    else if (hash.startsWith('#/profile')) await renderProfile(container);
    else if (hash.startsWith('#/notifications')) await renderNotifications(container);
    else container.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-heart-crack"></i>Page not found</div>`;
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${e.message || 'Something went wrong'}</div>`;
  }

  // re-render nav active state after content load (content render may need shell refresh for nav updates)
  const navContainer = document.querySelector('.sl-bottom-nav');
  if (navContainer) navContainer.outerHTML = bottomNavHtml(window.location.hash || '#/home');
  wireNavHandlers();
}

function wireGlobalHandlers() {
  wireNavHandlers();
}

function wireNavHandlers() {
  document.querySelectorAll('.sl-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      window.location.hash = btn.dataset.route;
    });
  });
}

window.addEventListener('hashchange', render);
window.addEventListener('sl:unauthorized', () => {
  toast('Session expired. Please log in again.');
  window.location.hash = '#/login';
});

subscribe(() => {
  // theme changes etc. handled via applyTheme directly
});

export { render, applyTheme, toggleTheme };

// bootstrap
(async () => {
  applyTheme(state.theme);
  await ensureBootstrapped();
  if (!window.location.hash) window.location.hash = state.user ? '#/home' : '#/login';
  render();

  // periodic light "DAU ping" analytics event (privacy-safe, no content)
  if (state.user) {
    api.trackEvent('dau_ping', {});
  }
})();
