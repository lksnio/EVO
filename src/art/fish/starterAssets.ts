import type Phaser from 'phaser';
import registration from './starterRegistration.json';
import { starterId, validStarterForm, STARTER_FORMS, PAINTED_FORMS } from '../../sim/starterFish';

export interface StarterRegistration {
  id: string; state: number[]; source: string; width: number; height: number; bounds: number[];
  eye: number[]; hinge: number[]; mouth: number[][]; skin: number;
  teeth: { box: number[]; polygon: number[][]; upper: boolean }[];
}
const painted=registration as StarterRegistration[];
export function starterSourceForm(form:number) {
  if(form<PAINTED_FORMS.length)return form;
  const [g,,k]=STARTER_FORMS[form]??STARTER_FORMS[0];
  return Math.max(0,PAINTED_FORMS.findIndex(s=>s[0]===g&&s[1]===0&&s[2]===k));
}
export function starterFinForm(form:number) {
  const f=STARTER_FORMS[form]?.[1]??0;
  return f?3+f:0;
}
export const STARTER_REGISTRATION:StarterRegistration[]=STARTER_FORMS.map((state,i)=>{
  if(i<painted.length)return painted[i];
  const source=painted[starterSourceForm(i)],fin=painted[starterFinForm(i)];
  return {...source,id:starterId(i),state:[...state],bounds:[Math.min(source.bounds[0],fin.bounds[0]),Math.min(source.bounds[1],fin.bounds[1]),source.bounds[2],Math.max(source.bounds[3],fin.bounds[3])]};
});
const files = [
  new URL('../../assets/fish/starter/g0_f0_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g1_f0_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g2_f0_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g3_f0_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f1_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f2_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f3_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f0_k1.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f0_k2.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f0_k3.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g3_f1_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g3_f0_k1.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g1_f3_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f3_k1.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g1_f0_k3.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f1_k3.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g1_f1_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f1_k1.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g1_f0_k1.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g1_f2_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f2_k1.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g2_f1_k0.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g2_f0_k1.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g1_f0_k2.webp', import.meta.url).href,
  new URL('../../assets/fish/starter/g0_f1_k2.webp', import.meta.url).href,
];
export const starterTexture = (form: number) => 'starter_' + starterId(form);
export const starterBodyTexture = (form: number) => starterTexture(form) + '_body';
export const starterJawTexture = (form: number) => starterTexture(form) + '_jaw';
export function starterRegistration(form: number) {
  return STARTER_REGISTRATION[validStarterForm(form) ? form : 0];
}
export function preloadStarterFish(scene: Phaser.Scene) {
  for (let i=0;i<files.length;i++) {
    const key = starterTexture(i), url = files[i];
    if (!scene.textures.exists(key) && !scene.textures.exists(starterBodyTexture(i))) scene.load.image(key, url);
  }
}
export function starterReady(scene: Phaser.Scene, form: number) {
  const ready=(f:number)=>scene.textures.exists(starterTexture(f))||scene.textures.exists(starterBodyTexture(f));
  return validStarterForm(form) && (ready(form) || (form>=PAINTED_FORMS.length && ready(starterSourceForm(form)) && ready(starterFinForm(form))));
}
