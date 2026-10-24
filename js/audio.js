// All sound is synthesized with WebAudio: rain and wind, thunder, the kaiju's roar and pain cries, layered impacts (a crack,
// a body thump, ringing armour plate or a wet slap of hide, a ground rumble), footfalls with hydraulics, explosions, servos.
// Sounds placed in the world (pass a position) are panned to where they are on screen, quieter, duller and a little later
// the farther away they are, and wetter (more of the city's echo).
let ctx = null, master = null, verb = null, noiseBuf = null, rainGain = null, droneGain = null, rainBands = [], weatherKind = 'rain', shaper = null;
const rnd = (a, b) => a + Math.random() * (b - a);
const L = { x: 0, y: 30, z: 260, rx: 1, rz: 0 };   // the listener (the camera) and its right-hand direction

function makeNoise() { const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; } return b; }
function makeVerb() { const len = ctx.sampleRate * 3.2, b = ctx.createBuffer(2, len, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < ctx.sampleRate * 0.02 ? i / (ctx.sampleRate * 0.02) : 1); } const v = ctx.createConvolver(); v.buffer = b; return v; }
const now = () => ctx.currentTime;
// where a sound sits: distance, pan, how much it is muffled and delayed
function place(p) {
  if (!p) return { k: 1, pan: 0, lp: 18000, delay: 0, wet: 0, d: 60 };
  const dx = p.x - L.x, dy = (p.y || 0) - L.y, dz = p.z - L.z, d = Math.max(1, Math.hypot(dx, dy, dz));
  return { k: Math.min(1.3, 110 / Math.max(25, d)), pan: Math.max(-0.9, Math.min(0.9, (dx * L.rx + dz * L.rz) / d)), lp: Math.max(700, 18000 * Math.exp(-d / 260)), delay: Math.min(0.22, d / 1500), wet: Math.min(0.5, d / 900), d };
}
// route a sound: gain -> (air) lowpass -> pan -> delay -> out, with a send to the reverb
function out(node, wet = 0.35, gain = 1, P = null) {
  const g = ctx.createGain(); g.gain.value = gain * (P ? P.k : 1); node.connect(g);
  let last = g;
  if (P) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = P.lp; lp.Q.value = 0.5; last.connect(lp); last = lp;
    if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = P.pan; last.connect(pn); last = pn; }
    if (P.delay > 0.005) { const dl = ctx.createDelay(0.5); dl.delayTime.value = P.delay; last.connect(dl); last = dl; }
  }
  last.connect(master);
  const w = wet + (P ? P.wet : 0); if (w > 0) { const wg = ctx.createGain(); wg.gain.value = w; last.connect(wg); wg.connect(verb); }
  return g;
}
function noise(dur, type = 'lowpass', f = 800, q = 0.7, t0 = now()) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rnd(0.8, 1.2); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q; s.connect(fl); s.start(t0, rnd(0, 1.5)); s.stop(t0 + dur + 0.1); return { s, fl }; }
function env(g, a, peak, d, t0 = now()) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
function osc(type, f0, f1, dur, t0 = now()) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur); o.start(t0); o.stop(t0 + dur + 0.05); return o; }
// a short burst through a soft clipper: the bite at the very start of a hit
function crack(P, power, f = 2600, len = 0.025, t0 = now()) { const n = noise(len + 0.02, 'highpass', f, 0.7, t0), g = ctx.createGain(); n.fl.connect(g); env(g, 0.001, 0.9 * power, len, t0); const sh = ctx.createWaveShaper(); sh.curve = shaper; g.connect(sh); out(sh, 0.25, 0.8, P); }
// a sine dropping in pitch: the weight of a blow or a footfall
function thump(P, power, f0, f1, len, t0 = now(), wet = 0.25) { const o = osc('sine', f0, f1, len, t0), g = ctx.createGain(); o.connect(g); env(g, 0.004, power, len, t0); out(g, wet, 1, P); }

