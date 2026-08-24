// ============================================================
// SNICKYLINK — Screen 4: Leaderboard
// ============================================================
import { api } from '../api.js';
import { openModal, initials, escapeHtml } from '../ui.js';
import { state } from '../store.js';

let currentScope = 'city';

export async function renderLeaderboard(container) {
  container.innerHTML = `
    <div class="sl-leaderboard-title">Leaderboard <button class="sl-icon-btn" id="info-btn" style="width:32px;height:32px;font-size:13px;margin-left:auto;"><i class="fa-solid fa-circle-info"></i></button></div>

    <div class="sl-segmented" style="margin-bottom:14px;">
      <button class="sl-segment ${currentScope === 'city' ? 'active' : ''}" data-scope="city">Local (City)</button>
      <button class="sl-segment ${currentScope === 'country' ? 'active' : ''}" data-scope="country">Country</button>
    </div>

    <div class="sl-filter-row">
      <span class="sl-pill-select" id="location-label"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(state.couple?.city || 'Set your city')}</span>
      <span class="sl-pill-select">This Week <i class="fa-solid fa-chevron-down" style="font-size:10px;"></i></span>
    </div>

    <div id="leaderboard-content"><div class="sl-loading-spinner"></div></div>
  `;

  document.getElementById('info-btn').addEventListener('click', () => {
    openModal(`
      <h3 style="margin-bottom:10px;">About the Leaderboard</h3>
      <p style="font-size:13.5px;line-height:1.6;color:var(--sl-text-muted);">
        Compete as a couple against others in your city or country. Only your couple nickname and XP are shown —
        your private details, chats, and personal data always stay private.
      </p>
      <button class="sl-btn sl-btn-primary sl-btn-block" style="margin-top:16px;" onclick="this.closest('.sl-modal-overlay').remove()">Got it</button>
    `);
  });

  document.querySelectorAll('.sl-segment').forEach((seg) => {
    seg.addEventListener('click', () => {
      currentScope = seg.dataset.scope;
      document.querySelectorAll('.sl-segment').forEach((s) => s.classList.remove('active'));
      seg.classList.add('active');
      loadLeaderboard();
    });
  });

  await loadLeaderboard();
}

async function loadLeaderboard() {
  const content = document.getElementById('leaderboard-content');
  try {
    const [data, rewardsData] = await Promise.all([api.getLeaderboard(currentScope), api.getRewards().catch(() => null)]);

    if (!data.entries.length) {
      content.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-trophy"></i>No couples ranked yet in this area. Complete Snicks to be the first!</div>`;
      return;
    }

    const top3 = data.entries.slice(0, 3);
    const rest = data.entries.slice(3);

    const podiumHtml = top3.length
      ? `<div class="sl-podium">
          ${top3
            .map(
              (e, i) => `
            <div class="sl-podium-item rank-${i + 1}">
              <div class="sl-podium-avatar">
                ${i === 0 ? '<div class="sl-podium-crown">👑</div>' : ''}
                ${initials(e.nickname)}
                <div class="sl-podium-medal">${e.rank}</div>
              </div>
              <div class="sl-podium-name">${escapeHtml(e.nickname)}</div>
              <div class="sl-podium-xp">${e.xpTotal.toLocaleString()} XP</div>
              <div class="sl-podium-base"></div>
            </div>
          `
            )
            .join('')}
        </div>`
      : '';

    const restHtml = rest
      .map(
        (e) => `
      <div class="sl-rank-row ${e.isMine ? 'mine' : ''}">
        <div class="sl-rank-num">${e.rank}</div>
        <div style="transform:scale(0.7);margin:-8px;">${''}</div>
        <div class="sl-rank-name">${escapeHtml(e.nickname)} ${e.isMine ? '(You)' : ''}</div>
        <div class="sl-rank-xp">${e.xpTotal.toLocaleString()} XP</div>
      </div>
    `
      )
      .join('');

    const league = data.myLeague;
    const nextReward = rewardsData?.rewards?.find((r) => !r.unlocked);

    content.innerHTML = `
      ${podiumHtml}
      ${restHtml}
      <div class="sl-league-banner">
        <div class="sl-league-icon">💎</div>
        <div style="flex:1;">
          <div class="sl-league-title">${league ? league.name : 'Unranked League'}</div>
          <div class="sl-league-sub">Top 1% couples in your city</div>
        </div>
        <button class="sl-btn sl-btn-sm" id="view-leagues-btn">View Leagues</button>
      </div>
      <div class="sl-rewards-banner">
        <div class="sl-rewards-icon">🎁</div>
        <div>
          <div class="sl-rewards-title">Rewards Teased!</div>
          <div class="sl-rewards-sub">${nextReward ? `Reach ${nextReward.unlockXp.toLocaleString()} XP to unlock "${escapeHtml(nextReward.title)}"` : 'Climb higher, unlock better rewards!'}</div>
        </div>
      </div>
    `;

    document.getElementById('view-leagues-btn').addEventListener('click', openLeaguesModal);
  } catch (e) {
    content.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${e.message}</div>`;
  }
}

async function openLeaguesModal() {
  const data = await api.getLeagues();
  openModal(`
    <h3 style="margin-bottom:14px;">Leagues</h3>
    <div class="sl-settings-list">
      ${data.leagues
        .map(
          (l) => `<div class="sl-settings-item">
            <i class="fa-solid fa-gem leading"></i>
            <span>${escapeHtml(l.name)}</span>
            <span style="color:var(--sl-text-muted);font-size:12px;">${l.minXp.toLocaleString()}+ XP</span>
          </div>`
        )
        .join('')}
    </div>
  `);
}
