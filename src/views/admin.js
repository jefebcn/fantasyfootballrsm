import * as S from '../state.js';
import {} from '../engine.js';
import { esc, icon, badge, roleChip, evTile, EV_LABEL, voteRow, dateIt, timeIt } from '../ui.js';

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
    // IL RISULTATO NON SI CAMBIA DA QUI, e non e' una restrizione: e' un dato
    // della FSGC, e l'import lo rilegge a ogni giro. Se lo si potesse
    // correggere a mano, la correzione durerebbe fino al prossimo import e
    // poi tornerebbe indietro da sola — il tipo di guasto che fa impazzire,
    // perche' sembra che l'app "si dimentichi".
    //
    // C'erano due pulsanti + e - per lato. Uno di quelli ha lasciato sul
    // database di Alex una sovrascrittura con i gol ospiti nulli, e la
    // giornata mostrava "3 - null".
    //
    // Se la federazione omologa un punteggio diverso (art. 10), quello arriva
    // col prossimo import: non serve una via a mano, serve che l'import giri.
    if (step === 1) body = `<div class="a-card"><label class="lbl">Risultato · dalla FSGC</label>
      <div class="ris-fsgc">
        <span class="sq">${esc(h.name)}</span>
        <b class="sc">${m.realHomeGoals ?? '—'} – ${m.realAwayGoals ?? '—'}</b>
        <span class="sq d">${esc(a.name)}</span>
      </div>
      <p class="small muted" style="margin:8px 0 0">Il risultato arriva dal sito della federazione e si aggiorna con l'import: da qui non si modifica. Quello che si inserisce qui sono <b>gli eventi</b> — chi ha segnato, i minuti, i cartellini.</p>
      ${m.realStatus === 'scheduled' ? `<p class="small muted" style="margin:6px 0 0">Questa partita per la FSGC non è ancora giocata.</p>` : ''}</div>
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
      // I tasti +/- del risultato non ci sono piu': il punteggio e' della FSGC.
      const ss = e.target.closest('[data-status]');
      // Lo stato della gara SI cambia: rinviata, sospesa, a tavolino (art. 10)
      // sono cose che il sito della federazione non dice e che cambiano come
      // si calcolano i voti. Ma non si tocca il punteggio: quello resta suo.
      if (ss) { guard(ctx, () => S.setMatch(m.id, { status: ss.dataset.status })); return; }
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
  // "Calcola la giornata" e non "Congela": e' lo stesso atto che in home si
  // chiama cosi', e due nomi per la stessa cosa facevano sembrare che fossero
  // due. Congelamento resta nel testo dell'art. 9.2, dove e' il termine del
  // regolamento.
  title: 'Calcola giornata', appbar: 'none', nav: false,
  render() {
    const n = S.currentMatchday(); const st = S.matchdayStatus(n); const ms = S.matchesOf(n);
    const checks = [[ms.every((m) => m.status !== 'scheduled'), `${ms.filter((m) => m.status !== 'scheduled').length}/8 partite inserite`], [true, 'Punteggi provvisori pubblicati'], [S.contestazioni().every((c) => c.status !== 'open'), `${S.contestazioni().filter((c) => c.status === 'open').length} contestazioni aperte`], [true, `Registro modifiche: ${S.changeLog().length} voci`],
      // Il lock decide se si puo' ancora schierare e se si vedono le formazioni
      // altrui, e lo applica il server: se le sue date non sono quelle del
      // calendario, il regolamento e' scritto in un posto e applicato in un
      // altro. Va visto, non dato per fatto.
      [S.lockDaSistemare() === 0, S.lockDaSistemare() === 0 ? 'Calendario dei lock allineato sul server'
        : `${S.lockDaSistemare()} giornate con il lock sbagliato sul server`]];
    const ok = checks.every((c) => c[0]);
    if (st === 'frozen') return `<div class="freeze" style="background:var(--c-titano-700)"><button class="ib" data-back style="align-self:flex-start;border:0;background:transparent;color:#fff;cursor:pointer;display:flex;gap:6px;align-items:center">${icon('chev', 'ic flip')} indietro</button><span class="eyebrow" style="color:rgba(255,255,255,.75)">Giudice Dati · giornata ${n}</span><h2>Giornata congelata</h2><p class="art">Art. 9.2 — Dopo le 20:00 di martedì la giornata è definitiva e non è più rettificabile, nemmeno per errori accertati.</p><div class="chk"><div>${icon('lock')}Formazioni, eventi e voti della giornata ${n} sono immutabili.</div></div><button class="a-btn sec" id="reopen" style="margin-top:auto;color:#fff;border-color:rgba(255,255,255,.6)">Riapri (solo stagione pilota)</button></div>`;
    return `<div class="freeze"><button class="ib" data-back style="align-self:flex-start;border:0;background:transparent;color:#fff;cursor:pointer;display:flex;gap:6px;align-items:center">${icon('chev', 'ic flip')} indietro</button>
      <span class="eyebrow" style="color:rgba(255,255,255,.75)">Giudice Dati · giornata ${n}</span><h2>Calcola la giornata</h2>
      <div class="chk">${checks.map(([c, l]) => `<div>${c ? icon('check') : icon('warn')}${l}</div>`).join('')}</div>
      <p class="art"><b>Art. 9.2</b> — Dal calcolo la giornata è <b>congelata</b>: i punteggi sono definitivi e non si rettificano più, nemmeno per errori accertati. L'eventuale errore non genera compensazioni nelle giornate successive.</p>
      <button class="a-btn" id="freeze">${icon('calc', 'ic sm')}Calcola la giornata ${n}</button>${ok ? '' : '<p class="small" style="opacity:.85;text-align:center">Puoi congelare anche con controlli aperti: il regolamento non ammette rettifiche dopo.</p>'}
      ${S.lockDaSistemare() ? `<button class="a-btn sec" id="sync-lock" style="color:#fff;border-color:rgba(255,255,255,.6)">Allinea il calendario dei lock (${S.lockDaSistemare()})</button>` : ''}</div>`;
  },
  mount(root, ctx) {
    const btn = root.querySelector('#freeze');
    const sl = root.querySelector('#sync-lock');
    if (sl) sl.onclick = async () => {
      sl.disabled = true;
      try { const n2 = await S.sincronizzaLock({ forza: true }); ctx.toast(`Calendario allineato · ${n2} giornate`); }
      catch (e) { ctx.toast(e.message || 'Non è stato possibile allineare'); sl.disabled = false; }
      ctx.render();
    };
    // Un tocco e una conferma, invece della parola CONGELA da scrivere a mano.
    // La parola era una guardia contro il tocco distratto, ma su un telefono
    // vuol dire aprire la tastiera, azzeccare le maiuscole e chiuderla: a
    // parita' di difesa, una domanda si' / no costa un decimo. L'atto resta
    // irreversibile e la domanda lo dice.
    if (btn) btn.onclick = () => {
      const n2 = S.currentMatchday();
      if (!confirm(`Calcolare la giornata ${n2}?\n\nI punteggi diventano definitivi e non si rettificano piu' (art. 9.2).`)) return;
      S.freezeMatchday(n2); ctx.toast(`Giornata ${n2} calcolata`);
    };
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


