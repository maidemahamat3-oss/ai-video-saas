// =====================================================================
// Personnages et véhicules : soldats masqués animés (modèle 3D skinné),
// otage, boss ; voiture tout-terrain, hélicoptère, vedette.
// =====================================================================
import { THREE, V3, TAU, G, rnd, rr, clamp, lerp, damp, lerpAng, angDiff, easeInOut, collide, lineOfSight, rayWorld,
  tracer, muzzleFX, sfx, impact, camera } from './engine.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { makeRifle } from './weapons.js';

let SOLDIER = null;
export const setSoldierAsset = (gltf) => { SOLDIER = gltf; };
const TINT = {
  enemy: { body: 0x7a766e, visor: 0x1a0a0a, visorE: 0x550000 },
  boss: { body: 0x5a2a28, visor: 0x101010, visorE: 0xaa6a00 },
  ally: { body: 0xd8742a, visor: 0x202020, visorE: 0x000000 },
};
const _v = new V3(), _w = new V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

function aimBone(bone, childWorld, desiredWorld) {
  const bp = bone.getWorldPosition(new V3());
  const cur = childWorld.clone().sub(bp).normalize(), want = desiredWorld.clone().sub(bp).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(cur, want);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion()); q.multiply(wq);
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(pq.multiply(q)); bone.updateMatrixWorld(true);
}
function rotateBoneWorld(bone, axis, angle) {
  const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion()); q.multiply(wq);
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(pq.multiply(q)); bone.updateMatrixWorld(true);
}
function ik(up, lo, hand, target, pole) {
  const a = up.getWorldPosition(new V3()), b = lo.getWorldPosition(new V3()), c = hand.getWorldPosition(new V3());
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const d = clamp(a.distanceTo(target), .05, l1 + l2 - .002);
  const dir = target.clone().sub(a).normalize();
  const ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const pd = pole.clone().sub(a); pd.addScaledVector(dir, -pd.dot(dir)).normalize();
  const elbow = a.clone().addScaledVector(dir, ca * l1).addScaledVector(pd, sa * l1);
  aimBone(up, b, elbow);
  aimBone(lo, hand.getWorldPosition(new V3()), target);
}

