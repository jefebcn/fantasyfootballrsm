import * as S from '../state.js';
import { icon } from '../ui.js';
import { fx } from './onboarding.js';
import { apriModulo } from './leghe.js';

/**
 * La guida di TITO: tre passi dopo la registrazione, prima delle leghe.
 *
 * La presentazione (onboarding.js) spiega che cos'e' il gioco a chi non ha
 * ancora un account. Questa spiega che cosa si FA, a chi l'account ce l'ha e
 * si trova davanti a «Crea una lega · Entra con codice» senza sapere da dove
 * cominciare: dove giocare, come si fa la squadra, come si comprano i
 * giocatori. La racconta TITO, la mascotte (media/tito), in prima persona.
 *
 * Si vede una volta per dispositivo (prefs.guidaVista): ci arriva da solo chi
 * non ha ancora una lega (gate in app.js), tranne chi arriva da un invito, che
 * sa gia' dove andare. Si rivede da Impostazioni → «Come si gioca».
 */
let passo = 0;

const PASSI = [
  {
    posa: 'saluta',
    titolo: 'Dove giocare',
    frase: 'Ciao, sono TITO! Prima scegli dove giocare.',
    punti: [
      ['users', 'Con gli amici', 'Crei una lega e diventi admin. Mandi il link d\'invito: chi lo apre entra col codice già pronto.'],
      ['globe', 'Nella lega pubblica', 'Se non hai una compagnia, entri nella lega aperta a tutti e sfidi chi c\'è.'],
    ],
  },
  {
    posa: 'indica',
    titolo: 'La tua squadra',
    frase: 'Poi la tua squadra: falla tua.',
    punti: [
      ['shirt', 'Il nome', 'Lo scegli quando entri in una lega. Una lega, una squadra.'],
      ['edit', 'Stemma, maglia e copertina', 'Da «La mia squadra» carichi lo stemma, disegni la maglia e scegli il personaggio in copertina. C\'è anche il mio!'],
    ],
  },
  {
    posa: 'braccia',
    titolo: 'I giocatori',
    frase: 'Infine i giocatori: servono 25, veri, del campionato.',
    punti: [
      ['cart', 'Nella lega pubblica', 'Vai nel Negozio e compri subito i tuoi 25 con i crediti della lega. Lo stesso giocatore può averlo anche un altro.'],
      ['cup', 'Con gli amici', 'Si fa l\'asta, 500 crediti a testa: l\'admin registra gli acquisti. Poi c\'è il mercato degli svincolati.'],
      ['cal', 'Ogni settimana', 'Schieri 11 titolari e 7 in panchina entro le 15 del giorno della prima partita. I voti li scrive il referto.'],
    ],
  },
];

export const guida = {
  title: 'Come si gioca', appbar: 'none', nav: false,
  render() {
    const p = PASSI[passo]; const ultimo = passo === PASSI.length - 1;
    return `<main class="intro guida">
      <div class="intro-bg"><canvas id="intro-fx"></canvas><span class="intro-veil"></span></div>
      <div class="intro-top">
        ${passo ? `<button class="intro-back" data-prev aria-label="Indietro">${icon('chev', 'ic flip')}</button>` : '<span></span>'}
        <span class="guida-passo">Passo ${passo + 1} di ${PASSI.length}</span>
        <button class="intro-skip" data-fine="leghe">Salta</button>
      </div>
      <div class="intro-body guida-body">
        <div class="guida-tito">
          <img src="media/tito/${p.posa}.webp" alt="TITO" width="160" height="220" decoding="async">
          <p class="guida-fumetto">${p.frase}</p>
        </div>
        <span class="intro-eyebrow">Come si gioca</span>
        <h1>${p.titolo}</h1>
        <ul class="intro-points">${p.punti.map(([ic, t, d], i) => `<li style="--i:${i}"><i>${icon(ic)}</i><div><b>${t}</b><span>${d}</span></div></li>`).join('')}</ul>
      </div>
      <div class="intro-foot">
        <div class="intro-dots">${PASSI.map((_, i) => `<i class="${i === passo ? 'on' : ''}"></i>`).join('')}</div>
        ${ultimo
          ? `<button class="a-btn intro-cta" data-fine="crea">${icon('users', 'ic sm')}Crea una lega con gli amici</button>
             <button class="intro-link" data-fine="pubblica">Entra nella lega pubblica</button>`
          : `<button class="a-btn intro-cta" data-next>Avanti ${icon('chev', 'ic sm')}</button>`}
      </div>
    </main>`;
  },
  mount(root, ctx) {
    const main = root.querySelector('.intro');
    fx(root.querySelector('#intro-fx'));
    const vai = (n) => { passo = Math.max(0, Math.min(PASSI.length - 1, n)); ctx.render(); };
    // Chi ha gia' una lega la stava rivedendo dalle impostazioni: torna li'.
    const fine = (dove) => {
      S.store.set({ guidaVista: true }); passo = 0;
      if (S.hasLeague() && dove === 'leghe') { ctx.go('impostazioni'); return; }
      apriModulo(dove === 'crea' ? 'create' : 'none');
      ctx.go('leghe');
    };
    main.addEventListener('click', (e) => {
      if (e.target.closest('[data-next]')) return vai(passo + 1);
      if (e.target.closest('[data-prev]')) return vai(passo - 1);
      const f = e.target.closest('[data-fine]'); if (f) return fine(f.dataset.fine);
    });
    let x0 = null;
    main.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    main.addEventListener('touchend', (e) => {
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 60) vai(passo + (dx < 0 ? 1 : -1));
    }, { passive: true });
  },
};
