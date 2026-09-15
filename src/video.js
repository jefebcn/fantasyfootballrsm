/**
 * Highlights dal canale YouTube della FSGC.
 *
 * Il feed del canale non e' leggibile dal browser (YouTube non manda le
 * intestazioni CORS), quindi i video arrivano da src/video-dati.js, scritto da
 * scripts/importa-video.py insieme al resto dei dati di giornata.
 *
 * Niente parte verso Google finche' non si tocca play: nemmeno la copertina.
 * La si disegna in casa col nome delle squadre e il risultato — che l'app
 * conosce gia' — invece di scaricarla da i.ytimg.com. Cosi' chi apre il
 * calendario non finisce nei registri di Google per il solo fatto di averlo
 * aperto, e la pagina sui cookie puo' continuare a dire il vero.
 */
import { PARTITE, VIDEO_CANALE, CANALE } from './video-dati.js';

const perPartita = new Map(PARTITE.map(([n, casa, ospite, id, quando]) => [`${n}:${casa}:${ospite}`, { id, quando }]));

/** Il video di una partita del campionato, se c'e'. */
export const videoDi = (m) => (m ? perPartita.get(`${m.matchday}:${m.homeClubId}:${m.awayClubId}`) || null : null);
/** Tutti i video di una giornata, in ordine di calendario. */
export const videoGiornata = (partite) => partite.map((m) => ({ m, v: videoDi(m) })).filter((x) => x.v);
/** Le giornate che hanno video, dalla piu' recente. Si guardano i dati dei
 *  video, non la giornata della lega: il campionato va avanti anche se
 *  l'amministratore non ha ancora caricato i risultati. */
export const giornateConVideo = () => [...new Set(PARTITE.map((r) => r[0]))].sort((a, b) => b - a);
/** Video del canale non legati a una partita (sondaggi, Coppa Titano). */
export const altriVideo = () => VIDEO_CANALE.map(([id, titolo, quando]) => ({ id, titolo, quando }));
export const urlCanale = `https://www.youtube.com/channel/${CANALE}`;
/** Pagina del video su YouTube, per chi preferisce aprirlo di la'. */
export const urlVideo = (id) => `https://www.youtube.com/watch?v=${id}`;
/** nocookie: fino al play non si carica, e anche dopo Google traccia di meno. */
export const urlIncorpora = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
export const ciSonoVideo = () => PARTITE.length > 0 || VIDEO_CANALE.length > 0;
