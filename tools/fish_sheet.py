#!/usr/bin/env python3
"""
Erzeugt ein komplettes Bewegungs-Sprite-Sheet für EINEN Fisch (Vorlage zum Überzeichnen):

    art/vorlagen/tiere/cladoselache_sheet.svg   editierbar, Ebenen je Bild
    art/vorlagen/tiere/cladoselache_sheet.json  Raster, Reihen, Bilderzahl, Zeiten (das liest später das Spiel)
    (PNG-Auszüge entstehen separat: transparent + mit Raster/Beschriftung)

Jede Reihe ist eine Bewegung, jedes Bild eine fertige Pose (Körperwelle, Flossen, Kiefer) – es wird im Spiel
NICHT gedreht oder zusammengesetzt. Zellgröße 448 x 360, Körpermitte = Mittelpunkt der Zelle, Blick nach rechts.

ACHTUNG: überschreibt die Dateien in art/vorlagen/tiere – nicht aufrufen, wenn sie von Hand bearbeitet wurden.
"""
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import bite_sheets as bs  # noqa: E402

CELL_W, CELL_H = 448, 360
SCALE = 0.78                      # Fisch (480 breit) -> ca. 365 px in der Zelle
FISH_C = (240, 148)               # Körpermitte im Fisch-Koordinatensystem
OUT = os.path.join(os.path.dirname(__file__), '..', 'art', 'vorlagen', 'tiere')
NAME = 'cladoselache'
PAL = dict(back='#3d4952', mid='#5e6c76', belly='#c4ccc8', fin='#323c44', fin2='#7f8d95')

TAU = 2 * math.pi


# ----------------------------------------------------------------------------- Verformung

NUM = re.compile(r'[A-Za-z]|-?\d+(?:\.\d+)?')


def make_warp(amp=0.0, phase=0.0, curl=0.0, sx=1.0, wl=1.0):
    """Körperwelle (nach hinten zunehmend), Krümmung (Zucken/Ausholen) und Streckung/Stauchung."""
    X0 = 340.0

    def f(x, y):
        u = (X0 - x) / 300.0
        dy = amp * (max(0.0, u) ** 1.4) * math.sin(phase + u * 2.6 * wl)
        if u < 0:
            dy += -0.10 * amp * (-u) * math.sin(phase)
        c = (x - 240.0) / 230.0
        dy += curl * 46.0 * (c * c - 0.12)
        x2 = 240.0 + (x - 240.0) * sx * (1 - 0.05 * abs(curl))
        return x2, y + dy
    return f


def warp_d(d, f):
    toks = NUM.findall(d)
    out, i, prev_num = [], 0, False
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            out.append(t)
            prev_num = False
            i += 1
            continue
        x, y = float(toks[i]), float(toks[i + 1])
        i += 2
        nx, ny = f(x, y)
        out.append((' ' if prev_num else '') + f'{nx:.1f} {ny:.1f}')
        prev_num = True
    return ''.join(out)


def warp_svg(svg, f):
    svg = re.sub(r'(\sd=")([^"]*)(")', lambda m: m.group(1) + warp_d(m.group(2), f) + m.group(3), svg)
    svg = re.sub(r'cx="(-?[\d.]+)" cy="(-?[\d.]+)"', lambda m: 'cx="%.1f" cy="%.1f"' % f(float(m.group(1)), float(m.group(2))), svg)
    svg = re.sub(r'rotate\((-?[\d.]+) (-?[\d.]+) (-?[\d.]+)\)',
                 lambda m: 'rotate(%s %.1f %.1f)' % ((m.group(1),) + tuple(f(float(m.group(2)), float(m.group(3))))), svg)
    return svg


# ----------------------------------------------------------------------------- Posen

def P(**kw):
    base = dict(amp=0, phase=0, curl=0, sx=1, jaw=0, tail=0, pect=0, pelv=0, dors=0, shut=False, pitch=0, lunge=0, lift=0)
    base.update(kw)
    return base


def swim(n=8):
    out = []
    for i in range(n):
        a = TAU * i / n
        out.append(P(amp=15, phase=a, tail=13 * math.sin(a + 1.0), pect=16 * math.sin(a + 1.6), pelv=9 * math.sin(a + 2.0),
                     dors=3 * math.sin(a + 0.5), jaw=1.5 + 1.5 * math.sin(a)))
    return out


def sprint(n=6):
    out = []
    for i in range(n):
        a = TAU * i / n
        out.append(P(amp=22, phase=a, sx=1.035, tail=19 * math.sin(a + 1.0), pect=-24 + 5 * math.sin(a), pelv=-12, dors=-5, jaw=0))
    return out


