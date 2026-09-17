const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ROTTE = ['','squadra','rosa','rosa/formazione','calendario','classifica','voti','listone','mercato',
  'lega','gestione','regolamento','regole','impostazioni','impostazioni/avanzate','asta','video','privacy','termini','archiviazione','licenze','scheda','admin','scambi','confronto/virtus_1/trefiori_1'];
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const problemi = [];
  for (const W of [360, 430]) {
    for (const tema of ['light','dark']) {
      const ctx = await b.newContext({viewport:{width:W,height:800}, deviceScaleFactor:2, isMobile:true, hasTouch:true, serviceWorkers:'block'});
      await ctx.addInitScript(() => {
        window.__SUPABASE_JS__='/tests/mock-supabase.js';
        localStorage.setItem('fcs:auth','supabase');
        localStorage.setItem('fcs:prefs', JSON.stringify({onboarded:true, theme:'system'}));
        localStorage.setItem('fcs:supabase', JSON.stringify({url:'https://mock.supabase.co', key:'mock-key-mock-key-mock'}));
      });
      await ctx.route('**/api/notizie*', r => r.fulfill({status:200, contentType:'application/json', body: JSON.stringify({
        fonte:'San Marino RTV', notizie:[{titolo:'Il Tre Fiori passa a Domagnano: 2-1 in rimonta nel finale di gara', link:'https://x.it/1', data:new Date(Date.now()-2*3600e3).toISOString()},
        {titolo:'La Fiorita, tre punti pesanti contro il Cosmos', link:'https://x.it/2', data:new Date(Date.now()-26*3600e3).toISOString()}]})}));
      const p = await ctx.newPage(); p.on('dialog', d=>d.accept());
      const wait=(ms=400)=>p.waitForTimeout(ms);
      await p.goto(`${BASE}/#/`,{waitUntil:'load'}); await wait(1200);
      await p.click('[data-tab="up"]'); await wait(250);
      await p.fill('#email','a@e.it'); await p.fill('#name','Alessandro'); await p.fill('#password','password123'); await p.click('#primary'); await wait(900);
      await p.click('[data-form="create"]'); await wait(250);
      await p.fill('#lname','Campionato dei Sudati di San Marino'); await p.fill('#team','Hasta El Chapo FC'); await p.click('#go-create'); await wait(1000);
      await p.evaluate(() => {
        const K='fcs:mock'; const s=JSON.parse(localStorage.getItem(K)); const lg=s.tables.leagues[0];
        [['Serravalle United','Marco','#c0392b','SU'],['Borgo Maggiore FC','Luca','#27ae60','BM'],
         ['Domagnano Stars','Sara','#8e44ad','DS'],['Fiorentino Boys','Giulia','#e67e22','FB']].forEach(([t,o,c,i],k)=>{
          s.tables.league_members.push({id:'fk'+k, league_id:lg.id, user_id:'fu'+k, role:'fantallenatore',
            team_name:t, owner_name:o, color:c, initials:i, credits:500, created_at:new Date().toISOString()});});
        localStorage.setItem(K, JSON.stringify(s));
      });
      await p.reload({waitUntil:'load'}); await wait(1500);
      await p.evaluate(()=>{location.hash='#/lega';}); await wait(600); await p.click('#draft').catch(()=>{}); await wait(2000);
      await p.evaluate(()=>{location.hash='#/impostazioni/avanzate';}); await wait(600);
      const seme = await p.evaluate(()=>{const x=document.querySelector('[data-act="seed"]'); if(!x) return false; x.click(); return true;});
      if (!seme) throw new Error('la voce per caricare le giornate non c\'e\': la prova girerebbe su una lega vuota');
      await wait(3500);
      await p.evaluate(t=>{document.documentElement.setAttribute('data-theme',t);}, tema); await wait(300);

      for (const r of ROTTE) {
        await p.evaluate(h=>{location.hash='#/'+h;}, r); await wait(600);
        // I caratteri veri sono piu' stretti di quelli di ripiego: misurare
        // prima che siano pronti fa sembrare che il testo sbordi.
        await p.evaluate(() => document.fonts && document.fonts.ready);
        const esiti = await p.evaluate(({W, r}) => {
          const out=[];
          const body=document.querySelector('.a-body');
          if (body && body.scrollWidth > body.clientWidth+1) out.push(`scorre in orizzontale (${body.scrollWidth}>${body.clientWidth})`);
          // elementi che sbordano dalla finestra
          document.querySelectorAll('.a-body *').forEach(el=>{
            const b=el.getBoundingClientRect();
            if (b.width && (b.right > W+1 || b.left < -1)) {
              const cs=getComputedStyle(el);
              if (cs.overflow==='hidden'||cs.overflowX==='auto'||cs.position==='fixed') return;
              // Dentro una fascia che scorre di proposito (.sqs, .chips, .gsel)
              // sbordare e' il comportamento voluto, a QUALUNQUE profondita':
              // prima si guardava solo il genitore diretto, quindi i nipoti
              // venivano segnalati a raffica.
              for (let a=el.parentElement; a && a!==document.body; a=a.parentElement) {
                const cs2=getComputedStyle(a);
                if (cs2.overflowX==='auto'||cs2.overflowX==='scroll'||cs2.overflowX==='hidden') return;
              }
              out.push(`sborda: ${el.className||el.tagName} ${Math.round(b.left)}..${Math.round(b.right)}`);
            }
          });
          // contrasto del testo sul fondo effettivo (WCAG AA: 4.5, 3.0 se grande)
          // Un colore CSS letto da getComputedStyle puo' arrivare in due scale:
          // rgb()/rgba() ha le componenti da 0 a 255, color(srgb ...) da 0 a 1.
          // Trattare le seconde come le prime faceva leggere il bianco quasi
          // nero, e l'audit segnalava contrasti inventati su testi che stavano
          // benissimo. L'alfa ora viene composta sul fondo invece di ignorarla.
          const leggi = (c) => { if (!c) return null;
            const m = c.match(/[\d.]+/g); if (!m) return null;
            const zeroUno = /^color\(/.test(c.trim());
            const s = zeroUno ? 255 : 1;
            const [r, g, b] = m.slice(0, 3).map((x) => Number(x) * s);
            const a = m[3] !== undefined ? Number(m[3]) : 1;
            return { r, g, b, a }; };
          const sopra = (f, d) => ({ r: f.r*f.a + d.r*(1-f.a), g: f.g*f.a + d.g*(1-f.a), b: f.b*f.a + d.b*(1-f.a), a: 1 });
          const lumDi = (c) => { const f=(v)=>{v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4);};
            return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
          // Il fondo effettivo: si risale compònendo ogni strato semitrasparente
          // finche' non se ne trova uno pieno.
          const fondo = (el) => { let e=el; let acc=null;
            while (e && e !== document.documentElement) {
              const c = leggi(getComputedStyle(e).backgroundColor);
              if (c && c.a > 0.004) { acc = acc ? sopra(acc, c) : c; if (acc.a > 0.995) return acc; }
              e = e.parentElement; }
            const b = leggi(getComputedStyle(document.body).backgroundColor) || { r:255,g:255,b:255,a:1 };
            return acc ? sopra(acc, { ...b, a: 1 }) : { ...b, a: 1 }; };
          document.querySelectorAll('.app *').forEach(el=>{
            if (!el.childNodes.length) return;
            const testo=[...el.childNodes].filter(n=>n.nodeType===3 && n.textContent.trim()).map(n=>n.textContent.trim()).join('');
            if (!testo) return;
            const cs=getComputedStyle(el);
            if (cs.visibility==='hidden'||cs.display==='none'||Number(cs.opacity)<0.5) return;
            // niente testo sopra un'immagine: il fondo non si puo' leggere da qui
            if (el.closest('.maglia,.a-hero,.nbig,.share,.field')) return;
            // un fondo a gradiente non si legge da backgroundColor: saltarlo
            // evita di confrontare il testo col colore della card sotto
            let g=el; let grad=false;
            while(g && g!==document.body){ if(getComputedStyle(g).backgroundImage!=='none'){grad=true;break;} g=g.parentElement; }
            if (grad) return;
            const testoCol = leggi(cs.color); const sfondo = fondo(el);
            if (!testoCol || !sfondo) return;
            if (testoCol.a < 0.06) return;   // testo praticamente invisibile: non e' un problema di contrasto
            const l1 = lumDi(sopra(testoCol, sfondo)), l2 = lumDi(sfondo);
            const r=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
            const px=parseFloat(cs.fontSize); const grande = px>=24 || (px>=18.66 && Number(cs.fontWeight)>=700);
            const soglia = grande ? 3 : 4.5;
            if (r < soglia) out.push(`contrasto ${r.toFixed(2)}<${soglia} (${Math.round(px)}px) [${el.className||el.tagName}] fg=${cs.color} bg=rgb(${Math.round(sfondo.r)}, ${Math.round(sfondo.g)}, ${Math.round(sfondo.b)}): "${testo.slice(0,20)}"`);
          });
          // bersagli di tocco troppo piccoli
          // WCAG 2.5.8 esenta il bersaglio "in a sentence": un link in mezzo a una
          // frase e' vincolato all'interlinea del testo attorno, e ingrandirlo
          // spezzerebbe la riga. Vale solo se e' davvero in mezzo ad altro testo.
          const dentroUnaFrase = (el) => {
            if (el.tagName !== 'A' || getComputedStyle(el).display !== 'inline') return false;
            const p = el.parentElement; if (!p) return false;
            return p.textContent.trim().length > el.textContent.trim().length + 4;
          };
          document.querySelectorAll('.a-body a,.a-body button,.a-nav a').forEach(el=>{
            const b=el.getBoundingClientRect();
            if (!b.width||!b.height) return;
            if (dentroUnaFrase(el)) return;
            if (b.height < 32 || b.width < 32) out.push(`tocco piccolo ${Math.round(b.width)}x${Math.round(b.height)}: ${(el.className||'')||el.textContent.trim().slice(0,20)}`);
          });
          return [...new Set(out)];
        }, {W, r});
        for (const e of esiti) problemi.push(`${W}px ${tema} · #/${r||'(home)'} · ${e}`);
      }
      await ctx.close();
    }
  }
  console.log(problemi.length ? problemi.join('\n') : 'nessun problema');
  console.log('\ntotale:', problemi.length);
  await b.close();
  // Il codice d'uscita serve a chi lancia la suite: senza, un problema
  // scorreva via fra le righe e il lavoro risultava riuscito.
  process.exit(problemi.length ? 1 : 0);
})();
