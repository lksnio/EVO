import Phaser from 'phaser';
import { type Ctx, ell, fillStroke, rgrad, tex, vgrad } from '../util/canvas';
import { W, H } from '../config';

// Symbole für Knöpfe und Anzeigen (weiß, damit sie eingefärbt werden können).

const S = 48;

function icon(scene: Phaser.Scene, key: string, draw: (ctx: Ctx) => void) {
  tex(scene, key, S, S, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    draw(ctx);
    ctx.restore();
  });
}

export function uiTextures(scene: Phaser.Scene) {
  icon(scene, 'ic_sound', (ctx) => {
    ctx.beginPath();
    ctx.moveTo(8, 19);
    ctx.lineTo(16, 19);
    ctx.lineTo(26, 10);
    ctx.lineTo(26, 38);
    ctx.lineTo(16, 29);
    ctx.lineTo(8, 29);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3.5;
    for (const r of [7, 13]) {
      ctx.beginPath();
      ctx.arc(27, 24, r, -0.9, 0.9);
      ctx.stroke();
    }
  });
  icon(scene, 'ic_mute', (ctx) => {
    ctx.beginPath();
    ctx.moveTo(8, 19);
    ctx.lineTo(16, 19);
    ctx.lineTo(26, 10);
    ctx.lineTo(26, 38);
    ctx.lineTo(16, 29);
    ctx.lineTo(8, 29);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(31, 18);
    ctx.lineTo(41, 30);
    ctx.moveTo(41, 18);
    ctx.lineTo(31, 30);
    ctx.stroke();
  });
  icon(scene, 'ic_pause', (ctx) => {
    ctx.fillRect(13, 10, 8, 28);
    ctx.fillRect(27, 10, 8, 28);
  });
  icon(scene, 'ic_play', (ctx) => {
    ctx.beginPath();
    ctx.moveTo(15, 9);
    ctx.lineTo(38, 24);
    ctx.lineTo(15, 39);
    ctx.closePath();
    ctx.fill();
  });
  icon(scene, 'ic_back', (ctx) => {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(28, 10);
    ctx.lineTo(14, 24);
    ctx.lineTo(28, 38);
    ctx.stroke();
  });
  icon(scene, 'ic_dna', (ctx) => {
    ctx.lineWidth = 3.5;
    for (const ph of [0, Math.PI]) {
      ctx.beginPath();
      for (let y = 6; y <= 42; y += 2) {
        const x = 24 + Math.sin(y * 0.17 + ph) * 11;
        if (y === 6) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 2.5;
    for (let y = 10; y <= 40; y += 6) {
      ctx.beginPath();
      ctx.moveTo(24 + Math.sin(y * 0.17) * 11, y);
      ctx.lineTo(24 + Math.sin(y * 0.17 + Math.PI) * 11, y);
      ctx.stroke();
    }
  });
  icon(scene, 'ic_map', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 12);
    ctx.lineTo(17, 8);
    ctx.lineTo(31, 13);
    ctx.lineTo(42, 9);
    ctx.lineTo(42, 36);
    ctx.lineTo(31, 40);
    ctx.lineTo(17, 35);
    ctx.lineTo(6, 39);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(17, 8);
    ctx.lineTo(17, 35);
    ctx.moveTo(31, 13);
    ctx.lineTo(31, 40);
    ctx.stroke();
  });
  icon(scene, 'ic_lock', (ctx) => {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(24, 20, 9, Math.PI, 0);
    ctx.stroke();
    ctx.fillRect(11, 20, 26, 20);
  });
  icon(scene, 'ic_check', (ctx) => {
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(10, 25);
    ctx.lineTo(20, 35);
    ctx.lineTo(38, 13);
    ctx.stroke();
  });
  icon(scene, 'ic_skull', (ctx) => {
    ell(ctx, 24, 20, 15, 14);
    ctx.fill();
    ctx.fillRect(15, 28, 18, 12);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ell(ctx, 18, 20, 4.5, 5);
    ctx.fill();
    ell(ctx, 30, 20, 4.5, 5);
    ctx.fill();
    for (const x of [19, 24, 29]) ctx.fillRect(x - 1, 33, 2, 7);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(6, 3);
    ctx.lineTo(15, 7);
    ctx.moveTo(38, 10);
    ctx.lineTo(42, 3);
    ctx.lineTo(33, 7);
    ctx.fill();
  });
  icon(scene, 'ic_star', (ctx) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? 8 : 18;
      ctx.lineTo(24 + Math.cos(a) * r, 25 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  icon(scene, 'ic_heart', (ctx) => {
    ctx.beginPath();
    ctx.moveTo(24, 40);
    ctx.bezierCurveTo(4, 26, 6, 8, 18, 9);
    ctx.bezierCurveTo(22, 9, 24, 13, 24, 15);
    ctx.bezierCurveTo(24, 13, 26, 9, 30, 9);
    ctx.bezierCurveTo(42, 8, 44, 26, 24, 40);
    ctx.closePath();
    ctx.fill();
  });
  icon(scene, 'ic_evo', (ctx) => {
    ctx.beginPath();
    ctx.moveTo(24, 4);
    ctx.lineTo(40, 14);
    ctx.lineTo(40, 34);
    ctx.lineTo(24, 44);
    ctx.lineTo(8, 34);
    ctx.lineTo(8, 14);
    ctx.closePath();
    ctx.fill();
  });
  icon(scene, 'ic_home', (ctx) => {
    ctx.beginPath();
    ctx.moveTo(6, 24);
    ctx.lineTo(24, 8);
    ctx.lineTo(42, 24);
    ctx.lineTo(36, 24);
    ctx.lineTo(36, 40);
    ctx.lineTo(12, 40);
    ctx.lineTo(12, 24);
    ctx.closePath();
    ctx.fill();
  });
  // farbige EVO-Anzeige
  tex(scene, 'evo_gem', 36, 40, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(33, 11);
    ctx.lineTo(33, 29);
    ctx.lineTo(18, 38);
    ctx.lineTo(3, 29);
    ctx.lineTo(3, 11);
    ctx.closePath();
    const g = ctx.createLinearGradient(3, 0, 33, 40);
    g.addColorStop(0, '#d8fcff');
    g.addColorStop(0.5, '#3ad0ff');
    g.addColorStop(1, '#a04aff');
    fillStroke(ctx, g, '#1a2a6a', 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', 18, 21);
  });
  tex(scene, 'heart_red', 36, 34, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(18, 31);
    ctx.bezierCurveTo(2, 20, 3, 4, 13, 4);
    ctx.bezierCurveTo(16, 4, 18, 7, 18, 9);
    ctx.bezierCurveTo(18, 7, 20, 4, 23, 4);
    ctx.bezierCurveTo(33, 4, 34, 20, 18, 31);
    ctx.closePath();
    fillStroke(ctx, rgrad(ctx, 13, 11, 1, 22, [[0, '#ff9a9a'], [1, '#d01a3a']]), '#6a0a1a', 2);
  });
  // Titelhintergrund
  tex(scene, 'title_bg', W, H, (ctx) => {
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#08203c'], [0.6, '#11466a'], [1, '#1a5a6a']]);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const x = (i * 197) % W, y = (i * 131) % 560, r = 30 + ((i * 53) % 90);
      ctx.fillStyle = rgrad(ctx, x, y, 0, r, [[0, i % 3 ? 'rgba(120,220,255,.12)' : 'rgba(255,220,120,.12)'], [1, 'rgba(0,0,0,0)']]);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (const ph of [0, Math.PI]) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) {
        const y = 300 + Math.sin(x * 0.012 + ph) * 46;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(140,230,255,.12)';
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    for (let x = 0; x <= W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 300 + Math.sin(x * 0.012) * 46);
      ctx.lineTo(x, 300 + Math.sin(x * 0.012 + Math.PI) * 46);
      ctx.strokeStyle = 'rgba(140,230,255,.07)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // Boden: links Wasser, Mitte Strand, rechts Wiese
    const gy = 600;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#1f78b0');
    g.addColorStop(0.28, '#2a90c8');
    g.addColorStop(0.36, '#e6d396');
    g.addColorStop(0.55, '#c8b070');
    g.addColorStop(0.7, '#6aae48');
    g.addColorStop(1, '#4a9a3a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= W; x += 40) ctx.quadraticCurveTo(x + 20, gy - 8, x + 40, gy);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, gy + 40, W, H - gy - 40);
    for (let x = 10; x < W * 0.33; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, gy + 14);
      ctx.quadraticCurveTo(x + 8, gy + 8, x + 16, gy + 14);
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}
