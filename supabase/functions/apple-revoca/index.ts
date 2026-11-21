/**
 * Chiude l'accesso «Accedi con Apple» quando un account viene cancellato.
 *
 * PERCHE' (Alex, 15/11). Apple chiede alle app che offrono «Accedi con Apple»
 * di revocare i gettoni dell'utente quando questo cancella l'account (regola
 * 5.1.1(v)): cosi' Fantatitano sparisce anche da «App che usano l'ID Apple»
 * nelle impostazioni del telefono.
 *
 * COME. L'app (dalla 1.1) chiede di nuovo il foglio di Apple e manda qui il
 * codice d'autorizzazione appena ricevuto (vale 5 minuti). Qui si scambia il
 * codice coi gettoni e si revoca subito il gettone di rinnovo. Nessun gettone
 * viene salvato da nessuna parte.
 *
 * Il «client secret» per Apple e' un JWT firmato con la chiave Sign in with
 * Apple (il .p8 di Alex), fatto qui al momento e valido 5 minuti.
 *
 * Secret (Edge Functions -> Secrets):
 *   APPLE_SIWA_KEY     il contenuto del .p8 della chiave Sign in with Apple
 *   APPLE_SIWA_KEY_ID  i 10 caratteri della chiave (4AQX3MQX53)
 *   APNS_TEAM_ID       il Team ID (8VQ5WP5Y4L), lo stesso delle notifiche
 * Senza la chiave risponde { revocato: false, motivo } e la cancellazione
 * dell'account va avanti lo stesso: non deve MAI bloccarla.
 *
 * POST { codice, client? }  con il gettone di chi ha fatto l'accesso.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const risposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: CORS });
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const testo = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)));

/** Il client secret per Apple: JWT ES256, 5 minuti. WebCrypto firma gia' nel formato r||s che vuole il JWT. */
async function clientSecret(chiave: string, keyId: string, team: string, client: string) {
  const ora = Math.floor(Date.now() / 1000);
  const dati = `${testo({ alg: 'ES256', kid: keyId })}.${testo({ iss: team, iat: ora, exp: ora + 300, aud: 'https://appleid.apple.com', sub: client })}`;
  const der = Uint8Array.from(atob(chiave.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, new TextEncoder().encode(dati)));
  return `${dati}.${b64u(firma)}`;
}

const modulo = (o: Record<string, string>) => new URLSearchParams(o).toString();
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return risposta({ errore: 'solo POST' }, 405);
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u, error: eu } = await sb.auth.getUser(jwt);
    if (eu || !u?.user) return risposta({ errore: 'Serve aver fatto l\'accesso.' }, 401);

    const corpo = await req.json().catch(() => ({})) as { codice?: string; client?: string };
    const codice = String(corpo.codice || '').trim();
    // l'app iPhone usa il bundle id; il sito userebbe il Services ID
    const client = corpo.client === 'site.fantatitano.web' ? 'site.fantatitano.web' : 'site.fantatitano.app';
    if (!codice) return risposta({ revocato: false, motivo: 'manca il codice di Apple' }, 400);

    const chiave = Deno.env.get('APPLE_SIWA_KEY')?.trim();
    const keyId = Deno.env.get('APPLE_SIWA_KEY_ID')?.trim();
    const team = (Deno.env.get('APPLE_TEAM_ID') || Deno.env.get('APNS_TEAM_ID'))?.trim();
    if (!chiave || !keyId || !team) return risposta({ revocato: false, motivo: 'chiave Sign in with Apple non configurata sul server' });

    const segreto = await clientSecret(chiave, keyId, team, client);
    const t = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST', headers: FORM,
      body: modulo({ client_id: client, client_secret: segreto, code: codice, grant_type: 'authorization_code' }),
    });
    const gettoni = await t.json().catch(() => ({})) as { refresh_token?: string; access_token?: string; error?: string };
    if (!t.ok) return risposta({ revocato: false, motivo: `Apple non ha accettato il codice (${gettoni.error || t.status})` });
    const token = gettoni.refresh_token || gettoni.access_token;
    if (!token) return risposta({ revocato: false, motivo: 'Apple non ha restituito gettoni' });

    const r = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST', headers: FORM,
      body: modulo({ client_id: client, client_secret: segreto, token, token_type_hint: gettoni.refresh_token ? 'refresh_token' : 'access_token' }),
    });
    if (!r.ok) return risposta({ revocato: false, motivo: `Apple non ha revocato (${r.status})` });
    return risposta({ revocato: true });
  } catch (err) {
    console.error('apple-revoca', err);
    return risposta({ revocato: false, motivo: err instanceof Error ? err.message : String(err) }, 500);
  }
});
