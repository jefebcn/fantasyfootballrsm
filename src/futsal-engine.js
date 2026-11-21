/**
 * Motore di punteggio del FantaFutsal.
 * Funzioni pure: nessuno stato, nessuna chiamata esterna.
 * Riferimenti: FUTSAL.md §§ 3-8 (voti) e § 13 (rosa, schemi e mercato in stile
 * Dunkest, dal 29/10/2026).
 *
 * Il referto FSGC del futsal non dice chi e' entrato in campo: tutti i
 * convocati stanno sotto «Titolari» e i cambi non ci sono. Quindi prende il
 * voto chi e' in distinta (§ 6), e i portieri si comprano insieme come
 * «Porta» della squadra (§ 5).
 */

export const REGOLE_FUTSAL = {
  versione: '2.0.0',
  voto: 6,
  esito: { vittoria: 0.5, pareggio: 0, sconfitta: -0.5 },
  gol: 3,
  autogol: -1,
  ammonizione: -0.5,
  espulsione: -1,
  rigoreSbagliato: -3,
  golSubito: -0.5,
  portaInviolata: 3,
  bonusDifesa: { punti: 2, soglia: 7.0, schema: '3-1' },
  // La rosa, come in Dunkest (FUTSAL.md § 13): la Porta fa da «coach», poi
  // otto giocatori di movimento. In campo ne vanno quattro, uno e' il sesto
  // uomo e gli altri tre stanno in panchina.
  rosa: { D: 4, A: 4 },
  schemi: { '1-3': { D: 1, A: 3 }, '2-2': { D: 2, A: 2 }, '3-1': { D: 3, A: 1 } },
  perClub: 2,
  capitano: 1.5,
  sesto: 1,
  panchina: 0.5,
  budget: 70,
  cambiGratis: 1,
  malusCambio: 1,
};

/** Dal ruolo che la FSGC scrive in distinta al ruolo di gioco (§ 4). */
export const RUOLO_GIOCO = { Portiere: 'P', Centrale: 'D', Laterale: 'D', Pivot: 'A', Universale: 'A' };

const r2 = (n) => Math.round(n * 100) / 100;

function esito(golFatti, golSubiti, R) {
  if (golFatti > golSubiti) return { valore: R.esito.vittoria, nota: 'vittoria' };
  if (golFatti < golSubiti) return { valore: R.esito.sconfitta, nota: 'sconfitta' };
  return { valore: R.esito.pareggio, nota: 'pareggio' };
}

/**
 * La partita di un club in una giornata, dal suo lato: null se riposa o non
 * ha referto. Con un id giocatore, prima si cerca la distinta in cui c'e':
 * chi cambia squadra a stagione in corso (Lotti, dalla Juvenes alla Virtus)
 * gioca per la squadra della distinta, non per quella del listone.
 */
export function partitaDi(referti, club, id = null) {
  for (const ref of id ? referti : []) {
    const lato = ref.distinte.findIndex((d) => d.includes(id));
    if (lato >= 0) return { ref, lato, avversario: lato === 0 ? ref.ospite : ref.casa };
  }
  const ref = referti.find((x) => x.casa === club || x.ospite === club);
  if (!ref) return null;
  const lato = ref.casa === club ? 0 : 1;
  return { ref, lato, avversario: lato === 0 ? ref.ospite : ref.casa };
}

/**
 * Gol fatti e subiti contati dagli eventi del referto: i gol del club piu'
 * gli autogol dell'avversario. Il lato di chi segna si prende dalla distinta
 * di quella partita, e solo se non c'e' dal listone (vedi partitaDi). Il
 * referto completo li ha sempre uguali al risultato (42 partite su 42 alla 6ª).
 */
function golDi(ref, lato, clubDi) {
  const mio = lato === 0 ? ref.casa : ref.ospite;
  const latoDi = (id) => { const i = ref.distinte.findIndex((d) => d.includes(id)); return i >= 0 ? i : (clubDi(id) === mio ? lato : 1 - lato); };
  let fatti = 0, subiti = 0;
  for (const [id, , tipo] of ref.eventi) {
    const nostro = latoDi(id) === lato;
    if (tipo === 'goal') { if (nostro) fatti++; else subiti++; }
    if (tipo === 'own_goal') { if (nostro) subiti++; else fatti++; }
  }
  return { fatti, subiti };
}

function eventiPersonali(eventiSuoi, R) {
  const voci = [];
  const conta = (t) => eventiSuoi.filter((e) => e[2] === t).length;
  const aggiungi = (etichetta, n, unita) => { if (n) voci.push({ etichetta: n > 1 ? `${etichetta} × ${n}` : etichetta, valore: r2(n * unita) }); };
  aggiungi('Gol', conta('goal'), R.gol);
  aggiungi('Autogol', conta('own_goal'), R.autogol);
  aggiungi('Rigore sbagliato', conta('pen_missed'), R.rigoreSbagliato);
  aggiungi('Ammonizione', conta('yellow'), R.ammonizione);
  aggiungi('Espulsione', conta('red'), R.espulsione);
  return voci;
}

