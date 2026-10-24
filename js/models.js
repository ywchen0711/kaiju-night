// The two giants as 3D models. The kaiju is one continuous skinned body (lofted along its bones) with craggy skin and three
// rows of glowing dorsal plates; the robot is a jaeger built from hundreds of chamfered armour plates over a mechanical frame.
// Every texture is painted procedurally on canvases (colour, normal, roughness, metalness).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const qd = (dir) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
const sstep = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function cnv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, srgb, rx = 1, ry = rx) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
// a tangent-space normal map from a height map (red channel)
function normalFromHeight(hc, strength = 3) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data, out = cnv(w, h), g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const H = (x, y) => src[((((y + h) % h) * w) + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return out;
}
// tileable cellular noise: distance to the nearest and second-nearest seed, and the nearest seed's random value
function voronoi(N, G) {
  const cs = N / G, pts = [];
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) pts.push([(gx + 0.1 + 0.8 * Math.random()) * cs, (gy + 0.1 + 0.8 * Math.random()) * cs, Math.random()]);
  const F1 = new Float32Array(N * N), F2 = new Float32Array(N * N), id = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gx = Math.floor(x / cs), gy = Math.floor(y / cs); let f1 = 1e9, f2 = 1e9, v = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = (gx + ox + G) % G, cy = (gy + oy + G) % G, p = pts[cy * G + cx];
      const px = p[0] + (gx + ox - cx) * cs, py = p[1] + (gy + oy - cy) * cs, d = Math.hypot(px - x, (py - y) * 1.25);
      if (d < f1) { f2 = f1; f1 = d; v = p[2]; } else if (d < f2) f2 = d;
    }
    const i = y * N + x; F1[i] = f1 / cs; F2[i] = f2 / cs; id[i] = v;
  }
  return { F1, F2, id };
}

// ------------------------------------------------------------------ kaiju skin: craggy, bark-like plates of hide split by deep cracks
let KSKIN = null;
function kaijuSkin() {
  if (KSKIN) return KSKIN;
  const N = 512, A = voronoi(N, 9), B = voronoi(N, 30);
  const hc = cnv(N), cc = cnv(N), rc = cnv(N), hg = hc.getContext('2d'), cg = cc.getContext('2d'), rg = rc.getContext('2d');
  const hi = hg.createImageData(N, N), ci = cg.createImageData(N, N), ri = rg.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const e1 = sstep((A.F2[i] - A.F1[i]) / 0.16), d1 = 1 - Math.min(1, A.F1[i] / 0.8), e2 = sstep((B.F2[i] - B.F1[i]) / 0.22), d2 = 1 - Math.min(1, B.F1[i] / 0.75);
    const grain = Math.random();
    const h = 0.42 * e1 * (0.55 + 0.45 * d1) + 0.38 * e2 * (0.4 + 0.6 * d2) + 0.06 * grain + 0.1 * A.id[i];
    const crack = e1 * (0.35 + 0.65 * e2);
    const tone = 18 + A.id[i] * 14 + d2 * 16 + grain * 6;
    const r = tone * 0.92 * crack + 5, g = tone * 0.97 * crack + 6, b = tone * 0.9 * crack + 6;
    const o = i * 4;
    hi.data[o] = hi.data[o + 1] = hi.data[o + 2] = h * 255; hi.data[o + 3] = 255;
    ci.data[o] = r; ci.data[o + 1] = g; ci.data[o + 2] = b; ci.data[o + 3] = 255;
    ri.data[o] = ri.data[o + 1] = ri.data[o + 2] = (0.9 - 0.42 * crack * (0.5 + 0.5 * d2)) * 255; ri.data[o + 3] = 255;
  }
  hg.putImageData(hi, 0, 0); cg.putImageData(ci, 0, 0); rg.putImageData(ri, 0, 0);
  KSKIN = { map: tex(cc, true), normal: tex(normalFromHeight(hc, 4.5), false), rough: tex(rc, false) };
  return KSKIN;
}
function kaijuMats() {
  const S = kaijuSkin();
  const glowC = cnv(128, 256), g = glowC.getContext('2d');
  // dorsal plate glow: dark at the root, burning blue toward the jagged tips, with cracks of light
  const grd = g.createLinearGradient(0, 256, 0, 0); grd.addColorStop(0, '#000'); grd.addColorStop(0.55, '#020608'); grd.addColorStop(0.88, '#2a7090'); grd.addColorStop(1, '#a8e8ff');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = 'rgba(140,230,255,.7)'; for (let i = 0; i < 18; i++) { g.lineWidth = rnd(0.5, 2); g.beginPath(); let x = rnd(10, 118), y = rnd(30, 200); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd(-12, 12); y -= rnd(8, 20); g.lineTo(x, y); } g.stroke(); }
  const glowMap = tex(glowC, true);
  const skin = new THREE.MeshPhysicalMaterial({ map: S.map, normalMap: S.normal, normalScale: new THREE.Vector2(2.4, 2.4), roughnessMap: S.rough, roughness: 1, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.45, envMapIntensity: 0.8, color: 0xffffff });
  const plate = () => new THREE.MeshPhysicalMaterial({ color: 0x2b2a28, normalMap: S.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.42, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.3, emissive: 0x4ad8ff, emissiveMap: glowMap, emissiveIntensity: 1.4 });
  return {
    skin, plate,
    tooth: new THREE.MeshStandardMaterial({ color: 0xb8ae96, roughness: 0.35 }),
    claw: new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.35, metalness: 0.1 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x2a0a0e, emissive: 0x3ad8ff, emissiveIntensity: 0, roughness: 0.5 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x1a0800, emissive: 0xffa040, emissiveIntensity: 1.6, roughness: 0.2 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 }),
    // the belly: paler, smoother scutes
    belly: new THREE.MeshPhysicalMaterial({ map: S.map, normalMap: S.normal, normalScale: new THREE.Vector2(1.1, 1.1), roughnessMap: S.rough, roughness: 0.9, color: 0x8a8476, clearcoat: 0.4, clearcoatRoughness: 0.45 }),
    // old wounds and gill slits that glow with the same light as the plates (brighter as it gets hurt)
    scar: new THREE.MeshStandardMaterial({ color: 0x06141a, emissive: 0x3ad8ff, emissiveIntensity: 0.4, roughness: 0.5 }),
    flesh: new THREE.MeshStandardMaterial({ color: 0x4a1418, roughness: 0.4 }),
  };
}

