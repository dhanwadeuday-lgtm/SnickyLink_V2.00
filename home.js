// ============================================================
// SNICKYLINK — Screen 1: Home / Community
// ============================================================
import { api } from '../api.js';
import { escapeHtml, openModal, closeModal, toast, haptic } from '../ui.js';
import { toggleTheme, state } from '../store.js';

let currentSort = 'popular';

export async function renderHome(container) {
  container.innerHTML = `
    <header class="sl-header">
      <button class="sl-icon-btn" id="menu-btn"><i class="fa-solid fa-bars"></i></button>
      <div class="sl-wordmark">SnickyLink</div>
      <button class="sl-icon-btn" id="bell-btn">
        <i class="fa-solid fa-bell"></i>
        <span class="sl-badge-dot" id="notif-dot" style="display:none;"></span>
      </button>
    </header>

    <div class="sl-community-title">Community <i class="fa-solid fa-heart" style="font-size:22px;"></i></div>

    <div class="sl-feed-filter-row">
      <button class="sl-pill-select" id="sort-select">
        <span id="sort-label">Popular</span> <i class="fa-solid fa-chevron-down" style="font-size:10px;"></i>
      </button>
    </div>

    <div id="feed-list"><div class="sl-loading-spinner"></div></div>

    <button class="sl-fab" id="new-post-fab"><i class="fa-solid fa-plus"></i></button>
  `;

  document.getElementById('menu-btn').addEventListener('click', openMenuDrawer);
  document.getElementById('bell-btn').addEventListener('click', () => (window.location.hash = '#/notifications'));
  document.getElementById('sort-select').addEventListener('click', toggleSort);
  document.getElementById('new-post-fab').addEventListener('click', openNewPostModal);

  await loadFeed();
  await loadNotifBadge();
}

async function loadNotifBadge() {
  try {
    const data = await api.getNotifications();
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = data.unreadCount > 0 ? 'block' : 'none';
  } catch {}
}

function toggleSort() {
  currentSort = currentSort === 'popular' ? 'recent' : 'popular';
  document.getElementById('sort-label').textContent = currentSort === 'popular' ? 'Popular' : 'Recent';
  loadFeed();
}

async function loadFeed() {
  const listEl = document.getElementById('feed-list');
  try {
    const data = await api.listPosts(currentSort);
    if (!data.posts.length) {
      listEl.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-comments"></i>No stories yet. Be the first to share!</div>`;
      return;
    }
    listEl.innerHTML = data.posts.map(postCardHtml).join('');
    wirePostHandlers(listEl);
  } catch (e) {
    listEl.innerHTML = `<div class="sl-empty-state"><i class="fa-solid fa-triangle-exclamation"></i>Couldn't load the feed</div>`;
  }
}

function postCardHtml(post) {
  const hasImage = !!post.imageUrl;
  const ratio = post.imageWidth && post.imageHeight ? `${post.imageWidth} / ${post.imageHeight}` : '1 / 1';
  return `
    <article class="sl-post-card ${hasImage ? 'sl-post-card--photo' : ''}" data-id="${post.id}">
      <div class="sl-post-author">${escapeHtml(post.author.coupleNickname)}</div>
      ${hasImage ? `
        <button class="sl-post-photo-wrap" data-id="${post.id}" data-view-photo style="aspect-ratio:${ratio};">
          <img src="${post.imageUrl}" alt="" class="sl-post-photo" loading="lazy" />
        </button>
      ` : ''}
      ${post.content ? `<p class="sl-post-text">${escapeHtml(post.content)}</p>` : ''}
      <div class="sl-post-meta">
        <div class="sl-post-stats">
          <button class="sl-post-stat like-btn ${post.likedByMe ? 'liked' : ''}" data-id="${post.id}">
            <i class="fa-${post.likedByMe ? 'solid' : 'regular'} fa-heart"></i> <span class="like-count">${post.likeCount}</span>
          </button>
          <button class="sl-post-stat comment-btn" data-id="${post.id}">
            <i class="fa-regular fa-comment"></i> <span>${post.commentCount}</span>
          </button>
        </div>
        <button class="sl-post-more" data-id="${post.id}" data-mine="${post.isMine}"><i class="fa-solid fa-ellipsis-vertical"></i></button>
      </div>
    </article>
  `;
}

