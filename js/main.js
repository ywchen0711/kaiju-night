import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, SHORE, STAGE } from './world.js?v=4';
import { ROBOTS, KAIJUS, STAGES, resolve } from './roster.js?v=1';
import { makeFx } from './fx.js?v=6';
import { Fighter, think } from './fighters.js?v=7';
import { Audio } from './audio.js?v=3';
import { T, has, getLang, setLang, applyDom } from './i18n.js?v=4';
applyDom();

const $ = (s) => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ quality
const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 600;
const PRESETS = {
  low: { name: 'qLow', pr: 0.75, aa: false, shadows: false, shadowSize: 1024, water: true, waterRes: 256, streetLights: false, rain: 5000, helis: 1, particles: 1800, fireLights: 2, bloom: true },
  mid: { name: 'qMid', pr: 1, aa: false, shadows: true, shadowSize: 2048, water: true, waterRes: 512, streetLights: false, rain: 12000, helis: 2, particles: 3500, fireLights: 4, bloom: true },
  high: { name: 'qHigh', pr: Math.min(2, devicePixelRatio), aa: true, shadows: true, shadowSize: 4096, water: true, waterRes: 1024, streetLights: true, rain: 22000, helis: 3, particles: 6000, fireLights: 6, bloom: true },
};
let qKey = (() => { try { return localStorage.getItem('kaiju.q') || (mobile ? 'low' : 'mid'); } catch { return mobile ? 'low' : 'mid'; } })();
const urlQ = new URLSearchParams(location.search).get('q'); if (PRESETS[urlQ]) qKey = urlQ;
const q = PRESETS[qKey];

// ------------------------------------------------------------------ renderer, scene, post
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: q.aa, powerPreference: 'high-performance' }); }
catch (e) { $('#nogl').hidden = false; throw e; }
renderer.setPixelRatio(q.pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = q.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 5000);
camera.position.set(0, 30, 260);

// the stage and the fighters: what the title screen chose ('random' or an id), remembered between visits
const sel = { stage: 'random', robot: 'random', kaiju: 'random' };
try { Object.assign(sel, JSON.parse(localStorage.getItem('kaiju.sel') || '{}')); } catch {}
let W = null;
function setStage(id) {
  if (W) { W.dispose(); fx && fx.clear(); }
  W = buildWorld(scene, renderer, q, id);
  W.onThunder = () => { Audio.thunder(rnd(1, 2.5)); shake = Math.max(shake, 0.15); };
  Audio.weather && Audio.weather(W.precip);
}
setStage(resolve(sel.stage, STAGES));
var fx = makeFx(scene, q);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// a NaN or an overflowed (infinite) pixel from any shader or a very close light would be smeared by the bloom blur into
// flickering black blocks; clean the frame before it gets there
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    float ok(float x){ return x >= 0. && x < 1e4 ? x : (x >= 1e4 ? 40. : 0.); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(min(vec3(ok(c.r), ok(c.g), ok(c.b)), vec3(40.)), 1.); }` }));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.55, 0.82); composer.addPass(bloom);
// the camera: colour grade (cold shadows, warm highlights, low saturation), chromatic aberration, vignette, film grain, letterbox, hit flash
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 0.0015 }, uFlash: { value: 0 }, uHurt: { value: 0 }, uBars: { value: 0 }, uAspect: { value: innerWidth / innerHeight } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uCA, uFlash, uHurt, uBars, uAspect; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.13)*43758.5453); }
    void main(){
      vec2 d = vUv - .5; float r = length(d * vec2(uAspect, 1.));
      vec2 off = d * uCA * (1. + r * 2.);
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(c, vec3(.2126,.7152,.0722));
      c = mix(vec3(l), c, .78);                                         // pull saturation down
      c *= mix(vec3(.82,.95,1.12), vec3(1.08,1.,.9), smoothstep(0., .6, l));   // teal shadows, warm highlights
      c = max(c - .004, 0.) * 1.02;                                      // crush the blacks a little
      c *= 1. - smoothstep(.45, 1.15, r) * .75;                          // vignette
      c += (h(vUv * 1000.) - .5) * .035 * (1. - l * .5);                 // grain
      c = mix(c, vec3(1.), uFlash * .6);
      c = mix(c, c * vec3(1.4,.3,.25), uHurt * smoothstep(.25, .9, r));
      float bar = step(abs(vUv.y - .5), .5 - uBars);
      gl_FragColor = vec4(c * bar, 1.);
    }`,
});
composer.addPass(grade); composer.addPass(new OutputPass());
bloom.enabled = q.bloom;

// a light that flashes where a blow lands
const hitLight = new THREE.PointLight(0xffc080, 0, 140, 2); scene.add(hitLight);
const rim = new THREE.DirectionalLight(0xa8bcff, 2.4); scene.add(rim, rim.target);
const bounce = new THREE.DirectionalLight(0xff8a44, 0.7); scene.add(bounce, bounce.target);
function placeLights() {
  const m = mid(), away = m.clone().sub(camera.position).setY(0).normalize();
  rim.target.position.copy(m).setY(40); rim.position.copy(m).addScaledVector(away, 300).setY(220); rim.intensity = 2.4 + W.flash * 4;
  bounce.target.position.copy(m).setY(50); bounce.position.copy(m).add(V(-80, -30, 200));
}
// keep the camera out of buildings: march from the subject toward the camera and stop in front of the first wall
function clampCam(pos, look) {
  const dir = pos.clone().sub(look), len = dir.length(); dir.divideScalar(len || 1);
  const p = V(); let last = look.clone();
  for (let d = 6; d <= len; d += 3) {
    p.copy(look).addScaledVector(dir, d);
    for (const b of W.buildings) if (b.alive && !b.pole && p.y < b.h + 3 && Math.abs(p.x - b.x) < b.w / 2 + 3 && Math.abs(p.z - b.z) < b.d / 2 + 3) return last;
    last = p.clone();
  }
  return pos;
}

