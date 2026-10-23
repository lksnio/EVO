import Phaser from 'phaser';
import { FONT, H, TITLE_FONT, W } from '../config';
import { audio } from '../audio/Audio';
import { capture } from '../state/keymap';
import { resetRetroSettings, retroSettings, setRetroSettings, type RetroSettings } from '../data/retro';
import { text } from './ui';

type NumericKey = Exclude<keyof RetroSettings, 'enabled'>;

interface SettingRow {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  value: Phaser.GameObjects.Text;
  minus: Control;
  plus: Control;
  y: number;
}

interface Control {
  setFocus(on: boolean): void;
  setLabel(label: string): void;
  setDisabled(disabled: boolean): void;
}

/**
 * A sharp HUD panel beside a visible portion of the world, so adjustments can be compared immediately.
 * The parent keeps Level paused and disables its own MenuNav until onClose runs.
 */
export function openRetroSettings(scene: Phaser.Scene, depth: number, onClose: () => void): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(depth);
  const x = 84, y = 42, w = 650, h = 636;
  const ink = 0x071326, cyan = 0x68eaff, amber = 0xffc66e;
  const bright = '#ecf8ff', dim = '#94b6c8';
  const beforeCapture = capture.on;
  capture.on = true;

  const backdrop = scene.add.rectangle(0, 0, W, H, 0x010510, 0.38).setOrigin(0).setInteractive();
  const plate = scene.add.rectangle(x, y, w, h, ink, 0.98).setOrigin(0).setStrokeStyle(1, cyan, 0.52).setInteractive();
  c.add([backdrop, plate]);
  const trim = scene.add.graphics();
  trim.fillStyle(cyan, 0.9).fillRect(x, y, 86, 3);
  trim.fillStyle(amber, 0.85).fillRect(x + w - 36, y + h - 3, 36, 3);
  trim.lineStyle(1, cyan, 0.2).lineBetween(x + 44, y + 108, x + w - 44, y + 108);
  c.add(trim);
  c.add(scene.add.text(x + 44, y + 44, 'BILD & STIL', {
    fontFamily: TITLE_FONT, fontSize: '27px', fontStyle: '700', color: bright, resolution: 2,
  }).setOrigin(0, 0.5).setLetterSpacing(4));
  c.add(text(scene, x + 44, y + 82, 'Deine Spielwelt im 16-Bit-Look. Das Interface bleibt scharf.', 16, dim).setOrigin(0, 0.5));
  c.add(text(scene, x + 44, y + 140, '16-Bit-Look', 20, bright).setOrigin(0, 0.5));

  let focus = 1;
  let closed = false;
  const rows: SettingRow[] = [];
  const drawing = scene.add.graphics();
  c.add(drawing);

  function button(cx: number, cy: number, bw: number, label: string, click: () => void, warm = false): Control {
    const group = scene.add.container(cx, cy);
    const bg = scene.add.rectangle(0, 0, bw, 44, 0x10243b, 1).setStrokeStyle(1, warm ? amber : cyan, 0.5);
    const t = scene.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: bw < 70 ? '25px' : '18px', fontStyle: '700', color: bright, resolution: 2,
    }).setOrigin(0.5);
    group.add([bg, t]);
    const hit = scene.add.zone(0, 0, bw, 46).setInteractive({ useHandCursor: true });
    group.add(hit);
    c.add(group);
    let selected = false, hover = false, disabled = false;
    const draw = () => {
      const lit = !disabled && (selected || hover);
      bg.setFillStyle(disabled ? 0x0a1727 : lit ? 0x1b3d53 : 0x10243b, 1).setStrokeStyle(lit ? 2 : 1, warm ? amber : cyan, disabled ? 0.15 : lit ? 1 : 0.45);
      t.setColor(lit ? (warm ? '#ffda99' : '#aaf5ff') : bright).setAlpha(disabled ? 0.3 : 1);
    };
    hit.on('pointerover', () => { hover = true; draw(); });
    hit.on('pointerout', () => { hover = false; draw(); });
    hit.on('pointerdown', () => {
      if (disabled || closed) return;
      audio.sfx('click');
      click();
    });
    return {
      setFocus: (on) => { selected = on; draw(); },
      setLabel: (label) => t.setText(label),
      setDisabled: (value) => { disabled = value; draw(); },
    };
  }

  const toggle = button(x + w - 112, y + 140, 136, '', () => {
    focus = 0;
    setRetroSettings({ enabled: !retroSettings.enabled });
    draw();
  });

  const specs: [NumericKey, string, number, number, number][] = [
    ['pixelSize', 'Pixelgröße', 1, 6, 1],
    ['contrast', 'Kontrast', 0.85, 1.5, 0.05],
    ['saturation', 'Farbintensität', 0.7, 1.8, 0.1],
    ['dither', 'Dithering', 0, 1, 0.1],
  ];
  specs.forEach(([key, label, min, max, step], i) => {
    const ry = y + 186 + i * 77;
    c.add(text(scene, x + 44, ry - 17, label, 19, bright).setOrigin(0, 0.5));
    const value = text(scene, x + w - 44, ry - 17, '', 17, '#ffc66e').setOrigin(1, 0.5);
    c.add(value);
    const minus = button(x + 66, ry + 18, 44, '−', () => adjust(i, -1));
    const plus = button(x + w - 66, ry + 18, 44, '+', () => adjust(i, 1));
    const row: SettingRow = { key, label, min, max, step, value, minus, plus, y: ry };
    rows.push(row);
    // Tapping or dragging the track is useful on touch screens as well as with a mouse.
    const track = scene.add.zone(x + w / 2, ry + 18, 436, 44).setInteractive({ useHandCursor: true });
    const setFromPointer = (p: Phaser.Input.Pointer) => {
      if (!retroSettings.enabled) return;
      focus = i + 1;
      const fraction = Phaser.Math.Clamp((p.x - (x + 107)) / 436, 0, 1);
      const n = Math.round((max - min) * fraction / step);
      setRetroSettings({ [key]: Math.min(max, min + n * step) });
      draw();
    };
    track.on('pointerdown', (p: Phaser.Input.Pointer) => { audio.sfx('click'); setFromPointer(p); });
    scene.input.setDraggable(track);
    track.on('drag', (p: Phaser.Input.Pointer) => setFromPointer(p));
    c.add(track);
  });

  const reset = button(x + 185, y + 538, 280, 'Standard wiederherstellen', () => {
    focus = 5;
    resetRetroSettings();
    draw();
  });
  const done = button(x + 488, y + 538, 236, 'Fertig', () => c.destroy(), true);
  c.add(text(scene, x + w / 2, y + 584, '↑ ↓ wählen · ← → ändern · Eingabe bestätigen · Esc zurück', 14, dim).setOrigin(0.5));
  c.add(text(scene, x + w / 2, y + 607, 'Änderungen gelten sofort und werden gespeichert.', 13, '#648ca8').setOrigin(0.5));

  function adjust(index: number, direction: number) {
    const r = rows[index];
    if (!r || !retroSettings.enabled) return;
    focus = index + 1;
    const next = Math.round((retroSettings[r.key] + direction * r.step) * 100) / 100;
    setRetroSettings({ [r.key]: Phaser.Math.Clamp(next, r.min, r.max) });
    draw();
  }

  function draw() {
    const enabled = retroSettings.enabled;
    toggle.setLabel(enabled ? 'AN' : 'AUS');
    toggle.setFocus(focus === 0);
    drawing.clear();
    rows.forEach((r, i) => {
      const value = retroSettings[r.key], selected = focus === i + 1;
      if (selected) drawing.fillStyle(cyan, enabled ? 0.065 : 0.025).fillRect(x + 32, r.y - 32, w - 64, 72);
      r.value.setText(r.key === 'pixelSize' ? `${value} px` : `${Math.round(value * 100)} %`).setAlpha(enabled ? 1 : 0.4);
      const bx = x + 107, by = r.y + 15, bw = 436;
      drawing.fillStyle(0x020914, 1).fillRect(bx, by, bw, 6);
      const f = Phaser.Math.Clamp((value - r.min) / (r.max - r.min), 0, 1);
      if (f > 0) drawing.fillStyle(selected ? amber : cyan, enabled ? 0.9 : 0.18).fillRect(bx, by, Math.round(bw * f), 6);
      const steps = Math.round((r.max - r.min) / r.step);
      drawing.lineStyle(1, cyan, enabled ? 0.22 : 0.08);
      for (let k = 0; k <= steps; k++) {
        const tx = Math.round(bx + bw * k / steps);
        drawing.lineBetween(tx, by + 9, tx, by + 12);
      }
      drawing.fillStyle(enabled ? 0xecf8ff : 0x526270, 1).fillRect(Math.round(bx + bw * f) - 3, by - 4, 6, 14);
      r.minus.setDisabled(!enabled || value <= r.min + 0.001);
      r.plus.setDisabled(!enabled || value >= r.max - 0.001);
      r.minus.setFocus(selected);
      r.plus.setFocus(selected);
    });
    reset.setFocus(focus === 5);
    done.setFocus(focus === 6);
  }

  const onKey = (e: KeyboardEvent) => {
    if (closed) return;
    const k = e.keyCode;
    if (![27, 37, 38, 39, 40, 13, 32].includes(k)) return;
    e.preventDefault();
    if (k === 27) { audio.sfx('back'); c.destroy(); return; }
    if (k === 38 || k === 40) {
      focus = (focus + (k === 38 ? -1 : 1) + 7) % 7;
      audio.sfx('click');
      draw();
      return;
    }
    if (k === 37 || k === 39) {
      if (focus >= 1 && focus <= 4) adjust(focus - 1, k === 37 ? -1 : 1);
      else if (focus >= 5) { focus = focus === 5 ? 6 : 5; draw(); }
      else { setRetroSettings({ enabled: !retroSettings.enabled }); draw(); }
      audio.sfx('click');
      return;
    }
    audio.sfx('confirm');
    if (focus === 6) c.destroy();
    else if (focus === 5) { resetRetroSettings(); draw(); }
    else if (focus === 0) { setRetroSettings({ enabled: !retroSettings.enabled }); draw(); }
    else adjust(focus - 1, 1);
  };
  const kb = scene.input.keyboard;
  kb?.on('keydown', onKey);
  c.once('destroy', () => {
    closed = true;
    kb?.off('keydown', onKey);
    // Keep the closing key inside this panel for the rest of its dispatch.
    queueMicrotask(() => { capture.on = beforeCapture; });
    onClose();
  });
  draw();
  audio.sfx('open');
  return c;
}
