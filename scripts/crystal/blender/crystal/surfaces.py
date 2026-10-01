"""Colour, light and surface slots of a crystal object.

* ``COLOR_0`` (attribute ``Col``, face corners, linear): palette colour ×
  baked ambient occlusion × edge wear / cavity grime — the art direction
  the engine multiplies with the surface's library texture.
* ``UVMap``: box projection in source-voxel units × ``uvScale`` (tileable
  library textures line up across models and keep one texel density).
* Material slots: one per crystal surface, named ``crystal:<surface>``;
  the engine swaps them for its shared surface materials by name.
"""

from __future__ import annotations

import bpy
import numpy as np

from .config import Config


def _loop_arrays(me: bpy.types.Mesh):
    nl = len(me.loops)
    lv = np.empty(nl, dtype=np.int32)
    me.loops.foreach_get("vertex_index", lv)
    np_ = len(me.polygons)
    ls = np.empty(np_, dtype=np.int32)
    lt = np.empty(np_, dtype=np.int32)
    me.polygons.foreach_get("loop_start", ls)
    me.polygons.foreach_get("loop_total", lt)
    loop_face = np.repeat(np.arange(np_, dtype=np.int32), lt)
    return lv, loop_face


def slot_labels(ob: bpy.types.Object) -> list[dict]:
    """Per material slot: the palette entry it stands for."""
    out = []
    for m in ob.data.materials:
        out.append(
            {
                "name": m.get("crystal_label_name", m.name),
                "class": m.get("crystal_label_class", "solid"),
                "hex": m.get("crystal_label_hex", "#808080"),
                "linear": tuple(m.diffuse_color[:3]),
            }
        )
    return out


def convexity(me: bpy.types.Mesh) -> np.ndarray:
    """Per-vertex convexity (+ = sharp outer edge, − = crevice), scale-free-ish."""
    nv = len(me.vertices)
    co = np.empty(nv * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    vn = np.empty(nv * 3, dtype=np.float64)
    me.vertices.foreach_get("normal", vn)
    vn = vn.reshape(-1, 3)
    ne = len(me.edges)
    ev = np.empty(ne * 2, dtype=np.int32)
    me.edges.foreach_get("vertices", ev)
    ev = ev.reshape(-1, 2)
    acc = np.zeros(nv)
    cnt = np.zeros(nv)
    for a, b in ((0, 1), (1, 0)):
        d = co[ev[:, b]] - co[ev[:, a]]
        ln = np.linalg.norm(d, axis=1) + 1e-9
        # Neighbour below the tangent plane → convex at this vertex.
        s = -np.einsum("ij,ij->i", d / ln[:, None], vn[ev[:, a]])
        np.add.at(acc, ev[:, a], s)
        np.add.at(cnt, ev[:, a], 1)
    return acc / np.maximum(cnt, 1)


def bake_ao(ob: bpy.types.Object, samples: int, distance: float) -> np.ndarray | None:
    """Ambient occlusion per face corner via a Cycles vertex-colour bake (1 = open)."""
    scene = bpy.context.scene
    me = ob.data
    if "AO" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["AO"])
    attr = me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color = attr
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.render.bake.target = "VERTEX_COLORS"
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.light_settings.distance = distance
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    try:
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    except RuntimeError as e:  # no GPU / headless quirks: carry on without AO
        print(f"[crystal] AO bake skipped: {e}")
        return None
    data = np.empty(len(me.loops) * 4, dtype=np.float32)
    attr.data.foreach_get("color", data)
    ao = data.reshape(-1, 4)[:, 0].copy()
    me.color_attributes.remove(attr)
    return ao


