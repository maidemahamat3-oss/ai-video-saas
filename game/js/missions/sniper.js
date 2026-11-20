// MISSION 03 — ŒIL DE FAUCON : tir de précision à plus de 3 km, à l'aube, dans les montagnes.
import { THREE, V3, G, rnd, rr, TAU, clamp, lerp, easeInOut, box, addCol, radio, stamp, sfx, later, mark, hud, caption, camera, FX } from '../engine.js';
import { MAT, prop, terrain, fbm, lamp } from '../world.js';
import { Soldier, makeSUV, makeHeli, spinHeli } from '../actors.js';
import { player, W, VM, lase, fireSniper, predictImpact, camDir } from '../player.js';
import { ctx } from '../main.js';
import { E, wait, look, lookAt, camPath, hold } from '../director.js';

const T = new V3(380, 0, -2980);           // centre de la villa
let HC = 30, S = {}, heli, cars = [];
const YAW0 = Math.atan2(-T.x, -T.z);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function H(x, z) {
  let h = fbm(x * .0011 + 3.1, z * .0011 + 7.3, 6) * 520 - 170;
  const dp = Math.hypot(x, z); h += 300 * Math.exp(-(dp * dp) / (2 * 320 * 320));
  // vallée dégagée entre le poste de tir et la cible
  const ax = T.x, az = T.z, L2 = ax * ax + az * az, u = clamp((x * ax + z * az) / L2, 0, 1), dx = x - ax * u, dz = z - az * u, dl = Math.hypot(dx, dz);
  h -= 230 * Math.exp(-(dl * dl) / (2 * 420 * 420)) * smooth(0, .18, u) * smooth(1.05, .9, u);
  // plateau de la villa
  const dtg = Math.hypot(x - T.x, z - T.z); h = lerp(h, HC, smooth(330, 150, dtg));
  return h;
}
const Y = (x, z) => H(x, z);

