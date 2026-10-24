// The two giants in motion: procedural walking with foot IK (planted feet, body bob, hip sway), keyframed attacks,
// secondary motion (tail lag, head tracking, breathing), staggers, knockdowns, death, hit detection and simple AI.
import * as THREE from 'three';
import { SHORE } from './world.js?v=2';
import { buildRobot, buildKaiju } from './models.js?v=1';

const rnd = (a, b) => a + Math.random() * (b - a);
const ease = (x) => x * x * (3 - 2 * x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;

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
const LEGJ = new Set(['hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR']);

// ------------------------------------------------------------------ a fighter
export class Fighter {
  constructor(kind, scene) {
    this.kind = kind;
    Object.assign(this, kind === 'robot' ? buildRobot() : buildKaiju());
    scene.add(this.root);
    this.maxHp = kind === 'robot' ? 1550 : 1700; this.hp = this.maxHp;
    this.pos = new THREE.Vector3(0, 0, kind === 'robot' ? 90 : -40); this.yaw = kind === 'robot' ? Math.PI : 0; this.yawVel = 0;
    this.vel = new THREE.Vector3(); this.speed = 0; this.phase = 0; this.act = null; this.stun = 0; this.down = 0; this.block = false; this.alive = true; this.dash = 0;
    this.R = kind === 'robot' ? 13 : 24; this.cd = {}; this.lastStep = 0; this.events = []; this.ventT = rnd(4, 8); this.breatheT = rnd(1, 3);
    this.moves = kind === 'robot' ? ROBOT_MOVES : KAIJU_MOVES;
    // the legs' rest geometry, for the foot IK
    this.root.updateMatrixWorld(true); this.legRest = {};
    for (const S of ['L', 'R']) {
      const h = this.j['hip' + S].getWorldPosition(new THREE.Vector3()), k = this.j['knee' + S].getWorldPosition(new THREE.Vector3()), a = this.j['ankle' + S].getWorldPosition(new THREE.Vector3());
      const t = k.clone().sub(h), s = a.clone().sub(k);
      this.legRest[S] = { hip: h, ankle: a, L1: Math.hypot(t.y, t.z), L2: Math.hypot(s.y, s.z), aT: Math.atan2(t.z, -t.y), aS: Math.atan2(s.z, -s.y) };
    }
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  wp(name, off = [0, 0, 0]) { const o = this.j[name]; this.root.updateMatrixWorld(true); return o.localToWorld(new THREE.Vector3(...off)); }
  face() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  can() { return this.alive && !this.act && this.stun <= 0 && this.down <= 0; }
  start(name) { if (!this.can() || (this.cd[name] || 0) > 0) return false; const m = this.moves[name]; this.act = { name, m, t: 0, hitDone: false, shotDone: false }; this.cd[name] = { plasma: 7, acid: 6, roar: 9, charge: 4.5, tail: 3 }[name] || 0; this.emit('attack', { name }); return true; }
  // the opponent's body, as a vertical capsule
  hitTest(opp, p, r) { const dy = Math.max(10, Math.min(opp.kind === 'robot' ? 62 : 60, p.y)); const d = Math.hypot(p.x - opp.pos.x, p.z - opp.pos.z, (p.y - dy) * 0.6); return d < opp.R + r; }
  takeHit(dmg, from, knock, o = {}) {
    if (!this.alive) return 0;
    const dir = this.pos.clone().sub(from.pos).setY(0).normalize();
    const facing = this.face().dot(dir.clone().negate()) > 0.3;
    const blocked = this.block && facing && !o.unblockable;
    const d = blocked ? dmg * 0.18 : dmg;
    this.hp = Math.max(0, this.hp - d);
    this.vel.addScaledVector(dir, (blocked ? knock * 0.3 : knock) * 1.7);
    if (!blocked) { this.stun = Math.max(this.stun, Math.min(1.1, 0.25 + knock / 40)); this.act = null; this.spinYaw = 0; if (knock >= 25 && Math.random() < 0.6) this.down = 2.6; this.hitT = 0; this.hitSide = Math.random() < 0.5 ? -1 : 1; this.hitPow = Math.min(1, knock / 25 + 0.3); }
    if (this.hp <= 0) this.die();
    return blocked ? -d : d;
  }
  die() { this.alive = false; this.act = null; this.spinYaw = 0; this.deathT = 0; this.emit('death'); }

  // ---------------------------------------------------------------- per frame
  update(dt, opp, input, world) {
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.stun -= dt; this.down -= dt; this.dash = Math.max(0, this.dash - dt);
    const toOpp = opp.pos.clone().sub(this.pos).setY(0), dist = toOpp.length(), robot = this.kind === 'robot';
    let want = new THREE.Vector3(), turn = 0;
    if (this.alive && this.stun <= 0 && this.down <= 0 && (!this.act || this.act.m.spin)) {
      const f = toOpp.clone().normalize(), side = new THREE.Vector3(f.z, 0, -f.x);
      want.addScaledVector(f, input.move || 0).addScaledVector(side, input.strafe || 0);
      if (want.lengthSq() > 1) want.normalize();
      if (!this.act) turn = clamp(wrap(Math.atan2(toOpp.x, toOpp.z) - this.yaw) * 2.2, -1.1, 1.1);
    }
    // turning has weight: angular speed eases in and out
    this.yawVel += (turn - this.yawVel) * (1 - Math.exp(-dt * 4)); this.yaw += this.yawVel * dt;
    const maxSp = (robot ? 13 : 14) * (this.block ? 0.4 : 1) * (this.dash > 0 ? 3.2 : 1);
    const desired = want.multiplyScalar(maxSp);
    this.speed += (desired.length() - this.speed) * (1 - Math.exp(-dt * (this.dash > 0 ? 6 : 2.4)));
    if (desired.lengthSq() > 0.01) { const d = desired.clone().normalize(); this.moveDir = this.moveDir ? this.moveDir.lerp(d, 1 - Math.exp(-dt * 6)).normalize() : d; }
    const mv = (this.moveDir || this.face()).clone().multiplyScalar(this.speed * dt);
    let pose = {};
    if (this.act) {
      const a = this.act, m = a.m; a.t += dt; const p = Math.min(1, a.t / m.dur);
      pose = sampleKeys(m.keys, p);
      if (pose.fwd) mv.addScaledVector(this.face(), pose.fwd * dt * (dist > this.R + opp.R + 4 ? 1 : 0.1));
      if (m.spin) { const s = p < 0.3 ? 0 : p > 0.75 ? 1 : ease((p - 0.3) / 0.45); this.spinYaw = s * TAU; }
      if (m.hit && !a.hitDone && p >= m.hit[0] && p <= m.hit[1]) {
        let hp = m.at === 'head' ? this.wp('head', [0, -2, 12]) : this.wp(m.at, [0, -3, 0]);
        if (m.spin) { this.root.updateMatrixWorld(true); for (const seg of this.j.tail) { const q = seg.localToWorld(new THREE.Vector3(0, 0, -3)); if (this.hitTest(opp, q, 9)) { hp = q; break; } } }
        if (this.hitTest(opp, hp, m.spin ? 9 : 8)) { a.hitDone = true; const dealt = opp.takeHit(m.dmg * (this.rage ? 1.15 : 1), this, m.knock); this.emit('hit', { point: hp, dmg: dealt, move: a.name, heavy: m.knock >= 20 }); }
      }
      if (m.shot && !a.shotDone && p >= m.shot) { a.shotDone = true; this.emit('shoot', { from: this.wp('fistR', [0, -6, 0]), dir: opp.pos.clone().setY(40).sub(this.wp('fistR')).normalize(), dmg: m.dmg }); }
      if (m.breath && p >= m.breath[0] && p <= m.breath[1]) {
        const mouth = this.wp('head', [0, -3.5, 15.5]), dir = this.wp('head', [0, -6.5, 40]).sub(mouth).normalize();
        this.emit('breath', { from: mouth, dir });
        const rel = opp.pos.clone().setY(40).sub(mouth), along = rel.dot(dir);
        if (along > 0 && along < 110 && rel.clone().sub(dir.clone().multiplyScalar(along)).length() < 14 + along * 0.12) { const d = opp.takeHit(m.dps * dt, this, 0.5); this.emit('burn', { point: opp.pos.clone().setY(40), dmg: d }); if (opp.stun > 0.3) opp.stun = 0.3; }
      }
      if (m.roar && !a.roared && p >= m.roar) { a.roared = true; this.emit('roar'); }
      if (p >= 1) { if (robot && m.knock >= 20) this.ventT = 0.3; this.act = null; this.spinYaw = 0; }
    }
    mv.addScaledVector(this.vel, dt); this.vel.multiplyScalar(Math.exp(-dt * 2.2));
    this.pos.add(mv);
    const sep = this.pos.clone().sub(opp.pos).setY(0), sd = sep.length(), minD = this.R + opp.R;
    if (sd < minD && sd > 0.01) this.pos.addScaledVector(sep.normalize(), (minD - sd) * 0.5);
    this.pos.x = clamp(this.pos.x, -420, 420); this.pos.z = clamp(this.pos.z, SHORE - 160, 520);
    // buildings in the way come down: under the body, under a fallen body, under a sweeping tail
    const probes = [[this.pos, this.R * 0.85]];
    if (this.down > 0 || !this.alive) probes.push([this.pos.clone().addScaledVector(this.face(), -38), this.R]);
    if (this.act && this.act.m.spin && this.act.t > this.act.m.dur * 0.3) { this.root.updateMatrixWorld(true); for (const k of [4, 7, 9]) probes.push([this.j.tail[k].localToWorld(new THREE.Vector3()), 9]); }
    for (const b of world.buildings) {
      if (!b.alive) continue;
      for (const [p, r] of probes) {
        const dx = Math.max(Math.abs(p.x - b.x) - b.w / 2, 0), dz = Math.max(Math.abs(p.z - b.z) - b.d / 2, 0);
        if (Math.hypot(dx, dz) < r) { world.collapse(b); this.emit('smash', { b }); if (p === this.pos) this.vel.multiplyScalar(0.6); break; }
      }
    }
    // the gait: slow, heavy strides; turning on the spot also steps
    const stepSp = Math.max(this.speed, Math.abs(this.yawVel) * 9);
    this.gait = Math.min(3, stepSp / 10);
    this.stepRate = (robot ? 0.75 : 0.65) + this.gait * (robot ? 1.35 : 1.2);
    if (stepSp > 0.4) this.phase += dt * this.stepRate;
    this.stepSp = stepSp;
    const cyc = Math.floor(this.phase / Math.PI);
    if (cyc !== this.lastStep) { this.lastStep = cyc; if (stepSp > 1.5 && this.alive && this.down <= 0) { const S = cyc % 2 ? 'R' : 'L'; this.emit('step', { p: this.wp('ankle' + S, [0, -2, 3]), power: robot ? 1 : 1.25, water: this.pos.z < SHORE }); } }
    // little lives: steam from the robot's back, the kaiju's breath in the cold rain
    if (this.alive) {
      if (robot && (this.ventT -= dt) < 0) { this.ventT = rnd(7, 12); this.emit('vent', { ps: this.j.vents.map((v) => this.j.chest.localToWorld(v.clone())), up: this.wp('chest', [0, 30, -10]).sub(this.wp('chest', [0, 20, -10])).normalize() }); }
      if (!robot && (this.breatheT -= dt) < 0) { this.breatheT = rnd(2.5, 4.5); this.emit('breathe', { ps: [this.wp('head', [-1.1, -0.9, 14.6]), this.wp('head', [1.1, -0.9, 14.6])], dir: this.wp('head', [0, -4, 30]).sub(this.wp('head', [0, -1, 14])).normalize() }); }
    }
    this.animate(dt, pose, opp);
  }

  // foot IK in the leg's forward plane: put the ankle at (offX, lift, offZ) from where it rests, keep the foot level
  legIK(S, offX, offZ, lift, rootY, T, toe) {
    const r = this.legRest[S];
    let dy = r.ankle.y - rootY + lift - r.hip.y, dz = r.ankle.z + offZ - r.hip.z, d = Math.hypot(dy, dz);
    const max = (r.L1 + r.L2) * 0.997, min = Math.abs(r.L1 - r.L2) + 1;
    if (d > max) { dy *= max / d; dz *= max / d; d = max; } else if (d < min) { dy *= min / d; dz *= min / d; d = min; }
    const aT = Math.atan2(dz, -dy), phi = Math.acos(clamp((r.L1 * r.L1 + d * d - r.L2 * r.L2) / (2 * r.L1 * d), -1, 1));
    const a1 = aT + phi, ky = -Math.cos(a1) * r.L1, kz = Math.sin(a1) * r.L1, a2 = Math.atan2(dz - kz, -(dy - ky));
    const hx = r.aT - a1, kx = r.aS - a2 - hx, hz = Math.asin(clamp(offX / (r.L1 + r.L2), -0.4, 0.4));
    T['hip' + S] = [hx, 0, hz]; T['knee' + S] = [kx, 0, 0]; T['ankle' + S] = [-(hx + kx) + toe, 0, -hz];
  }

  // ---------------------------------------------------------------- the pose for this frame
  animate(dt, act, opp) {
    const j = this.j, robot = this.kind === 'robot', T = {}, now = performance.now() / 1000;
    const set = (n, x = 0, y = 0, z = 0) => { T[n] = [x, y, z]; };
    const sp = this.stepSp || 0, k = Math.min(1, sp / 2.5), g1 = Math.min(1, this.gait || 0), ph = this.phase;
    const br = Math.sin(now * (robot ? 1.1 : 0.75));
    const look = clamp(wrap(Math.atan2(opp.pos.x - this.pos.x, opp.pos.z - this.pos.z) - this.yaw - (this.spinYaw || 0)), -0.7, 0.7);
    // falling (knocked down or dead)
    let fall = 0;
    if (this.down > 0) { const q = this.down > 2.0 ? (2.6 - this.down) / 0.6 : this.down < 0.8 ? this.down / 0.8 : 1; fall = ease(clamp(q, 0, 1)); }
    if (!this.alive) { this.deathT += dt; fall = ease(Math.min(1, this.deathT / 2)); }
    // the body rides up over the planted leg (an inverted pendulum), lowest as each foot lands
    const water = this.pos.z < SHORE ? -6 : 0;
    const rootY = (robot ? -1.2 : 0) - (act.dip || 0) + (robot ? 1.3 : 1.0) * k * g1 * (0.5 - 0.5 * Math.cos(2 * ph));
    // legs: stance feet slide back under the body at walking speed, swing feet arc forward
    if (fall < 0.05) {
      const S = Math.min(26, (this.speed || 0) * Math.PI / Math.max(0.5, this.stepRate || 1)), H = (1.5 + S * 0.22) * k;
      const md = this.moveDir || this.face(), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const lz = md.x * sy + md.z * cy, lx = md.x * cy - md.z * sy;
      for (const [side, off] of [['L', 0], ['R', Math.PI]]) {
        const f = (((ph + off) % TAU) + TAU) % TAU; let z, lift = 0, toe = 0;
        if (f < Math.PI) z = S / 2 - S * (f / Math.PI);
        else { const u = (f - Math.PI) / Math.PI; z = -S / 2 + S * ease(u); lift = Math.sin(Math.PI * u) * H; toe = 0.3 * Math.sin(Math.PI * u) * k - 0.15 * Math.sin(Math.PI * Math.min(1, u * 2)) * k; }
        // turning on the spot: small side-steps
        const turnStep = (this.speed < 2 ? clamp(this.yawVel, -1, 1) * 4 * (f < Math.PI ? 1 - 2 * f / Math.PI : -1 + 2 * ease((f - Math.PI) / Math.PI)) : 0);
        this.legIK(side, lx * z + turnStep * (side === 'L' ? -0.3 : 0.3), lz * z, lift, rootY, T, toe);
      }
    } else for (const n of LEGJ) set(n, 0, 0, 0);
    if (robot) {
      const guard = this.block ? 1 : 0.72, sw = Math.sin(ph) * 0.16 * k * g1;
      set('shL', -0.85 * guard + sw, 0, -0.12); set('shR', -0.85 * guard - sw, 0, 0.12);
      set('elL', -1.75 * guard + br * 0.03, 0, 0); set('elR', -1.75 * guard - br * 0.03, 0, 0); set('fistL', 0.15, 0, 0); set('fistR', 0.15, 0, 0);
      if (this.block) { set('shL', -1.6, 0.4, 0.2); set('shR', -1.6, -0.4, -0.2); set('elL', -2.2, 0, 0); set('elR', -2.2, 0, 0); }
      set('pelvis', 0, 0.06 * k * g1 * Math.cos(ph), 0.03 * k * g1 * Math.sin(ph));
      set('spine', 0.05 + 0.07 * g1 + br * 0.01, 0, 0);
      set('chest', br * 0.012, -0.08 * k * g1 * Math.cos(ph) + look * 0.3, 0);
      set('head', 0, look * 0.55, 0);
    } else {
      set('pelvis', 0, 0.05 * k * g1 * Math.cos(ph), 0.035 * k * g1 * Math.sin(ph) + Math.sin(now * 0.4) * 0.012);
      set('spine', 0.02 + 0.09 * g1 + br * 0.015, 0, 0);
      set('chest', br * 0.03, -0.06 * k * g1 * Math.cos(ph) + look * 0.25, 0);
      set('neck', -0.03 + br * 0.025 - 0.04 * g1, look * 0.35, Math.sin(now * 0.23) * 0.03);
      set('head', 0.05 + Math.sin(now * 0.5) * 0.03 + 0.05 * g1, look * 0.3, Math.sin(now * 0.31) * 0.04);
      set('jaw', 0.05 + Math.max(0, br) * 0.07, 0, 0);
      set('shL', -0.12 + Math.sin(ph) * 0.15 * k, 0, -0.1); set('shR', -0.12 - Math.sin(ph) * 0.15 * k, 0, 0.1);
      set('elL', -0.35 + br * 0.04, 0, 0); set('elR', -0.35 + br * 0.04, 0, 0); set('handL', 0.25, 0, 0); set('handR', 0.25, 0, 0);
      // the tail: swings opposite to turns and trails behind, each segment lagging the one before
      this.tailS = this.tailS || j.tail.map(() => [0, 0]);
      const spin = this.act && this.act.m.spin ? 1 : 0;
      j.tail.forEach((b, i) => {
        const st = this.tailS[i];
        const ty = -this.yawVel * 0.2 * (0.5 + i * 0.1) + Math.sin(now * 0.9 - i * 0.45) * (0.025 + 0.03 * k) + Math.sin(ph - i * 0.4) * 0.05 * k * g1 - (spin ? 0.12 : 0);
        const tx = 0.02 * g1 + Math.sin(now * 0.6 - i * 0.4) * 0.012 + spin * 0.05;
        const r = 1 - Math.exp(-dt * Math.max(1.5, 7 - i * 0.45));
        st[0] += (tx - st[0]) * r; st[1] += (ty - st[1]) * r; set('tail' + i, st[0], st[1], 0);
      });
    }
    // the action's pose overrides the walk where it says something
    for (const [key, v] of Object.entries(act)) if (Array.isArray(v)) T[key] = v;
    // reacting to a blow: the body snaps back and twists, then recovers
    this.hitT = (this.hitT ?? 9) + dt;
    const hk = this.hitT < 0.9 ? Math.sin(Math.min(1, this.hitT / 0.12) * Math.PI / 2) * Math.exp(-this.hitT * 4) * (this.hitPow || 0.5) : 0;
    let lean = (act.lean || 0) - 0.45 * hk, twist = (act.twist || 0) + 0.3 * hk * (this.hitSide || 1);
    if (hk > 0) { const h = robot ? 'head' : 'neck'; if (T[h]) T[h] = [T[h][0] - 0.4 * hk, T[h][1] + 0.3 * hk * (this.hitSide || 1), T[h][2]]; }
    if (T.spine) { T.spine = [T.spine[0] + lean, T.spine[1] + twist, T.spine[2]]; }
    if (robot && T.chest) T.chest = [T.chest[0], T.chest[1] + twist * 0.5, T.chest[2]];
    // place the body
    this.root.position.set(this.pos.x, water + rootY - fall * 6, this.pos.z);
    this.root.rotation.y = this.yaw + (this.spinYaw || 0);
    this.root.rotation.x += ((-fall * 1.45) - this.root.rotation.x) * Math.min(1, dt * 5);
    // ease every joint toward its target; legs track tightly so the feet stay planted
    const base = 1 - Math.exp(-dt * (this.act ? 20 : 11)), fast = 1 - Math.exp(-dt * 40), slowK = 1 - Math.exp(-dt * 6);
    for (const [name, v] of Object.entries(T)) {
      const gj = j[name]; if (!gj || Array.isArray(gj)) continue;
      const kk = LEGJ.has(name) ? (fall > 0.05 ? slowK : fast) : name.startsWith('tail') ? fast : base;
      gj.rotation.x += (v[0] - gj.rotation.x) * kk; gj.rotation.y += (v[1] - gj.rotation.y) * kk; gj.rotation.z += (v[2] - gj.rotation.z) * kk;
    }
    // glows: the robot's reactor (flickering when badly hurt) and its spinning turbine; the kaiju's plates and mouth
    const hpK = this.hp / this.maxHp;
    if (robot) {
      const flick = hpK < 0.3 ? (Math.random() < 0.08 ? 0.2 : 1) : 1, on = this.alive ? 1 : 0.03;
      this.mats.glow.emissiveIntensity = (1.2 + Math.sin(now * 3.3) * 0.2) * flick * on; this.coreLight.intensity = 260 * flick * on;
      if (j.fan) j.fan.rotation.z -= dt * (this.alive ? 6 + this.speed * 0.4 : 0.5);
      if (j.beacon) j.beacon.visible = this.alive && (now % 1.6) < 0.18;
    } else {
      const a = this.act, roar = a && a.name === 'roar' ? 1 : 0, acid = a && a.name === 'acid' ? Math.min(1, a.t / a.m.dur) : -1;
      this.bands.forEach((m, i) => {
        let tgt = this.alive ? 0.9 + (1 - hpK) * 1.2 + roar * 3 : 0.05;
        // before the acid breath a pulse of light climbs from the tail to the head, then the whole back blazes
        if (acid >= 0) { const w = acid / 0.3; tgt = acid < 0.3 ? 1.3 + 7 * Math.max(0, 1 - Math.abs(w * 1.25 - i / 7) * 4) + w * 1.5 : acid < 0.85 ? 6 + Math.sin(now * 30 + i) * 0.8 : 2; }
        m.emissiveIntensity += (tgt - m.emissiveIntensity) * Math.min(1, dt * 14);
      });
      const mouthOn = acid >= 0.25 && acid < 0.88 ? 1 : 0;
      this.mats.mouth.emissiveIntensity += (mouthOn * 6 + roar * 0.6 - this.mats.mouth.emissiveIntensity) * Math.min(1, dt * 8); this.mouthLight.intensity = this.mats.mouth.emissiveIntensity * 1400;
      this.mats.eye.emissiveIntensity = this.alive ? 1.6 : 0.1;
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
