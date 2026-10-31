// Il telefono dorme, il token scade, al risveglio la prima richiesta torna
// 401 «JWT expired»: si rinnova la sessione e la si rifa' una volta (13-14/10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rinnovaSeScaduto } from '../src/backend.js';

const risposta = (status, corpo) => new Response(corpo, { status });
const REST = 'https://x.supabase.co/rest/v1/profiles?id=eq.1';

test('token scaduto: si rinnova e si rifa\' la richiesta col token nuovo', async () => {
  const chiamate = [];
  const f = rinnovaSeScaduto(async (url, init) => {
    chiamate.push(new Headers(init.headers).get('Authorization'));
    return chiamate.length === 1 ? risposta(401, '{"code":"PGRST301","message":"JWT expired"}') : risposta(200, '[]');
  }, async () => 'nuovo');
  const r = await f(REST, { headers: { Authorization: 'Bearer vecchio' } });
  assert.equal(r.status, 200);
  assert.deepEqual(chiamate, ['Bearer vecchio', 'Bearer nuovo']);
});

test('un 401 che non e\' di token scaduto non si ripete', async () => {
  let n = 0;
  const f = rinnovaSeScaduto(async () => { n++; return risposta(401, '{"message":"permission denied"}'); }, async () => 'nuovo');
  assert.equal((await f(REST, {})).status, 401);
  assert.equal(n, 1);
});

test('se il rinnovo non riesce resta la risposta di prima', async () => {
  let n = 0;
  const f = rinnovaSeScaduto(async () => { n++; return risposta(401, 'JWT expired'); }, async () => null);
  assert.equal((await f(REST, {})).status, 401);
  assert.equal(n, 1);
});

test('le richieste di autenticazione non passano di qui', async () => {
  let n = 0;
  const f = rinnovaSeScaduto(async () => { n++; return risposta(401, 'JWT expired'); }, async () => 'nuovo');
  await f('https://x.supabase.co/auth/v1/token', {});
  assert.equal(n, 1);
});

test('la formazione rifiutata dopo il lock dice che la consegna e\' chiusa', async () => {
  const { translate } = await import('../src/backend.js');
  const m = translate({ message: 'new row violates row-level security policy for table "lineups"' });
  assert.match(m, /consegna per questa giornata è chiusa/);
  assert.equal(translate({ message: 'new row violates row-level security policy for table "profiles"' }), 'new row violates row-level security policy for table "profiles"');
});
