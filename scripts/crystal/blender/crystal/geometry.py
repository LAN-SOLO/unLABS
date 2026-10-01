"""Voxel dump → crystal surface (Blender object).

Steps: closed voxel shell → shape profile (``hard``: dissolve coplanar faces
per colour, bevel every edge; ``remesh``: voxel remesh + relax) → per-face
palette label → triangle budget. The result keeps one material slot per
palette label (``label:<n>``); ``surfaces.assign`` folds them into surface
slots once the vertex colours are written.
"""

from __future__ import annotations

import bmesh
import bpy
import numpy as np

from .dump import VoxelDump
from .shell import dilate_labels, label_at, shell, to_blender, to_game


def _clear_object(name: str) -> None:
    ob = bpy.data.objects.get(name)
    if ob:
        mesh = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def shell_object(dump: VoxelDump, name: str | None = None) -> bpy.types.Object:
    """The raw voxel shell as a mesh object (one slot per palette label)."""
    name = name or dump.id
    _clear_object(name)
    verts, quads, flab = shell(dump.labels, dump.unit)
    me = bpy.data.meshes.new(name)
    vb = to_blender(verts)
    me.vertices.add(len(vb))
    me.vertices.foreach_set("co", vb.astype(np.float32).ravel())
    me.loops.add(quads.size)
    me.loops.foreach_set("vertex_index", quads.astype(np.int32).ravel())
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", (np.arange(len(quads), dtype=np.int32) * 4))
    me.polygons.foreach_set("loop_total", np.full(len(quads), 4, dtype=np.int32))
    labels_used = sorted(int(x) for x in np.unique(flab))
    slot_of = {lab: i for i, lab in enumerate(labels_used)}
    for lab in labels_used:
        me.materials.append(_label_material(dump, lab))
    me.polygons.foreach_set("material_index", np.array([slot_of[int(l)] for l in flab], dtype=np.int32))
    me.update(calc_edges=True)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob["crystal_id"] = dump.id
    ob["crystal_key"] = dump.key
    return ob


def _label_material(dump: VoxelDump, label: int) -> bpy.types.Material:
    """Placeholder slot material that remembers its palette label."""
    e = dump.entry(label)
    name = f"label:{e.name}"
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat["crystal_label_name"] = e.name
    mat["crystal_label_class"] = e.mat
    mat["crystal_label_hex"] = e.hex
    mat.diffuse_color = (*e.linear, 1.0)
    if not mat.use_nodes:
        # Renders in its palette colour too (voxel comparison objects).
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (*e.linear, 1.0)
            bsdf.inputs["Roughness"].default_value = 0.6
            if e.mat == "metal":
                bsdf.inputs["Metallic"].default_value = 0.8
            if e.mat == "emit":
                bsdf.inputs["Emission Color"].default_value = (*e.linear, 1.0)
                bsdf.inputs["Emission Strength"].default_value = 3.0
    return mat


def _apply_modifiers(ob: bpy.types.Object) -> None:
    deps = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(deps)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=deps)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    me.name = old.name
    if old.users == 0:
        bpy.data.meshes.remove(old)


