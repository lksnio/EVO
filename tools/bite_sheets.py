#!/usr/bin/env python3
"""
Erzeugt die Biss-Sprite-Sheets der drei Entwicklungslinien als SVG:

    art/vorlagen/panzer_biss.svg         Panzerlinie  (Placodermen, Dunkleosteus-artig)
    art/vorlagen/jaeger_biss.svg         Jägerlinie   (Stachelhaie / frühe Haie)
    art/vorlagen/fleischflosser_biss.svg Fleischflosser (Eusthenopteron-artig)

Jedes Blatt: 5 Bilder nebeneinander, Maul geschlossen -> ganz offen, jedes Bild 480 x 300.
Alle Teile liegen in benannten Gruppen (tail, fin-dorsal, jaw-lower, head, ...), die Kiefer
drehen sich per transform um den Gelenkpunkt – so lässt sich alles in Inkscape & Co. bearbeiten.
Ähnliche Ankerpunkte (Kiefergelenk x≈340-352, Schwanzansatz x≈60-75, Schnauze x≈466) – damit sich Teile der
Linien später mischen lassen.
ACHTUNG: überschreibt die Dateien in art/vorlagen – nicht aufrufen, wenn die SVGs von Hand bearbeitet wurden.

Aufruf:  python3 tools/bite_sheets.py
"""
import math
import os
import re

CELL_W, CELL_H = 480, 300
FRAMES = 5
OUT = os.path.join(os.path.dirname(__file__), '..', 'art', 'vorlagen')

# gemeinsame Ankerpunkte (Bildkoordinaten, Blick nach rechts)
ANCHOR = {
    'snout': (466, 152),   # Schnauzenspitze
    'hinge': (340, 168),   # Kiefergelenk
    'tail_root': (66, 150),  # Schwanzansatz
}

INK = '#0c1112'


# ----------------------------------------------------------------------------- Geometrie

def _xy(p):
    return p[0], p[1]


def _sharp(p):
    return len(p) > 2 and p[2] == 's'


def _fmt(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def _handles(pts, i, closed, k):
    """Bezier-Anfasser (Catmull-Rom) für das Segment i -> i+1. Mit 's' markierte Punkte bleiben Ecken."""
    n = len(pts)
    p1, p2 = pts[i % n], pts[(i + 1) % n]
    if closed:
        p0, p3 = pts[(i - 1) % n], pts[(i + 2) % n]
    else:
        p0 = pts[i - 1] if i > 0 else p1
        p3 = pts[i + 2] if i + 2 < n else p2
    x1, y1 = _xy(p1)
    x2, y2 = _xy(p2)
    c1 = (x1, y1) if _sharp(p1) else (x1 + (p2[0] - p0[0]) * k, y1 + (p2[1] - p0[1]) * k)
    c2 = (x2, y2) if _sharp(p2) else (x2 - (p3[0] - p1[0]) * k, y2 - (p3[1] - p1[1]) * k)
    return c1, c2


def path(pts, closed=True, k=0.18):
    """Glatte Kurve durch die Punkte (Ecken mit dritter Angabe 's')."""
    n = len(pts)
    d = f'M{_fmt(pts[0][0])} {_fmt(pts[0][1])}'
    segs = n if closed else n - 1
    for i in range(segs):
        c1, c2 = _handles(pts, i, closed, k)
        p2 = pts[(i + 1) % n]
        d += f'C{_fmt(c1[0])} {_fmt(c1[1])} {_fmt(c2[0])} {_fmt(c2[1])} {_fmt(p2[0])} {_fmt(p2[1])}'
    return d + ('Z' if closed else '')


def sample(pts, per=8, closed=False, k=0.18):
    """Punkte entlang derselben Kurve (zum Platzieren von Zähnen & für das Maulinnere)."""
    n = len(pts)
    out = []
    segs = n if closed else n - 1
    for i in range(segs):
        c1, c2 = _handles(pts, i, closed, k)
        p1, p2 = _xy(pts[i % n]), _xy(pts[(i + 1) % n])
        for j in range(per):
            t = j / per
            u = 1 - t
            x = u ** 3 * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p2[0]
            y = u ** 3 * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p2[1]
            out.append((x, y))
    if not closed:
        out.append(_xy(pts[-1]))
    return out


def rot(p, ang, c):
    a = math.radians(ang)
    dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))


