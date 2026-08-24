// ============================================================
// SNICKYLINK — Auth screens: Login, Register, Couple Setup
// ============================================================
import { api, setTokens } from '../api.js';
import { state, setState, applyTheme } from '../store.js';
import { toast } from '../ui.js';
import { getPublicKeyJwk } from '../e2ee.js';

function bgDecor() {
  return `<div class="sl-auth-bg-decor"><span></span><span></span><span></span></div>`;
}

function themeToggleRow() {
  return `
    <div class="sl-theme-toggle-row">
      <div class="sl-theme-toggle" id="auth-theme-toggle">
        <button type="button" data-mode="light" class="${state.theme === 'dark' ? '' : 'active'}">
          <i class="fa-solid fa-sun"></i> Day
        </button>
        <button type="button" data-mode="dark" class="${state.theme === 'dark' ? 'active' : ''}">
          <i class="fa-solid fa-moon"></i> Night
        </button>
      </div>
    </div>
  `;
}

function bindThemeToggle() {
  const row = document.getElementById('auth-theme-toggle');
  if (!row) return;
  row.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.mode);
      row.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
}

function logoBlock(subtitle) {
  return `
    <div class="sl-auth-logo">
      <div class="sl-heart-icon"><i class="fa-solid fa-heart"></i></div>
      <div class="sl-wordmark">SnickyLink</div>
      <span class="sl-tagline">For Couples. Built on Fun, Trust &amp; Little Things.</span>
      ${subtitle ? `<p style="margin-top:14px;font-size:13px;color:var(--sl-text-muted);">${subtitle}</p>` : ''}
    </div>
  `;
}

function passwordFieldHtml(id, placeholder, extraAttrs) {
  return `
    <div class="sl-input-group">
      <i class="fa-solid fa-lock sl-input-icon"></i>
      <input type="password" id="${id}" placeholder="${placeholder}" class="has-toggle" ${extraAttrs || ''} />
      <button type="button" class="sl-input-toggle-btn" data-target="${id}" aria-label="Show password">
        <i class="fa-solid fa-eye"></i>
      </button>
    </div>
  `;
}

function bindPasswordToggles(root) {
  root.querySelectorAll('.sl-input-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const icon = btn.querySelector('i');
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      icon.classList.toggle('fa-eye', showing);
      icon.classList.toggle('fa-eye-slash', !showing);
    });
  });
}

function setLoading(btn, loading, label, loadingLabel) {
  btn.disabled = loading;
  btn.classList.toggle('sl-loading', loading);
  btn.innerHTML = loading
    ? `<i class="fa-solid fa-spinner"></i> ${loadingLabel}`
    : label;
}

export async function renderAuth(container, mode) {
  if (mode === 'login') return renderLogin(container);
  if (mode === 'register') return renderRegister(container);
  if (mode === 'couple-setup') return renderCoupleSetup(container);
}

const DEMO_ACCOUNTS = [
  { label: 'Ari (Demo 1)', email: 'demo1@snickylink.app', password: 'Demo1234!', icon: 'fa-user' },
  { label: 'Sam (Demo 2)', email: 'demo2@snickylink.app', password: 'Demo1234!', icon: 'fa-user' },
  { label: 'Admin', email: 'admin@snickylink.app', password: 'Admin1234!', icon: 'fa-shield-halved' },
];

function demoAccountsBlock() {
  return `
    <div class="sl-demo-box">
      <p><i class="fa-solid fa-flask"></i>&nbsp; Quick demo login</p>
      <div class="sl-demo-chip-row">
        ${DEMO_ACCOUNTS.map((d, i) => `
          <button type="button" class="sl-demo-chip" data-demo-idx="${i}">
            <i class="fa-solid ${d.icon}"></i> ${d.label}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function bindDemoChips(root, onFill) {
  root.querySelectorAll('[data-demo-idx]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const acc = DEMO_ACCOUNTS[Number(chip.dataset.demoIdx)];
      onFill(acc);
    });
  });
}

