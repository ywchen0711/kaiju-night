// Where they fight. Three stages share one layout (open ground to the north, z < SHORE, a city to the south):
//   harbour - the city at night in a storm: wet streets, lit towers, the bay, rain, lightning
//   desert  - an oil refinery at dusk: sand, storage tanks, warehouses, flare stacks, blowing dust, a low sun
//   snow    - a mountain town on a frozen lake at night: snowed-in houses, pine trees, a hotel or two, falling snow
// Everything is built into one group so a stage can be torn down and another built (every fight gets a fresh city).
// Units are metres.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

const rnd = (a, b) => a + Math.random() * (b - a);
export const SHORE = -70;   // land is z > SHORE
// the current stage, read by the fighters (do they wade in water beyond the shore?)
export const STAGE = { id: 'harbour', water: true };
const STAGES = {
  harbour: { bg: 0x05070b, fog: [0x0a0e15, 0.0026], skyA: [0.012, 0.016, 0.024], skyB: [0.05, 0.055, 0.07], glow: [0.22, 0.12, 0.06], sun: null,
    hemi: [0x2a3a55, 0x0a0806, 0.35], key: [0x8899cc, 0.55, [-200, 400, -300]], storm: true, precip: 'rain', ground: 'asphalt', water: true, win: 1.1, env: [0x020306, 0.08, 0.58], heliK: 1 },
  desert: { bg: 0x3a241a, fog: [0x6e4a36, 0.0019], skyA: [0.07, 0.05, 0.09], skyB: [0.42, 0.22, 0.12], glow: [0.95, 0.42, 0.14], sun: { dir: [-0.42, 0.1, -0.9], col: [1, 0.62, 0.3] },
    hemi: [0xffa878, 0x3a2414, 0.75], key: [0xffa264, 2.6, [-260, 70, -560]], storm: false, precip: 'dust', ground: 'sand', water: false, win: 0.45, env: [0x2a1a12, 0.07, 0.09], heliK: 0.35 },
  snow: { bg: 0x0b0f18, fog: [0x1c2432, 0.0034], skyA: [0.02, 0.026, 0.042], skyB: [0.085, 0.095, 0.125], glow: [0.13, 0.09, 0.07], sun: null,
    hemi: [0x5a6c90, 0x262a33, 0.62], key: [0xb0c0ee, 0.95, [-200, 400, -300]], storm: false, precip: 'snow', ground: 'snow', water: false, win: 1.3, env: [0x060912, 0.08, 0.6], heliK: 1 },
};

