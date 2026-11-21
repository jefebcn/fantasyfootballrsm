/**
 * PUBBLICA UNA STORIA DEI GOL CON BUFFER (Alex, 20/11: «non riesco a verificare
 * per IG user id e IG token, possiamo fare con altro metodo?»).
 *
 * Il lavoro delle storie dei gol (.github/workflows/storie-gol.yml, tramite
 * scripts/pubblica-storia.mjs) manda qui il JPG di un gol. Questa funzione:
 *   1. controlla che a chiamare sia DAVVERO quel lavoro di questo repository:
 *      il lavoro presenta il suo token OIDC di GitHub (firmato da GitHub, dura
 *      pochi minuti), e qui si verifica firma, repository e file del lavoro.
 *      Nessuna chiave condivisa da custodire;
 *   2. non ripubblica un gol gia' uscito (storie_pubblicate) e tiene un tetto
 *      giornaliero, perche' un errore che gira in tondo non riempia il profilo;
 *   3. carica il JPG nel secchio pubblico «storie» (047);
 *   4. lo pubblica SUBITO come storia di @fantatitano con Buffer (shareNow),
 *      lo stesso Buffer dei post: niente verifica Meta e niente token Instagram.
 *
 * Secret (Edge Functions -> Secrets): BUFFER_TOKEN, la chiave API di Buffer
 * (Buffer -> Settings -> API). Il canale e' scritto qui sotto; se Buffer non
 * lo trova si cerca l'Instagram che si chiama «fantatitano» (mai
 * fantatitano.futsal). Una sola chiamata a Buffer per gol: Buffer blocca chi
 * ne fa troppe (20/11, finestra di 24 ore).
 *
 * Risponde { esito: PUBBLICATA | GIA' FATTA | TETTO | ERRORE, ... }.
 */
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const REPO = 'jefebcn/fantasyfootballrsm';
const LAVORO = `${REPO}/.github/workflows/storie-gol.yml@`;
const PUBBLICO = 'fantatitano-storie-gol';          // l'audience che il lavoro chiede a GitHub
const GITHUB = 'https://token.actions.githubusercontent.com';
const JWKS = createRemoteJWKSet(new URL(`${GITHUB}/.well-known/jwks`));
const NOME = /^[a-z0-9_-]{3,120}\.jpg$/;
const ID = /^[a-z0-9_-]{3,160}$/;
const MASSIMO = 8 * 1024 * 1024;
const TETTO = 40;                                     // storie al giorno
const BUFFER = 'https://api.buffer.com';

const esito = (e: string, altro: Record<string, unknown> = {}, status = 200) =>
  Response.json({ esito: e, ...altro }, { status });

// Il canale Instagram @fantatitano su Buffer, scritto qui (Alex, 21/11: «non
// farci piu' bloccare»): cercarlo costava due chiamate in piu' a ogni avvio
// della funzione. Se un giorno il canale cambia, si cerca di nuovo per nome.
let canale: string | null = Deno.env.get('BUFFER_CANALE') || '6afcb03bece6dfde5ffd4fbb';

async function buffer(token: string, query: string, variables: Record<string, unknown> = {}) {
  const r = await fetch(BUFFER, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) throw new Error(`Buffer ${r.status} ${JSON.stringify(j.errors || j).slice(0, 300)}`);
  return j.data;
}

async function trovaCanale(token: string) {
  if (canale) return canale;
  const a = await buffer(token, '{ account { organizations { id } } }');
  for (const o of a.account.organizations) {
    const c = await buffer(token, 'query($o:OrganizationId!){ channels(input:{organizationId:$o}) { id name service } }', { o: o.id });
    const giusto = c.channels.find((x: { name: string; service: string }) => x.service === 'instagram' && x.name === 'fantatitano');
    if (giusto) return (canale = giusto.id);
  }
  throw new Error('su Buffer non c\'e\' il canale Instagram «fantatitano»');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return esito('ERRORE', { motivo: 'solo POST' }, 405);

  // --- 1. chi chiama?
  try {
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { payload } = await jwtVerify(jwt, JWKS, { issuer: GITHUB, audience: PUBBLICO });
    if (payload.repository !== REPO || !String(payload.workflow_ref || '').startsWith(LAVORO)) throw new Error('lavoro sbagliato');
  } catch (e) {
    return esito('ERRORE', { motivo: `non autorizzato: ${(e as Error).message}` }, 401);
  }

  const token = (Deno.env.get('BUFFER_TOKEN') || '').trim();
  if (!token) return esito('ERRORE', { motivo: 'manca il secret BUFFER_TOKEN' }, 503);

  const u = new URL(req.url);
  const nome = u.searchParams.get('nome') || '';
  const id = u.searchParams.get('id') || '';
  const ai = u.searchParams.get('ai') !== '0';     // etichetta IA: no solo per le storie con la sola foto vera
  if (!NOME.test(nome) || !ID.test(id)) return esito('ERRORE', { motivo: 'nome o id non validi' }, 400);
  const corpo = new Uint8Array(await req.arrayBuffer());
  if (!corpo.length || corpo.length > MASSIMO) return esito('ERRORE', { motivo: 'immagine vuota o troppo grande' }, 413);
  if (corpo[0] !== 0xff || corpo[1] !== 0xd8) return esito('ERRORE', { motivo: 'non e\' un JPEG' }, 415);

  const url = Deno.env.get('SUPABASE_URL')!;
  const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // --- 2. gia' uscita? quante oggi?
  const { data: gia } = await sb.from('storie_pubblicate').select('id').eq('id', id).maybeSingle();
  if (gia) return esito("GIA' FATTA", { id });
  const mezzanotte = new Date(); mezzanotte.setUTCHours(0, 0, 0, 0);
  const { count } = await sb.from('storie_pubblicate').select('id', { count: 'exact', head: true }).gte('pubblicata_at', mezzanotte.toISOString());
  if ((count || 0) >= TETTO) return esito('TETTO', { id, oggi: count });

  try {
    // --- 3. l'immagine in un indirizzo pubblico
    const percorso = `${new Date().toISOString().slice(0, 10)}/${nome}`;
    const { error } = await sb.storage.from('storie').upload(percorso, corpo, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(`caricamento: ${error.message}`);
    const pubblica = `${url}/storage/v1/object/public/storie/${percorso}`;

    // --- 4. subito su Instagram, con Buffer
    const c = await trovaCanale(token);
    const d = await buffer(token, `mutation($i: CreatePostInput!) { createPost(input: $i) {
        ... on PostActionSuccess { post { id status } } ... on MutationError { message } } }`, {
      i: {
        channelId: c, schedulingType: 'automatic', mode: 'shareNow', needsApproval: false, text: '',
        assets: [{ image: { url: pubblica } }],
        metadata: { instagram: { type: 'story', shouldShareToFeed: false, isAiGenerated: ai } },
      },
    });
    if (d.createPost.message) {
      // canale sparito o cambiato: la prossima volta si cerca per nome
      if (/channel/i.test(d.createPost.message)) canale = null;
      throw new Error(`Buffer: ${d.createPost.message}`);
    }
    const post = d.createPost.post;
    await sb.from('storie_pubblicate').insert({ id, media_id: `buffer:${post.id}`, url: pubblica });
    return esito('PUBBLICATA', { id, buffer: post.id, stato: post.status });
  } catch (e) {
    return esito('ERRORE', { id, motivo: (e as Error).message }, 502);
  }
});