def pitched(deg, n=6):
    out = []
    for i in range(n):
        a = TAU * i / n
        out.append(P(amp=12, phase=a, pitch=deg, tail=11 * math.sin(a + 1.0), pect=(-18 if deg > 0 else 20) + 7 * math.sin(a + 1.4),
                     pelv=7 * math.sin(a + 2.0), dors=2 * math.sin(a), jaw=1))
    return out


def idle(n=6):
    out = []
    for i in range(n):
        a = TAU * i / n
        out.append(P(amp=3.5, phase=a, tail=4 * math.sin(a + 1.0), pect=10 * math.sin(a + 1.0), pelv=5 * math.sin(a + 1.5),
                     dors=2 * math.sin(a), jaw=2 + 2 * (1 + math.sin(a)) / 2, lift=1.5 * math.sin(a)))
    return out


def eat():
    jaw = [0, 15, 26, 12, 0, 8]
    pit = [12, 16, 18, 14, 12, 13]
    lun = [0, 4, 8, 4, 0, 2]
    return [P(amp=4, phase=TAU * i / 6, pitch=pit[i], lunge=lun[i], jaw=jaw[i], pect=8 * math.sin(i), tail=3 * math.sin(i + 1)) for i in range(6)]


def bite():
    # Ausholen (3) – Vorstoß (2) – Zubeißen/Schütteln (1) – Erholen (2)
    lunge = [-10, -18, 6, 26, 32, 26, 12, 0]
    jaw = [10, 26, 50, 58, 22, 2, 0, 0]
    curl = [0.5, 1.0, -0.2, -0.5, -0.3, 0, 0.2, 0]
    sx = [0.97, 0.95, 1.02, 1.06, 1.05, 1.0, 0.99, 1.0]
    pect = [20, 30, -10, -25, -25, -10, 5, 0]
    tail = [8, 14, -6, -12, -8, 0, 4, 0]
    pitch = [0, -4, 0, 2, 2, -4, 1, 0]
    return [P(curl=curl[i], sx=sx[i], jaw=jaw[i], lunge=lunge[i], pect=pect[i], tail=tail[i], pitch=pitch[i], pelv=-pect[i] * 0.4, dors=pect[i] * -0.15)
            for i in range(8)]


def hurt():
    return [
        P(sx=0.94, curl=0.6, jaw=14, lunge=-14, shut=True, pect=20, tail=-8, pitch=-2),
        P(sx=0.92, curl=1.4, jaw=18, lunge=-8, shut=True, pect=30, pelv=14, tail=-18, pitch=-5),
        P(sx=0.96, curl=0.8, jaw=10, lunge=-3, shut=True, pect=14, tail=-8, pitch=-2),
        P(sx=0.99, curl=0.2, jaw=4, lunge=0, shut=False, pect=4, tail=-2),
    ]


# Reihe: (Name, Bilder, Beschreibung, Dauer je Bild in ms, Wiederholung, wann im Spiel)
ROWS = [
    ('schwimmen', swim(8), 'ruhiges Schwimmen, Körperwelle läuft von vorn nach hinten durch den Fisch', [100] * 8, True, 'normales Umherschwimmen'),
    ('schnell', sprint(6), 'Sprint: gestreckt, Flossen angelegt, kräftiger Schwanzschlag', [70] * 6, True, 'Flucht, Jagd, Anlauf'),
    ('tauchen', pitched(26, 6), 'Kopf nach unten geneigt (ca. 26°), schwimmt abwärts', [100] * 6, True, 'wenn der Fisch nach unten schwimmt'),
    ('steigen', pitched(-26, 6), 'Kopf nach oben geneigt (ca. 26°), schwimmt aufwärts', [100] * 6, True, 'wenn der Fisch nach oben schwimmt'),
    ('ruhen', idle(6), 'fast still: leichtes Schweben, Flossenfächeln, Kiemenatmen', [160] * 6, True, 'Ruhen, Lauern, Dösen am Grund'),
    ('fressen', eat(), 'Kopf senkt sich, schnappt kleine Happen (Algen, Fleisch)', [110] * 6, True, 'Fressen von Pflanzen und Fleischstücken'),
    ('beissen', bite(), 'Angriff: Ausholen (1–3), Vorstoß (4–5), Zubeißen (6), Erholen (7–8)', [140, 140, 120, 70, 70, 90, 120, 140], False, 'Biss auf ein anderes Tier'),
    ('zucken', hurt(), 'Treffer: zusammengezuckt, Auge zugekniffen, fängt sich wieder', [60, 80, 100, 120], False, 'wenn der Fisch verletzt wird'),
]