function wirePostHandlers(listEl) {
  listEl.querySelectorAll('.like-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      haptic();
      const id = btn.dataset.id;
      try {
        const res = await api.likePost(id);
        btn.classList.toggle('liked', res.liked);
        btn.querySelector('i').className = res.liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        const countEl = btn.querySelector('.like-count');
        countEl.textContent = parseInt(countEl.textContent, 10) + (res.liked ? 1 : -1);
        btn.classList.add('pulse-anim');
        setTimeout(() => btn.classList.remove('pulse-anim'), 400);
      } catch {}
    });
  });

  listEl.querySelectorAll('.comment-btn').forEach((btn) => {
    btn.addEventListener('click', () => openCommentsModal(btn.dataset.id));
  });

  listEl.querySelectorAll('.sl-post-more').forEach((btn) => {
    btn.addEventListener('click', () => openPostMenu(btn.dataset.id, btn.dataset.mine === 'true'));
  });

  listEl.querySelectorAll('[data-view-photo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.querySelector('img')?.src;
      if (src) openPhotoLightbox(src);
    });
  });
}

function openPhotoLightbox(src) {
  const el = document.createElement('div');
  el.className = 'sl-lightbox';
  el.innerHTML = `
    <button class="sl-lightbox-close"><i class="fa-solid fa-xmark"></i></button>
    <img src="${src}" alt="" />
  `;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  el.querySelector('.sl-lightbox-close').addEventListener('click', close);
}

function openPostMenu(postId, isMine) {
  const overlay = openModal(`
    <div style="padding-bottom:6px;">
      <div class="sl-settings-list">
        <div class="sl-settings-item" id="save-action"><i class="fa-regular fa-bookmark leading"></i><span>Save post</span></div>
        ${!isMine ? `<div class="sl-settings-item" id="report-action"><i class="fa-solid fa-flag leading"></i><span>Report</span></div>` : ''}
        ${isMine ? `<div class="sl-settings-item" id="delete-action"><i class="fa-solid fa-trash leading"></i><span>Delete</span></div>` : ''}
      </div>
    </div>
  `);
  document.getElementById('save-action')?.addEventListener('click', async () => {
    await api.savePost(postId);
    toast('Saved to your collection');
    closeModal(overlay);
  });
  document.getElementById('report-action')?.addEventListener('click', async () => {
    await api.reportContent('post', postId, 'Inappropriate content');
    toast('Report submitted. Thank you.');
    closeModal(overlay);
  });
  document.getElementById('delete-action')?.addEventListener('click', async () => {
    await api.deletePost(postId);
    toast('Post deleted');
    closeModal(overlay);
    loadFeed();
  });
}

async function openCommentsModal(postId) {
  const overlay = openModal(`
    <h3 style="margin-bottom:14px;">Comments</h3>
    <div id="comments-list" style="max-height:40vh;overflow-y:auto;margin-bottom:14px;"><div class="sl-loading-spinner"></div></div>
    <div class="sl-composer" style="border-top:none;">
      <input type="text" id="comment-input" placeholder="Add a comment…" maxlength="500" />
      <button class="sl-composer-send" id="send-comment"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  `);

  async function loadComments() {
    const data = await api.getComments(postId);
    const listEl = document.getElementById('comments-list');
    if (!listEl) return;
    listEl.innerHTML = data.comments.length
      ? data.comments
          .map(
            (c) => `<div style="padding:8px 0;border-bottom:1px solid var(--sl-border);">
              <div style="font-size:11.5px;font-weight:700;color:var(--sl-primary);">${escapeHtml(c.author)}</div>
              <div style="font-size:13px;">${escapeHtml(c.content)}</div>
            </div>`
          )
          .join('')
      : `<p style="color:var(--sl-text-muted);font-size:13px;">No comments yet.</p>`;
  }
  await loadComments();

  document.getElementById('send-comment').addEventListener('click', async () => {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    if (!content) return;
    await api.addComment(postId, content);
    input.value = '';
    await loadComments();
    loadFeed();
  });
}

const MAX_POST_IMAGE_BYTES = 15 * 1024 * 1024; // pre-compression client-side accept limit
const MAX_UPLOAD_BYTES = 1.4 * 1024 * 1024; // must stay under server's 1.5MB cap after compression
const MAX_IMAGE_DIMENSION = 1600; // longest side, px

