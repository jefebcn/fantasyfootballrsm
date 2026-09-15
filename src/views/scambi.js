import * as S from '../state.js';
import { esc, icon, crest, faccia, empty, ROLE_NAME, ROLE_ORDER } from '../ui.js';

/**
 * Scambi fra squadre.
 *
 * Una proposta muove lo stesso numero di giocatori per parte, più eventuali
 * crediti. Il vincolo non è un capriccio: i reparti hanno dimensioni fisse
 * (3 portieri, 8 difensori, 8 centrocampisti, 6 attaccanti) e uno scambio
 * sbilanciato lascerebbe una delle due rose fuori regola. Chi propone sceglie
 * ruolo per ruolo, così i conti tornano da soli.
 *
 * Il server ricontrolla tutto al momento dell'accettazione: fra la proposta e
 * la risposta può essere passato un altro scambio, e una proposta nata valida
 * può non esserlo più.
 */

let stato = { con: null, offro: new Set(), chiedo: new Set(), crediti: 0, nota: '' };
const P = (id) => S.playersById.get(id);
const nomeSquadra = (memberId) => S.managersById.get(memberId)?.teamName || 'squadra uscita';

function azzera(con = null) { stato = { con, offro: new Set(), chiedo: new Set(), crediti: 0, nota: '' }; }

/** Quanti giocatori per ruolo su ciascun lato: devono combaciare. */
function bilancio() {
  const conta = (ids) => { const c = { P: 0, D: 0, C: 0, A: 0 }; for (const id of ids) { const p = P(id); if (p) c[p.role]++; } return c; };
  const a = conta(stato.offro), b = conta(stato.chiedo);
  const pari = ROLE_ORDER.every((r) => a[r] === b[r]);
  return { a, b, pari, vuoto: stato.offro.size === 0 && stato.chiedo.size === 0 };
}

/** Il motivo per cui il tasto è spento, o null se si può proporre. */
export function perCheNo() {
  const me = S.me();
  if (!stato.con) return 'Scegli con quale squadra';
  const b = bilancio();
  if (b.vuoto && !stato.crediti) return 'Scegli almeno un giocatore per parte';
  if (!b.pari) {
    const fuori = ROLE_ORDER.filter((r) => b.a[r] !== b.b[r]).map((r) => ROLE_NAME[r].toLowerCase());
    return `I reparti non tornano: ${fuori.join(', ')}. Ogni ruolo deve muovere lo stesso numero di giocatori da una parte e dall'altra.`;
  }
  if (stato.crediti > (me?.credits ?? 0)) return `Hai ${me.credits} crediti, ne stai offrendo ${stato.crediti}`;
  const altro = S.managersById.get(stato.con);
  if (stato.crediti < 0 && -stato.crediti > (altro?.credits ?? 0)) return `${altro.teamName} ha ${altro.credits} crediti, ne stai chiedendo ${-stato.crediti}`;
  if (S.scambiInAttesa().some((t) => t.a === stato.con)) return `Hai già una proposta aperta verso ${esc(nomeSquadra(stato.con))}`;
  return null;
}

function elencoRosa(memberId, scelti, tipo) {
  const r = S.rosterOf(memberId).filter((x) => x.player.isActive);
  return ROLE_ORDER.map((role) => {
    const list = r.filter((x) => x.player.role === role).sort((a, b) => b.player.quotation - a.player.quotation);
    if (!list.length) return '';
    return `<div class="vlist"><div class="vhead">${ROLE_NAME[role]} <span>${list.length}</span></div>${list.map((x) => `
      <button class="vr sceglibile${scelti.has(x.playerId) ? ' scelto' : ''}" data-scegli="${tipo}" data-id="${esc(x.playerId)}">
        ${faccia(x.player, x.club)}
        <span class="nm"><b>${esc(x.player.name)}</b><span>${esc(x.club.name)} · quot. ${x.player.quotation}</span></span>
        <span class="fv">${scelti.has(x.playerId) ? icon('check', 'ic sm') : ''}</span>
      </button>`).join('')}</div>`;
  }).join('');
}

