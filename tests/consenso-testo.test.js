// Il testo del consenso che il calciatore legge nell'app deve essere,
// parola per parola, quello conservato dalla 044 con la sua impronta: se uno
// cambia e l'altro no, l'attestato dimostrerebbe un testo che nessuno ha
// letto. Cambiando il testo si cambia anche la versione (v2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { testoInChiaro } from './consenso-testo.js';

const src = readFileSync(new URL('../src/views/adesione.js', import.meta.url), 'utf8');
const TESTO = src.match(/export const TESTO_CONSENSO = `([\s\S]*?)`;/)[1];
const SCELTE = Function(`return (${src.match(/export const SCELTE = (\{[\s\S]*?\n\});/)[1]})`)();

test('il testo del consenso nell\'app e nella 044 è lo stesso', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const f = readdirSync(dir).find((x) => x.startsWith('044-'));
  const sql = readFileSync(new URL(f, dir), 'utf8');
  const nelDb = sql.match(/\$testo\$([\s\S]*?)\$testo\$/)[1];
  assert.equal(nelDb, testoInChiaro(SCELTE, TESTO));
});

test('la versione del testo nell\'app è quella della 044', () => {
  const st = readFileSync(new URL('../src/state.js', import.meta.url), 'utf8');
  const v = st.match(/VERSIONE_CONSENSO = '([^']+)'/)[1];
  const sql = readFileSync(new URL('../supabase/migrations/044-consenso-calciatori.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes(`select '${v}', t,`), `la 044 non inserisce la versione ${v}`);
});