function renderLogin(container) {
  container.innerHTML = `
    <div class="sl-auth-screen">
      ${bgDecor()}
      ${themeToggleRow()}
      ${logoBlock('Welcome back! Log in to continue your journey together.')}
      <div class="sl-auth-card">
        <form id="login-form">
          <div class="sl-field">
            <label>Email</label>
            <div class="sl-input-group">
              <i class="fa-solid fa-envelope sl-input-icon"></i>
              <input type="email" id="email" placeholder="you@example.com" required autocomplete="email" />
            </div>
          </div>
          <div class="sl-field">
            <label>Password</label>
            ${passwordFieldHtml('password', '••••••••', 'required autocomplete="current-password"')}
            <div class="sl-field-error" id="err" style="display:none;"><i class="fa-solid fa-circle-exclamation"></i><span></span></div>
          </div>
          <button type="submit" class="sl-btn sl-btn-primary sl-btn-block" id="submit-btn">
            <i class="fa-solid fa-heart"></i>&nbsp; Log In
          </button>
        </form>
        ${demoAccountsBlock()}
      </div>
      <div class="sl-auth-switch">Don't have an account? <b id="go-register">Sign up</b></div>
    </div>
  `;

  bindThemeToggle();
  bindPasswordToggles(container);
  bindDemoChips(container, (acc) => {
    document.getElementById('email').value = acc.email;
    document.getElementById('password').value = acc.password;
    toast(`Filled in ${acc.label} — tap Log In`);
  });

  document.getElementById('go-register').addEventListener('click', () => (window.location.hash = '#/register'));
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const errEl = document.getElementById('err');
    const errText = errEl.querySelector('span');
    errEl.style.display = 'none';
    setLoading(btn, true, '<i class="fa-solid fa-heart"></i>&nbsp; Log In', 'Logging in…');
    try {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const data = await api.login({ email, password });
      setTokens(data.accessToken, data.refreshToken);
      setState({ user: data.user });
      // sync E2EE public key (idempotent — safe every login)
      const jwk = await getPublicKeyJwk();
      await api.updateMe({ publicKeyJwk: jwk }).catch(() => {});
      if (data.user.coupleId) {
        const couple = await api.myCouple().catch(() => null);
        setState({ couple });
        window.location.hash = '#/home';
      } else {
        window.location.hash = '#/couple-setup';
      }
    } catch (err) {
      errText.textContent = err.message;
      errEl.style.display = 'flex';
      setLoading(btn, false, '<i class="fa-solid fa-heart"></i>&nbsp; Log In', '');
    }
  });
}

function renderRegister(container) {
  container.innerHTML = `
    <div class="sl-auth-screen">
      ${bgDecor()}
      ${themeToggleRow()}
      ${logoBlock('Create your account and start your couple journey.')}
      <div class="sl-auth-card">
        <form id="register-form">
          <div class="sl-field">
            <label>Your Name</label>
            <div class="sl-input-group">
              <i class="fa-solid fa-user sl-input-icon"></i>
              <input type="text" id="displayName" placeholder="Alex" required minlength="2" />
            </div>
          </div>
          <div class="sl-field">
            <label>Email</label>
            <div class="sl-input-group">
              <i class="fa-solid fa-envelope sl-input-icon"></i>
              <input type="email" id="email" placeholder="you@example.com" required autocomplete="email" />
            </div>
          </div>
          <div class="sl-field">
            <label>Password</label>
            ${passwordFieldHtml('password', 'At least 8 characters', 'required minlength="8" autocomplete="new-password"')}
            <div class="sl-field-error" id="err" style="display:none;"><i class="fa-solid fa-circle-exclamation"></i><span></span></div>
          </div>
          <button type="submit" class="sl-btn sl-btn-primary sl-btn-block" id="submit-btn">
            <i class="fa-solid fa-heart"></i>&nbsp; Create Account
          </button>
        </form>
      </div>
      <div class="sl-auth-switch">Already have an account? <b id="go-login">Log in</b></div>
    </div>
  `;

  bindThemeToggle();
  bindPasswordToggles(container);

  document.getElementById('go-login').addEventListener('click', () => (window.location.hash = '#/login'));
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const errEl = document.getElementById('err');
    const errText = errEl.querySelector('span');
    errEl.style.display = 'none';
    setLoading(btn, true, '<i class="fa-solid fa-heart"></i>&nbsp; Create Account', 'Creating…');
    try {
      const displayName = document.getElementById('displayName').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const data = await api.register({ displayName, email, password });
      setTokens(data.accessToken, data.refreshToken);
      setState({ user: data.user });
      const jwk = await getPublicKeyJwk();
      await api.updateMe({ publicKeyJwk: jwk }).catch(() => {});
      toast('Welcome to SnickyLink! 💕');
      window.location.hash = '#/couple-setup';
    } catch (err) {
      errText.textContent = err.message;
      errEl.style.display = 'flex';
      setLoading(btn, false, '<i class="fa-solid fa-heart"></i>&nbsp; Create Account', '');
    }
  });
}

