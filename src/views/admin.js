import * as S from '../state.js';
import { computeRating } from '../engine.js';
import { esc, fmt, icon, badge, roleChip, initials, evTile, pic, EV_LABEL, voteRow, dateIt, timeIt } from '../ui.js';

const STATUS = [['played', 'Giocata'], ['postponed', 'Rinviata'], ['suspended_before_45', 'Sospesa <45\''], ['suspended_after_45', 'Sospesa >45\''], ['awarded', 'A tavolino']];
const guard = (ctx, fn) => { try { fn(); } catch (e) { ctx.toast(e.message); } };

// ------------------------------------------------------------ giornata
export const adminGiornata = {
  title: 'Giudice Dati', sub: () => `Giudice Dati · Giornata ${S.currentMatchday()}`,
  render() {
    if (!S.isJudge()) return `<main class="a-body"><div class="empty">${icon('lock')}<p>Solo il Giudice Dati inserisce gli eventi (art. 9.4). Nella modalità con account il ruolo si assegna dal database.</p></div></main>`;
    const n = S.currentMatchday(); const st = S.matchdayStatus(n); const ms = S.matchesOf(n);
    const done = ms.filter((m) => m.status !== 'scheduled').length; const open = S.contestazioni().filter((c) => c.status === 'open');
    return `<main class="a-body">
      <div class="a-card a-fase"><div class="r">${badge(st, `giornata ${n}`)}<b class="num" style="font-size:14px">${done}/8</b></div><div class="prog"><i style="width:${done / 8 * 100}%"></i></div><p class="small muted">Pubblicazione entro dom 23:59 · congelamento mar 20:00. Ogni modifica è loggata (art. 9.3).</p></div>
      <div class="vlist">${ms.map((m) => { const h = S.clubsById.get(m.homeClubId), a = S.clubsById.get(m.awayClubId); const ev = S.eventsOf(m.id).length; const cls = m.status === 'scheduled' ? 'st-td' : ev || m.status !== 'played' ? 'st-ok' : 'st-ip';
        const right = m.status === 'played' ? `<span class="sc">${m.homeGoals} – ${m.awayGoals}</span>` : m.status === 'scheduled' ? '<span class="sc muted">–</span>' : `<span class="sc stato">${STATUS.find((s) => s[0] === m.status)[1].toUpperCase()}</span>`;
        return `<a class="mrow" href="#/admin/partita/${m.id}" style="text-decoration:none;color:inherit"><span class="st ${cls}">${cls === 'st-ok' ? icon('check', 'ic sm') : cls === 'st-ip' ? '●' : ''}</span><div><b>${esc(h.name)} — ${esc(a.name)}</b><span>${m.venue ? `${esc(m.venue)} · ` : ''}${m.status === 'scheduled' ? 'da inserire' : `${ev} ${ev === 1 ? 'evento' : 'eventi'}`}</span></div>${right}${icon('chev', 'ic sm')}</a>`; }).join('')}</div>
      ${open.length ? `<a class="warn info" href="#/admin/contestazioni" style="text-decoration:none">${icon('flag', 'ic sm')}<span><b>${open.length} contestazioni aperte</b> · scadenza mar 18:00</span></a>` : ''}
      ${st === 'frozen' ? `<div class="warn info">${icon('lock', 'ic sm')}<span>Giornata ${n} congelata: nessuna modifica possibile (art. 9.2).</span></div>` : `<a class="a-btn" href="#/admin/congela" style="text-decoration:none">${icon('lock', 'ic sm')}Vai al congelamento</a>`}
      <div class="chips" style="justify-content:center"><a class="chip" href="#/admin/registro" style="text-decoration:none">Registro modifiche</a><a class="chip" href="#/voti/${n}" style="text-decoration:none">Vista pubblica</a></div>
    </main>`;
  },
};

