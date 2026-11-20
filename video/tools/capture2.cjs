// Tournage d'une mission du jeu v2 (rendu déterministe image par image).
// Usage : node capture2.cjs <mission> <demo|cine> <sortie> [--size 1280x720] [--fps 24] [--windows 1-5,8-12] [--dpr 1]
// Écrit <sortie>/frames/00001.jpg…, events.json (sons, textes à traduire), marks.json (moments clés), meta.json
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [mission, mode, out, ...rest] = process.argv.slice(2);
const opt = { size: '1280x720', fps: '24', from: '0', to: '1e9', dpr: '1', url: 'http://127.0.0.1:8765/game/index.html' };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const [W, H] = opt.size.split('x').map(Number), fps = +opt.fps, from = +opt.from, to = +opt.to;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +opt.dpr });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(`${opt.url}?capture=1&clean=1&notext=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(([m, d]) => window.__cap.start(m, d === 'cine' ? 'cine' : true), [mission, mode]);
  await page.waitForFunction(() => !window.__game.G.pending, null, { timeout: 120000 });
  const dt = 1 / fps; const t0 = Date.now(); let total = 0;
  const windows = (opt.windows || `${from}-${to}`).split(',').map(w => w.split('-').map(Number));
  const meta = [];
  for (const [a, b] of windows) {
    const r = await page.evaluate(([dt, a]) => { const g = window.__game, G = g.G; while (G.t + dt < a && !G.demoDone) g.step(dt); return { t: G.t, done: !!G.demoDone }; }, [dt, a]);
    if (r.done) break;
    const dirw = path.join(out, `w${meta.length}`); fs.mkdirSync(dirw, { recursive: true }); let n = 0, t = r.t, start = r.t, done = false;
    while (t < b) {
      const st = await page.evaluate((dt) => window.__cap.frame(dt), dt); t = st.t;
      await page.screenshot({ path: path.join(dirw, String(++n).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90 }); total++;
      if (total % 100 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${mission}/${mode} : ${total} images · t=${t.toFixed(1)} s · ${(el / total).toFixed(2)} s/image`); }
      if (st.done) { done = true; break; }
    }
    meta.push({ dir: `w${meta.length}`, start: +start.toFixed(4), frames: n, duration: n / fps });
    if (done) break;
  }
  const events = await page.evaluate(() => window.__cap.events()), marks = await page.evaluate(() => window.__cap.marks());
  fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify(events));
  fs.writeFileSync(path.join(out, 'marks.json'), JSON.stringify(marks, null, 1));
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ mission, mode, fps, size: [W * +opt.dpr, H * +opt.dpr], windows: meta }, null, 1));
  console.log(`terminé : ${total} images en ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  await browser.close();
})();