/** Una proposta, vista da chi la guarda: dice sempre chi dà cosa a chi. */
function scheda(t, io) {
  const mia = t.da === io;
  const daN = nomeSquadra(t.da), aN = nomeSquadra(t.a);
  const lato = (ids, chi) => ids.length
    ? `<div class="lato"><span class="chi">${esc(chi)} dà</span>${ids.map((id) => { const p = P(id);
      return `<span class="gioc">${p ? esc(p.name) : id}</span>`; }).join('')}</div>`
    : `<div class="lato"><span class="chi">${esc(chi)} dà</span><span class="gioc niente">nessun giocatore</span></div>`;
  const soldi = t.crediti > 0 ? `<p class="soldi">${esc(daN)} aggiunge <b>${t.crediti}</b> crediti</p>`
    : t.crediti < 0 ? `<p class="soldi">${esc(aN)} aggiunge <b>${-t.crediti}</b> crediti</p>` : '';
  const etichette = { proposta: 'In attesa', accettata: 'Accettata', rifiutata: 'Rifiutata', annullata: 'Ritirata' };
  const tasti = t.stato !== 'proposta' ? ''
    : mia
      ? `<div class="azioni"><button class="a-btn sec" data-annulla="${t.id}">Ritira la proposta</button></div>`
      : `<div class="azioni"><button class="a-btn" data-accetta="${t.id}">${icon('check', 'ic sm')}Accetta</button>
         <button class="a-btn sec" data-rifiuta="${t.id}">Rifiuta</button></div>`;
  return `<div class="a-card scambio ${t.stato}">
    <div class="shead"><b>${esc(daN)} → ${esc(aN)}</b><span class="badge">${etichette[t.stato]}</span></div>
    ${lato(t.offre, daN)}${lato(t.chiede, aN)}${soldi}
    ${t.nota ? `<p class="nota">«${esc(t.nota)}»</p>` : ''}
    ${tasti}</div>`;
}

