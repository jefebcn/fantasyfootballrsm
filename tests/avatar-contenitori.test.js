/**
 * Ogni riquadro che contiene un avatar deve essere posizionato.
 *
 * La caricatura sta in `position:absolute` perche' deve appoggiarsi in basso —
 * e' una figura intera, non un ritratto, e nel riquadro ci sta in piedi. Un
 * elemento assoluto si aggancia al primo antenato posizionato: se il riquadro
 * non lo e', salta quel riquadro e si aggancia alla pagina.
 *
 * E' successo davvero, in .av-big: nella scheda del giocatore il tondo restava
 * vuoto e la testa del personaggio spuntava in fondo allo schermo, dietro la
 * barra di navigazione. Gli altri tre riquadri position:relative ce l'avevano
 * gia', e per questo il guasto si vedeva in una schermata sola.
 *
 * Il controllo e' sul testo del CSS e non sul browser, quindi ha un limite che
 * conviene dire: conosce i quattro riquadri che esistono oggi. Se ne nasce un
 * quinto va aggiunto qui a mano — l'elenco sta accanto ai punti dove si chiama
 * avatar(), in src/ui.js e nelle viste campo (formazione.js, live.js).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const radice = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const css = readFileSync(`${radice}/styles/app.css`, 'utf8');

/** I riquadri, con il file e la riga da cui esce l'avatar che ci finisce. */
const RIQUADRI = [
  ['.av-w', 'src/ui.js — faccia(), le liste'],
  ['.av-big', 'src/ui.js — avatarGrande(), la scheda del giocatore'],
  ['.ps .av', 'src/views/live.js — le formazioni dei Voti e del Live'],
  ['.slot .av', 'src/views/formazione.js — il campo'],
];

/** Il blocco di dichiarazioni della prima regola che definisce quel selettore. */
function regola(selettore) {
  const quotato = selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // il selettore puo' stare da solo o in un elenco separato da virgole
  const re = new RegExp(`(?:^|[,}])\\s*${quotato}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, 'm');
  const m = css.match(re);
  return m ? m[1] : null;
}

for (const [sel, dove] of RIQUADRI) {
  test(`${sel} e' posizionato (${dove})`, () => {
    const corpo = regola(sel);
    assert.ok(corpo, `la regola ${sel} non si trova in styles/app.css`);
    assert.match(
      corpo,
      /position\s*:\s*(relative|absolute|sticky|fixed)/,
      `${sel} non e' posizionato: la caricatura dentro ci passa attraverso e si aggancia alla pagina`,
    );
  });
}