def frame_svg(p, idx):
    raw = bs.jaeger(p['jaw'], tail_rot=p['tail'], pect_rot=p['pect'], pelv_rot=p['pelv'], dors_rot=p['dors'], shut=p['shut'], stripes=False, pivs=False)
    raw = raw.replace('jg-clip-body', f'jg-clip-{idx}')
    raw = re.sub(r'id="(tail|fin-dorsal|fin-pelvic|fin-pectoral|fin-pectoral-far|body|head|jaw-lower|mouth-interior|teeth-lower|teeth-upper|eye)"',
                 lambda m: f'id="f{idx}-{m.group(1)}"', raw)
    f = make_warp(p['amp'], p['phase'], p['curl'], p['sx'])
    raw = warp_svg(raw, f)
    tx = CELL_W / 2 + p['lunge'] * SCALE
    ty = CELL_H / 2 + p['lift']
    return (f'<g transform="translate({tx:.1f} {ty:.1f}) rotate({p["pitch"]:.1f}) scale({SCALE})'
            f' translate({-FISH_C[0]} {-FISH_C[1]})">{raw}</g>')


def build():
    ncol = max(len(r[1]) for r in ROWS)
    W, H = CELL_W * ncol, CELL_H * len(ROWS)
    body, guides, labels = [], [], []
    idx = 0
    for ri, (name, poses, desc, dur, loop, use) in enumerate(ROWS):
        row = []
        for ci, p in enumerate(poses):
            idx += 1
            row.append(f'<g id="{name}-{ci + 1}" transform="translate({ci * CELL_W} {ri * CELL_H})">{frame_svg(p, idx)}</g>')
        body.append(f'<g id="reihe-{name}">' + ''.join(row) + '</g>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
           f'<title>{NAME} – Bewegungs-Sprite-Sheet</title>'
           f'<!-- {len(ROWS)} Reihen, Zelle {CELL_W}x{CELL_H}, Blick nach rechts, Körpermitte = Zellmitte. Reihen (oben nach unten): '
           + ', '.join(f'{r[0]} ({len(r[1])})' for r in ROWS) + ' -->'
           f'<defs>{bs.COMMON_DEFS}{bs.defs("jg", **PAL)}</defs>' + ''.join(body) + '</svg>')
    return svg, W, H, ncol


def raster_svg(svg_inner_doc, W, H, ncol):
    """Dasselbe mit dunklem Hintergrund, Raster, Mittenkreuz und Beschriftung (nur zum Orientieren)."""
    g = ['<rect width="100%" height="100%" fill="#1b2a30"/>']
    for ri, (name, poses, desc, dur, loop, use) in enumerate(ROWS):
        for ci in range(ncol):
            x, y = ci * CELL_W, ri * CELL_H
            has = ci < len(poses)
            g.append(f'<rect x="{x + 0.5}" y="{y + 0.5}" width="{CELL_W - 1}" height="{CELL_H - 1}" fill="{"none" if has else "#0d161a"}" stroke="#3b525b" stroke-width="1"/>')
            if has:
                cx, cy = x + CELL_W / 2, y + CELL_H / 2
                g.append(f'<path d="M{cx - 10} {cy}H{cx + 10}M{cx} {cy - 10}V{cy + 10}" stroke="#ff00aa" stroke-width="1.5" opacity="0.7"/>')
                g.append(f'<text x="{x + 8}" y="{y + 18}" font-family="sans-serif" font-size="14" fill="#9fb6bd">{name} {ci + 1}/{len(poses)}</text>')
    doc = svg_inner_doc
    head, rest = doc.split('</title>', 1)
    return head + '</title>' + ''.join(g) + rest


def main():
    os.makedirs(OUT, exist_ok=True)
    svg, W, H, ncol = build()
    with open(os.path.join(OUT, f'{NAME}_sheet.svg'), 'w', encoding='utf-8') as f:
        f.write(svg)
    with open(os.path.join(OUT, f'{NAME}_sheet_raster.svg'), 'w', encoding='utf-8') as f:
        f.write(raster_svg(svg, W, H, ncol))
    meta = {
        'tier': NAME,
        'zelle': [CELL_W, CELL_H],
        'ursprung': [CELL_W // 2, CELL_H // 2],
        'blick': 'rechts',
        'spalten': ncol,
        'hinweis': 'Jede Reihe = eine Bewegung, links nach rechts. Das Bild darf gleichmäßig größer sein (z. B. 2x oder 4x), Anordnung gleich lassen.',
        'reihen': [{'name': r[0], 'bilder': len(r[1]), 'beschreibung': r[2], 'dauer_ms': r[3], 'wiederholen': r[4], 'verwendung': r[5]} for r in ROWS],
    }
    with open(os.path.join(OUT, f'{NAME}_sheet.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print('geschrieben', os.path.normpath(OUT), f'{W}x{H}', sum(len(r[1]) for r in ROWS), 'Bilder')


if __name__ == '__main__':
    main()
