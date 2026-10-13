/** Da quando una giornata si puo' chiudere: vedi giornataDaChiudere in state.js e la 035. */
const parti = (t) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
  .formatToParts(t).map((x) => [x.type, x.value]));
/** L'istante UTC di una data e ora di San Marino (l'ora legale la decide Intl). */
const daRoma = (y, m, d, h) => {
  const ipotesi = Date.UTC(y, m - 1, d, h);
  const p = parti(new Date(ipotesi));
  const scarto = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - ipotesi;
  return new Date(ipotesi - scarto);
};
export function chiusuraGiornata(lockAt) {
  if (!lockAt) return null;
  const p = parti(new Date(lockAt));
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  let giorni = (9 - dow) % 7;
  if (giorni === 0 && +p.hour >= 20) giorni = 7;
  const base = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + giorni));
  return daRoma(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 20);
}