// ------------------------------------------------------------------ procedural textures
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
// a facade: concrete or glass, rows of windows, some lit (warm, cool, flickering TV blue), the emissive map lights them
function facade(seed, glass) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const W = 256, H = 512, cols = glass ? 10 : 8, rows = 26, cw = W / cols, rh = H / rows;
  const base = canvas(W, H, (g) => {
    g.fillStyle = glass ? '#161a20' : '#24252a'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 60},${r() < 0.5 ? 0 : 60},${r() < 0.5 ? 0 : 60},${r() * 0.08})`; g.fillRect(r() * W, r() * H, r() * 20, r() * 40); }   // grime
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { g.fillStyle = glass ? '#0c1016' : '#101215'; g.fillRect(x * cw + 2, y * rh + 3, cw - 4, rh - 6); }
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < rows; y++) g.fillRect(0, y * rh, W, 2);
  });
  const lit = canvas(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (r() > (glass ? 0.32 : 0.24)) continue;
      const k = r(), col = k < 0.55 ? `rgb(${200 + r() * 55},${150 + r() * 50},${80 + r() * 40})` : k < 0.85 ? `rgb(${170 + r() * 40},${190 + r() * 40},${210 + r() * 45})` : `rgb(${80},${120 + r() * 60},${220})`;
      const grd = g.createLinearGradient(0, y * rh, 0, (y + 1) * rh); grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,.6)');
      g.fillStyle = grd; g.fillRect(x * cw + 2, y * rh + 3, cw - 4, rh - 6);
      if (r() < 0.3) { g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x * cw + 2 + (cw - 4) * r(), y * rh + 3, (cw - 4) * 0.4, rh - 6); }   // a curtain, a figure
    }
  });
  const T = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: T(base, true), emissiveMap: T(lit, true) };
}
// wet asphalt: dark, with puddles that are almost mirrors
function asphalt() {
  const N = 512;
  const col = canvas(N, N, (g) => { g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, N, N); for (let i = 0; i < 6000; i++) { const v = 20 + Math.random() * 25; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(Math.random() * N, Math.random() * N, 2, 2); } for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let x = Math.random() * N, y = Math.random() * N; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rnd(-30, 30); y += rnd(-30, 30); g.lineTo(x, y); } g.stroke(); } });
  // puddles: clusters of overlapping soft blobs, tiled sparsely so they don't repeat as a pattern
  const rough = canvas(N, N, (g) => { g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, N, N); for (let i = 0; i < 9; i++) { const cx = Math.random() * N, cy = Math.random() * N, R = rnd(30, 80); for (let k = 0; k < 7; k++) { const x = cx + rnd(-R, R), y = cy + rnd(-R, R) * 0.6, r = rnd(R * 0.3, R * 0.7), grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(14,14,14,.9)'); grd.addColorStop(0.6, 'rgba(30,30,30,.6)'); grd.addColorStop(1, 'rgba(30,30,30,0)'); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2); } } });
  const T = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const rt = T(rough); rt.repeat.set(9, 9); return { map: T(col, true), roughnessMap: rt };
}
// sand: warm, grainy, with wind ripples; snow: trampled white with blue shadows
function sand() {
  const N = 512;
  const col = canvas(N, N, (g) => { g.fillStyle = '#8a6a4c'; g.fillRect(0, 0, N, N); for (let i = 0; i < 9000; i++) { const v = rnd(-22, 22); g.fillStyle = `rgb(${138 + v},${106 + v * 0.9},${76 + v * 0.7})`; g.fillRect(Math.random() * N, Math.random() * N, 2, 2); }
    for (let y = 0; y < N; y += rnd(9, 16)) { g.strokeStyle = 'rgba(60,40,24,.18)'; g.lineWidth = rnd(1, 3); g.beginPath(); for (let x = 0; x <= N; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 4); g.stroke(); }
    for (let i = 0; i < 40; i++) { const x = rnd(0, N), y = rnd(0, N), r = rnd(20, 70), grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(40,28,18,.2)'); grd.addColorStop(1, 'rgba(40,28,18,0)'); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2); } });
  const t = new THREE.CanvasTexture(col); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return { map: t };
}
function snowTex() {
  const N = 512;
  const col = canvas(N, N, (g) => { g.fillStyle = '#c9d2de'; g.fillRect(0, 0, N, N); for (let i = 0; i < 7000; i++) { const v = rnd(-18, 14); g.fillStyle = `rgb(${200 + v},${210 + v},${224 + v})`; g.fillRect(Math.random() * N, Math.random() * N, 2, 2); }
    for (let i = 0; i < 60; i++) { const x = rnd(0, N), y = rnd(0, N), r = rnd(15, 60), grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(90,110,140,.22)'); grd.addColorStop(1, 'rgba(90,110,140,0)'); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(110,125,150,.25)'; g.lineWidth = rnd(3, 7); g.beginPath(); let x = rnd(0, N), y = rnd(0, N); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd(-40, 40); y += rnd(10, 40); g.lineTo(x, y); } g.stroke(); } });
  const t = new THREE.CanvasTexture(col); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 70); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return { map: t };
}
// a soft glow sprite texture
export const glowTex = (() => { let t = null; return () => t || (t = new THREE.CanvasTexture(canvas(64, 64, (g) => { const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); }))); })();

// ------------------------------------------------------------------ the world
export function buildWorld(scene, renderer, q, stageId = 'harbour') {
  const S = STAGES[stageId] || STAGES.harbour; STAGE.id = STAGES[stageId] ? stageId : 'harbour'; STAGE.water = S.water;
  const root = new THREE.Group(); scene.add(root);
  const W = { buildings: [], helis: [], lights: [], flares: [], flash: 0, t: 0, stage: STAGE.id, precip: S.precip };
  scene.background = new THREE.Color(S.bg);
  scene.fog = new THREE.FogExp2(S.fog[0], S.fog[1]);

  // sky: clouds lit from below by the city (and by lightning in the storm); a low sun at dusk
  const v3 = (a) => new THREE.Vector3(...a);
  const skyU = { uTime: { value: 0 }, uFlash: { value: 0 }, uA: { value: v3(S.skyA) }, uB: { value: v3(S.skyB) }, uGlow: { value: v3(S.glow) }, uSunDir: { value: v3(S.sun ? S.sun.dir : [0, -1, 0]).normalize() }, uSunCol: { value: v3(S.sun ? S.sun.col : [0, 0, 0]) } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform float uTime, uFlash; uniform vec3 uA, uB, uGlow, uSunDir, uSunCol;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
      void main(){
        float y = vP.y; vec2 uv = vP.xz/max(y+.35,.08)*1.6 + vec2(uTime*.01, uTime*.004);
        float c = fbm(uv*1.4);
        vec3 col = mix(uA, uB, c);
        col += uGlow * pow(1.-clamp(y,0.,1.), 6.) * (.6 + .4*c);                // the glow of the city (or the sunset) on the clouds
        float sd = max(dot(normalize(vP), uSunDir), 0.);
        col += uSunCol * (pow(sd, 900.) * 6. + pow(sd, 14.) * .45 * (1. - c * .5));   // the sun's disc and its haze
        col += vec3(.55,.62,.8) * uFlash * (.35 + c);                          // lightning inside the clouds
        gl_FragColor = vec4(col, 1.);
      }` }));
  root.add(sky);

  // light: a faint moon through the clouds (or the low sun), a fill from the sky, and lightning in the storm
  const hemi = new THREE.HemisphereLight(S.hemi[0], S.hemi[1], S.hemi[2]); root.add(hemi);
  const moon = new THREE.DirectionalLight(S.key[0], S.key[1]); moon.position.set(...S.key[2]); moon.castShadow = q.shadows;
  moon.shadow.mapSize.set(q.shadowSize, q.shadowSize); Object.assign(moon.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 50, far: 1200 }); moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.5;
  root.add(moon, moon.target);
  W.moon = moon; W.hemi = hemi; W.skyU = skyU;

  // reflections: a dark city panorama rendered once into an environment map
  const env = new THREE.Scene(); env.background = new THREE.Color(S.env[0]);
  for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, h = rnd(10, 60), m = new THREE.Mesh(new THREE.PlaneGeometry(rnd(8, 30), h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random() < 0.7 ? S.env[1] : S.env[2], 0.6, rnd(0.2, 0.55)), side: THREE.DoubleSide })); m.position.set(Math.cos(a) * 200, h / 2 - 10, Math.sin(a) * 200); m.lookAt(0, h / 2 - 10, 0); env.add(m); }
  if (S.sun) { const sunM = new THREE.Mesh(new THREE.PlaneGeometry(300, 120), new THREE.MeshBasicMaterial({ color: 0xff9a50, side: THREE.DoubleSide })); sunM.position.set(S.sun.dir[0] * 200, 30, S.sun.dir[2] * 200); sunM.lookAt(0, 30, 0); env.add(sunM); }
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose();

  // ground: wet asphalt on land and the bay beyond the quay; sand all the way to the horizon; snow down to a frozen lake
  const gMat = S.ground === 'asphalt' ? new THREE.MeshStandardMaterial({ ...asphalt(), color: 0xffffff, metalness: 0.1, roughness: 1, envMapIntensity: 1.4 })
    : S.ground === 'sand' ? new THREE.MeshStandardMaterial({ ...sand(), color: 0xffffff, roughness: 0.97, metalness: 0, envMapIntensity: 0.4 })
    : new THREE.MeshStandardMaterial({ ...snowTex(), color: 0xffffff, roughness: 0.78, metalness: 0, envMapIntensity: 0.7 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, S.ground === 'sand' ? 3400 : 2000), gMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, S.ground === 'sand' ? SHORE + 300 : SHORE + 1000); ground.receiveShadow = true; root.add(ground);
  // the quay wall (a stone embankment along the lake in the snow)
  if (S.ground !== 'sand') { const quay = new THREE.Mesh(new THREE.BoxGeometry(3000, 12, 6), new THREE.MeshStandardMaterial({ color: S.ground === 'snow' ? 0x5a606a : 0x2a2c30, roughness: 0.9 })); quay.position.set(0, S.ground === 'snow' ? -5.4 : -4, SHORE); root.add(quay); }
  if (S.ground === 'snow') {
    // the frozen lake: grey-blue ice with a little shine, drifts of snow on it
    const ice = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1600), new THREE.MeshPhysicalMaterial({ color: 0x6a8098, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.2 }));
    ice.rotation.x = -Math.PI / 2; ice.position.set(0, -0.05, SHORE - 800); ice.receiveShadow = true; root.add(ice);
    const drift = new THREE.MeshStandardMaterial({ ...snowTex(), roughness: 0.85 });
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(rnd(10, 40), 18), drift); m.rotation.x = -Math.PI / 2; m.scale.y = rnd(0.3, 0.7); m.position.set(rnd(-600, 600), 0.02 + i * 0.002, SHORE - rnd(20, 600)); m.receiveShadow = true; root.add(m); }
  } else if (S.ground === 'sand') {
    // dunes beyond the refinery
    const dune = new THREE.MeshStandardMaterial({ ...sand(), roughness: 0.97 });
    for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), dune); m.scale.set(rnd(80, 200), rnd(10, 34), rnd(40, 90)); m.position.set(rnd(-900, 900), -2, SHORE - rnd(250, 1100)); m.receiveShadow = true; root.add(m); }
  } else if (q.water) {
    const wn = new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    const water = new Water(new THREE.PlaneGeometry(3000, 1600), { textureWidth: q.waterRes, textureHeight: q.waterRes, waterNormals: wn, sunDirection: new THREE.Vector3(-0.3, 0.6, -0.5).normalize(), sunColor: 0x6a7a99, waterColor: 0x02080e, distortionScale: 4, fog: true });
    water.rotation.x = -Math.PI / 2; water.position.set(0, -1.2, SHORE - 800); root.add(water); W.water = water;
  } else {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1600), new THREE.MeshStandardMaterial({ color: 0x02080e, roughness: 0.15, metalness: 0.6 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -1.2, SHORE - 800); root.add(water);
  }

  // the harbour: container stacks and a quay crane with warning lights
  const contMat = [0x7a2a1e, 0x1e3f6a, 0x2f5a2f, 0x6a5a1e, 0x4a4a52].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.4 }));
  const cont = new THREE.BoxGeometry(12, 2.6, 2.5);
  if (S.ground !== 'snow') for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(cont, contMat[i % contMat.length]); const row = Math.floor(i / 20), col = i % 20; m.position.set(-420 + col * 13 + (row % 2) * 4, 1.3 + (i % 3) * 2.6, SHORE + 20 + row * 3); m.castShadow = m.receiveShadow = true; root.add(m); }
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6, metalness: 0.7 }), red = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  if (stageId === 'harbour') for (const x of [-330, -250, 300]) {
    const g = new THREE.Group(); g.position.set(x, 0, SHORE + 8);
    for (const dx of [-8, 8]) for (const dz of [-6, 6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 50, 1.5), steel); leg.position.set(dx, 25, dz); g.add(leg); }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 110), steel); boom.position.set(0, 52, -30); g.add(boom);
    const top = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 14), steel); top.position.set(0, 50, 0); g.add(top);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), red); lamp.position.set(0, 56, -84); lamp.userData.blink = Math.random(); g.add(lamp); W.lights.push(lamp);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); root.add(g);
  }

  // the city: blocks of towers; near the waterfront they are lower, so there is room to fight (and things to smash)
  const tex = [facade(7, false), facade(31, true), facade(97, false), facade(1234, true)];
  // in the desert the walls are sun-bleached concrete and corrugated metal, not dark glass
  const mats = tex.map((t, i) => new THREE.MeshStandardMaterial(S.ground === 'sand' ? { emissiveMap: t.emissiveMap, emissive: 0xffd0a0, emissiveIntensity: S.win, color: [0xb09478, 0x8a8478, 0xc0a488, 0x9a8a70][i], roughness: 0.9, metalness: i % 2 ? 0.4 : 0.05 }
    : { ...t, emissive: 0xffffff, emissiveIntensity: S.win, roughness: i % 2 ? 0.25 : 0.85, metalness: i % 2 ? 0.6 : 0.1, envMapIntensity: 0.8 }));
  const roofMat = new THREE.MeshStandardMaterial({ color: S.ground === 'snow' ? 0xdfe6f0 : S.ground === 'sand' ? 0x6a5444 : 0x15171b, roughness: 0.9 });
  const BLOCK = 64, ROAD = 22;
  // the plaza where the fight starts stays open
  // the plaza where the fight starts, and the strip the title screen's camera looks across, stay open
  const plaza = (x, z) => (Math.abs(x) < 46 && z < 100 && z > SHORE + 40) || (x > -60 && x < 80 && z >= 100 && z < 182);
  if (stageId === 'desert') refinery(); else if (stageId === 'snow') town();
  else for (let bx = -9; bx <= 9; bx++) for (let bz = 0; bz < 14; bz++) {
    const cx = bx * (BLOCK + ROAD), cz = SHORE + 60 + bz * (BLOCK + ROAD);
    const near = Math.hypot(cx, cz - 40) < 170;
    const lots = near ? 2 : 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < lots; i++) {
      const w = lots === 1 ? rnd(36, 56) : rnd(20, 30), d = lots === 1 ? rnd(36, 56) : rnd(22, 52);
      const x = cx + (lots === 1 ? 0 : (i - (lots - 1) / 2) * (BLOCK / lots)), z = cz + rnd(-4, 4);
      let h = near ? rnd(18, 55) : rnd(30, 70) + bz * rnd(6, 16) + (Math.abs(bx) < 4 && bz > 5 ? rnd(40, 160) : 0);
      if (plaza(x, z)) continue;
      addBuilding(x, z, w, d, h, mats[Math.floor(Math.random() * mats.length)]);
    }
  }
  function addBuilding(x, z, w, d, h, mat) {
    const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, nrm = geo.attributes.normal;
    // windows keep their size whatever the building's size: scale the uvs per face
    for (let i = 0; i < uv.count; i++) { const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)); const across = nx > 0.5 ? d : w; uv.setXY(i, uv.getX(i) * (ny > 0.5 ? 0 : across / 32), uv.getY(i) * (ny > 0.5 ? 0 : h / 64)); }
    const m = new THREE.Mesh(geo, mat); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; root.add(m);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 4, d * 0.5), roofMat); roof.position.set(x + rnd(-w / 6, w / 6), h + 2, z + rnd(-d / 6, d / 6)); roof.castShadow = true; root.add(roof);
    let beacon = null;
    if (h > 90) { beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), red); beacon.position.set(x, h + 9, z); beacon.userData.blink = Math.random(); root.add(beacon); W.lights.push(beacon); const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9), steel); ant.position.set(x, h + 4.5, z); root.add(ant); m.userData.extra = [ant, beacon]; }
    W.buildings.push({ mesh: m, roof, x, z, w, d, h, alive: true, hp: w * d * h / 4000 });
  }
  // any other solid that can be knocked down: a mesh standing on the ground, with an optional roof piece riding on top
  function addSolid(m, roof, x, z, w, d, h, roofOff = 2) {
    m.castShadow = m.receiveShadow = true; root.add(m); if (roof) { roof.castShadow = true; root.add(roof); }
    W.buildings.push({ mesh: m, roof: roof || new THREE.Object3D(), roofOff, x, z, w, d, h, alive: true, hp: w * d * h / 4000 });
  }
  // ---- the refinery: storage tanks, long warehouses, distillation towers, flare stacks burning off gas
  function refinery() {
    const tankM = [0xd8d2c4, 0xb8b0a0, 0x9a8a78].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.55, envMapIntensity: 0.9 }));
    const rust = new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: 0.8, metalness: 0.4 }), cap = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.5, metalness: 0.6 });
    for (let bx = -9; bx <= 9; bx++) for (let bz = 0; bz < 13; bz++) {
      const cx = bx * (BLOCK + ROAD), cz = SHORE + 60 + bz * (BLOCK + ROAD), near = Math.hypot(cx, cz - 40) < 170, r0 = Math.random();
      if (plaza(cx, cz)) continue;
      if (r0 < 0.45) {
        // a cluster of round tanks
        const n = near ? 2 : 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const r = n === 1 ? rnd(16, 26) : rnd(9, 14), h = rnd(12, 26), x = cx + (n === 1 ? 0 : (i - (n - 1) / 2) * 30), z = cz + rnd(-8, 8);
          if (plaza(x, z)) continue;
          const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), tankM[Math.floor(Math.random() * 3)]); m.position.set(x, h / 2, z);
          const roof = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.15, r, 2.6, 28), cap); roof.position.set(x, h + 1.3, z);
          const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, 1.2, 28), rust); band.position.y = h * rnd(-0.3, 0.3); m.add(band);
          addSolid(m, roof, x, z, r * 1.7, r * 1.7, h, 1.3);
        }
      } else if (r0 < 0.8) {
        // a warehouse: low and long, a few lit windows
        const w = rnd(40, 60), d = rnd(24, 44), h = near ? rnd(12, 18) : rnd(14, 26);
        addBuilding(cx, cz + rnd(-4, 4), w, d, h, mats[Math.floor(Math.random() * mats.length)]);
      } else {
        // a distillation tower: a tall steel column on a frame, a red light on top
        const r = rnd(3.5, 6), h = near ? rnd(40, 60) : rnd(60, 110), x = cx + rnd(-10, 10), z = cz + rnd(-10, 10);
        if (plaza(x, z)) continue;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 18), tankM[1]); m.position.set(x, h / 2, z);
        for (let k = 1; k < 5; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, 0.35, 6, 18), steel); ring.rotation.x = Math.PI / 2; ring.position.y = -h / 2 + k * h / 5; m.add(ring); }
        const roof = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap); roof.position.set(x, h, z);
        const bc = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), red); bc.position.set(0, h / 2 + r + 1, 0); bc.userData.blink = Math.random(); m.add(bc); W.lights.push(bc);
        addSolid(m, roof, x, z, r * 2.2, r * 2.2, h, 0);
      }
    }
    // flare stacks along the yard: a tall pipe burning off gas, the flame lights the dust
    const flameM = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const x of [-360, -200, 240, 380]) {
      const h = rnd(70, 95), z = SHORE + rnd(14, 30), pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, h, 12), steel); pipe.position.set(x, h / 2, z);
      const fl = new THREE.Sprite(flameM.clone()); fl.position.set(0, h / 2 + 6, 0); fl.scale.set(14, 26, 1); pipe.add(fl);
      const light = new THREE.PointLight(0xff8a30, 3000, 160, 2); light.position.set(0, h / 2 + 8, 0); pipe.add(light);
      W.flares.push({ fl, light, ph: Math.random() * 9 }); addSolid(pipe, null, x, z, 4, 4, h);
    }
  }
  // ---- the town: snowed-in houses with steep roofs and lit windows, a church, a couple of hotels, pine trees
  function town() {
    const wallM = [0x6a4a36, 0x8a7a66, 0x5a3a32, 0x9a9488].map((c) => new THREE.MeshStandardMaterial({ ...tex[(c >> 4) % 2 ? 0 : 2], color: c, emissive: 0xffd8a0, emissiveIntensity: S.win, roughness: 0.85 }));
    const snowRoof = new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 0.7 }), trunk = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.9 }), pine = new THREE.MeshStandardMaterial({ color: 0x1e3424, roughness: 0.85 });
    const house = (x, z, w, d, h) => {
      const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, nrm = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) { const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)); uv.setXY(i, uv.getX(i) * (ny > 0.5 ? 0 : (nx > 0.5 ? d : w) / 32), uv.getY(i) * (ny > 0.5 ? 0 : h / 64)); }
      const m = new THREE.Mesh(geo, wallM[Math.floor(Math.random() * wallM.length)]); m.position.set(x, h / 2, z);
      const rh = Math.min(w, d) * rnd(0.45, 0.7), roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.05, rh, 4).rotateY(Math.PI / 4), snowRoof); roof.scale.set(w / Math.hypot(w, d) * 1.41, 1, d / Math.hypot(w, d) * 1.41); roof.position.set(x, h + rh / 2, z);
      addSolid(m, roof, x, z, w, d, h, rh / 2);
    };
    for (let bx = -9; bx <= 9; bx++) for (let bz = 0; bz < 12; bz++) {
      const cx = bx * (BLOCK + ROAD), cz = SHORE + 60 + bz * (BLOCK + ROAD), near = Math.hypot(cx, cz - 40) < 170;
      if (plaza(cx, cz)) continue;
      const r0 = Math.random();
      if (!near && r0 < 0.1 && bz > 2) addBuilding(cx, cz, rnd(34, 48), rnd(26, 40), rnd(36, 70), mats[Math.floor(Math.random() * mats.length)]);   // a hotel
      else if (!near && r0 < 0.14) { house(cx, cz, 22, 40, 22); const t = new THREE.Mesh(new THREE.BoxGeometry(9, 50, 9), wallM[3]); t.position.set(cx, 25, cz + 18); const sp = new THREE.Mesh(new THREE.ConeGeometry(7, 18, 4).rotateY(Math.PI / 4), snowRoof); sp.position.set(cx, 59, cz + 18); addSolid(t, sp, cx, cz + 18, 9, 9, 50, 9); }   // the church
      else for (let i = 0; i < (near ? 3 : 2 + Math.floor(Math.random() * 3)); i++) {
        const x = cx + rnd(-22, 22), z = cz + rnd(-22, 22); if (plaza(x, z) || W.buildings.some((b) => Math.abs(b.x - x) < (b.w + 14) / 2 && Math.abs(b.z - z) < (b.d + 14) / 2)) continue;
        house(x, z, rnd(12, 20), rnd(12, 18), rnd(8, near ? 12 : 16));
      }
    }
    // pine trees: along the lake shore and scattered through town; they snap like lamp posts
    for (let i = 0; i < 160; i++) {
      const x = rnd(-430, 430), z = i < 60 ? SHORE + rnd(6, 30) : rnd(SHORE + 30, 500);
      if (plaza(x, z) || W.buildings.some((b) => Math.abs(b.x - x) < b.w / 2 + 3 && Math.abs(b.z - z) < b.d / 2 + 3)) continue;
      const h = rnd(10, 20), g = new THREE.Group(), tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, h * 0.3, 6), trunk); tr.position.y = h * 0.15; g.add(tr);
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(h * (0.32 - k * 0.07), h * 0.42, 8), k === 2 ? snowRoof : pine); c.position.y = h * (0.38 + k * 0.2); c.castShadow = true; g.add(c); }
      g.position.set(x, 0, z); root.add(g);
      W.buildings.push({ mesh: g, extra: [], x, z, w: 2, d: 2, h, alive: true, hp: 0.1, pole: true });
    }
  }

  // street lights near the waterfront: sodium lamps, a few of them real lights
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.6, metalness: 0.6 }), bulb = new THREE.MeshBasicMaterial({ color: 0xffb060 });
  let real = 0;
  for (let x = -400; x <= 400; x += 40) for (const z of [SHORE + 14, SHORE + 50 + 43]) {
    if (stageId === 'snow' && z === SHORE + 14 && Math.random() < 0.5) continue;
    if (W.buildings.some((b) => !b.pole && Math.abs(b.x - x) < b.w / 2 + 1 && Math.abs(b.z - z) < b.d / 2 + 1)) continue;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 11, 6), poleMat); p.position.set(x, 5.5, z); root.add(p);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), bulb); b.position.set(x, 11, z); root.add(b);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff9a40, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(9, 9, 1); halo.position.copy(b.position); root.add(halo);
    if (Math.abs(x) <= 160 && real < q.streetLights) { const l = new THREE.PointLight(0xff9a50, 900, 60, 2); l.position.set(x, 10, z); root.add(l); real++; }
    W.buildings.push({ mesh: p, extra: [b, halo], x, z, w: 1.5, d: 1.5, h: 11, alive: true, hp: 0.1, pole: true });
  }

  // rain: streaks that fall around the camera, slanted by the wind
  const P = { rain: { n: 1, fall: [55, 25], wind: 0.12, sway: 0, col: [0.62, 0.7, 0.85], a: [0.1, 0.14] }, snow: { n: 0.8, fall: [7, 5], wind: 0.35, sway: 1.6, col: [0.9, 0.93, 1], a: [0.35, 0.3] }, dust: { n: 0.5, fall: [1, 2], wind: 22, sway: 0.6, col: [0.85, 0.62, 0.42], a: [0.05, 0.08] } }[S.precip];
  const N = Math.floor(q.rain * P.n), pos = new Float32Array(N * 6), seeds = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const x = rnd(-120, 120), y = S.precip === 'dust' ? rnd(0, 40) : rnd(0, 140), z = rnd(-120, 120), len = rnd(1.4, 2.6);
    if (S.precip === 'rain') pos.set([x, y, z, x - 0.25, y + len, z - 0.1], i * 6); else if (S.precip === 'snow') pos.set([x, y, z, x + 0.12, y + 0.16, z + 0.05], i * 6); else pos.set([x, y, z, x - len * 1.6, y + 0.1, z - 0.3], i * 6);
    seeds[i * 2] = seeds[i * 2 + 1] = Math.random();
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); rg.setAttribute('seed', new THREE.BufferAttribute(seeds, 1)); const bases = new Float32Array(N * 6); for (let i = 0; i < N; i++) { bases.set([pos[i*6], pos[i*6+1], pos[i*6+2], pos[i*6], pos[i*6+1], pos[i*6+2]], i * 6); } rg.setAttribute('base', new THREE.BufferAttribute(bases, 3));
  const rainU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uFlash: { value: 0 }, uFall: { value: new THREE.Vector2(...P.fall) }, uWind: { value: P.wind }, uSway: { value: P.sway }, uCol: { value: new THREE.Vector3(...P.col) }, uA: { value: new THREE.Vector2(...P.a) } };
  const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: rainU,
    vertexShader: `attribute float seed; attribute vec3 base; uniform float uTime, uWind, uSway; uniform vec2 uFall, uA; uniform vec3 uCam; varying float vA;
      void main(){ float fall = uTime * (uFall.x + seed * uFall.y), wind = uTime * uWind * (0.7 + seed * 0.6) + (uWind > 1. ? 0. : fall * uWind);
        vec3 b = base; b.y = mod(base.y - fall - uCam.y + 70., 140.) - 70. + uCam.y; b.x = mod(base.x - uCam.x + wind + sin(uTime * 0.9 + seed * 40.) * uSway + 120., 240.) - 120. + uCam.x; b.z = mod(base.z - uCam.z + cos(uTime * 0.7 + seed * 30.) * uSway + 120., 240.) - 120. + uCam.z;
        if (uWind > 1.) b.y = base.y;
        vec3 p = b + (position - base); float d = distance(b, uCam);
        vA = (uA.x + seed * uA.y) * smoothstep(3., 14., d) * (1. - smoothstep(80., 120., d)); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: 'varying float vA; uniform float uFlash; uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol * (1. + uFlash*2.), vA); }' }));
  rain.frustumCulled = false; root.add(rain); W.rainU = rainU;

  // helicopters with searchlights circling the fight
  for (let i = 0; i < q.helis; i++) {
    const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 5, 4, 8), dark); body.rotation.z = Math.PI / 2; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.5), dark); tail.position.set(-5.5, 0.3, 0); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 0.5), dark); rotor.position.y = 1.8; g.add(rotor);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff3030 : 0xffffff })); blink.position.set(-9, 0.4, 0); g.add(blink);
    const spot = new THREE.SpotLight(0xdfe8ff, 60000 * S.heliK, 400, 0.13, 0.5, 2); spot.position.set(1.5, -1, 0); g.add(spot); root.add(spot.target);
    // the beam itself: a cone of light through the rain
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uO: { value: 0.16 * S.heliK } },
      vertexShader: 'varying float vY; varying vec3 vN, vV; void main(){ vY = position.y + .5; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vY; varying vec3 vN, vV; uniform float uO; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.5); gl_FragColor = vec4(vec3(.8,.85,1.), uO * .8 * f * pow(max(vY, 0.), 1.6) * smoothstep(0., .25, vY)); }' }));
    root.add(g, beam);
    W.helis.push({ g, rotor, blink, spot, beam, a: (i / q.helis) * Math.PI * 2, r: rnd(140, 200), y: rnd(90, 130), sp: rnd(0.06, 0.1) * (i % 2 ? 1 : -1), aim: new THREE.Vector3() });
  }

  // ------------------------------------------------------------------ per frame
  W.update = (dt, cam, focus) => {
    W.t += dt;
    skyU.uTime.value = W.t; rainU.uTime.value = W.t; rainU.uCam.value.copy(cam.position);
    if (W.water) W.water.material.uniforms.time.value += dt * 0.6;
    // lightning: a flash, a flicker, a bolt, thunder a moment later
    if (!W.nextBolt) W.nextBolt = W.t + rnd(6, 14);
    for (const f of W.flares) { const k = 0.8 + 0.2 * Math.sin(W.t * 11 + f.ph) * Math.sin(W.t * 4.3 + f.ph * 2); f.fl.scale.set(14 * k, 26 * (0.85 + 0.3 * k), 1); f.light.intensity = 3000 * k; }
    if (S.storm && W.t > W.nextBolt) { W.flash = 1; W.flicker = rnd(0.15, 0.35); W.nextBolt = W.t + rnd(9, 22); bolt(); if (W.onThunder) setTimeout(W.onThunder, rnd(500, 2000)); }
    W.flash = Math.max(0, W.flash - dt * (W.flash > 0.5 ? 3 : 1.4));
    const fl = W.flash * (0.6 + 0.4 * Math.sin(W.t * 60) * (W.flicker > 0 ? 1 : 0)); W.flicker -= dt;
    skyU.uFlash.value = fl; rainU.uFlash.value = fl; hemi.intensity = S.hemi[2] + fl * 2.2; moon.intensity = S.key[1] + fl * 3;
    if (W.boltMesh) { W.boltMesh.material.opacity = W.flash; if (W.flash <= 0) { root.remove(W.boltMesh); W.boltMesh = null; } }
    // shadows follow the fight
    if (focus) { moon.target.position.copy(focus); moon.position.set(focus.x + S.key[2][0], S.key[2][1], focus.z + S.key[2][2]); }
    for (const l of W.lights) l.visible = !l.userData.dead && ((W.t + l.userData.blink) % 1.4) < 0.25;
    for (const h of W.helis) {
      h.a += h.sp * dt; const fx = focus ? focus.x : 0, fz = focus ? focus.z : 40;
      h.g.position.set(fx + Math.cos(h.a) * h.r, h.y + Math.sin(W.t * 0.4 + h.a) * 6, fz + Math.sin(h.a) * h.r);
      h.g.rotation.y = -h.a + (h.sp > 0 ? -Math.PI / 2 : Math.PI / 2); h.rotor.rotation.y += dt * 40; h.blink.visible = (W.t * 1.5 + h.a) % 1 < 0.2;
      h.aim.lerp(focus ? new THREE.Vector3(focus.x + Math.sin(W.t * 0.7 + h.a) * 25, 25 + Math.sin(W.t + h.a) * 15, focus.z + Math.cos(W.t * 0.5 + h.a) * 25) : new THREE.Vector3(), 1 - Math.exp(-dt * 1.5));
      const from = new THREE.Vector3(); h.g.localToWorld(from.set(1.5, -1, 0)); h.spot.target.position.copy(h.aim);
      const len = from.distanceTo(h.aim), dir = h.aim.clone().sub(from).normalize();
      h.beam.position.copy(from).addScaledVector(dir, len / 2); h.beam.scale.set(len * 0.13, len, len * 0.13); h.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    }
  };
  function bolt() {
    const pts = [], a = Math.random() * Math.PI * 2, d = rnd(600, 1100); let p = new THREE.Vector3(Math.cos(a) * d, 520, Math.sin(a) * d - 300);
    for (let i = 0; i < 18; i++) { pts.push(p.clone()); p = p.clone().add(new THREE.Vector3(rnd(-30, 30), -rnd(20, 34), rnd(-30, 30))); }
    if (W.boltMesh) root.remove(W.boltMesh);
    W.boltMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xdde6ff, transparent: true, fog: false }));
    root.add(W.boltMesh);
  }
  // a building comes down: it sinks and breaks apart (fx makes the debris and dust)
  W.collapse = (b) => { if (!b.alive) return false; b.alive = false; b.fallT = 0; return true; };
  W.updateRuins = (dt) => {
    for (const b of W.buildings) {
      if (b.alive || b.gone) continue;
      b.fallT += dt; const k = Math.min(1, b.fallT / (b.pole ? 0.6 : 2.6));
      if (b.pole) { b.mesh.rotation.z = k * 1.4; for (const e of b.extra || []) e.visible = false; if (k >= 1) b.gone = true; continue; }
      b.mesh.position.y = b.h / 2 - k * k * b.h * 0.85; b.mesh.rotation.z = Math.sin(b.fallT * 3) * 0.02 * (1 - k) + k * 0.06; b.roof.position.y = b.mesh.position.y + b.h / 2 + (b.roofOff ?? 2);
      for (const e of b.mesh.userData.extra || []) { e.visible = false; e.userData.dead = true; }
      if (k >= 1) { b.gone = true; b.mesh.scale.y = 0.15; b.mesh.position.y = b.h * 0.075; b.roof.visible = false; b.mesh.material = b.mesh.material.clone(); b.mesh.material.emissiveIntensity = 0.05; for (const c of b.mesh.children) { c.visible = false; c.userData.dead = true; } }
    }
  };
  // tear the stage down: everything it built, its textures and materials
  W.dispose = () => {
    scene.remove(root);
    const seen = new Set();
    root.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      for (const m of [].concat(o.material || [])) { if (seen.has(m)) continue; seen.add(m); for (const k of ['map', 'emissiveMap', 'roughnessMap', 'normalMap']) if (m[k] && m[k] !== glowTex() && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); } m.dispose(); }
      if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose();
    });
    if (scene.environment) { scene.environment.dispose(); scene.environment = null; }
    if (W.water) W.water.material.dispose();
  };
  return W;
}
