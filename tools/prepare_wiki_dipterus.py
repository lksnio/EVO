"""Resize the generated encyclopedia painting for its book frame; keep the full composition."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
source = root / 'art/EVO_wiki_dipterus_v1/source/dipterus.png'
target = root / 'src/assets/aquapendium/dipterus.webp'
img = Image.open(source).convert('RGB')
img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
img.save(target, 'WEBP', quality=88, method=6)
print(f'{target.relative_to(root)}: {img.width}x{img.height}, {target.stat().st_size} bytes')