function renderCoupleSetup(container) {
  container.innerHTML = `
    <div class="sl-auth-screen">
      ${logoBlock()}
      <div class="sl-card" style="margin-bottom:14px;">
        <h3 style="margin-bottom:10px;">Create a Couple</h3>
        <p style="font-size:12.5px;color:var(--sl-text-muted);margin-bottom:14px;">Start your journey and invite your partner with a code.</p>
        <form id="create-couple-form">
          <div class="sl-field">
            <label>Couple Nickname</label>
            <input type="text" id="nickname" placeholder="e.g. UsForever" required minlength="2" />
          </div>
          <div class="sl-field">
            <label>Tagline</label>
            <input type="text" id="tagline" placeholder="We're better together 💕" />
          </div>
          <div class="sl-field">
            <label>City</label>
            <input type="text" id="city" placeholder="Pune" />
          </div>
          <div class="sl-field">
            <label>Country</label>
            <input type="text" id="country" placeholder="India" />
          </div>
          <div class="sl-field-error" id="err1" style="display:none;"></div>
          <button type="submit" class="sl-btn sl-btn-primary sl-btn-block">Create Couple</button>
        </form>
      </div>

      <div class="sl-divider-text">— or —</div>

      <div class="sl-card">
        <h3 style="margin-bottom:10px;">Join with Invite Code</h3>
        <form id="join-couple-form">
          <div class="sl-field">
            <label>Invite Code</label>
            <input type="text" id="code" placeholder="ABC12345" required style="text-transform:uppercase;" />
          </div>
          <div class="sl-field-error" id="err2" style="display:none;"></div>
          <button type="submit" class="sl-btn sl-btn-outline sl-btn-block">Join Couple</button>
        </form>
      </div>

      <div id="invite-result"></div>
    </div>
  `;

  document.getElementById('create-couple-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('err1');
    errEl.style.display = 'none';
    try {
      const nickname = document.getElementById('nickname').value.trim();
      const tagline = document.getElementById('tagline').value.trim();
      const city = document.getElementById('city').value.trim();
      const country = document.getElementById('country').value.trim();
      const result = await api.createCouple({ nickname, tagline, city, country });
      document.getElementById('invite-result').innerHTML = `
        <div class="sl-invite-code-display">
          <p style="font-size:12px;color:var(--sl-text-muted);margin-bottom:8px;">Share this code with your partner:</p>
          <div class="sl-invite-code-value">${result.inviteCode}</div>
          <button class="sl-btn sl-btn-primary sl-btn-block" style="margin-top:16px;" id="continue-btn">Continue to SnickyLink</button>
        </div>
      `;
      document.getElementById('continue-btn').addEventListener('click', async () => {
        const user = await api.me();
        setState({ user });
        const couple = await api.myCouple();
        setState({ couple });
        window.location.hash = '#/home';
      });
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });

  document.getElementById('join-couple-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('err2');
    errEl.style.display = 'none';
    try {
      const code = document.getElementById('code').value.trim();
      await api.joinCouple(code);
      const user = await api.me();
      setState({ user });
      const couple = await api.myCouple();
      setState({ couple });
      toast('You joined the couple! 💕');
      window.location.hash = '#/home';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}
