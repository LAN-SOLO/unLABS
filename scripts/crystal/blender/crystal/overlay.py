"""Weathering overlays: palette colours that are dirt, not paint.

In the voxel models grime, dust or soot are single voxels sprinkled over a
surface — in a real render they must not be hard-edged islands of another
colour. Overlay colours (``profiles.json → overlays``: name → strength) are
removed from the shape's colour labels (the neighbouring paint grows into
them) and come back as a soft field: blurred occupancy, sampled per vertex,
mixed over the paint with the overlay's own colour.
"""

from __future__ import annotations

import numpy as np

from .dump import VoxelDump
from .sdf import _gauss_blur


def split(dump: VoxelDump, overlays: dict[str, float]) -> tuple[VoxelDump, list[tuple[np.ndarray, tuple, float]]]:
    """(dump with overlay voxels repainted, [(mask, linear colour, strength), …])."""
    if not overlays:
        return dump, []
    labels = dump.labels
    over = {i: overlays[e.name] for i, e in enumerate(dump.palette, start=1) if e.name in overlays}
    if not over:
        return dump, []
    is_over = np.isin(labels, list(over))
    fields = [((labels == i), dump.entry(i).linear, s) for i, s in over.items()]
    # Grow the surrounding paint into the overlay cells (6-neighbour flood, a few rounds).
    out = labels.copy()
    hole = is_over.copy()
    out[hole] = 0
    for _ in range(8):
        if not hole.any():
            break
        grown = out.copy()
        for axis in range(3):
            for sign in (1, -1):
                nb = np.roll(out, sign, axis=axis)
                sl = [slice(None)] * 3
                sl[axis] = 0 if sign > 0 else -1
                nb[tuple(sl)] = 0
                take = hole & (grown == 0) & (nb != 0)
                grown[take] = nb[take]
        out = grown
        hole = is_over & (out == 0)
    # Fully enclosed overlay blobs (no paint around): keep them as they were.
    out[hole] = labels[hole]
    repainted = VoxelDump(
        id=dump.id,
        name=dump.name,
        labels=out,
        palette=dump.palette,
        key=dump.key,
        family=dump.family,
        unit=dump.unit,
        center=dump.center,
        meta=dump.meta,
    )
    return repainted, fields


def sample(
    mask: np.ndarray, pts_game: np.ndarray, unit: float, sigma: float = 0.7, gain: float = 2.0
) -> np.ndarray:
    """Blurred mask at game-space points (× `gain`, clipped to 0..1; gain 2 reads a full patch as solid)."""
    pad = int(np.ceil(3 * sigma)) + 1
    g = _gauss_blur(np.pad(mask.astype(np.float32), pad), sigma)
    p = pts_game / unit - 0.5 + pad
    i0 = np.floor(p).astype(int)
    f = p - i0
    i0 = np.clip(i0, 0, np.array(g.shape) - 2)
    v = np.zeros(len(p), dtype=np.float32)
    for dx in (0, 1):
        wx = f[:, 0] if dx else 1 - f[:, 0]
        for dy in (0, 1):
            wy = f[:, 1] if dy else 1 - f[:, 1]
            for dz in (0, 1):
                wz = f[:, 2] if dz else 1 - f[:, 2]
                v += wx * wy * wz * g[i0[:, 0] + dx, i0[:, 1] + dy, i0[:, 2] + dz]
    return np.clip(v * gain, 0.0, 1.0)
