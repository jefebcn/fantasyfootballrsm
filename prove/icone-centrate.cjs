// Ogni simbolo dentro il suo riquadro colorato deve stare al centro.
// Nasce da .warn: il riquadro dell'icona prende una classe che dice il tono, e
// "warn" e' anche il banner d'avviso, che ha un padding suo. Quel padding
// scendeva nel riquadro e spostava il simbolo.
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
  const schermi = ['#/', '#/rosa', '#/calendario', '#/classifica', '#/voti', '#/impostazioni', '#/lega', '#/mercato', '#/regolamento', '#/scambi'];
  let visti = 0, storti = [];
  for (const s of schermi) {
    await p.evaluate((h)=>{location.hash=h;}, s); await w(1000);
    const r = await p.evaluate((dove) => {
      const fuori = [];
      let n = 0;
      for (const lead of document.querySelectorAll('.tile > .lead')) {
        const fig = lead.querySelector('svg, img'); if (!fig) continue;
        const rl = lead.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        if (!rl.width || !rf.width) continue;
        n++;
        const dx = (rf.x + rf.width/2) - (rl.x + rl.width/2);
        const dy = (rf.y + rf.height/2) - (rl.y + rl.height/2);
        if (Math.abs(dx) > 0.6 || Math.abs(dy) > 0.6) {
          fuori.push({dove, classe: lead.className, dx: +dx.toFixed(1), dy: +dy.toFixed(1)});
        }
      }
      return {n, fuori};
    }, s);
    visti += r.n; storti.push(...r.fuori);
  }
  console.log(`riquadri guardati: ${visti}`);
  if (storti.length) { console.log('FUORI CENTRO:'); storti.slice(0,10).forEach(x=>console.log('  ', JSON.stringify(x))); }
  else console.log('=== tutti centrati ===');
  await b.close();
  process.exit(storti.length ? 1 : 0);
})();
