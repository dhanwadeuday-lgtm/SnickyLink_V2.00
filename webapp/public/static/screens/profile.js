// ============================================================
// SNICKYLINK — Screen 5: Profile
// ============================================================
import { api, clearTokens } from '../api.js';
import { state, setState, toggleTheme } from '../store.js';
import { openModal, closeModal, toast, escapeHtml, initials } from '../ui.js';

const PILLAR_META = {
  communication: { label: 'Communication', icon: 'fa-comment-dots' },
  emotionalConnection: { label: 'Emotional Connection', icon: 'fa-heart' },
  efforts: { label: 'Efforts', icon: 'fa-hand-fist' },
  trust: { label: 'Trust', icon: 'fa-shield-heart' },
};

export async function renderProfile(container) {
  container.innerHTML = `
    <div class="sl-header">
      <div class="sl-profile-title" style="margin:0;">Profile</div>
      <button class="sl-icon-btn" id="settings-btn"><i class="fa-solid fa-gear"></i></button>
    </div>

    <div id="profile-card"><div class="sl-loading-spinner"></div></div>

    <div class="sl-section-row">
      <div class="sl-section-title">Our 4 Pillars</div>
      <button class="sl-section-link" id="pillars-detail-btn">View Details</button>
    </div>
    <div class="sl-pillars-grid" id="pillars-grid"></div>

    <div class="sl-settings-list">
      <div class="sl-settings-item" id="stats-item"><i class="fa-solid fa-chart-simple leading"></i><span>Snick Stats</span><i class="fa-solid fa-chevron-right chevron"></i></div>
      <div class="sl-settings-item" id="achievements-item"><i class="fa-solid fa-medal leading"></i><span>Achievements</span><i class="fa-solid fa-chevron-right chevron"></i></div>
      <div class="sl-settings-item" id="settings-item"><i class="fa-solid fa-gear leading"></i><span>Settings</span><i class="fa-solid fa-chevron-right chevron"></i></div>
      <div class="sl-settings-item" id="help-item"><i class="fa-solid fa-circle-question leading"></i><span>Help &amp; Support</span><i class="fa-solid fa-chevron-right chevron"></i></div>
    </div>
  `;

  document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
  document.getElementById('stats-item').addEventListener('click', openStatsModal);
  document.getElementById('achievements-item').addEventListener('click', openAchievementsModal);
  document.getElementById('settings-item').addEventListener('click', openSettingsModal);
  document.getElementById('help-item').addEventListener('click', () => {
    openModal(`
      <h3 style="margin-bottom:10px;">Help &amp; Support</h3>
      <p style="font-size:13.5px;color:var(--sl-text-muted);line-height:1.6;">
        Need help? Reach us anytime at <b>support@snickylink.app</b>.<br/><br/>
        SnickyLink is privacy-first: your private chats are end-to-end encrypted and never
        readable by our team, even for support requests.
      </p>
      <button class="sl-btn sl-btn-primary sl-btn-block" style="margin-top:16px;" onclick="this.closest('.sl-modal-overlay').remove()">Close</button>
    `);
  });
  document.getElementById('pillars-detail-btn').addEventListener('click', openPillarsDetailModal);

  await Promise.all([loadProfileCard(), loadPillarsGrid()]);
}

async function loadProfileCard() {
  const el = document.getElementById('profile-card');
  try {
    const couple = await api.myCouple();
    setState({ couple });
    const xpForCurrentLevel = 500 * couple.level * (couple.level - 1);
    const xpForNextLevel = 500 * (couple.level + 1) * couple.level;
    const currentXp = couple.xpTotal - xpForCurrentLevel;
    const neededXp = xpForNextLevel - xpForCurrentLevel;
    const pct = Math.min(100, Math.round((currentXp / neededXp) * 100));

    el.innerHTML = `
      <div class="sl-profile-card">
        <div class="sl-couple-avatars">
          ${couple.members.map((m) => `<div class="sl-avatar sl-avatar-lg">${initials(m.displayName)}</div>`).join('')}
        </div>
        <div class="sl-profile-name">${escapeHtml(couple.nickname)} <i class="fa-solid fa-pen" style="font-size:14px;cursor:pointer;" id="edit-nickname-btn"></i></div>
        <div class="sl-profile-tagline">${escapeHtml(couple.tagline)} 💕</div>
        <div class="sl-level-badge">Level ${couple.level}</div>
        <div class="sl-xp-bar-track"><div class="sl-xp-bar-fill" style="width:${pct}%;"></div></div>
        <div class="sl-xp-text">${couple.xpTotal.toLocaleString()} / ${xpForNextLevel.toLocaleString()} XP · 🔥 ${couple.streakCount} day streak</div>
      </div>
    `;

    document.getElementById('edit-nickname-btn').addEventListener('click', () => openEditNicknameModal(couple));
  } catch (e) {
    el.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${e.message}</div>`;
  }
}

function openEditNicknameModal(couple) {
  const overlay = openModal(`
    <h3 style="margin-bottom:14px;">Edit Couple Info</h3>
    <div class="sl-field">
      <label>Nickname</label>
      <input type="text" id="edit-nickname" value="${escapeHtml(couple.nickname)}" />
    </div>
    <div class="sl-field">
      <label>Tagline</label>
      <input type="text" id="edit-tagline" value="${escapeHtml(couple.tagline)}" />
    </div>
    <button class="sl-btn sl-btn-primary sl-btn-block" id="save-btn">Save</button>
  `);
  document.getElementById('save-btn').addEventListener('click', async () => {
    try {
      await api.updateCouple({
        nickname: document.getElementById('edit-nickname').value.trim(),
        tagline: document.getElementById('edit-tagline').value.trim(),
      });
      closeModal(overlay);
      toast('Updated!');
      loadProfileCard();
    } catch (e) {
      toast(e.message);
    }
  });
}

async function loadPillarsGrid() {
  const grid = document.getElementById('pillars-grid');
  try {
    const pillars = await api.getPillars();
    grid.innerHTML = Object.entries(PILLAR_META)
      .map(([key, meta]) => {
        const p = pillars[key];
        return `
        <div class="sl-pillar-card">
          <div class="sl-pillar-icon"><i class="fa-solid ${meta.icon}"></i></div>
          <div class="sl-pillar-name">${meta.label}</div>
          <div class="sl-pillar-level">Lv. ${p.level}</div>
          <div class="sl-pillar-bar-track"><div class="sl-pillar-bar-fill" style="width:${p.percentage}%;"></div></div>
          <div class="sl-pillar-pct">${p.percentage}%</div>
        </div>
      `;
      })
      .join('');
  } catch (e) {
    grid.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${e.message}</div>`;
  }
}