def poly(pts):
    return 'M' + 'L'.join(f'{_fmt(x)} {_fmt(y)}' for x, y in pts) + 'Z'


def along(line, t):
    """Punkt und Richtung bei Anteil t (0..1) der Länge einer Punktfolge."""
    seg = [math.dist(line[i], line[i + 1]) for i in range(len(line) - 1)]
    tot = sum(seg)
    s = t * tot
    for i, d in enumerate(seg):
        if s <= d or i == len(seg) - 1:
            u = 0 if d == 0 else min(1, s / d)
            x = line[i][0] + (line[i + 1][0] - line[i][0]) * u
            y = line[i][1] + (line[i + 1][1] - line[i][1]) * u
            dx, dy = (line[i + 1][0] - line[i][0]) / (d or 1), (line[i + 1][1] - line[i][1]) / (d or 1)
            return (x, y), (dx, dy)
        s -= d
    return line[-1], (1, 0)


def teeth(line, count, h0, h1, down, w=0.55, recurve=0.35, t0=0.06, t1=0.97, fill='url(#tooth)', skip=()):
    """Zahnreihe entlang einer Linie. line läuft von hinten (Gelenk) nach vorn (Spitze).
    h0 = Höhe hinten, h1 = Höhe vorn; down=True: Zähne zeigen nach unten (Oberkiefer)."""
    out = []
    for i in range(count):
        if i in skip:
            continue
        t = t0 + (t1 - t0) * (i / max(1, count - 1))
        (x, y), (dx, dy) = along(line, t)
        nx, ny = (-dy, dx) if down else (dy, -dx)   # Normale (bei Blick nach rechts: nach unten bzw. oben)
        if down and ny < 0:
            nx, ny = -nx, -ny
        if not down and ny > 0:
            nx, ny = -nx, -ny
        h = h0 + (h1 - h0) * (i / max(1, count - 1))
        bw = h * w * 1.15
        a = (x - dx * bw / 2 - nx * 1.5, y - dy * bw / 2 - ny * 1.5)
        b = (x + dx * bw / 2 - nx * 1.5, y + dy * bw / 2 - ny * 1.5)
        tip = (x + nx * h - dx * h * recurve, y + ny * h - dy * h * recurve)
        out.append(f'<path d="M{_fmt(a[0])} {_fmt(a[1])}L{_fmt(tip[0])} {_fmt(tip[1])}L{_fmt(b[0])} {_fmt(b[1])}Z" fill="{fill}" stroke="{INK}" stroke-width="0.9" stroke-linejoin="round"/>')
    return ''.join(out)


def fang(base, tip, w, fill='url(#tooth)'):
    """Ein einzelner großer Zahn von base nach tip."""
    dx, dy = tip[0] - base[0], tip[1] - base[1]
    d = math.hypot(dx, dy) or 1
    nx, ny = -dy / d, dx / d
    a = (base[0] + nx * w / 2, base[1] + ny * w / 2)
    b = (base[0] - nx * w / 2, base[1] - ny * w / 2)
    mid = ((base[0] + tip[0]) / 2 + nx * w * 0.12, (base[1] + tip[1]) / 2 + ny * w * 0.12)
    return (f'<path d="M{_fmt(a[0])} {_fmt(a[1])}Q{_fmt(mid[0] + nx * w * .1)} {_fmt(mid[1])} {_fmt(tip[0])} {_fmt(tip[1])}'
            f'Q{_fmt(mid[0] - nx * w * .3)} {_fmt(mid[1] - ny * w * .1)} {_fmt(b[0])} {_fmt(b[1])}Z" fill="{fill}" stroke="{INK}" stroke-width="1" stroke-linejoin="round"/>')


# ----------------------------------------------------------------------------- Bausteine

def defs(pref, back, mid, belly, fin, fin2, membrane=0.55):
    """Farbverläufe einer Linie (ids mit Präfix, damit sich die Blätter nicht beißen)."""
    return f'''
    <linearGradient id="{pref}-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{back}"/><stop offset="0.45" stop-color="{mid}"/><stop offset="1" stop-color="{belly}"/>
    </linearGradient>
    <linearGradient id="{pref}-fin" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{fin}"/><stop offset="1" stop-color="{fin2}" stop-opacity="{membrane}"/>
    </linearGradient>
    <linearGradient id="{pref}-fin-v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{fin}"/><stop offset="1" stop-color="{fin2}" stop-opacity="{membrane}"/>
    </linearGradient>
    <linearGradient id="{pref}-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.30"/><stop offset="0.35" stop-color="#ffffff" stop-opacity="0.07"/><stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
    </linearGradient>'''


