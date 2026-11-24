/**
 * Il benvenuto del FantaFutsal (Alex, 24/11/2026): sei schermate da scorrere
 * la prima volta che si apre il futsal, prima di creare la squadra, così chi
 * entra sa già cosa sono crediti, Porta, sesto uomo, capitano e mercato.
 *
 * Compare UNA volta per telefono a chi non ha ancora una squadra; «Salta» è
 * sempre in alto. L'ultima schermata porta dritta all'iscrizione. Si rivede
 * dal Regolamento («Rivedi il benvenuto», #/futsal/benvenuto).
 *
 * I numeri (crediti, voto di partenza, capitano, cambi) vengono dal
 * regolamento del motore: se cambia una regola, il benvenuto la segue.
 * La grafica è quella del futsal: nero, carta e un solo arancio, titoli in
 * Teko, la barra inclinata e le maglie dell'app.
 */
import { esc, fmt } from '../ui.js';
import { REGOLE_FUTSAL as R } from '../futsal-engine.js';
import { magliaFs, logoFs } from '../futsal-grafica.js';

const CHIAVE = 'fcs:fs-benvenuto';
export function visto() { try { return localStorage.getItem(CHIAVE) === '1'; } catch { return true; } }
export function segnaVisto() { try { localStorage.setItem(CHIAVE, '1'); } catch { /* niente */ } }

const segno = (x) => (x > 0 ? `+${fmt(x)}` : fmt(x).replace('-', '−'));
const palla = (cls = '') => `<i class="mi ${cls}" style="--m:url(/media/icone/futsal/pallone.svg)"></i>`;
const icona = (nome) => `<i class="mi" style="--m:url(/media/icone/futsal/${nome}.svg)"></i>`;

/** Le sei schermate: disegno, titolo, testo. */
function schermate() {
  const maglia = (colore, numero, extra = '') => `<span class="fsb-mg ${extra}">${magliaFs({ colore, numero })}</span>`;
  return [
    {
      disegno: `<div class="fsb-palla">${palla()}</div>`,
      titolo: 'Benvenuto nel <em>FantaFutsal</em>',
      testo: 'Il fanta del <b>Campionato Sammarinese di Futsal</b>: giocatori veri, punti veri dai referti ufficiali FSGC. Ecco come si gioca, in un minuto.',
    },
    {
      disegno: `<div class="fsb-maglie">${maglia('#FFFFFF', '4')}${maglia('#FF4B2B', '5', 'centro')}${maglia('#FFFFFF', '9')}<span class="fsb-bollo">${R.budget}<small>crediti</small></span></div>`,
      titolo: 'Crea la tua <em>squadra</em>',
      testo: `Hai <b>${R.budget} crediti</b> per comprare la <b>Porta</b> di una squadra e <b>${R.rosa.D + R.rosa.A} giocatori</b>: ${R.rosa.D} difensori e ${R.rosa.A} attaccanti. Al massimo ${R.perClub} della stessa squadra, Porta compresa.`,
    },
    {
      disegno: `<div class="fsb-campo"><span class="fsb-g a">C</span><span class="fsb-g b"></span><span class="fsb-g c"></span><span class="fsb-g d"></span><span class="fsb-porta">P</span><span class="fsb-sesto">6°</span></div>`,
      titolo: 'Ogni <em>giornata</em>',
      testo: `Scegli lo schema (${Object.keys(R.schemi).join(', ')}), i quattro in campo, il <b>sesto uomo</b> e il <b>capitano</b>, che vale ×${fmt(R.capitano)}. La panchina conta il ${fmt(R.panchina * 100, 0)}%. Hai tempo fino a 10 minuti prima della prima partita.`,
    },
    {
      disegno: `<div class="fsb-referto"><p><span>Convocato</span><b>${fmt(R.voto)}</b></p><p><span>Gol</span><b>${segno(R.gol)}</b></p><p><span>Vittoria</span><b>${segno(R.esito.vittoria)}</b></p><p><span>Ammonizione</span><b>${segno(R.ammonizione)}</b></p><p class="fsb-tot"><span>Totale</span><b>${fmt(R.voto + R.gol + R.esito.vittoria + R.ammonizione)}</b></p></div>`,
      titolo: 'Punti dai <em>referti</em>',
      testo: `Ogni convocato parte da <b>${fmt(R.voto)}</b>, poi contano risultato, gol e cartellini. La Porta prende ${segno(R.portaInviolata)} se resta inviolata. La sera vedi il risultato con «voti in arrivo», i voti arrivano col referto FSGC.`,
    },
    {
      disegno: `<div class="fsb-mercato"><div class="su">${maglia('#FFFFFF', '7')}<b>Compra</b><span>▲ 6,5</span></div><div class="giu">${maglia('#111111', '10')}<b>Vendi</b><span>▼ 4,0</span></div></div>`,
      titolo: 'Il <em>mercato</em>',
      testo: `Le <b>quotazioni</b> salgono e scendono con le prestazioni. Tra una giornata e l'altra compri e vendi: ${R.cambiGratis === 1 ? 'un cambio gratis' : `${R.cambiGratis} cambi gratis`} a giornata, ogni cambio in più costa ${R.malusCambio} punto. La prima rosa è gratis.`,
    },
    {
      disegno: `<div class="fsb-sfida"><span class="i1">${icona('classifiche')}</span><span class="i2">${icona('coppa')}</span><span class="i3">${icona('amici')}</span></div>`,
      titolo: 'Sfida gli <em>altri</em>',
      testo: 'Classifica generale, campionato dei tifosi, le tre Serie, la <b>Coppa Titano</b> e le leghe con gli amici: tutte con la stessa squadra.',
    },
  ];
}