const somma = (voci) => r2(voci.reduce((s, v) => s + v.valore, 0));

/**
 * Voto di un giocatore di movimento nella giornata.
 * giocatore: { id, club }. clubDi: id -> club (per gli eventi degli avversari).
 * Ritorna { sv, motivo } oppure { sv:false, base, bonus, totale, voci }.
 * «base» e' voto + esito; «bonus» sono gli eventi personali, che il capitano raddoppia.
 */
export function votoGiocatore(giocatore, referti, clubDi, R = REGOLE_FUTSAL) {
  const p = partitaDi(referti, giocatore.club, giocatore.id);
  if (!p) return { sv: true, motivo: 'la squadra non gioca' };
  if (!p.ref.distinte[p.lato].includes(giocatore.id)) return { sv: true, motivo: 'non in distinta' };
  const g = golDi(p.ref, p.lato, clubDi);
  const e = esito(g.fatti, g.subiti, R);
  const voci = [{ etichetta: 'Convocato', valore: R.voto }, { etichetta: `Esito · ${e.nota}`, valore: e.valore }];
  const personali = eventiPersonali(p.ref.eventi.filter((x) => x[0] === giocatore.id), R);
  const base = r2(R.voto + e.valore), bonus = somma(personali);
  return { sv: false, base, bonus, totale: r2(base + bonus), voci: [...voci, ...personali] };
}

/**
 * Voto della Porta di un club (§ 5): voto, esito, gol subiti, porta inviolata
 * e gli eventi personali di tutti i portieri di quel club in distinta.
 * ruoloDi: id -> ruolo FSGC, per riconoscere i portieri.
 */
export function votoPorta(club, referti, clubDi, ruoloDi, R = REGOLE_FUTSAL) {
  const p = partitaDi(referti, club);
  if (!p) return { sv: true, motivo: 'la squadra non gioca' };
  const g = golDi(p.ref, p.lato, clubDi);
  const e = esito(g.fatti, g.subiti, R);
  const voci = [{ etichetta: 'Voto', valore: R.voto }, { etichetta: `Esito · ${e.nota}`, valore: e.valore }];
  const difesa = [];
  if (g.subiti) difesa.push({ etichetta: `Gol subiti × ${g.subiti}`, valore: r2(g.subiti * R.golSubito) });
  else difesa.push({ etichetta: 'Porta inviolata', valore: R.portaInviolata });
  const portieri = new Set(p.ref.distinte[p.lato].filter((id) => ruoloDi(id) === 'Portiere'));
  const personali = eventiPersonali(p.ref.eventi.filter((x) => portieri.has(x[0])), R);
  const base = r2(R.voto + e.valore), bonus = r2(somma(difesa) + somma(personali));
  return { sv: false, base, bonus, totale: r2(base + bonus), voci: [...voci, ...difesa, ...personali] };
}

/** Il ruolo di un posto della rosa: 'D' o 'A' (dal listone). */
const nelRuolo = (x, r) => x && x.ruolo === r;

/**
 * Controlla rosa e formazione (§§ 13.1-13.3).
 * f: { porta: club, D: [{id, club, ruolo}] ×4, A: [...] ×4, schema, titolari: [id] ×4, sesto: id, capitano, vice }
 * Ritorna l'elenco dei problemi, vuoto se va bene. I crediti si controllano a
 * parte (src/futsal-valori.js), perche' dipendono dalla giornata.
 */
export function controllaFormazione(f, R = REGOLE_FUTSAL) {
  const errori = [];
  if (!f.porta) errori.push('Manca la porta');
  for (const r of ['D', 'A']) {
    const n = (f[r] || []).filter((x) => nelRuolo(x, r)).length;
    if (n !== R.rosa[r]) errori.push(`Servono ${R.rosa[r]} ${r === 'D' ? 'difensori' : 'attaccanti'} in rosa (ora ${n})`);
  }
  const rosa = [...(f.D || []), ...(f.A || [])].filter(Boolean);
  const ids = rosa.map((x) => x.id);
  if (new Set(ids).size !== ids.length) errori.push('Un giocatore compare due volte');
  const club = new Map();
  for (const c of [f.porta, ...rosa.map((x) => x.club)].filter(Boolean)) club.set(c, (club.get(c) || 0) + 1);
  if ([...club.values()].some((n) => n > R.perClub)) errori.push(`Al massimo ${R.perClub} per squadra, Porta compresa`);
  const s = R.schemi[f.schema];
  if (!s) return [...errori, 'Schema non valido'];
  const tit = (f.titolari || []).map((id) => rosa.find((x) => x.id === id));
  if (tit.length !== 4 || tit.some((x) => !x)) errori.push('In campo vanno quattro giocatori della rosa');
  else for (const r of ['D', 'A']) { const n = tit.filter((x) => x.ruolo === r).length; if (n !== s[r]) errori.push(`Con il ${f.schema} in campo vanno ${s[r]} ${r === 'D' ? (s[r] === 1 ? 'difensore' : 'difensori') : (s[r] === 1 ? 'attaccante' : 'attaccanti')}`); }
  if (!f.sesto || !ids.includes(f.sesto) || (f.titolari || []).includes(f.sesto)) errori.push('Scegli il sesto uomo fra chi non è in campo');
  if (!f.capitano || !(f.titolari || []).includes(f.capitano)) errori.push('Scegli il capitano fra i quattro in campo');
  if (!f.vice || !(f.titolari || []).includes(f.vice)) errori.push('Scegli il vice fra i quattro in campo');
  else if (f.vice === f.capitano) errori.push('Capitano e vice devono essere due giocatori diversi');
  return errori;
}

