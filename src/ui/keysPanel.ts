import Phaser from 'phaser';
import { W, H, FONT, TITLE_FONT, UI } from '../config';
import { audio } from '../audio/Audio';
import { BINDS, ESC, capture, isDefault, keysOf, keyName, resetKeys, setKey, type Bind } from '../state/keymap';
import { Button, text } from './ui';

// ---------------------------------------------------------------------------
// Die Seite „Steuerung“ (Titelbild, Rast im Spiel und auf der Karte): jede Handlung mit ihren zwei Tasten. Eine Taste
// anklicken (oder mit den Pfeiltasten anwählen und Eingabe drücken), dann die neue drücken – Entf leert sie, Esc bricht ab,
// ein Rechtsklick leert sie ebenfalls. Gehört die Taste schon einer anderen Handlung, wechselt sie hierher (das steht dann
// unten). „Grundbelegung“ stellt alles wieder her.
// ---------------------------------------------------------------------------

const SHEET = { w: 900, h: 650 };
const CHIP = { w: 138, h: 26 };
const ROW = 31;

interface Chip {
  b: Bind;
  slot: 0 | 1;
  x: number;
  y: number;
  g: Phaser.GameObjects.Graphics;
  t: Phaser.GameObjects.Text;
}

/**
 * Öffnet die Seite als Tafel über allem (Tiefe depth). Zu schließen mit „Fertig“, Esc oder durch Zerstören des
 * zurückgegebenen Containers; danach wird onClose aufgerufen.
 */
