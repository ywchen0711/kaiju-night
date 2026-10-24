# 巨獸之夜 Kaiju Night

A giant robot and a kaiju fight in a harbour city at night, in the rain: **https://ywchen0711.github.io/kaiju-night/**

- **Three modes**: watch an AI-vs-AI fight cut like a live news broadcast (helicopter, street-level phone, harbour CCTV,
  over-the-shoulder, slow-motion close-ups on heavy hits), pilot the robot, or play the kaiju and wreck the city.
- **The look**: three.js with ACES tone mapping, bloom and a film grade (cold shadows, warm highlights, grain, vignette,
  chromatic aberration, letterbox). Storm sky with lightning, rain streaks, a reflective harbour, wet asphalt with puddles,
  thousands of lit windows, searchlight helicopters, fire light from burning ruins.
- **The giants**: a jointed jaeger-style robot (scratched gunmetal, pistons, glowing core, floodlights) and a kaiju with
  wet clearcoated skin, glowing veins and dorsal spikes, a jaw and a ten-segment tail; procedural walk cycles,
  keyframed attacks, hit stagger, knockdowns and death.
- **The fight**: punches, uppercut, kick, block, dash and plasma cannon against claw, bite, tail sweep, charge, acid
  breath and roar. Buildings in the way collapse into dust and fire.
- **Sound**: all synthesized with WebAudio (rain, thunder, roar, metal impacts, footfalls, explosions, collapse rumble).
- Controls: keyboard, touch (stick and buttons) or gamepad. Three quality presets.

```
js/world.js     the city, sky, rain, water, lights, helicopters, building collapse
js/fx.js        particles (smoke, glow, sparks), debris, fires
js/fighters.js  the robot and kaiju rigs, moves, hit detection, AI
js/audio.js     synthesized sound
js/main.js      renderer and post, camera director, modes, input, HUD
```
