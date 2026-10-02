"""uvox in Python — bit for bit the TypeScript side (lib/voxel/uvox.ts).

A grid is a numpy uint8 array of shape (sz, sy, sx): cell (x, y, z) is
``g[z, y, x]`` and ``g.ravel()`` is the game's order (x fastest). Values are
GAME palette indices (0 = empty). No bpy here — usable outside Blender.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

M32 = 0xFFFFFFFF


def grid_sha(g: np.ndarray) -> str:
    """Two FNV-1a lanes over "<sx>x<sy>x<sz>:" + raw cells (lib/voxel/uvox.ts gridSha)."""
    sz, sy, sx = g.shape
    a = 0x811C9DC5
    b = (0x01000193 ^ 0x5BD1E995) & M32
    p = 0x01000193
    data = f"{sx}x{sy}x{sz}:".encode("ascii") + np.ascontiguousarray(g, dtype=np.uint8).tobytes()
    for byte in data:
        a = ((a ^ byte) * p) & M32
        b = ((b ^ byte ^ 0xA5) * p) & M32
    return f"{a:08x}{b:08x}"


def encode_runs(data: np.ndarray) -> list[int]:
    d = np.ascontiguousarray(data, dtype=np.uint8).ravel()
    if d.size == 0:
        return []
    change = np.flatnonzero(np.diff(d)) + 1
    starts = np.concatenate(([0], change))
    ends = np.concatenate((change, [d.size]))
    out = np.empty(starts.size * 2, dtype=np.int64)
    out[0::2] = d[starts]
    out[1::2] = ends - starts
    return out.tolist()


def decode_runs(runs: list[int], n: int) -> np.ndarray:
    r = np.asarray(runs, dtype=np.int64)
    vals = r[0::2].astype(np.uint8)
    counts = r[1::2]
    if int(counts.sum()) != n:
        raise ValueError(f"uvox: runs cover {int(counts.sum())} of {n} cells")
    return np.repeat(vals, counts)


@dataclass
class Uvox:
    id: str
    grid: np.ndarray  # (sz, sy, sx) uint8
    unit: float = 1.0
    origin: tuple[float, float, float] = (0.0, 0.0, 0.0)
    anchor: tuple[float, float, float] = (0.0, 0.0, 0.0)
    rot_y: float = 0.0
    palette: dict[int, dict[str, Any]] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def size(self) -> tuple[int, int, int]:
        sz, sy, sx = self.grid.shape
        return sx, sy, sz

    @property
    def sha(self) -> str:
        return grid_sha(self.grid)

    def to_json(self) -> dict[str, Any]:
        used = sorted(int(v) for v in np.unique(self.grid) if v)
        missing = [i for i in used if i not in self.palette]
        if missing:
            raise ValueError(f"uvox {self.id}: palette lacks {missing}")
        out: dict[str, Any] = {
            "format": "uvox",
            "version": 1,
            "id": self.id,
            "size": list(self.size),
            "unit": self.unit,
            "origin": list(self.origin),
            "anchor": list(self.anchor),
            "rotY": self.rot_y,
            "palette": [{"index": i, **{k: self.palette[i][k] for k in ("rgb", "mat", "name")}} for i in used],
            "runs": encode_runs(self.grid),
            "sha": self.sha,
        }
        if self.meta:
            out["meta"] = self.meta
        return out


def from_json(d: dict[str, Any], *, check: bool = True) -> Uvox:
    if d.get("format") != "uvox":
        raise ValueError("not a uvox model")
    sx, sy, sz = d["size"]
    g = decode_runs(d["runs"], sx * sy * sz).reshape(sz, sy, sx)
    m = Uvox(
        id=d["id"],
        grid=g,
        unit=float(d["unit"]),
        origin=tuple(d.get("origin", (0, 0, 0))),
        anchor=tuple(d.get("anchor", (0, 0, 0))),
        rot_y=float(d.get("rotY", 0.0)),
        palette={int(p["index"]): {"rgb": list(p["rgb"]), "mat": p["mat"], "name": p["name"]} for p in d["palette"]},
        meta=dict(d.get("meta", {})),
    )
    if check and m.sha != d["sha"]:
        raise ValueError(f"uvox {m.id}: sha {m.sha} != {d['sha']}")
    return m


def load(path: str | Path) -> Uvox | list[Uvox]:
    """A uvox model, or the parts of a uvox-scene."""
    d = json.loads(Path(path).read_text())
    if d.get("format") == "uvox-scene":
        return [from_json(p) for p in d["parts"]]
    return from_json(d)


def save(m: Uvox, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(m.to_json()))
    return path
