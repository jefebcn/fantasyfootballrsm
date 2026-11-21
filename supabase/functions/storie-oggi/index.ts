/**
 * LE STORIE DEI GOL USCITE OGGI, in sola lettura (Alex, 21/11: «capire come
 * regolare per non farti piu' bloccare»).
 *
 * Il 20/11 la chat controllava le storie chiedendole a Buffer ogni 8 secondi e
 * Buffer ha bloccato la chiave per 24 ore. Da qui in poi la chat guarda questa
 * funzione, che legge storie_pubblicate (la scrive pubblica-gol dopo ogni
 * pubblicazione) e non tocca Buffer.
 *
 * Restituisce solo cio' che e' gia' pubblico: l'id della storia (giornata,
 * partita, squadra, n-esimo gol), l'ora e il link dell'immagine, che sta nel
 * secchio pubblico «storie». Niente scritture, niente parametri.
 * Pubblicata senza verifica del JWT (verify_jwt false).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'GET') return Response.json({ errore: 'solo GET' }, { status: 405 });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const mezzanotte = new Date(); mezzanotte.setUTCHours(0, 0, 0, 0);
  const { data, error } = await sb.from('storie_pubblicate')
    .select('id, url, pubblicata_at')
    .gte('pubblicata_at', mezzanotte.toISOString())
    .order('pubblicata_at', { ascending: true })
    .limit(60);
  if (error) return Response.json({ errore: error.message }, { status: 502 });
  return Response.json({ storie: data }, { headers: { 'cache-control': 'no-store' } });
});
