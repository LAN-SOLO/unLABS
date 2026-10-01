# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Material library scanner → `.crystal/library/catalog.json`.

Roots: $CRYSTAL_LIBRARY (os.pathsep-separated) and/or `.crystal/library/roots.json`
(`{"roots": ["~/Assets/Materials", ...]}`) — machine-specific, never committed.

Recognises
  * texture sets: a folder (or file-name stem group) with an albedo / base
    colour map plus any of normal (GL preferred over DX), roughness, AO,
    metalness, height (PolyHaven, ambientCG, Quixel, Poliigon naming);
  * HDRIs: *.hdr / *.exr (environment maps for look-dev and stills);
  * .blend files with material assets (listed through Blender, optional:
    `--blend`).

Every entry gets a stable id (`tex:<folder>`, `hdri:<name>`, `blend:<file>#<material>`),
tags from its path, and its maps. `pnpm crystal:library` runs this; the MCP
tools `library_search` / `library_assign` read the catalog.

  uv run --script scripts/crystal/library/scan.py [--blend] [root ...]
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / ".crystal" / "library"
CATALOG = OUT_DIR / "catalog.json"

IMG = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".exr", ".webp", ".tga"}
# Map kind → name patterns (lower-case, matched against the file stem's trailing token(s)).
KINDS: list[tuple[str, re.Pattern[str]]] = [
    ("normal_dx", re.compile(r"(normal|nrm|nor)[_-]?dx$|_nor_dx|normaldx")),
    ("normal", re.compile(r"(normal|nrm|nor)([_-]?gl)?$|_nor_gl|normalgl|_normal_")),
    ("albedo", re.compile(r"(albedo|basecolou?r|base_colou?r|diff(use)?|colou?r|_col)$|_diff_|_col_|basecolor")),
    ("roughness", re.compile(r"(rough(ness)?|rgh)$|_rough_")),
    ("ao", re.compile(r"(ao|ambientocclusion|occlusion)$|_ao_")),
    ("metal", re.compile(r"(metal(ness|lic)?|mtl)$|_metal_")),
    ("height", re.compile(r"(height|disp(lacement)?|bump)$|_disp_")),
    ("opacity", re.compile(r"(opacity|alpha|mask)$")),
]
RES = re.compile(r"(\d+)[kK]\b")


def roots_from(args: list[str]) -> list[Path]:
    roots = [Path(a).expanduser() for a in args if not a.startswith("--")]
    env = os.environ.get("CRYSTAL_LIBRARY")
    if env:
        roots += [Path(p).expanduser() for p in env.split(os.pathsep) if p]
    cfg = OUT_DIR / "roots.json"
    if cfg.exists():
        roots += [Path(p).expanduser() for p in json.loads(cfg.read_text()).get("roots", [])]
    seen, out = set(), []
    for r in roots:
        r = r.resolve()
        if r not in seen and r.exists():
            seen.add(r)
            out.append(r)
    return out


def kind_of(stem: str) -> str | None:
    s = stem.lower()
    # Strip resolution / variant tokens: "Metal012_2K_Roughness" → "...roughness".
    s = RES.sub("", s).replace("-", "_").strip("_")
    for k, pat in KINDS:
        if pat.search(s):
            return k
    return None


def tags_of(path: Path, root: Path) -> list[str]:
    rel = path.relative_to(root)
    words = re.split(r"[\s/_\-.]+", str(rel.parent).lower() + " " + path.stem.lower())
    return sorted({w for w in words if w and not w.isdigit() and len(w) > 1 and not RES.fullmatch(w)})


