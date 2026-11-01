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
# Zweiter Satz (art/im1–im4): Sonderzeichnungen für die Extremformen und das Maulinnere
EXTRA = {
    'body_kurz': ('im1.png', 0.65),   # kurz/massiger Körper (len −1, girth 1)
    'body_lang': ('im2.png', 0.65),   # lang/schlanker Körper (len 1, girth −1, swift 1)
    'mouth': ('im3.png', 0.3),        # Maulinnenraum (Rachen links dunkel, Gaumen rechts)
    'jaw_lang': ('im4.png', 0.3),     # langer Unterkiefer (starkes Gebiss)
}

os.makedirs(DST, exist_ok=True)
for name, k in SCALE.items():
    im = Image.open(os.path.join(SRC, f'teil_{name}.png')).convert('RGBA')
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out = os.path.join(DST, f'{name}.webp')
    im.save(out, 'WEBP', quality=90, method=6)
    print(name, im.size, os.path.getsize(out) // 1024, 'KB')

ART = os.path.join(os.path.dirname(__file__), '..', 'art')
for name, (f, k) in EXTRA.items():
    im = Image.open(os.path.join(ART, f)).convert('RGBA' if name != 'mouth' else 'RGB')
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out = os.path.join(DST, f'{name}.webp')
    im.save(out, 'WEBP', quality=88 if name == 'mouth' else 90, method=6)
    print(name, im.size, os.path.getsize(out) // 1024, 'KB')

# Dritter Satz: gemalter Kopfpanzer des Spielerfisches (art/EVO_player_head_armor_v1, geschlossene Basis ohne Augenöffnung)
ARMOR = os.path.join(ART, 'EVO_player_head_armor_v1', 'EVO_player_head_armor_v1', 'textures', 'kopfpanzer_basis.png')
im = Image.open(ARMOR).convert('RGBA')
im = im.resize((round(im.width * 0.5), round(im.height * 0.5)), Image.LANCZOS)
out = os.path.join(DST, 'armor.webp')
im.save(out, 'WEBP', quality=90, method=6)
print('armor', im.size, os.path.getsize(out) // 1024, 'KB')
