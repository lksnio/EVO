from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
im=Image.open(root/'art/EVO_editor_units_v1/source.png')
parts={'ribbon':(15,0,430,640),'fan':(430,120,800,645),'branch':(800,175,1220,640),'tubes':(1230,150,1536,640),'pebble':(50,780,370,990),'stone':(430,660,750,990),'ledge':(760,790,1290,990),'shoots':(1280,655,1525,990)}
for name,box in parts.items():
 a=im.crop(box);b=a.getchannel('A').point(lambda v:255 if v>5 else 0).getbbox();a=a.crop(b);a.thumbnail((380,540),Image.Resampling.LANCZOS);a.save(root/f'src/assets/reef/units/{name}.webp',quality=88,method=5)
