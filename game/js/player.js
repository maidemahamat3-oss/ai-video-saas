// =====================================================================
// Le commando : déplacements, caméra, tir, couteau, fusil de précision
// (balistique réelle + caméra qui suit la balle), conduite.
// =====================================================================
import { THREE, V3, TAU, G, rnd, rr, clamp, lerp, damp, lerpAng, angDiff, easeInOut, collide, rayWorld, rayBoxes,
  tracer, impact, bloodHit, muzzleFX, sfx, hitmark, stamp, feed, later, camera, vmCamera, hud, setText, FX, IS_TOUCH, detonate } from './engine.js';
import { Viewmodel } from './weapons.js';

export const player = {
  pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, recoil: 0, health: 100, alive: true, crouch: 0, crouchOn: false,
  speed: 0, sprinting: false, bob: 0, regenT: 0, god: false, hidden: false, floorY: 0, mode: 'foot', prone: false,
  eyePos() { return new V3(this.pos.x, this.pos.y + (this.prone ? .32 : 1.62 - this.crouch * .6), this.pos.z); },
};
G.player = player;
export const W = { weapon: 'rifle', mag: 30, magSize: 30, reserve: 150, cd: 0, empty: 0, zoom: 0, zooms: [6, 14, 30], range: 0, elev: 0, wind: 0, holdBreath: 0, bullet: null };
export let VM = null;
export function initViewmodel() { VM = new Viewmodel(); return VM; }
export const stats = { kills: 0, heads: 0, silent: 0, shots: 0, hits: 0, longest: 0 };
export function resetPlayer(o = {}) {
  Object.assign(player, { yaw: o.yaw ?? 0, pitch: o.pitch ?? 0, recoil: 0, health: 100, alive: true, crouch: 0, crouchOn: false, speed: 0, god: false, hidden: false, floorY: o.floorY ?? 0, mode: o.mode || 'foot', prone: !!o.prone });
  player.pos.set(o.x || 0, 0, o.z || 0); player.pos.y = player.floorY + G.ground(player.pos.x, player.pos.z); player.vel.set(0, 0, 0);
  Object.assign(W, { weapon: o.weapon || 'rifle', mag: o.weapon === 'sniper' ? 5 : 30, magSize: o.weapon === 'sniper' ? 5 : 30, reserve: o.weapon === 'sniper' ? 20 : 150, cd: 0, zoom: 0, range: 0, elev: 0, bullet: null });
  Object.assign(stats, { kills: 0, heads: 0, silent: 0, shots: 0, hits: 0, longest: 0 });
  VM.setMode(W.weapon); Object.assign(VM.s, { ads: 0, reload: 0, knifeT: 0, holster: 0, bolt: 0 });
}

