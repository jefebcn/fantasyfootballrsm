/** Highlights della FSGC. La copertina e' disegnata qui: Google non riceve
 *  niente finche' non si tocca play. */
import * as S from '../state.js';
import { esc, icon, dateIt, crest } from '../ui.js';
import { videoGiornata, giornateConVideo, altriVideo, urlCanale, urlIncorpora, urlVideo } from '../video.js';

/** Lo stemma di un club, con le sigle e i colori che ha gia' il calendario. */
const scudo = (c) => crest({ color: c.color, initials: c.shortName }, 'vid-stemma');

/**
 * Scheda di una partita.
 *
 * La copertina la disegna l'app, quindi non e' un fotogramma: e' un tabellone.
 * Il fondo prende i colori delle due squadre, tagliati in diagonale a meta',
 * cosi' una partita si riconosce prima di leggerla. I colori non ci vanno
 * puri: il giallo della Folgore col bianco sopra starebbe a 1,9 di contrasto.
 * Si mescolano al navy al 40%, dose misurata sui sedici club — il caso
 * peggiore resta la Folgore, e li' il bianco sta a 7,4 e l'oro a 4,8.
 */
function scheda(m, v) {
  const h = S.clubsById.get(m.homeClubId), a = S.clubsById.get(m.awayClubId);
  const giocata = m.status === 'played';
  const sotto = [dateIt(v.quando), m.venue].filter(Boolean).join(' · ');
  return `<div class="vid" data-vid="${esc(v.id)}">
    <div class="vid-cop" style="--ca:${esc(h.color)};--cb:${esc(a.color)}">
      <div class="vid-sq">
        <span class="vid-lato">${scudo(h)}<b>${esc(h.name)}</b></span>
        <span class="${giocata ? 'vid-ris' : 'vid-vs'}">${giocata ? `${m.homeGoals}<i>–</i>${m.awayGoals}` : 'vs'}</span>
        <span class="vid-lato">${scudo(a)}<b>${esc(a.name)}</b></span>
      </div>
      <button class="vid-play" aria-label="Guarda gli highlights di ${esc(h.name)} contro ${esc(a.name)}">${icon('play', 'ic')}</button>
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
      <div class="warn info">${icon('eye', 'ic sm')}<span>I video stanno su YouTube. Finché non tocchi play non parte nessuna richiesta verso Google: la copertina la disegna l'app.</span></div>
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
    root.querySelector('main').addEventListener('click', (e) => {
      const b = e.target.closest('.vid-play'); if (!b) return;
      const card = b.closest('[data-vid]'); const id = card.dataset.vid;
      // da qui in poi si contatta Google: succede perche' l'ha chiesto chi guarda
      card.querySelector('.vid-cop').outerHTML = `<div class="vid-cop in"><iframe
        src="${urlIncorpora(id)}" title="Highlights" loading="lazy" allowfullscreen
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    });
  },
};
