// Erzeugt die PNG-Symbole (PWA, Favicon-Ersatz, Apple-Touch) aus dem Monogramm.
//   NODE_PATH=$(npm root -g) node design/logo/icons_rendern.cjs <zielordner>
// icon-*.png: Monogramm vollflächig (eckig), maskable-*.png: Zeichen auf 60 % verkleinert (sichere Zone),
// apple-touch-icon.png: eckig, iOS rundet selbst.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ziel = process.argv[2];
const zeichen = '<path d="M14 16v18a10 10 0 0 0 20 0V16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="square"/><path d="M34 16h8a8 8 0 0 1 0 16h-8M34 34v16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="square"/>';
const svg = (skala) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#11264a"/><g transform="translate(32 33) scale(${skala}) translate(-32 -33)">${zeichen}</g></svg>`;
const dateien = [['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['maskable-192.png', 192, 0.6], ['maskable-512.png', 512, 0.6], ['apple-touch-icon.png', 180, 1]];

(async () => {
  const b = await chromium.launch();
  for (const [name, g, skala] of dateien) {
    const p = await b.newPage({ viewport: { width: g, height: g } });
    await p.setContent(`<html><body style="margin:0">${svg(skala).replace('<svg ', `<svg width="${g}" height="${g}" `)}</body></html>`);
    fs.writeFileSync(path.join(ziel, name), await p.screenshot({ type: 'png' }));
    await p.close();
  }
  await b.close();
})();