COMMON_DEFS = f'''
    <linearGradient id="tooth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f1ead2"/><stop offset="1" stop-color="#b9ab86"/>
    </linearGradient>
    <radialGradient id="mouth" cx="0.1" cy="0.5" r="1">
      <stop offset="0" stop-color="#5e1b1d"/><stop offset="0.55" stop-color="#2c0d0f"/><stop offset="1" stop-color="#140607"/>
    </radialGradient>
    <radialGradient id="eye-iris" cx="0.4" cy="0.38" r="0.7">
      <stop offset="0" stop-color="#f3d27a"/><stop offset="0.6" stop-color="#c58d2c"/><stop offset="1" stop-color="#6d4310"/>
    </radialGradient>
    <radialGradient id="eye-red" cx="0.4" cy="0.38" r="0.7">
      <stop offset="0" stop-color="#ff9a6a"/><stop offset="0.55" stop-color="#d4452a"/><stop offset="1" stop-color="#5a1410"/>
    </radialGradient>'''


def eye(cx, cy, r, grad='eye-iris'):
    return (f'<g id="eye"><circle cx="{cx}" cy="{cy}" r="{r + 2}" fill="#0b0f10" opacity="0.55"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{grad})" stroke="{INK}" stroke-width="1.6"/>'
            f'<ellipse cx="{cx + r * 0.12}" cy="{cy}" rx="{r * 0.36}" ry="{r * 0.62}" fill="#070909"/>'
            f'<circle cx="{cx - r * 0.3}" cy="{cy - r * 0.38}" r="{r * 0.22}" fill="#fff" opacity="0.85"/></g>')


def mouth_interior(upper_line, jaw_top, jaw_back, throat, theta, hinge):
    """Dunkles Maulinnere zwischen Oberkiefer-Linie und (gedrehtem) Unterkiefer."""
    jt = [rot(p, theta, hinge) for p in reversed(jaw_top)]   # von der Spitze zurück zum Gelenk
    jb = [rot(p, theta, hinge) for p in jaw_back]
    pts = list(upper_line) + jt + jb + [throat]
    return f'<path d="{poly(pts)}" fill="url(#mouth)" stroke="{INK}" stroke-width="1.5" stroke-linejoin="round"/>'


def scales(clip_id, x0, x1, y0, y1, dx, dy, r, stroke='#0c1112', op=0.22):
    """Schuppenmuster (Bögen), auf den Körper beschnitten."""
    s = []
    row = 0
    y = y0
    while y < y1:
        x = x0 + (dx / 2 if row % 2 else 0)
        while x < x1:
            s.append(f'M{_fmt(x)} {_fmt(y - r)}Q{_fmt(x - r)} {_fmt(y)} {_fmt(x)} {_fmt(y + r)}')
            x += dx
        y += dy
        row += 1
    return f'<g clip-path="url(#{clip_id})"><path d="{"".join(s)}" fill="none" stroke="{stroke}" stroke-width="1.1" opacity="{op}"/></g>'


def pivots(items):
    """Ausgeblendete Ebene mit den Drehpunkten (Kiefer, Schwanz, Flossen) – beim Überarbeiten mitziehen!"""
    g = ''.join(f'<g id="gelenk-{n}"><circle cx="{x}" cy="{y}" r="5" fill="none" stroke="#ff00aa" stroke-width="1.5"/>'
                f'<path d="M{x - 8} {y}H{x + 8}M{x} {y - 8}V{y + 8}" stroke="#ff00aa" stroke-width="1.2"/></g>' for n, (x, y) in items.items())
    return f'<g id="gelenke" display="none">{g}</g>'


def far_fin(pref, d):
    """Brustflosse der abgewandten Körperseite: dunkler, etwas versetzt, hinter dem Körper."""
    return (f'<g id="fin-pectoral-far" transform="translate(16 -12)" opacity="0.8"><path d="{d}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="#000" opacity="0.28"/></g>')


# ----------------------------------------------------------------------------- Linie 1: Panzer