// ------------------------------------------------------------ partita
let step = 1; let side = 'home';
export const adminPartita = {
  title: 'Inserisci eventi', appbar: 'back', nav: false, sub: ({ params }) => { const m = S.match(params.id); return m ? `${S.clubsById.get(m.homeClubId).name} — ${S.clubsById.get(m.awayClubId).name}` : ''; },
  render({ params }) {
    const m = S.match(params.id); if (!m) return '<main class="a-body"><div class="empty"><p>Partita non trovata.</p></div></main>';
    const h = S.clubsById.get(m.homeClubId), a = S.clubsById.get(m.awayClubId); const frozen = S.isFrozen(m.matchday);
    const apps = S.appearancesOf(m.id); const evs = S.eventsOf(m.id); const P = (id) => S.playersById.get(id);
    const clubPlayers = (cid) => S.base.players.filter((p) => p.clubId === cid && p.isActive).sort((x, y) => 'PDCA'.indexOf(x.role) - 'PDCA'.indexOf(y.role) || y.quotation - x.quotation);
    const appOf = (pid) => apps.find((x) => x.playerId === pid);
    const goalsEv = (cid) => evs.filter((e) => (e.type === 'goal' && e.clubId === cid) || (e.type === 'own_goal' && e.clubId !== cid && [m.homeClubId, m.awayClubId].includes(e.clubId))).length;
    const warn = [];
    if (m.status === 'played') { if (goalsEv(m.homeClubId) !== m.homeGoals) warn.push(`${h.name}: ${goalsEv(m.homeClubId)} gol registrati, il risultato dice ${m.homeGoals}`); if (goalsEv(m.awayClubId) !== m.awayGoals) warn.push(`${a.name}: ${goalsEv(m.awayClubId)} gol registrati, il risultato dice ${m.awayGoals}`); }
    const started = (cid) => apps.filter((x) => x.clubId === cid && x.started).length;
    if (m.status === 'played' && (started(m.homeClubId) !== 11 || started(m.awayClubId) !== 11)) warn.push(`Titolari: ${h.name} ${started(m.homeClubId)}/11 · ${a.name} ${started(m.awayClubId)}/11`);

    const steps = `<div class="chips">${[[1, 'Risultato'], [2, `Chi ha giocato · ${apps.length}`], [3, `Eventi · ${evs.length}`], [4, 'Anteprima voti']].map(([i, l]) => `<button class="chip${step === i ? ' on' : ''}" data-step="${i}">${i} · ${l}</button>`).join('')}</div>`;
    let body = '';
    if (step === 1) body = `<div class="a-card"><label class="lbl">Risultato</label>${[[h, 'home', m.homeGoals], [a, 'away', m.awayGoals]].map(([c, k, g]) => `<div class="scorerow"><b>${esc(c.name)}</b><div class="stepper"><button data-g="${k}:-1" ${frozen ? 'disabled' : ''}>−</button><b>${g ?? 0}</b><button data-g="${k}:1" ${frozen ? 'disabled' : ''}>+</button></div></div>`).join('')}</div>
      <div class="a-card"><label class="lbl">Stato gara (art. 10)</label><div class="chipgrid">${STATUS.map(([k, l]) => `<button class="chip${m.status === k ? ' on' : ''}" data-status="${k}" ${frozen ? 'disabled' : ''}>${l}</button>`).join('')}</div><p class="small muted" style="margin-top:8px">Rinviata, sospesa prima del 45' e a tavolino: S.V. per tutti. Sospesa dopo il 45': eventi validi, niente esito né porta inviolata.</p></div>
      <div class="a-card"><label class="lbl">Video Titani.TV</label>${m.videoUrl ? `<a href="${esc(m.videoUrl)}" target="_blank" rel="noopener" class="small">${esc(m.videoUrl)}</a>` : '<span class="small muted">Nessun link</span>'}</div>`;
    else if (step === 2) {
      const cid = side === 'home' ? m.homeClubId : m.awayClubId;
      body = `<div class="seg"><button class="${side === 'home' ? 'on' : ''}" data-side="home">${esc(h.name)} · ${started(m.homeClubId)} tit.</button><button class="${side === 'away' ? 'on' : ''}" data-side="away">${esc(a.name)} · ${started(m.awayClubId)} tit.</button></div>
        <p class="small muted">Tocca = titolare 90'. Tocca di nuovo per minuti e subentro. ${frozen ? 'Giornata congelata.' : ''}</p>
        <div class="chipgrid">${clubPlayers(cid).map((p) => { const ap = appOf(p.id); return `<button class="chip${ap ? ' on' : ' dim'}" data-pl="${p.id}" ${frozen ? 'disabled' : ''}>${p.role} ${esc(p.lastName)}${ap ? ` · ${ap.started ? '' : '↑' + ap.enteredAt + "' "}${ap.minutesPlayed}'` : ''}</button>`; }).join('')}</div>`;
    } else if (step === 3) {
      body = `<div class="tl">${evs.length ? evs.map((e) => { const p = P(e.playerId); return `<div class="te"><span class="min">${e.minute}'</span>${evTile(e.type)}<div><b>${esc(p.name)}</b><span>${esc(S.clubsById.get(e.clubId).name)} · ${EV_LABEL[e.type]}</span></div>${frozen ? '<span></span>' : `<button class="rm" data-rm="${e.id}" aria-label="Elimina">${icon('undo', 'ic sm')}</button>`}</div>`; }).join('') : '<p class="small muted" style="padding:14px">Nessun evento. Usa la tastiera qui sotto: tasto → minuto → giocatore.</p>'}</div>
        ${warn.map((w) => `<div class="warn block">${icon('warn', 'ic sm')}<span>${esc(w)}</span></div>`).join('')}
        <div class="kb" style="margin:auto -16px 0">
          <span class="handle"></span>
          ${[['goal', 'Gol'], ['assist', 'Assist'], ...(S.rules().assistSetPiece ? [['assist_set', 'Assist da fermo']] : []),
             ['own_goal', 'Autogol'], ['yellow', 'Giallo'],
             ['second_yellow', '2° giallo'], ['red_direct', 'Rosso'], ['pen_missed', 'Rig. sbagliato'], ['pen_saved', 'Rig. parato']]
            .map(([k, l]) => `<button class="k" data-ev="${k}" ${frozen ? 'disabled' : ''}>${evTile(k)}${l}</button>`).join('')}
          ${S.rules().level2Events ? `<button class="k" data-ev="pen_won" ${frozen ? 'disabled' : ''}><i>R+</i>Rig. procurato</button><button class="k" data-ev="pen_conceded" ${frozen ? 'disabled' : ''}><i>R−</i>Rig. causato</button>` : ''}
        </div>`;
    } else {
      const ratings = S.ratingsOf(m.matchday); const byP = {}; for (const e of evs) (byP[e.playerId] ||= []).push(e);
      const rows = apps.map((ap) => ({ ap, p: P(ap.playerId), r: ratings.get(ap.playerId) })).sort((x, y) => (x.p.clubId === y.p.clubId ? (y.r?.fantaVote ?? -1) - (x.r?.fantaVote ?? -1) : x.p.clubId === m.homeClubId ? -1 : 1));
      body = `${warn.map((w) => `<div class="warn block">${icon('warn', 'ic sm')}<span>${esc(w)}</span></div>`).join('')}
        <div class="vlist"><div class="vhead">${esc(h.name)} ${m.homeGoals ?? 0} – ${m.awayGoals ?? 0} ${esc(a.name)} <span>anteprima</span></div>${rows.map(({ ap, p, r }) => voteRow(p, S.clubsById.get(p.clubId), r ? { ...r, events: byP[p.id] || [] } : null, { minutes: ap.minutesPlayed })).join('') || '<p class="small muted" style="padding:14px">Nessuna presenza inserita.</p>'}</div>
        <a class="a-btn" href="#/admin" style="text-decoration:none">${icon('check', 'ic sm')}Fatto · torna alla giornata</a>`;
    }
    return `<main class="a-body">${steps}${frozen ? `<div class="warn info">${icon('lock', 'ic sm')}<span>Giornata ${m.matchday} congelata (art. 9.2): sola lettura.</span></div>` : ''}${body}</main>`;
  },
  mount(root, ctx, ) {
    const id = location.hash.split('/').pop(); const m = S.match(id); if (!m) return;
    const P = (pid) => S.playersById.get(pid);
    root.querySelector('main').addEventListener('click', (e) => {
      const st = e.target.closest('[data-step]'); if (st) { step = +st.dataset.step; ctx.render(); return; }
      const sd = e.target.closest('[data-side]'); if (sd) { side = sd.dataset.side; ctx.render(); return; }
      const g = e.target.closest('[data-g]'); if (g) { const [s, d] = g.dataset.g.split(':'); const key = s === 'home' ? 'homeGoals' : 'awayGoals'; guard(ctx, () => S.setMatch(m.id, { [key]: Math.max(0, (m[key] ?? 0) + +d), status: 'played' })); return; }
      const ss = e.target.closest('[data-status]'); if (ss) { guard(ctx, () => S.setMatch(m.id, { status: ss.dataset.status, ...(ss.dataset.status === 'played' ? { homeGoals: m.homeGoals ?? 0, awayGoals: m.awayGoals ?? 0 } : {}) })); return; }
      const pl = e.target.closest('[data-pl]'); if (pl) {
        const pid = pl.dataset.pl; const apps = S.appearancesOf(m.id); const ap = apps.find((x) => x.playerId === pid);
        if (!ap) { guard(ctx, () => S.setAppearances(m.id, [...apps, { matchId: m.id, playerId: pid, clubId: P(pid).clubId, started: true, minutesPlayed: 90, enteredAt: 0 }])); return; }
        ctx.sheet(`<h3>${esc(P(pid).name)}</h3><div class="row2"><div><label class="lbl" for="ap-min">Minuti giocati</label><input class="field-input" id="ap-min" type="number" min="1" max="90" value="${ap.minutesPlayed}"></div><div><label class="lbl" for="ap-in">Entrato al</label><input class="field-input" id="ap-in" type="number" min="0" max="90" value="${ap.started ? 0 : ap.enteredAt}"></div></div>
          <div class="chips" style="margin-top:10px">${[90, 75, 60, 45, 30, 15].map((v) => `<button class="chip" data-preset="${v}">${v}'</button>`).join('')}</div>
          <div class="row2" style="margin-top:12px"><button class="a-btn" id="ap-save">Salva</button><button class="a-btn sec" id="ap-rm">Non ha giocato</button></div>`);
        const sh = document.getElementById('sheet');
        sh.onclick = (ev) => {
          const pr = ev.target.closest('[data-preset]'); if (pr) { document.getElementById('ap-min').value = pr.dataset.preset; return; }
          if (ev.target.closest('#ap-save')) { const min = Math.max(1, Math.min(90, +document.getElementById('ap-min').value || 90)); const inn = Math.max(0, Math.min(89, +document.getElementById('ap-in').value || 0)); guard(ctx, () => S.setAppearances(m.id, apps.map((x) => (x.playerId === pid ? { ...x, minutesPlayed: Math.min(min, 90 - inn), started: inn === 0, enteredAt: inn } : x)))); ctx.sheet(null); }
          if (ev.target.closest('#ap-rm')) { guard(ctx, () => S.setAppearances(m.id, apps.filter((x) => x.playerId !== pid))); ctx.sheet(null); }
        };
        return;
      }
      const rm = e.target.closest('[data-rm]'); if (rm) { guard(ctx, () => S.removeEvent(m.id, rm.dataset.rm)); ctx.toast('Evento eliminato'); return; }
      const ev = e.target.closest('[data-ev]'); if (ev) {
        const type = ev.dataset.ev; const apps = S.appearancesOf(m.id); const last = S.eventsOf(m.id).slice(-1)[0];
        const list = apps.map((x) => P(x.playerId)).filter((p) => type !== 'pen_saved' || p.role === 'P');
        ctx.sheet(`<h3 class="sheet-ev">${evTile(type)} ${EV_LABEL[type]}</h3><label class="lbl" for="ev-min">Minuto</label><input class="field-input" id="ev-min" type="number" min="0" max="90" value="${last ? Math.min(90, last.minute + 1) : 1}"><input class="field-input" id="ev-q" placeholder="Cerca giocatore" style="margin-top:8px" autocomplete="off">
          <div class="plist" id="ev-list">${list.map((p) => `<button data-evp="${p.id}">${roleChip(p.role)}<span><b>${esc(p.name)}</b><span>${esc(S.clubsById.get(p.clubId).name)}</span></span><span></span></button>`).join('')}</div>`);
        const sh = document.getElementById('sheet');
        document.getElementById('ev-q').oninput = (x) => { const q = x.target.value.toLowerCase(); sh.querySelectorAll('[data-evp]').forEach((b) => { b.hidden = !P(b.dataset.evp).name.toLowerCase().includes(q); }); };
        sh.onclick = (x) => {
          const b = x.target.closest('[data-evp]'); if (!b) return;
          const pid = b.dataset.evp; const minute = Math.max(0, Math.min(90, +document.getElementById('ev-min').value || 0));
          guard(ctx, () => {
            S.addEvent(m.id, { playerId: pid, clubId: P(pid).clubId, minute, type });
            if (type === 'second_yellow' || type === 'red_direct') { // art. 7.1: i minuti dell'espulso sono quelli fino al cartellino
              S.setAppearances(m.id, S.appearancesOf(m.id).map((ap) => (ap.playerId === pid ? { ...ap, minutesPlayed: Math.max(1, minute - ap.enteredAt) } : ap)));
            }
            if (type === 'pen_missed') { // chiedi se parato
              const gk = apps.map((y) => P(y.playerId)).find((p) => p.role === 'P' && p.clubId !== P(pid).clubId);
              if (gk && confirm(`Rigore parato da ${gk.name}? (+3,0 al portiere)`)) S.addEvent(m.id, { playerId: gk.id, clubId: gk.clubId, minute, type: 'pen_saved' });
            }
          });
          ctx.sheet(null); ctx.toast(`${EV_LABEL[type]} · ${P(pid).lastName} ${minute}'`);
        };
      }
    });
  },
};