// ------------------------------------------------------------------ loft: a tube swept along a chain of points, with smooth radii
function crs(a, b, c, d, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); }
// nodes: [{ p, rx, ry, belly?, ridge?, bone? }] - a node's bone owns the stretch from it to the next node
function loft(nodes, o = {}) {
  const seg = o.seg || 28, step = o.step || 2.2, tile = o.tile || 12, K = o.uRep || 6, up = o.up || V(0, 1, 0), L = nodes.length;
  const curve = new THREE.CatmullRomCurve3(nodes.map((n) => n.p), false, 'centripetal');
  const samples = [];
  for (let i = 0; i < L - 1; i++) { const m = Math.max(2, Math.ceil(nodes[i].p.distanceTo(nodes[i + 1].p) / step)); for (let k = 0; k < m; k++) samples.push([i, k / m]); }
  samples.push([L - 2, 1]);
  const val = (key, i, f, def) => { const g = (x) => { const n = nodes[Math.max(0, Math.min(L - 1, x))]; return n[key] ?? def; }; return crs(g(i - 1), g(i), g(i + 1), g(i + 2), f); };
  const rings = []; let N = null, prevT = null, prevP = null, s = 0;
  for (const [i, f] of samples) {
    const t = (i + f) / (L - 1), P = curve.getPoint(t), T = curve.getTangent(t).normalize();
    if (!N) N = up.clone().addScaledVector(T, -up.dot(T)).normalize();
    else { const ax = V().crossVectors(prevT, T), sn = ax.length(); if (sn > 1e-6) N.applyAxisAngle(ax.divideScalar(sn), Math.atan2(sn, prevT.dot(T))); N.addScaledVector(T, -N.dot(T)).normalize(); }
    const B = V().crossVectors(T, N).normalize();
    if (prevP) s += P.distanceTo(prevP);
    rings.push({ P, T, N: N.clone(), B, rx: Math.max(0.05, val('rx', i, f)), ry: Math.max(0.05, val('ry', i, f)), belly: val('belly', i, f, o.belly ?? 0.9), ridge: val('ridge', i, f, o.ridge ?? 0), i, f, s, bone: nodes[i].bone });
    prevT = T; prevP = P;
  }
  const nv = rings.length * (seg + 1), pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const si = o.bones ? new Uint16Array(nv * 4) : null, sw = o.bones ? new Float32Array(nv * 4) : null;
  const tmp = V(), off = V(); let vi = 0;
  for (const r of rings) {
    let w = null;
    if (o.bones) {
      const own = nodes[r.i].bone, prev = r.i > 0 ? nodes[r.i - 1].bone : own, next = r.i + 1 < L - 1 ? nodes[r.i + 1].bone : own;
      let b = own, wb = 0;
      if (r.f < 0.3 && prev !== own) { b = prev; wb = 0.5 * (1 - r.f / 0.3); } else if (r.f > 0.7 && next !== own) { b = next; wb = 0.5 * ((r.f - 0.7) / 0.3); }
      w = [o.bones[own], o.bones[b], 1 - wb, wb];
    }
    for (let jj = 0; jj <= seg; jj++) {
      const a = jj / seg * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const ridge = 1 + r.ridge * Math.exp(-Math.pow(a - Math.PI / 2, 2) / 0.05);
      off.copy(r.B).multiplyScalar(c * r.rx).addScaledVector(r.N, sn * r.ry * (sn < 0 ? r.belly : 1) * ridge);
      tmp.copy(r.P).add(off);
      if (o.noise) { const n = Math.sin(tmp.x * 0.31 + tmp.y * 0.17) * Math.sin(tmp.y * 0.27 - tmp.z * 0.23) * Math.sin(tmp.z * 0.29 + tmp.x * 0.13) + 0.4 * Math.sin(tmp.x * 0.9 + tmp.z * 0.7) * Math.sin(tmp.y * 0.8); tmp.addScaledVector(off, o.noise * n); }
      pos[vi * 3] = tmp.x; pos[vi * 3 + 1] = tmp.y; pos[vi * 3 + 2] = tmp.z; uv[vi * 2] = jj / seg * K; uv[vi * 2 + 1] = r.s / tile;
      if (w) { si[vi * 4] = w[0]; si[vi * 4 + 1] = w[1]; sw[vi * 4] = w[2]; sw[vi * 4 + 1] = w[3]; }
      vi++;
    }
  }
  const idx = [];
  for (let k = 0; k < rings.length - 1; k++) for (let jj = 0; jj < seg; jj++) { const a = k * (seg + 1) + jj, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (si) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); }
  g.setIndex(idx); g.computeVertexNormals();
  // make sure the faces point outward
  const mid = Math.floor(rings.length / 2), v0 = mid * (seg + 1);
  if (V().fromBufferAttribute(g.attributes.position, v0).sub(rings[mid].P).dot(V().fromBufferAttribute(g.attributes.normal, v0)) < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  // weld the normals along the uv seam
  const nr = g.attributes.normal;
  for (let k = 0; k < rings.length; k++) { const a = k * (seg + 1), b = a + seg, n = V().fromBufferAttribute(nr, a).add(V().fromBufferAttribute(nr, b)).normalize(); nr.setXYZ(a, n.x, n.y, n.z); nr.setXYZ(b, n.x, n.y, n.z); }
  return { geo: g, rings };
}
// a finger segment along +z: a tapered tube, slightly flattened underneath
const fingerGeo = (L, r0, r1) => loft([{ p: V(0, 0, -0.35), rx: r0 * 0.92, ry: r0 * 0.85 }, { p: V(0, 0.06, L * 0.5), rx: (r0 + r1) * 0.5, ry: (r0 + r1) * 0.44 }, { p: V(0, 0, L), rx: r1, ry: r1 * 0.88 }, { p: V(0, -0.05, L + 0.3), rx: r1 * 0.55, ry: r1 * 0.5 }], { seg: 12, up: V(0, 1, 0), uRep: 1, tile: 6, belly: 0.85, noise: 0.05 }).geo;
// a hooked claw along +z, curving down toward the palm, narrow from side to side
const clawGeo = (len, r) => { const n = []; for (let i = 0; i <= 6; i++) { const t = i / 6; n.push({ p: V(0, -0.55 * len * t * t, len * t * (1 - 0.15 * t)), rx: r * (1 - 0.93 * t) * 0.7, ry: r * (1 - 0.93 * t) }); } return loft(n, { seg: 10, up: V(0, 1, 0), uRep: 1, tile: 4, belly: 1 }).geo; };
function lumpy(rx, ry, rz, amp = 0.08, seg = 20) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), p = g.attributes.position, v = V(), o = rnd(0, 100);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 5.1 + o) * Math.sin(v.y * 4.3 + o * 1.3) * Math.sin(v.z * 6.7 + o * 0.7); v.multiplyScalar(1 + amp * n); p.setXYZ(i, v.x * rx, v.y * ry, v.z * rz); }
  g.computeVertexNormals(); return g;
}
// a jagged, swept-back dorsal plate (in the XY plane: x along the body, y up), thinner toward the tip
function plateGeo() {
  const w = 0.85, h = 1, L = 3, s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  for (let i = 1; i <= L; i++) { const t = i / (L + 1), xr = -w / 2 + (w * 0.3) * t; s.lineTo(xr - w * rnd(0.16, 0.26) * (1 - t * 0.6), h * t - h * 0.07); s.lineTo(xr + w * 0.1, h * t + h * 0.05); }
  s.lineTo(-w * 0.28, h);
  for (let i = L; i >= 1; i--) { const t = i / (L + 1), xf = w / 2 - (w * 0.78) * t; s.lineTo(xf - w * 0.06, h * t + h * 0.06); s.lineTo(xf + w * rnd(0.12, 0.2) * (1 - t * 0.5), h * t - h * 0.04); }
  s.lineTo(w / 2, 0); s.closePath();
  const th = 0.12, g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.025, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, -th / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) * (1 - 0.75 * Math.max(0, Math.min(1, y / h)))); uv.setXY(i, p.getX(i) / w + 0.5, y / h); }
  g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ the kaiju