def panzer(theta):
    pref = 'pz'
    H = ANCHOR['hinge']
    P = (270, 108)                      # Drehpunkt des Kopfschilds (Nackengelenk)
    lift = theta * 0.16                 # das Kopfschild klappt beim Aufreißen etwas nach oben
    # Rumpf (hinter dem Schild)
    body = [(64, 146), (118, 134), (176, 121), (232, 111), (276, 108), (282, 160, 's'), (276, 202),
            (232, 212), (176, 204), (118, 184), (64, 156)]
    # Kopfschild + Oberkiefer (Hornschnabel)
    mline = [(466, 152, 's'), (446, 160), (410, 167), (372, 172), (340, 168)]
    head = [(268, 106, 's'), (298, 84), (340, 76, 's'), (392, 80), (432, 96, 's'), (454, 124), (468, 152, 's')] + mline[1:] + [(330, 196), (298, 210), (268, 200), (256, 150)]
    jaw_top = [(340, 168), (372, 172), (410, 167), (446, 160), (466, 152)]
    jaw = [(340, 168)] + jaw_top[1:] + [(470, 160, 's'), (448, 186), (412, 206), (372, 216), (338, 212), (322, 190)]
    jaw_back = [(338, 212), (322, 190)]
    upper_line = sample(mline[::-1], 6)   # vom Gelenk zur Spitze
    interior = mouth_interior(sample(mline[::-1], 6), sample(jaw_top, 6), jaw_back, (330, 196), theta, H)
    # Interior zusammen mit dem Kopf anheben
    tail = [(112, 141, 's'), (70, 146), (62, 124), (46, 94), (28, 62), (12, 30, 's'), (14, 76), (30, 118), (44, 148), (36, 176), (30, 208), (28, 240, 's'),
            (46, 206), (62, 178), (70, 156), (112, 159, 's')]
    dorsal = [(190, 118, 's'), (216, 84), (250, 72, 's'), (262, 108)]
    pelvic = [(150, 190, 's'), (128, 222), (104, 238, 's'), (126, 190), (148, 196)]
    pect = [(286, 190, 's'), (270, 226), (236, 258, 's'), (252, 214), (270, 188)]
    spine = [(292, 196, 's'), (296, 228), (294, 258, 's'), (284, 226)]
    up_t = sample(mline[::-1], 12)
    low_t = sample(jaw_top, 12)
    s = []
    s.append(f'<g id="tail"><path d="{path(tail, True, 0.2)}" fill="url(#{pref}-fin)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="M62 150 Q36 112 12 60 M62 152 Q36 190 28 240" fill="none" stroke="{INK}" stroke-width="1" opacity="0.35"/></g>')
    s.append(f'<g id="fin-dorsal"><path d="{path(dorsal, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/></g>')
    s.append(f'<g id="fin-pelvic"><path d="{path(pelvic, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/></g>')
    s.append(far_fin(pref, path(pect, True, 0.2)))
    s.append(f'<g id="body"><clipPath id="{pref}-clip-body"><path d="{path(body, True, 0.16)}"/></clipPath>'
             f'<path d="{path(body, True, 0.16)}" fill="url(#{pref}-body)" stroke="{INK}" stroke-width="2.6" stroke-linejoin="round"/>'
             f'<path d="{path(body, True, 0.16)}" fill="url(#{pref}-sheen)" opacity="0.55"/>'
             + scales(f'{pref}-clip-body', 70, 280, 112, 214, 17, 12, 7, op=0.2) + '</g>')
    # Schild-Gruppe (hebt sich), darin Maulinneres, Unterkiefer, Kopf
    s.append(f'<g id="head-group" transform="rotate({_fmt(-lift)} {P[0]} {P[1]})">')
    s.append(f'<g id="mouth-interior">{interior}</g>')
    s.append(f'<g id="jaw-lower" transform="rotate({_fmt(theta)} {H[0]} {H[1]})">'
             f'<path d="{path(jaw, True, 0.17)}" fill="url(#{pref}-body)" stroke="{INK}" stroke-width="2.6" stroke-linejoin="round"/>'
             f'<path d="{path(jaw, True, 0.17)}" fill="url(#{pref}-sheen)" opacity="0.5"/>'
             f'<path d="M352 176 Q392 196 440 178 M356 196 Q396 210 428 196" fill="none" stroke="{INK}" stroke-width="1.2" opacity="0.4"/>'
             + f'<g id="teeth-lower">' + teeth(low_t, 8, 6, 12, False, w=0.7) + fang((438, 160), (442, 128), 15) + '</g></g>')
    s.append(f'<g id="head"><path d="{path(head, True, 0.16)}" fill="url(#{pref}-body)" stroke="{INK}" stroke-width="2.8" stroke-linejoin="round"/>'
             f'<path d="{path(head, True, 0.16)}" fill="url(#{pref}-sheen)" opacity="0.6"/>'
             # Plattennähte des Schilds
             f'<path d="M300 90 Q318 130 312 176 M348 82 Q364 120 360 168 M404 94 Q398 128 372 168 M276 126 Q330 118 392 112 M286 164 Q340 156 400 158" fill="none" stroke="{INK}" stroke-width="1.6" opacity="0.5"/>'
             f'<path d="M262 150 Q272 118 300 96" fill="none" stroke="{INK}" stroke-width="2.2" opacity="0.55"/>'
             f'<path d="M296 110 Q340 96 392 104" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.18"/>'
             + f'<g id="teeth-upper">' + teeth(up_t, 8, 6, 12, True, w=0.7, skip=(7,)) + fang((438, 164), (446, 196), 15) + '</g>'
             + eye(396, 124, 11, 'eye-red') + '</g>')
    s.append('</g>')
    s.append(f'<g id="fin-pectoral"><path d="{path(pect, True, 0.2)}" fill="url(#{pref}-body)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="{path(spine, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="1.8" stroke-linejoin="round"/></g>')
    s.append(pivots({'kiefer': H, 'nacken': P, 'schwanz': (70, 148), 'brustflosse': (286, 192), 'bauchflosse': (140, 190), 'rueckenflosse': (232, 112)}))
    return ''.join(s)


