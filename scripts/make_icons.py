"""Generate the PWA / iOS icons into public/icons (run: npm run icons)."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)
TOP, BOTTOM = (91, 99, 211), (27, 175, 122)


def gradient(size):
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
    return img


def draw_mark(img, scale):
    """A stylised ledger: three rising bars + baseline (no text, crisp at any size)."""
    s = img.size[0]
    d = ImageDraw.Draw(img)
    inner = s * scale
    x0 = (s - inner) / 2
    y_base = s / 2 + inner * 0.32
    w = inner * 0.17
    gap = inner * 0.1
    heights = [0.32, 0.5, 0.72]
    total = 3 * w + 2 * gap
    start = (s - total) / 2
    for i, h in enumerate(heights):
        bx = start + i * (w + gap)
        d.rounded_rectangle([bx, y_base - inner * h, bx + w, y_base], radius=w * 0.35, fill=(255, 255, 255))
    d.rounded_rectangle([x0 + inner * 0.08, y_base + inner * 0.07, x0 + inner * 0.92, y_base + inner * 0.07 + inner * 0.06], radius=inner * 0.03, fill=(255, 255, 255, 220))
    return img


def rounded(img, radius_ratio):
    s = img.size[0]
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=255)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


big = draw_mark(gradient(1024), 0.6)
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    rounded(big, 0.22).resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))
# iOS applies its own rounding: full-bleed square
big.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'))
# Maskable: smaller mark inside the safe zone
draw_mark(gradient(1024), 0.46).resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'maskable-512.png'))
print('icons written to', os.path.abspath(OUT))