export function buildKaiju() {
  const M = kaijuMats(), j = {}, bones = [], root = new THREE.Group(), tmpRig = new THREE.Group(); root.add(tmpRig);
  const B = (parent, name, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); (parent || tmpRig).add(b); j[name] = b; bones.push(b); return b; };
  // skeleton: an upright, forward-leaning body over massive legs, a long heavy tail as counterweight
  const pelvis = B(null, 'pelvis', 0, 40, -6), spine = B(pelvis, 'spine', 0, 9, 5), chest = B(spine, 'chest', 0, 11, 6), neck0 = B(chest, 'neck0', 0, 4.5, 3), neck = B(neck0, 'neck', 0, 4.5, 3), head = B(neck, 'head', 0, 7, 7);
  B(head, 'jaw', 0, -3, 1);
  j.tail = []; let tp = pelvis;
  const TO = [[-2, -11], [-4.5, -9], [-4.5, -9], [-4.5, -9], [-4.5, -9], [-4.5, -9], [-4, -9], [-3, -8.5], [-2, -8], [-1.5, -8], [-1, -7.5], [-0.5, -7]];
  TO.forEach(([dy, dz], i) => { tp = B(tp, 'tail' + i, 0, dy, dz); j.tail.push(tp); });
  for (const [s, S] of [[-1, 'L'], [1, 'R']]) {
    // toes bend at the ball of the foot; the claws of each hand curl and spread on their own joint
    const hip = B(pelvis, 'hip' + S, s * 11, -4, 1), knee = B(hip, 'knee' + S, 0, -18, 7), an = B(knee, 'ankle' + S, 0, -15, -6); B(an, 'toe' + S, 0, -2, 5.5);
    const sh = B(chest, 'sh' + S, s * 12, -1, 5), el = B(sh, 'el' + S, s * 1, -11, 4), hn = B(el, 'hand' + S, 0, -8, 6); B(hn, 'fing' + S, 0, -1.2, 2.8);
  }
  root.updateMatrixWorld(true);
  const W = (name) => j[name].getWorldPosition(V()), bi = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  // the body: from the tip of the tail, through the torso and neck, to the snout
  const tailR = [12.5, 11, 9.6, 8.3, 7.1, 6.0, 5.0, 4.1, 3.3, 2.6, 2.0, 1.5];
  const nodes = [{ p: W('tail11').add(V(0, -0.3, -6)), rx: 0.5, ry: 0.5, bone: 'tail11', ridge: 0.1 }];
  for (let i = 11; i >= 0; i--) nodes.push({ p: W('tail' + i), rx: tailR[i], ry: tailR[i] * 1.12, bone: i > 0 ? 'tail' + (i - 1) : 'pelvis', ridge: 0.12, belly: 0.85 });
  const hd = (x, y, z) => W('head').add(V(x, y, z));
  nodes.push(
    { p: W('pelvis'), rx: 15.5, ry: 15.5, bone: 'pelvis', ridge: 0.06, belly: 0.86 },
    { p: W('spine'), rx: 16.5, ry: 15.5, bone: 'spine', ridge: 0.05, belly: 0.88 },
    { p: W('chest'), rx: 14.5, ry: 13, bone: 'chest', ridge: 0.05, belly: 0.9 },
    { p: W('neck0'), rx: 11, ry: 10, bone: 'neck0', ridge: 0.06 },
    { p: W('neck'), rx: 8.4, ry: 8.4, bone: 'neck', ridge: 0.08 },
    { p: W('head'), rx: 6.3, ry: 6.0, bone: 'head', ridge: 0.1, belly: 0.8 },
    { p: hd(0, -1.4, 7.5), rx: 4.7, ry: 3.9, bone: 'head', ridge: 0.08, belly: 0.72 },
    { p: hd(0, -2.3, 13.8), rx: 2.5, ry: 2.2, bone: 'head', belly: 0.7 },
    { p: hd(0, -2.6, 15.4), rx: 0.4, ry: 0.4, bone: 'head' },
  );
  const body = loft(nodes, { bones: bi, seg: 36, step: 2.2, uRep: 4, tile: 26, noise: 0.06 });
  const geos = [body.geo];
  // legs: huge thighs, digitigrade-ish shins, broad clawed feet
  for (const [s, S] of [[-1, 'L'], [1, 'R']]) {
    const hip = W('hip' + S), knee = W('knee' + S), an = W('ankle' + S);
    geos.push(loft([
      { p: hip.clone().add(V(-s * 1.5, 7, -1)), rx: 10, ry: 10.5, bone: 'pelvis' },
      { p: hip, rx: 10.5, ry: 11.5, bone: 'hip' + S },
      { p: hip.clone().lerp(knee, 0.5), rx: 9, ry: 9.8, bone: 'hip' + S },
      { p: knee, rx: 6, ry: 6.4, bone: 'knee' + S },
      { p: knee.clone().lerp(an, 0.5), rx: 5.1, ry: 5.5, bone: 'knee' + S },
      { p: an, rx: 4.4, ry: 4.6, bone: 'ankle' + S },
      { p: an.clone().add(V(0, -1.6, 4)), rx: 5.2, ry: 2.9, bone: 'ankle' + S },
      { p: an.clone().add(V(0, -2, 6.2)), rx: 5.1, ry: 2.4, bone: 'toe' + S },
      { p: an.clone().add(V(0, -2.2, 8.5)), rx: 4.7, ry: 1.9, bone: 'toe' + S },
      { p: an.clone().add(V(0, -2.3, 10)), rx: 1, ry: 0.8, bone: 'toe' + S },
    ], { bones: bi, seg: 26, up: V(0, 0, 1), uRep: 3, tile: 22, belly: 1, noise: 0.06 }).geo);
    const sh = W('sh' + S), el = W('el' + S), hand = W('hand' + S);
    geos.push(loft([
      { p: sh.clone().add(V(-s * 4, 1.5, -3)), rx: 5.2, ry: 5.2, bone: 'chest' },
      { p: sh, rx: 4.6, ry: 4.8, bone: 'sh' + S },
      { p: sh.clone().lerp(el, 0.5), rx: 4.1, ry: 4.3, bone: 'sh' + S },
      { p: el, rx: 3.4, ry: 3.5, bone: 'el' + S },
      { p: el.clone().lerp(hand, 0.5), rx: 3.0, ry: 3.1, bone: 'el' + S },
      // the wrist narrows, then a broad, flat palm ending in a row of knuckles (the fingers are separate jointed pieces)
      { p: hand, rx: 2.5, ry: 2.3, bone: 'hand' + S },
      { p: hand.clone().add(V(0, -1.0, 2.0)), rx: 3.0, ry: 1.75, bone: 'hand' + S },
      { p: hand.clone().add(V(0, -1.7, 3.6)), rx: 2.9, ry: 1.4, bone: 'fing' + S },
      { p: hand.clone().add(V(0, -2.0, 4.3)), rx: 1.4, ry: 0.8, bone: 'fing' + S },
    ], { bones: bi, seg: 20, up: V(0, 0, 1), uRep: 2, tile: 16, belly: 1, noise: 0.05 }).geo);
  }
  const mesh = new THREE.SkinnedMesh(mergeGeometries(geos), M.skin);
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  tmpRig.remove(pelvis); mesh.add(pelvis); root.remove(tmpRig); root.add(mesh);
  root.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));

  // rigid parts ride on their bones (placed in bind pose, where every bone is unrotated)
  const att = (bone, geo, mat, wpos, quat, scale) => { const m = new THREE.Mesh(geo, mat); m.position.copy(wpos).sub(W(bone)); if (quat) m.quaternion.copy(quat); if (scale) m.scale.copy(scale); m.castShadow = true; m.receiveShadow = true; j[bone].add(m); return m; };
  // dorsal plates: three staggered rows, biggest over the shoulders; grouped in bands so a glow can travel up the back
  const bands = Array.from({ length: 8 }, () => M.plate()), pgeos = [plateGeo(), plateGeo(), plateGeo(), plateGeo()], plates = [];
  const r0 = body.rings.find((r) => r.i >= 2), r1 = body.rings.find((r) => r.i >= 17), s0 = r0.s, s1 = r1.s;
  const ringAt = (s) => { let best = body.rings[0]; for (const r of body.rings) if (Math.abs(r.s - s) < Math.abs(best.s - s)) best = r; return best; };
  const place = (s, side) => {
    const x = (s - s0) / (s1 - s0), r = ringAt(s), a = Math.PI / 2 + side * 0.42;
    let h = 2.2 + 11.5 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(x, 1.35))), 1.4); if (side) h *= 0.6;
    const upd = r.B.clone().multiplyScalar(Math.cos(a) * r.rx).addScaledVector(r.N, Math.sin(a) * r.ry * (side ? 1 : 1 + r.ridge));
    const p = r.P.clone().add(upd), Y = upd.normalize(), X = r.T.clone().addScaledVector(Y, -r.T.dot(Y)).normalize(), Z = V().crossVectors(X, Y);
    p.addScaledVector(Y, -h * 0.16);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    const band = Math.min(7, Math.max(0, Math.floor(x * 8)));
    const m = att(r.bone, pgeos[Math.floor(Math.random() * 4)], bands[band], p, q, V(h * rnd(1.15, 1.4), h, h * (side ? 0.8 : 1)));
    plates.push(m);
  };
  for (let s = s0; s <= s1; s += 5.6) place(s, 0);
  for (let s = s0 + 2.8; s <= s1 - 6; s += 5.6) { place(s, -1); place(s, 1); }

  // the head: brow ridges over deep-set eyes, cheek muscles, nostrils, rows of teeth, a heavy lower jaw
  const hq = null;
  for (const s of [-1, 1]) {
    att('head', lumpy(2.4, 1.2, 3.6, 0.12), M.skin, hd(s * 3.9, 2.9, 4.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, s * 0.15, -s * 0.3)));
    att('head', new THREE.SphereGeometry(0.55, 12, 8), M.eye, hd(s * 4.35, 1.5, 4.9)).castShadow = false;
    att('head', lumpy(2.6, 3.2, 4.4, 0.1), M.skin, hd(s * 4.6, -1.4, 1));
    att('head', new THREE.SphereGeometry(0.45, 8, 6), M.dark, hd(s * 1.1, -0.9, 14.2));
    for (let k = 0; k < 8; k++) att('head', new THREE.ConeGeometry(0.34, 1.7, 6), M.tooth, hd(s * (3.9 - k * 0.26), -3.5 + k * 0.1, 4.6 + k * 1.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)));
    // spikes running down the cheeks behind the jaw
    for (let k = 0; k < 3; k++) att('head', new THREE.ConeGeometry(0.5, 2.6, 5), M.claw, hd(s * (5.6 - k * 0.2), -0.5 - k * 1.2, -1 - k * 1.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.9, 0, s * 0.6)));
  }
  const mouth = att('head', lumpy(3.2, 0.8, 6.2, 0.05), M.mouth, hd(0, -3.4, 8)); mouth.castShadow = false;
  const jw = W('jaw'), jl = loft([
    { p: jw.clone().add(V(0, 0.2, -1)), rx: 4.6, ry: 2.4 }, { p: jw.clone().add(V(0, -0.4, 5)), rx: 4.0, ry: 2.0 },
    { p: jw.clone().add(V(0, -0.3, 10)), rx: 2.8, ry: 1.5 }, { p: jw.clone().add(V(0, 0, 13.4)), rx: 1.3, ry: 1.0 }, { p: jw.clone().add(V(0, 0, 14.1)), rx: 0.2, ry: 0.2 },
  ], { seg: 20, up: V(0, 1, 0), uRep: 2, tile: 14, belly: 0.8, noise: 0.04 });
  jl.geo.translate(-jw.x, -jw.y, -jw.z);
  const jm = new THREE.Mesh(jl.geo, M.skin); jm.castShadow = true; j.jaw.add(jm);
  for (const s of [-1, 1]) for (let k = 0; k < 7; k++) att('jaw', new THREE.ConeGeometry(0.3, 1.5, 6), M.tooth, jw.clone().add(V(s * (3.4 - k * 0.3), 1.6, 3.5 + k * 1.4)));
  // claws on hands and feet, a spur at the heel
  for (const [s, S] of [[-1, 'L'], [1, 'R']]) {
    const an = W('ankle' + S), hand = W('hand' + S), fwd = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + 0.25, 0, 0));
    for (let k = -1; k <= 1; k++) att('toe' + S, new THREE.ConeGeometry(0.75, 3.4, 6), M.claw, an.clone().add(V(k * 2.9, -2.6, 10.6 - Math.abs(k) * 0.8)), fwd);
    att('ankle' + S, new THREE.ConeGeometry(0.8, 3, 6), M.claw, an.clone().add(V(0, -2.2, -3.5)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 - 0.3, 0, 0)));
    // the hand: four thick fingers of two segments each, knuckle pads, hooked claws, and an opposed thumb
    j['kf' + S] = [];
    const kn = hand.clone().add(V(0, -1.7, 3.6)), fdir = V(0, -0.55, 0.84).normalize();
    const digit = (base, d, L, r, spread, thumb) => {
      const Z = d.clone().normalize(), X = V(Z.z, 0, -Z.x).normalize(), Y = V().crossVectors(Z, X);
      const frame = new THREE.Group(); frame.position.copy(base).sub(W('fing' + S)); frame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); j['fing' + S].add(frame);
      const prox = new THREE.Group(), mid = new THREE.Group(); frame.add(prox); prox.add(mid); mid.position.z = L * 0.55;
      const m1 = new THREE.Mesh(fingerGeo(L * 0.55, r, r * 0.86), M.skin), m2 = new THREE.Mesh(fingerGeo(L * 0.45, r * 0.86, r * 0.7), M.skin), c = new THREE.Mesh(clawGeo(r * 3.4, r * 0.62), M.claw);
      const pad = new THREE.Mesh(lumpy(r * 1.05, r * 0.9, r * 1.1, 0.12, 12), M.skin); pad.position.set(0, r * 0.15, 0); c.position.z = L * 0.45 + 0.05;
      for (const m of [m1, m2, c, pad]) { m.castShadow = true; m.receiveShadow = true; }
      prox.add(m1, pad); mid.add(m2, c); j['kf' + S].push({ prox, mid, spread, thumb });
    };
    [[-2.0, 2.3, 0.78], [-0.68, 2.75, 0.86], [0.68, 2.75, 0.86], [2.0, 2.3, 0.78]].forEach(([x, L, r]) => digit(kn.clone().add(V(x, 0.1 - Math.abs(x) * 0.12, -Math.abs(x) * 0.25)), fdir.clone().applyAxisAngle(V(0, 1, 0), x * 0.09), L, r, Math.sign(x) * (Math.abs(x) > 1 ? 1 : 0.4), false));
    digit(hand.clone().add(V(-s * 2.4, -1.0, 2.0)), V(-s * 0.6, -0.45, 0.66), 2.1, 0.82, 0, true);
  }

  // ---- extra detail: belly scutes, bony spikes, horns, gills, old glowing wounds, a tongue
  const ring = (r, a) => r.B.clone().multiplyScalar(Math.cos(a) * r.rx).addScaledVector(r.N, Math.sin(a) * r.ry * (Math.sin(a) < 0 ? r.belly : 1 + r.ridge));
  const onSkin = (r, a, geo, mat, scale, k = 0.97, spin = 0) => {
    const off = ring(r, a), Y = off.clone().normalize(), X = r.T.clone().addScaledVector(Y, -r.T.dot(Y)).normalize().applyAxisAngle(Y, spin), Z = V().crossVectors(X, Y);
    return att(r.bone, geo, mat, r.P.clone().addScaledVector(off, k), new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)), scale);
  };
  // belly scutes: a column of overlapping plates from the groin up the throat
  const scute = lumpy(1, 1, 1, 0.07, 14);
  const b0 = body.rings.find((r) => r.i >= 12).s, b1 = body.rings.find((r) => r.i >= 18).s;
  for (let s = b0; s <= b1; s += 2.6) { const r = ringAt(s); onSkin(r, -Math.PI / 2, scute, M.belly, V(1.9, 0.42, r.rx * 0.5), 0.94); }
  // old wounds on the chest and flanks
  const scars = [], sc0 = body.rings.find((q) => q.i >= 13).s, sc1 = body.rings.find((q) => q.i >= 16).s;
  for (let n = 0; n < 7; n++) { const r = ringAt(rnd(sc0, sc1)), side = Math.random() < 0.5 ? -1 : 1; scars.push(onSkin(r, -Math.PI / 2 + side * rnd(0.5, 1.3), lumpy(1, 1, 1, 0.2, 10), M.scar, V(rnd(2.5, 4.5), 0.35, 0.32), 1.0, rnd(-0.9, 0.9))); }
  // spikes along the sides of the tail and a spiked tip
  const spike = new THREE.ConeGeometry(0.7, 3, 6), tip = new THREE.ConeGeometry(0.5, 3.6, 5);
  for (let i = 1; i <= 10; i++) for (const s of [-1, 1]) {
    const m = W('tail' + i).lerp(W('tail' + (i + 1)), 0.5), r = tailR[i] * 0.95;
    att('tail' + i, spike, M.claw, m.add(V(s * r, r * 0.25, 0)), qd(V(s, 0.25, -0.9)), V(1, 0.5 + 0.06 * (11 - i), 1));
  }
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; att('tail11', tip, M.claw, W('tail11').add(V(Math.cos(a) * 1.3, Math.sin(a) * 1.3 + 0.6, -4)), qd(V(Math.cos(a) * 0.7, Math.sin(a) * 0.7 + 0.2, -1))); }
  for (const [s, S] of [[-1, 'L'], [1, 'R']]) {
    const hip = W('hip' + S), knee = W('knee' + S), sh = W('sh' + S), el = W('el' + S), hand = W('hand' + S);
    // bony knobs down the outside of the thigh, a spur on the knee
    for (let k = 0; k < 4; k++) { const t = 0.1 + k * 0.2; att('hip' + S, spike, M.claw, hip.clone().lerp(knee, t).add(V(s * (9.4 - t * 3.6), 1 - k * 0.3, -1.5)), qd(V(s, 0.3, -0.4)), V(1.1, 0.55, 1.1)); }
    att('knee' + S, new THREE.ConeGeometry(1.1, 3.4, 6), M.claw, knee.clone().add(V(0, 0.4, 5)), qd(V(0, 0.45, 1)));
    // a ridge of spikes down the back of the forearm, a spur at the elbow, a hump of muscle on the shoulder
    for (let k = 0; k < 3; k++) att('el' + S, spike, M.claw, el.clone().lerp(hand, 0.2 + k * 0.28).add(V(s * 1.6, 0, -2.6)), qd(V(s * 0.5, 0.3, -1)), V(0.7, 0.55, 0.7));
    att('el' + S, new THREE.ConeGeometry(0.9, 3.4, 6), M.claw, el.clone().add(V(s * 0.5, 0, -3.1)), qd(V(s * 0.3, -0.4, -1)));
    att('sh' + S, lumpy(3.2, 2.2, 3.6, 0.15), M.skin, sh.clone().add(V(s * 1.5, 3, -1)));
    // horns swept back from the skull, knobs above the eyes
    att('head', new THREE.ConeGeometry(1.1, 7, 7), M.claw, hd(s * 3.4, 4.4, -1.6), qd(V(s * 0.35, 0.55, -1)));
    att('head', new THREE.ConeGeometry(0.7, 4, 6), M.claw, hd(s * 4.8, 2.6, -3), qd(V(s * 0.6, 0.3, -1)));
    for (let k = 0; k < 3; k++) att('head', new THREE.ConeGeometry(0.4, 1.3, 5), M.claw, hd(s * (3.2 - k * 0.9), 3.9 - k * 0.15, 5.2 + k * 0.9), qd(V(s * 0.2, 1, 0.2)));
    // gill slits on the neck that pulse with the plates
    for (let k = 0; k < 3; k++) scars.push(att('neck', lumpy(1, 1, 1, 0.1, 10), M.scar, W('neck').add(V(s * 7.9, -1.8 + k * 1.9, -1.4 - k * 0.5)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0)), V(0.25, 1.9, 0.45)));
    // spikes under the chin
    for (let k = 0; k < 3; k++) att('jaw', new THREE.ConeGeometry(0.45, 2, 5), M.claw, jw.clone().add(V(s * (2.6 - k * 0.5), -1.6, 3 + k * 2.4)), qd(V(s * 0.3, -1, -0.5)));
  }
  att('head', lumpy(1.4, 0.9, 2.6, 0.15), M.skin, hd(0, -0.2, 11.6));
  att('jaw', lumpy(1.7, 0.55, 4.6, 0.08), M.flesh, jw.clone().add(V(0, 1, 6.5)));
  const eyeLight = new THREE.PointLight(0xff8a30, 50, 16, 2); eyeLight.position.copy(hd(0, 2, 9).sub(W('head'))); j.head.add(eyeLight);
  const mouthLight = new THREE.PointLight(0x3ad8ff, 0, 70, 2); mouthLight.position.copy(hd(0, -3, 17).sub(W('head'))); j.head.add(mouthLight);
  return { root, j, mats: M, plates, bands, scars, mouthLight, hq };
}