# ----------------------------------------------------------------------------- Linie 2: Jäger

def jaeger(theta):
    pref = 'jg'
    H = ANCHOR['hinge']
    body = [(70, 147, 's'), (130, 132), (200, 116), (270, 108), (335, 110), (392, 121), (430, 136), (466, 152, 's'),
            (440, 158), (404, 163), (366, 166), (340, 168), (344, 196), (300, 205), (250, 207), (196, 199), (140, 184), (96, 168), (70, 154, 's')]
    mline = [(466, 152, 's'), (440, 158), (404, 163), (366, 166), (340, 168)]
    jaw_top = [(340, 168), (366, 166), (404, 163), (440, 158), (466, 152)]
    jaw = [(340, 168), (366, 166), (404, 163), (440, 158), (468, 154, 's'), (446, 175), (410, 188), (374, 196), (346, 198), (333, 184)]
    tail = [(114, 142, 's'), (74, 148), (66, 128), (50, 98), (30, 66), (12, 34, 's'), (10, 78), (22, 120), (40, 150), (22, 184), (10, 224), (14, 262, 's'),
            (32, 228), (50, 198), (66, 170), (74, 152), (114, 160, 's')]
    dorsal1 = [(214, 114, 's'), (238, 68), (292, 108, 's')]
    spine1 = [(212, 116, 's'), (234, 56, 's'), (241, 70), (222, 118)]
    dorsal2 = [(110, 134, 's'), (122, 98), (160, 124, 's')]
    spine2 = [(108, 135, 's'), (116, 88, 's'), (123, 98), (116, 138)]
    pelvic = [(198, 204, 's'), (180, 226), (166, 248, 's'), (206, 232), (236, 207, 's')]
    anal = [(126, 188, 's'), (108, 208), (92, 230, 's'), (126, 214), (160, 193, 's')]
    pect = [(300, 178, 's'), (332, 192), (268, 238, 's'), (268, 200)]
    up_t = sample(mline[::-1], 12)
    low_t = sample(jaw_top, 12)
    s = []
    s.append(f'<g id="tail"><path d="{path(tail, True, 0.2)}" fill="url(#{pref}-fin)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="M66 149 Q40 112 14 62 M66 151 Q40 190 18 240 M66 150 L30 150" fill="none" stroke="{INK}" stroke-width="1" opacity="0.35"/></g>')
    s.append(f'<g id="fin-dorsal"><path d="{path(dorsal2, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>'
             f'<path d="{path(spine2, True, 0.2)}" fill="#c9cfc2" stroke="{INK}" stroke-width="1.4" stroke-linejoin="round"/>'
             f'<path d="{path(dorsal1, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="{path(spine1, True, 0.2)}" fill="#c9cfc2" stroke="{INK}" stroke-width="1.6" stroke-linejoin="round"/></g>')
    s.append(f'<g id="fin-pelvic"><path d="{path(pelvic, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>'
             f'<path d="{path(anal, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/></g>')
    s.append(far_fin(pref, path(pect, True, 0.2)))
    s.append(f'<g id="mouth-interior">{mouth_interior(sample(mline[::-1], 6), sample(jaw_top, 6), [(346, 198), (333, 184)], (344, 196), theta, H)}</g>')
    s.append(f'<g id="jaw-lower" transform="rotate({_fmt(theta)} {H[0]} {H[1]})">'
             f'<path d="{path(jaw, True, 0.17)}" fill="url(#{pref}-body)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="{path(jaw, True, 0.17)}" fill="url(#{pref}-sheen)" opacity="0.5"/>'
             + f'<g id="teeth-lower">' + teeth(low_t, 11, 4, 9, False, w=0.6) + '</g></g>')
    s.append(f'<g id="body"><clipPath id="{pref}-clip-body"><path d="{path(body, True, 0.16)}"/></clipPath>'
             f'<path d="{path(body, True, 0.16)}" fill="url(#{pref}-body)" stroke="{INK}" stroke-width="2.6" stroke-linejoin="round"/>'
             f'<path d="{path(body, True, 0.16)}" fill="url(#{pref}-sheen)" opacity="0.55"/>'
             # Querbinden wie beim Stachelhai
             f'<g clip-path="url(#{pref}-clip-body)" fill="#1d2e36" opacity="0.28">'
             + ''.join(f'<path d="M{x} 100 Q{x + 14} 150 {x - 8} 215 L{x + 12} 215 Q{x + 34} 150 {x + 22} 100Z"/>' for x in (130, 168, 206, 244, 282))
             + '</g>'
             f'<path d="M96 138 Q250 120 400 138" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.16"/>'
             # Kiemenspalten
             f'<path d="M352 124 Q340 148 350 176 M366 122 Q354 148 364 174 M380 124 Q370 148 378 170" fill="none" stroke="{INK}" stroke-width="1.6" opacity="0.5"/>'
             + f'<g id="teeth-upper">' + teeth(up_t, 11, 4, 9, True, w=0.6) + '</g>'
             + eye(418, 138, 10) + '</g>')
    s.append(f'<g id="fin-pectoral"><path d="{path(pect, True, 0.2)}" fill="url(#{pref}-fin)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="M304 182 Q290 200 272 232 M310 186 Q300 206 284 226" fill="none" stroke="{INK}" stroke-width="1" opacity="0.4"/></g>')
    s.append(pivots({'kiefer': H, 'schwanz': (74, 150), 'brustflosse': (304, 180), 'bauchflosse': (210, 205), 'afterflosse': (140, 190), 'rueckenflosse-1': (240, 110), 'rueckenflosse-2': (140, 126)}))
    return ''.join(s)


