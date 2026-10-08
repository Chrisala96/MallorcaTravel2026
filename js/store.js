// Lokale Speicherung in IndexedDB (nur auf diesem Gerät, keine Synchronisation).
const DB_NAME = 'travel-companion-2026';
const DB_VERSION = 1;
let dbPromise = null;
let memory = null; // Fallback, falls IndexedDB nicht verfügbar ist (z. B. privater Modus in alten Browsern)

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch { memory = { kv: new Map(), docs: new Map() }; resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { memory = { kv: new Map(), docs: new Map() }; resolve(null); };
  });
  return dbPromise;
}

const tx = (db, store, mode, fn) => new Promise((resolve, reject) => {
  const t = db.transaction(store, mode);
  const s = t.objectStore(store);
  const r = fn(s);
  t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
  t.onerror = () => reject(t.error);
  t.onabort = () => reject(t.error);
});

export const storageIsPersistent = () => !memory;

export async function get(key, fallback = null) {
  const db = await open();
  if (!db) return memory.kv.has(key) ? structuredClone(memory.kv.get(key)) : fallback;
  const v = await tx(db, 'kv', 'readonly', (s) => s.get(key));
  return v === undefined ? fallback : v;
}
export async function set(key, value) {
  const db = await open();
  if (!db) { memory.kv.set(key, structuredClone(value)); return; }
  await tx(db, 'kv', 'readwrite', (s) => s.put(value, key));
}
export async function del(key) {
  const db = await open();
  if (!db) { memory.kv.delete(key); return; }
  await tx(db, 'kv', 'readwrite', (s) => s.delete(key));
}
export async function allKv() {
  const db = await open();
  if (!db) return Object.fromEntries(memory.kv);
  const keys = await tx(db, 'kv', 'readonly', (s) => s.getAllKeys());
  const vals = await tx(db, 'kv', 'readonly', (s) => s.getAll());
  return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
}

/* Dokumente (PDF) */
export async function listDocs() {
  const db = await open();
  const all = db ? await tx(db, 'docs', 'readonly', (s) => s.getAll()) : [...memory.docs.values()];
  return all.sort((a, b) => b.added - a.added);
}
export async function putDoc(doc) {
  const db = await open();
  if (!db) { memory.docs.set(doc.id, doc); return; }
  await tx(db, 'docs', 'readwrite', (s) => s.put(doc));
}
export async function getDoc(id) {
  const db = await open();
  if (!db) return memory.docs.get(id);
  return tx(db, 'docs', 'readonly', (s) => s.get(id));
}
export async function delDoc(id) {
  const db = await open();
  if (!db) { memory.docs.delete(id); return; }
  await tx(db, 'docs', 'readwrite', (s) => s.delete(id));
}

/** Bittet den Browser, die Daten nicht automatisch zu löschen (falls unterstützt). */
export async function requestPersistence() {
  try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch {}
  return false;
}
