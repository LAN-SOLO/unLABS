"""Voxel clones in Blender: uvox → objects, objects → uvox.

A clone is two objects:

- ``<id>`` — the **shell**: one quad per exposed voxel face, exactly on the
  lattice (no merging, no bevels). Face attributes: ``voxel`` (flat cell
  index, x fastest), ``pal`` (game palette index), ``dir`` (0..5: +x −x +y
  −y +z −z in GAME axes). Corner colours: ``Col`` (palette colour, linear)
  and ``Iso`` (the iso baker's face shading). Material slots: the game's
  four classes solid · glass · emit · metal.
- ``<id>.vox`` (child, hidden in renders) — the **volume**: one vertex per
  voxel at its centre, int attribute ``pal``. Every voxel, inside ones too:
  this is the source of truth `export_uvox` reads, so edits there (add /
  delete vertices, change ``pal``) are real voxel edits; `rebuild_shell`
  turns them into the shell again.

Space: mesh data is in voxel units with game (x, y, z) → Blender (x, −z, y);
the object matrix applies the uvox placement
    world = origin + Ry(rotY) · ((p − anchor) · unit)
so Blender units = game world units.
"""

from __future__ import annotations

import json
import math
from typing import Any

import bpy
import numpy as np
from mathutils import Matrix, Vector

from .uvox import Uvox

CLASSES = ("solid", "glass", "emit", "metal")
# Iso baker face shading (lib/voxel/iso-baker.ts) per game dir: top +y 1, +z (left) 0.78, +x (right) 0.6.
ISO_SHADE = {2: 1.0, 4: 0.78, 0: 0.6}

# Face templates in Blender coords relative to the cell's min corner, CCW from outside.
# dir index = GAME direction: 0 +x, 1 −x, 2 +y, 3 −y, 4 +z, 5 −z.
_FACES = {
    0: ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)),  # +x
    1: ((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)),  # −x
    2: ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)),  # +y game = +Z
    3: ((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)),  # −y game = −Z
    4: ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)),  # +z game = −Y
    5: ((0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)),  # −z game = +Y
}
# Neighbour offset (game dx, dy, dz) per dir.
_NEIGH = {0: (1, 0, 0), 1: (-1, 0, 0), 2: (0, 1, 0), 3: (0, -1, 0), 4: (0, 0, 1), 5: (0, 0, -1)}


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def exposed_faces(g: np.ndarray, dirs: tuple[int, ...] = (0, 1, 2, 3, 4, 5)) -> list[tuple[int, np.ndarray]]:
    """Per game direction: (dir, cells (n, 3) as game x, y, z) whose face there is exposed."""
    occ = g > 0
    pad = np.pad(occ, 1)
    out = []
    for d in dirs:
        dx, dy, dz = _NEIGH[d]
        # pad index of neighbour of cell (z, y, x) is (z+1+dz, y+1+dy, x+1+dx)
        nb = pad[1 + dz : pad.shape[0] - 1 + dz, 1 + dy : pad.shape[1] - 1 + dy, 1 + dx : pad.shape[2] - 1 + dx]
        zyx = np.argwhere(occ & ~nb)
        out.append((d, zyx[:, ::-1].copy()))  # → (x, y, z)
    return out


def _materials() -> list[bpy.types.Material]:
    """The game's four voxel material classes (lib/world/render/voxel-mesh.ts)."""
    mats = []
    for cls in CLASSES:
        name = f"voxel:{cls}"
        m = bpy.data.materials.get(name)
        if m is None:
            m = bpy.data.materials.new(name)
            m.use_nodes = True
            nt = m.node_tree
            N, L = nt.nodes, nt.links
            N.clear()
            out = N.new("ShaderNodeOutputMaterial")
            col = N.new("ShaderNodeVertexColor")
            col.layer_name = "Col"
            if cls == "emit":
                em = N.new("ShaderNodeEmission")
                em.inputs["Strength"].default_value = 2.4
                L.new(col.outputs["Color"], em.inputs["Color"])
                L.new(em.outputs["Emission"], out.inputs["Surface"])
            else:
                b = N.new("ShaderNodeBsdfPrincipled")
                L.new(col.outputs["Color"], b.inputs["Base Color"])
                rough, metal = {"solid": (0.9, 0.0), "metal": (0.35, 0.8), "glass": (0.1, 0.0)}[cls]
                b.inputs["Roughness"].default_value = rough
                b.inputs["Metallic"].default_value = metal
                if cls == "glass":
                    b.inputs["Alpha"].default_value = 0.45
                L.new(b.outputs["BSDF"], out.inputs["Surface"])
            m.diffuse_color = (0.8, 0.8, 0.8, 1)
        mats.append(m)
    return mats


