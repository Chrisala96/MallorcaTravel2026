#!/usr/bin/env node
// Verschlüsselt private/private-data.json → data/private.enc.json
// Nutzung:
//   node tools/encrypt.mjs --generate          → schlägt ein neues zufälliges Reise-Passwort vor
//   node tools/encrypt.mjs "dein-passwort"     → verschlüsselt mit diesem Passwort
// Benötigt Node.js 20 oder neuer. Die Klartextdatei private/ ist in .gitignore ausgeschlossen.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encryptJson, decryptJson, normalizePassphrase } from '../js/crypto.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORDS = ('anker ahorn bucht brise dorf dune ebbe eiche fels feder flut garten hafen insel kiesel klippe kompass koralle '
  + 'lagune leuchte mandel meer mole muschel nebel olive orange palme pinie quelle rakete regatta riff rose sand segel sonne '
  + 'strand tanne tinte turm ufer wal welle wind zitrone zypresse boje delfin fjord grotte himmel jacht kap lotse mast '
  + 'nordwind oase pirat rudern salz schoner seestern tang tide vogel wolke zeder piste kurve motor rennen boxen gipfel '
  + 'eifel ring brezel fahne helm kette ventil tunnel lenker reifen spoiler tacho turbo zylinder bergab bergauf').split(/\s+/);

function generate(n = 6) {
  const out = [];
  const rnd = new Uint32Array(n + 1);
  globalThis.crypto.getRandomValues(rnd);
  for (let i = 0; i < n; i++) out.push(WORDS[rnd[i] % WORDS.length]);
  out.push(String(rnd[n] % 100).padStart(2, '0'));
  return out.join('-');
}

const arg = process.argv[2];
if (!arg || arg === '--help') {
  console.log('Nutzung: node tools/encrypt.mjs --generate | "passwort"');
  process.exit(1);
}
if (arg === '--generate') {
  console.log(generate());
  process.exit(0);
}
const pass = normalizePassphrase(arg);
if (pass.length < 20) { console.error('Passwort zu kurz (mind. 20 Zeichen). Tipp: --generate'); process.exit(1); }

const plain = JSON.parse(await readFile(join(root, 'private/private-data.json'), 'utf8'));
const box = await encryptJson(plain, pass);
// Selbsttest
const back = await decryptJson(box, pass);
if (JSON.stringify(back) !== JSON.stringify(plain)) throw new Error('Selbsttest fehlgeschlagen');
await writeFile(join(root, 'data/private.enc.json'), JSON.stringify(box) + '\n');
console.log('✓ data/private.enc.json geschrieben und erfolgreich testweise entschlüsselt.');
console.log('  Freischalt-Link: <APP-URL>#k=' + encodeURIComponent(pass));
