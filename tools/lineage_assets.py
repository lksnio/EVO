"""Prepare the agreed player lineage paintings; original art masters are never modified.

Registrations are in normalised source coordinates. Mouth edges and dermal teeth
remain distinct so the renderer can close a painted open jaw without stretching
the trunk or moving upper fangs with the mandible.
"""
from pathlib import Path
import hashlib
import json
import math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull

ROOT = Path(__file__).resolve().parents[1]
# The v3 fang fish was explicitly reclassified as jaws one by the user.
FORMS = [
 ('transition', 'EVO_shore_base_v2/masters/shore_base_shortlegs.png', [.846,.532], [[.846,.532],[.876,.521],[.921,.528],[.965,.526],[.984,.513]], [[.846,.534],[.876,.527],[.921,.534],[.965,.533],[.984,.517]]),
 ('water', 'EVO_startfish_base_v2/masters/startfish_g0_f0_k0.png', [.845,.629], [[.845,.629],[.88,.592],[.92,.590],[.957,.585],[.969,.570]], [[.845,.632],[.88,.599],[.92,.597],[.957,.593],[.969,.575]]),
 ('water-bite-1', 'EVO_startfish_bite_tier2_v3/masters/startfish_g2_f0_k0.png', [.836,.596], [[.836,.596],[.87,.551],[.91,.507],[.955,.485],[.979,.470]], [[.836,.597],[.88,.620],[.93,.637],[.965,.636],[.971,.619]]),
 ('water-bite-2', 'EVO_startfish_bite_tier2_v4/masters/startfish_g2_f0_k0.png', [.786,.592], [[.786,.592],[.825,.530],[.875,.477],[.935,.442],[.973,.428]], [[.786,.594],[.825,.660],[.875,.727],[.925,.770],[.950,.754]]),
 ('water-skull-1', 'EVO_startfish_skull_tier1_v2/masters/startfish_g0_f0_k1.png', [.851,.630], [[.851,.630],[.885,.601],[.93,.596],[.962,.591],[.973,.576]], [[.851,.634],[.885,.608],[.93,.603],[.962,.599],[.973,.581]]),
 ('water-skull-2', 'EVO_startfish_skull_tier2_v2/masters/startfish_g0_f0_k2.png', [.855,.633], [[.855,.633],[.88,.610],[.924,.607],[.966,.600],[.979,.583]], [[.855,.637],[.88,.617],[.924,.614],[.966,.608],[.979,.589]]),
 ('shore', 'EVO_shore_base_v1/masters/shore_base.png', [.844,.547], [[.844,.547],[.870,.526],[.910,.531],[.956,.531],[.982,.511]], [[.844,.550],[.870,.534],[.910,.539],[.956,.539],[.982,.516]]),
 ('shore-bite-1', 'EVO_shore_bite1_legs2_v1/masters/shore_bite1_legs2.png', [.851,.545], [[.851,.545],[.880,.525],[.925,.510],[.962,.505],[.981,.498]], [[.851,.549],[.885,.558],[.930,.574],[.968,.565],[.977,.550]]),
 ('shore-bite-2', 'EVO_shore_bite_tier3_v1/masters/shore_bite_tier3.png', [.782,.538], [[.782,.538],[.825,.500],[.88,.472],[.94,.449],[.985,.431]], [[.782,.541],[.825,.570],[.88,.605],[.94,.613],[.969,.591]]),
 ('shore-skull-1', 'EVO_shore_skull_tier1_v2/masters/shore_skull_tier1.png', [.839,.573], [[.839,.573],[.870,.551],[.915,.551],[.959,.553],[.984,.534]], [[.839,.577],[.870,.559],[.915,.559],[.959,.561],[.984,.540]]),
 ('shore-skull-2', 'EVO_shore_skull_tier2_v1/masters/shore_skull_tier2_legs1.png', [.840,.578], [[.840,.578],[.867,.547],[.915,.550],[.959,.551],[.984,.530]], [[.840,.582],[.867,.555],[.915,.558],[.959,.559],[.984,.536]]),
]

# Golden teeth and reflective plates can be larger than the iris. Keep the colour
# component search local to the actual eye in each approved painting.
EYE_TARGETS = {
 'transition': (.910,.397), 'water': (.890,.438),
 'water-bite-1': (.900,.428), 'water-bite-2': (.879,.377),
 'water-skull-1': (.897,.450), 'water-skull-2': (.904,.484),
 'shore': (.910,.407), 'shore-bite-1': (.911,.400), 'shore-bite-2': (.874,.335),
 'shore-skull-1': (.901,.438), 'shore-skull-2': (.897,.434),
}

