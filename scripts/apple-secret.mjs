#!/usr/bin/env node
/**
 * Il «Secret Key (for OAuth)» del provider Apple su Supabase.
 *
 * Serve solo all'accesso con Apple SUL SITO (nell'app iPhone si passa dal
 * foglio nativo e il secret non c'entra). E' un JWT firmato con la chiave
 * «Sign in with Apple» (il file .p8): Apple non accetta che duri piu' di
 * 6 mesi, quindi VA RIFATTO ogni 6 mesi, se no l'accesso con Apple dal sito
 * smette di funzionare.
 *
 * Si lancia SUL PROPRIO COMPUTER, dove sta il file .p8. Il file non si
 * carica da nessuna parte e non si incolla in chat: lo legge solo questo
 * script, e il risultato si incolla SOLO su Supabase.
 *
 *   node scripts/apple-secret.mjs ~/Downloads/AuthKey_4AQX3MQX53.p8
 *
 * Poi: Supabase -> Authentication -> Sign In / Providers -> Apple ->
 * «Secret Key (for OAuth)» -> incolla la riga lunga -> Save.
 *
 * Valori fissi (si cambiano con le opzioni, se un giorno servisse):
 *   --team 8VQ5WP5Y4L  --key 4AQX3MQX53  --client site.fantatitano.web  --giorni 180
 */
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';

const args = process.argv.slice(2);
const opz = (nome, base) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : base; };
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!file) {
  console.error('Manca il file della chiave. Esempio: node scripts/apple-secret.mjs ~/Downloads/AuthKey_4AQX3MQX53.p8');
  process.exit(1);
}
const team = opz('team', '8VQ5WP5Y4L');
const kid = opz('key', (file.match(/AuthKey_([A-Z0-9]{10})\.p8$/) || [])[1] || '4AQX3MQX53');
const client = opz('client', 'site.fantatitano.web');
const giorni = Math.min(Number(opz('giorni', 180)), 180);   // Apple: al massimo 6 mesi

let chiave;
try { chiave = createPrivateKey(readFileSync(file, 'utf8')); } catch (e) {
  console.error(`Non riesco a leggere la chiave da ${file}: ${e.message}`);
  process.exit(1);
}
const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
const ora = Math.floor(Date.now() / 1000);
const scade = ora + giorni * 86400;
const testa = b64u({ alg: 'ES256', kid, typ: 'JWT' });
const corpo = b64u({ iss: team, iat: ora, exp: scade, aud: 'https://appleid.apple.com', sub: client });
const firma = sign('sha256', Buffer.from(`${testa}.${corpo}`), { key: chiave, dsaEncoding: 'ieee-p1363' }).toString('base64url');

// la riga da incollare va da sola su stdout; il resto su stderr
console.log(`${testa}.${corpo}.${firma}`);
const data = new Date(scade * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
console.error(`\nSecret per ${client} (team ${team}, chiave ${kid}).`);
console.error(`SCADE IL ${data}: prima di quella data rilancia questo comando e incolla il nuovo su Supabase.`);
console.error('Incollalo SOLO su Supabase (Apple -> Secret Key for OAuth), non in chat.');
