"""Voxel dumps (scripts/crystal/export.ts, scripts/merch/export-voxels.ts).

JSON: size [sx, sy, sz] (game axes, y up, front faces +z), a local palette
[{hex, mat, name}], run-length cells in x-fastest order
(index = x + sx * (y + sy * z)), ``runs = [paletteIndex, count, ...]``,
0 = empty. Crystal dumps add ``key`` (the engine's grid hash), ``family``
(RefineFamily), ``unit`` (source voxels per cell: 0.5 for refined grids)
and ``center``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np


@dataclass
class PaletteEntry:
    hex: str
    mat: str
    name: str

    @property
    def linear(self) -> tuple[float, float, float]:
        """sRGB hex → linear RGB (Blender/glTF vertex colours are linear)."""
        h = self.hex.lstrip("#")
        out = []
        for i in (0, 2, 4):
            c = int(h[i : i + 2], 16) / 255.0
            out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
        return (out[0], out[1], out[2])


@dataclass
class VoxelDump:
    id: str
    name: str
    labels: np.ndarray  # (sx, sy, sz) uint8, 0 = empty, 1.. = palette index (1-based)
    palette: list[PaletteEntry]
    key: str = ""
    family: str = "default"
    unit: float = 1.0
    center: bool = False
    meta: dict = field(default_factory=dict)

    @property
    def size(self) -> tuple[int, int, int]:
        sx, sy, sz = self.labels.shape
        return (int(sx), int(sy), int(sz))

    def entry(self, label: int) -> PaletteEntry:
        return self.palette[label - 1]


def load_dump(path: str | Path) -> VoxelDump:
    raw = json.loads(Path(path).read_text())
    sx, sy, sz = raw["size"]
    runs = raw["runs"]
    flat = np.empty(sx * sy * sz, dtype=np.uint8)
    pos = 0
    for i in range(0, len(runs), 2):
        v, n = runs[i], runs[i + 1]
        flat[pos : pos + n] = v
        pos += n
    if pos != flat.size:
        raise ValueError(f"{path}: runs cover {pos} cells, expected {flat.size}")
    # x fastest → reshape (z, y, x) then transpose to (x, y, z).
    labels = flat.reshape((sz, sy, sx)).transpose(2, 1, 0).copy()
    palette = [PaletteEntry(p["hex"], p["mat"], p["name"]) for p in raw["palette"]]
    known = {"id", "name", "size", "palette", "runs", "key", "family", "unit", "center"}
    return VoxelDump(
        id=raw["id"],
        name=raw.get("name", raw["id"]),
        labels=labels,
        palette=palette,
        key=raw.get("key", ""),
        family=raw.get("family", "default"),
        unit=float(raw.get("unit", 1.0)),
        center=bool(raw.get("center", False)),
        meta={k: v for k, v in raw.items() if k not in known},
    )
