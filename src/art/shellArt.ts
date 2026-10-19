import Phaser from 'phaser';
import { ell, rgrad, tex } from '../util/canvas';

// Die Muschel: als Fund im Level, im Titelbild und in der Übersicht (Taste C). Sie soll kostbar aussehen: eine Wellhornschnecke
// aus Elfenbein mit gewölbten Windungen, feinen Nähten, zarten Bändern und einer perlmuttschimmernden Mündung mit goldenem Saum.

/** Die Muschel (fein gezeichnet, damit sie auch klein klar bleibt) und ihr kurzes Funkeln. */
export function shellTexture(scene: Phaser.Scene) {
  tex(scene, 'shell', 44, 48, (ctx) => {
    const OUT = 'rgba(92,58,48,0.95)';
    // flacher, weicher Schatten auf dem Boden
    ctx.fillStyle = rgrad(ctx, 22, 44.6, 0, 15, [[0, 'rgba(0,0,0,0.34)'], [1, 'rgba(0,0,0,0)']]);
    ell(ctx, 22, 44.6, 15, 3.3);
    ctx.fill();
    ctx.save();
    ctx.translate(21.5, 24);
    ctx.rotate(0.16);

    // Umriss einer Wellhornschnecke: gewölbte Windungen, die zur Spitze hin kleiner werden, unten die große Windung mit dem
    // Siphonalkanal; Nähte als kleine Einkerbungen
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(0, -21.5);
      ctx.quadraticCurveTo(-2.8, -19.4, -3, -16.6);
      ctx.lineTo(-2.6, -16);
      ctx.quadraticCurveTo(-6.2, -14, -6, -10.4);
      ctx.lineTo(-5.4, -9.8);
      ctx.quadraticCurveTo(-9.8, -7.4, -9.4, -2.6);
      ctx.lineTo(-8.8, -2);
      ctx.quadraticCurveTo(-14.4, 1.8, -12.8, 9.6);
      ctx.quadraticCurveTo(-11.4, 15, -5.4, 18.4);
      ctx.quadraticCurveTo(-2.4, 20.6, -0.6, 22.6);
      ctx.quadraticCurveTo(1.4, 22.2, 2.6, 19.4);
      ctx.quadraticCurveTo(10.6, 16.6, 12.6, 8.4);
      ctx.quadraticCurveTo(13.6, 1.2, 8.8, -2);
      ctx.lineTo(8.2, -2.6);
      ctx.quadraticCurveTo(9.6, -7.2, 5.6, -9.8);
      ctx.lineTo(5, -10.4);
      ctx.quadraticCurveTo(6.2, -14.2, 2.6, -16);
      ctx.lineTo(2.9, -16.6);
      ctx.quadraticCurveTo(2.8, -19.6, 0, -21.5);
      ctx.closePath();
    };
    // Elfenbein: links im Schatten, rechts warm, zur Spitze hin etwas dunkler
    body();
    const side = ctx.createLinearGradient(-13, 0, 13, 0);
    side.addColorStop(0, '#c4a27e');
    side.addColorStop(0.3, '#f4e6d0');
    side.addColorStop(0.58, '#fcf5e9');
    side.addColorStop(1, '#ddc09c');
    ctx.fillStyle = side;
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    const tip = ctx.createLinearGradient(0, -22, 0, 22);
    tip.addColorStop(0, 'rgba(170,108,74,0.6)');
    tip.addColorStop(0.32, 'rgba(170,108,74,0.06)');
    tip.addColorStop(0.85, 'rgba(120,80,60,0.05)');
    tip.addColorStop(1, 'rgba(120,80,60,0.3)');
    ctx.fillStyle = tip;
    ctx.fillRect(-15, -23, 30, 47);
    // zarte, rosenholzfarbene Spiralbänder – auf der großen Windung zwei
    const band = (y: number, w: number, a: number) => {
      ctx.strokeStyle = `rgba(188,118,106,${a})`;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(-w, y + w * 0.16);
      ctx.quadraticCurveTo(0, y + 1.6, w, y - w * 0.16);
      ctx.stroke();
    };
    band(-13.2, 5, 0.22);
    band(-6.4, 8, 0.22);
    band(2.2, 13, 0.24);
    band(8.6, 13, 0.2);
    band(14.2, 10, 0.16);
    // feine Anwachsstreifen, schräg über die Windungen
    ctx.strokeStyle = 'rgba(118,78,62,0.17)';
    ctx.lineWidth = 0.45;
    for (let i = 0; i < 30; i++) {
      const y = -19 + i * 1.3;
      const w = Math.min(12, 2.2 + (y + 21) * 0.42);
      const x = -w + (((i * 7) % 11) / 11) * w * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 1, y + 1.2, x + 0.5, y + 2.4);
      ctx.stroke();
    }
    // die Nähte zwischen den Windungen: eine feine dunkle Linie, darunter ein heller Grat
    const sutures: [number, number][] = [[-16.3, 2.8], [-10.1, 5.4], [-2.3, 8.8]];
    for (const [y, w] of sutures) {
      ctx.strokeStyle = 'rgba(104,66,52,0.8)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-w, y + w * 0.14);
      ctx.quadraticCurveTo(0, y + 1.5, w, y - w * 0.14);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,252,244,0.7)';
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(-w, y + 0.8 + w * 0.14);
      ctx.quadraticCurveTo(0, y + 2.3, w, y + 0.8 - w * 0.14);
      ctx.stroke();
    }
    // Glanzlicht: ein weicher, heller Streifen über die Wölbung
    const gl = ctx.createLinearGradient(-9, 0, -2, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.75)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.moveTo(-1.4, -18);
    ctx.quadraticCurveTo(-6, -6, -9.2, 11);
    ctx.quadraticCurveTo(-7, 12.6, -5, 11);
    ctx.quadraticCurveTo(-3, -4, 0.2, -17.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // feiner Umriss
    body();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // die Mündung: eine lange Öffnung an der großen Windung – innen Perlmutt in Rosa, Flieder und Silber
    const mouth = () => {
      ctx.beginPath();
      ctx.moveTo(3.2, -1.2);
      ctx.quadraticCurveTo(10.6, 1.6, 10.2, 8.6);
      ctx.quadraticCurveTo(9.6, 14.4, 3.4, 18.6);
      ctx.quadraticCurveTo(1.6, 12, 1.8, 5);
      ctx.quadraticCurveTo(2, 1.2, 3.2, -1.2);
      ctx.closePath();
    };
    mouth();
    ctx.fillStyle = rgrad(ctx, 4.4, 3.6, 0.4, 13, [[0, '#fff6f8'], [0.28, '#f4d2de'], [0.6, '#c8a0c2'], [1, '#6e4c68']]);
    ctx.fill();
    ctx.save();
    mouth();
    ctx.clip();
    // Perlmutt-Schimmer: zarte Farbsäume
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(140,210,232,0.3)';
    ctx.beginPath();
    ctx.moveTo(4, 0.6);
    ctx.quadraticCurveTo(8.4, 3.6, 8, 9.6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,150,0.26)';
    ctx.beginPath();
    ctx.moveTo(3.4, 2.4);
    ctx.quadraticCurveTo(6.8, 6.4, 5.2, 14);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // ein heller Lichtfleck innen
    ell(ctx, 4.6, 2.6, 1, 2.2, -0.35);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
    // die Außenlippe: ein feiner, goldener Saum
    ctx.beginPath();
    ctx.moveTo(3.2, -1.2);
    ctx.quadraticCurveTo(10.6, 1.6, 10.2, 8.6);
    ctx.quadraticCurveTo(9.6, 14.4, 3.4, 18.6);
    ctx.strokeStyle = '#d4ae62';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,242,206,0.85)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(3.6, -0.4);
    ctx.quadraticCurveTo(9.8, 2.2, 9.4, 8.6);
    ctx.stroke();
    // die Innenlippe: ein dunklerer Schatten an der Spindel
    ctx.strokeStyle = 'rgba(110,70,72,0.55)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(3.2, -1.2);
    ctx.quadraticCurveTo(1.6, 5, 2.4, 12);
    ctx.stroke();

    // die Spitze glänzt
    ell(ctx, -0.3, -18.6, 0.75, 1.5, 0.2);
    ctx.fillStyle = 'rgba(255,250,240,0.85)';
    ctx.fill();
    ctx.restore();
  }, 4);

  // ein Funkeln: vier feine Strahlen um einen hellen Kern
  tex(scene, 'shell_glint', 24, 24, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 12, 12, 0, 6, [[0, 'rgba(255,250,232,0.95)'], [1, 'rgba(255,240,200,0)']]);
    ctx.fillRect(0, 0, 24, 24);
    ctx.fillStyle = 'rgba(255,248,226,0.95)';
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      ctx.beginPath();
      ctx.moveTo(12 - dx * 11.5, 12 - dy * 11.5);
      ctx.lineTo(12 + dy * 0.9, 12 - dx * 0.9);
      ctx.lineTo(12 + dx * 11.5, 12 + dy * 11.5);
      ctx.lineTo(12 - dy * 0.9, 12 + dx * 0.9);
      ctx.closePath();
      ctx.fill();
    }
  }, 2);
}
