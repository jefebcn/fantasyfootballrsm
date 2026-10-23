import * as S from '../state.js';
import { esc, fmt, icon, crest, badge, dateIt, timeIt } from '../ui.js';
import { giornateChiuse } from './formazione-di.js';

/**
 * LE FORMAZIONI DI TUTTI (Alex, 23/10, girando un messaggio: «di solito nei
 * fantacalci è possibile consultare le formazioni di tutti i partecipanti»).
 *
 * Si potevano gia' vedere, una per volta: toccando una squadra in
 * classifica (#/formazione/:id). Ma non lo sapeva nessuno. Qui ci sono tutte
 * insieme, giornata per giornata, ognuna col suo undici scritto per ruoli:
 * si scorre, si cerca un amico, e si tocca per aprirla sul campo.
 *
 * QUANDO. Dal lock in poi, come sempre: prima la formazione resta di chi
 * l'ha fatta (policy lineups_read, migrazione 004), se no il venerdi' alle
 * 21:04 si copierebbe quella del primo in classifica. La pagina lo dice, con
 * l'ora esatta.
 */
const RUOLI = ['P', 'D', 'C', 'A'];

function undici(l, mie) {
  const per = { P: [], D: [], C: [], A: [] };
  for (const id of (l.starters || []).filter(Boolean)) {
    const p = S.playersById.get(id); if (!p) continue;
    const segno = l.captainId === id ? '<i class="fx-c">C</i>' : l.viceCaptainId === id ? '<i class="fx-c v">V</i>' : '';
    per[p.role]?.push(`<span class="${mie.has(id) ? 'anche' : ''}">${esc(p.lastName)}${segno}</span>`);
  }
  return RUOLI.map((r) => `<div class="fx-r"><b class="rl rl-${r.toLowerCase()}">${r}</b><span>${per[r].join('') || '—'}</span></div>`).join('');
}

export const formazioniTutte = {
  title: 'Formazioni', appbar: 'back', sub: () => 'Le formazioni di tutti',
  render({ params }) {
    const chiuse = giornateChiuse();
    const n = chiuse.includes(+params.n) ? +params.n : chiuse[0];
    const prossima = S.matchday(S.giornataAperta());
    const quando = prossima && S.now() < new Date(prossima.lockAt)
      ? `<div class="warn info fx-quando">${icon('clock', 'ic sm')}<span>Quelle della <b>${prossima.number}ª</b> si vedono da <b>${dateIt(prossima.lockAt)} alle ${timeIt(prossima.lockAt)}</b>, quando si chiude la consegna: prima restano segrete, così nessuno copia.</span></div>`
      : '';
    if (!n) {
      return `<main class="a-body">${quando}<div class="empty"><p>Nessuna giornata ancora chiusa: le formazioni di tutti si vedono dal lock della prima.</p></div></main>`;
    }
    const i = chiuse.indexOf(n); const prima = chiuse[i + 1]; const dopo = chiuse[i - 1];
    const st = S.matchdayStatus(n);
    const conVoti = S.hasData(n) && st !== 'open' && st !== 'scheduled';
    const me = S.me();
    const mia = me ? S.savedLineup(n, me.id) : null;
    const mie = new Set(mia ? (mia.starters || []).filter(Boolean) : []);
    // chi ha piu' punti in cima quando ci sono i voti; prima, in ordine di nome
    const righe = S.base.managers.map((m) => {
      const l = S.savedLineup(n, m.id);
      const res = l && conVoti ? S.lineupResult(n, m.id) : null;
      return { m, l, punti: res ? res.total : null };
    }).sort((a, b) => (b.l ? 1 : 0) - (a.l ? 1 : 0) || (b.punti ?? -1) - (a.punti ?? -1) || a.m.teamName.localeCompare(b.m.teamName));
    const consegnate = righe.filter((r) => r.l).length;
    const carta = ({ m, l, punti }) => {
      const io = m.id === me?.id;
      const cerca = esc(`${m.teamName} ${m.owner || ''}`.toLowerCase());
      if (!l) {
        return `<a class="a-card fx-sq vuota" data-cerca="${cerca}" href="#/formazione/${m.id}/${n}">
          <div class="fx-testa">${crest(m, 'sm')}<span class="nm"><b>${esc(m.teamName)}</b><span>${esc(m.owner || '')}</span></span><span class="fx-nc">non consegnata</span></div></a>`;
      }
      return `<a class="a-card fx-sq${io ? ' io' : ''}" data-cerca="${cerca}" href="#/formazione/${m.id}/${n}">
        <div class="fx-testa">${crest(m, 'sm')}<span class="nm"><b>${esc(m.teamName)}${io ? ' <i class="fx-tua">la tua</i>' : ''}</b><span>${esc(m.owner || '')} · ${esc(l.formation || '')}</span></span>
          ${punti !== null ? `<span class="fx-pt"><b>${fmt(punti)}</b><span>punti</span></span>` : ''}${icon('chev', 'ic sm')}</div>
        <div class="fx-undici">${undici(l, io ? new Set() : mie)}</div></a>`;
    };
    return `<main class="a-body">
      <div class="fd-giornata">
        ${prima ? `<a class="ib" href="#/formazioni/${prima}" aria-label="Giornata ${prima}">${icon('chev', 'ic flip')}</a>` : '<span class="ib spento"></span>'}
        <span><b>Giornata ${n}</b>${badge(st)}</span>
        ${dopo ? `<a class="ib" href="#/formazioni/${dopo}" aria-label="Giornata ${dopo}">${icon('chev')}</a>` : '<span class="ib spento"></span>'}
      </div>
      <p class="small muted fx-sotto"><b>${consegnate}</b> su ${righe.length} hanno consegnato.${mie.size ? ' In <b class="anche">evidenza</b> i giocatori che hai schierato anche tu.' : ''} Tocca una squadra per vederla sul campo.</p>
      ${righe.length > 6 ? '<input class="field-input" id="fx-cerca" type="search" placeholder="Cerca una squadra o un allenatore" autocomplete="off">' : ''}
      <div class="fx-lista">${righe.map(carta).join('')}</div>
      <p class="small muted fx-nessuno" hidden>Nessuna squadra con questo nome.</p>
      ${quando}
    </main>`;
  },
  mount(root) {
    const c = root.querySelector('#fx-cerca'); if (!c) return;
    c.addEventListener('input', () => {
      const q = c.value.trim().toLowerCase(); let viste = 0;
      for (const a of root.querySelectorAll('.fx-sq')) { const si = !q || a.dataset.cerca.includes(q); a.hidden = !si; if (si) viste++; }
      root.querySelector('.fx-nessuno').hidden = viste > 0;
    });
  },
};