// ------------------------------------------------------------------ the fight
let robot, kaiju, mode = 'title', pilot = null, endT = 0, slow = 1, slowT = 0, shake = 0, flash = 0, hurt = 0, fightT = 0;
const shots = [];   // plasma bolts and missiles in flight
// the kaiju's heat beam: a white-hot core inside a blue halo, redrawn every frame it fires
const beamG = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true); beamG.translate(0, 0.5, 0);
const beamMesh = new THREE.Group(), beamCore = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xc8f4ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
const beamHalo = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0x2a8cff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
beamCore.scale.set(1.5, 1, 1.5); beamHalo.scale.set(5, 1, 5); beamCore.frustumCulled = beamHalo.frustumCulled = false; beamMesh.add(beamCore, beamHalo); beamMesh.visible = false; scene.add(beamMesh);
const beamLight = new THREE.PointLight(0x5ad0ff, 0, 240, 2); scene.add(beamLight);
let beamOn = 0, scorchT = 0;
function newFight() {
  for (const f of [robot, kaiju]) if (f) scene.remove(f.root);
  robot = new Fighter('robot', scene, ROBOTS[resolve(sel.robot, Object.keys(ROBOTS))]); kaiju = new Fighter('kaiju', scene, KAIJUS[resolve(sel.kaiju, Object.keys(KAIJUS))]);
  // the kaiju's breath, beam and blood take its colour
  const kv = kaiju.v; beamCore.material.color.setHex(kv.beam[0]); beamHalo.material.color.setHex(kv.beam[1]); beamLight.color.setHex(kv.beam[2]);
  // they start far apart, somewhere different every fight: often the kaiju wading in from the harbour, sometimes already in the streets
  const [rp, kp] = startSpots(); robot.pos.copy(rp); kaiju.pos.copy(kp);
  robot.yaw = Math.atan2(kp.x - rp.x, kp.z - rp.z); kaiju.yaw = Math.atan2(rp.x - kp.x, rp.z - kp.z);
  shots.length = 0; endT = 0; fightT = 0; slow = 1; beamOn = 0; director.next = null; director.cut('wide');
}
function startSpots() {
  const clear = (p, r) => !W.buildings.some((b) => b.alive && !b.pole && Math.abs(p.x - b.x) < b.w / 2 + r && Math.abs(p.z - b.z) < b.d / 2 + r);
  let best = null;
  for (let i = 0; i < 300; i++) {
    const K = V(rnd(-300, 300), 0, Math.random() < 0.5 ? rnd(-225, -90) : rnd(-90, 280)), a = rnd(0, Math.PI * 2), d = rnd(260, 380);
    const Rp = K.clone().add(V(Math.sin(a) * d, 0, Math.cos(a) * d));
    if (Math.abs(Rp.x) > 400 || Rp.z < SHORE + 10 || Rp.z > 480) continue;
    best = best || [Rp, K];
    if ((K.z < SHORE || clear(K, 26)) && clear(Rp, 16)) return [Rp, K];
  }
  return best || [V(0, 0, 150), V(0, 0, -215)];
}
const fighters = () => [robot, kaiju];
const mid = () => robot.pos.clone().add(kaiju.pos).multiplyScalar(0.5);

function bigHit(p, power) { hitLight.position.copy(p); hitLight.intensity = 22000 * power; shake = Math.max(shake, 1.2 * power); flash = Math.max(flash, 0.12 * power); }
function slowmo(k, t) { slow = k; slowT = t; }
const camDist = (p) => camera.position.distanceTo(p);

