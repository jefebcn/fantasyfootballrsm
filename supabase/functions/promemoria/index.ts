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

const gestisci = async (req: Request): Promise<Response> => {
  // Due guasti diversi, e per mesi rispondevano la stessa identica cosa.
  // Il 17 settembre l'azione pianificata ha preso 401 e dal registro non si
  // capiva se il token fosse sbagliato o se su Supabase non ci fosse proprio:
  // "non autorizzato" copriva tutti e due i casi. Adesso il secret mancante
  // e' un guasto di configurazione (500) e lo dice; 401 vuol dire una cosa
  // sola, cioe' che i due valori non coincidono. Non si rivela niente: il
  // token non compare, e chi passa di qui gia' sa di aver preso un rifiuto.
  const atteso = Deno.env.get('PROMEMORIA_TOKEN')?.trim();
  if (!atteso) {
    return new Response(
      'PROMEMORIA_TOKEN non e\' fra i secret di questa funzione: ' +
      'Project Settings -> Edge Functions -> Secrets, poi ridistribuisci.',
      { status: 500 },
    );
  }
  if (req.headers.get('x-promemoria-token')?.trim() !== atteso) {
    return new Response('token non valido', { status: 401 });
  }

  // Anche qui, come per il token: prima diceva "chiavi VAPID non configurate"
  // e basta. Due secret, un messaggio solo, e chi legge non sa se ne manca una
  // o tutte e due — ed e' la differenza fra "ho sbagliato a scrivere un nome"
  // e "non li ho mai messi". Il nome del secret non e' un segreto: il segreto
  // e' il valore, che non compare.
  //
  // .trim() su tutti e tre, e non e' pignoleria: un valore incollato nel
  // pannello si porta dietro un ritorno a capo che non si vede da nessuna
  // parte, e web-push su una chiave con un \n in coda non dice "c'e' uno
  // spazio", dice 'must be a URL safe Base 64' — cioe' manda a cercare la
  // chiave sbagliata. E' lo stesso guaio che ha avuto SUPABASE_FUNCTIONS_URL
  // su GitHub.
  const pubblica = Deno.env.get('VAPID_PUBLIC_KEY')?.trim();
  const privata = Deno.env.get('VAPID_PRIVATE_KEY')?.trim();

  // Il soggetto VAPID deve essere un URL: un indirizzo e-mail nudo fa
  // scoppiare setVapidDetails con "Vapid subject is not a valid URL". Chi
  // incolla un'e-mail nel pannello ha ragione lui, non la libreria: il
  // mailto: glielo mettiamo davanti invece di far fallire tutti i promemoria
  // per due punti e sei lettere.
  const soggetto = Deno.env.get('VAPID_SUBJECT')?.trim();
  const contatto = !soggetto
    ? 'mailto:nessuno@example.invalid'
    : /^(mailto:|https?:\/\/)/.test(soggetto) ? soggetto : `mailto:${soggetto}`;

  // La lista si costruisce DENTRO il controllo, non fuori: una condizione
  // scritta cosi' restringe il tipo, e sotto pubblica e privata sono stringhe
  // sicure. Riempire un array di nomi mancanti e poi guardarne la lunghezza
  // sembra piu' ordinato, ma per il compilatore le due variabili resterebbero
  // "forse assenti" e il deploy non passerebbe il controllo dei tipi.
  if (!pubblica || !privata) {
    const mancanti = [
      !pubblica ? 'VAPID_PUBLIC_KEY' : null,
      !privata ? 'VAPID_PRIVATE_KEY' : null,
    ].filter((n): n is string => n !== null);
    return Response.json({
      errore: `manca fra i secret di questa funzione: ${mancanti.join(', ')}`,
      dove: 'Supabase -> Project Settings -> Edge Functions -> Secrets',
      attenzione: 'i nomi sono esatti, maiuscole e underscore compresi',
    }, { status: 500 });
  }

  // Le chiavi ci sono ma possono essere quelle sbagliate, e i modi di
  // sbagliarle sono cinque — provati contro web-push 3.6.7, non immaginati:
  // scambiate fra loro, con uno spazio intorno, di lunghezza sbagliata.
  // Tutti finivano in un'eccezione non catturata, cioe' in "Internal Server
  // Error" nudo: la ragione la sapeva solo il registro di Supabase, e nel
  // registro dell'azione pianificata non arrivava niente.
  //
  // La lunghezza in caratteri la diciamo: non e' il segreto (il segreto e' il
  // valore) ed e' quasi sempre la cosa che fa capire lo scambio al primo
  // colpo — 87 e' la pubblica, 43 la privata.
  try {
    webpush.setVapidDetails(contatto, pubblica, privata);
  } catch (err) {
    return Response.json({
      errore: 'le chiavi VAPID ci sono ma web-push le rifiuta',
      dettaglio: (err as Error).message,
      caratteri: { VAPID_PUBLIC_KEY: pubblica.length, VAPID_PRIVATE_KEY: privata.length },
      atteso: { VAPID_PUBLIC_KEY: '87 caratteri, comincia per B', VAPID_PRIVATE_KEY: '43 caratteri' },
      VAPID_SUBJECT: contatto,
    }, { status: 500 });
  }

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
};

/**
 * La rete sotto tutto: qualunque cosa scoppi, esce un messaggio leggibile.
 *
 * Senza questa, un'eccezione qualsiasi diventa "Internal Server Error" e
 * basta: cinque righe piu' su setVapidDetails ne lanciava una, e nel registro
 * dell'azione pianificata arrivava quella frase nuda. Il motivo vero restava
 * nei log di Supabase, che sono un altro pannello, un altro giro e un'altra
 * mezz'ora. E' successo il 17 settembre due volte di fila.
 *
 * Fuori va il messaggio dell'eccezione, non la pila delle chiamate: la pila
 * dice i percorsi dei file del runtime e non serve a chi legge il registro.
 */
Deno.serve(async (req) => {
  try {
    return await gestisci(req);
  } catch (err) {
    const messaggio = err instanceof Error ? err.message : String(err);
    console.error('promemoria: eccezione non prevista', err);
    return Response.json({ errore: 'eccezione non prevista', dettaglio: messaggio }, { status: 500 });
  }
});
