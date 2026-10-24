# 巨獸之夜 Kaiju Night

A giant robot and a kaiju fight in a harbour city at night, in the rain: **https://ywchen0711.github.io/kaiju-night/**

- **Three modes**: watch an AI-vs-AI fight cut like a live news broadcast (helicopter, street-level phone, harbour CCTV,
  over-the-shoulder, slow-motion close-ups on heavy hits), pilot the robot, or play the kaiju and wreck the city.
- **The look**: three.js with ACES tone mapping, bloom and a film grade (cold shadows, warm highlights, grain, vignette,
  chromatic aberration, letterbox). Storm sky with lightning, rain streaks, a reflective harbour, wet asphalt with puddles,
  thousands of lit windows, searchlight helicopters, fire light from burning ruins.
- **The giants**: a Pacific Rim-style jaeger (layered chamfered armour, weathered paint with hazard stripes, a turbine reactor, heat-sink towers venting steam) and an upright Godzilla-style kaiju with
  craggy bark-like hide, three rows of glowing dorsal plates and a heavy twelve-segment tail; foot IK keeps every step planted,
  with body bob, hip sway, a tail that lags behind turns, head tracking, keyframed attacks, staggers, knockdowns and death.
- **The fight**: punches, uppercut, kick, block, dash and plasma cannon against claw, bite, tail sweep, charge, acid
  breath and roar. Buildings in the way collapse into dust and fire.
- **Sound**: all synthesized with WebAudio (rain, thunder, roar, metal impacts, footfalls, explosions, collapse rumble).
- Controls: keyboard, touch (stick and buttons) or gamepad. Three quality presets.

```
js/world.js     the city, sky, rain, water, lights, helicopters, building collapse
js/fx.js        particles (smoke, glow, sparks), debris, fires
js/models.js    the kaiju (one skinned body lofted along its bones, craggy skin, dorsal plates) and the jaeger (chamfered armour plates)
js/fighters.js  walking with foot IK, attacks, secondary motion, hit detection, AI
js/audio.js     synthesized sound
js/main.js      renderer and post, camera director, modes, input, HUD
```
