// =====================================================================
// OPÉRATION ÉCLIPSE — programme principal : chargement, menus, boucle,
// déroulement des missions, commandes, API de tournage vidéo.
// =====================================================================
import { THREE, V3, G, $, clamp, damp, lerp, CAPTURE, IS_TOUCH, params, reseed, rnd, renderer, camera, vmCamera, resize, render, newScene, setSky,
  updateFX, runTimers, updateHudFx, hud, setText, radio, stamp, sfx, initAudio, stopLoops, later, mark, grade, explosion, FX } from './engine.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setSoldierAsset, Soldier } from './actors.js';
import { prepareSniper } from './weapons.js';
import { player, W, VM, initViewmodel, resetPlayer, updatePlayer, updateCamera, updateWeapon, updateBullet, startReload, knifeAttack, lase, stats } from './player.js';
import { MODELS, initMats } from './world.js';
import { camPath } from './director.js';
import base from './missions/base.js';
import port from './missions/port.js';
import sniper from './missions/sniper.js';
import tower from './missions/tower.js';

export const MISSIONS = [base, port, sniper, tower];
if (params.has('clean')) document.body.classList.add('clean');
if (params.has('notext')) document.body.classList.add('notext');
resize();

// ---------------------------------------------------------- chargement
const SKIES = {};
async function load() {
  const gl = new GLTFLoader(); const bar = $('loadBar');
  const list = ['wooden_military_crate', 'Barrel_01', 'metal_jerrycan', 'concrete_road_barrier', 'street_lamp_01', 'ammo_box', 'propane_tank', 'old_tyre', 'bolt_action_rifle_7_62'];
  let done = 0; const total = list.length + 5; const tick = () => { done++; bar.style.width = `${Math.round(done / total * 100)}%`; };
  // .glb direct, sinon version texte base64 (hébergement qui ne sert pas les .glb)
  const glb = async (p) => { try { return await gl.loadAsync(p); } catch (e) { const txt = await (await fetch(p + '.b64.txt')).text(); const bin = Uint8Array.from(atob(txt.trim()), c => c.charCodeAt(0)); return await new Promise((res, rej) => gl.parse(bin.buffer, '', res, rej)); } };
  const sol = await glb('assets/models/Soldier.glb'); setSoldierAsset(sol); tick();
  await Promise.all(list.map(async n => { const g = await glb(`assets/models/${n}.glb`); MODELS[n] = g.scene; tick(); }));
  const tl = new THREE.TextureLoader();
  await Promise.all(['kloppenheim_02', 'satara_night', 'aarfontein_dawn', 'shanghai_bund'].map(async n => { SKIES[n] = await tl.loadAsync(`assets/sky/${n}.jpg`); tick(); }));
  initMats(); initViewmodel(); VM.setSniper(prepareSniper(MODELS.bolt_action_rifle_7_62));
  $('loading').hidden = true;
}

