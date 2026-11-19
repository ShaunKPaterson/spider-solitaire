"""Draws the home-screen icons: two fanned cards with a spade on green baize."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent


def spade(d, cx, cy, s, fill):
    # body: two circles + a triangle, stem: a small triangle
    r = s * 0.27
    d.ellipse([cx - s * 0.5 + 0.0 * s, cy - r * 0.2, cx - s * 0.5 + 2 * r, cy + 1.8 * r], fill=fill)
    d.ellipse([cx + s * 0.5 - 2 * r, cy - r * 0.2, cx + s * 0.5, cy + 1.8 * r], fill=fill)
    d.polygon([(cx, cy - s * 0.62), (cx - s * 0.5, cy + r * 0.6), (cx + s * 0.5, cy + r * 0.6)], fill=fill)
    d.polygon([(cx, cy + r * 0.4), (cx - s * 0.2, cy + s * 0.62), (cx + s * 0.2, cy + s * 0.62)], fill=fill)


def icon(size, safe):
    S = 4 * size  # draw large, then shrink for smooth edges
    img = Image.new('RGB', (S, S), '#0b7d20')
    g = Image.new('L', (S, S), 0)
    ImageDraw.Draw(g).ellipse([-S * .3, -S * .1, S * 1.3, S * 1.5], fill=255)
    g = g.filter(ImageFilter.GaussianBlur(S * .15))
    img.paste(Image.new('RGB', (S, S), '#15a733'), (0, 0), g)

    k = safe  # fraction of the canvas the artwork may use
    cw, ch = S * .42 * k, S * .58 * k
    cx, cy = S / 2, S / 2

    def card(angle, dx, face):
        layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        box = [cx - cw / 2 + dx, cy - ch / 2, cx + cw / 2 + dx, cy + ch / 2]
        d.rounded_rectangle(box, radius=cw * .1, fill='#ffffff', outline='#8a8a8a', width=int(S * .006))
        if face:
            spade(d, cx + dx, cy + ch * .04, cw * .62, '#17181c')
        else:
            inset = cw * .08
            d.rounded_rectangle([box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset], radius=cw * .06, fill='#1b2f5e', outline='#c9a646', width=int(S * .008))
        shadow = layer.split()[3].filter(ImageFilter.GaussianBlur(S * .01))
        sh = Image.new('RGBA', (S, S), (0, 0, 0, 90))
        sh.putalpha(shadow.point(lambda v: v * 0.45))
        sh = sh.rotate(angle, center=(cx, cy + ch * .6), resample=Image.BICUBIC, translate=(S * .01, S * .015))
        layer = layer.rotate(angle, center=(cx, cy + ch * .6), resample=Image.BICUBIC)
        img.paste(sh, (0, 0), sh)
        img.paste(layer, (0, 0), layer)

    card(14, -cw * .22, False)
    card(-8, cw * .14, True)
    return img.resize((size, size), Image.LANCZOS)


icon(192, 1.0).save(OUT / 'icon-192.png')
icon(512, 1.0).save(OUT / 'icon-512.png')
icon(512, 0.78).save(OUT / 'icon-maskable-512.png')
print('icons written to', OUT)
