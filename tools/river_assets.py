#!/usr/bin/env python3
"""Verified, repeatable runtime conversion. Preserve common cave framing and source art."""
import hashlib
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'art/EVO_laich_hoehle_wasser_v1/EVO_laich_hoehle_wasser_v1'
DST = ROOT / 'src/assets/river'
DST.mkdir(parents=True, exist_ok=True)
manifest = json.loads((SRC / 'import/assets.json').read_text())
selected = {'laich_nest_leer': 'nest', 'laich_ei_einzeln': 'egg', 'hoehle_hintergrund': 'cave_back', 'hoehle_vordergrund': 'cave_front'}
for entry in manifest['assets']:
    if entry['id'] not in selected:
        continue
    source = SRC / entry['file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry['sha256'], source
    im = Image.open(source).convert('RGBA')
    name = selected[entry['id']]
    if name.startswith('cave'):
        # Normalize entire canvases, never independently trim the two layers.
        im = im.resize((1008, 561), Image.Resampling.LANCZOS)
    else:
        im.thumbnail((710, 410), Image.Resampling.LANCZOS)
    im.save(DST / (name + '.webp'), 'WEBP', quality=92, method=6)
    print(name, im.size)