// ------------------------------------------------------------ missions
let M = null, sun = null, hemi = null, dir = null, endT = 0;
export const ctx = {
  done: false,
  complete(text) { if (ctx.done) return; ctx.done = true; endMission(true, text); },
  fail(text) { if (ctx.done) return; ctx.done = true; endMission(false, text); },
};
G.onAlarm = (by) => M && M.onAlarm && M.onAlarm(by);
G.onBlastKill = (e) => { stats.kills++; };
G.hurtPlayer = (d, from) => {
  if (!player.alive || player.god || G.demo) return;
  player.health -= d; player.regenT = 3.5; G.hurt = .6; sfx('hurt'); G.shake = Math.min(1, (G.shake || 0) + .25);
  if (player.health <= 0) { player.health = 0; player.alive = false; ctx.fail('Le commando Faucon est tombé.'); }
};
export function startMission(m, demo) {
  initAudio(); stopLoops(); reseed(m.seed || 7);
  M = m; G.mission = m; G.demo = !!demo; G.state = 'loading'; G.t = 0; G.time = 0; G.timeScale = 1; G.events.length = 0; for (const k in G.marks) delete G.marks[k];
  G.timers.length = 0; G.camOverride = null; G.droneOn = false; G.hideVM = false; G.shadowFocus = null; ctx.done = false; dir = null;
  camera.far = 5000; camera.near = .05; camera.updateProjectionMatrix();
  document.body.classList.remove('drone', 'cine');
  const scene = newScene();
  const L = m.light;
  setSky(SKIES[L.sky], L);
  if (L.fog) scene.fog = new THREE.FogExp2(L.fog[0], L.fog[1]);
  hemi = new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]); scene.add(hemi);
  G.sunDir = new V3(...L.sun.dir).normalize();
  sun = new THREE.DirectionalLight(L.sun.color, L.sun.intensity); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 300 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
  scene.add(sun, sun.target);
  VM.lights(scene.environment, G.sunDir.clone().multiplyScalar(3).add(new V3(-1, 1, 1)), L.sun.color);
  m.state = {}; m.build(); m.spawn();
  resetPlayer(m.player); M.timeLeft = m.time;
  hud.floor.hidden = true; hud.alarm.hidden = true;
  document.body.dataset.mission = m.id;
  $('start').hidden = true; $('end').hidden = true; $('hud').hidden = false;
  $('touch').hidden = !(IS_TOUCH && !demo); $('touch').classList.toggle('on', IS_TOUCH && !demo);
  document.body.classList.toggle('sniper', W.weapon === 'sniper');
  G.state = demo ? 'demo' : 'play';
  if (demo === 'cine') { player.hidden = true; G.hideVM = true; dir = cineShots(m); dir.next(); }
  else if (demo) { dir = m.demo(); dir.next(); }
  else { m.intro && radio(m.intro, 'QG', 6); if (!IS_TOUCH) renderer.domElement.requestPointerLock?.(); }
}
function endMission(win, text) {
  stopLoops();
  later(win ? 1.5 : 1, () => {
    if (CAPTURE) return;
    G.state = 'end'; G.demo = false; document.exitPointerLock?.(); G.camOverride = null;
    $('hud').hidden = true; $('touch').hidden = true; $('end').hidden = false;
    $('endTitle').innerHTML = win ? 'Mission<br>accomplie' : 'Mission<br>échouée'; $('endTitle').classList.toggle('fail', !win);
    $('endEyebrow').textContent = `RAPPORT · MISSION 0${M.num} · ${M.title.toUpperCase()}`;
    $('endText').textContent = text || '';
    const acc = stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0;
    $('stats').innerHTML = [['Temps', `${Math.floor(G.t / 60)}:${String(Math.floor(G.t % 60)).padStart(2, '0')}`], ['Ennemis éliminés', stats.kills], ['Tirs à la tête', stats.heads], ['Au couteau', stats.silent], ['Précision', `${acc} %`], ['Tir le plus long', stats.longest ? `${Math.round(stats.longest)} m` : '—']]
      .map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    $('next').hidden = !win || M.num >= MISSIONS.length;
  });
}

