import type Phaser from 'phaser';
import registration from './starterRegistration.json';
import { starterId, validStarterForm } from '../../sim/starterFish';

export interface StarterRegistration {
  id: string; state: number[]; source: string; width: number; height: number; bounds: number[];
  eye: number[]; hinge: number[]; mouth: number[][]; skin: number;
  teeth: { box: number[]; polygon: number[][]; upper: boolean }[];
}
export const STARTER_REGISTRATION = registration as StarterRegistration[];
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
  for (let i=0;i<STARTER_REGISTRATION.length;i++) {
    const key = starterTexture(i), url = files[i];
    if (!scene.textures.exists(key) && !scene.textures.exists(starterBodyTexture(i))) scene.load.image(key, url);
  }
}
export function starterReady(scene: Phaser.Scene, form: number) {
  return validStarterForm(form) && (scene.textures.exists(starterTexture(form)) || scene.textures.exists(starterBodyTexture(form)));
}