// ================================================================ soldat
export class Soldier {
  constructor(o = {}) {
    this.kind = o.kind || 'enemy'; this.id = o.id || 'x';
    this.baseY = o.y || 0; this.pos = new V3(o.x || 0, 0, o.z || 0); this.pos.y = this.baseY + G.ground(this.pos.x, this.pos.z); this.yaw = o.yaw ?? 0; this.scanBase = this.yaw;
    this.path = (o.path || []).map(([a, b]) => new V3(a, 0, b)); this.wp = 0; this.wait = 0;
    this.fixed = !!o.fixed; this.range = o.range || 30; this.health = o.health || 100; this.maxHealth = this.health;
    this.state = this.kind === 'ally' ? 'captive' : 'patrol'; this.aware = 0; this.see = false; this.losT = rnd() * .2;
    this.fireT = .8; this.burst = 3; this.alertT = 0; this.dead = false; this.deathT = 0; this.last = new V3();
    this.scanT = rnd() * 6; this.strafe = rnd() < .5 ? 1 : -1; this.armed = o.armed !== false; this.speed = 0; this.aimPitch = 0;
    this.accuracy = o.accuracy ?? 1; this.damageMul = o.damage ?? 1; this.hitFlash = 0; this.onDeath = o.onDeath; this.reaction = o.reaction ?? .55;
    this.build(o);
  }
  build(o) {
    const root = new THREE.Group(); this.root = root;
    const model = SkeletonUtils.clone(SOLDIER.scene); model.rotation.y = Math.PI; model.scale.setScalar(o.scale || 1); root.add(model); this.model = model;
    const t = TINT[this.kind] || TINT.enemy; this.mats = []; this.bodyMats = [];
    model.traverse(n => {
      if (n.isMesh) { n.castShadow = true; n.receiveShadow = false; n.frustumCulled = false; n.material = n.material.clone();
        if (/visor/i.test(n.name)) { n.material.color.set(t.visor); n.material.emissive?.set(t.visorE); n.material.roughness = .15; n.material.metalness = .6; }
        else { n.material.color.set(t.body); n.material.roughness = .8; this.bodyMats.push(n.material); } this.mats.push(n.material); }
    });
    const B = (n) => model.getObjectByName('mixamorig' + n);
    this.b = { hips: B('Hips'), sp: B('Spine'), sp1: B('Spine1'), sp2: B('Spine2'), neck: B('Neck'), head: B('Head'),
      lA: B('LeftArm'), lF: B('LeftForeArm'), lH: B('LeftHand'), rA: B('RightArm'), rF: B('RightForeArm'), rH: B('RightHand') };
    this.mixer = new THREE.AnimationMixer(model);
    this.act = {}; for (const c of SOLDIER.animations) this.act[c.name] = this.mixer.clipAction(c);
    this.cur = this.act.Idle; this.cur.play(); this.cur.time = rnd() * 2;
    if (this.armed) { this.rifle = makeRifle('low'); this.rifle.rotation.order = 'YXZ'; root.add(this.rifle); }
    root.position.copy(this.pos); root.rotation.y = this.yaw; G.scene.add(root);
  }
  play(name, fade = .25) { const a = this.act[name]; if (!a || a === this.cur) return; a.reset().play(); this.cur.crossFadeTo(a, fade, false); this.cur = a; }
  eye() { return this.b.head.getWorldPosition(new V3()); }
  muzzle() { return this.rifle ? this.rifle.localToWorld(this.rifle.userData.muzzle.clone()) : this.eye(); }
  hitTest(o, d, tmax) {
    const hc = this.b.head.getWorldPosition(_v).add(_w.set(0, .08, 0));
    const oc = new V3().subVectors(o, hc), b = oc.dot(d), c = oc.lengthSq() - .15 * .15, disc = b * b - c;
    let best = null;
    if (disc > 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < tmax) best = { t, head: true }; }
    const p = this.b.hips.getWorldPosition(new V3());
    const top = this.b.neck.getWorldPosition(new V3());
    const mn = [Math.min(p.x, top.x) - .26, this.pos.y, Math.min(p.z, top.z) - .26], mx = [Math.max(p.x, top.x) + .26, top.y, Math.max(p.z, top.z) + .26];
    const h = rayAABBlocal(o, d, mn, mx, best ? best.t : tmax);
    if (h !== null) best = { t: h, head: false };
    return best;
  }
  alert(src, quiet) {
    if (this.dead || this.kind === 'ally') return;
    if (src) this.last.copy(src);
    if (this.state !== 'alert') { this.state = 'alert'; this.alertT = 2; this.fireT = Math.max(this.fireT, this.reaction + rnd() * .4); if (!quiet && G.onAlarm) G.onAlarm(this); }
    this.aware = 1;
  }
  damage(d, head, dir) {
    if (this.dead) return false;
    this.health -= d; this.hitFlash = .15; this.flinch = 1; this.flinchDir = dir ? dir.clone() : null;
    if (this.health <= 0) { this.die(dir, head); return true; }
    this.alert(G.player.pos); return false;
  }
  die(dir, head) {
    this.dead = true; this.state = 'dead'; this.deathT = 0; for (const a of Object.values(this.act)) a.paused = true;
    const fwd = new V3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.fallBack = dir ? (dir.x * fwd.x + dir.z * fwd.z) < 0 : rnd() < .5;
    this.fallSide = rr(-.35, .35); this.headshot = !!head;
    if (this.rifle) { const wp = this.rifle.getWorldPosition(new V3()), wq = this.rifle.getWorldQuaternion(new THREE.Quaternion()); this.root.remove(this.rifle); G.scene.add(this.rifle); this.rifle.position.copy(wp); this.rifle.quaternion.copy(wq); this.dropV = new V3(rr(-1, 1), rr(.5, 1.5), rr(-1, 1)); this.dropS = new V3(rr(-4, 4), rr(-4, 4), rr(-4, 4)); }
    if (this.onDeath) this.onDeath(this);
  }
  update(dt) {
    if (this.sleep) return;
    if (this.dead) return this.updateDead(dt);
    const P = G.player;
    this.hitFlash = Math.max(0, this.hitFlash - dt); for (const m of this.bodyMats) m.emissive.setRGB(this.hitFlash * 1.5, 0, 0);
    const toP = new V3().subVectors(P.pos, this.pos); toP.y = 0; const dist = toP.length();
    let move = 0;
    if (this.kind === 'ally') move = this.updateAlly(dt, toP, dist);
    else {
      this.losT -= dt;
      if (this.losT <= 0) { this.losT = .12 + rnd() * .06; this.see = P.alive && !P.hidden && (G.state === 'play' || G.state === 'demo') && this.canSee(dist, toP); }
      if (this.state !== 'alert') {
        if (this.see) this.aware += dt * (1.7 * (1 - dist / this.range) + .35) * (P.crouch > .5 ? .45 : 1) * (P.sprinting ? 1.6 : 1) * (G.demo ? 0 : 1);
        else this.aware = Math.max(0, this.aware - dt * .3);
        if (this.aware > .12) this.yaw = lerpAng(this.yaw, Math.atan2(toP.x, toP.z), this.aware * 2 * dt);
        if (this.aware >= 1) this.alert(P.pos);
        else if (this.aware < .3) move = this.patrol(dt);
        this.aimPitch = damp(this.aimPitch, 0, 4, dt);
      } else {
        this.alertT -= dt;
        if (this.see) {
          this.last.copy(P.pos);
          const want = Math.atan2(toP.x, toP.z); this.yaw = lerpAng(this.yaw, want, 7 * dt);
          const e = this.eye(), pe = P.eyePos(); this.aimPitch = damp(this.aimPitch, Math.atan2(pe.y - e.y - .1, dist), 8, dt);
          if (!this.fixed && dist > 8 && this.kind !== 'boss') { const side = new V3(Math.cos(want), 0, -Math.sin(want)).multiplyScalar(this.strafe * 1.3 * dt); this.moveBy(side); move = 1.3; if (rnd() < dt * .4) this.strafe *= -1; }
          this.fireT -= dt;
          if (this.fireT <= 0 && Math.abs(angDiff(this.yaw, want)) < .35) { this.shoot(dist); this.burst--; this.fireT = this.burst > 0 ? .11 : rr(.7, 1.4); if (this.burst <= 0) this.burst = 3 + ((rnd() * 3) | 0); }
        } else if (!this.fixed) {
          const to = new V3().subVectors(this.last, this.pos); to.y = 0; const d = to.length();
          if (d > 1.5) { this.yaw = lerpAng(this.yaw, Math.atan2(to.x, to.z), 6 * dt); this.moveBy(to.normalize().multiplyScalar(3.4 * dt)); move = 3.4; }
          else { this.scanT += dt; this.yaw += Math.sin(this.scanT * 1.3) * dt; }
        } else { this.scanT += dt; this.yaw = this.scanBase + Math.sin(this.scanT * .8) * 1; }
      }
    }
    this.speed = damp(this.speed, move, 8, dt);
    this.animate(dt);
  }
  canSee(dist, toP) {
    const P = G.player;
    if (dist > this.range * (P.crouch > .5 ? .62 : 1)) return false;
    if (this.state !== 'alert' && Math.abs(angDiff(this.yaw, Math.atan2(toP.x, toP.z))) > 1.05) return false;
    return lineOfSight(this.eye(), P.eyePos());
  }
  patrol(dt) {
    if (this.fixed || !this.path.length) { this.scanT += dt; this.yaw = this.scanBase + Math.sin(this.scanT * .4) * .8; return 0; }
    if (this.wait > 0) { this.wait -= dt; return 0; }
    const tgt = this.path[this.wp]; const to = new V3().subVectors(tgt, this.pos); to.y = 0; const d = to.length();
    if (d < .3) { this.wp = (this.wp + 1) % this.path.length; this.wait = rr(1.2, 2.8); return 0; }
    this.yaw = lerpAng(this.yaw, Math.atan2(to.x, to.z), 4 * dt);
    this.moveBy(to.normalize().multiplyScalar(Math.min(d, 1.45 * dt))); return 1.45;
  }
  updateAlly(dt, toP, dist) {
    if (this.state === 'captive') return 0;
    if (this.state === 'follow' && dist > 2.6) { const want = Math.atan2(toP.x, toP.z); this.yaw = lerpAng(this.yaw, want, 6 * dt); const sp = dist > 6 ? 5 : 2.6; this.moveBy(toP.normalize().multiplyScalar(sp * dt)); return sp; }
    if (this.goal) { const to = new V3().subVectors(this.goal, this.pos); to.y = 0; const d = to.length(); if (d > .4) { this.yaw = lerpAng(this.yaw, Math.atan2(to.x, to.z), 6 * dt); this.moveBy(to.normalize().multiplyScalar(Math.min(d, 4 * dt))); return 4; } }
    return 0;
  }
  moveBy(v) { this.pos.add(v); collide(this.pos, .32, 1.8); this.pos.y = this.baseY + G.ground(this.pos.x, this.pos.z); }
  shoot(dist) {
    const P = G.player, mz = this.muzzle(), eye = P.eyePos();
    let p = clamp((.6 - dist * .011 - (P.speed > 2 ? .17 : 0) - (P.crouch > .5 ? .08 : 0)) * this.accuracy, .06, .7);
    if (G.demo || P.god) p = 0;
    const hit = rnd() < p;
    const tgt = eye.clone(); if (!hit) tgt.add(new V3(rr(-1, 1), rr(-.8, .6), rr(-1, 1)).normalize().multiplyScalar(rr(.5, 1.5)));
    const dir = tgt.clone().sub(mz).normalize();
    const far = mz.clone().addScaledVector(dir, hit ? mz.distanceTo(eye) - .5 : 70);
    const wh = rayWorld(mz, dir, mz.distanceTo(far), false);
    tracer(mz, wh ? wh.point : far, 0xffb070, .022, .05);
    muzzleFX(mz, dir, .8);
    if (wh) impact(wh.point, wh.normal);
    sfx('enemyShot', { d: +dist.toFixed(1) });
    if (hit && !wh) G.hurtPlayer(rr(6, 10) * this.damageMul, this.pos);
  }
  animate(dt) {
    const sp = this.speed;
    const want = this.kind === 'ally' && this.state === 'captive' ? 'Idle' : sp > 3 ? 'Run' : sp > .4 ? 'Walk' : 'Idle';
    this.play(want);
    if (this.cur === this.act.Walk) this.cur.timeScale = clamp(sp / 1.45, .6, 1.6); else if (this.cur === this.act.Run) this.cur.timeScale = clamp(sp / 4.5, .7, 1.3); else this.cur.timeScale = 1;
    this.mixer.update(dt);
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    // haut du corps : visée + fusil tenu à deux mains (cinématique inverse)
    if (this.rifle && this.armed) {
      const alert = this.state === 'alert';
      const right = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), fwd = new V3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const pitch = alert ? this.aimPitch : -.55;
      rotateBoneWorld(this.b.sp1, right, -pitch * .35); rotateBoneWorld(this.b.sp2, right, -pitch * .35);
      if (this.flinch > 0) { this.flinch = Math.max(0, this.flinch - dt * 5); rotateBoneWorld(this.b.sp2, right, this.flinch * .35); }
      const chest = this.b.sp2.getWorldPosition(new V3());
      const rp = chest.clone().addScaledVector(right, alert ? .1 : .06).addScaledVector(fwd, alert ? .2 : .3).add(new V3(0, alert ? .12 : -.08, 0));
      this.rifle.position.copy(this.root.worldToLocal(rp));
      this.rifle.rotation.set(pitch, Math.PI + (alert ? 0 : -.5), alert ? 0 : .2);
      this.rifle.updateMatrixWorld(true);
      const gR = this.rifle.localToWorld(this.rifle.userData.gripR.clone()), gL = this.rifle.localToWorld(this.rifle.userData.gripL.clone());
      const down = new V3(0, -1, 0);
      ik(this.b.rA, this.b.rF, this.b.rH, gR, this.b.rA.getWorldPosition(new V3()).addScaledVector(right, .4).add(down).addScaledVector(fwd, -.2));
      ik(this.b.lA, this.b.lF, this.b.lH, gL, this.b.lA.getWorldPosition(new V3()).addScaledVector(right, -.5).add(down).addScaledVector(fwd, -.1));
    }
  }
  updateDead(dt) {
    this.deathT += dt;
    const t = clamp(this.deathT / (this.headshot ? .45 : .7), 0, 1), e = t * t * (3 - 2 * t);
    const fwd = new V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), right = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // bascule autour des pieds, genoux qui cèdent
    const ang = e * Math.PI / 2 * .97 * (this.fallBack ? -1 : 1);
    const q = new THREE.Quaternion().setFromAxisAngle(right, ang).multiply(new THREE.Quaternion().setFromAxisAngle(fwd, this.fallSide * e));
    this.root.quaternion.copy(q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), this.yaw)));
    this.root.position.set(this.pos.x, this.pos.y + Math.sin(e * Math.PI) * .05 - e * .05, this.pos.z);
    if (this.rifle && this.dropV) { const gy = G.ground(this.rifle.position.x, this.rifle.position.z) + this.baseY + .05; if (this.rifle.position.y > gy) { this.dropV.y -= 9.8 * dt; this.rifle.position.addScaledVector(this.dropV, dt); this.rifle.rotation.x += this.dropS.x * dt; this.rifle.rotation.z += this.dropS.z * dt; } else { this.rifle.position.y = gy; this.rifle.rotation.x = 0; this.rifle.rotation.z = Math.PI / 2; this.dropV = null; } }
  }
}
function rayAABBlocal(o, d, mn, mx, tmax) {
  let t0 = 0, t1 = tmax;
  for (let a = 0; a < 3; a++) { const oa = a === 0 ? o.x : a === 1 ? o.y : o.z, da = a === 0 ? d.x : a === 1 ? d.y : d.z;
    if (Math.abs(da) < 1e-9) { if (oa < mn[a] || oa > mx[a]) return null; continue; }
    let tn = (mn[a] - oa) / da, tf = (mx[a] - oa) / da; if (tn > tf) { const t = tn; tn = tf; tf = t; } t0 = Math.max(t0, tn); t1 = Math.min(t1, tf); if (t0 > t1) return null; }
  return t0;
}

