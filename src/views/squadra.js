/**
 * La mia squadra: stemma, maglia, nomi e allenatore in seconda.
 *
 * Stemma e maglia si modificano qui e si vedono subito ovunque. La foto dello
 * stemma viene rimpicciolita nel browser prima di partire: sul server finisce
 * un quadrato di 192px, non il megabyte uscito dalla fotocamera.
 */
import * as S from '../state.js';
import { esc, icon, crest, sec } from '../ui.js';
import { maglia, COLORI, kitOf } from '../maglia.js';
import { personaggio, elenco, scelto } from '../personaggio.js';

const LATO = 192;          // lo stemma non serve più grande di così
const PESO_MAX = 60 * 1024; // oltre questo si stringe ancora la qualità

/** Ridimensiona e ricomprime una foto scelta dall'utente. */
export async function riduciFoto(file) {
  const bmp = await createImageBitmap(file);
  const lato = Math.min(bmp.width, bmp.height);     // quadrato dal centro
  const cv = document.createElement('canvas'); cv.width = cv.height = LATO;
  const cx = cv.getContext('2d');
  cx.drawImage(bmp, (bmp.width - lato) / 2, (bmp.height - lato) / 2, lato, lato, 0, 0, LATO, LATO);
  bmp.close?.();
  for (const q of [0.82, 0.7, 0.58, 0.45]) {
    const url = cv.toDataURL('image/jpeg', q);
    if (url.length <= PESO_MAX) return url;
  }
  return cv.toDataURL('image/jpeg', 0.35);
}

let bozza = null;   // maglia in modifica: si vede cambiare mentre si tocca

