"""Voxel grid → closed quad shell (exposed faces only), vectorised with numpy.

Coordinates: the shell is built in GAME axes (x, y up, z towards the viewer)
in source-voxel units (cell size = dump.unit), origin at the grid's min
corner — exactly the engine's mesh space before centring. ``to_blender``
maps game → Blender (x, -z, y), a proper rotation, so face winding survives;
the glTF exporter (+Y up) maps it back.
"""

from __future__ import annotations

import numpy as np

# (axis, sign) → (u, w) axes with u × w = sign · e_axis (outward normal, CCW quads).
_FACE_AXES = {0: (1, 2), 1: (2, 0), 2: (0, 1)}


def shell(labels: np.ndarray, unit: float):
    """Return (verts (n,3) float game-space, quads (m,4) int, face_labels (m,) uint8)."""
    sx, sy, sz = labels.shape
    pad = np.zeros((sx + 2, sy + 2, sz + 2), dtype=labels.dtype)
    pad[1:-1, 1:-1, 1:-1] = labels
    corner_quads = []
    face_labels = []
    for axis in range(3):
        u, w = _FACE_AXES[axis]
        for sign in (1, -1):
            nb = np.roll(pad, -sign, axis=axis)
            mask = (pad != 0) & (nb == 0)
            mask[0, :, :] = mask[-1, :, :] = False
            mask[:, 0, :] = mask[:, -1, :] = False
            mask[:, :, 0] = mask[:, :, -1] = False
            idx = np.argwhere(mask) - 1  # cell coords in the unpadded grid
            if idx.size == 0:
                continue
            base = idx.copy()
            if sign > 0:
                base[:, axis] += 1
            eu = np.zeros(3, dtype=int)
            ew = np.zeros(3, dtype=int)
            eu[u] = 1
            ew[w] = 1
            c0 = base
            c1 = base + eu
            c2 = base + eu + ew
            c3 = base + ew
            quad = np.stack([c0, c1, c2, c3], axis=1)  # (m, 4, 3)
            if sign < 0:
                quad = quad[:, ::-1, :]
            corner_quads.append(quad)
            face_labels.append(labels[idx[:, 0], idx[:, 1], idx[:, 2]])
    if not corner_quads:
        raise ValueError("empty grid")
    quads3 = np.concatenate(corner_quads)
    flab = np.concatenate(face_labels).astype(np.uint8)
    flat = quads3.reshape(-1, 3)
    # Lattice point id → shared vertex.
    lid = flat[:, 0] + (sx + 1) * (flat[:, 1] + (sy + 1) * flat[:, 2])
    uniq, inv = np.unique(lid, return_inverse=True)
    z = uniq // ((sx + 1) * (sy + 1))
    rem = uniq % ((sx + 1) * (sy + 1))
    y = rem // (sx + 1)
    x = rem % (sx + 1)
    verts = np.stack([x, y, z], axis=1).astype(np.float64) * unit
    quads = inv.reshape(-1, 4)
    return verts, quads, flab


def to_blender(v: np.ndarray) -> np.ndarray:
    """Game (x, y up, z) → Blender (x, -z, y)."""
    return np.stack([v[:, 0], -v[:, 2], v[:, 1]], axis=1)


def to_game(v: np.ndarray) -> np.ndarray:
    """Blender (x, y, z up) → game (x, z, -y)."""
    return np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1)


def dilate_labels(labels: np.ndarray, steps: int = 3) -> np.ndarray:
    """Grow labels into empty space (nearest-ish label for points just outside the voxels)."""
    out = labels.copy()
    for _ in range(steps):
        empty = out == 0
        if not empty.any():
            break
        grown = out.copy()
        for axis in range(3):
            for sign in (1, -1):
                nb = np.roll(out, sign, axis=axis)
                # Don't wrap around the borders.
                sl = [slice(None)] * 3
                sl[axis] = 0 if sign > 0 else -1
                nb[tuple(sl)] = 0
                take = empty & (grown == 0) & (nb != 0)
                grown[take] = nb[take]
        out = grown
    return out


def label_at(labels_dilated: np.ndarray, pts_game: np.ndarray, unit: float) -> np.ndarray:
    """Palette label of the cell containing each game-space point (0 = none)."""
    c = np.floor(pts_game / unit).astype(int)
    sx, sy, sz = labels_dilated.shape
    ok = (c[:, 0] >= 0) & (c[:, 1] >= 0) & (c[:, 2] >= 0) & (c[:, 0] < sx) & (c[:, 1] < sy) & (c[:, 2] < sz)
    out = np.zeros(len(pts_game), dtype=np.uint8)
    cc = c[ok]
    out[ok] = labels_dilated[cc[:, 0], cc[:, 1], cc[:, 2]]
    return out


def smooth_labels_at(labels: np.ndarray, pts_game: np.ndarray, unit: float, sigma: float) -> np.ndarray:
    """Argmax of Gaussian-blurred per-colour occupancy, trilinearly sampled (0 = none)."""
    from .sdf import _gauss_blur

    used = [int(x) for x in np.unique(labels) if x]
    pad = int(np.ceil(3 * sigma)) + 1
    p = pts_game / unit - 0.5 + pad  # cell-centre lattice coords in the padded grid
    i0 = np.floor(p).astype(int)
    f = p - i0
    shape = np.array(labels.shape) + 2 * pad
    i0 = np.clip(i0, 0, shape - 2)
    best = np.zeros(len(p), dtype=np.float32)
    out = np.zeros(len(p), dtype=np.uint8)
    for lab in used:
        g = _gauss_blur(np.pad((labels == lab).astype(np.float32), pad), sigma)
        v = np.zeros(len(p), dtype=np.float32)
        for dx in (0, 1):
            wx = f[:, 0] if dx else 1 - f[:, 0]
            for dy in (0, 1):
                wy = f[:, 1] if dy else 1 - f[:, 1]
                for dz in (0, 1):
                    wz = f[:, 2] if dz else 1 - f[:, 2]
                    v += wx * wy * wz * g[i0[:, 0] + dx, i0[:, 1] + dy, i0[:, 2] + dz]
        take = v > best
        best[take] = v[take]
        out[take] = lab
    out[best < 1e-3] = 0
    return out
