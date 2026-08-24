// ============================================================
// SNICKYLINK End-to-End Encryption
// Real cryptography via the browser's native Web Crypto API:
//   - ECDH (P-256) for key agreement between the two partners
//   - AES-GCM (256-bit) for message encryption
// The private key NEVER leaves this device. The server only ever
// stores/relays ciphertext + iv. There is no server-side decryption
// path anywhere in this app — chat content is architecturally opaque
// to the backend, community feed, leaderboard, analytics, and admin.
// ============================================================

const DB_NAME = 'snickylink_e2ee';
const STORE_NAME = 'keys';

function openKeyStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openKeyStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openKeyStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Namespace the keypair per logged-in user. Without this, two different
// SnickyLink accounts used on the same browser/device (e.g. testing both
// partners on one machine) would silently overwrite each other's keypair
// in IndexedDB and permanently break decryption for both. Falls back to
// 'anon' only in the brief pre-login window (never actually used to encrypt).
async function getUserId() {
  try {
    const { state } = await import('./store.js');
    return state.user?.id || 'anon';
  } catch {
    return 'anon';
  }
}

/**
 * Generate (once per device+account) or load this user's ECDH keypair.
 */
export async function ensureKeyPair() {
  const uid = await getUserId();
  const storageKey = `keypair:${uid}`;
  let stored = await idbGet(storageKey);
  if (stored) return stored;

  const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  stored = { publicKeyJwk, privateKeyJwk };
  await idbSet(storageKey, stored);
  return stored;
}

export async function getPublicKeyJwk() {
  const kp = await ensureKeyPair();
  return kp.publicKeyJwk;
}

async function importPrivateKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
}

async function importPublicKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

/**
 * Derive the shared AES-GCM key with the partner via ECDH.
 * Cached in-memory per session (re-derived if partnerPublicKeyJwk changes).
 */
let cachedSharedKey = null;
let cachedPartnerFingerprint = null;

export async function getSharedKey(partnerPublicKeyJwk) {
  if (!partnerPublicKeyJwk) return null;
  const fingerprint = JSON.stringify(partnerPublicKeyJwk);
  if (cachedSharedKey && cachedPartnerFingerprint === fingerprint) return cachedSharedKey;

  const kp = await ensureKeyPair();
  const privateKey = await importPrivateKey(kp.privateKeyJwk);
  const partnerPublicKey = await importPublicKey(partnerPublicKeyJwk);

  const sharedKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: partnerPublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedSharedKey = sharedKey;
  cachedPartnerFingerprint = fingerprint;
  return sharedKey;
}

/**
 * Self-derived key: ECDH(my private key, my own public key). Used as a
 * fallback so a message is never "lost" from the sender's own point of view
 * before the partner's public key has synced to the server. This key is
 * device-local and NOT shared with the partner — it only ever needs to
 * round-trip through the sender's own client.
 */
let cachedSelfKey = null;
let cachedSelfKeyUserId = null;

async function getSelfSharedKey() {
  const uid = await getUserId();
  if (cachedSelfKey && cachedSelfKeyUserId === uid) return cachedSelfKey;
  const kp = await ensureKeyPair();
  const publicKey = await importPublicKey(kp.publicKeyJwk);
  const privateKey = await importPrivateKey(kp.privateKeyJwk);
  const key = await crypto.subtle.deriveKey({ name: 'ECDH', public: publicKey }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  cachedSelfKey = key;
  cachedSelfKeyUserId = uid;
  return key;
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encryptMessage(plaintext, partnerPublicKeyJwk) {
  const key = await getSharedKey(partnerPublicKeyJwk);
  if (!key) throw new Error('No shared key available — partner has not set up encryption yet');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return { ciphertext: toBase64(ciphertextBuf), iv: toBase64(iv) };
}

/**
 * Decrypt a message. Tries the real partner-shared key first (the correct
 * path once both partners' public keys have synced), then falls back to the
 * sender's own self-derived key (covers messages sent via selfEncrypt while
 * waiting on the partner's key). This fixes the bug where a just-sent
 * message would permanently show "Waiting for encryption setup…" — that
 * placeholder was previously returned unconditionally whenever partnerKey
 * was missing, even for the sender's own decryptable messages.
 */
export async function decryptMessage(ciphertext, iv, partnerPublicKeyJwk) {
  if (partnerPublicKeyJwk) {
    try {
      const key = await getSharedKey(partnerPublicKeyJwk);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(ciphertext));
      return new TextDecoder().decode(decrypted);
    } catch {
      // fall through to self-key attempt below
    }
  }
  try {
    const key = await getSelfSharedKey();
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(ciphertext));
    return new TextDecoder().decode(decrypted);
  } catch {
    // genuinely can't decrypt with any key this device holds
  }
  return partnerPublicKeyJwk
    ? '🔒 Unable to decrypt (key mismatch)'
    : '🔒 Waiting for your partner to open the app and finish linking encryption…';
}

/**
 * Fallback for solo mode / before partner joins: encrypt to self so messages
 * sent before the partner's key exists aren't lost from the UI's perspective.
 * Once partner's key syncs, new messages use the real shared key automatically.
 * Messages sent this way are decryptable by the sender (via the self-key
 * fallback in decryptMessage) but NOT by the partner until re-sent after
 * their key syncs — this is expected E2EE behavior, not a bug.
 */
export async function selfEncrypt(plaintext) {
  const key = await getSelfSharedKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: toBase64(ciphertextBuf), iv: toBase64(iv), selfEncrypted: true };
}