export const squadra = {
  title: 'La mia squadra', appbar: 'back', sub: () => 'Stemma, maglia e nomi',
  render() {
    const m = S.me();
    if (!m) return `<main class="a-body"><div class="empty"><p>Non fai parte di questa lega.</p></div></main>`;
    const vice = S.sonoVice();
    const kit = bozza || kitOf(m);
    const pers = scelto(m);

    const testa = `${sec('Stemma e maglia')}
      <div class="a-card sm-testa">
        <div class="sm-box"><span class="sm-et">Stemma</span>
          <span class="sm-img">${crest({ ...m, crestUrl: m.crestUrl }, 'xl')}</span>
          <button class="sm-pen" data-act="stemma" aria-label="Cambia stemma">${icon('edit', 'ic sm')}</button>
          ${m.crestUrl ? '<button class="sm-via" data-act="stemma-via">Togli la foto</button>' : ''}
        </div>
        <div class="sm-box"><span class="sm-et">${pers ? 'Personaggio' : 'Maglia'}</span>
          <span class="sm-img">${pers ? personaggio(pers) : maglia(kit)}</span>
          <button class="sm-pen" data-act="${pers ? 'personaggio' : 'maglia'}" aria-label="Modifica">${icon('edit', 'ic sm')}</button>
        </div>
      </div>
      <input type="file" id="foto" accept="image/*" hidden>`;

    const personaggi = `${sec('Personaggio in copertina', pers ? `il numero ${pers}` : 'nessuno: si vede la maglia')}
      <div class="a-card"><p class="small muted">Nove personaggi: in una lega da otto ognuno puo' avere il suo. Se non ne scegli nessuno, in copertina resta la tua maglia.</p>
        <div class="pgrid">
          <button class="pcell${pers ? '' : ' on'}" data-pers="0"><span class="pno">${icon('shirt')}</span><small>Maglia</small></button>
          ${elenco().map((n) => `<button class="pcell${pers === n ? ' on' : ''}" data-pers="${n}">${personaggio(n)}<small>${n}</small></button>`).join('')}
        </div></div>`;

    const nomi = `${sec('Nome squadra')}
      <div class="a-card"><input class="field-input" id="team" maxlength="28" value="${esc(m.teamName)}"
        ${vice ? '' : ''} autocomplete="off" placeholder="Come si chiama la squadra"></div>
      ${sec('Nome fantallenatore')}
      <div class="a-card"><input class="field-input" id="owner" maxlength="24" value="${esc(m.owner === '—' ? '' : m.owner)}"
        autocomplete="off" placeholder="Come ti chiami"></div>
      <button class="a-btn" id="salva">Salva</button>`;

    const secondo = vice
      ? `${sec('Allenatore in seconda')}<div class="a-card"><p class="small muted">Sei tu il secondo allenatore di questa squadra: puoi schierare la formazione e cambiare stemma, maglia e nomi, ma la squadra resta di chi l'ha creata.</p>
          <button class="a-btn sec" data-act="vice-esci">Lascia il ruolo</button></div>`
      : `${sec('Allenatore in seconda', m.viceUserId ? 'occupato' : 'libero')}
        <div class="a-card" style="display:flex;flex-direction:column;gap:10px">
          ${m.viceUserId
    ? `<p class="small"><b>${esc(m.viceName || 'Un tuo amico')}</b> gestisce la squadra insieme a te.</p>
             <button class="a-btn sec" data-act="vice-via">Togli l'allenatore in seconda</button>`
    : `<p class="small muted">Invita un amico a gestire la squadra con te: riceve un link, entra e può schierare la formazione. Non prende una squadra sua e non occupa un posto in classifica.</p>
             ${m.viceCode ? `<div class="sm-link"><code>${esc(linkVice(m.viceCode))}</code></div>
               <div style="display:flex;gap:8px"><button class="a-btn" data-act="vice-copia" style="flex:1">${icon('share', 'ic sm')}Manda il link</button>
               <button class="chip" data-act="vice-nuovo">Nuovo link</button></div>
               <p class="small muted">Il link vale una volta sola. Generandone un altro il precedente smette di funzionare.</p>`
      : `<button class="a-btn" data-act="vice-invita">${icon('userplus', 'ic sm')}Crea il link d'invito</button>`}`}
        </div>`;

    return `<main class="a-body">${testa}${personaggi}${nomi}${secondo}</main>`;
  },

  mount(root, ctx) {
    const m = S.me(); if (!m) return;
    const file = root.querySelector('#foto');

    file?.addEventListener('change', async () => {
      const f = file.files?.[0]; if (!f) return;
      if (!/^image\//.test(f.type)) { ctx.toast('Serve un\'immagine'); return; }
      ctx.toast('Preparo la foto…');
      try { await S.updateMyTeam({ crestUrl: await riduciFoto(f) }); ctx.toast('Stemma aggiornato'); }
      catch (err) { ctx.toast(err.message); }
      file.value = '';
    });

    root.querySelector('main').addEventListener('click', async (e) => {
      const pc = e.target.closest('[data-pers]');
      if (pc) {
        const n = Number(pc.dataset.pers);
        try { await S.updateMyTeam({ kit: { ...kitOf(S.me()), personaggio: n || undefined } }); ctx.toast(n ? 'Personaggio scelto' : 'Torni alla maglia'); }
        catch (err) { ctx.toast(err.message); }
        return;
      }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'stemma') { file.click(); return; }
      if (act === 'stemma-via') { try { await S.updateMyTeam({ crestUrl: null }); ctx.toast('Foto tolta'); } catch (err) { ctx.toast(err.message); } return; }
      if (act === 'maglia' || act === 'personaggio') { apriMaglia(ctx); return; }
      if (act === 'vice-invita' || act === 'vice-nuovo') {
        try { await S.invitaVice(); ctx.toast('Link pronto'); } catch (err) { ctx.toast(err.message); } return;
      }
      if (act === 'vice-copia') {
        const testo = `Vieni ad allenare "${S.me().teamName}" con me sul Fantacampionato Sammarinese: ${linkVice(S.me().viceCode)}`;
        if (navigator.share) { try { await navigator.share({ text: testo }); } catch { /* annullato */ } }
        else { await navigator.clipboard?.writeText(testo); ctx.toast('Link copiato'); }
        return;
      }
      if (act === 'vice-via' || act === 'vice-esci') {
        if (!confirm(act === 'vice-esci' ? 'Lasciare il ruolo di allenatore in seconda?' : 'Togliere l\'allenatore in seconda?')) return;
        try { await S.togliVice(S.me().id); ctx.toast('Fatto'); } catch (err) { ctx.toast(err.message); }
      }
    });

    root.querySelector('#salva')?.addEventListener('click', async () => {
      const team = root.querySelector('#team').value.trim();
      const owner = root.querySelector('#owner').value.trim();
      if (!team) { ctx.toast('La squadra ha bisogno di un nome'); return; }
      try { await S.updateMyTeam({ teamName: team, owner }); ctx.toast('Salvato'); } catch (err) { ctx.toast(err.message); }
    });
  },
};

const linkVice = (code) => `${location.origin}${location.pathname}#/vice/${code}`;

/** Editor della maglia: ogni tocco ridisegna l'anteprima lì sopra. */
function apriMaglia(ctx) {
  const m = S.me(); bozza = kitOf(m);
  const tinte = (campo) => COLORI.map((c) => `<button class="tinta${bozza[campo] === c ? ' on' : ''}" data-set="${campo}:${c}" style="--t:${c}" aria-label="${c}"></button>`).join('');
  const disegna = () => {
    ctx.sheet(`<h3>Maglia</h3>
      <div class="mg-prev" id="mg-prev">${maglia(bozza)}</div>
      <label class="lbl">Colore</label><div class="tinte">${tinte('c1')}</div>
      <label class="lbl" for="mg-nome">Nome sulla maglia</label>
      <input class="field-input" id="mg-nome" maxlength="12" value="${esc(bozza.nome || '')}" placeholder="lascia vuoto per una maglia pulita">
      </div>
      <button class="a-btn" id="mg-ok" style="margin-top:12px">Salva la maglia</button>`);
    const sh = document.getElementById('sheet');
    // Solo l'anteprima si ridisegna: se rifacessi tutto il foglio, il dito
    // perderebbe il pulsante sotto e la tastiera si chiuderebbe a ogni tasto.
    const aggiorna = () => { sh.querySelector('#mg-prev').innerHTML = maglia(bozza); };
    sh.onclick = async (e) => {
      const t = e.target.closest('[data-set]');
      if (t) {
        const [campo, val] = t.dataset.set.split(':');
        bozza[campo] = val;
        sh.querySelectorAll(`[data-set^="${campo}:"]`).forEach((x) => x.classList.toggle('on', x.dataset.set === t.dataset.set));
        aggiorna(); return;
      }
      if (e.target.closest('#mg-ok')) {
        try { await S.updateMyTeam({ kit: bozza, color: bozza.c1 }); bozza = null; ctx.sheet(null); ctx.toast('Maglia salvata'); }
        catch (err) { ctx.toast(err.message); }
      }
    };
    sh.querySelector('#mg-nome').oninput = (e) => { bozza.nome = e.target.value; aggiorna(); };
  };
  disegna();
}
