// Entsperren der privaten Buchungsdaten. Die verschlüsselte Datei liegt öffentlich im Repo,
// der Klartext existiert nur lokal im Browser nach Eingabe des Reise-Passworts.
import { decryptJson } from './crypto.js';
import * as M from './model.js';

function validate(obj) {
  if (!obj || obj.version !== 1 || !obj.hotel || !obj.sixt || !obj.villa) throw new Error('Datei hat nicht das erwartete Format');
  return obj;
}

export async function unlockWithPassphrase(pass) {
  let box;
  try {
    const res = await fetch('data/private.enc.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error();
    box = await res.json();
  } catch { throw new Error('Verschlüsselte Datei nicht erreichbar – Internetverbindung prüfen.'); }
  const data = validate(await decryptJson(box, pass));
  M.state.priv = data;
  await M.save('priv');
  return data;
}

export async function importPrivateFile(file) {
  if (!file) throw new Error('Keine Datei gewählt');
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { throw new Error('Datei ist kein gültiges JSON'); }
  M.state.priv = validate(obj);
  await M.save('priv');
}

export async function lockPrivate() {
  M.state.priv = null;
  await M.save('priv');
}