def shell_mesh(name: str, m: Uvox, dirs: tuple[int, ...] = (0, 1, 2, 3, 4, 5)) -> bpy.types.Mesh:
    """Exact face shell of the grid (voxel units, Blender axes)."""
    g = m.grid
    sz, sy, sx = g.shape
    pal_lin = {i: srgb_to_linear(np.asarray(p["rgb"], dtype=np.float64) / 255.0) for i, p in m.palette.items()}
    mat_of = {i: CLASSES.index(p["mat"]) for i, p in m.palette.items()}
    verts, dir_l, cells = [], [], []
    for d, xyz in exposed_faces(g, dirs):
        if not len(xyz):
            continue
        base = np.stack([xyz[:, 0], -xyz[:, 2] - 1, xyz[:, 1]], axis=1).astype(np.float64)
        tpl = np.asarray(_FACES[d], dtype=np.float64)
        verts.append((base[:, None, :] + tpl[None, :, :]).reshape(-1, 3))
        dir_l.append(np.full(len(xyz), d, dtype=np.int32))
        cells.append(xyz)
    me = bpy.data.meshes.new(name)
    if not verts:
        return me
    V = np.concatenate(verts)
    D = np.concatenate(dir_l)
    X = np.concatenate(cells)
    nf = len(D)
    me.vertices.add(nf * 4)
    me.vertices.foreach_set("co", V.astype(np.float32).ravel())
    me.loops.add(nf * 4)
    me.loops.foreach_set("vertex_index", np.arange(nf * 4, dtype=np.int32))
    me.polygons.add(nf)
    me.polygons.foreach_set("loop_start", np.arange(0, nf * 4, 4, dtype=np.int32))
    pal = g[X[:, 2], X[:, 1], X[:, 0]].astype(np.int32)
    flat = (X[:, 0] + sx * (X[:, 1] + sy * X[:, 2])).astype(np.int32)
    me.polygons.foreach_set("material_index", np.asarray([mat_of[int(v)] for v in pal], dtype=np.int32))
    for nm, arr in (("voxel", flat), ("pal", pal), ("dir", D)):
        a = me.attributes.new(nm, "INT", "FACE")
        a.data.foreach_set("value", arr)
    # Colours per face, written to its 4 corners.
    rgb = np.asarray([m.palette[int(v)]["rgb"] for v in pal], dtype=np.float64)
    col = np.asarray([pal_lin[int(v)] for v in pal])
    shade = np.asarray([ISO_SHADE.get(int(d), 1.0) for d in D])
    iso_bytes = np.clip(np.rint(rgb * shade[:, None]), 0, 255)  # Uint8ClampedArray rounds half to even, like rint
    iso = srgb_to_linear(iso_bytes / 255.0)
    for nm, c in (("Col", col), ("Iso", iso)):
        ca = me.color_attributes.new(nm, "FLOAT_COLOR", "CORNER")
        rgba = np.ones((nf, 4), dtype=np.float32)
        rgba[:, :3] = c
        ca.data.foreach_set("color", np.repeat(rgba, 4, axis=0).ravel())
    me.color_attributes.active_color = me.color_attributes["Col"]
    for mat in _materials():
        me.materials.append(mat)
    me.update()
    return me


def placement(m: Uvox) -> Matrix:
    ox, oy, oz = m.origin
    ax, ay, az = m.anchor
    return (
        Matrix.Translation(Vector((ox, -oz, oy)))
        @ Matrix.Rotation(m.rot_y, 4, "Z")
        @ Matrix.Diagonal(Vector((m.unit, m.unit * float(m.meta.get("scaleZ", 1.0)), m.unit, 1.0)))
        @ Matrix.Translation(Vector((-ax, az, -ay)))
    )