// --------------------------------------------------------- déplacements
export function updatePlayer(dt) {
  if (!player.alive || player.mode !== 'foot') return;
  const I = G.input, k = I.keys;
  let f = I.f, s = I.s;
  if (k.KeyW || k.ArrowUp) f += 1; if (k.KeyS || k.ArrowDown) f -= 1; if (k.KeyD || k.ArrowRight) s += 1; if (k.KeyA || k.ArrowLeft) s -= 1;
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  if (player.prone) { f = s = 0; }
  player.crouch = damp(player.crouch, player.crouchOn ? 1 : 0, 10, dt);
  const sprint = (I.sprint || k.ShiftLeft || k.ShiftRight) && f > .5 && VM.s.ads < .2 && player.crouch < .3;
  player.sprinting = sprint;
  const sp = sprint ? 6.8 : player.crouch > .5 ? 2.3 : VM.s.ads > .5 ? 2.8 : 4.3;
  const fwd = new V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)), right = new V3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const want = fwd.multiplyScalar(f * sp).add(right.multiplyScalar(s * sp));
  player.vel.x = damp(player.vel.x, want.x, 11, dt); player.vel.z = damp(player.vel.z, want.z, 11, dt);
  player.pos.addScaledVector(player.vel, dt); collide(player.pos, .38, 1.8);
  player.pos.y = player.floorY + G.ground(player.pos.x, player.pos.z);
  player.speed = Math.hypot(player.vel.x, player.vel.z); player.bob += dt * player.speed * 1.9;
  player.regenT -= dt; if (player.regenT <= 0 && player.health < 100) player.health = Math.min(100, player.health + 14 * dt);
}
export function updateCamera(dt) {
  if (G.camOverride) { G.camOverride(dt); return; }
  if (G.droneOn) return;
  const ep = player.eyePos(), s = VM.s, bobA = player.speed > .3 ? 1 : 0;
  camera.position.set(ep.x + Math.cos(player.bob) * .03 * bobA * (1 - s.ads), ep.y + Math.abs(Math.sin(player.bob)) * .05 * bobA * (1 - s.ads * .7), ep.z);
  const sh = (G.shake || 0) ** 2; G.shake = Math.max(0, (G.shake || 0) - dt * 1.5);
  let sx = 0, sy = 0;
  if (W.weapon === 'sniper' && s.ads > .5 && !G.demo) { const b = 1 - W.holdBreath; sx = Math.sin(G.time * .9) * .0016 * b + Math.sin(G.time * 2.3) * .0005; sy = Math.sin(G.time * 1.3) * .0012 * b; }
  player.recoil = damp(player.recoil, 0, 5.5, dt);
  camera.rotation.set(player.pitch + player.recoil + sy + (rnd() - .5) * sh * .06, player.yaw + sx + (rnd() - .5) * sh * .06, (rnd() - .5) * sh * .04);
  let fov = camera.userData.baseFov * (player.sprinting ? 1.06 : 1);
  if (W.weapon === 'sniper' && s.ads > .5) fov = 50 / W.zooms[W.zoom];
  else fov -= s.ads * 18;
  if (Math.abs(camera.fov - fov) > .001) { camera.fov = W.weapon === 'sniper' && s.ads > .5 ? fov : damp(camera.fov, fov, 12, dt); camera.near = camera.fov < 10 ? 25 : .05; camera.updateProjectionMatrix(); }
}