export function openKeys(scene: Phaser.Scene, depth: number, onClose: () => void) {
  const c = scene.add.container(0, 0).setDepth(depth);
  const x = (W - SHEET.w) / 2, y = (H - SHEET.h) / 2, cx = W / 2;
  const shade = scene.add.rectangle(0, 0, W, H, 0x010304, 0.8).setOrigin(0).setInteractive();
  const g = scene.add.graphics();
  g.fillStyle(0x05090a, 0.96);
  g.fillRoundedRect(x, y, SHEET.w, SHEET.h, 8);
  g.lineStyle(1, 0xc8913c, 0.35);
  g.strokeRoundedRect(x + 0.5, y + 0.5, SHEET.w - 1, SHEET.h - 1, 8);
  g.lineStyle(1, 0xc8913c, 0.55);
  g.lineBetween(cx - 54, y + 66, cx + 54, y + 66);
  c.add([shade, g]);
  c.add(scene.add.text(cx, y + 40, 'STEUERUNG', { fontFamily: TITLE_FONT, fontSize: '18px', color: UI.ochre, fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(10));
  c.add(text(scene, cx, y + 88, 'Eine Taste anklicken und die neue drücken  ·  Entf leert sie  ·  Esc bricht ab', 14, UI.boneDim).setOrigin(0.5).setAlpha(0.85));

  // Spaltenköpfe
  const x0 = x + 74, c1 = cx + 160, c2 = cx + 316;
  const head = (hx: number, s: string, origin = 0.5) =>
    c.add(scene.add.text(hx, y + 120, s, { fontFamily: TITLE_FONT, fontSize: '11px', color: UI.ochre, fontStyle: '700', resolution: 2 }).setOrigin(origin, 0.5).setLetterSpacing(4).setAlpha(0.8));
  head(x0, 'HANDLUNG', 0);
  head(c1, 'TASTE');
  head(c2, 'ZWEITE TASTE');

  const chips: Chip[] = [];
  const lines = scene.add.graphics();
  c.add(lines);
  BINDS.forEach((d, i) => {
    const ry = y + 152 + i * ROW;
    lines.lineStyle(1, 0xe6dcc4, 0.05);
    lines.lineBetween(x0 - 10, ry + ROW / 2, x + SHEET.w - 60, ry + ROW / 2);
    const label = text(scene, x0, ry, d.label, 18, UI.bone).setOrigin(0, 0.5);
    c.add(label);
    if (d.note) c.add(text(scene, x0 + label.width + 12, ry + 1, d.note, 14, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0, 0.5).setAlpha(0.8));
    for (const slot of [0, 1] as const) {
      const chip: Chip = { b: d.id, slot, x: slot ? c2 : c1, y: ry, g: scene.add.graphics(), t: scene.add.text(slot ? c2 : c1, ry, '', { fontFamily: TITLE_FONT, fontSize: '14px', color: UI.bone, fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(1) };
      c.add([chip.g, chip.t]);
      const zone = scene.add.zone(chip.x, ry, CHIP.w, CHIP.h + 2).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        hover = chips.indexOf(chip);
        audio.sfx('hover');
        draw();
      });
      zone.on('pointerout', () => {
        hover = -1;
        draw();
      });
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        focus = chips.indexOf(chip);
        if (p.rightButtonDown()) {
          stop();
          assign(chip, null);
        } else if (waiting === chip) stop(true);
        else start(chip);
      });
      c.add(zone);
      chips.push(chip);
    }
  });

  // unten: was gerade geschah, und die beiden Knöpfe
  const msg = text(scene, cx, y + SHEET.h - 88, '', 15, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5);
  c.add(msg);
  const reset = new Button(scene, cx - 130, y + SHEET.h - 44, 'Grundbelegung', { w: 230, h: 46, size: 17, sound: null, onClick: () => {
    stop();
    resetKeys();
    audio.sfx('confirm');
    say('Alle Tasten liegen wieder auf ihrem Platz.');
  } });
  const done = new Button(scene, cx + 130, y + SHEET.h - 44, 'Fertig', { w: 230, h: 46, size: 17, color: UI.ochreN, sound: 'back', onClick: () => c.destroy() });
  c.add([reset, done]);
  const buttons = [reset, done];

  let focus = -1, hover = -1;
  let waiting: Chip | undefined;
  let blink: Phaser.Tweens.Tween | undefined;

  function say(s: string, strong = false) {
    msg.setText(s).setColor(strong ? '#e2b876' : UI.boneDim).setAlpha(0);
    scene.tweens.add({ targets: msg, alpha: 1, duration: 200 });
  }
  const idle = () => say(isDefault() ? 'Auf dem Handy erscheinen Knöpfe auf dem Bildschirm.' : 'Die Belegung gilt sofort – auch im laufenden Spiel.');

  function draw() {
    chips.forEach((ch, i) => {
      const codes = keysOf(ch.b), code = codes[ch.slot];
      const on = waiting === ch, lit = on || i === focus || i === hover;
      ch.g.clear();
      ch.g.fillStyle(on ? 0x2a1c0c : 0x0d0c0b, on ? 1 : 0.9);
      ch.g.fillRoundedRect(ch.x - CHIP.w / 2, ch.y - CHIP.h / 2, CHIP.w, CHIP.h, 6);
      ch.g.lineStyle(on ? 1.6 : 1.2, 0xc8913c, on ? 1 : lit ? 0.85 : code ? 0.4 : 0.18);
      ch.g.strokeRoundedRect(ch.x - CHIP.w / 2 + 0.5, ch.y - CHIP.h / 2 + 0.5, CHIP.w - 1, CHIP.h - 1, 6);
      if (on) return void ch.t.setText('Taste drücken …').setFontFamily(TITLE_FONT).setColor('#f2c46e').setFontSize(13);
      // Pfeile in der Schrift des Fließtexts (in der Zierschrift sind sie winzig)
      const arrow = !!code && code >= 37 && code <= 40;
      ch.t.setText(code ? keyName(code) : '—').setFontFamily(arrow ? FONT : TITLE_FONT).setFontSize(arrow ? 19 : 14)
        .setColor(code ? (lit ? '#fff2d6' : UI.bone) : UI.boneDim).setAlpha(code ? 1 : 0.5);
    });
    buttons.forEach((b, k) => b.setFocus(focus === chips.length + k));
  }

  function start(ch: Chip) {
    stop();
    waiting = ch;
    capture.on = true;
    audio.sfx('select');
    const label = BINDS.find((d) => d.id === ch.b)!.label;
    say(`${label}: Welche Taste soll es ${ch.slot ? 'außerdem ' : ''}sein?`, true);
    draw();
    blink = scene.tweens.add({ targets: ch.t, alpha: 0.45, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** Das Warten auf eine Taste beenden (abgebrochen: mit leisem Ton). */
  function stop(cancelled = false) {
    if (!waiting) return;
    blink?.remove();
    blink = undefined;
    waiting.t.setAlpha(1);
    waiting = undefined;
    // erst nach diesem Tastendruck wieder frei geben – sonst wirkt er gleich noch im Spiel
    queueMicrotask(() => (capture.on = !!waiting));
    if (cancelled) {
      audio.sfx('back');
      idle();
    }
    draw();
  }

  function assign(ch: Chip, code: number | null) {
    const before = keysOf(ch.b)[ch.slot];
    const took = setKey(ch.b, ch.slot, code);
    const label = BINDS.find((d) => d.id === ch.b)!.label;
    if (code === null) {
      audio.sfx('click');
      say(before ? `${label}: ${ch.slot ? 'Zweite Taste' : 'Taste'} geleert.` : `${label} hat hier keine Taste.`);
    } else {
      audio.sfx('confirm');
      if (took) say(`${keyName(code)} gehörte bisher zu „${BINDS.find((d) => d.id === took)!.label}“ – jetzt: ${label}.`, true);
      else say(`${label}: ${keysOf(ch.b).map(keyName).join(' oder ')}`);
    }
    draw();
  }

  const onKey = (e: KeyboardEvent) => {
    if (waiting) {
      e.preventDefault?.();
      const ch = waiting;
      if (e.keyCode === ESC) return stop(true);
      stop();
      assign(ch, e.keyCode === 46 || e.keyCode === 8 ? null : e.keyCode);
      return;
    }
    if (e.keyCode === ESC) return c.destroy();
    // anwählen: Pfeiltasten – auf und ab durch die Zeilen, links und rechts zwischen den Spalten
    const n = chips.length, total = n + buttons.length;
    const move = (to: number) => {
      focus = Phaser.Math.Clamp(to, 0, total - 1);
      audio.sfx('click');
      draw();
    };
    const cur = focus < 0 ? 0 : focus;
    if (e.keyCode === 38) move(focus < 0 ? 0 : cur >= n ? n - 2 + (cur - n) : cur - 2);
    else if (e.keyCode === 40) move(focus < 0 ? 0 : cur >= n ? cur : cur + 2 >= n ? n + (cur % 2) : cur + 2);
    else if (e.keyCode === 37) move(focus < 0 ? 0 : cur >= n ? n : cur - (cur % 2));
    else if (e.keyCode === 39) move(focus < 0 ? 1 : cur >= n ? n + 1 : cur - (cur % 2) + 1);
    else if ((e.keyCode === 13 || e.keyCode === 32) && focus >= 0) {
      if (focus < n) start(chips[focus]);
      else buttons[focus - n].click();
    }
  };
  const kb = scene.input.keyboard!;
  kb.on('keydown', onKey);
  // ein Klick daneben bricht das Warten ab
  shade.on('pointerdown', () => stop(true));
  c.once('destroy', () => {
    kb.off('keydown', onKey);
    blink?.remove();
    waiting = undefined;
    capture.on = false;
    onClose();
  });

  idle();
  draw();
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 200 });
  audio.sfx('open');
  return c;
}
