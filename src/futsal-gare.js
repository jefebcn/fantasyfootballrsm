/**
 * Le competizioni del FantaFutsal (FUTSAL.md § 10): classifica generale,
 * leghe di amici (a somma o testa a testa) e coppa in tre fasi.
 * Funzioni pure: tutto quello che serve entra dagli argomenti.
 *
 * punti(giornata, id): i fantapunti di quell'iscritto nella giornata, 0 se
 * non ha consegnato, null se la giornata non ha ancora punteggi. Chi lo
 * fornisce decide come si calcola (src/views/futsal.js usa il motore).
 */

const r2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- classifiche a somma

/**
 * Classifica a somma dei punti (§ 10.1): totale, poi media sulle giornate
 * consegnate, poi miglior giornata, seconda migliore, e cosi' via.
 */
export function classificaSomma(ids, giornate, punti) {
  const righe = ids.map((id) => {
    const p = giornate.map((g) => punti(g, id)).filter((x) => x != null);
    const consegnate = p.filter((x) => x > 0);
    return { id, totale: r2(p.reduce((s, x) => s + x, 0)), giornate: consegnate.length,
      media: consegnate.length ? r2(consegnate.reduce((s, x) => s + x, 0) / consegnate.length) : 0,
      migliori: [...p].sort((a, b) => b - a) };
  });
  return righe.sort((a, b) => b.totale - a.totale || b.media - a.media || confrontaMigliori(a.migliori, b.migliori) || (a.id < b.id ? -1 : 1))
    .map((r, i) => ({ ...r, posto: i + 1 }));
}
function confrontaMigliori(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (b[i] || 0) - (a[i] || 0); if (d) return d; }
  return 0;
}

// ---------------------------------------------------------------- scontri

/** Girone all'italiana col metodo del cerchio: n-1 turni (n se dispari, con un riposo a turno). */
export function girone(ids) {
  const t = ids.length % 2 ? [...ids, null] : [...ids];
  const n = t.length, turni = [];
  for (let k = 0; k < n - 1; k++) {
    const coppie = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      coppie.push(k % 2 && i === 0 ? [b, a] : [a, b]);
    }
    turni.push(coppie);
    t.splice(1, 0, t.pop());
  }
  return turni;
}

/** Esito di uno scontro: 3 punti a chi fa di piu', 1 a testa a punteggio uguale. */
function esito(pa, pb) { return pa > pb ? [3, 0] : pa < pb ? [0, 3] : [1, 1]; }

/**
 * Classifica di un girone o di una lega testa a testa (§ 10.2): punti, poi
 * differenza, poi punti fatti, poi l'ordine di partenza (al posto del sorteggio).
 * turni: [{ giornata, coppie: [[a, b]] }] — b nullo vuol dire riposo, o
 * contro la media se mediaAlRiposo.
 */
export function classificaScontri(ids, turni, punti, { mediaAlRiposo = false } = {}) {
  const t = new Map(ids.map((id, i) => [id, { id, ordine: i, punti: 0, giocate: 0, vinte: 0, pari: 0, perse: 0, fatti: 0, subiti: 0 }]));
  const partite = [];
  for (const { giornata, coppie } of turni) {
    const presenti = ids.map((id) => punti(giornata, id));
    if (presenti.every((x) => x == null)) { partite.push({ giornata, sfide: coppie.map(([a, b]) => ({ a, b, pa: null, pb: null })) }); continue; }
    const media = r2(presenti.reduce((s, x) => s + (x || 0), 0) / ids.length);
    const sfide = [];
    for (const [a, b] of coppie) {
      const pa = a ? punti(giornata, a) ?? 0 : null;
      const pb = b ? punti(giornata, b) ?? 0 : (mediaAlRiposo ? media : null);
      sfide.push({ a, b, pa, pb, media: !b && mediaAlRiposo });
      if (pa == null || pb == null) continue;
      const [ea, eb] = esito(pa, pb);
      for (const [id, e, f, s] of [[a, ea, pa, pb], [b, eb, pb, pa]]) {
        const x = id && t.get(id); if (!x) continue;
        x.punti += e; x.giocate++; x.fatti = r2(x.fatti + f); x.subiti = r2(x.subiti + s);
        if (e === 3) x.vinte++; else if (e === 1) x.pari++; else x.perse++;
      }
    }
    partite.push({ giornata, sfide });
  }
  const classifica = [...t.values()].sort((a, b) => b.punti - a.punti || (b.fatti - b.subiti) - (a.fatti - a.subiti) || b.fatti - a.fatti || a.ordine - b.ordine)
    .map((r, i) => ({ ...r, posto: i + 1 }));
  return { classifica, partite };
}

/** Il calendario di una lega testa a testa dalla giornata di avvio alla 30ª, ripetendo il girone. */
export function calendarioTesta(membri, avvio, ultima = 30) {
  const g = girone(membri), turni = [];
  for (let n = avvio, k = 0; n <= ultima; n++, k++) turni.push({ giornata: n, coppie: g[k % g.length] });
  return turni;
}

// ---------------------------------------------------------------- coppa

export const COPPA = { preliminari: [9, 14], gironi: [15, 20], finale: 27 };

