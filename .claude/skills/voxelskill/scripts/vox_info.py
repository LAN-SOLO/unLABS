#!/usr/bin/env python3
"""Inspect a MagicaVoxel .vox file (stdlib only).

Usage: vox_info.py FILE.vox [--json]

Prints version, chunk counts, models (size, voxel count, colors used),
scene graph (transforms with name/translation/rotation/layer), layers,
materials (MATL) and palette entries actually used. Exit 1 on malformed files.
"""
from __future__ import annotations

import json
import struct
import sys
from collections import Counter
from pathlib import Path


class Reader:
    def __init__(self, data: bytes, pos: int = 0):
        self.d, self.p = data, pos

    def i32(self) -> int:
        if self.p + 4 > len(self.d):
            raise ValueError(f"truncated at byte {self.p}")
        v = struct.unpack_from("<i", self.d, self.p)[0]
        self.p += 4
        return v

    def cid(self) -> str:
        s = self.d[self.p:self.p + 4].decode("ascii", "replace")
        self.p += 4
        return s

    def string(self) -> str:
        n = self.i32()
        s = self.d[self.p:self.p + n].decode("utf-8", "replace")
        self.p += n
        return s

    def dict(self) -> dict[str, str]:
        return {self.string(): self.string() for _ in range(self.i32())}


def parse(data: bytes) -> dict:
    r = Reader(data)
    if r.cid() != "VOX ":
        raise ValueError("missing 'VOX ' magic — not a .vox file")
    info: dict = {"version": r.i32(), "chunks": Counter(), "models": [], "nodes": {}, "layers": [], "materials": {}, "palette": None}
    if r.cid() != "MAIN":
        raise ValueError("expected MAIN chunk")
    content, children = r.i32(), r.i32()
    r.p += content
    end = r.p + children
    size = None
    while r.p < end:
        cid, n, m = r.cid(), r.i32(), r.i32()
        nxt = r.p + n + m
        info["chunks"][cid] += 1
        if cid == "SIZE":
            size = (r.i32(), r.i32(), r.i32())
        elif cid == "XYZI":
            count = r.i32()
            colors = Counter(data[r.p + i * 4 + 3] for i in range(count))
            info["models"].append({"size": size, "voxels": count, "colors": dict(sorted(colors.items()))})
        elif cid == "RGBA":
            info["palette"] = [data[r.p + i * 4:r.p + i * 4 + 4].hex() for i in range(255)]
        elif cid == "nTRN":
            nid, attrs, child = r.i32(), r.dict(), r.i32()
            r.i32()
            layer, nframes = r.i32(), r.i32()
            frames = [r.dict() for _ in range(nframes)]
            info["nodes"][nid] = {"kind": "transform", "attrs": attrs, "child": child, "layer": layer, "frames": frames}
        elif cid == "nGRP":
            nid, attrs = r.i32(), r.dict()
            info["nodes"][nid] = {"kind": "group", "attrs": attrs, "children": [r.i32() for _ in range(r.i32())]}
        elif cid == "nSHP":
            nid, attrs = r.i32(), r.dict()
            models = []
            for _ in range(r.i32()):
                models.append({"model": r.i32(), "attrs": r.dict()})
            info["nodes"][nid] = {"kind": "shape", "attrs": attrs, "models": models}
        elif cid == "LAYR":
            lid, attrs = r.i32(), r.dict()
            info["layers"].append({"id": lid, **attrs})
        elif cid == "MATL":
            mid = r.i32()
            info["materials"][mid] = r.dict()
        r.p = nxt
    info["chunks"] = dict(info["chunks"])
    return info


def print_tree(info: dict, nid: int = 0, depth: int = 0) -> None:
    node = info["nodes"].get(nid)
    if node is None:
        return
    pad = "  " * depth
    if node["kind"] == "transform":
        f = node["frames"][0] if node["frames"] else {}
        name = node["attrs"].get("_name", "")
        extra = f" t=({f.get('_t', '0 0 0')}) r={f.get('_r', '4')}" + (f" frames={len(node['frames'])}" if len(node["frames"]) > 1 else "")
        print(f"{pad}nTRN {nid} {name!r} layer={node['layer']}{extra}")
        print_tree(info, node["child"], depth + 1)
    elif node["kind"] == "group":
        print(f"{pad}nGRP {nid} ({len(node['children'])} children)")
        for c in node["children"]:
            print_tree(info, c, depth + 1)
    else:
        print(f"{pad}nSHP {nid} -> models {[m['model'] for m in node['models']]}")


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0 if argv else 1
    path = Path(argv[0])
    try:
        info = parse(path.read_bytes())
    except (OSError, ValueError, struct.error) as e:
        print(f"error: {path}: {e}", file=sys.stderr)
        return 1
    if "--json" in argv:
        print(json.dumps(info, indent=2))
        return 0
    print(f"{path}  version={info['version']}  chunks={info['chunks']}")
    used = Counter()
    for i, m in enumerate(info["models"]):
        used.update(m["colors"])
        print(f"  model {i}: size={m['size'][0]}x{m['size'][1]}x{m['size'][2]} (x,y,z-up)  voxels={m['voxels']}  colors={len(m['colors'])}")
    if info["nodes"]:
        print("scene:")
        print_tree(info, 0, 1)
    for layer in info["layers"]:
        print(f"  layer {layer['id']}: {layer.get('_name', '')} hidden={layer.get('_hidden', '0')}")
    mats = {k: v for k, v in info["materials"].items() if v.get("_type", "_diffuse") != "_diffuse"}
    if mats:
        print("non-diffuse materials:")
        for k, v in sorted(mats.items()):
            print(f"  {k}: {v}")
    if info["palette"]:
        print("palette used (index: rrggbbaa × count):")
        print("  " + ", ".join(f"{c}: {info['palette'][c - 1]}×{n}" for c, n in sorted(used.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