function handleEvents(f, opp) {
  for (const e of f.events) {
    switch (e.type) {
      case 'attack':
        if (e.super && mode !== 'title') { banner(T(has(e.name + '_' + f.v.id) ? e.name + '_' + f.v.id : e.name), f); director.super(f, e.name); }
        if (e.name === 'beam') { Audio.charge(); Audio.roar(1.4, 1.25); break; }
        if (e.name === 'quake') { Audio.roar(1.6, 0.9); break; }
        if (f.kind === 'robot') { Audio.servo(); if (e.name === 'plasma' || e.super) Audio.charge(); else Audio.whoosh(); }
        else if (e.name === 'acid') Audio.hiss(f.moves.acid.dur * 0.55);
        else if (e.name !== 'roar') Audio.whoosh();
        break;
      case 'hit': {
        const blocked = e.dmg < 0, power = Math.min(2, Math.abs(e.dmg) / 50 + 0.4);
        const dir = opp.pos.clone().sub(f.pos).setY(0).normalize();
        if (opp.kind === 'robot') { fx.sparks(e.point, blocked ? 50 : 90); Audio.clang(power); if (!blocked && e.heavy) fx.explosion(e.point, 0.5); }
        else { fx.blood(e.point, dir, blocked ? 10 : 34, opp.v.blood); fx.sparks(e.point, 20, opp.v.blood.map((c) => 0.4 + c * 0.6)); Audio.thud(power); Audio.clang(power * 0.4); }
        bigHit(e.point, blocked ? 0.4 : power);
        if (e.heavy && !blocked) { slowmo(0.25, 0.5); director.impact(e.point, opp); }
        if (pilot && opp === pilot) hurt = Math.min(1, hurt + 0.5);
        break; }
      case 'shoot': shots.push({ p: e.from.clone(), dir: e.dir, dmg: e.dmg, life: 2, from: f }); Audio.zap(); bigHit(e.from, 0.5); break;
      case 'breath': fx.acid(e.from, e.dir, f.v.breath); break;
      case 'missile': {
        const side = V(rnd(-1, 1), 0, rnd(-1, 1)).multiplyScalar(18);
        shots.push({ missile: true, p: e.from.clone(), v: e.dir.clone().multiplyScalar(70).add(side), sp: 90, t: 0, life: 4, target: e.target, from: f, jit: V(rnd(-9, 9), rnd(-14, 12), rnd(-9, 9)) });
        fx.thrust(e.from, e.dir.clone().negate(), 1.4); if (Math.random() < 0.5) Audio.whoosh(); break; }
      case 'beam': {
        if (f.act && !f.act.beamSnd) { f.act.beamSnd = true; Audio.zap(); Audio.hiss(f.act.m.dur * (f.act.m.beam[1] - f.act.m.beam[0])); }
        const v = e.to.clone().sub(e.from), L = Math.max(1, v.length()), fl = 1 + Math.sin(t * 60) * 0.12 + Math.random() * 0.1;
        beamMesh.position.copy(e.from); beamMesh.quaternion.setFromUnitVectors(V(0, 1, 0), v.divideScalar(L)); beamMesh.scale.set(fl, L, fl); beamOn = 0.08;
        beamDanger(e.from, e.to); dangerAt(e.to, 12, 'beam');
        beamLight.position.copy(e.to); beamLight.intensity = 26000; hitLight.position.copy(e.from); hitLight.intensity = Math.max(hitLight.intensity, 9000);
        fx.sparks(e.to, 6, [0.5, 0.9, 1]); fx.glow.add({ x: e.to.x, y: e.to.y, z: e.to.z, vx: rnd(-6, 6), vy: rnd(4, 14), vz: rnd(-6, 6), life: rnd(0.4, 0.8), size: rnd(10, 18), grow: 1.5, color: [0.3, 0.75, 1], alpha: 0.6 });
        if (e.ground && (scorchT -= rdtNow) < 0) { scorchT = 0.25; fx.dust(e.to.x, e.to.z, 0.6); fx.fire(e.to.x + rnd(-3, 3), e.to.z + rnd(-3, 3), 1, rnd(8, 16)); }
        shake = Math.max(shake, 0.35); break; }
      case 'quake': {
        if (onFoot && human.alive && Math.hypot(human.pos.x - e.p.x, human.pos.z - e.p.z) < e.r * 0.45) killHuman('blast');
        fx.shockwave(e.p, e.r * (e.big ? 1.4 : 1), e.big ? [0.55, 0.85, 1] : [0.7, 0.9, 1]); Audio.explosion(e.big ? 1.6 : 1.1, camDist(e.p)); Audio.step(2.5, camDist(e.p));
        shake = Math.max(shake, e.big ? 2.2 : 1.5); flash = Math.max(flash, 0.22); if (e.big) slowmo(0.35, 0.6); break; }
      case 'land': fx.dust(e.p.x, e.p.z, 1.1 * e.power); Audio.step(1.5 * e.power, camDist(e.p)); shake = Math.max(shake, Math.min(0.9, 60 / camDist(e.p))); break;
      case 'thrust': for (const p of e.ps) fx.thrust(p, e.dir, e.k); break;
      case 'breathe': for (const p of e.ps) for (let i = 0; i < 5; i++) fx.smoke.add({ x: p.x, y: p.y, z: p.z, vx: e.dir.x * rnd(5, 9) + rnd(-1, 1), vy: e.dir.y * rnd(5, 9) + rnd(-0.5, 1), vz: e.dir.z * rnd(5, 9) + rnd(-1, 1), life: rnd(1.6, 2.6), size: rnd(1.5, 3), grow: 3.5, color: [0.42, 0.45, 0.48], alpha: 0.16, drag: 1.2, fadeIn: 0.2 }); break;
      case 'vent': for (const p of e.ps) for (let i = 0; i < 16; i++) fx.smoke.add({ x: p.x + rnd(-1, 1), y: p.y, z: p.z + rnd(-1, 1), vx: e.up.x * rnd(8, 18) + rnd(-2, 2), vy: e.up.y * rnd(10, 22), vz: e.up.z * rnd(8, 18) + rnd(-2, 2), life: rnd(2, 3.5), size: rnd(2.5, 5), grow: 4, color: [0.55, 0.58, 0.62], alpha: 0.28, drag: 1, fadeIn: 0.1 }); if (camDist(e.ps[0]) < 160) Audio.hiss && Audio.whoosh(); break;
      case 'burn': if (Math.random() < 0.3) fx.sparks(e.point.clone().add(V(rnd(-8, 8), rnd(-10, 10), rnd(-8, 8))), 6, [0.4, 0.9, 1]); if (pilot === opp) hurt = Math.min(0.7, hurt + 0.02); break;
      case 'roar': Audio.roar(2.4); shake = Math.max(shake, 0.6); director.roar(f); break;
      case 'step': {
        const d = camDist(e.p); if (e.water) { for (let i = 0; i < 14; i++) fx.smoke.add({ x: e.p.x + rnd(-4, 4), y: 0, z: e.p.z + rnd(-4, 4), vx: rnd(-10, 10), vy: rnd(10, 26), vz: rnd(-10, 10), life: rnd(1, 2), size: rnd(4, 9), grow: 2, color: [0.5, 0.55, 0.6], alpha: 0.4, grav: 25, drag: 0.5 }); }
        else fx.dust(e.p.x, e.p.z, 0.45 * e.power);
        Audio.step(e.power, d, e.water); shake = Math.max(shake, Math.min(0.5, 40 / d) * e.power); break; }
      case 'smash': {
        const b = e.b, d = camDist(V(b.x, 0, b.z));
        if (b.pole) { fx.sparks(V(b.x, 9, b.z), 25); }
        else { fx.collapse(b); Audio.collapse(d); shake = Math.max(shake, Math.min(1, 80 / d)); if (b.h > 60) director.collapse(b); }
        break; }
      case 'death': slowmo(0.3, 2.2); Audio.explosion(1.5, camDist(f.pos)); if (f.kind === 'kaiju') Audio.roar(3.5, 0.75); else { fx.explosion(f.wp('chest', [0, 10, 9]), 1.5); } director.death(f); break;
    }
  }
  f.events.length = 0;
}

function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    if (shots[i].missile) { updateMissile(shots[i], i, dt); continue; }
    const s = shots[i], step = 320 * dt; s.life -= dt; fx.plasma(s.p, s.dir);
    let boom = s.life <= 0 || s.p.y < 0.5;
    const target = s.from === robot ? kaiju : robot;
    for (let k = 0; k < 4 && !boom; k++) {
      s.p.addScaledVector(s.dir, step / 4);
      if (target.alive && target.hitTest(target, s.p, 4)) { const d = target.takeHit(s.dmg, s.from, 22); s.from.emit && s.from.emit('hit', { point: s.p.clone(), dmg: d, move: 'plasma', heavy: true }); boom = true; }
      for (const b of W.buildings) if (b.alive && !b.pole && Math.abs(s.p.x - b.x) < b.w / 2 && Math.abs(s.p.z - b.z) < b.d / 2 && s.p.y < b.h) { W.collapse(b); fx.collapse(b); Audio.collapse(camDist(s.p)); boom = true; break; }
    }
    if (boom) { fx.explosion(s.p, 1); Audio.explosion(1, camDist(s.p)); bigHit(s.p, 1.2); dangerAt(s.p, 14, 'blast'); shots.splice(i, 1); }
  }
}

// a missile: flies out of its pod, then curves onto the target, faster and faster
function updateMissile(s, i, dt) {
  const target = s.target; s.t += dt; s.life -= dt;
  if (s.t > 0.35 && target.alive) { const aim = target.pos.clone().setY(target.kind === 'robot' ? 45 : 42).add(s.jit).sub(s.p).normalize().multiplyScalar(s.sp); s.v.lerp(aim, 1 - Math.exp(-dt * 3.4)); }
  s.sp = Math.min(270, s.sp + dt * 230);
  let boom = s.life <= 0;
  for (let k = 0; k < 3 && !boom; k++) {
    s.p.addScaledVector(s.v, dt / 3);
    if (s.p.y < 0.5) boom = true;
    else if (target.alive && target.hitTest(target, s.p, 3)) { const d = target.takeHit(8, s.from, 3); s.from.emit('hit', { point: s.p.clone(), dmg: d, move: 'missile', heavy: false }); boom = true; }
    else for (const b of W.buildings) if (b.alive && !b.pole && Math.abs(s.p.x - b.x) < b.w / 2 && Math.abs(s.p.z - b.z) < b.d / 2 && s.p.y < b.h) { W.collapse(b); fx.collapse(b); Audio.collapse(camDist(s.p)); boom = true; break; }
  }
  fx.trail(s.p);
  if (boom) { fx.explosion(s.p, 0.45); Audio.explosion(0.5, camDist(s.p)); bigHit(s.p, 0.5); dangerAt(s.p, 9, 'blast'); shots.splice(i, 1); }
}

