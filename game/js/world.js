// =====================================================================
// Kit de décor : props 3D (Poly Haven CC0), bâtiments, conteneurs,
// lampadaires, sacs de sable, eau, terrain.
// =====================================================================
import { THREE, V3, TAU, G, rnd, rr, clamp, box, addCol, pbr, boxGeo } from './engine.js';
import { Water } from 'three/addons/objects/Water.js';

export const MODELS = {};
export function prop(name, x, y, z, o = {}) {
  const src = MODELS[name]; if (!src) return null;
  const m = src.clone(true); m.position.set(x, y, z); m.rotation.y = o.ry || 0; m.scale.setScalar(o.s || 1);
  m.traverse(n => { if (n.isMesh) { n.castShadow = o.cast !== false; n.receiveShadow = true; } });
  (o.parent || G.scene).add(m);
  if (o.col !== false) { m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m); m.userData.col = addCol(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z, o.tag || 'metal'); }
  return m;
}
// Matériaux partagés du décor
export const MAT = {};
export function initMats() {
  MAT.concrete = pbr('brushed_concrete', { repeat: 1 });
  MAT.concreteFloor = pbr('concrete_floor_01', { repeat: 1, color: 0x8c8a84 });
  MAT.sand = pbr('coast_sand_01', { repeat: 1, color: 0xd8c4a4 });
  MAT.asphalt = pbr('asphalt_02', { repeat: 1 });
  MAT.metal = pbr('metal_plate', { repeat: 1, metal: .6, rough: .8 });
  MAT.plaster = pbr('grey_plaster_02', { repeat: 1 });
  MAT.tiles = pbr('floor_tiles_06', { repeat: 1 });
  MAT.rock = pbr('aerial_rocks_02', { repeat: 1 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x1d1f21, metalness: .6, roughness: .45 });
  MAT.roof = new THREE.MeshStandardMaterial({ color: 0x3a3d3e, metalness: .4, roughness: .7 });
  MAT.window = new THREE.MeshStandardMaterial({ color: 0x1a1208, emissive: 0xffb060, emissiveIntensity: 1.6 });
  MAT.glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1418, metalness: .1, roughness: .04, transparent: true, opacity: .35, envMapIntensity: 1.5 });
  MAT.sandbag = new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 1, map: MAT.sand.map });
  MAT.containers = [0xb5503a, 0x5f8a6c, 0x5577a8, 0xc8963a, 0x9a9a96].map(c => { const m = pbr('corrugated_iron_02', { repeat: 1, color: c, metal: .5, rough: .9 }); return m; });
}

