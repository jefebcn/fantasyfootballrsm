/**
 * I tuoi dati: portarli via.
 *
 * L'informativa promette da sempre che puoi RICEVERE i tuoi dati in un
 * formato leggibile da una macchina (art. 20 GDPR). Non c'era nessun bottone:
 * era una promessa scritta in un documento legale e mantenuta a mano, cioe'
 * mantenuta quando qualcuno aveva tempo.
 *
 * Qui non si chiede niente di nuovo al server: si mette insieme quello che
 * l'app ha gia' in casa per farti giocare. Se un dato non e' in questo file
 * non e' perche' lo nascondiamo, e' perche' l'app non ce l'ha sottomano.
 *
 * E c'e' un limite vero, scritto anche dentro il file che scarichi: l'app
 * tiene aperta UNA lega alla volta. Delle altre conosce nome e codice, non
 * rosa e formazioni. Dirlo e' meglio che consegnare un export che sembra
 * completo e non lo e'.
 */
import * as S from './state.js';

const GIORNATE = 30;

/** Quello che l'app sa di te, in una struttura che una macchina rilegge. */
export function mieiDati() {
  const u = S.currentUser();
  const p = S.profileInfo();
  const io = S.me();
  const lega = S.base.league;
  const aperta = io && lega && lega.id;

  const formazioni = [];
  if (aperta) {
    for (let n = 1; n <= GIORNATE; n++) {
      const f = S.savedLineup(n, io.id);
      if (f) formazioni.push({ giornata: n, formazione: f });
    }
  }

  return {
    generato: new Date().toISOString(),
    app: 'Fantatitano',
    nota: 'Export dei dati che questa app tiene su di te (art. 20 GDPR, portabilità).',
    limite: 'L\'app tiene aperta una lega alla volta: qui c\'è per intero quella aperta, '
      + 'delle altre solo nome e codice. Per averle tutte, riapri ogni lega ed esporta.',
    account: u ? {
      id: u.id,
      email: u.email || null,
      nome: p?.display_name || null,
      giudiceDati: !!p?.is_judge,
    } : null,
    legheACuiPartecipi: S.myLeagues().map((l) => ({ id: l.id, nome: l.name })),
    legaAperta: aperta ? {
      id: lega.id,
      nome: lega.name,
      squadra: {
        nome: io.teamName,
        proprietario: io.owner || null,
        colore: io.color || null,
        iniziali: io.initials || null,
        ruolo: io.role,
        crediti: io.credits,
      },
      rosa: S.rosterIds(io.id).map((id) => {
        const g = S.playersById.get(id);
        return g ? { id, nome: g.name, ruolo: g.role, club: g.clubId } : { id };
      }),
      formazioniConsegnate: formazioni,
    } : null,
  };
}

/** Lo scarica come file. Non passa da nessun server: si costruisce qui. */
export function scaricaMieiDati(documento = document) {
  const dati = mieiDati();
  const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = documento.createElement('a');
  a.href = url;
  a.download = `fantatitano-miei-dati-${new Date().toISOString().slice(0, 10)}.json`;
  documento.body.appendChild(a);
  a.click();
  a.remove();
  // Senza questo il file resta in memoria finche' non si chiude la scheda.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return dati;
}
