/**
 * La funzione del promemoria, provata davvero.
 *
 * Gira su Deno dentro Supabase, quindi qui non ci girerebbe: i tipi e
 * l'oggetto Deno non esistono in node. Ma il pezzo che si e' rotto due volte
 * in un giorno — leggere tre secret e montare le chiavi VAPID — non ha niente
 * di Deno dentro, e lasciarlo senza prove significa scoprire i guasti dal
 * registro di un'azione pianificata, un tentativo alla volta.
 *
 * Allora si prende il VERO index.ts, gli si togliono i tipi con esbuild, si
 * sostituiscono i due import npm: e l'oggetto Deno con degli stub, e si
 * esegue. Nessuna copia del codice: se qualcuno cambia la funzione, cambia
 * quello che queste prove eseguono.
 *
 * Non provano il database ne' la spedizione (li' servirebbe Supabase vero):
 * provano le risposte quando la configurazione e' storta, che e' l'unica
 * cosa che finora e' andata storta.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import webpush from 'web-push';

const ambiente = {};
let rompi = null;
// per le prove dell'iPhone: un lock fra 5 ore e chi va avvisato
let lockFinti = [];
let genteFinta = [];
const segnati = { morti: [], rifare: [] };

globalThis.__banco = {
  webpush,
  ambiente,
  createClient: () => ({
    from: () => {
      if (rompi) throw new Error(rompi);
      return {
        // select() normale e' una promessa; con { head: true } e' la conta,
        // che la funzione incatena con .is().
        select: (_c, opts) => (opts?.head
          ? { is: async () => ({ count: 2, error: null }) }
          : Promise.resolve({ data: lockFinti, error: null })),
        update: () => ({ in: async (_c, lista) => { segnati.morti.push(...lista); return {}; } }),
      };
    },
    rpc: async (nome, p) => {
      if (nome === 'promemoria_da_rifare') { segnati.rifare.push(...p.p_endpoints); return { data: p.p_endpoints.length, error: null }; }
      return { data: genteFinta, error: null };
    },
  }),
};

const sorgente = new URL('../supabase/functions/promemoria/index.ts', import.meta.url);
const { code } = await transform(readFileSync(sorgente, 'utf8'), {
  loader: 'ts', format: 'esm', target: 'es2022',
});

// Gli import npm: via, e al loro posto quello che il banco tiene pronto. Il
// modulo si importa da una data: URL e non da un file: non lascia niente in
// giro, e non c'e' un file temporaneo che qualcuno possa trovarsi davanti
// senza capire da dove arriva.
const fonte = `
const webpush = globalThis.__banco.webpush;
const createClient = globalThis.__banco.createClient;
const ambiente = globalThis.__banco.ambiente;
let maniglia;
globalThis.Deno = { env: { get: (n) => ambiente[n] }, serve: (h) => { maniglia = h; } };
${code.replace(/^import .*?from ["']npm:.*?["'];?$/gm, '')}
export const chiama = (token) => maniglia(new Request('http://x/promemoria-', {
  headers: token === undefined ? {} : { 'x-promemoria-token': token },
}));
`;
const { chiama } = await import(
  'data:text/javascript;base64,' + Buffer.from(fonte).toString('base64')
);

const chiavi = webpush.generateVAPIDKeys();
const buone = {
  PROMEMORIA_TOKEN: 'segreto',
  VAPID_PUBLIC_KEY: chiavi.publicKey,
  VAPID_PRIVATE_KEY: chiavi.privateKey,
  VAPID_SUBJECT: 'mailto:tizio@example.org',
};

/** Rimette l'ambiente da zero: i casi non si devono sporcare fra loro. */
const con = (env) => {
  rompi = null; lockFinti = []; genteFinta = []; segnati.morti = []; segnati.rifare = [];
  for (const k of Object.keys(ambiente)) delete ambiente[k];
  Object.assign(ambiente, env);
};

const risposta = async (token = 'segreto') => {
  const r = await chiama(token);
  return { stato: r.status, corpo: await r.text() };
};

test('configurazione a posto: risponde 200 e non spedisce niente', async () => {
  con(buone);
  const { stato, corpo } = await risposta();
  assert.equal(stato, 200);
  assert.match(corpo, /nessun lock nella finestra/);
  // e dice quanti telefoni sono iscritti, che da fuori non si puo' sapere
  assert.match(corpo, /"iscritti":2/);
});

test('token sbagliato: 401, e non si confonde col token mancante', async () => {
  con(buone);
  const { stato, corpo } = await risposta('un altro');
  assert.equal(stato, 401);
  assert.equal(corpo, 'token non valido');
});

