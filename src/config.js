/**
 * Configurazione Supabase. Valori pubblici (anon key): la sicurezza sta nelle policy RLS.
 * Lascia vuoto per la modalità locale (demo). In alternativa si possono inserire dall'app
 * (Impostazioni → Connetti Supabase), salvati in localStorage su quel dispositivo.
 */
export const SUPABASE_URL = 'https://nskgzpbcssnpfuxmbepa.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_3ji0uoP5OW9LBzGhQ9QDSg_JoSJigHa';
// Versione pinnata: un aggiornamento del CDN non deve cambiare il comportamento dell'app.
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm';
// Se il CDN non risponde entro questo tempo, l'app mostra la schermata di errore.
export const SUPABASE_TIMEOUT_MS = 8000;

/**
 * Clerk: fornitore d'identità. Se la chiave è presente, l'accesso passa da Clerk
 * (password, Google, Apple, link via e-mail) e Supabase riceve il token di sessione
 * come identità esterna. Se è vuota, si usa l'autenticazione di Supabase.
 * La publishable key è pubblica; la secret key non va MAI nel frontend.
 */
export const CLERK_PUBLISHABLE_KEY = 'pk_test_ZGVjZW50LXJhdmVuLTQzMjcuY2xlcmsuYWNjb3VudHMuZGV2JA';
// Vuoto = token di sessione predefinito (integrazione Supabase nativa di Clerk).
// Valorizzare solo se sul progetto Clerk esiste un JWT template dedicato.
export const CLERK_JWT_TEMPLATE = '';
