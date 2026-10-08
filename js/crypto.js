// Ver-/Entschlüsselung der privaten Buchungsdaten (AES-256-GCM, Schlüssel per PBKDF2-SHA256).
// Läuft identisch im Browser und in Node 20+ (globalThis.crypto.subtle).
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Gross-/Kleinschreibung, Leerzeichen und Bindestriche spielen bei der Eingabe keine Rolle. */
export const normalizePassphrase = (p) => String(p || '').trim().toLowerCase().replace(/[\s_\-–—]+/g, '-');

async function deriveKey(pass, salt, iter) {
  const base = await subtle.importKey('raw', enc.encode(normalizePassphrase(pass)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(obj, pass, iter = 600000) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, iter);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { v: 1, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

export async function decryptJson(box, pass) {
  if (!box || box.v !== 1) throw new Error('Unbekanntes Format');
  const key = await deriveKey(pass, unb64(box.salt), box.iter);
  let pt;
  try { pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct)); }
  catch { throw new Error('Passwort falsch'); }
  return JSON.parse(dec.decode(pt));
}
