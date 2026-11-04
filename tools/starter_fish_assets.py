"""Encode the 25 unchanged art masters as small transparent runtime WebPs.

Requires ffmpeg. Registration lives separately in starterRegistration.json;
source paintings are never overwritten. Run from anywhere in the checkout.
"""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parents[1]
registration = root / 'src/art/fish/starterRegistration.json'
output = root / 'src/assets/fish/starter'
output.mkdir(parents=True, exist_ok=True)
for form in json.loads(registration.read_text()):
    subprocess.run([
        'ffmpeg', '-v', 'error', '-y', '-threads', '1', '-filter_threads', '1',
        '-i', str(root / form['source']), '-vf', 'scale=768:-2',
        '-c:v', 'libwebp', '-q:v', '90', '-compression_level', '6',
        '-pix_fmt', 'yuva420p', '-frames:v', '1', str(output / (form['id'] + '.webp')),
    ], check=True)
print('Encoded 25 starter-fish forms; master PNGs unchanged.')
