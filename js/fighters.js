// The two giants: a jaeger-style robot and a kaiju. Jointed rigs built from many parts, realistic materials,
// procedural animation (walk cycles, keyframed attacks, staggers, death), hit detection and simple AI.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SHORE } from './world.js?v=1';

const rnd = (a, b) => a + Math.random() * (b - a);
const ease = (x) => x * x * (3 - 2 * x);
function canvasTex(w, h, draw, srgb = true, rep = 1) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }

// ------------------------------------------------------------------ materials
function robotMats() {
  // armour: brushed, scratched gunmetal with panel lines; a roughness map makes the scratches catch the light
  const panel = (g, w, h, base) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { const v = Math.random() * 30; g.fillStyle = `rgba(${v},${v},${v + 4},.08)`; g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 40, 1); } g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { const x = Math.random() * w, y = Math.random() * h; g.strokeRect(x, y, 40 + Math.random() * 120, 30 + Math.random() * 100); } for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(20,20,22,.8)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2, 0, 7); g.fill(); } };
  const map = canvasTex(512, 512, (g, w, h) => { panel(g, w, h, '#5d636b'); g.fillStyle = 'rgba(200,150,40,.85)'; for (let i = 0; i < 6; i++) { g.save(); g.translate(60 + i * 30, 380); g.rotate(-0.6); g.fillRect(0, 0, 14, 90); g.restore(); } for (let i = 0; i < 120; i++) { g.strokeStyle = `rgba(190,190,195,${Math.random() * 0.3})`; g.lineWidth = 1; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + rnd(-30, 30), y + rnd(-8, 8)); g.stroke(); } for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(70,40,20,${Math.random() * 0.35})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(4, 20), rnd(10, 50), 0, 0, 7); g.fill(); } }, true, 1);
  const rough = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(20,20,20,${Math.random() * 0.6})`; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + rnd(-40, 40), y + rnd(-10, 10)); g.stroke(); } for (let i = 0; i < 20; i++) { g.fillStyle = `rgba(230,230,230,${Math.random() * 0.4})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(10, 40), rnd(10, 40), 0, 0, 7); g.fill(); } }, false, 1);
  return {
    armor: new THREE.MeshStandardMaterial({ map, roughnessMap: rough, color: 0xffffff, metalness: 0.85, roughness: 0.55, envMapIntensity: 1.3 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x26292e, metalness: 0.8, roughness: 0.45, envMapIntensity: 1 }),
    piston: new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 1, roughness: 0.2, envMapIntensity: 1.5 }),
    paint: new THREE.MeshStandardMaterial({ color: 0x8a2a20, metalness: 0.5, roughness: 0.5, map }),
    glow: new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x55ccff, emissiveIntensity: 3 }),
    amber: new THREE.MeshStandardMaterial({ color: 0x301a00, emissive: 0xffa040, emissiveIntensity: 3 }),
  };
}
function kaijuMats() {
  // skin: dark, knobbly and wet; clearcoat gives the rain sheen
  const bump = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { const x = Math.random() * w, y = Math.random() * h, r = rnd(2, 14), grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, `rgba(255,255,255,${rnd(0.2, 0.6)})`); grd.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2); } for (let i = 0; i < 70; i++) { g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = rnd(1, 3); g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd(-25, 25); y += rnd(-25, 25); g.lineTo(x, y); } g.stroke(); } }, false, 3);
  const map = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#26302c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd(10, 60)},${rnd(20, 60)},${rnd(20, 50)},.25)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rnd(2, 18), 0, 7); g.fill(); } }, true, 3);
  // faint glowing veins under the skin
  const veins = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,200,255,.7)'; for (let i = 0; i < 26; i++) { g.lineWidth = rnd(1, 2.5); g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rnd(-30, 30); y += rnd(-30, 30); g.lineTo(x, y); } g.stroke(); } }, true, 3);
  return {
    skin: new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 3, emissiveMap: veins, emissive: 0x2a7aa0, emissiveIntensity: 0.6, color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.2 }),
    belly: new THREE.MeshPhysicalMaterial({ color: 0x3a3a30, bumpMap: bump, bumpScale: 2, roughness: 0.6, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    horn: new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.4, metalness: 0.1 }),
    tooth: new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.35 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x2a0a10, emissive: 0x3ad8ff, emissiveIntensity: 0, roughness: 0.6 }),
    spike: new THREE.MeshStandardMaterial({ color: 0x0c1a22, emissive: 0x3ad8ff, emissiveIntensity: 2.2, roughness: 0.3 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x200800, emissive: 0xff7a20, emissiveIntensity: 5 }),
  };
}
// organic shapes: a sphere pushed in and out by noise so nothing is perfectly smooth
function lumpy(rx, ry, rz, amp = 0.08, seg = 28) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), p = g.attributes.position, v = new THREE.Vector3(), o = rnd(0, 100);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 5.1 + o) * Math.sin(v.y * 4.3 + o * 1.3) * Math.sin(v.z * 6.7 + o * 0.7) + 0.5 * Math.sin(v.x * 11 + v.z * 9 + o); v.multiplyScalar(1 + amp * n); p.setXYZ(i, v.x * rx, v.y * ry, v.z * rz); }
  g.computeVertexNormals(); return g;
}
const J = (parent, x, y, z, name, map) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); map[name] = g; return g; };
const put = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
const rbox = (w, h, d, r = 0.8) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));

