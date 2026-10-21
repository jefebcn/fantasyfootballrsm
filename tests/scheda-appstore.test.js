/**
 * La scheda dell'App Store sta nei limiti di Apple, e quello che promette c'e'.
 *
 * Stessa ragione della prova gemella per Play: i limiti (nome e sottotitolo
 * 30, testo promozionale 170, parole chiave 100, descrizione 4000) si
 * scoprono incollando, il giorno che si ha il Mac in prestito e poco tempo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const SCHEDA = 'store/scheda-appstore.md';
const testo = readFileSync(SCHEDA, 'utf8');

function blocco(titolo) {
  const i = testo.indexOf(`## ${titolo}`);
  assert.ok(i >= 0, `manca la sezione "${titolo}" in ${SCHEDA}`);
  const apre = testo.indexOf('```', i);
  const chiude = testo.indexOf('```', apre + 3);
  assert.ok(apre > 0 && chiude > apre, `la sezione "${titolo}" non ha un blocco di testo`);
  return testo.slice(apre + 3, chiude).trim();
}

for (const [titolo, max] of [['Nome', 30], ['Sottotitolo', 30], ['Testo promozionale', 170], ['Parole chiave', 100], ['Descrizione', 4000]]) {
  test(`App Store, ${titolo}: sta nei ${max} caratteri`, () => {
    const t = blocco(titolo);
    assert.ok(t.length > 0, `${titolo} e' vuoto`);
    assert.ok(t.length <= max, `${titolo} e' lungo ${t.length}, il limite e' ${max}`);
  });
}

test('App Store: parole chiave senza spazi dopo le virgole e senza doppioni', () => {
  const k = blocco('Parole chiave');
  assert.doesNotMatch(k, /, /, 'lo spazio dopo la virgola spreca caratteri');
  const parole = k.split(',');
  assert.equal(new Set(parole).size, parole.length, 'ci sono parole ripetute');
});

test('App Store: le pagine indicate nella scheda esistono e vanno online', () => {
  const elenco = readFileSync('scripts/costruisci.mjs', 'utf8');
  for (const f of ['assistenza.html', 'privacy.html', 'cancella-account.html']) {
    assert.ok(existsSync(f), `${f} non c'e'`);
    assert.ok(elenco.includes(`'${f}'`), `${f} non e' nell'elenco di costruisci.mjs: non andrebbe online`);
  }
  assert.match(readFileSync('assistenza.html', 'utf8'), /support@fantatitano\.site/, 'la pagina di assistenza deve avere un recapito');
});

/** Misure e canale alfa di un PNG, dall'intestazione IHDR. */
function png(file) {
  const d = readFileSync(file);
  return { w: d.readUInt32BE(16), h: d.readUInt32BE(20), alfa: d[25] === 4 || d[25] === 6 };
}

test('App Store: l\'icona e\' 1024x1024 e senza trasparenza', () => {
  for (const f of ['store/ios/icona-1024.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png']) {
    const { w, h, alfa } = png(f);
    assert.equal(`${w}x${h}`, '1024x1024', `${f} e' ${w}x${h}`);
    assert.equal(alfa, false, `${f} ha il canale alfa: Apple la rifiuta`);
  }
});

test('progetto iOS: apre fantatitano.site e il bundle id e\' lo stesso dappertutto', () => {
  const cfg = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
  assert.equal(cfg.server.url, 'https://fantatitano.site');
  const pbx = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
  assert.match(pbx, new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = ${cfg.appId.replace(/\./g, '\\.')};`));
  assert.match(pbx, /TARGETED_DEVICE_FAMILY = 1;/, 'solo iPhone: con l\'iPad servirebbero anche i suoi screenshot');
  const plist = readFileSync('ios/App/App/Info.plist', 'utf8');
  assert.match(plist, /<key>WKAppBoundDomains<\/key>\s*<array>\s*<string>fantatitano\.site<\/string>/);
  assert.match(plist, /remote-notification/);
  const ent = readFileSync('ios/App/App/App.entitlements', 'utf8');
  assert.match(ent, /aps-environment/);
  assert.match(ent, /applinks:fantatitano\.site/);
});
