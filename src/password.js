/**
 * LE REGOLE DELLA PASSWORD, le stesse del server.
 *
 * Il progetto Supabase vuole almeno 6 caratteri, con almeno una lettera e un
 * numero. L'app diceva solo «almeno 6 caratteri»: chi sceglieva «calcio» o
 * «123456» passava il controllo dell'app e si prendeva dal server «Password
 * should contain at least one character of each: abcdef…», in inglese (log
 * del 23/10). Ora le regole si vedono mentre si scrive, e sono queste.
 */
export const REGOLE = [
  { k: 'lunga', testo: 'almeno 6 caratteri', ok: (p) => p.length >= 6 },
  { k: 'lettera', testo: 'una lettera', ok: (p) => /\p{L}/u.test(p) },
  { k: 'numero', testo: 'un numero', ok: (p) => /\d/.test(p) },
];

/** Cosa manca, in parole; vuoto se la password va bene. */
export const mancano = (p) => REGOLE.filter((r) => !r.ok(p || '')).map((r) => r.testo);

/** Il messaggio d'errore intero, o '' se va bene. */
export function erroreRegole(p) {
  const m = mancano(p);
  if (!m.length) return '';
  const elenco = m.length === 1 ? m[0] : `${m.slice(0, -1).join(', ')} e ${m.at(-1)}`;
  return `La password deve avere ${elenco}.`;
}