// ------------------------------------------------------------ console app
/**
 * La console di chi amministra l'app.
 *
 * Nasce da una richiesta precisa: "piu' controllo e autonomia — chi accede,
 * problemi con le password, creazione leghe pubbliche, chi ha poteri, leghe
 * private create, dati statistici".
 *
 * Tutto quello che si legge qui passa da funzioni del database che
 * controllano chi chiama (migrazione 014): le leghe altrui e le e-mail la RLS
 * non le farebbe vedere a nessuno, e giustamente.
 *
 * QUELLO CHE NON C'E', e non e' una dimenticanza: cambiare la password di un
 * altro. Servirebbe la chiave di servizio di Supabase nel frontend, cioe' le
 * chiavi del database su ogni telefono. Si manda un link per reimpostarla e
 * se la rifa' la persona — che e' anche l'unico modo in cui resta sua.
 */
let aTab = 'numeri';        // 'numeri' | 'persone' | 'squadre' | 'leghe' | 'sponsor'
let cache = { numeri: null, persone: null, squadre: null, leghe: null, conteggi: null };
let cerca = '';

const quando = (iso) => (iso ? `${dateIt(iso)} ${timeIt(iso)}` : '—');

/**
 * Le iscrizioni degli ultimi quattordici giorni, a colonnine.
 *
 * Serve a rispondere alla domanda che un totale non risponde: sta crescendo o
 * si e' fermata? "Iscritti: 43" e' lo stesso numero il giorno dopo l'apertura
 * e tre settimane dopo, e nel secondo caso vuol dire che nessuno arriva piu'.
 *
 * Si ricava dall'elenco delle persone, che la console sa gia' leggere: niente
 * funzione nuova nel database, e quindi niente migrazione da caricare a mano.
 * Il prezzo e' che si conta su chi sta nell'elenco — duecento persone al
 * massimo, le piu' recenti — e per le iscrizioni degli ultimi quattordici
 * giorni e' esattamente la parte giusta.
 */
