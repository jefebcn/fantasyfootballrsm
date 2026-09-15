import * as S from '../state.js';
import { esc, fmt, icon, logo, badge, matchCard, sec, dateIt, timeIt } from '../ui.js';

const STATUS = { played: null, scheduled: null, postponed: 'Rinviata', suspended_before_45: 'Sospesa <45\'', suspended_after_45: 'Sospesa >45\'', awarded: 'A tavolino' };
export const calendario = {
  title: 'Calendario',
  render({ params }) {
    const n = Math.min(30, Math.max(1, +params.n || S.nextMatchday())); const st = S.matchdayStatus(n); const md = S.matchday(n);
    const fx = S.fixturesOf(n).map((f) => S.fixtureResult(f));
    const real = S.matchesOf(n);
    return `<main class="a-body">
      <div class="gsel" id="gsel">${Array.from({ length: 30 }, (_, i) => `<a href="#/calendario/${i + 1}" class="gs${i + 1 === n ? ' on' : ''}">G${i + 1}${i + 1 === n ? '<i></i>' : ''}</a>`).join('')}</div>
      ${sec('Scontri di lega', `${fx.length} ${fx.length === 1 ? 'partita' : 'partite'}`)}
      <div class="statusline">${badge(st, st === 'open' ? `lock ${dateIt(md.lockAt)} ${timeIt(md.lockAt)}` : st === 'scheduled' ? dateIt(md.lockAt) : '')}</div>
      ${fx.length ? fx.map((r) => matchCard(r, S.managersById)).join('') : `<div class="empty">${logo()}<p>Nessuno scontro: servono almeno due squadre nella lega.</p></div>`}
      ${sec('Partite del campionato', `${n}ª giornata`)}
      ${Object.entries(real.reduce((acc, m) => { (acc[dateIt(m.kickoffAt)] ||= []).push(m); return acc; }, {}))
        .map(([giorno, lista]) => `<div class="daygroup"><div class="dayhead">${esc(giorno)}</div>${lista.map((m) => {
          const h = S.clubsById.get(m.homeClubId), a = S.clubsById.get(m.awayClubId); const label = STATUS[m.status];
          const right = m.status === 'played' ? `<span class="sc">${m.homeGoals} – ${m.awayGoals}</span>`
            : label ? `<span class="sc st">${label}</span>` : `<span class="sc time">${timeIt(m.kickoffAt)}</span>`;
          return `<div class="rr"><div><b>${esc(h.name)} — ${esc(a.name)}</b><span>${m.venue ? esc(m.venue) : ''}</span></div>${right}${m.videoUrl ? `<a href="${m.videoUrl}" target="_blank" rel="noopener" class="play" aria-label="Guarda su Titani.TV">${icon('play', 'ic sm')}</a>` : '<span></span>'}</div>`;
        }).join('')}</div>`).join('')}
    </main>`;
  },
  mount(root) { const el = root.querySelector('#gsel .on'); if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' }); },
};
