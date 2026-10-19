// Erzeugt die PNG-Symbole (PWA, Favicon-Ersatz, Apple-Touch) aus dem EduOrga-Monogramm (edo-monogramm-eckig.svg).
//   NODE_PATH=$(npm root -g) node design/logo/icons_rendern.cjs <zielordner>
// icon-*.png: Monogramm vollflächig (eckig, Petrol #164c55, weißes „E“, helles Petrol-Quadrat), maskable-*.png: Zeichen auf 60 %
// verkleinert (sichere Zone), apple-touch-icon.png: eckig, iOS rundet selbst.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ziel = process.argv[2];
if (!ziel) { console.error('Aufruf: node design/logo/icons_rendern.cjs <zielordner>'); process.exit(1); }
// Zeichen wie in edo-monogramm.svg: „E“ mit mittlerem Balken, daneben das kleine Quadrat
const zeichen = '<path d="M18 14h28v6H24v9h14v6H24v9h22v6H18z" fill="#ffffff"/><rect x="41" y="29" width="6" height="6" fill="#7fc9c9"/>';
const svg = (skala) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#164c55"/><g transform="translate(32 32) scale(${skala}) translate(-32 -32)">${zeichen}</g></svg>`;
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