function andamento(persone) {
  if (!persone) return '';
  const GIORNI = 14;
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const conta = new Array(GIORNI).fill(0);
  for (const u of persone) {
    if (!u.iscritto) continue;
    const d = new Date(u.iscritto); d.setHours(0, 0, 0, 0);
    const fa = Math.round((oggi - d) / 86400000);
    if (fa >= 0 && fa < GIORNI) conta[GIORNI - 1 - fa]++;
  }
  const max = Math.max(1, ...conta);
  const totale = conta.reduce((a, b) => a + b, 0);
  const et = (i) => { const d = new Date(oggi); d.setDate(d.getDate() - (GIORNI - 1 - i)); return `${d.getDate()}/${d.getMonth() + 1}`; };
  return `<div class="a-sec"><b>Iscrizioni</b><span>${totale} in ${GIORNI} giorni</span></div>
    <div class="a-card adm-graf">${conta.map((v, i) => `<span class="col" title="${et(i)}: ${v}">
      <i style="height:${Math.round(v / max * 100)}%"></i><small>${i === 0 || i === GIORNI - 1 ? et(i) : ''}</small>
      ${v ? `<b>${v}</b>` : ''}</span>`).join('')}</div>
    <p class="small muted" style="margin:-4px 2px 0">Contate sulle persone in elenco (le 100 più recenti). Se una colonna è vuota, quel giorno non si è iscritto nessuno.</p>`;
}

function numeri(r) {
  if (!r) return `<p class="small muted">Sto contando…</p>`;
  const q = [
    ['Iscritti', r.utenti, `${r.iscritti_7_giorni || 0} negli ultimi 7 giorni`],
    ['Leghe', r.leghe, `${r.leghe_pubbliche || 0} pubbliche`],
    ['Squadre', r.squadre, `${r.rose_complete || 0} con la rosa completa`],
    ['Formazioni consegnate', r.formazioni, ''],
    ['Telefoni col push', r.telefoni_push, ''],
    ['Contestazioni aperte', r.contestazioni_aperte, r.contestazioni_aperte ? 'da guardare' : 'nessuna'],
    ['Giornate calcolate', r.giornate_congelate, ''],
    ['Con poteri', (r.amministratori || 0) + (r.giudici || 0), `${r.amministratori || 0} admin · ${r.giudici || 0} giudici`],
  ];
  return `<div class="adm-numeri">${q.map(([et, v, sotto]) => `<div class="adm-n">
    <span class="et">${et}</span><b>${v ?? '—'}</b>${sotto ? `<span class="sotto">${esc(sotto)}</span>` : ''}</div>`).join('')}</div>`;
}

