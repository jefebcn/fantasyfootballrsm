/**
 * IL RITORNO DAL LINK DELL'E-MAIL, QUANDO IL LINK E' GIA' STATO APERTO.
 *
 * Il link vale una volta sola, e non e' detto che la prima volta sia
 * l'utente: i controlli antiphishing delle caselle lo aprono da soli per
 * vedere dove porta. Misurato sul progetto vero il 24 settembre: iscrizione
 * alle 08:27:32, account confermato alle 08:27:59 senza che nessuno avesse
 * toccato niente, e il clic vero due minuti dopo si e' preso "Email link is
 * invalid or has expired".
 *
 * Quindi qui si guarda che l'app non ripeta quella frase inglese a una
 * persona che e' gia' dentro, ma dica in italiano cosa e' successo e cosa
 * fare — per tutti e due i casi, perche' l'indirizzo di ritorno non porta il
 * tipo e da qui non si puo' sapere se veniva da un'iscrizione o da un
 * recupero password.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const RITORNO = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const errori = [];
  p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);

  await p.goto(`${BASE}/index.html${RITORNO}`, { waitUntil: 'load' }); await w(2200);
  const r = await p.evaluate(() => ({
    foglio: (document.getElementById('sheet')?.innerText || '').replace(/\n+/g, ' / '),
    aperto: !!document.getElementById('sheet')?.classList.contains('on'),
    avviso: document.getElementById('toast')?.textContent || '',
    hash: location.hash,
    bottone: !!document.getElementById('ritorno-ok'),
  }));
  et(r.aperto && !!r.foglio, `il ritorno con l'errore apre una spiegazione ("${r.foglio.slice(0, 60)}…")`);
  et(!/invalid or has expired/i.test(r.foglio + r.avviso),
    'e non ripete la frase inglese di Supabase, che a chi e\' gia\' confermato dice il falso');
  et(/iscriv/i.test(r.foglio) && /password/i.test(r.foglio),
    'spiega tutti e due i casi: chi si stava iscrivendo e chi recuperava la password');
  et(/una volta sola|già.*apert/i.test(r.foglio), 'e dice perché è successo, che non è colpa sua');
  et(r.bottone, 'col tasto per andare all\'accesso');
  // l'indirizzo va ripulito: quei parametri non devono restare appesi alla barra
  et(!/error=|error_code=/.test(r.hash), `e l'indirizzo resta pulito (${r.hash || 'vuoto'})`);

  // se il tasto non c'e' il clic andrebbe in timeout dopo 30 secondi e la
  // prova morirebbe con uno stack invece di dire cosa manca
  if (r.bottone) { await p.click('#ritorno-ok'); await w(900); }
  const dopo = r.bottone
    ? await p.evaluate(() => ({ hash: location.hash, foglio: document.getElementById('sheet')?.classList.contains('on') }))
    : { hash: '(nessun tasto)', foglio: false };
  // Senza sessione la porta d'ingresso ci aveva gia' portati su #/login,
  // quindi qui la cosa che si sta davvero provando e' che il tasto chiuda il
  // foglio e lasci sull'accesso, non che ci porti da un'altra parte.
  et(r.bottone && !dopo.foglio && /login/.test(dopo.hash), `il tasto chiude il foglio e lascia sull'accesso (${dopo.hash})`);

  // --- un errore diverso resta un avviso corto, non un foglio che copre tutto
  const p2 = await ctx.newPage(); p2.on('pageerror', (e) => errori.push(e.message));
  await p2.goto(`${BASE}/index.html#error=server_error&error_description=Qualcosa+e+andato+storto`, { waitUntil: 'load' });
  await p2.waitForTimeout(2200);
  const r2 = await p2.evaluate(() => ({
    foglio: !!document.getElementById('sheet')?.classList.contains('on'),
    avviso: document.getElementById('toast')?.textContent || '',
  }));
  et(!r2.foglio, 'un errore di altro tipo non apre il foglio');
  et(/storto/i.test(r2.avviso), `ma lo dice nell'avviso ("${r2.avviso}")`);

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
