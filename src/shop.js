/**
 * Lo shop (Alex, 12/11): il catalogo e i conti.
 *
 * Il prezzo vero lo decide il database (supabase/migrations/056-shop.sql,
 * shop_prezzo): qui c'e' lo stesso elenco per mostrarlo. Se cambia un prezzo
 * va cambiato in tutti e due i posti (tests/shop.test.js controlla che
 * coincidano).
 */
export const SPEDIZIONE_CENT = 200;
export const TAGLIE = ['S', 'M', 'L', 'XL'];
export const MAX_QUANTITA = 5;

export const ARTICOLI = [
  {
    id: 'top-fantatitano',
    nome: 'Top Fantatitano',
    categoria: 'Abbigliamento',
    prezzoCent: 1800,
    taglie: TAGLIE,
    foto: [
      { src: 'media/shop/top-1.webp', alt: 'Il top Fantatitano indossato' },
      { src: 'media/shop/top-2.webp', alt: 'Davanti: la corona sul petto' },
      { src: 'media/shop/top-3.webp', alt: 'Di lato: i bordi lime di collo e maniche' },
      { src: 'media/shop/top-4.webp', alt: 'Dietro: la scritta FANTATITANO sotto il collo' },
    ],
    descrizione: [
      'Il top ufficiale di Fantatitano, nei colori dell\'app: viola sopra, bianco sotto, bordi lime al collo e alle maniche.',
      'Davanti la corona, dietro la scritta FANTATITANO sotto il collo. Corto e aderente.',
    ],
  },
];

export const articolo = (id) => ARTICOLI.find((a) => a.id === id) || null;

/** 1800 -> «18,00 €» */
export const euro = (cent) => `${(cent / 100).toFixed(2).replace('.', ',')} €`;

/** Il totale come lo calcola il database: prezzo per quantita', piu' la spedizione se c'e'. */
export function totaleCent(art, quantita, consegna) {
  const q = Math.min(MAX_QUANTITA, Math.max(1, Number(quantita) || 1));
  return art.prezzoCent * q + (consegna === 'spedizione' ? SPEDIZIONE_CENT : 0);
}

export const STATI = {
  nuovo: 'Ricevuto',
  pagato: 'Pagato',
  spedito: 'Spedito',
  consegnato: 'Consegnato',
  annullato: 'Annullato',
};
