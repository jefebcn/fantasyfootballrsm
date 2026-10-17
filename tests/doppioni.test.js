// Lo stesso calciatore in vendita due volte (Tordella 13/10, Piscitella 17/10):
// i voti vanno a uno, chi ha comprato l'altro non prende niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSeason } from '../src/data.js';

const base = buildSeason();
const parole = (p) => `${p.firstName} ${p.lastName}`.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1).sort().join(' ');

test('nessun calciatore compare due volte nella stessa società con le stesse parole nel nome', () => {
  const visti = new Map();
  for (const p of base.players.filter((x) => !x.doppioneDi)) {
    const k = `${p.clubId}|${parole(p)}`;
    assert.ok(!visti.has(k), `${p.id} e ${visti.get(k)} sono lo stesso nome: segnalo come doppione`);
    visti.set(k, p.id);
  }
});

test('un doppione punta a un giocatore vero della stessa società', () => {
  const perId = new Map(base.players.map((p) => [p.id, p]));
  for (const p of base.players.filter((x) => x.doppioneDi)) {
    const vero = perId.get(p.doppioneDi);
    assert.ok(vero, `${p.id}: ${p.doppioneDi} non esiste`);
    assert.equal(vero.clubId, p.clubId, `${p.id}: il vero è di un'altra società`);
    assert.ok(!vero.doppioneDi, `${p.id}: punta a un altro doppione`);
  }
  assert.equal(perId.get('virtus_25').doppioneDi, 'virtus_14');
  assert.equal(perId.get('virtus_14').role, 'A');
});

test('il listino del database ha tutti i giocatori in vendita e nessun doppione', () => {
  const sql = readFileSync(new URL('../supabase/seed-quotazioni.sql', import.meta.url), 'utf8');
  const nelListino = new Set([...sql.matchAll(/^\s+\('([a-z]+_\d+)', '([PDCA])'/gm)].map((m) => `${m[1]}|${m[2]}`));
  for (const p of base.players) {
    const c = `${p.id}|${p.role}`;
    if (p.doppioneDi) assert.ok(![...nelListino].some((x) => x.startsWith(`${p.id}|`)), `${p.id} è un doppione ma è in vendita`);
    else assert.ok(nelListino.has(c), `${p.id} (${p.role}) manca dal listino o ha un altro ruolo: rigenera con scripts/genera-quotazioni.mjs`);
  }
});