// UV « monde » pour des textures à l'échelle réelle
export function worldBox(x, y, z, w, h, d, mat, o = {}) { return box(x, y, z, w, h, d, mat, { uv: o.uv || 2.5, ...o }); }
export function ground(size, mat, rep, y = 0) {
  const g = new THREE.PlaneGeometry(size, size); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep, uv.getY(i) * rep);
  const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; G.scene.add(m); return m;
}
export function container(x, z, alongX, color = 0, y = 0, o = {}) {
  const L = 6.06, Wd = 2.44, H = 2.59, mat = MAT.containers[color % MAT.containers.length];
  const m = box(x, y, z, alongX ? L : Wd, H, alongX ? Wd : L, mat, { uv: 2.4, tag: 'metal', ...o });
  // portes + barres de verrouillage au bout
  const end = new THREE.Group(); end.position.set(x, y, z); end.rotation.y = alongX ? Math.PI / 2 : 0; G.scene.add(end);
  for (const s of [-1, 1]) for (const k of [-.45, .45]) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, H - .2, 6), MAT.dark); bar.position.set(s * (Wd / 2 * k * 1.6), H / 2, L / 2 + .03); end.add(bar); }
  return m;
}
export function sandbags(x, z, len, rot = 0, rows = 3) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; G.scene.add(g);
  const bag = new THREE.CapsuleGeometry(.17, .38, 4, 8); bag.rotateZ(Math.PI / 2); bag.scale(1, .55, 1);
  for (let r = 0; r < rows; r++) for (let i = 0; i < Math.floor(len / .58); i++) { const m = new THREE.Mesh(bag, MAT.sandbag); m.position.set(-len / 2 + .3 + i * .58 + (r % 2) * .29, .1 + r * .19, rr(-.03, .03)); m.rotation.y = rr(-.08, .08); m.castShadow = m.receiveShadow = true; g.add(m); }
  const c = Math.cos(rot), s = Math.sin(rot), hx = Math.abs(c) * len / 2 + Math.abs(s) * .25, hz = Math.abs(s) * len / 2 + Math.abs(c) * .25;
  addCol(x - hx, 0, z - hz, x + hx, rows * .19 + .1, z + hz);
  return g;
}
const lamps = [];
export function lamp(x, z, o = {}) {
  const m = prop('street_lamp_01', x, o.y || 0, z, { ry: o.ry || 0, s: o.s || 1.3, col: false });
  addCol(x - .15, 0, z - .15, x + .15, 4, z + .15);
  const h = 3.75 * (o.s || 1.3) + (o.y || 0);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: o.color || 0xffb36a, emissiveIntensity: 6 }));
  bulb.position.set(x, h - .25, z); G.scene.add(bulb);
  if (o.light !== false) { const l = new THREE.SpotLight(o.color || 0xffb36a, o.intensity || 160, 26, .95, .6, 1.6); l.position.set(x, h - .3, z); l.target.position.set(x, 0, z); G.scene.add(l, l.target); }
  return m;
}
export function building(x, z, w, h, d, o = {}) {
  const mat = o.mat || MAT.concrete;
  const b = box(x, 0, z, w, h, d, mat, { uv: 3 });
  box(x, h, z, w + .5, .3, d + .5, MAT.roof, { col: false });
  const n = Math.floor(w / 3.2);
  for (let i = 0; i < n; i++) for (const side of [1, -1]) {
    const wx = x - w / 2 + 1.6 + i * 3.2; const lit = rnd() < (o.lit ?? .6);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1), lit ? MAT.window : MAT.glass); win.position.set(wx, h * .55, z + side * (d / 2 + .02)); if (side < 0) win.rotation.y = Math.PI; G.scene.add(win);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.45, .08, .12), MAT.dark); sill.position.set(wx, h * .55 - .55, z + side * (d / 2 + .05)); G.scene.add(sill);
  }
  return b;
}
export function water(size, y = 0, color = 0x0b1a22) {
  const tex = new THREE.TextureLoader().load('assets/tex/waternormals.jpg', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const sunDir = G.sunDir ? G.sunDir.clone().normalize() : new V3(0, 1, 0);
  const w = new Water(new THREE.PlaneGeometry(size, size), { textureWidth: 512, textureHeight: 512, waterNormals: tex, sunDirection: sunDir, sunColor: 0x8899aa, waterColor: color, distortionScale: 2.2, fog: !!G.scene.fog });
  w.rotation.x = -Math.PI / 2; w.position.y = y; G.scene.add(w);
  G.updaters.push((dt) => { w.material.uniforms.time.value += dt * .6; });
  return w;
}
// Terrain avec relief (pour les montagnes) + fonction de hauteur
export function terrain(size, seg, heightFn, mat, rep, cx = 0, cz = 0) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, heightFn(p.getX(i) + cx, p.getZ(i) + cz));
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep, uv.getY(i) * rep);
  g.computeVertexNormals();
  // teinte selon la pente (sable sur le plat, roche dans les pentes) + variation à grande échelle
  const n = g.attributes.normal, col = new Float32Array(p.count * 3), rock = new THREE.Color(0x9c8a74), sand = new THREE.Color(0xe2cda6), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz, k = clamp((n.getY(i) - .82) / .14, 0, 1), v = .8 + .45 * fbm(x * .004 + 9, z * .004 + 4, 3);
    c.copy(rock).lerp(sand, k).multiplyScalar(v); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!mat.userData.terrain) { mat.userData.terrain = true; mat.vertexColors = true;
    mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `vec4 c1 = texture2D(map, vMapUv); vec4 c2 = texture2D(map, vMapUv * .137 + .31);
      diffuseColor *= vec4(mix(c1.rgb, c2.rgb, .45) * (.8 + .4 * c2.g), 1.);`); }; }
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.position.set(cx, 0, cz); G.scene.add(m);
  return m;
}
export function fbm(x, z, oct = 5) {
  const h = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
  const n2 = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    return lerp2(lerp2(h(xi, zi), h(xi + 1, zi), u), lerp2(h(xi, zi + 1), h(xi + 1, zi + 1), u), v); };
  let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += n2(x * f, z * f) * a; a *= .5; f *= 2.03; } return s;
}
const lerp2 = (a, b, t) => a + (b - a) * t;
