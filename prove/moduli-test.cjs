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
  p.on('pageerror', e=>console.log('   PAGEERROR', e.message.slice(0,140)));
  const wait=(ms=400)=>p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`,{waitUntil:'load'}); await wait(1300);
  await p.click('[data-tab="up"]'); await wait(250);
  await p.fill('#email','a@e.it'); await p.fill('#name','Conti25'); await p.fill('#password','password123'); await p.click('#primary'); await wait(900);
  await p.click('[data-form="create"]'); await wait(250);
  await p.fill('#lname','Torneo Titano'); await p.fill('#team','Hasta El Roxy'); await p.click('#go-create'); await wait(1200);
  await p.evaluate(()=>{location.hash='#/lega';}); await wait(700); await p.click('#draft'); await wait(2200);
  // NIENTE seed: e' il caso di chi non ha caricato le giornate giocate
  await p.evaluate(()=>{location.hash='#/rosa/formazione';}); await wait(1200);

  const st = await p.evaluate(async ()=>{
    const S = await import('/src/state.js');
    const n = S.giornataDaSchierare();
    return { prossima: S.nextMatchday(), daSchierare: n, stato: S.matchdayStatus(n),
             lock: S.matchday(n).lockAt.slice(0,10),
             moduliSpenti: [...document.querySelectorAll('[data-mod]')].filter(b=>b.disabled).length,
             moduliTotali: document.querySelectorAll('[data-mod]').length };
  });
  console.log(JSON.stringify(st));
  // prova a cambiare modulo davvero
  const prima = await p.evaluate(()=>document.querySelector('[data-mod].on')?.dataset.mod);
  await p.click('[data-mod="3-5-2"]').catch(e=>console.log('   clic fallito:', e.message.split('\n')[0]));
  await wait(800);
  const dopo = await p.evaluate(()=>document.querySelector('[data-mod].on')?.dataset.mod);
  const ok = prima !== dopo && !!dopo;
  console.log(`modulo: ${prima} → ${dopo}  ${ok ? 'CAMBIATO' : 'NON CAMBIATO — FALLITO'}`);
  await p.screenshot({path:`${process.env.USCITA || '/tmp'}/MD_campo.png`});
  await b.close();
  process.exit(ok ? 0 : 1);
})();
