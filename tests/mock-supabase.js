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

function builder(table) {
  const filters = []; let op = 'select'; let payload = null; let single = false; let maybe = false; let orderBy = null; let lim = null; 
  const apply = (rows) => rows.filter((r) => filters.every((f) => f(r)));
  const b = {
    select() { return b; },   // il finto server torna sempre le righe
    eq(k, v) { filters.push((r) => r[k] === v); return b; },
    is(k, v) { filters.push((r) => r[k] === v); return b; },
    order(k, o) { orderBy = [k, o?.ascending !== false]; return b; },
    limit(n) { lim = n; return b; },
    single() { single = true; return b; }, maybeSingle() { maybe = true; return b; },
    insert(rows) { op = 'insert'; payload = rows; return b; },
    upsert(rows) { op = 'upsert'; payload = rows; return b; },
    update(patch) { op = 'update'; payload = patch; return b; },
    delete() { op = 'delete'; return b; },
    then(res, rej) {
      try {
        let data = null; const rows = T(table);
        const pk = { lineups: ['league_id', 'member_id', 'matchday'], match_overrides: ['match_id'], match_appearances: ['match_id', 'player_id'], matchday_status: ['matchday'], matchday_locks: ['matchday'], profiles: ['id'] }[table] || ['id'];
        const withDefaults = (r) => ({ id: uid(), created_at: now(), ...r });
        if (op === 'select') { data = apply(rows).map(expand); if (orderBy) data.sort((a, b) => (a[orderBy[0]] > b[orderBy[0]] ? 1 : -1) * (orderBy[1] ? 1 : -1)); if (lim) data = data.slice(0, lim); }
        if (op === 'insert') { const list = (Array.isArray(payload) ? payload : [payload]).map(withDefaults); guardFrozen(table, list); rows.push(...list); data = list.map(expand); }
        if (op === 'upsert') { const list = (Array.isArray(payload) ? payload : [payload]); guardFrozen(table, list); for (const r of list) { const i = rows.findIndex((x) => pk.every((k) => x[k] === r[k])); if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push(withDefaults(r)); } data = list; }
        if (op === 'update') { data = []; for (const r of rows) if (filters.every((f) => f(r))) { Object.assign(r, payload); data.push(expand(r)); } }
        if (op === 'delete') { const del = apply(rows); guardFrozen(table, del); tables[table] = rows.filter((r) => !del.includes(r)); data = del; }
        if (single || maybe) data = data[0] || null;
        if (single && !data) throw new Error('no rows');
        if (op !== 'select') persisti();
        res({ data, error: null });
      } catch (e) { res({ data: null, error: { message: e.message } }); }
    },
  };
  return b;
}
function guardFrozen(table, list) {
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
      async getSession() { return { data: { session: userId ? { user: { id: userId, email: T('profiles').find((p) => p.id === userId)?.email } } : null } }; },
      async getUser() { return { data: { user: { id: userId, email: T('profiles').find((p) => p.id === userId)?.email } } }; },
      async signInWithOtp({ email }) { globalThis.__lastOtpEmail = email; return { data: {}, error: null }; },
      async signUp({ email, password, options }) {
        if (T('profiles').some((x) => x.email === email)) return { data: null, error: { message: 'User already registered' } };
        if (!password || password.length < 6) return { data: null, error: { message: 'Password should be at least 6 characters' } };
        const p = { id: uid(), email, password, display_name: options?.data?.display_name || email.split('@')[0], is_judge: T('profiles').length === 0 };
        T('profiles').push(p); persisti();
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
      async verifyOtp({ email, token }) { if (token !== '123456') return { data: null, error: { message: 'Codice errato' } }; let p = T('profiles').find((x) => x.email === email); if (!p) { p = { id: uid(), email, display_name: email.split('@')[0], is_judge: T('profiles').length === 0 }; T('profiles').push(p); } userId = p.id; persisti(); authListeners.forEach((fn) => fn('SIGNED_IN', { user: { id: userId, email } })); return { data: { user: { id: userId } }, error: null }; },
      async signOut() { userId = null; persisti(); authListeners.forEach((fn) => fn('SIGNED_OUT', null)); },
      onAuthStateChange(fn) { authListeners.push(fn); },
    },
    from: builder,
    async rpc(name, args) {
      try {
        if (!userId) throw new Error('non autenticato');
        const prof = T('profiles').find((p) => p.id === userId);
        if (name === 'create_league') { const l = { id: uid(), name: args.p_name, short_name: args.p_short, invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(), rules: {}, started: false, created_by: userId, created_at: now() }; T('leagues').push(l); T('league_members').push({ id: uid(), league_id: l.id, user_id: userId, role: 'admin', team_name: args.p_team, owner_name: prof.display_name, color: args.p_color, initials: args.p_initials, credits: 500, created_at: now() }); persisti(); return { data: l.id, error: null }; }
        if (name === 'join_league') { const l = T('leagues').find((x) => x.invite_code === args.p_code.toUpperCase()); if (!l) throw new Error('Codice invito non valido'); if (!T('league_members').some((m) => m.league_id === l.id && m.user_id === userId)) T('league_members').push({ id: uid(), league_id: l.id, user_id: userId, role: 'fantallenatore', team_name: args.p_team, owner_name: prof.display_name, color: args.p_color, initials: args.p_initials, credits: 500, created_at: now() }); persisti(); return { data: l.id, error: null }; }
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
        throw new Error('rpc sconosciuta ' + name);
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
    channel() { const c = { on() { return c; }, subscribe() { return c; } }; return c; },
    removeChannel() {},
  };
}
