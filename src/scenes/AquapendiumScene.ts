import Phaser from 'phaser';
import { W, H, FONT, TITLE_FONT } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import { ENTRIES, MAXES, DIET_TEXT, LAYER_TEXT, ROLE_TEXT, herdText, lengthText, placesText, type Entry } from '../data/aquapendium';
import { makeSpeciesPortrait } from '../art/speciesArt';
import { tex, type Ctx } from '../util/canvas';
import { mulberry32 } from '../util/math';
import { Button, fadeIn, fadeTo } from '../ui/ui';

// ---------------------------------------------------------------------------
// Das Aquapendium – ein Buch mit einer Seite für jedes Tier der Urmeere. Außerhalb des Spiels, wie der Stammbaum.
// Links das Bild, rechts der Steckbrief. Wer ein Tier noch nie gesehen hat, sieht nur seinen schwarzen Umriss.
// Eigene Bilder: PNG/WebP/JPG mit dem Namen der Art (z. B. "pteraspis.png") in src/assets/aquapendium/ ablegen.
// ---------------------------------------------------------------------------

const IMAGES = import.meta.glob('../assets/aquapendium/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const imageUrl = (id: string) => {
  for (const [path, url] of Object.entries(IMAGES)) {
    const name = (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '').toLowerCase();
    if (name === id) return url;
  }
  return undefined;
};

const INK = '#2a1a0e';
const INK_SOFT = '#6a5236';
const INK_RED = '#7a2a20';

// Buchmaße
const PX = 88, PY = 50, PW = 548, PH = 620;
const LEFT = PX, RIGHT = PX + PW + 8;
const FRAME = { x: 44, y: 64, w: 460, h: 370 };

export class AquapendiumScene extends Phaser.Scene {
  private page = 0;
  private cur?: Phaser.GameObjects.Container;
  private busy = false;
  private prev!: Button;
  private next!: Button;
  private wheelAt = 0;
  private pending = new Set<string>();
  private pictures = new Map<string, Phaser.GameObjects.Image>();
  private swipe?: { x: number; t: number };

  constructor() {
    super('Aquapendium');
  }

  init(d: { page?: number }) {
    this.page = Math.max(0, Math.min(ENTRIES.length, d?.page ?? 0));
    this.cur = undefined;
    this.busy = false;
    this.pending = new Set();
    this.pictures = new Map();
  }

  create() {
    fadeIn(this, 800);
    audio.music('generation');
    audio.sfx('tablet');
    this.cameras.main.setBackgroundColor('#070605');
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.9);
    this.drawBook();

    this.prev = new Button(this, 40, H / 2, '‹', { w: 52, h: 96, size: 40, onClick: () => this.flip(-1), sound: null });
    this.next = new Button(this, W - 40, H / 2, '›', { w: 52, h: 96, size: 40, onClick: () => this.flip(1), sound: null });
    new Button(this, 150, 22, 'Titelbild', { w: 190, h: 34, size: 16, icon: 'ic_home', onClick: () => fadeTo(this, 'Title') });
    new Button(this, W - 150, 22, 'Inhalt', { w: 190, h: 34, size: 16, onClick: () => this.go(0) });