// ============================================================ véhicules
const paint = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, metalness: o.metal ?? .6, roughness: o.rough ?? .32, clearcoat: 1, clearcoatRoughness: .08 });
function ext(pts, depth, bevel, mat) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2); g.rotateY(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
// Tout-terrain noir (avant = +z)
export function makeSUV(color = 0x0f1012) {
  const car = new THREE.Group(), body = paint(color), glass = new THREE.MeshPhysicalMaterial({ color: 0x05070a, metalness: .3, roughness: .04, clearcoat: 1 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: .7 }), chrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: .12 });
  const arch = (cx, r, pts, dir) => { for (let i = 0; i <= 10; i++) { const a = Math.PI - i / 10 * Math.PI; pts.push([cx + Math.cos(a) * r * dir, .42 + Math.sin(a) * r]); } };
  const pts = [[-2.35, .5]]; arch(-1.45, .5, pts, 1); pts.push([1.0, .42]); arch(1.48, .5, pts, 1);
  pts.push([2.36, .5], [2.4, .9], [2.3, 1.08], [1.1, 1.2], [.28, 1.86], [-1.95, 1.9], [-2.33, 1.72], [-2.4, .95]);
  const shell = ext(pts, 1.94, .07, body); car.add(shell);
  const win = ext([[-2.08, 1.24], [.92, 1.24], [.3, 1.8], [-1.95, 1.82]], 1.96, .02, glass); car.add(win);
  const ws = ext([[1.05, 1.21], [1.15, 1.2], [.34, 1.84], [.26, 1.85]], 1.82, .02, glass); car.add(ws);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.3, .32, .06), trim); grille.position.set(0, .82, 2.4); car.add(grille);
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.25, .02, .07), chrome); s.position.set(0, .7 + i * .06, 2.41); car.add(s); }
  const bump = new THREE.Mesh(new THREE.BoxGeometry(2, .22, .25), trim); bump.position.set(0, .5, 2.33); car.add(bump);
  const bumpR = bump.clone(); bumpR.position.z = -2.33; car.add(bumpR);
  const hlM = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2d8, emissiveIntensity: 3 }), tlM = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a10, emissiveIntensity: 2.2 });
  for (const x of [-.72, .72]) { const h = new THREE.Mesh(new THREE.BoxGeometry(.42, .13, .05), hlM); h.position.set(x, 1.0, 2.36); car.add(h); const t = new THREE.Mesh(new THREE.BoxGeometry(.18, .32, .05), tlM); t.position.set(x * 1.18, 1.3, -2.38); car.add(t);
    const mir = new THREE.Mesh(new THREE.BoxGeometry(.06, .14, .22), body); mir.position.set(x * 1.43, 1.3, .85); car.add(mir); }
  for (const x of [-.75, .75]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.04, .05, 2.6), trim); r.position.set(x, 1.93, -.85); car.add(r); }
  const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .9 }), rim = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, metalness: .9, roughness: .3 });
  car.userData.wheels = [];
  for (const [x, z] of [[-.86, 1.48], [.86, 1.48], [-.86, -1.45], [.86, -1.45]]) {
    const w = new THREE.Group(); w.position.set(x, .42, z); car.add(w);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 28), tire); t.rotation.z = Math.PI / 2; t.castShadow = true; w.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .31, 20), rim); r.rotation.z = Math.PI / 2; w.add(r);
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(.32, .05, .03), rim); s.rotation.x = i / 6 * Math.PI; s.position.x = x > 0 ? .16 : -.16; w.add(s); }
    car.userData.wheels.push(w);
  }
  car.userData.lights = [];
  for (const x of [-.7, .7]) { const s = new THREE.SpotLight(0xfff2dd, 60, 50, .5, .5, 1.5); s.position.set(x, 1, 2.4); s.target.position.set(x, 0, 12); car.add(s, s.target); car.userData.lights.push(s); }
  return car;
}
// Hélicoptère d'extraction (avant = -z)
export function makeHeli() {
  const h = new THREE.Group(), body = paint(0x2b2f28, { metal: .35, rough: .5 }), dark = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: .6, roughness: .4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1218, metalness: .5, roughness: .05, clearcoat: 1, transparent: true, opacity: .85 });
  const fus = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), body); fus.scale.set(1.15, 1.05, 2.5); fus.position.set(0, 1.7, -.3); fus.castShadow = true; h.add(fus);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, Math.PI / 2.1), glass); cab.scale.set(1.02, .95, 1.4); cab.rotation.x = -Math.PI / 2.4; cab.position.set(0, 1.85, -2.2); h.add(cab);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(.18, .42, 6, 16), body); boom.rotation.x = Math.PI / 2; boom.position.set(0, 2.05, 4.6); boom.castShadow = true; h.add(boom);
  const fin = ext([[0, 0], [1.2, 0], [1.6, 1.6], [1.1, 1.7]], .12, .02, body); fin.position.set(0, 2.05, 7.2); fin.rotation.y = 0; h.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(2.2, .06, .5), body); stab.position.set(0, 2.1, 6.6); h.add(stab);
  const eng = new THREE.Mesh(new THREE.CapsuleGeometry(.5, 1.6, 6, 16), body); eng.rotation.x = Math.PI / 2; eng.position.set(0, 2.85, .2); h.add(eng);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.36, .14, 1.6), new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: .6 })); stripe.position.set(0, 1.55, .7); h.add(stripe);
  for (const x of [-.95, .95]) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 4.4, 8), dark); sk.rotation.x = Math.PI / 2; sk.position.set(x, .06, -.2); h.add(sk);
    for (const z of [-1.2, .8]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1, 8), dark); st.position.set(x * .85, .55, z); st.rotation.z = x > 0 ? .25 : -.25; h.add(st); } }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), new THREE.MeshStandardMaterial({ color: 0x050505 })); door.position.set(1.16, 1.65, .1); door.rotation.y = Math.PI / 2; h.add(door);
  const rotor = new THREE.Group(); rotor.position.y = 3.35; h.add(rotor);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.3, .04, 5.6), dark); b.position.z = 2.8; const p = new THREE.Group(); p.rotation.y = i * Math.PI / 2; p.add(b); rotor.add(p); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.8, 48), new THREE.MeshBasicMaterial({ color: 0x8a8f90, transparent: true, opacity: .08, depthWrite: false, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; rotor.add(disc);
  const tr = new THREE.Group(); tr.position.set(.2, 3.0, 7.7); h.add(tr);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.03, 1.5, .12), dark); b.rotation.x = i * Math.PI / 2; tr.add(b); }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); beacon.position.set(0, 3.0, 1.2); h.add(beacon);
  const spot = new THREE.SpotLight(0xffffff, 0, 60, .45, .6, 1.2); spot.position.set(0, 1, -2); spot.target.position.set(0, -10, -6); h.add(spot, spot.target);
  h.userData = { rotor, tail: tr, spot, beacon };
  h.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return h;
}
export function spinHeli(h, dt) { h.userData.rotor.rotation.y += dt * 26; h.userData.tail.rotation.x += dt * 40; h.userData.beacon.visible = (G.time % 1) < .15; }
// Vedette rapide (avant = -z)
export function makeBoat() {
  const b = new THREE.Group(), hull = paint(0x24282a, { metal: .2, rough: .45 }), deck = new THREE.MeshStandardMaterial({ color: 0x3a3a36, roughness: .9 });
  const s = new THREE.Shape(); s.moveTo(-1.2, 3); s.lineTo(1.2, 3); s.lineTo(1.25, -1.2); s.quadraticCurveTo(1.1, -3.4, 0, -4.2); s.quadraticCurveTo(-1.1, -3.4, -1.25, -1.2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: .9, bevelEnabled: true, bevelThickness: .15, bevelSize: .15, bevelSegments: 3 }); g.rotateX(Math.PI / 2); g.translate(0, .9, 0);
  const m = new THREE.Mesh(g, hull); m.castShadow = true; b.add(m);
  const d = new THREE.Mesh(new THREE.ShapeGeometry(s), deck); d.rotation.x = -Math.PI / 2; d.position.y = .92; d.scale.setScalar(.94); b.add(d);
  const con = new THREE.Mesh(new THREE.BoxGeometry(1, .9, .7), hull); con.position.set(0, 1.4, -.4); b.add(con);
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .5), new THREE.MeshPhysicalMaterial({ color: 0x0a1218, roughness: .05, transparent: true, opacity: .6 })); ws.position.set(0, 2.05, -.8); ws.rotation.x = -.5; b.add(ws);
  const mot = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.1, .5), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .4, metalness: .4 })); mot.position.set(0, 1.0, 3.2); b.add(mot);
  return b;
}
