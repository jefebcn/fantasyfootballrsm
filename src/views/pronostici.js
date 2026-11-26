/**
 * I PRONOSTICI DELLA GIORNATA (#/pronostici, migrazione 071).
 *
 * Un gioco piccolo accanto al fantacalcio, aperto a chiunque abbia un account,
 * anche senza lega e senza rosa: per ogni partita della giornata 1, X o 2 e,
 * se vuoi, il risultato esatto. 1 punto il segno, 3 il risultato esatto.
 * Si chiude con le formazioni (lo stesso blocco della giornata) e la chiusura
 * la fa il database: dopo, un pronostico non si cambia.
 *
 * Si salva a ogni tocco, come un interruttore. Quelli degli altri non si
 * leggono mai: si vedono solo come classifica e, a giornata chiusa, come
 * percentuali. Nessun premio finché il legale non dice.
 */
import * as S from '../state.js';
import * as remote from '../backend.js';
import { esc, sec, stemmaClub, dateIt, timeIt, t } from '../ui.js';

const chiave = (n, c, o) => `${n}:${c}:${o}`;
const segnoDi = (gc, go) => (gc > go ? '1' : gc < go ? '2' : 'X');
const uid = () => S.currentUser()?.id || null;
const club = (id) => S.clubsById.get(id);
const nomeClub = (id) => club(id)?.name || id;

let st = { per: null, caricato: false, attivo: true, miei: new Map() };
let classifiche = { per: null, generale: null, lega: null }, scheda = 'generale';
const percentuali = new Map();
let caricando = false;

/** I risultati veri delle partite finite, per la classifica (contano solo le giornate chiuse). */
export function risultati() {
  const out = [];
  for (const md of S.base.matchdays) {
    for (const m of S.matchesOf(md.number)) {
      if (m.status === 'played' && m.homeGoals != null && m.awayGoals != null) out.push({ g: md.number, c: m.homeClubId, o: m.awayClubId, gc: m.homeGoals, go: m.awayGoals });
    }
  }
  return out;
}

/** Punti di un pronostico su un risultato: 0, 1 (segno) o 3 (esatto). */
export function punti(p, r) {
  if (!p || !r) return null;
  if (p.gol_casa === r.gc && p.gol_ospite === r.go) return 3;
  return p.segno === segnoDi(r.gc, r.go) ? 1 : 0;
}

const manca = (e) => /does not exist|schema cache|could not find|pronostici/i.test(e?.message || '') && !/permesso|permission/i.test(e?.message || '');

async function carica(ctx) {
  const io = uid();
  const lega = S.base.league?.id || null;
  if (!io || caricando || (st.caricato && st.per === io && classifiche.per === lega)) return;
  caricando = true;
  try {
    const [righe, gen, leg] = await Promise.all([
      remote.mieiPronostici(io),
      remote.pronosticiClassifica(risultati()),
      lega ? remote.pronosticiClassifica(risultati(), lega) : Promise.resolve(null)]);
    st = { per: io, caricato: true, attivo: true, miei: new Map(righe.map((r) => [chiave(r.matchday, r.casa, r.ospite), r])) };
    classifiche = { per: lega, generale: gen, lega: leg };
  } catch (e) {
    st = { per: io, caricato: true, attivo: !manca(e), errore: e.message, miei: new Map() };
  }
  const chiusa = ultimaChiusa();
  if (chiusa && !percentuali.has(chiusa)) {
    try { percentuali.set(chiusa, new Map((await remote.pronosticiPercentuali(chiusa)).map((r) => [`${r.casa}:${r.ospite}`, r]))); } catch { percentuali.set(chiusa, new Map()); }
  }
  caricando = false;
  ctx.render();
}

/** La giornata su cui si pronostica: la stessa delle formazioni. */
function aperta() {
  const n = S.giornataDaSchierare(); const md = S.matchday(n);
  if (!md || Date.now() >= new Date(md.lockAt)) return null;
  return { n, lockAt: new Date(md.lockAt) };
}
/** L'ultima giornata già chiusa, per vedere com'è andata. */
function ultimaChiusa() {
  const chiuse = S.base.matchdays.filter((md) => Date.now() >= new Date(md.lockAt)).map((md) => md.number);
  return chiuse.length ? Math.max(...chiuse) : null;
}

