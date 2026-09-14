import * as S from '../state.js';
import { icon } from '../ui.js';
import { prepareLogin } from './auth.js';

/**
 * Presentazione per chi apre l'app la prima volta. Due schermate su sfondo video
 * sfocato; chi è già registrato su questo dispositivo non la rivede più.
 * Il video va in media/intro.mp4 — se manca, resta lo sfondo animato di riserva.
 */
let slide = 0;

const SLIDES = [
  {
    eyebrow: 'Campionato Sammarinese',
    title: 'Fantacampionato<br><em>Titano</em>',
    body: `<p>Il fantacalcio delle sedici squadre di San Marino: asta, rosa, formazione ogni settimana, scontro diretto.</p>
           <p>Con una differenza: qui <b>le pagelle non esistono</b>. Nessuno decide se hai giocato bene. Il voto nasce da quello che è successo in campo.</p>`,
  },
  {
    eyebrow: 'Come funziona',
    title: 'Tre cose<br><em>da sapere</em>',
    points: [
      ['calc', 'Il Voto Titano', 'Si parte da 6,0. Si aggiunge l\'esito della squadra e ogni evento del referto: gol, assist, porta inviolata, cartellini, rigori. Il conto è sempre visibile, riga per riga.'],
      ['cal', 'Una giornata a settimana', 'Schieri 11 titolari e 7 in panchina ordinati. Le formazioni si chiudono all\'inizio della prima gara. La domenica sera arrivano i punteggi.'],
      ['lock', 'Il dato si congela', 'Hai tempo fino al martedì per contestare un evento. Alle 20:00 la giornata diventa definitiva e non si tocca più.'],
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
        <video id="intro-video" playsinline muted loop preload="auto" poster="media/intro.jpg">
          <source src="media/intro.webm" type="video/webm"><source src="media/intro.mp4" type="video/mp4">
        </video>
        <span class="intro-veil"></span>
      </div>
      <div class="intro-top">
        ${slide ? `<button class="intro-back" data-prev aria-label="Indietro">${icon('chev', 'ic flip')}</button>` : '<span></span>'}
        ${icon('towers', 'ic intro-mark')}
        <button class="intro-skip" data-skip>Salta</button>
      </div>
      <div class="intro-body">
        <span class="intro-eyebrow">${s.eyebrow}</span>
        <h1>${s.title}</h1>
        ${s.body || ''}
        ${s.points ? `<ul class="intro-points">${s.points.map(([ic, t, d], i) => `<li style="--i:${i}"><i>${icon(ic)}</i><div><b>${t}</b><span>${d}</span></div></li>`).join('')}</ul>` : ''}
      </div>
      <div class="intro-foot">
        <div class="intro-dots">${SLIDES.map((_, i) => `<i class="${i === slide ? 'on' : ''}"></i>`).join('')}</div>
        ${last
          ? `<button class="a-btn intro-cta" data-signup>${icon('userplus', 'ic sm')}Registrati</button>
             <button class="intro-link" data-signin>Ho già un account · Accedi</button>`
          : `<button class="a-btn intro-cta" data-next>Avanti ${icon('chev', 'ic sm')}</button>`}
      </div>
    </main>`;
  },
  mount(root, ctx) {
    const main = root.querySelector('.intro');
    const video = root.querySelector('#intro-video');
    // Il video compare solo se c'è davvero: altrimenti resta lo sfondo animato.
    video.addEventListener('canplay', () => { video.classList.add('on'); video.play().catch(() => {}); }, { once: true });
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
function fx(cv) {
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
