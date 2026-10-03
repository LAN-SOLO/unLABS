"""Render one trailer shot (docs/TRAILERS.md).

  blender -b --factory-startup -P scripts/trailer/blender/render.py -- \\
      --trailer t1 --shot s2_control --fmt h [--stills] [--scale 50] [--samples 32] [--step 1]

Writes .voxel/trailer/frames/<trailer>/<fmt>/<shot>/f####.png (all frames) or,
with --stills, three frames (first, middle, last) to …/stills/<shot>-<k>.png.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import fx  # noqa: E402
import lab  # noqa: E402
import shots  # noqa: E402

SIZES = {"h": (1920, 1080), "v": (1080, 1920)}


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--trailer", required=True)
    ap.add_argument("--shot", required=True)
    ap.add_argument("--fmt", default="h", choices=("h", "v"))
    ap.add_argument("--stills", action="store_true")
    ap.add_argument("--at", default="")
    ap.add_argument("--scale", type=int, default=100)
    ap.add_argument("--samples", type=int, default=32)
    ap.add_argument("--step", type=int, default=1)
    ap.add_argument("--fps", type=int, default=24)
    a = ap.parse_args(argv)
    sh = next((s for s in shots.shots_of(a.trailer) if s.id == a.shot), None)
    if sh is None:
        print(f"[trailer] unknown shot {a.trailer}/{a.shot}")
        return 2
    t0 = time.time()
    lab.reset()
    w, h = SIZES[a.fmt]
    lab.setup(w, h, a.fps, a.samples)
    sc = bpy.context.scene
    sc.render.resolution_percentage = a.scale
    n = int(round(sh.seconds * a.fps))
    ctx = shots.Ctx(a.fmt, a.fps, n, fx.Rig(a.fmt))
    sh.build(ctx)
    lab.smooth_all()
    fx.constant([o for o in bpy.data.objects if o.get("kind") == "_never"])
    sc.frame_start = 1
    sc.frame_end = n
    print(f"[trailer] {a.trailer}/{a.shot} {a.fmt}: built in {time.time() - t0:.1f}s, {n} frames")
    root = lab.TR / "frames" / a.trailer / a.fmt
    if a.stills or a.at:
        out = root / "stills"
        out.mkdir(parents=True, exist_ok=True)
        picks = [int(x) for x in a.at.split(",")] if a.at else [1, n // 2, n]
        for k, f in enumerate(picks):
            sc.frame_set(f)
            sc.render.filepath = str(out / f"{a.shot}-{k}.png")
            bpy.ops.render.render(write_still=True)
    else:
        out = root / a.shot
        out.mkdir(parents=True, exist_ok=True)
        sc.frame_step = a.step
        sc.render.filepath = str(out / "f")
        sc.render.use_file_extension = True
        bpy.ops.render.render(animation=True)
    print(f"[trailer] {a.trailer}/{a.shot} {a.fmt}: done in {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