test('token assente dai secret: 500 e dice dove si mette', async () => {
  con({ ...buone, PROMEMORIA_TOKEN: undefined });
  const { stato, corpo } = await risposta();
  assert.equal(stato, 500);
  assert.match(corpo, /PROMEMORIA_TOKEN non e' fra i secret/);
});

test('un ritorno a capo nel token non fa fallire il confronto', async () => {
  con({ ...buone, PROMEMORIA_TOKEN: 'segreto\n' });
  assert.equal((await risposta('segreto')).stato, 200);
});

test('chiave VAPID mancante: dice QUALE, non "chiavi non configurate"', async () => {
  con({ ...buone, VAPID_PRIVATE_KEY: undefined });
  const { stato, corpo } = await risposta();
  assert.equal(stato, 500);
  assert.match(corpo, /VAPID_PRIVATE_KEY/);
  assert.doesNotMatch(corpo, /VAPID_PUBLIC_KEY":/);
});

test('se mancano tutte e due le nomina tutte e due', async () => {
  con({ PROMEMORIA_TOKEN: 'segreto' });
  const { corpo } = await risposta();
  assert.match(corpo, /VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY/);
});

// I tre casi che finivano in "Internal Server Error" nudo. Non sono ipotesi:
// sono i modi in cui web-push 3.6.7 lancia davvero.
test('una chiave incollata col ritorno a capo funziona lo stesso', async () => {
  con({ ...buone, VAPID_PUBLIC_KEY: `${chiavi.publicKey}\n`, VAPID_PRIVATE_KEY: ` ${chiavi.privateKey} ` });
  assert.equal((await risposta()).stato, 200);
});

test('un indirizzo e-mail nudo come VAPID_SUBJECT non ferma i promemoria', async () => {
  con({ ...buone, VAPID_SUBJECT: 'support@fantatitano.site' });
  assert.equal((await risposta()).stato, 200);
});

test('chiavi scambiate: 500 con le lunghezze, che mostrano lo scambio', async () => {
  con({ ...buone, VAPID_PUBLIC_KEY: chiavi.privateKey, VAPID_PRIVATE_KEY: chiavi.publicKey });
  const { stato, corpo } = await risposta();
  assert.equal(stato, 500);
  assert.match(corpo, /web-push le rifiuta/);
  assert.match(corpo, /"VAPID_PUBLIC_KEY":43/);
  assert.match(corpo, /"VAPID_PRIVATE_KEY":87/);
  // E il valore delle chiavi non esce mai nella risposta.
  assert.doesNotMatch(corpo, new RegExp(chiavi.privateKey.slice(0, 12)));
});

test('un guasto imprevisto esce leggibile, non come Internal Server Error', async () => {
  con(buone);
  rompi = 'il database ha sternutito';
  const { stato, corpo } = await risposta();
  assert.equal(stato, 500);
  assert.match(corpo, /eccezione non prevista/);
  assert.match(corpo, /sternutito/);
});

// ---- APP IPHONE: invio tramite Apple (APNs) ----
const { generateKeyPairSync, createVerify } = await import('node:crypto');
const coppia = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const p8 = coppia.privateKey.export({ type: 'pkcs8', format: 'pem' });
const conIphone = (extra = {}) => {
  con({ ...buone, APNS_KEY: p8, APNS_KEY_ID: 'ABC123DEFG', APNS_TEAM_ID: 'TEAM123456', ...extra });
  lockFinti = [{ matchday: 7, lock_at: new Date(Date.now() + 5 * 3600e3).toISOString() }];
  genteFinta = [{ user_id: 'u1', endpoint: 'apns:abcd1234', p256dh: 'apns', auth: 'apns', league_name: 'Titano Open', team_name: 'I Draghi' }];
};
const fetchVero = globalThis.fetch;
const conFetch = async (stato, corpo, fn) => {
  const viste = [];
  globalThis.fetch = async (url, init) => { viste.push({ url: String(url), init }); return new Response(corpo, { status: stato }); };
  try { await fn(); } finally { globalThis.fetch = fetchVero; }
  return viste;
};

test('iPhone: spedisce ad Apple con un gettone ES256 valido', async () => {
  conIphone();
  let corpo;
  const viste = await conFetch(200, '', async () => { corpo = (await risposta()).corpo; });
  assert.match(corpo, /"spedite":1/);
  assert.equal(viste.length, 1);
  const { url, init } = viste[0];
  assert.equal(url, 'https://api.push.apple.com/3/device/abcd1234');
  assert.equal(init.headers['apns-topic'], 'site.fantatitano.app');
  assert.equal(init.headers['apns-push-type'], 'alert');
  const [testa, carico, firma] = init.headers.authorization.replace('bearer ', '').split('.');
  assert.deepEqual(JSON.parse(Buffer.from(testa, 'base64url')), { alg: 'ES256', kid: 'ABC123DEFG' });
  assert.equal(JSON.parse(Buffer.from(carico, 'base64url')).iss, 'TEAM123456');
  const v = createVerify('SHA256'); v.update(`${testa}.${carico}`);
  assert.ok(v.verify({ key: coppia.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(firma, 'base64url')), 'la firma la accetterebbe Apple');
  const msg = JSON.parse(init.body);
  assert.match(msg.aps.alert.title, /Giornata 7/);
  assert.equal(msg.url, './#/rosa/formazione');
});

test('iPhone: dispositivo sparito (410) si segna e non si riprova', async () => {
  conIphone();
  await conFetch(410, JSON.stringify({ reason: 'Unregistered' }), () => risposta());
  assert.deepEqual(segnati.morti, ['apns:abcd1234']);
  assert.deepEqual(segnati.rifare, []);
});

test('iPhone: Apple non risponde, il promemoria si rimette in coda', async () => {
  conIphone();
  await conFetch(503, '', () => risposta());
  assert.deepEqual(segnati.rifare, ['apns:abcd1234']);
});

test('iPhone senza chiave APNs: non si perde, si rimette in coda e lo dice', async () => {
  conIphone({ APNS_KEY: undefined });
  let corpo;
  const viste = await conFetch(200, '', async () => { corpo = (await risposta()).corpo; });
  assert.equal(viste.length, 0);
  assert.match(corpo, /"iphone_senza_chiave_apns":1/);
  assert.deepEqual(segnati.rifare, ['apns:abcd1234']);
});

test('APNS_SANDBOX=1 usa il server di prova di Apple', async () => {
  conIphone({ APNS_SANDBOX: '1' });
  const viste = await conFetch(200, '', () => risposta());
  assert.match(viste[0].url, /^https:\/\/api\.sandbox\.push\.apple\.com\//);
});
