import type { Layout, Morph } from '../creatureArt';
import { starterRegistration } from './starterAssets';

/** Original pixel registration → common game coordinates; fins keep their full silhouette. */
export function starterGeometry(form: number) {
  const r = starterRegistration(form);
  const width = 80 / Math.max(.5, r.bounds[2] - .25);
  return { r, width, height: width * r.height / r.width };
}
export function starterLayout(m: Morph): Layout {
  const { r, width, height } = starterGeometry(m.fishForm ?? 0), s = m.size;
  const x = (u: number) => (u - .55) * width;
  const y = (v: number) => (v - .54) * height;
  const hx=x(r.hinge[0]), hy=y(r.hinge[1]), tip=x(r.bounds[2]);
  const neck: [number,number] = [x(.74)*s,0];
  const er=r.eye[2]*width;
  const bite=r.bite??[hx-3,hy-7,tip-hx+12,20];
  return {
    s, land:false, bw:66*s, bh:32*s, neck, tail:[x(.25)*s,0],
    legF:[0,0],legB:[0,0],legLen:0,topY:-16*s,footY:16*s,halfW:33*s,
    hg:{L:tip-x(.74),H:32,mouthY:hy,hingeX:hx-x(.74),jawH:8,dome:0,snoutH:12,ex:x(r.eye[0])-x(.74),ey:y(r.eye[1]),er},
    bite:{x:bite[0]*s,y:bite[1]*s,w:bite[2]*s,h:bite[3]*s},
  };
}
