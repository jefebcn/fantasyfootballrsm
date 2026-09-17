/* Nessuna riga del campo deve finire fuori dal riquadro, in nessun modulo,
   ne' con la rosa assegnata ne' senza (e' li' che si era rotto). */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  let guai = 0;
  for (const conRosa of [false, true]) {
    for (const larghezza of [360, 430]) {
      const ctx = await b.newContext({viewport:{width:larghezza,height:852}, isMobile:true, hasTouch:true, serviceWorkers:'block'});
      await ctx.addInitScript(() => {
        window.__SUPABASE_JS__='/tests/mock-supabase.js';
        localStorage.setItem('fcs:auth','supabase');
        localStorage.setItem('fcs:prefs', JSON.stringify({onboarded:true, theme:'system'}));
        localStorage.setItem('fcs:supabase', JSON.stringify({url:'https://mock.supabase.co', key:'mock-key-mock-key-mock'}));
      });
      const p = await ctx.newPage(); p.on('dialog', d=>d.accept());
      const w=(m=400)=>p.waitForTimeout(m);
      await p.goto(`${BASE}/#/`,{waitUntil:'load'}); await w(1300);
      await p.click('[data-tab="up"]'); await w(250);
      await p.fill('#email','a@e.it'); await p.fill('#name','C'); await p.fill('#password','password123'); await p.click('#primary'); await w(900);
      await p.click('[data-form="create"]'); await w(250);
      await p.fill('#lname','T'); await p.fill('#team','H'); await p.click('#go-create'); await w(1400);
      if (conRosa) { await p.evaluate(()=>{location.hash='#/lega';}); await w(700); await p.click('#draft'); await w(2200); }
      await p.evaluate(()=>{location.hash='#/rosa/formazione';}); await w(1200);
      const moduli = await p.evaluate(()=>[...document.querySelectorAll('[data-mod]')].map(b=>b.dataset.mod));
      for (const m of moduli) {
        await p.click(`[data-mod="${m}"]`); await w(450);
        const bad = await p.evaluate(()=>{
          const pit=document.querySelector('.pitch'); const box=pit.getBoundingClientRect();
          return [...pit.querySelectorAll('.line')].filter(l=>{
            const r=l.getBoundingClientRect(); return r.bottom > box.bottom + 1 || r.top < box.top - 1;
          }).map(l=>l.dataset.line);
        });
        const eti = `${conRosa?'rosa':'vuota'} ${larghezza}px ${m}`;
        if (bad.length) { console.log(`  ${eti}: righe fuori → ${bad.join(',')}`); guai++; }
      }
      await ctx.close();
    }
  }
  console.log(guai ? `\n${guai} casi con righe tagliate — FALLITO` : '\nnessuna riga tagliata in 28 combinazioni  OK');
  await b.close();
  process.exit(guai ? 1 : 0);
})();
