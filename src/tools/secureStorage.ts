/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UTIL.SECURE.STORAGE.AESGCM
   REGION: 🟠 UTIL
   VERSION: 1.0.0
   ============================================================================
   secureStorage.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

// Minimal secure storage helper using WebCrypto AES-GCM. Requires a passphrase
// to be supplied at runtime (not stored). This file provides encrypt/decrypt helpers
// and convenience get/set that fall back to plain localStorage when passphrase
// is not provided (with a console warning).

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptString(plain: string, passphrase: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  const payload = new Uint8Array(cipher);
  // return base64(salt + iv + cipher)
  const combined = new Uint8Array(salt.byteLength + iv.byteLength + payload.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.byteLength);
  combined.set(payload, salt.byteLength + iv.byteLength);
  let str = '';
  for (let i = 0; i < combined.length; i++) str += String.fromCharCode(combined[i]);
  return btoa(str);
}

export async function decryptString(b64: string, passphrase: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const salt = arr.slice(0, 16);
  const iv = arr.slice(16, 28);
  const payload = arr.slice(28);
  const key = await deriveKey(passphrase, salt);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, payload);
  const dec = new TextDecoder();
  return dec.decode(plainBuf);
}

export async function secureSetItem(key: string, value: string, passphrase?: string) {
  if (!passphrase) {
    console.warn('[secureStorage] No passphrase provided; writing plaintext to localStorage');
    localStorage.setItem(key, value);
    return;
  }
  const enc = await encryptString(value, passphrase);
  localStorage.setItem(key, enc);
}

export async function secureGetItem(key: string, passphrase?: string): Promise<string | null> {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  if (!passphrase) {
    console.warn('[secureStorage] No passphrase provided; reading plaintext from localStorage');
    return raw;
  }
  try {
    return await decryptString(raw, passphrase);
  } catch (e) {
    console.warn('[secureStorage] decrypt failed', e);
    return null;
  }
}
