"""Headless entry point — run inside Blender:

  blender -b --factory-startup -P scripts/crystal/blender/cli.py -- build \
      --dump .crystal/dumps/<id>.json --glb public/crystal/models/<key>.glb \
      [--preview .crystal/previews/<id>.png] [--no-ao]

  blender -b --factory-startup -P scripts/crystal/blender/cli.py -- batch --jobs jobs.json

`batch` reads [{dump, glb, preview?}] and builds them in one Blender process
(much faster than one process per model); one JSON report line per model
(`[crystal] {...}`) on stdout, failures as `[crystal-error] {...}`.
The node orchestrator (scripts/crystal/build.ts) drives this.
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from crystal.config import Config  # noqa: E402
from crystal.pipeline import build_one  # noqa: E402


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="crystal")
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--dump", required=True)
    b.add_argument("--glb")
    b.add_argument("--preview")
    b.add_argument("--no-ao", action="store_true")
    b.add_argument("--size", type=int, default=768)
    b.add_argument("--samples", type=int, default=96)
    b.add_argument("--shape", help='profile overrides as JSON, e.g. \'{"profile":"crystal","blur":0.7}\'')
    bt = sub.add_parser("batch")
    bt.add_argument("--jobs", required=True)
    bt.add_argument("--no-ao", action="store_true")
    ba = sub.add_parser("blend-assets", help="list materials of .blend files (library scan)")
    ba.add_argument("--files", required=True)
    tx = sub.add_parser("textures", help="export library maps of bound surfaces for the engine")
    tx.add_argument("--size", type=int, default=1024)
    tx.add_argument("--only", help="comma-separated surface ids")
    args = ap.parse_args(argv)

    cfg = Config.load()
    if args.cmd == "blend-assets":
        from crystal.library import list_blend_assets

        list_blend_assets(json.loads(Path(args.files).read_text()))
        return 0
    if args.cmd == "textures":
        from crystal.library import export_textures

        only = set(args.only.split(",")) if args.only else None
        export_textures(cfg, size=args.size, only=only)
        return 0
    if args.cmd == "build":
        build_one(args.dump, args.glb, args.preview, cfg=cfg, ao=not args.no_ao, preview_size=args.size, preview_samples=args.samples, shape=json.loads(args.shape) if args.shape else None)
        return 0
    jobs = json.loads(Path(args.jobs).read_text())
    failed = 0
    for job in jobs:
        try:
            build_one(job["dump"], job.get("glb"), job.get("preview"), cfg=cfg, ao=not args.no_ao)
        except Exception as e:  # noqa: BLE001 — one broken model must not stop the batch
            failed += 1
            print("[crystal-error] " + json.dumps({"dump": job["dump"], "error": str(e), "trace": traceback.format_exc()}))
    return 1 if failed else 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    sys.exit(main(argv))
