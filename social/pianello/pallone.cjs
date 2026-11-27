const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 600, height: 600 } });
  const svg = fs.readFileSync(require('path').join(__dirname, '..', '..', 'media', 'icone', 'futsal', 'pallone.svg'), 'utf8').replace(/#000/g, '#FF4B2B').replace('<svg ', '<svg width="600" height="600" ');
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await p.screenshot({ path: process.argv[2], omitBackground: true, clip: { x: 0, y: 0, width: 600, height: 600 } });
  await b.close();
})();