def eye_of(a, target):
 h,w,_ = a.shape
 r,g,b = [a[:,:,i].astype(float) for i in range(3)]
 yy,xx = np.mgrid[:h,:w]
 mask = (abs(xx/w-target[0])<.025)&(abs(yy/h-target[1])<.06)&(a[:,:,3]>200)&(r>105)&(g>75)&(b<105)&(r>g*1.03)&(g>b*1.25)
 labels,n = ndimage.label(mask)
 candidates=[]
 for i in range(1,n+1):
  ys,xs=np.where(labels==i)
  if len(xs)<14:continue
  x,y=xs.mean(),ys.mean();ww,hh=xs.max()-xs.min()+1,ys.max()-ys.min()+1
  if ww>75 or hh>70 or ww<8 or hh<6:continue
  score=len(xs)/(1+abs(ww/hh-1))
  candidates.append((score,x,y,ww,hh))
 if not candidates:raise ValueError('Cannot locate golden eye')
 _,x,y,ww,hh=max(candidates)
 radius=max(ww,hh)*.57
 sx,sy=int(x-radius*1.2),int(y+radius*1.4)
 rgb=a[max(0,min(h-1,sy)),max(0,min(w-1,sx)),:3]
 return [round(x/w,6),round(y/h,6),round(radius/w,6)], int(rgb[0])<<16|int(rgb[1])<<8|int(rgb[2])

def teeth_of(a, upper, lower):
 h,w,_=a.shape
 xs=np.arange(w)/w
 top=np.interp(xs,[p[0] for p in upper],[p[1] for p in upper])*h
 bot=np.interp(xs,[p[0] for p in lower],[p[1] for p in lower])*h
 yy,xx=np.mgrid[:h,:w]
 inside=(xx>upper[0][0]*w+4)&(xx<min(upper[-1][0],lower[-1][0])*w)&(yy>top[None,:]+3)&(yy<bot[None,:]-3)
 r,g,b=[a[:,:,i].astype(float) for i in range(3)]
 mask=inside&(a[:,:,3]>200)&(r>120)&(g>100)&(b>55)&((r+g+b)>385)
 labels,n=ndimage.label(mask)
 result=[]
 for i in range(1,n+1):
  component=labels==i;ys,x=np.where(component)
  if len(x)<12 or x.max()-x.min()>w*.13 or ys.max()-ys.min()<4:continue
  dilated=ndimage.binary_dilation(component,iterations=3)
  y2,x2=np.where(dilated)
  points=np.column_stack([x2,y2])
  hull=ConvexHull(points)
  polygon=[[round(float(p[0])/w,6),round(float(p[1])/h,6)] for p in points[hull.vertices]]
  # A hanging upper tooth meets the upper lip; a lower tooth meets the mandible.
  up=float(np.min(ys-top[x]));down=float(np.min(bot[x]-ys))
  result.append({'upper':up<=down,'polygon':polygon})
 return result

out=[]
for id,source,hinge,upper,lower in FORMS:
 master=ROOT/'art'/source
 image=Image.open(master).convert('RGBA')
 a=np.array(image);a[a[:,:,3]<8]=0
 original_size=image.size
 image=Image.fromarray(a).resize((1280,round(image.height*1280/image.width)),Image.Resampling.LANCZOS)
 a=np.array(image);a[a[:,:,3]<8]=0
 image=Image.fromarray(a)
 image.save(ROOT/'src/assets/lineage'/f'{id}.webp',quality=94,method=6,exact=True)
 eye,skin=eye_of(a,EYE_TARGETS[id])
 bounds=image.getchannel('A').point(lambda v:255 if v>=16 else 0).getbbox()
 width,height=image.size
 upper_delta=[(upper[-1][0]-hinge[0])*width,(upper[-1][1]-hinge[1])*height]
 lower_delta=[(lower[-1][0]-hinge[0])*width,(lower[-1][1]-hinge[1])*height]
 angle=max(0,math.atan2(lower_delta[1],lower_delta[0])-math.atan2(upper_delta[1],upper_delta[0]))
 teeth=teeth_of(a,upper,lower) if '-bite-' in id else []
 d={'id':id,'source':'art/'+source,'sourceSize':list(original_size),'sourceSha256':hashlib.sha256(master.read_bytes()).hexdigest(),'width':width,'height':height,'bounds':[round(bounds[0]/width,6),round(bounds[1]/height,6),round(bounds[2]/width,6),round(bounds[3]/height,6)],'eye':eye,'skin':skin,'hinge':hinge,'upperLip':upper,'lowerLip':lower,'paintAngle':round(angle,6),'teeth':teeth}
 out.append(d)
 print(id,'eye',eye,'gape',round(angle,3),'teeth',len(teeth),sum(t['upper'] for t in teeth))
(ROOT/'src/art/lineage/registration.json').write_text(json.dumps(out,indent=2)+'\n')