// ------------------------------------------------------------------ robot surfaces: weathered painted steel, panel seams, rivets, rust and rain streaks
let RTEX = null;
function robotTex() {
  if (RTEX) return RTEX;
  const N = 1024, hc = cnv(N), cc = cnv(N), rc = cnv(N), mc = cnv(N), H = hc.getContext('2d'), C = cc.getContext('2d'), R = rc.getContext('2d'), Mt = mc.getContext('2d');
  H.fillStyle = '#808080'; H.fillRect(0, 0, N, N); C.fillStyle = '#bfc3c7'; C.fillRect(0, 0, N, N); R.fillStyle = '#8a8a8a'; R.fillRect(0, 0, N, N); Mt.fillStyle = '#404040'; Mt.fillRect(0, 0, N, N);
  // large soft mottling in the paint
  for (let i = 0; i < 160; i++) { const x = rnd(0, N), y = rnd(0, N), r = rnd(30, 160), v = rnd(-1, 1), g = C.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, v > 0 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)'); g.addColorStop(1, 'rgba(0,0,0,0)'); C.fillStyle = g; C.fillRect(x - r, y - r, r * 2, r * 2); }
  // panels: recursive splits; each panel slightly raised or sunk, seams are grooves
  const leaves = [];
  (function split(x, y, w, h, d) { if (d > 0 && (w > 260 || h > 260) && Math.random() < 0.9) { if (w > h) { const k = Math.round(w * rnd(0.3, 0.7)); split(x, y, k, h, d - 1); split(x + k, y, w - k, h, d - 1); } else { const k = Math.round(h * rnd(0.3, 0.7)); split(x, y, w, k, d - 1); split(x, y + k, w, h - k, d - 1); } } else leaves.push([x, y, w, h]); })(0, 0, N, N, 6);
  for (const [x, y, w, h] of leaves) {
    const lift = rnd(-12, 12); H.fillStyle = `rgb(${128 + lift},${128 + lift},${128 + lift})`; H.fillRect(x + 4, y + 4, w - 8, h - 8);
    C.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.06)'; C.fillRect(x, y, w, h);
    H.strokeStyle = '#2a2a2a'; H.lineWidth = 4; H.strokeRect(x + 1, y + 1, w - 2, h - 2);
    C.strokeStyle = 'rgba(10,12,14,.75)'; C.lineWidth = 2.5; C.strokeRect(x + 1, y + 1, w - 2, h - 2);
    R.strokeStyle = '#d8d8d8'; R.lineWidth = 3; R.strokeRect(x + 1, y + 1, w - 2, h - 2);
    // rivets along some edges
    if (Math.random() < 0.3) for (let t = 14; t < w - 10; t += 26) for (const yy of [y + 10, y + h - 10]) { H.fillStyle = '#e0e0e0'; H.beginPath(); H.arc(x + t, yy, 3.2, 0, 7); H.fill(); C.fillStyle = 'rgba(40,40,40,.6)'; C.beginPath(); C.arc(x + t + 1, yy + 1, 3, 0, 7); C.fill(); }
    // vent grilles in a few panels
    if (w > 80 && h > 60 && Math.random() < 0.12) for (let yy = y + 16; yy < y + h - 16; yy += 9) { H.fillStyle = '#202020'; H.fillRect(x + 14, yy, w - 28, 4); C.fillStyle = 'rgba(0,0,0,.7)'; C.fillRect(x + 14, yy, w - 28, 4); }
    // rust and grime run down from the seams
    for (let k = 0; k < 3; k++) if (Math.random() < 0.5) { const sx = x + rnd(5, w - 5), sy = y + rnd(0, h * 0.4), len = rnd(40, 200), rust = Math.random() < 0.45, g = C.createLinearGradient(0, sy, 0, sy + len); g.addColorStop(0, rust ? 'rgba(120,58,22,.45)' : 'rgba(15,16,18,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); C.fillStyle = g; C.fillRect(sx, sy, rnd(2, 9), len); R.fillStyle = 'rgba(220,220,220,.35)'; R.fillRect(sx, sy, 6, len * 0.6); }
  }
  // edge wear: bare metal chipped along seams, plus scratches
  for (let i = 0; i < 2600; i++) { const L = leaves[Math.floor(Math.random() * leaves.length)], e = Math.floor(Math.random() * 4); let x = L[0] + Math.random() * L[2], y = L[1] + Math.random() * L[3]; if (e === 0) y = L[1] + rnd(0, 7); else if (e === 1) y = L[1] + L[3] - rnd(0, 7); else if (e === 2) x = L[0] + rnd(0, 7); else x = L[0] + L[2] - rnd(0, 7); const s = rnd(1, 4); C.fillStyle = `rgba(${rnd(170, 215)},${rnd(170, 215)},${rnd(175, 220)},.8)`; C.fillRect(x, y, s, s * rnd(0.5, 1.5)); Mt.fillStyle = '#f0f0f0'; Mt.fillRect(x, y, s, s); R.fillStyle = '#505050'; R.fillRect(x, y, s, s); }
  for (let i = 0; i < 260; i++) { const x = rnd(0, N), y = rnd(0, N), a = rnd(-0.4, 0.4) + (Math.random() < 0.5 ? 0 : Math.PI / 2), l = rnd(10, 70); for (const [g, col] of [[C, 'rgba(210,212,216,.35)'], [Mt, 'rgba(255,255,255,.5)'], [R, 'rgba(70,70,70,.5)'], [H, 'rgba(100,100,100,.6)']]) { g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }
  // hazard stripes: worn yellow and black
  const zc = cnv(256), Z = zc.getContext('2d'); Z.fillStyle = '#d29a1e'; Z.fillRect(0, 0, 256, 256); Z.fillStyle = '#16161a';
  for (let k = -256; k < 512; k += 64) { Z.beginPath(); Z.moveTo(k, 0); Z.lineTo(k + 32, 0); Z.lineTo(k + 32 - 256, 256); Z.lineTo(k - 256, 256); Z.closePath(); Z.fill(); }
  for (let i = 0; i < 900; i++) { Z.fillStyle = `rgba(${rnd(60, 120)},${rnd(60, 110)},${rnd(60, 100)},${rnd(0.2, 0.6)})`; Z.fillRect(rnd(0, 256), rnd(0, 256), rnd(1, 5), rnd(1, 4)); }
  for (let i = 0; i < 20; i++) { const x = rnd(0, 256), g = Z.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(20,16,10,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); Z.fillStyle = g; Z.fillRect(x, rnd(0, 120), rnd(2, 6), 256); }
  RTEX = { map: tex(cc, true), normal: tex(normalFromHeight(hc, 2.5), false), rough: tex(rc, false), metal: tex(mc, false), hazard: tex(zc, true) };
  return RTEX;
}
function robotMats() {
  const T = robotTex();
  const phys = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ map: T.map, normalMap: T.normal, normalScale: new THREE.Vector2(1, 1), roughnessMap: T.rough, metalnessMap: T.metal, roughness: 1, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 1.25 }, o));
  // stencilled number on the chest, worn
  const dc = cnv(256), D = dc.getContext('2d'); D.fillStyle = '#e9e4d6'; D.font = 'bold 170px Impact, "Arial Black", sans-serif'; D.textAlign = 'center'; D.textBaseline = 'middle'; D.fillText('04', 128, 120);
  D.font = 'bold 26px Impact, "Arial Black", sans-serif'; D.fillText('SENTINEL', 128, 222);
  D.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 1400; i++) { D.fillStyle = `rgba(0,0,0,${rnd(0.3, 1)})`; D.fillRect(rnd(0, 256), rnd(0, 256), rnd(1, 5), rnd(1, 4)); }
  return {
    armor: phys({ color: 0x51606e }),
    armor2: phys({ color: 0x2e3640 }),
    hazard: phys({ map: T.hazard, color: 0xffffff, metalness: 0.4 }),
    frame: phys({ color: 0x2c2e31, clearcoat: 0.1, metalnessMap: null, metalness: 0.9, roughness: 0.85 }),
    piston: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.18, envMapIntensity: 1.6 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x6fd8ff, emissiveIntensity: 1.3 }),
    amber: new THREE.MeshStandardMaterial({ color: 0x301a00, emissive: 0xffa040, emissiveIntensity: 3 }),
    red: new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2010, emissiveIntensity: 4 }),
    // the fold-out plasma blade, the thruster nozzles, rubber hoses
    blade: new THREE.MeshStandardMaterial({ color: 0xd8e4ee, metalness: 1, roughness: 0.12, envMapIntensity: 2, emissive: 0x4ab8ff, emissiveIntensity: 0 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x9fe8ff, emissiveIntensity: 0 }),
    thrust: new THREE.MeshStandardMaterial({ color: 0x1a0c04, emissive: 0xff8a30, emissiveIntensity: 0.2 }),
    hose: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.6, metalness: 0.2 }),
    decal: new THREE.MeshStandardMaterial({ map: tex(dc, true), transparent: true, roughness: 0.6, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
  };
}
// hard-surface pieces: chamfered plates and trapezoid prisms with a small bevel, box-projected UVs so the texture keeps its scale
function boxUV(g, sc = 1 / 38) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * sc + 0.37; uv[i * 2 + 1] = v * sc + 0.11;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
const GC = new Map();
const cached = (key, make) => { if (!GC.has(key)) GC.set(key, make()); return GC.get(key); };
function poly(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
function extrude(shape, d, bev) { const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.05, d - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 4 }); g.translate(0, 0, -(d - bev * 2) / 2); g.computeVertexNormals(); return boxUV(g); }
// a trapezoid (bottom width wb, top width wt) with cut corners, extruded to depth d
function trap(wb, wt, h, d, c) {
  c = Math.min(c ?? Math.min(wb, wt, h) * 0.16, h * 0.45, Math.min(wb, wt) * 0.45);
  return cached(`t${wb},${wt},${h},${d},${c}`, () => extrude(poly([[-wb / 2 + c, -h / 2], [wb / 2 - c, -h / 2], [wb / 2, -h / 2 + c], [wt / 2, h / 2 - c], [wt / 2 - c, h / 2], [-wt / 2 + c, h / 2], [-wt / 2, h / 2 - c], [-wb / 2, -h / 2 + c]]), d, Math.min(0.45, d * 0.12, h * 0.08)));
}
const plate = (w, h, d, c) => trap(w, w, h, d, c);
const cyl = (r, h, seg = 18) => cached(`c${r},${h},${seg}`, () => boxUV(new THREE.CylinderGeometry(r, r, h, seg)));
const sph = (r) => cached(`s${r}`, () => boxUV(new THREE.SphereGeometry(r, 18, 12)));
const J = (parent, x, y, z, name, map) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); map[name] = g; return g; };
const put = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
const lit = (m) => { m.castShadow = false; return m; };

