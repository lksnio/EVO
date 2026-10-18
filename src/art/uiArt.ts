import Phaser from 'phaser';
import { type Ctx, ell, rgrad, tex, vgrad } from '../util/canvas';
import { mulberry32 } from '../util/math';
import { W, H } from '../config';
import { pattern } from './paint';

// Symbole für Knöpfe (hell, damit sie eingefärbt werden können) und der Titelhintergrund.

const S = 48;

function icon(scene: Phaser.Scene, key: string, draw: (ctx: Ctx) => void) {
  tex(scene, key, S, S, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = '#efe6d2';
    ctx.strokeStyle = '#efe6d2';
    draw(ctx);
    ctx.restore();
  });
}

export function uiTextures(scene: Phaser.Scene) {
  const speaker = (ctx: Ctx) => {
    ctx.beginPath();
    ctx.moveTo(8, 19);
    ctx.lineTo(16, 19);
    ctx.lineTo(26, 10);
    ctx.lineTo(26, 38);
    ctx.lineTo(16, 29);
    ctx.lineTo(8, 29);
    ctx.closePath();
    ctx.fill();
  };
  icon(scene, 'ic_sound', (ctx) => {
    speaker(ctx);
    ctx.lineWidth = 3.5;
    for (const r of [7, 13]) {
      ctx.beginPath();
      ctx.arc(27, 24, r, -0.9, 0.9);
      ctx.stroke();
    }
  });
  icon(scene, 'ic_mute', (ctx) => {
    speaker(ctx);
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
  icon(scene, 'ic_eye', (ctx) => {
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(5, 24);
    ctx.quadraticCurveTo(24, 6, 43, 24);
    ctx.quadraticCurveTo(24, 42, 5, 24);
    ctx.closePath();
    ctx.stroke();
    ell(ctx, 24, 24, 7, 7);
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
  // Krallenspuren als Zeichen für "geschafft"
  icon(scene, 'ic_claw', (ctx) => {
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(12 + i * 9, 8);
      ctx.quadraticCurveTo(16 + i * 9, 24, 12 + i * 9, 40);
      ctx.stroke();
    }
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
  });
  // drei kleine Fische: deine Gruppe (Schwarm rufen)
  icon(scene, 'ic_swarm', (ctx) => {
    for (const [x, y, s] of [[29, 13, 0.85], [17, 25, 1], [31, 35, 0.9]]) {
      ell(ctx, x, y, 8 * s, 4.6 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 6 * s, y);
      ctx.lineTo(x - 13 * s, y - 5 * s);
      ctx.lineTo(x - 13 * s, y + 5 * s);
      ctx.closePath();
      ctx.fill();
    }
  });
  icon(scene, 'ic_footprint', (ctx) => {
    ell(ctx, 24, 30, 9, 11);
    ctx.fill();
    for (const [x, y] of [[13, 14], [20, 9], [28, 9], [35, 14]]) {
      ell(ctx, x, y, 3.4, 4);
      ctx.fill();
    }
  });
  // Titelhintergrund: Tiefsee, schwaches Licht von oben
  tex(scene, 'title_bg2', W, H, (ctx) => {
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#0e2228'], [0.5, '#061216'], [1, '#020507']]);
    ctx.fillRect(0, 0, W, H);
    const r = mulberry32(42);
    for (let i = 0; i < 7; i++) {
      const x = 200 + r() * 900, w = 40 + r() * 80;
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.9);
      g.addColorStop(0, `rgba(170,220,210,${0.05 + r() * 0.05})`);
      g.addColorStop(1, 'rgba(170,220,210,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 0);
      ctx.lineTo(x + w / 2, 0);
      ctx.lineTo(x + w / 2 + 200, H * 0.9);
      ctx.lineTo(x - w / 2 + 120, H * 0.9);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 220; i++) {
      ell(ctx, r() * W, r() * H, 0.5 + r() * 1.2, 0.5 + r() * 1.2);
      ctx.fillStyle = `rgba(200,220,210,${0.05 + r() * 0.2})`;
      ctx.fill();
    }
    // Silhouetten von Felsen und Tang
    ctx.fillStyle = 'rgba(2,8,10,.95)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 140);
    for (let x = 0; x <= W; x += 80) ctx.quadraticCurveTo(x + 40, H - 120 - r() * 120, x + 80, H - 110 - r() * 60);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 14; i++) {
      const x = r() * W, ht = 160 + r() * 260;
      ctx.beginPath();
      ctx.moveTo(x, H);
      for (let y = H; y > H - ht; y -= 16) ctx.lineTo(x + Math.sin(y * 0.03 + i) * 12, y);
      ctx.strokeStyle = 'rgba(3,10,10,.95)';
      ctx.lineWidth = 6 + r() * 5;
      ctx.stroke();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pattern(ctx, 'grain', 1);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.fillStyle = rgrad(ctx, W / 2, H / 2, 200, 820, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.8)']]);
    ctx.fillRect(0, 0, W, H);
  });
  // Steintafel für Karten
  tex(scene, 'tablet', 220, 340, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(14, 4);
    ctx.lineTo(206, 8);
    ctx.quadraticCurveTo(218, 10, 216, 26);
    ctx.lineTo(214, 322);
    ctx.quadraticCurveTo(212, 336, 196, 336);
    ctx.lineTo(18, 334);
    ctx.quadraticCurveTo(4, 332, 4, 318);
    ctx.lineTo(6, 20);
    ctx.quadraticCurveTo(6, 4, 14, 4);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 0, 340, [[0, '#2c2924'], [1, '#141210']]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pattern(ctx, 'stone', 0.7);
    ctx.fillRect(0, 0, 220, 340);
    ctx.restore();
    ctx.strokeStyle = 'rgba(150,130,100,.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}
