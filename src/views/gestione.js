/** Hub a riquadri: le destinazioni ricorrenti della lega, con le icone duotone. */
import * as S from '../state.js';
import { esc, pic } from '../ui.js';

/** [href, icona in media/icone/lega, etichetta] — la nota si aggiunge in render().
 *  Tre riquadri per riga: ogni blocco tiene un numero di voci multiplo di tre. */
const GIOCA = [
  ['#/rosa', 'la-mia-squadra', 'La mia rosa'],
  ['#/rosa/formazione', 'probabili-formazioni', 'Formazione'],
  ['#/listone', 'calcola', 'Listone'],
  ['#/mercato', 'scambi', 'Mercato libero'],
  ['#/calendario', 'calendario', 'Calendario'],
  ['#/classifica', 'classifica', 'Classifica'],
];
const LEGA = [
  ['#/voti', 'andamento', 'Andamento voti'],
  ['#/lega', 'rose', 'Partecipanti'],
  ['#/scheda', 'chat', 'Scheda condivisibile'],
];
const GIUDICE = [
  ['#/admin', 'strumenti', 'Inserisci eventi'],
  ['#/admin/contestazioni', 'supporto', 'Contestazioni'],
  ['#/admin/congela', 'live', 'Congela giornata'],
];

const nota = (voci, href, testo) => voci.map((v) => (v[0] === href ? [...v, testo] : v));
const tile = ([href, ic, label, sub]) => `<a class="hub-t" href="${href}">
  <i>${pic(ic, 'lega')}</i><b>${esc(label)}</b><small>${sub ? esc(sub) : ''}</small></a>`;
const blocco = (titolo, voci) => (voci.length
  ? `<section class="hub-s"><h3>${titolo}</h3><div class="hub">${voci.map(tile).join('')}</div></section>` : '');

export const gestione = {
  title: 'Gestione', appbar: 'back', sub: () => 'Tutte le sezioni',
  render() {
    const gioca = nota(nota(GIOCA, '#/listone', `${S.base.players.length} atleti`),
      '#/calendario', `giornata ${S.currentMatchday()}`);
    const sq = S.base.managers.length;
    const lega = nota(LEGA, '#/lega', `${sq} squadr${sq === 1 ? 'a' : 'e'}`);
    const giudice = S.isJudge()
      ? nota(GIUDICE, '#/admin/contestazioni', `${S.contestazioni().filter((c) => c.status === 'open').length} aperte`)
      : [];
    return `<main class="a-body">
      ${blocco('Gioca', gioca)}
      ${blocco('La lega', lega)}
      ${blocco('Giudice Dati', giudice)}
    </main>`;
  },
};
