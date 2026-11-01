"""Read-only manifest / PNG inspection. Run from anywhere; requires Pillow."""
from pathlib import Path
from PIL import Image
import hashlib,json
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'import/assets.json').read_text())
for item in data['assets']:
    file=root/item['file']
    assert hashlib.sha256(file.read_bytes()).hexdigest()==item['sha256'],file
    with Image.open(file) as im:
        assert im.mode=='RGBA',file
        assert list(im.size)==[item['width'],item['height']],file
        a=im.getchannel('A')
        amin,amax=a.getextrema()
        assert amin==0 and amax>=250,file
        box=a.point(lambda v:255 if v>=128 else 0).getbbox()
        assert list(box)==item['paintedBounds128'],file
    print('OK',item['file'])
print('Verified',len(data['assets']),'RGBA PNG assets. No runtime integration check.')
