#!/usr/bin/env python3
"""Reproducible runtime copies; originals and anchor coordinates stay in art/."""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
RAY = ROOT / 'art/EVO_world_rayfins_part2_v1/EVO_world_rayfins_part2_v1'
ARMOR = ROOT / 'art/EVO_player_head_armor_v1/EVO_player_head_armor_v1'
DST = ROOT / 'src/assets/fish/fauna'
DST.mkdir(parents=True, exist_ok=True)
profiles = json.loads((RAY / 'import/species_profiles.json').read_text())['species']
meta = {}
for p in profiles:
    im = Image.open(RAY / p['body']).convert('RGBA')
    # Keep full source frame so original anchor pixels remain an exact coordinate system.
    alpha = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    bounds = alpha.getbbox()
    meta[p['id']] = dict(size=list(im.size), bounds=list(bounds), points=p['anchorHints']['points'])
    im.thumbnail((900, 600), Image.Resampling.LANCZOS)
    im.save(DST / (p['id'] + '.webp'), quality=92, method=6)
for name in ('gillicus_anal', 'protosphyraena_pectoral', 'xiphactinus_jaw', 'enchodus_fang'):
    im = Image.open(RAY / 'special_parts' / (name + '.png')).convert('RGBA')
    b = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    im = im.crop(b)
    im.thumbnail((500, 320), Image.Resampling.LANCZOS)
    im.save(DST / (name + '.webp'), quality=92, method=6)
im = Image.open(ARMOR / 'textures/kopfpanzer_basis.png').convert('RGBA')
im.thumbnail((700, 700), Image.Resampling.LANCZOS)
im.save(DST / 'head_armor.webp', quality=92, method=6)
(ROOT / 'src/art/fauna/registration.json').write_text(json.dumps(meta, indent=2) + '\n')