// ------------------------------------------------------------ contestazioni
export const adminContestazioni = {
  title: 'Contestazioni', appbar: 'back', sub: () => 'Contestazioni · scadenza mar 18:00',
  render() {
    const list = S.contestazioni(); const admin = S.isJudge();
    const item = (c) => { const p = S.playersById.get(c.playerId); const m = S.match(c.matchId); const by = S.managersById.get(c.by) || (c.byName ? { owner: c.byName } : null);
      return `<div class="a-card" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(p?.name || '?')}${c.minute != null ? ` · ${c.minute}'` : ''}</b><span class="badge ${c.status === 'open' ? 'badge--prov' : c.status === 'accolta' ? 'badge--live' : 'badge--froz'}" style="padding:2px 8px">${c.status === 'open' ? 'aperta' : c.status}</span></div><span class="small muted">${m ? `${esc(S.clubsById.get(m.homeClubId).name)} — ${esc(S.clubsById.get(m.awayClubId).name)} · ` : ''}${esc(by?.owner || '—')}${c.leagueName ? ` · ${esc(c.leagueName)}` : ''} · ${dateIt(c.at)} ${timeIt(c.at)}</span><p style="font-size:14px">${esc(c.text)}</p>${c.note ? `<p class="small muted">Giudice: ${esc(c.note)}</p>` : ''}
        ${c.status === 'open' && admin ? `<div class="row2"><button class="a-btn sec" data-res="${c.id}:accolta" style="height:40px">Accolta → modifica</button><button class="a-btn sec" data-res="${c.id}:respinta" style="height:40px;border-color:var(--negative);color:var(--negative)">Respinta</button></div>` : ''}</div>`; };
    return `<main class="a-body">${list.length ? list.map(item).join('') : `<div class="empty">${icon('flag')}<p>Nessuna contestazione. Dalla vista Voti, in fase provvisoria, ogni riga ha «Segnala un errore» (art. 9.3).</p></div>`}</main>`;
  },
  mount(root, ctx) {
    root.querySelector('main').addEventListener('click', (e) => {
      const b = e.target.closest('[data-res]'); if (!b) return; const [id, status] = b.dataset.res.split(':');
      const note = prompt(status === 'accolta' ? 'Nota per il registro dei precedenti (art. 9.4)' : 'Motivo del rigetto (obbligatorio)') || '';
      if (status === 'respinta' && !note.trim()) { ctx.toast('Il motivo è obbligatorio'); return; }
      S.resolveContestazione(id, status, note); ctx.toast(status === 'accolta' ? 'Accolta: apri la partita e correggi l\'evento' : 'Respinta e archiviata');
      if (status === 'accolta') { const c = S.contestazioni().find((x) => x.id === id); if (c?.matchId) ctx.go(`admin/partita/${c.matchId}`); }
    });
  },
};

// ------------------------------------------------------------ congela
export const adminCongela = {
  title: 'Congela giornata', appbar: 'none', nav: false,
  render() {
    const n = S.currentMatchday(); const st = S.matchdayStatus(n); const ms = S.matchesOf(n);
    const checks = [[ms.every((m) => m.status !== 'scheduled'), `${ms.filter((m) => m.status !== 'scheduled').length}/8 partite inserite`], [true, 'Punteggi provvisori pubblicati'], [S.contestazioni().every((c) => c.status !== 'open'), `${S.contestazioni().filter((c) => c.status === 'open').length} contestazioni aperte`], [true, `Registro modifiche: ${S.changeLog().length} voci`]];
    const ok = checks.every((c) => c[0]);
    if (st === 'frozen') return `<div class="freeze" style="background:var(--c-titano-700)"><button class="ib" data-back style="align-self:flex-start;border:0;background:transparent;color:#fff;cursor:pointer;display:flex;gap:6px;align-items:center">${icon('chev', 'ic flip')} indietro</button><span class="eyebrow" style="color:rgba(255,255,255,.75)">Giudice Dati · giornata ${n}</span><h2>Giornata congelata</h2><p class="art">Art. 9.2 — Dopo le 20:00 di martedì la giornata è definitiva e non è più rettificabile, nemmeno per errori accertati.</p><div class="chk"><div>${icon('lock')}Formazioni, eventi e voti della giornata ${n} sono immutabili.</div></div><button class="a-btn sec" id="reopen" style="margin-top:auto;color:#fff;border-color:rgba(255,255,255,.6)">Riapri (solo stagione pilota)</button></div>`;
    return `<div class="freeze"><button class="ib" data-back style="align-self:flex-start;border:0;background:transparent;color:#fff;cursor:pointer;display:flex;gap:6px;align-items:center">${icon('chev', 'ic flip')} indietro</button>
      <span class="eyebrow" style="color:rgba(255,255,255,.75)">Giudice Dati · giornata ${n}</span><h2>Congela la giornata</h2>
      <div class="chk">${checks.map(([c, l]) => `<div>${c ? icon('check') : icon('warn')}${l}</div>`).join('')}</div>
      <p class="art"><b>Art. 9.2</b> — Dopo le 20:00 di martedì la giornata è congelata e non è più rettificabile, nemmeno per errori accertati. L'eventuale errore non genera compensazioni nelle giornate successive.</p>
      <input id="freeze-confirm" type="text" placeholder="Scrivi CONGELA per confermare" autocomplete="off" autocapitalize="characters">
      <button class="a-btn" id="freeze" disabled>${icon('lock', 'ic sm')}Congela giornata ${n}</button>${ok ? '' : '<p class="small" style="opacity:.85;text-align:center">Puoi congelare anche con controlli aperti: il regolamento non ammette rettifiche dopo.</p>'}</div>`;
  },
  mount(root, ctx) {
    const inp = root.querySelector('#freeze-confirm'); const btn = root.querySelector('#freeze');
    if (inp) inp.oninput = () => { btn.disabled = inp.value.trim().toUpperCase() !== 'CONGELA'; };
    if (btn) btn.onclick = () => { S.freezeMatchday(S.currentMatchday()); ctx.toast(`Giornata ${S.currentMatchday()} congelata`); };
    root.querySelector('#reopen')?.addEventListener('click', () => { if (confirm('Riaprire la giornata? Solo per la stagione pilota.')) { S.reopenMatchday(S.currentMatchday()); } });
  },
};

// ------------------------------------------------------------ registro
export const adminRegistro = {
  title: 'Registro modifiche', appbar: 'back', sub: () => 'Registro modifiche · chi, quando, cosa',
  render() {
    const log = S.changeLog();
    const line = (l) => { const who = S.managersById.get(l.by)?.owner || (l.by ? 'giudice' : '—'); const m = l.matchId ? S.match(l.matchId) : null; const where = m ? `${S.clubsById.get(m.homeClubId).shortName}–${S.clubsById.get(m.awayClubId).shortName}` : l.matchday ? `G${l.matchday}` : '';
      const what = /:/.test(l.what) ? `${l.what.replace('match_events', 'evento').replace('match_overrides', 'partita').replace(':insert', ' +').replace(':delete', ' −').replace(':update', ' ~')} ${l.payload?.type ? EV_LABEL[l.payload.type] + ' ' + (S.playersById.get(l.payload.player_id)?.lastName || '') + ' ' + l.payload.minute + "'" : l.payload?.status ? `${l.payload.status} ${l.payload.home_goals ?? ''}-${l.payload.away_goals ?? ''}` : ''}` : l.what === 'event+' ? `+ ${EV_LABEL[l.ev.type]} ${S.playersById.get(l.ev.playerId)?.lastName} ${l.ev.minute}'` : l.what === 'event-' ? `− ${EV_LABEL[l.ev?.type] || 'evento'} ${S.playersById.get(l.ev?.playerId)?.lastName || ''}` : l.what === 'match' ? `risultato/stato: ${Object.entries(l.patch).map(([k, v]) => `${k}=${v}`).join(' ')}` : l.what === 'appearances' ? `presenze: ${l.count}` : l.what === 'freeze' ? 'congelamento' : l.what === 'reopen' ? 'riapertura' : l.what === 'contestazione' ? `contestazione ${l.status}` : l.what;
      return `<div class="te"><span class="min">${dateIt(l.at)}<br>${timeIt(l.at)}</span><span class="small" style="font-weight:600">${esc(who)}</span><div><b>${esc(what)}</b><span>${esc(where)}</span></div><span></span></div>`; };
    return `<main class="a-body">${log.length ? `<div class="tl">${log.map(line).join('')}</div>` : `<div class="empty">${icon('archive')}<p>Nessuna modifica registrata su questo dispositivo.</p></div>`}</main>`;
  },
};
