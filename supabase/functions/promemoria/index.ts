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

/**
 * Da quante ore prima del lock si avvisa.
 *
 * Era una finestra di 1,2 ore attorno alle 24, perche' l'azione pianificata
 * doveva passare ogni ora. Non passa ogni ora: misurato sulle corse vere,
 * 3,2 - 6,3 - 5,8 ore. Con quel passo la finestra stretta si mancava tre volte
 * su quattro. Ora la finestra e' tutto il giorno prima e a non ripetersi ci
 * pensa il database, che segna chi e' gia' stato avvisato (migrazione 009).
 */
const ORE_PRIMA = 24;

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

  // Quali giornate hanno il lock nel giorno che viene? Le date stanno su
  // matchday_locks, cioe' la stessa fonte che regola i permessi: se qui si
  // usasse un'altra formula tornerebbe lo scarto di otto giorni.
  const ora = Date.now();
  const { data: locks, error: e1 } = await sb.from('matchday_locks').select('matchday, lock_at');
  if (e1) return Response.json({ errore: e1.message }, { status: 500 });

  const candidate = (locks ?? []).map((l) => ({
    ...l, ore: (new Date(l.lock_at).getTime() - ora) / 3600000,
  })).filter((l) => l.ore > 0 && l.ore <= ORE_PRIMA);
  if (!candidate.length) return Response.json({ spedite: 0, motivo: 'nessun lock nella finestra' });

  let spedite = 0; const morti: string[] = []; let rimessi = 0;
  for (const l of candidate) {
    const { data: gente, error: e2 } = await sb.rpc('da_avvisare', { p_matchday: l.matchday });
    if (e2) return Response.json({ errore: e2.message }, { status: 500 });

    // Quanto manca davvero, non le 24 ore fisse di prima: adesso l'avviso puo'
    // partire a qualunque ora del giorno prima, e dirgli "fra 24 ore" quando ne
    // mancano tre sarebbe una bugia che costa una formazione.
    const quanto = l.ore >= 1.5 ? `fra ${Math.round(l.ore)} ore` : "fra meno di un'ora";
    const daRimettere: string[] = [];
    for (const g of gente ?? []) {
      const carico = JSON.stringify({
        titolo: `Giornata ${l.matchday}: manca la formazione`,
        corpo: `${g.team_name} in ${g.league_name}. Si chiude ${quanto}: senza consegna vale l'ultima valida, o il 4-4-2 d'ufficio.`,
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
        // Guasto passeggero: il segno messo da da_avvisare va tolto, se no
        // questa persona resta fuori per sempre da questa giornata.
        else daRimettere.push(g.endpoint);
      }
    }
    if (daRimettere.length) {
      const { data: n } = await sb.rpc('promemoria_da_rifare', { p_matchday: l.matchday, p_endpoints: daRimettere });
      rimessi += Number(n ?? 0);
    }
  }
  if (morti.length) await sb.from('push_subscriptions').update({ failed_at: new Date().toISOString() }).in('endpoint', morti);

  return Response.json({ giornate: candidate.map((c) => c.matchday), spedite, scaduti: morti.length, da_rifare: rimessi });
});
