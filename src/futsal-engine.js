/**
 * Motore di punteggio del FantaFutsal.
 * Funzioni pure: nessuno stato, nessuna chiamata esterna.
 * Riferimenti: FUTSAL.md §§ 3-8 (regolamento deciso il 25/10/2026).
 *
 * Il referto FSGC del futsal non dice chi e' entrato in campo: tutti i
 * convocati stanno sotto «Titolari» e i cambi non ci sono. Quindi prende il
 * voto chi e' in distinta (§ 6), e i portieri si comprano insieme come
 * «Porta» della squadra (§ 5).
 */

export const REGOLE_FUTSAL = {
  versione: '1.0.0',
  voto: 6,
  esito: { vittoria: 0.5, pareggio: 0, sconfitta: -0.5 },
  gol: 3,
  autogol: -1,
  ammonizione: -0.5,
  espulsione: -1,
  rigoreSbagliato: -3,
  golSubito: -0.5,
  portaInviolata: 3,
  bonusDifesa: { punti: 2, soglia: 7.0, modulo: '3-1' },
  moduli: { '2-2': { D: 2, A: 2 }, '3-1': { D: 3, A: 1 } },
  panchina: ['D', 'A'],
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

/**
 * Controlla una formazione (§§ 3-4, 8).
 * f: { modulo, porta: club, titolari: [{id, club, ruolo}], panchina: [{id, club, ruolo}], capitano, vice }
 * Ritorna l'elenco dei problemi, vuoto se va bene.
 */
export function controllaFormazione(f, R = REGOLE_FUTSAL) {
  const errori = [];
  const m = R.moduli[f.modulo];
  if (!m) return ['Modulo non valido'];
  if (!f.porta) errori.push('Manca la porta');
  const per = (r) => (f.titolari || []).filter((x) => x?.ruolo === r).length;
  for (const r of ['D', 'A']) if (per(r) !== m[r]) errori.push(`Servono ${m[r]} ${r === 'D' ? 'difensori' : 'attaccanti'} (ora ${per(r)})`);
  const panchina = (f.panchina || []).filter(Boolean);
  for (const r of R.panchina) if (panchina.filter((x) => x.ruolo === r).length !== 1) errori.push(`Manca ${r === 'D' ? 'il difensore' : 'l\'attaccante'} di riserva`);
  const club = [f.porta, ...(f.titolari || []).map((x) => x?.club), ...panchina.map((x) => x.club)].filter(Boolean);
  if (new Set(club).size !== club.length) errori.push('Al massimo un giocatore per squadra (porta e riserve comprese)');
  const ids = (f.titolari || []).map((x) => x?.id);
  if (!f.capitano || !ids.includes(f.capitano)) errori.push('Scegli il capitano fra i quattro titolari');
  if (!f.vice || !ids.includes(f.vice)) errori.push('Scegli il vice fra i quattro titolari');
  else if (f.vice === f.capitano) errori.push('Capitano e vice devono essere due giocatori diversi');
  return errori;
}

/**
 * Punteggio di una formazione nella giornata (§§ 6-8).
 * voti: { porta: voto della Porta, giocatori: Map id -> voto } (da votoGiocatore/votoPorta).
 * Ritorna { totale, righe, bonusDifesa, capitano } con una riga per posto in campo.
 */
export function punteggioFormazione(f, voti, R = REGOLE_FUTSAL) {
  const sv = { sv: true, motivo: 'senza voto' };
  const di = (id) => voti.giocatori.get(id) || sv;
  const panchinaLibera = [...(f.panchina || [])].filter(Boolean);
  const righe = [{ posto: 'P', id: null, club: f.porta, voto: voti.porta || sv, entrato: null }];
  for (const t of f.titolari) {
    let voto = di(t.id), entrato = null;
    if (voto.sv) {
      // Il panchinaro del suo ruolo, se ha il voto (§ 8). Non eredita la fascia.
      const i = panchinaLibera.findIndex((b) => b.ruolo === t.ruolo && !di(b.id).sv);
      if (i >= 0) { entrato = panchinaLibera[i]; voto = di(entrato.id); panchinaLibera.splice(i, 1); }
    }
    righe.push({ posto: t.ruolo, id: t.id, club: t.club, voto, entrato });
  }
  // Capitano, e se non ha voto il vice; chi entra dalla panchina non porta la fascia.
  const conVoto = (id) => righe.find((r) => r.id === id && !r.entrato && !r.voto.sv);
  const fascia = conVoto(f.capitano) ? f.capitano : conVoto(f.vice) ? f.vice : null;
  let totale = 0;
  for (const r of righe) {
    r.punti = r.voto.sv ? 0 : r.voto.totale;
    if (fascia && r.id === fascia) { r.capitano = true; r.punti = r2(r.punti + r.voto.bonus); }
    totale += r.punti;
  }
  let bonusDifesa = null;
  if (f.modulo === R.bonusDifesa.modulo) {
    const quali = righe.filter((r) => r.posto === 'P' || r.posto === 'D');
    const media = r2(quali.reduce((s, r) => s + r.punti, 0) / quali.length);
    bonusDifesa = { media, preso: media >= R.bonusDifesa.soglia, punti: media >= R.bonusDifesa.soglia ? R.bonusDifesa.punti : 0 };
    totale += bonusDifesa.punti;
  }
  return { totale: r2(totale), righe, bonusDifesa, capitano: fascia };
}
