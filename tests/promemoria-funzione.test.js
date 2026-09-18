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
          : Promise.resolve({ data: [], error: null })),
        update: () => ({ in: async () => ({}) }),
      };
    },
    rpc: async () => ({ data: [], error: null }),
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
  rompi = null;
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