function persone(list) {
  if (!list) return `<p class="small muted">Sto cercando…</p>`;
  if (!list.length) return `<p class="small muted">Nessuno con questo nome o indirizzo.</p>`;
  return `<div class="vlist">${list.map((u) => `<div class="adm-u">
    <div class="riga">
      <span class="nm"><b>${esc(u.nome || '—')}</b><span>${esc(u.email || 'e-mail non disponibile')}</span></span>
      <span class="tag">${u.is_admin ? '<i class="adm">admin</i>' : ''}${u.is_judge ? '<i class="giu">giudice</i>' : ''}${u.sospeso ? '<i class="sos">sospeso</i>' : ''}</span>
    </div>
    <div class="dati">
      <span>iscritto ${quando(u.iscritto)}</span>
      <span>ultimo accesso ${quando(u.ultimo_accesso)}</span>
      <span>${u.email_confermata ? 'e-mail confermata' : '<b>e-mail NON confermata</b>'}</span>
      <span>${u.leghe} ${u.leghe === 1 ? 'lega' : 'leghe'}</span>
    </div>
    <div class="azioni">
      <button class="chip" data-ruolo="is_judge:${esc(u.id)}:${u.is_judge ? 'off' : 'on'}">${u.is_judge ? 'Togli giudice' : 'Fai giudice'}</button>
      <button class="chip" data-ruolo="is_admin:${esc(u.id)}:${u.is_admin ? 'off' : 'on'}">${u.is_admin ? 'Togli admin' : 'Fai admin'}</button>
      ${u.email ? `<button class="chip" data-reset="${esc(u.email)}">Link password</button>` : ''}
      <button class="chip" data-sosp="${esc(u.id)}:${u.sospeso ? 'off' : 'on'}">${u.sospeso ? 'Riattiva' : 'Sospendi'}</button>
    </div></div>`).join('')}</div>`;
}

/**
 * Le squadre, che e' dove stanno i nomi che si vedono in giro.
 *
 * Servono qui perche' il nome di una squadra e quello del fantallenatore li
 * scrive chi gioca e li leggono gli altri — in classifica, sullo scontro,
 * nella scheda che si condivide fuori dall'app. Per moderarne uno bisogna
 * prima trovarlo, e prima di questa scheda l'unico modo era indovinare in
 * quale lega stesse.
 */
function squadre(list) {
  if (!list) return `<p class="small muted">Sto cercando…</p>`;
  if (!list.length) return `<p class="small muted">Nessuna squadra con questo nome.</p>`;
  return `<div class="vlist">${list.map((m) => `<div class="adm-u">
    <div class="riga">
      <span class="nm"><b>${esc(m.squadra || '—')}</b><span>${esc(m.fantallenatore || '—')} · ${esc(m.lega || '—')}</span></span>
      <span class="tag">${m.sospeso ? '<i class="sos">sospeso</i>' : `<i class="giu">${esc(m.iniziali || '')}</i>`}</span>
    </div>
    <div class="dati"><span>creata ${quando(m.creata)}</span></div>
    <div class="azioni">
      <button class="chip" data-rinomina="${esc(m.member_id)}">Rinomina</button>
      <button class="chip" data-sosp="${esc(m.user_id)}:${m.sospeso ? 'off' : 'on'}">${m.sospeso ? 'Riattiva' : 'Sospendi'}</button>
    </div></div>`).join('')}</div>`;
}