const golScelta = (m, lato, valore) => `<select class="pr-gol" data-gol="${lato}" data-m="${esc(m.id)}" aria-label="${esc(t('Gol di {squadra}', { squadra: nomeClub(lato === 'c' ? m.homeClubId : m.awayClubId) }))}">
  <option value="">–</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i}"${valore === i ? ' selected' : ''}>${i}</option>`).join('')}</select>`;

// Il risultato esatto compare solo dopo il segno, e chiuso: «+ risultato
// esatto» lo apre (ritocchi del 26/11, prima la riga si ripeteva in ogni
// partita). Se c'e' gia' un risultato resta aperto.
const aperti = new Set();
const aCapo = (nome) => esc(nome).replace(/\//g, '/<wbr>');
function esatto(m, p) {
  if (!p) return '';
  if (p.gol_casa == null && !aperti.has(String(m.id))) return `<button class="pr-piu" data-piu="${esc(m.id)}">+ ${t('risultato esatto')}</button>`;
  return `<div class="pr-esatto small muted">${t('Risultato esatto')} ${golScelta(m, 'c', p.gol_casa ?? null)} <span>-</span> ${golScelta(m, 'o', p.gol_ospite ?? null)}</div>`;
}

function partita(n, m) {
  const p = st.miei.get(chiave(n, m.homeClubId, m.awayClubId));
  const tasto = (s, nome) => `<button class="pr-s${p?.segno === s ? ' on' : ''}" data-segno="${s}" data-m="${esc(m.id)}" aria-pressed="${p?.segno === s}" aria-label="${esc(nome)}">${s}</button>`;
  return `<div class="a-card pr-partita">
    <div class="pr-squadre"><span>${stemmaClub(club(m.homeClubId), 'sm')}<b>${aCapo(nomeClub(m.homeClubId))}</b></span><span class="pr-ora small muted">${m.kickoffAt ? `${dateIt(m.kickoffAt)}<br>${timeIt(m.kickoffAt)}` : ''}</span><span>${stemmaClub(club(m.awayClubId), 'sm')}<b>${aCapo(nomeClub(m.awayClubId))}</b></span></div>
    <div class="pr-segni" role="group" aria-label="${esc(t('Pronostico'))}">${tasto('1', t('vince {squadra}', { squadra: nomeClub(m.homeClubId) }))}${tasto('X', t('pareggio'))}${tasto('2', t('vince {squadra}', { squadra: nomeClub(m.awayClubId) }))}</div>
    ${esatto(m, p)}
  </div>`;
}

function giornataChiusa(n) {
  const ris = new Map(risultati().filter((r) => r.g === n).map((r) => [`${r.c}:${r.o}`, r]));
  const perc = percentuali.get(n) || new Map();
  let fatti = 0;
  const gare = S.matchesOf(n);
  if (!gare.some((m) => st.miei.has(chiave(n, m.homeClubId, m.awayClubId)))) {
    return `<p class="pr-saltata small muted">${t('Non hai giocato la giornata {n}', { n })}</p>`;
  }
  const righe = gare.map((m) => {
    const k = `${m.homeClubId}:${m.awayClubId}`;
    const p = st.miei.get(chiave(n, m.homeClubId, m.awayClubId)); const r = ris.get(k); const pt = punti(p, r);
    if (pt) fatti += pt;
    const q = perc.get(k);
    const barra = q?.totale ? `<div class="pr-perc" aria-label="${esc(t('Come hanno pronosticato tutti'))}">${[['1', q.uno], ['X', q.ics], ['2', q.due]].map(([s, v]) => `<span style="flex:${v || 0.0001}"${p?.segno === s ? ' class="mio"' : ''}>${s} ${Math.round((v / q.totale) * 100)}%</span>`).join('')}</div>` : '';
    return `<div class="pr-riga"><span class="pr-match">${esc(nomeClub(m.homeClubId))} <b class="num">${r ? `${r.gc}-${r.go}` : '—'}</b> ${esc(nomeClub(m.awayClubId))}</span>
      <span class="pr-mio">${p ? `${esc(p.segno)}${p.gol_casa != null ? ` · ${p.gol_casa}-${p.gol_ospite}` : ''}` : t('nessuno')}</span>
      <span class="pr-pt num${pt ? ' si' : ''}">${pt == null ? (p && !r ? t('in attesa') : '') : `+${pt}`}</span>${barra}</div>`;
  }).join('');
  return `${sec(t('Giornata {n}', { n }), t('i tuoi punti: {p}', { p: fatti }))}<div class="a-card pr-chiusa">${righe}</div>`;
}

function classifica() {
  const lista = scheda === 'lega' ? classifiche.lega : classifiche.generale;
  const corpo = lista === null ? `<p class="small muted">${t('Carico…')}</p>`
    : !lista.length ? `<p class="small muted">${t('La classifica parte dalla prima giornata chiusa con un risultato.')}</p>`
    : lista.map((r) => `<div class="pr-cl${r.mio ? ' mio' : ''}"><span class="num pos">${r.posto}</span><b>${esc(r.nome)}</b><span class="small muted">${r.esatti === 1 ? t('1 esatto') : t('{e} esatti', { e: r.esatti })}</span><span class="num pt">${r.punti}</span></div>`).join('');
  const schede = S.base.league?.id ? `<div class="segwrap"><div class="seg seg-cls" role="tablist">
    <button class="${scheda === 'generale' ? 'on' : ''}" data-scheda="generale" role="tab">${t('Tutti')}</button>
    <button class="${scheda === 'lega' ? 'on' : ''}" data-scheda="lega" role="tab">${t('La tua lega')}</button></div></div>` : '';
  return `${sec(t('Classifica dei pronostici'), t('segno 1, esatto 3'))}${schede}<div class="a-card pr-classifica">${corpo}</div>`;
}

export const pronostici = {
  title: 'Pronostici', appbar: 'back', testata: () => t('Pronostici'),
  sub: () => { const a = aperta(); return a ? t('Giornata {n} · chiude {quando}', { n: a.n, quando: `${dateIt(a.lockAt)} ${timeIt(a.lockAt)}` }) : t('1 X 2 sulle partite del campionato'); },
  render() {
    if (st.per !== uid()) st = { per: null, caricato: false, attivo: true, miei: new Map() };
    if (st.caricato && !st.attivo) return `<main class="a-body"><div class="a-card"><p>${t('I pronostici arrivano a breve.')}</p></div></main>`;
    const a = aperta(); const chiusa = ultimaChiusa();
    const gare = a ? S.matchesOf(a.n) : [];
    const fatti = a ? gare.filter((m) => st.miei.has(chiave(a.n, m.homeClubId, m.awayClubId))).length : 0;
    return `<main class="a-body pronostici">
      <p class="pr-intro">${t('<b>1</b> casa, <b>X</b> pari, <b>2</b> fuori · segno 1 punto, esatto 3')}</p>
      ${a ? `${sec(t('Giornata {n}', { n: a.n }), st.caricato ? t('{f} su {t}', { f: fatti, t: gare.length }) : '')}
        ${gare.map((m) => partita(a.n, m)).join('')}` : `<div class="a-card"><p class="small muted">${t('Nessuna giornata aperta: il campionato è finito.')}</p></div>`}
      ${chiusa && st.caricato ? giornataChiusa(chiusa) : ''}
      ${classifica()}
    </main>`;
  },
  mount(root, ctx) {
    carica(ctx);
    const a = aperta(); if (!a) return;
    const gare = new Map(S.matchesOf(a.n).map((m) => [String(m.id), m]));
    const salva = async (m, riga) => {
      const k = chiave(a.n, m.homeClubId, m.awayClubId); const prima = st.miei.get(k);
      if (riga) st.miei.set(k, riga); else st.miei.delete(k);
      ctx.render();
      try {
        if (riga) await remote.salvaPronostico({ user_id: uid(), ...riga });
        else await remote.togliPronostico(uid(), a.n, m.homeClubId, m.awayClubId);
      } catch (e) {
        if (prima) st.miei.set(k, prima); else st.miei.delete(k);
        ctx.toast(Date.now() >= a.lockAt ? t('La giornata si è chiusa: il pronostico non si cambia più.') : e.message);
        ctx.render();
      }
    };
    const base = (m) => ({ matchday: a.n, casa: m.homeClubId, ospite: m.awayClubId });
    root.querySelectorAll('[data-segno]').forEach((b) => b.addEventListener('click', () => {
      const m = gare.get(b.dataset.m); if (!m) return;
      const p = st.miei.get(chiave(a.n, m.homeClubId, m.awayClubId)); const s = b.dataset.segno;
      if (p?.segno === s) { salva(m, null); return; }   // ritoccare lo stesso segno lo toglie
      // il risultato esatto resta solo se dice lo stesso del segno nuovo
      const tiene = p?.gol_casa != null && segnoDi(p.gol_casa, p.gol_ospite) === s;
      salva(m, { ...base(m), segno: s, gol_casa: tiene ? p.gol_casa : null, gol_ospite: tiene ? p.gol_ospite : null });
    }));
    root.querySelectorAll('[data-gol]').forEach((x) => x.addEventListener('change', () => {
      const m = gare.get(x.dataset.m); if (!m) return;
      const scelte = root.querySelectorAll(`[data-m="${CSS.escape(x.dataset.m)}"][data-gol]`);
      const [gc, go] = [...scelte].map((y) => (y.value === '' ? null : Number(y.value)));
      const p = st.miei.get(chiave(a.n, m.homeClubId, m.awayClubId));
      if (gc != null && go != null) salva(m, { ...base(m), segno: segnoDi(gc, go), gol_casa: gc, gol_ospite: go });
      else if (gc == null && go == null && p?.gol_casa != null) salva(m, { ...p, gol_casa: null, gol_ospite: null });
      // con un solo numero si aspetta l'altro
    }));
    root.querySelectorAll('[data-piu]').forEach((b) => b.addEventListener('click', () => {
      aperti.add(b.dataset.piu); ctx.render();
      root.querySelector(`[data-gol="c"][data-m="${CSS.escape(b.dataset.piu)}"]`)?.focus();
    }));
    root.querySelectorAll('[data-scheda]').forEach((b) => b.addEventListener('click', () => { scheda = b.dataset.scheda; ctx.render(); }));
  },
};

/** Per le prove: si riparte da zero. */
export function azzera() { st = { per: null, caricato: false, attivo: true, miei: new Map() }; classifiche = { per: null, generale: null, lega: null }; percentuali.clear(); aperti.clear(); scheda = 'generale'; }
