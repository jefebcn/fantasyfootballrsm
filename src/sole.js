/**
 * Alba e tramonto sul Titano, per la copertina della home: di giorno il
 * Titano al tramonto, dopo il tramonto quello di notte (Alex, 12/11).
 *
 * L'equazione dell'alba della NOAA nella forma corta: sbaglia di un paio di
 * minuti, che per scegliere uno sfondo bastano. Lavora in millisecondi UTC,
 * quindi il fuso del telefono non conta.
 */
const LAT = 43.94, LON = 12.45; // San Marino, Città
const RAD = Math.PI / 180;

/** { alba, tramonto } in ms UTC per il giorno solare che contiene `ms`. */
export function sole(ms = Date.now(), lat = LAT, lon = LON) {
  const jd = ms / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const L = (M + C + 180 + 102.9372) % 360;
  const transito = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
  const sinD = Math.sin(L * RAD) * Math.sin(23.4397 * RAD);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinD) / (Math.cos(lat * RAD) * cosD);
  const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / RAD;
  const ms0 = (j) => (j - 2440587.5) * 86400000;
  return { alba: ms0(transito - w / 360), tramonto: ms0(transito + w / 360) };
}

/** true tra il tramonto e l'alba. */
export function eNotte(ms = Date.now()) {
  const { alba, tramonto } = sole(ms);
  return ms < alba || ms > tramonto;
}
