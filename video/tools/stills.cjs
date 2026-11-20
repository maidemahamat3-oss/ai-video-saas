// Images fixes pour la vidéo longue : vues tactiques des cartes et portraits des cibles (1920x1080).
// Usage : node stills.cjs <dossier_sortie>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const only = (process.env.ONLY || '').split(',').filter(Boolean), [VW, VH] = (process.env.SIZE || '1920x1080').split('x').map(Number);
const SHOTS = [
  // [mission, nom, secondes de simulation avant la photo, code de mise en place]
  ['base', 'map_base', 2, `cam.position.set(0, 120, 30); cam.lookAt(0, 0, -8); cam.fov = 45;`],
  ['port', 'map_port', 2, `cam.position.set(0, 110, 60); cam.lookAt(0, 0, 8); cam.fov = 48;`],
  ['sniper', 'map_sniper', 2, `cam.position.set(380, 140, -2880); cam.lookAt(380, 30, -2985); cam.fov = 40;`],
  ['tower', 'map_tower', 2, `cam.position.set(60, 140, 60); cam.lookAt(0, 20, -30); cam.fov = 50;`],
  ['sniper', 'dossier_varga', 0, `const c = G.enemies.find(e => e.id === 'colonel'); c.root.visible = true; c.hidden = false; c.pos.set(380, 30, -2975); c.yaw = 0; c.update(0.01); const e = c.eye(); cam.position.set(e.x + .35, e.y + .05, e.z + 1.35); cam.lookAt(e.x, e.y - .15, e.z); cam.fov = 32;`],
  ['tower', 'dossier_serpent', 0, `G.mission.setFloor(14); const b = G.enemies.find(e => e.id === 'boss'); b.sleep = false; b.update(0.01); const e = b.eye(); cam.position.set(e.x - .45, e.y + .05, e.z + 1.5); cam.lookAt(e.x, e.y - .2, e.z); cam.fov = 32;`],
  ['base', 'dossier_vipere', 0, `const s = G.enemies[1]; s.update(0.01); const e = s.eye(); cam.position.set(e.x + 1.2, e.y + .1, e.z + 1.6); cam.lookAt(e.x, e.y - .4, e.z); cam.fov = 38;`],
];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  page.on('pageerror', e => console.error('pageerror:', e.message));
  await page.goto('http://127.0.0.1:8765/game/index.html?capture=1&clean=1&notext=1');
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  for (const [m, name, secs, code] of SHOTS.filter(s => !only.length || only.includes(s[1]))) {
    await page.evaluate((m) => window.__cap.start(m, false), m);
    await page.waitForFunction(() => !window.__game.G.pending, null, { timeout: 120000 });
    await page.evaluate(([secs, code]) => {
      const g = window.__game, G = g.G, cam = G.camera; for (let i = 0; i < secs * 24; i++) g.step(1 / 24);
      G.state = 'menu'; G.camOverride = () => {}; G.hideVM = true; G.droneOn = true; document.getElementById('hud').hidden = true;
      eval(code); cam.near = .05; cam.far = 20000; cam.updateProjectionMatrix(); for (let i = 0; i < 3; i++) g.render();
    }, [secs, code]);
    await page.screenshot({ path: path.join(out, name + '.jpg'), type: 'jpeg', quality: 92, timeout: 240000 });
    console.log('image', name);
  }
  await browser.close();
})();
