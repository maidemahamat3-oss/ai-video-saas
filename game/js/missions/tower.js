// MISSION 04 — LA TOUR : arrivée en voiture, 18 gardes sur 14 étages, le Serpent au sommet, hélico sur le toit.
import { THREE, V3, G, rnd, rr, TAU, clamp, lerp, damp, lerpAng, angDiff, easeInOut, box, addCol, radio, stamp, sfx, later, mark, hud, caption, camera, FX,
  explosion, fade, cine, collide, spark, impact } from '../engine.js';
import { MAT, prop, ground, lamp, sandbags } from '../world.js';
import { Soldier, makeSUV, makeHeli, spinHeli } from '../actors.js';
import { player, W, VM, fire } from '../player.js';
import { ctx } from '../main.js';
import { E, wait, walk, look, lookAt, aimAndKill, camPath, hold } from '../director.js';

const FH = 4, TW = 30, TC = new V3(0, 0, -40); // hauteur d'étage, largeur de la tour, centre
const STOPS = [0, 5, 9, 12, 14, 15];             // étages desservis (15 = toit)
let S = {}, car, heli, shell, floors = {}, barrier;
const fy = (n) => n * FH;

function windowsTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#05080b'; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const lit = rnd(); g.fillStyle = lit > .55 ? `rgba(255,${200 + rnd() * 40 | 0},${140 + rnd() * 60 | 0},${.5 + rnd() * .5})` : lit > .4 ? 'rgba(120,170,220,.35)' : 'rgba(20,28,36,1)';
    g.fillRect(x * 32 + 3, y * 32 + 4, 26, 24); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function officeFloor(n, layout) {
  const g = new THREE.Group(); G.scene.add(g); const y = fy(n); const x0 = TC.x, z0 = TC.z, h = TW / 2;
  const floorMat = n === 14 ? MAT.tiles : MAT.concreteFloor;
  const f = new THREE.Mesh(new THREE.BoxGeometry(TW, .4, TW), floorMat); f.position.set(x0, y - .2, z0); f.receiveShadow = true; g.add(f);
  addCol(x0 - h, y - .4, z0 - h, x0 + h, y, z0 + h);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(TW, .4, TW), new THREE.MeshStandardMaterial({ color: 0x9a9a98, roughness: .9 })); ceil.position.set(x0, y + 3.8, z0); g.add(ceil);
  addCol(x0 - h, y + 3.6, z0 - h, x0 + h, y + 4, z0 + h);
  // panneaux lumineux au plafond
  const pm = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: n === 14 ? 0xffd6a0 : 0xe8f0ff, emissiveIntensity: 1.4 });
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { if (Math.abs(i) < 1 && Math.abs(j) < 1) continue; const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .6), pm); p.rotation.x = Math.PI / 2; p.position.set(x0 + i * 5.6, y + 3.59, z0 + j * 5.6); g.add(p); }
  for (const [dx, dz] of [[-6, 9], [6, 9], [0, -12]]) { const l = new THREE.PointLight(n === 14 ? 0xffd2a0 : 0xe6eeff, 45, 26, 1.2); l.position.set(x0 + dx, y + 3.2, z0 + dz); g.add(l); }
  // façade vitrée (on voit la ville la nuit)
  for (const [dx, dz, w, d] of [[0, h, TW, .1], [0, -h, TW, .1], [h, 0, .1, TW], [-h, 0, .1, TW]]) {
    const gl = new THREE.Mesh(new THREE.BoxGeometry(w, 3.6, d), MAT.glass); gl.position.set(x0 + dx, y + 1.8, z0 + dz); g.add(gl); addCol(x0 + dx - w / 2, y, z0 + dz - d / 2, x0 + dx + w / 2, y + 3.6, z0 + dz + d / 2);
    for (let k = -2; k <= 2; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(w > 1 ? .15 : .25, 3.6, d > 1 ? .15 : .25), MAT.dark); m.position.set(x0 + dx + (w > 1 ? k * 6 : 0), y + 1.8, z0 + dz + (d > 1 ? k * 6 : 0)); g.add(m); }
  }
  // noyau central : cage d'ascenseur
  box(x0, y, z0 - 2, 8, 3.6, 8, MAT.plaster, { uv: 2.5, parent: g });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), new THREE.MeshStandardMaterial({ color: 0x5a5e62, metalness: .8, roughness: .4 })); door.position.set(x0, y + 1.4, z0 + 2.02); g.add(door);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(.5, .2), new THREE.MeshStandardMaterial({ color: 0x100000, emissive: 0xff5020, emissiveIntensity: 2 })); disp.position.set(x0, y + 3.05, z0 + 2.03); g.add(disp);
  // poteaux
  for (const [dx, dz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) box(x0 + dx, y, z0 + dz, .7, 3.6, .7, MAT.concrete, { uv: 2, parent: g });
  layout(g, y);
  g.visible = false; floors[n] = g; return g;
}
const wood = () => new THREE.MeshStandardMaterial({ color: 0x5a3c26, roughness: .55 });
function desk(g, x, z, y, rot = 0) {
  const top = new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: .5 });
  box(x, y + .72, z, rot ? .8 : 1.8, .05, rot ? 1.8 : .8, top, { parent: g, col: false });
  box(x, y, z, rot ? .7 : 1.7, .72, rot ? 1.7 : .7, MAT.dark, { parent: g, col: true });
  const mon = new THREE.Mesh(new THREE.BoxGeometry(rot ? .05 : .6, .38, rot ? .6 : .05), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x3a7acc, emissiveIntensity: .8 })); mon.position.set(x, y + 1, z); g.add(mon);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(.5, .9, .5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .8 })); ch.position.set(x + (rot ? .8 : 0), y + .45, z + (rot ? 0 : .8)); g.add(ch);
}
function plant(g, x, z, y) { const pot = new THREE.Mesh(new THREE.CylinderGeometry(.3, .25, .6, 12), MAT.dark); pot.position.set(x, y + .3, z); g.add(pot);
  const fol = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 1), new THREE.MeshStandardMaterial({ color: 0x2c5a2a, roughness: .9, flatShading: true })); fol.position.set(x, y + 1.2, z); fol.scale.y = 1.4; g.add(fol); }

