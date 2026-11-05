/**
 * Il dizionario spagnolo: frase italiana -> frase spagnola (src/lingua.js).
 *
 * Diviso per zona dell'app, un file ciascuna, cosi' chi traduce una schermata
 * non tocca le altre. Le graffe ({n}, {squadra}) restano uguali nelle due
 * lingue. Spagnolo neutro dell'America Latina, dove sta il pubblico che lo
 * chiede (i tifosi di @trepennefutbol): «tú» e non «vos» ne' «usted», e i
 * termini del calcio come li usano li': «fecha» per la giornata, «arquero»
 * per il portiere, «DT» no: «entrenador».
 */
import { BASE } from './es-base.js';
import { ACCESSO } from './es-accesso.js';
import { HOME } from './es-home.js';
import { SQUADRA } from './es-squadra.js';
import { VOTI } from './es-voti.js';
import { CAMPIONATO } from './es-campionato.js';

export const ES = { ...BASE, ...ACCESSO, ...HOME, ...SQUADRA, ...VOTI, ...CAMPIONATO };
