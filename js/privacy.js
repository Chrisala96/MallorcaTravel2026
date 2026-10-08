// Entsperren der privaten Buchungsdaten. Die verschlüsselte Datei liegt öffentlich im Repo,
// der Klartext existiert nur lokal im Browser nach Eingabe des Reise-Passworts.
//
// Zentrale Ergänzungen: Wird data/private.enc.json neu veröffentlicht (z. B. mit Gate, Villa-Adresse),
// holt sich jedes bereits entsperrte Gerät beim nächsten Öffnen mit Internet automatisch die neue Version.
// Dafür wird das Passwort lokal auf dem Gerät gespeichert – dort liegen die entschlüsselten Daten ohnehin.
import { decryptJson, normalizePassphrase } from './crypto.js';
import * as store from './store.js';
import * as M from './model.js';

function validate(obj) {
  if (!obj || obj.version !== 1 || !obj.hotel || !obj.sixt || !obj.villa) throw new Error('Datei hat nicht das erwartete Format');
  return obj;
}

async function fetchBox() {
  const res = await fetch('data/private.enc.json?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function unlockWithPassphrase(pass) {
  let box;
  try { box = await fetchBox(); } catch { throw new Error('Verschlüsselte Datei nicht erreichbar – Internetverbindung prüfen.'); }
  const data = validate(await decryptJson(box, pass));
  await store.set('privKey', normalizePassphrase(pass));
  await store.set('privStamp', box.ct.slice(0, 64));
  M.state.priv = data;
  await M.save('priv');
  return data;
}

/** Prüft beim Start, ob eine neuere zentrale Version vorliegt. Liefert true, wenn aktualisiert wurde. */
export async function refreshPrivate() {
  if (!M.state.priv || !navigator.onLine) return false;
  const key = await store.get('privKey');
  if (!key) return false;
  let box;
  try { box = await fetchBox(); } catch { return false; }
  if (!box?.ct || box.ct.slice(0, 64) === (await store.get('privStamp'))) return false;
  try {
    const data = validate(await decryptJson(box, key));
    M.state.priv = data;
    await store.set('privStamp', box.ct.slice(0, 64));
    await M.save('priv');
    return true;
  } catch {
    return 'password'; // Passwort wurde geändert → neu entsperren nötig, alte Daten bleiben erhalten
  }
}

export async function hasAutoRefresh() { return !!(await store.get('privKey')); }

export async function importPrivateFile(file) {
  if (!file) throw new Error('Keine Datei gewählt');
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { throw new Error('Datei ist kein gültiges JSON'); }
  M.state.priv = validate(obj);
  await store.del('privKey'); await store.del('privStamp');
  await M.save('priv');
}

export async function lockPrivate() {
  M.state.priv = null;
  await store.del('privKey'); await store.del('privStamp');
  await M.save('priv');
}
