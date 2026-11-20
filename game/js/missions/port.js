// MISSION 02 — LE PORT : de nuit, entre les conteneurs, libérer l'informateur et s'enfuir en vedette.
import { THREE, V3, G, rnd, rr, TAU, clamp, lerp, damp, lerpAng, easeInOut, box, addCol, radio, stamp, sfx, later, mark, hud, caption, camera, FX, explosion, fade, loadTex, detonate } from '../engine.js';
import { MAT, prop, ground, container, lamp, sandbags, building } from '../world.js';
import { Soldier, makeBoat } from '../actors.js';
import { player, W, fire } from '../player.js';
import { ctx } from '../main.js';
import { E, wait, walk, look, lookAt, aimAndKill, knifeKill, camPath, hold } from '../director.js';

const CELL = new V3(18, 0, -2), BOAT = new V3(-52, 0, 36);
let S = {}, boat, water, cellDoor;

function crane(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); G.scene.add(g);
  const paint = new THREE.MeshStandardMaterial({ color: 0xc23a22, metalness: .5, roughness: .55 }), white = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, metalness: .4, roughness: .6 });
  const leg = (lx, lz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 32, 1.2), paint); m.position.set(lx, 16, lz); m.castShadow = true; g.add(m); addCol(x + lx - .6, 0, z + lz - .6, x + lx + .6, 32, z + lz + .6, 'metal'); };
  leg(-9, -12); leg(9, -12); leg(-9, 12); leg(9, 12);
  for (const lx of [-9, 9]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 26), paint); b.position.set(lx, 31, 0); g.add(b); const b2 = b.clone(); b2.position.y = 12; g.add(b2); }
  const boom = new THREE.Mesh(new THREE.BoxGeometry(20, 2.2, 3), white); boom.position.set(0, 33, 14); boom.scale.z = 1; g.add(boom);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 70), white); jib.position.set(0, 34, 22); jib.castShadow = true; g.add(jib);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), paint); cab.position.set(0, 31.6, 30); g.add(cab);
  const cw = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1), MAT.window); cw.position.set(0, 31.8, 31.52); g.add(cw);
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 14, 4), MAT.dark); r.position.set(-.8 + i * .5, 26, 30); g.add(r); }
  const spr = new THREE.Mesh(new THREE.BoxGeometry(2.6, .6, 12), new THREE.MeshStandardMaterial({ color: 0xd8a020, metalness: .4, roughness: .6 })); spr.position.set(0, 19, 30); g.add(spr);
  const l = new THREE.SpotLight(0xffe8c8, 1800, 70, .7, .5, 1.3); l.position.set(0, 30, 0); l.target.position.set(x, 0, z); G.scene.add(l, l.target);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.3), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: 8 })); beacon.position.set(0, 35.3, 56); g.add(beacon);
  return g;
}
function ship(x, z) {
  const g = new THREE.Group(); g.position.set(x, -1.6, z); G.scene.add(g);
  const hull = new THREE.MeshStandardMaterial({ color: 0x5a1a14, metalness: .3, roughness: .65 }), deckM = new THREE.MeshStandardMaterial({ color: 0x3a4a3c, roughness: .8 });
  const s = new THREE.Shape(); s.moveTo(-70, -9); s.lineTo(52, -9); s.quadraticCurveTo(70, -6, 76, 0); s.quadraticCurveTo(70, 6, 52, 9); s.lineTo(-70, 9); s.closePath();
  const hg = new THREE.ExtrudeGeometry(s, { depth: 11, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); hg.translate(0, -3, 0);
  const h = new THREE.Mesh(hg, hull); h.castShadow = h.receiveShadow = true; g.add(h);
  const stripe = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .6, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 7.4, 0), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: .6 })); stripe.scale.set(1.002, 1, 1.01); g.add(stripe);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(s), deckM); deck.rotation.x = -Math.PI / 2; deck.position.y = 8.02; g.add(deck);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < (2 + ((i * 7 + j * 3) % 3)); k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.59, 2.44), MAT.containers[(i + j + k) % 5]); m.position.set(-40 + i * 9.2, 8 + 1.3 + k * 2.6, -4.2 + j * 2.8); m.castShadow = true; g.add(m); }
  const br = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 16), new THREE.MeshStandardMaterial({ color: 0xe0dcd0, roughness: .7 })); br.position.set(-60, 15, 0); br.castShadow = true; g.add(br);
  for (let r = 0; r < 4; r++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(14.5, .9), MAT.window); w.position.set(-53.98, 10 + r * 3, 0); w.rotation.y = Math.PI / 2; g.add(w); }
  const fun = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 7, 16), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: .6 })); fun.position.set(-63, 25, 0); g.add(fun);
  addCol(x - 70, -4, z - 9, x + 76, 7, z + 9, 'metal');
  return g;
}