# ----------------------------------------------------------------------------- Linie 3: Fleischflosser

def fleisch(theta):
    pref = 'ff'
    H = (352, 170)
    body = [(58, 148, 's'), (112, 130), (180, 114), (250, 107), (320, 108), (380, 114), (420, 126), (450, 142), (466, 156), (440, 165), (402, 170),
            (372, 172), (352, 172), (348, 200), (300, 208), (240, 210), (180, 204), (120, 188), (82, 168), (58, 154, 's')]
    mline = [(466, 156), (440, 165), (402, 170), (372, 172), (352, 172)]
    jaw_top = [(352, 172), (372, 172), (402, 170), (440, 165), (466, 156)]
    jaw = [(352, 172), (372, 172), (402, 170), (440, 165), (468, 158), (462, 170), (440, 186), (404, 200), (370, 206), (346, 202), (338, 188)]
    tail = [(104, 140, 's'), (60, 148), (36, 124), (10, 112, 's'), (28, 136), (18, 150, 's'), (28, 164), (10, 190, 's'), (36, 176), (60, 154), (104, 160, 's')]
    dors1 = [(222, 109, 's'), (230, 74), (262, 66), (282, 80), (272, 108, 's')]
    dors2 = [(128, 128, 's'), (136, 96), (160, 90), (172, 104), (166, 122, 's')]
    anal = [(150, 192, 's'), (146, 224), (172, 230), (190, 214), (186, 196, 's')]
    pelv_s = [(208, 200), (192, 224), (176, 246)]
    pect_s = [(322, 188), (306, 214), (286, 240)]
    up_t = sample(mline[::-1], 12)
    low_t = sample(jaw_top, 12)

    def lobed(stalk, w0, w1, rays, ang):
        (x0, y0), (x1, y1) = stalk[0], stalk[-1]
        # fleischiger Stiel
        dx, dy = x1 - x0, y1 - y0
        d = math.hypot(dx, dy)
        nx, ny = -dy / d, dx / d
        a = (x0 + nx * w0, y0 + ny * w0)
        b = (x0 - nx * w0, y0 - ny * w0)
        c = (x1 - nx * w1, y1 - ny * w1)
        e = (x1 + nx * w1, y1 + ny * w1)
        stem = f'<path d="{path([a, e, c, b], True, 0.2)}" fill="url(#{pref}-body)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
        fan = []
        for i in range(rays):
            t = (i / (rays - 1) - 0.5) * 2 * ang
            tip = rot((x1 + dx / d * 30, y1 + dy / d * 30), t, (x1, y1))
            fan.append(f'<path d="M{_fmt(x1)} {_fmt(y1)}L{_fmt(tip[0])} {_fmt(tip[1])}" stroke="{INK}" stroke-width="1.2" opacity="0.55"/>')
        edge = [rot((x1 + dx / d * 30, y1 + dy / d * 30), (i / (rays - 1) - 0.5) * 2 * ang, (x1, y1)) for i in range(rays)]
        mem = f'<path d="{path([(x1, y1, "s")] + edge + [(x1, y1, "s")], True, 0.12)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2" stroke-linejoin="round"/>'
        return mem + ''.join(fan) + stem

    s = []
    s.append(f'<g id="tail"><path d="{path(tail, True, 0.2)}" fill="url(#{pref}-fin)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="M58 149 L16 118 M58 151 L22 150 M58 153 L16 184" fill="none" stroke="{INK}" stroke-width="1" opacity="0.4"/></g>')
    s.append(f'<g id="fin-dorsal"><path d="{path(dors2, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>'
             f'<path d="{path(dors1, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="M232 108 L242 76 M246 108 L252 70 M260 108 L262 70 M270 108 L270 82 M136 126 L142 98 M148 124 L152 94 M160 122 L162 100" stroke="{INK}" stroke-width="1" opacity="0.45"/></g>')
    s.append(f'<g id="fin-pelvic"><path d="{path(anal, True, 0.2)}" fill="url(#{pref}-fin-v)" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>'
             + lobed(pelv_s, 11, 8, 6, 34) + '</g>')
    s.append(f'<g id="fin-pectoral-far" transform="translate(-22 -6)" opacity="0.85">' + lobed(pect_s, 12, 9, 7, 36) + '</g>')
    s.append(f'<g id="mouth-interior">{mouth_interior(sample(mline[::-1], 6), sample(jaw_top, 6), [(346, 202), (338, 188)], (348, 200), theta, H)}</g>')
    s.append(f'<g id="jaw-lower" transform="rotate({_fmt(theta)} {H[0]} {H[1]})">'
             f'<path d="{path(jaw, True, 0.17)}" fill="url(#{pref}-body)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
             f'<path d="{path(jaw, True, 0.17)}" fill="url(#{pref}-sheen)" opacity="0.5"/>'
             f'<path d="M370 190 Q410 196 450 176" fill="none" stroke="{INK}" stroke-width="1.2" opacity="0.35"/>'
             + f'<g id="teeth-lower">' + teeth(low_t, 10, 4, 8, False, w=0.55, skip=(8,)) + fang((438, 168), (442, 136), 12) + '</g></g>')
    s.append(f'<g id="body"><clipPath id="{pref}-clip-body"><path d="{path(body, True, 0.16)}"/></clipPath>'
             f'<path d="{path(body, True, 0.16)}" fill="url(#{pref}-body)" stroke="{INK}" stroke-width="2.6" stroke-linejoin="round"/>'
             f'<path d="{path(body, True, 0.16)}" fill="url(#{pref}-sheen)" opacity="0.55"/>'
             + scales(f'{pref}-clip-body', 70, 330, 112, 212, 19, 15, 9, op=0.28)
             # Kopfplatten (Kosmoidschuppen-Stil) & Kiemendeckel
             + f'<path d="M334 112 Q350 150 342 196 M352 110 Q372 150 362 190" fill="none" stroke="{INK}" stroke-width="1.8" opacity="0.5"/>'
             f'<path d="M372 118 Q410 112 440 136 M362 140 Q400 134 452 150" fill="none" stroke="{INK}" stroke-width="1.4" opacity="0.4"/>'
             f'<path d="M96 134 Q250 118 400 130" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.16"/>'
             + f'<g id="teeth-upper">' + teeth(up_t, 10, 4, 8, True, w=0.55, skip=(8,)) + fang((436, 166), (440, 196), 12) + '</g>'
             + eye(414, 136, 10) + '</g>')
    s.append(f'<g id="fin-pectoral">' + lobed(pect_s, 12, 9, 7, 36) + '</g>')
    s.append(pivots({'kiefer': H, 'schwanz': (58, 150), 'brustflosse': (322, 188), 'bauchflosse': (208, 200), 'afterflosse': (170, 194), 'rueckenflosse-1': (250, 108), 'rueckenflosse-2': (150, 126)}))
    return ''.join(s)


