// =====================================================================
// Armes et bras du commando : fusil d'assaut VK-12 (modélisé en détail),
// couteau de combat, fusil de précision (modèle 3D Poly Haven, CC0).
// =====================================================================
import { THREE, V3, TAU, G, rnd, rr, clamp, lerp, damp, easeInOut, vmScene, vmCamera } from './engine.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ----- textures de détail générées (grain du métal, tissu camouflage)
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function heightToNormal(h, size, strength) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const img = g.createImageData(size, size);
  const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength; const l = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4; img.data[i] = (-dx / l * .5 + .5) * 255; img.data[i + 1] = (dy / l * .5 + .5) * 255; img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const S = 256, grain = new Float32Array(S * S), weave = new Float32Array(S * S), stip = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) { grain[i] = Math.random(); const x = i % S, y = (i / S) | 0; weave[i] = (Math.sin(x * .8) * Math.sin(y * .8) > 0 ? .6 : .4) + Math.random() * .25; stip[i] = Math.random() < .35 ? 1 : 0; }
  const nGrain = heightToNormal(grain, S, .35), nWeave = heightToNormal(weave, S, 1.2), nStip = heightToNormal(stip, S, .8);
  nGrain.repeat.set(4, 4); nStip.repeat.set(6, 6); nWeave.repeat.set(10, 10);
  const camo = canvasTex(512, (g, s) => {
    g.fillStyle = '#857b5d'; g.fillRect(0, 0, s, s);
    const blob = (col, n, r0, r1) => { g.fillStyle = col; for (let i = 0; i < n; i++) { g.beginPath(); const x = Math.random() * s, y = Math.random() * s; for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, r = r0 + Math.random() * (r1 - r0); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * .7); } g.fill(); } };
    blob('#9c8c69', 40, 18, 46); blob('#5f5a3f', 35, 14, 40); blob('#6d5a3e', 30, 10, 30); blob('#b3a47f', 22, 6, 18); blob('#3f3a2b', 20, 5, 14);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .08})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  });
  camo.repeat.set(2, 2);
  MATS = {
    anod: new THREE.MeshStandardMaterial({ color: 0x1d1e20, metalness: .55, roughness: .4, normalMap: nGrain, normalScale: new THREE.Vector2(.25, .25) }),
    dark: new THREE.MeshStandardMaterial({ color: 0x141516, metalness: .5, roughness: .5, normalMap: nGrain, normalScale: new THREE.Vector2(.2, .2) }),
    steel: new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: .9, roughness: .3, normalMap: nGrain, normalScale: new THREE.Vector2(.15, .15) }),
    poly: new THREE.MeshStandardMaterial({ color: 0x232323, metalness: 0, roughness: .62, normalMap: nStip, normalScale: new THREE.Vector2(.35, .35) }),
    fde: new THREE.MeshStandardMaterial({ color: 0x75664c, metalness: 0, roughness: .6, normalMap: nStip, normalScale: new THREE.Vector2(.3, .3) }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: .92 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: .25 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9ab6d0, metalness: 0, roughness: .04, transparent: true, opacity: .22, envMapIntensity: 2.2 }),
    dot: new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff4dd, emissiveIntensity: .25, roughness: .1 }),
    blade: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 1, roughness: .16, normalMap: nGrain, normalScale: new THREE.Vector2(.08, .08) }),
    glove: new THREE.MeshStandardMaterial({ color: 0x2c2d2b, roughness: .82, normalMap: nWeave, normalScale: new THREE.Vector2(.5, .5) }),
    pad: new THREE.MeshStandardMaterial({ color: 0x1a1a19, roughness: .7 }),
    sleeve: new THREE.MeshStandardMaterial({ map: camo, roughness: .95, normalMap: nWeave, normalScale: new THREE.Vector2(.6, .6) }),
  };
  return MATS;
}

