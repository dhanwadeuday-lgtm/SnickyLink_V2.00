// ============================================================
// SNICKYLINK small UI helpers: toast, modal sheet, avatar, doodles
// ============================================================

export function toast(msg, duration = 2200) {
  const el = document.createElement('div');
  el.className = 'sl-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function openModal(innerHtml, opts = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'sl-modal-overlay';
  overlay.innerHTML = `<div class="sl-modal-sheet"><div class="sl-modal-handle"></div>${innerHtml}</div>`;
  if (!opts.persistent) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  }
  document.body.appendChild(overlay);
  return overlay;
}

export function closeModal(overlay) {
  if (!overlay) overlay = document.querySelector('.sl-modal-overlay');
  if (overlay) overlay.remove();
}

export function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function avatarHtml(name, size = '') {
  const sizeClass = size ? `sl-avatar-${size}` : '';
  return `<div class="sl-avatar ${sizeClass}">${initials(name)}</div>`;
}

export function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr + 'Z').getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr + 'Z').toLocaleDateString();
}

export function formatTime(dateStr) {
  const d = new Date(dateStr + 'Z');
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function haptic() {
  if (navigator.vibrate) navigator.vibrate(8);
}

// Unique Snicks brand mark — a heart mid-"spark" (mission/quest energy) instead
// of a generic map-pin icon. Uses currentColor so it tints correctly in the
// bottom-nav (active/inactive) and the Snicks screen header on both themes.
export const snickLogo = (size = 22) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="sl-snick-logo">
    <path d="M12 20.2c-.3 0-.6-.1-.8-.3-1.9-1.6-3.6-3.1-4.9-4.5-1.9-2-2.8-3.9-2.8-5.9 0-2.6 2-4.7 4.5-4.7 1.4 0 2.7.7 3.5 1.8l.5.7.5-.7c.8-1.1 2.1-1.8 3.5-1.8 2.5 0 4.5 2.1 4.5 4.7 0 2-.9 3.9-2.8 5.9-1.3 1.4-3 2.9-4.9 4.5-.2.2-.5.3-.8.3z" fill="currentColor"/>
    <path d="M12.5 2.2l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="currentColor"/>
  </svg>
`;

// Small doodle SVGs matching the reference's playful map illustrations
export const doodles = {
  mountain: `<svg width="60" height="34" viewBox="0 0 60 34" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 32L18 8L28 22L36 12L58 32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cloud: `<svg width="46" height="24" viewBox="0 0 46 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 18a7 7 0 010-14 8 8 0 0115 3 6 6 0 01-1 12H12a6 6 0 010-1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sun: `<svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="17" cy="17" r="7" stroke="currentColor" stroke-width="2.2"/><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="17" y1="1" x2="17" y2="5"/><line x1="17" y1="29" x2="17" y2="33"/><line x1="1" y1="17" x2="5" y2="17"/><line x1="29" y1="17" x2="33" y2="17"/><line x1="5.5" y1="5.5" x2="8.3" y2="8.3"/><line x1="25.7" y1="25.7" x2="28.5" y2="28.5"/><line x1="5.5" y1="28.5" x2="8.3" y2="25.7"/><line x1="25.7" y1="8.3" x2="28.5" y2="5.5"/></g></svg>`,
  star: `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10 0l2.35 6.85L20 9l-7.65 2.15L10 20l-2.35-8.85L0 9l7.65-2.15z"/></svg>`,
  tree: `<svg width="26" height="40" viewBox="0 0 26 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L21 18H16L23 30H3L10 18H5L13 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><line x1="13" y1="30" x2="13" y2="38" stroke="currentColor" stroke-width="2"/></svg>`,
};
