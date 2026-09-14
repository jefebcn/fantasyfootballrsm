import * as S from '../state.js';
import { fmt } from '../ui.js';

export const regolamento = {
  title: 'Regolamento', appbar: 'back', sub: () => 'Regolamento ed opzioni',
  render() {
    const r = S.rules(); const row = (k, v) => `<tr><td>${k}</td><td class="num" style="text-align:right">${v}</td></tr>`;
    return `<main class="a-body rules">
      <div class="a-card"><p class="rule-art">PRINCIPIO FONDANTE</p><p>Non esistendo pagelle per il Campionato Sammarinese, nessun voto è espresso da una redazione. Ogni valutazione nasce da eventi oggettivi e verificabili del referto FSGC, eventualmente confermati dal video di Titani.TV. Il referto fa fede; nessun giudizio soggettivo; il dato si congela.</p></div>
      <h3>Art. 4 — Voto base (Voto Titano)</h3>
      <table><tr><th>Condizione</th><th>Voto</th></tr>${row('Almeno 20 minuti', fmt(r.baseVote))}${row('Meno di 20 minuti senza eventi', 'S.V.')}${row('Meno di 20 minuti con eventi', fmt(r.baseVote) + ' + eventi')}${row('Non entrato / squalificato', 'S.V.')}</table>
      <table><tr><th>Esito collettivo</th><th>≥ 60\'</th><th>20–59\'</th></tr><tr><td>Vittoria</td><td class="num">+${fmt(r.outcome.win)}</td><td class="num">+${fmt(r.outcome.win * r.partialWeight, 2)}</td></tr><tr><td>Pareggio</td><td class="num">0</td><td class="num">0</td></tr><tr><td>Sconfitta</td><td class="num">−${fmt(-r.outcome.loss)}</td><td class="num">−${fmt(-r.outcome.loss * r.partialWeight, 2)}</td></tr></table>
      <h3>Art. 5 — Bonus e malus</h3>
      <table><tr><th>Gol per ruolo</th><th></th></tr>${row('Portiere', '+' + fmt(r.goal.P))}${row('Difensore', '+' + fmt(r.goal.D))}${row('Centrocampista', '+' + fmt(r.goal.C))}${row('Attaccante', '+' + fmt(r.goal.A))}</table>
      <table><tr><th>Evento</th><th></th></tr>${row('Assist', '+' + fmt(r.assist))}${row('Porta inviolata portiere (min. 60\')', '+' + fmt(r.cleanSheet.P))}${row('Porta inviolata difensore (min. 60\')', '+' + fmt(r.cleanSheet.D))}${row('Gol subito — portiere', fmt(r.goalConcededGK))}${row('Rigore parato', '+' + fmt(r.penSaved))}${row('Rigore sbagliato', fmt(r.penMissed))}${row('Autogol', fmt(r.ownGoal))}${row('Ammonizione', fmt(r.yellow))}${row('Espulsione per doppia ammonizione', fmt(r.secondYellow) + ' (cumulabile: −1,5)')}${row('Espulsione per rosso diretto', fmt(r.redDirect))}${row('Rigore procurato / causato (livello 2)', r.level2Events ? '+1,0 / −1,0' : 'disattivati')}</table>
      <h3>Art. 6 — Capitano</h3><p>Raddoppia bonus e malus, non il voto base. Se è S.V. subentra il vice; se anche il vice è S.V., nessun raddoppio.</p>
      <h3>Art. 7 — Definizioni</h3><p>Minuti da referto, recupero escluso. Assist: ultimo passaggio volontario verso la conclusione vincente, uno per gol, nel dubbio nessuno. Autogol: −2,0 e gol subito per il proprio portiere. Rigore segnato = gol normale. Porta inviolata: conta il risultato finale, min. 60'. Cambio portiere: il malus va a chi è in campo al momento del gol. Movimento in porta: mantiene il ruolo da listone.</p>
      <h3>Art. 8 — Formazioni</h3><p>11 titolari + 7 panchinari ordinati. Moduli: ${r.modules.join(', ')}. Lock all'inizio della prima gara. Non consegnata: ultima formazione valida; alla prima giornata 4-4-2 con le quotazioni più alte. Sostituzioni automatiche: stesso ruolo, ordine di panchina, massimo ${r.maxSubs}; senza sostituto il titolare vale ${fmt(r.noSubVote)}.</p>
      <h3>Art. 9 — Tempi</h3><p>Punteggi provvisori entro domenica 23:59. Contestazioni entro martedì 18:00, per iscritto, con evento e minuto. Congelamento martedì 20:00: la giornata non è più rettificabile. Il Giudice Dati decide sui casi non previsti e registra i precedenti.</p>
      <h3>Art. 10 — Gare anomale</h3><p>Rinviata: S.V. (se recuperata entro il martedì, voti validi). Sospesa prima del 45': S.V. per tutti. Sospesa dopo: eventi validi, niente porta inviolata né esito collettivo. A tavolino: S.V. per tutti i 22. Omologata con punteggio modificato: esito e porta inviolata sul risultato omologato, eventi reali validi.</p>
      <h3>Art. 11 — Conversione in gol</h3>
      <table><tr><th>Fantallenatori</th><th>Soglia</th><th>Passo</th></tr>${r.conversion.map((c) => `<tr><td>${c.min}–${c.max}</td><td class="num">${fmt(c.threshold)}</td><td class="num">${fmt(c.step)}</td></tr>`).join('')}</table><p>Parità di fantapunteggio = pareggio.</p>
      <h3>Art. 12 — Classifica</h3><p>3 punti a vittoria, 1 a pareggio. Spareggi: punti › fantapunti stagionali › differenza reti › scontri diretti.</p>
      <h3>Art. 13 — Integrità</h3><p>I tesserati del Campionato Sammarinese non possono avere in rosa giocatori della propria società e non possono partecipare a leghe con premi in denaro.</p>
      <h3>Opzioni di lega</h3>
      <table>${row('Budget', r.budget)}${row('Rosa', `${r.roster.P}P · ${r.roster.D}D · ${r.roster.C}C · ${r.roster.A}A`)}${row('Tetto per società', r.maxPerClub || 'nessuno')}${row('Eventi livello 2', r.level2Events ? 'attivi' : 'spenti')}${row('Motore', r.engineVersion)}</table>
    </main>`;
  },
};
