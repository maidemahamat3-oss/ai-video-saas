// Tourne la démo du jeu image par image (rendu déterministe) et enregistre :
//   <out>/frames/00001.jpg ...   les images 1080x1920
//   <out>/events.json            les tirs, coups de couteau, explosions… (pour les bruitages)
//   <out>/marks.json             les moments clés (pour caler la voix off)
// Usage : node capture.cjs <dossier_sortie> [fps=30] [url=http://127.0.0.1:8765/game/index.html]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'build';
const fps = +(process.argv[3] || 30);
const url = (process.argv[4] || 'http://127.0.0.1:8765/game/v1-prototype.html') + '?capture=1&clean=1';

(async () => {
  fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__cap, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.__cap.start(true));
  const dt = 1 / fps;
  const t0 = Date.now();
  for (let i = 1; i < fps * 120; i++) {
    const st = await page.evaluate((dt) => window.__cap.frame(dt), dt);
    await page.screenshot({ path: path.join(out, 'frames', String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    if (i % (fps * 5) === 0) console.log(`t=${st.t.toFixed(1)}s  (${((Date.now() - t0) / 1000).toFixed(0)}s de calcul)`);
    if (st.done) break;
  }
  fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify(await page.evaluate(() => window.__cap.events()), null, 1));
  fs.writeFileSync(path.join(out, 'marks.json'), JSON.stringify(await page.evaluate(() => window.__cap.marks()), null, 1));
  console.log('terminé');
  await browser.close();
})();
