/**
 * L'OROLOGIO DELLE STORIE DEI GOL (Alex, 20/11: «mi serve qualcosa per cui non
 * ci sia ritardo nella pubblicazione, quasi istantaneo»).
 *
 * Il lavoro che guarda le partite e pubblica le storie dei gol
 * (.github/workflows/storie-gol.yml) partiva dall'orario di GitHub, che le
 * corse pianificate le ritarda di ore: l'8/11 il turno e' partito alle 15:33
 * per partite delle 15:00, e un ritardo oltre le 3h30 lascia i gol senza
 * storia. Una partenza CHIESTA (workflow_dispatch) invece GitHub la serve in
 * pochi secondi.
 *
 * Questa funzione la chiama pg_cron ogni 2 minuti (migrazione 058-orologio-gol.sql).
 * Legge il calendario pubblico dell'app e, se c'e' una partita fra meno di
 * 30 minuti o in corso (fino a 3h30 dal calcio d'inizio, come turno-gol.mjs) e
 * nessun turno sta girando o aspetta, fa partire il turno. Cosi' il turno parte
 * prima del calcio d'inizio e, se si ferma a meta' partita, riparte entro 2
 * minuti. Fuori dalle partite non fa niente.
 *
 * Secret (Edge Functions -> Secrets): GITHUB_TOKEN_OROLOGIO, un token GitHub
 * fine-grained limitato a fantasyfootballrsm col solo permesso Actions: read
 * and write. Senza, la funzione risponde «manca il secret» e non fa niente.
 *
 * Chiamarla piu' volte e' innocuo: parte al massimo un turno, e solo se non ce
 * n'e' gia' uno. Per questo e' pubblicata senza verifica del JWT (verify_jwt
 * false): pg_cron la chiama senza chiavi, e la chiave pubblica del progetto
 * (sb_publishable_) non e' un JWT.
 */
const REPO = 'jefebcn/fantasyfootballrsm';
const LAVORO = 'storie-gol.yml';
const RAMO = 'main';
const CALENDARIO_URL = 'https://fantatitano.site/src/calendario-dati.js';
const MIN = 60_000;
const PRIMA = 30 * MIN;
const DOPO = 210 * MIN;

const risposta = (dati: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async () => {
  const token = (Deno.env.get('GITHUB_TOKEN_OROLOGIO') || '').trim();
  if (!token) return risposta({ fatto: 'niente', motivo: 'manca il secret GITHUB_TOKEN_OROLOGIO' });

  // --- si gioca adesso, o fra poco?
  let cal: unknown[][];
  try {
    const testo = await (await fetch(`${CALENDARIO_URL}?t=${Date.now()}`)).text();
    const m = testo.match(/CALENDARIO\s*=\s*(\[[\s\S]*?\n\]);/);
    if (!m) throw new Error('calendario senza CALENDARIO');
    cal = JSON.parse(m[1].replace(/,\s*\]$/, ']'));   // il file ha la virgola dopo l'ultima riga
  } catch (e) {
    return risposta({ fatto: 'errore', motivo: `calendario: ${(e as Error).message}` }, 502);
  }
  const ora = Date.now();
  const vive = cal.filter((r) => {
    const t = Date.parse(String(r[3]));
    return !Number.isNaN(t) && ora >= t - PRIMA && ora < t + DOPO;
  });
  if (!vive.length) return risposta({ fatto: 'niente', motivo: 'nessuna partita in corso o fra meno di 30 minuti' });

  const gh = (percorso: string, init: RequestInit = {}) => fetch(`https://api.github.com/repos/${REPO}${percorso}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'fantatitano-orologio-gol',   // senza, GitHub risponde 403
      ...(init.headers || {}),
    },
  });

  // --- c'e' gia' un turno che gira o aspetta?
  const r = await gh(`/actions/workflows/${LAVORO}/runs?per_page=10`);
  if (!r.ok) return risposta({ fatto: 'errore', motivo: `GitHub ${r.status} leggendo i turni` }, 502);
  const { workflow_runs: turni = [] } = await r.json();
  const attivo = turni.find((t: { status: string }) => t.status !== 'completed');
  if (attivo) return risposta({ fatto: 'niente', motivo: `turno gia' ${attivo.status}`, partite: vive.length });

  // --- parte il turno
  const d = await gh(`/actions/workflows/${LAVORO}/dispatches`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: RAMO }),
  });
  if (d.status !== 204) return risposta({ fatto: 'errore', motivo: `GitHub ${d.status} facendo partire il turno` }, 502);
  return risposta({ fatto: 'turno partito', partite: vive.length });
});
