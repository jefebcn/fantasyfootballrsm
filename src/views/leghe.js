import * as S from '../state.js';
import { esc, icon, crest, logo, pic, sec } from '../ui.js';
import { COLORI_SQUADRA } from '../colore.js';


let form = 'none'; // 'create' | 'join' | 'pubblica'
let pubbliche = null;   // elenco dal server: null = non ancora chiesto
let entraIn = null;     // id della lega pubblica in cui si sta entrando
let apriEntra = null;   // arrivati dal banner: ci si scorre sopra una volta sola
// Con Apple e «Nascondi la mia e-mail» il nome non arriva: lo chiediamo qui,
// che è il passaggio obbligato prima di entrare in una lega.
const nameField = () => S.nomeDaCompletare()
  ? `<label class="lbl" for="who">Come ti chiami</label><input class="field-input" id="who" placeholder="es. Alex" maxlength="40" autocomplete="name">`
  : '';
/**
 * Il nome della squadra, e basta.
 *
 * C'era una fila di dieci pastiglie colorate da scegliere. Non si capiva cosa
 * cambiassero, e soprattutto NON DAVANO SEGNO: la pastiglia scelta doveva
 * colorarsi di --primary, ma ognuna ha il suo colore scritto inline, che
 * vince sulla classe. Il tocco funzionava, il colpo d'occhio no — quindi
 * sembrava un comando rotto.
 *
 * Tolto invece di aggiustato: il colore si sceglie davvero dopo, in "La mia
 * squadra", dove si disegna la maglia intera e si carica lo stemma. Chiederlo
 * qui era chiedere una decisione prima di avere il contesto per prenderla, e
 * su una schermata dove si vuole solo cominciare a giocare. Alla creazione ne
 * arriva uno a caso, che e' un punto di partenza come un altro.
 */
const teamFields = () => `${nameField()}<label class="lbl" for="team">Nome della tua squadra</label><input class="field-input" id="team" placeholder="es. Hasta El Chapo FC" maxlength="28">
  <p class="small muted" style="margin:6px 2px 0">Colori e stemma si scelgono dopo, in «La mia squadra».</p>`;
/** Un colore di partenza a caso: si cambia in "La mia squadra". */
const coloreACaso = () => COLORI_SQUADRA[Math.floor(Math.random() * COLORI_SQUADRA.length)];

/** Tre punti su cosa rende diverso il Voto Titano: la schermata senza lega era vuota. */
function comeFunziona() {
  const punti = [
    ['voti', 'Niente pagelle', 'Il voto nasce dagli eventi del referto FSGC, non dal giudizio di un giornalista.'],
    ['probabili', 'Una giornata per settimana', 'Si schiera entro il sabato, i voti escono la domenica, il martedì la giornata si chiude.'],
    ['quotazioni', 'Rosa da 25', 'Listone del campionato sammarinese, 500 crediti all\'asta, mercato libero fra una giornata e l\'altra.'],
  ];
  return sec('Come funziona') + `<div class="a-card howto">${punti.map(([ic, t, d]) => `<div class="how"><i>${pic(ic, 'menu')}</i><span><b>${t}</b><span>${d}</span></span></div>`).join('')}</div>`;
}

/**
 * Il modulo per creare una lega pubblica.
 *
 * Tre cose che una lega fra amici non ha, e che qui vanno decise da chi la
 * apre: quanti crediti ha ognuno per farsi la rosa, quanta gente ci sta, e
 * cosa c'e' in palio. I premi si possono aggiungere anche dopo, dalla
 * classifica: qui basta uno.
 */
function moduloPubblica() {
  return `<div class="a-card" style="display:flex;flex-direction:column;gap:6px">
    <p class="auth-hint" style="margin:0 0 4px"><b>Come funziona una lega pubblica.</b> Ci entra chiunque, senza codice. I giocatori non sono esclusivi: possono stare nella rosa di tutti, altrimenti dal ventesimo iscritto non resterebbero più portieri. Non ci sono scontri diretti: ogni giornata i tuoi fantapunti si sommano, e vince chi ne ha di più.</p>
    <label class="lbl" for="pname">Nome della lega</label>
    <input class="field-input" id="pname" placeholder="es. Titano Open" maxlength="40">
    <div class="due">
      <span><label class="lbl" for="pbudget">Crediti a testa</label>
        <input class="field-input" id="pbudget" type="number" value="500" min="50" max="5000" inputmode="numeric"></span>
      <span><label class="lbl" for="pmax">Massimo partecipanti</label>
        <input class="field-input" id="pmax" type="number" value="200" min="2" max="1000" inputmode="numeric"></span>
    </div>
    <label class="lbl" for="ppremio">Premio per il primo <span class="muted">(facoltativo)</span></label>
    <input class="field-input" id="ppremio" placeholder="es. una cena offerta" maxlength="120">
    ${teamFields()}
    <button class="a-btn" id="go-pubblica" style="margin-top:10px">Crea la lega pubblica</button>
  </div>`;
}