def shape_hard(ob: bpy.types.Object, prof: dict, unit: float) -> None:
    """Hard surface: merge coplanar same-colour faces, bevel the voxel edges."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.dissolve_limit(
        bm,
        angle_limit=np.radians(1.0),
        use_dissolve_boundaries=False,
        verts=bm.verts,
        edges=bm.edges,
        delimit={"MATERIAL"},
    )
    bm.to_mesh(ob.data)
    bm.free()
    # Smooth shading + hardened bevel normals: flat faces stay flat, edges round.
    ob.data.polygons.foreach_set("use_smooth", np.ones(len(ob.data.polygons), dtype=bool))
    width = float(prof.get("bevel", 0.09))
    max_tris = int(prof.get("maxTris", 30000))
    # Fewer bevel segments instead of decimating: a collapse decimate smears
    # hard-surface planes, a 1-segment bevel still reads as a real edge.
    for segs in range(max(1, int(prof.get("bevelSegments", 3))), 0, -1):
        ob.modifiers.clear()
        if width > 0:
            bev = ob.modifiers.new("bevel", "BEVEL")
            bev.width = width
            bev.segments = segs
            bev.limit_method = "ANGLE"
            bev.angle_limit = np.radians(float(prof.get("bevelAngle", 35)))
            bev.harden_normals = True
            bev.miter_outer = "MITER_ARC"
            bev.profile = 0.5
            bev.use_clamp_overlap = True
        tri = ob.modifiers.new("tri", "TRIANGULATE")
        tri.quad_method = "BEAUTY"
        tri.keep_custom_normals = True
        if segs == 1 or _evaluated_tris(ob) <= max_tris:
            break
    _apply_modifiers(ob)


def _evaluated_tris(ob: bpy.types.Object) -> int:
    deps = bpy.context.evaluated_depsgraph_get()
    return len(ob.evaluated_get(deps).data.polygons)


def shape_remesh(ob: bpy.types.Object, dump: VoxelDump, prof: dict) -> None:
    """Organic: voxel remesh, relax, then re-label faces from the source grid."""
    rm = ob.modifiers.new("remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = float(prof.get("voxel", 0.125))
    rm.adaptivity = 0.0
    rm.use_smooth_shade = True
    it = int(prof.get("smooth", 0))
    if it > 0:
        sm = ob.modifiers.new("relax", "SMOOTH")
        sm.factor = float(prof.get("smoothFactor", 0.5))
        sm.iterations = it
    _apply_modifiers(ob)
    relabel_faces(ob, dump)


def relabel_faces(ob: bpy.types.Object, dump: VoxelDump, smooth: float = 0.0) -> None:
    """Assign every face the palette label of the voxel just inside it.

    ``smooth`` > 0 (voxels): labels come from blurred per-colour fields
    (argmax), so colour borders follow straight lines and curves instead of
    the voxel staircase.
    """
    me = ob.data
    n = len(me.polygons)
    centers = np.empty(n * 3, dtype=np.float32)
    normals = np.empty(n * 3, dtype=np.float32)
    me.polygons.foreach_get("center", centers)
    me.polygons.foreach_get("normal", normals)
    c = to_game(centers.reshape(-1, 3).astype(np.float64))
    nn = to_game(normals.reshape(-1, 3).astype(np.float64))
    lab = np.zeros(n, dtype=np.uint8)
    if smooth > 0:
        from .shell import smooth_labels_at

        lab = smooth_labels_at(dump.labels, c - nn * dump.unit * 0.3, dump.unit, smooth)
    grown = dilate_labels(dump.labels, 4)
    miss = lab == 0
    if miss.any():
        lab[miss] = label_at(grown, c[miss] - nn[miss] * dump.unit * 0.35, dump.unit)
    # Points that landed in empty space: try further inside.
    miss = lab == 0
    if miss.any():
        lab[miss] = label_at(grown, c[miss] - nn[miss] * dump.unit * 1.2, dump.unit)
    lab[lab == 0] = int(np.bincount(dump.labels[dump.labels > 0]).argmax())
    used = sorted(int(x) for x in np.unique(lab))
    me.materials.clear()
    for l in used:
        me.materials.append(_label_material(dump, l))
    slot = {l: i for i, l in enumerate(used)}
    me.polygons.foreach_set("material_index", np.array([slot[int(l)] for l in lab], dtype=np.int32))
    me.update()


def budget(ob: bpy.types.Object, max_tris: int) -> None:
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris <= max_tris:
        return
    dec = ob.modifiers.new("budget", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = max(0.05, max_tris / tris)
    dec.use_collapse_triangulate = True
    _apply_modifiers(ob)


def reduce(ob: bpy.types.Object, max_tris: int, planar_deg: float = 1.5) -> None:
    """Merge flat regions into big polygons, then collapse down to the budget."""
    if planar_deg > 0:
        dec = ob.modifiers.new("planar", "DECIMATE")
        dec.decimate_type = "DISSOLVE"
        dec.angle_limit = np.radians(planar_deg)
        dec.delimit = {"MATERIAL", "SHARP"}
        tri = ob.modifiers.new("tri", "TRIANGULATE")
        tri.quad_method = "BEAUTY"
        _apply_modifiers(ob)
    budget(ob, max_tris)


def build_surface(dump: VoxelDump, prof: dict) -> bpy.types.Object:
    mode = prof.get("mode", "hard")
    if mode == "sdf":
        from .sdf import sdf_object

        ob = sdf_object(dump, prof, name=dump.id)
        _clear_and_link(ob)
        if prof.get("borderCut", True):
            # On the dense iso mesh (every face small), before flat regions are merged.
            cut_color_borders(ob, dump, float(prof.get("colorBlur", 0.5)))
        else:
            relabel_faces(ob, dump, float(prof.get("colorBlur", 0.5)))
        reduce(ob, int(prof.get("maxTris", 30000)), float(prof.get("planar", 0.6)))
        ob.data.polygons.foreach_set("use_smooth", np.ones(len(ob.data.polygons), dtype=bool))
        ob.data.set_sharp_from_angle(angle=np.radians(float(prof.get("sharpAngle", 40))))
        # Big flat faces stay flat-shaded, small bevel faces carry the curvature.
        wn = ob.modifiers.new("wn", "WEIGHTED_NORMAL")
        wn.mode = "FACE_AREA"
        wn.keep_sharp = True
        wn.weight = 50
        _apply_modifiers(ob)
        return ob
    ob = shell_object(dump)
    if mode == "remesh":
        shape_remesh(ob, dump, prof)
        budget(ob, int(prof.get("maxTris", 30000)))
        ob.data.polygons.foreach_set("use_smooth", np.ones(len(ob.data.polygons), dtype=bool))
    else:
        shape_hard(ob, prof, dump.unit)
    return ob


def _clear_and_link(ob: bpy.types.Object) -> None:
    if ob.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(ob)


def crop(ob: bpy.types.Object, box: list[float], unit: float, eps: float = 1e-3) -> None:
    """Cut the surface to the cell box [x0,y0,z0,x1,y1,z1] (game axes, cells × unit).

    Terrain chunks are built with a ring of neighbour context so the blur
    and the AO match across chunk borders; the ring is cut away here
    (open borders meet the neighbour chunk's open borders exactly).
    """
    x0, y0, z0, x1, y1, z1 = (v * unit for v in box)
    # Game (x, y, z) → Blender (x, -z, y).
    planes = [
        ((x1 + eps, 0, 0), (1, 0, 0)),
        ((x0 - eps, 0, 0), (-1, 0, 0)),
        ((0, 0, y1 + eps), (0, 0, 1)),
        ((0, 0, y0 - eps), (0, 0, -1)),
        ((0, -z0 + eps, 0), (0, 1, 0)),
        ((0, -z1 - eps, 0), (0, -1, 0)),
    ]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for co, no in planes:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_outer=True)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


def _label_fields(dump: VoxelDump, pts_game: np.ndarray, sigma: float) -> tuple[list[int], np.ndarray]:
    """Blurred per-colour occupancy at points → (labels, weights[n_points, n_labels])."""
    from .overlay import sample

    used = [int(x) for x in np.unique(dump.labels) if x]
    w = np.stack([sample(dump.labels == l, pts_game, dump.unit, sigma, gain=1.0) for l in used], axis=1)
    return used, w


def cut_color_borders(ob: bpy.types.Object, dump: VoxelDump, sigma: float, inset: float = 0.3) -> None:
    """Split triangles along the smooth colour borders (marching triangles, numpy).

    Each vertex gets its dominant colour from the blurred per-colour fields.
    A triangle whose corners carry two colours is cut where the two fields
    are equal (edge points shared with the neighbour → no cracks) into a
    triangle of the odd colour and a quad of the other; corners with three
    colours keep the triangle (labelled from its centre). Colour borders
    become smooth curves instead of following the triangles.
    """
    me = ob.data
    nv = len(me.vertices)
    if nv == 0:
        return
    tri_mod = ob.modifiers.new("tri", "TRIANGULATE")
    tri_mod.quad_method = "BEAUTY"
    tri_mod.ngon_method = "BEAUTY"
    _apply_modifiers(ob)
    me = ob.data
    nv = len(me.vertices)
    co = np.empty(nv * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    P = co.reshape(-1, 3)
    vn = np.empty(nv * 3, dtype=np.float64)
    me.vertices.foreach_get("normal", vn)
    pts = to_game(P) - to_game(vn.reshape(-1, 3)) * dump.unit * inset
    used, W = _label_fields(dump, pts, sigma)
    L = W.argmax(axis=1)
    nt = len(me.polygons)
    T = np.empty(nt * 3, dtype=np.int64)
    me.polygons.foreach_get("vertices", T)
    T = T.reshape(-1, 3)
    la, lb, lc = L[T[:, 0]], L[T[:, 1]], L[T[:, 2]]
    same = (la == lb) & (lb == lc)
    three = (la != lb) & (lb != lc) & (la != lc)
    two = ~same & ~three
    # Rotate two-colour triangles so the odd corner comes first (cyclic order kept).
    t2 = T[two]
    l2 = np.stack([la[two], lb[two], lc[two]], axis=1)
    odd = np.where(l2[:, 1] == l2[:, 2], 0, np.where(l2[:, 0] == l2[:, 2], 1, 2))
    idx = (odd[:, None] + np.arange(3)[None, :]) % 3
    r = np.take_along_axis(t2, idx, axis=1)
    a, b, c = r[:, 0], r[:, 1], r[:, 2]
    LA, LB = L[a], L[b]

    # Edge points, deduplicated per undirected edge (computed from the lower vertex id).
    def edge_points(u: np.ndarray, v: np.ndarray, lu: np.ndarray, lv: np.ndarray):
        lo = np.minimum(u, v)
        hi = np.maximum(u, v)
        llo = np.where(u < v, lu, lv)
        lhi = np.where(u < v, lv, lu)
        f0 = W[lo, llo] - W[lo, lhi]
        f1 = W[hi, llo] - W[hi, lhi]
        t = np.clip(f0 / np.maximum(f0 - f1, 1e-6), 0.08, 0.92)
        return lo * (nv + 1) + hi, P[lo] + (P[hi] - P[lo]) * t[:, None]

    kab, pab = edge_points(a, b, LA, LB)
    kac, pac = edge_points(a, c, LA, LB)
    keys = np.concatenate([kab, kac])
    uniq, first, inv = np.unique(keys, return_index=True, return_inverse=True)
    newp = np.concatenate([pab, pac])[first]
    iab = nv + inv[: len(kab)]
    iac = nv + inv[len(kab) :]
    P2 = np.concatenate([P, newp])
    keep = T[same | three]
    keep_lab = np.where(three[same | three], -1, L[keep[:, 0]])
    faces = np.concatenate(
        [
            keep,
            np.stack([a, iab, iac], axis=1),
            np.stack([iab, b, c], axis=1),
            np.stack([iab, c, iac], axis=1),
        ]
    )
    flab = np.concatenate([keep_lab, LA, LB, LB])
    me2 = bpy.data.meshes.new(me.name + "_cut")
    me2.vertices.add(len(P2))
    me2.vertices.foreach_set("co", P2.astype(np.float32).ravel())
    me2.loops.add(faces.size)
    me2.loops.foreach_set("vertex_index", faces.astype(np.int32).ravel())
    me2.polygons.add(len(faces))
    me2.polygons.foreach_set("loop_start", np.arange(len(faces), dtype=np.int32) * 3)
    me2.polygons.foreach_set("loop_total", np.full(len(faces), 3, dtype=np.int32))
    me2.update(calc_edges=True)
    me2.validate()
    old = ob.data
    ob.data = me2
    bpy.data.meshes.remove(old)
    me2.name = ob.name
    # Labels: field index → palette label; three-colour triangles from their centre.
    pal = np.array(used, dtype=np.int64)
    lab = np.where(flab >= 0, pal[np.maximum(flab, 0)], 0)
    if (flab < 0).any():
        cen = P2[faces[flab < 0]].mean(axis=1)
        from .shell import smooth_labels_at

        lab[flab < 0] = smooth_labels_at(dump.labels, to_game(cen), dump.unit, sigma)
    lab[lab == 0] = int(np.bincount(dump.labels[dump.labels > 0]).argmax())
    labs = sorted(int(x) for x in np.unique(lab))
    for l in labs:
        me2.materials.append(_label_material(dump, l))
    slot = {l: i for i, l in enumerate(labs)}
    me2.polygons.foreach_set("material_index", np.array([slot[int(l)] for l in lab], dtype=np.int32))
    me2.update()