function leghe(list) {
  if (!list) return `<p class="small muted">Sto guardando…</p>`;
  if (!list.length) return `<p class="small muted">Nessuna lega.</p>`;
  return `<div class="vlist">${list.map((l) => {
    const premio = (l.premi || []).slice().sort((a, b) => a.posto - b.posto)[0];
    return `<div class="adm-u">
      <div class="riga"><span class="nm"><b>${esc(l.nome)}</b><span>${esc(l.creatore || '—')} · ${quando(l.creata)}</span></span>
        <span class="tag">${l.pubblica ? '<i class="adm">pubblica</i>' : '<i class="giu">privata</i>'}</span></div>
      <div class="dati"><span>${l.membri}${l.pubblica ? `/${l.max_membri}` : ''} squadre</span>
        <span>${l.budget} crediti</span>
        <span>${l.started ? 'rose assegnate' : 'in attesa delle rose'}</span>
        ${premio ? `<span>in palio: ${esc(premio.premio)}</span>` : ''}</div></div>`;
  }).join('')}</div>`;
}

/**
 * Gli sponsor, dalla console.
 *
 * Il modulo e' uno solo: vuoto crea, con un id modifica. Due moduli separati
 * vorrebbero dire due volte gli stessi campi e due volte gli stessi errori.
 */
let spBozza = null;
const oggiISO = () => new Date().toISOString().slice(0, 10);
/**
 * Il rendiconto sotto il nome: e' quello che si porta al rinnovo.
 *
 * Le viste sono giorni-dispositivo, non disegni della schermata: chi apre
 * l'app dieci volte in un giorno vale uno. E' un numero piu' piccolo e piu'
 * difendibile — al primo controllo di uno sponsor serio, l'altro si sgonfia.
 */
function rendiconto(id) {
  const r = S.rendicontoSponsor(id);
  if (!r.viste && !r.tocchi) return '<span class="sp-conti muted">nessuna vista ancora registrata</span>';
  const pct = r.ctr === null ? '—' : `${(r.ctr * 100).toFixed(1).replace('.', ',')}%`;
  const pl = (n, uno, molti) => `<b>${n}</b> ${n === 1 ? uno : molti}`;
  return `<span class="sp-conti">${pl(r.viste, 'vista', 'viste')} · ${pl(r.tocchi, 'tocco', 'tocchi')} · ${pct}
    <span class="muted">(7 giorni: ${r.viste7} / ${r.tocchi7} · ${r.giorni} ${r.giorni === 1 ? 'giorno' : 'giorni'} con dati)</span></span>`;
}
function sponsor() {
  const elenco = S.sponsorTutti();
  const b = spBozza || { nome: '', claim: '', logo: '', link: '', dal: oggiISO(), al: '', attivo: true };
  const oggi = oggiISO();
  const stato = (x) => (!x.attivo ? ['spento', 'sos'] : x.dal > oggi ? ['programmato', ''] : x.al && x.al < oggi ? ['scaduto', 'sos'] : ['in corso', 'ok']);
  return `<div class="adm-sp">
    ${elenco.length ? elenco.map((x) => { const [testo, cls] = stato(x); return `<div class="adm-u">
      <div class="riga">
        <div class="nm"><b>${esc(x.nome)}</b><span>${esc(x.claim || '—')} · dal ${esc(x.dal)}${x.al ? ` al ${esc(x.al)}` : ' (senza scadenza)'}</span></div>
        <span class="tag"><i class="${cls}">${testo}</i></span>
      </div>
      ${rendiconto(x.id)}
      <div class="azioni">
        <button class="chip" data-sp-mod="${esc(x.id)}">Modifica</button>
        <button class="chip" data-sp-del="${esc(x.id)}">Elimina</button>
      </div>
    </div>`; }).join('') : '<p class="small muted">Nessuno spazio venduto, per ora.</p>'}
    <div class="a-sec"><b>${b.id ? 'Modifica' : 'Nuovo'}</b><span>${b.id ? esc(b.nome) : 'spazio sponsor'}</span></div>
    <label class="lbl" for="sp-nome">Nome</label><input class="field-input" id="sp-nome" value="${esc(b.nome)}" maxlength="40" placeholder="Come si chiama">
    <label class="lbl" for="sp-claim">Una riga sotto</label><input class="field-input" id="sp-claim" value="${esc(b.claim)}" maxlength="60" placeholder="es. Dal 1972 a Borgo Maggiore">
    <label class="lbl" for="sp-logo">Logo (indirizzo)</label><input class="field-input" id="sp-logo" value="${esc(b.logo)}" placeholder="/media/sponsor/nome.png">
    <label class="lbl" for="sp-link">Dove porta</label><input class="field-input" id="sp-link" value="${esc(b.link)}" placeholder="https://…">
    <div class="sp-date">
      <span><label class="lbl" for="sp-dal">Dal</label><input class="field-input" id="sp-dal" type="date" value="${esc(b.dal)}"></span>
      <span><label class="lbl" for="sp-al">Al (vuoto = sempre)</label><input class="field-input" id="sp-al" type="date" value="${esc(b.al || '')}"></span>
    </div>
    <label class="lbl"><input type="checkbox" id="sp-attivo" ${b.attivo ? 'checked' : ''}> Acceso</label>
    <div class="chips" style="margin-top:10px"><button class="a-btn" id="sp-salva">${b.id ? 'Salva le modifiche' : 'Aggiungi'}</button>
      ${b.id ? '<button class="chip" id="sp-annulla">Annulla</button>' : ''}</div>
  </div>`;
}