// ------------------------------------------------------------------ the robot
function buildRobot() {
  const M = robotMats(), j = {}, root = new THREE.Group(), body = J(root, 0, 36, 0, 'pelvis', j);
  put(body, rbox(17, 7, 11, 1.5), M.armor); put(body, rbox(12, 5, 13), M.frame, 0, -3, 0);
  const spine = J(body, 0, 3, 0, 'spine', j);
  put(spine, rbox(13, 9, 10), M.frame, 0, 4, 0);                       // abdomen, with pistons
  for (const s of [-1, 1]) put(spine, new THREE.CylinderGeometry(0.9, 0.9, 10, 10), M.piston, s * 5, 5, -4, 0.2, 0, 0);
  const chest = J(spine, 0, 9, 0, 'chest', j);
  put(chest, rbox(28, 16, 15, 2), M.armor, 0, 8, 0); put(chest, rbox(22, 6, 16, 1.5), M.paint, 0, 15, 0.5);
  put(chest, rbox(10, 12, 4, 1), M.frame, 0, 7, -8);                    // back pack
  for (const s of [-1, 1]) put(chest, new THREE.CylinderGeometry(1.6, 2, 9, 12), M.frame, s * 4, 9, -11, 0, 0, 0);   // exhausts
  const core = put(chest, new THREE.CylinderGeometry(3.6, 3.6, 2, 24), M.glow, 0, 8, 7.4, Math.PI / 2, 0, 0); core.castShadow = false;
  put(chest, new THREE.TorusGeometry(4.2, 0.7, 8, 24), M.piston, 0, 8, 7.6);
  for (const s of [-1, 1]) { const l = put(chest, new THREE.CylinderGeometry(1.1, 1.1, 1, 12), M.amber, s * 9, 13, 7.6, Math.PI / 2, 0, 0); l.castShadow = false; }
  const neck = J(chest, 0, 17, 0, 'head', j);
  put(neck, rbox(8, 7, 8, 1.5), M.armor, 0, 3.5, 0); const visor = put(neck, rbox(6.5, 1.3, 1, 0.4), M.glow, 0, 4, 4); visor.castShadow = false;
  put(neck, new THREE.ConeGeometry(0.8, 5, 6), M.frame, 3, 9, -1, 0, 0, -0.3);
  // arms
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    const sh = J(chest, s * 18, 12, 0, 'sh' + side, j);
    put(sh, rbox(13, 9, 15, 2), M.armor, s * 1.5, 3, 0); put(sh, rbox(11, 3, 13, 1), M.paint, s * 1.5, 7.5, 0);
    put(sh, new THREE.SphereGeometry(4.5, 16, 12), M.frame);
    put(sh, rbox(7, 15, 7, 1.2), M.armor, 0, -9, 0); put(sh, new THREE.CylinderGeometry(0.7, 0.7, 12, 8), M.piston, s * 3.8, -9, 2);
    const el = J(sh, 0, -17, 0, 'el' + side, j);
    put(el, new THREE.SphereGeometry(3.6, 14, 10), M.frame); put(el, rbox(8.5, 15, 8.5, 1.5), M.armor, 0, -8, 0); put(el, rbox(9, 4, 9.5, 1), M.paint, 0, -2, 0);
    const fist = J(el, 0, -17, 0, 'fist' + side, j);
    put(fist, rbox(8, 8, 8, 1.6), M.frame, 0, -2, 0); for (let k = 0; k < 4; k++) put(fist, rbox(1.7, 2.4, 5, 0.5), M.armor, -2.7 + k * 1.8, -2, 4);
  }
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    const hip = J(body, s * 7.5, -3, 0, 'hip' + side, j);
    put(hip, new THREE.SphereGeometry(4.2, 14, 10), M.frame); put(hip, rbox(9, 16, 9, 1.5), M.armor, 0, -9, 0); put(hip, new THREE.CylinderGeometry(0.8, 0.8, 13, 8), M.piston, s * 4.2, -9, -2);
    const kn = J(hip, 0, -17, 0, 'knee' + side, j);
    put(kn, rbox(7, 5, 6, 1.5), M.paint, 0, 0, 3.5); put(kn, rbox(8.5, 16, 8.5, 1.5), M.armor, 0, -8.5, 0);
    const an = J(kn, 0, -17, 0, 'ankle' + side, j);
    put(an, rbox(10, 3.6, 16, 1.2), M.frame, 0, -0.5, 2); put(an, rbox(9, 2, 6, 0.8), M.armor, 0, 1, 7);
  }
  // the robot's own floodlights
  const lamp = new THREE.SpotLight(0xffd8a0, 14000, 260, 0.42, 0.6, 2); lamp.position.set(0, 13, 8); j.chest.add(lamp); const tgt = new THREE.Object3D(); tgt.position.set(0, -10, 80); j.chest.add(tgt); lamp.target = tgt;
  const coreLight = new THREE.PointLight(0x55ccff, 1500, 40, 2); coreLight.position.set(0, 8, 12); j.chest.add(coreLight);
  return { root, j, mats: M, core, visor, coreLight };
}

