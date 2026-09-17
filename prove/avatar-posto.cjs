// Ogni caricatura deve stare dentro il suo contenitore, su tutte le schermate.
// La caricatura e' in posizione assoluta: se il contenitore non e' posizionato
// si aggancia alla pagina e finisce dove capita (nella scheda del giocatore
// spuntava in fondo allo schermo, dietro la barra).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const ctx = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:'block'});
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__='/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth','supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({onboarded:true, theme:'system'}));
    localStorage.setItem('fcs:supabase', JSON.stringify({url:'https://mock.supabase.co', key:'mock-key-mock-key-mock'}));
  });
  const p = await ctx.newPage(); p.on('dialog', d=>d.accept());
  const w=(ms=400)=>p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`,{waitUntil:'load'}); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email','a@e.it'); await p.fill('#name','Conti25'); await p.fill('#password','password123'); await p.click('#primary'); await w(900);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname','Torneo Titano'); await p.fill('#team','Hasta El Roxy'); await p.click('#go-create'); await w(1200);
  await p.evaluate(()=>{location.hash='#/lega';}); await w(700); await p.click('#draft'); await w(2200);

  const schermi = ['#/', '#/rosa', '#/rosa/formazione', '#/listone', '#/voti', '#/live', '#/mercato', '#/squadra', '#/confronto'];
  let male = 0, viste = 0;
  for (const s of schermi) {
    await p.evaluate((h)=>{location.hash=h;}, s); await w(1100);
    const esito = await p.evaluate(() => {
      const fuori = [];
      let quante = 0;
      for (const im of document.querySelectorAll('.av-cal')) {
        quante++;
        const c = im.parentElement;
        const ri = im.getBoundingClientRect(), rc = c.getBoundingClientRect();
        if (!ri.width) continue;
        // il disegno puo' sbordare, ma il suo centro deve stare nel contenitore
        const cx = ri.x + ri.width/2, cy = ri.y + ri.height/2;
        if (cx < rc.x - 4 || cx > rc.right + 4 || cy < rc.y - rc.height || cy > rc.bottom + rc.height) {
          fuori.push({classe: c.className, im: [Math.round(ri.x), Math.round(ri.y)], cont: [Math.round(rc.x), Math.round(rc.y)]});
        }
      }
      return {quante, fuori};
    });
    viste += esito.quante;
    if (esito.fuori.length) { male += esito.fuori.length; console.log(`${s}  FUORI POSTO ${JSON.stringify(esito.fuori.slice(0,3))}`); }
  }
  // e la scheda di un giocatore, che e' dove si era rotto
  await p.evaluate(()=>{location.hash='#/listone';}); await w(1100);
  await p.evaluate(()=>{const a=document.querySelector('a[href^="#/giocatore/"]'); a && (location.hash=a.getAttribute('href'));}); await w(1100);
  const sch = await p.evaluate(() => {
    const im = document.querySelector('.av-big .av-cal');
    if (!im) return 'la scheda non mostra nessuna caricatura';
    const rc = im.parentElement.getBoundingClientRect(), ri = im.getBoundingClientRect();
    return Math.abs((ri.x+ri.width/2) - (rc.x+rc.width/2)) < 6 && ri.y > rc.y - rc.height ? 'ok' : 'FUORI POSTO';
  });
  console.log('scheda giocatore:', sch);
  if (sch !== 'ok') male++;
  console.log(male ? `=== ${male} FUORI POSTO su ${viste} ===` : `=== tutte a posto (${viste} caricature viste) ===`);
  await b.close();
  process.exit(male ? 1 : 0);
})();