// ------------------------------------------------------------ armes
export function camDir(spread = 0) {
  const d = new V3(0, 0, -1).applyEuler(camera.rotation);
  if (spread) d.add(new V3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(spread)).normalize();
  return d;
}
export function updateWeapon(dt) {
  W.cd -= dt; W.empty -= dt;
  const I = G.input, s = VM.s;
  const adsWanted = (I.ads || I.keys.Mouse2) && s.reload <= 0 && s.knifeT <= 0 && !player.sprinting && player.mode === 'foot';
  VM.update(dt, { ads: adsWanted, sprint: player.sprinting, speed: player.speed, bob: player.bob });
  W.holdBreath = damp(W.holdBreath, I.keys.ShiftLeft && W.weapon === 'sniper' ? 1 : 0, 3, dt);
  if (s.reload > 0 && s.reload - dt <= 0) { const n = Math.min(W.magSize - W.mag, W.reserve); W.mag += n; W.reserve -= n; }
  if (s.knifeT > 0 && !s.knifeHit && s.knifeT < s.knifeMax - .14) { s.knifeHit = true; knifeResolve(); }
  if ((I.fire || I.keys.Mouse0) && G.state === 'play' && player.mode === 'foot') fire();
  hud.scope.hidden = !(W.weapon === 'sniper' && s.ads > .6 && !G.camOverride);
  if (!hud.scope.hidden) setText(hud.scopeInfo, 'si', `${W.zooms[W.zoom]}×   ·   DIST ${W.range ? Math.round(W.range) + ' m' : '— (T)'}   ·   VENT ${Math.abs(W.wind).toFixed(1)} m/s ${W.wind > 0 ? '→' : '←'}`);
}
export function fire() {
  const s = VM.s;
  if (s.reload > 0 || s.knifeT > 0 || s.holster > .1 || W.cd > 0 || W.bullet) return;
  if (W.mag <= 0) { if (W.empty <= 0) { sfx('empty'); W.empty = .3; } startReload(); return; }
  if (W.weapon === 'sniper') return fireSniper();
  W.mag--; W.cd = .1; stats.shots++;
  const spread = lerp(.015 + player.speed * .004, .0022, s.ads);
  const o = camera.position.clone(), d = camDir(spread);
  const hit = rayWorld(o, d, 300);
  const mz = camera.localToWorld(new V3(lerp(.14, 0, s.ads), lerp(-.13, -.07, s.ads), -.85));
  tracer(mz, hit ? hit.point : o.clone().addScaledVector(d, 150));
  muzzleFX(mz, d, .9);
  if (hit) {
    if (hit.actor) { const e = hit.actor; stats.hits++; bloodHit(hit.point, d); const killed = e.damage(hit.head ? (e.kind === 'boss' ? 80 : 140) : 36, hit.head, d); if (killed) onKill(e, hit.head ? 'head' : 'rifle'); else hitmark(false); }
    else { impact(hit.point, hit.normal, hit.c?.tag === 'metal' ? 'metal' : 'concrete'); if (hit.c?.tag === 'explosive') detonate(hit.c); }
  }
  for (const e of G.enemies) if (!e.dead && e.pos.distanceTo(player.pos) < 45) e.alert(player.pos);
  VM.fire(); player.recoil += lerp(.02, .011, s.ads); player.yaw += rr(-.004, .004); G.shake = Math.min(1, (G.shake || 0) + .05);
  sfx('shot');
  if (W.mag === 0 && W.reserve > 0) later(.22, startReload);
}
export function startReload() {
  const s = VM.s; if (s.reload > 0 || W.mag >= W.magSize || W.reserve <= 0 || s.knifeT > 0) return;
  s.reloadT = W.weapon === 'sniper' ? 2.6 : 1.9; s.reload = s.reloadT; sfx('reload');
}
export function knifeAttack() { const s = VM.s; if (s.knifeT > 0 || s.reload > 0 || W.weapon === 'sniper') return; s.knifeT = s.knifeMax; s.knifeHit = false; sfx('knife'); }
function knifeResolve() {
  let best = null, bd = 2.6; const fwd = new V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  for (const e of G.enemies) { if (e.dead) continue; const to = new V3().subVectors(e.pos, player.pos); if (Math.abs(to.y) > 1.2) continue; to.y = 0; const d = to.length(); if (d < bd && to.normalize().dot(fwd) > .5) { best = e; bd = d; } }
  if (!best) return;
  const behind = Math.cos(angDiff(best.yaw, Math.atan2(player.pos.x - best.pos.x, player.pos.z - best.pos.z))) < -.2;
  const silent = best.state !== 'alert' || behind;
  sfx('stab'); bloodHit(best.eye().add(new V3(0, -.35, 0)), fwd);
  if (silent) { best.damage(999, false, fwd); onKill(best, 'silent'); } else { if (best.damage(55, false, fwd)) onKill(best, 'knife'); else hitmark(false); }
  G.shake = Math.min(1, (G.shake || 0) + .15);
}
export function onKill(e, how, dist) {
  stats.kills++; hitmark(true);
  if (how === 'sniper') { stamp(`TIR À ${Math.round(dist)} M`, true); feed(`<b>R-700</b> · ${Math.round(dist)} m`); }
  else if (e.kind === 'boss') { stamp('CIBLE PRINCIPALE ÉLIMINÉE', true); feed('<b>VK-12</b> · cible principale'); }
  else if (how === 'head') { stats.heads++; stamp('TIR À LA TÊTE', true); feed('<b>VK-12</b> · garde éliminé · tête'); }
  else if (how === 'silent') { stats.silent++; stamp('ÉLIMINATION SILENCIEUSE', true); feed('<b>COUTEAU</b> · élimination silencieuse'); }
  else feed(`<b>${how === 'knife' ? 'COUTEAU' : 'VK-12'}</b> · garde éliminé`);
  sfx('kill', { how });
}