// ------------------------------------------------------------------ the kaiju
function buildKaiju() {
  const M = kaijuMats(), j = {}, root = new THREE.Group(), pelvis = J(root, 0, 32, -18, 'pelvis', j);
  put(pelvis, lumpy(15, 13, 15, 0.08), M.skin);
  const torso = J(pelvis, 0, 6, 4, 'spine', j);
  put(torso, lumpy(19, 17, 21, 0.09), M.skin, 0, 10, 10, -0.35, 0, 0); put(torso, lumpy(13, 12, 15, 0.06), M.belly, 0, 4, 18, -0.4, 0, 0);
  const chest = J(torso, 0, 16, 22, 'chest', j);
  put(chest, lumpy(16, 14, 14, 0.1), M.skin, 0, 0, 0);
  // dorsal spikes along the back and tail, glowing at the edges
  const spikes = [];
  for (let i = 0; i < 7; i++) { const s = put(torso, new THREE.ConeGeometry(2.2 + (6 - i) * 0.25, 9 + (6 - i) * 1.2, 4), M.spike, 0, 22 - i * 2.4, 22 - i * 5.4, -0.5, 0, 0); s.scale.z = 0.35; spikes.push(s); }
  const neck = J(chest, 0, 6, 10, 'neck', j);
  put(neck, lumpy(9, 9, 11, 0.1), M.skin, 0, 2, 4, -0.5, 0, 0);
  const head = J(neck, 0, 5, 12, 'head', j);
  put(head, lumpy(8, 7, 13, 0.1), M.skin, 0, 1, 4); put(head, lumpy(6, 3, 10, 0.08), M.skin, 0, 0, 12);    // skull, snout
  for (const s of [-1, 1]) {
    put(head, lumpy(3, 1.5, 5, 0.1), M.horn, s * 5.5, 5, 4, 0, s * 0.3, 0);                                  // brow ridge
    put(head, new THREE.ConeGeometry(1.4, 11, 6), M.horn, s * 4, 7, -4, -1.1, 0, s * 0.35);                  // horns
    const e = put(head, new THREE.SphereGeometry(1.3, 10, 8), M.eye, s * 4.6, 3.2, 8); e.castShadow = false;
    for (let k = 0; k < 6; k++) put(head, new THREE.ConeGeometry(0.5, 2.6, 5), M.tooth, s * (2 + k * 0.45), -2.3, 10 + k * 2.2, Math.PI, 0, 0);
  }
  const mouthGlow = put(head, lumpy(4, 1.2, 9, 0.05), M.mouth, 0, -2.5, 12); mouthGlow.castShadow = false;
  const jaw = J(head, 0, -2.5, 3, 'jaw', j);
  put(jaw, lumpy(5.5, 2.4, 11, 0.1), M.skin, 0, -1.5, 8);
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) put(jaw, new THREE.ConeGeometry(0.45, 2.2, 5), M.tooth, s * (2 + k * 0.4), 0.6, 8 + k * 2.2);
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    const sh = J(chest, s * 13, -2, 4, 'sh' + side, j);
    put(sh, lumpy(5, 9, 5, 0.12), M.skin, s * 1, -6, 2, 0.4, 0, 0);
    const el = J(sh, s * 1, -13, 5, 'el' + side, j);
    put(el, lumpy(3.6, 8, 3.6, 0.12), M.skin, 0, -6, 2, 0.5, 0, 0);
    const hand = J(el, 0, -13, 5, 'hand' + side, j);
    put(hand, lumpy(3.4, 2.4, 4, 0.1), M.skin);
    for (let k = 0; k < 3; k++) put(hand, new THREE.ConeGeometry(0.7, 6, 6), M.horn, (k - 1) * 1.6, -2, 4, 1.9, 0, (k - 1) * 0.2);
  }
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    const hip = J(pelvis, s * 11, -2, 0, 'hip' + side, j);
    put(hip, lumpy(8, 13, 9, 0.1), M.skin, 0, -6, 3, 0.35, 0, 0);
    const kn = J(hip, 0, -14, 6, 'knee' + side, j);
    put(kn, lumpy(5, 9, 5.5, 0.1), M.skin, 0, -6, -3, -0.55, 0, 0);
    const an = J(kn, 0, -13, -6, 'ankle' + side, j);
    put(an, lumpy(4, 3.5, 4, 0.1), M.skin, 0, -2, 0);
    for (let k = 0; k < 3; k++) { put(an, lumpy(1.6, 1.4, 4, 0.1), M.skin, (k - 1) * 2.6, -4.2, 4, 0, (k - 1) * 0.3, 0); put(an, new THREE.ConeGeometry(0.6, 3, 5), M.horn, (k - 1) * 2.8, -4.5, 8.5, Math.PI / 2, 0, 0); }
  }
  // the tail: ten segments, each a joint, getting thinner, with spikes
  let parent = pelvis; j.tail = [];
  for (let i = 0; i < 10; i++) {
    const seg = J(parent, 0, i === 0 ? -1 : 0, i === 0 ? -12 : -7.4, 'tail' + i, j); j.tail.push(seg);
    const r = 9 - i * 0.75; put(seg, lumpy(r, r * 0.9, 5.5, 0.08, 18), M.skin, 0, 0, -3.5);
    if (i % 2 === 0 && i < 8) { const sp = put(seg, new THREE.ConeGeometry(1.4, 6 - i * 0.4, 4), M.spike, 0, r * 0.9, -3, -0.6, 0, 0); sp.scale.z = 0.35; spikes.push(sp); }
    parent = seg;
  }
  const eyeLight = new THREE.PointLight(0xff7a30, 600, 30, 2); eyeLight.position.set(0, 4, 14); j.head.add(eyeLight);
  const mouthLight = new THREE.PointLight(0x3ad8ff, 0, 60, 2); mouthLight.position.set(0, -2, 20); j.head.add(mouthLight);
  return { root, j, mats: M, spikes, mouthLight };
}

