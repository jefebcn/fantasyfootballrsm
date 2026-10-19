/**
 * Mock minimale di supabase-js per lo smoke test end-to-end del flusso remoto (senza rete).
 * Emula auth OTP, query builder in memoria, rpc create_league/join_league, realtime no-op.
 */
/* Persistenza: il client vero usa persistSession, quindi senza questo il mock
   non permette di provare cosa vede l'utente RICARICANDO la pagina. */
const CHIAVE = 'fcs:mock';
const salvato = (() => { try { return JSON.parse(localStorage.getItem(CHIAVE) || '{}'); } catch { return {}; } })();
const tables = salvato.tables || {};
const T = (n) => (tables[n] ||= []);
let userId = salvato.userId || null; const authListeners = [];
const persisti = () => { try { localStorage.setItem(CHIAVE, JSON.stringify({ tables, userId })); } catch { /* quota */ } };
const uid = () => 'u' + Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
// I Reclutatori (023) esistono solo se la prova lo chiede: le altre prove
// girano come un database senza la 023, e cosi' provano anche quel caso.
const con023 = () => typeof window !== 'undefined' && !!window.__MOCK_023__;
const campi023 = () => (con023() ? { reclutati: 0, invitato_da: null, invito_contato_at: null, created_at: now() } : {});
// Come conta_reclutato() del database: una volta sola, e solo se gioca.
function contaReclutato(id) {
  if (!con023()) return;
  const p = T('profiles').find((x) => x.id === id);
  if (!p || !p.invitato_da || p.invito_contato_at || !T('league_members').some((m) => m.user_id === id)) return;
  p.invito_contato_at = now();
  const chi = T('profiles').find((x) => x.id === p.invitato_da); if (chi) chi.reclutati = (chi.reclutati || 0) + 1;
}