/**
 * Il benvenuto, sopra a tutto. fine: il testo dell'ultimo tasto
 * («Crea la tua squadra» per chi non l'ha, altrimenti «Vai al FantaFutsal»).
 */
export function benvenutoHtml({ fine = 'Crea la tua squadra' } = {}) {
  const s = schermate();
  return `<div class="fsb" role="dialog" aria-modal="true" aria-label="Benvenuto nel FantaFutsal">
    <div class="fsb-testa">${logoFs('velo fsb-logo')}<button class="fsb-salta" data-fsb-chiudi>Salta</button></div>
    <div class="fsb-scorri" tabindex="0">${s.map((x, i) => `<section class="fsb-pag" aria-label="${i + 1} di ${s.length}">
      <div class="fsb-disegno">${x.disegno}</div>
      <h2>${x.titolo}</h2><p>${x.testo}</p></section>`).join('')}</div>
    <div class="fsb-piede">
      <div class="fsb-punti" aria-hidden="true">${s.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
      <button class="a-btn big fsb-avanti" data-fsb-avanti>Avanti</button>
      <button class="a-btn big fsb-fine" data-fsb-chiudi data-fsb-fine hidden>${esc(fine)}</button>
    </div>
  </div>`;
}

/** Scorrimento, puntini, Avanti e chiusura. chiudi(finito): finito = ha toccato l'ultimo tasto. */
export function montaBenvenuto(root, chiudi) {
  const el = root.querySelector('.fsb'); if (!el) return;
  const sc = el.querySelector('.fsb-scorri'), punti = [...el.querySelectorAll('.fsb-punti i')];
  const avanti = el.querySelector('.fsb-avanti'), fine = el.querySelector('.fsb-fine');
  const n = punti.length;
  const qui = () => Math.round(sc.scrollLeft / Math.max(1, sc.clientWidth));
  const aggiorna = () => {
    const i = Math.min(n - 1, Math.max(0, qui()));
    punti.forEach((p, k) => p.classList.toggle('on', k === i));
    avanti.hidden = i === n - 1; fine.hidden = i !== n - 1;
  };
  const vai = (i) => sc.scrollTo({ left: i * sc.clientWidth, behavior: 'smooth' });
  sc.addEventListener('scroll', () => requestAnimationFrame(aggiorna), { passive: true });
  avanti.addEventListener('click', () => vai(Math.min(n - 1, qui() + 1)));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') vai(Math.min(n - 1, qui() + 1));
    if (e.key === 'ArrowLeft') vai(Math.max(0, qui() - 1));
    if (e.key === 'Escape') { segnaVisto(); chiudi(false); }
  });
  el.querySelectorAll('[data-fsb-chiudi]').forEach((b) => b.addEventListener('click', () => { segnaVisto(); chiudi(b.hasAttribute('data-fsb-fine')); }));
  sc.focus({ preventScroll: true });
}
