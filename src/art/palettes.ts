export interface Palette {
  name: string;
  base: number;
  belly: number;
  dark: number;
  accent: number;
  eye: number;
}

export const PALETTES: Palette[] = [
  { name: 'Ozeanblau', base: 0x3d8fd8, belly: 0xc6e6ff, dark: 0x183f66, accent: 0xffb547, eye: 0xffd23f },
  { name: 'Korallenrot', base: 0xe2573f, belly: 0xffd5bd, dark: 0x6e1f12, accent: 0xffd34d, eye: 0x7cf0ff },
  { name: 'Algengrün', base: 0x4fae4f, belly: 0xdaf5c6, dark: 0x1d4f1f, accent: 0xf4e05a, eye: 0xff7a3d },
  { name: 'Sandgelb', base: 0xe0b44a, belly: 0xfff0c2, dark: 0x6b4c12, accent: 0xd0542e, eye: 0x2fc58a },
  { name: 'Violett', base: 0x8d5ad6, belly: 0xe7d7ff, dark: 0x3a1d6e, accent: 0x5ee6c8, eye: 0xfff15e },
  { name: 'Nachtschwarz', base: 0x3c4150, belly: 0x9aa4b8, dark: 0x101218, accent: 0xe8484a, eye: 0xff4a4a },
  { name: 'Schneeweiß', base: 0xe6edf5, belly: 0xffffff, dark: 0x5f6f88, accent: 0x4aa6e8, eye: 0x3a7bd5 },
  { name: 'Gold', base: 0xf2c21b, belly: 0xfff4b8, dark: 0x7c5a00, accent: 0xff6a3d, eye: 0x52e3ff },
];
