// Effects: soft particles (smoke, dust, fire, sparks, glowing kaiju blood, acid), concrete debris, fire lights.
import * as THREE from 'three';

function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  // a lumpy puff: several soft blobs, so smoke does not look like perfect circles
  for (let i = 0; i < 14; i++) { const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, r = 20 + Math.random() * 30, grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); return t;
}
const VERT = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aRot; varying float vA; varying vec3 vC; varying float vR;
  void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * (900. / -mv.z); vA = aAlpha; vC = aColor; vR = aRot; }`;
const FRAG = `uniform sampler2D uTex; varying float vA; varying vec3 vC; varying float vR;
  void main(){ vec2 p = gl_PointCoord - .5; float c = cos(vR), s = sin(vR); p = mat2(c,-s,s,c) * p + .5; vec4 t = texture2D(uTex, p); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < .003) discard; }`;
// one pool of particles drawn in one call
class Pool {
  constructor(scene, max, blending, tex) {
    this.max = max; this.n = 0; this.p = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.col = new Float32Array(max * 3); this.rot = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3)); g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    this.geo = g;
    this.pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTex: { value: tex } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending }));
    this.pts.frustumCulled = false; scene.add(this.pts);
  }
  // o: { x,y,z, vx,vy,vz, life, size, grow, color [r,g,b], alpha, drag, grav, spin }
  add(o) { if (this.p.length >= this.max) this.p.shift(); this.p.push({ t: 0, rot: Math.random() * 6, ...o }); }
  update(dt) {
    let i = 0;
    for (let k = this.p.length - 1; k >= 0; k--) {
      const q = this.p[k]; q.t += dt;
      if (q.t >= q.life) { this.p.splice(k, 1); continue; }
      const dr = Math.exp(-(q.drag || 0) * dt);
      q.vx *= dr; q.vy = q.vy * dr - (q.grav || 0) * dt; q.vz *= dr; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.floor && q.y < 0.3) { q.y = 0.3; q.vy = Math.abs(q.vy) * 0.3; q.vx *= 0.6; q.vz *= 0.6; }
    }
    for (const q of this.p) {
      const k = q.t / q.life;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.size[i] = q.size * (1 + (q.grow || 0) * k);
      this.alpha[i] = (q.alpha ?? 1) * (q.fadeIn ? Math.min(1, k / q.fadeIn) : 1) * (1 - k) ** (q.fade || 1);
      const c = q.color, heat = q.cool ? 1 - k : 1;
      this.col[i * 3] = c[0] * heat + (q.cool ? q.cool[0] * (1 - heat) : 0); this.col[i * 3 + 1] = c[1] * heat + (q.cool ? q.cool[1] * (1 - heat) : 0); this.col[i * 3 + 2] = c[2] * heat + (q.cool ? q.cool[2] * (1 - heat) : 0);
      this.rot[i] = q.rot + (q.spin || 0) * q.t;
      i++;
    }
    this.geo.setDrawRange(0, i);
    for (const a of ['position', 'aSize', 'aAlpha', 'aColor', 'aRot']) this.geo.attributes[a].needsUpdate = true;
  }
}
const rnd = (a, b) => a + Math.random() * (b - a);

export function makeFx(scene, q) {
  const soft = softTex(), dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), grd = g.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const smoke = new Pool(scene, q.particles, THREE.NormalBlending, soft), glow = new Pool(scene, q.particles, THREE.AdditiveBlending, soft), sparks = new Pool(scene, q.particles, THREE.AdditiveBlending, dot);
  // concrete chunks: one instanced mesh, simple physics
  const DEB = 400, deb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x5a5a5e, roughness: 0.95 }), DEB);
  deb.castShadow = true; deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(deb); const chunks = []; const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  // fire lights: a few pooled point lights that flicker over the biggest fires
  const fireLights = Array.from({ length: q.fireLights }, () => { const l = new THREE.PointLight(0xff6a20, 0, 120, 2); scene.add(l); return { l, fire: null }; });
  const fires = [];
  // shockwave rings: flat additive rings racing outward over the ground
  const ringG = new THREE.RingGeometry(0.86, 1, 72); ringG.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; m.frustumCulled = false; scene.add(m); return { m, t: 1, life: 1, r: 1 }; });
  const F = {
    smoke, glow, sparks,
    // dust and smoke where something heavy lands
    dust(x, z, power = 1, y = 1) { for (let i = 0; i < 10 * power; i++) { const a = Math.random() * 6.28, s = rnd(1, 16) * power, o = rnd(0, 8); smoke.add({ x: x + Math.cos(a) * o, y: y + rnd(0, 4), z: z + Math.sin(a) * o, vx: Math.cos(a) * s, vy: rnd(1, 6), vz: Math.sin(a) * s, life: rnd(2, 5), size: rnd(6, 16) * power, grow: 2.2, color: [0.11, 0.105, 0.1], alpha: rnd(0.3, 0.55), drag: 1.2, fadeIn: 0.1, spin: rnd(-0.3, 0.3) }); } },
    // metal on metal or claw on armour: sparks and a flash
    sparks(p, n = 40, color = [1, 0.75, 0.35]) {
      for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(15, 55)); sparks.add({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: rnd(0.5, 1.3), size: rnd(0.6, 1.4), color, alpha: 1, grav: 30, drag: 0.6, floor: true }); }
      glow.add({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, life: 0.18, size: 30, grow: 1, color: [1, 0.8, 0.5], alpha: 0.9 });
    },
    // kaiju blood glows blue, and steams
    blood(p, dir, n = 30) {
      for (let i = 0; i < n; i++) { const v = dir.clone().multiplyScalar(rnd(10, 30)).add(new THREE.Vector3(rnd(-12, 12), rnd(-4, 14), rnd(-12, 12))); glow.add({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: rnd(1, 2.4), size: rnd(1.5, 3.5), color: [0.15, 0.8, 1], alpha: 0.9, grav: 22, drag: 0.4, floor: true }); }
      for (let i = 0; i < 6; i++) smoke.add({ x: p.x, y: p.y, z: p.z, vx: rnd(-3, 3), vy: rnd(2, 6), vz: rnd(-3, 3), life: rnd(1.5, 3), size: rnd(5, 9), grow: 2, color: [0.25, 0.35, 0.38], alpha: 0.35, drag: 0.8 });
    },
    // acid breath: a stream of glowing droplets and vapour
    acid(p, dir) {
      for (let i = 0; i < 6; i++) { const v = dir.clone().multiplyScalar(rnd(60, 90)).add(new THREE.Vector3(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6))); glow.add({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: rnd(0.6, 1.1), size: rnd(4, 9), grow: 2.5, color: [0.2, 0.9, 1], alpha: 0.5, grav: 8, drag: 0.8 }); }
      smoke.add({ x: p.x, y: p.y, z: p.z, vx: dir.x * 40, vy: dir.y * 40 + 3, vz: dir.z * 40, life: 2, size: 10, grow: 3, color: [0.18, 0.3, 0.32], alpha: 0.3, drag: 1 });
    },
    // the plasma cannon
    plasma(p, dir) { for (let i = 0; i < 3; i++) glow.add({ x: p.x + rnd(-1, 1), y: p.y + rnd(-1, 1), z: p.z + rnd(-1, 1), vx: dir.x * 4, vy: dir.y * 4, vz: dir.z * 4, life: 0.35, size: rnd(6, 10), color: [0.4, 0.75, 1], alpha: 0.8 }); },
    explosion(p, power = 1) {
      for (let i = 0; i < 30 * power; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(10, 40) * power); glow.add({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, life: rnd(0.6, 1.4), size: rnd(8, 16) * power, grow: 1.5, color: [1, 0.55, 0.15], cool: [0.3, 0.05, 0], alpha: 0.9, drag: 2.5 }); }
      for (let i = 0; i < 16 * power; i++) smoke.add({ x: p.x + rnd(-5, 5), y: p.y + rnd(-3, 5), z: p.z + rnd(-5, 5), vx: rnd(-8, 8), vy: rnd(4, 14), vz: rnd(-8, 8), life: rnd(4, 8), size: rnd(12, 22) * power, grow: 2.5, color: [0.08, 0.08, 0.09], alpha: 0.7, drag: 0.9, fadeIn: 0.15 });
      F.sparks(p, 30 * power);
      F.fire(p.x, p.z, p.y * 0.3 + 2, rnd(12, 25) * power);
    },
    // a landing that shakes the ground: a ring of light, a wall of dust rolling outward, chunks of road thrown up
    shockwave(p, r, color = [0.55, 0.85, 1]) {
      const R = rings.find((x) => x.t >= x.life) || rings[0]; R.t = 0; R.life = 0.9; R.r = r; R.m.position.set(p.x, 0.6, p.z); R.m.material.color.setRGB(...color); R.m.visible = true;
      for (let i = 0; i < 44; i++) { const a = i / 44 * 6.28 + rnd(-0.1, 0.1), s = rnd(30, 70) * r / 60; smoke.add({ x: p.x + Math.cos(a) * 6, y: rnd(0.5, 3), z: p.z + Math.sin(a) * 6, vx: Math.cos(a) * s, vy: rnd(2, 8), vz: Math.sin(a) * s, life: rnd(2, 4), size: rnd(10, 18), grow: 2.2, color: [0.13, 0.12, 0.11], alpha: 0.55, drag: 1.4, fadeIn: 0.05 }); }
      for (let i = 0; i < 24; i++) chunks.push({ p: new THREE.Vector3(p.x + rnd(-r / 3, r / 3), 1, p.z + rnd(-r / 3, r / 3)), v: new THREE.Vector3(rnd(-15, 15), rnd(14, 32), rnd(-15, 15)), r: new THREE.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: new THREE.Vector3(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)), s: rnd(1.5, 4), t: 0 });
      while (chunks.length > DEB) chunks.shift();
      glow.add({ x: p.x, y: 4, z: p.z, vx: 0, vy: 0, vz: 0, life: 0.35, size: r * 1.4, grow: 1, color, alpha: 0.7 });
    },
    // thruster exhaust: a short hot flame and a little smoke
    thrust(p, dir, k = 1) {
      for (let i = 0; i < 2; i++) { const s = rnd(40, 70); glow.add({ x: p.x + rnd(-0.5, 0.5), y: p.y, z: p.z + rnd(-0.5, 0.5), vx: dir.x * s + rnd(-3, 3), vy: dir.y * s + rnd(-3, 3), vz: dir.z * s + rnd(-3, 3), life: rnd(0.15, 0.3), size: rnd(4, 7) * k, grow: -0.3, color: [1, 0.62, 0.25], cool: [0.5, 0.15, 0.6], alpha: 0.85 }); }
      if (Math.random() < 0.3 * k) smoke.add({ x: p.x, y: p.y, z: p.z, vx: dir.x * 20, vy: dir.y * 20 + 2, vz: dir.z * 20, life: rnd(1, 2), size: rnd(4, 7), grow: 3, color: [0.3, 0.3, 0.32], alpha: 0.25, drag: 1.5 });
    },
    // a missile in flight: a bright head and a smoke trail
    trail(p, color = [1, 0.7, 0.35]) {
      glow.add({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, life: 0.12, size: 4, color, alpha: 1 });
      smoke.add({ x: p.x, y: p.y, z: p.z, vx: rnd(-1, 1), vy: rnd(0, 1.5), vz: rnd(-1, 1), life: rnd(1.4, 2.4), size: rnd(1.6, 2.6), grow: 2.5, color: [0.5, 0.5, 0.52], alpha: 0.35, drag: 0.8 });
    },
    // a fire that keeps burning (in a ruin, on the street)
    fire(x, z, y = 2, life = 20) { fires.push({ x, z, y, life, t: 0, power: rnd(0.7, 1.3) }); },
    // a building collapsing: chunks, a huge dust cloud, fires inside
    collapse(b) {
      const n = Math.min(60, 10 + Math.floor(b.h / 3));
      for (let i = 0; i < n; i++) chunks.push({ p: new THREE.Vector3(b.x + rnd(-b.w / 2, b.w / 2), rnd(b.h * 0.2, b.h), b.z + rnd(-b.d / 2, b.d / 2)), v: new THREE.Vector3(rnd(-10, 10), rnd(-2, 8), rnd(-10, 10)), r: new THREE.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6)), w: new THREE.Vector3(rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)), s: rnd(1.5, 5.5), t: 0 });
      while (chunks.length > DEB) chunks.shift();
      for (let i = 0; i < 26; i++) smoke.add({ x: b.x + rnd(-b.w / 2, b.w / 2), y: rnd(2, b.h * 0.6), z: b.z + rnd(-b.d / 2, b.d / 2), vx: rnd(-14, 14), vy: rnd(-2, 6), vz: rnd(-14, 14), life: rnd(6, 11), size: rnd(18, 34), grow: 2.2, color: [0.24, 0.22, 0.21], alpha: 0.6, drag: 0.7, fadeIn: 0.1, spin: rnd(-0.2, 0.2) });
      if (Math.random() < 0.7) F.fire(b.x + rnd(-b.w / 3, b.w / 3), b.z + rnd(-b.d / 3, b.d / 3), b.h * 0.1, rnd(25, 60));
    },
    update(dt, t) {
      // burning fires throw flame and smoke; the nearest few get a flickering light
      for (let i = fires.length - 1; i >= 0; i--) {
        const f = fires[i]; f.t += dt; if (f.t > f.life) { fires.splice(i, 1); continue; }
        const k = Math.min(1, (f.life - f.t) / 4) * f.power;
        if (Math.random() < dt * 30 * k) glow.add({ x: f.x + rnd(-3, 3), y: f.y + rnd(0, 2), z: f.z + rnd(-3, 3), vx: rnd(-1, 1), vy: rnd(5, 11), vz: rnd(-1, 1), life: rnd(0.6, 1.2), size: rnd(5, 10) * k, grow: -0.4, color: [1, 0.5, 0.12], cool: [0.5, 0.1, 0.02], alpha: 0.75, fade: 1.4 });
        if (Math.random() < dt * 6 * k) smoke.add({ x: f.x + rnd(-2, 2), y: f.y + 6, z: f.z + rnd(-2, 2), vx: rnd(-1, 1) + 2, vy: rnd(5, 9), vz: rnd(-1, 1), life: rnd(5, 9), size: rnd(10, 16), grow: 3, color: [0.07, 0.07, 0.08], alpha: 0.55, drag: 0.3, fadeIn: 0.2 });
      }
      const ranked = fires.slice().sort((a, b) => b.power - a.power);
      fireLights.forEach((fl, i) => { const f = ranked[i]; if (!f) { fl.l.intensity = 0; return; } fl.l.position.set(f.x, f.y + 5, f.z); fl.l.intensity = 9000 * f.power * Math.min(1, (f.life - f.t) / 4) * (0.75 + 0.25 * Math.sin(t * 23 + i) * Math.sin(t * 7.3 + i * 2)); });
      smoke.update(dt); glow.update(dt); sparks.update(dt);
      for (const R of rings) { if (R.t >= R.life) { R.m.visible = false; continue; } R.t += dt; const k = Math.min(1, R.t / R.life), sc = R.r * (0.15 + 0.85 * (1 - (1 - k) ** 3)); R.m.scale.set(sc, 1, sc); R.m.material.opacity = (1 - k) ** 1.5 * 0.9; }
      // debris
      let n = 0;
      for (let i = chunks.length - 1; i >= 0; i--) {
        const c = chunks[i]; c.t += dt;
        if (c.p.y > c.s / 2) { c.v.y -= 30 * dt; c.p.addScaledVector(c.v, dt); c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt; }
        if (c.p.y <= c.s / 2) { c.p.y = c.s / 2; if (Math.abs(c.v.y) > 5) { c.v.y *= -0.25; c.v.x *= 0.5; c.v.z *= 0.5; } else c.v.set(0, 0, 0); c.w.multiplyScalar(0.8); }
        if (c.t > 40) { chunks.splice(i, 1); continue; }
      }
      for (const c of chunks) { Q.setFromEuler(c.r); Sc.set(c.s, c.s * 0.6, c.s * 0.8); M.compose(c.p, Q, Sc); deb.setMatrixAt(n++, M); }
      deb.count = n; deb.instanceMatrix.needsUpdate = true;
    },
  };
  return F;
}
