/**
 * PUBBLICA UNA STORIA AUTOMATICA DEL FUTSAL CON BUFFER (Alex, 27/11).
 *
 * La stessa strada delle storie dei gol del calcio (pubblica-gol), per
 * @fantatitano.futsal. L'import (.github/workflows/dati-fsgc.yml, tramite
 * scripts/storie-futsal.mjs) manda qui il JPG di un risultato o di una
 * giornata finita, subito dopo aver pubblicato il referto nell'app.
 *
 *   1. chi chiama deve essere DAVVERO quel lavoro, sul ramo main: token OIDC
 *      di GitHub (firmato da GitHub, dura pochi minuti), nessuna chiave da
 *      custodire;
 *   2. niente doppioni (storie_pubblicate, id «futsal-…») e un tetto di
 *      storie futsal al giorno: un errore che gira in tondo non riempie il
 *      profilo;
 *   3. il JPG va nel secchio pubblico «storie» (047);
 *   4. esce SUBITO come storia di @fantatitano.futsal con Buffer (shareNow):
 *      non occupa i 10 posti della coda del piano gratuito.
 *
 * Secret: BUFFER_TOKEN (lo stesso di pubblica-gol). Una sola chiamata a
 * Buffer per storia: Buffer blocca chi ne fa troppe (20/11, 24 ore).
 *
 * Risponde { esito: PUBBLICATA | GIA' FATTA | TETTO | ERRORE, ... }.
 */
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const REPO = 'jefebcn/fantasyfootballrsm';
const LAVORO = `${REPO}/.github/workflows/dati-fsgc.yml@`;
const PUBBLICO = 'fantatitano-storie-futsal';
const GITHUB = 'https://token.actions.githubusercontent.com';
const JWKS = createRemoteJWKSet(new URL(`${GITHUB}/.well-known/jwks`));
const ID = /^futsal-[a-z0-9-]{3,120}$/;
const MASSIMO = 8 * 1024 * 1024;
const TETTO = 12;                                     // storie futsal al giorno: 7 risultati + 1 giornata ci stanno
const BUFFER = 'https://api.buffer.com';
// Il canale Instagram @fantatitano.futsal su Buffer (docs/futsal/RICETTE.md): mai @fantatitano.
const CANALE = Deno.env.get('BUFFER_CANALE_FUTSAL') || '6afc2100ece6dfde5ff5006f';

const esito = (e: string, altro: Record<string, unknown> = {}, status = 200) =>
  Response.json({ esito: e, ...altro }, { status });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return esito('ERRORE', { motivo: 'solo POST' }, 405);

  // --- 1. chi chiama?
  try {
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { payload } = await jwtVerify(jwt, JWKS, { issuer: GITHUB, audience: PUBBLICO });
    if (payload.repository !== REPO || !String(payload.workflow_ref || '').startsWith(LAVORO)) throw new Error('lavoro sbagliato');
    if (payload.ref !== 'refs/heads/main') throw new Error('ramo sbagliato');
  } catch (e) {
    return esito('ERRORE', { motivo: `non autorizzato: ${(e as Error).message}` }, 401);
  }

  const token = (Deno.env.get('BUFFER_TOKEN') || '').trim();
  if (!token) return esito('ERRORE', { motivo: 'manca il secret BUFFER_TOKEN' }, 503);

  const id = new URL(req.url).searchParams.get('id') || '';
  if (!ID.test(id)) return esito('ERRORE', { motivo: 'id non valido' }, 400);
  const corpo = new Uint8Array(await req.arrayBuffer());
  if (!corpo.length || corpo.length > MASSIMO) return esito('ERRORE', { motivo: 'immagine vuota o troppo grande' }, 413);
  if (corpo[0] !== 0xff || corpo[1] !== 0xd8) return esito('ERRORE', { motivo: 'non e\' un JPEG' }, 415);

  const url = Deno.env.get('SUPABASE_URL')!;
  const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // --- 2. gia' uscita? quante oggi?
  const { data: gia } = await sb.from('storie_pubblicate').select('id').eq('id', id).maybeSingle();
  if (gia) return esito("GIA' FATTA", { id });
  const mezzanotte = new Date(); mezzanotte.setUTCHours(0, 0, 0, 0);
  const { count } = await sb.from('storie_pubblicate').select('id', { count: 'exact', head: true })
    .like('id', 'futsal-%').gte('pubblicata_at', mezzanotte.toISOString());
  if ((count || 0) >= TETTO) return esito('TETTO', { id, oggi: count });

  try {
    // --- 3. l'immagine in un indirizzo pubblico
    const percorso = `${new Date().toISOString().slice(0, 10)}/${id}.jpg`;
    const { error } = await sb.storage.from('storie').upload(percorso, corpo, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(`caricamento: ${error.message}`);
    const pubblica = `${url}/storage/v1/object/public/storie/${percorso}`;

    // --- 4. subito su Instagram, con Buffer (una chiamata)
    const r = await fetch(BUFFER, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: `mutation($i: CreatePostInput!) { createPost(input: $i) {
          ... on PostActionSuccess { post { id status } } ... on MutationError { message } } }`,
        variables: {
          i: {
            channelId: CANALE, schedulingType: 'automatic', mode: 'shareNow', needsApproval: false, text: '',
            assets: [{ image: { url: pubblica } }],
            metadata: { instagram: { type: 'story', shouldShareToFeed: false, isAiGenerated: true } },
          },
        },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) throw new Error(`Buffer ${r.status} ${JSON.stringify(j.errors || j).slice(0, 300)}`);
    if (j.data.createPost.message) throw new Error(`Buffer: ${j.data.createPost.message}`);
    const post = j.data.createPost.post;
    await sb.from('storie_pubblicate').insert({ id, media_id: `buffer:${post.id}`, url: pubblica });
    return esito('PUBBLICATA', { id, buffer: post.id, stato: post.status });
  } catch (e) {
    return esito('ERRORE', { id, motivo: (e as Error).message }, 502);
  }
});