// the special move's name across the screen
let bannerT = 0;
function banner(text, f) {
  const b = $('#banner'); b.className = f.kind; b.style.setProperty('--kc', f.v.css || '#3ad8ff'); $('#bnName').textContent = text; $('#bnWho').textContent = T(f.v.name) + ' ' + T('superOf');
  b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(bannerT); bannerT = setTimeout(() => { b.hidden = true; }, 2600);
}

// ------------------------------------------------------------------ the camera director (spectator mode): cuts between shots like a broadcast
const smoothLook = V(), tmp = V();
const director = {
  shot: 'wide', t: 0, len: 6, seed: 0, focus: null, label: '',
  pick() {
    const d = robot.pos.distanceTo(kaiju.pos);
    const opts = d > 120 ? ['wide', 'heli', 'street', 'waterline'] : ['street', 'shoulderR', 'shoulderK', 'heli', 'low', 'wide', 'orbit'];
    let s; do s = opts[Math.floor(Math.random() * opts.length)]; while (s === this.shot && opts.length > 1);
    this.cut(s);
  },
  cut(s, len) { this.shot = s; this.t = 0; this.len = len || rnd(4.5, 8); this.seed = Math.random(); this.side = Math.random() < 0.5 ? -1 : 1; this.base = null; this.label = LABELS[s] ? T(LABELS[s]) : ''; if (!onFoot) $('#feed').textContent = this.label; },
  impact(p, who) { if (mode !== 'watch' || this.shot === 'hero' || Math.random() < 0.35) return; this.cut('close', 1.6); this.focus = p.clone(); this.who = who; },
  // a special move: a low hero shot of the one winding up, then a wide side view of the payoff
  super(f, name) { if (mode !== 'watch') return; const m = f.moves[name]; this.cut('hero', Math.max(1.2, m.dur * (m.windup || (m.leap ? m.leap[0] : 0.3)))); this.who = f; this.next = { shot: 'side', len: Math.max(3.5, m.dur * 0.8) }; },
  roar(f) { if (mode === 'watch' && Math.random() < 0.7) { this.cut('face', 2.6); this.who = f; } },
  collapse(b) { if (mode === 'watch' && Math.random() < 0.35 && this.shot !== 'close') { this.cut('ruin', 3); this.focus = V(b.x, 0, b.z); } },
  death(f) { if (mode === 'watch') { this.cut('death', 6); this.who = f; } },
  // where the camera is and what it looks at, for each kind of shot
  frame(dt) {
    this.t += dt; if (this.t > this.len && mode === 'watch') { if (this.next) { const n = this.next; this.next = null; this.cut(n.shot, n.len); } else this.pick(); }
    const m = mid(), R = robot.pos, K = kaiju.pos, a = K.clone().sub(R).setY(0).normalize(), side = V(a.z, 0, -a.x).multiplyScalar(this.side), t = this.t;
    let pos, look, fov = 38;
    switch (this.shot) {
      case 'wide': pos = m.clone().addScaledVector(side, 230).add(V(0, 26 + t * 1.5, 0)).addScaledVector(a, -40 + t * 4); look = m.clone().setY(40); fov = 34; break;
      case 'heli': { const ang = this.seed * 6.28 + t * 0.08; pos = m.clone().add(V(Math.cos(ang) * 190, 120, Math.sin(ang) * 190)); look = m.clone().setY(30); fov = 30; break; }
      // from the street: a person's eye height, the giants towering over
      case 'street': { if (!this.base) this.base = m.clone().addScaledVector(side, rnd(70, 110)).addScaledVector(a, rnd(-40, 40)).setY(1.7); pos = this.base.clone().add(V(0, 0, -t * 1.5)); look = m.clone().setY(55); fov = 52; break; }
      case 'low': { if (!this.base) this.base = m.clone().addScaledVector(side, 45).setY(3); pos = this.base.clone().addScaledVector(a, t * 3); look = (this.seed < 0.5 ? R : K).clone().setY(50); fov = 58; break; }
      case 'shoulderR': pos = R.clone().addScaledVector(a, -38).addScaledVector(side, 26).setY(64); look = K.clone().setY(48); fov = 40; break;
      case 'shoulderK': pos = K.clone().addScaledVector(a, 42).addScaledVector(side, 30).setY(62); look = R.clone().setY(52); fov = 40; break;
      case 'orbit': { const ang = this.seed * 6.28 + t * 0.22 * this.side; pos = m.clone().add(V(Math.cos(ang) * 120, 35, Math.sin(ang) * 120)); look = m.clone().setY(45); break; }
      case 'waterline': { if (!this.base) this.base = V(K.x + this.side * 90, 2.5, SHORE + 30); pos = this.base; look = K.clone().setY(40); fov = 44; break; }
      case 'close': { const w = this.who || kaiju; pos = this.focus.clone().addScaledVector(side, 60).add(V(0, 6, 0)).addScaledVector(a, -10); look = this.focus; fov = 30; break; }
      case 'face': { const w = this.who, hp = w.wp('head', [0, 0, 10]), f = w.face(); const sd = V(f.z, 0, -f.x).multiplyScalar(this.side); pos = hp.clone().addScaledVector(f, 26).addScaledVector(sd, 48).add(V(0, -16, 0)); look = hp; fov = 32; break; }
      case 'ruin': pos = this.focus.clone().addScaledVector(side, 110).add(V(0, 8, 0)); look = this.focus.clone().setY(25); fov = 40; break;
      case 'hero': { const w = this.who, f = w.face(), sd = V(f.z, 0, -f.x).multiplyScalar(this.side); pos = w.pos.clone().addScaledVector(f, 78 - t * 7).addScaledVector(sd, 50).setY(7 + t * 2); look = w.pos.clone().setY((w.kind === 'robot' ? 52 : 58) + (w.air || 0)); fov = 52; break; }
      case 'side': pos = m.clone().addScaledVector(side, 185).add(V(0, 30, 0)).addScaledVector(a, t * 3); look = m.clone().setY(40 + Math.max(robot.air, kaiju.air) * 0.6); fov = 42; break;
      case 'title': pos = V(52 - t * 0.6, 2.2, 160); look = V(-85, 48, 0); fov = 50; break;
      case 'death': { const w = this.who; pos = w.pos.clone().addScaledVector(side, 120 - t * 6).add(V(0, 20 + t * 4, 0)); look = w.pos.clone().setY(20); fov = 36; break; }
    }
    return { pos, look, fov };
  },
};
const LABELS = { hero: 'camNews', side: 'camHeli2', wide: 'camNews', heli: 'camHeli2', street: 'camPhone', low: 'camCctv', shoulderR: 'camCockpit', shoulderK: 'camNews', orbit: 'camHeli1', waterline: 'camHarbour', ruin: 'camPhone', death: 'camNews' };

