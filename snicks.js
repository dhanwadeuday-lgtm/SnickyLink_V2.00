// ============================================================
// SNICKYLINK — Screen 3: Snicks (journey map / level-progression)
// ============================================================
import { api } from '../api.js';
import { openModal, closeModal, toast, haptic, doodles, escapeHtml, snickLogo } from '../ui.js';

let currentFrequency = 'DAILY';

export async function renderSnicks(container) {
  container.innerHTML = `
    <div class="sl-snicks-title-row">
      <div class="sl-snicks-title"><span class="sl-snicks-title-logo">${snickLogo(26)}</span>Snicks</div>
      <button class="sl-icon-btn" id="info-btn"><i class="fa-solid fa-circle-info"></i></button>
    </div>

    <div class="sl-segmented sl-segmented-4" style="margin-bottom:16px;">
      <button class="sl-segment ${currentFrequency === 'DAILY' ? 'active' : ''}" data-freq="DAILY">Daily</button>
      <button class="sl-segment ${currentFrequency === 'WEEKLY' ? 'active' : ''}" data-freq="WEEKLY">Weekly</button>
      <button class="sl-segment ${currentFrequency === 'MONTHLY' ? 'active' : ''}" data-freq="MONTHLY">Monthly</button>
      <button class="sl-segment ${currentFrequency === 'CHALLENGE' ? 'active' : ''}" data-freq="CHALLENGE">Challenges</button>
    </div>

    <div id="gate-banner"></div>
    <div id="map-container"><div class="sl-loading-spinner"></div></div>

    <div class="sl-map-legend">
      <div class="sl-legend-item"><span class="sl-legend-dot" style="background:var(--sl-daily);"></span>Daily Snicks</div>
      <div class="sl-legend-item"><span class="sl-legend-dot" style="background:var(--sl-weekly);"></span>Weekly Snicks</div>
      <div class="sl-legend-item"><span class="sl-legend-dot" style="background:var(--sl-monthly);"></span>Monthly Snicks</div>
      <div class="sl-legend-item"><span class="sl-legend-dot" style="background:var(--sl-challenge, #4CA6A8);"></span>Challenges</div>
    </div>
  `;

  document.getElementById('info-btn').addEventListener('click', () => {
    openModal(`
      <h3 style="margin-bottom:10px;">How Snicks Work</h3>
      <p style="font-size:13.5px;line-height:1.6;color:var(--sl-text-muted);">
        Snicks are fun little missions for you and your partner. Complete them together to earn XP,
        grow your four relationship pillars, build your streak, and level up as a couple.
        Tap any unlocked Snick on the map to see details and start it!
      </p>
      <button class="sl-btn sl-btn-primary sl-btn-block" style="margin-top:16px;" onclick="this.closest('.sl-modal-overlay').remove()">Got it</button>
    `);
  });

  document.querySelectorAll('.sl-segment').forEach((seg) => {
    seg.addEventListener('click', () => {
      haptic();
      currentFrequency = seg.dataset.freq;
      document.querySelectorAll('.sl-segment').forEach((s) => s.classList.remove('active'));
      seg.classList.add('active');
      loadMap();
    });
  });

  await loadMap();
}

function freqClass(freq) {
  if (freq === 'DAILY') return 'daily';
  if (freq === 'WEEKLY') return 'weekly';
  if (freq === 'CHALLENGE') return 'challenge';
  return 'monthly';
}

function stateIcon(state) {
  if (state === 'completed') return '<i class="fa-solid fa-check"></i>';
  if (state === 'locked') return '<i class="fa-solid fa-lock"></i>';
  if (state === 'current') return '<i class="fa-solid fa-star"></i>';
  return '<i class="fa-regular fa-circle"></i>';
}

