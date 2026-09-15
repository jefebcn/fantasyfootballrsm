/**
 * Mette supabase-js dentro l'app, invece di chiederlo a jsDelivr a ogni
 * apertura. Due motivi, entrambi concreti:
 *
 * 1. Privacy. La pagina sui cookie dice che nessuno strumento di terzi ti
 *    segue, e per i caratteri l'avevamo sistemato portandoli qui dentro. Ma
 *    a ogni avvio partiva comunque una richiesta a jsDelivr, che vede il tuo
 *    indirizzo IP: la frase era vera per i caratteri e falsa per la libreria.
 * 2. Robustezza. Senza quella libreria l'app non parla col server. Dipendere
 *    da una rete di distribuzione altrui per accendersi non ha senso quando
 *    il file pesa poche centinaia di kB e non cambia mai.
 *
 * Si rigenera con: npm run vendor
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const versione = JSON.parse(readFileSync('node_modules/@supabase/supabase-js/package.json', 'utf8')).version;

const r = await build({
  stdin: { contents: "export * from '@supabase/supabase-js';", resolveDir: '.', loader: 'js' },
  bundle: true, format: 'esm', platform: 'browser', target: ['safari15', 'chrome100', 'firefox100'],
  minify: true, legalComments: 'none', write: false,
});

const testa = `/* supabase-js ${versione} — licenza MIT, https://github.com/supabase/supabase-js\n`
  + `   Generato da scripts/vendor-supabase.mjs (npm run vendor). Non modificare a mano. */\n`;
writeFileSync('vendor/supabase-js.js', testa + r.outputFiles[0].text);
writeFileSync('vendor/VERSIONE', versione + '\n');
console.log(`vendor/supabase-js.js  ${versione}  ${(r.outputFiles[0].contents.length / 1024).toFixed(0)} kB`);