// pilot camera: behind your giant, framing the enemy
function pilotFrame() {
  const me = pilot, foe = me === robot ? kaiju : robot, a = foe.pos.clone().sub(me.pos).setY(0).normalize(), side = V(a.z, 0, -a.x);
  const pos = me.pos.clone().addScaledVector(a, -80).addScaledVector(side, 62).setY(me === robot ? 66 : 62);
  const look = me.pos.clone().lerp(foe.pos, 0.6).setY(42);
  return { pos, look, fov: 46 };
}

// ------------------------------------------------------------------ on foot: one person in the street, looking up at the fight
let onFoot = false;
const human = { pos: V(), yaw: 0, pitch: 0.25, bob: 0, alive: true, t: 0, deadT: 0, cause: '', moving: 0 };
const inBuilding = (p, r) => { for (const b of W.buildings) if (b.alive && !b.pole && Math.abs(p.x - b.x) < b.w / 2 + r && Math.abs(p.z - b.z) < b.d / 2 + r) return b; return null; };
function placeHuman() {
  // somewhere on a street behind the jaeger, out of the way, with a clear view down to the harbour
  const m = mid(), sees = (p) => { const tgt = m.clone().setY(45), eye = p.clone().setY(1.7), L = eye.distanceTo(tgt); for (let d = 8; d < L; d += 4) { const q = eye.clone().lerp(tgt, d / L); for (const b of W.buildings) if (b.alive && !b.pole && q.y < b.h && Math.abs(q.x - b.x) < b.w / 2 && Math.abs(q.z - b.z) < b.d / 2) return false; } return true; };
  let found = null;
  for (let i = 0; i < 800 && !found; i++) {
    const a = rnd(0, Math.PI * 2), p = m.clone().add(V(Math.sin(a), 0, Math.cos(a)).multiplyScalar(rnd(150, 260))).setY(0);
    if (Math.abs(p.x) > 410 || p.z < SHORE + 8 || p.z > 510 || inBuilding(p, 3) || p.distanceTo(robot.pos) < 90 || p.distanceTo(kaiju.pos) < 100) continue;
    if (i > 600 || sees(p)) found = p;
  }
  human.pos.copy(found || V(0, 0, 240));
  human.yaw = Math.atan2(m.x - human.pos.x, m.z - human.pos.z); human.pitch = 0.22;
  Object.assign(human, { alive: true, t: 0, deadT: 0, cause: '', bob: 0, moving: 0 });
}
function killHuman(cause) {
  if (!human.alive) return; human.alive = false; human.cause = cause; hurt = 1; shake = Math.max(shake, 2); flash = Math.max(flash, cause === 'beam' || cause === 'blast' ? 0.8 : 0.3);
  endT = 0; if (document.pointerLockElement) document.exitPointerLock();
}
function updateHuman(dt) {
  if (!human.alive) { human.deadT += dt; return; }
  human.t += dt;
  let mv = 0, st = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mv += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) mv -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) st += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) st -= 1;
  if (touch.active) { mv -= touch.y; st += touch.x; }
  const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (pad) { const ax = pad.axes; if (Math.abs(ax[1]) > 0.15) mv -= ax[1]; if (Math.abs(ax[0]) > 0.15) st += ax[0]; if (Math.abs(ax[2]) > 0.15) human.yaw -= ax[2] * dt * 2.2; if (Math.abs(ax[3]) > 0.15) human.pitch = Math.max(-1.2, Math.min(1.35, human.pitch - ax[3] * dt * 1.6)); }
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(touch.x, touch.y) > 0.92 || (pad && pad.buttons[10] && pad.buttons[10].pressed);
  const f = V(Math.sin(human.yaw), 0, Math.cos(human.yaw)), r = V(-f.z, 0, f.x), d = f.multiplyScalar(mv).addScaledVector(r, st);
  const len = Math.min(1, d.length()); human.moving += ((len > 0.05 ? (run ? 1.6 : 1) : 0) - human.moving) * Math.min(1, dt * 6);
  if (len > 0.05) {
    d.normalize().multiplyScalar(len * (run ? 13 : 5.5) * dt); human.pos.add(d);
    // walls: slide along the side of a building
    const b = inBuilding(human.pos, 0.6);
    if (b) { const ox = b.w / 2 + 0.6 - Math.abs(human.pos.x - b.x), oz = b.d / 2 + 0.6 - Math.abs(human.pos.z - b.z); if (ox < oz) human.pos.x += Math.sign(human.pos.x - b.x) * ox; else human.pos.z += Math.sign(human.pos.z - b.z) * oz; }
    const was = Math.floor(human.bob / Math.PI); human.bob += dt * (run ? 15 : 9) * len; if (Math.floor(human.bob / Math.PI) !== was) Audio.step(run ? 0.05 : 0.03, 12, STAGE.water && human.pos.z < SHORE);
  }
  human.pos.x = Math.max(-420, Math.min(420, human.pos.x)); human.pos.z = Math.max(SHORE + 2, Math.min(520, human.pos.z));
  // the giants do not see you: underfoot, under a falling body, under a falling building
  for (const g of [robot, kaiju]) {
    if (g.air > 15) continue;
    if (Math.hypot(human.pos.x - g.pos.x, human.pos.z - g.pos.z) < g.R * 0.8) killHuman(g.kind);
    if (g.down > 0 || !g.alive) { const body = g.pos.clone().addScaledVector(g.face(), -36); if (Math.hypot(human.pos.x - body.x, human.pos.z - body.z) < g.R) killHuman(g.kind); }
  }
  for (const b of W.buildings) if (!b.alive && !b.pole && b.fallT !== undefined && b.fallT < 2.5 && Math.abs(human.pos.x - b.x) < b.w / 2 + 4 && Math.abs(human.pos.z - b.z) < b.d / 2 + 4) killHuman('rubble');
}
// near a blast or a beam: anything closer than r to the person kills them
function dangerAt(p, r, cause) { if (onFoot && human.alive && p.distanceTo(human.pos.clone().setY(1.5)) < r) killHuman(cause); }
function beamDanger(a, b) { if (!onFoot || !human.alive) return; const h = human.pos.clone().setY(1.5), ab = b.clone().sub(a), k = Math.max(0, Math.min(1, h.clone().sub(a).dot(ab) / ab.lengthSq())); if (a.clone().addScaledVector(ab, k).distanceTo(h) < 7) killHuman('beam'); }
// first-person camera: eye height, a little walking bob; dead, it drops to the ground and looks up at the sky
function humanFrame() {
  const dead = !human.alive, k = Math.min(1, human.deadT / 1.2);
  const eye = human.pos.clone().setY((dead ? 1.7 - 1.4 * k : 1.7) + Math.sin(human.bob * 2) * 0.07 * Math.min(1, human.moving));
  eye.x += Math.cos(human.bob) * 0.04 * Math.min(1, human.moving);
  const pitch = dead ? human.pitch + (1.25 - human.pitch) * k : human.pitch;
  const dir = V(Math.sin(human.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(human.yaw) * Math.cos(pitch));
  return { pos: eye, look: eye.clone().addScaledVector(dir, 20), fov: human.moving > 1.2 ? 74 : 68 };
}
const canvas = renderer.domElement;
canvas.addEventListener('click', () => { if (onFoot && human.alive && mode === 'human' && !document.pointerLockElement && canvas.requestPointerLock) canvas.requestPointerLock(); });
let drag = null;
canvas.addEventListener('pointerdown', (e) => { if (onFoot && !document.pointerLockElement) drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', (e) => { if (drag && drag.id === e.pointerId) drag = null; });
const look = (dx, dy, k) => { human.yaw -= dx * k; human.pitch = Math.max(-1.2, Math.min(1.35, human.pitch - dy * k)); };
addEventListener('pointermove', (e) => {
  if (!onFoot || !human.alive) return;
  if (document.pointerLockElement === canvas) look(e.movementX, e.movementY, 0.0022);
  else if (drag && drag.id === e.pointerId) { look(e.clientX - drag.x, e.clientY - drag.y, e.pointerType === 'touch' ? 0.006 : 0.004); drag.x = e.clientX; drag.y = e.clientY; }
});

// ------------------------------------------------------------------ input
const keys = new Set(); let gp = null;
addEventListener('keydown', (e) => { if (e.repeat) return; keys.add(e.code); if (mode === 'pilot') pressed(e.code); if (e.code === 'Escape' && mode !== 'title') toTitle(); if (e.code === 'KeyM') toggleMute(); });
addEventListener('keyup', (e) => keys.delete(e.code));
const ROBOT_KEYS = { KeyJ: 'jab', KeyK: 'cross', KeyL: 'upper', KeyI: 'kick', KeyU: 'elbow', KeyO: 'hammer', KeyH: 'combo', KeyG: 'rocket', KeyQ: 'plasma', KeyE: 'missiles', KeyF: 'blade', KeyC: 'backstep' };
const KAIJU_KEYS = { KeyJ: 'swipe', KeyK: 'bite', KeyL: 'tail', KeyI: 'charge', KeyU: 'rake', KeyO: 'headbutt', KeyH: 'stomp', KeyG: 'pounce', KeyQ: 'acid', KeyR: 'roar', KeyE: 'beam', KeyF: 'quake', KeyC: 'hop' };
function pressed(code) {
  const map = pilot === robot ? ROBOT_KEYS : KAIJU_KEYS;
  if (map[code]) pilot.start(map[code]);
  if ((code === 'ShiftLeft' || code === 'ShiftRight') && pilot === robot && !(robot.cd.dash > 0) && robot.can()) { robot.dash = 0.45; robot.cd.dash = 2.5; Audio.whoosh(); Audio.servo(); }
}
function pilotInput() {
  const i = { move: 0, strafe: 0 };
  if (keys.has('KeyW') || keys.has('ArrowUp')) i.move += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) i.move -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) i.strafe += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) i.strafe -= 1;
  let block = keys.has('Space');
  if (touch.active) { i.move += -touch.y; i.strafe += touch.x; block = block || touch.block; }
  const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (pad) {
    const ax = pad.axes; if (Math.abs(ax[1]) > 0.15) i.move -= ax[1]; if (Math.abs(ax[0]) > 0.15) i.strafe += ax[0];
    const b = pad.buttons.map((x) => x.pressed), prev = gp || [];
    const map = pilot === robot ? ['jab', 'cross', 'kick', 'upper'] : ['swipe', 'bite', 'charge', 'tail'];
    [0, 1, 2, 3].forEach((k) => { if (b[k] && !prev[k]) pilot.start(map[k]); });
    if (b[5] && !prev[5]) pilot.start(pilot === robot ? 'plasma' : 'acid');
    if (b[7] && !prev[7]) pressed('ShiftLeft');
    if (b[6] && !prev[6] && pilot === kaiju) pilot.start('roar');
    // d-pad: up and down for the two special moves, left to back off, right for the rocket punch / pounce; stick clicks for the combo and the hammer / stomp
    [[12, 'KeyE'], [13, 'KeyF'], [14, 'KeyC'], [15, 'KeyG'], [10, 'KeyH'], [11, 'KeyO']].forEach(([k, c]) => { if (b[k] && !prev[k]) pressed(c); });
    block = block || b[4]; gp = b;
  }
  if (pilot === robot) pilot.block = block && pilot.can(); return i;
}
// touch: a stick on the left, buttons on the right
const touch = { active: false, x: 0, y: 0, id: null, block: false };
function setupTouch() {
  const stick = $('#stick'), knob = $('#knob');
  stick.addEventListener('pointerdown', (e) => { touch.id = e.pointerId; touch.active = true; stick.setPointerCapture(e.pointerId); move(e); });
  const move = (e) => { if (e.pointerId !== touch.id) return; const r = stick.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } touch.x = x; touch.y = y; knob.style.transform = `translate(${x * 40}px,${y * 40}px)`; };
  stick.addEventListener('pointermove', move);
  const up = (e) => { if (e.pointerId !== touch.id) return; touch.active = false; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', up); stick.addEventListener('pointercancel', up);
  document.querySelectorAll('#pads [data-k]').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (k === 'Space') touch.block = true; else pressed(k); });
    const rel = () => { if (k === 'Space') touch.block = false; }; b.addEventListener('pointerup', rel); b.addEventListener('pointerleave', rel);
  });
}
setupTouch();

