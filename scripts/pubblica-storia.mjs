/**
 * Una storia su Instagram: carica il JPG nel secchio «storie» di Supabase
 * (Instagram vuole un indirizzo da cui prenderla) e la pubblica con l'API di
 * Instagram (accesso con Instagram, permesso instagram_business_content_publish).
 *
 *   node scripts/pubblica-storia.mjs file.jpg id-del-gol
 *
 * STORIE_GOL decide cosa succede:
 *   on        pubblica davvero
 *   altro     (o vuoto) prova: non carica e non pubblica, dice solo che lo farebbe
 * Cosi' l'interruttore sta in una variabile del repository, e spegnere tutto e'
 * cambiare una parola su GitHub (Settings → Variables).
 *
 * Segreti: SUPABASE_SERVICE_KEY, IG_USER_ID, IG_TOKEN. Il token dura 60 giorni:
 * lo script lo rinnova da solo quando ne mancano meno di 15 e tiene il nuovo
 * nella tabella social_token (047), che solo la service_role legge.
 *
 * Righe che scrive: PUBBLICATA, PROVA, GIA' FATTA, TETTO, ERRORE.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { SUPABASE_URL } from '../src/config.js';

const [file, id] = process.argv.slice(2);
if (!file || !id) { console.error('uso: pubblica-storia.mjs file.jpg id'); process.exit(2); }

const MODO = process.env.STORIE_GOL || 'prova';
const TETTO = Number(process.env.STORIE_GOL_TETTO || 40);   // al giorno: un errore che gira in tondo non riempie il profilo
const IG = `https://graph.instagram.com/${process.env.IG_API_VERSION || 'v25.0'}`;
const chiave = process.env.SUPABASE_SERVICE_KEY;
const db = (path, init = {}) => fetch(`${SUPABASE_URL}${path}`, {
  ...init, headers: { apikey: chiave, authorization: `Bearer ${chiave}`, ...(init.headers || {}) },
});
const esci = (riga, codice = 0) => { console.log(riga); process.exit(codice); };

if (MODO !== 'on') esci(`PROVA ${id} (STORIE_GOL=${MODO}: non pubblicata)`);
for (const k of ['SUPABASE_SERVICE_KEY', 'IG_USER_ID', 'IG_TOKEN']) if (!process.env[k]) esci(`ERRORE manca il segreto ${k}`, 1);

// --- gia' uscita? e quante oggi?
const gia = await (await db(`/rest/v1/storie_pubblicate?id=eq.${encodeURIComponent(id)}&select=id`)).json();
if (gia.length) esci(`GIA' FATTA ${id}`);
const mezzanotte = new Date(); mezzanotte.setUTCHours(0, 0, 0, 0);
const oggi = await db(`/rest/v1/storie_pubblicate?pubblicata_at=gte.${mezzanotte.toISOString()}&select=id`, { headers: { prefer: 'count=exact', range: '0-0' } });
const contate = Number((oggi.headers.get('content-range') || '/0').split('/')[1]) || 0;
if (contate >= TETTO) esci(`TETTO ${contate} storie oggi: ${id} non pubblicata`);

// --- il token, rinnovato se serve
async function token() {
  const r = await (await db('/rest/v1/social_token?rete=eq.instagram&select=token,scade_at')).json();
  let { token: t, scade_at: scade } = r[0] || { token: process.env.IG_TOKEN, scade_at: null };
  const giorni = scade ? (Date.parse(scade) - Date.now()) / 86400000 : 0;
  if (giorni < 15) {
    const n = await (await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${t}`)).json();
    if (n.access_token) {
      t = n.access_token;
      await db('/rest/v1/social_token', {
        method: 'POST', headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ rete: 'instagram', token: t, scade_at: new Date(Date.now() + n.expires_in * 1000).toISOString(), aggiornato_at: new Date().toISOString() }),
      });
    } else if (!r[0]) {
      // primo giro con il token appena messo nei segreti: lo si tiene com'e'
      await db('/rest/v1/social_token', {
        method: 'POST', headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ rete: 'instagram', token: t, scade_at: null }),
      });
    }
  }
  return t;
}

try {
  // --- l'immagine in un indirizzo pubblico
  const percorso = `${new Date().toISOString().slice(0, 10)}/${basename(file)}`;
  const su = await db(`/storage/v1/object/storie/${percorso}`, {
    method: 'POST', headers: { 'content-type': 'image/jpeg', 'x-upsert': 'true' }, body: readFileSync(file),
  });
  if (!su.ok) throw new Error(`caricamento: ${su.status} ${await su.text()}`);
  const url = `${SUPABASE_URL}/storage/v1/object/public/storie/${percorso}`;

  // --- contenitore, attesa che Instagram l'abbia preso, pubblicazione
  const t = await token();
  const io = process.env.IG_USER_ID;
  const c = await (await fetch(`${IG}/${io}/media`, {
    method: 'POST', body: new URLSearchParams({ media_type: 'STORIES', image_url: url, access_token: t }),
  })).json();
  if (!c.id) throw new Error(`contenitore: ${JSON.stringify(c.error || c)}`);
  for (let i = 0; i < 20; i++) {
    const s = await (await fetch(`${IG}/${c.id}?fields=status_code&access_token=${t}`)).json();
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`contenitore ${s.status_code}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  const p = await (await fetch(`${IG}/${io}/media_publish`, {
    method: 'POST', body: new URLSearchParams({ creation_id: c.id, access_token: t }),
  })).json();
  if (!p.id) throw new Error(`pubblicazione: ${JSON.stringify(p.error || p)}`);
  await db('/rest/v1/storie_pubblicate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, media_id: p.id, url }),
  });
  esci(`PUBBLICATA ${id} ${p.id}`);
} catch (e) {
  esci(`ERRORE ${id} ${e.message}`, 1);
}
