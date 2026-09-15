/**
 * Misure vere del riquadro sullo schermo del telefono.
 *
 * Il fondo dell'app su iPhone lasciava una fascia scoperta sotto la barra in
 * basso, e nel sandbox non si riproduce: Chromium non espone
 * env(safe-area-inset-*) e non ha le barre che compaiono e spariscono, quindi
 * dvh, lvh e svh valgono sempre lo stesso numero. Invece di tirare a indovinare
 * un'altra volta, l'app si misura da sola sul telefono e sputa i numeri.
 *
 * Tutto quello che c'e' qui dentro e' sola lettura: nessuna misura cambia il
 * layout, e la sonda vive qualche millisecondo fuori dallo schermo.
 */

/** Altezza reale di 100svh / 100lvh / 100dvh, misurata con una sonda. */
function unitaViewport() {
  const out = {};
  const s = document.createElement('div');
  s.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;pointer-events:none;visibility:hidden';
  document.body.appendChild(s);
  for (const u of ['svh', 'lvh', 'dvh', 'vh']) {
    s.style.height = `100${u}`;
    const h = s.getBoundingClientRect().height;
    out[u] = h ? Math.round(h * 10) / 10 : null;   // null: unita' non supportata
  }
  s.remove();
  return out;
}

/**
 * Gli inset del telefono. Si leggono da un padding, non da getComputedStyle
 * della variabile: una custom property torna la stringa "env(...)" non risolta.
 */
function inset() {
  const s = document.createElement('div');
  s.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;visibility:hidden;'
    + 'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);'
    + 'padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';
  document.body.appendChild(s);
  const cs = getComputedStyle(s);
  const n = (v) => Math.round(parseFloat(v) * 10) / 10 || 0;
  const out = { top: n(cs.paddingTop), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft), right: n(cs.paddingRight) };
  s.remove();
  return out;
}

function comeGira() {
  for (const m of ['standalone', 'fullscreen', 'minimal-ui', 'browser']) {
    if (window.matchMedia && window.matchMedia(`(display-mode:${m})`).matches) return m;
  }
  return navigator.standalone ? 'standalone' : 'ignoto';
}

/** Le versioni in cache: dicono subito se il telefono ha ancora l'app vecchia. */
async function versioniInCache() {
  if (!('caches' in window)) return [];
  try { return await caches.keys(); } catch { return []; }
}

/**
 * @returns {Promise<{righe:[string,string][], testo:string}>}
 *   righe da mostrare e la stessa roba in testo piatto da incollare.
 */
export async function misure() {
  const u = unitaViewport();
  const sa = inset();
  const vv = window.visualViewport;
  const app = document.querySelector('.app')?.getBoundingClientRect();
  const nav = document.querySelector('.a-nav,.l-nav')?.getBoundingClientRect();
  const cache = await versioniInCache();
  const sw = navigator.serviceWorker?.controller?.scriptURL || null;
  const r = (v) => (v == null ? '—' : Math.round(v * 10) / 10);

  const righe = [
    ['Come gira', comeGira()],
    ['Schermo', `${screen.width}×${screen.height} · rapporto ${window.devicePixelRatio}`],
    ['Finestra', `innerHeight ${r(window.innerHeight)}`],
    ['Viewport visibile', vv ? `${r(vv.height)} (scostata di ${r(vv.offsetTop)} in alto)` : 'non disponibile'],
    ['Unità', `svh ${r(u.svh)} · lvh ${r(u.lvh)} · dvh ${r(u.dvh)} · vh ${r(u.vh)}`],
    ['Tacche', `alto ${r(sa.top)} · basso ${r(sa.bottom)} · lati ${r(sa.left)}/${r(sa.right)}`],
    ['Riquadro app', app ? `da ${r(app.top)} a ${r(app.bottom)} · alto ${r(app.height)}` : 'non trovato'],
    ['Barra in basso', nav ? `da ${r(nav.top)} a ${r(nav.bottom)} · alta ${r(nav.height)}` : 'assente in questa schermata'],
    ['Scoperto sotto', nav ? `${r(window.innerHeight - nav.bottom)} sotto la barra` : '—'],
    ['Service worker', sw ? sw.split('/').pop() : 'nessuno'],
    ['Cache', cache.length ? cache.join(', ') : 'vuota'],
  ];
  return { righe, testo: righe.map(([k, v]) => `${k}: ${v}`).join('\n') };
}