// profil latéral extrudé : points [avant, haut] → pièce centrée en x, l'avant vers -z
function prof(pts, depth, bevel = .002, holes = []) {
  const s = new THREE.Shape(pts.map(([f, u]) => new THREE.Vector2(f, u)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([f, u]) => new THREE.Vector2(f, u))));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.0005, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2); g.rotateY(Math.PI / 2);
  return g;
}
const rectH = (f0, f1, u0, u1) => [[f0, u0], [f1, u0], [f1, u1], [f0, u1]];
function cyl(r, f0, f1, u, x = 0, seg = 20, open = false) { const g = new THREE.CylinderGeometry(r, r, f1 - f0, seg, 1, open); g.rotateX(Math.PI / 2); g.translate(x, u, -(f0 + f1) / 2); return g; }
function mesh(g, m, parent, cast = false) { const o = new THREE.Mesh(g, m); o.castShadow = cast; parent.add(o); return o; }

// ------------------------------------------------- fusil d'assaut VK-12
export function makeRifle(lod = 'high') {
  const M = mats(), r = new THREE.Group(), hi = lod === 'high';
  r.userData = {};
  // carcasse supérieure + inférieure
  mesh(prof(rectH(-.165, .118, .034, .087), .05, .004), M.anod, r, true);
  mesh(prof([[-.15, .034], [.1, .034], [.1, -.004], [.086, -.01], [.086, -.058], [.002, -.058], [.002, -.012], [-.03, -.014], [-.1, -.01], [-.15, .0]], .047, .004), M.anod, r, true);
  // pontet + détente
  if (hi) { mesh(prof(rectH(-.078, .0, -.052, -.01), .012, .002, [rectH(-.07, -.007, -.045, -.017)]), M.anod, r); mesh(prof([[-.035, -.012], [-.028, -.012], [-.03, -.03], [-.038, -.04], [-.04, -.036]], .006, .001), M.steel, r); }
  // poignée pistolet (polymère texturé)
  mesh(prof([[-.105, -.006], [-.052, -.006], [-.062, -.06], [-.082, -.128], [-.132, -.128], [-.124, -.066]], .032, .007), M.poly, r, true);
  // chargeur courbe + semelle
  mesh(prof([[.006, -.01], [.08, -.01], [.088, -.06], [.104, -.12], [.126, -.17], [.138, -.205], [.075, -.222], [.052, -.17], [.03, -.11], [.013, -.05]], .025, .003), M.fde, r, true);
  mesh(prof([[.07, -.222], [.142, -.203], [.146, -.214], [.074, -.234]], .03, .003), M.poly, r);
  // garde-main avec fentes M-LOK traversantes
  const holes = []; for (let i = 0; i < 6; i++) { const f0 = .15 + i * .056; holes.push(rectH(f0, f0 + .034, .046, .062)); }
  mesh(prof(rectH(.118, .5, .028, .1), .058, .009, holes), M.anod, r, true);
  // rail Picatinny + dents
  mesh(prof(rectH(-.165, .5, .087, .097), .022, .001), M.anod, r);
  if (hi) { const teeth = []; for (let f = -.16; f < .495; f += .01) { const g = new THREE.BoxGeometry(.026, .006, .0042); g.translate(0, .1, -f); teeth.push(g); } mesh(mergeGeometries(teeth), M.anod, r); }
  // canon, bloc gaz, frein de bouche
  mesh(cyl(.0095, .118, .64, .064), M.steel, r);
  mesh(cyl(.0145, .64, .715, .064, 0, 16), M.dark, r);
  if (hi) for (let i = 0; i < 3; i++) mesh(cyl(.0148, .655 + i * .018, .662 + i * .018, .064, 0, 16), M.rubber, r);
  // tube de crosse + crosse réglable + plaque de couche
  mesh(cyl(.017, -.34, -.165, .062), M.anod, r);
  mesh(prof([[-.25, .095], [-.43, .095], [-.448, .088], [-.448, -.032], [-.425, -.046], [-.37, -.012], [-.3, .028], [-.25, .04]], .042, .006), M.fde, r, true);
  mesh(prof([[-.448, .09], [-.462, .09], [-.462, -.04], [-.448, -.034]], .046, .004), M.rubber, r);
  // levier d'armement, assistance de fermeture, fenêtre d'éjection
  mesh(prof(rectH(-.18, -.155, .078, .086), .07, .002), M.dark, r);
  if (hi) {
    mesh(cyl(.007, -.11, -.075, .07, .03, 12), M.dark, r);
    const port = new THREE.Mesh(new THREE.PlaneGeometry(.075, .024), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: .6 }));
    port.position.set(.0262, .057, .02); port.rotation.y = Math.PI / 2; r.add(port);
    mesh(prof(rectH(-.07, -.05, .05, .07), .01, .002), M.anod, r).position.x = .028;
  }
  r.userData.eject = new V3(.03, .058, .02);
  // viseur point rouge (tube ouvert, lentilles, point lumineux)
  const sightU = .142;
  mesh(prof(rectH(-.075, .02, .097, .112), .03, .002), M.anod, r);
  mesh(prof(rectH(-.06, -.04, .11, .125), .016, .002), M.anod, r); mesh(prof(rectH(.0, .02, .11, .125), .016, .002), M.anod, r);
  mesh(cyl(.021, -.07, .025, sightU, 0, 28, true), M.anod, r);
  if (hi) {
    const inner = new THREE.Mesh(cyl(.019, -.07, .025, sightU, 0, 28, true), new THREE.MeshStandardMaterial({ color: 0x050505, side: THREE.BackSide, roughness: .5 })); r.add(inner);
    mesh(cyl(.009, -.03, -.01, sightU + .025), M.dark, r); const tr = new THREE.Mesh(cyl(.009, -.03, -.01, 0), M.dark); tr.rotation.z = -Math.PI / 2; tr.position.set(.025, sightU, 0); r.add(tr);
    for (const f of [-.068, .023]) { const l = new THREE.Mesh(new THREE.CircleGeometry(.019, 24), M.glass); l.position.set(0, sightU, -f); r.add(l); }
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.0016, 8, 6), M.dot); dot.position.set(0, sightU, .03); r.add(dot);
  r.userData.dot = dot.position.clone();
  // lampe tactique + poignée avant
  mesh(cyl(.0135, .38, .48, .05, .045, 16), M.anod, r);
  if (hi) { const l = new THREE.Mesh(new THREE.CircleGeometry(.011, 16), M.lens); l.position.set(.045, .05, -.481); r.add(l); }
  mesh(prof([[.27, .028], [.33, .028], [.325, -.04], [.31, -.06], [.285, -.06], [.28, -.04]], .03, .006), M.poly, r, true);
  r.userData.muzzle = new V3(0, .064, -.72);
  r.userData.gripR = new V3(0, -.06, .09); r.userData.gripL = new V3(0, .0, -.3);
  return r;
}