// ------------------------------------------------------------------ the robot: a jaeger, about 78 m tall
export function buildRobot() {
  const M = robotMats(), j = {}, root = new THREE.Group(), P = Math.PI;
  const pelvis = J(root, 0, 37, 0, 'pelvis', j);
  put(pelvis, plate(17, 7, 12), M.frame);
  put(pelvis, trap(8, 14, 9, 3), M.armor, 0, -2.6, 6.6, -0.12);
  put(pelvis, plate(9, 1.2, 0.8, 0.2), M.hazard, 0, 1.4, 8.4, -0.12);
  for (const s of [-1, 1]) { put(pelvis, plate(3, 11, 11), M.armor2, s * 10, -3.4, 0, 0, 0, s * 0.2); put(pelvis, plate(1, 9, 9), M.armor, s * 11.6, -3.8, 0, 0, 0, s * 0.2); }
  put(pelvis, trap(12, 15, 7, 3), M.armor2, 0, -1.5, -6.6, 0.15);
  for (const [s, S] of [[-1, 'L'], [1, 'R']]) {
    const sk = J(pelvis, s * 9, -0.5, 8.8, 'skirt' + S, j);
    put(sk, trap(6.4, 7.6, 10, 1.4, 1.2), M.armor, 0, -5, 0, -0.06);
    put(sk, plate(5.6, 0.7, 0.5, 0.15), M.hazard, 0, -9.4, 0.8);
    put(sk, cyl(0.5, 1.2), M.piston, 0, 0, -0.3, 0, 0, Math.PI / 2);
  }
  // the abdomen: an exposed mechanical spine with pistons
  const spine = J(pelvis, 0, 4, 0, 'spine', j);
  put(spine, cyl(2.6, 10), M.frame, 0, 4, -1.5);
  for (let k = 0; k < 4; k++) put(spine, cyl(5.4 - (k % 2) * 0.8, 1.1, 22), M.frame, 0, 0.9 + k * 2.2, -1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { put(spine, cyl(0.55, 9), M.piston, sx * 5.6, 4.2, sz * 3.4); put(spine, cyl(0.95, 4.2), M.frame, sx * 5.6, 1.6, sz * 3.4); }
  for (let k = 0; k < 3; k++) put(spine, plate(9 - k * 0.6, 2.2, 2.6, 0.6), M.armor, 0, 1.4 + k * 2.5, 5.2, -0.08);
  for (const s of [-1, 1]) for (const [z, bow] of [[-3.5, 2.2], [3, 1.6]]) put(spine, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(s * 2.6, -0.5, z), V(s * (4.8 + bow), 4, z * 1.25), V(s * 2.8, 8.6, z)]), 14, 0.45, 6), M.hose);
  // the chest: a broad armoured hull with the reactor turbine at its heart
  const chest = J(spine, 0, 8, 0, 'chest', j);
  put(chest, trap(22, 32, 20, 16, 4), M.armor, 0, 10, 0);
  put(chest, plate(12.5, 12.5, 2), M.frame, 0, 9.5, 7.4);
  for (const s of [-1, 1]) { put(chest, trap(13, 14.5, 9, 3, 2.5), M.armor, s * 8.4, 14, 8.6, -0.12, s * 0.22, 0); put(chest, plate(2.6, 11, 13), M.armor2, s * 12.6, 5, 0, 0, 0, s * 0.22); put(chest, cyl(4.2, 5), M.frame, s * 15.5, 15, 0, 0, 0, P / 2); }
  put(chest, plate(26, 3.6, 15), M.armor2, 0, 20.4, -0.5); put(chest, plate(25, 0.9, 0.7, 0.2), M.hazard, 0, 19.6, 7.3);
  put(chest, new THREE.TorusGeometry(5.3, 1.05, 12, 36), M.piston, 0, 9.5, 8.9);
  put(chest, new THREE.TorusGeometry(4.1, 0.35, 8, 36), M.frame, 0, 9.5, 9.3);
  const core = lit(put(chest, new THREE.RingGeometry(1.4, 4.3, 36), M.glow, 0, 9.5, 8.7)); lit(put(chest, new THREE.CircleGeometry(1.5, 24), M.frame, 0, 9.5, 8.68));
  const fan = new THREE.Group(); fan.position.set(0, 9.5, 9.1); chest.add(fan); j.fan = fan;
  put(fan, new THREE.CylinderGeometry(1.1, 1.3, 0.8, 16), M.frame, 0, 0, 0.2, P / 2, 0, 0);
  for (let k = 0; k < 9; k++) { const b = put(fan, new THREE.BoxGeometry(0.7, 3.4, 0.18), M.frame, 0, 0, 0, 0, 0.35, 0); b.position.set(Math.sin(k / 9 * P * 2) * 2.2, Math.cos(k / 9 * P * 2) * 2.2, 0); b.rotation.z = -k / 9 * P * 2; b.rotateY(0.45); }
  const dec = put(chest, new THREE.PlaneGeometry(5.5, 5.5), M.decal, -8.6, 14.2, 10.15, -0.12, -0.22, 0); dec.castShadow = false;
  // the back: armour, two heat-sink towers with glowing slits; steam vents out of their tops
  put(chest, trap(18, 26, 14, 3, 3), M.armor, 0, 12, -8.6);
  for (const s of [-1, 1]) { put(chest, plate(5.5, 17, 6), M.frame, s * 7.5, 14, -10.6); for (let k = 0; k < 5; k++) put(chest, plate(7, 0.6, 7.4, 0.15), M.armor2, s * 7.5, 7.5 + k * 3.2, -10.6); lit(put(chest, plate(2.4, 13, 0.4, 0.1), M.amber, s * 7.5, 14, -13.8)); }
  j.vents = [V(-7.5, 23.5, -10.6), V(7.5, 23.5, -10.6)];
  // missile pods on top of the hull: the lids hinge open at the front, six warheads under each
  j.pods = []; j.podMuzzles = [];
  const tipG = new THREE.ConeGeometry(0.75, 1.2, 8);
  for (const [s, S] of [[-1, 'L'], [1, 'R']]) {
    put(chest, plate(7.4, 3.2, 9.6, 0.8), M.frame, s * 9.2, 23.4, -2.2);
    put(chest, plate(7.8, 0.6, 0.5, 0.15), M.hazard, s * 9.2, 22.6, 2.75);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 2; r++) { const x = s * 9.2 + (c - 1) * 2.3, z = -2.2 + (r - 0.5) * 4; lit(put(chest, tipG, M.red, x, 25, z)); j.podMuzzles.push(V(x, 26.4, z)); }
    const lid = J(chest, s * 9.2, 25.7, 2.6, 'pod' + S, j);
    put(lid, plate(7.8, 0.9, 9.8, 0.35), M.armor, 0, 0.3, -4.8);
    put(lid, plate(6, 0.5, 1.2, 0.15), M.armor2, 0, 0.8, -8.6);
    j.pods.push(lid);
  }
  // thrusters low on the back: nozzles that flare during dashes and leaps
  j.nozzles = [];
  for (const s of [-1, 1]) {
    put(chest, cached('nozzle', () => boxUV(new THREE.CylinderGeometry(1.7, 2.5, 4.2, 16))), M.frame, s * 5.2, 1.4, -10.4, 0.55, 0, 0);
    put(chest, cyl(1.9, 1.2), M.armor2, s * 5.2, 3.5, -9.1, 0.55, 0, 0);
    lit(put(chest, new THREE.CircleGeometry(1.7, 16), M.thrust, s * 5.2, -0.42, -11.52, P / 2 + 0.55, 0, 0));
    j.nozzles.push(V(s * 5.2, -1.1, -12));
    // vent louvres down the flanks of the hull
    for (let k = 0; k < 4; k++) put(chest, plate(0.6, 1.1, 7, 0.15), M.armor2, s * 13.9, 3.5 + k * 1.8, -0.5, 0, 0, s * 0.22);
  }
  // the head: a low cockpit module with a visor slit, sunk between the shoulders
  const head = J(chest, 0, 19.5, 2, 'head', j);
  put(head, cyl(3, 4), M.frame, 0, -0.5, 0);
  const helm = put(head, cached('helm', () => { const g = extrude(poly([[-4.5, 0], [4.7, 0], [5.4, 2.2], [4.2, 5.6], [-1, 7], [-4.6, 5]]), 9, 0.4); g.rotateY(-P / 2); boxUV(g); return g; }), M.armor);
  helm.position.set(0, 0.6, 0);
  const visor = lit(put(head, plate(7.6, 1.1, 0.5, 0.2), M.glow, 0, 3.9, 5.25, -0.34));
  for (const s of [-1, 1]) put(head, plate(1, 5, 7.5), M.armor2, s * 4.9, 2.8, 0.3);
  put(head, plate(1.2, 3, 6), M.armor2, 0, 7.6, -1.5, -0.3);
  const beacon = lit(put(head, new THREE.SphereGeometry(0.45, 10, 8), M.red, 0, 8.9, -3.4)); j.beacon = beacon;
  for (const s of [-1, 1]) {
    put(head, cyl(0.18, 6, 6), M.piston, s * 3.8, 8.4, -2.6, -0.45, 0, s * 0.25);
    put(head, cyl(0.45, 1.2, 8), M.frame, s * 3.8, 5.8, -1.4, -0.45, 0, s * 0.25);
    for (let k = 0; k < 3; k++) put(head, plate(0.5, 0.5, 3.6, 0.1), M.frame, s * 5.5, 1.4 + k * 1.1, 1.2);
    lit(put(head, plate(0.9, 0.9, 0.4, 0.15), M.amber, s * 3.2, 2.2, 5.3));
  }
  put(head, trap(5, 7, 2.6, 4, 0.8), M.armor2, 0, 0.6, 4.2, -0.2);
  // arms: layered pauldrons, armoured biceps, heavy gauntlets, big fists
  for (const [s, S] of [[-1, 'L'], [1, 'R']]) {
    const sh = J(chest, s * 19, 15, 0, 'sh' + S, j);
    put(sh, sph(5), M.frame);
    // the pauldron rides on its own hinge so it lifts and tilts as the arm moves
    const pad = J(sh, 0, 2, 0, 'pad' + S, j);
    put(pad, plate(15, 3.2, 18, 2.2), M.armor, s * 1.5, 5.2, 0, 0, 0, -s * 0.18);
    put(pad, plate(14, 3.3, 1.1, 0.4), M.hazard, s * 1.5, 5.2, 9.1, 0, 0, -s * 0.18);
    put(pad, plate(12, 3, 17, 2), M.armor2, s * 7.4, 2, 0, 0, 0, -s * 0.62);
    put(pad, plate(9, 3, 16, 2), M.armor, s * 10.1, -2.6, 0, 0, 0, -s * 1.05);
    for (let k = 0; k < 4; k++) put(pad, plate(1.4, 0.8, 14, 0.2), M.frame, s * (3 + k * 2.4), 6.9 - k * 0.45, 0, 0, 0, -s * 0.18);
    lit(put(pad, new THREE.CylinderGeometry(0.9, 0.9, 0.6, 12), M.amber, s * 4.5, 6.4, 9.05, P / 2, 0, 0));
    put(sh, cyl(3.2, 13), M.frame, 0, -8, 0);
    put(sh, trap(7.4, 8.6, 11, 8, 1.6), M.armor, 0, -8.6, 0);
    put(sh, cyl(0.6, 11), M.piston, 0, -8, 4.6);
    const el = J(sh, 0, -16, 0, 'el' + S, j);
    put(el, cyl(3.3, 8), M.frame, 0, 0, 0, 0, 0, P / 2);
    put(el, plate(5, 5, 3, 1), M.hazard, 0, 0.6, -4);
    put(el, trap(11, 9, 15, 10.5, 2.4), M.armor, 0, -8.6, 0);
    for (let k = 0; k < 3; k++) { put(el, plate(1.2, 3, 11, 0.4), M.armor2, s * 5.7, -4 - k * 4, 0); lit(put(el, plate(6, 0.55, 0.4, 0.1), M.glow, 0, -6 - k * 2.4, 5.45)); }
    put(el, cyl(0.45, 12), M.piston, -s * 4.6, -8, -3.8);
    if (S === 'L') {
      // the plasma blade: folded into a housing on the outside of the forearm, it slides out past the fist
      put(el, plate(1.8, 13, 5.6, 0.5), M.armor2, s * 6.6, -9, 0);
      const blade = J(el, s * 6.6, -9, 0, 'blade', j);
      const bg = cached('blade', () => { const g = extrude(poly([[-2.7, 0], [2.7, 0], [2.3, -31], [0, -42], [-1.8, -33]]), 0.8, 0.2); g.rotateY(-P / 2); return g; });
      put(blade, bg, M.blade);
      lit(put(blade, plate(0.6, 32, 0.6, 0.12), M.edge, 0, -16, 2.6)); lit(put(blade, plate(0.6, 26, 0.6, 0.12), M.edge, 0, -14, -1.9));
      j.bladeTip = new THREE.Object3D(); j.bladeTip.position.set(0, -38, 0); blade.add(j.bladeTip);
      blade.scale.y = 0.05; blade.visible = false;
    }
    const fist = J(el, 0, -16, 0, 'fist' + S, j);
    put(fist, cyl(3, 3), M.frame, 0, -0.5, 0);
    put(fist, plate(8, 6.5, 7.5, 1.2), M.frame, 0, -4.6, 0);
    put(fist, plate(8.6, 3, 3.4, 0.6), M.armor, 0, -6.6, 2.6);
    put(fist, plate(8, 5, 1.4, 0.4), M.armor, 0, -4.6, -4.2);
    lit(put(fist, new THREE.CircleGeometry(1.6, 18), M.glow, 0, -7.9, -0.6, P / 2, 0, 0));
    // four fingers, each with two segments, and an opposed thumb: they close into a fist, open for the palm cannon
    const fing = J(fist, 0, -7.6, 1.8, 'fing' + S, j); j['fingD' + S] = [];
    for (let k = 0; k < 4; k++) {
      const x = -2.9 + k * 1.95;
      put(fing, plate(1.8, 3.2, 2.6, 0.4), M.armor2, x, -1.5, 0);
      put(fing, cyl(0.55, 1.9, 8), M.frame, x, 0, 0, 0, 0, P / 2);
      const d = J(fing, x, -3.1, 0, 'fd' + S + k, j);
      put(d, plate(1.65, 2.6, 2.3, 0.4), M.armor2, 0, -1.3, 0);
      put(d, plate(1.2, 0.7, 1.6, 0.2), M.frame, 0, -2.6, 0.5);
      j['fingD' + S].push(d);
    }
    const th = J(fist, s * 4.5, -3.6, 2.2, 'thumb' + S, j);
    put(th, plate(2.2, 4.6, 2.4, 0.4), M.armor2, 0, -2, 0.4, 0, 0, s * 0.15);
    put(th, cyl(0.7, 2.4, 8), M.frame, 0, 0, 0, P / 2, 0, 0);
  }
  // legs
  for (const [s, S] of [[-1, 'L'], [1, 'R']]) {
    const hip = J(pelvis, s * 8, -2, 0, 'hip' + S, j);
    put(hip, sph(4.2), M.frame);
    put(hip, cyl(3.4, 15), M.frame, 0, -8, 0);
    put(hip, trap(8, 10, 14, 6, 2), M.armor, 0, -8, 2.4);
    put(hip, plate(2.2, 13, 9), M.armor2, s * 5.2, -8, 0);
    put(hip, cyl(0.7, 13), M.piston, 0, -8, -4.2);
    const knee = J(hip, 0, -16, 0, 'knee' + S, j);
    put(knee, cyl(3.6, 8.5), M.frame, 0, 0, 0, 0, 0, P / 2);
    put(knee, plate(7, 6.5, 3, 1.5), M.hazard, 0, 0.6, 4.4, -0.25);
    put(knee, trap(11, 8.5, 15, 9, 2.4), M.armor, 0, -8, 0.3);
    put(knee, plate(3.4, 12, 1.6, 0.5), M.armor2, 0, -8.5, 5.1);
    for (const sx of [-1, 1]) put(knee, cyl(0.7, 12), M.piston, sx * 2.8, -7.5, -5);
    const ankle = J(knee, 0, -15, 0, 'ankle' + S, j);
    put(ankle, sph(3.4), M.frame);
    put(ankle, plate(12, 3, 14, 1.5), M.frame, 0, -2.5, 1.8);
    put(ankle, plate(10, 2.4, 9, 1.5), M.armor, 0, -0.5, 2.5, 0.12);
    for (const sx of [-1, 1]) put(ankle, cyl(0.5, 7), M.piston, sx * 4.2, 2.2, 1.5, 0.9, 0, 0);
    // the toes hinge at the ball of the foot and bend as the heel lifts
    const toe = J(ankle, 0, -2.5, 9.6, 'toe' + S, j);
    put(toe, cyl(1.2, 11, 12), M.frame, 0, 0, 0, 0, 0, P / 2);
    for (let k = -1; k <= 1; k++) put(toe, plate(3.4, 2.4, 5, 0.6), M.armor2, k * 3.7, -0.1, 3);
    put(toe, plate(11, 0.8, 0.8, 0.2), M.hazard, 0, 1.2, 5.6);
    put(ankle, plate(7, 3, 4.5, 1), M.armor, 0, -2.4, -6.5);
  }
  // floodlights on the shoulders of the chest, a light inside the reactor
  const lamp = new THREE.SpotLight(0xffd8a0, 14000, 260, 0.42, 0.6, 2); lamp.position.set(0, 21, 8); chest.add(lamp); const tgt = new THREE.Object3D(); tgt.position.set(0, -10, 80); chest.add(tgt); lamp.target = tgt;
  const coreLight = new THREE.PointLight(0x6fd8ff, 260, 30, 2); coreLight.position.set(0, 9.5, 13); chest.add(coreLight);
  const thrustLight = new THREE.PointLight(0xff8a30, 0, 60, 2); thrustLight.position.set(0, -2, -14); chest.add(thrustLight);
  return { root, j, mats: M, core, visor, coreLight, thrustLight };
}
