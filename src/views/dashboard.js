import * as S from '../state.js';
import * as N from '../notizie.js';
import { esc, fmt, icon, logo, badge, crest, matchCard, tile, sec, dateIt, timeIt } from '../ui.js';

const RULES = [
  ['Art. 7.4', 'Rigore parato', 'Vale +3,0 al portiere e −3,0 al tiratore. Sul palo o fuori: −3,0 al tiratore e nessun bonus al portiere.'],
  ['Art. 7.5', 'Porta inviolata', 'Spetta solo se la squadra chiude senza subire gol e il giocatore ha disputato almeno 60 minuti.'],
  ['Art. 6.2', 'Capitano', 'Raddoppia bonus e malus, non il voto base. Se è S.V. subentra il vice.'],
  ['Art. 8.5', 'Sostituzioni automatiche', 'Un titolare S.V. è sostituito dal primo panchinaro del suo ruolo con voto. Massimo tre.'],
  ['Art. 9.2', 'Congelamento', 'Martedì alle 20:00 la giornata diventa definitiva, anche se emergono errori.'],
  ['Art. 11', 'Conversione in gol', 'Con dieci fantallenatori il primo gol scatta a 69,0, poi uno ogni 6,0 punti.'],
  ['Art. 4', 'Esito collettivo', 'Vittoria +0,5, sconfitta −0,5; metà tra 20 e 59 minuti. Senza pagelle serve differenziare.'],
];

/** L'azione della settimana: una sola, in cima, con il perché accanto. */
function azione(ph, me) {
  const n = ph.next; const md = S.matchday(n);
  const saved = S.savedLineup(n, me.id);
  const st = S.matchdayStatus(n);
  if (st === 'open' || st === 'scheduled') {
    const left = Math.max(0, new Date(md.lockAt) - S.now());
    const g = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000);
    return tile({
      href: '#/rosa/formazione', lead: icon('shirt'), leadKind: saved ? '' : 'gold', cls: saved ? '' : 'cta',
      title: saved ? `Formazione pronta · giornata ${n}` : `Schiera la formazione`,
      sub: saved ? `Salvata ${dateIt(saved.submittedAt)} · puoi cambiarla fino al lock` : `Giornata ${n} · si chiude ${dateIt(md.lockAt)} alle ${timeIt(md.lockAt)}${left ? ` · mancano ${g}g ${h}h` : ''}`,
    });
  }
  return tile({ href: `#/voti/${ph.matchday}`, lead: icon('votes'), leadKind: 'warn',
    title: `Voti della giornata ${ph.matchday}`,
    sub: st === 'frozen' ? 'Giornata congelata: risultati definitivi' : 'Punteggi provvisori: puoi segnalare un errore fino a martedì',
    badgeHtml: badge(st, st === 'provisional' ? 'fino a mar 18:00' : '') });
}

/**
 * Lo scontro della giornata in corso, sempre presente: è la prima cosa che si
 * cerca riaprendo l'app. Prima compariva solo a giornata giocata, quindi tra il
 * lunedì e il sabato la dashboard non diceva più contro chi si gioca.
 */
function sfida(ph, curR, riposo) {
  if (riposo) return sec('Giornata in corso', `${ph.matchday}ª di lega`)
    + tile({ href: '#/calendario', lead: icon('cal'), title: 'Turno di riposo', sub: `In questa giornata non hai avversarie` });
  if (!curR) return '';
  const lock = S.matchday(ph.matchday)?.lockAt;
  const titolo = curR.played ? (ph.status === 'frozen' ? 'Giornata conclusa' : 'Risultati provvisori') : 'La tua sfida';
  const meta = curR.played ? '' : (lock ? `si chiude ${dateIt(lock)} · ${timeIt(lock)}` : '');
  return sec(titolo, `${ph.matchday}ª di lega`) + matchCard(curR, S.managersById, { meta });
}

/**
 * Le prossime partite vere del campionato, in una fila che scorre: è il pezzo
 * di contesto che mancava, e viene dal calendario FSGC, non dalla lega.
 */