// ------------------------------------------------------------- couteau
export function makeKnife() {
  const M = mats(), k = new THREE.Group();
  mesh(prof([[0, .013], [.125, .013], [.165, .004], [.19, -.003], [.16, -.012], [.06, -.016], [0, -.015]], .0045, .0015), M.blade, k);
  mesh(prof([[0, .0], [.15, .0], [.17, -.004], [.16, -.012], [.06, -.016], [0, -.015]], .0046, 0), new THREE.MeshStandardMaterial({ color: 0xe8eaee, metalness: 1, roughness: .08 }), k).position.y = .0002;
  mesh(prof(rectH(-.012, .0, -.026, .03), .024, .003), M.dark, k);
  mesh(prof([[-.13, .011], [-.012, .014], [-.012, -.02], [-.04, -.022], [-.07, -.017], [-.1, -.022], [-.13, -.016]], .024, .007), M.poly, k);
  k.rotation.set(0, 0, 0);
  return k;
}

// ---------------------------------------------------------- bras/gants
function capsule(a, b, r, m, parent) {
  const v = new V3().subVectors(b, a), L = v.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(.001, L - 2 * r), 6, 14); g.rotateX(Math.PI / 2);
  const o = new THREE.Mesh(g, m); o.position.copy(a).addScaledVector(v, .5); o.lookAt(b); parent.add(o); return o;
}
// rifle-local : x droite, y haut, z arrière (avant = -z)
function handOnGrip(parent, wrist, palmPos, palmRot, fingers) {
  const M = mats();
  const palm = new THREE.Mesh(new RoundedBoxGeometry(.05, .085, .09, 3, .018), M.glove); palm.position.copy(palmPos); palm.rotation.set(...palmRot); parent.add(palm);
  for (const [a, b, r] of fingers) capsule(a, b, r || .0105, M.glove, parent);
  // manchette + avant-bras en tissu camouflage
  capsule(wrist[0], wrist[1], .034, M.glove, parent);
  capsule(wrist[1], wrist[2], .047, M.sleeve, parent);
}
export function addRifleArms(r) {
  const P = (x, y, z) => new V3(x, y, z);
  // main droite sur la poignée, index le long du pontet
  handOnGrip(r, [P(.005, -.07, .1), P(.03, -.12, .2), P(.16, -.36, .62)], P(.004, -.07, .085), [-.35, 0, 0], [
    [P(-.022, -.04, .055), P(-.024, -.035, .02), .009],
    [P(-.024, -.035, .02), P(-.02, -.036, -.03), .0085],
    [P(.0, -.06, .06), P(-.02, -.075, .055)], [P(-.02, -.075, .055), P(-.026, -.08, .075)],
    [P(.002, -.08, .065), P(-.02, -.095, .063)], [P(.004, -.098, .07), P(-.016, -.11, .072), .0095],
    [P(.024, -.035, .07), P(.021, -.01, .04), .01],
  ]);
  // main gauche sous le garde-main, doigts remontant sur le flanc
  handOnGrip(r, [P(-.02, -.02, -.29), P(-.06, -.07, -.22), P(-.27, -.35, .12)], P(-.012, .006, -.3), [0, 0, .25], [
    [P(-.03, .02, -.33), P(-.034, .07, -.33)], [P(-.03, .02, -.305), P(-.034, .072, -.305)], [P(-.03, .02, -.28), P(-.033, .068, -.28)],
    [P(.03, .01, -.32), P(.034, .05, -.33), .0105],
  ]);
}
export function addKnifeArm(k) {
  const P = (x, y, z) => new V3(x, y, z);
  handOnGrip(k, [P(0, -.005, .075), P(.02, -.06, .17), P(.12, -.3, .52)], P(0, -.004, .07), [0, 0, 0], [
    [P(-.022, .016, .045), P(-.022, -.02, .045)], [P(-.022, .016, .07), P(-.022, -.02, .07)], [P(-.022, .016, .095), P(-.022, -.02, .095)],
    [P(.02, .018, .05), P(.0, .02, .02), .0105],
  ]);
}

