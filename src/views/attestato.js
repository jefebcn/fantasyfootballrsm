import * as S from '../state.js';
import { esc, icon } from '../ui.js';
import { SCELTE } from './adesione.js';

/**
 * L'ATTESTATO DI UN CONSENSO (044), per chi amministra. Se un ente, una
 * societa' o un avvocato chiedono «il giocatore X vi ha dato il consenso?»,
 * la risposta e' questa pagina, da salvare in PDF: chi, quando, da quale
 * dispositivo, su quale testo (con la sua impronta), come e' stato
 * verificato (con lo screenshot), e ogni passaggio del registro con la sua
 * impronta. Tutto letto dal database, niente scritto qui.
 */
let caricato = { id: null, dati: null, errore: null };
const quando = (t) => (t ? new Date(t).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'long', timeStyle: 'medium' }) : '—');
const pulisci = (h) => h.replace(/<[^>]+>/g, '');
const EVENTO = { inviata: 'Inviata dal calciatore', verificata: 'Verificata', respinta: 'Respinta («non è lui»)', ritirata: 'Consenso ritirato' };

async function carica(id) {
  const [adesioni, registro, integro] = await Promise.all([S.caricaAdesioni(), S.caricaRegistro(), S.verificaRegistro()]);
  const a = (adesioni || []).find((x) => String(x.id) === String(id));
  if (!a) return { a: null };
  const [testo, prova] = await Promise.all([a.versione ? S.testoConsenso(a.versione) : null, a.prova ? S.urlProva(a.prova) : null]);
  return { a, testo, prova, integro, passi: (registro || []).filter((r) => String(r.adesione_id) === String(id)) };
}

// Chi ha verificato: il proprietario si riconosce per nome, gli altri per
// il codice del loro account (il nome lo legge solo la console).
function chiHa(id) {
  if (!id) return '—';
  const io = S.currentUser(); const pr = S.profileInfo();
  return io && io.id === id ? `${esc(pr?.display_name || 'proprietario dell\'app')} <span class="mono small">(account ${esc(id)})</span>` : `<span class="mono">account ${esc(id)}</span>`;
}
function riga(k, v) { return `<tr><th>${k}</th><td>${v}</td></tr>`; }