def scan_textures(root: Path) -> list[dict]:
    """Group images by folder (and by stem prefix inside flat folders)."""
    groups: dict[tuple[Path, str], dict[str, Path]] = {}
    for p in root.rglob("*"):
        if p.suffix.lower() not in IMG or p.name.startswith("."):
            continue
        k = kind_of(p.stem)
        if not k:
            continue
        # Prefix before the map token = set name (handles flat folders with many sets).
        prefix = re.split(r"[_\-. ](?=[^_\-. ]*$)", p.stem)[0]
        prefix = RES.sub("", prefix).strip("_- ").lower()
        key = (p.parent, prefix if len(list(p.parent.iterdir())) > 12 else "")
        maps = groups.setdefault(key, {})
        # Prefer PNG/JPG/TIF over EXR for game export; keep the first of each kind otherwise.
        if k not in maps or (maps[k].suffix.lower() == ".exr" and p.suffix.lower() != ".exr"):
            maps[k] = p
    entries = []
    for (folder, prefix), maps in groups.items():
        if "albedo" not in maps and "normal" not in maps and "normal_dx" not in maps:
            continue
        if "normal" not in maps and "normal_dx" in maps:
            maps["normal"] = maps["normal_dx"]
            dx = True
        else:
            dx = False
        maps.pop("normal_dx", None)
        name = (prefix or folder.name).strip()
        rid = f"tex:{folder.relative_to(root).as_posix()}{'#' + prefix if prefix else ''}"
        any_map = next(iter(maps.values()))
        res = RES.search(any_map.stem)
        entries.append(
            {
                "id": rid,
                "kind": "textures",
                "name": name,
                "root": str(root),
                "maps": {k: str(v) for k, v in sorted(maps.items())},
                "normalDX": dx,
                "resolution": f"{res.group(1)}k" if res else None,
                "tags": tags_of(any_map, root),
            }
        )
    return entries


def scan_hdris(root: Path) -> list[dict]:
    out = []
    for p in root.rglob("*"):
        if p.suffix.lower() in (".hdr", ".exr") and not kind_of(p.stem):
            out.append(
                {
                    "id": f"hdri:{p.relative_to(root).as_posix()}",
                    "kind": "hdri",
                    "name": p.stem,
                    "root": str(root),
                    "path": str(p),
                    "tags": tags_of(p, root),
                }
            )
    return out


def scan_blends(root: Path) -> list[dict]:
    blends = [p for p in root.rglob("*.blend") if not p.name.startswith(".")]
    if not blends:
        return []
    blender = os.environ.get("BLENDER") or (
        "/Applications/Blender.app/Contents/MacOS/Blender"
        if Path("/Applications/Blender.app").exists()
        else "blender"
    )
    cli = ROOT / "scripts" / "crystal" / "blender" / "cli.py"
    lst = OUT_DIR / "blend-files.json"
    lst.write_text(json.dumps([str(b) for b in blends]))
    res = subprocess.run(
        [blender, "-b", "--factory-startup", "-P", str(cli), "--", "blend-assets", "--files", str(lst)],
        capture_output=True,
        text=True,
    )
    out = []
    for line in res.stdout.splitlines():
        if not line.startswith("[crystal-asset] "):
            continue
        a = json.loads(line[16:])
        p = Path(a["file"])
        out.append(
            {
                "id": f"blend:{p.relative_to(root).as_posix()}#{a['material']}",
                "kind": "blend",
                "name": a["material"],
                "root": str(root),
                "path": str(p),
                "material": a["material"],
                "asset": a.get("asset", False),
                "tags": sorted(set(tags_of(p, root) + [t.lower() for t in a.get("tags", [])])),
            }
        )
    return out


def main(argv: list[str]) -> int:
    roots = roots_from(argv)
    if not roots:
        print(
            "No library roots. Set CRYSTAL_LIBRARY=/path/to/library or write "
            ".crystal/library/roots.json  {\"roots\": [\"~/Assets/Materials\"]}",
            file=sys.stderr,
        )
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entries: dict[str, dict] = {}
    for r in roots:
        for e in scan_textures(r) + scan_hdris(r) + (scan_blends(r) if "--blend" in argv else []):
            entries[e["id"]] = e
    cat = {"roots": [str(r) for r in roots], "count": len(entries), "entries": entries}
    CATALOG.write_text(json.dumps(cat, indent=1) + "\n")
    kinds: dict[str, int] = {}
    for e in entries.values():
        kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
    print(f"library: {len(entries)} entries ({', '.join(f'{k} {n}' for k, n in sorted(kinds.items()))}) → {CATALOG.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
