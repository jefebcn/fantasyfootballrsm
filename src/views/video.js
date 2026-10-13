/** Highlights della FSGC. La copertina e' disegnata qui: Google non riceve
 *  niente finche' non si tocca play. */
import * as S from '../state.js';
import { esc, icon, dateIt } from '../ui.js';
import { maglia } from '../maglia.js';
import { videoGiornata, giornateConVideo, altriVideo, urlCanale, urlIncorpora, urlVideo, videoDaAprire } from '../video.js';

/** La maglia di un club, nel suo colore e con la sigla in petto: e' il
 *  disegno delle maglie fanta (src/maglia.js), nessuna maglia vera. */
const divisa = (c) => maglia({ c1: c.color, nome: c.shortName }, 'vid-maglia');

/**
 * Scheda di una partita.
 *
 * La copertina la disegna l'app, quindi non e' un fotogramma: e' un poster
 * prepartita (Alex, 12/10: «qualcosa di piu' bello e iconico»). Le due maglie
 * nei colori dei club, una contro l'altra, sullo stadio dello sfondo della
 * home tinto per meta' con i colori delle squadre e tagliato da una riga
 * lime; risultato come adesivo lime, nomi in Anton. Foto di giocatori veri
 * no: non sono nostre, e qui non parte nessuna richiesta finche' non si
 * tocca play — stadio e maglia sono file dell'app.
 */
function scheda(m, v) {
  const h = S.clubsById.get(m.homeClubId), a = S.clubsById.get(m.awayClubId);
  const giocata = m.status === 'played';
  const sotto = [dateIt(v.quando), m.venue].filter(Boolean).join(' · ');
  return `<div class="vid" data-vid="${esc(v.id)}">
    <div class="vid-cop" style="--ca:${esc(h.color)};--cb:${esc(a.color)}">
      <div class="vid-sq">
        <span class="vid-lato">${divisa(h)}<b>${esc(h.name)}</b></span>
        <span class="${giocata ? 'vid-ris' : 'vid-vs'}">${giocata ? `${m.homeGoals}<i>–</i>${m.awayGoals}` : 'vs'}</span>
        <span class="vid-lato">${divisa(a)}<b>${esc(a.name)}</b></span>
      </div>
      ${S.prudente()
    ? `<a class="vid-play" href="${urlVideo(v.id)}" target="_blank" rel="noopener" aria-label="Guarda su YouTube gli highlights di ${esc(h.name)} contro ${esc(a.name)}">${icon('play', 'ic')}</a>`
    : `<button class="vid-play" aria-label="Guarda gli highlights di ${esc(h.name)} contro ${esc(a.name)}">${icon('play', 'ic')}</button>`}
    </div>
    <div class="vid-pie"><span>${esc(sotto)}</span><a href="${urlVideo(v.id)}" target="_blank" rel="noopener">Apri su YouTube</a></div>
  </div>`;
}

export const video = {
  title: 'Video', appbar: 'back', sub: () => 'Highlights della FSGC',
  render() {
    const giornate = giornateConVideo().slice(0, 6)
      .map((k) => [k, videoGiornata(S.matchesOf(k))]).filter(([, l]) => l.length);
    const altri = altriVideo();
    if (!giornate.length && !altri.length) {
      return `<main class="a-body"><div class="empty"><p>Non ci sono ancora video.</p>
        <p class="small muted">Arrivano dal canale della FSGC quando pubblica gli highlights di una giornata.</p>
        <a class="a-btn sec" href="${urlCanale}" target="_blank" rel="noopener" style="text-decoration:none">Vai al canale</a></div></main>`;
    }
    return `<main class="a-body">
      <div class="warn info">${icon('eye', 'ic sm')}<span>${S.prudente() ? 'I video si guardano su YouTube: il play apre il canale della FSGC.' : 'I video stanno su YouTube. Finché non tocchi play non parte nessuna richiesta verso Google: la copertina la disegna l\'app.'}</span></div>
      ${giornate.map(([k, lista]) => `<div class="a-sec"><b>${k}ª giornata</b><span>${lista.length} ${lista.length === 1 ? 'partita' : 'partite'}</span></div>
        ${lista.map(({ m, v }) => scheda(m, v)).join('')}`).join('')}
      ${altri.length ? `<div class="a-sec"><b>Dal canale</b><span>coppa e sondaggi</span></div>
        <div class="bench">${altri.map((x) => `<a class="br" href="${urlVideo(x.id)}" target="_blank" rel="noopener" style="text-decoration:none">
          <span class="vid-mini">${icon('play', 'ic sm')}</span>
          <span class="nm"><b>${esc(x.titolo)}</b><span>${esc(dateIt(x.quando))}</span></span></a>`).join('')}</div>` : ''}
      <a class="a-btn sec" href="${urlCanale}" target="_blank" rel="noopener" style="text-decoration:none">Tutto il canale della FSGC</a>
    </main>`;
  },
  mount(root) {
    // da qui in poi si contatta Google: succede perche' l'ha chiesto chi guarda
    const suona = (card) => {
      // in modalita' prudente i video si guardano solo su YouTube
      if (S.prudente()) return;
      const id = card.dataset.vid; const cop = card.querySelector('.vid-cop:not(.in)'); if (!cop) return;
      cop.outerHTML = `<div class="vid-cop in"><iframe
        src="${urlIncorpora(id)}" title="Highlights" loading="lazy" allowfullscreen
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" playsinline
        referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    };
    root.querySelector('main').addEventListener('click', (e) => {
      const b = e.target.closest('button.vid-play'); if (b) suona(b.closest('[data-vid]'));
    });
    // arrivati dalla home toccando una partita: parte quella, gia' in vista
    const id = videoDaAprire();
    const card = id && [...root.querySelectorAll('[data-vid]')].find((c) => c.dataset.vid === id);
    if (card) { suona(card); card.scrollIntoView({ block: 'center' }); }
  },
};