function builder(table) {
  const filters = []; let op = 'select'; let cols = '*'; let payload = null; let single = false; let maybe = false; let orderBy = []; let lim = null; let da = null; let a = null; 
  const apply = (rows) => rows.filter((r) => filters.every((f) => f(r)));
  const b = {
    select(c) { if (op === 'select') cols = c || '*'; return b; },   // il finto server torna sempre le righe
    eq(k, v) { filters.push((r) => r[k] === v); return b; },
    // "is null" in SQL prende anche le colonne mai scritte. Qui invece
    // undefined === null e' falso, quindi .is('released_at', null) scartava
    // TUTTE le righe delle rose: le prove col browser girano da sempre con le
    // rose vuote, e nessuna se n'era accorta perche' le schermate si
    // disegnavano comunque.
    gte(k, v) { filters.push((r) => r[k] >= v); return b; },
    is(k, v) { filters.push((r) => (v === null ? r[k] === null || r[k] === undefined : r[k] === v)); return b; },
    in(k, vs) { filters.push((r) => vs.includes(r[k])); return b; },
    order(k, o) { orderBy.push([k, o?.ascending !== false]); return b; },
    limit(n) { lim = n; return b; },
    range(x, y) { da = x; a = y; return b; },
    single() { single = true; return b; }, maybeSingle() { maybe = true; return b; },
    insert(rows) { op = 'insert'; payload = rows; return b; },
    upsert(rows) { op = 'upsert'; payload = rows; return b; },
    update(patch) { op = 'update'; payload = patch; return b; },
    delete() { op = 'delete'; return b; },
    then(res, rej) {
      // la rete vera ha una latenza per richiesta: con __RITARDO_QUERY__ la
      // si simula, per misurare quante richieste l'app fa una dopo l'altra
      const ritardo = typeof window !== 'undefined' ? window.__RITARDO_QUERY__ : 0;
      if (ritardo) { setTimeout(() => esegui(res, rej), ritardo); return; }
      esegui(res, rej);
    },
  };
  function esegui(res) {
    {
      try {
        let data = null; const rows = T(table);
        const pk = { lineups: ['league_id', 'member_id', 'matchday'], match_overrides: ['match_id'], match_appearances: ['match_id', 'player_id'], matchday_status: ['matchday'], matchday_locks: ['matchday'], profiles: ['id'], app_interruttori: ['chiave'], giocatori_esclusi: ['player_id'], squalifiche: ['player_id', 'matchday'] }[table] || ['id'];
        const withDefaults = (r) => ({ id: uid(), created_at: now(), ...r });
        // __MOCK_SESSIONE_PERSA__: il token e' scaduto e la rete non l'ha
        // rinnovato, le richieste partono come anonimo. Come Supabase vero: i
        // profili non si vedono e scriverne uno lo rifiuta la RLS.
        // Come dalla 026: dei profili si leggono solo id, nome e amici
        // portati. Il resto (anche select('*')) lo rifiuta il database.
        if (table === 'profiles' && op === 'select' && String(cols).split(',').some((c) => !['id', 'display_name', 'reclutati'].includes(c.trim()))) {
          res({ data: null, error: { code: '42501', message: 'permission denied for table profiles' } }); return;
        }
        // i nomi della lega leggono i profili: da anonimo, rifiutati (026)
        if (globalThis.__MOCK_SESSIONE_PERSA__ && table === 'league_members' && op === 'select' && /profiles/.test(cols)) {
          res({ data: null, error: { code: '42501', message: 'permission denied for table profiles' } }); return;
        }
        if (globalThis.__MOCK_SESSIONE_PERSA__ && table === 'profiles') {
          if (op === 'select') { res({ data: (single || maybe) ? null : [], error: null }); return; }
          if (op === 'upsert' || op === 'insert') { res({ data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "profiles"' } }); return; }
        }
        if (op === 'select') { data = apply(rows).map(expand); if (orderBy.length) data.sort((x, y) => { for (const [k, su] of orderBy) { if (x[k] !== y[k]) return (x[k] > y[k] ? 1 : -1) * (su ? 1 : -1); } return 0; });
          if (da !== null) data = data.slice(da, a + 1);
          if (lim) data = data.slice(0, lim);
          // come Supabase: al massimo max_rows righe per richiesta (1000), il
          // resto non arriva e nessuno lo dice. Le prove possono abbassarlo.
          data = data.slice(0, globalThis.__MAX_RIGHE__ ?? 1000); }
        if (op === 'insert') { const list = (Array.isArray(payload) ? payload : [payload]).map(withDefaults); guardFrozen(table, list); if (table === 'adesioni_giocatori') list.forEach((r) => sigillo(r, null)); if (table === 'prove_consenso') list.forEach((r) => { r.id = T('prove_consenso').length + 1; r.impronta = Math.random().toString(16).slice(2).padEnd(64, '0'); r.caricata_at = now(); r.caricata_da = userId; }); rows.push(...list); data = list.map(expand); }
        if (op === 'upsert' && table === 'profiles') globalThis.__mockProfiloScritto = true;
        if (op === 'upsert') { const list = (Array.isArray(payload) ? payload : [payload]); guardFrozen(table, list); for (const r of list) { const i = rows.findIndex((x) => pk.every((k) => x[k] === r[k])); if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push(withDefaults(r)); } data = list; }
        if (op === 'update') { data = []; for (const r of rows) if (filters.every((f) => f(r))) { const prima = { ...r }; Object.assign(r, payload); if (table === 'adesioni_giocatori') sigillo(r, prima); data.push(expand(r)); } }
        if (op === 'delete') { const del = apply(rows); guardFrozen(table, del); tables[table] = rows.filter((r) => !del.includes(r)); data = del; }
        if (single || maybe) data = data[0] || null;
        if (single && !data) throw new Error('no rows');
        if (op !== 'select') persisti();
        res({ data, error: null });
      } catch (e) { res({ data: null, error: { message: e.message } }); }
    }
  }
  return b;
}
// Il consenso dei calciatori (044), come i trigger del database: data, IP e
// dispositivo li scrive il server, chi verifica pure, e ogni passaggio va nel
// registro con la sua impronta (qui finta: le impronte vere le prova l'SQL).
function sigillo(r, prima) {
  if (!prima) {
    r.id = T('adesioni_giocatori').length + 1;
    Object.assign(r, { created_at: now(), ip: '127.0.0.1', dispositivo: (typeof navigator !== 'undefined' && navigator.userAgent) || 'prova', stato: r.stato || 'attesa' });
  } else if (r.stato === 'verificato' && prima.stato !== 'verificato') { r.verificato_at = now(); r.verificato_da = userId; }
  const ev = !prima ? 'inviata' : (r.ritirato_at && !prima.ritirato_at) ? 'ritirata'
    : (r.stato === 'verificato' && prima.stato !== 'verificato') ? 'verificata' : (r.stato === 'respinto' && prima.stato !== 'respinto') ? 'respinta' : null;
  if (!ev) return;
  const reg = T('consensi_registro'); const prec = reg.length ? reg[reg.length - 1].impronta : null;
  reg.push({ id: reg.length + 1, adesione_id: r.id, evento: ev, chi: prima ? userId : null, quando: now(), dati: { ...r },
    impronta_prec: prec, impronta: Math.random().toString(16).slice(2).padEnd(64, '0') });
}
function guardFrozen(table, list) {
  // 037: nella lega pubblica la formazione si consegna con la rosa completa.
  if (table === 'lineups') {
    for (const r of list) {
      const lega = T('leagues').find((l) => l.id === r.league_id);
      if (!lega || !lega.pubblica) continue;
      const serve = Object.values({ P: 3, D: 8, C: 8, A: 6, ...(lega.rules?.roster || {}) }).reduce((x, y) => x + y, 0);
      const ha = T('rosters').filter((x) => x.member_id === r.member_id && !x.released_at).length;
      if (ha < serve) throw new Error(`Nella lega pubblica la formazione si consegna con la rosa completa: hai ${ha} giocatori su ${serve}. Completala dal Negozio.`);
    }
    return;
  }
  if (!['match_events', 'match_appearances', 'match_overrides'].includes(table)) return;
  for (const r of list) { const n = +((r.match_id || '').match(/^md(\d+)/) || [])[1]; if (T('matchday_status').some((s) => s.matchday === n && s.status === 'frozen')) throw new Error(`Giornata ${n} congelata (art. 9.2)`); }
}
function expand(r) {
  const out = { ...r };
  if ('league_id' in r && !('league' in out)) out.league = T('leagues').find((l) => l.id === r.league_id) || null;
  if ('user_id' in r) out.profile = T('profiles').find((p) => p.id === r.user_id) || null;
  if ('member_id' in r) out.member = T('league_members').find((m) => m.id === r.member_id) || null;
  return out;
}
export function createClient(_url, _key, opts) {
  if (opts && opts.accessToken) { Promise.resolve(opts.accessToken()).then((t) => { globalThis.__lastAccessToken = t; }); }
  return {
    auth: {
      async getSession() {
        // con la sessione persa, la prima lettura (quella dell'avvio) trova
        // ancora la sessione in memoria; dopo, il rinnovo fallisce
        if (globalThis.__MOCK_SESSIONE_PERSA__ && (globalThis.__mockLettureSessione = (globalThis.__mockLettureSessione || 0) + 1) > 1) return { data: { session: null } };
        return { data: { session: userId ? { user: { id: userId, email: T('profiles').find((p) => p.id === userId)?.email } } : null } };
      },
      async getUser() { return { data: { user: { id: userId, email: T('profiles').find((p) => p.id === userId)?.email } } }; },
      async signInWithOtp({ email }) { globalThis.__lastOtpEmail = email; return { data: {}, error: null }; },
      async signUp({ email, password, options }) {
        // Come il vero Supabase: con la conferma e-mail accesa un indirizzo gia'
        // iscritto NON da' errore (non si rivela chi e' iscritto): torna un
        // utente senza «identities», senza sessione, e nessuna mail parte.
        if (T('profiles').some((x) => x.email === email)) {
          if (globalThis.__MOCK_CONFIRM__) { return { data: { user: { id: uid(), email, identities: [] }, session: null }, error: null }; }
          return { data: null, error: { message: 'User already registered' } };
        }
        if (!password || password.length < 6) return { data: null, error: { message: 'Password should be at least 6 characters' } };
        const p = { id: uid(), email, password, display_name: options?.data?.display_name || email.split('@')[0], is_judge: T('profiles').length === 0, ...campi023() };
        T('profiles').push(p); persisti();
        // l'indirizzo a cui tornera' la conferma e-mail: le prove guardano che
        // porti il codice d'invito, quando c'e'
        globalThis.__ULTIMO_RITORNO__ = options?.emailRedirectTo || null;
        if (globalThis.__MOCK_CONFIRM__) return { data: { user: { id: p.id, email }, session: null }, error: null };
        userId = p.id; persisti();
        authListeners.forEach((fn) => fn('SIGNED_IN', { user: { id: userId, email } }));
        return { data: { user: { id: p.id, email }, session: { user: { id: p.id, email } } }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const p = T('profiles').find((x) => x.email === email && x.password === password);
        if (!p) return { data: null, error: { message: 'Invalid login credentials' } };
        userId = p.id; persisti(); authListeners.forEach((fn) => fn('SIGNED_IN', { user: { id: userId, email } }));
        return { data: { user: { id: p.id, email }, session: {} }, error: null };
      },
      async signInWithOAuth({ provider }) { globalThis.__lastOAuth = provider; return { data: { url: 'about:blank' }, error: null }; },
      async resetPasswordForEmail(email) { globalThis.__lastResetEmail = email; return { data: {}, error: null }; },
      async updateUser({ password }) { const p = T('profiles').find((x) => x.id === userId); if (p) p.password = password; persisti(); return { data: { user: { id: userId } }, error: null }; },
      async verifyOtp({ email, token }) { if (token !== '123456') return { data: null, error: { message: 'Codice errato' } }; let p = T('profiles').find((x) => x.email === email); if (!p) { p = { id: uid(), email, display_name: email.split('@')[0], is_judge: T('profiles').length === 0, ...campi023() }; T('profiles').push(p); } userId = p.id; persisti(); authListeners.forEach((fn) => fn('SIGNED_IN', { user: { id: userId, email } })); return { data: { user: { id: userId } }, error: null }; },
      async signOut() { userId = null; persisti(); authListeners.forEach((fn) => fn('SIGNED_OUT', null)); },
      onAuthStateChange(fn) { authListeners.push(fn); },
    },
    from: builder,

    async rpc(name, args) {
      try {
        // I calciatori col bollino (044): aperta anche a chi non ha un account.
        // L'ultima richiesta verificata di ognuno decide.
        if (name === 'giocatori_aderenti') {
          const ultima = new Map();
          T('adesioni_giocatori').filter((r) => r.stato === 'verificato' && r.player_id)
            .sort((x, y) => String(x.verificato_at).localeCompare(String(y.verificato_at)))
            .forEach((r) => ultima.set(r.player_id, r.ritirato_at ? 'ritirato' : r.scelta));
          return { data: [...ultima].filter(([, sc]) => sc === 'aderisco').map(([pid]) => pid), error: null };
        }
        if (name === 'conta_banner') {
          const giorno = new Date().toISOString().slice(0, 10);
          const r = T('banner_conteggi').find((x) => x.giorno === giorno && x.evento === args.p_evento);
          if (r) r.n++; else T('banner_conteggi').push({ giorno, evento: args.p_evento, n: 1 });
          // Si scrive SOLO il contatore, dentro quello che c'e' gia' salvato: il
          // banner si conta all'apertura della Home, e un persisti() qui
          // riscriveva tutto il finto database con la copia in memoria,
          // cancellando i dati che le prove avevano appena preparato.
          try {
            const salv = JSON.parse(localStorage.getItem(CHIAVE) || '{}');
            salv.tables = salv.tables || {}; salv.tables.banner_conteggi = T('banner_conteggi');
            localStorage.setItem(CHIAVE, JSON.stringify(salv));
          } catch { /* quota */ }
          return { data: null, error: null };
        }
        if (name === 'verifica_registro') return { data: { righe: T('consensi_registro').length, integro: true, prima_rotta: null }, error: null };
        // Il contatore dello sponsor (018) sta PRIMA del controllo
        // dell'account: nel vero si puo' chiamare anche da anonimo, e una
        // prova che lo chiama sempre da iscritto non proverebbe quel caso.
        // La finestra e' la stessa del database: fuori non si conta e non si
        // sbaglia, si torna indietro e basta.
        // Gli errori dei telefoni (022): anche questa porta e' aperta a chi
        // non ha un account. Stesse regole della funzione vera: una riga per
        // errore al giorno col suo contatore, e le e-mail che si cancellano.
        if (name === 'segnala_errore') {
          const posta = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
          const m = String(args.p_messaggio || '').trim().slice(0, 300).replace(posta, '[e-mail]');
          if (!m) return { data: null, error: null };
          const giorno = new Date().toISOString().slice(0, 10);
          const v = String(args.p_versione || '').slice(0, 40); const sc = String(args.p_schermata || '').slice(0, 60);
          const gia = T('errori_app').find((e) => e.giorno === giorno && e.messaggio === m && e.versione === v && e.schermata === sc);
          if (gia) { gia.quante++; gia.ultimo = now(); }
          else T('errori_app').push({ id: uid(), giorno, primo: now(), ultimo: now(), quante: 1, messaggio: m,
            dettaglio: String(args.p_dettaglio || '').slice(0, 1200).replace(posta, '[e-mail]'), versione: v, schermata: sc,
            dispositivo: String(args.p_dispositivo || '').slice(0, 60) });
          persisti(); return { data: null, error: null };
        }
        if (name === 'conta_sponsor') {
          if (args.p_tipo !== 'vista' && args.p_tipo !== 'tocco') throw new Error('tipo sconosciuto: ' + args.p_tipo);
          const oggi = new Date().toISOString().slice(0, 10);
          const sp = T('sponsor').find((x) => x.id === args.p_sponsor);
          if (!sp || sp.attivo === false || sp.dal > oggi || (sp.al && sp.al < oggi)) return { data: null, error: null };
          // 021: lo sponsor di una lega lo conta solo chi ci gioca dentro. Se
          // qui fosse piu' largo, una prova direbbe che il rendiconto regge
          // mentre in produzione il database non conta niente.
          if (sp.lega_id && !T('league_members').some((m) => m.league_id === sp.lega_id && m.user_id === userId)) {
            return { data: null, error: null };
          }
          let riga = T('sponsor_conteggi').find((x) => x.sponsor_id === args.p_sponsor && x.giorno === oggi);
          if (!riga) { riga = { sponsor_id: args.p_sponsor, giorno: oggi, viste: 0, tocchi: 0 }; T('sponsor_conteggi').push(riga); }
          if (args.p_tipo === 'vista') riga.viste++; else riga.tocchi++;
          persisti(); return { data: null, error: null };
        }
        if (!userId) throw new Error('non autenticato');
        // Il negozio della lega aperta (019). Le regole sono quelle della
        // funzione vera, nello stesso ordine: se qui fossero piu' larghe, la
        // prova direbbe che si puo' fare una cosa che in produzione il
        // database rifiuta.
        if (name === 'mercato_aperto' || name === 'compra_giocatore' || name === 'vendi_giocatore') {
          // La rete vera non risponde subito: le prove lo simulano per
          // guardare che lo schermo non la aspetti.
          if (name !== 'mercato_aperto' && typeof window !== 'undefined' && window.__RITARDO_RPC__) await new Promise((r) => setTimeout(r, window.__RITARDO_RPC__));
          const lega = T('leagues').find((l) => l.id === args.p_league);
          const mio = T('league_members').find((m) => m.league_id === args.p_league && m.user_id === userId);
          const aperto = () => {
            if (!lega || !lega.pubblica || !mio) return false;
            // 039: una finestra di riparazione aperta adesso
            if (T('finestre_mercato').some((f) => new Date(f.inizio) <= new Date() && new Date() <= new Date(f.fine))) return true;
            const entrato = new Date(mio.created_at || 0);
            const prossimi = T('matchday_locks').filter((k) => new Date(k.lock_at) > entrato)
              .sort((a, b) => a.matchday - b.matchday);
            return prossimi.length ? new Date(prossimi[0].lock_at) > new Date() : false;
          };
          if (name === 'mercato_aperto') return { data: aperto(), error: null };
          if (!mio) throw new Error('Non sei in questa lega');
          if (!lega.pubblica) throw new Error("In questa lega la rosa si fa con l'asta, non dal negozio");
          const mie = () => T('rosters').filter((r) => r.league_id === args.p_league && r.member_id === mio.id && !r.released_at);
          // 037: chi ha la rosa incompleta puo' sempre COMPRARE (vendere no).
          const serve = Object.values({ P: 3, D: 8, C: 8, A: 6, ...(lega.rules?.roster || {}) }).reduce((x, y) => x + y, 0);
          // 038: finche' la rosa non e' completa si vende anche, per liberare crediti.
          if (!aperto() && mie().length >= serve) throw new Error('Il mercato è chiuso: la tua prima giornata è già cominciata');
          if (name === 'vendi_giocatore') {
            const r = mie().find((x) => x.player_id === args.p_player);
            if (!r) throw new Error('Questo giocatore non è in rosa');
            tables.rosters = T('rosters').filter((x) => x !== r);
            mio.credits += r.price_paid;
            // 040: le formazioni ancora da giocare che lo contengono si tolgono
            const aperta = (n) => !T('matchday_locks').some((k) => k.matchday === n && new Date(k.lock_at) <= new Date());
            const prima = T('lineups').length;
            tables.lineups = T('lineups').filter((l) => !(l.member_id === mio.id && aperta(l.matchday)
              && [...(l.lineup?.starters || []), ...(l.lineup?.bench || [])].includes(args.p_player)));
            const tolte = prima - tables.lineups.length;
            persisti();
            return { data: { player_id: args.p_player, reso: r.price_paid, crediti: mio.credits, formazioni_tolte: tolte }, error: null };
          }
          const q = T('quotazioni').find((x) => x.player_id === args.p_player);
          if (!q) throw new Error(`Giocatore sconosciuto (${args.p_player})`);
          if (mie().some((x) => x.player_id === args.p_player)) throw new Error("Ce l'hai già in rosa");
          const quote = { P: 3, D: 8, C: 8, A: 6, ...(lega.rules?.roster || {}) };
          const quanti = mie().filter((x) => (T('quotazioni').find((z) => z.player_id === x.player_id) || {}).ruolo === q.ruolo).length;
          if (quanti >= quote[q.ruolo]) throw new Error(`Hai già ${quote[q.ruolo]} giocatori in quel ruolo: è il massimo`);
          if (mio.credits < q.quotazione) throw new Error(`Ti restano ${mio.credits} crediti e ne servono ${q.quotazione}`);
          // 038: riserva crediti per completare la rosa coi giocatori meno cari
          const ruoloDi = (id) => (T('quotazioni').find((z) => z.player_id === id) || {}).ruolo;
          const ho = new Set(mie().map((x) => x.player_id));
          let riserva = 0;
          for (const r of Object.keys(quote)) {
            const vuoti = Math.max(0, quote[r] - mie().filter((x) => ruoloDi(x.player_id) === r).length - (r === q.ruolo ? 1 : 0));
            const prezzi = T('quotazioni').filter((z) => z.ruolo === r && !ho.has(z.player_id)).map((z) => z.quotazione);
            riserva += vuoti * (prezzi.length ? Math.min(...prezzi) : 0);
          }
          if (mio.credits - q.quotazione < riserva) throw new Error(`Riserva crediti: dopo questo acquisto te ne resterebbero ${mio.credits - q.quotazione}, ma ne servono almeno ${riserva} per completare la rosa coi giocatori meno cari`);
          T('rosters').push({ id: uid(), league_id: args.p_league, member_id: mio.id, player_id: args.p_player,
            price_paid: q.quotazione, released_at: null });
          mio.credits -= q.quotazione; persisti();
          return { data: { player_id: args.p_player, prezzo: q.quotazione, crediti: mio.credits }, error: null };
        }
        const prof = T('profiles').find((p) => p.id === userId);
        if (name === 'registra_invito') {
          if (!con023()) throw new Error('function public.registra_invito(p_da => text) does not exist');
          const io = T('profiles').find((x) => x.id === userId); const da = String(args.p_da || '').trim();
          let esito;
          if (!da || !T('profiles').some((x) => x.id === da)) esito = 'sconosciuto';
          else if (da === userId) esito = 'se-stesso';
          else if (io.invitato_da) esito = 'gia';
          else if (Date.now() - new Date(io.created_at || 0).getTime() > 7 * 86400000) esito = 'tardi';
          else { io.invitato_da = da; contaReclutato(userId); esito = 'ok'; }
          globalThis.__ULTIMO_INVITO__ = esito;
          persisti(); return { data: esito, error: null };
        }
        if (name === 'create_league') { const l = { id: uid(), name: args.p_name, short_name: args.p_short, invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(), rules: {}, started: false, created_by: userId, created_at: now() }; T('leagues').push(l); T('league_members').push({ id: uid(), league_id: l.id, user_id: userId, role: 'admin', team_name: args.p_team, owner_name: prof.display_name, color: args.p_color, initials: args.p_initials, credits: 500, created_at: now() }); contaReclutato(userId); persisti(); return { data: l.id, error: null }; }
        // Chiudere la giornata (008): il finto database applica le stesse tre
        // condizioni del vero, se no la prova passa dove il server direbbe di
        // no. Qui mancava del tutto, e il pezzo di prova che ci contava non
        // girava mai — il tasto restava spento per altri motivi.
        if (name === 'chiudi_giornata') {
          const n = args.p_matchday;
          if (!T('league_members').some((m) => m.user_id === userId)) throw new Error('Solo chi è in una lega può chiudere la giornata');
          if (T('matchday_status').some((x) => x.matchday === n && x.status === 'frozen')) throw new Error(`La giornata ${n} è già chiusa`);
          const gare = new Set(T('match_events').map((e) => e.match_id).filter((id) => +((id.match(/^md(\d+)_m/) || [])[1]) === n));
          if (!gare.size) throw new Error(`La giornata ${n} non ha ancora nessun evento: non c'è niente da chiudere`);
          const riga = T('matchday_status').find((x) => x.matchday === n);
          if (riga) { riga.status = 'frozen'; riga.changed_at = now(); riga.changed_by = userId; }
          else T('matchday_status').push({ matchday: n, status: 'frozen', changed_by: userId, changed_at: now() });
          persisti(); return { data: null, error: null };
        }
        // --- console amministrativa (014)
        const amministro = () => !!T('profiles').find((x) => x.id === userId)?.is_admin;
        if (name === 'admin_riepilogo') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          return { data: {
            utenti: T('profiles').length,
            giudici: T('profiles').filter((x) => x.is_judge).length,
            amministratori: T('profiles').filter((x) => x.is_admin).length,
            leghe: T('leagues').length,
            leghe_pubbliche: T('leagues').filter((l) => l.pubblica).length,
            squadre: T('league_members').length,
            rose_complete: 0, formazioni: T('lineups').length,
            telefoni_push: T('push_subscriptions').filter((x) => !x.failed_at).length,
            contestazioni_aperte: T('contestazioni').filter((c) => c.status === 'open').length,
            giornate_congelate: T('matchday_status').filter((m) => m.status === 'frozen').length,
            iscritti_7_giorni: T('profiles').length,
            // 020: la serie delle consegne. Stesse due regole del database:
            // solo le giornate col lock passato, e il denominatore preso al
            // momento della chiusura, non di oggi.
            consegne: T('matchday_locks')
              .filter((l) => new Date(l.lock_at) <= new Date(now()))
              .sort((x, y) => y.matchday - x.matchday).slice(0, 10)
              .sort((x, y) => x.matchday - y.matchday)
              .map((l) => ({
                giornata: l.matchday,
                consegne: T('lineups').filter((x) => x.matchday === l.matchday).length,
                squadre: T('league_members').filter((m) => new Date(m.created_at || 0) <= new Date(l.lock_at)).length,
              })),
          }, error: null };
        }
        // 015: le persone portano anche "sospeso", le squadre si cercano e si
        // rinominano, e la sospensione la impone il vero database — qui si
        // riproducono i controlli che la migrazione fa nel corpo delle funzioni.
        if (name === 'admin_persone') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          const q = (args.p_cerca || '').trim().toLowerCase();
          return { data: T('profiles')
            .filter((p2) => !q || (p2.display_name || '').toLowerCase().includes(q) || (p2.email || '').toLowerCase().includes(q))
            .map((p2) => ({ id: p2.id, nome: p2.display_name, email: p2.email || `${p2.id}@example.org`,
              is_judge: !!p2.is_judge, is_admin: !!p2.is_admin, sospeso: !!p2.sospeso,
              iscritto: p2.created_at || now(),
              ultimo_accesso: p2.created_at || now(), email_confermata: p2.created_at || now(),
              leghe: T('league_members').filter((m) => m.user_id === p2.id).length,
              squadre: T('league_members').filter((m) => m.user_id === p2.id).length })), error: null };
        }
        // 030: chi non ha confermato l'e-mail (sul vero database: auth.users
        // senza email_confirmed_at). Le prove lo mettono in «da_confermare».
        if (name === 'admin_da_confermare') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          return { data: T('da_confermare').filter((u) => !u.confermata), error: null };
        }
        if (name === 'admin_risolvi_errore') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          const r = T('errori_app').find((e) => String(e.id) === String(args.p_id));
          if (!r) return { data: 0, error: null };
          const prima = T('errori_app').length;
          const resto = T('errori_app').filter((e) => e.messaggio !== r.messaggio);
          T('errori_app').length = 0; T('errori_app').push(...resto); persisti();
          return { data: prima - resto.length, error: null };
        }
        if (name === 'admin_conferma_email') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          const u = T('da_confermare').find((x) => x.id === args.p_user);
          if (!u) throw new Error('Account non trovato');
          const gia = !!u.confermata; u.confermata = now(); persisti();
          return { data: { email: u.email, gia, avvisato: !gia }, error: null };
        }
        if (name === 'admin_squadre') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          const q = (args.p_cerca || '').trim().toLowerCase();
          const dentro = (v) => (v || '').toLowerCase().includes(q);
          return { data: T('league_members')
            .filter((m) => { const l = T('leagues').find((x) => x.id === m.league_id) || {};
              const p2 = T('profiles').find((x) => x.id === m.user_id) || {};
              return !q || dentro(m.team_name) || dentro(m.owner_name) || dentro(p2.display_name) || dentro(l.name); })
            .map((m) => { const l = T('leagues').find((x) => x.id === m.league_id) || {};
              const p2 = T('profiles').find((x) => x.id === m.user_id) || {};
              return { member_id: m.id, squadra: m.team_name, fantallenatore: m.owner_name || p2.display_name || null,
                iniziali: m.initials, lega: l.name, league_id: m.league_id, user_id: m.user_id,
                sospeso: !!p2.sospeso, creata: m.created_at }; }), error: null };
        }
        if (name === 'admin_rinomina') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          const nome = (args.p_squadra || '').trim();
          if (!nome) throw new Error('La squadra ha bisogno di un nome');
          const m = T('league_members').find((x) => x.id === args.p_member);
          if (!m) throw new Error('Squadra non trovata');
          m.team_name = nome;
          m.initials = (nome.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '').split(/\s+/).filter(Boolean)
            .map((w) => w[0]).join('').slice(0, 3).toUpperCase()) || 'FC';
          if ((args.p_fantallenatore || '').trim()) m.owner_name = args.p_fantallenatore.trim();
          persisti(); return { data: true, error: null };
        }
        if (name === 'admin_sospendi') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          const u = T('profiles').find((x) => x.id === args.p_user);
          if (!u) throw new Error('Utente non trovato');
          if (args.p_user === userId && args.p_on) throw new Error('Non puoi sospendere te stesso');
          if (args.p_on && u.is_admin) throw new Error("E' un amministratore: prima togligli l'amministrazione, poi sospendilo");
          u.sospeso = !!args.p_on; persisti(); return { data: true, error: null };
        }
        if (name === 'admin_utenti') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          const q = (args.p_cerca || '').trim().toLowerCase();
          return { data: T('profiles')
            .filter((p2) => !q || (p2.display_name || '').toLowerCase().includes(q) || (p2.email || '').toLowerCase().includes(q))
            .map((p2) => ({ id: p2.id, nome: p2.display_name, email: p2.email || `${p2.id}@example.org`,
              is_judge: !!p2.is_judge, is_admin: !!p2.is_admin, iscritto: p2.created_at || now(),
              ultimo_accesso: p2.created_at || now(), email_confermata: p2.created_at || now(),
              leghe: T('league_members').filter((m) => m.user_id === p2.id).length,
              squadre: T('league_members').filter((m) => m.user_id === p2.id).length })), error: null };
        }
        if (name === 'admin_leghe') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          return { data: T('leagues').map((l) => ({ id: l.id, nome: l.name, pubblica: !!l.pubblica,
            membri: T('league_members').filter((m) => m.league_id === l.id).length,
            max_membri: l.max_membri || 12, budget: l.rules?.budget ?? 500, premi: l.premi || [],
            started: !!l.started, creata: l.created_at,
            creatore: T('profiles').find((x) => x.id === l.created_by)?.display_name || null })), error: null };
        }
        // 033: il proprietario, come nel vero database
        if (name === 'proprietario_app') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          return { data: T('profiles').find((x) => x.is_owner)?.id || null, error: null };
        }
        if (name === 'admin_imposta_ruolo') {
          if (!amministro()) throw new Error("Serve essere amministratore dell'app");
          if (!['is_judge', 'is_admin'].includes(args.p_ruolo)) throw new Error(`Ruolo sconosciuto: ${args.p_ruolo}`);
          const u = T('profiles').find((x) => x.id === args.p_user);
          if (!u) throw new Error('Utente non trovato');
          if (u.is_owner) throw new Error("È il proprietario dell'app: i suoi poteri non si toccano");
          if (args.p_ruolo === 'is_admin' && !T('profiles').find((x) => x.id === userId)?.is_owner) {
            throw new Error("Solo il proprietario dell'app nomina o toglie gli amministratori");
          }
          if (args.p_user === userId && args.p_ruolo === 'is_admin' && !args.p_on) {
            throw new Error('Non puoi togliere a te stesso l\'amministrazione: fallo fare a un altro amministratore');
          }
          u[args.p_ruolo] = !!args.p_on; persisti(); return { data: true, error: null };
        }

        // --- lega pubblica (013)
        if (name === 'crea_lega_pubblica') {
          if (!T('profiles').find((x) => x.id === userId)?.is_admin) {
            throw new Error("Le leghe pubbliche le apre chi amministra l'app");
          }
          const l = { id: uid(), name: args.p_name, short_name: args.p_short, invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
            rules: { budget: args.p_budget }, season_id: 's2026', started: false, created_by: userId, created_at: now(),
            pubblica: true, classifica: 'punti', premi: args.p_premi || [], max_membri: args.p_max };
          T('leagues').push(l);
          T('league_members').push({ id: uid(), league_id: l.id, user_id: userId, role: 'admin', team_name: args.p_team,
            owner_name: prof.display_name, color: args.p_color, initials: args.p_initials, credits: args.p_budget, created_at: now() });
          persisti(); return { data: l.id, error: null };
        }
        if (name === 'entra_lega_pubblica') {
          const l = T('leagues').find((x) => x.id === args.p_league);
          if (!l) throw new Error('Lega non trovata');
          if (!l.pubblica) throw new Error("Questa lega non e' pubblica: serve il codice invito");
          const dentro = T('league_members').filter((m) => m.league_id === l.id);
          if (!dentro.some((m) => m.user_id === userId)) {
            if (dentro.length >= l.max_membri) throw new Error(`Lega al completo (${dentro.length} su ${l.max_membri})`);
            T('league_members').push({ id: uid(), league_id: l.id, user_id: userId, team_name: args.p_team, role: 'fantallenatore',
              owner_name: prof.display_name, color: args.p_color, initials: args.p_initials,
              credits: l.rules?.budget ?? 500, created_at: now() });
          }
          contaReclutato(userId); persisti(); return { data: l.id, error: null };
        }
        if (name === 'leghe_pubbliche') {
          return { data: T('leagues').filter((l) => l.pubblica).map((l) => ({
            id: l.id, name: l.name, short_name: l.short_name, premi: l.premi || [],
            membri: T('league_members').filter((m) => m.league_id === l.id).length,
            max_membri: l.max_membri, budget: l.rules?.budget ?? 500, creata: l.created_at,
            dentro: T('league_members').some((m) => m.league_id === l.id && m.user_id === userId),
          })), error: null };
        }
        if (name === 'imposta_premi') {
          const l = T('leagues').find((x) => x.id === args.p_league);
          if (!l) throw new Error('Lega non trovata');
          const mio = T('league_members').find((m) => m.league_id === l.id && m.user_id === userId);
          if (!mio || mio.role !== 'admin') throw new Error('Solo chi amministra la lega puo cambiare i premi');
          const pr = (args.p_premi || []).map((x, i) => {
            const posto = parseInt(x.posto, 10);
            if (!(posto >= 1 && posto <= 99)) throw new Error(`Premio ${i + 1}: il posto e un numero da 1 a 99`);
            if (!String(x.premio || '').trim()) throw new Error(`Premio ${i + 1}: manca la descrizione`);
            return { posto, premio: String(x.premio).trim() };
          });
          l.premi = pr; persisti(); return { data: pr, error: null };
        }
        // 026: il proprio profilo intero (gli altri ne leggono solo nome e amici)
        // mio_profilo e' solo per chi e' entrato: da anonimo la rifiuta (026)
        if (name === 'mio_profilo' && globalThis.__MOCK_SESSIONE_PERSA__) return { data: null, error: { code: '42501', message: 'permission denied for function mio_profilo' } };
        // __MOCK_PROFILO_ASSENTE__: il primo accesso, quando l'utente c'e' ma
        // il profilo no — lo crea il client (001). Finche' non lo scrive,
        // mio_profilo non trova niente, senza errore.
        if (name === 'mio_profilo' && globalThis.__MOCK_PROFILO_ASSENTE__ && !globalThis.__mockProfiloScritto) return { data: null, error: null };
        // __MOCK_SCADE_DOPO_PROFILO__: il profilo arriva, poi la sessione cade
        if (name === 'mio_profilo' && globalThis.__MOCK_SCADE_DOPO_PROFILO__) { globalThis.__MOCK_SCADE_DOPO_PROFILO__ = false; globalThis.__MOCK_SESSIONE_PERSA__ = true; globalThis.__mockLettureSessione = 1; return { data: T('profiles').find((x) => x.id === userId) || null, error: null }; }
        if (name === 'mio_profilo') { return { data: T('profiles').find((x) => x.id === userId) || null, error: null }; }
        if (name === 'join_league') { const l = T('leagues').find((x) => x.invite_code === args.p_code.toUpperCase()); if (!l) throw new Error('Codice invito non valido'); if (!T('league_members').some((m) => m.league_id === l.id && m.user_id === userId)) T('league_members').push({ id: uid(), league_id: l.id, user_id: userId, role: 'fantallenatore', team_name: args.p_team, owner_name: prof.display_name, color: args.p_color, initials: args.p_initials, credits: 500, created_at: now() }); contaReclutato(userId); persisti(); return { data: l.id, error: null }; }
        if (name === 'sync_matchday_locks') {
          // Interruttore per provare il caso in cui la sincronizzazione fallisce
          // e deve essere riprovata al giro dopo. Solo nel mock.
          if (typeof window !== 'undefined' && window.__rompiSync) throw new Error('rete giu (finto)');
          // Come sul server: solo il Giudice Dati, e riscrive solo cio' che cambia.
          if (!prof?.is_judge) throw new Error('solo il Giudice Dati puo aggiornare il calendario dei lock');
          const t = T('matchday_locks'); let n = 0;
          for (const e of args.p || []) {
            const riga = t.find((x) => x.matchday === e.matchday);
            if (!riga) { t.push({ matchday: e.matchday, lock_at: e.lock_at, updated_at: now(), updated_by: userId }); n++; }
            else if (riga.lock_at !== e.lock_at) { riga.lock_at = e.lock_at; riga.updated_at = now(); n++; }
          }
          persisti(); return { data: n, error: null };
        }
        // --- scambi: le stesse regole del server (006-scambi.sql), perche' una
        // prova che passa su regole piu' larghe di quelle vere non prova niente
        const mioMembro = (lega) => T('league_members').find((m) => m.league_id === lega && m.user_id === userId);
        const inRosa = (lega, membro, pid) => T('rosters').some((r) => r.league_id === lega && r.member_id === membro && r.player_id === pid && !r.released_at);
        const verifica = (lega, da, a, offre, chiede, crediti) => {
          if (!offre.length && !chiede.length && !crediti) throw new Error('Uno scambio vuoto non si puo proporre');
          if (offre.length !== chiede.length) throw new Error(`Lo scambio deve muovere lo stesso numero di giocatori per parte: ${offre.length}, contro ${chiede.length}`);
          if (new Set(offre).size !== offre.length || new Set(chiede).size !== chiede.length) throw new Error('Lo stesso giocatore compare due volte nella proposta');
          if (offre.some((x) => chiede.includes(x))) throw new Error('Un giocatore non puo stare da entrambe le parti');
          for (const pid of offre) if (!inRosa(lega, da, pid)) throw new Error(`Il giocatore ${pid} non e (piu) nella tua rosa`);
          for (const pid of chiede) if (!inRosa(lega, a, pid)) throw new Error(`Il giocatore ${pid} non e (piu) nella rosa dell'altra squadra`);
          const mDa = T('league_members').find((m) => m.id === da), mA = T('league_members').find((m) => m.id === a);
          if (mDa.credits - crediti < 0) throw new Error(`Non hai abbastanza crediti: ne hai ${mDa.credits}, ne servono ${crediti}`);
          if (mA.credits + crediti < 0) throw new Error(`L'altra squadra non ha abbastanza crediti: ne ha ${mA.credits}, ne servono ${-crediti}`);
        };
        if (name === 'proponi_scambio') {
          const lega = args.p_league; const mio = mioMembro(lega);
          if (!mio) throw new Error('Non fai parte di questa lega');
          if (mio.id === args.p_a_member) throw new Error('Non puoi scambiare con te stesso');
          if (!T('league_members').some((m) => m.id === args.p_a_member && m.league_id === lega)) throw new Error('La squadra scelta non e di questa lega');
          if (T('trades').some((t) => t.league_id === lega && t.stato === 'proposta' && t.da_member === mio.id && t.a_member === args.p_a_member)) {
            throw new Error('Hai gia una proposta aperta verso questa squadra');
          }
          const offre = args.p_offre || [], chiede = args.p_chiede || [], crediti = args.p_crediti || 0;
          verifica(lega, mio.id, args.p_a_member, offre, chiede, crediti);
          const t = { id: uid(), league_id: lega, da_member: mio.id, a_member: args.p_a_member, offre, chiede, crediti, stato: 'proposta', nota: args.p_nota || null, creato_at: now() };
          T('trades').push(t); persisti(); return { data: t.id, error: null };
        }
        if (name === 'accetta_scambio' || name === 'rifiuta_scambio' || name === 'annulla_scambio') {
          const t = T('trades').find((x) => x.id === args.p_id);
          if (!t) throw new Error('Proposta non trovata');
          if (t.stato !== 'proposta') throw new Error(`Questa proposta e gia stata ${t.stato}`);
          const mio = mioMembro(t.league_id);
          if (name === 'annulla_scambio') {
            if (!mio || mio.id !== t.da_member) throw new Error('Solo chi ha proposto puo ritirare');
            t.stato = 'annullata';
          } else {
            if (!mio || mio.id !== t.a_member) throw new Error(`Solo la squadra a cui e rivolta puo ${name === 'accetta_scambio' ? 'accettare' : 'rifiutare'}`);
            if (name === 'rifiuta_scambio') t.stato = 'rifiutata';
            else {
              verifica(t.league_id, t.da_member, t.a_member, t.offre, t.chiede, t.crediti);
              for (const r of T('rosters')) {
                if (r.league_id !== t.league_id || r.released_at) continue;
                if (r.member_id === t.da_member && t.offre.includes(r.player_id)) r.member_id = t.a_member;
                else if (r.member_id === t.a_member && t.chiede.includes(r.player_id)) r.member_id = t.da_member;
              }
              const mDa = T('league_members').find((m) => m.id === t.da_member), mA = T('league_members').find((m) => m.id === t.a_member);
              mDa.credits -= t.crediti; mA.credits += t.crediti;
              t.stato = 'accettata';
              const toccati = new Set([...t.offre, ...t.chiede]);
              for (const altro of T('trades')) {
                if (altro.id === t.id || altro.stato !== 'proposta' || altro.league_id !== t.league_id) continue;
                if ([...altro.offre, ...altro.chiede].some((x) => toccati.has(x))) altro.stato = 'annullata';
              }
            }
          }
          t.deciso_at = now(); t.deciso_da = userId; persisti(); return { data: null, error: null };
        }
        // --- mercato svincolati: stesse regole di 007-mercato-svincolati.sql
        const svincolato = (lega, pid) => !T('rosters').some((r) => r.league_id === lega && r.player_id === pid && !r.released_at);
        if (name === 'e_svincolato') return { data: svincolato(args.p_league, args.p_player), error: null };
        if (name === 'offri') {
          const lega = args.p_league; const mio = mioMembro(lega);
          if (!mio) throw new Error('Non fai parte di questa lega');
          if (args.p_crediti < 1) throw new Error("L'offerta e almeno 1 credito");
          if (!svincolato(lega, args.p_player)) throw new Error('Questo giocatore e gia in una rosa');
          const impegni = T('offerte').filter((o) => o.league_id === lega && o.member_id === mio.id && o.stato === 'aperta' && o.player_id !== args.p_player)
            .reduce((s, o) => s + o.crediti, 0);
          if (mio.credits < args.p_crediti + impegni) throw new Error(`Non ti bastano i crediti: ne hai ${mio.credits}, contando le offerte gia aperte`);
          if (T('rosters').filter((r) => r.league_id === lega && r.member_id === mio.id && !r.released_at).length >= 25) throw new Error('La tua rosa e gia di 25 giocatori');
          const su = T('offerte').filter((o) => o.league_id === lega && o.player_id === args.p_player && o.stato === 'aperta');
          const migliore = su.length ? Math.max(...su.map((o) => o.crediti)) : null;
          if (migliore !== null && args.p_crediti <= migliore) throw new Error(`Devi superare l'offerta piu alta, che e di ${migliore} crediti`);
          for (const o of su) if (o.member_id === mio.id) { o.stato = 'ritirata'; o.chiusa_at = now(); }
          // la finestra la apre la prima offerta e non si allunga coi rilanci
          const scade = su.length ? su.map((o) => o.scade_at).sort()[0] : new Date(Date.now() + 24 * 3600e3).toISOString();
          const o = { id: uid(), league_id: lega, member_id: mio.id, player_id: args.p_player, crediti: args.p_crediti, stato: 'aperta', creata_at: now(), scade_at: scade };
          T('offerte').push(o); persisti(); return { data: o.id, error: null };
        }
        if (name === 'ritira_offerta') {
          const o = T('offerte').find((x) => x.id === args.p_id);
          if (!o) throw new Error('Offerta non trovata');
          if (o.stato !== 'aperta') throw new Error(`Questa offerta e gia ${o.stato}`);
          const mio = mioMembro(o.league_id);
          if (!mio || mio.id !== o.member_id) throw new Error('Non e la tua offerta');
          o.stato = 'ritirata'; o.chiusa_at = now(); persisti(); return { data: null, error: null };
        }
        if (name === 'risolvi_offerte') {
          const lega = args.p_league;
          if (!mioMembro(lega)) throw new Error('Non fai parte di questa lega');
          let n = 0;
          const scadute = [...new Set(T('offerte').filter((o) => o.league_id === lega && o.stato === 'aperta' && new Date(o.scade_at) <= new Date()).map((o) => o.player_id))];
          for (const pid of scadute) {
            const chiudi = (stato) => { for (const o of T('offerte')) if (o.league_id === lega && o.player_id === pid && o.stato === 'aperta') { o.stato = stato; o.chiusa_at = now(); } };
            if (!svincolato(lega, pid)) { chiudi('persa'); continue; }
            let assegnato = false;
            for (;;) {
              const aperte = T('offerte').filter((o) => o.league_id === lega && o.player_id === pid && o.stato === 'aperta')
                .sort((a, b) => b.crediti - a.crediti || new Date(a.creata_at) - new Date(b.creata_at));
              if (!aperte.length) break;
              const v = aperte[0];
              const m = T('league_members').find((x) => x.id === v.member_id);
              const rosa = T('rosters').filter((r) => r.league_id === lega && r.member_id === v.member_id && !r.released_at).length;
              if (m.credits < v.crediti || rosa >= 25) { v.stato = 'persa'; v.chiusa_at = now(); continue; }
              T('rosters').push({ id: uid(), league_id: lega, member_id: v.member_id, player_id: pid, price_paid: v.crediti, released_at: null });
              m.credits -= v.crediti; v.stato = 'vinta'; v.chiusa_at = now();
              chiudi('persa'); assegnato = true; n++; break;
            }
            if (!assegnato) chiudi('persa');
          }
          persisti(); return { data: n, error: null };
        }
        throw new Error('rpc sconosciuta ' + name);
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
    channel() { const c = { on() { return c; }, subscribe() { return c; } }; return c; },
    removeChannel() {},
  };
}
