"""Voxel operations — every result is still a voxel grid on a lattice.

Pure numpy (no bpy) except `voxelize_object`. Grids are uint8 (sz, sy, sx)
with GAME palette indices; all ops are exact (no resampling blur, no
rounding of colours). Sizes: a model's `unit` is its voxel edge in world
units; models of different units combine exactly when the coarser unit is
an integer multiple of the finer one and every origin sits on the finer
lattice (`combine`), which is how fine detail is mounted on coarse bodies
without losing a single voxel.
"""

from __future__ import annotations

import math
from dataclasses import replace
from typing import Iterable

import numpy as np

from .uvox import Uvox

EPS = 1e-6


def _ratio(a: float, b: float) -> int | None:
    r = a / b
    return int(round(r)) if abs(r - round(r)) < EPS else None


# ── Size ─────────────────────────────────────────────────────────


def upsample(m: Uvox, k: int) -> Uvox:
    """Each voxel → k×k×k voxels; the unit shrinks by k (same shape, finer lattice)."""
    if k < 1 or int(k) != k:
        raise ValueError("upsample: k must be a positive integer")
    g = m.grid.repeat(k, 0).repeat(k, 1).repeat(k, 2)
    return replace(m, grid=g, unit=m.unit / k, anchor=tuple(a * k for a in m.anchor))


def downsample(m: Uvox, k: int, *, rule: str = "majority") -> Uvox:
    """k×k×k blocks → one voxel (unit × k). `majority`: most common non-empty
    colour if at least half the block is filled; `any`: filled if any voxel is.
    Lossy by nature — the only op here that is."""
    sz, sy, sx = m.grid.shape
    pz, py, px = (-sz) % k, (-sy) % k, (-sx) % k
    g = np.pad(m.grid, ((0, pz), (0, py), (0, px)))
    Z, Y, X = g.shape[0] // k, g.shape[1] // k, g.shape[2] // k
    blocks = g.reshape(Z, k, Y, k, X, k).transpose(0, 2, 4, 1, 3, 5).reshape(Z, Y, X, k**3)
    out = np.zeros((Z, Y, X), dtype=np.uint8)
    filled = (blocks > 0).sum(-1)
    need = 1 if rule == "any" else (k**3 + 1) // 2
    idx = np.argwhere(filled >= need)
    for z, y, x in idx:
        b = blocks[z, y, x]
        vals, counts = np.unique(b[b > 0], return_counts=True)
        out[z, y, x] = vals[np.argmax(counts)]
    return replace(m, grid=out, unit=m.unit * k, anchor=tuple(a / k for a in m.anchor))


def refit(m: Uvox) -> Uvox:
    """Crop to the filled box (origin and anchor follow, the voxels stay put)."""
    nz = np.argwhere(m.grid > 0)
    if not len(nz):
        return m
    (z0, y0, x0), (z1, y1, x1) = nz.min(0), nz.max(0) + 1
    g = m.grid[z0:z1, y0:y1, x0:x1].copy()
    ax, ay, az = m.anchor
    return replace(m, grid=g, anchor=(ax - x0, ay - y0, az - z0))


# ── Orientation ──────────────────────────────────────────────────


def rotate_y90(m: Uvox, turns: int = 1) -> Uvox:
    """Quarter turns about +y, three.js sense (lib/voxel/uvox.ts rotateY90)."""
    g = m.grid
    sx = g.shape[2]
    ax, ay, az = m.anchor
    for _ in range(turns % 4):
        sz, sy, sx = g.shape
        # (x, z) → (z, sx − 1 − x): new array indexed [z' = sx−1−x, y, x' = z]
        g = np.transpose(g, (2, 1, 0))[::-1, :, :].copy()
        ax, az = az, sx - ax
    return replace(m, grid=g, anchor=(ax, ay, az))


def mirror(m: Uvox, axis: str) -> Uvox:
    i = {"x": 2, "y": 1, "z": 0}[axis]
    g = np.flip(m.grid, i).copy()
    a = list(m.anchor)
    k = {"x": 0, "y": 1, "z": 2}[axis]
    a[k] = m.grid.shape[i] - a[k]
    return replace(m, grid=g, anchor=tuple(a))


