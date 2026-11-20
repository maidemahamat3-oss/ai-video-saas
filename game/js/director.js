// =====================================================================
// Réalisateur : outils pour écrire les démos filmées des missions
// (déplacements, visée, tirs, plans de caméra). Générateurs : yield = 1 image.
// =====================================================================
import { V3, G, clamp, lerp, lerpAng, angDiff, easeInOut, collide, camera, mark } from './engine.js';
import { player, fire, knifeAttack, VM, W } from './player.js';

export { mark };
export const E = (id) => G.enemies.find(e => e.id === id) || G.allies.find(e => e.id === id);
export function* wait(s) { let t = 0; while (t < s) t += yield; }
export function look(p, k, dt) {
  const ep = player.eyePos(), d = new V3().subVectors(p, ep);
  const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  player.yaw = lerpAng(player.yaw, yaw, k * dt); player.pitch = lerp(player.pitch, pitch, clamp(k * dt, 0, 1));
  return Math.abs(angDiff(player.yaw, yaw)) + Math.abs(player.pitch - pitch);
}
export function* lookAt(p, dur, k = 5) { for (let t = 0; t < dur;) { const dt = yield; t += dt; look(typeof p === 'function' ? p() : p, k, dt); } }
export function* walk(pts, speed, o = {}) {
  for (const [x, z] of pts) {
    const tgt = new V3(x, 0, z); let stuck = 0, last = Infinity;
    while (true) {
      const dt = yield; const to = new V3().subVectors(tgt, player.pos); to.y = 0; const d = to.length(); if (d < .25) break;
      if (d > last - .01) { stuck += dt; if (stuck > 1.5) { player.pos.x = tgt.x; player.pos.z = tgt.z; console.warn('walk: bloqué, téléporté', x, z); break; } } else stuck = 0; last = d;
      player.vel.copy(to.normalize().multiplyScalar(speed)); player.pos.addScaledVector(player.vel, Math.min(dt, d / speed)); collide(player.pos, .38, 1.8);
      player.pos.y = player.floorY + G.ground(player.pos.x, player.pos.z);
      player.speed = speed; player.bob += dt * speed * 1.9; player.sprinting = speed > 6;
      if (o.lookAt) look(typeof o.lookAt === 'function' ? o.lookAt() : o.lookAt, o.k || 5, dt);
      else { player.yaw = lerpAng(player.yaw, Math.atan2(-tgt.x + player.pos.x, -tgt.z + player.pos.z), 6 * dt); player.pitch = lerp(player.pitch, o.pitch ?? -.05, 4 * dt); }
      if (o.during) o.during(dt);
    }
  }
  player.speed = 0; player.sprinting = false; player.vel.set(0, 0, 0);
}
function demoFire() { const s = G.state; G.state = 'play'; fire(); G.state = s; }
export function* aimAndKill(id, o = {}) {
  const e = E(id); if (!e || e.dead) return; G.input.ads = !!o.ads; let t = 0;
  while (!e.dead && t < (o.max || 3.5)) {
    const dt = yield; t += dt;
    const tgt = e.eye().add(new V3(0, o.head ? .03 : -.45, 0));
    const err = look(tgt, o.k || 9, dt);
    if (err < .025 && t > (o.delay || .25)) { G.input.fire = true; demoFire(); } else G.input.fire = false;
  }
  G.input.fire = false; if (!o.keepAds) G.input.ads = false;
}
export function* knifeKill(id) { const e = E(id); look(e.eye(), 30, .03); knifeAttack(); yield* wait(.6); }
// Plan de caméra libre (drone, plan fixe, travelling)
export function* camPath(points, targets, dur, o = {}) {
  G.droneOn = true; document.body.classList.add('drone'); let t = 0;
  while (t < dur) {
    const u = o.linear ? t / dur : easeInOut(t / dur);
    const seg = u * (points.length - 1), i = Math.min(points.length - 2, seg | 0), f = seg - i;
    camera.position.lerpVectors(points[i], points[i + 1], f);
    const tg = typeof targets === 'function' ? targets(u) : (() => { const s2 = u * (targets.length - 1), j = Math.min(targets.length - 2, s2 | 0); return new V3().lerpVectors(targets[j], targets[j + 1], s2 - j); })();
    camera.lookAt(tg);
    if (o.fov && camera.fov !== o.fov) { camera.fov = o.fov; camera.updateProjectionMatrix(); }
    if (camera.near !== (o.near ?? .3)) { camera.near = o.near ?? .3; camera.updateProjectionMatrix(); }
    t += yield;
  }
  G.droneOn = false; document.body.classList.remove('drone'); camera.fov = camera.userData.baseFov; camera.near = .05; camera.updateProjectionMatrix();
}
export function* hold(fn, dur) { for (let t = 0; t < dur;) { const dt = yield; t += dt; fn(dt, t); } }