def volume_mesh(name: str, m: Uvox) -> bpy.types.Mesh:
    """Every voxel as a vertex at its centre (voxel units, Blender axes) + int `pal`."""
    zyx = np.argwhere(m.grid > 0)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(zyx))
    co = np.stack([zyx[:, 2] + 0.5, -zyx[:, 0] - 0.5, zyx[:, 1] + 0.5], axis=1)
    me.vertices.foreach_set("co", co.astype(np.float32).ravel())
    a = me.attributes.new("pal", "INT", "POINT")
    a.data.foreach_set("value", m.grid[zyx[:, 0], zyx[:, 1], zyx[:, 2]].astype(np.int32))
    me.update()
    return me


def _store(ob: bpy.types.Object, m: Uvox) -> None:
    ob["uvox_id"] = m.id
    ob["uvox_size"] = list(m.size)
    ob["uvox_unit"] = m.unit
    ob["uvox_origin"] = list(m.origin)
    ob["uvox_anchor"] = list(m.anchor)
    ob["uvox_rotY"] = m.rot_y
    ob["uvox_palette"] = json.dumps({str(k): v for k, v in m.palette.items()})
    ob["uvox_meta"] = json.dumps(m.meta)
    ob["uvox_sha"] = m.sha


def clone(m: Uvox, collection: bpy.types.Collection | None = None) -> bpy.types.Object:
    """uvox → shell object with its volume child. Returns the shell."""
    coll = collection or bpy.context.scene.collection
    shell = bpy.data.objects.new(m.id, shell_mesh(m.id, m))
    vol = bpy.data.objects.new(f"{m.id}.vox", volume_mesh(f"{m.id}.vox", m))
    coll.objects.link(shell)
    coll.objects.link(vol)
    vol.parent = shell
    vol.hide_render = True
    vol.hide_set(True)
    shell.matrix_world = placement(m)
    _store(shell, m)
    return shell


def volume_of(shell: bpy.types.Object) -> bpy.types.Object:
    for c in shell.children:
        if c.name.endswith(".vox"):
            return c
    raise ValueError(f"{shell.name}: no .vox volume child")


def read_back(shell: bpy.types.Object) -> Uvox:
    """Blender → uvox from the VOLUME geometry (not from the stored source)."""
    vol = volume_of(shell)
    me = vol.data
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    pal = np.empty(n, dtype=np.int32)
    me.attributes["pal"].data.foreach_get("value", pal)
    x = np.floor(co[:, 0]).astype(np.int64)
    y = np.floor(co[:, 2]).astype(np.int64)
    z = np.floor(-co[:, 1]).astype(np.int64)
    sx, sy, sz = shell["uvox_size"]
    if n and (x.min() < 0 or y.min() < 0 or z.min() < 0 or x.max() >= sx or y.max() >= sy or z.max() >= sz):
        # Voxels were added outside: grow the grid (origin/anchor stay in the model's frame).
        raise ValueError(f"{shell.name}: voxels outside the {sx}×{sy}×{sz} grid — use voxelgod.ops.refit")
    g = np.zeros((sz, sy, sx), dtype=np.uint8)
    g[z, y, x] = pal.astype(np.uint8)
    palette = {int(k): v for k, v in json.loads(shell["uvox_palette"]).items()}
    return Uvox(
        id=shell["uvox_id"],
        grid=g,
        unit=float(shell["uvox_unit"]),
        origin=tuple(shell["uvox_origin"]),
        anchor=tuple(shell["uvox_anchor"]),
        rot_y=float(shell["uvox_rotY"]),
        palette=palette,
        meta=json.loads(shell["uvox_meta"]),
    )


def rebuild_shell(shell: bpy.types.Object) -> None:
    """After editing the volume: regenerate the shell from it."""
    m = read_back(shell)
    old = shell.data
    shell.data = shell_mesh(m.id, m)
    bpy.data.meshes.remove(old)
    shell["uvox_sha"] = m.sha


def clone_scene(parts: list[Uvox], name: str) -> bpy.types.Collection:
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    for p in parts:
        clone(p, coll)
    return coll


def info(shell: bpy.types.Object) -> dict[str, Any]:
    return {
        "id": shell["uvox_id"],
        "size": list(shell["uvox_size"]),
        "unit": shell["uvox_unit"],
        "faces": len(shell.data.polygons),
        "voxels": len(volume_of(shell).data.vertices),
        "sha": shell["uvox_sha"],
        "rotY_deg": math.degrees(float(shell["uvox_rotY"])),
    }