export const adminConsole = {
  title: 'Console', appbar: 'back', sub: () => 'Amministrazione dell\'app',
  render() {
    if (!S.isAdmin()) {
      return `<main class="a-body"><div class="empty">${icon('lock')}<p>Questa console è di chi amministra l'app.</p>
        <p class="small muted">Il primo amministratore si nomina dal database, non da qui: se si potesse dall'app, chiunque si darebbe i poteri da solo.</p></div></main>`;
    }
    const barra = `<div class="segwrap"><div class="seg seg-cls">
      <button class="${aTab === 'numeri' ? 'on' : ''}" data-atab="numeri">Numeri</button>
      <button class="${aTab === 'persone' ? 'on' : ''}" data-atab="persone">Persone</button>
      <button class="${aTab === 'squadre' ? 'on' : ''}" data-atab="squadre">Squadre</button>
      <button class="${aTab === 'leghe' ? 'on' : ''}" data-atab="leghe">Leghe</button>
      <button class="${aTab === 'sponsor' ? 'on' : ''}" data-atab="sponsor">Sponsor</button></div></div>`;
    let corpo = '';
    if (aTab === 'numeri') corpo = numeri(cache.numeri) + andamento(cache.persone);
    else if (aTab === 'persone') {
      corpo = `<input class="field-input" id="adm-cerca" placeholder="Cerca per nome o e-mail" value="${esc(cerca)}" autocomplete="off">
        ${persone(cache.persone)}`;
    } else if (aTab === 'squadre') {
      corpo = `<input class="field-input" id="adm-cerca" placeholder="Cerca per squadra, fantallenatore o lega" value="${esc(cerca)}" autocomplete="off">
        ${squadre(cache.squadre)}`;
    } else if (aTab === 'sponsor') corpo = sponsor();
    else corpo = leghe(cache.leghe);
    return `<main class="a-body">${barra}
      ${aTab === 'numeri' ? `<div class="a-sec"><b>Come va</b><span>adesso</span></div>` : ''}
      ${corpo}
      ${aTab === 'persone' ? `<p class="small muted">«Link password» manda alla persona un messaggio per reimpostarla da sé: la password non la può leggere né scrivere nessuno, nemmeno da qui. «Sospendi» le impedisce di schierare, contestare ed entrare in altre leghe: le squadre e i punti restano.</p>` : ''}
      ${aTab === 'sponsor' ? `<p class="small muted">Una <b>vista</b> è un dispositivo in un giorno, non un disegno della schermata: chi apre l'app dieci volte oggi conta uno. Non si registra chi guarda: per ogni sponsor c'è una riga al giorno con due numeri, e nient'altro.</p>
        <p class="small muted">Le date fanno il lavoro da sole: lo sponsor compare il giorno che comincia e sparisce il giorno dopo la scadenza, senza che nessuno debba ricordarsene. Il logo può stare nel repository (<code>/media/sponsor/nome.png</code>) o essere un indirizzo esterno.</p>` : ''}
      ${aTab === 'squadre' ? `<p class="small muted">Si comincia sempre da «Rinomina»: toglie subito il nome da tutte le schermate e chi l'ha scritto continua a giocare. «Sospendi» è per chi ne scrive un altro.</p>` : ''}
    </main>`;
  },
  mount(root, ctx) {
    if (!S.isAdmin()) return;
    const carica = async () => {
      try {
        if (aTab === 'numeri' && !cache.numeri) { cache.numeri = await S.adminRiepilogo(); ctx.render(); }
        // l'andamento si disegna sull'elenco delle persone: la scheda dei
        // numeri lo chiede una volta e poi resta in cache come le altre
        if (aTab === 'numeri' && !cache.persone) { cache.persone = await S.adminPersone(null, 100); ctx.render(); }
        if (aTab === 'leghe' && !cache.leghe) { cache.leghe = await S.adminLeghe(200); ctx.render(); }
        if (aTab === 'persone' && !cache.persone) { cache.persone = await S.adminPersone(cerca, 100); ctx.render(); }
        if (aTab === 'squadre' && !cache.squadre) { cache.squadre = await S.adminSquadre(cerca, 100); ctx.render(); }
        // I conteggi (018): una volta per apertura della console. Se la
        // migrazione non c'e' ancora tornano vuoti e la scheda funziona lo
        // stesso — si vede "nessuna vista", non un errore.
        if (aTab === 'sponsor' && !cache.conteggi) { cache.conteggi = await S.caricaConteggiSponsor(); ctx.render(); }
      } catch (e) { ctx.toast(e.message || 'Non è stato possibile leggere'); }
    };
    carica();
    const inp = root.querySelector('#adm-cerca');
    if (inp) {
      // Si cerca alla pressione di Invio, non a ogni lettera: ogni ricerca e'
      // una richiesta al database e scrivere "Alessandro" ne farebbe undici.
      inp.onkeydown = async (e) => {
        if (e.key !== 'Enter') return;
        cerca = inp.value; cache.persone = null; cache.squadre = null;
        try {
          if (aTab === 'squadre') cache.squadre = await S.adminSquadre(cerca, 100);
          else cache.persone = await S.adminPersone(cerca, 100);
        } catch (err) { ctx.toast(err.message); }
        ctx.render();
      };
    }
    root.querySelector('main').addEventListener('click', async (e) => {
      const t = e.target.closest('[data-atab]');
      if (t) { aTab = t.dataset.atab; ctx.render(); return; }
      const mod = e.target.closest('[data-sp-mod]');
      if (mod) { spBozza = { ...S.sponsorTutti().find((x) => x.id === mod.dataset.spMod) }; ctx.render(); return; }
      const del = e.target.closest('[data-sp-del]');
      if (del) {
        const chi = S.sponsorTutti().find((x) => x.id === del.dataset.spDel);
        if (!confirm(`Eliminare lo spazio di ${chi ? chi.nome : 'questo sponsor'}? Sparisce dall'app subito.`)) return;
        try { await S.eliminaSponsor(del.dataset.spDel); spBozza = null; ctx.toast('Eliminato'); ctx.render(); }
        catch (err) { ctx.toast(err.message || 'Non è stato possibile'); }
        return;
      }
      if (e.target.closest('#sp-annulla')) { spBozza = null; ctx.render(); return; }
      if (e.target.closest('#sp-salva')) {
        const v = (id) => root.querySelector(id)?.value.trim() || '';
        const dati = { id: spBozza?.id, nome: v('#sp-nome'), claim: v('#sp-claim'), logo: v('#sp-logo'),
          link: v('#sp-link'), dal: v('#sp-dal') || oggiISO(), al: v('#sp-al'), attivo: !!root.querySelector('#sp-attivo')?.checked };
        if (!dati.nome) { ctx.toast('Serve almeno il nome'); return; }
        if (dati.al && dati.al < dati.dal) { ctx.toast('La fine viene prima dell\'inizio'); return; }
        try { await S.salvaSponsor(dati); spBozza = null; ctx.toast('Salvato'); ctx.render(); }
        catch (err) { ctx.toast(err.message || 'Non è stato possibile salvare'); }
        return;
      }
      const r = e.target.closest('[data-ruolo]');
      if (r) {
        const [ruolo, id, verso] = r.dataset.ruolo.split(':');
        const nome = (cache.persone || []).find((u) => u.id === id)?.nome || 'questa persona';
        const che = ruolo === 'is_admin' ? 'amministratore dell\'app' : 'Giudice Dati';
        if (!confirm(`${verso === 'on' ? 'Dare' : 'Togliere'} a ${nome} i poteri di ${che}?`)) return;
        r.disabled = true;
        try {
          await S.adminImpostaRuolo(id, ruolo, verso === 'on');
          cache.persone = await S.adminPersone(cerca, 100); cache.numeri = null;
          ctx.toast('Fatto'); ctx.render();
        } catch (err) { ctx.toast(err.message || 'Non è stato possibile'); r.disabled = false; }
        return;
      }
      // Sospendere e riattivare. La conferma dice cosa comporta, perche'
      // "sospendi" da solo non dice se l'account viene cancellato.
      const sp = e.target.closest('[data-sosp]');
      if (sp) {
        const [id, verso] = sp.dataset.sosp.split(':');
        const chi = (cache.persone || []).find((u) => u.id === id)?.nome
          || (cache.squadre || []).find((m) => m.user_id === id)?.fantallenatore || 'questa persona';
        const domanda = verso === 'on'
          ? `Sospendere ${chi}? Non potrà più schierare, contestare né entrare in altre leghe. Le squadre e i punti restano, e la sospensione si può togliere.`
          : `Riattivare ${chi}?`;
        if (!confirm(domanda)) return;
        sp.disabled = true;
        try {
          await S.adminSospendi(id, verso === 'on');
          if (cache.persone) cache.persone = await S.adminPersone(cerca, 100);
          if (cache.squadre) cache.squadre = await S.adminSquadre(cerca, 100);
          ctx.toast(verso === 'on' ? 'Sospeso' : 'Riattivato'); ctx.render();
        } catch (err) { ctx.toast(err.message || 'Non è stato possibile'); sp.disabled = false; }
        return;
      }
      // Rinominare: il nome nuovo si chiede col prompt del sistema e non con
      // un foglio, perche' e' un campo solo e va fatto in fretta — un nome
      // offensivo sta online mentre si cerca il bottone.
      const rn = e.target.closest('[data-rinomina]');
      if (rn) {
        const id = rn.dataset.rinomina;
        const sq = (cache.squadre || []).find((m) => m.member_id === id);
        const nome = prompt(`Nuovo nome per «${sq?.squadra || 'questa squadra'}»`, sq?.squadra || '');
        if (nome === null || !nome.trim()) return;
        rn.disabled = true;
        try {
          await S.adminRinomina(id, nome.trim());
          cache.squadre = await S.adminSquadre(cerca, 100);
          ctx.toast('Rinominata'); ctx.render();
        } catch (err) { ctx.toast(err.message || 'Non è stato possibile'); rn.disabled = false; }
        return;
      }
      const rs = e.target.closest('[data-reset]');
      if (rs) {
        const mail = rs.dataset.reset;
        if (!confirm(`Mandare a ${mail} il link per reimpostare la password?`)) return;
        rs.disabled = true;
        try { await S.mandaResetPassword(mail); ctx.toast('Link mandato'); }
        catch (err) { ctx.toast(err.message || 'Non è stato possibile mandarlo'); }
        rs.disabled = false;
      }
    });
  },
};
