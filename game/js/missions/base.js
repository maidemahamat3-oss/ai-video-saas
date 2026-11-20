// MISSION 01 — BASE VIPÈRE : infiltration de nuit, antenne radar, extraction.
import { THREE, V3, G, rnd, rr, TAU, easeInOut, clamp, box, addCol, radio, stamp, sfx, later, mark, explosion, hud, caption, cine, FX } from '../engine.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT, prop, ground, container, sandbags, lamp, building } from '../world.js';
import { Soldier, makeHeli, spinHeli } from '../actors.js';
import { player } from '../player.js';
import { ctx } from '../main.js';
import { E, wait, walk, look, lookAt, aimAndKill, knifeKill, camPath, hold } from '../director.js';

const RADAR = new V3(22, 0, -30), CONSOLE = new V3(18.5, 0, -26.2), HELIPAD = new V3(-18, 0, -32);
let mast, dish, heli, charge, beacon, S = {};

export default {
  id: 'base', num: 1, seed: 7, title: 'Base Vipère', place: 'DÉSERT DU NORD · 02 h 40', time: 240,
  brief: ['Infiltrer la base ennemie', "Saboter l'antenne radar", "Rejoindre l'hélico d'extraction"],
  text: "<strong>12 gardes. 4 minutes.</strong> Attaque-les par derrière au couteau pour rester invisible. Un seul coup de feu et toute la base te tombe dessus.",
  intro: "Faucon, ici le QG. L'antenne de la Base Vipère doit tomber. Discrétion maximale.",
  winText: "Antenne détruite. Le réseau Vipère est aveugle.",
  player: { x: 0, z: 54, yaw: 0 },
  menuCam: { r: 70, h: 26, cx: 0, cz: -8 },
  cine: [
    [[-90, 60, 120], [-40, 40, 70], [0, 0, -10], [0, 0, -10], 9], [[60, 9, 40], [40, 7, 30], [0, 2, 20], [0, 2, 10], 7],
    [[-34, 7, 26], [-30, 7, -10], [-20, 1, 10], [-10, 1, -20], 8], [[30, 14, -10], [18, 12, -18], [22, 8, -30], [22, 9, -30], 7],
    [[-5, 3, -20], [-12, 3, -26], [-18, 1, -32], [-18, 1, -32], 6], [[0, 120, 160], [0, 80, 60], [0, 0, -8], [0, 0, -8], 9],
    [[40, 4, 50], [10, 3, 40], [0, 2, 28], [0, 2, 28], 7], [[-60, 30, -80], [60, 30, -80], [0, 0, -10], [0, 0, -10], 10],
  ],
  light: { sky: 'kloppenheim_02', bg: .32, env: 1.35, exposure: 1.1, bloom: .5, fog: [0x141c28, .011], hemi: [0x8a9cc0, 0x3a3020, .9], sun: { dir: [-.55, .75, -.4], color: 0xb0c4ff, intensity: 1.3 } },

  build() {
    S = {};
    ground(6000, MAT.sand, 1500);
    const slab = ground(72, MAT.concreteFloor, 18, .015); slab.position.set(0, .015, -8);
    // enceinte
    const H = 3.6, T = .8;
    box(-20, 0, 28, 32, H, T, MAT.concrete, { uv: 3 }); box(20, 0, 28, 32, H, T, MAT.concrete, { uv: 3 });
    box(0, 0, -44, 72.8, H, T, MAT.concrete, { uv: 3 }); box(-36, 0, -8, T, H, 72, MAT.concrete, { uv: 3 }); box(36, 0, -8, T, H, 72, MAT.concrete, { uv: 3 });
    for (const x of [-4.6, 4.6]) { box(x, 0, 28, 1.2, 4.6, 1.2, MAT.concrete, { uv: 2 }); box(x, 4.6, 28, 1.4, .25, 1.4, MAT.dark, { col: false }); }
    // fil barbelé sur les murs
    const wire = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: .8, roughness: .5 });
    { const parts = []; for (const [x, z, len, rot] of [[-20, 28, 32, 0], [20, 28, 32, 0], [0, -44, 72, 0], [-36, -8, 72, Math.PI / 2], [36, -8, 72, Math.PI / 2]]) for (let i = -len / 2; i < len / 2; i += .35) {
        const t = new THREE.TorusGeometry(.22, .012, 3, 10); t.rotateY(Math.PI / 2 + .3); t.translate(i, 0, 0); t.rotateY(rot); t.translate(x, H + .22, z); parts.push(t); }
      G.scene.add(new THREE.Mesh(mergeGeometries(parts), wire)); }
    // barrière et guérite
    box(-6.5, 0, 31, 2, 2.6, 2, MAT.plaster, { uv: 2 }); box(-6.5, 2.6, 31, 2.4, .2, 2.4, MAT.roof, { col: false });
    for (const x of [-8, -6, 6, 8]) prop('concrete_road_barrier', x, 0, 34, { ry: 0 });
    // bâtiments
    building(-23, -6, 10, 4.2, 16, { lit: .5 }); building(18, 9, 13, 5, 8, { lit: .7 }); building(-22, 14, 8, 3.6, 6, { lit: .4 });
    // conteneurs
    container(-6, -14, true, 0); container(-6, -14, true, 2, 2.59); container(9, -21, false, 1); container(-13, 18, false, 3); container(3, 13, true, 2); container(27, -14, false, 0); container(-2, -36, true, 1);
    // caisses, barils, jerricanes, pneus
    for (const [x, z, r] of [[6, 21, 0], [7.4, 21.2, .2], [-9, 20, 1.2], [12, -4, .5], [-3, -26, 0], [20, -18, 1.4], [-17, -28, .3], [-11, 2.5, 1.57], [24, -2, .8], [-28, -16, 0], [30, -30, 1], [0, 0, .4]]) prop('wooden_military_crate', x, 0, z, { ry: r, s: 1.25 });
    for (const [x, z] of [[-10, 3.8], [13.6, -4.4], [25, -3], [29.5, -6], [-27, -14], [16, 4], [-15, 22]]) prop('Barrel_01', x, 0, z, { ry: rnd() * TAU, s: 1.1 });
    for (const [x, z] of [[7, 22.5], [-8.5, 21.5], [21, -16.8], [-2, -24.5]]) prop('metal_jerrycan', x, 0, z, { ry: rnd() * TAU });
    for (const [x, z] of [[11, -2.6], [-12, 4.5], [26, -1]]) prop('old_tyre', x, 0, z, { ry: rnd() * TAU, s: 1.2, col: false });
    for (const [x, z] of [[28, -4], [31, -4], [29.5, -1.5]]) prop('propane_tank', x, 0, z, { ry: 0, s: 1.6 });
    for (const [x, z] of [[-3.4, -25.2], [19.5, -16.6]]) prop('ammo_box', x, 1.25, z, { ry: rnd(), col: false });
    sandbags(-8, 24.5, 4); sandbags(9, 24.5, 4); sandbags(14, -26, 4, Math.PI / 2); sandbags(-16, -36, 4);
    // tours de guet + projecteurs
    S.towers = [];
    for (const [x, z, a] of [[-31, 23, .3], [31, -39, 2.5]]) {
      const TH = 4.6;
      for (const [a2, b2] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) box(x + a2, 0, z + b2, .22, TH, .22, MAT.dark);
      box(x, TH, z, 3.2, .25, 3.2, MAT.metal, { col: false });
      for (const [dx, dz, w, d] of [[0, 1.5, 3.2, .1], [0, -1.5, 3.2, .1], [1.5, 0, .1, 3.2], [-1.5, 0, .1, 3.2]]) box(x + dx, TH + .25, z + dz, w, 1, d, MAT.metal, { col: false });
      box(x, TH + 2.4, z, 3.6, .2, 3.6, MAT.roof, { col: false });
      const spot = new THREE.SpotLight(0xdde8ff, 900, 80, .18, .45, 1.3); spot.position.set(x, TH + 1.9, z); G.scene.add(spot, spot.target);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -.5, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: .045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.copy(spot.position); G.scene.add(cone);
      S.towers.push({ spot, cone, x, z, a });
    }
    // lampadaires
    for (const [x, z] of [[-6, 25.5], [6, 25.5], [-14, 6], [10, -10], [16, -31], [-24, -30]]) lamp(x, z, { intensity: 220 });
    // antenne radar
    box(RADAR.x, 0, RADAR.z, 4, 1.4, 4, MAT.concrete);
    mast = new THREE.Group(); mast.position.copy(RADAR); G.scene.add(mast);
    const m1 = new THREE.Mesh(new THREE.CylinderGeometry(.22, .35, 8, 12), MAT.metal); m1.position.y = 5.4; m1.castShadow = true; mast.add(m1);
    for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(1.3, .07, .07), MAT.dark); r.position.y = 1.8 + i * 1.15; r.rotation.y = i * .8; mast.add(r); }
    dish = new THREE.Group(); dish.position.y = 9.6; mast.add(dish);
    const dm = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 14, 0, TAU, 0, .7), new THREE.MeshStandardMaterial({ color: 0xd8d6cc, metalness: .5, roughness: .35, side: THREE.DoubleSide })); dm.rotation.x = -Math.PI / 2.4; dm.castShadow = true; dish.add(dm);
    beacon = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 8 })); beacon.position.y = 10.9; mast.add(beacon);
    box(CONSOLE.x, 0, CONSOLE.z, 1.1, 1.25, .7, MAT.dark);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(.8, .45), new THREE.MeshStandardMaterial({ color: 0x051018, emissive: 0x2fb8ff, emissiveIntensity: 2.4 })); sc.position.set(CONSOLE.x, 1.05, CONSOLE.z + .36); sc.rotation.x = -.35; G.scene.add(sc);
    charge = new THREE.Group(); charge.add(new THREE.Mesh(new THREE.BoxGeometry(.35, .2, .25), new THREE.MeshStandardMaterial({ color: 0x5a5a3a, roughness: .8 })));
    const led = new THREE.Mesh(new THREE.SphereGeometry(.035), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: 6 })); led.position.set(.1, .12, 0); charge.add(led); charge.userData.led = led;
    charge.position.set(CONSOLE.x, 1.36, CONSOLE.z); charge.visible = false; G.scene.add(charge);
    // héliport
    const hp = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), new THREE.MeshStandardMaterial({ map: helipadTex(), roughness: .9 })); hp.rotation.x = -Math.PI / 2; hp.position.copy(HELIPAD).setY(.03); hp.receiveShadow = true; G.scene.add(hp);
    heli = makeHeli(); heli.visible = false; G.scene.add(heli);
    // rochers à l'approche
    for (const [x, z, r] of [[-7, 44, 2.2], [9, 40, 1.8], [-14, 36, 1.5], [16, 47, 2.6], [-22, 52, 2], [4, 62, 1.4], [-40, 70, 4], [44, 60, 5]]) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), MAT.rock); m.position.set(x, r * .4, z); m.scale.y = .7; m.rotation.set(rnd(), rnd() * 3, rnd()); m.castShadow = m.receiveShadow = true; G.scene.add(m);
      addCol(x - r * .8, 0, z - r * .8, x + r * .8, r * 1.1, z + r * .8);
    }
    G.updaters.push((dt) => {
      for (const s of S.towers) { s.a += dt * .35; const r = 16 + Math.sin(s.a * .7) * 6; const tx = s.x + Math.cos(s.a) * r * (s.x < 0 ? 1 : -1) + (s.x < 0 ? 12 : -12), tz = s.z + Math.sin(s.a) * r * .8 + (s.z > 0 ? -12 : 12);
        s.spot.target.position.set(tx, 0, tz); s.cone.lookAt(tx, 0, tz); const d = s.spot.position.distanceTo(s.spot.target.position); s.cone.scale.set(d * .18, d * .18, d); }
      dish.rotation.y += dt * .8; beacon.visible = (G.time % 1.2) < .6;
      if (S.fall) { const f = S.fall = Math.min(1, S.fall + dt * .55); mast.rotation.z = -easeInOut(f) * 1.4; mast.position.x = RADAR.x + easeInOut(f) * 1.4; }
      if (heli.visible) this.updateHeli(dt);
    });
  },
  spawn() {
    const list = G.demo ? [
      ['d1', -1.5, 19, { yaw: Math.PI * .94, fixed: true }], ['d2', 12, 16, { yaw: -2.2, fixed: true }], ['d3', 8, 1, { yaw: 2.6, fixed: true }],
      ['d4', -4, -6, { yaw: 2.2, fixed: true }], ['d5', 24, -22, { yaw: 2.4, fixed: true }], ['d6', 12, -33, { yaw: 2.8, fixed: true }],
      ['d7', 4, -24, { path: [[4, -24], [9, -24]] }], ['t1', -31, 23, { y: 4.85, fixed: true, yaw: 2.4 }],
    ] : [
      ['g1', -6, 21, { path: [[-6, 21], [4, 23], [-12, 22]] }], ['g2', 14, 15, { yaw: -Math.PI / 2, fixed: true }], ['g3', -16, 4, { path: [[-16, 4], [-16, -18]] }],
      ['g4', 2, -3, { path: [[2, -3], [12, -8], [3, -9]] }], ['g5', 17, -23, { yaw: Math.PI, fixed: true }], ['g6', 26, -22, { path: [[26, -22], [26, -35], [14, -35]] }],
      ['g7', -26, -24, { path: [[-26, -24], [-9, -24]] }], ['g8', -5, -30, { yaw: Math.PI / 2, fixed: true }], ['g9', 6, 6, { path: [[6, 6], [6, -10]] }],
      ['g10', 10, 3.5, { yaw: -Math.PI / 2, fixed: true }], ['t1', -31, 23, { y: 4.85, fixed: true, yaw: 2.4, range: 38 }], ['t2', 31, -39, { y: 4.85, fixed: true, yaw: -.9, range: 38 }],
    ];
    for (const [id, x, z, o] of list) G.enemies.push(new Soldier({ id, x, z, ...o }));
    Object.assign(S, { stage: 0, plant: 0, fuse: 0, heliT: 0, fall: 0, alarm: false });
  },
  onAlarm(by) {
    if (S.alarm) return; S.alarm = true; hud.alarm.hidden = false; sfx('alarm');
    radio("Ils t'ont repéré ! Toute la base est en alerte, fonce !");
    for (const e of G.enemies) if (!e.dead && e !== by && e.pos.distanceTo(by.pos) < 30) later(.4 + rnd() * .9, () => e.alert(player.pos, true));
  },
  update(dt) {
    if (S.stage === 0 && player.pos.z < 26.5 && Math.abs(player.pos.x) < 35.5) { S.stage = 1; radio("Tu es dans la base. L'antenne radar est au nord-est. Pose la charge sur la console."); }
    if (S.stage === 1 && player.pos.distanceTo(CONSOLE.clone().setY(player.pos.y)) < 2.6) {
      if (G.input.action) { if (S.plant === 0) sfx('plant'); S.plant += dt / 2.2; } else S.plant = Math.max(0, S.plant - dt);
      if (S.plant >= 1) { S.stage = 2; S.fuse = G.demo ? 8 : 15; charge.visible = true; stamp('CHARGE POSÉE', true); sfx('plant'); radio(G.demo ? 'Charge posée ! Dégage de là, huit secondes !' : 'Charge posée ! Dégage de là, quinze secondes !'); }
    }
    if (S.stage === 2) {
      const prev = Math.ceil(S.fuse); S.fuse -= dt; if (Math.ceil(S.fuse) !== prev && S.fuse > 0) sfx('beep'); charge.userData.led.visible = (S.fuse * 4 % 1) < .5;
      if (S.fuse <= 0) { S.stage = 3; charge.visible = false; explosion(RADAR.clone().setY(2.5), 1.3); S.fall = .001; stamp('CIBLE DÉTRUITE', true);
        for (const e of G.enemies) if (!e.dead && e.pos.distanceTo(RADAR) < 10) e.damage(999, false, new V3(0, 0, 1));
        if (player.pos.distanceTo(RADAR) < 9) G.hurtPlayer(70, RADAR);
        later(1.2, () => radio("Cible détruite ! Corbeau-1 arrive sur l'héliport, cours !")); heli.visible = true; S.heliT = 0; }
    }
    if (S.stage === 3 && heli.userData.landed && player.pos.distanceTo(HELIPAD) < 7 && !G.demo) ctx.complete(this.winText);
  },
  updateHeli(dt) {
    S.heliT += dt; spinHeli(heli, dt);
    const T = S.heliT, HA = G.demo ? 4.5 : 7, HL = G.demo ? 2.6 : 4;
    if (T < HA) { const k = easeInOut(T / HA); heli.position.set(lerp(-90, HELIPAD.x, k), lerp(45, 9, k), lerp(-150, HELIPAD.z, k)); heli.rotation.set(-.12 * (1 - k), .4 * (1 - k), 0); }
    else { const k = easeInOut(clamp((T - HA) / HL, 0, 1)); heli.position.set(HELIPAD.x, lerp(9, .05, k), HELIPAD.z); heli.rotation.set(0, 0, Math.sin(G.time * 1.5) * .02 * (1 - k)); heli.userData.spot.intensity = 900; heli.userData.landed = k >= 1;
      if (rnd() < dt * 18 * k) FX.smoke.spawn({ p: HELIPAD.clone().add(new V3(rr(-5, 5), .3, rr(-5, 5))), v: new V3(rr(-6, 6), rr(.2, 1), rr(-6, 6)), life: 1.4, s0: 1, s1: 4, c0: 0x8a7a60, a: .35 }); }
  },
  objective() {
    const t = [{ text: 'Infiltrer la base', target: new V3(0, 2, 27) }, { text: "Saboter l'antenne radar", target: CONSOLE.clone().setY(1.8) },
      { text: `Fuir ! Explosion dans ${Math.max(0, Math.ceil(S.fuse))} s`, target: HELIPAD.clone().setY(2) }, { text: "Rejoindre l'hélico d'extraction", target: HELIPAD.clone().setY(3) }][S.stage];
    if (S.stage === 1 && player.pos.distanceTo(CONSOLE.clone().setY(player.pos.y)) < 2.6) { t.prompt = 'Maintiens E : poser la charge'; t.progress = S.plant; }
    return t;
  },
  *demo() {
    player.pos.set(-1.6, 0, 33); player.yaw = 0; player.pitch = -.05; player.crouchOn = true; player.crouch = 1;
    mark('drone');
    yield* camPath([new V3(-30, 34, 80), new V3(-6, 22, 46), new V3(6, 14, 30)], [new V3(0, 0, -10), new V3(6, 0, -18)], 6);
    mark('fps');
    caption('MISSION 01', 'BASE VIPÈRE', 'DÉSERT DU NORD · 02 H 40', 4);
    radio("Faucon, ici le QG. L'antenne de la Base Vipère doit tomber. Discrétion maximale.", 'QG', 5);
    yield* wait(.8); G.input.ads = true; yield* wait(1.1); G.input.ads = false;
    mark('sneak');
    yield* walk([[-1.5, 27], [-1.45, 20.7]], 2.4, { lookAt: () => E('d1').eye().add(new V3(0, -.25, 0)), k: 4, during: (dt) => { player.crouch = Math.min(1, player.crouch); } });
    mark('knife');
    yield* knifeKill('d1');
    yield* wait(.8);
    player.crouchOn = false; player.crouch = 0;
    const d2 = E('d2'); d2.yaw = Math.atan2(player.pos.x - d2.pos.x, player.pos.z - d2.pos.z); d2.alert(player.pos);
    mark('alarm');
    yield* wait(.3);
    yield* aimAndKill('d2', { ads: true, head: true, k: 7, delay: .45 });
    yield* walk([[-1.5, 9]], 6.2, { lookAt: () => E('d3').eye(), k: 5 });
    yield* aimAndKill('d3', { ads: true, k: 9 });
    yield* aimAndKill('d4', { ads: true, k: 9 });
    mark('run');
    yield* walk([[10, -14], [13, -15]], 6.4, { lookAt: () => E('d5').dead ? new V3(18, 1.5, -25) : E('d5').eye(), k: 3 });
    yield* aimAndKill('d5', { ads: true, head: true, k: 10 });
    yield* aimAndKill('d6', { ads: true, k: 10 });
    yield* walk([[18.5, -24.6]], 4.5, { lookAt: CONSOLE.clone().setY(1.2), k: 6 });
    mark('plant');
    yield* hold((dt) => { look(CONSOLE.clone().setY(1.25), 8, dt); G.input.action = true; }, 2.4);
    G.input.action = false;
    mark('flee');
    yield* walk([[14, -22.5], [6, -27]], 6.6, { pitch: -.02, during: () => { const e = E('d7'); if (e && !e.dead && e.state !== 'alert') e.alert(player.pos, true); } });
    yield* aimAndKill('d7', { k: 12 });
    yield* walk([[-2, -29.5]], 6.6, { pitch: -.02 });
    yield* lookAt(new V3(22, 5, -30), 1.2);
    for (let t = 0; S.stage < 3 && t < 12;) { const dt = yield; t += dt; look(new V3(22, 5, -30), 5, dt); }
    mark('boom');
    yield* wait(2.6);
    mark('heli');
    yield* lookAt(() => heli.position.clone().add(new V3(0, 1.2, 0)), 5, 3);
    yield* walk([[-13, -30.5]], 5.5, { lookAt: () => heli.position.clone().add(new V3(0, 1.2, 0)), k: 4 });
    mark('end');
    yield* wait(3);
  },
};
const lerp = (a, b, t) => a + (b - a) * t;
function helipadTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#3c3e3a'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},.04)`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
  g.strokeStyle = '#e8e2d0'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 102, 0, TAU); g.stroke();
  g.fillStyle = '#e8e2d0'; g.font = 'bold 130px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
