/**
 * La Partita, il gioco di calcio 3D, sotto fantatitano.site/gioco.
 *
 * Il gioco ha un repository e un deploy suoi (jefebcn/fantatitano-gioco, Alex 17/11: «stesso
 * indirizzo ma repository e deploy a parte»). Qui c'e' solo il collegamento: Vercel serve
 * /gioco/... prendendolo da quel deploy, e il browser vede sempre fantatitano.site.
 * (Il minigioco #/gioco dell'app e' un'altra cosa: sta dopo il cancelletto, non si tocca.)
 *
 * LA BARRA IN FONDO. Il gioco chiede i suoi file con indirizzi relativi (data.js, img/...):
 * da /gioco il browser li cercherebbe nella radice del sito, da /gioco/ li trova al posto
 * giusto. Per questo /gioco rimanda a /gioco/. La regola vale solo per /gioco senza barra,
 * se no il rimando girerebbe in tondo.
 *
 * FUORI DALLA CACHE DELL'APP. Il service worker tiene in cache tutto quello che passa
 * dall'indirizzo del sito, versione per versione. Il gioco si aggiorna per conto suo:
 * se passasse da li', chi ha l'app installata giocherebbe alla versione vecchia
 * fino al prossimo aggiornamento dell'app.
 *
 * DENTRO L'APP PER IPHONE. Alex, 17/11: «dall'app non voglio che si apra in una nuova schermata,
 * deve rimanere tutto sull'applicazione». L'app per iPhone carica fantatitano.site: /gioco/ e' lo
 * stesso indirizzo, quindi ci si arriva restando dentro l'app. E un link a fantatitano.site/gioco
 * toccato fuori (Instagram, messaggi) deve aprire l'app, come ogni altro indirizzo del sito:
 * per questo /gioco NON va escluso dai link universali, al contrario di /link.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const conf = JSON.parse(readFileSync('vercel.json', 'utf8'));
const DEPLOY = 'https://fantatitano-gioco.vercel.app';

test('partita 3D: /gioco rimanda a /gioco/, e solo quello', () => {
  const r = conf.redirects.find((x) => x.source === '/gioco');
  assert.ok(r, 'manca il rimando da /gioco a /gioco/');
  assert.equal(r.destination, '/gioco/');
  assert.equal(r.permanent, false);
  assert.ok(!conf.redirects.some((x) => x.source === '/gioco/' || x.source === '/gioco/:path*'), 'un rimando su /gioco/ girerebbe in tondo');
});

test('partita 3D: /gioco/ e i suoi file vengono dal deploy del gioco', () => {
  const rw = (s) => conf.rewrites.find((x) => x.source === s)?.destination;
  assert.equal(rw('/gioco/'), `${DEPLOY}/`);
  assert.equal(rw('/gioco/:path*'), `${DEPLOY}/:path*`);
});

test('partita 3D: le cartelle nascoste del sito non coprono il gioco', () => {
  // i rimandi verso la home valgono per le cartelle di lavoro in radice, non per /gioco/data.js o /gioco/img
  for (const r of conf.redirects) {
    if (r.has || r.source === '/gioco') continue;
    const re = new RegExp('^' + r.source.replace(/:dir\(([^)]+)\)/, '($1)').replace(/:path\*/, '.*').replace(/:file\(([^)]+)\)/, '($1)') + '$');
    for (const u of ['/gioco/', '/gioco/data.js', '/gioco/img/pelle.webp', '/gioco/app.js']) assert.ok(!re.test(u), `${r.source} prende anche ${u}`);
  }
});

test('partita 3D: il service worker la lascia passare senza cache', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const salta = sw.indexOf("url.pathname.startsWith('/gioco/')"), guscio = sw.indexOf('e.respondWith(caches.open(VERSION).then');
  assert.ok(salta > 0, 'il service worker non salta /gioco/');
  assert.ok(salta < guscio, 'il salto va prima della cache del guscio');
});

test('partita 3D: sull\'iPhone si apre dentro l\'app, non nel browser', () => {
  const aasa = JSON.parse(readFileSync('.well-known/apple-app-site-association', 'utf8'));
  const c = aasa.applinks.details[0].components;
  assert.ok(c.some((x) => x['/'] === '/*' && !x.exclude), 'i link universali devono coprire tutto il sito');
  for (const x of c.filter((y) => y.exclude)) assert.ok(!/^\/gioco/.test(x['/']), `${x['/']} manderebbe il gioco nel browser invece che nell'app`);
  // l'app carica il sito vero: il gioco sotto lo stesso indirizzo resta nella stessa finestra
  const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
  assert.equal(new URL(cap.server.url).host, 'fantatitano.site');
});
