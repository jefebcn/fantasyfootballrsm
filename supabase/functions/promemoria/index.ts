/**
 * Spedisce il promemoria della formazione a chi non l'ha consegnata.
 *
 * Gira fuori dall'app, quindi e' l'unica parte che funziona a telefono chiuso.
 * La chiama un'azione pianificata (.github/workflows/promemoria.yml) ogni ora:
 * decide lei se e' il momento, guardando quanto manca al lock.
 *
 * La chiave VAPID PRIVATA arriva dai secret, non dal codice. La pubblica sta
 * anche in src/config.js, ed e' giusto: e' pubblica per costruzione.
 */
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

/** Quante ore prima del lock si avvisa. Una volta sola per giornata. */
const ORE_PRIMA = 24;
/** Tolleranza: l'azione gira ogni ora, quindi basta una finestra di un'ora. */
const FINESTRA_ORE = 1.2;

Deno.serve(async (req) => {
  const atteso = Deno.env.get('PROMEMORIA_TOKEN');
  if (!atteso || req.headers.get('x-promemoria-token') !== atteso) {
    return new Response('non autorizzato', { status: 401 });
  }

  const pubblica = Deno.env.get('VAPID_PUBLIC_KEY');
  const privata = Deno.env.get('VAPID_PRIVATE_KEY');
  const contatto = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:nessuno@example.invalid';
  if (!pubblica || !privata) return Response.json({ errore: 'chiavi VAPID non configurate' }, { status: 500 });
  webpush.setVapidDetails(contatto, pubblica, privata);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Qual e' la giornata il cui lock cade nella finestra? Le date stanno su
  // matchday_locks, cioe' la stessa fonte che regola i permessi: se qui si
  // usasse un'altra formula tornerebbe lo scarto di otto giorni.
  const ora = Date.now();
  const { data: locks, error: e1 } = await sb.from('matchday_locks').select('matchday, lock_at');
  if (e1) return Response.json({ errore: e1.message }, { status: 500 });

  const candidate = (locks ?? []).filter((l) => {
    const ore = (new Date(l.lock_at).getTime() - ora) / 3600000;
    return ore > 0 && ore <= ORE_PRIMA && ore > ORE_PRIMA - FINESTRA_ORE;
  });
  if (!candidate.length) return Response.json({ spedite: 0, motivo: 'nessun lock nella finestra' });

  let spedite = 0; const morti: string[] = [];
  for (const l of candidate) {
    const { data: gente, error: e2 } = await sb.rpc('da_avvisare', { p_matchday: l.matchday });
    if (e2) return Response.json({ errore: e2.message }, { status: 500 });

    for (const g of gente ?? []) {
      const carico = JSON.stringify({
        titolo: `Giornata ${l.matchday}: manca la formazione`,
        corpo: `${g.team_name} in ${g.league_name}. Si chiude fra ${ORE_PRIMA} ore: senza consegna vale l'ultima valida, o il 4-4-2 d'ufficio.`,
        tag: `formazione-${l.matchday}`,
        url: './#/rosa/formazione',
      });
      try {
        await webpush.sendNotification(
          { endpoint: g.endpoint, keys: { p256dh: g.p256dh, auth: g.auth } },
          carico,
        );
        spedite++;
      } catch (err) {
        // 404 e 410 vogliono dire che quel dispositivo non esiste piu': si
        // segna e non lo si ritenta all'infinito.
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) morti.push(g.endpoint);
      }
    }
  }
  if (morti.length) await sb.from('push_subscriptions').update({ failed_at: new Date().toISOString() }).in('endpoint', morti);

  return Response.json({ giornate: candidate.map((c) => c.matchday), spedite, scaduti: morti.length });
});