/** La panchina: chi e' in rosa ma non in campo e non e' il sesto uomo, nell'ordine della rosa. */
export const panchinaDi = (f) => [...(f.D || []), ...(f.A || [])].filter((x) => x && !(f.titolari || []).includes(x.id) && x.id !== f.sesto);

/**
 * Punteggio di una formazione nella giornata (§§ 13.4-13.6).
 * voti: { porta: voto della Porta, giocatori: Map id -> voto } (da votoGiocatore/votoPorta;
 * chi riposa arriva con { riposo: true } e la sua media, src/futsal.js).
 * opz.malus: i punti tolti per i cambi di mercato oltre quelli gratis.
 * Ritorna { totale, righe, bonusDifesa, capitano, malus }: una riga per Porta,
 * quattro in campo, sesto uomo e panchina, ognuna con peso e punti.
 */
export function punteggioFormazione(f, voti, { malus = 0 } = {}, R = REGOLE_FUTSAL) {
  const sv = { sv: true, motivo: 'senza voto' };
  const di = (id) => voti.giocatori.get(id) || sv;
  const rosa = [...(f.D || []), ...(f.A || [])].filter(Boolean);
  const chi = (id) => rosa.find((x) => x.id === id);
  const panchina = panchinaDi(f);
  const libera = panchina.filter((b) => !di(b.id).sv);
  const righe = [{ posto: 'P', id: null, club: f.porta, voto: voti.porta || sv, peso: 1, entrato: null }];
  for (const id of f.titolari) {
    const t = chi(id);
    let voto = di(id), entrato = null;
    if (voto.sv) {
      // Il primo della panchina nello stesso ruolo, se ha il voto: entra al
      // 100% e non porta la fascia. Il sesto uomo conta gia' per intero.
      const i = libera.findIndex((b) => b.ruolo === t.ruolo);
      if (i >= 0) { entrato = libera[i]; voto = di(entrato.id); libera.splice(i, 1); }
    }
    righe.push({ posto: t.ruolo, id, club: t.club, voto, peso: 1, entrato });
  }
  const sesto = chi(f.sesto);
  righe.push({ posto: 'S', id: f.sesto, club: sesto?.club, ruolo: sesto?.ruolo, voto: di(f.sesto), peso: R.sesto, entrato: null });
  const entrati = new Set(righe.map((r) => r.entrato?.id).filter(Boolean));
  for (const b of panchina) righe.push({ posto: 'B', id: b.id, club: b.club, ruolo: b.ruolo, voto: di(b.id), peso: entrati.has(b.id) ? 0 : R.panchina, entrato: null, usato: entrati.has(b.id) });
  // Capitano, e se non gioca il vice. Chi riposa prende la media ma non la
  // fascia, come in Dunkest; chi entra dalla panchina nemmeno.
  const gioca = (id) => righe.find((r) => r.id === id && r.peso === 1 && !r.entrato && !r.voto.sv && !r.voto.riposo);
  const fascia = gioca(f.capitano) ? f.capitano : gioca(f.vice) ? f.vice : null;
  let totale = 0;
  for (const r of righe) {
    r.punti = r.voto.sv ? 0 : r2(r.voto.totale * r.peso);
    if (fascia && r.id === fascia && r.posto !== 'S' && r.posto !== 'B') { r.capitano = true; r.punti = r2(r.voto.totale * R.capitano); }
    totale += r.punti;
  }
  let bonusDifesa = null;
  if (f.schema === R.bonusDifesa.schema) {
    const quali = righe.filter((r) => r.posto === 'P' || r.posto === 'D');
    const media = r2(quali.reduce((s, r) => s + r.punti, 0) / quali.length);
    bonusDifesa = { media, preso: media >= R.bonusDifesa.soglia, punti: media >= R.bonusDifesa.soglia ? R.bonusDifesa.punti : 0 };
    totale += bonusDifesa.punti;
  }
  return { totale: r2(totale - malus), righe, bonusDifesa, capitano: fascia, malus };
}
