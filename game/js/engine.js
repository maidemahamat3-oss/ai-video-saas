// =====================================================================
// OPÉRATION ÉCLIPSE — moteur : rendu réaliste, post-traitement, effets,
// collisions, son, HUD, entrées, outils de mise en scène.
// =====================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export { THREE };
export const V3 = THREE.Vector3;
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const lerpAng = (a, b, t) => a + angDiff(a, b) * clamp(t, 0, 1);
export const easeInOut = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const $ = (id) => document.getElementById(id);

export const params = new URLSearchParams(location.search);
export const CAPTURE = params.has('capture');
export const IS_TOUCH = !CAPTURE && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
export const HQ = CAPTURE || params.has('hq') || !IS_TOUCH;

// Aléatoire déterministe (tournages vidéo reproductibles)
let SEED = 1;
export const reseed = (s) => { SEED = s >>> 0; };
export const rnd = () => { SEED = (SEED * 1664525 + 1013904223) >>> 0; return SEED / 4294967296; };
export const rr = (a, b) => a + (b - a) * rnd();

// ------------------------------------------------------------------ état
export const G = {
  scene: null, camera: null, vmScene: null, vmCamera: null, renderer: null,
  colliders: [], enemies: [], allies: [], props: [], updaters: [],
  mission: null, state: 'menu', demo: false, time: 0, t: 0, timeScale: 1,
  events: [], marks: {}, timers: [], droneOn: false, camOverride: null,
  ground: () => 0,
  input: { f: 0, s: 0, sprint: false, fire: false, ads: false, action: false, keys: {} },
};

// --------------------------------------------------------------- rendu
const canvas = $('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = CAPTURE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
G.renderer = renderer;

export const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 5000);
camera.rotation.order = 'YXZ';
export const vmScene = new THREE.Scene();
export const vmCamera = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
G.camera = camera; G.vmScene = vmScene; G.vmCamera = vmCamera;

