// The two giants in motion: procedural walking with foot IK (planted feet, body bob, hip sway), keyframed attacks,
// special moves (paid for with a power meter), leaps, secondary motion (tail lag, head tracking, breathing, fingers, toes,
// armour plates following the limbs), staggers, knockdowns, death, hit detection, and an AI that fights in phases:
// close in, trade blows, break apart and circle, then come back with a special move.
import * as THREE from 'three';
import { SHORE, STAGE } from './world.js?v=4';
import { buildRobot, buildKaiju } from './models.js?v=4';
import { ROBOTS, KAIJUS } from './roster.js?v=1';

const rnd = (a, b) => a + Math.random() * (b - a);
const ease = (x) => x * x * (3 - 2 * x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ attacks: timing, hit point, damage, poses as keyframes
// pose: { joint: [rx, ry, rz] } ; special keys: lean (pitch the body), twist (yaw the upper body), dip (lower the hips), fwd (lunge speed),
// rise (height off the ground), thrust (the robot's back thrusters), blade (the robot's arm blade, 0 folded .. 1 out)
// move flags: super (costs a full meter, not interrupted by ordinary hits), leap [p0, p1] (jump at the opponent, landing gap
// from them), track (keeps turning toward the opponent), quake (a landing shockwave at that point, radius qr), salvo, beam
const ROBOT_MOVES = {
  jab: { dur: 0.55, hit: [0.28, 0.42], at: 'fistL', dmg: 32, knock: 6, keys: [[0, { shL: [-0.6, 0, -0.2], elL: [-1.8, 0, 0], twist: 0 }], [0.3, { shL: [-1.55, 0, 0.1], elL: [-0.1, 0, 0], twist: 0.35, fwd: 25 }], [0.6, { shL: [-1.3, 0, 0], elL: [-0.4, 0, 0], twist: 0.25 }], [1, {}]] },
  cross: { dur: 0.75, hit: [0.36, 0.5], at: 'fistR', dmg: 48, knock: 10, keys: [[0, {}], [0.25, { shR: [-0.4, 0, 0.5], elR: [-1.9, 0, 0], twist: 0.45 }], [0.42, { shR: [-1.6, 0, -0.1], elR: [-0.05, 0, 0], twist: -0.55, lean: 0.25, fwd: 30 }], [0.7, { shR: [-1.3, 0, 0], elR: [-0.4, 0, 0], twist: -0.35 }], [1, {}]] },
  upper: { dur: 1.0, hit: [0.42, 0.58], at: 'fistR', dmg: 95, knock: 26, lift: true, keys: [[0, {}], [0.3, { shR: [0.5, 0, 0.3], elR: [-2.2, 0, 0], dip: 7, twist: 0.4, lean: 0.2 }], [0.5, { shR: [-2.6, 0, -0.2], elR: [-0.6, 0, 0], dip: -2, twist: -0.5, lean: -0.25, fwd: 22 }], [0.75, { shR: [-2.3, 0, 0], elR: [-0.6, 0, 0] }], [1, {}]] },
  kick: { dur: 0.95, hit: [0.4, 0.58], at: 'ankleR', dmg: 65, knock: 18, keys: [[0, {}], [0.3, { hipR: [-1.0, 0, 0], kneeR: [1.6, 0, 0], lean: -0.15 }], [0.48, { hipR: [-1.5, 0, 0], kneeR: [0.1, 0, 0], lean: -0.3, fwd: 18 }], [0.7, { hipR: [-0.8, 0, 0], kneeR: [1.0, 0, 0] }], [1, {}]] },
  plasma: { dur: 1.6, at: 'fistR', shot: 0.62, dmg: 125, keys: [[0, {}], [0.4, { shR: [-1.55, 0, 0], elR: [0, 0, 0], fingR: [0.1, 0, 0], thumbR: [0, 0, 0.3], twist: -0.2, lean: -0.05 }], [0.7, { shR: [-1.5, 0, 0], elR: [0, 0, 0], fingR: [0.1, 0, 0], thumbR: [0, 0, 0.3], twist: -0.2, lean: -0.2 }], [1, {}]] },
  // a short elbow smash, a two-fisted hammer blow, a jab-cross-uppercut chain, and a rocket punch (forearm jets, a lunge from range)
  elbow: { dur: 0.6, hit: [0.34, 0.5], at: 'elR', hitR: 10, dmg: 38, knock: 9, keys: [[0, {}], [0.25, { shR: [-0.4, 0, 0.9], elR: [-2.4, 0, 0], twist: 0.5 }], [0.42, { shR: [-1.1, -0.6, 0.4], elR: [-2.5, 0, 0], twist: -0.6, fwd: 22 }], [0.7, { shR: [-1.0, 0, 0.3], elR: [-2.2, 0, 0], twist: -0.3 }], [1, {}]] },
  hammer: { dur: 1.2, hit: [0.5, 0.64], at: 'fistL', hitR: 10, dmg: 85, knock: 22, keys: [[0, {}], [0.38, { shL: [-3.0, 0, 0.4], shR: [-3.0, 0, -0.4], elL: [-0.9, 0, 0], elR: [-0.9, 0, 0], lean: -0.25 }], [0.56, { shL: [-1.1, 0, 0.25], shR: [-1.1, 0, -0.25], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0], lean: 0.45, dip: 6, fwd: 18 }], [0.8, { shL: [-0.9, 0, 0.2], shR: [-0.9, 0, -0.2], lean: 0.3, dip: 4 }], [1, {}]] },
  combo: { dur: 1.7, hits: [{ t: [0.14, 0.26], at: 'fistL', dmg: 20, knock: 4 }, { t: [0.36, 0.48], at: 'fistR', dmg: 26, knock: 6 }, { t: [0.66, 0.8], at: 'fistL', dmg: 48, knock: 20 }],
    keys: [[0, {}], [0.18, { shL: [-1.55, 0, 0.1], elL: [-0.1, 0, 0], twist: 0.35, fwd: 28 }], [0.28, { shL: [-0.8, 0, -0.1], elL: [-1.8, 0, 0], twist: 0.1 }], [0.42, { shR: [-1.6, 0, -0.1], elR: [-0.05, 0, 0], twist: -0.55, lean: 0.2, fwd: 30 }],
      [0.55, { shR: [-0.8, 0, 0.1], elR: [-1.8, 0, 0], shL: [0.4, 0, -0.3], elL: [-2.2, 0, 0], dip: 6, twist: 0.3 }], [0.74, { shL: [-2.6, 0, 0.2], elL: [-0.6, 0, 0], dip: -2, twist: 0.5, lean: -0.25, fwd: 20 }], [0.88, { shL: [-2.2, 0, 0], elL: [-0.6, 0, 0] }], [1, {}]] },
  rocket: { dur: 1.5, hit: [0.42, 0.64], at: 'fistR', hitR: 11, dmg: 80, knock: 26, jet: 'elR',
    keys: [[0, {}], [0.3, { shR: [0.6, 0, 0.3], elR: [-2.0, 0, 0], dip: 5, twist: 0.6, lean: 0.1, thrust: 0.6 }], [0.45, { shR: [-1.6, 0, -0.05], elR: [0, 0, 0], twist: -0.6, lean: 0.35, fwd: 120, thrust: 1, rise: 3 }],
      [0.62, { shR: [-1.55, 0, 0], elR: [0, 0, 0], twist: -0.5, lean: 0.3, fwd: 60, thrust: 0.8 }], [0.85, { shR: [-1.2, 0, 0], elR: [-0.4, 0, 0], lean: 0.15 }], [1, {}]] },
  // thrusters fire and it skids back out of reach
  backstep: { dur: 0.9, keys: [[0, {}], [0.15, { dip: 4, lean: 0.12, thrust: 1 }], [0.32, { fwd: -115, rise: 4, lean: -0.15, thrust: 1, shL: [-1.1, 0, -0.35], shR: [-1.1, 0, 0.35], elL: [-1.2, 0, 0], elR: [-1.2, 0, 0] }], [0.7, { fwd: -55, rise: 3, thrust: 0.6, lean: -0.08 }], [0.88, { dip: 4 }], [1, {}]] },
  // special: the hull pods open and sixteen missiles arc into the target
  missiles: { dur: 3.2, super: true, salvo: [0.28, 0.78, 16], keys: [[0, {}], [0.18, { podL: [1.25, 0, 0], podR: [1.25, 0, 0], lean: -0.14, dip: 3, shL: [-0.3, 0, -0.55], shR: [-0.3, 0, 0.55], elL: [-0.9, 0, 0], elR: [-0.9, 0, 0] }], [0.85, { podL: [1.25, 0, 0], podR: [1.25, 0, 0], lean: -0.1, dip: 3, shL: [-0.3, 0, -0.55], shR: [-0.3, 0, 0.55], elL: [-0.9, 0, 0], elR: [-0.9, 0, 0] }], [1, {}]] },
  // special: the plasma blade slides out of the left forearm, a thruster leap, and an overhead slash that lands with a shockwave
  blade: { dur: 2.7, super: true, at: 'bladeTip', hit: [0.55, 0.72], hitR: 15, dmg: 175, knock: 32, down: 0.45, leap: [0.32, 0.6], gap: 6, track: 0.9, quake: 0.6, qr: 46,
    keys: [[0, {}], [0.14, { blade: 1, shL: [-0.6, 0, -0.9], elL: [-0.6, 0, 0], twist: 0.3 }], [0.3, { blade: 1, dip: 9, lean: 0.3, shL: [-0.2, 0, -0.6], elL: [-0.4, 0, 0], shR: [-0.6, 0, 0.4], elR: [-1.6, 0, 0], thrust: 0.5 }],
      [0.46, { blade: 1, rise: 34, lean: -0.25, shL: [-3.0, 0, -0.2], elL: [-0.5, 0, 0], shR: [-0.8, 0, 0.5], elR: [-1.2, 0, 0], thrust: 1, twist: -0.1 }], [0.56, { blade: 1, rise: 12, lean: 0.2, shL: [-2.0, 0, 0], elL: [-0.3, 0, 0], thrust: 0.8, twist: -0.25 }],
      [0.6, { blade: 1, dip: 10, lean: 0.55, shL: [-0.9, 0, 0.1], elL: [-0.1, 0, 0], thrust: 0.3, twist: -0.35 }], [0.8, { blade: 1, dip: 6, lean: 0.35, shL: [-0.8, 0, 0], elL: [-0.2, 0, 0] }], [1, {}]] },
};
const KAIJU_MOVES = {
  swipe: { dur: 0.9, hit: [0.42, 0.58], at: 'handR', dmg: 52, knock: 12, keys: [[0, {}], [0.35, { shR: [-1.6, 0.6, 1.0], elR: [-0.6, 0, 0], fingR: [-0.7, 0, 0], twist: 0.5 }], [0.55, { shR: [-1.0, -0.8, -0.6], elR: [-0.2, 0, 0], fingR: [0.7, 0, 0], twist: -0.6, fwd: 20 }], [1, {}]] },
  bite: { dur: 1.0, hit: [0.48, 0.6], at: 'head', dmg: 80, knock: 10, keys: [[0, {}], [0.4, { neck: [-0.5, 0, 0], head: [-0.4, 0, 0], jaw: [0.9, 0, 0], lean: -0.2 }], [0.55, { neck: [0.45, 0, 0], head: [0.2, 0, 0], jaw: [0.05, 0, 0], lean: 0.3, fwd: 32 }], [0.8, { jaw: [0.2, 0, 0] }], [1, {}]] },
  tail: { dur: 1.5, hit: [0.4, 0.7], at: 'tail8', dmg: 72, knock: 30, spin: true, keys: [[0, {}], [0.25, { lean: 0.1, dip: 3 }], [0.55, { lean: 0.15, dip: 3 }], [1, {}]] },
  charge: { dur: 1.9, hit: [0.45, 0.8], at: 'head', dmg: 90, knock: 34, pump: [0.3, 0.84],
    keys: [[0, {}], [0.22, { lean: 0.2, neck: [-0.2, 0, 0], head: [-0.15, 0, 0], jaw: [0.5, 0, 0], dip: 6, fingL: [-0.6, 0, 0], fingR: [-0.6, 0, 0] }], [0.34, { lean: 0.42, neck: [0.45, 0, 0], head: [0.3, 0, 0], dip: 3, fwd: 30, fingL: [-0.6, 0, 0], fingR: [-0.6, 0, 0] }],
      [0.48, { lean: 0.5, neck: [0.55, 0, 0], head: [0.4, 0, 0], jaw: [0.3, 0, 0], fwd: 72, fingL: [-0.5, 0, 0], fingR: [-0.5, 0, 0] }], [0.8, { lean: 0.45, neck: [0.5, 0, 0], head: [0.35, 0, 0], fwd: 58, fingL: [-0.4, 0, 0], fingR: [-0.4, 0, 0] }],
      [0.92, { lean: 0.15, dip: 5, fwd: 6 }], [1, {}]] },
  acid: { dur: 2.4, breath: [0.3, 0.85], dps: 55, keys: [[0, {}], [0.2, { neck: [-0.4, 0, 0], head: [-0.3, 0, 0], jaw: [0.5, 0, 0], lean: -0.15 }], [0.3, { neck: [0.25, 0, 0], head: [0.1, 0, 0], jaw: [1.0, 0, 0], lean: 0.1 }], [0.85, { neck: [0.25, 0, 0], head: [0.1, 0, 0], jaw: [1.0, 0, 0], lean: 0.1 }], [1, {}]] },
  roar: { dur: 2.2, roar: 0.25, keys: [[0, {}], [0.2, { neck: [-0.7, 0, 0], head: [-0.5, 0, 0], jaw: [1.1, 0, 0], lean: -0.35, shL: [-1, 0, -0.8], shR: [-1, 0, 0.8], fingL: [-0.7, 0, 0], fingR: [-0.7, 0, 0] }], [0.85, { neck: [-0.7, 0.1, 0], head: [-0.6, 0, 0], jaw: [1.15, 0, 0], lean: -0.35, shL: [-1.1, 0, -0.9], shR: [-1.1, 0, 0.9], fingL: [-0.7, 0, 0], fingR: [-0.7, 0, 0] }], [1, {}]] },
  // a stomp that cracks the street, a two-handed claw rake, a skull-first headbutt, and a pounce: a crouch, a low heavy leap, claws first
  stomp: { dur: 1.3, quake: 0.5, qr: 44, dmg: 45, knock: 14, keys: [[0, {}], [0.3, { hipR: [-1.1, 0, 0.1], kneeR: [1.3, 0, 0], ankleR: [-0.2, 0, 0], lean: -0.15, shL: [-0.6, 0, -0.5], shR: [-0.6, 0, 0.5] }], [0.5, { hipR: [-0.05, 0, 0], kneeR: [0.1, 0, 0], lean: 0.2, dip: 4 }], [0.75, { dip: 3 }], [1, {}]] },
  rake: { dur: 1.3, hits: [{ t: [0.25, 0.4], at: 'handR', dmg: 34, knock: 6 }, { t: [0.55, 0.72], at: 'handL', dmg: 44, knock: 14 }],
    keys: [[0, {}], [0.18, { shR: [-1.7, 0.6, 1.0], elR: [-0.6, 0, 0], fingR: [-0.7, 0, 0], twist: 0.5 }], [0.34, { shR: [-0.9, -0.8, -0.5], elR: [-0.2, 0, 0], fingR: [0.7, 0, 0], twist: -0.4, fwd: 18, shL: [-1.7, -0.6, -1.0], elL: [-0.6, 0, 0], fingL: [-0.7, 0, 0] }],
      [0.62, { shL: [-0.9, 0.8, 0.5], elL: [-0.2, 0, 0], fingL: [0.7, 0, 0], twist: 0.55, fwd: 18, shR: [-0.5, 0, 0.3] }], [1, {}]] },
  headbutt: { dur: 1.1, hit: [0.45, 0.62], at: 'head', dmg: 62, knock: 20, keys: [[0, {}], [0.35, { neck: [-0.6, 0, 0], head: [-0.4, 0, 0], lean: -0.3, dip: 3 }], [0.52, { neck: [0.6, 0, 0], head: [0.5, 0, 0], lean: 0.5, fwd: 40, dip: 5 }], [0.75, { neck: [0.3, 0, 0], lean: 0.3 }], [1, {}]] },
  pounce: { dur: 2.0, leap: [0.34, 0.56], gap: 2, track: 0.7, hit: [0.5, 0.66], at: 'handR', hitR: 13, dmg: 95, knock: 28, down: 0.3, land: 0.56,
    keys: [[0, {}], [0.3, { dip: 11, lean: 0.4, neck: [0.25, 0, 0], head: [-0.2, 0, 0], jaw: [0.4, 0, 0], shL: [0.35, 0, -0.45], shR: [0.35, 0, 0.45], elL: [-0.9, 0, 0], elR: [-0.9, 0, 0], fingL: [-0.5, 0, 0], fingR: [-0.5, 0, 0] }],
      [0.44, { rise: 16, lean: -0.05, neck: [-0.15, 0, 0], jaw: [1.0, 0, 0], shL: [-2.2, 0, -0.45], shR: [-2.2, 0, 0.45], elL: [-0.25, 0, 0], elR: [-0.25, 0, 0], fingL: [-0.85, 0, 0], fingR: [-0.85, 0, 0] }],
      [0.56, { rise: 1, dip: 6, lean: 0.5, neck: [0.35, 0, 0], jaw: [0.7, 0, 0], shL: [-1.2, 0, -0.3], shR: [-1.2, 0, 0.3], elL: [-0.15, 0, 0], elR: [-0.15, 0, 0], fingL: [0.7, 0, 0], fingR: [0.7, 0, 0] }],
      [0.7, { dip: 10, lean: 0.45, neck: [0.3, 0, 0], jaw: [0.4, 0, 0], shL: [-0.9, 0, -0.35], shR: [-0.9, 0, 0.35], fingL: [0.6, 0, 0], fingR: [0.6, 0, 0] }], [1, {}]] },
  // a heavy hop backwards out of the clinch
  hop: { dur: 1.15, land: 0.68, keys: [[0, {}], [0.22, { dip: 6, lean: 0.15 }], [0.45, { rise: 9, fwd: -95, lean: -0.2, shL: [-0.8, 0, -0.5], shR: [-0.8, 0, 0.5] }], [0.68, { fwd: -40, dip: 7, lean: 0.12 }], [1, {}]] },
  // special: a light climbs the dorsal plates twice, then a beam of blue fire that sweeps after its target, cutting through buildings
  beam: { dur: 4.4, super: true, beam: [0.36, 0.88], windup: 0.36, dps: 115, track: 0.45,
    keys: [[0, {}], [0.12, { lean: -0.32, neck: [-0.6, 0, 0], head: [-0.4, 0, 0], jaw: [0.3, 0, 0], shL: [-0.5, 0, -0.6], shR: [-0.5, 0, 0.6], fingL: [-0.6, 0, 0], fingR: [-0.6, 0, 0], dip: 2 }],
      [0.33, { lean: -0.38, neck: [-0.7, 0, 0], head: [-0.5, 0, 0], jaw: [0.5, 0, 0], shL: [-0.6, 0, -0.7], shR: [-0.6, 0, 0.7], fingL: [-0.7, 0, 0], fingR: [-0.7, 0, 0], dip: 3 }],
      [0.4, { lean: 0.2, neck: [0.3, 0, 0], head: [0.1, 0, 0], jaw: [1.15, 0, 0], dip: 4, shL: [-0.3, 0, -0.4], shR: [-0.3, 0, 0.4], fingL: [0.5, 0, 0], fingR: [0.5, 0, 0] }],
      [0.88, { lean: 0.22, neck: [0.32, 0, 0], head: [0.1, 0, 0], jaw: [1.15, 0, 0], dip: 4, shL: [-0.3, 0, -0.4], shR: [-0.3, 0, 0.4], fingL: [0.5, 0, 0], fingR: [0.5, 0, 0] }], [1, {}]] },
  // special: it rears up, leaps, and slams down with both arms; the shockwave knocks everything flat
  quake: { dur: 3.0, super: true, leap: [0.36, 0.62], gap: -2, track: 0.8, quake: 0.62, qr: 72, dmg: 150, knock: 34, down: true, unblock: true,
    keys: [[0, {}], [0.2, { lean: -0.45, neck: [-0.6, 0, 0], head: [-0.5, 0, 0], jaw: [1.0, 0, 0], shL: [-2.4, 0, -0.5], shR: [-2.4, 0, 0.5], elL: [-0.6, 0, 0], elR: [-0.6, 0, 0], fingL: [-0.7, 0, 0], fingR: [-0.7, 0, 0] }],
      [0.34, { dip: 9, lean: 0.25, shL: [-0.8, 0, -0.6], shR: [-0.8, 0, 0.6], jaw: [0.4, 0, 0] }], [0.48, { rise: 26, lean: -0.1, shL: [-2.0, 0, -0.6], shR: [-2.0, 0, 0.6], elL: [-0.4, 0, 0], elR: [-0.4, 0, 0], jaw: [0.6, 0, 0] }],
      [0.58, { rise: 8, lean: 0.25, shL: [-1.8, 0, -0.4], shR: [-1.8, 0, 0.4], jaw: [0.8, 0, 0] }], [0.62, { dip: 11, lean: 0.45, shL: [-1.2, 0, -0.3], shR: [-1.2, 0, 0.3], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0], fingL: [0.5, 0, 0], fingR: [0.5, 0, 0], jaw: [0.6, 0, 0] }],
      [0.8, { dip: 7, lean: 0.3, jaw: [0.9, 0, 0], neck: [-0.3, 0, 0] }], [1, {}]] },
};
// ------------------------------------------------------------------ signature moves: one of its own for every jaeger and kaiju (key T)
// erupt [p0, p1, n, spacing]: geysers of lava burst one after another along the ground toward the opponent
// bolts [p0, p1, n]: lightning strikes called down onto (and around) the opponent
const SIGNATURE = {
  // Sentinel: the back thrusters fire it up into a rising uppercut that leaves the ground
  sentinel: { dur: 1.6, sig: true, hit: [0.4, 0.62], at: 'fistR', hitR: 12, dmg: 115, knock: 30, lift: true, down: 0.35, land: 0.84, track: 0.6,
    keys: [[0, {}], [0.24, { dip: 9, lean: 0.32, shR: [0.5, 0, 0.3], elR: [-2.2, 0, 0], shL: [-1.1, 0, -0.3], elL: [-1.8, 0, 0], twist: 0.55, thrust: 0.7 }],
      [0.42, { shR: [-2.8, 0, -0.2], elR: [-0.5, 0, 0], shL: [-0.4, 0, -0.5], elL: [-1.2, 0, 0], dip: -3, lean: -0.3, twist: -0.55, fwd: 75, thrust: 1, rise: 12 }],
      [0.62, { shR: [-2.9, 0, 0], elR: [-0.3, 0, 0], rise: 17, lean: -0.35, thrust: 0.8 }], [0.84, { rise: 1, dip: 8, lean: 0.25, thrust: 0.2 }], [1, {}]] },
  // Bulwark: both fists raised high, a thruster hop, and a smash into the street that splits it open
  bulwark: { dur: 2.0, sig: true, quake: 0.52, qr: 60, dmg: 125, knock: 30, down: 0.5, track: 0.5,
    keys: [[0, {}], [0.3, { shL: [-3.0, 0, 0.4], shR: [-3.0, 0, -0.4], elL: [-0.8, 0, 0], elR: [-0.8, 0, 0], lean: -0.3, dip: 4, rise: 7, thrust: 0.7 }],
      [0.5, { shL: [-0.7, 0, 0.25], shR: [-0.7, 0, -0.25], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], lean: 0.75, dip: 14, fwd: 12 }],
      [0.78, { shL: [-0.7, 0, 0.25], shR: [-0.7, 0, -0.25], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], lean: 0.6, dip: 11 }], [1, {}]] },
  // Striker: a dash in and four slashes of the forearm blade, the last one the hardest
  striker: { dur: 1.7, sig: true, track: 0.8,
    hits: [{ t: [0.16, 0.27], at: 'fistR', dmg: 19, knock: 4, r: 13 }, { t: [0.3, 0.42], at: 'fistR', dmg: 19, knock: 5, r: 13 }, { t: [0.52, 0.62], at: 'fistR', dmg: 21, knock: 6, r: 13 }, { t: [0.72, 0.84], at: 'fistR', dmg: 36, knock: 24, r: 14 }],
    keys: [[0, {}], [0.12, { shR: [-1.2, 0.8, 1.2], elR: [-0.6, 0, 0], twist: 0.6, fwd: 70, thrust: 0.7 }], [0.24, { shR: [-1.4, -0.8, -0.6], elR: [-0.2, 0, 0], twist: -0.6, fwd: 30 }],
      [0.36, { shR: [-2.6, 0, 0.3], elR: [-0.4, 0, 0], twist: 0.2, lean: -0.2 }], [0.5, { shR: [-0.8, 0, 0], elR: [-0.1, 0, 0], lean: 0.4, dip: 6, twist: 0 }],
      [0.64, { shR: [-1.3, 0.9, 1.3], elR: [-0.5, 0, 0], twist: 0.75, fwd: 28, thrust: 0.5 }], [0.8, { shR: [-1.5, -0.9, -0.8], elR: [-0.1, 0, 0], twist: -0.85, lean: 0.25, fwd: 26 }], [1, {}]] },
  // Abyssal: it rears up as light floods its plates, then slams down and the light bursts out of it in a ring
  abyssal: { dur: 2.3, sig: true, quake: 0.56, qr: 58, dmg: 100, knock: 30, down: 0.5, unblock: true, charge: [0.5, 0.62],
    keys: [[0, {}], [0.22, { lean: -0.35, neck: [-0.6, 0, 0], head: [-0.4, 0, 0], jaw: [1.0, 0, 0], shL: [-1.2, 0, -1.0], shR: [-1.2, 0, 1.0], fingL: [-0.8, 0, 0], fingR: [-0.8, 0, 0], dip: 2 }],
      [0.5, { lean: -0.42, neck: [-0.65, 0, 0], head: [-0.45, 0, 0], jaw: [1.1, 0, 0], shL: [-1.3, 0, -1.1], shR: [-1.3, 0, 1.1], fingL: [-0.85, 0, 0], fingR: [-0.85, 0, 0], dip: 3 }],
      [0.57, { lean: 0.38, dip: 10, neck: [0.3, 0, 0], jaw: [0.7, 0, 0], shL: [-0.6, 0, -0.5], shR: [-0.6, 0, 0.5], fingL: [0.6, 0, 0], fingR: [0.6, 0, 0] }], [0.8, { dip: 6, lean: 0.22 }], [1, {}]] },
  // Magmaw: it drives both fists into the ground and the street erupts in a line of lava toward its enemy
  magmaw: { dur: 2.6, sig: true, quake: 0.4, qr: 30, erupt: [0.42, 0.86, 6, 21], edmg: 36, charge: [0.3, 0.86],
    keys: [[0, {}], [0.25, { lean: -0.3, neck: [-0.5, 0, 0], jaw: [0.9, 0, 0], shL: [-2.6, 0, -0.4], shR: [-2.6, 0, 0.4], elL: [-0.6, 0, 0], elR: [-0.6, 0, 0], fingL: [0.7, 0, 0], fingR: [0.7, 0, 0] }],
      [0.4, { lean: 0.8, dip: 14, neck: [0.2, 0, 0], jaw: [0.6, 0, 0], shL: [-0.5, 0, -0.2], shR: [-0.5, 0, 0.2], elL: [-0.05, 0, 0], elR: [-0.05, 0, 0], fingL: [0.7, 0, 0], fingR: [0.7, 0, 0] }],
      [0.86, { lean: 0.75, dip: 13, neck: [0.25, 0, 0], jaw: [0.8, 0, 0], shL: [-0.5, 0, -0.2], shR: [-0.5, 0, 0.2], elL: [-0.05, 0, 0], elR: [-0.05, 0, 0], fingL: [0.7, 0, 0], fingR: [0.7, 0, 0] }], [1, {}]] },
  // Voltra: head thrown back, claws to the sky, it calls lightning down on its enemy
  voltra: { dur: 2.7, sig: true, bolts: [0.34, 0.86, 5], bdmg: 29, charge: [0.15, 0.86],
    keys: [[0, {}], [0.25, { lean: -0.45, neck: [-0.75, 0, 0], head: [-0.6, 0, 0], jaw: [1.1, 0, 0], shL: [-2.7, 0, -0.5], shR: [-2.7, 0, 0.5], elL: [-0.3, 0, 0], elR: [-0.3, 0, 0], fingL: [-0.85, 0, 0], fingR: [-0.85, 0, 0] }],
      [0.86, { lean: -0.42, neck: [-0.7, 0.15, 0], head: [-0.55, 0, 0], jaw: [1.05, 0, 0], shL: [-2.6, 0, -0.6], shR: [-2.6, 0, 0.6], elL: [-0.35, 0, 0], elR: [-0.35, 0, 0], fingL: [-0.85, 0, 0], fingR: [-0.85, 0, 0] }], [1, {}]] },
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
const HOOKS = new Set(['swipe', 'rake', 'cross', 'elbow', 'combo', 'tail', 'sig', 'hammer']);
const LEGJ = new Set(['hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'toeL', 'toeR']);

// ------------------------------------------------------------------ a fighter
export class Fighter {
  constructor(kind, scene, variant) {
    this.kind = kind;
    const v = variant || (kind === 'robot' ? ROBOTS.sentinel : KAIJUS.abyssal);
    Object.assign(this, kind === 'robot' ? buildRobot(v) : buildKaiju(v));
    scene.add(this.root);
    this.maxHp = v.hp; this.hp = this.maxHp; this.speedK = v.speed; this.dmgK = v.dmg;
    this.pos = new THREE.Vector3(0, 0, kind === 'robot' ? 90 : -40); this.yaw = kind === 'robot' ? Math.PI : 0; this.yawVel = 0;
    this.vel = new THREE.Vector3(); this.speed = 0; this.phase = 0; this.act = null; this.stun = 0; this.down = 0; this.block = false; this.alive = true; this.dash = 0;
    this.R = v.R || (kind === 'robot' ? 13 : 24); this.cd = {}; this.lastStep = 0; this.events = []; this.ventT = rnd(4, 8); this.breatheT = rnd(1, 3);
    this.moves = { ...(kind === 'robot' ? ROBOT_MOVES : KAIJU_MOVES), sig: SIGNATURE[v.id] }; this.tempo = v.tempo;
    // weight: joints move on damped springs (so limbs carry through and settle), the body sinks on each footfall
    this.jv = {}; this.bodyY = 0; this.bodyV = 0; this.gSpeed = 0; this.accLean = 0;
    this.meter = 25; this.air = 0; this.bladeK = 0; this.thrustK = 0;
    // a knockdown: 0.8 s to fall, a while on the ground, then a slow get-up (roll up to a kneel, push up to standing)
    this.downDur = kind === 'robot' ? 4.6 : 5.2; this.riseT = kind === 'robot' ? 2.2 : 2.8;
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
  start(name) {
    const m = this.moves[name];
    if (!m || !this.can() || (this.cd[name] || 0) > 0) return false;
    if (m.super) { if (this.meter < 100) return false; this.meter = 0; }
    this.act = { name, m, t: 0, hitDone: false, shotDone: false, fired: 0 };
    this.cd[name] = { plasma: 7, acid: 6, roar: 9, charge: 4.5, tail: 3, backstep: 2.2, hop: 3, missiles: 6, blade: 6, beam: 6, quake: 6, hammer: 2, combo: 2.5, rocket: 5, stomp: 3, rake: 1.5, headbutt: 1.5, pounce: 7, sig: 9 }[name] || 0;
    this.emit('attack', { name, super: !!m.super, sig: !!m.sig }); return true;
  }
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
    // the meter fills from taking and dealing damage
    this.meter = Math.min(100, this.meter + d * 0.14); from.meter = Math.min(100, (from.meter || 0) + d * 0.1);
    // a special move in progress shrugs off ordinary blows (super armour); a grazing beam burns without staggering
    const armour = this.act && this.act.m.super && !o.down;
    if (!o.graze) {
      this.lastLimb = o.limb || ''; this.react(o.point || this.pos.clone().addScaledVector(dir, -this.R).setY(40), dir, knock, blocked, armour, from);
      // hit-stop: a blow that connects stops both of them dead for a few frames (longer the heavier it is)
      if (o.melee) { const hs = blocked ? 0.05 : 0.05 + 0.1 * Math.min(1, knock / 30); this.hitstop = Math.max(this.hitstop || 0, hs); from.hitstop = Math.max(from.hitstop || 0, hs); }
    }
    if (!blocked && !o.graze) {
      this.hitT = 0; this.hitPow = Math.min(1, knock / 25 + 0.3) * (armour ? 0.4 : 1); this.bodyV -= this.hitPow * 14;
      if (!armour) { this.stun = Math.max(this.stun, Math.min(1.1, 0.25 + knock / 40)); this.act = null; this.spinYaw = 0; const floored = o.down === true || (typeof o.down === 'number' && Math.random() < o.down) || (knock >= 30 && Math.random() < 0.22); if (floored && this.down <= 0) this.down = this.downDur; }
    }
    if (this.hp <= 0) this.die();
    return blocked ? -d : d;
  }
  // the reaction to a blow: from where it landed on the body (head, body or legs; left or right) and which way it pushed,
  // a set of offsets that snap in and then ease off (heavier blows hit harder and take longer to shake off)
  react(pt, dir, knock, blocked, armour, from) {
    const f = this.face(), right = new THREE.Vector3(-f.z, 0, f.x), H = this.kind === 'robot' ? 72 : 62;
    const hy = clamp(pt.y / H, 0, 1.2), side = clamp(((pt.x - this.pos.x) * right.x + (pt.z - this.pos.z) * right.z) / (this.R * 0.9), -1, 1);
    const name = from.act ? from.act.name : '', m = from.act ? from.act.m : null, limb = this.lastLimb || '';
    // which way the blow sweeps across the body: a hook or a claw from the attacker's right drives it to its right, and so on
    const ls = limb === 'tail' ? 1 : /R$/.test(limb) ? 1 : /L$/.test(limb) ? -1 : 0, hook = HOOKS.has(name) || limb === 'tail';
    const across = clamp(dir.x * right.x + dir.z * right.z + ls * (hook ? 0.75 : 0.25), -1, 1);
    const pow = Math.min(1.3, knock / 25 + 0.25) * (blocked ? 0.35 : 1) * (armour ? 0.45 : 1);
    const zone = hy > 0.72 ? 'head' : hy > 0.32 ? 'body' : 'legs';
    const lift = m && (m.lift || name === 'headbutt'), overhead = name === 'hammer' || name === 'quake' || name === 'pounce' || (m && m.quake !== undefined && !m.at);
    const R = { t: 0, pow, across, dec: 3.4 - Math.min(1, pow) * 1.5, zone,
      pitch: lift ? -0.75 : overhead ? 0.35 : zone === 'head' ? -0.5 : zone === 'body' ? 0.42 : -0.12,   // + folds forward over a gut blow, - snaps back
      yaw: -across * 0.65 - side * 0.25, roll: across * 0.28 + (zone === 'legs' ? side * 0.18 : 0),
      dip: overhead ? 7 : zone === 'body' ? 3 : zone === 'legs' ? 4.5 : 1.5,
      knee: zone === 'legs' || (pow > 0.9 && !blocked) ? (side > 0 ? 'R' : 'L') : null,
      headP: lift ? -0.7 : zone === 'head' ? -0.55 : zone === 'body' ? 0.3 : 0, headY: -across * 0.55 - side * 0.2, arm: blocked ? 0.15 : 0.7 * pow };
    this.re = R;
    // a blow from the side turns the whole body; one from the front drives it back
    this.yawVel += -across * pow * (this.kind === 'robot' ? 1.8 : 1.4);
  }
  die() { this.alive = false; this.act = null; this.spinYaw = 0; this.deathT = 0; this.emit('death'); }

  // ---------------------------------------------------------------- per frame
  update(dt, opp, input, world) {
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.07; }
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.alive) this.meter = Math.min(100, this.meter + dt * 1.2);
    this.stun -= dt; this.down -= dt; this.dash = Math.max(0, this.dash - dt);
    const toOpp = opp.pos.clone().sub(this.pos).setY(0), dist = toOpp.length(), robot = this.kind === 'robot';
    let want = new THREE.Vector3(), turn = 0;
    if (this.alive && this.stun <= 0 && this.down <= 0 && (!this.act || this.act.m.spin)) {
      const f = toOpp.clone().normalize(), side = new THREE.Vector3(f.z, 0, -f.x);
      want.addScaledVector(f, input.move || 0).addScaledVector(side, input.strafe || 0);
      if (want.lengthSq() > 1) want.normalize();
      if (!this.act) turn = clamp(wrap(Math.atan2(toOpp.x, toOpp.z) - this.yaw) * 2.2, -1.1, 1.1);
    } else if (this.alive && this.act && this.act.m.track) turn = clamp(wrap(Math.atan2(toOpp.x, toOpp.z) - this.yaw) * 2.2, -1.1, 1.1) * this.act.m.track;
    // turning has weight: angular speed eases in and out
    this.yawVel += (turn - this.yawVel) * (1 - Math.exp(-dt * 4)); this.yaw += this.yawVel * dt;
    const maxSp = (robot ? 13 : 14) * this.speedK * (this.block ? 0.4 : 1) * (this.dash > 0 ? 3.2 : 1);
    const desired = want.multiplyScalar(maxSp);
    this.speed += (desired.length() - this.speed) * (1 - Math.exp(-dt * (this.dash > 0 ? 6 : 2.4)));
    if (desired.lengthSq() > 0.01) { const d = desired.clone().normalize(); this.moveDir = this.moveDir ? this.moveDir.lerp(d, 1 - Math.exp(-dt * 6)).normalize() : d; }
    const mv = (this.moveDir || this.face()).clone().multiplyScalar(this.speed * dt);
    let pose = {};
    if (this.act) {
      const a = this.act, m = a.m; a.t += dt; const p = Math.min(1, a.t / (m.dur * this.tempo));
      pose = sampleKeys(m.keys, p);
      if (pose.fwd) mv.addScaledVector(this.face(), pose.fwd * dt * (pose.fwd < 0 || dist > this.R + opp.R + 4 ? 1 : 0.1));
      // a leap: cover the distance to the opponent in the air, landing (gap) short of them
      if (m.leap && p >= m.leap[0] && p <= m.leap[1]) {
        if (a.leapV === undefined) a.leapV = clamp((dist - this.R - opp.R - (m.gap || 0)) / ((m.leap[1] - m.leap[0]) * m.dur), 0, 140);
        mv.addScaledVector(toOpp.clone().normalize(), a.leapV * dt);
      }
      if (m.spin) { const s = p < 0.3 ? 0 : p > 0.75 ? 1 : ease((p - 0.3) / 0.45); this.spinYaw = s * TAU; }
      // blows: one hit window, or several for a combo, each landing at most once
      const hits = m.hits || (m.hit ? [{ t: m.hit, at: m.at, dmg: m.dmg, knock: m.knock, r: m.hitR }] : []);
      a.done = a.done || [];
      a.sw = a.sw || [];
      hits.forEach((h, hi) => {
        if (!a.sw[hi] && p >= h.t[0] - 0.1 && this.act) { a.sw[hi] = true; this.emit('swing', { p: h.at === 'head' ? this.wp('head') : this.wp(m.spin ? 'tail6' : h.at), power: Math.min(1.6, (h.knock || 10) / 18 + 0.4) * (robot ? 0.9 : 1.1) }); }
        if (a.done[hi] || p < h.t[0] || p > h.t[1] || !this.act) return;
        let hp = h.at === 'head' ? this.wp('head', [0, -2, 12]) : this.wp(h.at, [0, -3, 0]);
        if (m.spin) { this.root.updateMatrixWorld(true); for (const seg of this.j.tail) { const q = seg.localToWorld(new THREE.Vector3(0, 0, -3)); if (this.hitTest(opp, q, 9)) { hp = q; break; } } }
        if (this.hitTest(opp, hp, h.r || (m.spin ? 9 : 8))) { a.done[hi] = true; const dealt = opp.takeHit(h.dmg * this.dmgK * (this.rage ? 1.15 : 1), this, h.knock, { down: m.down, unblockable: m.unblock, point: hp, melee: true, limb: m.spin ? 'tail' : h.at }); this.emit('hit', { point: hp, dmg: dealt, move: a.name, heavy: h.knock >= 20 }); }
      });
      // jets on a limb (the rocket punch)
      if (m.jet && (pose.thrust || 0) > 0.3) this.emit('thrust', { ps: [this.wp(m.jet, [0, 1, -3])], dir: this.face().negate(), k: pose.thrust });
      if (m.shot && !a.shotDone && p >= m.shot) { a.shotDone = true; this.emit('shoot', { from: this.wp('fistR', [0, -6, 0]), dir: opp.pos.clone().setY(40).sub(this.wp('fistR')).normalize(), dmg: m.dmg * this.dmgK }); }
      if (m.breath && p >= m.breath[0] && p <= m.breath[1]) {
        const mouth = this.wp('head', [0, -3.5, 15.5]), dir = this.wp('head', [0, -6.5, 40]).sub(mouth).normalize();
        this.emit('breath', { from: mouth, dir });
        const rel = opp.pos.clone().setY(40).sub(mouth), along = rel.dot(dir);
        if (along > 0 && along < 110 && rel.clone().sub(dir.clone().multiplyScalar(along)).length() < 14 + along * 0.12) { const d = opp.takeHit(m.dps * this.dmgK * dt, this, 0.5); this.emit('burn', { point: opp.pos.clone().setY(40), dmg: d }); if (opp.stun > 0.3) opp.stun = 0.3; }
      }
      if (m.roar && !a.roared && p >= m.roar) { a.roared = true; this.emit('roar'); }
      // lava: one geyser after another along the ground toward the opponent; each burns it if it is standing there
      if (m.erupt) {
        const [s0, s1, n, gap] = m.erupt, want = p < s0 ? 0 : Math.min(n, Math.floor((p - s0) / (s1 - s0) * n) + 1);
        if (!a.eDir) a.eDir = toOpp.clone().normalize();
        while ((a.fired || 0) < want) {
          const k = a.fired++, q = this.pos.clone().addScaledVector(a.eDir, this.R + 14 + k * gap).setY(0);
          this.emit('erupt', { p: q, k });
          if (Math.hypot(opp.pos.x - q.x, opp.pos.z - q.z) < opp.R + 9 && opp.air < 10) { const d = opp.takeHit(m.edmg * this.dmgK, this, 14); this.emit('hit', { point: opp.pos.clone().setY(18), dmg: d, move: 'erupt', heavy: k === n - 1 }); }
          for (const b of world.buildings) if (b.alive && Math.hypot(b.x - q.x, b.z - q.z) < 12 + Math.max(b.w, b.d) / 2) { if (world.collapse(b)) this.emit('smash', { b }); }
        }
      }
      // lightning: each bolt lands where the opponent is about to be (or close by)
      if (m.bolts) {
        const [s0, s1, n] = m.bolts, want = p < s0 ? 0 : Math.min(n, Math.floor((p - s0) / (s1 - s0) * n) + 1);
        while ((a.fired || 0) < want) {
          const k = a.fired++, lead = opp.vel.clone().add(opp.face().multiplyScalar(opp.speed || 0)).multiplyScalar(0.4);
          const q = opp.pos.clone().add(lead).add(new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).multiplyScalar(k % 2 ? 16 : 6)).setY(0);
          this.emit('bolt', { p: q, k });
          if (Math.hypot(opp.pos.x - q.x, opp.pos.z - q.z) < opp.R + 6) { const d = opp.takeHit(m.bdmg * this.dmgK, this, 10, { down: k === n - 1 ? 0.3 : 0 }); this.emit('hit', { point: opp.pos.clone().setY(45), dmg: d, move: 'bolt', heavy: k === n - 1 }); }
          for (const b of world.buildings) if (b.alive && Math.abs(q.x - b.x) < b.w / 2 + 4 && Math.abs(q.z - b.z) < b.d / 2 + 4) { if (world.collapse(b)) this.emit('smash', { b }); }
        }
      }
      // missile salvo: one launch after another from the hull pods
      if (m.salvo) {
        const [s0, s1, n] = m.salvo, want = p < s0 ? 0 : Math.min(n, Math.floor((p - s0) / (s1 - s0) * n) + 1);
        if (a.fired < want) this.root.updateMatrixWorld(true);
        while (a.fired < want) {
          const mz = this.j.podMuzzles[(a.fired * 5) % this.j.podMuzzles.length]; a.fired++;
          const from = this.j.chest.localToWorld(mz.clone()), up = this.j.chest.localToWorld(mz.clone().add(new THREE.Vector3(0, 1, -0.3))).sub(from).normalize();
          this.emit('missile', { from, dir: up, target: opp });
        }
      }
      // the heat beam: sweeps from the street in front up into the target, lagging behind it, stopped by the first thing it hits
      if (m.beam && p >= m.beam[0] && p <= m.beam[1]) {
        const mouth = this.wp('head', [0, -3.5, 15.5]), tgt = opp.pos.clone().setY(opp.kind === 'robot' ? 46 : 44);
        if (!a.aim) a.aim = this.pos.clone().addScaledVector(this.face(), 70).setY(0).sub(mouth).normalize();
        a.aim.lerp(tgt.clone().sub(mouth).normalize(), 1 - Math.exp(-dt * 1.7)).normalize();
        const dir = a.aim, rel = tgt.clone().sub(mouth), along = rel.dot(dir);
        let len = 420, hitOpp = false;
        if (along > 0 && along < len && rel.clone().addScaledVector(dir, -along).length() < opp.R + 5) { hitOpp = true; len = along - opp.R * 0.6; }
        if (dir.y < -0.01) { const g = mouth.y / -dir.y; if (g < len) { len = g; hitOpp = false; } }
        a.scan = (a.scan || 0) - dt;
        scan: for (let st = 12; st < len; st += 6) {
          const q = mouth.clone().addScaledVector(dir, st);
          for (const b of world.buildings) if (b.alive && !b.pole && q.y < b.h && Math.abs(q.x - b.x) < b.w / 2 && Math.abs(q.z - b.z) < b.d / 2) { if (world.collapse(b)) this.emit('smash', { b }); len = st; hitOpp = false; break scan; }
        }
        if (hitOpp) { const d = opp.takeHit(m.dps * this.dmgK * dt, this, 0.3, { graze: true }); this.emit('burn', { point: opp.pos.clone().setY(40), dmg: d }); }
        this.emit('beam', { from: mouth, to: mouth.clone().addScaledVector(dir, len), hit: hitOpp, ground: !hitOpp && dir.y < -0.01 });
      }
      // a landing shockwave: knocks the opponent flat if it is a stomp, and brings down the buildings around
      if (m.quake !== undefined && !a.quaked && p >= m.quake) {
        a.quaked = true; const c = this.pos.clone().setY(0); this.bodyV -= robot ? 34 : 46;
        this.emit('quake', { p: c, r: m.qr, big: !m.at && m.qr > 50, col: m.sig ? (robot ? new THREE.Color(this.v.glow).toArray() : this.v.blood) : null });
        if (!m.at && m.dmg) {
          const dd = Math.max(0, Math.hypot(opp.pos.x - c.x, opp.pos.z - c.z) - opp.R);
          if (dd < m.qr && opp.air < 8) { const dealt = opp.takeHit(m.dmg * this.dmgK * (1 - 0.5 * dd / m.qr), this, m.knock, { down: dd < m.qr * 0.4, unblockable: m.unblock, point: opp.pos.clone().setY(8), melee: true }); this.emit('hit', { point: opp.pos.clone().setY(20), dmg: dealt, move: a.name, heavy: true }); }
        }
        for (const b of world.buildings) if (b.alive && Math.hypot(b.x - c.x, b.z - c.z) < m.qr * 0.7 + Math.max(b.w, b.d) / 2) { if (world.collapse(b)) this.emit('smash', { b }); }
      }
      if (m.land && !a.landed && p >= m.land) { a.landed = true; this.bodyV -= robot ? 30 : 40; this.emit('land', { p: this.pos.clone().setY(0), power: robot ? 1 : 1.4 }); }
      if (p >= 1) { if (robot && (m.knock >= 20 || m.super)) this.ventT = 0.3; this.act = null; this.spinYaw = 0; }
    }
    this.air = this.act ? Math.max(0, pose.rise || 0) : 0;
    // thrusters: on during dashes and wherever a move asks for them
    this.thrustK += (Math.max(pose.thrust || 0, this.dash > 0 ? 1 : 0) - this.thrustK) * Math.min(1, dt * 10);
    if (robot && this.thrustK > 0.15) { this.root.updateMatrixWorld(true); this.emit('thrust', { ps: this.j.nozzles.map((v) => this.j.chest.localToWorld(v.clone())), dir: new THREE.Vector3(0, -0.85, -0.52).transformDirection(this.j.chest.matrixWorld), k: this.thrustK }); }
    mv.addScaledVector(this.vel, dt); this.vel.multiplyScalar(Math.exp(-dt * 2.2));
    // driven back hard: the feet skid over the ground
    const vs = Math.hypot(this.vel.x, this.vel.z);
    if (vs > 14 && this.air < 2 && this.alive && this.down <= 0 && (this.skidT = (this.skidT || 0) - dt) < 0) { this.skidT = 0.1; this.emit('skid', { ps: [this.wp('ankleL', [0, -2, 2]), this.wp('ankleR', [0, -2, 2])], power: Math.min(1.5, vs / 30), water: STAGE.water && this.pos.z < SHORE }); }
    this.pos.add(mv);
    const gv = Math.hypot(mv.x, mv.z) / Math.max(dt, 1e-4), g0 = this.gSpeed;
    this.gSpeed += (gv - this.gSpeed) * (1 - Math.exp(-dt * 7));
    if (gv > 0.5) { const d = new THREE.Vector3(mv.x, 0, mv.z).normalize(); this.gDir = this.gDir ? this.gDir.lerp(d, 1 - Math.exp(-dt * 8)).normalize() : d; }
    // the upper body lags behind changes of speed: it rocks back as the body sets off, sways forward as it pulls up
    const acc = clamp((this.gSpeed - g0) / Math.max(dt, 1e-4), -120, 120);
    this.accLean += (-acc * (robot ? 0.0022 : 0.003) - this.accLean) * (1 - Math.exp(-dt * 3));
    const sep = this.pos.clone().sub(opp.pos).setY(0), sd = sep.length(), minD = this.R + opp.R;
    if (sd < minD && sd > 0.01) this.pos.addScaledVector(sep.normalize(), (minD - sd) * 0.5);
    this.pos.x = clamp(this.pos.x, -420, 420); this.pos.z = clamp(this.pos.z, SHORE - 160, 520);
    // buildings in the way come down: under the body, under a fallen body, under a sweeping tail
    const probes = this.air > 6 ? [] : [[this.pos, this.R * 0.85]];
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
    const stepSp = this.air > 2 ? this.speed : Math.max(this.gSpeed, Math.abs(this.yawVel) * 9);
    this.gait = Math.min(6, stepSp / 10);
    this.stepRate = (robot ? 0.75 : 0.65) + this.gait * (robot ? 1.35 : 1.2);
    if (stepSp > 0.4) this.phase += dt * this.stepRate;
    this.stepSp = stepSp;
    const cyc = Math.floor(this.phase / Math.PI);
    if (cyc !== this.lastStep) { this.lastStep = cyc; if (stepSp > 1.5 && this.alive && this.down <= 0 && this.air < 2) { const S = cyc % 2 ? 'R' : 'L', pw = (robot ? 1 : 1.25) * (0.8 + Math.min(1.2, this.gait * 0.25)); this.bodyV -= (robot ? 9 : 12) * Math.min(1.6, 0.6 + this.gait * 0.3); this.emit('step', { p: this.wp('ankle' + S, [0, -2, 3]), power: pw, water: STAGE.water && this.pos.z < SHORE }); } }
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
    // reacting to a blow: snaps in fast, then eases off; the head whips a beat after the body
    const re = this.re; let rk = 0, rh = 0;
    if (re) {
      re.t += dt; const t = re.t, a = 0.06, ah = 0.12;
      rk = (t < a ? Math.sin(t / a * Math.PI / 2) : Math.exp(-(t - a) * re.dec)) * re.pow;
      rh = (t < ah ? Math.sin(t / ah * Math.PI / 2) : Math.exp(-(t - ah) * re.dec * 0.9)) * re.pow;
      if (t > 2.5) this.re = null;
    }
    const sp = this.stepSp || 0, k = Math.min(1, sp / 2.5), g1 = Math.min(1, this.gait || 0), g2 = clamp(((this.gait || 0) - 1) / 3, 0, 1), ph = this.phase;
    // the settle spring: each footfall pushes the body down, it sinks a little and comes back up (heavier for the kaiju)
    { const w = robot ? 15 : 11, z = robot ? 0.55 : 0.5, n = Math.ceil(dt * w / 0.3), h = dt / n;
      for (let i = 0; i < n; i++) { this.bodyV += (-w * w * this.bodyY - 2 * z * w * this.bodyV) * h; this.bodyY += this.bodyV * h; }
      this.bodyY = clamp(this.bodyY, -4, 2); }
    const sink = this.bodyY;
    const br = Math.sin(now * (robot ? 1.1 : 0.75));
    const look = clamp(wrap(Math.atan2(opp.pos.x - this.pos.x, opp.pos.z - this.pos.z) - this.yaw - (this.spinYaw || 0)), -0.7, 0.7);
    // falling (knocked down or dead)
    let fall = 0, up = -1;
    if (this.down > 0) {
      const el = this.downDur - this.down;
      if (el < 0.8) fall = ease(el / 0.8); else if (this.down > this.riseT) fall = 1;
      else { up = 1 - this.down / this.riseT; fall = up < 0.5 ? 1 - ease(up / 0.5) : 0; }
    }
    // getting up: the body sinks into a deep crouch as it rolls upright, then pushes up on its legs
    const crouch = up < 0 ? 0 : up < 0.5 ? ease(up / 0.5) : 1 - ease((up - 0.5) / 0.5);
    if (!this.alive) { this.deathT += dt; fall = ease(Math.min(1, this.deathT / 2)); }
    // the body rides up over the planted leg (an inverted pendulum), lowest as each foot lands
    const water = STAGE.water && this.pos.z < SHORE ? -6 : 0;
    const air = this.air || 0, tuck = Math.min(1, air / 12);
    const rootY = (robot ? -1.2 : 0) - (act.dip || 0) - crouch * (robot ? 11 : 13) + air + (robot ? 1.3 : 1.0) * k * g1 * (0.5 - 0.5 * Math.cos(2 * ph)) * (1 - 0.3 * g2) - g2 * (robot ? 2 : 3) + (air > 1 ? 0 : sink);
    // legs: stance feet slide back under the body at walking speed, swing feet arc forward
    if (fall < 0.05) {
      const S = Math.min(30, (this.gSpeed || 0) * Math.PI / Math.max(0.5, this.stepRate || 1)), H = (1.5 + S * 0.22) * k;
      const md = this.gDir || this.moveDir || this.face(), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const lz = md.x * sy + md.z * cy, lx = md.x * cy - md.z * sy;
      for (const [side, off] of [['L', 0], ['R', Math.PI]]) {
        const f = (((ph + off) % TAU) + TAU) % TAU; let z, lift = 0, toe = 0;
        if (f < Math.PI) z = S / 2 - S * (f / Math.PI);
        else { const u = (f - Math.PI) / Math.PI; z = -S / 2 + S * ease(u); lift = Math.sin(Math.PI * u) * H; toe = 0.3 * Math.sin(Math.PI * u) * k - 0.15 * Math.sin(Math.PI * Math.min(1, u * 2)) * k; }
        // turning on the spot: small side-steps
        const turnStep = (this.speed < 2 ? clamp(this.yawVel, -1, 1) * 4 * (f < Math.PI ? 1 - 2 * f / Math.PI : -1 + 2 * ease((f - Math.PI) / Math.PI)) : 0);
        // in the air the feet come up with the body, knees tucked, toes pointed
        this.legIK(side, lx * z + turnStep * (side === 'L' ? -0.3 : 0.3), lz * z * (1 - tuck) - tuck * (side === 'L' ? 3 : -2), lift * (1 - tuck) + air * 0.88 + tuck * 4, rootY, T, toe + tuck * 0.35);
        // the toes flick up as the foot leaves the ground
        set('toe' + side, f >= Math.PI ? -0.45 * Math.sin(Math.PI * (f - Math.PI) / Math.PI) * k * (1 - tuck) + tuck * 0.4 : 0, 0, 0);
      }
    } else if (up >= 0) { const kn = 1 - fall * 0.7; for (const S of ['L', 'R']) { set('hip' + S, -1.5 * kn, 0, S === 'L' ? -0.1 : 0.1); set('knee' + S, 2.2 * kn, 0, 0); set('ankle' + S, -0.7 * kn, 0, 0); set('toe' + S, 0.3 * kn, 0, 0); } }
    else for (const n of LEGJ) set(n, 0, 0, 0);
    if (robot) {
      const guard = this.block ? 1 : 0.72, sw = Math.sin(ph) * (0.16 + 0.3 * g2) * k * g1;
      set('shL', -0.85 * guard + sw, 0, -0.12); set('shR', -0.85 * guard - sw, 0, 0.12);
      set('elL', -1.75 * guard + br * 0.03, 0, 0); set('elR', -1.75 * guard - br * 0.03, 0, 0); set('fistL', 0.15, 0, 0); set('fistR', 0.15, 0, 0);
      if (this.block) { set('shL', -1.6, 0.4, 0.2); set('shR', -1.6, -0.4, -0.2); set('elL', -2.2, 0, 0); set('elR', -2.2, 0, 0); }
      // fists closed, pods shut
      set('fingL', 1.35, 0, 0); set('fingR', 1.35, 0, 0); set('thumbL', 0, 0, 0.5); set('thumbR', 0, 0, -0.5); set('podL'); set('podR');
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
      // arms: a heavy swing against the legs; in a charge they come forward, elbows bent, pumping with each stride
      const pm = this.act && this.act.m.pump ? (() => { const q = this.act.t / (this.act.m.dur * this.tempo), [p0, p1] = this.act.m.pump; return q < p0 || q > p1 ? 0 : Math.sin(Math.PI * clamp((q - p0) / (p1 - p0), 0, 1)) ** 0.5; })() : 0;
      const aw = (0.15 + 0.25 * g2) * k + pm * 0.35, ab = -0.12 - pm * 0.75 - g2 * 0.2;
      set('shL', ab + Math.sin(ph) * aw, 0, -0.1 - pm * 0.25); set('shR', ab - Math.sin(ph) * aw, 0, 0.1 + pm * 0.25);
      set('elL', -0.35 - pm * 0.7 - g2 * 0.25 + br * 0.04 - Math.max(0, Math.sin(ph)) * pm * 0.4, 0, 0); set('elR', -0.35 - pm * 0.7 - g2 * 0.25 + br * 0.04 - Math.max(0, -Math.sin(ph)) * pm * 0.4, 0, 0);
      set('handL', 0.25 - pm * 0.2, 0, 0); set('handR', 0.25 - pm * 0.2, 0, 0);
      set('fingL', 0.15 + Math.max(0, br) * 0.08, 0, 0); set('fingR', 0.15 + Math.max(0, br) * 0.08, 0, 0);
      // the tail: swings opposite to turns and trails behind, each segment lagging the one before
      this.tailS = this.tailS || j.tail.map(() => [0, 0]);
      const spin = this.act && this.act.m.spin ? 1 : 0;
      j.tail.forEach((b, i) => {
        const st = this.tailS[i];
        const ty = (re ? re.across * 0.35 * rk * (0.3 + i * 0.08) : 0) - this.yawVel * 0.2 * (0.5 + i * 0.1) + Math.sin(now * 0.9 - i * 0.45) * (0.025 + 0.03 * k) + Math.sin(ph - i * 0.4) * 0.05 * k * g1 - (spin ? 0.12 : 0);
        const tx = 0.02 * g1 + Math.sin(now * 0.6 - i * 0.4) * 0.012 + spin * 0.05 + (act.lean || 0) * 0.035 + g2 * 0.02 - sink * 0.012 * (i < 6 ? 1 : -0.6);
        const r = 1 - Math.exp(-dt * Math.max(1.5, 7 - i * 0.45));
        st[0] += (tx - st[0]) * r; st[1] += (ty - st[1]) * r; set('tail' + i, st[0], st[1], 0);
      });
    }
    // getting up: lean forward over the knees, hands pushing off the ground
    if (crouch > 0) for (const [S, s] of [['L', -1], ['R', 1]]) { set('sh' + S, -0.9 * crouch, 0, s * 0.35 * crouch); set('el' + S, -0.5 * crouch, 0, 0); }
    // the action's pose overrides the walk where it says something
    for (const [key, v] of Object.entries(act)) if (Array.isArray(v)) T[key] = v;
    let lean = (act.lean || 0) + (re ? re.pitch * rk : 0) + 0.55 * crouch + (this.down > 0 || !this.alive ? 0 : clamp(this.accLean, -0.12, 0.12) + g2 * (robot ? 0.16 : 0.12) - sink * 0.018), twist = (act.twist || 0) + (re ? re.yaw * rk : 0);
    { const h = robot ? 'head' : 'neck'; if (T[h]) T[h] = [T[h][0] + sink * 0.03, T[h][1], T[h][2]]; for (const S of ['L', 'R']) if (T['sh' + S] && !(act['sh' + S])) T['sh' + S] = [T['sh' + S][0] - sink * 0.03, T['sh' + S][1], T['sh' + S][2]]; }
    if (re && rk > 0.002) {
      const h = robot ? 'head' : 'neck'; if (T[h]) T[h] = [T[h][0] + re.headP * rh, T[h][1] + re.headY * rh, T[h][2] + re.across * 0.2 * rh];
      if (!robot && T.head) T.head = [T.head[0] + re.headP * 0.5 * rh, T.head[1] + re.headY * 0.4 * rh, T.head[2]];
      if (!robot && T.jaw) T.jaw = [T.jaw[0] + 0.55 * rh, 0, 0];
      // the arms fly out, the knee on the struck side gives
      for (const [S, sg] of [['L', -1], ['R', 1]]) if (T['sh' + S] && !act['sh' + S]) T['sh' + S] = [T['sh' + S][0] - 0.45 * re.arm * rk, T['sh' + S][1], T['sh' + S][2] + sg * 0.55 * re.arm * rk];
      if (re.knee && T['knee' + re.knee] && fall < 0.05) { const S = re.knee; T['knee' + S] = [T['knee' + S][0] + 0.75 * rk, 0, 0]; T['hip' + S] = [T['hip' + S][0] - 0.4 * rk, T['hip' + S][1], T['hip' + S][2]]; T['ankle' + S] = [T['ankle' + S][0] - 0.3 * rk, 0, T['ankle' + S][2]]; }
    }
    if (T.spine) { T.spine = [T.spine[0] + lean, T.spine[1] + twist, T.spine[2] + (re ? re.roll * rk : 0)]; }
    if (robot && T.chest) T.chest = [T.chest[0], T.chest[1] + twist * 0.5, T.chest[2]];
    // the kaiju's neck bends along its length: the base takes part of the motion
    if (!robot && T.neck) { const n = T.neck; T.neck0 = [n[0] * 0.5, n[1] * 0.45, n[2] * 0.5]; T.neck = [n[0] * 0.6, n[1] * 0.6, n[2] * 0.6]; }
    // place the body
    this.root.position.set(this.pos.x, water + rootY - fall * 6 - (re ? re.dip * rk : 0), this.pos.z);
    this.root.rotation.y = this.yaw + (this.spinYaw || 0);
    this.root.rotation.x += ((-fall * 1.45) - this.root.rotation.x) * Math.min(1, dt * (up >= 0 ? 3 : 5));
    // ease every joint toward its target; legs track tightly so the feet stay planted
    const base = 1 - Math.exp(-dt * (this.act ? 20 : 11)), fast = 1 - Math.exp(-dt * 40), slowK = 1 - Math.exp(-dt * 6);
    // the kaiju's fingers: one curl value per hand (negative spreads the claws, positive clenches), each knuckle following it
    if (!robot) for (const S of ['L', 'R']) {
      const v = T['fing' + S]; delete T['fing' + S]; this.curl = this.curl || { L: 0.15, R: 0.15 };
      this.curl[S] += ((v ? v[0] : 0.15) - this.curl[S]) * base; const c = this.curl[S], open = Math.max(0, -c);
      j['fing' + S].rotation.x = c * 0.2;
      for (const f of j['kf' + S]) { f.prox.rotation.set((f.thumb ? 0.2 : 0.3) + c * (f.thumb ? 0.55 : 0.75), f.spread * open * 0.35, 0); f.mid.rotation.x = 0.35 + c * 0.9; }
    }
    // a spring per joint: the heavy parts (spine, chest, shoulders) are slower and swing past a little, the hands and head quicker
    const W0 = robot ? (this.act ? 21 : 12) : (this.act ? 17 : 9), Z = robot ? 0.78 : 0.68;
    for (const [name, v] of Object.entries(T)) {
      const gj = j[name]; if (!gj || Array.isArray(gj)) continue;
      if (LEGJ.has(name) || name.startsWith('tail') || fall > 0.05 || up >= 0) {
        const kk = LEGJ.has(name) ? (fall > 0.05 || up >= 0 ? slowK : fast) : name.startsWith('tail') ? fast : base;
        gj.rotation.x += (v[0] - gj.rotation.x) * kk; gj.rotation.y += (v[1] - gj.rotation.y) * kk; gj.rotation.z += (v[2] - gj.rotation.z) * kk;
        if (this.jv[name]) this.jv[name].set(0, 0, 0);
        continue;
      }
      const heavy = name === 'spine' || name === 'chest' || name === 'pelvis' || name === 'neck0' ? 0.75 : name.startsWith('sh') || name === 'neck' ? 0.9 : name.startsWith('el') ? 1.05 : 1.25;
      const w = W0 * heavy, n = Math.ceil(dt * w / 0.35), h = dt / n, jv = this.jv[name] || (this.jv[name] = new THREE.Vector3()), r = gj.rotation;
      for (let i = 0; i < n; i++) {
        jv.x += ((v[0] - r.x) * w * w - 2 * Z * w * jv.x) * h; jv.y += ((v[1] - r.y) * w * w - 2 * Z * w * jv.y) * h; jv.z += ((v[2] - r.z) * w * w - 2 * Z * w * jv.z) * h;
        r.x += jv.x * h; r.y += jv.y * h; r.z += jv.z * h;
      }
    }
    // secondary parts of the robot: pauldrons lift with the arms, thigh plates swing with the legs, fingertips follow the knuckles
    if (robot) for (const [S, s] of [['L', -1], ['R', 1]]) {
      const sh = j['sh' + S], hip = j['hip' + S];
      j['pad' + S].rotation.set(-sh.rotation.x * 0.22, 0, -sh.rotation.z * 0.5 + s * Math.max(0, -sh.rotation.x - 1.1) * 0.3);
      j['skirt' + S].rotation.set(Math.min(0, hip.rotation.x) * 0.85, 0, hip.rotation.z * 0.6);
      for (const d of j['fingD' + S]) d.rotation.x = j['fing' + S].rotation.x * 0.95;
    }
    // glows: the robot's reactor (flickering when badly hurt) and its spinning turbine; the kaiju's plates and mouth
    const hpK = this.hp / this.maxHp;
    if (robot) {
      this.bladeK += ((act.blade || 0) - this.bladeK) * Math.min(1, dt * 9);
      j.blade.visible = this.bladeK > 0.03; j.blade.scale.y = 0.05 + 0.95 * this.bladeK;
      this.mats.blade.emissiveIntensity = this.bladeK * 1.3; this.mats.edge.emissiveIntensity = this.bladeK * (7 + Math.sin(now * 40) * 1);
      this.mats.thrust.emissiveIntensity = 0.2 + this.thrustK * 7; this.thrustLight.intensity = this.thrustK * 4000;
      const flick = hpK < 0.3 ? (Math.random() < 0.08 ? 0.2 : 1) : 1, on = this.alive ? 1 : 0.03;
      this.mats.glow.emissiveIntensity = (1.2 + Math.sin(now * 3.3) * 0.2) * flick * on; this.coreLight.intensity = 260 * flick * on;
      if (j.fan) j.fan.rotation.z -= dt * (this.alive ? 6 + this.speed * 0.4 : 0.5);
      if (j.beacon) j.beacon.visible = this.alive && (now % 1.6) < 0.18;
    } else {
      const a = this.act, roar = a && a.name === 'roar' ? 1 : 0, beam = a && a.name === 'beam';
      // acid and beam: before the breath a pulse of light climbs from the tail to the head (twice for the beam), then the whole back blazes
      const sigC = a && a.m.charge, ch = a && (a.name === 'acid' || beam || sigC) ? { p: Math.min(1, a.t / (a.m.dur * this.tempo)), w: beam ? a.m.windup : sigC ? sigC[0] : 0.3, e: beam ? a.m.beam[1] : sigC ? sigC[1] : 0.85 } : null;
      this.bands.forEach((m, i) => {
        let tgt = this.alive ? 0.9 + (1 - hpK) * 1.2 + roar * 3  : 0.05;
        if (ch) { const w = ch.p / ch.w, wv = beam ? (w * 2) % 1 : w; tgt = ch.p < ch.w ? 1.3 + 7 * Math.max(0, 1 - Math.abs(wv * 1.25 - i / 7) * 4) + w * 1.5 : ch.p < ch.e ? (beam ? 10 : 6) + Math.sin(now * 30 + i) * 0.8 : 2; }
        if (this.v.id === 'voltra' && this.alive && Math.random() < dt * 3) tgt += rnd(2, 6);
        m.emissiveIntensity += (tgt - m.emissiveIntensity) * Math.min(1, dt * 14);
      });
      if (this.v.veins) this.mats.skin.emissiveIntensity = this.alive ? (this.v.id === 'voltra' ? 0.35 + (Math.random() < 0.06 ? 1.5 : 0) : 0.8 + 0.25 * Math.sin(now * 1.3)) * (1 + (1 - hpK) * 0.8) + (ch && ch.p < ch.e ? 0.8 : 0) : 0.05;
      const mouthOn = ch && ch.p >= ch.w - 0.05 && ch.p < ch.e + 0.03 ? (beam ? 1.6 : 1) : 0;
      this.mats.mouth.emissiveIntensity += (mouthOn * 6 + roar * 0.6 - this.mats.mouth.emissiveIntensity) * Math.min(1, dt * 8); this.mouthLight.intensity = this.mats.mouth.emissiveIntensity * 1400;
      this.mats.scar.emissiveIntensity = this.alive ? 0.25 + (1 - hpK) * 2.6 + (ch && ch.p < ch.e ? 1.5 : 0) + Math.sin(now * 1.7) * 0.12 : 0.02;
      this.mats.eye.emissiveIntensity = this.alive ? 1.6 : 0.1;
    }
  }
}

