// ============================================================
// SNICKYLINK — Notifications screen
// ============================================================
import { api } from '../api.js';
import { escapeHtml, timeAgo } from '../ui.js';

const TYPE_ICON = {
  NEW_SNICK: 'fa-map-location-dot',
  PARTNER_COMPLETED_SNICK: 'fa-check-circle',
  PARTNER_CONFIRMATION_NEEDED: 'fa-hand',
  STREAK_WARNING: 'fa-fire',
  ACHIEVEMENT_UNLOCKED: 'fa-medal',
  LEVEL_UP: 'fa-trophy',
  LEADERBOARD_CHANGE: 'fa-ranking-star',
  COUPLE_INVITE: 'fa-heart',
  REWARD_UNLOCKED: 'fa-gift',
};

export async function renderNotifications(container) {
  container.innerHTML = `
    <div class="sl-header">
      <button class="sl-icon-btn" id="back-btn"><i class="fa-solid fa-arrow-left"></i></button>
      <div style="font-weight:800;font-size:17px;">Notifications</div>
      <button class="sl-icon-btn" id="read-all-btn"><i class="fa-solid fa-check-double"></i></button>
    </div>
    <div id="notif-list"><div class="sl-loading-spinner"></div></div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => (window.location.hash = '#/home'));
  document.getElementById('read-all-btn').addEventListener('click', async () => {
    await api.markAllRead();
    load();
  });

  async function load() {
    const listEl = document.getElementById('notif-list');
    try {
      const data = await api.getNotifications();
      if (!data.notifications.length) {
        listEl.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-bell-slash"></i>No notifications yet.</div>`;
        return;
      }
      listEl.innerHTML = data.notifications
        .map(
          (n) => `
        <div class="sl-post-card" style="padding:14px;${n.read ? 'opacity:0.6;' : ''}" data-id="${n.id}">
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <div class="sl-pillar-icon" style="flex-shrink:0;"><i class="fa-solid ${TYPE_ICON[n.type] || 'fa-bell'}"></i></div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:13.5px;">${escapeHtml(n.title)}</div>
              <div style="font-size:12.5px;color:var(--sl-text-muted);margin-top:2px;">${escapeHtml(n.body)}</div>
              <div style="font-size:10.5px;color:var(--sl-text-muted);margin-top:6px;">${timeAgo(n.createdAt)} ago</div>
            </div>
          </div>
        </div>
      `
        )
        .join('');

      listEl.querySelectorAll('.sl-post-card').forEach((el) => {
        el.addEventListener('click', async () => {
          await api.markNotificationRead(el.dataset.id);
          el.style.opacity = '0.6';
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${e.message}</div>`;
    }
  }

  await load();
}