const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: HQ ? 4 : 0 });
export const composer = new EffectComposer(renderer, rt);
G.composer = composer; G.rt = rt;
const passWorld = new RenderPass(new THREE.Scene(), camera);
const passVM = new RenderPass(vmScene, vmCamera); passVM.clear = false; passVM.clearDepth = true;
export const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.88);
G.bloom = bloom;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: .35 }, uGrain: { value: .045 }, uHurt: { value: 0 }, uFlash: { value: 0 }, uSat: { value: 1.08 }, uScope: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uHurt, uFlash, uSat, uScope; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 c = uv - .5;
      float ca = .0012 + uHurt * .004;
      vec3 col = vec3(texture2D(tDiffuse, uv + c*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c*ca).b);
      float l = dot(col, vec3(.2126,.7152,.0722)); col = mix(vec3(l), col, uSat);
      col = mix(col, col * vec3(1.03, 1., .96), .5);
      float v = smoothstep(.85, .2, length(c * vec2(1.25, 1.)));
      col *= mix(1. - uVig, 1., v);
      col = mix(col, col * vec3(1.4, .35, .3), uHurt * (1. - v) * .9);
      col += uFlash;
      col += (h(uv * 900. + uTime) - .5) * uGrain;
      gl_FragColor = vec4(col, 1.);
    }`,
};
export const grade = new ShaderPass(GradeShader);
composer.addPass(passWorld); composer.addPass(passVM); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grade);

export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  const a = w / h;
  camera.aspect = vmCamera.aspect = a;
  camera.userData.baseFov = a < 1 ? 82 : 68;
  vmCamera.fov = a < 1 ? 72 : 52;
  if (!G.fovLock) camera.fov = camera.userData.baseFov;
  camera.updateProjectionMatrix(); vmCamera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

export function newScene() {
  // libère l'ancienne scène
  if (G.scene) G.scene.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose?.(); });
  const scene = new THREE.Scene();
  G.scene = scene; passWorld.scene = scene;
  G.colliders = []; G.enemies = []; G.allies = []; G.props = []; G.updaters = [];
  G.ground = () => 0;
  scene.add(camera);
  initFX(scene);
  return scene;
}
export function render() {
  grade.uniforms.uTime.value = G.time % 100;
  passVM.enabled = !G.droneOn && !G.hideVM && (G.state === 'play' || G.state === 'demo');
  composer.render();
}

// Ciel HDRI + éclairage d'environnement
let pmrem = null;
export function setSky(tex, o = {}) {
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  const s = G.scene;
  s.background = tex; s.backgroundIntensity = o.bg ?? 1; s.backgroundRotation.y = o.rot ?? 0;
  pmrem = pmrem || new THREE.PMREMGenerator(renderer);
  s.environment = pmrem.fromEquirectangular(tex).texture;
  s.environmentIntensity = o.env ?? 1; s.environmentRotation.y = o.rot ?? 0;
  renderer.toneMappingExposure = o.exposure ?? 1;
  bloom.strength = o.bloom ?? .5;
}

// --------------------------------------------------------- matériaux
const texCache = {};
export function loadTex(url, srgb = true) {
  if (texCache[url]) return texCache[url];
  G.pending = (G.pending || 0) + 1;
  const t = new THREE.TextureLoader().load(url, () => { G.pending--; }, undefined, () => { G.pending--; });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[url] = t);
}
const matCache = {};
// Matériau PBR à partir d'un jeu de textures Poly Haven (couleur + relief + rugosité)
export function pbr(name, o = {}) {
  const key = name + JSON.stringify(o);
  if (matCache[key]) return matCache[key];
  const rep = o.repeat || 1;
  const prep = (t) => { const c = t.clone(); c.repeat.set(rep, rep); return c; };
  const m = new THREE.MeshStandardMaterial({
    map: prep(loadTex(`assets/tex/${name}_diff.jpg`)),
    normalMap: prep(loadTex(`assets/tex/${name}_nor.jpg`, false)),
    roughnessMap: prep(loadTex(`assets/tex/${name}_rough.jpg`, false)),
    color: o.color ?? 0xffffff, roughness: o.rough ?? 1, metalness: o.metal ?? 0,
  });
  m.normalScale.setScalar(o.normal ?? 1);
  return (matCache[key] = m);
}
// Boîte dont les UV suivent la taille réelle (1 répétition = `uvs` mètres)
export function boxGeo(w, h, d, uvs = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / uvs, uv.getY(k) * dims[f][1] / uvs); }
  return g;
}

// ---------------------------------------------------------- collisions
export const addCol = (x0, y0, z0, x1, y1, z1, tag) => { const c = { min: [x0, y0, z0], max: [x1, y1, z1], tag }; G.colliders.push(c); return c; };
export function box(x, y, z, w, h, d, mat, o = {}) {
  const m = new THREE.Mesh(boxGeo(w, h, d, o.uv || 2), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = o.cast !== false; m.receiveShadow = true;
  if (o.ry) m.rotation.y = o.ry;
  (o.parent || G.scene).add(m);
  if (o.col !== false) m.userData.col = addCol(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, o.tag);
  return m;
}
export function collide(p, r, h) {
  for (let it = 0; it < 2; it++) for (const c of G.colliders) {
    if (c.off || p.y + h < c.min[1] || p.y > c.max[1] - .4) continue;
    const cx = clamp(p.x, c.min[0], c.max[0]), cz = clamp(p.z, c.min[2], c.max[2]);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else { const l = p.x - c.min[0], ri = c.max[0] - p.x, f = p.z - c.min[2], b = c.max[2] - p.z, m = Math.min(l, ri, f, b); if (m === l) p.x = c.min[0] - r; else if (m === ri) p.x = c.max[0] + r; else if (m === f) p.z = c.min[2] - r; else p.z = c.max[2] + r; }
    }
  }
}
export function rayAABB(o, d, mn, mx, tmax) {
  let t0 = 0, t1 = tmax, ax = -1;
  for (let a = 0; a < 3; a++) {
    const oa = a === 0 ? o.x : a === 1 ? o.y : o.z, da = a === 0 ? d.x : a === 1 ? d.y : d.z;
    if (Math.abs(da) < 1e-9) { if (oa < mn[a] || oa > mx[a]) return null; continue; }
    let tn = (mn[a] - oa) / da, tf = (mx[a] - oa) / da; if (tn > tf) { const t = tn; tn = tf; tf = t; }
    if (tn > t0) { t0 = tn; ax = a; } if (tf < t1) t1 = tf; if (t0 > t1) return null;
  }
  return { t: t0, ax };
}
export function rayBoxes(o, d, tmax) {
  let best = null;
  for (const c of G.colliders) { if (c.off || c.noRay) continue; const h = rayAABB(o, d, c.min, c.max, best ? best.t : tmax); if (h && h.t > .001) best = { ...h, c }; }
  // sol / terrain (marche)
  if (d.y < 0) {
    const g0 = G.ground(o.x, o.z); if (o.y > g0) {
      let tPrev = 0; const step = Math.max(1, (best ? best.t : tmax) / 120);
      for (let t = step; t <= (best ? best.t : tmax); t += step) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        if (y <= G.ground(x, z)) { let a = tPrev, b = t; for (let k = 0; k < 8; k++) { const m = (a + b) / 2; if (o.y + d.y * m <= G.ground(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; } best = { t: b, ax: 1 }; break; }
        tPrev = t;
      }
    }
  }
  return best;
}
// Tir : murs + ennemis (corps et tête)
export function rayWorld(o, d, tmax, withActors = true) {
  const b = rayBoxes(o, d, tmax);
  let res = b ? { c: b.c, t: b.t, normal: new V3(b.ax === 0 ? -Math.sign(d.x) : 0, b.ax === 1 ? -Math.sign(d.y) || 1 : 0, b.ax === 2 ? -Math.sign(d.z) : 0) } : null;
  if (withActors) for (const e of [...G.enemies, ...G.allies]) {
    if (e.dead || e.hidden || !e.hitTest) continue;
    const h = e.hitTest(o, d, res ? res.t : tmax);
    if (h && (!res || h.t < res.t)) res = { t: h.t, actor: e, head: h.head, normal: d.clone().negate() };
  }
  if (res) res.point = o.clone().addScaledVector(d, res.t);
  return res;
}
export function lineOfSight(a, b) { const d = new V3().subVectors(b, a); const L = d.length(); d.normalize(); return !rayBoxes(a, d, L - .3); }

// ------------------------------------------------------------- effets
// Fumée/feu réalistes : billboards instanciés avec une texture de bruit fBm générée
function puffAtlas() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S * 2; const g = c.getContext('2d');
  const img = g.createImageData(S * 2, S * 2);
  const hash = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
  const noise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), cc = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v; };
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * S, oy = Math.floor(v / 2) * S;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nx = x / S - .5, ny = y / S - .5; const r = Math.sqrt(nx * nx + ny * ny) * 2;
      let n = 0, amp = .5, f = 3; for (let o = 0; o < 5; o++) { n += noise(nx * f + 10, ny * f + 10, v * 7 + o) * amp; amp *= .5; f *= 2; }
      const a = Math.max(0, Math.min(1, (1 - r * (1.05 + (1 - n) * .55)) * 1.6)) * (.55 + n * .7);
      const i = ((oy + y) * S * 2 + ox + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, 140 + n * 160); img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let ATLAS = null;
class Particles {
  constructor(scene, max, additive) {
    this.max = max; this.list = [];
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iCol', this.aCol); g.setAttribute('iRot', this.aRot);
    g.instanceCount = 0; this.g = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: ATLAS }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec4 iPos; attribute vec4 iCol; attribute vec2 iRot; varying vec2 vUv; varying vec4 vCol; varying float vDist;
        void main(){ vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.); float c = cos(iRot.x), s = sin(iRot.x);
          vec2 q = position.xy * iPos.w; mv.xy += vec2(c*q.x - s*q.y, s*q.x + c*q.y); vDist = -mv.z;
          gl_Position = projectionMatrix * mv; float v = iRot.y; vUv = (uv + vec2(mod(v, 2.), floor(v / 2.))) * .5; vCol = iCol; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogColor; uniform float fogDensity; varying vec2 vUv; varying vec4 vCol; varying float vDist;
        void main(){ vec4 t = texture2D(map, vUv); float f = 1. - exp(-pow(fogDensity * vDist, 2.));
          vec3 col = vCol.rgb * t.rgb; ${additive ? 'col *= (1.-f); gl_FragColor = vec4(col * t.a * vCol.a, 1.);' : 'col = mix(col, fogColor, f); gl_FragColor = vec4(col, t.a * vCol.a);'} }`,
    });
    if (additive) { mat.blending = THREE.CustomBlending; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneFactor; }
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2;
    scene.add(this.mesh);
  }
  spawn(o) {
    if (this.list.length >= this.max) this.list.shift();
    const p = { p: o.p.clone(), v: o.v ? o.v.clone() : new V3(), life: o.life, max: o.life, s0: o.s0, s1: o.s1 ?? o.s0 * 2.5,
      c0: new THREE.Color(o.c0 ?? 0xffffff), c1: new THREE.Color(o.c1 ?? o.c0 ?? 0xffffff), a: o.a ?? 1, rot: rnd() * TAU, rv: rr(-.6, .6) * (o.spin ?? 1),
      drag: o.drag ?? 1, g: o.g ?? 0, var: (rnd() * 4) | 0, fadeIn: o.fadeIn ?? .08 };
    this.list.push(p); return p;
  }
  update(dt) {
    const fog = G.scene.fog; this.mesh.material.uniforms.fogDensity.value = fog ? fog.density : 0; if (fog) this.mesh.material.uniforms.fogColor.value.copy(fog.color);
    let n = 0; const P = this.aPos.array, C = this.aCol.array, R = this.aRot.array; const col = new THREE.Color();
    for (let i = this.list.length - 1; i >= 0; i--) { const p = this.list[i]; p.life -= dt; if (p.life <= 0) this.list.splice(i, 1); }
    // tri arrière → avant pour la fumée
    const cp = camera.position; this.list.sort((a, b) => b.p.distanceToSquared(cp) - a.p.distanceToSquared(cp));
    for (const p of this.list) {
      const u = 1 - p.life / p.max;
      p.v.multiplyScalar(Math.exp(-p.drag * dt)); p.v.y += p.g * dt; p.p.addScaledVector(p.v, dt); p.rot += p.rv * dt;
      const s = lerp(p.s0, p.s1, 1 - Math.pow(1 - u, 2.2));
      col.copy(p.c0).lerp(p.c1, Math.min(1, u * 1.6));
      const a = p.a * Math.min(1, u / p.fadeIn) * (1 - u) * (1 - u * .3);
      P[n * 4] = p.p.x; P[n * 4 + 1] = p.p.y; P[n * 4 + 2] = p.p.z; P[n * 4 + 3] = s;
      C[n * 4] = col.r; C[n * 4 + 1] = col.g; C[n * 4 + 2] = col.b; C[n * 4 + 3] = a;
      R[n * 2] = p.rot; R[n * 2 + 1] = p.var; n++;
    }
    this.g.instanceCount = n; this.aPos.needsUpdate = this.aCol.needsUpdate = this.aRot.needsUpdate = true;
  }
}
export const FX = {};
function initFX(scene) {
  ATLAS = ATLAS || puffAtlas();
  FX.smoke = new Particles(scene, 600, false);
  FX.fire = new Particles(scene, 400, true);
  // étincelles (allongées dans le sens de la vitesse)
  FX.sparks = [];
  const sg = new THREE.BoxGeometry(.012, .012, 1); sg.translate(0, 0, -.5);
  for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; scene.add(m); FX.sparks.push({ m, v: new V3(), life: 0 }); }
  FX.sparkI = 0;
  FX.tracers = [];
  const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0, .5);
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; scene.add(m); FX.tracers.push({ m, life: 0 }); }
  FX.tracerI = 0;
  FX.debris = [];
  FX.decals = []; FX.decalI = 0;
  const dTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(10,8,6,1)'); gr.addColorStop(.25, 'rgba(25,22,18,.95)'); gr.addColorStop(.5, 'rgba(60,55,48,.5)'); gr.addColorStop(1, 'rgba(60,55,48,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const dm = new THREE.MeshStandardMaterial({ map: dTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 });
  for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.11, .11), dm); m.visible = false; scene.add(m); FX.decals.push(m); }
  FX.lights = [];
  for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffa050, 0, 16, 2); scene.add(l); FX.lights.push({ l, life: 0, max: 1, i0: 0 }); }
  FX.rings = [];
  FX.burners = [];
}
export function flashLight(p, intensity, life, dist = 16, color = 0xffa050) {
  const L = FX.lights.reduce((a, b) => (a.life < b.life ? a : b));
  L.l.position.copy(p); L.l.color.set(color); L.l.distance = dist; L.i0 = intensity; L.life = L.max = life;
}
export function spark(p, dir, n = 8, speed = 7, color = 0xffc070) {
  for (let i = 0; i < n; i++) { const s = FX.sparks[FX.sparkI++ % FX.sparks.length]; s.m.visible = true; s.m.position.copy(p); s.m.material.color.set(color);
    s.v.set(dir.x + rr(-.8, .8), dir.y + rr(-.3, 1), dir.z + rr(-.8, .8)).normalize().multiplyScalar(speed * rr(.35, 1)); s.life = rr(.12, .4); }
}
export function tracer(a, b, color = 0xffd8a0, w = .018, life = .06) {
  const t = FX.tracers[FX.tracerI++ % FX.tracers.length]; t.m.visible = true; t.m.position.copy(a); t.m.lookAt(b);
  t.m.scale.set(w, w, a.distanceTo(b)); t.m.material.color.set(color); t.m.material.opacity = 1; t.life = t.max = life;
}
export function decal(p, n) {
  const m = FX.decals[FX.decalI++ % FX.decals.length]; m.visible = true; m.position.copy(p).addScaledVector(n, .01);
  m.lookAt(p.clone().add(n)); m.rotateZ(rnd() * TAU); m.scale.setScalar(rr(.7, 1.3));
}
export function impact(p, n, kind = 'concrete') {
  decal(p, n);
  spark(p, n, kind === 'metal' ? 10 : 5, 6, kind === 'metal' ? 0xffd090 : 0xffb070);
  for (let i = 0; i < 3; i++) FX.smoke.spawn({ p: p.clone().addScaledVector(n, .05), v: n.clone().multiplyScalar(rr(.5, 1.6)).add(new V3(rr(-.3, .3), rr(0, .4), rr(-.3, .3))), life: rr(.5, 1), s0: .12, s1: rr(.6, .9), c0: kind === 'metal' ? 0x9a9a98 : 0xa89c88, a: .55, drag: 2.5 });
}
export function bloodHit(p, dir) {
  for (let i = 0; i < 4; i++) FX.smoke.spawn({ p: p.clone(), v: dir.clone().multiplyScalar(rr(.6, 1.6)).add(new V3(rr(-.4, .4), rr(-.2, .5), rr(-.4, .4))), life: rr(.25, .5), s0: .1, s1: rr(.35, .55), c0: 0x5a0b0b, c1: 0x3a0606, a: .85, drag: 3, g: -2 });
}
export function muzzleFX(p, dir, scale = 1) {
  FX.fire.spawn({ p: p.clone().addScaledVector(dir, .08 * scale), life: .05, s0: .35 * scale, s1: .5 * scale, c0: 0xffd28a, c1: 0xff8a30, a: 1.4, fadeIn: .01 });
  FX.smoke.spawn({ p: p.clone(), v: dir.clone().multiplyScalar(1.2).add(new V3(0, .3, 0)), life: .7, s0: .08 * scale, s1: .5 * scale, c0: 0xb8b4ac, a: .18, drag: 2 });
  flashLight(p, 22 * scale, .05, 10);
}
export function explosion(p, size = 1, o = {}) {
  sfx('explosion', { size });
  flashLight(p.clone().setY(p.y + 2 * size), 9000 * size, 1.2, 90 * size, 0xff8a3a);
  G.flash = Math.max(G.flash || 0, .35 * clamp(1 - camera.position.distanceTo(p) / (80 * size), 0, 1));
  for (let i = 0; i < 70 * size; i++) {
    const d = new V3(rr(-1, 1), rr(-.15, 1.2), rr(-1, 1)).normalize();
    FX.fire.spawn({ p: p.clone().addScaledVector(d, rr(0, 1.5) * size), v: d.multiplyScalar(rr(4, 14) * size), life: rr(.5, 1.3), s0: rr(1.5, 3) * size, s1: rr(5, 9) * size, c0: i % 4 ? 0xffb35a : 0xfff0c0, c1: 0x8a1a04, a: 1.3, drag: 3.2, g: 2 });
  }
  for (let i = 0; i < 50 * size; i++) {
    const d = new V3(rr(-1, 1), rr(.1, 1.3), rr(-1, 1)).normalize();
    FX.smoke.spawn({ p: p.clone().addScaledVector(d, rr(.5, 2.5) * size), v: d.multiplyScalar(rr(2, 9) * size), life: rr(3.5, 8), s0: rr(2, 4) * size, s1: rr(10, 18) * size, c0: 0x2a2624, c1: 0x5a5550, a: .9, drag: .9, g: .6, fadeIn: .15 });
  }
  for (let i = 0; i < 30 * size; i++) { // poussière au sol
    const a = rr(0, TAU); FX.smoke.spawn({ p: new V3(p.x + Math.cos(a) * 2, G.ground(p.x, p.z) + .5, p.z + Math.sin(a) * 2), v: new V3(Math.cos(a), .05, Math.sin(a)).multiplyScalar(rr(8, 16) * size), life: rr(2, 4), s0: 2 * size, s1: 8 * size, c0: 0x8a7a64, a: .55, drag: 1.4 });
  }
  spark(p, new V3(0, 1, 0), 80, 22 * size, 0xffc060);
  // anneau de choc
  const ring = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.copy(p).setY(G.ground(p.x, p.z) + .3); G.scene.add(ring); FX.rings.push({ m: ring, t: 0, size });
  // débris
  const dm = o.debrisMat || new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: .9 });
  for (let i = 0; i < 26 * size; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(rr(.08, .35) * size, 0), dm); m.position.copy(p); m.castShadow = true; G.scene.add(m);
    FX.debris.push({ m, v: new V3(rr(-14, 14), rr(6, 22), rr(-14, 14)).multiplyScalar(size), s: new V3(rr(-9, 9), rr(-9, 9), rr(-9, 9)), life: 7 });
    if (rnd() < .4) FX.burners.push({ p: m.position, t: 0, life: 2.5, small: true, follow: m });
  }
  G.shake = Math.min(1.2, (G.shake || 0) + clamp(1.4 - camera.position.distanceTo(p) / (60 * size), .15, 1.2));
  if (o.burn !== false) FX.burners.push({ p: p.clone(), t: 0, life: o.burnLife ?? 1e9, size });
}
export function updateFX(dt) {
  FX.smoke.update(dt); FX.fire.update(dt);
  for (const s of FX.sparks) { if (s.life <= 0) continue; s.life -= dt; s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt); s.m.lookAt(s.m.position.clone().add(s.v)); s.m.scale.set(1, 1, Math.min(.5, s.v.length() * .025)); s.m.material.opacity = Math.min(1, s.life * 4); if (s.life <= 0) s.m.visible = false; }
  for (const t of FX.tracers) { if (t.life <= 0) continue; t.life -= dt; t.m.material.opacity = t.life / t.max; if (t.life <= 0) t.m.visible = false; }
  for (const L of FX.lights) { if (L.life <= 0) { L.l.intensity = 0; continue; } L.life -= dt; L.l.intensity = L.i0 * Math.max(0, L.life / L.max) ** 1.5; }
  for (let i = FX.debris.length - 1; i >= 0; i--) { const d = FX.debris[i]; d.life -= dt; d.v.y -= 20 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.s.x * dt; d.m.rotation.y += d.s.y * dt;
    const gy = G.ground(d.m.position.x, d.m.position.z) + .1; if (d.m.position.y < gy) { d.m.position.y = gy; d.v.multiplyScalar(.35); d.v.y *= -.3; d.s.multiplyScalar(.5); }
    if (d.life <= 0) { G.scene.remove(d.m); FX.debris.splice(i, 1); } }
  for (let i = FX.rings.length - 1; i >= 0; i--) { const r = FX.rings[i]; r.t += dt; const s = 1 + r.t * 70 * r.size; r.m.scale.setScalar(s); r.m.material.opacity = Math.max(0, .5 - r.t * 1.1); if (r.t > .5) { G.scene.remove(r.m); FX.rings.splice(i, 1); } }
  for (let i = FX.burners.length - 1; i >= 0; i--) {
    const b = FX.burners[i]; b.t += dt; if (b.t > b.life) { FX.burners.splice(i, 1); continue; }
    const p = b.follow ? b.follow.position : b.p, k = b.small ? .25 : (b.size || 1);
    if (rnd() < dt * (b.small ? 14 : 30)) FX.fire.spawn({ p: p.clone().add(new V3(rr(-1.2, 1.2) * k, rr(0, .6) * k, rr(-1.2, 1.2) * k)), v: new V3(rr(-.3, .3), rr(1.5, 3.5), rr(-.3, .3)), life: rr(.5, 1.1), s0: rr(.6, 1.4) * k, s1: rr(1.5, 3) * k, c0: 0xffb050, c1: 0x7a1800, a: 1, drag: .6 });
    if (rnd() < dt * (b.small ? 6 : 10)) FX.smoke.spawn({ p: p.clone().add(new V3(0, 1.5 * k, 0)), v: new V3(rr(-.5, .5), rr(1.5, 3), rr(-.5, .5)), life: rr(4, 7), s0: 1.5 * k, s1: 9 * k, c0: 0x1c1a19, c1: 0x3a3836, a: .55, drag: .15, fadeIn: .2 });
  }
}