// --------------------------------------------------------------- boucle
function step(dtReal) {
  const dt = dtReal * G.timeScale;
  G.time += dt;
  runTimers();
  if (G.state === 'play' || G.state === 'demo') {
    G.t += dtReal;
    if (dir) { const r = dir.next(dt); if (r.done) { dir = null; if (!CAPTURE) ctx.complete(M.winText); else G.demoDone = true; } }
    else if (G.state === 'play') updatePlayer(dt);
    updateWeapon(dt); updateBullet(dt);
    for (const e of G.enemies) e.update(dt);
    for (const a of G.allies) a.update(dt);
    if (M.update) M.update(dt);
    if (!ctx.done && G.state === 'play' && M.time) { M.timeLeft -= dt; if (M.timeLeft <= 0) ctx.fail('Temps écoulé.'); }
  } else if (G.state === 'menu' || G.state === 'end') menuCam(dtReal);
  for (const u of G.updaters) u(dt);
  updateFX(dt);
  updateCamera(dtReal);
  if (sun) { const c = G.shadowFocus || (G.state === 'menu' ? new V3(0, 0, 0) : player.pos); sun.target.position.copy(c); sun.position.copy(c).addScaledVector(G.sunDir, 120); }
  G.hurt = Math.max(0, (G.hurt || 0) - dtReal * .8); G.flash = Math.max(0, (G.flash || 0) - dtReal * 1.5);
  grade.uniforms.uHurt.value = Math.max(G.hurt, (1 - player.health / 100) * .6 * (G.state === 'play' ? 1 : 0)); grade.uniforms.uFlash.value = G.flash;
  updateHUD(dtReal);
}
let menuA = 0;
function menuCam(dt) {
  if (!M) return; menuA += dt * .04; const c = M.menuCam || { r: 70, h: 26, cx: 0, cz: -8 };
  camera.position.set(c.cx + Math.sin(menuA) * c.r, c.h, c.cz + Math.cos(menuA) * c.r); camera.lookAt(c.cx, 0, c.cz);
  for (const e of G.enemies) e.update(dt);
}
let scopeKey = '';
function drawScope() {
  const c = $('scopeCanvas'), w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1), key = `${w}x${h}x${W.zoom}`;
  if (key === scopeKey) return; scopeKey = key; c.width = w * dpr; c.height = h * dpr; const g = c.getContext('2d'); g.scale(dpr, dpr);
  const R = Math.min(w, h) * .46, cx = w / 2, cy = h / 2;
  g.fillStyle = '#000'; g.beginPath(); g.rect(0, 0, w, h); g.arc(cx, cy, R, 0, Math.PI * 2, true); g.fill();
  const gr = g.createRadialGradient(cx, cy, R * .82, cx, cy, R); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  const fov = 50 / W.zooms[W.zoom], mil = h / fov * .0573; // pixels par milliradian
  g.strokeStyle = 'rgba(10,10,10,.95)'; g.fillStyle = 'rgba(10,10,10,.95)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx - 6, cy); g.moveTo(cx + 6, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy - 6); g.moveTo(cx, cy + 6); g.lineTo(cx, cy + R); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx - R * .55, cy); g.moveTo(cx + R * .55, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy + R * .55); g.lineTo(cx, cy + R); g.stroke();
  g.font = '600 11px Rajdhani, Arial'; g.textAlign = 'center';
  for (let i = 1; i <= 10; i++) { const d = i * mil; if (d > R * .55) break; const s = i % 5 ? 3 : 6;
    for (const [x, y, vx] of [[cx + d, cy, 0], [cx - d, cy, 0], [cx, cy + d, 1], [cx, cy - d, 1]]) { g.beginPath(); g.arc(x, y, s / 2.2, 0, Math.PI * 2); g.fill(); }
    if (i % 5 === 0) { g.fillText(String(i), cx + d, cy - 8); g.fillText(String(i), cx - d, cy - 8); } }
  g.fillStyle = 'rgba(255,40,30,.9)'; g.beginPath(); g.arc(cx, cy, 1.6, 0, Math.PI * 2); g.fill();
}
function updateHUD(dt) {
  updateHudFx(dt);
  if (!hud.scope.hidden) drawScope();
  if (G.state !== 'play' && G.state !== 'demo') return;
  const s = VM.s;
  setText(hud.mag, 'mag', s.knifeT > 0 ? '—' : s.reload > 0 ? '··' : String(W.mag)); setText(hud.res, 'res', `/ ${W.reserve}`);
  setText(hud.wname, 'wn', s.knifeT > 0 ? 'COUTEAU' : W.weapon === 'sniper' ? 'R-700 · 7,62' : 'VK-12');
  hud.hpBar.style.width = `${player.health | 0}%`; hud.hpBar.classList.toggle('low', player.health < 35);
  const sp = 10 + player.speed * 3 + s.kick * 10, ch = hud.cross.children;
  ch[0].style.top = `${-sp - 9}px`; ch[1].style.top = `${sp}px`; ch[2].style.left = `${-sp - 9}px`; ch[3].style.left = `${sp}px`;
  hud.cross.style.opacity = s.ads > .5 || G.camOverride || player.mode !== 'foot' ? 0 : 1;
  const tl = Math.max(0, Math.ceil(M.timeLeft || 0)); setText(hud.timer, 'timer', `${String((tl / 60) | 0).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`);
  hud.timer.classList.toggle('low', (M.timeLeft || 99) < 30);
  const o = M.objective ? M.objective() : { text: '' };
  setText(hud.objText, 'obj', o.text);
  hud.prompt.hidden = !o.prompt; if (o.prompt) { setText(hud.promptText, 'pt', IS_TOUCH ? o.prompt.replace('E :', 'ACTION :') : o.prompt); hud.promptBar.style.width = `${((o.progress || 0) * 100) | 0}%`; }
  const show = !!o.target && !G.camOverride;
  hud.marker.style.display = show ? '' : 'none';
  if (show) {
    const v = o.target.clone().project(camera); const behind = v.z > 1;
    let x = (v.x * .5 + .5) * innerWidth, y = (-v.y * .5 + .5) * innerHeight;
    if (behind) { x = innerWidth - x; y = innerHeight - 40; }
    hud.marker.style.transform = `translate(${clamp(x, 30, innerWidth - 30)}px, ${clamp(y, 90, innerHeight - 60)}px) translate(-50%, -50%)`;
    setText(hud.markerDist, 'md', `${Math.round(o.target.distanceTo(player.pos))} m`);
  }
}

