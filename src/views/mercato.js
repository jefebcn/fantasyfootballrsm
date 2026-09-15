import * as S from '../state.js';
import { esc, roleChip } from '../ui.js';

export const mercato = {
  title: 'Mercato', appbar: 'back', sub: () => 'Mercato libero · rilancio 24h',
  render() {
    const owned = new Set(); for (const m of S.base.managers) for (const r of S.base.rosters[m.id]) owned.add(r.playerId);
    const free = S.base.players.filter((p) => p.isActive && !owned.has(p.id)).sort((a, b) => b.quotation - a.quotation).slice(0, 60);
    const out = S.base.players.filter((p) => !p.isActive);
    return `<main class="a-body">
      <div class="a-card a-rule"><span class="art">Art. 3.4</span><p><b>Mercato libero</b> sempre aperto per i non assegnati all'asta, con rilancio a 24 ore. Chi lascia il campionato è rimosso d'ufficio con rimborso del 50% (art. 3.3), spendibile solo qui. Le offerte arrivano con la Fase 2.</p></div>
      <div class="vlist"><div class="vhead">Fuori dal campionato <span>${out.length}</span></div>${out.map((p) => `<a class="vr" href="#/giocatore/${p.id}" style="text-decoration:none">${roleChip(p.role)}<span class="nm"><b style="text-decoration:line-through">${esc(p.name)}</b><span>${esc(S.clubsById.get(p.clubId).name)} · rimosso d'ufficio</span></span><span class="ev"></span><span class="fv sv">50%</span></a>`).join('')}</div>
      <div class="vlist"><div class="vhead">Svincolati <span>per quotazione</span></div>${free.map((p) => `<a class="vr" href="#/giocatore/${p.id}" style="text-decoration:none">${roleChip(p.role)}<span class="nm"><b>${esc(p.name)}</b><span>${esc(S.clubsById.get(p.clubId).name)}</span></span><span class="ev"></span><span class="fv" style="font-size:14px">${p.quotation}</span></a>`).join('')}</div>
    </main>`;
  },
};