// ---------------------------------------------------------------- audio
export const EVENTS = G.events;
let AC = null, master = null, noiseBuf = null; const loops = {};
export function initAudio() {
  if (AC || CAPTURE) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .55;
    const comp = AC.createDynamicsCompressor(); master.connect(comp); comp.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function noise(t, dur, f0, f1, g0, type = 'lowpass', q = .7) {
  const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}
function tone(t, dur, f0, f1, g0, type = 'sine') {
  const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
function loop(name, on, build) {
  if (on && !loops[name] && AC) loops[name] = build();
  if (!on && loops[name]) { try { loops[name].stop(); } catch (e) { } delete loops[name]; }
}
export function sfx(type, o = {}) {
  G.events.push({ t: +G.t.toFixed(3), type, ...o });
  if (!AC) return; const t = AC.currentTime;
  switch (type) {
    case 'shot': noise(t, .16, 5000, 400, .9); tone(t, .12, 140, 45, .8, 'triangle'); noise(t + .02, .45, 1200, 200, .2); break;
    case 'sniper': noise(t, .3, 4000, 200, 1.2); tone(t, .3, 90, 30, 1, 'triangle'); noise(t + .05, 1.6, 900, 120, .35); break;
    case 'enemyShot': { const v = clamp(1 - (o.d || 30) / 80, .08, 1) * .45; noise(t, .14, 2600, 300, v); tone(t, .1, 110, 40, v * .7, 'triangle'); break; }
    case 'knife': noise(t, .22, 900, 5000, .25, 'bandpass', 2); break;
    case 'stab': noise(t, .1, 600, 200, .4); tone(t, .08, 90, 50, .4); break;
    case 'hit': tone(t, .05, 1800, 1500, .1, 'square'); break;
    case 'kill': tone(t, .09, 900, 600, .12, 'square'); break;
    case 'reload': noise(t, .05, 3000, 2000, .3, 'highpass'); noise(t + .9, .05, 2500, 1800, .3, 'highpass'); noise(t + 1.5, .06, 3500, 2500, .35, 'highpass'); break;
    case 'bolt': noise(t, .06, 2500, 1500, .35, 'highpass'); noise(t + .35, .07, 3000, 2000, .35, 'highpass'); break;
    case 'beep': tone(t, .09, 1400, 1400, .2, 'square'); break;
    case 'plant': tone(t, .15, 600, 900, .2, 'square'); break;
    case 'ding': tone(t, .8, 1320, 1320, .18); tone(t + .25, 1, 990, 990, .15); break;
    case 'explosion': noise(t, 2.5, 3000, 60, 1.2); tone(t, 1.4, 70, 25, 1, 'sine'); noise(t + .1, 3.5, 600, 80, .4); break;
    case 'crash': noise(t, .5, 2500, 300, 1); noise(t, .9, 6000, 2000, .3, 'highpass'); tone(t, .3, 80, 40, .8); break;
    case 'glass': noise(t, .6, 9000, 5000, .4, 'highpass'); break;
    case 'hurt': noise(t, .12, 800, 200, .4); break;
    case 'alarm': loop('alarm', true, () => { const o2 = AC.createOscillator(); o2.type = 'sawtooth'; const lfo = AC.createOscillator(); lfo.frequency.value = .6; const lg = AC.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(o2.frequency); o2.frequency.value = 620; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; const g = AC.createGain(); g.gain.value = .04; o2.connect(f); f.connect(g); g.connect(master); o2.start(); lfo.start(); return { stop() { o2.stop(); lfo.stop(); } }; }); break;
  }
}
export function stopLoops() { for (const k of Object.keys(loops)) loop(k, false); }

// ------------------------------------------------------------------ HUD
export const hud = {};
['objText', 'timer', 'mag', 'res', 'wname', 'hpBar', 'cross', 'hitmark', 'stamp', 'prompt', 'promptText', 'marker', 'markerDist', 'alarm', 'radio', 'radioText', 'radioWho', 'feed', 'floor', 'scope', 'scopeInfo', 'letterbox', 'caption', 'fade'].forEach(k => hud[k] = $(k));
hud.promptBar = document.querySelector('#promptBar b');
const cache = {};
export const setText = (el, k, v) => { if (el && cache[k] !== v) { cache[k] = v; el.textContent = v; } };
let stampT = 0, radioT = 0, hitT = 0;
export function stamp(text, hot) { G.events.push({ t: +G.t.toFixed(3), type: 'stamp', text, hot: !!hot }); hud.stamp.textContent = text; hud.stamp.classList.toggle('hot', !!hot); stampT = 1.7; }
export function radio(text, who = 'QG', dur = 5) { G.events.push({ t: +G.t.toFixed(3), type: 'radio', text, who, dur }); hud.radioWho.textContent = who; hud.radioText.textContent = text; hud.radio.hidden = false; radioT = dur; }
export function feed(html) { const d = document.createElement('div'); d.innerHTML = html; hud.feed.prepend(d); later(3.5, () => d.remove()); while (hud.feed.children.length > 4) hud.feed.lastChild.remove(); }
export function hitmark(kill) { hud.hitmark.classList.toggle('kill', !!kill); hitT = .22; sfx(kill ? 'kill' : 'hit'); }
export function updateHudFx(dt) {
  hitT -= dt; hud.hitmark.style.opacity = Math.max(0, hitT / .22);
  stampT -= dt; hud.stamp.style.opacity = clamp(stampT * 2, 0, 1); hud.stamp.style.transform = `translateX(-50%) scale(${1 + Math.max(0, stampT - 1.5) * 1.5})`;
  radioT -= dt; if (radioT <= 0) hud.radio.hidden = true;
}

// --------------------------------------------------------- minuterie
export const later = (s, fn) => G.timers.push({ t: G.time + s, fn });
export function runTimers() { for (let i = G.timers.length - 1; i >= 0; i--) if (G.timers[i].t <= G.time) { const f = G.timers[i].fn; G.timers.splice(i, 1); f(); } }
export const mark = (k) => { G.marks[k] = +G.t.toFixed(3); };
// Titres façon film et fondus (démos filmées)
export function caption(k, t, p, dur = 4) { G.events.push({ t: +G.t.toFixed(3), type: 'caption', k, title: t, p: p || '', dur }); $('capK').textContent = k; $('capT').textContent = t; $('capP').textContent = p || ''; $('caption').classList.add('on'); later(dur, () => $('caption').classList.remove('on')); }
export function fade(on) { $('fade').classList.toggle('on', on); }
export function cine(on) { document.body.classList.toggle('cine', on); }

// Barils et citernes qui explosent quand on tire dessus
export function detonate(c) {
  if (!c || c.off) return; c.off = true; if (c.mesh) c.mesh.visible = false;
  const p = new V3((c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2);
  explosion(p, .7, { burnLife: 12 });
  for (const e of [...G.enemies, ...G.allies]) if (!e.dead && e.pos.distanceTo(p) < 6.5 && e.kind !== 'ally') { e.damage(999, false, e.pos.clone().sub(p).normalize()); if (G.onBlastKill) G.onBlastKill(e); }
  if (G.player && G.player.pos.distanceTo(p) < 5 && G.hurtPlayer) G.hurtPlayer(45, p);
  for (const o of G.colliders) if (o.tag === 'explosive' && !o.off) { const q = new V3((o.min[0] + o.max[0]) / 2, (o.min[1] + o.max[1]) / 2, (o.min[2] + o.max[2]) / 2); if (q.distanceTo(p) < 4) later(.15 + rnd() * .2, () => detonate(o)); }
}
