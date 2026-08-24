// ============================================================
// SNICKYLINK — Screen 2: Chat (list + private E2EE conversation)
// ============================================================
import { api } from '../api.js';
import { avatarHtml, escapeHtml, formatTime, timeAgo, haptic } from '../ui.js';
import { encryptMessage, decryptMessage, selfEncrypt } from '../e2ee.js';

export async function renderChat(container) {
  container.innerHTML = `
    <header class="sl-header">
      <div></div>
      <div class="sl-chat-title" style="margin:0;">Chat <i class="fa-solid fa-heart" style="font-size:22px;"></i></div>
      <button class="sl-icon-btn" id="new-chat-btn"><i class="fa-solid fa-plus"></i></button>
    </header>

    <div class="sl-search">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input type="text" placeholder="Search in chats" id="search-input" />
    </div>

    <div id="chat-list"><div class="sl-loading-spinner"></div></div>
  `;

  document.getElementById('new-chat-btn').addEventListener('click', () => {
    import('../ui.js').then(({ toast }) => toast('You can only chat with your linked partner 💕'));
  });

  await loadChatList();

  document.getElementById('search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.sl-chat-row').forEach((row) => {
      const name = row.dataset.name.toLowerCase();
      row.style.display = name.includes(q) ? 'flex' : 'none';
    });
  });
}

async function loadChatList() {
  const listEl = document.getElementById('chat-list');
  try {
    const data = await api.getConversations();
    if (!data.conversations.length) {
      listEl.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-comment-dots"></i>No conversation yet.</div>`;
      return;
    }
    const conv = data.conversations[0];
    let preview = 'Say hello to start your private chat 💬';
    if (conv.lastMessageCiphertext) {
      preview = await decryptMessage(conv.lastMessageCiphertext, conv.lastMessageIv, conv.partner?.publicKeyJwk);
    }
    listEl.innerHTML = `
      <div class="sl-chat-row" data-name="${escapeHtml(conv.title)}" data-id="${conv.id}">
        ${avatarHtml(conv.partner?.displayName || conv.title)}
        <div class="sl-chat-content">
          <div class="sl-chat-name">${escapeHtml(conv.title)} 💕</div>
          <div class="sl-chat-preview">${escapeHtml(preview)}</div>
        </div>
        <div class="sl-chat-meta">
          <div class="sl-chat-time">${conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : ''}</div>
          ${conv.unreadCount > 0 ? `<div class="sl-unread-badge">${conv.unreadCount}</div>` : ''}
        </div>
      </div>
    `;
    listEl.querySelector('.sl-chat-row').addEventListener('click', () => {
      window.location.hash = `#/chat/${conv.id}`;
    });
  } catch (e) {
    listEl.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${e.message}</div>`;
  }
}

export async function renderConversation(container, conversationId) {
  container.innerHTML = `
    <div class="sl-conversation">
      <div class="sl-conv-header">
        <button class="sl-icon-btn" id="back-btn"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="sl-conv-header-avatar" id="conv-avatar"></div>
        <div class="sl-conv-header-info">
          <div id="conv-title">Loading…</div>
          <div class="sl-conv-header-status"><span class="sl-online-dot"></span>Online</div>
        </div>
        <button class="sl-icon-btn" id="call-btn"><i class="fa-solid fa-phone"></i></button>
        <button class="sl-icon-btn" id="video-btn"><i class="fa-solid fa-video"></i></button>
      </div>
      <div class="sl-messages" id="messages-list"><div class="sl-loading-spinner"></div></div>
      <div class="sl-composer">
        <button class="sl-composer-plus" id="attach-btn"><i class="fa-solid fa-plus"></i></button>
        <div class="sl-composer-field">
          <input type="text" id="msg-input" placeholder="Type an encrypted message…" maxlength="2000" />
          <i class="fa-regular fa-face-smile"></i>
        </div>
        <button class="sl-composer-send" id="send-btn"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => (window.location.hash = '#/chat'));
  document.getElementById('call-btn').addEventListener('click', () => {
    import('../ui.js').then(({ toast }) => toast('Voice calls are coming soon 💕'));
  });
  document.getElementById('video-btn').addEventListener('click', () => {
    import('../ui.js').then(({ toast }) => toast('Video calls are coming soon 💕'));
  });
  document.getElementById('attach-btn').addEventListener('click', () => {
    import('../ui.js').then(({ toast }) => toast('Photo attachments are coming soon 📸'));
  });

  const data = await api.getConversations();
  const conv = data.conversations.find((c) => c.id === conversationId) || data.conversations[0];
  if (!conv) {
    container.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>Conversation not found</div>`;
    return;
  }
  document.getElementById('conv-title').innerHTML = `${escapeHtml(conv.title)} <i class="fa-solid fa-heart" style="font-size:13px;color:var(--sl-secondary);"></i>`;
  document.getElementById('conv-avatar').innerHTML = avatarHtml(conv.partner?.displayName || conv.title, 'sm');

  const partnerKey = conv.partner?.publicKeyJwk || null;

  await loadMessages(conversationId, partnerKey);
  await api.markRead(conversationId);

  document.getElementById('send-btn').addEventListener('click', () => sendMessage(conversationId, partnerKey));
  document.getElementById('msg-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(conversationId, partnerKey);
  });
}

async function loadMessages(conversationId, partnerKey) {
  const listEl = document.getElementById('messages-list');
  try {
    const data = await api.getMessages(conversationId);
    const { state } = await import('../store.js');
    const myId = state.user?.id;

    if (!data.messages.length) {
      listEl.innerHTML = `
        <div class="sl-chat-empty">
          <img src="/static/img/chat-sticker.png" alt="" class="sl-chat-sticker" />
          <div class="sl-chat-empty-text"><i class="fa-solid fa-lock"></i> Messages are end-to-end encrypted. Say hi! 👋</div>
        </div>
      `;
      return;
    }

    const bubbles = await Promise.all(
      data.messages.map(async (m) => {
        const plaintext = await decryptMessage(m.ciphertext, m.iv, partnerKey);
        const mine = m.senderId === myId;
        const status = mine ? (m.readAt ? '<i class="fa-solid fa-check-double"></i> Read' : m.deliveredAt ? '<i class="fa-solid fa-check-double"></i>' : '<i class="fa-solid fa-check"></i>') : '';
        return `
          <div class="sl-bubble ${mine ? 'sl-bubble-mine' : 'sl-bubble-theirs'}">
            <div>${escapeHtml(plaintext)}</div>
            <div class="sl-bubble-meta">${formatTime(m.createdAt)} ${status}</div>
          </div>
        `;
      })
    );
    listEl.innerHTML = bubbles.join('');
    listEl.scrollTop = listEl.scrollHeight;
  } catch (e) {
    listEl.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${e.message}</div>`;
  }
}