export const Audio = {
  on: false,
  start() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = makeNoise(); master = ctx.createGain(); master.gain.value = 0.8;
    shaper = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; shaper[i] = Math.tanh(x * 3) / Math.tanh(3); }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25; master.connect(comp); comp.connect(ctx.destination);
    verb = makeVerb(); const vg = ctx.createGain(); vg.gain.value = 0.6; verb.connect(vg); vg.connect(comp);
    // rain: two bands of noise, steady
    rainGain = ctx.createGain(); rainGain.gain.value = 0.22; rainGain.connect(master);
    for (const [f, t, g] of [[3800, 'highpass', 0.5], [900, 'bandpass', 0.6]]) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = t; fl.frequency.value = f; const gg = ctx.createGain(); gg.gain.value = g; s.connect(fl); fl.connect(gg); gg.connect(rainGain); s.start(); rainBands.push({ fl, gg }); }
    // wind (desert and snow): the same noise, low and gusting
    const wl = ctx.createOscillator(), wg = ctx.createGain(); wl.frequency.value = 0.13; wg.gain.value = 0.25; wl.connect(wg); wl.start(); this.gust = wg;
    this.weather(weatherKind);
    // drone: low detuned saws through a slow filter, with a heartbeat-like swell
    droneGain = ctx.createGain(); droneGain.gain.value = 0.05; const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 220; df.Q.value = 3;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg); lg.connect(df.frequency); lfo.start();
    for (const f of [36.7, 36.9, 55, 43.6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(df); o.start(); }
    df.connect(droneGain); out(droneGain, 0.6, 1);
    this.on = true;
  },
  // the camera, every frame: position and the direction to its right
  listen(pos, right) { L.x = pos.x; L.y = pos.y; L.z = pos.z; const l = Math.hypot(right.x, right.z) || 1; L.rx = right.x / l; L.rz = right.z / l; },
  // the steady ambience: 'rain' hisses; 'dust' and 'snow' are wind, a low moan that gusts
  weather(kind) {
    weatherKind = kind; if (!ctx || rainBands.length < 2) return;
    const [hi, lo] = rainBands, wind = kind !== 'rain', t = now();
    hi.gg.gain.setTargetAtTime(wind ? 0.04 : 0.5, t, 0.5); lo.gg.gain.setTargetAtTime(wind ? 0.9 : 0.6, t, 0.5);
    lo.fl.frequency.setTargetAtTime(wind ? (kind === 'dust' ? 520 : 380) : 900, t, 0.5); lo.fl.Q.setTargetAtTime(wind ? 2.5 : 1, t, 0.5);
    try { this.gust.disconnect(); } catch {} if (wind) this.gust.connect(rainGain.gain);
    rainGain.gain.setTargetAtTime(wind ? 0.3 : 0.22, t, 0.5);
  },
  setMuted(m) { if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, now(), 0.1); },
  thunder(dist = 1) {
    if (!ctx) return; const d = rnd(4, 7), n = noise(d, 'lowpass', 300 + 600 / dist, 0.5), g = ctx.createGain(); n.fl.connect(g);
    g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(1.2 / dist, now() + 0.08); for (let i = 1; i < 6; i++) g.gain.setTargetAtTime(rnd(0.3, 1) / dist, now() + i * rnd(0.3, 0.6), 0.2); g.gain.exponentialRampToValueAtTime(0.0001, now() + d);
    n.fl.frequency.exponentialRampToValueAtTime(90, now() + d); out(g, 0.6, 1);
  },
  // a giant footfall: the ground thumps and crunches; a splash in water; the robot's legs hiss and clank as the hydraulics take the weight
  step(power = 1, dist = 100, water = false, p = null, metal = false) {
    if (!ctx) return; const P = p ? place(p) : place(null), k = p ? power : Math.min(1, 160 / Math.max(40, dist)) * power, t = now();
    thump(P, 0.9 * k, 72, 26, 0.7, t, 0.3);
    const n = noise(0.8, 'lowpass', water ? 1800 : 380), g2 = ctx.createGain(); n.fl.connect(g2); env(g2, 0.01, (water ? 0.5 : 0.35) * k, water ? 0.9 : 0.5); out(g2, 0.4, 1, P);
    if (!water) { const c = noise(0.3, 'bandpass', 1400, 0.9), cg = ctx.createGain(); c.fl.connect(cg); env(cg, 0.004, 0.12 * k, 0.22); out(cg, 0.3, 1, P); }   // grit crushed under the foot
    if (metal) {
      const t1 = t + 0.04, h = noise(0.5, 'highpass', 3200, 0.6, t1), hg = ctx.createGain(); h.fl.connect(hg); env(hg, 0.03, 0.07 * k, 0.4, t1); out(hg, 0.2, 1, P);
      const o = osc('triangle', rnd(95, 120), 80, 0.25, t), og = ctx.createGain(); o.connect(og); env(og, 0.002, 0.12 * k, 0.22, t); out(og, 0.3, 1, P);
    }
  },
  servo(p = null) { if (!ctx) return; const P = place(p), o = osc('square', rnd(180, 260), rnd(420, 600), 0.25), g = ctx.createGain(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 4; o.connect(f); f.connect(g); env(g, 0.02, 0.05, 0.3); out(g, 0.2, 1, P); },
  // the roar: a growling saw chord through moving vocal formants, with breath noise
  roar(len = 2.2, pitch = 1, p = null, vol = 1) {
    if (!ctx) return; const P = place(p), t = now(), g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7 * vol, t + Math.min(0.35, len * 0.25)); g.gain.setValueAtTime(0.7 * vol, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const mix = ctx.createGain(); mix.gain.value = 0.25;
    for (const [f, det] of [[62, 0], [64, 7], [93, -5], [124, 3]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * pitch * 0.8, t); o.frequency.linearRampToValueAtTime(f * pitch * 1.1, t + Math.min(0.4, len * 0.3)); o.frequency.linearRampToValueAtTime(f * pitch * 0.7, t + len); o.detune.value = det; const am = ctx.createOscillator(), ag = ctx.createGain(); am.frequency.value = rnd(22, 34); ag.gain.value = 0.5; am.connect(ag); ag.connect(mix.gain); am.start(t); am.stop(t + len); o.connect(mix); o.start(t); o.stop(t + len + 0.1); }
    const sh = ctx.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); } sh.curve = c; mix.connect(sh);
    for (const [f, q, gg] of [[420, 5, 1], [900, 6, 0.6], [2300, 8, 0.25]]) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.setValueAtTime(f * 0.7 * pitch, t); b.frequency.linearRampToValueAtTime(f * pitch, t + Math.min(0.5, len * 0.4)); b.frequency.linearRampToValueAtTime(f * 0.8 * pitch, t + len); b.Q.value = q; const bg = ctx.createGain(); bg.gain.value = gg; sh.connect(b); b.connect(bg); bg.connect(g); }
    const n = noise(len, 'bandpass', 1200, 1); n.fl.connect(g);
    out(g, 0.8, 1.1, P);
  },
  // a blow landing. o: { p, power, metal (the one hit is armour), blocked, heavy, sharp (claws or a blade, not a fist) }
  impact(o) {
    if (!ctx) return; const P = place(o.p), t = now(), pw = Math.min(2, o.power || 1), heavy = !!o.heavy;
    crack(P, (o.blocked ? 0.7 : 0.9) * pw, o.metal ? 3000 : 1800, o.sharp ? 0.05 : 0.025, t);
    // the body of the blow: deep for flesh, a harder knock for armour
    thump(P, (o.metal ? 0.75 : 1.0) * pw, o.metal ? 150 : 105, o.metal ? 48 : 30, heavy ? 0.6 : 0.38, t);
    if (heavy) thump(P, 0.7 * pw, 55, 22, 1.1, t + 0.01, 0.5);
    if (o.metal) {
      // a big armour plate ringing: inharmonic modes of a plate, a slight drop in pitch, decaying unevenly
      const f0 = rnd(85, 140) * (o.blocked ? 1.3 : 1), g = ctx.createGain(); env(g, 0.002, 0.32 * pw, heavy ? 2.2 : 1.3, t);
      for (const [r, a] of [[1, 1], [1.59, 0.7], [2.14, 0.55], [2.3, 0.5], [2.65, 0.35], [2.92, 0.3], [3.5, 0.22], [5.1, 0.12]]) { const oo = osc('sine', f0 * r * rnd(0.98, 1.02), f0 * r * 0.97, 2.2, t), og = ctx.createGain(); og.gain.setValueAtTime(a / r, t); og.gain.exponentialRampToValueAtTime(0.0001, t + (heavy ? 2.2 : 1.3) / Math.sqrt(r)); oo.connect(og); og.connect(g); }
      out(g, 0.5, 1, P);
      // the dent: a short distorted crunch
      const n = noise(0.18, 'bandpass', 700, 0.8, t), ng = ctx.createGain(); n.fl.connect(ng); env(ng, 0.002, 0.6 * pw, 0.14, t); const sh = ctx.createWaveShaper(); sh.curve = shaper; ng.connect(sh); out(sh, 0.3, 0.9, P);
      // claws dragging across the plate
      if (o.sharp) { const s = noise(0.5, 'bandpass', 4200, 6, t), sg = ctx.createGain(); s.fl.frequency.exponentialRampToValueAtTime(1800, t + 0.45); s.fl.connect(sg); env(sg, 0.02, 0.25 * pw, 0.45, t); out(sg, 0.4, 1, P); }
      // bits of armour and bolts falling away
      if (heavy && !o.blocked) for (let i = 0; i < 5; i++) { const t2 = t + rnd(0.15, 0.9), b = osc('sine', rnd(1800, 4200), rnd(1500, 3500), 0.12, t2), bg = ctx.createGain(); b.connect(bg); env(bg, 0.001, rnd(0.03, 0.07) * pw, rnd(0.05, 0.15), t2); out(bg, 0.5, 1, P); }
    } else {
      // hide: a wet slap with the pitch falling away, and for a heavy blow the crunch of something giving way inside
      const n = noise(0.3, 'bandpass', 900, 1.4, t), ng = ctx.createGain(); n.fl.frequency.exponentialRampToValueAtTime(220, t + 0.25); n.fl.connect(ng); env(ng, 0.002, 0.8 * pw, 0.24, t); out(ng, 0.25, 1, P);
      const w = noise(0.6, 'lowpass', 500, 0.7, t + 0.02), wg = ctx.createGain(); w.fl.connect(wg); env(wg, 0.01, 0.35 * pw, 0.5, t + 0.02); out(wg, 0.35, 1, P);
      if (o.sharp) { const s = noise(0.22, 'bandpass', 2600, 2, t), sg = ctx.createGain(); s.fl.frequency.exponentialRampToValueAtTime(900, t + 0.2); s.fl.connect(sg); env(sg, 0.004, 0.35 * pw, 0.2, t); out(sg, 0.3, 1, P); }
      if (heavy && !o.blocked) for (let i = 0; i < 4; i++) { const t2 = t + 0.02 + i * rnd(0.018, 0.04); crack(P, 0.35 * pw, 900, 0.012, t2); }
    }
    // a guard taking it: the blow skids off with a scrape
    if (o.blocked) { const s = noise(0.4, 'bandpass', 1800, 3, t + 0.03), sg = ctx.createGain(); s.fl.frequency.exponentialRampToValueAtTime(600, t + 0.4); s.fl.connect(sg); env(sg, 0.01, 0.3 * pw, 0.35, t + 0.03); out(sg, 0.3, 1, P); }
    // the ground and the buildings answer a heavy blow
    if (heavy) { const r = noise(1.6, 'lowpass', 260, 0.6, t + 0.05), rg = ctx.createGain(); r.fl.connect(rg); env(rg, 0.08, 0.5 * pw, 1.4, t + 0.05); out(rg, 0.7, 1, P); }
  },
  // the one hit cries out: the kaiju a short ragged growl or a yelp; the robot strains, hisses, and sounds a damage alarm
  pain(kind, power = 1, p = null, low = false) {
    if (!ctx) return; const P = place(p), t = now();
    if (kind === 'kaiju') { this.roar(rnd(0.45, 0.7) + power * 0.35, rnd(1.25, 1.55) - power * 0.15, p, Math.min(1, 0.45 + power * 0.35)); return; }
    const o = osc('sawtooth', rnd(140, 190), rnd(55, 70), 0.6, t + 0.05), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 3; const g = ctx.createGain(); o.connect(f); f.connect(g); env(g, 0.02, 0.12 * power, 0.55, t + 0.05); out(g, 0.3, 1, P);
    const h = noise(0.9, 'highpass', 2500, 0.7, t + 0.08), hg = ctx.createGain(); h.fl.connect(hg); env(hg, 0.03, 0.16 * power, 0.8, t + 0.08); out(hg, 0.3, 1, P);
    if (low) for (let i = 0; i < 3; i++) { const t2 = t + 0.3 + i * 0.22, b = osc('square', 880, 880, 0.12, t2), bg = ctx.createGain(); b.connect(bg); env(bg, 0.005, 0.05, 0.1, t2); out(bg, 0.2, 1, P); }
  },
  // a heavy limb cutting the air: lower and longer the bigger the move
  swing(power = 1, p = null) {
    if (!ctx) return; const P = place(p), t = now(), len = 0.25 + 0.2 * power, n = noise(len + 0.1, 'bandpass', 220, 1.1, t), g = ctx.createGain();
    n.fl.frequency.exponentialRampToValueAtTime(900 + 300 * power, t + len * 0.6); n.fl.frequency.exponentialRampToValueAtTime(300, t + len); n.fl.connect(g); env(g, len * 0.55, 0.32 * Math.min(1.5, power), len * 0.45, t); out(g, 0.2, 1, P);
  },
  explosion(power = 1, dist = 100, p = null) {
    if (!ctx) return; const P = place(p), k = p ? Math.min(1.2, power) : Math.min(1.2, 200 / Math.max(50, dist)) * power, d = 3 + power;
    crack(P, 0.8 * k, 1200, 0.06);
    const n = noise(d, 'lowpass', 2400), g = ctx.createGain(); n.fl.frequency.exponentialRampToValueAtTime(120, now() + d); n.fl.connect(g); env(g, 0.01, 1.1 * k, d); out(g, 0.7, 1, P);
    thump(P, 1 * k, 60, 22, 1.6, now(), 0.2);
  },
  // a building falls: a long rumble with cracks
  collapse(dist = 100, p = null) {
    if (!ctx) return; const P = place(p), k = p ? 1 : Math.min(1, 220 / Math.max(60, dist)), d = rnd(4, 6);
    const n = noise(d, 'lowpass', 500), g = ctx.createGain(); n.fl.connect(g); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(0.9 * k, now() + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, now() + d); out(g, 0.6, 1, P);
    for (let i = 0; i < 8; i++) crack(P, 0.3 * k, rnd(1500, 3000), rnd(0.02, 0.06), now() + rnd(0, 2.5));
  },
  // plasma cannon: a rising charge whine, then a crack
  charge(p = null) { if (!ctx) return; const P = place(p), o = osc('sawtooth', 120, 1800, 0.95), g = ctx.createGain(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000; o.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(0.12, now() + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, now() + 1.05); out(g, 0.4, 1, P); },
  zap(p = null) { if (!ctx) return; const P = place(p), n = noise(0.9, 'bandpass', 2500, 1.5), g = ctx.createGain(); n.fl.frequency.exponentialRampToValueAtTime(300, now() + 0.8); n.fl.connect(g); env(g, 0.003, 0.9, 0.8); out(g, 0.6, 1, P); const o = osc('square', 900, 60, 0.4), og = ctx.createGain(); o.connect(og); env(og, 0.003, 0.15, 0.45); out(og, 0.3, 1, P); },
  // acid breath: a hissing, bubbling roar, held while it lasts
  hiss(len = 1.4, p = null) { if (!ctx) return; const P = place(p), n = noise(len, 'bandpass', 2800, 0.8), g = ctx.createGain(); n.fl.connect(g); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(0.5, now() + 0.15); g.gain.setValueAtTime(0.5, now() + len - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, now() + len); out(g, 0.5, 1, P); this.roar(len, 1.3, p); },
  whoosh(p = null) { this.swing(0.6, p); },
  // a giant foot or body skidding over the street
  skid(power = 1, p = null) { if (!ctx) return; const P = place(p), n = noise(0.5, 'bandpass', 500, 0.8), g = ctx.createGain(); n.fl.connect(g); env(g, 0.04, 0.25 * power, 0.4); out(g, 0.3, 1, P); },
  tension(k) { if (droneGain) droneGain.gain.setTargetAtTime(0.04 + k * 0.08, now(), 1); },
};
