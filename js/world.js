// The city at night in a storm: wet streets, lit towers that can fall, the harbour, rain, lightning, helicopters.
// Units are metres. The bay is to the north (negative z); the fight happens on the waterfront.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

const rnd = (a, b) => a + Math.random() * (b - a);
export const SHORE = -70;   // land is z > SHORE

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
// a soft glow sprite texture
export const glowTex = (() => { let t = null; return () => t || (t = new THREE.CanvasTexture(canvas(64, 64, (g) => { const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); }))); })();

// ------------------------------------------------------------------ the world
export function buildWorld(scene, renderer, q) {
  const W = { buildings: [], helis: [], lights: [], flash: 0, t: 0 };
  scene.background = new THREE.Color(0x05070b);
  scene.fog = new THREE.FogExp2(0x0a0e15, 0.0026);

  // sky: storm clouds lit from below by the city, lit up by lightning
  const skyU = { uTime: { value: 0 }, uFlash: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform float uTime, uFlash;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
      void main(){
        float y = vP.y; vec2 uv = vP.xz/(y+.35)*1.6 + vec2(uTime*.01, uTime*.004);
        float c = fbm(uv*1.4);
        vec3 col = mix(vec3(.012,.016,.024), vec3(.05,.055,.07), c);
        col += vec3(.22,.12,.06) * pow(1.-clamp(y,0.,1.), 6.) * (.6 + .4*c);   // the city's orange glow on the clouds
        col += vec3(.55,.62,.8) * uFlash * (.35 + c);                          // lightning inside the clouds
        gl_FragColor = vec4(col, 1.);
      }` }));
  scene.add(sky);

  // light: a faint moon through the clouds, a cold fill, and lightning
  const hemi = new THREE.HemisphereLight(0x2a3a55, 0x0a0806, 0.35); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8899cc, 0.55); moon.position.set(-200, 400, -300); moon.castShadow = q.shadows;
  moon.shadow.mapSize.set(q.shadowSize, q.shadowSize); Object.assign(moon.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 50, far: 1200 }); moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.5;
  scene.add(moon, moon.target);
  W.moon = moon; W.hemi = hemi; W.skyU = skyU;

  // reflections: a dark city panorama rendered once into an environment map
  const env = new THREE.Scene(); env.background = new THREE.Color(0x020306);
  for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, h = rnd(10, 60), m = new THREE.Mesh(new THREE.PlaneGeometry(rnd(8, 30), h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random() < 0.7 ? 0.08 : 0.58, 0.6, rnd(0.2, 0.55)), side: THREE.DoubleSide })); m.position.set(Math.cos(a) * 200, h / 2 - 10, Math.sin(a) * 200); m.lookAt(0, h / 2 - 10, 0); env.add(m); }
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose();

  // ground: wet asphalt on land, the bay beyond the quay
  const as = asphalt();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 2000), new THREE.MeshStandardMaterial({ ...as, color: 0xffffff, metalness: 0.1, roughness: 1, envMapIntensity: 1.4 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, SHORE + 1000); ground.receiveShadow = true; scene.add(ground);
  // the quay wall
  const quay = new THREE.Mesh(new THREE.BoxGeometry(3000, 12, 6), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.9 })); quay.position.set(0, -4, SHORE); scene.add(quay);
  // the bay
  if (q.water) {
    const wn = new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    const water = new Water(new THREE.PlaneGeometry(3000, 1600), { textureWidth: q.waterRes, textureHeight: q.waterRes, waterNormals: wn, sunDirection: new THREE.Vector3(-0.3, 0.6, -0.5).normalize(), sunColor: 0x6a7a99, waterColor: 0x02080e, distortionScale: 4, fog: true });
    water.rotation.x = -Math.PI / 2; water.position.set(0, -1.2, SHORE - 800); scene.add(water); W.water = water;
  } else {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1600), new THREE.MeshStandardMaterial({ color: 0x02080e, roughness: 0.15, metalness: 0.6 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -1.2, SHORE - 800); scene.add(water);
  }

  // the harbour: container stacks and a quay crane with warning lights
  const contMat = [0x7a2a1e, 0x1e3f6a, 0x2f5a2f, 0x6a5a1e, 0x4a4a52].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.4 }));
  const cont = new THREE.BoxGeometry(12, 2.6, 2.5);
  for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(cont, contMat[i % contMat.length]); const row = Math.floor(i / 20), col = i % 20; m.position.set(-420 + col * 13 + (row % 2) * 4, 1.3 + (i % 3) * 2.6, SHORE + 20 + row * 3); m.castShadow = m.receiveShadow = true; scene.add(m); }
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6, metalness: 0.7 }), red = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  for (const x of [-330, -250, 300]) {
    const g = new THREE.Group(); g.position.set(x, 0, SHORE + 8);
    for (const dx of [-8, 8]) for (const dz of [-6, 6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 50, 1.5), steel); leg.position.set(dx, 25, dz); g.add(leg); }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 110), steel); boom.position.set(0, 52, -30); g.add(boom);
    const top = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 14), steel); top.position.set(0, 50, 0); g.add(top);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), red); lamp.position.set(0, 56, -84); lamp.userData.blink = Math.random(); g.add(lamp); W.lights.push(lamp);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }

  // the city: blocks of towers; near the waterfront they are lower, so there is room to fight (and things to smash)
  const tex = [facade(7, false), facade(31, true), facade(97, false), facade(1234, true)];
  const mats = tex.map((t, i) => new THREE.MeshStandardMaterial({ ...t, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: i % 2 ? 0.25 : 0.85, metalness: i % 2 ? 0.6 : 0.1, envMapIntensity: 0.8 }));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.9 });
  const BLOCK = 64, ROAD = 22;
  for (let bx = -9; bx <= 9; bx++) for (let bz = 0; bz < 14; bz++) {
    const cx = bx * (BLOCK + ROAD), cz = SHORE + 60 + bz * (BLOCK + ROAD);
    const near = Math.hypot(cx, cz - 40) < 170;
    const lots = near ? 2 : 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < lots; i++) {
      const w = lots === 1 ? rnd(36, 56) : rnd(20, 30), d = lots === 1 ? rnd(36, 56) : rnd(22, 52);
      const x = cx + (lots === 1 ? 0 : (i - (lots - 1) / 2) * (BLOCK / lots)), z = cz + rnd(-4, 4);
      let h = near ? rnd(18, 55) : rnd(30, 70) + bz * rnd(6, 16) + (Math.abs(bx) < 4 && bz > 5 ? rnd(40, 160) : 0);
      if (Math.abs(x) < 46 && z < 100 && z > SHORE + 40) continue;   // the plaza where the fight starts
      addBuilding(x, z, w, d, h, mats[Math.floor(Math.random() * mats.length)]);
    }
  }
  function addBuilding(x, z, w, d, h, mat) {
    const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, nrm = geo.attributes.normal;
    // windows keep their size whatever the building's size: scale the uvs per face
    for (let i = 0; i < uv.count; i++) { const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)); const across = nx > 0.5 ? d : w; uv.setXY(i, uv.getX(i) * (ny > 0.5 ? 0 : across / 32), uv.getY(i) * (ny > 0.5 ? 0 : h / 64)); }
    const m = new THREE.Mesh(geo, ny0(mat)); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 4, d * 0.5), roofMat); roof.position.set(x + rnd(-w / 6, w / 6), h + 2, z + rnd(-d / 6, d / 6)); roof.castShadow = true; scene.add(roof);
    let beacon = null;
    if (h > 90) { beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), red); beacon.position.set(x, h + 9, z); beacon.userData.blink = Math.random(); scene.add(beacon); W.lights.push(beacon); const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9), steel); ant.position.set(x, h + 4.5, z); scene.add(ant); m.userData.extra = [ant, beacon]; }
    W.buildings.push({ mesh: m, roof, x, z, w, d, h, alive: true, hp: w * d * h / 4000 });
  }
  function ny0(m) { return m; }

  // street lights near the waterfront: sodium lamps, a few of them real lights
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.6, metalness: 0.6 }), bulb = new THREE.MeshBasicMaterial({ color: 0xffb060 });
  let real = 0;
  for (let x = -400; x <= 400; x += 40) for (const z of [SHORE + 14, SHORE + 50 + 43]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 11, 6), poleMat); p.position.set(x, 5.5, z); scene.add(p);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), bulb); b.position.set(x, 11, z); scene.add(b);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff9a40, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(9, 9, 1); halo.position.copy(b.position); scene.add(halo);
    if (Math.abs(x) <= 160 && real < q.streetLights) { const l = new THREE.PointLight(0xff9a50, 900, 60, 2); l.position.set(x, 10, z); scene.add(l); real++; }
    W.buildings.push({ mesh: p, extra: [b, halo], x, z, w: 1.5, d: 1.5, h: 11, alive: true, hp: 0.1, pole: true });
  }

  // rain: streaks that fall around the camera, slanted by the wind
  const N = q.rain, pos = new Float32Array(N * 6), seeds = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { const x = rnd(-120, 120), y = rnd(0, 140), z = rnd(-120, 120), len = rnd(1.4, 2.6); pos.set([x, y, z, x - 0.25, y + len, z - 0.1], i * 6); seeds[i * 2] = seeds[i * 2 + 1] = Math.random(); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); rg.setAttribute('seed', new THREE.BufferAttribute(seeds, 1)); const bases = new Float32Array(N * 6); for (let i = 0; i < N; i++) { bases.set([pos[i*6], pos[i*6+1], pos[i*6+2], pos[i*6], pos[i*6+1], pos[i*6+2]], i * 6); } rg.setAttribute('base', new THREE.BufferAttribute(bases, 3));
  const rainU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uFlash: { value: 0 } };
  const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: rainU,
    vertexShader: `attribute float seed; attribute vec3 base; uniform float uTime; uniform vec3 uCam; varying float vA;
      void main(){ float fall = uTime * (55. + seed * 25.);
        vec3 b = base; b.y = mod(base.y - fall - uCam.y + 70., 140.) - 70. + uCam.y; b.x = mod(base.x - uCam.x + fall*0.12 + 120., 240.) - 120. + uCam.x; b.z = mod(base.z - uCam.z + 120., 240.) - 120. + uCam.z;
        vec3 p = b + (position - base); float d = distance(b, uCam);
        vA = (.1 + seed * .14) * smoothstep(3., 14., d) * (1. - smoothstep(80., 120., d)); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: 'varying float vA; uniform float uFlash; void main(){ gl_FragColor = vec4(vec3(.62,.7,.85) * (1. + uFlash*2.), vA); }' }));
  rain.frustumCulled = false; scene.add(rain); W.rainU = rainU;

  // helicopters with searchlights circling the fight
  for (let i = 0; i < q.helis; i++) {
    const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 5, 4, 8), dark); body.rotation.z = Math.PI / 2; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.5), dark); tail.position.set(-5.5, 0.3, 0); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 0.5), dark); rotor.position.y = 1.8; g.add(rotor);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff3030 : 0xffffff })); blink.position.set(-9, 0.4, 0); g.add(blink);
    const spot = new THREE.SpotLight(0xdfe8ff, 60000, 400, 0.13, 0.5, 2); spot.position.set(1.5, -1, 0); g.add(spot); scene.add(spot.target);
    // the beam itself: a cone of light through the rain
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uO: { value: 0.16 } },
      vertexShader: 'varying float vY; varying vec3 vN, vV; void main(){ vY = position.y + .5; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vY; varying vec3 vN, vV; uniform float uO; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.5); gl_FragColor = vec4(vec3(.8,.85,1.), uO * .8 * f * pow(vY, 1.6) * smoothstep(0., .25, vY)); }' }));
    scene.add(g, beam);
    W.helis.push({ g, rotor, blink, spot, beam, a: (i / q.helis) * Math.PI * 2, r: rnd(140, 200), y: rnd(90, 130), sp: rnd(0.06, 0.1) * (i % 2 ? 1 : -1), aim: new THREE.Vector3() });
  }

  // ------------------------------------------------------------------ per frame
  W.update = (dt, cam, focus) => {
    W.t += dt;
    skyU.uTime.value = W.t; rainU.uTime.value = W.t; rainU.uCam.value.copy(cam.position);
    if (W.water) W.water.material.uniforms.time.value += dt * 0.6;
    // lightning: a flash, a flicker, a bolt, thunder a moment later
    if (!W.nextBolt) W.nextBolt = W.t + rnd(6, 14);
    if (W.t > W.nextBolt) { W.flash = 1; W.flicker = rnd(0.15, 0.35); W.nextBolt = W.t + rnd(9, 22); bolt(); if (W.onThunder) setTimeout(W.onThunder, rnd(500, 2000)); }
    W.flash = Math.max(0, W.flash - dt * (W.flash > 0.5 ? 3 : 1.4));
    const fl = W.flash * (0.6 + 0.4 * Math.sin(W.t * 60) * (W.flicker > 0 ? 1 : 0)); W.flicker -= dt;
    skyU.uFlash.value = fl; rainU.uFlash.value = fl; hemi.intensity = 0.35 + fl * 2.2; moon.intensity = 0.55 + fl * 3;
    if (W.boltMesh) { W.boltMesh.material.opacity = W.flash; if (W.flash <= 0) { scene.remove(W.boltMesh); W.boltMesh = null; } }
    // shadows follow the fight
    if (focus) { moon.target.position.copy(focus); moon.position.set(focus.x - 200, 400, focus.z - 300); }
    for (const l of W.lights) l.visible = ((W.t + l.userData.blink) % 1.4) < 0.25;
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
    if (W.boltMesh) scene.remove(W.boltMesh);
    W.boltMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xdde6ff, transparent: true, fog: false }));
    scene.add(W.boltMesh);
  }
  // a building comes down: it sinks and breaks apart (fx makes the debris and dust)
  W.collapse = (b) => { if (!b.alive) return false; b.alive = false; b.fallT = 0; return true; };
  W.updateRuins = (dt) => {
    for (const b of W.buildings) {
      if (b.alive || b.gone) continue;
      b.fallT += dt; const k = Math.min(1, b.fallT / (b.pole ? 0.6 : 2.6));
      if (b.pole) { b.mesh.rotation.z = k * 1.4; for (const e of b.extra || []) e.visible = false; if (k >= 1) b.gone = true; continue; }
      b.mesh.position.y = b.h / 2 - k * k * b.h * 0.85; b.mesh.rotation.z = Math.sin(b.fallT * 3) * 0.02 * (1 - k) + k * 0.06; b.roof.position.y = b.mesh.position.y + b.h / 2 + 2;
      for (const e of b.mesh.userData.extra || []) e.visible = false;
      if (k >= 1) { b.gone = true; b.mesh.scale.y = 0.15; b.mesh.position.y = b.h * 0.075; b.roof.visible = false; b.mesh.material = b.mesh.material.clone(); b.mesh.material.emissiveIntensity = 0.05; }
    }
  };
  return W;
}