// ------------------------------------------------------------------ the brain for a computer-controlled fighter
// It fights in phases so the bout has a rhythm: approach (with ranged pokes), a close exchange for a few seconds, then break
// apart (a backstep or a hop) and circle at range, and when the meter is full, a special move from the right distance.
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SIG_RANGE = { sentinel: [0, 40], bulwark: [0, 34], striker: [0, 60], abyssal: [0, 30], magmaw: [25, 140], voltra: [40, 260] };
const trySig = (me, d, rate, dt) => { const r = SIG_RANGE[me.v.id]; if (r && d >= r[0] && d <= r[1] && Math.random() < dt * rate) me.start('sig'); };
const SUPER_RANGE = { missiles: [30, 400], blade: [15, 110], beam: [25, 260], quake: [10, 100] };
export function think(me, opp, dt) {
  const inp = { move: 0, strafe: 0 }; if (!me.alive || !opp.alive) return inp;
  const robot = me.kind === 'robot';
  me.ai = me.ai || { t: 0, strafe: 1, state: 'approach', st: 0, circle: 1, range: 90, len: 3 };
  const A = me.ai; A.t -= dt; A.st += dt;
  const d = me.pos.distanceTo(opp.pos) - me.R - opp.R, oa = opp.act, on = oa && oa.name, op = oa ? oa.t / oa.m.dur : 0, ready = me.meter >= 100;
  if (A.t <= 0) { A.t = rnd(0.6, 1.6); A.strafe = Math.random() < 0.5 ? -1 : 1; A.mood = Math.random(); }
  const go = (s) => { A.state = s; A.st = 0; A.circle = Math.random() < 0.5 ? -1 : 1; A.range = rnd(50, 100); A.len = rnd(2, 3.5); A.sup = null; };
  me.block = false;
  if (!robot) {
    if (me.hp < me.maxHp * 0.35) me.rage = true;
    if (!me.introDone) { me.introDone = me.start('roar'); return inp; }
  }
  // the heat beam: run sideways out of it (a good pilot dashes, a bad one gets caught, some just brace behind their guard)
  if (robot && on === 'beam') {
    if (!A.dodge) A.dodge = { dir: Math.random() < 0.5 ? -1 : 1, skill: Math.random(), react: rnd(0.3, 0.42) };
    if (op > A.dodge.react) {
      if (A.dodge.skill < 0.22) { me.block = true; return inp; }
      inp.strafe = A.dodge.dir; inp.move = d < 60 ? -0.3 : 0.15;
      if (A.dodge.skill > 0.45 && me.dash <= 0) me.dash = 0.5;
      return inp;
    }
  } else A.dodge = null;
  // a stomp coming down: thrust away
  if (robot && on === 'quake' && op > 0.4 && !A.qDodge) { A.qDodge = true; if (Math.random() < 0.6) me.start('backstep'); }
  if (on !== 'quake') A.qDodge = false;
  // guard against close blows (decided once per attack, not every frame)
  if (oa !== A.seenAct) { A.seenAct = oa; A.guard = !!oa && Math.random() < 0.08 + 0.2 * (A.mood || 0.5); }
  if (robot && A.guard && oa && !oa.m.super && d < 30 && op < 0.55) me.block = true;
  switch (A.state) {
    case 'approach':
      inp.move = 1; inp.strafe = A.circle * 0.25; trySig(me, d, 0.25, dt);
      if (robot) { if (d > 70 && Math.random() < dt * 0.22) me.start('plasma'); if (d > 20 && d < 70 && Math.random() < dt * 0.4) me.start('rocket'); if (d > 90 && Math.random() < dt * 0.4) me.dash = 0.5; }
      else if (d > 35 && d < 110 && Math.random() < dt * 0.18) me.start('pounce');
      else if (d > 60 && Math.random() < dt * 0.35) me.start('charge');
      else if (d > 20 && d < 90 && Math.random() < dt * 0.2) me.start('acid');
      if (ready && A.st > 0.8) go('super');
      else if (d < (robot ? 14 : 18)) { go('close'); A.len = rnd(6, 12); }
      break;
    case 'close': {
      inp.move = d > 10 ? 0.6 : 0.1; inp.strafe = A.strafe * 0.4; trySig(me, d, 0.35, dt);
      if (robot) { if (!me.block && Math.random() < dt * 2.4) me.start(pick(['jab', 'jab', 'cross', 'upper', 'kick', 'cross', 'elbow', 'elbow', 'hammer', 'combo'])); }
      else if (Math.random() < dt * (me.rage ? 3.2 : 2.4)) me.start(pick(['swipe', 'swipe', 'bite', 'tail', 'bite', 'rake', 'rake', 'headbutt', 'headbutt', 'stomp']));
      const hurt = robot && (me.stun > 0.5 || me.down > 0);   // the robot backs off when it is getting hurt; the kaiju just gets angrier
      if (opp.down > 0.5 || d > 45 || A.st > A.len || (ready && A.st > 1.2) || (hurt && Math.random() < dt * 0.7)) {
        const taunt = opp.down > 0.5 && !robot;
        go('apart'); if (ready) A.len = rnd(1, 2); A.taunt = taunt;
        if (Math.random() < (robot ? 0.6 : 0.45)) A.retreat = robot ? 'backstep' : 'hop';
      }
      break; }
    case 'apart':
      if (A.retreat && me.start(A.retreat)) A.retreat = null; else if (A.st > 1) A.retreat = null;
      inp.move = d < A.range - 12 ? -0.85 : d > A.range + 25 ? 0.6 : 0; inp.strafe = A.circle * 0.85; trySig(me, d, 0.2, dt);
      if (robot) { if (d > 40 && Math.random() < dt * 0.15) me.start('plasma'); if (d > 20 && d < 75 && Math.random() < dt * 0.12) me.start('rocket'); }
      else { if (A.taunt && me.start('roar')) A.taunt = false; if (Math.random() < dt * 0.06) me.start('roar'); if (d < 100 && Math.random() < dt * 0.2) me.start('acid'); if (d > 35 && d < 110 && Math.random() < dt * 0.12) me.start('pounce'); if (d > 30 && d < 110 && Math.random() < dt * 0.1 && me.start('charge')) go('approach'); }
      if (A.st > A.len) go(ready ? 'super' : 'approach');
      break;
    case 'super': {
      if (!A.sup) A.sup = robot ? (d > 75 || Math.random() < 0.4 ? 'missiles' : 'blade') : (d > 75 || Math.random() < 0.5 ? 'beam' : 'quake');
      const [lo, hi] = SUPER_RANGE[A.sup];
      inp.move = d < lo ? -0.8 : d > hi ? 1 : 0; inp.strafe = A.circle * 0.3;
      if (d >= lo && d <= hi && me.start(A.sup)) go('after');
      else if (A.st > 5 || !ready) go('approach');
      break; }
    case 'after': if (!me.act) go(Math.random() < 0.5 ? 'apart' : 'approach'); break;
  }
  return inp;
}
