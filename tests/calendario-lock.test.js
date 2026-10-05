/**
 * La migrazione del calendario dei lock deve essere quella generata dal
 * calendario dell'app: se qualcuno cambia src/data.js e non rigenera, il
 * server chiuderebbe le formazioni in un giorno diverso da quello che l'app
 * mostra — il guasto silenzioso che la 004 racconta.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESTINAZIONE, righeLock, sqlCalendarioLock } from '../scripts/genera-lock.mjs';

test('la migrazione 012 e\' aggiornata al calendario dell\'app', () => {
  const suDisco = readFileSync(DESTINAZIONE, 'utf8');
  assert.equal(suDisco, sqlCalendarioLock(), 'rigenera con: node scripts/genera-lock.mjs');
});

test('trenta giornate, una per numero, in ordine e con date crescenti', () => {
  const r = righeLock();
  assert.equal(r.length, 30);
  assert.deepEqual(r.map((x) => x.matchday), Array.from({ length: 30 }, (_, i) => i + 1));
  for (let i = 1; i < r.length; i++) assert.ok(new Date(r[i].lock_at) > new Date(r[i - 1].lock_at), `giornata ${i + 1} non dopo la ${i}`);
});

test('il file e\' ripetibile: riscrive solo le date diverse', () => {
  assert.match(sqlCalendarioLock(), /on conflict \(matchday\) do update/);
  assert.match(sqlCalendarioLock(), /is distinct from excluded\.lock_at/);
});

// L'8a giornata comincia sabato 7 novembre alle 14:00: con le 15:00 secche il
// lock cadeva un'ora DOPO il calcio d'inizio, e si schierava sapendo chi aveva
// gia' segnato.
test('nessun lock dopo il calcio d\'inizio della prima partita della sua giornata', async () => {
  const { CALENDARIO } = await import('../src/calendario-dati.js');
  const primo = {};
  for (const [g, , , iso] of CALENDARIO) {
    const t = Date.parse(iso);
    if (Number.isFinite(t) && t > 0 && !(primo[g] <= t)) primo[g] = t;
  }
  assert.ok(Object.keys(primo).length >= 5, 'servono giornate con gli orari');
  for (const r of righeLock()) {
    if (primo[r.matchday] === undefined) continue;
    assert.ok(Date.parse(r.lock_at) <= primo[r.matchday],
      `giornata ${r.matchday}: lock ${r.lock_at} dopo il primo calcio d'inizio ${new Date(primo[r.matchday]).toISOString()}`);
  }
});
