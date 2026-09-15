import * as S from '../state.js';
import { esc, icon, crest, logo, pic, tile, sec } from '../ui.js';

const COLORS = ['#1B84C6', '#2b7a3d', '#8a1d1d', '#5b3fa6', '#c46a00', '#1a1a1a', '#2c7a7b', '#b8321f', '#d4a017', '#0e5e93'];
let form = 'none'; // 'create' | 'join'
// Con Apple e «Nascondi la mia e-mail» il nome non arriva: lo chiediamo qui,
// che è il passaggio obbligato prima di entrare in una lega.
const nameField = () => S.nomeDaCompletare()
  ? `<label class="lbl" for="who">Come ti chiami</label><input class="field-input" id="who" placeholder="es. Alex" maxlength="40" autocomplete="name">`
  : '';
const teamFields = () => `${nameField()}<label class="lbl" for="team">Nome della tua squadra</label><input class="field-input" id="team" placeholder="es. Hasta El Chapo FC" maxlength="28">
  <label class="lbl" for="color" style="margin-top:8px">Colore</label><div class="chipgrid" id="colors">${COLORS.map((c, i) => `<button class="chip${i === 0 ? ' on' : ''}" data-color="${c}" style="width:34px;height:34px;padding:0;background:${c};border-color:${c}" aria-label="${c}"></button>`).join('')}</div>`;

/** Tre punti su cosa rende diverso il Voto Titano: la schermata senza lega era vuota. */
function comeFunziona() {
  const punti = [
    ['voti', 'Niente pagelle', 'Il voto nasce dagli eventi del referto FSGC, non dal giudizio di un giornalista.'],
    ['probabili', 'Una giornata per settimana', 'Si schiera entro il sabato, i voti escono la domenica, il martedì la giornata si chiude.'],
    ['quotazioni', 'Rosa da 25', 'Listone del campionato sammarinese, 500 crediti all\'asta, mercato libero fra una giornata e l\'altra.'],
  ];
  return sec('Come funziona') + `<div class="a-card howto">${punti.map(([ic, t, d]) => `<div class="how"><i>${pic(ic, 'menu')}</i><span><b>${t}</b><span>${d}</span></span></div>`).join('')}</div>`;
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
      </div>
      ${form === 'create' ? `<div class="a-card" style="display:flex;flex-direction:column;gap:6px"><label class="lbl" for="lname">Nome della lega</label><input class="field-input" id="lname" placeholder="es. I Sudati di RSM" maxlength="40">${teamFields()}<button class="a-btn" id="go-create" style="margin-top:10px">Crea e diventa admin</button></div>` : ''}
      ${form === 'join' ? `<div class="a-card" style="display:flex;flex-direction:column;gap:6px"><label class="lbl" for="code">Codice invito</label><input class="field-input" id="code" placeholder="es. A1B2C3" autocapitalize="characters" maxlength="6">${teamFields()}<button class="a-btn" id="go-join" style="margin-top:10px">Entra nella lega</button></div>` : ''}
      ${mine.length ? '' : comeFunziona()}
    </main>`;
  },
  mount(root, ctx) {
    let color = COLORS[0];
    root.querySelector('main').addEventListener('click', async (e) => {
      const f = e.target.closest('[data-form]'); if (f) { form = form === f.dataset.form ? 'none' : f.dataset.form; ctx.render(); return; }
      const c = e.target.closest('[data-color]'); if (c) { color = c.dataset.color; root.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b === c)); return; }
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
      const bj = e.target.closest('#go-join');
      if (bj) { if (bj.disabled) return; const code = root.querySelector('#code').value.trim(); const t = team(); if (code.length < 4) { ctx.toast('Inserisci il codice invito'); return; } if (!t) return; if (!await salvaNome()) return;
        occupa(bj);
        try { await S.joinLeague(code, t, color, initials(t)); ctx.toast('Sei dentro'); form = 'none'; ctx.go(''); } catch (err) { ctx.toast(err.message); libera(bj); } }
    });
  },
};