function prossimePartite(ph) {
  const cerca = (n) => (n && n <= 30 ? S.matchesOf(n).filter((m) => m.status === 'scheduled') : []);
  let n = ph.matchday; let ms = cerca(n);
  if (!ms.length) { n = ph.next; ms = cerca(n); }
  if (!ms.length) return '';
  const cl = (id) => S.clubsById.get(id);
  return sec('Prossime partite', `${n}ª giornata`) + `<div class="upcoming">${ms.slice(0, 6).map((m) => {
    const h = cl(m.homeClubId), a = cl(m.awayClubId); const k = m.kickoffAt ? new Date(m.kickoffAt) : null;
    return `<a class="up" href="#/calendario/${n}">
      <span class="when">${k ? `${dateIt(k)} · ${timeIt(k)}` : `${n}ª giornata`}</span>
      <span class="teams">
        <span class="t">${crest({ color: h.color, initials: h.shortName }, 'sm')}<b>${esc(h.name)}</b></span>
        <em>VS</em>
        <span class="t">${crest({ color: a.color, initials: a.shortName }, 'sm')}<b>${esc(a.name)}</b></span>
      </span>
      <span class="where">${esc(m.venue)}</span></a>`;
  }).join('')}</div>`;
}

/** Anteprima della classifica di lega, con la propria riga sempre inclusa. */
function classificaBreve(me) {
  const st = S.standings(); if (st.length < 2) return '';
  const mio = st.findIndex((r) => r.managerId === me.id);
  const righe = st.slice(0, 5);
  if (mio >= 5) righe.push(st[mio]);            // se sei fuori dai primi cinque, la tua riga si aggiunge
  return sec('Classifica', `${st.length} squadre`) + `<a class="a-card lead" href="#/classifica">
    ${righe.map((r) => { const m = S.managersById.get(r.managerId); const io = r.managerId === me.id;
      return `<span class="lrow${io ? ' io' : ''}"><i class="pos">${r.position}</i>${crest(m, 'sm')}
        <span class="nm"><b>${esc(m.teamName)}</b><span>${esc(m.owner)}</span></span>
        <span class="pt"><b>${r.points}</b><span>punti</span></span></span>`; }).join('')}
    <span class="lcta">Classifica completa${icon('chev', 'ic sm')}</span></a>`;
}

/** Notizie vere del campionato: la prima in grande, le altre in riga. */
function notizie() {
  const list = N.disponibili(); if (!list.length) return '';
  const quando = (iso) => {
    if (!iso) return '';
    const d = new Date(iso); const ore = (Date.now() - d) / 3600000;
    if (ore < 1) return 'poco fa';
    if (ore < 24) return `${Math.round(ore)} h fa`;
    if (ore < 48) return 'ieri';
    return dateIt(d);
  };
  const meta = (n) => `${esc(quando(n.data))}${n.data ? ' · ' : ''}${esc(N.fonte())}`;
  const [prima, ...altre] = list.slice(0, 5);
  const grande = `<a class="nbig" href="${esc(prima.link)}" target="_blank" rel="noopener noreferrer">
    ${prima.foto ? `<span class="ph"><img src="${esc(prima.foto)}" alt="" decoding="async"></span>` : ''}
    <span class="tx"><b>${esc(prima.titolo)}</b>${prima.sommario ? `<span>${esc(prima.sommario)}</span>` : ''}<em>${meta(prima)}</em></span></a>`;
  const righe = altre.map((n) => `<a class="ni" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">
    ${n.fotoMini || n.foto ? `<span class="th"><img src="${esc(n.fotoMini || n.foto)}" alt="" loading="lazy" decoding="async"></span>` : ''}
    <span class="tx"><b>${esc(n.titolo)}</b><em>${meta(n)}</em></span></a>`).join('');
  return sec('Notizie', esc(N.fonte())) + grande + `<div class="news">${righe}
    <a class="lcta" href="https://www.sanmarinortv.sm/sport/calcio-sammarinese-c15" target="_blank" rel="noopener noreferrer">Tutte le notizie su ${esc(N.fonte())}${icon('out', 'ic sm')}</a></div>`;
}

