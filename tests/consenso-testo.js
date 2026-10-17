// Il testo del consenso in chiaro, come lo conserva la 044 (consensi_testi):
// le frasi che si spuntano e il testo per intero, senza HTML. Una funzione
// sola, usata dalla prova che lo confronta con la migrazione.
export function testoInChiaro(SCELTE, TESTO) {
  const pulisci = (h) => h.replace(/\$\{IG\}/g, 'fantatitano').replace(/<\/(h3|p|li)>/g, '\n').replace(/<[^>]+>/g, '')
    .split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return ['Le frasi che si spuntano',
    `[scelta] ${pulisci(SCELTE.aderisco)}`, `[facoltativa, solo con «Ci sto»] ${pulisci(SCELTE.sponsor)}`,
    `[scelta] ${pulisci(SCELTE.escludimi)}`, `[sotto i 18 anni] ${pulisci(SCELTE.genitore)}`,
    `[obbligatoria] ${pulisci(SCELTE.dichiaro)}`, pulisci(TESTO)].join('\n');
}
