// Prove browser senza server (cloud): node -r ./prove/strumenti/servi-da-disco.cjs prove/xxx.cjs con BASE=http://app.local
// (https://app.local per service worker e notifiche). Le pagine arrivano dal disco del repo.
const path = require('path'); const fs = require('fs');
const REPO = path.resolve(__dirname, '../..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const pw = require(require.resolve('playwright', { paths: [REPO] }));
const servi = async (ctx) => {
  await ctx.route(/^https?:\/\/app\.local\//, async (r) => {
    let p = decodeURIComponent(new URL(r.request().url()).pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(REPO, p);
    if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TIPI[path.extname(f)] || 'application/octet-stream' });
  });
  return ctx;
};
const lancia = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await lancia(...a);
  const nc = b.newContext.bind(b); b.newContext = async (...x) => servi(await nc(...x));
  const np = b.newPage.bind(b); b.newPage = async (...x) => { const pg = await np(...x); await servi(pg.context()); return pg; };
  return b;
};
