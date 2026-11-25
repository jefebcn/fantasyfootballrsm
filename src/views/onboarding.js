import * as S from '../state.js';
import { icon, logo, marchio, t } from '../ui.js';
import { prepareLogin } from './auth.js';
import { nativa } from '../notifiche.js';

/**
 * IL TASTO DELL'APP STORE (Alex, 18/11: «se entra una persona che non ha
 * installato da App Store, che gli compaia da qualche parte un tasto che lo
 * reindirizza all'App Store»). Chi arriva qui dal link in bio di Instagram
 * apre il SITO dentro il browser di Instagram: gli diamo la strada per l'app
 * vera. Dentro l'app (Capacitor) non compare; su Android neanche, perche'
 * l'app c'e' solo per iPhone.
 */
export const APP_STORE = 'https://apps.apple.com/it/app/fantatitano/id6834601552';
const mostraAppStore = () => !nativa()
  && !(typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || ''));
const MELA = '<svg class="ic sm" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.16 1.77-3.2 1.85-3.25-1.01-1.47-2.58-1.67-3.13-1.7-1.33-.13-2.6.79-3.28.79-.68 0-1.72-.77-2.83-.75-1.45.02-2.8.85-3.55 2.15-1.52 2.63-.39 6.52 1.09 8.66.72 1.04 1.58 2.21 2.71 2.17 1.09-.04 1.5-.7 2.82-.7 1.31 0 1.69.7 2.84.68 1.17-.02 1.91-1.06 2.62-2.11.83-1.21 1.17-2.38 1.19-2.44-.03-.01-2.28-.87-2.33-3.5zM14.23 6.25c.6-.73 1-1.73.89-2.75-.86.04-1.91.58-2.53 1.3-.55.64-1.04 1.67-.91 2.66.96.07 1.95-.49 2.55-1.21z"/></svg>';

/**
 * Presentazione per chi apre l'app la prima volta: due schermate su un video
 * di sfondo sfocato (media/intro.mp4). Chi e' gia' registrato su questo
 * dispositivo non la rivede piu'.
 *
 * Sotto al video c'e' sempre lo sfondo animato di fx(), luci lente nei colori
 * del Titano: il video compare solo quando ha un fotogramma pronto, e se il
 * file manca o il formato non e' supportato resta quello, senza schermate nere.
 *
 * Il video l'avevo tolto il 15 settembre perche' pesa 1,5 MB, piu' di tutta
 * l'app, per una schermata che si vede una volta. Alex lo ha rivoluto: e' la
 * prima cosa che si vede dell'app, e vale il peso. Non sta nella cache del
 * service worker — si scarica una volta, per la presentazione, e basta.
 */
let slide = 0;

const SLIDES = [
  {
    // IL TITOLO E' IL MARCHIO, non una scritta che gli somiglia. "Fantatitano"
    // scritto col font dell'app aveva un altro peso e un'altra spaziatura di
    // quello del logo — due volte lo stesso nome, in due modi diversi, nella
    // prima schermata che si vede dell'app.
    marchio: true,
    // un paragrafo per voce, tradotti quando si disegna la schermata
    body: [
      'Il fantacalcio delle sedici squadre di San Marino: asta, rosa, formazione ogni settimana, scontro diretto.',
      'Qui il voto non è un\'opinione: <b>lo scrive la partita</b>. Gol, assist, porta inviolata, cartellini — quello che c\'è nel referto, e nient\'altro.',
    ],
  },
  {
    eyebrow: 'Come funziona',
    // Stessa regola del marchio, applicata alle parole: la prima pesante, la
    // seconda leggera e spaziata. E' quello che fa FANTA/TITANO.
    title: 'Tre cose<br><em>da sapere</em>',
    points: [
      ['calc', 'Il Voto Titano', 'Si parte da 6,0. Si aggiunge l\'esito della squadra e ogni evento del referto: gol, assist, porta inviolata, cartellini, rigori. Il conto è sempre visibile, riga per riga.'],
      ['cal', 'Una giornata a settimana', 'Schieri 11 titolari e 7 in panchina ordinati. Le formazioni si chiudono 10 minuti prima della prima gara. La domenica sera arrivano i punteggi.'],
      ['lock', 'Il dato si congela', 'Hai tempo fino al martedì per contestare un evento. Alle 20:00 la giornata diventa definitiva e non si tocca più.'],
    ],
  },
  {
    // PERCHE' FANTATITANO (piano lavori, 26/11): quello che il gioco e', detto
    // in positivo e senza nominare nessun altro. Niente premi qui finche' il
    // regolamento non ha il via del legale (docs/CRESCITA.md).
    eyebrow: 'Perché Fantatitano',
    title: 'Si gioca<br><em>gratis</em>',
    points: [
      ['users', 'Con i tuoi amici', 'Crei una lega, fate l\'asta con 500 crediti e ogni settimana sfidi gli altri. Senza un gruppo c\'è la lega pubblica: la rosa la compri subito.'],
      ['coppa', 'Non solo campionato', 'La Coppa Fantatitano si gioca sulle partite della Coppa Titano, con i gironi e poi l\'eliminazione diretta.'],
      ['star', 'Niente da pagare', 'Nessun abbonamento e nessun acquisto per vincere: contano solo la tua squadra e i voti del referto.'],
    ],
  },
];

