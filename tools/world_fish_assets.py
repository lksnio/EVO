#!/usr/bin/env python3
"""Macht aus dem Assetpaket art/EVO_world_rayfins_part2_v1 die Laufzeit-Bilder der acht festen Weltfische (src/assets/fish/world/*.webp).

Jedes Bild wird auf die gemalte Fläche (Alpha >= 128 plus 8 Pixel Rand) zugeschnitten und auf eine Breite von höchstens 640 Pixeln
verkleinert (Körper) bzw. 420 Pixeln (Sonderteile). Was der Code zur Registrierung braucht, steht in src/art/fish/worldFish.json:
Zuschnitt (cx, cy) und Verkleinerung k je Datei – Pixel des Originals p ergeben Pixel q im Laufzeitbild als q = (p − c) · k.
"""
import json
import os
from PIL import Image

HERE = os.path.dirname(__file__)
PKG = os.path.join(HERE, '..', 'art', 'EVO_world_rayfins_part2_v1', 'EVO_world_rayfins_part2_v1')
DST = os.path.join(HERE, '..', 'src', 'assets', 'fish', 'world')
OUT = os.path.join(HERE, '..', 'src', 'art', 'fish', 'worldFish.json')
os.makedirs(DST, exist_ok=True)

assets = json.load(open(os.path.join(PKG, 'import', 'assets.json')))['assets']
out = {}
for a in assets:
    if a['role'] == 'full':
        continue  # die vollständigen Posen sind Vorlagen (Vergleich, Porträt), keine Laufzeitbilder des Rigs
    name = os.path.splitext(os.path.basename(a['file']))[0]
    im = Image.open(os.path.join(PKG, a['file'])).convert('RGBA')
    x0, y0, x1, y1 = a['paintedBounds128']
    pad = 8
    cx, cy = max(0, x0 - pad), max(0, y0 - pad)
    ex, ey = min(im.width, x1 + pad), min(im.height, y1 + pad)
    crop = im.crop((cx, cy, ex, ey))
    wmax = 640 if a['role'] == 'body' else 420
    k = min(1.0, wmax / max(crop.width, crop.height))
    crop = crop.resize((max(1, round(crop.width * k)), max(1, round(crop.height * k))), Image.LANCZOS)
    path = os.path.join(DST, name + '.webp')
    crop.save(path, 'WEBP', quality=90, method=6)
    out[name] = {'cx': cx, 'cy': cy, 'k': k, 'w': crop.width, 'h': crop.height, 'bounds': [x0, y0, x1, y1], 'role': a['role']}
    print(name, crop.size, os.path.getsize(path) // 1024, 'KB')
json.dump(out, open(OUT, 'w'), indent=1)