# ── Combining (mixed voxel sizes, exact) ─────────────────────────


def _turned(m: Uvox) -> Uvox:
    """Bake a quarter-turn rotY into the grid (about the anchor), rotY → 0."""
    if abs(math.remainder(m.rot_y, math.pi / 2)) > EPS:
        raise ValueError(f"{m.id}: combine needs quarter-turn rotations")
    turns = int(round(m.rot_y / (math.pi / 2))) % 4
    return rotate_y90(replace(m, rot_y=0.0), turns)


def _place(parts: list[Uvox], unit: float) -> tuple[np.ndarray, list[tuple[np.ndarray, np.ndarray]]]:
    """Every part on the `unit` lattice: (lowest cell, [(upsampled grid, cell of its corner)])."""
    placed = []
    for p in parts:
        r = _turned(p)
        k = _ratio(r.unit, unit)
        if k is None:
            raise ValueError(f"{p.id}: unit {r.unit} is not a multiple of {unit}")
        corner = np.asarray(r.origin, dtype=float) - np.asarray(r.anchor, dtype=float) * r.unit
        cell = [_ratio(c, unit) for c in corner]
        if any(c is None for c in cell):
            raise ValueError(f"{p.id}: corner {corner.tolist()} is off the {unit} lattice")
        g = r.grid.repeat(k, 0).repeat(k, 1).repeat(k, 2)
        placed.append((g, np.asarray(cell, dtype=int)))
    lo = np.min([c for _, c in placed], axis=0)
    return lo, placed


def combine(parts: Iterable[Uvox], unit: float | None = None, *, id: str = "combined") -> Uvox:
    """Merge models (any units, quarter turns) into one grid on the lattice of
    `unit` (default: the finest). Exact or it raises. Later parts win."""
    parts = list(parts)
    unit = unit or min(p.unit for p in parts)
    lo, placed = _place(parts, unit)
    hi = np.max([c + np.asarray(g.shape[::-1]) for g, c in placed], axis=0)
    sx, sy, sz = (hi - lo).tolist()
    out = np.zeros((sz, sy, sx), dtype=np.uint8)
    palette: dict = {}
    for (g, c), p in zip(placed, parts):
        x0, y0, z0 = (c - lo).tolist()
        view = out[z0 : z0 + g.shape[0], y0 : y0 + g.shape[1], x0 : x0 + g.shape[2]]
        view[g > 0] = g[g > 0]
        palette.update(p.palette)
    return Uvox(id=id, grid=out, unit=unit, origin=tuple((lo * unit).tolist()), palette=palette)


def subtract(m: Uvox, cutter: Uvox) -> Uvox:
    """Carve `cutter`'s filled voxels out of `m` (same lattice rules as `combine`)."""
    out = combine([m], min(m.unit, cutter.unit), id=m.id)
    lo, ((cg, cc),) = _place([cutter], out.unit)
    base = np.round(np.asarray(out.origin) / out.unit).astype(int)
    x0, y0, z0 = (cc - base).tolist()
    g = out.grid
    # Overlap of the cutter box with the model box.
    zs, ys, xs = (slice(max(0, a), min(g.shape[i], a + cg.shape[i])) for i, a in enumerate((z0, y0, x0)))
    sub = cg[zs.start - z0 : zs.stop - z0, ys.start - y0 : ys.stop - y0, xs.start - x0 : xs.stop - x0]
    g[zs, ys, xs][sub > 0] = 0
    return refit(replace(out, palette=m.palette))


# ── Primitives (voxel-exact shapes at any size) ──────────────────


def _empty(id: str, sx: int, sy: int, sz: int, unit: float, color: int, palette: dict) -> Uvox:
    return Uvox(id=id, grid=np.zeros((sz, sy, sx), dtype=np.uint8), unit=unit, palette={color: palette[color]})


def box(id: str, size: tuple[int, int, int], color: int, palette: dict, unit: float = 0.125) -> Uvox:
    m = _empty(id, *size, unit, color, palette)
    m.grid[:] = color
    return m


