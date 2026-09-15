/** Hub a riquadri: le destinazioni ricorrenti della lega, con le icone duotone. */
import * as S from '../state.js';
import { esc, pic } from '../ui.js';

/** [href, icona in media/icone/lega, etichetta] — la nota si aggiunge in render().
 *  Tre riquadri per riga: ogni blocco tiene un numero di voci multiplo di tre. */
const GIOCA = [
  ['#/squadra', 'la-mia-squadra', 'La mia squadra'],
  ['#/rosa', 'rose', 'La mia rosa'],
  ['#/rosa/formazione', 'probabili-formazioni', 'Formazione'],
  ['#/listone', 'calcola', 'Listone'],
  ['#/mercato', 'scambi', 'Mercato libero'],
  ['#/calendario', 'calendario', 'Calendario'],
];
const LEGA = [
  ['#/classifica', 'classifica', 'Classifica'],
  ['#/voti', 'andamento', 'Andamento voti'],
  ['#/lega', 'trofei', 'Partecipanti'],
];
const REGOLE = [
  ['#/regolamento', 'premi', 'Regolamento'],
  ['#/regole', 'impostazioni', 'Opzioni di regolamento'],
  ['#/admin/registro', 'chat', 'Registro decisioni'],
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
    const r = S.rules();
    const regole = nota(REGOLE, '#/regole', S.isLeagueAdmin() ? `${r.subMode === 'free' ? 'modulo libero' : 'stesso ruolo'} · ${r.maxSubs} cambi` : 'sola lettura');
    return `<main class="a-body">
      ${blocco('Gioca', gioca)}
      ${blocco('La lega', lega)}
      ${blocco('Regole', regole)}
      ${blocco('Giudice Dati', giudice)}
    </main>`;
  },
};
