/**
 * Carica una storia dei gol nel secchio pubblico «storie» (047) e ne
 * restituisce l'indirizzo: Instagram, o Metricool, la prendono da li'.
 *
 * Chi chiama manda la chiave nell'intestazione x-chiave. Qui c'e' solo la sua
 * impronta SHA-256: la chiave non sta nel repository, e chi legge questo file
 * non puo' caricare niente. Il nome del file e' controllato, la grandezza ha
 * un tetto: non e' un hosting di immagini qualunque.
 *
 *   curl -X POST -H "x-chiave: ..." --data-binary @storia.jpg \
 *     "https://<progetto>.supabase.co/functions/v1/carica-storia?nome=6-murata-domagnano-49-murata_21.jpg"
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const IMPRONTA = '123e28e7a097033d31b68eeefaf47557c6ddd6b91aeeb7151f6bab7365be6730';
const NOME = /^[a-z0-9_-]{3,120}\.jpg$/;
const MASSIMO = 8 * 1024 * 1024;

async function sha256(testo: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('solo POST', { status: 405 });
  if ((await sha256(req.headers.get('x-chiave') || '')) !== IMPRONTA) return new Response('chiave sbagliata', { status: 401 });
  const nome = new URL(req.url).searchParams.get('nome') || '';
  if (!NOME.test(nome)) return new Response('nome non valido', { status: 400 });
  const corpo = new Uint8Array(await req.arrayBuffer());
  if (!corpo.length || corpo.length > MASSIMO) return new Response('immagine vuota o troppo grande', { status: 413 });
  if (corpo[0] !== 0xff || corpo[1] !== 0xd8) return new Response('non e\' un JPEG', { status: 415 });

  const url = Deno.env.get('SUPABASE_URL')!;
  const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const percorso = `${new Date().toISOString().slice(0, 10)}/${nome}`;
  const { error } = await sb.storage.from('storie').upload(percorso, corpo, { contentType: 'image/jpeg', upsert: true });
  if (error) return new Response(`caricamento: ${error.message}`, { status: 500 });
  return Response.json({ url: `${url}/storage/v1/object/public/storie/${percorso}` });
});
