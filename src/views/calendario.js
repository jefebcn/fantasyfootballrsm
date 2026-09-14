import * as S from '../state.js';
import { esc, fmt, icon, badge, matchCard, sec, dateIt, timeIt } from '../ui.js';

const STATUS = { played: null, scheduled: null, postponed: 'Rinviata', suspended_before_45: 'Sospesa <45\'', suspended_after_45: 'Sospesa >45\'', awarded: 'A tavolino' };
export const calendario = {
  title: 'Calendario',
  render({ params }) {
    const n = Math.min(30, Math.max(1, +params.n || S.nextMatchday())); const st = S.matchdayStatus(n); const md = S.matchday(n);
    const fx = S.fixturesOf(n).map((f) => S.fixtureResult(f));
    const real = S.matchesOf(n);
    return `<main class="a-body">
      <div class="gsel" id="gsel">${Array.from({ length: 30 }, (_, i) => `<a href="#/calendario/${i + 1}" class="${i + 1 === n ? 'on' : ''}" style="text-decoration:none;flex:none;font:700 13px var(--font-display);color:${i + 1 === n ? 'var(--primary)' : 'var(--text-muted)'};padding:8px 10px;position:relative">G${i + 1}${i + 1 === n ? '<i style="position:absolute;left:50%;bottom:2px;width:6px;height:6px;border-radius:50%;background:var(--primary);transform:translateX(-50%)"></i>' : ''}</a>`).join('')}</div>
      ${sec('Scontri di lega', badge(st, st === 'open' ? `lock ${dateIt(md.lockAt)} ${timeIt(md.lockAt)}` : st === 'scheduled' ? dateIt(md.lockAt) : ''))}
      ${fx.map((r) => matchCard(r, S.managersById)).join('')}
      ${sec('Partite del campionato', `${n}ª giornata · campi neutri`)}
      <div class="real">${real.map((m) => { const h = S.clubsById.get(m.homeClubId), a = S.clubsById.get(m.awayClubId); const label = STATUS[m.status];
        const right = m.status === 'played' ? `<span class="sc">${m.homeGoals} – ${m.awayGoals}</span>` : label ? `<span class="sc st">${label}</span>` : `<span class="sc st" style="color:var(--text-muted)">${timeIt(m.kickoffAt)}</span>`;
        return `<div class="rr"><div><b>${esc(h.name)} — ${esc(a.name)}</b><span>${dateIt(m.kickoffAt)} ${timeIt(m.kickoffAt)} · ${esc(m.venue)}</span></div>${right}${m.videoUrl ? `<a href="${m.videoUrl}" target="_blank" rel="noopener" class="play" aria-label="Titani.TV">${icon('play', 'ic sm')}</a>` : '<span></span>'}</div>`; }).join('')}</div>
    </main>`;
  },
  mount(root) { const el = root.querySelector('#gsel .on'); if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' }); },
};
