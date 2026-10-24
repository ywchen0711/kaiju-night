// All sound is synthesized with WebAudio: rain, thunder, the kaiju's roar, metal hits, footfalls, explosions, servos, a dark drone.
let ctx = null, master = null, verb = null, noiseBuf = null, rainGain = null, droneGain = null;
const rnd = (a, b) => a + Math.random() * (b - a);

function makeNoise() { const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; } return b; }
function makeVerb() { const len = ctx.sampleRate * 3.2, b = ctx.createBuffer(2, len, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); } const v = ctx.createConvolver(); v.buffer = b; return v; }
const now = () => ctx.currentTime;
function out(node, wet = 0.35, gain = 1) { const g = ctx.createGain(); g.gain.value = gain; node.connect(g); g.connect(master); if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); } return g; }
function noise(dur, type = 'lowpass', f = 800, q = 0.7) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rnd(0.8, 1.2); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); s.start(now(), rnd(0, 1.5)); s.stop(now() + dur + 0.1); return { s, fl }; }
function env(g, a, peak, d, t0 = now()) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }

export const Audio = {
  on: false,
  start() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = makeNoise(); master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; master.connect(comp); comp.connect(ctx.destination);
    verb = makeVerb(); const vg = ctx.createGain(); vg.gain.value = 0.6; verb.connect(vg); vg.connect(comp);
    // rain: two bands of noise, steady
    rainGain = ctx.createGain(); rainGain.gain.value = 0.22; rainGain.connect(master);
    for (const [f, t, g] of [[3800, 'highpass', 0.5], [900, 'bandpass', 0.6]]) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = t; fl.frequency.value = f; const gg = ctx.createGain(); gg.gain.value = g; s.connect(fl); fl.connect(gg); gg.connect(rainGain); s.start(); }
    // drone: low detuned saws through a slow filter, with a heartbeat-like swell
    droneGain = ctx.createGain(); droneGain.gain.value = 0.05; const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 220; df.Q.value = 3;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg); lg.connect(df.frequency); lfo.start();
    for (const f of [36.7, 36.9, 55, 43.6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(df); o.start(); }
    df.connect(droneGain); out(droneGain, 0.6, 1);
    this.on = true;
  },
  setMuted(m) { if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, now(), 0.1); },
  thunder(dist = 1) {
    if (!ctx) return; const d = rnd(4, 7), n = noise(d, 'lowpass', 300 + 600 / dist, 0.5), g = ctx.createGain(); n.fl.connect(g);
    g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(1.2 / dist, now() + 0.08); for (let i = 1; i < 6; i++) g.gain.setTargetAtTime(rnd(0.3, 1) / dist, now() + i * rnd(0.3, 0.6), 0.2); g.gain.exponentialRampToValueAtTime(0.0001, now() + d);
    n.fl.frequency.exponentialRampToValueAtTime(90, now() + d); out(g, 0.6, 1);
  },
  // a giant footfall: a sub thump, plus a splash in the water
  step(power = 1, dist = 100, water = false) {
    if (!ctx) return; const k = Math.min(1, 160 / Math.max(40, dist)) * power;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(70, now()); o.frequency.exponentialRampToValueAtTime(28, now() + 0.5); o.connect(g); env(g, 0.01, 0.9 * k, 0.7); out(g, 0.3); o.start(); o.stop(now() + 0.8);
    const n = noise(0.8, 'lowpass', water ? 1800 : 400), g2 = ctx.createGain(); n.fl.connect(g2); env(g2, 0.01, (water ? 0.5 : 0.35) * k, water ? 0.9 : 0.5); out(g2, 0.4);
  },
  servo() { if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(rnd(180, 260), now()); o.frequency.exponentialRampToValueAtTime(rnd(420, 600), now() + 0.25); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 4; o.connect(f); f.connect(g); env(g, 0.02, 0.05, 0.3); out(g, 0.2); o.start(); o.stop(now() + 0.4); },
  // the roar: a growling saw chord through moving vocal formants, with breath noise
  roar(len = 2.2, pitch = 1) {
    if (!ctx) return; const t = now(), g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.35); g.gain.setValueAtTime(0.7, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const mix = ctx.createGain(); mix.gain.value = 0.25;
    for (const [f, det] of [[62, 0], [64, 7], [93, -5], [124, 3]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * pitch * 0.8, t); o.frequency.linearRampToValueAtTime(f * pitch * 1.1, t + 0.4); o.frequency.linearRampToValueAtTime(f * pitch * 0.7, t + len); o.detune.value = det; const am = ctx.createOscillator(), ag = ctx.createGain(); am.frequency.value = rnd(22, 34); ag.gain.value = 0.5; am.connect(ag); ag.connect(mix.gain); am.start(t); am.stop(t + len); o.connect(mix); o.start(t); o.stop(t + len + 0.1); }
    const sh = ctx.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); } sh.curve = c; mix.connect(sh);
    for (const [f, q, gg] of [[420, 5, 1], [900, 6, 0.6], [2300, 8, 0.25]]) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.setValueAtTime(f * 0.7, t); b.frequency.linearRampToValueAtTime(f, t + 0.5); b.frequency.linearRampToValueAtTime(f * 0.8, t + len); b.Q.value = q; const bg = ctx.createGain(); bg.gain.value = gg; sh.connect(b); b.connect(bg); bg.connect(g); }
    const n = noise(len, 'bandpass', 1200, 1); n.fl.connect(g);
    out(g, 0.8, 1.1);
  },
  // metal hit: inharmonic partials ringing, plus a crunch
  clang(power = 1) {
    if (!ctx) return; const t = now(), g = ctx.createGain(); env(g, 0.003, 0.45 * power, 1.4);
    for (const r of [1, 2.76, 5.4, 8.93]) { const o = ctx.createOscillator(); o.frequency.value = 180 * r * rnd(0.95, 1.05); const og = ctx.createGain(); og.gain.value = 0.3 / r; o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.5); }
    const n = noise(0.3, 'highpass', 1500), ng = ctx.createGain(); n.fl.connect(ng); env(ng, 0.002, 0.6 * power, 0.25); out(ng, 0.4);
    this.thud(power * 0.8); out(g, 0.6);
  },
  // flesh hit: a wet low thud
  thud(power = 1) { if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, now()); o.frequency.exponentialRampToValueAtTime(35, now() + 0.35); o.connect(g); env(g, 0.005, 0.9 * power, 0.45); out(g, 0.3); o.start(); o.stop(now() + 0.5); const n = noise(0.4, 'lowpass', 700), ng = ctx.createGain(); n.fl.connect(ng); env(ng, 0.005, 0.5 * power, 0.3); out(ng, 0.3); },
  explosion(power = 1, dist = 100) {
    if (!ctx) return; const k = Math.min(1.2, 200 / Math.max(50, dist)) * power, d = 3 + power;
    const n = noise(d, 'lowpass', 2400), g = ctx.createGain(); n.fl.frequency.exponentialRampToValueAtTime(120, now() + d); n.fl.connect(g); env(g, 0.01, 1.1 * k, d); out(g, 0.7);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(60, now()); o.frequency.exponentialRampToValueAtTime(22, now() + 1.5); o.connect(og); env(og, 0.01, 1 * k, 1.6); out(og, 0.2); o.start(); o.stop(now() + 1.8);
  },
  // a building falls: a long rumble with cracks
  collapse(dist = 100) {
    if (!ctx) return; const k = Math.min(1, 220 / Math.max(60, dist)), d = rnd(4, 6);
    const n = noise(d, 'lowpass', 500), g = ctx.createGain(); n.fl.connect(g); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(0.9 * k, now() + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, now() + d); out(g, 0.6);
    for (let i = 0; i < 6; i++) setTimeout(() => { const c = noise(0.2, 'highpass', 2500), cg = ctx.createGain(); c.fl.connect(cg); env(cg, 0.002, 0.3 * k, 0.15); out(cg, 0.5); }, rnd(0, 2500));
  },
  // plasma cannon: a rising charge whine, then a crack
  charge() { if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(120, now()); o.frequency.exponentialRampToValueAtTime(1800, now() + 0.95); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000; o.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(0.12, now() + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, now() + 1.05); out(g, 0.4); o.start(); o.stop(now() + 1.1); },
  zap() { if (!ctx) return; const n = noise(0.9, 'bandpass', 2500, 1.5), g = ctx.createGain(); n.fl.frequency.exponentialRampToValueAtTime(300, now() + 0.8); n.fl.connect(g); env(g, 0.003, 0.9, 0.8); out(g, 0.6); const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(900, now()); o.frequency.exponentialRampToValueAtTime(60, now() + 0.4); o.connect(og); env(og, 0.003, 0.15, 0.45); out(og, 0.3); o.start(); o.stop(now() + 0.5); },
  // acid breath: a hissing, bubbling roar, held while it lasts
  hiss(len = 1.4) { if (!ctx) return; const n = noise(len, 'bandpass', 2800, 0.8), g = ctx.createGain(); n.fl.connect(g); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(0.5, now() + 0.15); g.gain.setValueAtTime(0.5, now() + len - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, now() + len); out(g, 0.5); this.roar(len, 1.3); },
  whoosh() { if (!ctx) return; const n = noise(0.5, 'bandpass', 400, 1.2), g = ctx.createGain(); n.fl.frequency.exponentialRampToValueAtTime(1600, now() + 0.3); n.fl.connect(g); env(g, 0.15, 0.25, 0.3); out(g, 0.2); },
  tension(k) { if (droneGain) droneGain.gain.setTargetAtTime(0.04 + k * 0.08, now(), 1); },
};