export const dashboard = {
  title: 'Dashboard',
  render() {
    const me = S.me(); const ph = S.weekPhase();
    if (!me) return `<main class="a-body"><div class="empty">${logo()}<p>Non fai parte di questa lega.</p><a class="a-btn" href="#/leghe" style="text-decoration:none">Le mie leghe</a></div></main>`;
    const st = S.standings(); const row = st.find((r) => r.managerId === me.id) || { position: '–', points: 0, played: 0, fantapunti: 0 };
    const noRoster = S.rosterIds(me.id).length === 0;
    const cur = S.myFixture(ph.matchday, me.id); const curR = cur ? S.fixtureResult(cur) : null;
    const riposo = !cur && S.base.managers.length > 1;
    const nxt = S.myFixture(ph.next, me.id); const nxtR = nxt && ph.next !== ph.matchday ? S.fixtureResult(nxt) : null;
    const last = S.resultsUntil(ph.matchday).filter((r) => r.homeManagerId === me.id || r.awayManagerId === me.id).slice(-5).reverse();
    const forma = last.length ? `${sec('Ultimi risultati', last.length < 5 ? `${last.length} giocate` : '')}
      <div class="a-card form-row">${[...last.map((r) => { const home = r.homeManagerId === me.id;
        const gf = home ? r.homeGoals : r.awayGoals, gs = home ? r.awayGoals : r.homeGoals;
        const k = gf > gs ? 'v' : gf < gs ? 'p' : 'n';
        return `<div><i class="${k}">${k.toUpperCase()}</i><b>${gf}–${gs}</b><small>G${r.matchday}</small></div>`;
      }), ...Array(Math.max(0, 5 - last.length)).fill('<div><i></i><b>–</b><small>&nbsp;</small></div>')].join('')}</div>` : '';
    const [art, titolo, testo] = RULES[Math.floor(Date.now() / 86400000) % RULES.length];

    return `<main class="a-body">
      <div id="install-slot"></div>
      <div class="a-herowrap">
        <div class="a-hero">${logo('tw')}
          <a class="hero-league" href="#/leghe">${esc(S.base.league.name)}${icon('chev', 'ic sm')}</a>
          <svg class="jersey" style="--j1:${me.color};--j2:${me.color}"><use href="#i-jersey"/></svg>
          <h2>${esc(me.teamName)}</h2><p class="hero-owner">${esc(me.owner)}</p>
          <div class="acts">
            <a href="#/scheda" aria-label="Condividi la scheda"><button>${icon('share')}</button></a>
            <a href="#/rosa" aria-label="La mia rosa"><button>${icon('shirt')}</button></a>
            <a href="#/mercato" aria-label="Mercato libero"><button class="gold">${icon('cart')}</button></a>
          </div>
        </div>
      </div>
      <div class="a-card a-stats">
        <div><b>${row.position}<sup>ª</sup></b><span>Posizione</span></div>
        <div><b>${row.points}</b><span>Punti</span></div>
        <div><b>${row.played}</b><span>Partite</span></div>
        <div><b>${fmt(row.fantapunti)}</b><span>Fantapunti</span></div>
      </div>
      ${sfida(ph, curR, riposo)}
      ${noRoster ? tile({ href: S.isLeagueAdmin() ? '#/lega' : '#/leghe', lead: icon('warn'), leadKind: 'warn',
          title: 'Rose non ancora assegnate',
          sub: S.isLeagueAdmin() ? "Generale o inserirle dalla gestione lega" : "Le assegna l'admin della lega dopo l'asta" }) : azione(ph, me)}
      ${nxtR ? sec('Prossima giornata', `${ph.next}ª di lega`) + matchCard(nxtR, S.managersById, { meta: `${dateIt(S.matchday(ph.next).lockAt)} · ${timeIt(S.matchday(ph.next).lockAt)}` }) : ''}
      ${forma}
      ${prossimePartite(ph)}
      ${notizie()}
      ${classificaBreve(me)}
      ${sec('Dal regolamento')}
      <div class="rule"><span class="art">${art}</span><p><b>${titolo}.</b> ${testo}</p></div>
    </main>`;
  },
  mount(root, ctx) {
    const slot = root.querySelector('#install-slot');
    const show = () => {
      if (!window.__installPrompt || S.store.get().installedDismissed || !slot) return;
      slot.innerHTML = `<div class="install">${logo()}<div style="flex:1"><b>Installa l'app</b>Sulla schermata Home si apre a tutto schermo.</div><button class="ok" id="inst-ok">Installa</button><button class="no" id="inst-no">✕</button></div>`;
      slot.querySelector('#inst-ok').onclick = async () => { const p = window.__installPrompt; if (!p) return; p.prompt(); await p.userChoice; window.__installPrompt = null; slot.innerHTML = ''; };
      slot.querySelector('#inst-no').onclick = () => { S.store.set({ installedDismissed: true }); slot.innerHTML = ''; };
    };
    show(); document.addEventListener('installable', show, { once: true });
    N.carica(() => ctx.render());
    // 'error' non risale: si ascolta in cattura. Una foto che non carica sparisce
    // insieme al suo riquadro, invece di lasciare l'icona di immagine rotta.
    root.addEventListener('error', (e) => {
      const img = e.target; if (img?.tagName !== 'IMG') return;
      const box = img.closest('.ph, .th'); if (box) box.remove();
    }, true);
  },
};