/**
 * Le leghe pubbliche in cui si puo' entrare. L'elenco arriva dal server con
 * una funzione sua (leghe_pubbliche), perche' le leghe di cui non fai parte
 * la policy non te le farebbe vedere — e giustamente: di quelle altrui qui
 * escono solo il nome, quanti sono e cosa c'e' in palio.
 */
function elencoPubbliche() {
  if (pubbliche === null) return `<div class="a-sec"><b>Leghe pubbliche</b></div><p class="small muted" style="margin:0 2px">Sto guardando quali ci sono…</p>`;
  if (!pubbliche.length) return '';
  const riga = (l) => {
    const pieno = l.membri >= l.max_membri;
    const primo = (l.premi || []).slice().sort((a, b) => a.posto - b.posto)[0];
    return `<div class="lgrow">
      <button class="vr" data-pubblica="${l.id}" ${l.dentro || pieno ? 'disabled' : ''}>
        ${crest({ color: 'var(--accent)', initials: (l.short_name || l.name).slice(0, 2).toUpperCase() }, 'sm')}
        <span class="nm"><b>${esc(l.name)}</b><span>${l.membri}${l.max_membri < 1000 ? `/${l.max_membri}` : ''} squadre · ${l.budget} crediti${primo ? ` · in palio: ${esc(primo.premio)}` : ''}</span></span>
        <span class="ev"></span>
        <span class="fv" style="font-size:12px">${l.dentro ? icon('check', 'ic sm') : pieno ? 'al completo' : 'entra'}</span>
      </button></div>`;
  };
  return `<div class="a-sec"><b>Leghe pubbliche</b><span>${pubbliche.length}</span></div>
    <div class="vlist">${pubbliche.map(riga).join('')}</div>
    ${entraIn ? `<div class="a-card" style="display:flex;flex-direction:column;gap:6px">
      <p class="auth-hint" style="margin:0">Stai entrando in <b>${esc(pubbliche.find((l) => l.id === entraIn)?.name || '')}</b>. Ti servono un nome per la squadra e un colore.</p>
      ${teamFields()}<button class="a-btn" id="go-entra" style="margin-top:10px">Entra nella lega</button></div>` : ''}
    <p class="small muted" style="margin:-4px 2px 0">Nelle leghe pubbliche non serve il codice: si entra e si fa la propria rosa.</p>`;
}

