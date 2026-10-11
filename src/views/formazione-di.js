import * as S from '../state.js';
import { esc, fmt, icon, crest, badge, dateIt, timeIt } from '../ui.js';
import { fieldTeam, benchCol, campoProbabile } from './live.js';

/**
 * LA FORMAZIONE DI UN ALTRO (Alex, 11/10: «che i partecipanti alla lega
 * pubblica possano vedere la formazione degli altri, così per vedere un amico
 * cosa abbia messo»).
 *
 * Nelle leghe a scontri le formazioni degli altri si vedevano gia', nella
 * partita (#/live). In una lega a punti le partite non ci sono, e quindi non
 * c'era nessun posto dove guardarle: si arriva qui toccando una squadra in
 * classifica.
 *
 * QUANDO SI VEDE. Dal lock in poi, come nelle partite: prima la formazione
 * resta di chi l'ha fatta. Non e' una scelta di questa schermata ma del
 * database (policy lineups_read, migrazione 004): prima del lock quella degli
 * altri al telefono non arriva proprio. Senza, il venerdi' alle 14:59 si
 * copierebbe quella del primo in classifica.
 *
 * Si apre sull'ultima giornata gia' chiusa — quella che si sta giocando, o
 * l'ultima giocata — e con le frecce si torna indietro.
 */

/** Le giornate di questa lega gia' chiuse (lock passato), dalla piu' recente. */
function giornateChiuse() {
  const out = [];
  for (let n = Math.min(30, S.giornataAperta()); n >= S.primaGiornata(); n--) {
    const md = S.matchday(n);
    if (md && S.now() >= new Date(md.lockAt)) out.push(n);
  }
  return out;
}

export const formazioneDi = {
  title: 'Formazione', appbar: 'back', sub: () => 'Formazione',
  render({ params }) {
    const m = S.managersById.get(params.id);
    if (!m) return '<main class="a-body"><div class="empty"><p>Squadra non trovata in questa lega.</p></div></main>';
    const io = m.id === S.me()?.id;
    const chiuse = giornateChiuse();
    const n = chiuse.includes(+params.n) ? +params.n : chiuse[0];
    const prossima = S.matchday(S.giornataAperta());
    const testa = `<div class="a-card fd-testa">${crest(m)}<span class="nm"><b>${esc(m.teamName)}</b><span>${esc(m.owner || '')}</span></span>${io ? '<span class="chip">la tua</span>' : ''}</div>`;
    // quando si vedra' la prossima: la domanda che si fa chi apre di martedi'
    const quandoProssima = prossima && S.now() < new Date(prossima.lockAt)
      ? `<p class="small muted fd-nota">${io ? `La tua formazione della ${prossima.number}ª la vedono gli altri` : `Quella della ${prossima.number}ª si vede`} da ${dateIt(prossima.lockAt)} alle ${timeIt(prossima.lockAt)}, quando si chiude la consegna: prima resta segreta, così nessuno copia.</p>`
      : '';
    if (!n) {
      return `<main class="a-body">${testa}<div class="empty"><p>Nessuna giornata ancora chiusa per questa lega: le formazioni degli altri si vedono dal lock della prima.</p></div>${quandoProssima}
        ${io ? '<a class="a-btn sec" href="#/rosa/formazione" style="text-decoration:none">La tua formazione</a>' : ''}</main>`;
    }
    const i = chiuse.indexOf(n);
    const prima = chiuse[i + 1], dopo = chiuse[i - 1];
    const frecce = `<div class="fd-giornata">
      ${prima ? `<a class="ib" href="#/formazione/${m.id}/${prima}" aria-label="Giornata ${prima}">${icon('chev', 'ic flip')}</a>` : '<span class="ib spento"></span>'}
      <span><b>Giornata ${n}</b>${badge(S.matchdayStatus(n))}</span>
      ${dopo ? `<a class="ib" href="#/formazione/${m.id}/${dopo}" aria-label="Giornata ${dopo}">${icon('chev')}</a>` : '<span class="ib spento"></span>'}
    </div>`;
    const salvata = S.savedLineup(n, m.id);
    if (!salvata) {
      return `<main class="a-body">${testa}${frecce}
        <div class="a-card fd-vuota"><b>Nessuna formazione consegnata per la ${n}ª.</b><span>Senza consegna la giornata vale zero fantapunti (art. 8.4).</span></div>${quandoProssima}</main>`;
    }
    // Il lock e' passato ma i voti non ci sono ancora: si vede l'undici, senza pastiglie.
    const st = S.matchdayStatus(n);
    const conVoti = S.hasData(n) && st !== 'open' && st !== 'scheduled';
    const res = conVoti ? S.lineupResult(n, m.id) : null;
    let campo; let panchina; let totale = '';
    if (res) {
      const ratings = S.ratingsOf(n);
      const evs = {}; for (const mt of S.matchesOf(n)) for (const e of S.eventsOf(mt.id)) (evs[e.playerId] ||= []).push(e);
      campo = `<div class="field fd-campo">${fieldTeam(res, ratings, evs, true)}<span class="box bot"></span></div>`;
      panchina = `<div class="bench2">${benchCol(res, ratings)}</div>`;
      totale = `<div class="a-card fd-tot"><span>Fantapunti</span><b>${fmt(res.total)}</b></div>`;
    } else {
      campo = `<div class="field fd-campo">${campoProbabile({ ...salvata, starters: (salvata.starters || []).filter((id) => S.playersById.get(id)) }, true)}<span class="box bot"></span></div>`;
      panchina = `<div class="bench2">${(salvata.bench || []).map((id) => { const p = S.playersById.get(id); const c = p && S.clubsById.get(p.clubId);
        return p ? `<div class="b2"><span class="nm"><b>${esc(p.lastName)}</b><span>${esc(c?.name || '')}</span></span></div>` : ''; }).join('')}</div>`;
    }
    return `<main class="a-body">${testa}${frecce}
      <p class="prehead libero">${esc(salvata.formation || '')}${salvata.submittedAt ? ` · consegnata ${dateIt(salvata.submittedAt)} alle ${timeIt(salvata.submittedAt)}` : ''}</p>
      ${campo}${totale}
      <div class="a-sec"><b>Panchina</b><span>ordine di ingresso</span></div>${panchina}
      ${quandoProssima}</main>`;
  },
};
