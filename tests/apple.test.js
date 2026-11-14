// «Accedi con Apple» (Alex, 14/11): quando il pulsante compare, il nonce, il
// nome, e il secret per Supabase fatto da scripts/apple-secret.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, createHash, verify } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appleMostrabile, impronta, nuovoNonce, nomeDa } from '../src/apple.js';

const conCapacitor = (plugin, fn) => {
  globalThis.window = { Capacitor: { isNativePlatform: () => true, isPluginAvailable: (n) => plugin && n === 'AccediConApple' } };
  try { return fn(); } finally { delete globalThis.window; }
};

test('il pulsante: mai se Apple è spento su Supabase', () => {
  assert.equal(appleMostrabile(false, true), false);
  assert.equal(conCapacitor(true, () => appleMostrabile(false, true)), false);
});

test('il pulsante sul sito: solo con il secret a posto (APPLE_WEB)', () => {
  assert.equal(appleMostrabile(true, false), false);
  assert.equal(appleMostrabile(true, true), true);
});

test('il pulsante nell\'app: solo con il plugin nativo (non nella 1.0)', () => {
  assert.equal(conCapacitor(false, () => appleMostrabile(true, true)), false, 'app 1.0: il giro web non va, niente pulsante');
  assert.equal(conCapacitor(true, () => appleMostrabile(true, false)), true, 'app 1.1: il foglio nativo non ha bisogno del secret');
});

test('il nonce: casuale, e l\'impronta è lo SHA-256 esadecimale che vuole Apple', async () => {
  const a = nuovoNonce(); const b = nuovoNonce();
  assert.match(a, /^[0-9a-f]{64}$/); assert.notEqual(a, b);
  assert.equal(await impronta(a), createHash('sha256').update(a).digest('hex'));
});

test('il nome che Apple manda al primo accesso', () => {
  assert.equal(nomeDa({ givenName: 'Mario', familyName: 'Rossi' }), 'Mario Rossi');
  assert.equal(nomeDa({ givenName: '', familyName: '' }), '');
  assert.equal(nomeDa(null), '');
  assert.ok(nomeDa({ givenName: 'A'.repeat(40) }).length <= 24);
});

test('apple-secret.mjs: un JWT ES256 valido per Supabase, che scade entro 6 mesi', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const dir = mkdtempSync(join(tmpdir(), 'asecret-'));
  const f = join(dir, 'AuthKey_ABCDE12345.p8');
  writeFileSync(f, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const out = execFileSync('node', ['scripts/apple-secret.mjs', f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const [h, c, s] = out.split('.');
  const testa = JSON.parse(Buffer.from(h, 'base64url')); const corpo = JSON.parse(Buffer.from(c, 'base64url'));
  assert.deepEqual(testa, { alg: 'ES256', kid: 'ABCDE12345', typ: 'JWT' });
  assert.equal(corpo.iss, '8VQ5WP5Y4L'); assert.equal(corpo.sub, 'site.fantatitano.web');
  assert.equal(corpo.aud, 'https://appleid.apple.com');
  assert.ok(corpo.exp - corpo.iat <= 180 * 86400, 'Apple non accetta più di 6 mesi');
  assert.ok(verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')), 'firma valida');
});