function* cineShots(m) {
  for (const [p0, p1, t0, t1, d] of m.cine) { G.events.push({ t: +G.t.toFixed(3), type: 'cut' }); yield* camPath([new V3(...p0), new V3(...p1)], [new V3(...t0), new V3(...t1)], d, { linear: true, near: .5 }); }
}
// ------------------------------------------------------------ commandes
const LOOK = .0022;
addEventListener('keydown', (e) => {
  G.input.keys[e.code] = true; if (G.state !== 'play') return;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyF' || e.code === 'KeyV') knifeAttack();
  if (e.code === 'KeyT') lase();
  if (e.code === 'KeyC' || e.code === 'ControlLeft') player.crouchOn = !player.crouchOn;
  if (e.code === 'KeyE') G.input.action = true;
  if (M && M.onKey) M.onKey(e.code);
});
addEventListener('keyup', (e) => { G.input.keys[e.code] = false; if (e.code === 'KeyE') G.input.action = false; });
const cv = renderer.domElement;
cv.addEventListener('mousedown', (e) => { if (G.state !== 'play' || IS_TOUCH) return; if (document.pointerLockElement !== cv) { cv.requestPointerLock?.(); return; } G.input.keys['Mouse' + e.button] = true; });
addEventListener('mouseup', (e) => { G.input.keys['Mouse' + e.button] = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { if (G.state === 'play' && W.weapon === 'sniper') W.zoom = clamp(W.zoom + (e.deltaY > 0 ? -1 : 1), 0, W.zooms.length - 1); });
addEventListener('mousemove', (e) => {
  if (G.state !== 'play' || document.pointerLockElement !== cv) return;
  if (M && M.onLook && M.onLook(e.movementX, e.movementY)) return;
  const s = LOOK * (1 - VM.s.ads * .45) * (W.weapon === 'sniper' && VM.s.ads > .5 ? 1 / W.zooms[W.zoom] * 2.5 : 1);
  player.yaw -= e.movementX * s; player.pitch = clamp(player.pitch - e.movementY * s, -1.45, 1.45);
  VM.s.swayX = clamp(VM.s.swayX - e.movementX * .00025, -.03, .03); VM.s.swayY = clamp(VM.s.swayY + e.movementY * .00025, -.03, .03);
});
const joy = $('joy'), joyKnob = joy.querySelector('b'), touches = {};
const tz = $('touch');
tz.addEventListener('touchstart', (e) => {
  if (G.state !== 'play') return;
  for (const t of e.changedTouches) {
    const btn = t.target.closest?.('.tb');
    if (btn) { const act = btn.dataset.act; btn.classList.add('on');
      if (act === 'fire') { G.input.fire = true; touches[t.identifier] = { kind: 'look', x: t.clientX, y: t.clientY, btn }; }
      else if (act === 'ads') { G.input.ads = !G.input.ads; btn.classList.toggle('on', G.input.ads); }
      else if (act === 'knife') { knifeAttack(); touches[t.identifier] = { kind: 'btn', btn }; }
      else if (act === 'reload') { startReload(); touches[t.identifier] = { kind: 'btn', btn }; }
      else if (act === 'action') { G.input.action = true; touches[t.identifier] = { kind: 'btn', btn, act }; }
      else if (act === 'crouch') { player.crouchOn = !player.crouchOn; btn.classList.toggle('on', player.crouchOn); }
      else if (act === 'zoom') { W.zoom = (W.zoom + 1) % W.zooms.length; touches[t.identifier] = { kind: 'btn', btn }; }
      else if (act === 'lase') { lase(); touches[t.identifier] = { kind: 'btn', btn }; }
      e.preventDefault(); continue; }
    if (t.clientX < innerWidth * .45 && !Object.values(touches).some(v => v.kind === 'joy')) { touches[t.identifier] = { kind: 'joy', x: t.clientX, y: t.clientY }; joy.style.display = 'block'; joy.style.left = t.clientX + 'px'; joy.style.top = t.clientY + 'px'; joyKnob.style.transform = ''; }
    else touches[t.identifier] = { kind: 'look', x: t.clientX, y: t.clientY };
    e.preventDefault();
  }
}, { passive: false });
tz.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) { const s = touches[t.identifier]; if (!s) continue;
    if (s.kind === 'joy') { let dx = t.clientX - s.x, dy = t.clientY - s.y; const d = Math.hypot(dx, dy), R = 55; if (d > R) { dx *= R / d; dy *= R / d; } joyKnob.style.transform = `translate(${dx}px, ${dy}px)`; G.input.s = dx / R; G.input.f = -dy / R; G.input.sprint = d > R * 1.25 && -dy > 0; }
    else if (s.kind === 'look') { const dx = t.clientX - s.x, dy = t.clientY - s.y; s.x = t.clientX; s.y = t.clientY; const k = .0052 * (1 - VM.s.ads * .5) * (W.weapon === 'sniper' && VM.s.ads > .5 ? 2.5 / W.zooms[W.zoom] : 1); player.yaw -= dx * k; player.pitch = clamp(player.pitch - dy * k, -1.4, 1.4); } }
  e.preventDefault();
}, { passive: false });
const tEnd = (e) => { for (const t of e.changedTouches) { const s = touches[t.identifier]; if (!s) continue; if (s.kind === 'joy') { joy.style.display = 'none'; G.input.f = G.input.s = 0; G.input.sprint = false; }
  if (s.btn) { if (!['ads', 'crouch'].includes(s.btn.dataset.act)) s.btn.classList.remove('on'); if (s.btn.dataset.act === 'fire') G.input.fire = false; if (s.act === 'action') G.input.action = false; } delete touches[t.identifier]; } };