// Compresses/resizes an image file in-browser via <canvas> so it fits
// comfortably under the D1-blob upload limit, since photos are stored
// directly as BLOBs in D1 (no R2 available). Returns a Blob (image/jpeg)
// plus its final pixel dimensions.
async function compressImageForUpload(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  let { naturalWidth: w, naturalHeight: h } = img;
  if (Math.max(w, h) > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.85;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.35) {
    quality -= 0.12;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  return { blob, width: w, height: h };
}

function openNewPostModal() {
  let selectedFile = null;
  const overlay = openModal(`
    <h3 style="margin-bottom:14px;">Share with the Community</h3>
    <textarea id="post-content" placeholder="What's on your mind? Share a story, question, or win…" maxlength="1000"
      style="width:100%;min-height:90px;border-radius:16px;border:1.5px solid var(--sl-border);padding:14px;font-family:inherit;font-size:14px;outline:none;resize:none;background:var(--sl-surface);color:var(--sl-text);"></textarea>
    <div id="photo-preview-wrap" style="display:none;margin-top:12px;position:relative;">
      <img id="photo-preview" style="width:100%;max-height:260px;object-fit:cover;border-radius:16px;display:block;" />
      <button id="remove-photo-btn" type="button" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);color:#fff;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <input type="file" id="photo-input" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;" />
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;">
      <button type="button" id="add-photo-btn" class="sl-icon-btn" style="background:var(--sl-surface-2);"><i class="fa-solid fa-image" style="color:var(--sl-primary);"></i></button>
      <button class="sl-btn sl-btn-primary" style="flex:1;margin-left:12px;" id="publish-btn">Publish</button>
    </div>
  `);

  const previewWrap = document.getElementById('photo-preview-wrap');
  const previewImg = document.getElementById('photo-preview');
  const fileInput = document.getElementById('photo-input');

  document.getElementById('add-photo-btn').addEventListener('click', () => fileInput.click());
  document.getElementById('remove-photo-btn').addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewWrap.style.display = 'none';
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > MAX_POST_IMAGE_BYTES) {
      toast('Photo must be under 15MB');
      fileInput.value = '';
      return;
    }
    selectedFile = file;
    previewImg.src = URL.createObjectURL(file);
    previewWrap.style.display = 'block';
  });

  document.getElementById('publish-btn').addEventListener('click', async () => {
    const content = document.getElementById('post-content').value.trim();
    if (!selectedFile && content.length < 3) return toast('Write a bit more, or add a photo 💭');
    const publishBtn = document.getElementById('publish-btn');
    publishBtn.disabled = true;
    publishBtn.textContent = 'Posting…';
    try {
      let imageMeta = null;
      if (selectedFile) {
        publishBtn.textContent = 'Compressing…';
        const { blob, width, height } = await compressImageForUpload(selectedFile);
        publishBtn.textContent = 'Uploading…';
        const uploaded = await api.uploadPostImage(blob);
        imageMeta = { imageKey: uploaded.imageKey, imageWidth: width, imageHeight: height };
      }
      await api.createPost(content, imageMeta);
      closeModal(overlay);
      toast('Posted to the community! 🎉');
      loadFeed();
    } catch (e) {
      toast(e.message);
      publishBtn.disabled = false;
      publishBtn.textContent = 'Publish';
    }
  });
}

function openMenuDrawer() {
  const el = document.createElement('div');
  el.className = 'sl-menu-drawer';
  el.innerHTML = `
    <div class="sl-menu-backdrop"></div>
    <div class="sl-menu-panel">
      <div class="sl-auth-logo" style="margin-bottom:24px;">
        <div class="sl-heart-icon"><i class="fa-solid fa-heart"></i></div>
        <div class="sl-wordmark">SnickyLink</div>
      </div>
      <div class="sl-settings-list" style="margin-bottom:14px;">
        <div class="sl-settings-item" id="menu-theme">
          <i class="fa-solid fa-circle-half-stroke leading"></i><span>Toggle Dark Mode</span>
        </div>
        <div class="sl-settings-item" id="menu-profile">
          <i class="fa-solid fa-user leading"></i><span>Profile</span>
        </div>
        <div class="sl-settings-item" id="menu-logout">
          <i class="fa-solid fa-right-from-bracket leading"></i><span>Log Out</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.querySelector('.sl-menu-backdrop').addEventListener('click', () => el.remove());
  document.getElementById('menu-theme').addEventListener('click', () => {
    toggleTheme();
    el.remove();
  });
  document.getElementById('menu-profile').addEventListener('click', () => {
    el.remove();
    window.location.hash = '#/profile';
  });
  document.getElementById('menu-logout').addEventListener('click', async () => {
    const { clearTokens } = await import('../api.js');
    clearTokens();
    el.remove();
    window.location.href = window.location.pathname;
  });
}