export const leghe = {
  title: 'Le mie leghe', appbar: () => (S.hasLeague() ? 'main' : 'none'), sub: () => 'Le mie leghe',
  render() {
    const mine = S.myLeagues(); const cur = S.currentLeagueId();
    return `<main class="a-body">
      ${mine.length ? '' : `<div class="auth-hero" style="padding-top:20px">${logo('auth-mark')}<h1 style="font-size:22px">Benvenuto${!S.nomeDaCompletare() && S.profileInfo()?.display_name ? `, ${esc(S.profileInfo().display_name)}` : ''}</h1><p>Per giocare serve una lega: creala tu e invita gli altri con un codice, oppure entra in una che esiste già.</p></div>`}
      ${mine.length ? `<div class="vlist"><div class="vhead">Leghe <span>${mine.length}</span></div>${mine.map((l) => {
    const mia = S.laHoCreataIo(l);
    return `<div class="lgrow">
      <button class="vr" data-league="${l.id}">${crest({ color: l.id === cur ? 'var(--primary)' : 'var(--c-pietra-400)', initials: (l.short_name || l.name).slice(0, 2).toUpperCase() }, 'sm')}<span class="nm"><b>${esc(l.name)}</b><span>${l.myRole === 'admin' ? 'admin' : 'fantallenatore'} · ${l.started ? 'in corso' : 'in attesa delle rose'} · codice ${esc(l.invite_code)}</span></span><span class="ev"></span><span class="fv" style="font-size:12px">${l.id === cur ? icon('check', 'ic sm') : ''}</span></button>
      <button class="lgvia" data-via="${mia ? 'elimina' : 'esci'}:${l.id}" aria-label="${mia ? 'Elimina' : 'Esci da'} ${esc(l.name)}" title="${mia ? 'Elimina la lega' : 'Esci dalla lega'}">${icon(mia ? 'trash' : 'exit', 'ic sm')}</button>
    </div>`;
  }).join('')}</div>
  <p class="small muted" style="margin:-4px 2px 0">Tocca una lega per entrarci. Il tasto a destra ${mine.some((l) => S.laHoCreataIo(l)) ? 'elimina quelle che hai creato tu ed esce dalle altre' : 'ti fa uscire dalla lega'}.</p>` : ''}
      <div class="startgrid">
        <button class="startcard${form === 'create' ? ' on' : ''}" data-form="create">${pic('leghe', 'menu')}<b>Crea una lega</b><span>Ne diventi admin e ricevi il codice da girare agli altri</span></button>
        <button class="startcard${form === 'join' ? ' on' : ''}" data-form="join">${pic('squadre', 'menu')}<b>Entra con codice</b><span>Ti serve il codice a 6 caratteri dell'organizzatore</span></button>
        ${S.isAdmin() ? `<button class="startcard larga${form === 'pubblica' ? ' on' : ''}" data-form="pubblica">${pic('trofei', 'lega')}<b>Crea una lega pubblica</b><span>Aperta a tutti, senza codice: ognuno si fa la sua rosa e vince chi fa più punti</span></button>` : ''}
      </div>
      ${form === 'create' ? `<div class="a-card" style="display:flex;flex-direction:column;gap:6px"><label class="lbl" for="lname">Nome della lega</label><input class="field-input" id="lname" placeholder="es. I Sudati di RSM" maxlength="40">${teamFields()}<button class="a-btn" id="go-create" style="margin-top:10px">Crea e diventa admin</button></div>` : ''}
      ${form === 'join' ? `<div class="a-card" style="display:flex;flex-direction:column;gap:6px"><label class="lbl" for="code">Codice invito</label><input class="field-input" id="code" placeholder="es. A1B2C3" autocapitalize="characters" maxlength="6">${teamFields()}<button class="a-btn" id="go-join" style="margin-top:10px">Entra nella lega</button></div>` : ''}
      ${form === 'pubblica' ? moduloPubblica() : ''}
      ${elencoPubbliche()}
      ${mine.length ? '' : comeFunziona()}
    </main>`;
  },
  mount(root, ctx) {
    // Un colore a caso per questa creazione: non si chiede piu' all'utente.
    const color = coloreACaso();
    // Chi arriva dal banner del montepremi vuole entrare in QUELLA lega: il
    // modulo del nome squadra lo trova aperto, e la pagina ci scorre sopra.
    // Senza questo passaggio finiva nell'elenco e la doveva cercare.
    try {
      const chiesta = sessionStorage.getItem('fcs:entra-pubblica');
      if (chiesta) { sessionStorage.removeItem('fcs:entra-pubblica'); entraIn = chiesta; apriEntra = chiesta; }
    } catch { /* niente storage: resta l'elenco */ }
    if (apriEntra) {
      const modulo = root.querySelector('#go-entra')?.closest('.a-card');
      if (modulo) { apriEntra = null; modulo.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    // L'elenco delle pubbliche si chiede una volta per apertura di schermata,
    // non a ogni ridisegno: senza questa guardia ogni tocco su un colore
    // faceva una richiesta al server.
    if (pubbliche === null) {
      S.leghePubbliche().then((l) => { pubbliche = l; ctx.render(); })
        .catch(() => { pubbliche = []; ctx.render(); });
    }
    root.querySelector('main').addEventListener('click', async (e) => {
      const f = e.target.closest('[data-form]'); if (f) { form = form === f.dataset.form ? 'none' : f.dataset.form; ctx.render(); return; }
      const v = e.target.closest('[data-via]');
      if (v) {
        const [azione, id] = v.dataset.via.split(':');
        const lega = S.myLeagues().find((x) => x.id === id); if (!lega) return;
        if (azione === 'elimina') {
          // Si fa riscrivere il nome: cancella anche le squadre degli altri.
          const risposta = prompt(`Eliminare "${lega.name}" cancella per sempre squadre, rose e formazioni di tutti, e non si puo' annullare.\n\nPer confermare scrivi il nome della lega:\n${lega.name}`);
          if (risposta === null) return;
          if (risposta.trim().toLowerCase() !== lega.name.trim().toLowerCase()) { ctx.toast('Nome non corrispondente: non ho eliminato niente'); return; }
          try { await S.deleteLeague(id); ctx.toast('Lega eliminata'); } catch (err) { ctx.toast(err.message); }
        } else {
          if (!confirm(`Uscire da "${lega.name}"? Perdi la tua squadra e la tua rosa in questa lega.`)) return;
          try { await S.abbandonaLega(id); ctx.toast('Sei uscito dalla lega'); } catch (err) { ctx.toast(err.message); }
        }
        ctx.render(); return;
      }
      const l = e.target.closest('[data-league]'); if (l) { await S.switchLeague(l.dataset.league); ctx.go(''); return; }
      const team = () => { const t = root.querySelector('#team')?.value.trim(); if (!t) { ctx.toast('Dai un nome alla tua squadra'); return null; } return t; };
      // Ritorna false se il nome serve e manca: senza, in lega comparirebbe la sigla dell'indirizzo.
      const salvaNome = async () => {
        const c = root.querySelector('#who'); if (!c) return true;
        const v = c.value.trim(); if (!v) { ctx.toast('Scrivi come ti chiami'); c.focus(); return false; }
        try { await S.updateDisplayName(v); return true; } catch (err) { ctx.toast(err.message); return false; }
      };
      const initials = (t) => t.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      // Il bottone si spegne mentre la richiesta e' in volo: senza, due tocchi
      // ravvicinati creavano DUE leghe identiche, ed e' quasi certamente cosi'
      // che ne sono nate quattro con lo stesso nome.
      const occupa = (b) => { b.disabled = true; b.dataset.prima = b.textContent; b.textContent = 'Un attimo\u2026'; };
      const libera = (b) => { b.disabled = false; if (b.dataset.prima) b.textContent = b.dataset.prima; };
      const bc = e.target.closest('#go-create');
      if (bc) { if (bc.disabled) return; const name = root.querySelector('#lname').value.trim(); const t = team(); if (!name) { ctx.toast('Dai un nome alla lega'); return; } if (!t) return; if (!await salvaNome()) return;
        occupa(bc);
        try { await S.createLeague(name, t, color, initials(t)); ctx.toast('Lega creata'); form = 'none'; ctx.go('lega'); } catch (err) { ctx.toast(err.message); libera(bc); } return; }
      // scelta di una lega pubblica: prima si chiede nome squadra e colore
      const pb = e.target.closest('[data-pubblica]');
      if (pb) { entraIn = entraIn === pb.dataset.pubblica ? null : pb.dataset.pubblica; ctx.render(); return; }

      const be = e.target.closest('#go-entra');
      if (be) {
        if (be.disabled) return;
        const t = team(); if (!t) return; if (!await salvaNome()) return;
        occupa(be);
        try {
          await S.entraLegaPubblica(entraIn, t, color, initials(t));
          entraIn = null; pubbliche = null; ctx.toast('Sei dentro'); ctx.go('');
        } catch (err) { ctx.toast(err.message); libera(be); }
        return;
      }

      const bp = e.target.closest('#go-pubblica');
      if (bp) {
        if (bp.disabled) return;
        const name = root.querySelector('#pname').value.trim();
        const budget = parseInt(root.querySelector('#pbudget').value, 10);
        const max = parseInt(root.querySelector('#pmax').value, 10);
        const premio = root.querySelector('#ppremio').value.trim();
        const t = team();
        if (!name) { ctx.toast('Dai un nome alla lega'); return; }
        if (!Number.isInteger(budget) || budget < 50 || budget > 5000) { ctx.toast('I crediti vanno da 50 a 5000'); return; }
        if (!Number.isInteger(max) || max < 2 || max > 1000) { ctx.toast('I partecipanti vanno da 2 a 1000'); return; }
        if (!t) return; if (!await salvaNome()) return;
        occupa(bp);
        try {
          await S.creaLegaPubblica(name, t, color, initials(t), {
            budget, max, premi: premio ? [{ posto: 1, premio }] : [],
          });
          form = 'none'; pubbliche = null; ctx.toast('Lega pubblica creata'); ctx.go('lega');
        } catch (err) { ctx.toast(err.message); libera(bp); }
        return;
      }

      const bj = e.target.closest('#go-join');
      if (bj) { if (bj.disabled) return; const code = root.querySelector('#code').value.trim(); const t = team(); if (code.length < 4) { ctx.toast('Inserisci il codice invito'); return; } if (!t) return; if (!await salvaNome()) return;
        occupa(bj);
        try { await S.joinLeague(code, t, color, initials(t)); ctx.toast('Sei dentro'); form = 'none'; ctx.go(''); } catch (err) { ctx.toast(err.message); libera(bj); } }
    });
  },
};
