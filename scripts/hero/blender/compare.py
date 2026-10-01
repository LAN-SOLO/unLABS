"""Side-by-side of a Jade render and the reference portrait, aligned on the pupils.

  blender -b -P scripts/hero/blender/compare.py -- <render.png> <out.png> [--photo PATH]

The portrait stays outside the repo (default ~/Desktop/JadeLawrence/Portrait_lawrence_usc.jpg);
the output goes to the gitignored .crystal/ dir. Pupils of the render are found as the darkest
blobs left / right of the centre in the upper half; the portrait's are measured (800,680)/(1070,678).
"""

import sys
from pathlib import Path

import bpy
import numpy as np

PHOTO_PUPILS = ((800.0, 680.0), (1070.0, 678.0))


def load(path):
    img = bpy.data.images.load(str(path))
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)[::-1].copy()  # row 0 = top


def pupils(a):
    h, w, _ = a.shape
    lum = a[..., :3].mean(axis=2)
    out = []
    for x0, x1 in ((int(w * 0.3), w // 2), (w // 2, int(w * 0.7))):
        sub = lum[int(h * 0.3) : int(h * 0.75), x0:x1]
        y, x = np.unravel_index(np.argmin(sub + 0.0), sub.shape)
        out.append((x0 + x, int(h * 0.3) + y))
    return out


def resample(a, scale, dx, dy, w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    sx = ((xs - dx) / scale).astype(int)
    sy = ((ys - dy) / scale).astype(int)
    ok = (sx >= 0) & (sy >= 0) & (sx < a.shape[1]) & (sy < a.shape[0])
    out = np.zeros((h, w, 4), dtype=np.float32)
    out[..., 3] = 1
    out[ok] = a[sy[ok], sx[ok]]
    return out


def main(argv):
    render, out = Path(argv[0]), Path(argv[1])
    photo = Path(argv[argv.index("--photo") + 1]) if "--photo" in argv else Path.home() / "Desktop/JadeLawrence/Portrait_lawrence_usc.jpg"
    r = load(render)
    p = load(photo)
    side = render.with_suffix(".json")
    if side.exists():
        import json

        (rl, rr) = json.loads(side.read_text())["pupils"]
    else:
        (rl, rr) = pupils(r)
    d_r = abs(rr[0] - rl[0])
    d_p = PHOTO_PUPILS[1][0] - PHOTO_PUPILS[0][0]
    s = d_p / max(d_r, 1)
    cx_r = (rl[0] + rr[0]) / 2
    cy_r = (rl[1] + rr[1]) / 2
    cx_p = (PHOTO_PUPILS[0][0] + PHOTO_PUPILS[1][0]) / 2
    cy_p = (PHOTO_PUPILS[0][1] + PHOTO_PUPILS[1][1]) / 2
    H, W = p.shape[0], p.shape[1]
    rr_img = resample(r, s, cx_p - cx_r * s, cy_p - cy_r * s, W, H)
    # Crop both around the face.
    y0, y1 = int(cy_p - 520), int(cy_p + 620)
    x0, x1 = int(cx_p - 560), int(cx_p + 560)
    crop = lambda a: a[max(0, y0) : y1, max(0, x0) : x1]
    a, b = crop(p), crop(rr_img)
    mix = a * 0.5 + b * 0.5
    sheet = np.concatenate([a, b, mix], axis=1)
    hh, ww, _ = sheet.shape
    img = bpy.data.images.new("cmp", ww, hh)
    img.pixels.foreach_set(sheet[::-1].ravel())
    img.filepath_raw = str(out)
    img.file_format = "PNG"
    img.save()
    print(f"[compare] render pupils {rl} {rr} scale {s:.2f} → {out}")


main(sys.argv[sys.argv.index("--") + 1 :])