export const scambi = {
  title: 'Scambi', appbar: 'back', sub: () => 'Proposte fra squadre',
  render() {
    const me = S.me();
    if (!me) return `<main class="a-body">${empty('Gli scambi si fanno dentro una lega.')}</main>`;
    if (!S.scambiDisponibili()) {
      return `<main class="a-body">${empty('Gli scambi non sono ancora attivi su questo server.')}
        <div class="a-card a-rule"><span class="art">Da fare</span><p>Manca la migrazione <code>supabase/migrations/006-scambi.sql</code>: va eseguita una volta nell\'SQL Editor. Finché non c\'è, il resto dell\'app funziona normalmente.</p></div></main>`;
    }
    const altri = S.base.managers.filter((m) => m.id !== me.id);
    const tutti = S.scambi();
    const daDecidere = S.scambiDaDecidere();
    const miei = S.scambiInAttesa();
    const chiusi = tutti.filter((t) => t.stato !== 'proposta').slice(0, 10);

    if (!stato.con) {
      return `<main class="a-body">
        ${daDecidere.length ? `<div class="a-sec"><b>Aspettano una tua risposta</b><span>${daDecidere.length}</span></div>
          ${daDecidere.map((t) => scheda(t, me.id)).join('')}` : ''}
        ${miei.length ? `<div class="a-sec"><b>Hai proposto</b><span>${miei.length}</span></div>
          ${miei.map((t) => scheda(t, me.id)).join('')}` : ''}
        <div class="a-sec"><b>Proponi uno scambio</b><span>${altri.length} squadre</span></div>
        ${altri.length ? `<div class="vlist">${altri.map((m) => `
          <button class="vr" data-con="${m.id}">${crest(m, 'sm')}
            <span class="nm"><b>${esc(m.teamName)}</b><span>${esc(m.owner)} · ${m.credits} crediti</span></span>
            ${icon('chev', 'ic sm chev')}</button>`).join('')}</div>`
    : `<div class="a-card"><p class="small muted">Sei da solo in questa lega: gli scambi servono almeno in due.</p></div>`}
        <div class="a-card a-rule"><span class="art">Come funziona</span><p>Uno scambio muove <b>lo stesso numero di giocatori per ruolo</b> da una parte e dall\'altra, più eventuali crediti: i reparti hanno dimensioni fisse e devono restare quelle. Diventa effettivo quando l\'altra squadra accetta, e in quel momento il server ricontrolla che sia ancora fattibile.</p></div>
        ${chiusi.length ? `<div class="a-sec"><b>Già decisi</b><span>ultimi ${chiusi.length}</span></div>${chiusi.map((t) => scheda(t, me.id)).join('')}` : ''}
      </main>`;
    }

    const altro = S.managersById.get(stato.con);
    const b = bilancio();
    const no = perCheNo();
    const riepilogo = ROLE_ORDER.filter((r) => b.a[r] || b.b[r])
      .map((r) => `<span class="rb${b.a[r] === b.b[r] ? ' ok' : ' no'}">${r} ${b.a[r]}–${b.b[r]}</span>`).join('');

    return `<main class="a-body">
      <div class="a-card a-fase"><div class="r"><p><b>Scambio con ${esc(altro.teamName)}</b></p>
        <button class="a-btn sec piccolo" data-con="">Cambia</button></div>
        <p class="small muted">Scegli chi dai e chi prendi. Stesso numero di giocatori per ruolo.</p>
        ${riepilogo ? `<div class="bilancio">${riepilogo}</div>` : ''}</div>

      <div class="a-card">
        <label class="lbl" for="cred">Crediti</label>
        <input class="field-input" id="cred" type="number" inputmode="numeric" step="1" value="${stato.crediti}"
          aria-describedby="cred-aiuto">
        <p class="auth-hint" id="cred-aiuto">Positivo: li aggiungi tu. Negativo: li chiedi a ${esc(altro.teamName)}. Tu ne hai ${me.credits}, loro ${altro.credits}.</p>
        <label class="lbl" for="nota" style="margin-top:10px">Due righe, se vuoi</label>
        <input class="field-input" id="nota" maxlength="140" value="${esc(stato.nota)}" placeholder="perché conviene a tutti e due">
      </div>

      <div class="a-sec"><b>Dai tu</b><span>${stato.offro.size} scelti</span></div>
      ${elencoRosa(me.id, stato.offro, 'offro')}
      <div class="a-sec"><b>Prendi da ${esc(altro.teamName)}</b><span>${stato.chiedo.size} scelti</span></div>
      ${elencoRosa(stato.con, stato.chiedo, 'chiedo')}

      <div class="a-card">
        ${no ? `<p class="auth-hint">${esc(no)}</p>` : '<p class="auth-hint">Tutto torna: la proposta può partire.</p>'}
        <button class="a-btn" id="manda" ${no ? 'disabled' : ''}>${icon('check', 'ic sm')}Manda la proposta</button>
      </div>
    </main>`;
  },

  mount(root, ctx) {
    const main = root.querySelector('main');
    main.addEventListener('click', async (e) => {
      const c = e.target.closest('[data-con]');
      if (c) { azzera(c.dataset.con || null); ctx.render(); return; }

      const s = e.target.closest('[data-scegli]');
      if (s) {
        const set = s.dataset.scegli === 'offro' ? stato.offro : stato.chiedo;
        const id = s.dataset.id;
        if (set.has(id)) set.delete(id); else set.add(id);
        ctx.render(); return;
      }

      const decidi = async (b, fn, fatto) => {
        b.disabled = true;
        try { await fn(); ctx.toast(fatto); azzera(); ctx.render(); }
        catch (err) { ctx.toast(err.message || 'Non è andata'); b.disabled = false; ctx.render(); }
      };
      const acc = e.target.closest('[data-accetta]');
      if (acc) return decidi(acc, () => S.accettaScambio(acc.dataset.accetta), 'Scambio fatto');
      const rif = e.target.closest('[data-rifiuta]');
      if (rif) return decidi(rif, () => S.rifiutaScambio(rif.dataset.rifiuta), 'Proposta rifiutata');
      const ann = e.target.closest('[data-annulla]');
      if (ann) return decidi(ann, () => S.annullaScambio(ann.dataset.annulla), 'Proposta ritirata');

      const m = e.target.closest('#manda');
      if (m) {
        // I valori si rileggono dal campo, non dallo stato: chi scrive e tocca
        // subito "Manda" non deve perdere l'ultima cifra digitata.
        stato.crediti = Math.trunc(Number(main.querySelector('#cred')?.value) || 0);
        stato.nota = main.querySelector('#nota')?.value?.trim() || '';
        const no = perCheNo();
        if (no) { ctx.toast(no); ctx.render(); return; }
        m.disabled = true;
        try {
          await S.proponiScambio(stato.con, [...stato.offro], [...stato.chiedo], stato.crediti, stato.nota);
          ctx.toast('Proposta mandata'); azzera(); ctx.render();
        } catch (err) { ctx.toast(err.message || 'Non è andata'); m.disabled = false; }
      }
    });
    main.addEventListener('input', (e) => {
      if (e.target.id === 'cred') stato.crediti = Math.trunc(Number(e.target.value) || 0);
      if (e.target.id === 'nota') stato.nota = e.target.value;
    });
  },
};
