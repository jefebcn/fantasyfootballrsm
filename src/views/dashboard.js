import * as S from '../state.js';
import { esc, fmt, icon, badge, crest, matchCard, sec, dateIt, timeIt } from '../ui.js';

const RULES = [
  ['Art. 7.4', '<b>Rigore parato:</b> +3,0 al portiere, −3,0 al tiratore. Sul palo o fuori: −3,0 al tiratore e nessun bonus al portiere.'],
  ['Art. 7.5', '<b>Porta inviolata:</b> spetta solo se la squadra chiude senza subire gol e il giocatore ha disputato almeno 60 minuti.'],
  ['Art. 6.2', '<b>Capitano:</b> raddoppia bonus e malus, non il voto base. Se è S.V. subentra il vice.'],
  ['Art. 8.5', '<b>Sostituzioni automatiche:</b> un titolare S.V. è sostituito dal primo panchinaro del suo ruolo con voto. Massimo 3.'],
  ['Art. 9.2', '<b>Congelamento:</b> martedì alle 20:00 la giornata diventa definitiva, anche se emergono errori.'],
  ['Art. 11', '<b>Conversione in gol:</b> con 10 fantallenatori il primo gol scatta a 69,0, poi uno ogni 6,0 punti.'],
  ['Art. 4', '<b>Esito collettivo:</b> vittoria +0,5, sconfitta −0,5 (metà tra 20 e 59 minuti). Senza pagelle serve differenziare.'],
];

function phaseCard(ph) {
  const n = ph.matchday; const st = ph.status;
  if (st === 'provisional') return `<div class="a-card a-fase">${badge('provisional')}<div class="r"><p><b>Giornata ${n}</b> · punteggi provvisori pubblicati</p><a class="a-link" href="#/voti/${n}">Vedi i voti ›</a></div></div>`;
  if (st === 'frozen') return `<div class="a-card a-fase">${badge('frozen')}<div class="r"><p><b>Giornata ${n}</b> · archiviata</p><a class="a-link" href="#/voti/${n}">Vedi i voti ›</a></div></div>`;
  if (st === 'live') return `<div class="a-card a-fase">${badge('live')}<div class="r"><p><b>Giornata ${n}</b> · eventi in inserimento</p><a class="a-link" href="#/voti/${n}">Parziali ›</a></div></div>`;
  return '';
}
function nextCard(ph, me) {
  const n = ph.next; const md = S.matchday(n); const lock = md ? new Date(md.lockAt) : null;
  const left = lock ? Math.max(0, lock - S.now()) : 0; const d = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000);
  const saved = S.savedLineup(n, me.id);
  return `<div class="a-card a-fase">${badge('open', `lock ${dateIt(md.lockAt)} ${timeIt(md.lockAt)} · ${d}g ${h}h`)}<div class="r"><p><b>Giornata ${n}</b> · ${saved ? 'formazione salvata' : 'formazione non ancora salvata'}</p><a class="a-link" href="#/rosa/formazione">${saved ? 'Modifica ›' : 'Schiera ›'}</a></div>${saved ? '' : `<a class="a-btn" href="#/rosa/formazione" style="text-decoration:none">${icon('shirt', 'ic sm')}Schiera la formazione</a>`}</div>`;
}