// ------------------------------------------------------------------ screens and HUD
function toTitle(rebuild = true) { mode = 'title'; pilot = null; onFoot = false; if (document.pointerLockElement) document.exitPointerLock(); $('#title').hidden = false; $('#hud').hidden = true; $('#end').hidden = true; $('#pads').hidden = true; $('#help').hidden = true; if (rebuild) setStage(resolve(sel.stage, STAGES)); newFight(); robot.pos.set(0, 0, 62); robot.yaw = Math.PI; kaiju.pos.set(-20, 0, -110); director.cut('title', 999); }
function begin(m) {
  // every fight gets a fresh city (the title screen's preview may already be the chosen stage)
  Audio.start(); setStage(resolve(sel.stage, STAGES)); newFight(); onFoot = m === 'human'; mode = m === 'watch' ? 'watch' : onFoot ? 'human' : 'pilot'; pilot = m === 'robot' ? robot : m === 'kaiju' ? kaiju : null;
  $('#title').hidden = true; $('#hud').hidden = false; $('#end').hidden = true;
  $('#pads').hidden = !((pilot || onFoot) && (matchMedia('(pointer: coarse)').matches || mobile));
  $('#feed').hidden = !!pilot;
  if (onFoot) placeHuman();
  director.cut(pilot || kaiju.pos.z > SHORE ? 'wide' : 'waterline', 6);
  labelHud();
}
// the texts that depend on the mode and the language
function labelHud() {
  $('#nmR').textContent = T(robot.v.name); $('#nmK').textContent = T(kaiju.v.name);
  $('#help').hidden = !(pilot || onFoot); $('#help').innerHTML = onFoot ? T('helpH') : pilot === robot ? T('helpR') : pilot === kaiju ? T('helpK') : '';
  const pads = onFoot ? {} : T(pilot === robot ? 'padR' : 'padK');
  document.querySelectorAll('#pads [data-k]').forEach((b) => { const k = b.dataset.k; b.textContent = pads[k] || ''; b.hidden = !b.textContent; });
  if (onFoot) $('#feed').textContent = T('camMine'); else if (director.label) { director.label = LABELS[director.shot] ? T(LABELS[director.shot]) : ''; $('#feed').textContent = director.label; }
}
let muted = false;
function toggleMute() { muted = !muted; Audio.setMuted(muted); $('#mute').textContent = muted ? '🔇' : '🔊'; }
$('#mute').onclick = () => { Audio.start(); toggleMute(); };
document.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => begin(b.dataset.mode));
$('#again').onclick = () => begin(onFoot ? 'human' : pilot === robot ? 'robot' : pilot === kaiju ? 'kaiju' : 'watch');
$('#back').onclick = toTitle;
const qSel = $('#quality');
function fillQuality() { qSel.innerHTML = ''; for (const [k, p] of Object.entries(PRESETS)) { const o = document.createElement('option'); o.value = k; o.textContent = T('quality') + T(p.name); qSel.appendChild(o); } qSel.value = qKey; qSel.setAttribute('aria-label', T('quality')); }
fillQuality();
$('#lang').textContent = T('langBtn');
$('#lang').onclick = () => { setLang(getLang() === 'zh' ? 'en' : 'zh'); $('#lang').textContent = T('langBtn'); fillQuality(); fillPicks(); if (mode !== 'title') labelHud(); if (mode === 'end') showEnd(); };
// the title screen's choices: stage, jaeger, kaiju, each with a 'random' option; changing one rebuilds the preview behind
const PICKS = { stage: ['random', ...STAGES], robot: ['random', ...Object.keys(ROBOTS)], kaiju: ['random', ...Object.keys(KAIJUS)] };
const pickName = (k, id) => id === 'random' ? T('random') : T(k === 'stage' ? 'st_' + id : k === 'robot' ? ROBOTS[id].name : KAIJUS[id].name);
function fillPicks() {
  for (const k of Object.keys(PICKS)) { const el = $(`#pick-${k}`); if (!el) continue; el.querySelector('.lb').textContent = T('sel_' + k); el.querySelector('.v').textContent = pickName(k, sel[k]); el.querySelector('.d').textContent = T('d_' + sel[k]); }
}
for (const k of Object.keys(PICKS)) {
  const el = $(`#pick-${k}`); if (!el) continue;
  const step = (d) => {
    const L = PICKS[k]; sel[k] = L[(L.indexOf(sel[k]) + d + L.length) % L.length]; try { localStorage.setItem('kaiju.sel', JSON.stringify(sel)); } catch {}
    fillPicks();
    // show the choice behind the title: a new stage, or the new fighter in the current one
    if (sel[k] !== 'random' || k !== 'stage') { if (k === 'stage') setStage(sel.stage); toTitle(false); }
  };
  el.querySelector('.prev').onclick = () => step(-1); el.querySelector('.next').onclick = () => step(1);
}
fillPicks();
qSel.onchange = () => { try { localStorage.setItem('kaiju.q', qSel.value); } catch {} location.search = ''; location.reload(); };

