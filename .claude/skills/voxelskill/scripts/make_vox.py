#!/usr/bin/env python3
"""Write MagicaVoxel .vox files (stdlib only) — from JSON or built-in demo props.

Usage:
  make_vox.py --demo tree|house|crate|lamp|coin|all --out DIR
  make_vox.py --json model.json --out model.vox

JSON input (MagicaVoxel axes, z = up; colors are palette indices 1..255):
  {
    "palette": ["#6b4a2b", "#3f9b3a", ...],        # entry i -> palette index i+1
    "models": [
      {"name": "trunk", "size": [3, 3, 8], "translation": [0, 0, 4],
       "voxels": [[1, 1, 0, 1], ...],              # [x, y, z, colorIndex]
       "boxes":  [[0, 0, 0, 3, 3, 8, 1]]}          # [x0, y0, z0, x1, y1, z1, color], max exclusive
    ],
    "materials": {"5": {"_type": "_emit", "_emit": "1"}}
  }
The file opens in MagicaVoxel with every model placed in the world editor.
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path


def _chunk(cid: bytes, content: bytes, children: bytes = b"") -> bytes:
    return cid + struct.pack("<ii", len(content), len(children)) + content + children


def _string(s: str) -> bytes:
    b = s.encode("utf-8")
    return struct.pack("<i", len(b)) + b


def _dict(d: dict[str, str]) -> bytes:
    return struct.pack("<i", len(d)) + b"".join(_string(k) + _string(str(v)) for k, v in d.items())


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"invalid color '{h}', expected #rrggbb")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


class Model:
    def __init__(self, size: tuple[int, int, int], name: str = "", translation: tuple[int, int, int] | None = None):
        if any(not 1 <= s <= 256 for s in size):
            raise ValueError(f"model size {size} outside 1..256")
        self.size = size
        self.name = name
        # Default: stand on z = 0 in MagicaVoxel (pivot is floor(size/2)).
        self.translation = translation if translation is not None else (0, 0, size[2] // 2)
        self.voxels: dict[tuple[int, int, int], int] = {}

    def set(self, x: int, y: int, z: int, c: int) -> None:
        if not (0 <= x < self.size[0] and 0 <= y < self.size[1] and 0 <= z < self.size[2]):
            return
        if not 0 <= c <= 255:
            raise ValueError(f"color index {c} outside 0..255")
        if c == 0:
            self.voxels.pop((x, y, z), None)
        else:
            self.voxels[(x, y, z)] = c

    def box(self, x0: int, y0: int, z0: int, x1: int, y1: int, z1: int, c: int) -> None:
        for z in range(z0, z1):
            for y in range(y0, y1):
                for x in range(x0, x1):
                    self.set(x, y, z, c)


def write_vox(path: Path, models: list[Model], palette: list[str], materials: dict[int, dict[str, str]] | None = None) -> None:
    if not models:
        raise ValueError("need at least one model")
    if len(palette) > 255:
        raise ValueError("palette holds at most 255 colors")
    body = b""
    for m in models:
        body += _chunk(b"SIZE", struct.pack("<iii", *m.size))
        xyzi = b"".join(struct.pack("<BBBB", x, y, z, c) for (x, y, z), c in sorted(m.voxels.items()))
        body += _chunk(b"XYZI", struct.pack("<i", len(m.voxels)) + xyzi)
    # Scene graph: 0 root nTRN -> 1 nGRP -> (nTRN, nSHP) per model.
    body += _chunk(b"nTRN", struct.pack("<i", 0) + _dict({}) + struct.pack("<iiii", 1, -1, -1, 1) + _dict({}))
    kids = [2 + 2 * k for k in range(len(models))]
    body += _chunk(b"nGRP", struct.pack("<i", 1) + _dict({}) + struct.pack("<i", len(kids)) + b"".join(struct.pack("<i", k) for k in kids))
    for k, m in enumerate(models):
        attrs = {"_name": m.name} if m.name else {}
        t = " ".join(str(v) for v in m.translation)
        body += _chunk(b"nTRN", struct.pack("<i", 2 + 2 * k) + _dict(attrs) + struct.pack("<iiii", 3 + 2 * k, -1, 0, 1) + _dict({"_t": t}))
        body += _chunk(b"nSHP", struct.pack("<i", 3 + 2 * k) + _dict({}) + struct.pack("<i", 1) + struct.pack("<i", k) + _dict({}))
    rgba = bytearray(1024)
    for i, h in enumerate(palette):
        r, g, b = hex_rgb(h)
        rgba[i * 4:i * 4 + 4] = bytes((r, g, b, 255))
    body += _chunk(b"RGBA", bytes(rgba))
    for mid, props in sorted((materials or {}).items()):
        body += _chunk(b"MATL", struct.pack("<i", mid) + _dict(props))
    data = b"VOX " + struct.pack("<i", 150) + _chunk(b"MAIN", b"", body)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


# ---------------------------------------------------------------- demo props
# Shared prop palette so all demo assets match (index = position + 1).
PROP_PALETTE = [
    "#6b4a2b",  # 1 bark
    "#3f9b3a",  # 2 leaves
    "#2f7a2e",  # 3 leaves dark
    "#d9c7a0",  # 4 plaster
    "#b5452f",  # 5 roof
    "#8a5a35",  # 6 wood
    "#5b3b22",  # 7 wood dark
    "#9aa3ad",  # 8 stone
    "#ffd76a",  # 9 lamp light (emit)
    "#8fd3ff",  # 10 window (glass)
    "#3b3f46",  # 11 iron
    "#ffc933",  # 12 gold
    "#c9901a",  # 13 gold dark
]


def demo_tree() -> list[Model]:
    m = Model((9, 9, 14), "tree")
    m.box(3, 3, 0, 6, 6, 6, 1)
    for z in range(5, 13):
        r = 4 - abs(z - 8) // 2
        for y in range(9):
            for x in range(9):
                if (x - 4) ** 2 + (y - 4) ** 2 <= r * r:
                    m.set(x, y, z, 2 if (x + y + z) % 4 else 3)
    return [m]


def demo_house() -> list[Model]:
    m = Model((14, 12, 14), "house")
    m.box(0, 0, 0, 14, 12, 1, 8)                     # foundation
    m.box(1, 1, 1, 13, 11, 8, 4)                     # walls
    m.box(2, 2, 1, 12, 10, 8, 0)                     # hollow
    m.box(6, 0, 1, 8, 2, 5, 7)                       # door
    for x0 in (2, 10):
        m.box(x0, 0, 4, x0 + 2, 2, 6, 10)            # windows front
    for z in range(8, 14):                           # gable roof along x
        inset = z - 8
        m.box(0, inset, z, 14, 12 - inset, z + 1, 5)
    return [m]


def demo_crate() -> list[Model]:
    m = Model((6, 6, 6), "crate")
    m.box(0, 0, 0, 6, 6, 6, 6)
    for a in range(6):
        for b in (0, 5):
            for c in (0, 5):
                m.set(a, b, c, 7); m.set(b, a, c, 7); m.set(b, c, a, 7)
    return [m]


def demo_lamp() -> list[Model]:
    m = Model((3, 3, 9), "lamp")
    m.box(1, 1, 0, 2, 2, 7, 11)
    m.box(0, 0, 6, 3, 3, 9, 11)
    m.set(1, 1, 7, 9)
    m.box(0, 1, 7, 3, 2, 8, 9)
    m.box(1, 0, 7, 2, 3, 8, 9)
    return [m]


def demo_coin() -> list[Model]:
    m = Model((5, 1, 5), "coin")
    for z in range(5):
        for x in range(5):
            if (x - 2) ** 2 + (z - 2) ** 2 <= 5:
                m.set(x, 0, z, 13 if (x - 2) ** 2 + (z - 2) ** 2 >= 4 else 12)
    return [m]


DEMOS = {"tree": demo_tree, "house": demo_house, "crate": demo_crate, "lamp": demo_lamp, "coin": demo_coin}
DEMO_MATERIALS = {9: {"_type": "_emit", "_emit": "1", "_flux": "1"}, 10: {"_type": "_glass", "_alpha": "0.5"}, 11: {"_type": "_metal", "_metal": "0.8", "_rough": "0.3"}}


def from_json(spec: dict) -> tuple[list[Model], list[str], dict[int, dict[str, str]]]:
    models = []
    for ms in spec["models"]:
        t = ms.get("translation")
        m = Model(tuple(ms["size"]), ms.get("name", ""), tuple(t) if t else None)
        for x0, y0, z0, x1, y1, z1, c in ms.get("boxes", []):
            m.box(x0, y0, z0, x1, y1, z1, c)
        for x, y, z, c in ms.get("voxels", []):
            m.set(x, y, z, c)
        models.append(m)
    mats = {int(k): {kk: str(vv) for kk, vv in v.items()} for k, v in spec.get("materials", {}).items()}
    return models, spec["palette"], mats


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--demo", choices=[*DEMOS, "all"])
    src.add_argument("--json", type=Path)
    ap.add_argument("--out", type=Path, required=True, help="output .vox file (--json) or directory (--demo)")
    a = ap.parse_args()
    try:
        if a.json:
            models, palette, mats = from_json(json.loads(a.json.read_text()))
            write_vox(a.out, models, palette, mats)
            print(f"wrote {a.out} ({sum(len(m.voxels) for m in models)} voxels, {len(models)} models)")
        else:
            names = list(DEMOS) if a.demo == "all" else [a.demo]
            for n in names:
                path = a.out / f"{n}.vox"
                models = DEMOS[n]()
                write_vox(path, models, PROP_PALETTE, DEMO_MATERIALS)
                print(f"wrote {path} ({sum(len(m.voxels) for m in models)} voxels)")
    except (ValueError, KeyError, json.JSONDecodeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
