// Il 13/10 una formazione con un posto vuoto ("") lasciato dalla 034 fermava
// il motore dei punteggi, e con lui l'app per tutta la lega. Un id vuoto o
// sconosciuto e' un posto scoperto, non un errore che blocca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLineupResult, defaultLineup } from '../src/engine.js';
import { buildSeason } from '../src/data.js';

const b = buildSeason();
const players = new Map(b.players.map((p) => [p.id, p]));

test('un posto vuoto o un giocatore sconosciuto non fermano il calcolo', () => {
  const rosa = b.players.filter((p) => p.isActive).slice(0, 25).map((p) => p.id);
  const l = defaultLineup(rosa, players);
  const conBuchi = { ...l, starters: ['', ...l.starters.slice(1, 10), 'nessuno_99'], bench: ['', ...l.bench], captainId: '' };
  const r = computeLineupResult({ lineup: conBuchi, ratings: new Map(), players, managerCount: 6, matchday: 6 });
  assert.ok(r && typeof r === 'object');
  assert.doesNotThrow(() => defaultLineup([...rosa, 'nessuno_99'], players));
});
