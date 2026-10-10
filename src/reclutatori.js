/**
 * I premi dei Reclutatori (migrazione 023).
 *
 * Alex, 10/10: niente soldi e niente oggetti (servirebbe il commercialista), e
 * NESSUN vantaggio in classifica. Quindi solo cose da mostrare: si vedono in
 * copertina, in Partecipanti e in classifica, e non spostano un punto.
 *
 * Le stesse soglie le controlla il database (trigger premi_reclutatore sulla
 * 023): chi si scrivesse la maglia d'oro a mano se la vede togliere.
 */
export const PREMI = [
  { id: 'titano', tipo: 'finitura', nome: 'Maglia biancazzurra', amici: 0, benvenuto: true,
    come: 'il regalo di benvenuto di chi arriva dal link di un amico, e di chi porta il primo amico' },
  { id: 'oro', tipo: 'finitura', nome: 'Maglia d\'oro', amici: 1, come: 'porta un amico' },
  { id: 31, tipo: 'personaggio', nome: 'TITO d\'oro', amici: 3, come: 'porta 3 amici' },
  { id: 'cornice', tipo: 'cornice', nome: 'Cornice d\'oro allo stemma', amici: 5, come: 'porta 5 amici' },
];

/** Sbloccato? n = amici portati, invitato = arrivato dal link di qualcuno. */
export function sbloccato(premio, n = 0, invitato = false) {
  const p = typeof premio === 'object' ? premio : PREMI.find((x) => x.id === premio);
  if (!p) return true;
  if (p.benvenuto) return invitato || n >= 1;
  return n >= p.amici;
}

export const FINITURE = PREMI.filter((p) => p.tipo === 'finitura');
export const PERSONAGGI_ESCLUSIVI = PREMI.filter((p) => p.tipo === 'personaggio').map((p) => p.id);
export const conCornice = (n) => sbloccato('cornice', n);