// ------------------------------------------------------------------ attacks: timing, hit point, damage, poses as keyframes
// pose: { joint: [rx, ry, rz] } ; special keys: lean (pitch the body), twist (yaw the upper body), dip (lower the hips), fwd (lunge speed)
const ROBOT_MOVES = {
  jab: { dur: 0.55, hit: [0.28, 0.42], at: 'fistL', dmg: 32, knock: 6, keys: [[0, { shL: [-0.6, 0, -0.2], elL: [-1.8, 0, 0], twist: 0 }], [0.3, { shL: [-1.55, 0, 0.1], elL: [-0.1, 0, 0], twist: 0.35, fwd: 25 }], [0.6, { shL: [-1.3, 0, 0], elL: [-0.4, 0, 0], twist: 0.25 }], [1, {}]] },
  cross: { dur: 0.75, hit: [0.36, 0.5], at: 'fistR', dmg: 48, knock: 10, keys: [[0, {}], [0.25, { shR: [-0.4, 0, 0.5], elR: [-1.9, 0, 0], twist: 0.45 }], [0.42, { shR: [-1.6, 0, -0.1], elR: [-0.05, 0, 0], twist: -0.55, lean: 0.25, fwd: 30 }], [0.7, { shR: [-1.3, 0, 0], elR: [-0.4, 0, 0], twist: -0.35 }], [1, {}]] },
  upper: { dur: 1.0, hit: [0.42, 0.58], at: 'fistR', dmg: 95, knock: 26, lift: true, keys: [[0, {}], [0.3, { shR: [0.5, 0, 0.3], elR: [-2.2, 0, 0], dip: 7, twist: 0.4, lean: 0.2 }], [0.5, { shR: [-2.6, 0, -0.2], elR: [-0.6, 0, 0], dip: -2, twist: -0.5, lean: -0.25, fwd: 22 }], [0.75, { shR: [-2.3, 0, 0], elR: [-0.6, 0, 0] }], [1, {}]] },
  kick: { dur: 0.95, hit: [0.4, 0.58], at: 'ankleR', dmg: 65, knock: 18, keys: [[0, {}], [0.3, { hipR: [-1.0, 0, 0], kneeR: [1.6, 0, 0], lean: -0.15 }], [0.48, { hipR: [-1.5, 0, 0], kneeR: [0.1, 0, 0], lean: -0.3, fwd: 18 }], [0.7, { hipR: [-0.8, 0, 0], kneeR: [1.0, 0, 0] }], [1, {}]] },
  plasma: { dur: 1.6, at: 'fistR', shot: 0.62, dmg: 150, keys: [[0, {}], [0.4, { shR: [-1.55, 0, 0], elR: [0, 0, 0], twist: -0.2, lean: -0.05 }], [0.7, { shR: [-1.5, 0, 0], elR: [0, 0, 0], twist: -0.2, lean: -0.2 }], [1, {}]] },
};
const KAIJU_MOVES = {
  swipe: { dur: 0.9, hit: [0.42, 0.58], at: 'handR', dmg: 52, knock: 12, keys: [[0, {}], [0.35, { shR: [-1.6, 0.6, 1.0], elR: [-0.6, 0, 0], twist: 0.5 }], [0.55, { shR: [-1.0, -0.8, -0.6], elR: [-0.2, 0, 0], twist: -0.6, fwd: 20 }], [1, {}]] },
  bite: { dur: 1.0, hit: [0.48, 0.6], at: 'head', dmg: 80, knock: 10, keys: [[0, {}], [0.4, { neck: [-0.5, 0, 0], head: [-0.4, 0, 0], jaw: [0.9, 0, 0], lean: -0.2 }], [0.55, { neck: [0.45, 0, 0], head: [0.2, 0, 0], jaw: [0.05, 0, 0], lean: 0.3, fwd: 32 }], [0.8, { jaw: [0.2, 0, 0] }], [1, {}]] },
  tail: { dur: 1.5, hit: [0.4, 0.7], at: 'tail8', dmg: 72, knock: 30, spin: true, keys: [[0, {}], [0.25, { lean: 0.1, dip: 3 }], [0.55, { lean: 0.15, dip: 3 }], [1, {}]] },
  charge: { dur: 1.7, hit: [0.45, 0.8], at: 'head', dmg: 90, knock: 34, keys: [[0, {}], [0.3, { lean: 0.35, neck: [0.4, 0, 0], head: [0.3, 0, 0], dip: 4 }], [0.45, { lean: 0.45, neck: [0.5, 0, 0], head: [0.4, 0, 0], fwd: 75 }], [0.8, { lean: 0.4, fwd: 60 }], [1, {}]] },
  acid: { dur: 2.4, breath: [0.3, 0.85], dps: 55, keys: [[0, {}], [0.2, { neck: [-0.4, 0, 0], head: [-0.3, 0, 0], jaw: [0.5, 0, 0], lean: -0.15 }], [0.3, { neck: [0.25, 0, 0], head: [0.1, 0, 0], jaw: [1.0, 0, 0], lean: 0.1 }], [0.85, { neck: [0.25, 0, 0], head: [0.1, 0, 0], jaw: [1.0, 0, 0], lean: 0.1 }], [1, {}]] },
  roar: { dur: 2.2, roar: 0.25, keys: [[0, {}], [0.2, { neck: [-0.7, 0, 0], head: [-0.5, 0, 0], jaw: [1.1, 0, 0], lean: -0.35, shL: [-1, 0, -0.8], shR: [-1, 0, 0.8] }], [0.85, { neck: [-0.7, 0.1, 0], head: [-0.6, 0, 0], jaw: [1.15, 0, 0], lean: -0.35, shL: [-1.1, 0, -0.9], shR: [-1.1, 0, 0.9] }], [1, {}]] },
};
function sampleKeys(keys, p) {
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (p >= keys[i][0] && p <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const k = b[0] === a[0] ? 1 : ease((p - a[0]) / (b[0] - a[0])), out = {};
  for (const key of new Set([...Object.keys(a[1]), ...Object.keys(b[1])])) {
    const va = a[1][key], vb = b[1][key];
    if (Array.isArray(va) || Array.isArray(vb)) { const A = va || [0, 0, 0], Bv = vb || [0, 0, 0]; out[key] = A.map((x, i) => x + (Bv[i] - x) * k); }
    else out[key] = (va || 0) + ((vb || 0) - (va || 0)) * k;
  }
  return out;
}

// ------------------------------------------------------------------ a fighter
export class Fighter {
  constructor(kind, scene) {
    this.kind = kind;
    const b = kind === 'robot' ? buildRobot() : buildKaiju();
    Object.assign(this, b);
    scene.add(this.root);
    this.maxHp = kind === 'robot' ? 1400 : 1700; this.hp = this.maxHp;
    this.pos = new THREE.Vector3(kind === 'robot' ? 0 : 0, 0, kind === 'robot' ? 90 : -40); this.yaw = kind === 'robot' ? Math.PI : 0;
    this.vel = new THREE.Vector3(); this.speed = 0; this.phase = 0; this.act = null; this.stun = 0; this.down = 0; this.block = false; this.alive = true; this.dash = 0;
    this.R = kind === 'robot' ? 13 : 20; this.cd = {}; this.rot = {}; this.lastStep = 0; this.events = [];
    this.moves = kind === 'robot' ? ROBOT_MOVES : KAIJU_MOVES;
    this.root.traverse((o) => { if (o.isGroup && o !== this.root) this.rot[o.name || ''] = 0; });
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  wp(name, off = [0, 0, 0]) { const o = this.j[name]; this.root.updateMatrixWorld(true); return o.localToWorld(new THREE.Vector3(...off)); }
  face() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  can() { return this.alive && !this.act && this.stun <= 0 && this.down <= 0; }
  start(name) { if (!this.can() || (this.cd[name] || 0) > 0) return false; const m = this.moves[name]; this.act = { name, m, t: 0, hitDone: false, shotDone: false }; this.cd[name] = { plasma: 7, acid: 6, roar: 9, charge: 4.5, tail: 3 }[name] || 0; this.emit('attack', { name }); return true; }
  // the opponent's body, as a vertical capsule
  hitTest(opp, p, r) { const dy = Math.max(10, Math.min(opp.kind === 'robot' ? 60 : 55, p.y)); const d = Math.hypot(p.x - opp.pos.x, p.z - opp.pos.z, (p.y - dy) * 0.6); return d < opp.R + r; }
  takeHit(dmg, from, knock, o = {}) {
    if (!this.alive) return 0;
    const dir = this.pos.clone().sub(from.pos).setY(0).normalize();
    // blocking: in front, mostly stopped
    const facing = this.face().dot(dir.clone().negate()) > 0.3;
    const blocked = this.block && facing && !o.unblockable;
    const d = blocked ? dmg * 0.18 : dmg;
    this.hp = Math.max(0, this.hp - d);
    this.vel.addScaledVector(dir, (blocked ? knock * 0.3 : knock) * 1.7);
    if (!blocked) { this.stun = Math.max(this.stun, Math.min(1.1, 0.25 + knock / 40)); this.act = null; if (knock >= 25 && Math.random() < 0.6) this.down = 2.2; this.hitFlash = 1; }
    if (this.hp <= 0) this.die();
    return blocked ? -d : d;
  }
  die() { this.alive = false; this.act = null; this.deathT = 0; this.emit('death'); }

  // ---------------------------------------------------------------- per frame
  update(dt, opp, input, world) {
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.stun -= dt; this.down -= dt; this.dash = Math.max(0, this.dash - dt); this.hitFlash = Math.max(0, (this.hitFlash || 0) - dt * 3);
    const toOpp = opp.pos.clone().sub(this.pos).setY(0), dist = toOpp.length();
    // movement from input (player or AI): { move: -1..1, strafe: -1..1, face: true }
    let want = new THREE.Vector3();
    if (this.alive && this.stun <= 0 && this.down <= 0 && (!this.act || this.act.m.spin)) {
      const f = toOpp.clone().normalize(), side = new THREE.Vector3(f.z, 0, -f.x);
      want.addScaledVector(f, input.move || 0).addScaledVector(side, input.strafe || 0);
      if (want.lengthSq() > 1) want.normalize();
      const targetYaw = Math.atan2(toOpp.x, toOpp.z);
      let dy = Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw));
      if (!this.act) this.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, dy));
    }
    const maxSp = (this.kind === 'robot' ? 13 : 15) * (this.block ? 0.4 : 1) * (this.dash > 0 ? 3.2 : 1);
    const desired = want.multiplyScalar(maxSp);
    this.speed += (desired.length() - this.speed) * (1 - Math.exp(-dt * 3));
    if (desired.lengthSq() > 0.01) this.moveDir = desired.clone().normalize();
    const mv = (this.moveDir || this.face()).clone().multiplyScalar(this.speed * dt);
    // attacks: advance, lunge, check hits
    let pose = {};
    if (this.act) {
      const a = this.act, m = a.m; a.t += dt; const p = Math.min(1, a.t / m.dur);
      pose = sampleKeys(m.keys, p);
      if (pose.fwd) mv.addScaledVector(this.face(), pose.fwd * dt * (dist > this.R + opp.R + 4 ? 1 : 0.1));
      if (m.spin) { const s = p < 0.3 ? 0 : p > 0.75 ? 1 : (p - 0.3) / 0.45; this.spinYaw = s * Math.PI * 2; }
      if (m.hit && !a.hitDone && p >= m.hit[0] && p <= m.hit[1]) {
        let hp = m.at === 'head' ? this.wp('head', [0, 0, 10]) : this.wp(m.at, [0, -3, 0]);
        if (m.spin) { for (const seg of this.j.tail) { const q = seg.localToWorld(new THREE.Vector3(0, 0, -3)); if (this.hitTest(opp, q, 9)) { hp = q; break; } } }
        if (this.hitTest(opp, hp, m.spin ? 9 : 8)) { a.hitDone = true; const dealt = opp.takeHit(m.dmg * (this.rage ? 1.15 : 1), this, m.knock); this.emit('hit', { point: hp, dmg: dealt, move: a.name, heavy: m.knock >= 20 }); }
      }
      if (m.shot && !a.shotDone && p >= m.shot) { a.shotDone = true; this.emit('shoot', { from: this.wp('fistR', [0, -6, 0]), dir: opp.pos.clone().setY(40).sub(this.wp('fistR')).normalize(), dmg: m.dmg }); }
      if (m.breath && p >= m.breath[0] && p <= m.breath[1]) {
        const mouth = this.wp('head', [0, -2, 22]), dir = this.wp('head', [0, -3, 40]).sub(mouth).normalize();
        this.emit('breath', { from: mouth, dir });
        const rel = opp.pos.clone().setY(40).sub(mouth), along = rel.dot(dir);
        if (along > 0 && along < 110 && rel.clone().sub(dir.clone().multiplyScalar(along)).length() < 14 + along * 0.12) { const d = opp.takeHit(m.dps * dt, this, 0.5, { unblockable: false }); this.emit('burn', { point: opp.pos.clone().setY(40), dmg: d }); if (opp.stun > 0.3) opp.stun = 0.3; }
      }
      if (m.roar && !a.roared && p >= m.roar) { a.roared = true; this.emit('roar'); }
      if (p >= 1) { this.act = null; this.spinYaw = 0; }
    }
    // knockback slides, slows
    mv.addScaledVector(this.vel, dt); this.vel.multiplyScalar(Math.exp(-dt * 2.2));
    this.pos.add(mv);
    // keep apart from each other
    const sep = this.pos.clone().sub(opp.pos).setY(0), sd = sep.length(), minD = this.R + opp.R;
    if (sd < minD && sd > 0.01) this.pos.addScaledVector(sep.normalize(), (minD - sd) * 0.5);
    this.pos.x = Math.max(-420, Math.min(420, this.pos.x)); this.pos.z = Math.max(SHORE - 160, Math.min(520, this.pos.z));
    // buildings in the way come down
    const probes = [[this.pos, this.R * 0.85]];
    if (this.down > 0 || !this.alive) probes.push([this.pos.clone().addScaledVector(this.face(), -38), this.R]);
    if (this.act && this.act.m.spin && this.act.t > this.act.m.dur * 0.3) for (const k of [4, 7, 9]) probes.push([this.j.tail[k].localToWorld(new THREE.Vector3()), 9]);
    for (const b of world.buildings) {
      if (!b.alive) continue;
      for (const [p, r] of probes) {
        const dx = Math.max(Math.abs(p.x - b.x) - b.w / 2, 0), dz = Math.max(Math.abs(p.z - b.z) - b.d / 2, 0);
        if (Math.hypot(dx, dz) < r) { world.collapse(b); this.emit('smash', { b }); if (p === this.pos) this.vel.multiplyScalar(0.6); break; }
      }
    }
    // walking: a phase that drives the legs; each footfall shakes the ground
    const gait = Math.min(1.4, this.speed / 10);
    this.phase += dt * (1.2 + gait * 2.4) * (this.speed > 0.5 ? 1 : 0);
    const stepNow = Math.floor(this.phase / Math.PI);
    if (stepNow !== this.lastStep && this.speed > 1.5) { this.lastStep = stepNow; const side = stepNow % 2 ? 'L' : 'R'; this.emit('step', { p: this.wp('ankle' + side), power: this.kind === 'kaiju' ? 1.2 : 1, water: this.pos.z < SHORE }); }
    this.animate(dt, pose, gait, opp);
  }

  // ---------------------------------------------------------------- the pose for this frame
  animate(dt, act, gait, opp) {
    const j = this.j, s = Math.sin(this.phase), c = Math.cos(this.phase), robot = this.kind === 'robot';
    const T = {};
    const set = (n, x = 0, y = 0, z = 0) => { T[n] = [x, y, z]; };
    // breathing / servo idle
    const br = Math.sin(performance.now() / 1000 * (robot ? 1.2 : 0.9));
    // walk cycle
    const sw = s * 0.55 * gait;
    if (robot) {
      set('hipL', -sw, 0, 0); set('hipR', sw, 0, 0); set('kneeL', Math.max(0, -c) * 0.9 * gait + 0.08, 0, 0); set('kneeR', Math.max(0, c) * 0.9 * gait + 0.08, 0, 0);
      set('ankleL', 0, 0, 0); set('ankleR', 0, 0, 0);
      // guard: fists up, ready
      const guard = this.block ? 1 : 0.65;
      set('shL', -0.9 * guard + sw * 0.3, 0, -0.15); set('shR', -0.9 * guard - sw * 0.3, 0, 0.15); set('elL', -1.7 * guard, 0, 0); set('elR', -1.7 * guard, 0, 0);
      if (this.block) { set('shL', -1.6, 0.4, 0.2); set('shR', -1.6, -0.4, -0.2); set('elL', -2.2, 0, 0); set('elR', -2.2, 0, 0); }
      set('chest', 0.04 * br, s * 0.05 * gait, 0); set('head', 0, 0, 0); set('spine', 0.05, 0, 0); set('pelvis', 0, 0, 0);
    } else {
      set('hipL', -sw * 0.8 - 0.2, 0, 0); set('hipR', sw * 0.8 - 0.2, 0, 0); set('kneeL', Math.max(0, -c) * 0.7 * gait + 0.25, 0, 0); set('kneeR', Math.max(0, c) * 0.7 * gait + 0.25, 0, 0);
      set('ankleL', -0.05, 0, 0); set('ankleR', -0.05, 0, 0);
      set('shL', -0.5 + sw * 0.25, 0, -0.3); set('shR', -0.5 - sw * 0.25, 0, 0.3); set('elL', -0.6, 0, 0); set('elR', -0.6, 0, 0); set('handL', 0.3, 0, 0); set('handR', 0.3, 0, 0);
      set('spine', 0.15 + br * 0.02, s * 0.06 * gait, 0); set('chest', 0, 0, 0); set('neck', -0.1 + br * 0.04, 0, 0); set('head', 0.1, 0, 0); set('jaw', 0.08 + Math.max(0, br) * 0.05, 0, 0); set('pelvis', 0, 0, 0);
      // the tail sways, follows behind
      const tw = performance.now() / 1000;
      (j.tail || []).forEach((t, i) => set('tail' + i, -0.06 + Math.sin(tw * 1.3 - i * 0.6) * 0.03, Math.sin(tw * 1.1 - i * 0.5) * (0.06 + gait * 0.05) * (1 + i * 0.15), 0));
    }
    // the action's pose wins over the walk where it says something
    for (const [k, v] of Object.entries(act)) if (Array.isArray(v)) T[k] = v;
    // hit reaction and knockdown
    let lean = (act.lean || 0) + (robot ? 0.04 : 0.15), twist = act.twist || 0, dip = act.dip || 0;
    if (this.stun > 0 && this.down <= 0) { lean -= 0.35 * Math.min(1, this.stun * 2); twist += Math.sin(this.stun * 20) * 0.08; }
    // the root: position, facing (plus a tail spin), crouch, bob, a fall when knocked down or dead
    const bob = Math.abs(s) * 1.4 * gait;
    this.root.position.set(this.pos.x, (this.pos.z < SHORE ? -6 : 0) - dip - bob * 0.6, this.pos.z);
    this.root.rotation.y = this.yaw + (this.spinYaw || 0);
    let fall = 0;
    if (this.down > 0) { const k = this.down > 1.7 ? (2.2 - this.down) / 0.5 : this.down < 0.6 ? this.down / 0.6 : 1; fall = ease(Math.max(0, Math.min(1, k))); }
    if (!this.alive) { this.deathT += dt; fall = ease(Math.min(1, this.deathT / 1.8)); }
    const kk = 1 - Math.exp(-dt * (this.act ? 18 : 10));
    this.root.rotation.x = (this.root.rotation.x || 0) + ((-fall * 1.45) - (this.root.rotation.x || 0)) * Math.min(1, dt * 6);
    if (fall > 0) { this.root.position.y -= fall * 6; }
    for (const [name, g] of Object.entries(j)) {
      if (Array.isArray(g)) continue;
      const t = T[name]; if (!t) continue;
      let [x, y, z] = t;
      if (name === 'spine') { x += lean; y += twist; }
      if (name === 'chest' && robot) y += twist * 0.5;
      g.rotation.x += (x - g.rotation.x) * kk; g.rotation.y += (y - g.rotation.y) * kk; g.rotation.z += (z - g.rotation.z) * kk;
    }
    // the glow: robot core pulses (dims with damage), kaiju spikes flare when it is angry, mouth lights for acid
    const hpK = this.hp / this.maxHp;
    if (robot) { const flick = hpK < 0.3 ? (Math.random() < 0.08 ? 0.2 : 1) : 1; this.mats.glow.emissiveIntensity = (2.2 + Math.sin(performance.now() / 300) * 0.5) * flick * (this.alive ? 1 : 0.05); this.coreLight.intensity = 1500 * flick * (this.alive ? 1 : 0); }
    else {
      const ang = this.act && (this.act.name === 'roar' || this.act.name === 'acid') ? 1 : 0;
      this.mats.spike.emissiveIntensity += ((this.alive ? 2 + ang * 4 + (1 - hpK) * 1.5 : 0.1) - this.mats.spike.emissiveIntensity) * Math.min(1, dt * 5);
      const breath = this.act && this.act.name === 'acid' ? 1 : 0;
      this.mats.mouth.emissiveIntensity += (breath * 6 - this.mats.mouth.emissiveIntensity) * Math.min(1, dt * 6); this.mouthLight.intensity = this.mats.mouth.emissiveIntensity * 1200;
    }
  }
}

