/**
 * Configurazione Supabase. Valori pubblici (anon key): la sicurezza sta nelle policy RLS.
 * Lascia vuoto per la modalità locale (demo). In alternativa si possono inserire dall'app
 * (Impostazioni → Connetti Supabase), salvati in localStorage su quel dispositivo.
 */
export const SUPABASE_URL = 'https://nskgzpbcssnpfuxmbepa.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_3ji0uoP5OW9LBzGhQ9QDSg_JoSJigHa';
// La libreria sta dentro l'app (vendor/supabase-js.js, si rigenera con
// `npm run vendor`). Prima arrivava da jsDelivr: a ogni apertura partiva una
// richiesta verso un terzo che vedeva l'indirizzo IP di chi apriva — la stessa
// cosa che avevamo tolto per i caratteri — e senza quella rete l'app non si
// accendeva proprio.
export const SUPABASE_JS = '/vendor/supabase-js.js';
// Se la libreria non si carica entro questo tempo, l'app mostra l'errore.
export const SUPABASE_TIMEOUT_MS = 8000;

/**
 * Clerk: fornitore d'identità. Se la chiave è presente, l'accesso passa da Clerk
 * (password, Google, Apple, link via e-mail) e Supabase riceve il token di sessione
 * come identità esterna. Se è vuota, si usa l'autenticazione di Supabase.
 * La publishable key è pubblica; la secret key non va MAI nel frontend.
 */
export const CLERK_PUBLISHABLE_KEY = ''; // Clerk disattivato: l'accesso passa da Supabase, senza uscire dall'app
// Vuoto = token di sessione predefinito (integrazione Supabase nativa di Clerk).
// Valorizzare solo se sul progetto Clerk esiste un JWT template dedicato.
export const CLERK_JWT_TEMPLATE = '';

/** Indirizzo a cui arriva "Contattaci". Vuoto = la voce spiega come impostarlo. */
export const CONTATTO = '';

/**
 * Chi risponde dei dati, cioe' il titolare del trattamento.
 * Finche' i campi restano vuoti l'informativa NON inventa un nome: dice a chiare
 * lettere che manca e che va compilato prima di aprire le iscrizioni fuori dal
 * giro di amici. Meglio un buco dichiarato che un dato falso in un documento
 * che la gente legge per fidarsi.
 */
export const TITOLARE = {
  nome: '',            // ragione sociale o nome e cognome di chi gestisce l'app
  sede: '',            // indirizzo completo
  paese: '',           // es. 'Repubblica di San Marino'
  codiceOperatore: '', // COE sammarinese, o partita IVA se e' una societa' italiana
  email: '',           // indirizzo per le richieste sui dati (puo' coincidere con CONTATTO)
  pec: '',             // facoltativa
};
/** Data dell'ultima revisione dei testi legali, in ISO. */
export const LEGALI_AGGIORNATE = '2026-09-15';
/** Eta' minima per iscriversi. */
export const ETA_MINIMA = 14;

/**
 * Chiave PUBBLICA VAPID per le notifiche a telefono chiuso. E' pubblica per
 * costruzione: sta nel frontend come la chiave anon di Supabase.
 *
 * La chiave PRIVATA non va MAI qui: sta nei secret di Supabase e la usa solo
 * la funzione che spedisce. Si generano in coppia — vedi
 * supabase/functions/promemoria/README.md.
 *
 * Finche' resta vuota le push sono spente e l'app lo dice, invece di chiedere
 * un permesso che non userebbe.
 */
export const VAPID_PUBBLICA = 'BLrGGXQUEc9KX2oOtPO5ygNu5Z1tcDKmCLMMBX7Dq9IcR4qFwfw65uPoFRXUWHl8_wrxKgYpy4JqYw5k19QEklo';

/** Lingue dell'interfaccia. Per ora l'app parla solo italiano: quando ne
 *  arriverà un'altra basta aggiungerla qui. */
export const LINGUE = [['it', 'Italiano']];
