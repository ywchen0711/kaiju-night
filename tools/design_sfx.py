# Builds Kaiju Night's impact sounds from real recordings (Kenney Impact Sounds + Sci-fi Sounds, CC0):
# each sound is several recordings layered, pitched down to giant scale, filtered, peak-normalised, saved as mono mp3.
import subprocess, os, re, json, sys
RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kenney_raw')   # the .ogg files of both Kenney packs, unzipped flat
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sfx')
os.makedirs(OUT, exist_ok=True)
def f(group, i, n=5): return os.path.join(RAW, f'{group}_{i % n:03d}.ogg')
# a layer: (file group, variants in the pack, rate, gain dB, delay ms, highpass, lowpass)
R = {
  'flesh_h':  [('impactPunch_heavy', 5, 0.55, 0, 0, 30, 9000), ('impactSoft_heavy', 5, 0.45, -2, 0, 20, 5000), ('slime', 2, 0.62, -9, 12, 80, 6000), ('impactMining', 5, 0.5, -11, 25, 200, 3000), ('lowFrequency_explosion', 2, 0.8, -6, 0, 20, 220)],
  'flesh_m':  [('impactPunch_medium', 5, 0.65, 0, 0, 40, 10000), ('impactSoft_medium', 5, 0.55, -3, 0, 30, 6000), ('slime', 2, 0.78, -13, 10, 100, 7000)],
  'metal_h':  [('impactPlate_heavy', 5, 0.55, 0, 0, 40, 9000), ('impactMetal_heavy', 5, 0.5, -3, 0, 40, 8000), ('impactMetal', 5, 0.6, -4, 8, 60, 9000), ('explosionCrunch', 5, 0.7, -11, 10, 80, 2500), ('lowFrequency_explosion', 2, 0.8, -8, 0, 20, 220)],
  'metal_m':  [('impactPlate_medium', 5, 0.65, 0, 0, 60, 10000), ('impactMetal_medium', 5, 0.6, -3, 0, 60, 9000), ('impactMetal', 5, 0.75, -9, 6, 80, 9000)],
  'block':    [('impactMetal_heavy', 5, 0.75, 0, 0, 120, 10000), ('impactPlate_light', 5, 0.8, -4, 0, 150, 10000), ('impactMetal', 5, 0.9, -7, 5, 300, 10000)],
  'step':     [('impactSoft_heavy', 5, 0.35, 0, 0, 20, 900), ('impactMining', 5, 0.4, -7, 15, 60, 1500), ('lowFrequency_explosion', 2, 0.6, -3, 0, 15, 160)],
  'step_bot': [('impactSoft_heavy', 5, 0.35, 0, 0, 20, 900), ('impactMining', 5, 0.42, -8, 15, 60, 1500), ('lowFrequency_explosion', 2, 0.6, -4, 0, 15, 160), ('impactMetal_medium', 5, 0.45, -9, 35, 80, 4000), ('impactPlate_light', 5, 0.5, -14, 60, 200, 6000)],
  'step_snow':[('footstep_snow', 5, 0.4, 0, 0, 40, 2200), ('impactSoft_heavy', 5, 0.35, -3, 0, 20, 700), ('lowFrequency_explosion', 2, 0.6, -6, 0, 15, 150)],
  'explosion':[('explosionCrunch', 5, 0.7, 0, 0, 20, 12000), ('lowFrequency_explosion', 2, 0.7, -2, 0, 15, 400), ('explosionCrunch', 5, 0.5, -5, 70, 20, 4000)],
  'collapse': [('impactMining', 5, 0.35, 0, 0, 20, 3000), ('explosionCrunch', 5, 0.4, -3, 200, 20, 2500), ('impactGlass_heavy', 5, 0.7, -8, 90, 300, 10000), ('impactGlass_medium', 5, 0.6, -10, 600, 300, 10000), ('impactMining', 5, 0.3, -4, 900, 20, 2000), ('lowFrequency_explosion', 2, 0.5, -2, 0, 15, 300)],
  'plasma':   [('laserLarge', 5, 0.6, 0, 0, 60, 12000), ('lowFrequency_explosion', 2, 0.9, -8, 0, 20, 300)],
  'thrust':   [('thrusterFire', 5, 0.8, 0, 0, 40, 9000)],
  'bolt':     [('explosionCrunch', 5, 1.1, 0, 0, 200, 14000), ('impactGlass_heavy', 5, 0.8, -7, 0, 400, 14000), ('lowFrequency_explosion', 2, 0.7, -2, 20, 15, 300)],
}
VARIANTS = {'collapse': 3, 'plasma': 3, 'thrust': 2, 'bolt': 3}
manifest = {}
for name, layers in R.items():
  n = VARIANTS.get(name, 4); manifest[name] = n
  for v in range(n):
    ins, chains = [], []
    for k, (g, cnt, rate, gain, delay, hp, lp) in enumerate(layers):
      ins += ['-i', f(g, v + k, cnt)]
      chains.append(f"[{k}:a]aformat=channel_layouts=mono,asetrate={int(44100 * rate)},aresample=44100,highpass=f={hp},lowpass=f={lp},volume={gain}dB,adelay={delay}:all=1[l{k}]")
    trim = ',atrim=0:1.6,afade=t=out:st=1.2:d=0.4' if name == 'thrust' else ''
    graph = ';'.join(chains) + ';' + ''.join(f'[l{k}]' for k in range(len(layers))) + f'amix=inputs={len(layers)}:normalize=0:duration=longest{trim},alimiter=limit=0.9[o]'
    wav = os.path.join(OUT, f'_{name}_{v}.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', graph, '-map', '[o]', '-ac', '1', wav], check=True)
    # peak-normalise to -1 dBFS
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    peak = float(re.search(r'max_volume: (-?[\d.]+) dB', r).group(1))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', f'volume={-1 - peak}dB,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-60dB', '-c:a', 'libmp3lame', '-b:a', '96k', os.path.join(OUT, f'{name}_{v}.mp3')], check=True)
    os.remove(wav)
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
print(manifest, sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT)) // 1024, 'KB')