async function openPillarsDetailModal() {
  const pillars = await api.getPillars();
  openModal(`
    <h3 style="margin-bottom:6px;">Our 4 Pillars</h3>
    <p style="font-size:12px;color:var(--sl-text-muted);margin-bottom:16px;">
      These are gameplay stats that grow as you complete Snicks together — not clinical scores.
    </p>
    ${Object.entries(PILLAR_META)
      .map(([key, meta]) => {
        const p = pillars[key];
        return `
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:700;font-size:13.5px;"><i class="fa-solid ${meta.icon}" style="color:var(--sl-primary);margin-right:6px;"></i>${meta.label}</span>
            <span style="font-size:12px;color:var(--sl-text-muted);">Lv. ${p.level} · ${p.percentage}%</span>
          </div>
          <div class="sl-pillar-bar-track"><div class="sl-pillar-bar-fill" style="width:${p.percentage}%;"></div></div>
        </div>
      `;
      })
      .join('')}
    <button class="sl-btn sl-btn-primary sl-btn-block" onclick="this.closest('.sl-modal-overlay').remove()">Close</button>
  `);
}

async function openStatsModal() {
  const stats = await api.getStats();
  openModal(`
    <h3 style="margin-bottom:14px;">Snick Stats</h3>
    <div class="sl-card-flat">
      <div class="sl-detail-row"><span class="sl-detail-label">Total Snicks Completed</span><span class="sl-detail-value">${stats.totalSnicksCompleted}</span></div>
      <div class="sl-detail-row"><span class="sl-detail-label">Current Streak</span><span class="sl-detail-value">🔥 ${stats.streakCount} days</span></div>
      <div class="sl-detail-row"><span class="sl-detail-label">Longest Streak</span><span class="sl-detail-value">${stats.longestStreak} days</span></div>
      <div class="sl-detail-row"><span class="sl-detail-label">Daily Snicks Done</span><span class="sl-detail-value">${stats.byFrequency.DAILY || 0}</span></div>
      <div class="sl-detail-row"><span class="sl-detail-label">Weekly Snicks Done</span><span class="sl-detail-value">${stats.byFrequency.WEEKLY || 0}</span></div>
      <div class="sl-detail-row"><span class="sl-detail-label">Monthly Snicks Done</span><span class="sl-detail-value">${stats.byFrequency.MONTHLY || 0}</span></div>
    </div>
  `);
}

async function openAchievementsModal() {
  const data = await api.getAchievements();
  openModal(`
    <h3 style="margin-bottom:14px;">Achievements</h3>
    <div style="max-height:50vh;overflow-y:auto;">
      ${data.achievements
        .map(
          (a) => `
        <div class="sl-settings-item" style="opacity:${a.unlocked ? 1 : 0.45};">
          <i class="fa-solid fa-${a.iconKey} leading"></i>
          <div>
            <div style="font-weight:700;font-size:13px;">${escapeHtml(a.title)}</div>
            <div style="font-size:11px;color:var(--sl-text-muted);">${escapeHtml(a.description)}</div>
          </div>
          ${a.unlocked ? '<i class="fa-solid fa-check" style="color:var(--sl-success);margin-left:auto;"></i>' : '<i class="fa-solid fa-lock chevron" style="margin-left:auto;"></i>'}
        </div>
      `
        )
        .join('')}
    </div>
  `);
}

function openSettingsModal() {
  const overlay = openModal(`
    <h3 style="margin-bottom:14px;">Settings</h3>
    <div class="sl-settings-list" style="margin-bottom:16px;">
      <div class="sl-settings-item" id="theme-toggle-item">
        <i class="fa-solid fa-circle-half-stroke leading"></i>
        <span>Dark Mode</span>
        <span style="color:var(--sl-text-muted);font-size:12px;">${state.theme === 'dark' ? 'On' : 'Off'}</span>
      </div>
    </div>
    <button class="sl-btn sl-btn-outline sl-btn-block" id="logout-btn" style="border-color:var(--sl-danger);color:var(--sl-danger);">Log Out</button>
  `);
  document.getElementById('theme-toggle-item').addEventListener('click', () => {
    toggleTheme();
    closeModal(overlay);
  });
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearTokens();
    closeModal(overlay);
    window.location.href = window.location.pathname;
  });
}
