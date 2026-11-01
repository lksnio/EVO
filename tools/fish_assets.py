#!/usr/bin/env python3
"""Macht aus den gemalten Fischtexturen (art/EVO_fish_painted_v1) die Laufzeit-Bilder (src/assets/fish/painted/*.webp).

Die Bilder werden verkleinert (das Spiel braucht höchstens etwa 600 Pixel Breite für den Körper) und als WebP mit Alpha gespeichert.
Die Registrierung (welche Pixel des Bildes wohin im Vorlagenrahmen gehören) steht NICHT in den Bildern, sondern in
src/art/fish/painted.ts und bezieht sich auf die Pixel der Originale – deshalb steht hier der Verkleinerungsfaktor je Datei.
"""
import os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'art', 'EVO_fish_painted_v1', 'EVO_fish_painted_v1', 'textures')
DST = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'fish', 'painted')
SCALE = {'body': 0.6, 'jaw': 0.5, 'eye': 0.4, 'overlay': 0.5, 'dorsal': 0.5, 'anal': 0.5, 'pelvic': 0.4, 'pectoral': 0.5}

os.makedirs(DST, exist_ok=True)
for name, k in SCALE.items():
    im = Image.open(os.path.join(SRC, f'teil_{name}.png')).convert('RGBA')
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out = os.path.join(DST, f'{name}.webp')
    im.save(out, 'WEBP', quality=90, method=6)
    print(name, im.size, os.path.getsize(out) // 1024, 'KB')