export const onboarding = {
  title: 'Benvenuto', appbar: 'none', nav: false,
  render() {
    const s = SLIDES[slide]; const last = slide === SLIDES.length - 1;
    return `<main class="intro">
      <div class="intro-bg">
        <canvas id="intro-fx"></canvas>
        <video id="intro-video" playsinline autoplay muted loop preload="auto" disablepictureinpicture>
          <source src="media/intro.mp4" type="video/mp4">
        </video>
        <span class="intro-veil"></span>
      </div>
      <div class="intro-top">
        ${slide ? `<button class="intro-back" data-prev aria-label="${t('Indietro')}">${icon('chev', 'ic flip')}</button>` : '<span></span>'}
        ${s.marchio ? '<span></span>' : logo('intro-mark')}
        <button class="intro-skip" data-skip>${t('Salta')}</button>
      </div>
      <div class="intro-body">
        ${s.marchio
    // La corona in cima sparisce quando sotto c'e' il marchio intero: due
    // corone nella stessa schermata sono una di troppo.
    ? `<div class="intro-marchio">${marchio()}</div>`
    : `<span class="intro-eyebrow">${t(s.eyebrow)}</span><h1>${t(s.title)}</h1>`}
        ${s.body ? s.body.map((p) => `<p>${t(p)}</p>`).join('\n           ') : ''}
        ${s.points ? `<ul class="intro-points">${s.points.map(([ic, tit, d], i) => `<li style="--i:${i}"><i>${icon(ic)}</i><div><b>${t(tit)}</b><span>${t(d)}</span></div></li>`).join('')}</ul>` : ''}
      </div>
      <div class="intro-foot">
        <div class="intro-dots">${SLIDES.map((_, i) => `<i class="${i === slide ? 'on' : ''}"></i>`).join('')}</div>
        ${last
          ? `<button class="a-btn intro-cta" data-signup>${icon('userplus', 'ic sm')}${t('Registrati')}</button>
             <button class="intro-link" data-signin>${t('Ho già un account · Accedi')}</button>`
          : `<button class="a-btn intro-cta" data-next>${t('Avanti')} ${icon('chev', 'ic sm')}</button>`}
        ${mostraAppStore() ? `<a class="intro-appstore" href="${APP_STORE}" target="_blank" rel="noopener">${MELA}${t('Scarica l\'app dall\'App Store')}</a>` : ''}
      </div>
    </main>`;
  },
  mount(root, ctx) {
    const main = root.querySelector('.intro');
    const video = root.querySelector('#intro-video');
    // Compare solo quando c'e' un fotogramma pronto: se il formato non e'
    // supportato o il file manca resta lo sfondo animato, senza schermate nere.
    const show = () => { video.classList.add('on'); video.play().catch(() => {}); };
    if (video.readyState >= 2) show(); else video.addEventListener('loadeddata', show, { once: true });
    video.addEventListener('error', () => video.remove(), { once: true });
    fx(root.querySelector('#intro-fx'));

    const go = (n) => { slide = Math.max(0, Math.min(SLIDES.length - 1, n)); ctx.render(); };
    const leave = (tab) => { S.store.set({ onboarded: true }); prepareLogin(tab); ctx.go('login'); };
    main.addEventListener('click', (e) => {
      if (e.target.closest('[data-next]')) return go(slide + 1);
      if (e.target.closest('[data-prev]')) return go(slide - 1);
      if (e.target.closest('[data-skip]') || e.target.closest('[data-signin]')) return leave('in');
      if (e.target.closest('[data-signup]')) return leave('up');
    });
    let x0 = null;
    main.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    main.addEventListener('touchend', (e) => {
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 60) go(slide + (dx < 0 ? 1 : -1));
    }, { passive: true });
  },
};

/** Sfondo di riserva: luci lente in movimento nei colori del Titano. */
export function fx(cv) {
  if (!cv) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = cv.getContext('2d'); const dpr = Math.min(2, devicePixelRatio || 1);
  const blobs = [
    { x: .25, y: .30, r: .55, c: '#2E9FD8' }, { x: .78, y: .22, r: .45, c: '#1B84C6' },
    { x: .55, y: .78, r: .60, c: '#0A4570' }, { x: .18, y: .85, r: .40, c: '#35B37E' },
    { x: .88, y: .62, r: .35, c: '#E5A11B' },
  ];
  const size = () => { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; };
  size(); addEventListener('resize', size);
  let t = 0;
  const draw = () => {
    if (!cv.isConnected) return;
    const { width: w, height: h } = cv;
    ctx.fillStyle = '#062033'; ctx.fillRect(0, 0, w, h);
    blobs.forEach((b, i) => {
      const px = (b.x + Math.sin(t / 900 + i * 1.7) * .06) * w;
      const py = (b.y + Math.cos(t / 1100 + i * 2.3) * .05) * h;
      const r = b.r * Math.max(w, h) * .5;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, b.c + 'cc'); g.addColorStop(1, b.c + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    });
    t += reduce ? 0 : 8;
    if (!reduce) requestAnimationFrame(draw);
  };
  draw();
}
