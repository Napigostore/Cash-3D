"""Draws the app icon: a gold coin with wings ("Cash to Freedom") on a deep navy background.
Run: python tools/make_icon.py   → ios/CashToFreedom/Assets.xcassets/AppIcon.appiconset/icon-1024.png and docs/icon.png
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
S = 2048  # drawn at 2x, then downsampled for smooth edges


def radial(size, inner, outer, center=(0.5, 0.5), radius=0.75):
    img = Image.new('RGB', (size, size))
    px = img.load()
    cx, cy = center[0] * size, center[1] * size
    r = radius * size
    for y in range(size):
        for x in range(size):
            t = min(1.0, math.hypot(x - cx, y - cy) / r)
            px[x, y] = tuple(int(inner[i] + (outer[i] - inner[i]) * t) for i in range(3))
    return img


def gold_gradient(size, top=(255, 233, 160), mid=(233, 178, 52), bottom=(150, 92, 18)):
    g = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(g)
    for y in range(size):
        t = y / size
        if t < .45:
            k = t / .45
            c = tuple(int(top[i] + (mid[i] - top[i]) * k) for i in range(3))
        else:
            k = (t - .45) / .55
            c = tuple(int(mid[i] + (bottom[i] - mid[i]) * k) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)
    return g


def feather(d, bx, by, ang, L, W, fill, outline):
    """A pointed feather from (bx, by) towards `ang` degrees (0 = right, 90 = up)."""
    ux, uy = math.cos(math.radians(ang)), -math.sin(math.radians(ang))
    nx, ny = -uy, ux
    left, right = [], []
    for i in range(41):
        t = i / 40
        w = W * (math.sin(math.pi * min(1, t * 1.05)) ** .7) * (1 - .35 * t)
        x, y = bx + ux * L * t, by + uy * L * t
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    d.polygon(left + right[::-1], fill=fill, outline=outline, width=7)
    d.line([(bx, by), (bx + ux * L * .9, by + uy * L * .9)], fill=outline, width=4)


def draw_wing(img, cx, cy, R, side):
    d = ImageDraw.Draw(img)
    S_ = img.width
    layers = [  # (angles from top to bottom, lengths, width, base offset, colour)
        ([72, 58, 44, 30, 16, 2], [.25, .3, .31, .29, .25, .2], .03, .78, (236, 190, 92)),
        ([65, 50, 36, 22, 8], [.18, .21, .22, .2, .16], .028, .8, (247, 212, 128)),
        ([58, 42, 26, 12], [.11, .12, .12, .1], .026, .82, (255, 234, 172))]
    for angles, lengths, w, off, col in layers:
        for k, (a, l) in enumerate(zip(angles, lengths)):
            ang = a if side > 0 else 180 - a
            by = cy - R * .35 + k * R * .14
            bx = cx + side * R * off
            feather(d, bx, by, ang, l * S_, w * S_, col, (128, 80, 14))


def main():
    bg = radial(S, (24, 58, 96), (6, 16, 32), center=(.5, .42), radius=.78)

    glow = Image.new('L', (S, S), 0)
    ImageDraw.Draw(glow).ellipse([S * .18, S * .14, S * .82, S * .78], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(S * .09))
    bg = Image.composite(Image.new('RGB', (S, S), (255, 196, 80)), bg, glow.point(lambda v: int(v * .35)))

    # wings: three layers of pointed feathers on each side
    cx0, cy0, R0 = S / 2, S * .53, S * .24
    draw_wing(bg, cx0, cy0, R0, -1)
    draw_wing(bg, cx0, cy0, R0, 1)

    # coin
    cx, cy, R = S / 2, S * .53, S * .24
    shadow = Image.new('L', (S, S), 0)
    ImageDraw.Draw(shadow).ellipse([cx - R, cy - R + S * .03, cx + R, cy + R + S * .05], fill=190)
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * .02))
    bg = Image.composite(Image.new('RGB', (S, S), (4, 10, 20)), bg, shadow)

    def disc(r, dy=0):
        m = Image.new('L', (S, S), 0)
        ImageDraw.Draw(m).ellipse([cx - r, cy - r + dy, cx + r, cy + r + dy], fill=255)
        return m
    bg = Image.composite(Image.new('RGB', (S, S), (122, 70, 8)), bg, disc(R, S * .018))   # coin edge
    bg = Image.composite(gold_gradient(S, (255, 226, 130), (232, 170, 40), (176, 108, 16)), bg, disc(R))
    ring = ImageChops.subtract(disc(R * .86), disc(R * .8))
    bg = Image.composite(Image.new('RGB', (S, S), (166, 104, 14)), bg, ring)
    bg = Image.composite(gold_gradient(S, (255, 238, 170), (240, 186, 60), (190, 120, 20)), bg, disc(R * .8))

    # emblem: rising arrow breaking out of the coin (cash → freedom)
    em = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(em)
    w = int(S * .045)
    pts = [(cx - R * .55, cy + R * .38), (cx - R * .12, cy - R * .05), (cx + R * .1, cy + R * .16), (cx + R * .58, cy - R * .42)]
    d.line(pts, fill=255, width=w, joint='curve')
    for x, y in pts[:-1]:
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=255)
    tip = (cx + R * .74, cy - R * .6)
    d.polygon([tip, (cx + R * .3, cy - R * .5), (cx + R * .66, cy - R * .14)], fill=255)
    emboss = em.filter(ImageFilter.GaussianBlur(S * .004))
    bg = Image.composite(Image.new('RGB', (S, S), (255, 246, 214)), bg, ImageChops.offset(emboss, -4, -4))
    bg = Image.composite(Image.new('RGB', (S, S), (22, 48, 86)), bg, em)

    # highlight sweep on the coin
    hl = Image.new('L', (S, S), 0)
    ImageDraw.Draw(hl).ellipse([cx - R * .85, cy - R * .95, cx + R * .2, cy - R * .1], fill=120)
    hl = ImageChops.multiply(hl.filter(ImageFilter.GaussianBlur(S * .03)), disc(R))
    bg = Image.composite(Image.new('RGB', (S, S), (255, 255, 255)), bg, hl)

    # sparkles
    for (x, y, r) in [(.5, .12, .016), (.17, .84, .011), (.83, .84, .011)]:
        sp = Image.new('L', (S, S), 0)
        sd = ImageDraw.Draw(sp)
        X, Y, Rr = x * S, y * S, r * S
        sd.polygon([(X, Y - Rr * 3), (X + Rr * .5, Y - Rr * .5), (X + Rr * 3, Y), (X + Rr * .5, Y + Rr * .5), (X, Y + Rr * 3), (X - Rr * .5, Y + Rr * .5), (X - Rr * 3, Y), (X - Rr * .5, Y - Rr * .5)], fill=230)
        bg = Image.composite(Image.new('RGB', (S, S), (255, 236, 170)), bg, sp.filter(ImageFilter.GaussianBlur(2)))

    out = bg.resize((1024, 1024), Image.LANCZOS)
    for path in ['ios/CashToFreedom/Assets.xcassets/AppIcon.appiconset/icon-1024.png', 'docs/icon.png']:
        out.save(os.path.join(ROOT, path))
    print('icon written')


if __name__ == '__main__':
    main()