function hud() {
  $('#hpR').style.width = (robot.hp / robot.maxHp * 100) + '%'; $('#hpK').style.width = (kaiju.hp / kaiju.maxHp * 100) + '%';
  $('#hpRt').textContent = Math.ceil(robot.hp); $('#hpKt').textContent = Math.ceil(kaiju.hp);
  for (const [f, id] of [[robot, '#mtR'], [kaiju, '#mtK']]) { const el = $(id); el.style.width = f.meter + '%'; el.parentNode.classList.toggle('full', f.meter >= 100); }
  if (pilot) {
    const list = pilot === robot ? [['plasma', 'cdPlasma', 7], ['rocket', 'cdRocket', 5], ['dash', 'cdDash', 2.5], ['missiles', 'cdMissiles', 6, 1], ['blade', 'cdBlade', 6, 1]] : [['acid', 'cdAcid', 6], ['pounce', 'cdPounce', 7], ['charge', 'cdCharge', 4.5], ['roar', 'cdRoar', 9], ['beam', 'cdBeam', 6, 1], ['quake', 'cdQuake', 6, 1]];
    $('#cds').innerHTML = list.map(([k, key, max, sup]) => { const n = T(key); const c = pilot.cd[k] || 0, fr = sup ? Math.min(pilot.meter / 100, 1 - c / max) : 1 - c / max; return `<span class="cd${fr >= 1 ? ' ready' : ''}${sup ? ' sup' : ''}"><i style="width:${fr * 100}%"></i>${n}</span>`; }).join('');
  } else $('#cds').innerHTML = '';
  const t = Math.floor(fightT); $('#clock').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function showEnd() {
  const robotWon = robot.alive; mode = 'end';
  const youWon = pilot ? pilot.alive : null, fallen = W.buildings.filter((b) => !b.alive && !b.pole).length;
  if (document.pointerLockElement) document.exitPointerLock();
  if (onFoot) {
    $('#endTitle').textContent = human.alive ? T('survived') : T('dead_' + human.cause);
    $('#endSub').textContent = human.alive ? T(robotWon ? 'robotWonSub' : 'kaijuWonSub')(T(robot.v.name), T(kaiju.v.name)) : T('deadSub');
    const s = Math.floor(human.t); $('#endStats').textContent = T('survivedFor')(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`) + ' · ' + T('stats')($('#clock').textContent, fallen);
  } else {
    $('#endTitle').textContent = pilot ? T(youWon ? 'win' : 'lose') : T(robotWon ? 'cityHeld' : 'cityFell');
    $('#endSub').textContent = T(robotWon ? 'robotWonSub' : 'kaijuWonSub')(T(robot.v.name), T(kaiju.v.name));
    $('#endStats').textContent = T('stats')($('#clock').textContent, fallen);
  }
  $('#end').hidden = false; $('#pads').hidden = true;
}

// ------------------------------------------------------------------ the loop
const clock = new THREE.Clock(); let t = 0, rdtNow = 0.016;
const camPos = V(), camLook = V(); let camInit = false;
function frame() {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, clock.getDelta()); t += rdt;
  if (slowT > 0) { slowT -= rdt; if (slowT <= 0) slow = 1; }
  const dt = rdt * slow; rdtNow = rdt;
  if (mode !== 'title') fightT += dt * (robot.alive && kaiju.alive ? 1 : 0);
  // brains and bodies
  const inR = pilot === robot ? pilotInput() : (mode === 'title' ? { move: 0, strafe: 0 } : think(robot, kaiju, dt));
  const inK = pilot === kaiju ? pilotInput() : (mode === 'title' ? { move: 0, strafe: 0 } : think(kaiju, robot, dt));
  robot.update(dt, kaiju, inR, W); kaiju.update(dt, robot, inK, W);
  handleEvents(robot, kaiju); handleEvents(kaiju, robot); updateShots(dt);
  if (onFoot && mode === 'human') updateHuman(rdt);
  if (onFoot && !human.alive && mode === 'human') { endT += rdt; if (endT > 3) showEnd(); }
  else if ((!robot.alive || !kaiju.alive) && mode !== 'end' && mode !== 'title') { endT += rdt; if (endT > 5) showEnd(); }
  Audio.tension(robot.alive && kaiju.alive ? Math.min(1, 60 / Math.max(10, robot.pos.distanceTo(kaiju.pos))) : 0.2);
  // camera
  let f = onFoot ? humanFrame() : pilot && mode === 'pilot' ? pilotFrame() : director.frame(rdt); let cp = onFoot ? f.pos : clampCam(f.pos, f.look);
  // a wall forced the camera right up against the giants: right after a cut, try another shot instead
  for (let tries = 0; tries < 4 && mode === 'watch' && director.t < 0.2 && !['close', 'face'].includes(director.shot) && cp.distanceTo(f.look) < f.pos.distanceTo(f.look) * 0.55; tries++) { director.pick(); f = director.frame(0); cp = clampCam(f.pos, f.look); }
  f.pos = cp;
  const cut = director.t < rdt * 1.5 && !pilot && !onFoot;
  if (!camInit || cut || onFoot) { camPos.copy(f.pos); camLook.copy(f.look); camInit = true; }
  else { const k = 1 - Math.exp(-rdt * (pilot ? 4 : 6)); camPos.lerp(f.pos, k); camLook.lerp(f.look, 1 - Math.exp(-rdt * 5)); }
  camera.position.copy(camPos); camera.position.y = Math.max(camera.position.y, 1.2);
  // handheld drift + shake
  const hand = onFoot ? 0.02 : director.shot === 'street' || director.shot === 'ruin' ? 0.6 : 0.25;
  camera.position.x += Math.sin(t * 1.3) * hand + (Math.random() - 0.5) * shake * 2.2; camera.position.y += Math.sin(t * 1.7 + 1) * hand * 0.6 + (Math.random() - 0.5) * shake * 1.6;
  camera.lookAt(camLook); camera.rotateZ(Math.sin(t * 0.7) * 0.004 * (hand * 4) + (Math.random() - 0.5) * shake * 0.01);
  if (Math.abs(camera.fov - f.fov) > 0.05) { camera.fov += (f.fov - camera.fov) * (cut ? 1 : Math.min(1, rdt * 3)); camera.updateProjectionMatrix(); }
  shake = Math.max(0, shake - rdt * 2.2); flash = Math.max(0, flash - rdt * 1.5); hurt = Math.max(0, hurt - rdt * 0.8);
  hitLight.intensity *= Math.exp(-rdt * 9);
  beamOn -= rdt; beamMesh.visible = beamOn > 0; if (!beamMesh.visible) beamLight.intensity *= Math.exp(-rdt * 12);
  // the world
  W.update(dt, camera, mid()); W.updateRuins(dt); placeLights(); fx.update(dt, t);
  grade.uniforms.uTime.value = t; grade.uniforms.uFlash.value = flash + W.flash * 0.05; grade.uniforms.uHurt.value = hurt;
  grade.uniforms.uCA.value = 0.0006 + shake * 0.0012;
  const barsTarget = mode === 'watch' || mode === 'title' ? 0.06 : 0; grade.uniforms.uBars.value += (barsTarget - grade.uniforms.uBars.value) * Math.min(1, rdt * 3);
  if (mode !== 'title') hud();
  composer.render(rdt);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); grade.uniforms.uAspect.value = innerWidth / innerHeight; });
toTitle(false);
frame();
// fast-forward an AI fight without drawing (for balance checks)
function sim(seconds, dt = 1 / 30) {
  newFight(); mode = 'watch'; let t2 = 0;
  for (; t2 < seconds && robot.alive && kaiju.alive; t2 += dt) {
    const a = think(robot, kaiju, dt), b = think(kaiju, robot, dt);
    robot.update(dt, kaiju, a, W); kaiju.update(dt, robot, b, W); handleEvents(robot, kaiju); handleEvents(kaiju, robot); updateShots(dt); W.updateRuins(dt);
  }
  return { t: Math.round(t2), robot: Math.round(robot.hp), kaiju: Math.round(kaiju.hp), fallen: W.buildings.filter((b) => !b.alive && !b.pole).length };
}
window.KN = { sim, get robot() { return robot; }, get kaiju() { return kaiju; }, human, get mode() { return mode; }, begin, director, get W() { return W; }, fx, sel, setStage, newFight, renderer, toTitle, setSlow: slowmo };
