/**
 * Scrive media/stemmi/<squadra>.svg (con le scritte) e <squadra>-mini.svg
 * (senza, per le liste) per tutte le squadre di src/data.js.
 *
 *   node strumenti/stemmi/genera.mjs
 *
 * Le forme delle lettere (glifi-anton.json) vengono da media/font/anton-400-latin.woff2,
 * estratte con fontTools (SVGPathPen) una volta sola.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { CLUBS } from '../../src/data.js';
import { stemma } from './disegno.mjs';

const dir = new URL('../../media/stemmi/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const c of CLUBS) {
  writeFileSync(new URL(`${c.id}.svg`, dir), stemma(c, { size: 200 }) + '\n');
  writeFileSync(new URL(`${c.id}-mini.svg`, dir), stemma(c, { mini: true, size: 64 }) + '\n');
}
console.log(`stemmi: ${CLUBS.length * 2} file in media/stemmi`);
