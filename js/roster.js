// Who can fight, and where. Each robot and kaiju is a variant of the same rig: its own build (bulk, plates, horns,
// armour pieces), paint and glow, stats (health, speed, tempo of its moves, damage) and the colour of its breath.
// tempo > 1 plays every move slower (heavier); speed scales walking; dmg scales every blow.
export const ROBOTS = {
  sentinel: { id: 'sentinel', name: 'robotName', paint: 0x51606e, paint2: 0x2e3640, glow: 0x6fd8ff, num: '04', label: 'SENTINEL', hp: 1800, speed: 1, tempo: 1.06, dmg: 1.16, R: 13, pad: 1, fist: 1 },
  // a slow, armoured brawler: wide pauldrons, huge fists, forearm shields, a crest
  bulwark: { id: 'bulwark', name: 'bulwarkName', paint: 0x8c3b22, paint2: 0x2a2522, glow: 0xffb347, num: '09', label: 'BULWARK', hp: 2050, speed: 0.86, tempo: 1.14, dmg: 1.16, R: 15, pad: 1.3, fist: 1.24 },
  // a light, fast duellist: slim shoulders, back fins, a blade on the right forearm
  // four arms and a ring of light: a flurry fighter (the lower pair has its own fists)
  asura: { id: 'asura', name: 'asuraName', paint: 0x6a1f2a, paint2: 0x2a1a14, glow: 0xffd27a, num: '08', label: 'ASURA', hp: 1650, speed: 1.05, tempo: 1, dmg: 0.9, R: 13, pad: 0.9, fist: 0.95 },
  // a walking gun platform: two long cannons over the shoulders, armoured legs; slow, fights from range
  fortress: { id: 'fortress', name: 'fortressName', paint: 0x55603e, paint2: 0x2a2e24, glow: 0xff7a3a, num: '22', label: 'FORTRESS', hp: 2450, speed: 0.8, tempo: 1.15, dmg: 1.28, R: 15, pad: 1.15, fist: 1.1 },
  striker: { id: 'striker', name: 'strikerName', paint: 0xc9d0d6, paint2: 0x1c3766, glow: 0x6dffc4, num: '11', label: 'STRIKER', hp: 1480, speed: 1.24, tempo: 0.92, dmg: 0.9, R: 12, pad: 0.78, fist: 0.9 },
};
export const KAIJUS = {
  abyssal: { id: 'abyssal', name: 'kaijuName', glow: 0x4ad8ff, mouth: 0x3ad8ff, eye: 0xffa040, skin: 0xffffff, belly: 0x8a8476, veins: 0, bulk: 1, tail: 1, plateW: 1, plateH: 1, horn: 1,
    hp: 1950, speed: 1, tempo: 1.14, dmg: 1, beam: [0xc8f4ff, 0x2a8cff, 0x5ad0ff], blood: [0.15, 0.8, 1], breath: [0.2, 0.9, 1], css: '#3ad8ff', voice: 1 },
  // a hulking lava beast: cracked hide glowing from inside, low broad plates, a horn on its snout, molten breath
  magmaw: { id: 'magmaw', name: 'magmawName', glow: 0xff6a1a, mouth: 0xff8a2a, eye: 0xfff0a0, skin: 0xc09078, belly: 0x6a4a3a, veins: 0xff5a10, bulk: 1.12, tail: 0.85, plateW: 1.55, plateH: 0.7, horn: 1.4,
    hp: 1950, speed: 0.86, tempo: 1.22, dmg: 0.97, beam: [0xfff0c0, 0xff5a10, 0xff7a30], blood: [1, 0.45, 0.1], breath: [1, 0.55, 0.15], css: '#ff6a1a', voice: 0.82 },
  // a lean storm beast: tall knife-like plates that crackle, a crest behind the skull, a long whip of a tail, lightning breath
  voltra: { id: 'voltra', name: 'voltraName', glow: 0xa98aff, mouth: 0xc0a8ff, eye: 0xd8f4ff, skin: 0x9aa6b8, belly: 0x7a7e8a, veins: 0x8a60ff, bulk: 0.9, tail: 1.15, plateW: 0.75, plateH: 1.45, horn: 0.8,
    hp: 1880, speed: 1.2, tempo: 1.04, dmg: 0.9, beam: [0xf4eeff, 0x8a50ff, 0xb090ff], blood: [0.7, 0.5, 1], breath: [0.75, 0.6, 1], css: '#a98aff', voice: 1.15 },
  // an ape: no tail, no plates, a hunched back, huge long arms; it grabs, beats its chest, and pounds (red blood)
  gorvax: { id: 'gorvax', name: 'gorvaxName', body: 'ape', glow: 0xff5a3a, mouth: 0xff7a50, eye: 0xff3020, skin: 0x8a6a58, belly: 0x5a4a40, veins: 0, bulk: 1.15, tail: 0.12, tailR: 0.15, plates: false, armL: 1.45, armT: 1.45, shW: 1.15, snout: 0.55, horn: 0, hunch: 0.28, plateW: 1, plateH: 1,
    hp: 1850, speed: 1.05, tempo: 1.1, dmg: 0.97, beam: [0xffe0d0, 0xff3a20, 0xff6040], blood: [0.85, 0.12, 0.08], breath: [1, 0.4, 0.3], css: '#ff5a3a', voice: 0.9 },
  // a winged beast: bat wings that fold along its back, a long crest; it blasts with its wings, strikes from the air, dive-bombs
  pterax: { id: 'pterax', name: 'pteraxName', body: 'wing', wings: true, glow: 0x5dffa0, mouth: 0x7dffb8, eye: 0xfff27a, skin: 0x7a8a78, belly: 0x8a8a70, veins: 0, bulk: 0.88, tail: 1.25, plateW: 0.8, plateH: 0.6, horn: 1.35,
    hp: 2050, speed: 1.15, tempo: 1.02, dmg: 1, beam: [0xe8fff0, 0x30d070, 0x60ff90], blood: [0.4, 1, 0.6], breath: [0.4, 1, 0.6], css: '#5dffa0', voice: 1.3 },
};
export const STAGES = ['harbour', 'desert', 'snow'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// a choice of 'random' resolves to one of them, a fixed id to itself
export const resolve = (choice, list) => (choice === 'random' || !list.includes(choice) ? pick(list) : choice);
