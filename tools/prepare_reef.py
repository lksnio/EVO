"""Crop the generated modules and encode runtime WebPs. Requires Pillow; no repainting or alpha replacement."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/EVO_reef_direction_v1/source'
OUT = ROOT / 'src/assets/reef'
PARTS = [
    ('sandstone.png', 'roof', (18, 65, 1666, 475), 1200),
    ('sandstone.png', 'support_low', (20, 540, 680, 900), 580),
    ('sandstone.png', 'support_tall', (700, 475, 1235, 900), 500),
    ('sandstone.png', 'stones', (1250, 665, 1675, 900), 400),
    ('reef.png', 'kelp', (8, 0, 488, 830), 440),
    ('reef.png', 'coral', (505, 400, 1285, 830), 720),
    ('reef.png', 'frame', (1300, 0, 1875, 830), 540),
]
OUT.mkdir(parents=True, exist_ok=True)
for source, name, rect, max_width in PARTS:
    im = Image.open(SOURCE / source).crop(rect)
    x0, y0, x1, y1 = im.getchannel('A').point(lambda a: 255 if a > 5 else 0).getbbox()
    im = im.crop((max(0, x0 - 4), max(0, y0 - 4), min(im.width, x1 + 4), min(im.height, y1 + 4)))
    if im.width > max_width:
        im.thumbnail((max_width, 1500), Image.Resampling.LANCZOS)
    im.save(OUT / (name + '.webp'), quality=88, method=6)
material = Image.open(SOURCE / 'sediment.png').convert('RGB').resize((512, 512), Image.Resampling.LANCZOS)
material.save(OUT / 'sediment.webp', quality=86, method=6)
