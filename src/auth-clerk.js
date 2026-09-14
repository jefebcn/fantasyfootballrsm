/**
 * Identità via Clerk. Carica clerk-js dal dominio dell'istanza e fornisce a Supabase
 * il token di sessione: le policy RLS leggono l'utente dal claim "sub" (vedi
 * supabase/migrations/001-identita-esterna.sql), quindi lo schema resta lo stesso.
 */
import { CLERK_PUBLISHABLE_KEY, CLERK_JWT_TEMPLATE, SUPABASE_TIMEOUT_MS } from './config.js';

let clerk = null;
const listeners = new Set();

/** Permette di forzare il fornitore ('clerk' | 'supabase') per prove e diagnosi. */
function forced() { try { return localStorage.getItem('fcs:auth'); } catch { return null; } }
export function publishableKey() {
  try { const v = localStorage.getItem('fcs:clerk'); if (v) return v; } catch { /* privato */ }
  return CLERK_PUBLISHABLE_KEY;
}
export function isEnabled() { const f = forced(); if (f === 'supabase') return false; if (f === 'clerk') return true; return !!publishableKey(); }
/** Il dominio dell'istanza è codificato nella publishable key. */
export function domain() {
  const b64 = publishableKey().split('_').slice(2).join('_');
  try { return atob(b64).replace(/\$+$/, ''); } catch { return ''; }
}

const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what}: nessuna risposta entro ${Math.round(ms / 1000)}s`)), ms))]);

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.Clerk) return resolve(window.Clerk);
    const src = window.__CLERK_JS__ || `https://${domain()}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
    const el = document.createElement('script');
    el.src = src; el.async = true; el.crossOrigin = 'anonymous';
    el.setAttribute('data-clerk-publishable-key', publishableKey());
    el.onload = () => (window.Clerk ? resolve(window.Clerk) : reject(new Error('Clerk non inizializzato')));
    el.onerror = () => reject(new Error('Clerk non raggiungibile'));
    document.head.appendChild(el);
  });
}

export async function init() {
  if (clerk) return user();
  const C = await withTimeout(loadScript(), SUPABASE_TIMEOUT_MS, 'Clerk non raggiungibile');
  clerk = typeof C === 'function' ? new C(publishableKey()) : C;
  await withTimeout(clerk.load({ appearance: appearance() }), SUPABASE_TIMEOUT_MS, 'Clerk non pronto');
  clerk.addListener(() => listeners.forEach((fn) => fn(user())));
  return user();
}

function map(u) {
  if (!u) return null;
  const email = u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || '';
  return { id: u.id, email, user_metadata: { display_name: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || email.split('@')[0] } };
}
export const user = () => map(clerk?.user);
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** Token per Supabase: il claim "role" deve valere "authenticated" (integrazione Supabase di Clerk). */
export async function token() {
  try { return (await clerk?.session?.getToken(CLERK_JWT_TEMPLATE ? { template: CLERK_JWT_TEMPLATE } : undefined)) || null; }
  catch { return null; }
}
export async function signOut() { await clerk?.signOut(); }
export function openProfile() { clerk?.openUserProfile?.(); }

/** L'aspetto dei componenti Clerk segue i token dell'app, così non sembra un pezzo estraneo. */
function appearance() {
  const v = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
  return {
    variables: {
      colorPrimary: v('--primary', '#1B84C6'),
      colorBackground: v('--surface', '#ffffff'),
      colorText: v('--text', '#0C2C45'),
      colorTextSecondary: v('--text-muted', '#5A7591'),
      colorInputBackground: v('--surface', '#ffffff'),
      colorInputText: v('--text', '#0C2C45'),
      colorDanger: v('--negative', '#CE3B3B'),
      colorSuccess: v('--positive', '#1E9E6A'),
      borderRadius: '12px',
      fontFamily: "'Asap', system-ui, sans-serif",
    },
    elements: { card: { boxShadow: 'none', border: 'none', width: '100%' }, rootBox: { width: '100%' }, footer: { background: 'transparent' } },
  };
}
export function mount(el, kind = 'sign-in') {
  if (!clerk) return;
  const opts = { appearance: appearance(), routing: 'virtual' };
  kind === 'sign-up' ? clerk.mountSignUp(el, opts) : clerk.mountSignIn(el, opts);
}
export function unmount(el) { try { clerk?.unmountSignIn?.(el); clerk?.unmountSignUp?.(el); } catch { /* già smontato */ } }