async function sendMessage(conversationId, partnerKey) {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  haptic();

  // Optimistic local echo: show the message immediately instead of waiting on
  // a full send + re-fetch round trip (the previous "nothing shows up after
  // sending" complaint was partly a real decrypt bug, partly perceived lag).
  const listEl = document.getElementById('messages-list');
  const emptyState = listEl?.querySelector('.sl-empty-state');
  if (emptyState) listEl.innerHTML = '';
  const tempId = `pending-${Date.now()}`;
  if (listEl) {
    listEl.insertAdjacentHTML(
      'beforeend',
      `<div class="sl-bubble sl-bubble-mine" id="${tempId}">
        <div>${escapeHtml(text)}</div>
        <div class="sl-bubble-meta"><i class="fa-solid fa-clock"></i> Sending…</div>
      </div>`
    );
    listEl.scrollTop = listEl.scrollHeight;
  }

  try {
    let encrypted;
    if (partnerKey) {
      encrypted = await encryptMessage(text, partnerKey);
    } else {
      // Partner hasn't synced their public key yet — self-encrypt so the UI still
      // stores something meaningful; once partner's key syncs, new messages will
      // use the real shared key. This never sends plaintext to the server.
      encrypted = await selfEncrypt(text);
    }
    await api.sendMessage(conversationId, encrypted.ciphertext, encrypted.iv);
    await loadMessages(conversationId, partnerKey);
  } catch (e) {
    document.getElementById(tempId)?.remove();
    const { toast } = await import('../ui.js');
    toast(e.message);
  }
}
