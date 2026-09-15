import * as S from '../state.js';
import { esc, icon, crest, roleChip, sec } from '../ui.js';
import { maglia, kitOf } from '../maglia.js';

export const lega = {
  title: 'Gestione lega', appbar: 'back', sub: () => 'Profilo lega · Partecipanti · Rose',
  render() {
    const L = S.base.league; const ms = S.base.managers; const admin = S.isLeagueAdmin(); const me = S.me();
    const rosterCount = (m) => (S.base.rosters[m.id] || []).length;
    const started = ms.some((m) => rosterCount(m) > 0);
    return `<main class="a-body">
      <div class="a-card" style="display:flex;flex-direction:column;gap:6px"><b style="font:700 18px var(--font-display)">${esc(L.name)}</b><span class="small muted">${ms.length} partecipanti · ${started ? 'rose assegnate' : 'in attesa delle rose'}</span>
        ${L.inviteCode ? `<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span class="small muted">Codice invito</span><b class="num" style="font-size:20px;letter-spacing:.12em">${esc(L.inviteCode)}</b><button class="chip" id="share-code" style="margin-left:auto">${icon('share', 'ic sm')} Invita</button></div>` : ''}</div>
      ${sec('Partecipanti', `${ms.length}/12`)}
      <div class="vlist">${ms.map((m) => `<div class="prow">${crest(m, 'sm')}<span class="pmg">${maglia(kitOf(m))}</span>
        <div class="ptxt"><b>${esc(m.teamName)}${m.id === me?.id ? ' <em>tu</em>' : ''}</b><span>${esc(m.owner)}${m.viceName ? ` e ${esc(m.viceName)}` : ''} · ${m.role === 'admin' ? 'admin' : 'fantallenatore'}</span>
          <span class="pmeta">rosa ${rosterCount(m)}/25 · ${m.credits} crediti</span></div>
        ${admin && m.id !== me?.id ? `<div class="pact"><button class="chip" data-role="${m.id}:${m.role === 'admin' ? 'fantallenatore' : 'admin'}">${m.role === 'admin' ? 'Togli admin' : 'Fai admin'}</button><button class="chip danger" data-kick="${m.id}" aria-label="Rimuovi">✕</button></div>` : ''}</div>`).join('')}</div>
      ${admin ? `${sec('Rose', 'art. 2')}
      <div class="a-card" style="display:flex;flex-direction:column;gap:10px"><p class="small muted">Il draft assegna 25 giocatori a testa (3P 8D 8C 6A) per quotazione, entro 500 crediti. Poi correggi ogni rosa a mano, o inseriscila tutta a mano dopo l'asta.</p><button class="a-btn${started ? ' sec' : ''}" id="draft">${icon('cart', 'ic sm')}${started ? 'Rigenera le rose' : 'Genera le rose'}</button>${started ? '<p class="small muted" style="text-align:center">Rigenerare sostituisce le rose attuali.</p>' : ''}</div>
      ${started ? `<div class="a-sec"><b>Modifica rose</b><span>tocca un giocatore per rimuoverlo</span></div>${ms.map((m) => `<div class="vlist"><div class="vhead">${esc(m.teamName)} <span>${rosterCount(m)}/25 · crediti ${m.credits}</span></div>${(S.base.rosters[m.id] || []).map((r) => { const p = S.playersById.get(r.playerId); return `<button class="vr" data-rm="${m.id}:${r.playerId}">${roleChip(p.role)}<span class="nm"><b>${esc(p.name)}</b><span>${esc(S.clubsById.get(p.clubId).name)} · pagato ${r.pricePaid}</span></span><span class="ev"></span><span class="fv" style="font-size:12px;color:var(--negative-ink)">✕</span></button>`; }).join('')}<button class="vr" data-add="${m.id}" style="color:var(--primary)"><span class="rl rl-piu">+</span><span class="nm"><b>Aggiungi giocatore</b></span><span class="ev"></span><span></span></button></div>`).join('')}` : ''}` : ''}
      ${S.soPossoEliminareLega() ? `${sec('Elimina la lega', 'solo chi l\'ha creata')}
      <div class="a-card pericolo"><p class="small">Eliminare <b>${esc(L.name)}</b> cancella per sempre squadre, rose, formazioni e contestazioni di tutti. Non si torna indietro.</p>
        <button class="a-btn danger" id="elimina">Elimina la lega</button></div>` : ''}
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('main').addEventListener('click', async (e) => {
      if (e.target.closest('#share-code')) { const text = `Entra nella lega "${S.base.league.name}" del Fantacampionato Sammarinese con il codice ${S.base.league.inviteCode} — ${location.origin}${location.pathname}`; if (navigator.share) { try { await navigator.share({ text }); } catch { /* annullato */ } } else { await navigator.clipboard?.writeText(text); ctx.toast('Invito copiato'); } return; }
      const r = e.target.closest('[data-role]'); if (r) { const [id, role] = r.dataset.role.split(':'); try { await S.setMemberRole(id, role); ctx.toast('Ruolo aggiornato'); } catch (err) { ctx.toast(err.message); } return; }
      const k = e.target.closest('[data-kick]'); if (k && confirm('Rimuovere questo partecipante dalla lega?')) { try { await S.removeMember(k.dataset.kick); } catch (err) { ctx.toast(err.message); } return; }
      if (e.target.closest('#elimina')) {
        const L = S.base.league;
        // Si fa scrivere il nome: un tocco solo non basta per una cosa che
        // cancella anche le squadre degli altri.
        const risposta = prompt(`Questa operazione cancella la lega per tutti e non si puo' annullare.\n\nPer confermare scrivi il nome della lega:\n${L.name}`);
        if (risposta === null) return;
        if (risposta.trim().toLowerCase() !== L.name.trim().toLowerCase()) { ctx.toast('Nome non corrispondente: non ho eliminato niente'); return; }
        try { await S.deleteLeague(); ctx.toast('Lega eliminata'); ctx.go('leghe'); } catch (err) { ctx.toast(err.message); }
        return;
      }
      if (e.target.closest('#draft')) { if (!confirm('Generare le rose per tutti i partecipanti? Le rose attuali vengono sostituite.')) return; try { await S.draftRosters(); ctx.toast('Rose generate'); } catch (err) { ctx.toast(err.message); } return; }
      const rm = e.target.closest('[data-rm]'); if (rm) { const [mid, pid] = rm.dataset.rm.split(':'); if (!confirm(`Togliere ${S.playersById.get(pid).name} dalla rosa?`)) return; try { await S.removeRosterPlayer(mid, pid); } catch (err) { ctx.toast(err.message); } return; }
      const add = e.target.closest('[data-add]'); if (add) {
        const mid = add.dataset.add; const owned = new Set(); for (const m of S.base.managers) for (const x of S.base.rosters[m.id] || []) owned.add(x.playerId);
        const free = S.base.players.filter((p) => p.isActive && !owned.has(p.id)).sort((a, b) => b.quotation - a.quotation);
        ctx.sheet(`<h3>Aggiungi a ${esc(S.managersById.get(mid).teamName)}</h3><input class="field-input" id="add-q" placeholder="Cerca" autocomplete="off"><div class="row2" style="margin-top:8px"><div><label class="lbl" for="add-price">Prezzo</label><input class="field-input" id="add-price" type="number" min="1" value="1"></div></div><div class="plist" id="add-list">${free.slice(0, 200).map((p) => `<button data-pick="${p.id}">${roleChip(p.role)}<span><b>${esc(p.name)}</b><span>${esc(S.clubsById.get(p.clubId).name)}</span></span><span class="q">${p.quotation}</span></button>`).join('')}</div>`);
        const sh = document.getElementById('sheet');
        document.getElementById('add-q').oninput = (x) => { const q = x.target.value.toLowerCase(); sh.querySelectorAll('[data-pick]').forEach((b) => { b.hidden = !S.playersById.get(b.dataset.pick).name.toLowerCase().includes(q); }); };
        sh.onclick = async (x) => { const b = x.target.closest('[data-pick]'); if (!b) return; const price = Math.max(1, +document.getElementById('add-price').value || 1); try { await S.addRosterPlayer(mid, b.dataset.pick, price); ctx.sheet(null); ctx.toast('Aggiunto'); } catch (err) { ctx.toast(err.message); } };
      }
    });
  },
};