/** Sorteggio ripetibile: lo stesso seme da' a tutti i telefoni lo stesso ordine. */
export function mescola(ids, seme) {
  let h = 1779033703;
  for (const c of String(seme)) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  const rnd = () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Il formato secondo gli iscritti (§ 10.2). */
export function formatoCoppa(n) {
  if (n >= 50) return { nome: 'completo', preliminari: true, passanoPerGirone: 16 };
  if (n >= 24) return { nome: 'medio', preliminari: true, passanoPerGirone: 8 };
  if (n >= 8) return { nome: 'ridotto', preliminari: false };
  return null;
}

const giornateDa = ([da, a]) => Array.from({ length: a - da + 1 }, (_, i) => da + i);
const finita = (giornate, punti, ids) => giornate.every((g) => ids.some((id) => punti(g, id) != null));

/** Ordine standard del tabellone: 1 e 2 si incontrano solo in finale. */
export function posizioniTabellone(n) {
  let p = [1];
  while (p.length < n) { const m = p.length * 2 + 1; p = p.flatMap((x) => [x, m - x]); }
  return p;
}
const NOMI_TURNO = { 16: 'Ottavi', 8: 'Quarti', 4: 'Semifinali', 2: 'Finale' };

/**
 * La coppa intera, fin dove i punteggi la fanno arrivare.
 * ids: gli iscritti ammessi (chi c'era alla chiusura della 9ª), in ordine qualunque.
 */
export function coppa(ids, punti, seme = 'futsal-2026') {
  const formato = formatoCoppa(ids.length);
  if (!formato) return { formato: null, iscritti: ids.length };
  const ordine = mescola([...ids].sort(), seme);
  const out = { formato, iscritti: ids.length, preliminari: null, gironi: null, tabellone: [], campione: null };

  // fase 1 — gironi preliminari A e B, sei turni contro avversari diversi
  let qualificati = ordine;
  if (formato.preliminari) {
    const gA = ordine.filter((_, i) => i % 2 === 0), gB = ordine.filter((_, i) => i % 2 === 1);
    const g9 = giornateDa(COPPA.preliminari);
    out.preliminari = [['A', gA], ['B', gB]].map(([nome, membri]) => {
      const turni = girone(membri).slice(0, g9.length).map((coppie, k) => ({ giornata: g9[k], coppie }));
      return { nome, ...classificaScontri(membri, turni, punti, { mediaAlRiposo: true }) };
    });
    if (!finita(g9, punti, ordine)) return out;
    const [A, B] = out.preliminari.map((x) => x.classifica.slice(0, formato.passanoPerGirone).map((r) => r.id));
    qualificati = A.flatMap((id, i) => [id, B[i]]);
  }

  // fase 2 — gironi da quattro (da cinque nel formato ridotto, se avanzano squadre)
  const nGironi = Math.floor(qualificati.length / 4);
  const gironi = Array.from({ length: nGironi }, () => []);
  qualificati.forEach((id, i) => {
    const fascia = Math.floor(i / nGironi), pos = i % nGironi;
    gironi[Math.min(fascia % 2 ? nGironi - 1 - pos : pos, nGironi - 1)].push(id);
  });
  const g15 = giornateDa(COPPA.gironi);
  out.gironi = gironi.map((membri, k) => {
    const andata = girone(membri);
    const turni = (membri.length === 4 ? [...andata, ...andata.map((c) => c.map(([a, b]) => [b, a]))] : andata)
      .slice(0, g15.length).map((coppie, i) => ({ giornata: g15[i], coppie }));
    return { nome: String(k + 1), ...classificaScontri(membri, turni, punti) };
  });
  if (!finita(g15, punti, qualificati)) return out;

  // fase 3 — eliminazione diretta: prime, poi le migliori seconde, fino alla potenza di due
  let posti = 2; while (posti * 2 <= nGironi * 2) posti *= 2;
  const perPosto = (p) => out.gironi.map((g) => g.classifica[p]).filter(Boolean)
    .sort((a, b) => b.punti - a.punti || (b.fatti - b.subiti) - (a.fatti - a.subiti) || b.fatti - a.fatti);
  const teste = [...perPosto(0), ...perPosto(1), ...perPosto(2)].slice(0, posti).map((r) => r.id);
  let inGara = posizioniTabellone(posti).map((s) => teste[s - 1]);
  const seme_ = new Map(teste.map((id, i) => [id, i]));
  let giornata = COPPA.finale - 2 * (Math.log2(posti) - 1);
  while (inGara.length >= 2) {
    const finale = inGara.length === 2;
    const g = finale ? [COPPA.finale] : [giornata, giornata + 1];
    const sfide = [];
    for (let i = 0; i < inGara.length; i += 2) {
      const [a, b] = [inGara[i], inGara[i + 1]];
      const gare = g.map((n) => [punti(n, a), punti(n, b)]);
      const decisa = gare.every(([x, y]) => x != null && y != null);
      let vincente = null;
      if (decisa) {
        const ta = gare.reduce((s, x) => s + x[0], 0), tb = gare.reduce((s, x) => s + x[1], 0);
        const [ra, rb] = gare.at(-1);
        vincente = ta !== tb ? (ta > tb ? a : b) : ra !== rb ? (ra > rb ? a : b) : (seme_.get(a) < seme_.get(b) ? a : b);
      }
      sfide.push({ a, b, gare, vincente });
    }
    out.tabellone.push({ nome: NOMI_TURNO[inGara.length] || `Turno a ${inGara.length}`, giornate: g, sfide });
    if (sfide.some((s) => !s.vincente)) break;
    inGara = sfide.map((s) => s.vincente);
    if (inGara.length === 1) out.campione = inGara[0];
    giornata += 2;
  }
  return out;
}
