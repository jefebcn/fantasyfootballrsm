/**
 * La scheda da condividere: la card della giornata come immagine (formato
 * storia, src/card-giornata.js), con il link d'invito nel testo che
 * l'accompagna.
 *
 * Vale per tutte e due le leghe. Prima c'era solo lo scontro diretto, e nella
 * lega pubblica (a punti, senza avversari) il tasto «Condividi» della home
 * portava a «Nessuna partita giocata da condividere».
 */
import * as S from '../state.js';
import { fmt, icon, logo, t, esc, fotoStemma } from '../ui.js';
import { tintaLeggibile } from '../colore.js';
import { scelto } from '../personaggio.js';
import { disegnaCard } from '../card-giornata.js';

const STATI = { frozen: 'Definitivo', provisional: 'Provvisorio', live: 'In corso', partial: 'In corso' };
const posto = (n) => `${n}ª`;

/** I migliori della formazione: solo chi ha preso un voto, dal piu' alto. */
const migliori = (rows) => (rows || [])
  .filter((r) => !r.isSV && typeof r.fantaVote === 'number')
  .sort((a, b) => b.fantaVote - a.fantaVote).slice(0, 3)
  .map((r) => ({ nome: S.playersById.get(r.playerId)?.name || '', ruolo: r.role, voto: fmt(r.fantaVote), capitano: !!r.isCaptain }));

/**
 * Cosa c'e' da mettere nella card, o `{ vuota }` con il perche' non c'e'.
 * Esportata per le prove.
 */
export function datiScheda() {
  const me = S.me(); const n = S.currentMatchday(); const st = S.matchdayStatus(n);
  if (!me) return { vuota: t('Non fai parte di questa lega.') };
  if (st === 'open' || st === 'scheduled' || !S.hasData(n)) return { vuota: t('Nessuna giornata con i voti da condividere.') };
  // lega nata dopo questa giornata: non e' «non hai consegnato», e' che non c'eri ancora
  if (n < S.primaGiornata()) return { vuota: t('La tua prima giornata in questa lega è la {n}ª: la scheda arriva con i suoi voti.', { n: S.primaGiornata() }) };
  const riga = S.standings().find((r) => r.managerId === me.id);
  const { fondo, inchiostro } = tintaLeggibile(me.color);
  const base = {
    giornata: n, stato: t(STATI[st] || 'Provvisorio').toUpperCase(),
    squadra: me.teamName, allenatore: me.owner, lega: S.base.league.name,
    personaggio: scelto(me) ? `media/avatar/${scelto(me)}.webp` : null,
    stemma: { foto: fotoStemma(me.crestUrl) ? me.crestUrl : null, iniziali: me.initials, colore: fondo, inchiostro },
    testi: { giornata: t('Giornata {n}', { n }).toUpperCase(), fantapunti: t('Fantapunti'), migliori: t('I migliori'),
      invito: t('Gioca gratis con me su FANTATITANO'), vs: t('contro') },
  };

  if (S.aPunti()) {
    const mia = S.lineupResult(n, me.id);
    if (!mia) return { vuota: t('Nella {n}ª giornata non hai consegnato la formazione: la scheda torna con la prossima.', { n }) };
    // il posto nella giornata, fra chi ha consegnato
    const consegnate = S.base.managers.map((m) => S.lineupResult(n, m.id)).filter(Boolean);
    const sopra = consegnate.filter((r) => r.total > mia.total).length;
    return { ...base, punti: fmt(mia.total), sfida: null, migliori: migliori(mia.rows),
      numeri: [
        { valore: posto(sopra + 1), etichetta: t('nella giornata su {n}', { n: consegnate.length }) },
        ...(riga ? [{ valore: posto(riga.position), etichetta: t('in classifica') }] : []),
      ] };
  }

  const f = S.myFixture(n, me.id); const r = f ? S.fixtureResult(f) : null;
  if (!r || !r.played) return { vuota: t('Nessuna partita giocata da condividere.') };
  const casa = r.homeManagerId === me.id;
  const avv = S.managersById.get(casa ? r.awayManagerId : r.homeManagerId);
  const gf = casa ? r.homeGoals : r.awayGoals, gs = casa ? r.awayGoals : r.homeGoals;
  const esito = gf > gs ? t('Vittoria') : gf < gs ? t('Sconfitta') : t('Pareggio');
  return { ...base, punti: fmt(casa ? r.homeScore : r.awayScore),
    sfida: { gf, gs, avversaria: avv?.teamName || '', puntiAvversaria: fmt(casa ? r.awayScore : r.homeScore) },
    migliori: migliori((casa ? r.home : r.away)?.rows),
    numeri: [{ valore: esito.toUpperCase(), etichetta: t('Giornata {n}', { n }) },
      ...(riga ? [{ valore: posto(riga.position), etichetta: t('in classifica') }] : [])] };
}

