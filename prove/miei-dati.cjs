/* Le tre promesse che l'informativa faceva e l'app non manteneva:
   scaricare i propri dati, segnalare un problema, cancellare il profilo. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = []; const ko = [];
const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const ctx = await b.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true,
    serviceWorkers:'block', acceptDownloads:true, permissions:['clipboard-read','clipboard-write']});
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__='/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth','supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({onboarded:true, theme:'system'}));
    localStorage.setItem('fcs:supabase', JSON.stringify({url:'https://mock.supabase.co', key:'mock-key-mock-key-mock'}));
  });
  const p = await ctx.newPage(); p.on('dialog', d=>d.accept());
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  const w=(ms=400)=>p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`,{waitUntil:'load'}); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email','a@e.it'); await p.fill('#name','Conti25'); await p.fill('#password','password123'); await p.click('#primary'); await w(900);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname','Torneo Titano'); await p.fill('#team','Hasta El Roxy'); await p.click('#go-create'); await w(1200);
  await p.evaluate(()=>{location.hash='#/lega';}); await w(700); await p.click('#draft'); await w(2200);
  // una formazione consegnata, così l'export ha qualcosa da contenere
  await p.evaluate(()=>{location.hash='#/rosa/formazione';}); await w(1200);
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/salva|consegna/i.test(x.textContent)); b && b.click();}); await w(900);

  await p.evaluate(()=>{location.hash='#/impostazioni';}); await w(1100);

  // 1. scaricare i propri dati
  const [scaricato] = await Promise.all([
    p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    p.evaluate(()=>{const b=[...document.querySelectorAll('[data-act]')].find(x=>x.dataset.act==='esporta'); b && b.click();}),
  ]);
  et(!!scaricato, 'il bottone scarica un file');
  if (scaricato) {
    et(/^fantatitano-miei-dati-\d{4}-\d{2}-\d{2}\.json$/.test(scaricato.suggestedFilename()),
      `il file ha un nome sensato (${scaricato.suggestedFilename()})`);
    const fs = require('fs');
    const dove = await scaricato.path();
    const d = JSON.parse(fs.readFileSync(dove, 'utf8'));
    et(d.account && d.account.email === 'a@e.it', 'dentro c\'è il mio account');
    et(d.legaAperta && d.legaAperta.nome === 'Torneo Titano', 'e la lega aperta');
    et(Array.isArray(d.legaAperta?.rosa) && d.legaAperta.rosa.length > 0,
      `e la rosa (${d.legaAperta?.rosa?.length} giocatori)`);
    et(typeof d.limite === 'string' && d.limite.includes('una lega alla volta'),
      'e dice da sé cosa NON contiene');
  }

  // 2. segnalare un problema
  await p.evaluate(()=>{location.hash='#/impostazioni';}); await w(900);
  const rapporto = await p.evaluate(async ()=>{
    const D = await import('/src/diagnostica.js');
    D.segna('prova', 'guasto finto per la prova');
    return D.rapporto({ versione: await D.versioneInCache() });
  });
  et(/Segnalazione Fantatitano/.test(rapporto), 'la segnalazione si scrive da sé');
  et(/guasto finto per la prova/.test(rapporto), 'e contiene gli errori registrati');
  et(/browser:.*Mozilla/.test(rapporto), 'e com\'è fatto il telefono');
  et(!/a@e\.it|password123|Hasta El Roxy/.test(rapporto),
    'e NON contiene e-mail, password o nomi di squadra');

  // 3. cancellare il profilo: si chiede conferma, non si fa e basta
  await p.evaluate(()=>{const b=[...document.querySelectorAll('[data-act]')].find(x=>x.dataset.act==='elimina-profilo'); b && b.click();});
  await w(700);
  const foglio = await p.evaluate(()=>{const s=document.getElementById('sheet'); return s ? s.textContent : '';});
  et(/Cancellare il profilo/.test(foglio), 'cancellare chiede conferma');
  et(/Non si torna indietro/.test(foglio), 'e lo dice chiaro');
  et(await p.evaluate(()=>!!document.querySelector('[data-conferma="no"]')), 'e si può dire di no');

  et(errs.length === 0, `nessun errore JS${errs.length ? ': ' + errs.join(' | ') : ''}`);
  ok.forEach(t=>console.log('  ok ', t));
  ko.forEach(t=>console.log('  KO ', t));
  console.log(ko.length ? `=== ${ko.length} FALLITE ===` : `=== tutte a posto (${ok.length}) ===`);
  await b.close();
  process.exit(ko.length ? 1 : 0);
})();