// ---------------------------------------------------- fusil de précision
const V0 = 880, KD = .0003, GRAV = 9.81;
// Où la balle passera-t-elle ? (même physique que le vol réel) → écart angulaire avec la cible
export function predictImpact(target) {
  const o = player.eyePos(), d = new V3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  const side = new V3(-d.z, 0, d.x).normalize(), v = d.clone().applyAxisAngle(side, W.elev).multiplyScalar(V0), wind = new V3(side.x, 0, side.z).multiplyScalar(-W.wind);
  const p = o.clone().addScaledVector(d, .8), want = target.clone().sub(o), wantH = Math.hypot(want.x, want.z); let best = p.clone(), bd = 1e9; const h = 1 / 240;
  for (let t = 0; t < 12; t += h) { const sp = v.length(); v.addScaledVector(v, -KD * sp * h); v.y -= GRAV * h; v.addScaledVector(wind, h * .35); p.addScaledVector(v, h);
    const dd = p.distanceTo(target); if (dd < bd) { bd = dd; best.copy(p); } else if (Math.hypot(p.x - o.x, p.z - o.z) > wantH + 20) break; }
  const got = best.sub(o);
  return { yaw: angDiff(Math.atan2(-want.x, -want.z), Math.atan2(-got.x, -got.z)), pitch: Math.atan2(got.y, Math.hypot(got.x, got.z)) - Math.atan2(want.y, wantH), miss: bd };
}
// angle de hausse pour toucher à la distance `range` (mesurée sur la ligne de visée)
export function elevationFor(range) {
  let lo = 0, hi = .15;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; const v = new V3(Math.cos(m), Math.sin(m), 0).multiplyScalar(V0), p = new V3(); let y = 0;
    for (let t = 0; t < 12; t += .005) { const sp = v.length(); v.addScaledVector(v, -KD * sp * .005); v.y -= GRAV * .005; p.addScaledVector(v, .005); if (p.x >= range) { y = p.y; break; } }
    if (y > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
export function lase() {
  const h = rayWorld(camera.position, camDir(0), 6000, true);
  if (h) { W.range = h.t; W.elev = elevationFor(h.t); sfx('beep'); }
  return W.range;
}
export function fireSniper(opts = {}) {
  const s = VM.s; W.mag--; W.cd = 1.4; stats.shots++;
  const d = G.demo ? new V3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ')) : camDir(0), side = new V3(-d.z, 0, d.x).normalize();
  const dir = d.clone().applyAxisAngle(side, W.elev).normalize();
  const mz = (G.demo ? player.eyePos() : camera.position.clone()).addScaledVector(d, .8);
  const los = rayWorld(mz, d, 6000, true);
  W.bullet = { p: mz.clone(), v: dir.multiplyScalar(V0), t: 0, start: mz.clone(), aim: los ? los.point : mz.clone().addScaledVector(d, W.range || 1000), done: false, cam: opts.cam ?? (W.range > 600 || G.demo), wind: new V3(side.x, 0, side.z).multiplyScalar(-W.wind) };
  VM.fire(); s.bolt = .9; later(.5, () => sfx('bolt')); player.recoil += .05; G.shake = Math.min(1, (G.shake || 0) + .3);
  muzzleFX(mz, d, 2.2); sfx('sniper');
  for (let i = 0; i < 8; i++) FX.smoke.spawn({ p: player.pos.clone().add(new V3(rr(-1.2, 1.2), .2, rr(-1.2, 1.2))), v: new V3(rr(-1, 1), .3, rr(-1, 1)), life: 1.5, s0: .5, s1: 2, c0: 0x9a8a70, a: .35 });
  if (W.bullet.cam) startBulletCam();
}
const bulletMesh = (() => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CapsuleGeometry(.009, .06, 4, 12), new THREE.MeshStandardMaterial({ color: 0xc87a40, metalness: 1, roughness: .2 })); m.rotation.x = Math.PI / 2; g.add(m);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(.004, .012, 1.2, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); tr.rotation.x = Math.PI / 2; tr.position.z = -.65; g.add(tr); return g; })();
function startBulletCam() {
  G.hideVM = true; G.scene.add(bulletMesh); hud.scope.hidden = true; document.body.classList.add('cine');
  let hold = 0, side = rnd() < .5 ? 1 : -1;
  G.camOverride = (dt) => {
    const b = W.bullet; if (!b) return;
    bulletMesh.position.copy(b.p); bulletMesh.lookAt(b.p.clone().sub(b.v));
    const dir = b.v.clone().normalize(), right = new V3(-dir.z, 0, dir.x).normalize();
    if (camera.fov !== 38) { camera.fov = 38; camera.near = .02; camera.updateProjectionMatrix(); }
    if (b.done) { // après l'impact : on recule lentement en regardant la cible tomber
      hold += dt; const k = Math.min(1, hold / 2.4);
      camera.position.copy(b.p).addScaledVector(dir, -2.2 - k * 2.5).addScaledVector(right, side * (1.6 + k * 1.2)).add(new V3(0, .5 + k * .6, 0)); camera.lookAt(b.p);
      if (hold / Math.max(G.timeScale, .05) > 2.5 || hold > 2.6) endBulletCam(); return;
    }
    const close = (b.remaining ?? 9999) < 70;
    if (!close) { const toAim = b.aim.clone().sub(b.p).normalize(); camera.position.copy(b.p).addScaledVector(toAim, -.75).addScaledVector(right, side * .12).add(new V3(0, .1, 0)); camera.lookAt(b.aim); }
    else { camera.position.copy(b.p).addScaledVector(dir, -.9).addScaledVector(right, side * 1.1).add(new V3(0, .25, 0)); camera.lookAt(b.p.clone().addScaledVector(dir, 2.5)); }
  };
}
function endBulletCam() { G.camOverride = null; G.hideVM = false; G.timeScale = 1; G.scene.remove(bulletMesh); W.bullet = null; document.body.classList.remove('cine'); camera.near = .05; }
export function updateBullet(dtWorld) {
  const b = W.bullet; if (!b || b.done) return;
  // ralenti cinématique pendant le vol
  if (b.cam) { const remain = b.remaining ?? 9999; G.timeScale = remain < 25 ? .06 : remain < 120 ? .2 : 1; }
  const n = 8, h = dtWorld / n;
  for (let i = 0; i < n && !b.done; i++) {
    const sp = b.v.length(); const prev = b.p.clone();
    b.v.addScaledVector(b.v, -KD * sp * h); b.v.y -= GRAV * h; b.v.addScaledVector(b.wind, h * .35); b.p.addScaledVector(b.v, h); b.t += h;
    const seg = new V3().subVectors(b.p, prev), L = seg.length(); seg.normalize();
    const hit = rayWorld(prev, seg, L, true);
    if (hit) {
      b.done = true; b.p.copy(hit.point); const dist = hit.point.distanceTo(b.start);
      if (b.cam) G.timeScale = .3;
      if (hit.actor) { const e = hit.actor; bloodHit(hit.point, seg); for (let k = 0; k < 6; k++) bloodHit(hit.point, seg); if (e.damage(999, hit.head, seg)) { stats.hits++; stats.longest = Math.max(stats.longest, dist); onKill(e, 'sniper', dist); } }
      else impact(hit.point, hit.normal);
      sfx('impact', { d: dist });
      for (const e of G.enemies) if (!e.dead && e.pos.distanceTo(hit.point) < 40) e.alert(player.pos, true);
      if (!b.cam) W.bullet = null;
    }
    if (b.t > 10) { b.done = true; W.bullet = null; }
  }
  // distance restante jusqu'à la cible visée (pour le ralenti)
  if (b && !b.done) { const look = rayWorld(b.p, b.v.clone().normalize(), 400, true); b.remaining = look ? look.t : 9999;
    if (b.cam && rnd() < .7) FX.smoke.spawn({ p: b.p.clone(), life: .6, s0: .02, s1: .12, c0: 0xd8d0c0, a: .25, drag: 4 }); }
}