export default {
  id: 'port', num: 2, seed: 19, title: 'Le Port', place: 'PORT DE SALVA · 01 H 10', time: 300,
  brief: ['Infiltrer les quais', "Libérer l'informateur enfermé dans un conteneur", "L'escorter jusqu'à la vedette"],
  text: "<strong>L'informateur sait où se cache le Serpent.</strong> Il est enfermé dans un conteneur, quelque part sur les quais. Les barils explosent si tu tires dessus.",
  intro: "Faucon, notre informateur est retenu sur les quais. Ramène-le vivant, il sait où se cache le Serpent.",
  winText: "L'informateur est en sécurité. On sait maintenant où frapper.",
  player: { x: -54, z: 24, yaw: Math.PI * .5 + .2 },
  menuCam: { r: 95, h: 40, cx: 0, cz: 5 },
  cine: [
    [[120, 60, 140], [60, 40, 90], [0, 5, 20], [0, 8, 30], 9], [[-60, 3, 40], [-20, 3, 40], [10, 6, 46], [20, 6, 46], 8],
    [[-30, 2, 4.8], [-12, 2, 4.8], [0, 1.5, 4.8], [10, 1.5, 4.8], 7], [[-10, 40, 0], [30, 40, 10], [10, 0, 0], [20, 0, 10], 8],
    [[12, 2.2, 8], [16, 2.2, 4], [18, 1.5, -2], [18, 1.5, -2], 6], [[-50, 1, 45], [-55, 2, 30], [-52, 0, 36], [-52, 0, 36], 6],
    [[0, 25, 70], [-40, 25, 70], [10, 10, 46], [0, 10, 46], 9], [[60, 80, -60], [-60, 80, -60], [0, 0, 10], [0, 0, 10], 10],
  ],
  light: { sky: 'satara_night', bg: .55, env: 1.1, exposure: 1.05, bloom: .65, rot: 2.6, fog: [0x10141c, .009], hemi: [0x7080a8, 0x1a1a22, .7], sun: { dir: [.4, .7, .6], color: 0x9fb2e0, intensity: .9 } },

  build() {
    S = { stage: 0, open: 0, escaped: 0, alarm: false };
    // quai en béton + eau
    const quay = ground(400, MAT.concreteFloor, 100); quay.position.set(0, 0, -170);
    const wn = loadTex('assets/tex/waternormals.jpg', false); const wnc = wn.clone(); wnc.repeat.set(60, 60);
    water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: .06, metalness: .2, normalMap: wnc, normalScale: new THREE.Vector2(.55, .55), envMapIntensity: 1.4 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -1.6, 1530); G.scene.add(water);
    G.updaters.push((dt) => { wnc.offset.x += dt * .006; wnc.offset.y += dt * .004; });
    box(0, -2, 30.2, 400, 2, .6, MAT.concrete, { uv: 2.5, col: false }); // bord du quai
    addCol(-200, -3, 30, 200, 3, 31); // empêche de tomber à l'eau
    for (let x = -60; x <= 60; x += 6) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.25, .3, .6, 10), MAT.dark); b.position.set(x, .3, 29.4); G.scene.add(b); }
    // conteneurs empilés (allées)
    let k = 0;
    for (const [x0, z0, cols, rows] of [[-30, -6, 3, 2], [-6, -6, 2, 3], [26, -14, 2, 2], [-30, 12, 2, 1], [4, 12, 1, 1]]) {
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const h = 1 + ((i * 3 + j * 5 + k) % 3); for (let l = 0; l < h; l++) container(x0 + i * 6.6, z0 + j * 3.1, true, (i + j + l + k) % 5, l * 2.59); k++; }
    }
    // le conteneur de l'informateur
    container(CELL.x, CELL.z, false, 3);
    cellDoor = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.5, .08), MAT.containers[3]); cellDoor.position.set(CELL.x, 1.3, CELL.z + 3.06); G.scene.add(cellDoor);
    // grues portiques, entrepôts, cargo
    crane(-10, 18); crane(30, 18);
    building(-20, -36, 40, 9, 16, { mat: MAT.containers[4], lit: .4 }); building(28, -38, 26, 8, 14, { mat: MAT.containers[1], lit: .3 });
    ship(10, 46);
    // barils explosifs, caisses, projecteurs
    S.barrels = [];
    for (const [x, z] of [[-14, 4.5], [-13, 5.6], [6, 4], [22, 6], [33, -2], [-2, 9]]) { const m = prop('Barrel_01', x, 0, z, { s: 1.2, tag: 'explosive' }); m.userData.col.mesh = m; S.barrels.push(m); m.traverse(n => { if (n.isMesh) { n.material = n.material.clone(); n.material.color.set(0xc23a20); } }); }
    for (const [x, z, r] of [[-20, 8, .4], [12, -10, 1.2], [-38, 2, 0], [36, 8, .7], [-4, 22, .2]]) prop('wooden_military_crate', x, 0, z, { ry: r, s: 1.25 });
    for (const [x, z, l] of [[-46, 22, 1], [-24, 22, 0], [0, 24, 1], [24, 24, 0], [-34, -14, 1], [10, -22, 0]]) lamp(x, z, { intensity: 220, light: !!l });
    boat = makeBoat(); boat.position.set(BOAT.x, -1.55, BOAT.z); boat.rotation.y = Math.PI / 2; G.scene.add(boat);
    G.updaters.push((dt) => { boat.position.y = -1.55 + Math.sin(G.time * 1.3) * .08; boat.rotation.z = Math.sin(G.time * .9) * .03;
      if (S.escaped) { S.escaped += dt; const sp = Math.min(22, S.escaped * 6); boat.position.x += sp * dt * .4; boat.position.z += sp * dt; boat.rotation.y = lerp(boat.rotation.y, Math.PI, dt);
        if (rnd() < .9) FX.smoke.spawn({ p: boat.position.clone().add(new V3(0, .4, -3)), v: new V3(rr(-1, 1), .5, -2), life: 1.6, s0: .8, s1: 4, c0: 0xdde4e8, a: .4 }); } });
  },
  spawn() {
    const g = (id, x, z, o = {}) => G.enemies.push(new Soldier({ id, x, z, range: 28, ...o }));
    g('p1', -36, 18, { path: [[-36, 18], [-20, 18], [-20, 26]] });
    g('p2', -18, 1, { yaw: Math.PI / 2, fixed: true });
    g('p3', 6, 2, { path: [[6, 2], [6, 8], [20, 8]] });
    g('p4', 16, 4.5, { yaw: Math.PI, fixed: true });
    g('p5', 22, -4, { path: [[22, -4], [36, -4]] });
    g('p6', 0, -16, { path: [[0, -16], [-20, -16]] });
    g('p7', 38, 12, { yaw: -Math.PI / 2, fixed: true });
    g('p8', -8, -12, { yaw: 0, fixed: true });
    g('p9', 30, 26, { yaw: Math.PI, fixed: true });
    g('p10', -28, -18, { path: [[-28, -18], [-40, -6]] });
    const inf = new Soldier({ id: 'informant', kind: 'ally', armed: false, x: CELL.x, z: CELL.z, yaw: 0 }); G.allies.push(inf); S.inf = inf;
  },
  onAlarm(by) {
    if (S.alarm) return; S.alarm = true; hud.alarm.hidden = false; sfx('alarm');
    radio('Tu es repéré ! Ils vont essayer de reprendre l’informateur.');
    for (const e of G.enemies) if (!e.dead && e !== by && e.pos.distanceTo(by.pos) < 35) later(.4 + rnd() * .9, () => e.alert(player.pos, true));
  },
  update(dt) {
    const inf = S.inf, near = player.pos.distanceTo(new V3(CELL.x, player.pos.y, CELL.z + 3.6)) < 2.4;
    if (S.stage === 0 && near) {
      if (G.input.action) S.open += dt / 2; else S.open = Math.max(0, S.open - dt);
      if (S.open >= 1) { S.stage = 1; cellDoor.rotation.y = 0; cellDoor.position.x -= 1.2; cellDoor.position.z += 1.1; cellDoor.rotation.y = -1.4; sfx('crash'); stamp('INFORMATEUR LIBÉRÉ', true); radio("Je l'ai. On rejoint la vedette !", 'FAUCON', 3.5); inf.state = 'follow'; }
    }
    if (S.stage === 1 && player.pos.distanceTo(BOAT.clone().setY(player.pos.y).add(new V3(0, 0, -8))) < 6 && inf.pos.distanceTo(player.pos) < 6) { S.stage = 2; if (!G.demo) { this.escape(); later(4, () => ctx.complete(this.winText)); } }
    if (inf.dead && !G.demo) ctx.fail("L'informateur est mort.");
  },
  escape() { S.escaped = .001; player.hidden = true; G.hideVM = true; const pp = boat.position;
    G.camOverride = () => { camera.position.copy(boat.position).add(new V3(-9, 4, -12)); camera.lookAt(boat.position.clone().add(new V3(0, 1, 6))); }; },
  objective() {
    if (S.stage === 0) { const o = { text: "Trouver et libérer l'informateur", target: new V3(CELL.x, 2.4, CELL.z + 3) }; if (player.pos.distanceTo(new V3(CELL.x, player.pos.y, CELL.z + 3.6)) < 2.4) { o.prompt = 'Maintiens E : forcer le conteneur'; o.progress = S.open; } return o; }
    if (S.stage === 1) return { text: "Escorter l'informateur jusqu'à la vedette", target: BOAT.clone().add(new V3(0, 1.5, -6)) };
    return { text: 'Évacuation', target: null };
  },
  *demo() {
    mark('aerial');
    yield* camPath([new V3(90, 50, 120), new V3(40, 30, 70), new V3(-30, 12, 40)], [new V3(0, 5, 20), new V3(-10, 4, 10), new V3(-46, 2, 22)], 7);
    caption('MISSION 02', 'LE PORT', 'PORT DE SALVA · 01 H 10', 4.5);
    radio("Faucon, notre informateur est retenu sur les quais. Ramène-le vivant.", 'QG', 5);
    mark('sneak');
    player.crouchOn = true; player.crouch = 1;
    yield* lookAt(new V3(-20, 1.5, 18), 1.2, 3);
    yield* walk([[-44, 22], [-38, 21.2]], 2.4, { lookAt: () => E('p1').eye(), k: 3 });
    // le garde passe devant : couteau dans le dos
    while (E('p1').pos.distanceTo(player.pos) > 2.2 && G.t < 40) { const dt = yield; look(E('p1').eye().add(new V3(0, -.3, 0)), 5, dt); const e = E('p1'); if (e.pos.x > player.pos.x + 1) { player.pos.x = lerp(player.pos.x, e.pos.x - 1.6, dt * 2); player.pos.z = lerp(player.pos.z, e.pos.z, dt * 2); } }
    mark('knife');
    yield* knifeKill('p1');
    yield* wait(.6);
    yield* walk([[-24, 9.8], [-16, 9.8]], 2.4, { lookAt: () => E('p2').eye(), k: 4 });
    mark('knife2');
    yield* walk([[-17, 1.8]], 2.2, { lookAt: () => E('p2').eye().add(new V3(0, -.3, 0)), k: 5 });
    yield* knifeKill('p2');
    player.crouchOn = false; player.crouch = 0;
    mark('barrel');
    // repéré : un baril explose au milieu de deux gardes
    E('p3').alert(player.pos); E('p4').alert(player.pos);
    yield* wait(.4);
    const brl = S.barrels[2];
    yield* hold((dt) => look(brl.position.clone().add(new V3(0, .6, 0)), 9, dt), .9);
    G.input.ads = true; yield* wait(.25);
    { const s = G.state; G.state = 'play'; G.input.fire = true; fire(); G.state = s; G.input.fire = false; detonate(brl.userData.col); }
    yield* wait(1.2); G.input.ads = false;
    yield* aimAndKill('p3', { ads: true, k: 9 }); yield* aimAndKill('p4', { ads: true, k: 9 });
    // le conteneur
    mark('cell');
    yield* walk([[10, 6.5], [CELL.x, CELL.z + 3.6]], 5.5, { lookAt: new V3(CELL.x, 1.3, CELL.z + 2), k: 5 });
    yield* hold((dt) => { look(new V3(CELL.x, 1.4, CELL.z + 3), 6, dt); G.input.action = true; }, 2.2);
    G.input.action = false;
    yield* lookAt(() => S.inf.eye(), 1.5, 4);
    mark('escort');
    yield* aimAndKill('p5', { ads: true, k: 8, max: 3 }); yield* aimAndKill('p7', { ads: true, k: 8, max: 3 });
    yield* walk([[8, 9], [-10, 10], [-30, 9.5], [-44, 24], [-52, 27.5]], 6, { during: () => {} });
    yield* lookAt(() => S.inf.eye(), 1, 4);
    while (S.inf.pos.distanceTo(player.pos) > 4) { const dt = yield; look(S.inf.eye(), 3, dt); }
    mark('boat');
    S.stage = 2; this.escape();
    yield* wait(2);
    const bp = boat.position;
    yield* camPath([bp.clone().add(new V3(-30, 6, 20)), bp.clone().add(new V3(-60, 25, 90))], () => boat.position.clone().add(new V3(0, 1, 0)), 6);
    mark('end');
  },
};
