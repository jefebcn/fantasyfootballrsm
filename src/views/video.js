/** Highlights della FSGC. La copertina e' disegnata qui: Google non riceve
 *  niente finche' non si tocca play. */
import * as S from '../state.js';
import { esc, icon, dateIt } from '../ui.js';
import { videoGiornata, giornateConVideo, altriVideo, urlCanale, urlIncorpora, urlVideo } from '../video.js';

/** Scheda di una partita: squadre, risultato e il tasto per far partire. */
function scheda(m, v) {
  const h = S.clubsById.get(m.homeClubId), a = S.clubsById.get(m.awayClubId);
  const ris = m.status === 'played' ? `${m.homeGoals} – ${m.awayGoals}` : '';
  return `<div class="vid" data-vid="${esc(v.id)}">
    <div class="vid-cop">
      <div class="vid-sq"><b>${esc(h.name)}</b>${ris ? `<span class="vid-ris">${ris}</span>` : '<span class="vid-vs">—</span>'}<b>${esc(a.name)}</b></div>
      <button class="vid-play" aria-label="Guarda gli highlights di ${esc(h.name)} contro ${esc(a.name)}">${icon('play', 'ic')}</button>
    </div>
    <div class="vid-pie"><span>${esc(dateIt(v.quando))}</span><a href="${urlVideo(v.id)}" target="_blank" rel="noopener">Apri su YouTube</a></div>
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