// -------------------------------------------- fusil de précision (glTF)
export function prepareSniper(gltfScene) {
  const s = new THREE.Group(); const m = gltfScene.clone(true);
  m.traverse(o => { if (o.name && /bullet/i.test(o.name)) o.visible = false; if (o.isMesh) { o.castShadow = true; } });
  // modèle : +x vers la bouche du canon → on l'oriente vers -z
  m.rotation.y = Math.PI / 2;
  s.add(m);
  const bb = new THREE.Box3().setFromObject(s); s.userData = { bbox: bb, muzzle: new V3(0, (bb.min.y + bb.max.y) / 2 + .01, bb.min.z) };
  return s;
}

// =====================================================================
// Vue à la première personne : position, recul, rechargement, couteau
// =====================================================================
export class Viewmodel {
  constructor() {
    this.root = new THREE.Group(); vmScene.add(this.root);
    this.rifle = makeRifle('high'); addRifleArms(this.rifle); this.root.add(this.rifle);
    this.knife = makeKnife(); addKnifeArm(this.knife); this.knife.scale.setScalar(1.25); this.root.add(this.knife); this.knife.visible = false;
    this.sniper = null;
    this.flash = new THREE.Group(); this.rifle.add(this.flash); this.flash.position.copy(this.rifle.userData.muzzle);
    const ft = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.translate(64, 64);
      for (let i = 0; i < 7; i++) { g.rotate(TAU / 7 + rnd() * .2); const gr = g.createLinearGradient(0, 0, 60, 0); gr.addColorStop(0, 'rgba(255,245,220,1)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -6); g.lineTo(58 * rr(.6, 1), 0); g.lineTo(0, 6); g.fill(); }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 28); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gr; g.fillRect(-30, -30, 60, 60);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const fm = new THREE.MeshBasicMaterial({ map: ft, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xffffff });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(.2, .2), fm); this.flash.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(.09, .34), fm); p2.rotation.y = Math.PI / 2; p2.position.z = -.1; this.flash.add(p2);
    const p3 = p2.clone(); p3.rotation.set(Math.PI / 2, 0, Math.PI / 2); this.flash.add(p3);
    this.flash.visible = false;
    this.light = new THREE.PointLight(0xffa050, 0, 2.5, 2); this.light.position.set(.1, -.05, -.9); vmScene.add(this.light);
    this.key = new THREE.DirectionalLight(0xc8d6ff, 1.6); this.key.position.set(-1, 2, 1); vmScene.add(this.key);
    this.fill = new THREE.HemisphereLight(0x9fb2d6, 0x3a3020, .4); vmScene.add(this.fill);
    this.casings = [];
    const cg = new THREE.CylinderGeometry(.0048, .0048, .045, 10);
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(cg, mats().brass); m.visible = false; vmScene.add(m); this.casings.push({ m, v: new V3(), life: 0, s: 0 }); }
    this.ci = 0;
    this.s = { ads: 0, kick: 0, flash: 0, swayX: 0, swayY: 0, holster: 0, reload: 0, reloadT: 1.9, knifeT: 0, knifeMax: .5, sprint: 0, bob: 0, bolt: 0, raise: 0 };
    this.mode = 'rifle';
    this.adsPos = new V3(-this.rifle.userData.dot.x, -this.rifle.userData.dot.y, -.27 - this.rifle.userData.dot.z);
  }
  setSniper(model) { this.sniper = model; this.root.add(model); model.visible = false; }
  setMode(m) { this.mode = m; this.rifle.visible = m === 'rifle'; if (this.sniper) this.sniper.visible = m === 'sniper'; this.root.visible = m !== 'none'; }
  lights(env, key, color) { vmScene.environment = env; this.key.position.copy(key); this.key.color.set(color || 0xc8d6ff); }
  fire() {
    const s = this.s; s.kick = 1; s.flash = .045; this.light.intensity = 5;
    const c = this.casings[this.ci++ % this.casings.length]; c.m.visible = true; c.life = .8; c.s = rr(10, 22);
    c.m.position.copy(this.rifle.localToWorld(this.rifle.userData.eject.clone())); c.v.set(rr(1, 1.5), rr(.8, 1.3), rr(.1, .4)); c.m.rotation.set(rnd() * 3, 0, Math.PI / 2);
  }
  update(dt, P) {
    const s = this.s, a = vmCamera.aspect < 1;
    s.kick = damp(s.kick, 0, 18, dt); s.flash -= dt; s.ads = damp(s.ads, P.ads ? 1 : 0, 14, dt); s.sprint = damp(s.sprint, P.sprint ? 1 : 0, 8, dt);
    s.holster = damp(s.holster, s.knifeT > 0 ? 1 : 0, 16, dt); s.swayX = damp(s.swayX, 0, 8, dt); s.swayY = damp(s.swayY, 0, 8, dt);
    s.raise = damp(s.raise, 0, 5, dt);
    if (s.reload > 0) s.reload -= dt; if (s.knifeT > 0) s.knifeT -= dt; if (s.bolt > 0) s.bolt -= dt;
    const bobA = P.speed > .3 ? Math.min(1, P.speed / 4) : 0, bx = Math.cos(P.bob) * .012 * bobA * (1 - s.ads * .85), by = Math.abs(Math.sin(P.bob)) * .012 * bobA * (1 - s.ads * .85);
    const hip = new V3(a ? .1 : .135, a ? -.2 : -.165, a ? -.32 : -.33);
    const p = hip.lerp(this.adsPos, s.ads);
    const rl = s.reload > 0 ? Math.sin(Math.PI * (1 - s.reload / s.reloadT)) : 0;
    const w = this.mode === 'sniper' && this.sniper ? this.sniper : this.rifle;
    w.position.set(p.x + bx + s.swayX * (1 - s.ads * .8), p.y + by + s.swayY - s.holster * .45 - rl * .07 - s.raise * .3 - s.bolt * .02, p.z + s.kick * (this.mode === 'sniper' ? .09 : .04));
    w.rotation.set(s.kick * (this.mode === 'sniper' ? .2 : .05) + rl * .55 - s.sprint * .25 + s.raise * .4, s.sprint * .55 + lerp(.035, 0, s.ads), rl * .45 + s.sprint * .3);
    if (this.mode === 'sniper' && this.sniper) w.position.set(p.x + bx + .02, p.y + by - .02 - s.raise * .3, p.z - .05 + s.kick * .08);
    this.rifle.visible = this.mode === 'rifle' && s.holster < .97;
    if (this.sniper) this.sniper.visible = this.mode === 'sniper' && s.ads < .7 && s.holster < .97;
    this.knife.visible = s.holster > .03;
    if (this.knife.visible) {
      const kt = s.knifeT > 0 ? 1 - s.knifeT / s.knifeMax : 0;
      let ox = 0, oy = 0, oz = 0, rx = .2, ry = 0, rz = -.25;
      if (kt > 0) {
        if (kt < .22) { const u = kt / .22; ox = u * .1; oy = u * .12; rz = -.25 - u * .9; rx = .2 + u * .35; }
        else if (kt < .55) { const u = easeInOut((kt - .22) / .33); ox = .1 - u * .36; oy = .12 - u * .24; oz = -u * .16; rz = -1.15 + u * 2.1; rx = .55 - u * .95; ry = u * .5; }
        else { const u = easeInOut((kt - .55) / .45); ox = -.26 * (1 - u); oy = -.12 * (1 - u); oz = -.16 * (1 - u); rz = .95 * (1 - u) - .25 * u; rx = -.4 * (1 - u) + .2 * u; ry = .5 * (1 - u); }
      }
      this.knife.position.set((a ? .07 : .13) + ox + bx, -.19 + oy + by - (1 - s.holster) * .45, -.3 + oz);
      this.knife.rotation.set(rx, ry, rz);
    }
    this.flash.visible = s.flash > 0 && this.mode === 'rifle'; if (this.flash.visible) { this.flash.rotation.z = rnd() * TAU; this.flash.scale.setScalar(rr(.8, 1.25)); }
    this.light.intensity = damp(this.light.intensity, 0, 30, dt);
    for (const c of this.casings) { if (c.life <= 0) continue; c.life -= dt; c.v.y -= 9 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.s * dt; c.m.rotation.y += c.s * .6 * dt; if (c.life <= 0) c.m.visible = false; }
  }
}