def write_colors(
    ob: bpy.types.Object,
    cfg: Config,
    ao: np.ndarray | None,
    overlays: list | None = None,
    unit: float = 1.0,
) -> None:
    me = ob.data
    lv, loop_face = _loop_arrays(me)
    slots = slot_labels(ob)
    fmat = np.empty(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get("material_index", fmat)
    base = np.array([s["linear"] for s in slots], dtype=np.float64)[fmat[loop_face]]
    is_lit = np.array([s["class"] not in ("emit",) for s in slots])[fmat[loop_face]]
    aoc = cfg.profiles.get("ao", {})
    wear = cfg.profiles.get("wear", {})
    shade = np.ones(len(lv))
    if ao is not None:
        strength = float(aoc.get("strength", 0.85))
        shade *= 1.0 - strength * (1.0 - np.clip(ao, 0, 1))
    cv = convexity(me)[lv]
    # Per-surface wear amount: lighter worn edges, darker grime in crevices.
    surf_wear = np.array(
        [cfg.surface(cfg.surface_for(s["name"], s["class"])).get("wear", 0.3) for s in slots]
    )[fmat[loop_face]]
    edge = np.clip(cv * 3.0, 0, 1) * float(wear.get("edge", 0.18)) * surf_wear
    cav = np.clip(-cv * 3.0, 0, 1) * float(wear.get("cavity", 0.22))
    shade *= 1.0 + edge - cav
    shade = np.where(is_lit, shade, 1.0)
    paint = base
    if overlays:
        from .overlay import sample
        from .shell import to_game

        co = np.empty(len(me.vertices) * 3, dtype=np.float64)
        me.vertices.foreach_get("co", co)
        pts = to_game(co.reshape(-1, 3))
        paint = base.copy()
        for mask, colour, strength in overlays:
            f = sample(mask, pts, unit)[lv] * float(strength)
            f = np.where(is_lit, f, 0.0)[:, None]
            paint = paint * (1 - f) + np.array(colour)[None, :] * f
    col = np.clip(paint * shade[:, None], 0, 16)
    if "Col" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["Col"])
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    rgba = np.concatenate([col, np.ones((len(col), 1))], axis=1).astype(np.float32)
    attr.data.foreach_set("color", rgba.ravel())
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find("Col")


def box_uv(ob: bpy.types.Object, scale: float) -> None:
    """Box projection per face (dominant normal axis), in mesh units × scale."""
    me = ob.data
    lv, loop_face = _loop_arrays(me)
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)[lv]
    fn = np.empty(len(me.polygons) * 3, dtype=np.float64)
    me.polygons.foreach_get("normal", fn)
    n = fn.reshape(-1, 3)[loop_face]
    ax = np.abs(n).argmax(axis=1)
    u = np.where(ax == 0, co[:, 1] * np.sign(n[:, 0]), co[:, 0] * np.where(ax == 1, -np.sign(n[:, 1]), np.sign(n[:, 2])))
    v = np.where(ax == 2, co[:, 1], co[:, 2])
    uv = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    uv.data.foreach_set("uv", (np.stack([u, v], axis=1) * scale).astype(np.float32).ravel())


def fold_to_surfaces(ob: bpy.types.Object, cfg: Config, model_id: str) -> list[str]:
    """Replace the per-label slots by one slot per crystal surface."""
    me = ob.data
    slots = slot_labels(ob)
    sids = [cfg.surface_for(s["name"], s["class"], model_id) for s in slots]
    uniq = sorted(set(sids))
    remap = np.array([uniq.index(s) for s in sids], dtype=np.int32)
    fmat = np.empty(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get("material_index", fmat)
    me.materials.clear()
    for sid in uniq:
        me.materials.append(export_material(sid, cfg))
    me.polygons.foreach_set("material_index", remap[fmat])
    me.update()
    return uniq


def export_material(sid: str, cfg: Config) -> bpy.types.Material:
    """glTF-facing material: vertex colour base, the surface's PBR factors."""
    name = f"crystal:{sid}"
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    s = cfg.surface(sid)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    if s.get("emit"):
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = float(s["emit"])
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = float(s.get("metal", 0))
    bsdf.inputs["Roughness"].default_value = float(s.get("rough", 0.5))
    if s.get("transmission"):
        bsdf.inputs["Transmission Weight"].default_value = float(s["transmission"])
    if s.get("clearcoat"):
        bsdf.inputs["Coat Weight"].default_value = float(s["clearcoat"])
    mat["crystal_surface"] = sid
    return mat