def cylinder(id: str, radius: float, height: int, color: int, palette: dict, unit: float = 0.125, axis: str = "y") -> Uvox:
    """Voxels whose centre lies inside the cylinder (deterministic, symmetric)."""
    d = int(math.ceil(radius * 2))
    c = d / 2
    u = (np.arange(d) + 0.5 - c) ** 2
    disk = (u[:, None] + u[None, :]) <= radius * radius
    g = np.zeros((d, height, d), dtype=np.uint8) if axis == "y" else np.zeros((height, d, d), dtype=np.uint8)
    if axis == "y":
        g[:, :, :] = np.where(disk[:, None, :], color, 0)
    elif axis == "z":
        g[:, :, :] = np.where(disk[None, :, :], color, 0)
    else:
        g = np.zeros((d, d, height), dtype=np.uint8)
        g[:, :, :] = np.where(disk[:, :, None], color, 0)
    return Uvox(id=id, grid=g, unit=unit, palette={color: palette[color]})


def sphere(id: str, radius: float, color: int, palette: dict, unit: float = 0.125, shell: float = 0.0) -> Uvox:
    d = int(math.ceil(radius * 2))
    c = d / 2
    a = np.arange(d) + 0.5 - c
    r2 = a[:, None, None] ** 2 + a[None, :, None] ** 2 + a[None, None, :] ** 2
    inside = r2 <= radius * radius
    if shell > 0:
        inside &= r2 >= (radius - shell) ** 2
    return Uvox(id=id, grid=np.where(inside, color, 0).astype(np.uint8), unit=unit, palette={color: palette[color]})


def paint(m: Uvox, where: np.ndarray, color: int, palette: dict) -> Uvox:
    """Recolour filled voxels selected by a boolean mask (same shape as the grid)."""
    g = m.grid.copy()
    g[where & (g > 0)] = color
    pal = dict(m.palette)
    pal[color] = palette[color]
    return replace(m, grid=g, palette=pal)


def recolor(m: Uvox, mapping: dict[int, int], palette: dict) -> Uvox:
    g = m.grid.copy()
    lut = np.arange(256, dtype=np.uint8)
    for a, b in mapping.items():
        lut[a] = b
    g = lut[g]
    pal = {int(v): palette[int(v)] for v in np.unique(g) if v}
    return replace(m, grid=g, palette=pal)


# ── Mesh → voxels (Blender) ─────────────────────────────────────


def voxelize_object(ob, unit: float, color: int, palette: dict, *, id: str | None = None) -> Uvox:
    """Fill every lattice cell whose centre is inside a closed Blender mesh
    (ray parity along +x, robust against grazing hits by a tiny skew)."""
    import bpy  # noqa: F401  (only here)
    from mathutils.bvhtree import BVHTree

    dg = __import__("bpy").context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(ob, dg)
    mw = ob.matrix_world
    me = ob.evaluated_get(dg).to_mesh()
    pts = np.array([mw @ v.co for v in me.vertices])
    ob.evaluated_get(dg).to_mesh_clear()
    # Blender bounds → game lattice (game x = X, y = Z, z = −Y).
    lo_g = np.array([pts[:, 0].min(), pts[:, 2].min(), (-pts[:, 1]).min()])
    hi_g = np.array([pts[:, 0].max(), pts[:, 2].max(), (-pts[:, 1]).max()])
    c0 = np.floor(lo_g / unit).astype(int)
    c1 = np.ceil(hi_g / unit).astype(int)
    sx, sy, sz = (c1 - c0).tolist()
    g = np.zeros((sz, sy, sx), dtype=np.uint8)
    inv = mw.inverted()
    from mathutils import Vector

    d = (Vector((1.0, 1e-4, 2e-4)) @ inv.to_3x3().transposed()).normalized()
    for z in range(sz):
        for y in range(sy):
            for x in range(sx):
                gx, gy, gz = (c0 + np.array([x, y, z]) + 0.5) * unit
                p = inv @ Vector((gx, -gz, gy))
                hits, q = 0, p
                while True:
                    loc, _n, _i, dist = bvh.ray_cast(q, d)
                    if loc is None:
                        break
                    hits += 1
                    q = loc + d * 1e-5
                if hits % 2 == 1:
                    g[z, y, x] = color
    return Uvox(
        id=id or ob.name,
        grid=g,
        unit=unit,
        origin=tuple((c0 * unit).tolist()),
        palette={color: palette[color]},
    )
