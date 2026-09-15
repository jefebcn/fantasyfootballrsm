/** Opzioni di regolamento della lega: le regole che il fantacalcio lascia
 *  scegliere e che qui hanno senso. Chi non e' amministratore le legge e basta. */
import * as S from '../state.js';
import { esc, fmt, icon } from '../ui.js';

/** [chiave, titolo, spiegazione, scelte [valore, etichetta]] */
const OPZIONI = [
  ['homeBonus', 'Fattore campo', 'Punti in più a chi gioca in casa nella sfida di giornata. Il fantacalcio ne consiglia 2.',
    [[0, 'Spento'], [2, '+2'], [3, '+3']]],
  ['decisiveGoal', 'Gol decisivo', 'Bonus al gol che vale il pareggio o il sorpasso. Uno solo per partita, e solo a chi non perde.',
    [[0, 'Spento'], [0.5, '+0,5'], [1, '+1']]],
  ['assistSetPiece', 'Assist da palla inattiva', 'Angolo o punizione: il merito è minore, e il referto lo distingue da sé.',
    [[1, 'Come gli altri'], [0.5, '+0,5'], [0, 'Niente bonus']]],
  ['subMode', 'Sostituzioni automatiche', 'Quando un titolare non prende voto e in panchina non c\'è nessuno del suo ruolo.',
    [['role', 'Solo stesso ruolo'], ['free', 'Modulo libero']]],
  ['maxSubs', 'Cambi massimi', 'Quanti titolari senza voto si possono rimpiazzare. Il fantacalcio ne consiglia da 5 a 7.',
    [[3, '3'], [5, '5'], [7, '7']]],
  ['level2Events', 'Rigore procurato e causato', 'Eventi di livello 2: +1 a chi si procura un rigore, −1 a chi lo causa.',
    [[false, 'Spenti'], [true, 'Attivi']]],
];

const val = (v) => JSON.stringify(v);

export const regole = {
  title: 'Opzioni di regolamento', appbar: 'back', sub: () => 'Regole della lega',
  render() {
    const r = S.rules(); const admin = S.isLeagueAdmin();
    const iniziata = S.base.league.started;
    return `<main class="a-body">
      ${admin ? '' : `<div class="warn block">${icon('lock', 'ic sm')}<span>Solo l'amministratore della lega può cambiare le regole. Qui le vedi come sono.</span></div>`}
      ${admin && iniziata ? `<div class="warn block">${icon('warn', 'ic sm')}<span>La lega è già partita: una regola cambiata adesso <b>ricalcola anche le giornate già giocate</b>, tranne quelle congelate.</span></div>` : ''}
      ${OPZIONI.map(([k, titolo, spiega, scelte]) => `<div class="a-card opz">
        <b>${esc(titolo)}</b><p class="small muted">${esc(spiega)}</p>
        <div class="scelte" data-opz="${k}">${scelte.map(([v, l]) =>
          `<button class="chip${val(r[k]) === val(v) ? ' on' : ''}" data-val='${esc(val(v))}' ${admin ? '' : 'disabled'}>${esc(l)}</button>`).join('')}</div>
      </div>`).join('')}
      <div class="a-card"><p class="rule-art">NON MODIFICABILI</p>
        <p class="small muted">Voto base ${fmt(r.baseVote)}, gol per ruolo, ammonizioni ed espulsioni, porta inviolata e conversione in gol sono il cuore del Voto Titano: si cambiano solo con una modifica al regolamento, non da qui.</p>
        <p class="small muted">Nel regolamento completo c'è anche l'elenco delle regole del fantacalcio che qui non si possono applicare, e perché.</p>
        <a class="a-btn sec" href="#/regolamento" style="text-decoration:none">Leggi il regolamento completo</a></div>
    </main>`;
  },
  mount(root, ctx) {
    if (!S.isLeagueAdmin()) return;
    root.querySelector('main').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-val]'); if (!b) return;
      const k = b.closest('[data-opz]').dataset.opz; const v = JSON.parse(b.dataset.val);
      if (val(S.rules()[k]) === val(v)) return;
      b.disabled = true;
      try { await S.salvaRegole({ [k]: v }); ctx.toast('Regola salvata'); }
      catch (err) { ctx.toast(err.message || 'Non è stato possibile salvare'); }
      ctx.render();
    });
  },
};
