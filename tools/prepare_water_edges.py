"""Crop/resize generated source paintings; no runtime drawing or image generation."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=root/'art/EVO_water_edges_v1/source'
out=root/'src/assets/water'
out.mkdir(parents=True,exist_ok=True)
sky=Image.open(source/'sky.png').convert('RGB')
sky.resize((2048,683),Image.Resampling.LANCZOS).save(out/'sky.webp',quality=84)
wave=Image.open(source/'waterline.png').convert('RGBA')
b=wave.getchannel('A').point(lambda v: 255 if v > 180 else 0).getbbox()
print('wave alpha bounds',b)
wave.crop((0,b[1]-6,wave.width,b[3]+6)).resize((2048,132),Image.Resampling.LANCZOS).save(out/'waterline.webp',quality=88)
