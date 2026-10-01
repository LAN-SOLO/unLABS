"""Crystallisation proper: voxels → smooth field → iso surface (OpenVDB).

The voxel occupancy is upsampled to ``cell`` source voxels, Gaussian
blurred (σ = ``blur`` voxels) and meshed at the 0.5 iso level:

* a flat side of a model blurs to a half-space → its iso surface is still
  exactly planar, in place (big planes stay big planes);
* staircases (the voxel diagonals) melt into the slope they stand for;
* convex edges round with a radius ≈ σ, concave ones get a fillet.

Kept sharp (barely blurred, OR-ed in): screens / LEDs / glass
(``sharpClasses``, ``sharpNames``; edge softness ``sharpBevel``). Thin parts
(a voxel with nothing on both sides along an axis would evaporate under the
blur) get their own small blur (``thinBlur``) and a gain (``thinGain``), so
plates and rods come out round instead of as cubes.
"""

from __future__ import annotations

import bpy
import numpy as np
import openvdb as vdb

from .dump import VoxelDump
from .shell import to_blender


def _gauss_blur(a: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0:
        return a
    r = max(1, int(np.ceil(3 * sigma)))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    k /= k.sum()
    out = a
    for axis in range(3):
        acc = np.zeros_like(out)
        for i, w in enumerate(k):
            acc += w * np.roll(out, i - r, axis=axis)
        out = acc
    return out


def thin_mask(occ: np.ndarray) -> np.ndarray:
    """Voxels with empty space on both sides along some axis (1-voxel plates, rods)."""
    pad = np.pad(occ, 1)
    thin = np.zeros_like(occ)
    for axis in range(3):
        a = np.roll(pad, 1, axis=axis)[1:-1, 1:-1, 1:-1]
        b = np.roll(pad, -1, axis=axis)[1:-1, 1:-1, 1:-1]
        thin |= occ & ~a & ~b
    return thin


def adaptive_cell(dump: VoxelDump, prof: dict) -> float:
    """Sampling cell: the profile's `cell`, coarser when the model's surface would
    produce far more triangles than its budget (decimating millions of faces
    costs minutes; a coarser field costs nothing and looks the same after it)."""
    cell = float(prof.get("cell", 0.25))
    budget = float(prof.get("maxTris", 30000))
    occ = dump.labels > 0
    exposed = 0
    for axis in range(3):
        a = np.pad(occ, 1)
        exposed += int((a & ~np.roll(a, 1, axis=axis)).sum() + (a & ~np.roll(a, -1, axis=axis)).sum())
    # ≈ 2 triangles per fine cell of surface, about 6× the budget before reduction.
    area = exposed * dump.unit * dump.unit
    need = (2.0 * area / (6.0 * budget)) ** 0.5
    return max(cell, min(need, dump.unit * 0.5))


def field(dump: VoxelDump, prof: dict) -> tuple[np.ndarray, float, int]:
    """Signed field (inside < 0) on the fine lattice, the fine cell size, the pad."""
    labels = dump.labels
    occ = labels > 0
    k = max(1, int(round(dump.unit / adaptive_cell(dump, prof))))
    cell = dump.unit / k
    sharp_classes = set(prof.get("sharpClasses", ["emit", "glass"]))
    sharp_names = set(prof.get("sharpNames", []))
    is_sharp_label = np.zeros(256, dtype=bool)
    for i, e in enumerate(dump.palette, start=1):
        is_sharp_label[i] = e.mat in sharp_classes or e.name in sharp_names
    sharp = is_sharp_label[labels] & occ
    thin = thin_mask(occ) & ~sharp if prof.get("keepThin", True) else np.zeros_like(occ)
    soft = occ & ~sharp
    sigma = float(prof.get("blur", 0.6)) * k  # in fine cells
    pad = int(np.ceil(3 * sigma)) + 2

    def up(m: np.ndarray) -> np.ndarray:
        u = np.repeat(np.repeat(np.repeat(m, k, 0), k, 1), k, 2).astype(np.float32)
        return np.pad(u, pad)

    # Blur the soft body together with the sharp parts (so they fuse cleanly),
    # then OR the sharp parts back in at full strength.
    dens = _gauss_blur(up(soft | sharp), sigma)
    sharp_up = up(sharp)
    if prof.get("sharpBevel", 0.0) > 0:
        sharp_up = np.minimum(1.0, _gauss_blur(sharp_up, float(prof["sharpBevel"]) * k) * 2.0)
    dens = np.maximum(dens, sharp_up)
    if thin.any():
        # Thin plates / rods: rounded with a small blur, boosted so they survive the iso cut.
        tb = float(prof.get("thinBlur", 0.3)) * k
        dens = np.maximum(dens, np.minimum(1.0, _gauss_blur(up(thin), tb) * float(prof.get("thinGain", 1.7))))
    return (0.5 - dens).astype(np.float32), cell, pad


def sdf_object(dump: VoxelDump, prof: dict, name: str) -> bpy.types.Object:
    f, cell, pad = field(dump, prof)
    grid = vdb.FloatGrid(background=0.5)
    grid.copyFromArray(f)
    pts, tris, quads = grid.convertToPolygons(isovalue=0.0, adaptivity=float(prof.get("adaptivity", 0.0)))
    if len(pts) == 0:
        raise ValueError(f"{dump.id}: empty iso surface")
    # Lattice index i ↔ fine cell centre (i - pad + 0.5) · cell in game space.
    game = (np.asarray(pts, dtype=np.float64) - pad + 0.5) * cell
    vb = to_blender(game)
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new(name)
    tris = np.asarray(tris, dtype=np.int32)
    quads = np.asarray(quads, dtype=np.int32)
    faces = [list(t) for t in tris] + [list(q) for q in quads]
    me.from_pydata(vb.tolist(), [], faces)
    me.update(calc_edges=True)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    _orient_outward(ob)
    ob["crystal_id"] = dump.id
    ob["crystal_key"] = dump.key
    return ob


def _orient_outward(ob: bpy.types.Object) -> None:
    """OpenVDB's winding depends on the sign convention — make normals point out."""
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