    const kb = this.input.keyboard!;
    for (const k of ['LEFT', 'A', 'PAGE_UP']) kb.on(`keydown-${k}`, () => this.flip(-1));
    for (const k of ['RIGHT', 'D', 'PAGE_DOWN', 'SPACE']) kb.on(`keydown-${k}`, () => this.flip(1));
    for (const k of ['HOME', 'I']) kb.on(`keydown-${k}`, () => this.go(0));
    kb.on('keydown-END', () => this.go(ENTRIES.length));
    kb.on('keydown-ESC', () => fadeTo(this, 'Title'));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.time.now < this.wheelAt) return;
      this.wheelAt = this.time.now + 260;
      this.flip(dy > 0 ? 1 : -1);
    });
    // Wischen
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.swipe = { x: p.x, t: this.time.now }));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const s = this.swipe;
      this.swipe = undefined;
      if (s && this.time.now - s.t < 500 && Math.abs(p.x - s.x) > 110) this.flip(p.x < s.x ? 1 : -1);
    });

    this.show(this.page, 0);
  }

  // ---------------------------------------------------------------- Blättern

  private flip(d: number) {
    this.go(this.page + d);
  }

  private go(to: number) {
    to = Math.max(0, Math.min(ENTRIES.length, to));
    if (to === this.page || this.busy) return;
    audio.sfx('click');
    const dir = to > this.page ? 1 : -1;
    this.page = to;
    this.show(to, dir);
  }

  private show(index: number, dir: number) {
    const old = this.cur;
    const c = this.add.container(0, 0);
    if (index === 0) this.contents(c);
    else this.entry(c, ENTRIES[index - 1]);
    this.cur = c;
    this.prev.setDisabled(index === 0).setAlpha(index === 0 ? 0.35 : 1);
    this.next.setDisabled(index === ENTRIES.length).setAlpha(index === ENTRIES.length ? 0.35 : 1);
    if (dir === 0 || !old) return;
    // Die Seite wird umgeschlagen: alte Seite gleitet weg, die neue kommt herein
    this.busy = true;
    c.setAlpha(0).setX(40 * dir);
    this.tweens.add({ targets: old, alpha: 0, x: -40 * dir, duration: 200, ease: 'Sine.in', onComplete: () => old.destroy() });
    this.tweens.add({ targets: c, alpha: 1, x: 0, duration: 260, delay: 120, ease: 'Sine.out', onComplete: () => (this.busy = false) });
  }

  // ---------------------------------------------------------------- Das Buch

  private drawBook() {
    const g = this.add.graphics();
    // Einband
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(PX - 26, PY - 22, PW * 2 + 8 + 52, PH + 52, 20);
    g.fillStyle(0x2b1a10, 1);
    g.fillRoundedRect(PX - 30, PY - 28, PW * 2 + 8 + 60, PH + 56, 18);
    g.lineStyle(2, 0x6a4a28, 0.7);
    g.strokeRoundedRect(PX - 27, PY - 25, PW * 2 + 8 + 54, PH + 50, 16);
    g.lineStyle(1, 0x000000, 0.5);
    g.strokeRoundedRect(PX - 18, PY - 16, PW * 2 + 8 + 36, PH + 32, 10);
    // Seitenstapel unten
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0xc9b78c : 0xb9a67a, 1);
      g.fillRect(PX + 4 + i * 2, PY + PH + i * 2, PW * 2 + 8 - 8 - i * 4, 3);
    }
    const key = this.pageTexture();
    this.add.image(LEFT, PY, key).setOrigin(0).setFlipX(true);
    this.add.image(RIGHT, PY, key).setOrigin(0);
    // Mittelfalz
    const s = this.add.graphics();
    s.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.45, 0, 0.45);
    s.fillRect(LEFT + PW - 34, PY, 34, PH);
    s.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.45, 0, 0.45, 0);
    s.fillRect(RIGHT, PY, 34, PH);
    s.fillStyle(0x1a0f08, 1);
    s.fillRect(LEFT + PW, PY, 8, PH);
  }

  /** Die Pergamentseite: warm, fleckig, zum Falz hin dunkler. */
  private pageTexture() {
    return tex(this, 'aqp_page', PW, PH, (ctx: Ctx, w, h) => {
      const r = mulberry32(11);
      const base = ctx.createLinearGradient(0, 0, w, 0);
      base.addColorStop(0, '#cdbb90');
      base.addColorStop(0.25, '#dccca4');
      base.addColorStop(1, '#d4c39a');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      // Flecken und Fasern
      for (let i = 0; i < 46; i++) {
        const x = r() * w, y = r() * h, rad = 20 + r() * 80;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const dark = r() < 0.6;
        g.addColorStop(0, dark ? 'rgba(110,80,36,0.07)' : 'rgba(255,248,220,0.07)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      ctx.globalAlpha = 0.07;
      for (let i = 0; i < 260; i++) {
        ctx.strokeStyle = r() < 0.5 ? '#5a3c18' : '#fff6dc';
        ctx.lineWidth = 0.6;
        const x = r() * w, y = r() * h, a = r() * 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * (4 + r() * 12), y + Math.sin(a) * (4 + r() * 12));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // dunkle Ränder
      const v = ctx.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, 'rgba(70,44,16,0.22)');
      v.addColorStop(0.08, 'rgba(70,44,16,0)');
      v.addColorStop(0.92, 'rgba(70,44,16,0)');
      v.addColorStop(1, 'rgba(70,44,16,0.26)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
      const e = ctx.createLinearGradient(w - 40, 0, w, 0);
      e.addColorStop(0, 'rgba(70,44,16,0)');
      e.addColorStop(1, 'rgba(70,44,16,0.28)');
      ctx.fillStyle = e;
      ctx.fillRect(w - 40, 0, 40, h);
      const f = ctx.createLinearGradient(0, 0, 60, 0);
      f.addColorStop(0, 'rgba(40,24,8,0.35)');
      f.addColorStop(1, 'rgba(40,24,8,0)');
      ctx.fillStyle = f;
      ctx.fillRect(0, 0, 60, h);
    });
  }

  // ---------------------------------------------------------------- Texte auf Pergament

  private ink(c: Phaser.GameObjects.Container, x: number, y: number, str: string, size: number, color = INK, o: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    const t = this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: '500', resolution: 2, ...o });
    c.add(t);
    return t;
  }

  private head(c: Phaser.GameObjects.Container, x: number, y: number, str: string, size: number, color = INK) {
    const t = this.add.text(x, y, str, { fontFamily: TITLE_FONT, fontSize: `${size}px`, color, fontStyle: '700', resolution: 2 });
    c.add(t);
    return t;
  }

  /** Eine Zierlinie mit kleiner Raute in der Mitte. */
  private rule(c: Phaser.GameObjects.Container, x: number, y: number, w: number) {
    const g = this.add.graphics();
    g.lineStyle(1.5, 0x6a5236, 0.7);
    g.lineBetween(x, y, x + w / 2 - 12, y);
    g.lineBetween(x + w / 2 + 12, y, x + w, y);
    g.fillStyle(0x6a5236, 0.85);
    g.beginPath();
    g.moveTo(x + w / 2, y - 5);
    g.lineTo(x + w / 2 + 6, y);
    g.lineTo(x + w / 2, y + 5);
    g.lineTo(x + w / 2 - 6, y);
    g.closePath();
    g.fillPath();
    c.add(g);
  }

  // ---------------------------------------------------------------- Inhalt

  private contents(c: Phaser.GameObjects.Container) {
    const seen = ENTRIES.filter((e) => game.hasSeen(e.id)).length;
    const n = ENTRIES.length;
    // linke Seite: Titel und Stand
    this.head(c, LEFT + PW / 2, PY + 96, 'AQUAPENDIUM', 44).setOrigin(0.5).setLetterSpacing(3);
    this.rule(c, LEFT + 80, PY + 140, PW - 160);
    this.ink(c, LEFT + PW / 2, PY + 172, 'Das Buch der Urmeere', 26, INK_SOFT, { fontStyle: 'italic' }).setOrigin(0.5);
    const big = this.add.text(LEFT + PW / 2, PY + 290, `${seen}`, { fontFamily: TITLE_FONT, fontSize: '110px', color: INK, fontStyle: '700', resolution: 2 }).setOrigin(0.5);
    c.add(big);
    this.ink(c, LEFT + PW / 2, PY + 368, `von ${n} Tieren gefunden`, 24, INK_SOFT).setOrigin(0.5);
    const bar = this.add.graphics();
    bar.fillStyle(0x2a1a0e, 0.18);
    bar.fillRoundedRect(LEFT + 90, PY + 410, PW - 180, 14, 7);
    bar.fillStyle(0x7a4a1c, 0.9);
    bar.fillRoundedRect(LEFT + 90, PY + 410, Math.max(10, (PW - 180) * (seen / n)), 14, 7);
    bar.lineStyle(1.2, 0x2a1a0e, 0.6);
    bar.strokeRoundedRect(LEFT + 90, PY + 410, PW - 180, 14, 7);
    c.add(bar);
    this.ink(c, LEFT + PW / 2, PY + 470, 'Jedes Tier, dem du im Spiel begegnest, bekommt\nhier seine Seite. Alle anderen Seiten zeigen nur\nden schwarzen Umriss.', 19, INK, { align: 'center', fontStyle: 'italic' }).setOrigin(0.5, 0);
    this.ink(c, LEFT + PW / 2, PY + PH - 44, '← → blättern  ·  Esc: zurück zum Titelbild', 16, INK_SOFT).setOrigin(0.5);

    // rechte Seite: Verzeichnis in zwei Spalten
    this.head(c, RIGHT + PW / 2, PY + 36, 'Inhalt', 28).setOrigin(0.5);
    this.rule(c, RIGHT + 60, PY + 62, PW - 120);
    const per = Math.ceil(n / 2), rowH = 25;
    ENTRIES.forEach((e, i) => {
      const col = Math.floor(i / per), row = i % per;
      const x = RIGHT + 34 + col * 252, y = PY + 82 + row * rowH;
      const known = game.hasSeen(e.id);
      const g = this.add.graphics();
      g.lineStyle(1.4, 0x2a1a0e, known ? 0.9 : 0.55);
      g.fillStyle(known ? 0x7a4a1c : 0x1a1008, known ? 0.9 : 0.85);
      g.fillCircle(x + 6, y + 11, 4.5);
      if (!known) g.strokeCircle(x + 6, y + 11, 4.5);
      c.add(g);
      this.ink(c, x + 20, y + 1, `${e.no}`.padStart(2, '0'), 15, INK_SOFT);
      const name = this.ink(c, x + 48, y, known ? e.def.name : '· · · · · · ·', 18, known ? INK : INK_SOFT, { fontStyle: known ? '700' : '500' });
      const hit = this.add.rectangle(x - 4, y - 1, 240, rowH, 0x7a4a1c, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        hit.setFillStyle(0x7a4a1c, 0.16);
        name.setColor('#7a2a20');
      });
      hit.on('pointerout', () => {
        hit.setFillStyle(0x7a4a1c, 0);
        name.setColor(known ? INK : INK_SOFT);
      });
      hit.on('pointerup', () => this.go(e.no));
      c.add(hit);
    });
  }

  // ---------------------------------------------------------------- Eine Tierseite

  private entry(c: Phaser.GameObjects.Container, e: Entry) {
    const known = game.hasSeen(e.id);
    const d = e.def;
    // ---- linke Seite: Bild
    const era = e.eras.length ? e.eras.join('  ·  ').toUpperCase() : '';
    this.ink(c, LEFT + PW / 2, PY + 30, era, 15, INK_SOFT, { fontStyle: '700' }).setOrigin(0.5).setLetterSpacing(3);
    const fx = LEFT + FRAME.x, fy = PY + FRAME.y;
    const fr = this.add.graphics();
    fr.fillStyle(0x6a4c20, 0.1);
    fr.fillRoundedRect(fx, fy, FRAME.w, FRAME.h, 6);
    fr.lineStyle(3, 0x2a1a0e, 0.85);
    fr.strokeRoundedRect(fx, fy, FRAME.w, FRAME.h, 6);
    fr.lineStyle(1, 0x2a1a0e, 0.55);
    fr.strokeRoundedRect(fx + 8, fy + 8, FRAME.w - 16, FRAME.h - 16, 3);
    c.add(fr);
    this.picture(c, e, known, fx + FRAME.w / 2, fy + FRAME.h / 2);
    const nameT = this.head(c, LEFT + PW / 2, PY + 470, known ? d.name : '???', known && d.name.length > 14 ? 30 : 36).setOrigin(0.5);
    void nameT;
    this.ink(c, LEFT + PW / 2, PY + 514, known ? e.latin : 'Noch unbekannt', 22, INK_SOFT, { fontStyle: 'italic' }).setOrigin(0.5);
    this.rule(c, LEFT + 110, PY + 552, PW - 220);
    this.ink(c, LEFT + PW / 2, PY + PH - 40, `– ${e.no} –`, 17, INK_SOFT).setOrigin(0.5);

    // ---- rechte Seite: Steckbrief
    const rx = RIGHT + 44;
    this.head(c, rx, PY + 22, 'Steckbrief', 26);
    const tag = known ? ROLE_TEXT[d.role].toUpperCase() : 'UNBEKANNT';
    const tt = this.ink(c, RIGHT + PW - 44, PY + 28, tag, 14, INK_RED, { fontStyle: '700' }).setOrigin(1, 0).setLetterSpacing(2);
    const tg = this.add.graphics();
    tg.lineStyle(1.5, 0x7a2a20, 0.8);
    tg.strokeRoundedRect(tt.x - tt.width - 8, tt.y - 4, tt.width + 16, tt.height + 8, 4);
    c.add(tg);
    this.rule(c, rx, PY + 66, PW - 88);

    const layer = d.crawl ? 'Kriecht am Grund' : d.art.t === 'jelly' ? 'Treibt im Wasser' : d.layer ? LAYER_TEXT[d.layer] : 'Überall im Wasser';
    const rows: [string, string][] = [
      ['Zeitalter', e.eras.join(', ') || '–'],
      ['Gelebt', `vor ca. ${e.ma} Mio. Jahren`],
      ['Länge', lengthText(e.cm)],
      ['Rolle', ROLE_TEXT[d.role]],
      ['Nahrung', DIET_TEXT[d.diet]],
      ['Lebensweise', herdText(d)],
      ['Lebensraum', layer],
      ['Häufig in', placesText(d)],
    ];
    rows.forEach(([k, v], i) => {
      const y = PY + 82 + i * 30;
      this.ink(c, rx, y + 2, k, 17, INK_SOFT, { fontStyle: 'italic' });
      if (known) this.ink(c, rx + 132, y, v, 19, INK, { fontStyle: '700', wordWrap: { width: PW - 88 - 132 } });
      else this.ink(c, rx + 132, y, '?', 19, INK_SOFT, { fontStyle: '700' });
    });

    // Werte aus dem Spiel
    this.head(c, rx, PY + 336, 'Werte', 22);
    this.rule(c, rx + 84, PY + 350, PW - 88 - 84);
    const stats: [string, number, number, string][] = [
      ['Lebenskraft', d.hp, MAXES.hp, `${d.hp}`],
      ['Biss', d.dmg, MAXES.dmg, d.dmg ? `${d.dmg}` : '–'],
      ['Stärke', d.power, MAXES.power, `${d.power}`],
      ['Tempo', d.speed, MAXES.speed, `${d.speed}`],
      ['Sinne', d.sense, MAXES.sense, d.sense ? `${d.sense}` : '–'],
    ];
    const bar = this.add.graphics();
    stats.forEach(([k, v, max, label], i) => {
      const y = PY + 370 + i * 28;
      this.ink(c, rx, y, k, 18, INK);
      const bx = rx + 132, bw = 230;
      bar.fillStyle(0x2a1a0e, 0.16);
      bar.fillRoundedRect(bx, y + 4, bw, 12, 6);
      if (known && v > 0) {
        bar.fillStyle(0x7a4a1c, 0.92);
        bar.fillRoundedRect(bx, y + 4, Math.max(8, bw * Math.sqrt(Math.min(1, v / max))), 12, 6);
      }
      bar.lineStyle(1, 0x2a1a0e, 0.55);
      bar.strokeRoundedRect(bx, y + 4, bw, 12, 6);
      this.ink(c, rx + PW - 88, y, known ? label : '?', 18, known ? INK : INK_SOFT, { fontStyle: '700' }).setOrigin(1, 0);
    });
    c.add(bar);

    this.rule(c, rx, PY + 524, PW - 88);
    const note = known ? e.note : 'Diese Seite ist noch leer. Begegne dem Tier im Spiel – dann füllen sich Bild, Name und Werte.';
    this.ink(c, rx, PY + 540, note, 17, known ? INK : INK_SOFT, { fontStyle: 'italic', wordWrap: { width: PW - 88 }, lineSpacing: 2 });
  }

  /** Das Bild des Tieres: ein eigenes Bild, wenn eines da ist, sonst der Platzhalter (das Tier aus dem Spiel). Unbekannte nur als Umriss. */
  private picture(c: Phaser.GameObjects.Container, e: Entry, known: boolean, cx: number, cy: number) {
    const maxW = FRAME.w - 40, maxH = FRAME.h - 50;
    const own = imageUrl(e.id);
    const place = (key: string, real: boolean) => {
      if (!c.active) return;
      const img = this.add.image(cx, cy - 6, key);
      const k = Math.min(maxW / img.width, maxH / img.height);
      img.setScale(real ? k : Math.min(k, 3.4));
      if (!known) img.setTint(0x120a05).setTintMode(Phaser.TintModes.FILL).setAlpha(0.96);
      c.add(img);
      this.pictures.set(e.id, img);
    };
    if (own) {
      const key = `aqpimg_${e.id}`;
      if (this.textures.exists(key)) place(key, true);
      else if (!this.pending.has(key)) {
        // erst der Platzhalter, dann das echte Bild, sobald es geladen ist
        this.pending.add(key);
        this.load.image(key, own);
        this.load.once(`filecomplete-image-${key}`, () => {
          this.pending.delete(key);
          this.pictures.get(e.id)?.destroy();
          if (this.cur === c || c.active) place(key, true);
        });
        this.load.start();
        place(makeSpeciesPortrait(this, e.def), false);
      } else place(makeSpeciesPortrait(this, e.def), false);
    } else {
      place(makeSpeciesPortrait(this, e.def), false);
      if (known) this.ink(c, cx, cy + FRAME.h / 2 - 28, 'Platzhalter – das Bild folgt', 14, INK_SOFT, { fontStyle: 'italic' }).setOrigin(0.5);
    }
    if (!known) {
      // Tinte, die den Umriss verdeckt: ein kleines Fragezeichen
      const q = this.add.text(cx, fy(cy, FRAME.h), '?', { fontFamily: TITLE_FONT, fontSize: '40px', color: '#7a5a3a', fontStyle: '700', resolution: 2 }).setOrigin(0.5).setAlpha(0.55);
      c.add(q);
    }
  }
}

/** Unten im Bildrahmen. */
const fy = (cy: number, h: number) => cy + h / 2 - 30;