# ----------------------------------------------------------------------------- Blatt

LINES = {
    'panzer': (panzer, dict(back='#3a4247', mid='#69737a', belly='#aeb2a8', fin='#2d363b', fin2='#5d6a70')),
    'jaeger': (jaeger, dict(back='#36525c', mid='#6a8791', belly='#cfd6cc', fin='#2f4850', fin2='#8fa8ae')),
    'fleischflosser': (fleisch, dict(back='#454c2a', mid='#787a3e', belly='#cdbf8e', fin='#7a4a2c', fin2='#c98a4c')),
}
ANGLES = [0, 14, 28, 42, 56]


def sheet(name):
    fn, pal = LINES[name]
    pref = {'panzer': 'pz', 'jaeger': 'jg', 'fleischflosser': 'ff'}[name]
    frames = []
    for i, th in enumerate(ANGLES[:FRAMES]):
        body = fn(th)
        # ids je Bild eindeutig machen (clipPath), Gruppen bleiben gleich benannt
        body = body.replace(f'{pref}-clip-body', f'{pref}-clip-{i + 1}')
        body = re.sub(r'id="(tail|fin-dorsal|fin-pelvic|fin-pectoral|fin-pectoral-far|body|head|head-group|jaw-lower|mouth-interior|teeth-lower|teeth-upper|eye|gelenke|gelenk-[a-z0-9-]+)"',
                      lambda m: f'id="bild{i + 1}-{m.group(1)}"', body)
        frames.append(f'<g id="bild-{i + 1}" transform="translate({i * CELL_W} 0)">{body}</g>')
    guides = ''.join(f'<rect x="{i * CELL_W + 0.5}" y="0.5" width="{CELL_W - 1}" height="{CELL_H - 1}" fill="none" stroke="#ff00aa" stroke-width="1"/>' for i in range(FRAMES))
    note = (f'<!-- {name}: {FRAMES} Bilder à {CELL_W}x{CELL_H}, Blick nach rechts, Kiefer öffnet von {ANGLES[0]} bis {ANGLES[FRAMES - 1]} Grad '
            f'(Drehpunkt = Kiefergelenk, siehe transform der Gruppe jaw-lower). Ebenen je Bild: tail, fin-dorsal, fin-pelvic, fin-pectoral-far, mouth-interior, '
            f'jaw-lower, body, head, fin-pectoral, gelenke (ausgeblendet). Ebene hilfslinien (ausgeblendet) zeigt die Bildraster. -->')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CELL_W * FRAMES} {CELL_H}" width="{CELL_W * FRAMES}" height="{CELL_H}">{note}'
            f'<title>{name} – Biss in {FRAMES} Bildern (Maul zu bis ganz offen)</title>'
            f'<defs>{COMMON_DEFS}{defs(pref, **pal)}</defs>'
            f'<g id="hilfslinien" display="none">{guides}</g>'
            + ''.join(frames) + '</svg>')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n in LINES:
        p = os.path.join(OUT, f'{n}_biss.svg')
        with open(p, 'w', encoding='utf-8') as f:
            f.write(sheet(n))
        print('geschrieben', os.path.normpath(p))
