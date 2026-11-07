"""Generate Key Critters app icons: coloured piano keys on an indigo background.

Usage: python make_icons.py   (needs Pillow)
"""
from PIL import Image, ImageDraw

COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#06b6d4", "#6366f1", "#d946ef"]
BG_TOP = (30, 27, 75)      # #1e1b4b
BG_BOTTOM = (76, 29, 149)  # #4c1d95
SS = 4                     # supersampling factor for smooth edges


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def draw_icon(size):
    s = size * SS
    img = Image.new("RGB", (s, s), BG_TOP)
    d = ImageDraw.Draw(img)

    # vertical indigo -> purple gradient, full bleed (iOS masks the corners itself)
    for y in range(s):
        t = y / (s - 1)
        d.line([(0, y), (s, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))

    # keys sit inside the central ~72% so maskable crops keep them whole
    left, right = 0.15 * s, 0.85 * s
    top, bottom = 0.25 * s, 0.77 * s
    gap = 0.012 * s
    kw = (right - left - gap * 6) / 7
    radius = 0.035 * s

    # soft shadow under the keys
    d.rounded_rectangle([left, top + 0.025 * s, right, bottom + 0.025 * s], radius=radius, fill=(18, 16, 48))

    for i, c in enumerate(COLORS):
        x0 = left + i * (kw + gap)
        rgb = hex_rgb(c)
        d.rounded_rectangle([x0, top, x0 + kw, bottom], radius=radius, fill=rgb)
        # glossy highlight at the top of each key
        hi = tuple(min(255, v + 60) for v in rgb)
        d.rounded_rectangle([x0 + kw * 0.18, top + 0.02 * s, x0 + kw * 0.82, top + 0.09 * s], radius=radius / 2, fill=hi)

    # black keys between C-D, D-E, F-G, G-A, A-B
    bw = kw * 0.62
    bh = (bottom - top) * 0.56
    for i in (0, 1, 3, 4, 5):
        cx = left + (i + 1) * (kw + gap) - gap / 2
        d.rounded_rectangle([cx - bw / 2, top - 0.005 * s, cx + bw / 2, top + bh], radius=radius * 0.7, fill=(17, 24, 39))

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    for size in (180, 192, 512):
        draw_icon(size).save(f"icon-{size}.png", optimize=True)
        print(f"wrote icon-{size}.png")
