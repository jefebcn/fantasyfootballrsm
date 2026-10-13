/**
 * Il proprietario dell'app (033) e gli altri amministratori.
 *
 * Alex, 13/10: «che altri non possano avere le stesse funzioni admin totali
 * che ho io». Fino a qui un amministratore poteva togliere i poteri a tutti
 * gli altri, Alex compreso. Qui si guarda la console con gli occhi di un
 * amministratore che NON e' il proprietario: niente «Fai admin», nessun tasto
 * sulla riga del proprietario, niente modalita' prudente, sponsor in sola
 * lettura. E il finto database, come quello vero, rifiuta lo stesso.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Secondo'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);

  // chi gioca e' un amministratore qualunque; il proprietario e' un altro
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    s.tables.profiles.push({ id: 'u_alex', display_name: 'Alex', email: 'alex@example.org', is_admin: true, is_judge: true, is_owner: true, created_at: new Date().toISOString() });
    s.tables.profiles.push({ id: 'u_tizio', display_name: 'Tizio', email: 'tizio@example.org', is_admin: false, is_judge: false, created_at: new Date().toISOString() });
    (s.tables.sponsor ||= []).push({ id: 'sp1', nome: 'Bar Titano', dal: new Date().toISOString().slice(0, 10), al: null, attivo: true });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    location.hash = '#/admin/console';
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('[data-atab]', { timeout: 8000 }).catch(() => {});
  et(!(await p.$('[data-prudente]')), 'la modalità prudente non la tocca un amministratore qualunque');

  await p.evaluate(() => [...document.querySelectorAll('[data-atab]')].find((e) => e.dataset.atab === 'persone')?.click());
  await p.waitForFunction(() => document.querySelectorAll('.adm-u').length >= 3, null, { timeout: 8000 }).catch(() => {});
  const vista = await p.evaluate(() => {
    const riga = (nome) => [...document.querySelectorAll('.adm-u')].find((r) => r.querySelector('.nm b')?.textContent === nome);
    const alex = riga('Alex'), tizio = riga('Tizio');
    return {
      tagAlex: alex?.querySelector('.tag')?.innerText || '',
      tastiAlex: alex ? alex.querySelectorAll('button').length : -1,
      faiAdmin: !!document.querySelector('[data-ruolo^="is_admin:"]'),
      reset: !!document.querySelector('[data-reset]'),
      faiGiudiceTizio: !!tizio?.querySelector('[data-ruolo^="is_judge:"]'),
      nota: document.body.innerText,
    };
  });
  et(/proprietario/i.test(vista.tagAlex), `il proprietario è segnato come tale («${vista.tagAlex}»)`);
  et(vista.tastiAlex === 0, `sulla sua riga nessun tasto (${vista.tastiAlex})`);
  et(!vista.faiAdmin, 'nessun «Fai admin»: gli amministratori li nomina il proprietario');
  et(!vista.reset, 'niente link per la password: servirebbe l\'e-mail intera');
  et(vista.faiGiudiceTizio, 'i Giudici invece si nominano anche da qui');
  et(/solo dal proprietario/.test(vista.nota), 'e la console dice perché');

  // il finto database rifiuta come quello vero, anche chiamandolo a mano
  const rifiuti = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const prova = async (f) => { try { await f(); return 'passato'; } catch (e) { return e.message; } };
    return {
      nomina: await prova(() => S.adminImpostaRuolo('u_tizio', 'is_admin', true)),
      togli: await prova(() => S.adminImpostaRuolo('u_alex', 'is_admin', false)),
    };
  });
  et(/proprietario/.test(rifiuti.nomina), `nominare un amministratore viene rifiutato («${rifiuti.nomina}»)`);
  et(/proprietario/.test(rifiuti.togli), `togliere i poteri al proprietario viene rifiutato («${rifiuti.togli}»)`);

  await p.evaluate(() => [...document.querySelectorAll('[data-atab]')].find((e) => e.dataset.atab === 'sponsor')?.click());
  await p.waitForFunction(() => /Bar Titano/.test(document.querySelector('main')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  const sp = await p.evaluate(() => ({ form: !!document.querySelector('#sp-salva'), mod: !!document.querySelector('[data-sp-mod]'), testo: document.querySelector('main')?.innerText || '' }));
  et(/Bar Titano/.test(sp.testo), 'gli sponsor si vedono');
  et(!sp.form && !sp.mod, 'ma non si aggiungono né si modificano');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