/** Il testo che accompagna l'immagine: dove la si manda (WhatsApp) il link resta cliccabile. */
function testo(d) {
  const risultato = d.sfida
    ? `${d.squadra} ${d.sfida.gf}–${d.sfida.gs} ${d.sfida.avversaria}`
    : t('{squadra}: {p} fantapunti', { squadra: d.squadra, p: d.punti });
  return t('{risultato} nella {n}ª giornata di Fantatitano, il fantacalcio gratis del Campionato Sammarinese. Gioca con me: {link}',
    { risultato, n: d.giornata, link: S.linkInvito() });
}

let ultimo = null;   // l'indirizzo dell'immagine mostrata, da liberare alla prossima

export const scheda = {
  title: 'Scheda', appbar: 'back', sub: () => t('Scheda condivisibile'),
  serveSquadra: true,   // senza una squadra in questa lega: app.js mostra «Non fai parte di questa lega»
  render() {
    const d = datiScheda();
    if (d.vuota) return `<main class="a-body"><div class="empty">${logo()}<p>${esc(d.vuota)}</p></div></main>`;
    return `<main class="a-body card-g">
      <div class="card-g-img" id="card-g"><span class="card-g-att">${t('Preparo la tua card…')}</span></div>
      <button class="a-btn" id="share-img" disabled>${icon('share', 'ic sm')}${t('Condividi l\'immagine')}</button>
      <a class="a-btn sec" id="salva-img" hidden>${t('Salva l\'immagine')}</a>
      <p class="small muted card-g-nota" id="card-g-nota" hidden>${t('Puoi anche tenere premuto sull\'immagine per salvarla o condividerla.')}</p>
      <button class="a-btn sec" id="share">${icon('share', 'ic sm')}${t('Invia il link d\'invito')}</button>
    </main>`;
  },
  async mount(root, ctx) {
    const d = datiScheda(); if (d.vuota) return;
    const box = root.querySelector('#card-g'), btn = root.querySelector('#share-img'), salva = root.querySelector('#salva-img');
    const nome = `fantatitano-giornata-${d.giornata}.png`;

    root.querySelector('#share')?.addEventListener('click', async () => {
      const text = testo(d);
      if (navigator.share) { try { await navigator.share({ title: 'Fantatitano', text }); } catch { /* annullato */ } }
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });

    let blob;
    try { blob = await disegnaCard(d); } catch {
      box.innerHTML = `<span class="card-g-att">${t('Non sono riuscito a preparare l\'immagine.')}</span>`;
      return;
    }
    if (!box.isConnected) return;   // si e' gia' cambiata pagina
    if (ultimo) URL.revokeObjectURL(ultimo);
    ultimo = URL.createObjectURL(blob);
    box.innerHTML = `<img src="${ultimo}" alt="${esc(t('La tua card della {n}ª giornata', { n: d.giornata }))}">`;
    salva.href = ultimo; salva.download = nome;

    const file = typeof File === 'function' ? new File([blob], nome, { type: 'image/png' }) : null;
    const puoi = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    btn.disabled = !puoi;
    if (!puoi) { btn.hidden = true; salva.hidden = false; root.querySelector('#card-g-nota').hidden = false; }
    btn.addEventListener('click', async () => {
      try { await navigator.share({ files: [file], title: 'Fantatitano', text: testo(d) }); }
      catch (e) {
        if (e?.name === 'AbortError') return;
        // alcuni browser accettano il file ma non il testo insieme: si riprova col solo file
        try { await navigator.share({ files: [file] }); } catch (e2) { if (e2?.name !== 'AbortError') ctx.toast(t('Condivisione non riuscita: salva l\'immagine')); }
      }
    });
  },
};
