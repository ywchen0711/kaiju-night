# 巨獸之夜 Kaiju Night

A giant robot and a kaiju fight in a harbour city at night, in the rain: **https://ywchen0711.github.io/kaiju-night/**

- **Four modes**, in Chinese or English (toggle top right): watch an AI-vs-AI fight cut like a live news broadcast (helicopter, street-level phone, harbour CCTV,
  over-the-shoulder, slow-motion close-ups on heavy hits), pilot the robot, play the kaiju and wreck the city, or go **on foot**: one person in the street, first person, looking up at the fight (don't get stepped on, don't stand under buildings).
- **The look**: three.js with ACES tone mapping, bloom and a film grade (cold shadows, warm highlights, grain, vignette,
  chromatic aberration, letterbox). Storm sky with lightning, rain streaks, a reflective harbour, wet asphalt with puddles,
  thousands of lit windows, searchlight helicopters, fire light from burning ruins.
- **The giants**: a Pacific Rim-style jaeger (layered chamfered armour, weathered paint with hazard stripes, a turbine reactor, heat-sink towers venting steam) and an upright Godzilla-style kaiju with
  craggy bark-like hide, three rows of glowing dorsal plates and a heavy twelve-segment tail; foot IK keeps every step planted,
  with body bob, hip sway, a tail that lags behind turns, head tracking, keyframed attacks, staggers, knockdowns and death.
- **More joints**: the kaiju's neck bends along two joints, its toes flex and its hands have a palm, knuckles, four two-segment fingers with hooked claws and a thumb that spread and clench; the jaeger has
  two-segment fingers and a thumb that close into fists or open for the palm cannon, toes, hinged missile-pod lids, a
  fold-out arm blade, and pauldrons and thigh plates that follow the limbs. Detail: belly scutes, bony spikes on the
  tail, thighs and forearms, horns, gill slits and old wounds that glow brighter as the kaiju gets hurt; antennas, hoses,
  vents and back thrusters on the jaeger.
- **Stages, jaegers and kaiju** (chosen on the title screen, or random; every fight gets a fresh city):
  - Stages: 暴雨港灣 Harbour storm (night, rain, lightning, the bay), 黃昏煉油廠 Refinery at dusk (low sun, blowing sand,
    storage tanks, warehouses, burning flare stacks), 雪夜山城 Snowbound town (falling snow, a frozen lake, cabins, a church, pines).
  - Jaegers: Sentinel MK-IV (balanced), Bulwark MK-II (heavy: wide pauldrons, huge fists, forearm shields; slow and tough),
    Striker MK-V (light: back fins, a forearm blade; fast and fragile).
  - Kaiju: Abyssal (deep-sea, blue heat beam), Magmaw (lava veins glowing through cracked hide, rock armour, a snout horn,
    magma breath; biggest and slowest), Voltra (lean, tall crackling plates, a crest of blades, thunder breath; fastest).
  - Each has a signature move of its own (key **T**, gamepad LT): Sentinel's thruster uppercut 推進升龍拳, Bulwark's
    ground-splitting double fist 斷層鐵拳, Striker's four-slash blade flurry 疾風連斬, Abyssal's ring of light 深淵脈衝,
    Magmaw's line of lava geysers 熔岩噴發, Voltra's lightning called down from the sky 雷暴召喚. The AI uses them from the right range.
  - Each variant has its own health, speed, move tempo and damage, tuned with headless AI-vs-AI runs of every pairing.
- **The fight**: punches, uppercut, kick, elbow, two-fisted hammer, a jab-cross-uppercut combo, a jet-assisted rocket
  punch, block, dash and plasma cannon against claw, two-handed rake, bite, headbutt, stomp, tail sweep, a running charge, acid
  breath, a low claws-first pounce, and roar. The kaiju fights with its body only, no projectiles besides its breath. Every fight starts from random positions. Buildings in the way collapse into dust and fire. The AI fights in phases (close in, trade blows,
  now and then break apart with a thruster backstep or a hop and circle at range, come back), so they are not always in a clinch. Knockdowns are rare, and getting up takes a while: roll up to a kneel, push up to standing.
- **Weight**: every joint above the hips moves on a damped spring, so limbs carry through and settle; each footfall sinks the
  body and nods the head a beat later, the upper body lags behind changes of speed, the tail lifts as a counterweight, and the
  legs always step at the body's real ground speed (lunges, the charge and being knocked back all walk). Moves play a little
  slower than they used to, the kaiju more so.
- **Special moves** (a power meter fills from dealing and taking damage): the jaeger's missile barrage (飛彈齊射) and
  a thruster leap into a plasma-blade slash (電漿劍 · 天降斬); the kaiju's atomic heat beam (原子熱線), which sweeps
  after its target and cuts through buildings, and a leaping quake stomp (震地踐踏). Each gets a hero shot, a wide shot
  and a title across the screen. Pilot keys: **E** / **F** for the specials, **C** to back off.
- **Sound**: all synthesized with WebAudio (rain, thunder, roar, metal impacts, footfalls, explosions, collapse rumble).
- Controls: keyboard, touch (stick and buttons) or gamepad. Three quality presets.

```
js/roster.js    the jaegers, kaiju and stages: build, colours, stats
js/i18n.js      Chinese and English texts
js/world.js     the city, sky, rain, water, lights, helicopters, building collapse
js/fx.js        particles (smoke, glow, sparks), debris, fires
js/models.js    the kaiju (one skinned body lofted along its bones, craggy skin, dorsal plates) and the jaeger (chamfered armour plates)
js/fighters.js  walking with foot IK, attacks, secondary motion, hit detection, AI
js/audio.js     synthesized sound
js/main.js      renderer and post, camera director, modes, input, HUD
```