export default {
  id: 'sniper', num: 3, seed: 31, title: 'Œil de Faucon', place: 'MONTS KARAS · 05 H 52', time: 300,
  brief: ['Repérer la villa du colonel Varga', 'L’éliminer à plus de 3 km', "Rejoindre l'hélico sur la crête"],
  text: "<strong>Un seul tir. Plus de 3 kilomètres.</strong> Utilise le télémètre (T), compense le vent avec les graduations de la lunette et attends qu'il sorte.",
  intro: "Faucon, le colonel Varga quitte sa villa dans quelques minutes. Tu n'auras qu'une seule chance.",
  winText: "Le colonel Varga est neutralisé. Le Serpent vient de perdre son bras droit.",
  player: { x: 0, z: 0, yaw: Math.atan2(-T.x, -T.z), pitch: -.05, weapon: 'sniper', prone: true },
  menuCam: { r: 160, h: 480, cx: 0, cz: -60 },
  cine: [
    [[-400, 700, 500], [-100, 520, 120], [380, 30, -2980], [0, 360, 0], 10], [[30, 370, 25], [8, 364, 8], [0, 362, 0], [380, 30, -2980], 8],
    [[700, 260, -2500], [100, 200, -2700], [380, 30, -2980], [380, 30, -2980], 10], [[420, 40, -2930], [360, 40, -2935], [380, 32, -2980], [380, 32, -2985], 8],
    [[300, 90, -2900], [460, 90, -2900], [380, 30, -2985], [380, 30, -2985], 8], [[0, 380, 0], [190, 300, -1490], [380, 30, -2980], [380, 30, -2980], 12],
    [[-200, 420, -200], [200, 420, 200], [0, 360, 0], [0, 360, 0], 10],
  ],
  light: { sky: 'aarfontein_dawn', bg: 1, env: 1, exposure: .95, bloom: .35, rot: -2.0, fog: [0x9aa1ab, .00021], hemi: [0xb7c4dc, 0x5a4a38, .9], sun: { dir: [.62, .2, -.76], color: 0xffd2a0, intensity: 3.2 } },

  build() {
    S = { stage: 0, t: 0, colonelOut: false, fled: false, heliT: 0 };
    HC = 30; // plateau de la villa à 30 m
    G.ground = Y;
    camera.far = 14000; camera.updateProjectionMatrix();
    const rockMat = MAT.rock.clone(); rockMat.color = new THREE.Color(0xffffff);
    terrain(9000, 360, H, rockMat, 700, 0, -1500);
    const farMat = rockMat.clone(); farMat.map = rockMat.map.clone(); farMat.map.repeat.set(1, 1);
    terrain(60000, 160, (x, z) => (Math.abs(x) < 4400 && z > -5900 && z < 2900) ? H(x, z) - 25 : H(x, z) * 1.6, farMat, 1200);
    // poste de tir : rochers autour du commando
    for (let i = 0; i < 22; i++) { const a = rr(-1.2, 1.2) + Math.PI, r = rr(2.5, 14), x = Math.sin(a + YAW0) * r, z = Math.cos(a + YAW0) * r, s = rr(.4, 1.6);
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), MAT.rock); m.position.set(x, Y(x, z) + s * .3, z); m.scale.y = .6; m.rotation.set(rnd(), rnd() * 3, rnd()); m.castShadow = m.receiveShadow = true; G.scene.add(m); }
    // ---- la villa du colonel
    const y0 = HC, at = (x, z) => [T.x + x, T.z + z];
    const plaster = MAT.plaster;
    box(...[T.x, y0, T.z - 10], 22, 7.2, 14, plaster, { uv: 3 }); box(T.x, y0 + 7.2, T.z - 10, 23, .4, 15, MAT.roof, { col: false });
    box(T.x + 15, y0, T.z - 14, 9, 3.6, 7, plaster, { uv: 3 }); box(T.x + 15, y0 + 3.6, T.z - 14, 9.6, .3, 7.6, MAT.roof, { col: false });
    for (let i = 0; i < 6; i++) for (const yy of [1.8, 5.2]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), i % 3 === 1 ? MAT.window : MAT.glass); win.position.set(T.x - 9 + i * 3.6, y0 + yy, T.z - 2.98); G.scene.add(win); }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: .6 })); door.position.set(T.x, y0 + 1.3, T.z - 2.97); G.scene.add(door);
    // mur d'enceinte
    for (const [x, z, w, d] of [[0, -24, 60, .8], [-30, -4, .8, 40], [30, -4, .8, 40], [-18, 16, 24, .8], [18, 16, 24, .8]]) box(T.x + x, y0, T.z + z, w, 2.6, d, plaster, { uv: 3 });
    // cour : voitures, caisses, projecteurs
    cars = [];
    for (const [x, z, r] of [[-4, 6, .2], [5, 7, -.15]]) { const c = makeSUV(0x0d0e10); c.position.set(T.x + x, y0, T.z + z); c.rotation.y = r + Math.PI; G.scene.add(c); cars.push(c); addCol(T.x + x - 1.1, y0, T.z + z - 2.4, T.x + x + 1.1, y0 + 1.9, T.z + z + 2.4, 'metal'); c.userData.lights.forEach(l => l.intensity = 0); }
    for (const [x, z] of [[-24, 8], [24, -18], [20, 10]]) prop('wooden_military_crate', T.x + x, y0, T.z + z, { ry: rnd() * 3, s: 1.25 });
    for (const [x, z] of [[-22, 10], [-21, 7.5], [23, 12]]) prop('Barrel_01', T.x + x, y0, T.z + z, { s: 1.1 });
    for (const [x, z] of [[-26, -20], [26, -20], [-26, 12], [26, 12]]) lamp(T.x + x, T.z + z, { y: y0, light: false });
    // tour de guet
    const tx = T.x - 26, tz = T.z + 13;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(tx + a, y0, tz + b, .2, 5, .2, MAT.dark);
    box(tx, y0 + 5, tz, 2.6, .2, 2.6, MAT.metal, { col: false }); box(tx, y0 + 7, tz, 3, .15, 3, MAT.roof, { col: false });
    // villages et pistes au loin (échelle)
    for (let i = 0; i < 14; i++) { const x = T.x + rr(-900, 900), z = T.z + rr(-700, 500); if (Math.hypot(x - T.x, z - T.z) < 220) continue; const w = rr(6, 14), d = rr(6, 12), hh = rr(3, 6); box(x, Y(x, z) - .5, z, w, hh, d, plaster, { uv: 3, col: false }); }
    // héliport sur la crête
    heli = makeHeli(); heli.visible = false; G.scene.add(heli);
    G.updaters.push((dt) => this.tick(dt));
  },
  spawn() {
    const y0 = HC;
    const g = (id, x, z, o = {}) => { const s = new Soldier({ id, x: T.x + x, z: T.z + z, range: 60, ...o }); G.enemies.push(s); return s; };
    g('v1', -8, 0, { path: [[T.x - 8, T.z], [T.x - 8, T.z + 12], [T.x + 10, T.z + 12]] });
    g('v2', 12, 2, { yaw: Math.PI * .8, fixed: true });
    g('v3', -2, 13, { yaw: 0, fixed: true });
    g('v4', 22, -6, { path: [[T.x + 22, T.z - 6], [T.x + 22, T.z + 10]] });
    g('v5', -26, 13, { y: 5.2, yaw: .3, fixed: true });
    const col = g('colonel', 0, -1.5, { kind: 'boss', armed: false, yaw: 0, health: 100, fixed: false });
    col.root.visible = false; col.hidden = true; col.path = [];
    S.colonel = col;
  },
  tick(dt) {
    S.t += dt;
    // le colonel sort de la villa et marche vers sa voiture
    const c = S.colonel;
    if (!c.dead && !S.colonelOut && S.t > (G.demo ? S.outAt ?? 1e9 : 25)) {
      S.colonelOut = true; c.root.visible = true; c.hidden = false;
      const pts = G.demo ? [[-1, 3.2], [-2.6, 5.2]] : [[0, 1.5], [7, 2], [7, 9], [-1, 9.5], [-2.6, 5.2]];
      c.path = pts.map(([x, z]) => new V3(T.x + x, 0, T.z + z)); c.wp = 0; c.wait = 0; radio('Il sort ! Le colonel marche vers sa voiture.', 'QG', 4); if (S.stage === 0) S.stage = 1; }
    if (S.colonelOut && !c.dead && !G.demo && c.wp === c.path.length - 1 && c.pos.distanceTo(new V3(T.x - 2.6, c.pos.y, T.z + 5.2)) < .5) { S.fled = true; ctx.fail('Le colonel est monté dans sa voiture. Cible perdue.'); }
    // ombres nettes là où l'on regarde
    G.shadowFocus = (VM.s.ads > .5 || G.camOverride) ? T.clone().setY(HC) : null;
    if (heli.visible) {
      S.heliT += dt; spinHeli(heli, dt);
      const land = new V3(player.pos.x - 22, 0, player.pos.z + 18); land.y = Y(land.x, land.z) + .1;
      const k = easeInOut(clamp(S.heliT / 9, 0, 1));
      heli.position.set(lerp(land.x - 400, land.x, k), lerp(land.y + 160, land.y + (S.heliT > 9 ? 0 : 6), k), lerp(land.z + 300, land.z, k));
      heli.rotation.y = -.6 * (1 - k) + .9; heli.userData.landed = k >= 1;
      if (S.lift) { S.lift += dt; heli.position.y += S.lift * S.lift * 2.2; heli.position.x -= S.lift * S.lift * 3; heli.rotation.x = -.15; }
    }
  },
  update(dt) {
    const c = S.colonel;
    if (S.stage < 2 && c.dead) { S.stage = 2; later(1.5, () => radio('Cible neutralisée. Corbeau-1 arrive sur la crête, prépare-toi.', 'QG', 5)); later(3, () => { heli.visible = true; S.heliT = 0; }); }
    if (S.stage === 2 && heli.userData.landed && !G.demo) { player.prone = false; if (player.pos.distanceTo(heli.position) < 9) ctx.complete(this.winText); }
  },
  objective() {
    const c = S.colonel;
    if (S.stage === 0) return { text: 'Surveiller la villa (lunette : clic droit, T : télémètre)', target: T.clone().setY(HC + 4) };
    if (S.stage === 1) return { text: 'Éliminer le colonel Varga', target: c.eye() };
    return { text: heli.userData.landed ? "Monter dans l'hélico" : "Attendre l'hélico d'extraction", target: heli.visible ? heli.position.clone().add(new V3(0, 2, 0)) : null };
  },
  onKey(code) { if (code === 'KeyX' && S.stage === 2) player.prone = !player.prone; },
  *demo() {
    S.outAt = 1e9;
    W.wind = 2.6;
    const c = S.colonel;
    // 1. survol des montagnes à l'aube
    mark('aerial');
    const P = player.pos.clone();
    yield* camPath([new V3(-260, Y(-260, 600) + 260, 600), new V3(-60, P.y + 70, 140), new V3(-6, P.y + 6, 14)], [new V3(0, P.y, 0), new V3(T.x * .1, P.y - 20, T.z * .1), new V3(T.x * .02, P.y - 2, T.z * .02)], 7);
    caption('MISSION 03', 'ŒIL DE FAUCON', 'MONTS KARAS · 05 H 52', 4.5);
    mark('prone');
    radio("Faucon, le colonel Varga quitte sa villa dans quelques minutes. Tu n'auras qu'une seule chance.", 'QG', 5);
    yield* lookAt(T.clone().setY(HC + 3), 2.5, 3);
    // 2. la lunette
    mark('scope');
    G.input.ads = true; W.zoom = 0; yield* wait(1.2);
    W.zoom = 1; yield* lookAt(T.clone().setY(HC + 3), 1.2, 6);
    W.zoom = 2; yield* lookAt(T.clone().add(new V3(-2, HC + 1.5, 4)), 1.4, 6);
    mark('lase');
    lase(); yield* wait(1.4);
    // 3. il sort
    S.outAt = S.t + .2; yield* wait(.4);
    mark('target');
    yield* hold((dt) => { look(c.eye().add(new V3(0, .3, 0)), 7, dt); }, 4.5);
    // le colonel s'arrête un instant devant sa voiture
    c.path = []; c.speed = 0;
    // 4. le tir (visée calculée pour le vent et la chute)
    mark('aim');
    const aimAt = c.b.sp2.getWorldPosition(new V3());
    for (let i = 0; i < 6; i++) { const err = predictImpact(aimAt); player.yaw -= err.yaw; player.pitch -= err.pitch; }
    W.holdBreath = 1; yield* wait(1.0);
    for (let i = 0; i < 4; i++) { const err = predictImpact(aimAt); player.yaw -= err.yaw; player.pitch -= err.pitch; }
    mark('shot');
    fireSniper({ cam: true });
    while (W.bullet) yield;
    mark('impact_done');
    G.input.ads = true; W.zoom = 1;
    yield* lookAt(T.clone().setY(HC + 2), 2.5, 4);
    // 5. un garde qui panique : deuxième tir, sans caméra balle
    const v2 = E('v2'); v2.fixed = false;
    mark('second');
    yield* wait(.6);
    for (let i = 0; i < 8; i++) { const err = predictImpact(v2.b.sp2.getWorldPosition(new V3())); player.yaw -= err.yaw; player.pitch -= err.pitch; }
    W.zoom = 2; yield* wait(.5);
    for (let i = 0; i < 6; i++) { const err = predictImpact(v2.b.sp2.getWorldPosition(new V3())); player.yaw -= err.yaw; player.pitch -= err.pitch; }
    fireSniper({ cam: false });
    yield* wait(6.5);
    G.input.ads = false;
    // 6. extraction
    mark('heli');
    for (let t = 0; !heli.visible && t < 6;) { const dt = yield; t += dt; }
    yield* lookAt(() => heli.position.clone().add(new V3(0, 2, 0)), 9, 2);
    S.lift = .001;
    mark('lift');
    const hp = heli.position.clone();
    yield* camPath([hp.clone().add(new V3(-30, 6, 30)), hp.clone().add(new V3(-60, 40, 80))], () => heli.position.clone().add(new V3(0, 2, 0)), 6);
    mark('end');
  },
};
