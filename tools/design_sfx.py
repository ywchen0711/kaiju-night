# Builds Kaiju Night's sound effects from real recordings, all CC0 (public domain):
#   Kenney Impact Sounds and Sci-fi Sounds (kenney.nl), rubberduck's "80 CC0 creature SFX" 1 and 2, Ogrebane's
#   "Monster Sound Effects Pack" and the "Swishes Sound Pack" (opengameart.org).
# Each sound layers several recordings, pitched down to the scale of 80 m giants, filtered, given some size with echoes,
# peak-normalised and saved as mono mp3 in ../sfx, with manifest.json listing how many variants each has.
# Usage: put every pack's audio files, unzipped flat, in tools/raw/, then  python tools/design_sfx.py  (needs ffmpeg).
import subprocess, os, re, json, glob
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', 'sfx')
os.makedirs(OUT, exist_ok=True)
def files(pat): return sorted(glob.glob(os.path.join(RAW, pat)))
# a layer: (file pattern, rate, gain dB, delay ms, highpass, lowpass); variant v takes file (v + layer index) of the pattern
R = {
  # blows
  'flesh_h':  [('impactPunch_heavy_*', 0.55, 0, 0, 30, 9000), ('impactSoft_heavy_*', 0.45, -2, 0, 20, 5000), ('slime_0[0-9][0-9].ogg', 0.62, -9, 12, 80, 6000), ('impactMining_*', 0.5, -11, 25, 200, 3000), ('lowFrequency_explosion_*', 0.8, -6, 0, 20, 220)],
  'flesh_m':  [('impactPunch_medium_*', 0.65, 0, 0, 40, 10000), ('impactSoft_medium_*', 0.55, -3, 0, 30, 6000), ('slime_0[0-9][0-9].ogg', 0.78, -13, 10, 100, 7000)],
  'metal_h':  [('impactPlate_heavy_*', 0.55, 0, 0, 40, 9000), ('impactMetal_heavy_*', 0.5, -3, 0, 40, 8000), ('impactMetal_0*', 0.6, -4, 8, 60, 9000), ('explosionCrunch_*', 0.7, -11, 10, 80, 2500), ('lowFrequency_explosion_*', 0.8, -8, 0, 20, 220)],
  'metal_m':  [('impactPlate_medium_*', 0.65, 0, 0, 60, 10000), ('impactMetal_medium_*', 0.6, -3, 0, 60, 9000), ('impactMetal_0*', 0.75, -9, 6, 80, 9000)],
  'block':    [('impactMetal_heavy_*', 0.75, 0, 0, 120, 10000), ('impactPlate_light_*', 0.8, -4, 0, 150, 10000), ('impactMetal_0*', 0.9, -7, 5, 300, 10000)],
  # footfalls
  'step':     [('impactSoft_heavy_*', 0.35, 0, 0, 20, 900), ('impactMining_*', 0.4, -7, 15, 60, 1500), ('lowFrequency_explosion_*', 0.6, -3, 0, 15, 160)],
  'step_bot': [('impactSoft_heavy_*', 0.35, 0, 0, 20, 900), ('impactMining_*', 0.42, -8, 15, 60, 1500), ('lowFrequency_explosion_*', 0.6, -4, 0, 15, 160), ('impactMetal_medium_*', 0.45, -9, 35, 80, 4000), ('impactPlate_light_*', 0.5, -14, 60, 200, 6000)],
  'step_snow':[('footstep_snow_*', 0.4, 0, 0, 40, 2200), ('impactSoft_heavy_*', 0.35, -3, 0, 20, 700), ('lowFrequency_explosion_*', 0.6, -6, 0, 15, 150)],
  # the world
  'explosion':[('explosionCrunch_*', 0.7, 0, 0, 20, 12000), ('lowFrequency_explosion_*', 0.7, -2, 0, 15, 400), ('explosionCrunch_*', 0.5, -5, 70, 20, 4000)],
  'collapse': [('impactMining_*', 0.35, 0, 0, 20, 3000), ('explosionCrunch_*', 0.4, -3, 200, 20, 2500), ('impactGlass_heavy_*', 0.7, -8, 90, 300, 10000), ('impactGlass_medium_*', 0.6, -10, 600, 300, 10000), ('impactMining_*', 0.3, -4, 900, 20, 2000), ('lowFrequency_explosion_*', 0.5, -2, 0, 15, 300)],
  'plasma':   [('laserLarge_*', 0.6, 0, 0, 60, 12000), ('lowFrequency_explosion_*', 0.9, -8, 0, 20, 300)],
  'thrust':   [('thrusterFire_*', 0.8, 0, 0, 40, 9000)],
  'bolt':     [('explosionCrunch_*', 1.1, 0, 0, 200, 14000), ('impactGlass_heavy_*', 0.8, -7, 0, 400, 14000), ('lowFrequency_explosion_*', 0.7, -2, 20, 15, 300)],
  # the kaiju's voice: roars stacked an octave and more down, with a second beast under the first and a boom beneath
  'roar':     [('roar_0*', 0.5, 0, 0, 40, 7000), ('monster_[01]*.ogg', 0.45, -4, 80, 40, 5000), ('roar_0*', 0.62, -7, 150, 60, 6000), ('lowFrequency_explosion_*', 0.6, -9, 0, 15, 200)],
  'roar_long':[('roar_0*', 0.45, 0, 0, 40, 6500), ('monster_[01]*.ogg', 0.42, -3, 60, 40, 5000), ('roar_0*', 0.5, -2, 850, 40, 6500), ('monster-*.wav', 0.45, -5, 900, 40, 5000), ('roar_0*', 0.58, -8, 300, 60, 6000), ('lowFrequency_explosion_*', 0.5, -8, 0, 15, 200)],
  'growl':    [('monster_[01]*.ogg', 0.55, 0, 0, 50, 6000), ('grunt_0*', 0.5, -6, 20, 50, 5000)],
  'pain':     [('hurt_0*', 0.5, 0, 0, 60, 7000), ('monster-*.wav', 0.55, -5, 30, 50, 6000), ('attack_0*', 0.5, -9, 0, 60, 6000)],
  'death':    [('die_0*', 0.4, 0, 0, 30, 6000), ('roar_0*', 0.38, -3, 120, 30, 5000), ('die_0*', 0.33, -6, 500, 30, 4000), ('lowFrequency_explosion_*', 0.45, -6, 0, 15, 200)],
  # limbs through the air: a stick and a hanger swung, slowed to giant arms
  'swing_h':  [('swish-[6-9].wav', 0.32, 0, 0, 40, 2600), ('swish-1[0-3].wav', 0.42, -5, 25, 60, 3500)],
  'swing_l':  [('swish-[1-5].wav', 0.45, 0, 0, 60, 4000)],
  # the robot's hydraulics: sci-fi doors, slowed into giant pistons
  'servo':    [('doorOpen_*', 0.6, 0, 0, 60, 8000), ('doorClose_*', 0.5, -6, 120, 60, 6000)],
}
VARIANTS = {'collapse': 3, 'plasma': 3, 'thrust': 2, 'bolt': 3, 'roar': 6, 'roar_long': 3, 'growl': 6, 'pain': 6, 'death': 3, 'swing_h': 5, 'swing_l': 4, 'servo': 4}
# echoes that give a sound its size (a city street at night, not a room)
SIZE = {'roar': 'aecho=0.8:0.6:70|140:0.3|0.2', 'roar_long': 'aecho=0.8:0.6:80|170:0.32|0.22', 'growl': 'aecho=0.8:0.5:60:0.25', 'pain': 'aecho=0.8:0.5:60:0.22', 'death': 'aecho=0.8:0.6:90|200:0.35|0.25'}
manifest = {}
for name, layers in R.items():
  n = VARIANTS.get(name, 4); manifest[name] = n
  for v in range(n):
    ins, chains = [], []
    for k, (pat, rate, gain, delay, hp, lp) in enumerate(layers):
      fl = files(pat); assert fl, pat
      ins += ['-i', fl[(v * 2 + k) % len(fl)] if name in SIZE else fl[(v + k) % len(fl)]]
      chains.append(f"[{k}:a]aformat=channel_layouts=mono,asetrate={int(44100 * rate)},aresample=44100,highpass=f={hp},lowpass=f={lp},volume={gain}dB,adelay={delay}:all=1[l{k}]")
    post = (',' + SIZE[name]) if name in SIZE else ''
    if name == 'thrust': post += ',atrim=0:1.6,afade=t=out:st=1.2:d=0.4'
    graph = ';'.join(chains) + ';' + ''.join(f'[l{k}]' for k in range(len(layers))) + f'amix=inputs={len(layers)}:normalize=0:duration=longest{post},alimiter=limit=0.9[o]'
    wav = os.path.join(OUT, f'_{name}_{v}.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', graph, '-map', '[o]', '-ac', '1', wav], check=True)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    peak = float(re.search(r'max_volume: (-?[\d.]+) dB', r).group(1))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', f'volume={-1 - peak}dB,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-60dB', '-c:a', 'libmp3lame', '-b:a', '96k', os.path.join(OUT, f'{name}_{v}.mp3')], check=True)
    os.remove(wav)
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
print(manifest, sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT)) // 1024, 'KB')
