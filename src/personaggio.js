/**
 * Personaggi scontornati per la copertina (media/avatar/N.webp).
 *
 * Li ritaglia scripts/make-avatar.py dai file in media/avatarN.jpg. Sono nove:
 * in una lega da otto ognuno puo' avere il suo e non se ne ripete nessuno.
 * Chi non ne sceglie uno tiene la maglia.
 */
export const QUANTI = 9;
export const elenco = () => Array.from({ length: QUANTI }, (_, i) => i + 1);

/** Il personaggio scelto, o null se la squadra tiene la maglia. */
export const scelto = (m) => {
  const n = Number(m?.kit?.personaggio);
  return Number.isInteger(n) && n >= 1 && n <= QUANTI ? n : null;
};

export const personaggio = (n, cls = '') =>
  `<img class="pers ${cls}" src="media/avatar/${n}.webp" alt="" decoding="async">`;