export const attestato = {
  title: 'Attestato di consenso', appbar: 'back', sub: ({ params }) => `Attestato n. ${params.id}`,
  render({ params }) {
    if (!S.isOwner()) return `<main class="a-body"><div class="empty">${icon('lock')}<p>Gli attestati li vede solo il proprietario dell'app.</p></div></main>`;
    if (caricato.id !== params.id || !caricato.dati) return '<main class="a-body"><p class="small muted">Sto preparando l\'attestato…</p></main>';
    const { a, testo, prova, integro, passi } = caricato.dati;
    if (!a) return '<main class="a-body"><div class="empty"><p>Richiesta non trovata.</p></div></main>';
    const p = a.player_id && S.playersById.get(a.player_id);
    const gioc = p ? `${esc(S.nomeVero(p).firstName)} ${esc(S.nomeVero(p).lastName)} · ${esc(S.clubsById.get(p.clubId)?.name || '')} <span class="mono">(${esc(p.id)})</span>` : '—';
    const stato = a.ritirato_at ? `Ritirato il ${quando(a.ritirato_at)}` : { attesa: 'In attesa di verifica: il consenso non vale ancora', verificato: 'Verificato: il consenso vale', respinto: 'Respinto: non era il calciatore' }[a.stato || 'attesa'];
    const spuntate = [a.scelta === 'aderisco' ? SCELTE.aderisco : SCELTE.escludimi];
    if (a.sponsor) spuntate.push(SCELTE.sponsor);
    if (a.maggiorenne === false) spuntate.push(SCELTE.genitore);
    spuntate.push(SCELTE.dichiaro);
    return `<main class="a-body attestato">
      <div class="a-card att-testa">
        <span class="small muted">Fantatitano · fantatitano.site</span>
        <h2>Attestato di consenso n. ${esc(a.id)}</h2>
        <p class="att-stato ${a.ritirato_at ? 'ritirato' : esc(a.stato || 'attesa')}">${stato}</p>
        <div class="no-print att-azioni"><button class="a-btn" type="button" id="att-pdf">${icon('share', 'ic sm')}Salva in PDF</button></div>
      </div>

      <div class="a-card"><b>Chi e quando</b>
        <table class="att-tab">${riga('Nome dichiarato', esc(a.nome))}${riga('Squadra dichiarata', esc(a.squadra || '—'))}
        ${riga('Profilo Instagram', esc(a.instagram || 'non indicato'))}${riga('Maggiorenne', a.maggiorenne == null ? '—' : a.maggiorenne ? 'sì' : `no · genitore: ${esc(a.genitore || '—')}`)}
        ${riga('Inviata il', quando(a.created_at))}${riga('Indirizzo IP', `<span class="mono">${esc(a.ip || '—')}</span>`)}${riga('Dispositivo', `<span class="small">${esc(a.dispositivo || '—')}</span>`)}
        ${riga('Codice di verifica', `<span class="mono">${esc(a.codice || '—')}</span>`)}</table>
        <p class="small muted">Data, ora, indirizzo IP e dispositivo li ha scritti il server al momento dell'invio, non il telefono.</p></div>

      <div class="a-card"><b>Cosa ha scelto</b>
        <ul class="att-scelte">${spuntate.map((x) => `<li>☑ ${pulisci(x)}</li>`).join('')}</ul>
        ${a.scelta === 'aderisco' && !a.sponsor ? '<p class="small">☐ Non ha spuntato «Anche con sponsor e premi».</p>' : ''}</div>

      <div class="a-card"><b>Il testo che ha letto</b>
        <table class="att-tab">${riga('Versione', esc(a.versione || '—'))}${riga('Impronta SHA-256', `<span class="mono att-hash">${esc(testo?.impronta || '—')}</span>`)}</table>
        ${testo ? `<pre class="att-testo">${esc(testo.testo)}</pre>` : '<p class="small muted">Testo non disponibile: esegui la SQL 044.</p>'}</div>

      <div class="a-card"><b>La verifica</b>
        <table class="att-tab">${riga('Giocatore', gioc)}${riga('Come', a.verificato_come === 'societa' ? 'conferma della società' : a.verificato_come === 'instagram' ? 'messaggio privato dal suo profilo Instagram' : '—')}
        ${riga('Verificata il', quando(a.verificato_at))}${riga('Da', chiHa(a.verificato_da))}</table>
        ${prova ? `<img class="att-prova" src="${esc(prova)}" alt="Screenshot del messaggio di verifica">` : a.prova ? '<p class="small muted">Screenshot salvato, ma non è stato possibile aprirlo ora.</p>' : ''}</div>

      <div class="a-card"><b>Il registro</b>
        <p class="small muted">Ogni passaggio è scritto una volta e non si modifica. Ognuno porta l'impronta di quello prima: se una riga venisse toccata, la catena non tornerebbe più.</p>
        <table class="att-tab att-reg"><tr><th>Riga</th><th>Passaggio</th><th>Quando</th><th>Impronta</th></tr>
        ${(passi || []).map((r) => `<tr><td>${esc(r.id)}</td><td>${esc(EVENTO[r.evento] || r.evento)}</td><td>${quando(r.quando)}</td><td class="mono att-hash">${esc(r.impronta)}</td></tr>`).join('')}</table>
        <p class="small">Stato della catena, verificato dal database adesso: ${integro ? (integro.integro ? `<b class="ok">integra</b> (${integro.righe} righe in tutto)` : `<b class="ko">rotta alla riga ${integro.prima_rotta}</b>`) : 'non disponibile'}.</p></div>

      <p class="small muted att-piede">Generato il ${quando(new Date().toISOString())} da fantatitano.site. Fantatitano per il momento non è affiliato alla FSGC né alle società.</p>
    </main>`;
  },
  mount(root, ctx) {
    const id = ctx.params.id;
    if (S.isOwner() && (caricato.id !== id || !caricato.dati)) {
      caricato = { id, dati: null };
      carica(id).then((d) => { if (caricato.id === id) { caricato.dati = d; ctx.render(); } })
        .catch((e) => ctx.toast(e.message || 'Non è stato possibile caricare l\'attestato'));
    }
    root.querySelector('#att-pdf')?.addEventListener('click', () => window.print());
  },
};