export default {
  id: 'tower', num: 4, seed: 77, title: 'La Tour', place: 'CAPITALE · 23 H 15', time: 420,
  brief: ['Forcer l’entrée de la Tour Vipère en voiture', 'Monter jusqu’au 14e étage', 'Éliminer le Serpent', "S'échapper par le toit en hélico"],
  text: "<strong>Plus de 15 gardes entre toi et le sommet.</strong> Fonce sur la barrière, nettoie chaque étage, puis affronte le Serpent dans son bureau.",
  intro: "Faucon, le Serpent est dans son bureau, au 14e étage. Fonce, on ne pourra pas te couvrir longtemps.",
  winText: "Le Serpent est tombé. Le réseau Vipère est décapité.",
  player: { x: -260, z: 30, yaw: -Math.PI / 2, mode: 'car' },
  menuCam: { r: 90, h: 70, cx: 0, cz: -40 },
  cine: [
    [[200, 140, 200], [80, 90, 60], [0, 30, -40], [0, 50, -40], 10], [[-120, 4, 30], [-30, 3, 30], [0, 2, 20], [0, 2, 10], 8],
    [[0, 2, 25], [0, 6, 5], [0, 4, -20], [0, 40, -40], 8], [[40, 60, 0], [40, 60, -80], [0, 55, -40], [0, 55, -40], 9],
    [[-30, 66, -10], [-25, 70, -60], [0, 62, -40], [0, 62, -40], 8], [[0, 2, -14], [-6, 2, -22], [0, 2, -30], [0, 2, -36], 6],
    [[300, 50, 120], [-300, 50, 120], [0, 30, -40], [0, 30, -40], 12],
  ],
  light: { sky: 'shanghai_bund', bg: .9, env: .8, exposure: 1.0, bloom: .45, rot: 1.6, fog: [0x1a1c26, .0045], hemi: [0x6a7898, 0x1a1a22, .5], sun: { dir: [-.4, .8, .45], color: 0x9fb2e0, intensity: .6 } },

  build() {
    S = { stage: 0, floor: 0, ride: null, heliT: 0, carSpeed: 0 }; floors = {};
    ground(4000, MAT.asphalt, 900);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(900, 14), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: .55, metalness: .1, map: MAT.asphalt.map, normalMap: MAT.asphalt.normalMap }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, .02, 30); road.receiveShadow = true; G.scene.add(road);
    const lineM = new THREE.MeshBasicMaterial({ color: 0xd8d0b0 }); for (let x = -440; x < 440; x += 8) { const l = new THREE.Mesh(new THREE.PlaneGeometry(4, .15), lineM); l.rotation.x = -Math.PI / 2; l.position.set(x, .03, 30); G.scene.add(l); }
    for (let x = -300; x <= 300; x += 30) lamp(x, 22.5, { ry: Math.PI, light: Math.abs(x) <= 30, intensity: 260, color: 0xffc890 });
    // enceinte + portail
    for (const [x, z, w, d] of [[-22, 12, 36, .8], [22, 12, 36, .8], [-40, -34, .8, 92], [40, -34, .8, 92], [0, -80, 80, .8]]) box(x, 0, z, w, 2.8, d, MAT.concrete, { uv: 3 });
    box(7.5, 0, 15, 3, 2.8, 3, MAT.plaster, { uv: 2 }); box(7.5, 2.8, 15, 3.4, .25, 3.4, MAT.roof, { col: false });
    const bwin = new THREE.Mesh(new THREE.PlaneGeometry(2, .9), MAT.window); bwin.position.set(7.5, 1.7, 16.52); G.scene.add(bwin);
    barrier = new THREE.Group(); barrier.position.set(4, 1.1, 12.6); G.scene.add(barrier);
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1, .14, .14), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe8e4da : 0xc4281c, roughness: .6 })); s.position.x = -.5 - i; barrier.add(s); }
    S.barrierV = null;
    for (const x of [-12, -6, 6, 12]) prop('concrete_road_barrier', x, 0, 10.5);
    // parvis
    for (const [x, z] of [[-14, -6], [14, -6], [-14, 4], [14, 4]]) plant({ add: (o) => G.scene.add(o) }, x, z, 0);
    for (const [x, z, r] of [[-20, -10, .3], [21, -2, -.4]]) { const c = makeSUV(r > 0 ? 0x1a1a1c : 0x3a3e44); c.position.set(x, 0, z); c.rotation.y = r; G.scene.add(c); addCol(x - 2, 0, z - 2.5, x + 2, 1.9, z + 2.5, 'metal'); c.userData.lights.forEach(l => l.intensity = 0); }
    for (const [x, z] of [[-10, -18], [10, -18], [-26, 0], [26, 0]]) lamp(x, z, { light: x === -10 || x === 10, intensity: 200 });
    // la tour : coque vitrée extérieure (étages 1 à 15)
    const wt = windowsTex(); const h = TW / 2;
    const shellMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1118, metalness: .7, roughness: .12, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 1.2, clearcoat: 1 });
    wt.repeat.set(2, 2);
    shell = new THREE.Mesh(new THREE.BoxGeometry(TW, fy(15) - FH, TW), shellMat); shell.position.set(TC.x, FH + (fy(15) - FH) / 2, TC.z); shell.castShadow = true; G.scene.add(shell);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(TW + .6, 1.2, TW + .6), MAT.dark); crown.position.set(TC.x, fy(15) + .6, TC.z); G.scene.add(crown);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(.1, .25, 14, 8), MAT.dark); ant.position.set(TC.x + 10, fy(15) + 7, TC.z - 10); G.scene.add(ant);
    const red = new THREE.Mesh(new THREE.SphereGeometry(.25), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: 8 })); red.position.set(TC.x + 10, fy(15) + 14.2, TC.z - 10); G.scene.add(red); S.red = red;
    // hall d'entrée (rez-de-chaussée, toujours visible)
    const lobby = new THREE.Group(); G.scene.add(lobby); floors[0] = lobby;
    const lf = new THREE.Mesh(new THREE.BoxGeometry(TW, .2, TW), MAT.tiles); lf.position.set(TC.x, .1, TC.z); lf.receiveShadow = true; lobby.add(lf);
    const lc = new THREE.Mesh(new THREE.BoxGeometry(TW, .4, TW), new THREE.MeshStandardMaterial({ color: 0x8a8a88 })); lc.position.set(TC.x, FH - .2, TC.z); lobby.add(lc); addCol(TC.x - h, FH - .4, TC.z - h, TC.x + h, FH, TC.z + h);
    for (const [dx, dz, w, d, skip] of [[0, h, TW, .1, true], [0, -h, TW, .1], [h, 0, .1, TW], [-h, 0, .1, TW]]) {
      if (skip) { for (const sx of [-1, 1]) { const ww = h - 2.2; const gl = new THREE.Mesh(new THREE.BoxGeometry(ww, 3.8, .1), MAT.glass); gl.position.set(TC.x + sx * (2.2 + ww / 2), 1.9, TC.z + dz); lobby.add(gl); addCol(TC.x + sx * 2.2 - (sx < 0 ? ww : 0), 0, TC.z + dz - .1, TC.x + sx * 2.2 + (sx > 0 ? ww : 0), 3.8, TC.z + dz + .1); } continue; }
      const gl = new THREE.Mesh(new THREE.BoxGeometry(w, 3.8, d), MAT.glass); gl.position.set(TC.x + dx, 1.9, TC.z + dz); lobby.add(gl); addCol(TC.x + dx - w / 2, 0, TC.z + dz - d / 2, TC.x + dx + w / 2, 3.8, TC.z + dz + d / 2);
    }
    box(TC.x, 0, TC.z - 2, 8, FH, 8, MAT.plaster, { parent: lobby });
    const ldoor = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), new THREE.MeshStandardMaterial({ color: 0x5a5e62, metalness: .8, roughness: .4 })); ldoor.position.set(TC.x, 1.4, TC.z + 2.02); lobby.add(ldoor);
    box(TC.x, 0, TC.z + 7, 6, 1.1, 1.2, wood(), { parent: lobby }); // accueil
    for (const [dx, dz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) box(TC.x + dx, 0, TC.z + dz, .9, FH, .9, MAT.concrete, { parent: lobby });
    for (const [dx, dz] of [[-11, 12], [11, 12]]) plant(lobby, TC.x + dx, TC.z + dz, 0);
    for (const [dx, dz] of [[-6, 9], [6, 9], [0, 4]]) { const l = new THREE.PointLight(0xffe2c0, 50, 26, 1.2); l.position.set(TC.x + dx, 3.4, TC.z + dz); lobby.add(l); }
    // étages de combat
    officeFloor(5, (g, y) => { for (const [x, z] of [[-6, 6], [-6, 10], [6, 6], [6, 10], [-10, -6], [10, -6], [-11, 1], [11, 1]]) desk(g, TC.x + x, TC.z + z, y); plant(g, TC.x - 13, TC.z + 13, y); plant(g, TC.x + 13, TC.z + 13, y); });
    officeFloor(9, (g, y) => { for (const [x, z] of [[-5, 7], [5, 7], [-11, 9], [11, 9], [-11, -2], [11, -2]]) desk(g, TC.x + x, TC.z + z, y, 1);
      for (const [x, z] of [[-12, -11], [-9.5, -11], [12, -11]]) box(TC.x + x, y, TC.z + z, 1.4, 2.1, .9, MAT.dark, { parent: g }); });
    officeFloor(12, (g, y) => { for (const [x, z] of [[-4, 8], [4, 8], [-9, 4], [9, 4], [-9, 11], [9, 11]]) desk(g, TC.x + x, TC.z + z, y); for (const x of [-12, 12]) box(TC.x + x, y, TC.z - 8, 2.5, 1.2, 1, wood(), { parent: g }); });
    officeFloor(14, (g, y) => {
      box(TC.x, y, TC.z - 10, 5, .8, 1.6, wood(), { parent: g }); // bureau du Serpent
      const chair = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.4, .9), new THREE.MeshStandardMaterial({ color: 0x3a0e0c, roughness: .4 })); chair.position.set(TC.x, y + .7, TC.z - 11.6); g.add(chair);
      for (const [x, z, w, d] of [[-8, 6, 3.6, 1.2], [8, 6, 3.6, 1.2], [-8, 9, 1.2, 1.2]]) box(TC.x + x, y, TC.z + z, w, .8, d, new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: .7 }), { parent: g });
      box(TC.x + 11, y, TC.z - 6, 1, 1.1, 5, wood(), { parent: g });
      for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) plant(g, TC.x + x, TC.z + z, y);
    });
    // toit : héliport
    const roof = new THREE.Group(); G.scene.add(roof); floors[15] = roof; const ry = fy(15) + 1.2;
    const rf = new THREE.Mesh(new THREE.BoxGeometry(TW, .2, TW), MAT.concreteFloor); rf.position.set(TC.x, ry, TC.z); rf.receiveShadow = true; roof.add(rf); addCol(TC.x - h, ry - .2, TC.z - h, TC.x + h, ry + .1, TC.z + h);
    for (const [dx, dz, w, d] of [[0, h, TW, .3], [0, -h, TW, .3], [h, 0, .3, TW], [-h, 0, .3, TW]]) box(TC.x + dx, ry, TC.z + dz, w, 1.1, d, MAT.concrete, { parent: roof });
    box(TC.x, ry, TC.z - 2, 8, 3, 8, MAT.concrete, { parent: roof });
    for (const [dx, dz] of [[-10, -10], [-10, -6], [10, 8]]) box(TC.x + dx, ry, TC.z + dz, 2.4, 1.6, 2.4, MAT.metal, { parent: roof });
    const hp = new THREE.Mesh(new THREE.CircleGeometry(5.5, 48), new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const q = c.getContext('2d'); q.fillStyle = '#2e3236'; q.fillRect(0, 0, 256, 256); q.strokeStyle = '#ffd23f'; q.lineWidth = 10; q.beginPath(); q.arc(128, 128, 104, 0, TAU); q.stroke(); q.fillStyle = '#f2efe6'; q.font = 'bold 130px Arial'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('H', 128, 134); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), roughness: .8 }));
    hp.rotation.x = -Math.PI / 2; hp.position.set(TC.x, ry + .11, TC.z + 8); roof.add(hp);
    S.roofY = ry;
    car = makeSUV(0x0c0d0f); G.scene.add(car); car.position.set(-260, 0, 30); car.rotation.y = Math.PI / 2;
    heli = makeHeli(); heli.visible = false; G.scene.add(heli);
    G.updaters.push((dt) => this.tick(dt));
  },
  spawn() {
    const add = (id, x, z, n, o = {}) => { const s = new Soldier({ id, x: TC.x + x, z: TC.z + z, y: fy(n), range: 26, ...o }); s.floor = n; G.enemies.push(s); return s; };
    G.enemies.push(Object.assign(new Soldier({ id: 'gate', x: 7.5, z: 18, yaw: 0, fixed: true, range: 45 }), { floor: -1 }));
    G.enemies.push(Object.assign(new Soldier({ id: 'door', x: 4, z: -22, yaw: 0, range: 35 }), { floor: -1 }));
    add('l1', -6, 5, 0, { yaw: .3 }); add('l2', 7, 3, 0, { yaw: -.4 }); add('l3', 0, -7, 0, { yaw: 0, fixed: true });
    add('a1', -6, 3, 5, { yaw: 0 }); add('a2', 7, 4, 5, { yaw: 0 }); add('a3', -11, -3, 5, { yaw: .5 }); add('a4', 11, -3, 5, { yaw: -.5, fixed: true });
    add('b1', -4, 4, 9, { yaw: 0 }); add('b2', 4, 4, 9, { yaw: 0 }); add('b3', -11, 5, 9, { yaw: .4 }); add('b4', 11, -6, 9, { yaw: -.6 });
    add('c1', -2, 4, 12, { yaw: 0 }); add('c2', 9, 7, 12, { yaw: -.3 }); add('c3', -9, 7, 12, { yaw: .3 }); add('c4', 12, -6, 12, { yaw: -.8, fixed: true });
    add('boss', 0, -11.4, 14, { kind: 'boss', yaw: 0, fixed: true, health: 650, accuracy: 1.4, damage: 1.2, range: 40, reaction: .3 });
    add('k1', -7, 4, 14, { yaw: .2, fixed: true }); add('k2', 7, 4, 14, { yaw: -.2, fixed: true });
    for (const e of G.enemies) if (e.floor > 0) { e.root.visible = false; e.sleep = true; }
  },
  setFloor(n) {
    S.floor = n; player.floorY = n === 15 ? S.roofY : fy(n);
    for (const [k, g] of Object.entries(floors)) g.visible = (+k === n) || +k === 0 && n === 0 || +k === 15 && n === 15;
    floors[0].visible = n === 0; shell.visible = n === 0 || n === 15; if (n === 15) floors[15].visible = true;
    for (const e of G.enemies) if (e.floor > 0) { const on = e.floor === n; e.root.visible = on || e.dead && on; e.sleep = !on; }
    sfx('ding'); G.events.push({ t: +G.t.toFixed(3), type: 'floor', n });
    hud.floor.hidden = n === 0; hud.floor.textContent = n === 15 ? 'TOIT' : `ÉTAGE ${n}`;
  },
  tick(dt) {
    S.red.visible = (G.time % 1.4) < .7;
    if (S.barrierV) { barrier.position.addScaledVector(S.barrierV, dt); S.barrierV.y -= 9.8 * dt; barrier.rotation.z += dt * 9; barrier.rotation.x += dt * 4; if (barrier.position.y < .1) { barrier.position.y = .1; S.barrierV = null; } }
    // voiture : roues
    const sp = S.carSpeed; for (const w of car.userData.wheels) w.rotation.x += sp * dt / .42;
    if (player.mode === 'car') {
      if (!G.demo) this.drive(dt);
      // casse la barrière
      if (!S.broken && car.position.z < 14.5 && Math.abs(car.position.x) < 6) { S.broken = true; S.barrierV = new V3(rr(-3, 3), 6, -S.carSpeed * .6); sfx('crash'); spark(new V3(0, 1.1, 12.6), new V3(0, .5, -1), 30, 9); G.shake = .8; stamp('ENTRÉE FORCÉE', true); }
    }
    if (heli.visible) {
      S.heliT += dt; spinHeli(heli, dt);
      const land = new V3(TC.x, S.roofY + .1, TC.z + 8), k = easeInOut(clamp(S.heliT / 8, 0, 1));
      if (!S.lift) { heli.position.set(lerp(land.x + 220, land.x, k), lerp(land.y + 70, land.y, k), lerp(land.z + 160, land.z, k)); heli.rotation.y = lerp(-.9, -Math.PI / 2, k); heli.userData.landed = k >= 1; heli.userData.spot.intensity = 1500; }
      else { S.lift += dt; heli.position.y += dt * (2 + S.lift * 5); heli.position.x -= dt * S.lift * S.lift * 6; heli.rotation.x = -.15; }
      if (S.floor === 15 && rnd() < dt * 14 && k > .5) FX.smoke.spawn({ p: land.clone().add(new V3(rr(-6, 6), .3, rr(-6, 6))), v: new V3(rr(-6, 6), rr(.2, .8), rr(-6, 6)), life: 1.3, s0: 1, s1: 3.5, c0: 0x8a8a88, a: .25 });
    }
  },
  drive(dt) {
    const k = G.input.keys; let th = G.input.f, st = -G.input.s;
    if (k.KeyW || k.ArrowUp) th = 1; if (k.KeyS || k.ArrowDown) th = -1; if (k.KeyA || k.ArrowLeft) st = 1; if (k.KeyD || k.ArrowRight) st = -1;
    S.carSpeed = clamp(S.carSpeed + th * 12 * dt - S.carSpeed * .25 * dt, -8, 30);
    car.rotation.y += st * clamp(S.carSpeed / 10, -1, 1) * 1.6 * dt;
    const fwd = new V3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    const p = car.position.clone().addScaledVector(fwd, S.carSpeed * dt), q = p.clone();
    collide(q, 1.3, 1.5);
    if (q.distanceTo(p) > .01 && !(Math.abs(p.x) < 6 && p.z > 11 && p.z < 14)) { if (Math.abs(S.carSpeed) > 8) { sfx('crash'); G.shake = .6; } S.carSpeed *= -.25; } else car.position.copy(p);
    player.pos.copy(car.position); player.speed = Math.abs(S.carSpeed);
  },
  chaseCam(dt) {
    const fwd = new V3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    const want = car.position.clone().addScaledVector(fwd, -7.5).add(new V3(0, 2.6, 0));
    S.cc = S.cc ? S.cc.lerp(want, 1 - Math.exp(-6 * dt)) : want;
    camera.position.copy(S.cc); camera.lookAt(car.position.clone().addScaledVector(fwd, 6).add(new V3(0, 1, 0)));
    if (camera.fov !== 62) { camera.fov = 62; camera.near = .1; camera.updateProjectionMatrix(); }
  },
  exitCar() {
    player.mode = 'foot'; G.camOverride = null; G.hideVM = false; camera.fov = camera.userData.baseFov; camera.updateProjectionMatrix();
    const side = new V3(Math.cos(car.rotation.y), 0, -Math.sin(car.rotation.y));
    player.pos.copy(car.position).addScaledVector(side, -2); player.yaw = car.rotation.y + Math.PI; player.pitch = 0;
    S.carSpeed = 0; if (S.stage === 0) S.stage = 1;
  },
  onKey(code) {
    if (code === 'KeyE' && player.mode === 'car' && Math.abs(S.carSpeed) < 3) this.exitCar();
  },
  update(dt) {
    if (player.mode === 'car' && !G.camOverride && !G.demo) { G.camOverride = (d) => this.chaseCam(d); G.hideVM = true; }
    for (const e of G.enemies) if (e.sleep && !e.dead) { e.aware = 0; }
    // ascenseur
    const nearLift = player.mode === 'foot' && Math.hypot(player.pos.x - TC.x, player.pos.z - (TC.z + 3)) < 2.2;
    S.liftReady = false;
    if (nearLift && !S.ride) {
      const here = STOPS.indexOf(S.floor), clear = G.enemies.every(e => e.dead || e.floor !== S.floor || e.floor < 0);
      if (here < STOPS.length - 1 && (clear || S.floor === 0 && G.demo)) { S.liftReady = true; if (G.input.action || G.demo && S.callLift) { S.callLift = false; this.ride(STOPS[here + 1]); } }
    }
    if (S.ride) {
      S.ride.t += dt;
      if (S.ride.t > .4 && !S.ride.moved) { S.ride.moved = true; let n = S.floor; const tgt = S.ride.to; const step = () => { if (n < tgt) { n++; G.events.push({ t: +G.t.toFixed(3), type: 'floorTick', n }); hud.floor.hidden = false; hud.floor.textContent = n === 15 ? 'TOIT' : `ÉTAGE ${n}`; later(.22, step); } else { this.setFloor(tgt); player.pos.set(TC.x, player.floorY, TC.z + 3.2); player.yaw = Math.PI; player.pitch = 0; fade(false); later(.4, () => { S.ride = null; }); } }; step(); }
    }
    for (const e of G.enemies) if (e.kind === 'boss' && e.dead && S.stage < 3) { S.stage = 3; radio("Le Serpent est mort ! Prends l'ascenseur jusqu'au toit, Corbeau-1 arrive.", 'QG', 5); }
    if (S.stage === 3 && S.floor === 15 && !heli.visible) { heli.visible = true; S.heliT = 0; }
    if (S.stage === 3 && heli.userData.landed && player.pos.distanceTo(heli.position) < 7 && !G.demo) ctx.complete(this.winText);
    if (S.stage === 1 && player.pos.z < TC.z + 16 && Math.abs(player.pos.x - TC.x) < 15) S.stage = 2;
  },
  ride(to) { S.ride = { to, t: 0 }; fade(true); sfx('ding'); },
  objective() {
    if (player.mode === 'car') return { text: S.broken ? 'Sors de la voiture (E à l’arrêt)' : 'Fonce sur la barrière de la Tour', target: new V3(0, 1.5, 12) };
    const lift = new V3(TC.x, player.floorY + 1.5, TC.z + 2.2), boss = G.enemies.find(e => e.kind === 'boss');
    const clear = G.enemies.every(e => e.dead || e.floor !== S.floor || e.floor < 0);
    let o;
    if (S.stage === 3) o = { text: S.floor === 15 ? "Monter dans l'hélico" : "Rejoindre le toit par l'ascenseur", target: S.floor === 15 ? heli.position.clone().add(new V3(0, 2, 0)) : lift };
    else if (S.floor === 14) o = { text: 'Éliminer le Serpent', target: boss.eye() };
    else if (!clear) o = { text: `Nettoyer l'étage ${S.floor || 'du hall'}`, target: null };
    else o = { text: `Prendre l'ascenseur (étage ${STOPS[STOPS.indexOf(S.floor) + 1]})`, target: lift };
    if (S.liftReady) { o.prompt = 'E : appeler l’ascenseur'; o.progress = 1; }
    return o;
  },
  *demo() {
    const boss = () => E('boss');
    // 1. la ville, la tour
    mark('aerial');
    yield* camPath([new V3(160, 110, 160), new V3(60, 80, 40), new V3(30, 72, -20)], [new V3(0, 40, -40), new V3(0, 58, -40), new V3(0, 62, -40)], 7);
    caption('MISSION 04', 'LA TOUR', 'CAPITALE · 23 H 15', 4.5);
    // 2. poursuite : la voiture fonce vers la barrière
    mark('drive');
    S.carSpeed = 26; G.camOverride = (d) => this.chaseCam(d); G.hideVM = true;
    const path = [new V3(-60, 0, 30), new V3(-10, 0, 29), new V3(0, 0, 22), new V3(0, 0, 8), new V3(0, 0, -12)];
    let wp = 0;
    const drive = (dt, speedFn) => { const tgt = path[wp]; const to = tgt.clone().sub(car.position); to.y = 0; if (to.length() < 2.5 && wp < path.length - 1) wp++;
      car.rotation.y = lerpAng(car.rotation.y, Math.atan2(to.x, to.z), 3.2 * dt); S.carSpeed = damp(S.carSpeed, speedFn(), 2.5, dt);
      car.position.addScaledVector(new V3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y)), S.carSpeed * dt); player.pos.copy(car.position); };
    car.position.set(-200, 0, 30); car.rotation.y = Math.PI / 2;
    E('gate').alert(car.position, true);
    while (car.position.x < -14) { const dt = yield; drive(dt, () => 28); }
    // 3. le choc, au ralenti, plan fixe près de la barrière
    mark('crash');
    G.camOverride = null; G.timeScale = .3;
    const cp = [new V3(3.4, .8, 7), new V3(3.1, 1.2, 4.5)];
    let t = 0;
    G.droneOn = true; document.body.classList.add('drone');
    while (t < 1.6 && car.position.z > -2) { const dt = yield; t += dt; drive(dt, () => 18); camera.position.lerpVectors(cp[0], cp[1], clamp(t / 1.6, 0, 1)); camera.lookAt(car.position.clone().add(new V3(0, 1, 0))); }
    G.timeScale = 1; G.droneOn = false; document.body.classList.remove('drone');
    G.camOverride = (d) => this.chaseCam(d);
    while (wp < path.length - 1 || S.carSpeed > .5) { const dt = yield; drive(dt, () => wp >= path.length - 1 ? 0 : 14); if (car.position.z < -11) S.carSpeed = damp(S.carSpeed, 0, 6, dt); }
    S.carSpeed = 0;
    // 4. sortie du véhicule, le garde de l'entrée
    mark('exit');
    this.exitCar(); player.yaw = Math.PI; yield* wait(.4);
    yield* aimAndKill('gate', { ads: true, k: 6, delay: .5, max: 4 });
    yield* aimAndKill('door', { ads: true, head: true, k: 7, max: 4 });
    // 5. le hall
    mark('lobby');
    yield* walk([[-1, -18], [-1, -26]], 5.5, { lookAt: () => E('l1').eye(), k: 4 });
    for (const id of ['l1', 'l2', 'l3']) yield* aimAndKill(id, { ads: true, k: 9, max: 4 });
    yield* walk([[-4.5, -30], [-4.5, -35.5], [0, -36.6]], 5, { pitch: 0 });
    // 6. les étages
    for (const [n, ids] of [[5, ['a1', 'a2', 'a3', 'a4']], [9, ['b1', 'b2', 'b3', 'b4']], [12, ['c1', 'c3', 'c2', 'c4']]]) {
      mark('lift' + n);
      player.pos.set(TC.x, player.floorY, TC.z + 3); S.callLift = true;
      while (S.floor !== n || S.ride) yield;
      mark('floor' + n);
      yield* wait(.3);
      for (const id of ids) { yield* aimAndKill(id, { ads: true, head: rnd() < .4, k: 9, max: 4 }); }
      for (const e of G.enemies) if (e.floor === n && !e.dead) e.damage(999, false, new V3(0, 0, -1));
      yield* wait(.4);
    }
    // 7. le bureau du Serpent
    mark('lift14');
    player.pos.set(TC.x, player.floorY, TC.z + 3); S.callLift = true;
    while (S.floor !== 14 || S.ride) yield;
    mark('boss');
    radio('Le voilà. Le Serpent.', 'QG', 3);
    yield* wait(.5);
    yield* aimAndKill('k1', { ads: true, k: 10 }); yield* aimAndKill('k2', { ads: true, k: 10 });
    yield* walk([[TC.x - 1.5, TC.z + 1]], 3, { lookAt: () => boss().eye(), k: 6 });
    G.timeScale = 1;
    let killT = 0;
    while (!boss().dead && killT < 8) { const dt = yield; killT += dt; const b = boss(); const err = look(b.eye().add(new V3(0, killT > 3 ? .03 : -.4, 0)), 9, dt); G.input.ads = true;
      if (b.health < 160) G.timeScale = .35; if (err < .03) { G.input.fire = true; const s = G.state; G.state = 'play'; fire(); G.state = s; } }
    G.input.fire = false; G.input.ads = false;
    if (!boss().dead) boss().damage(999, true, new V3(0, 0, -1));
    mark('bossdown');
    yield* wait(.6); G.timeScale = 1; yield* wait(1.4);
    // 8. le toit, l'hélico
    mark('roof');
    player.pos.set(TC.x, player.floorY, TC.z + 3); S.callLift = true;
    while (S.floor !== 15 || S.ride) yield;
    yield* lookAt(() => heli.position.clone().add(new V3(0, 1.5, 0)), 8, 2);
    yield* walk([[TC.x + 3, TC.z + 8]], 5, { lookAt: () => heli.position.clone().add(new V3(0, 1.5, 0)), k: 4 });
    mark('lift');
    S.lift = .001;
    const hp = heli.position.clone();
    yield* camPath([hp.clone().add(new V3(25, 6, 25)), hp.clone().add(new V3(80, 40, 120))], () => heli.position.clone().add(new V3(0, 2, 0)), 7);
    mark('end');
  },
};