function gateBannerHtml(gate) {
  if (!gate || gate.unlocked) return '';
  const pct = gate.progress ? Math.round((gate.progress.current / gate.progress.required) * 100) : 0;
  return `
    <div class="sl-gate-banner">
      <div class="sl-gate-icon">🔒</div>
      <div style="flex:1;">
        <div class="sl-gate-reason">${escapeHtml(gate.reason)}</div>
        ${gate.progress ? `
          <div class="sl-gate-progress-track"><div class="sl-gate-progress-fill" style="width:${pct}%;"></div></div>
          <div class="sl-gate-progress-label">${gate.progress.current}/${gate.progress.required} ${escapeHtml(gate.progress.label)}</div>
        ` : ''}
      </div>
    </div>
  `;
}

async function loadMap() {
  const container = document.getElementById('map-container');
  const gateBanner = document.getElementById('gate-banner');
  try {
    const data = await api.listSnicks(currentFrequency);
    if (gateBanner) gateBanner.innerHTML = gateBannerHtml(data.gate);
    if (!data.items.length) {
      container.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-map"></i>No Snicks available yet for this frequency.</div>`;
      return;
    }

    const doodleSet = [
      { html: doodles.sun, style: 'top:20px; right:20px; width:40px;' },
      { html: doodles.cloud, style: 'top:60px; left:10px; width:50px;' },
      { html: doodles.mountain, style: 'bottom:40px; left:0px; width:70px;' },
      { html: doodles.tree, style: 'bottom:20px; right:16px; width:28px;' },
      { html: doodles.star, style: 'top:140px; right:40px; width:18px;' },
      { html: doodles.cloud, style: 'bottom:140px; right:8px; width:44px;' },
    ];

    const alignCycle = ['align-left', 'align-right', 'align-center'];

    const hiddenBeforeHtml = data.hiddenCompletedCount > 0
      ? `<div class="sl-map-window-hint"><i class="fa-solid fa-check-double"></i> ${data.hiddenCompletedCount} earlier Snick${data.hiddenCompletedCount === 1 ? '' : 's'} completed</div>`
      : '';
    const hiddenAfterHtml = data.hiddenLockedCount > 0
      ? `<div class="sl-map-window-hint"><i class="fa-solid fa-lock"></i> ${data.hiddenLockedCount} more locked — keep going to unlock them one by one</div>`
      : '';

    const nodesHtml = data.items
      .map((item, idx) => {
        const align = alignCycle[idx % alignCycle.length];
        return `
        <div class="sl-map-node-row ${align}">
          <div class="sl-map-node ${freqClass(item.frequency)} ${item.state}" data-id="${item.id}">
            <div class="sl-map-node-icon">${stateIcon(item.state)}</div>
            <div>
              <div class="sl-map-node-label">${escapeHtml(item.mapLabel)}</div>
              <div class="sl-map-node-sub">${item.xpReward} XP</div>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    container.innerHTML = `
      <div class="sl-map-wrap">
        ${doodleSet.map((d) => `<div class="sl-map-doodle" style="${d.style}">${d.html}</div>`).join('')}
        <div class="sl-map-nodes">
          ${hiddenBeforeHtml}
          ${nodesHtml}
          ${hiddenAfterHtml}
        </div>
      </div>
    `;

    container.querySelectorAll('.sl-map-node').forEach((node) => {
      node.addEventListener('click', () => {
        if (node.classList.contains('locked')) {
          haptic();
          toast('Complete earlier Snicks to unlock this one 🔒');
          return;
        }
        openSnickDetail(node.dataset.id);
      });
    });

    // With large pools (163 Daily / 46 Weekly), jump straight to the couple's
    // actionable node instead of making them scroll past dozens of future-locked
    // ones — the "current" node is always where progress actually happens.
    const focusNode = container.querySelector('.sl-map-node.current') || container.querySelector('.sl-map-node.completed');
    if (focusNode) {
      requestAnimationFrame(() => {
        focusNode.scrollIntoView({ behavior: 'auto', block: 'center' });
      });
    }
  } catch (e) {
    container.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${e.message}</div>`;
  }
}

const DIFFICULTY_LABEL = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };
const VERIFICATION_LABEL = {
  SELF_CONFIRMATION: 'Self-confirm',
  PARTNER_CONFIRMATION: 'Partner confirms',
  MUTUAL_COMPLETION: 'Both confirm',
  OPTIONAL_NON_SENSITIVE_EVIDENCE: 'Optional evidence',
};

async function openSnickDetail(snickId) {
  const snick = await api.getSnick(snickId);
  const pillarsHtml = Object.entries(snick.pillars)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="sl-pillar-chip">${pillarLabel(k)} ${v}%</span>`)
    .join('');

  const status = snick.completion?.status;
  const needsConsent = snick.safetyStatus === 'REVIEW_CONSENT_SAFETY';
  const hasSkipOption = snick.safetyStatus === 'CONSENT_SKIP_OPTION';

  const overlay = openModal(`
    <h3 style="margin-bottom:6px;">${escapeHtml(snick.title)}</h3>
    <p style="font-size:13.5px;color:var(--sl-text-muted);line-height:1.5;margin-bottom:14px;">${escapeHtml(snick.description)}</p>
    <div style="margin-bottom:14px;">${pillarsHtml}</div>
    <div class="sl-card-flat" style="margin-bottom:16px;">
      <div class="sl-detail-row"><span class="sl-detail-label">Difficulty</span><span class="sl-detail-value">${DIFFICULTY_LABEL[snick.difficulty]}</span></div>
      <div class="sl-detail-row"><span class="sl-detail-label">XP Reward</span><span class="sl-detail-value">+${snick.xpReward} XP</span></div>
      <div class="sl-detail-row"><span class="sl-detail-label">Duration</span><span class="sl-detail-value">${snick.durationMinutes} min</span></div>
      <div class="sl-detail-row"><span class="sl-detail-label">Verification</span><span class="sl-detail-value">${escapeHtml(snick.verificationMethod || VERIFICATION_LABEL[snick.verificationType])}</span></div>
      <div class="sl-detail-row"><span class="sl-detail-label">Long distance</span><span class="sl-detail-value">${snick.longDistanceSupported ? 'Supported' : 'In-person'}</span></div>
    </div>
    ${
      needsConsent || hasSkipOption
        ? `<div class="sl-privacy-note"><i class="fa-solid fa-shield-heart"></i> ${escapeHtml(snick.privacyRule || 'Never require a private chat screenshot.')}</div>`
        : ''
    }
    <div id="snick-action-area"></div>
  `);

  renderSnickAction(snickId, snick, status, overlay);
}

function pillarLabel(key) {
  return { communication: 'Communication', emotional: 'Emotional', efforts: 'Efforts', trust: 'Trust' }[key] || key;
}

function renderSnickAction(snickId, snick, status, overlay) {
  const area = document.getElementById('snick-action-area');
  if (status === 'APPROVED') {
    area.innerHTML = `<button class="sl-btn sl-btn-block" style="background:var(--sl-success);color:#fff;" disabled><i class="fa-solid fa-check"></i> Completed</button>`;
    return;
  }
  if (status === 'PENDING' && snick.completion?.completedAt) {
    area.innerHTML = `
      <p style="font-size:12.5px;color:var(--sl-text-muted);margin-bottom:10px;text-align:center;">Waiting for partner confirmation…</p>
      <button class="sl-btn sl-btn-secondary sl-btn-block" id="verify-btn">Confirm as Partner</button>
    `;
    document.getElementById('verify-btn').addEventListener('click', async () => {
      try {
        const result = await api.verifyCompletion(snick.completion.id, 'APPROVED');
        closeModal(overlay);
        showCelebration(result.result);
      } catch (e) {
        toast(e.message);
      }
    });
    return;
  }
  if (status === 'PENDING') {
    const hasSkipOption = snick.safetyStatus === 'CONSENT_SKIP_OPTION';
    area.innerHTML = `
      <button class="sl-btn sl-btn-primary sl-btn-block" id="complete-btn">Mark as Done</button>
      ${hasSkipOption ? `<button class="sl-btn sl-btn-ghost sl-btn-block" id="skip-btn" style="margin-top:8px;">Skip this one (no penalty)</button>` : ''}
    `;
    document.getElementById('complete-btn').addEventListener('click', () => doComplete(snickId, snick, overlay, {}));
    document.getElementById('skip-btn')?.addEventListener('click', () => doComplete(snickId, snick, overlay, { skip: true }));
    return;
  }
  area.innerHTML = `<button class="sl-btn sl-btn-primary sl-btn-block" id="start-btn">Start Snick</button>`;
  document.getElementById('start-btn').addEventListener('click', async () => {
    try {
      await api.startSnick(snickId);
      closeModal(overlay);
      toast('Snick started! 🎯');
      loadMap();
    } catch (e) {
      toast(e.message);
    }
  });
}

async function doComplete(snickId, snick, overlay, opts) {
  try {
    const result = await api.completeSnick(snickId, opts);
    closeModal(overlay);
    if (result.status === 'SKIPPED') {
      toast('Skipped — no worries, next one\'s waiting whenever you\'re ready 💛');
      loadMap();
    } else if (result.requiresPartnerConfirmation) {
      toast('Marked done! Waiting for partner to confirm 💬');
    } else {
      showCelebration(result.result);
    }
  } catch (e) {
    if (e.status === 428) {
      openConsentSheet(snickId, snick, overlay, e.data?.privacyRule || e.message);
    } else {
      toast(e.message);
    }
  }
}

function openConsentSheet(snickId, snick, parentOverlay, privacyRule) {
  const overlay = openModal(`
    <h3 style="margin-bottom:10px;"><i class="fa-solid fa-shield-heart" style="color:var(--sl-primary);"></i> Quick check before you continue</h3>
    <p style="font-size:13.5px;line-height:1.6;color:var(--sl-text-muted);margin-bottom:16px;">${escapeHtml(privacyRule)}</p>
    <p style="font-size:13px;line-height:1.5;margin-bottom:16px;">This Snick needs both of you comfortable and consenting. Tap confirm only if you both agree to go ahead.</p>
    <button class="sl-btn sl-btn-primary sl-btn-block" id="consent-confirm-btn">We both consent — continue</button>
    <button class="sl-btn sl-btn-ghost sl-btn-block" id="consent-cancel-btn" style="margin-top:8px;">Not right now</button>
  `);
  document.getElementById('consent-confirm-btn').addEventListener('click', async () => {
    closeModal(overlay);
    await doComplete(snickId, snick, parentOverlay, { consent: true });
  });
  document.getElementById('consent-cancel-btn').addEventListener('click', () => closeModal(overlay));
}

function showCelebration(result) {
  loadMap();
  if (!result) return;
  const overlay = openModal(`
    <div class="sl-celebration">
      <div class="sl-celebration-icon"><i class="fa-solid fa-check"></i></div>
      <div class="sl-xp-gain">+${result.xpAwarded} XP</div>
      <p style="font-size:13px;color:var(--sl-text-muted);margin-top:8px;">
        ${result.leveledUp ? `🎉 Level Up! You're now Level ${result.levelAfter}` : `Level ${result.levelAfter}`}
        ${result.streakIncreased ? ` · 🔥 ${result.streakCount} day streak!` : ''}
      </p>
      ${
        result.unlockedAchievements?.length
          ? `<div style="margin-top:14px;">${result.unlockedAchievements
              .map((a) => `<div class="sl-pillar-chip">🌟 ${escapeHtml(a.title)}</div>`)
              .join('')}</div>`
          : ''
      }
      <button class="sl-btn sl-btn-primary sl-btn-block" style="margin-top:20px;" onclick="this.closest('.sl-modal-overlay').remove()">Nice!</button>
    </div>
  `);
}