tz.addEventListener('touchend', tEnd); tz.addEventListener('touchcancel', tEnd);

// --------------------------------------------------------------- menus
function buildMenu() {
  const list = $('missions'); list.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mcard'; b.innerHTML = `<span class="n">0${m.num}</span><span class="t">${m.title}</span><span class="d">${m.place}</span>`;
    b.addEventListener('click', () => selectMission(i)); list.appendChild(b);
  });
  selectMission(0);
}
let sel = 0;
function selectMission(i) {
  sel = i; const m = MISSIONS[i];
  [...$('missions').children].forEach((c, k) => c.classList.toggle('on', k === i));
  $('mTitle').textContent = m.title; $('mPlace').textContent = m.place;
  $('mObj').innerHTML = m.brief.map(b => `<li>${b}</li>`).join(''); $('mText').innerHTML = m.text;
  if (!CAPTURE) { startMenuScene(m); }
}
function startMenuScene(m) { startMission(m, false); G.state = 'menu'; $('hud').hidden = true; $('touch').hidden = true; $('start').hidden = false; document.exitPointerLock?.(); }
$('play').addEventListener('click', () => startMission(MISSIONS[sel], false));
$('watch').addEventListener('click', () => startMission(MISSIONS[sel], true));
$('again').addEventListener('click', () => startMission(M, false));
$('next').addEventListener('click', () => { const i = MISSIONS.indexOf(M) + 1; selectMission(i); startMission(MISSIONS[i], false); });
function toMenu() { $('end').hidden = true; document.exitPointerLock?.(); stopLoops(); selectMission(Math.max(0, MISSIONS.indexOf(M))); }
$('menu').addEventListener('click', toMenu);
$('pause').addEventListener('click', toMenu);
addEventListener('keydown', (e) => { if (e.code === 'Escape' && (G.state === 'play' || G.state === 'demo')) toMenu(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.state === 'play' && !IS_TOUCH && !CAPTURE) G.paused = true; });
if (IS_TOUCH) { $('keysDesk').hidden = true; $('keysTouch').hidden = false; }

// ------------------------------------------------- démarrage + tournage
load().then(() => {
  window.__game = { G, player, W, VM, stats, MISSIONS, startMission, step, render, explosion, FX, THREE };
  if (CAPTURE) {
    window.__cap = {
      start(id, demo = true) { startMission(MISSIONS.find(m => m.id === id), demo); return true; },
      size(w, h) { resize(); },
      frame(dt) { step(dt); render(); return { t: G.t, done: !!G.demoDone }; },
      events: () => G.events, marks: () => G.marks,
    };
    window.__ready = true;
  } else {
    buildMenu();
    const q = params.get('mission'); if (q) { const i = MISSIONS.findIndex(m => m.id === q); if (i >= 0) { selectMission(i); if (params.has('demo')) startMission(MISSIONS[i], true); } }
    let last = performance.now();
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; step(dt); render(); };
    requestAnimationFrame(loop);
  }
}).catch(e => { $('loadText').textContent = 'Erreur de chargement : ' + e.message; console.error(e); });
