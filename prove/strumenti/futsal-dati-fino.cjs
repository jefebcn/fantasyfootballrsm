/**
 * I dati del futsal come erano prima di una giornata, per le prove con
 * l'orologio fermo: senza i referti e i risultati da quella giornata in poi.
 * Senza, ogni import automatico cambia cosa vedono le prove (24/11: i referti
 * dell'11ª facevano fallire futsal-leghe e futsal-risultati-a-mano su main).
 *
 *   await fermaDatiFutsal(ctx, 11)   // l'11ª e le seguenti non ancora giocate
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'src', 'futsal-dati.js');

const datiFino = (testo, da) => testo
  // i referti stanno uno per riga: «  {g:11,casa:…},»
  .replace(/^ {2}\{g:(\d+),.*$\n/gm, (riga, g) => (+g >= da ? '' : riga))
  // il calendario: «  [11,"casa","ospite","quando","campo",gc,go],»
  .replace(/^( {2}\[(\d+),"[^"]+","[^"]+","[^"]+","[^"]*"),-?\d+,-?\d+\]/gm, (riga, testa, g) => (+g >= da ? `${testa},null,null]` : riga));

const fermaDatiFutsal = (ctx, da) => ctx.route('**/src/futsal-dati.js', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript', body: datiFino(fs.readFileSync(FILE, 'utf8'), da),
}));

module.exports = { datiFino, fermaDatiFutsal };
