/**
 * Mock minimale di supabase-js per lo smoke test end-to-end del flusso remoto (senza rete).
 * Emula auth OTP, query builder in memoria, rpc create_league/join_league, realtime no-op.
 */
const tables = {};
const T = (n) => (tables[n] ||= []);
let userId = null; const authListeners = [];
const uid = () => 'u' + Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

function builder(table) {
  const filters = []; let op = 'select'; let payload = null; let single = false; let maybe = false; let orderBy = null; let lim = null; let returning = false;
  const apply = (rows) => rows.filter((r) => filters.every((f) => f(r)));
  const b = {
    select() { returning = true; if (op === 'select') return b; return b; },
    eq(k, v) { filters.push((r) => r[k] === v); return b; },
    is(k, v) { filters.push((r) => r[k] == v); return b; },
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
        const pk = { lineups: ['league_id', 'member_id', 'matchday'], match_overrides: ['match_id'], match_appearances: ['match_id', 'player_id'], matchday_status: ['matchday'], profiles: ['id'] }[table] || ['id'];
        const withDefaults = (r) => ({ id: uid(), created_at: now(), ...r });
        if (op === 'select') { data = apply(rows).map(expand); if (orderBy) data.sort((a, b) => (a[orderBy[0]] > b[orderBy[0]] ? 1 : -1) * (orderBy[1] ? 1 : -1)); if (lim) data = data.slice(0, lim); }
        if (op === 'insert') { const list = (Array.isArray(payload) ? payload : [payload]).map(withDefaults); guardFrozen(table, list); rows.push(...list); data = list.map(expand); }
        if (op === 'upsert') { const list = (Array.isArray(payload) ? payload : [payload]); guardFrozen(table, list); for (const r of list) { const i = rows.findIndex((x) => pk.every((k) => x[k] === r[k])); if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push(withDefaults(r)); } data = list; }
        if (op === 'update') { data = []; for (const r of rows) if (filters.every((f) => f(r))) { Object.assign(r, payload); data.push(expand(r)); } }
        if (op === 'delete') { const del = apply(rows); guardFrozen(table, del); tables[table] = rows.filter((r) => !del.includes(r)); data = del; }
        if (single || maybe) data = data[0] || null;
        if (single && !data) throw new Error('no rows');
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
export function createClient() {
  return {
    auth: {
      async getSession() { return { data: { session: userId ? { user: { id: userId, email: T('profiles').find((p) => p.id === userId)?.email } } : null } }; },
      async getUser() { return { data: { user: { id: userId, email: T('profiles').find((p) => p.id === userId)?.email } } }; },
      async signInWithOtp({ email }) { globalThis.__lastOtpEmail = email; return { data: {}, error: null }; },
      async signUp({ email, password, options }) {
        if (T('profiles').some((x) => x.email === email)) return { data: null, error: { message: 'User already registered' } };
        if (!password || password.length < 6) return { data: null, error: { message: 'Password should be at least 6 characters' } };
        const p = { id: uid(), email, password, display_name: options?.data?.display_name || email.split('@')[0], is_judge: T('profiles').length === 0 };
        T('profiles').push(p); userId = p.id;
        authListeners.forEach((fn) => fn('SIGNED_IN', { user: { id: userId, email } }));
        return { data: { user: { id: p.id, email }, session: { user: { id: p.id, email } } }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const p = T('profiles').find((x) => x.email === email && x.password === password);
        if (!p) return { data: null, error: { message: 'Invalid login credentials' } };
        userId = p.id; authListeners.forEach((fn) => fn('SIGNED_IN', { user: { id: userId, email } }));
        return { data: { user: { id: p.id, email }, session: {} }, error: null };
      },
      async resetPasswordForEmail(email) { globalThis.__lastResetEmail = email; return { data: {}, error: null }; },
      async updateUser({ password }) { const p = T('profiles').find((x) => x.id === userId); if (p) p.password = password; return { data: { user: { id: userId } }, error: null }; },
      async verifyOtp({ email, token }) { if (token !== '123456') return { data: null, error: { message: 'Codice errato' } }; let p = T('profiles').find((x) => x.email === email); if (!p) { p = { id: uid(), email, display_name: email.split('@')[0], is_judge: T('profiles').length === 0 }; T('profiles').push(p); } userId = p.id; authListeners.forEach((fn) => fn('SIGNED_IN', { user: { id: userId, email } })); return { data: { user: { id: userId } }, error: null }; },
      async signOut() { userId = null; authListeners.forEach((fn) => fn('SIGNED_OUT', null)); },
      onAuthStateChange(fn) { authListeners.push(fn); },
    },
    from: builder,
    async rpc(name, args) {
      try {
        if (!userId) throw new Error('non autenticato');
        const prof = T('profiles').find((p) => p.id === userId);
        if (name === 'create_league') { const l = { id: uid(), name: args.p_name, short_name: args.p_short, invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(), rules: {}, started: false, created_by: userId, created_at: now() }; T('leagues').push(l); T('league_members').push({ id: uid(), league_id: l.id, user_id: userId, role: 'admin', team_name: args.p_team, owner_name: prof.display_name, color: args.p_color, initials: args.p_initials, credits: 500, created_at: now() }); return { data: l.id, error: null }; }
        if (name === 'join_league') { const l = T('leagues').find((x) => x.invite_code === args.p_code.toUpperCase()); if (!l) throw new Error('Codice invito non valido'); if (!T('league_members').some((m) => m.league_id === l.id && m.user_id === userId)) T('league_members').push({ id: uid(), league_id: l.id, user_id: userId, role: 'fantallenatore', team_name: args.p_team, owner_name: prof.display_name, color: args.p_color, initials: args.p_initials, credits: 500, created_at: now() }); return { data: l.id, error: null }; }
        throw new Error('rpc sconosciuta ' + name);
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
    channel() { const c = { on() { return c; }, subscribe() { return c; } }; return c; },
    removeChannel() {},
  };
}