export const dashboard = {
  title: 'Dashboard',
  render() {
    const me = S.me(); const ph = S.weekPhase(); const st = S.standings(); const row = (me && st.find((r) => r.managerId === me.id)) || { position: '–', points: 0, played: 0, fantapunti: 0 };
    if (!me) return `<main class="a-body"><div class="empty">${icon('towers')}<p>Non fai parte di questa lega.</p><a class="a-btn" href="#/leghe" style="text-decoration:none">Le mie leghe</a></div></main>`;
    const noRoster = S.rosterIds(me.id).length === 0;
    const cur = S.myFixture(ph.matchday, me.id); const curR = cur ? S.fixtureResult(cur) : null;
    const nxt = S.myFixture(ph.next, me.id); const nxtR = nxt ? S.fixtureResult(nxt) : null;
    const last = S.resultsUntil(ph.matchday).filter((r) => r.homeManagerId === me.id || r.awayManagerId === me.id).slice(-5).reverse();
    const last5 = [...last.map((r) => { const home = r.homeManagerId === me.id; const gf = home ? r.homeGoals : r.awayGoals, gs = home ? r.awayGoals : r.homeGoals; const cls = gf > gs ? 'v' : gf < gs ? 'p' : 'n'; return `<div><i class="${cls}">${r.matchday}</i>${gf} – ${gs}<small>${fmt(home ? r.homeScore : r.awayScore)}</small></div>`; }), ...Array(Math.max(0, 5 - last.length)).fill('<div><i></i></div>')].join('');
    const rule = RULES[Math.floor(Date.now() / 86400000) % RULES.length];
    const err = S.connectionError();
    return `<main class="a-body">
      <div id="install-slot"></div>
      ${err ? `<div class="warn block">${icon('warn', 'ic sm')}<span><b>Modalità locale.</b> ${esc(err.message)} — i dati che vedi sono la demo sul dispositivo. <a href="#/impostazioni">Riprova la connessione</a></span></div>` : ''}
      <div class="a-herowrap"><a class="a-league" href="#/leghe" style="text-decoration:none;color:inherit">${esc(S.base.league.shortName)} ${icon('chev')}</a>
        <div class="a-hero">${icon('towers', 'tw')}<h2>${esc(me.teamName)}</h2>
          <svg class="jersey" style="--j1:${me.color};--j2:${me.color}"><use href="#i-jersey"/></svg>
          <div class="acts"><a href="#/scheda" aria-label="Condividi scheda"><button>${icon('share')}</button></a><a href="#/impostazioni" aria-label="Impostazioni"><button>${icon('gear')}</button></a><a href="#/mercato" aria-label="Mercato libero"><button class="gold">${icon('cart')}</button></a></div>
          <div class="logos">${icon('towers', '')}<span>Fantacampionato</span><i></i><span>Titani.TV</span></div>
        </div></div>
      <div class="a-card a-stats"><div><b>${row.position}<sup>ª</sup></b><span>Posizione</span></div><div><b>${row.points}</b><span>Punti</span></div><div><b>${row.played}</b><span>Partite</span></div><div><b>${fmt(row.fantapunti)}</b><span>Fantapunti</span></div></div>
      ${noRoster ? `<div class="warn info">${icon('warn', 'ic sm')}<span><b>Rose non ancora assegnate.</b> ${S.isLeagueAdmin() ? '<a href="#/lega">Genera o inserisci le rose</a> dalla gestione lega.' : 'L\'admin della lega le assegna dopo l\'asta.'}</span></div>` : ''}
      ${phaseCard(ph)}
      ${nextCard(ph, me)}
      ${curR ? sec(`${ph.status === 'frozen' ? 'Ultima giornata' : 'Risultati provvisori'}`, `${ph.matchday}ª di Lega · ${ph.matchday}ª del Campionato`) + matchCard(curR, S.managersById) : ''}
      ${nxtR ? sec('Prossima giornata', `${ph.next}ª di Lega · ${ph.next}ª del Campionato`) + matchCard(nxtR, S.managersById) : ''}
      ${sec('Ultimi 5 incontri', 'dal più recente')}<div class="a-card last5">${last5}</div>
      <div class="a-card a-rule"><span class="art">${rule[0]}</span><p>${rule[1]}</p></div>
    </main>`;
  },
  mount(root) {
    const slot = root.querySelector('#install-slot');
    const show = () => {
      if (!window.__installPrompt || S.store.get().installedDismissed || !slot) return;
      slot.innerHTML = `<div class="install">${icon('towers', 'ic')}<div style="flex:1"><b>Installa l'app</b>Aggiungi alla schermata Home: si apre a tutto schermo, anche offline.</div><button class="ok" id="inst-ok">Installa</button><button class="no" id="inst-no">✕</button></div>`;
      slot.querySelector('#inst-ok').onclick = async () => { const p = window.__installPrompt; if (!p) return; p.prompt(); await p.userChoice; window.__installPrompt = null; slot.innerHTML = ''; };
      slot.querySelector('#inst-no').onclick = () => { S.store.set({ installedDismissed: true }); slot.innerHTML = ''; };
    };
    show(); document.addEventListener('installable', show, { once: true });
  },
};
