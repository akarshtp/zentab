"""One-off script to generate bundled gradient WebP backgrounds."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "backgrounds"
ROOT.mkdir(parents=True, exist_ok=True)

GRADIENTS = [
    ("sunset", (255, 94, 98), (255, 195, 113)),
    ("ocean", (43, 88, 118), (78, 67, 118)),
    ("forest", (17, 153, 142), (56, 239, 125)),
    ("lavender", (102, 126, 234), (118, 75, 162)),
    ("rose", (240, 147, 251), (245, 87, 108)),
    ("midnight", (15, 32, 39), (44, 83, 100)),
    ("aurora", (0, 210, 255), (58, 123, 213)),
    ("ember", (255, 81, 47), (221, 36, 118)),
]

W, H = 1280, 720

for name, c1, c2 in GRADIENTS:
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1) if H > 1 else 0
        for x in range(W):
            r = int(c1[0] + (c2[0] - c1[0]) * t)
            g = int(c1[1] + (c2[1] - c1[1]) * t)
            b = int(c1[2] + (c2[2] - c1[2]) * t)
            px[x, y] = (r, g, b)
    out = ROOT / f"{name}.webp"
    img.save(out, "WEBP", quality=82, method=6)
    print(f"{name}: {out.stat().st_size} bytes")
