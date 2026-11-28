/**
 * IL CAMPO DELLO SCONTRO NELLE LEGHE PRIVATE.
 *
 * Alex, 27/11: «un personaggio non deve coprire il nome dell'altro»; «manca,
 * come in quella pubblica, sotto il nome di che squadra è e contro chi
 * gioca»; «il campo non è delineato per niente bene»; «se anche l'avversario
 * mette la squadra si devono vedere entrambe, con una piccola separazione».
 * Qui: due undici sul campo, una meta' per squadra col suo nome, la partita
 * sotto ogni giocatore, nessuna figura sopra un nome o una partita, e la
 * meta' con la scritta quando l'avversario non ha nessuno da schierare.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

async function scontro(b, una) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 2400 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', colorScheme: 'dark' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', `campo${una ? 1 : 2}@e.it`); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy');
  await p.click('#go-create'); await w(1300);
  // l'avversario con l'undici consegnato; io con il mio, o senza nessuno da schierare
  await p.evaluate(async (soloLui) => {
    const S = await import('/src/state.js');
    const tutti = [...S.playersById.values()].filter((x) => x.isActive !== false);
    const undici = (k) => { const di = (r, q) => tutti.filter((x) => x.role === r).slice(k * q, k * q + q).map((x) => x.id);
      const st = [...di('P', 1), ...di('D', 4), ...di('C', 4), ...di('A', 2)];
      return { formation: '4-4-2', starters: st, bench: [], captainId: st[10], viceCaptainId: st[9] }; };
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const io = s.tables.league_members[0]; const lega = s.tables.leagues[0];
    s.tables.profiles.push({ id: 'u_rivale', display_name: 'Enea', is_judge: false });
    s.tables.league_members.push({ ...io, id: 'm_rivale', user_id: 'u_rivale', role: 'fantallenatore', team_name: 'Fuego Roxy', owner_name: 'Enea', color: '#1B84C6', initials: 'FR' });
    s.tables.lineups = s.tables.lineups || [];
    const ora = new Date().toISOString();
    // la sfida in home e' quella della prossima giornata: le formazioni ci sono per tutte
    for (let n = 1; n <= 40; n++) {
      s.tables.lineups.push({ league_id: lega.id, member_id: 'm_rivale', matchday: n, submitted_at: ora, lineup: undici(1) });
      s.tables.lineups.push({ league_id: lega.id, member_id: io.id, matchday: n, submitted_at: ora, lineup: soloLui ? { formation: '4-4-2', starters: [], bench: [] } : undici(2) });
    }
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  }, una);
  await p.evaluate(() => { location.hash = '#/'; }); await p.reload({ waitUntil: 'load' }); await w(1800);
  await p.locator('a.mrow.tocca').first().click(); await w(1500);
  const r = await p.evaluate(() => {
    const campo = document.querySelector('.field.scontro'); if (!campo) return null;
    const ps = [...campo.querySelectorAll('.ps')];
    const coperti = [];
    for (const a of ps) {
      const fig = (a.querySelector('.av img') || a.querySelector('.av')).getBoundingClientRect();
      for (const b of ps) { if (a === b) continue;
        for (const el of b.querySelectorAll('b, .avv')) { const t = el.getBoundingClientRect();
          if (fig.left < t.right && fig.right > t.left && fig.top < t.bottom && fig.bottom > t.top) coperti.push(`${a.querySelector('b').textContent} copre ${b.querySelector('b').textContent}`); } }
    }
    return { mete: [...campo.querySelectorAll('.meta')].map((m) => ({ nome: m.querySelector('.tag-sq')?.textContent, giocatori: m.querySelectorAll('.ps').length, vuota: !!m.querySelector('.vuota-sq') })),
      centro: !!campo.querySelector('.centro'), aree: campo.querySelectorAll('.area').length,
      partite: ps.filter((x) => /^[A-Z0-9]{2,4} (vs|@) [A-Z0-9]{2,4}$|riposa/.test(x.querySelector('.avv')?.textContent || '')).length, tot: ps.length, coperti };
  });
  await p.locator('.field.scontro').screenshot({ path: `${USCITA}/scontro-campo${una ? '-una' : ''}.png` }).catch(() => {});
  await ctx.close();
  return { r, errori };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const due = await scontro(b, false);
  const r = due.r || { mete: [], coperti: ['campo dello scontro assente'] };
  et(r.mete.length === 2 && r.mete.every((m) => m.giocatori === 11), `due meta' da 11 (${JSON.stringify(r.mete)})`);
  et(r.mete[0]?.nome === 'Fuego Roxy' && r.mete[1]?.nome === 'Hasta El Roxy', 'ogni meta\' ha il nome della sua squadra, casa sopra');
  et(r.centro && r.aree === 2, 'linea di centrocampo in mezzo e due aree di rigore');
  et(r.partite === r.tot && r.tot === 22, `sotto ogni nome la sua squadra e l'avversaria (${r.partite}/${r.tot})`);
  et(r.coperti.length === 0, `nessuna figura copre un nome o una partita${r.coperti.length ? ' — ' + r.coperti.slice(0, 3).join(', ') : ''}`);
  const una = await scontro(b, true);
  const u = una.r || { mete: [] };
  et(u.mete[0]?.giocatori === 11 && u.mete[1]?.vuota, `chi non ha nessuno da schierare ha la sua meta' con la scritta (${JSON.stringify(u.mete)})`);
  const errori = [...due.errori, ...una.errori];
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
