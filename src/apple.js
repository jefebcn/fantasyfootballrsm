/**
 * «Accedi con Apple» (Alex, 14/11).
 *
 * DUE STRADE, stesso account:
 *  - nell'app iPhone (dalla 1.1) il foglio nativo di Apple, tramite il plugin
 *    AccediConApple (ios/App/App/AccediConApple.swift). Apple restituisce un
 *    gettone firmato che si passa a Supabase con signInWithIdToken. Il sito
 *    dentro l'app non puo' fare il giro web: l'app apre solo fantatitano.site.
 *  - sul sito, il giro OAuth di Supabase con il Services ID site.fantatitano.web.
 *    Quello vuole il «Secret Key» su Supabase (un JWT firmato con la chiave
 *    .p8, scripts/apple-secret.mjs): finche' non c'e', APPLE_WEB resta spento
 *    e il pulsante sul sito non compare.
 *
 * Nell'app 1.0 (senza plugin) il pulsante non compare: niente giri a vuoto.
 *
 * IL NONCE: Apple firma nel gettone l'impronta SHA-256 di un numero a caso
 * scelto qui; Supabase riceve il numero in chiaro, rifa' l'impronta e
 * controlla che coincida. Cosi' un gettone rubato non si puo' riusare.
 */
import { APPLE_WEB } from './config.js';

const PLUGIN = 'AccediConApple';
const capacitor = () => (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? window.Capacitor : null);

/** Dentro l'app iPhone, con il plugin nativo (build 1.1 in poi). */
export const appleNativo = () => !!capacitor()?.isPluginAvailable?.(PLUGIN);

/**
 * Se mostrare il pulsante: Apple attivo su Supabase e una strada che funziona.
 * Nell'app senza plugin no (la 1.0); sul sito solo con APPLE_WEB acceso.
 */
export function appleMostrabile(attivoSuSupabase, web = APPLE_WEB) {
  if (!attivoSuSupabase) return false;
  if (capacitor()) return appleNativo();
  return !!web;
}

/** Un numero a caso, 32 byte in esadecimale. */
export function nuovoNonce() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** L'impronta SHA-256 in esadecimale, come la vuole Apple. */
export async function impronta(testo) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Il nome che Apple manda solo al primo accesso, in una riga. */
export const nomeDa = (r) => [r?.givenName, r?.familyName].map((s) => String(s || '').trim()).filter(Boolean).join(' ').slice(0, 24);

/**
 * Il foglio di Apple nell'app. Restituisce { token, nonce, nome } da passare
 * a Supabase. Se la persona chiude il foglio: errore con codice 'CANCELED'.
 */
export async function accediNativo() {
  const core = await import('../vendor/capacitor-core.js');
  // il plugin resta dentro la funzione: il proxy di Capacitor risponde anche a
  // "then", e una promessa che si risolvesse con lui lo chiamerebbe (notifiche.js)
  const P = core.registerPlugin(PLUGIN);
  const nonce = nuovoNonce();
  const r = await P.accedi({ nonce: await impronta(nonce) });
  if (!r?.identityToken) throw Object.assign(new Error('Apple non ha restituito il gettone d\'accesso.'), { code: 'NO_TOKEN' });
  return { token: r.identityToken, nonce, nome: nomeDa(r), codice: r.authorizationCode || '' };
}

/** Annullato dalla persona: non e' un errore da mostrare. */
export const annullato = (e) => e?.code === 'CANCELED' || /annullat|cancel/i.test(e?.message || '');
