/**
 * Le pagine legali statiche: si leggono SENZA JavaScript, e dicono la stessa
 * cosa di quelle dentro l'app.
 *
 * Servono ai moduli di Google Play e di Apple, che chiedono un indirizzo per
 * l'informativa: chi lo controlla apre quell'indirizzo — a volte un programma,
 * non una persona — e si aspetta di leggere il testo, non un'app che deve
 * ancora partire.
 *
 * Qui si prova la cosa che conta: il browser gira con **javaScriptEnabled a
 * false**. Se la pagina fosse l'app col router a cancelletto, a JavaScript
 * spento sarebbe bianca, e questa prova lo vedrebbe.
 *
 * E si confronta il testo con quello dell'app, parola per parola (normalizzato
 * sugli spazi): le due copie non possono divergere senza che qualcuno se ne
 * accorga. Se diverge, si rigenera con scripts/genera-legali.cjs — non si
 * corregge a mano il file statico, che e' generato.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const PAGINE = [['privacy.html', 'privacy', 'Privacy'], ['termini.html', 'termini', 'Termini'],
  // Questa la chiede Google Play: la strada per cancellare l'account deve
  // aprirsi dal web, senza installare niente e senza accesso.
  ['cancella-account.html', 'cancella-account', 'Cancellare']];
// Minuscolo di proposito: innerText restituisce il testo RESO, e i titoli di
// sezione escono in maiuscolo per via del CSS — nella statica e nell'app le
// regole che li toccano non sono le stesse. Confrontare distinguendo le
// maiuscole farebbe fallire la prova per una differenza che nessuno legge
// come differenza: ci sono gia' cascato due volte in questo progetto.
const pulisci = (t) => t.replace(/\s+/g, ' ').replace(/ /g, ' ').trim().toLowerCase();

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

  for (const [file, rotta, titolo] of PAGINE) {
    // 1. senza JavaScript: e' la condizione di chi controlla
    const spento = await b.newContext({ viewport: { width: 420, height: 900 }, javaScriptEnabled: false, serviceWorkers: 'block' });
    const ps = await spento.newPage();
    const r = await ps.goto(`${BASE}/${file}`, { waitUntil: 'load' });
    const statica = await ps.evaluate(() => ({
      testo: document.body.innerText, titolo: document.title,
      descrizione: document.querySelector('meta[name=description]')?.content || '',
      sezioni: document.querySelectorAll('.group').length,
      bottoni: document.querySelectorAll('button, .a-btn').length,
      linkInterni: [...document.querySelectorAll('a[href^="#/"]')].length,
    }));
    et(r?.status() === 200, `${file}: il server la serve (${r?.status()})`);
    et(/Fantatitano/.test(statica.titolo) && new RegExp(titolo, 'i').test(statica.titolo), `${file}: ha il suo titolo ("${statica.titolo}")`);
    et(statica.descrizione.length > 30, `${file}: e una descrizione per chi la indicizza`);
    et(statica.sezioni >= 3, `${file}: ${statica.sezioni} sezioni di testo, a JavaScript spento`);
    et(pulisci(statica.testo).length > 1500, `${file}: ${pulisci(statica.testo).length} caratteri di testo leggibile senza JavaScript`);
    et(statica.bottoni === 0 && statica.linkInterni === 0, `${file}: niente bottoni o link dell'app che da qui non porterebbero da nessuna parte`);
    await spento.close();

    // 2. lo stesso testo dell'app
    const acceso = await b.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
    await acceso.addInitScript(() => { localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'light' })); });
    const pa = await acceso.newPage();
    await pa.goto(`${BASE}/#/${rotta}`, { waitUntil: 'load' });
    await pa.waitForSelector('.a-body .group', { timeout: 15000 });
    await pa.waitForTimeout(250);
    const dentro = pulisci(await pa.evaluate(() => {
      const m = document.querySelector('.a-body').cloneNode(true);
      m.querySelectorAll('button, .a-btn, svg').forEach((e) => e.remove());
      return m.innerText;
    }));
    await acceso.close();

    // Il confronto si fa su lettere e numeri e basta: niente spazi, niente
    // punteggiatura. Le due pagine impaginano lo stesso testo in scatole
    // diverse, e innerText mette gli a capo dove finiscono le scatole — un
    // confronto che tiene conto degli spazi fallirebbe per l'impaginazione,
    // non per il testo, che e' l'unica cosa che qui conta.
    const nudo = (t) => pulisci(t).replace(/[^a-zà-ÿ0-9]/g, '');
    const fuoriN = nudo(statica.testo); const dentroN = nudo(dentro);
    const pezzi = []; for (let i = 0; i < dentroN.length; i += 120) pezzi.push(dentroN.slice(i, i + 120));
    const interi = pezzi.filter((x) => x.length === 120);
    const mancanti = interi.filter((x) => !fuoriN.includes(x));
    et(mancanti.length === 0, mancanti.length
      ? `${file}: ${mancanti.length} pezzi su ${interi.length} del testo dell'app non sono nella pagina statica — rigenerala con scripts/genera-legali.cjs ("…${mancanti[0].slice(0, 50)}…")`
      : `${file}: stesso testo della pagina dentro l'app (${interi.length} pezzi da 120 caratteri, tutti presenti)`);
  }

  // 3. e le pagine legali dentro l'app si aprono anche senza account
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/#/privacy`, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const dove = await p.evaluate(() => ({ hash: location.hash, sezioni: document.querySelectorAll('.a-body .group').length }));
  et(/privacy/.test(dove.hash) && dove.sezioni >= 3,
    `l'informativa si apre anche senza account e senza server configurato (${dove.hash}, ${dove.sezioni} sezioni)`);
  await ctx.close();

  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