// ------------------------------------------------------------------ the brain for a computer-controlled fighter
export function think(me, opp, dt) {
  const inp = { move: 0, strafe: 0 }; if (!me.alive || !opp.alive) return inp;
  me.ai = me.ai || { t: 0, strafe: 1, plan: null };
  const A = me.ai; A.t -= dt;
  const d = me.pos.distanceTo(opp.pos) - me.R - opp.R;
  if (A.t <= 0) { A.t = rnd(0.6, 1.6); A.strafe = Math.random() < 0.5 ? -1 : 1; A.mood = Math.random(); }
  if (me.kind === 'kaiju') {
    if (me.hp < me.maxHp * 0.35) me.rage = true;
    if (!me.introDone) { me.introDone = me.start('roar'); return inp; }
    if (d > 60) { inp.move = 1; if (Math.random() < dt * 0.4) me.start('charge'); if (Math.random() < dt * 0.3 && d < 110) me.start('acid'); }
    else if (d > 14) { inp.move = 0.8; inp.strafe = A.strafe * 0.3; if (Math.random() < dt * 0.5) me.start(d < 40 ? 'acid' : 'charge'); }
    else { inp.move = 0.1; inp.strafe = A.strafe * 0.4; if (Math.random() < dt * (me.rage ? 2.6 : 1.8)) me.start(['swipe', 'swipe', 'bite', 'tail', 'bite'][Math.floor(Math.random() * 5)]); if (Math.random() < dt * 0.08) me.start('roar'); }
  } else {
    me.block = false;
    if (opp.act && d < 30 && opp.act.t < opp.act.m.dur * 0.4 && Math.random() < 0.5 * (A.mood || 0.5)) me.block = true;
    if (d > 70) { inp.move = 1; if (Math.random() < dt * 0.6) me.start('plasma'); if (Math.random() < dt * 0.4) me.dash = 0.5; }
    else if (d > 10) { inp.move = 0.85; inp.strafe = A.strafe * 0.35; if (d > 35 && Math.random() < dt * 0.25) me.start('plasma'); }
    else { inp.move = A.mood < 0.3 ? -0.5 : 0.1; inp.strafe = A.strafe * 0.5; if (!me.block && Math.random() < dt * 2.4) me.start(['jab', 'jab', 'cross', 'upper', 'kick', 'cross'][Math.floor(Math.random() * 6)]); }
  }
  return inp;
}
