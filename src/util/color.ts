export const rgbOf = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

export function css(c: number, a = 1) {
  const [r, g, b] = rgbOf(c);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

export function mix(a: number, b: number, t: number) {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  return (
    (Math.round(r1 + (r2 - r1) * t) << 16) |
    (Math.round(g1 + (g2 - g1) * t) << 8) |
    Math.round(b1 + (b2 - b1) * t)
  );
}

/** t > 0 hellt auf (Richtung Weiß), t < 0 dunkelt ab (Richtung Schwarz). */
export const shade = (c: number, t: number) => (t < 0 ? mix(c, 0x000000, -t) : mix(c, 0xffffff, t));

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
