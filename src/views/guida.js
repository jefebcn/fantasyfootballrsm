import * as S from '../state.js';
import { icon } from '../ui.js';
import { fx } from './onboarding.js';
import { apriModulo, vaiAllePubbliche } from './leghe.js';
import { suiOS, installata, browserIOS, doveCondividi } from '../notifiche.js';

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
 *
 * L'ULTIMO PASSO E' LA SCHERMATA HOME (Alex, 10/10): chi apre l'app dal
 * browser e non la mette sulla Home la perde fra le schede, e su iPhone senza
 * Home non arrivano nemmeno le notifiche. TITO dice quali tasti toccare,
 * quelli del telefono che si ha in mano. Chi l'ha gia' installata (dalla Home
 * o dal Play Store, che apre a schermo intero) quel passo non lo vede.
 *
 * I PRIMI TRE PASSI SI LEGGONO E BASTA (Alex, 10/10): disegnati come schede
 * coi bordi sembravano bottoni da scegliere o campi da riempire, e chi li
 * guardava cercava cosa toccare. Adesso sono righe di testo senza riquadro,
 * e TITO lo dice subito: per ora non si sceglie niente.
 */
let passo = 0;

const PASSI = [
  {
    posa: 'saluta',
    titolo: 'Dove si gioca',
    frase: 'Ciao, sono TITO! Ti racconto come funziona. Per ora leggi e basta: si sceglie alla fine.',
    punti: [
      ['users', 'Con gli amici', 'Una lega tutta vostra: chi la crea fa l\'admin e manda il link d\'invito agli altri.'],
      ['globe', 'Nella lega pubblica', 'Aperta a tutti: si entra senza codice e si gioca contro chi c\'è.'],
    ],
  },
  {
    posa: 'indica',
    titolo: 'La tua squadra',
    frase: 'Poi c\'è la tua squadra. La sistemi quando vuoi, anche dopo.',
    punti: [
      ['shirt', 'Il nome', 'Si sceglie quando entri in una lega: una lega, una squadra.'],
      ['edit', 'Stemma, maglia e copertina', 'Si cambiano quando vuoi da «La mia squadra». C\'è anche il mio personaggio!'],
    ],
  },
  {
    posa: 'braccia',
    titolo: 'I giocatori',
    frase: 'Infine i giocatori: 25, veri, del campionato.',
    punti: [
      ['cart', 'Nella lega pubblica', 'Li compri subito nel Negozio, con i crediti della lega.'],
      ['cup', 'Con gli amici', 'Si fa l\'asta, 500 crediti a testa. Poi il mercato degli svincolati.'],
      ['cal', 'Ogni settimana', 'Schieri la formazione entro le 15 del giorno della prima partita.'],
    ],
  },
];

// I tre puntini del menu di Chrome: nello sprite non c'e', qui serve com'e'.
const PUNTINI = '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

const HOME = () => (suiOS()
  ? {
    posa: 'indica',
    titolo: 'Mettimi sulla Home',
    frase: 'Ultima cosa: mettimi sulla Home. Così mi apri con un tocco e ti avviso io.',
    punti: [
      ['share', '1 · Tocca Condividi', doveCondividi()],
      ['home', '2 · «Aggiungi alla schermata Home»', 'Scorri l\'elenco che si apre e toccalo.'],
      ['check', '3 · Tocca «Aggiungi»', 'In alto a destra. Fatto: sono sulla Home.'],
    ],
    azione: true,
    nota: browserIOS() === 'app'
      ? 'Sei dentro un\'altra app: apri fantatitano.site in Safari o in Chrome, lì trovi la voce.'
      : browserIOS() === 'altro' ? 'Se la voce non c\'è, apri fantatitano.site in Safari o in Chrome.' : '',
  }
  : {
    posa: 'indica',
    titolo: 'Mettimi sulla Home',
    frase: 'Ultima cosa: mettimi sulla Home. Così mi apri con un tocco e ti avviso io.',
    punti: [
      [PUNTINI, '1 · Tocca i tre puntini', 'In alto a destra, nella barra di Chrome.'],
      ['home', '2 · «Aggiungi a schermata Home»', 'Oppure «Installa app»: è la stessa cosa.'],
      ['check', '3 · Tocca «Installa»', 'Fatto: mi trovi fra le app del telefono.'],
    ],
    installa: true,
    azione: true,
  });

/** I passi di oggi: quello della Home solo se l'app gira ancora nel browser. */
const passi = () => (installata() ? PASSI : [...PASSI, HOME()]);
const ico = (ic) => (ic.startsWith('<') ? ic : icon(ic));

export const guida = {
  title: 'Come si gioca', appbar: 'none', nav: false,
  render() {
    const tutti = passi(); passo = Math.min(passo, tutti.length - 1);
    const p = tutti[passo]; const ultimo = passo === tutti.length - 1;
    return `<main class="intro guida">
      <div class="intro-bg"><canvas id="intro-fx"></canvas><span class="intro-veil"></span></div>
      <div class="intro-top">
        ${passo ? `<button class="intro-back" data-prev aria-label="Indietro">${icon('chev', 'ic flip')}</button>` : '<span></span>'}
        <span class="guida-passo">Passo ${passo + 1} di ${tutti.length}</span>
        <button class="intro-skip" data-fine="leghe">Salta</button>
      </div>
      <div class="intro-body guida-body">
        <div class="guida-tito">
          <img src="media/tito/${p.posa}.webp" alt="TITO" width="160" height="220" decoding="async">
          <p class="guida-fumetto">${p.frase}</p>
        </div>
        <span class="intro-eyebrow">Come si gioca</span>
        <h1>${p.titolo}</h1>
        <ul class="intro-points${p.azione ? '' : ' info'}">${p.punti.map(([ic, t, d], i) => `<li style="--i:${i}"><i>${ico(ic)}</i><div><b>${t}</b><span>${d}</span></div></li>`).join('')}</ul>
        ${p.installa && window.__installPrompt ? `<button class="guida-installa" data-installa>${icon('down', 'ic sm')}Installa adesso</button>` : ''}
        ${p.nota ? `<p class="guida-nota">${p.nota}</p>` : ''}
      </div>
      <div class="intro-foot">
        <div class="intro-dots">${tutti.map((_, i) => `<i class="${i === passo ? 'on' : ''}"></i>`).join('')}</div>
        ${ultimo
          ? `<button class="a-btn intro-cta" data-fine="pubblica">${icon('globe', 'ic sm')}Entra nella lega pubblica</button>
             <button class="intro-link" data-fine="crea">Crea una lega con gli amici</button>`
          : `<button class="a-btn intro-cta" data-next>Avanti ${icon('chev', 'ic sm')}</button>`}
      </div>
    </main>`;
  },
  mount(root, ctx) {
    const main = root.querySelector('.intro');
    fx(root.querySelector('#intro-fx'));
    const vai = (n) => { passo = Math.max(0, Math.min(passi().length - 1, n)); ctx.render(); };
    // Chi ha gia' una lega la stava rivedendo dalle impostazioni: torna li'.
    // Il pulsante giallo e' la lega pubblica: chi scarica l'app dallo Store
    // di solito non ha una compagnia con cui giocare, e li' entra da solo.
    const fine = (dove) => {
      S.store.set({ guidaVista: true }); passo = 0;
      if (S.hasLeague() && dove === 'leghe') { ctx.go('impostazioni'); return; }
      apriModulo(dove === 'crea' ? 'create' : 'none');
      if (dove === 'pubblica') vaiAllePubbliche();
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
