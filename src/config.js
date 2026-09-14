/**
 * Configurazione Supabase. Valori pubblici (anon key): la sicurezza sta nelle policy RLS.
 * Lascia vuoto per la modalità locale (demo). In alternativa si possono inserire dall'app
 * (Impostazioni → Connetti Supabase), salvati in localStorage su quel dispositivo.
 */
export const SUPABASE_URL = 'https://nskgzpbcssnpfuxmbepa.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_3ji0uoP5OW9LBzGhQ9QDSg_JoSJigHa';
// Versione pinnata: un aggiornamento del CDN non deve cambiare il comportamento dell'app.
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm';
// Se il CDN non risponde entro questo tempo, l'app riparte in modalità locale.
export const SUPABASE_TIMEOUT_MS = 8000;
