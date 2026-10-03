"""Trailer effects: camera paths, power-ups, voxel assembly, morse, screens.

All effects are plain keyframes or a geometry-nodes modifier with a keyed
input, so a shot renders the same at any frame (frames can render out of
order and in parallel).
"""

from __future__ import annotations

import math
import random
from typing import Iterable

import bpy
from mathutils import Vector

import lab


# ── Camera ─────────────────────────────────────────────────────────


class Rig:
    """Camera + aim target (Track To), keyed per format.

    A shot keys `eye`/`target`/`lens` at frames; `v` overrides for 9:16.
    """

    def __init__(self, fmt: str) -> None:
        self.fmt = fmt
        self.cam = lab.camera("cam", 35)
        self.cam.data.sensor_fit = "AUTO"
        self.cam.data.sensor_width = 36
        self.tgt = bpy.data.objects.new("cam:target", None)
        bpy.context.scene.collection.objects.link(self.tgt)
        c = self.cam.constraints.new("TRACK_TO")
        c.target = self.tgt
        c.track_axis = "TRACK_NEGATIVE_Z"
        c.up_axis = "UP_Y"

    def key(self, frame: int, eye: Vector, target: Vector, lens: float, v: dict | None = None, roll: float = 0.0) -> None:
        if self.fmt == "v":
            o = v or {}
            eye = o.get("eye", eye)
            target = o.get("target", target)
            lens = o.get("lens", lens * 0.78)
        self.cam.location = eye
        self.cam.keyframe_insert("location", frame=frame)
        self.tgt.location = target
        self.tgt.keyframe_insert("location", frame=frame)
        self.cam.data.lens = lens
        self.cam.data.keyframe_insert("lens", frame=frame)
        self.cam.rotation_euler = (0, 0, roll)
        self.cam.keyframe_insert("rotation_euler", frame=frame, index=2)

    def dof(self, focus: bpy.types.Object | Vector | None, fstop: float = 2.8) -> None:
        d = self.cam.data.dof
        d.use_dof = True
        d.aperture_fstop = fstop
        if isinstance(focus, bpy.types.Object):
            d.focus_object = focus
        elif focus is not None:
            e = bpy.data.objects.new("cam:focus", None)
            bpy.context.scene.collection.objects.link(e)
            e.location = focus
            d.focus_object = e
        else:
            d.focus_object = self.tgt


def orbit(center: Vector, dist: float, az_deg: float, height: float) -> Vector:
    """A point around `center` (Blender), azimuth from +X counter-clockwise."""
    a = math.radians(az_deg)
    return center + Vector((math.cos(a) * dist, math.sin(a) * dist, height))


def toward(a: Vector, b: Vector) -> float:
    """Azimuth (deg) of the direction a → b in the XY plane."""
    d = b - a
    return math.degrees(math.atan2(d.y, d.x))


def bbox(objs: Iterable[bpy.types.Object]) -> tuple[Vector, Vector]:
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    bpy.context.view_layer.update()
    for ob in objs:
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    return lo, hi


def mid(objs: Iterable[bpy.types.Object]) -> Vector:
    lo, hi = bbox(objs)
    return (lo + hi) / 2


# ── Power ──────────────────────────────────────────────────────────


def glow(objs: Iterable[bpy.types.Object], frames: list[tuple[int, float]], prop: str = "glow") -> None:
    for ob in objs:
        for f, v in frames:
            ob[prop] = v
            ob.keyframe_insert(f'["{prop}"]', frame=f)


def energy(lights: Iterable[bpy.types.Object], frames: list[tuple[int, float]]) -> None:
    """Key light energy as a fraction of its base (`energy0`)."""
    for ob in lights:
        e0 = float(ob.get("energy0", ob.data.energy))
        for f, k in frames:
            ob.data.energy = e0 * k
            ob.data.keyframe_insert("energy", frame=f)


def click_on(objs: list[bpy.types.Object], lights: list[bpy.types.Object], frame: int, stutter: bool = True, seed: int = 0) -> None:
    """A lamp coming on: a short stutter (fluorescent), then steady."""
    rnd = random.Random(seed)
    seq = [(frame - 1, 0.0), (frame, 1.0)]
    if stutter:
        seq = [(frame - 1, 0.0), (frame, 0.8), (frame + 1, 0.05), (frame + 2 + rnd.randint(0, 2), 0.9), (frame + 4 + rnd.randint(0, 3), 0.15), (frame + 8, 1.0)]
    glow(objs, seq)
    energy(lights, seq)
    constant(objs + lights)


def constant(objs: Iterable[bpy.types.Object]) -> None:
    """Make every key of these objects (and their light data) step, not ease."""
    for ob in objs:
        for idb in (ob, getattr(ob, "data", None)):
            ad = getattr(idb, "animation_data", None)
            if ad and ad.action:
                for fc in lab._fcurves(ad.action):
                    for k in fc.keyframe_points:
                        k.interpolation = "CONSTANT"


def morse(lights: list[bpy.types.Object], objs: list[bpy.types.Object], code: str, start: int, unit: int, low: float = 0.08) -> int:
    """Pulse lights/glow in a morse rhythm ('.' = 1 unit on, '_' = 3, gap 1, ' ' = 3)."""
    f = start
    seq: list[tuple[int, float]] = [(f - 1, low)]
    for ch in code:
        if ch in "._-":
            n = 1 if ch == "." else 3
            seq += [(f, 1.0), (f + n * unit, low)]
            f += (n + 1) * unit
        else:
            f += 2 * unit
    glow(objs, seq)
    energy(lights, seq)
    constant(objs + lights)
    return f


# ── Voxel assembly (geometry nodes) ────────────────────────────────


def _assemble_group() -> bpy.types.NodeTree:
    """Faces drop in per voxel from above, bottom rows first, jittered.

    Works on voxelgod shells: every face has unique vertices and an int face
    attribute `voxel` (flat index, x fastest). Inputs: Progress 0 → 1, SX, SY
    (grid size), Drop (units).
    """
    name = "trailer:assemble"
    ng = bpy.data.node_groups.get(name)
    if ng:
        return ng
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    I = ng.interface
    I.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    for nm in ("Progress", "SX", "SY", "Drop"):
        I.new_socket(nm, in_out="INPUT", socket_type="NodeSocketFloat")
    I.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N, L = ng.nodes, ng.links
    gi = N.new("NodeGroupInput")
    go = N.new("NodeGroupOutput")

    def math_(op: str, a, b=None):  # noqa: ANN001
        m = N.new("ShaderNodeMath")
        m.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                L.new(v, m.inputs[i])
        return m.outputs[0]

    vox = N.new("GeometryNodeInputNamedAttribute")
    vox.data_type = "INT"
    vox.inputs["Name"].default_value = "voxel"
    vid = vox.outputs["Attribute"]
    # y = floor(voxel / SX) mod SY  →  row 0 … SY-1
    row = math_("FLOORED_MODULO", math_("FLOOR", math_("DIVIDE", vid, gi.outputs["SX"])), gi.outputs["SY"])
    yn = math_("DIVIDE", row, math_("MAXIMUM", gi.outputs["SY"], 1.0))
    rnd = N.new("FunctionNodeRandomValue")
    rnd.data_type = "FLOAT"
    L.new(vid, rnd.inputs["ID"])
    delay = math_("ADD", math_("MULTIPLY", yn, 0.72), math_("MULTIPLY", rnd.outputs[1], 0.2))
    # local = clamp((P*1.1 − delay) / 0.18)
    local = math_("DIVIDE", math_("SUBTRACT", math_("MULTIPLY", gi.outputs["Progress"], 1.12), delay), 0.18)
    cl = N.new("ShaderNodeClamp")
    L.new(local, cl.inputs["Value"])
    inv = math_("SUBTRACT", 1.0, cl.outputs[0])
    off = math_("MULTIPLY", math_("MULTIPLY", inv, inv), gi.outputs["Drop"])
    comb = N.new("ShaderNodeCombineXYZ")
    L.new(off, comb.inputs["Z"])
    sp = N.new("GeometryNodeSetPosition")
    L.new(gi.outputs["Geometry"], sp.inputs["Geometry"])
    L.new(comb.outputs[0], sp.inputs["Offset"])
    dl = N.new("GeometryNodeDeleteGeometry")
    dl.domain = "FACE"
    L.new(sp.outputs[0], dl.inputs["Geometry"])
    hidden = math_("LESS_THAN", cl.outputs[0], 0.001)
    L.new(hidden, dl.inputs["Selection"])
    L.new(dl.outputs[0], go.inputs[0])
    return ng


def assemble(ob: bpy.types.Object, f0: int, f1: int, drop: float = 3.0) -> None:
    """Key `ob` (a voxel shell) to assemble between frames f0 and f1."""
    size = list(ob.get("uvox_size", [])) or _size_from(ob)
    mod = ob.modifiers.new("assemble", "NODES")
    mod.node_group = _assemble_group()
    ids = {s.name: s.identifier for s in mod.node_group.interface.items_tree if getattr(s, "in_out", "") == "INPUT"}
    mod[ids["SX"]] = float(size[0])
    mod[ids["SY"]] = float(size[1])
    # Drop in voxel units of the object (it is scaled by its unit).
    mod[ids["Drop"]] = drop / max(ob.matrix_world.to_scale().z, 1e-6)
    pid = ids["Progress"]
    mod[pid] = 0.0
    ob.keyframe_insert(f'modifiers["assemble"]["{pid}"]', frame=f0)
    mod[pid] = 1.0
    ob.keyframe_insert(f'modifiers["assemble"]["{pid}"]', frame=f1)


def _size_from(ob: bpy.types.Object) -> list[int]:
    lo = [min(v.co[i] for v in ob.data.vertices) for i in range(3)]
    hi = [max(v.co[i] for v in ob.data.vertices) for i in range(3)]
    # Blender (x, −z, y) voxel units → game sx, sy
    return [int(round(hi[0] - lo[0])), int(round(hi[2] - lo[2])), int(round(hi[1] - lo[1]))]


# ── Visibility ─────────────────────────────────────────────────────


def show(ob: bpy.types.Object, frames: list[tuple[int, bool]]) -> None:
    for f, vis in frames:
        ob.hide_render = not vis
        ob.keyframe_insert("hide_render", frame=f)
        ob.hide_viewport = not vis
        ob.keyframe_insert("hide_viewport", frame=f)


def fade_black(f0: int, f1: int, fade_in: bool = True) -> None:
    """Exposure ramp (scene view settings) for in-shot fades."""
    vs = bpy.context.scene.view_settings
    a, b = (-10.0, 0.0) if fade_in else (0.0, -10.0)
    vs.exposure = a
    vs.keyframe_insert("exposure", frame=f0)
    vs.exposure = b
    vs.keyframe_insert("exposure", frame=f1)


def clear(a: Vector, b: Vector, ignore: Iterable[bpy.types.Object] = ()) -> float:
    """Free distance from a towards b (stops at the first hit not in `ignore`)."""
    dg = bpy.context.evaluated_depsgraph_get()
    skip = {o.name for o in ignore}
    d = b - a
    total = d.length
    if total < 1e-6:
        return 0.0
    dirn = d.normalized()
    o = a.copy()
    travelled = 0.0
    while travelled < total:
        hit, loc, _n, _i, ob, _m = bpy.context.scene.ray_cast(dg, o, dirn, distance=total - travelled)
        if not hit:
            return total
        step = (loc - o).length
        travelled += step
        if ob is None or ob.name not in skip:
            return travelled
        o = loc + dirn * 1e-3
    return total


def find_view(target: Vector, dist: float, height: float, az_pref: float, ignore: Iterable[bpy.types.Object] = (), spread: float = 150.0, step: float = 7.5) -> float:
    """Azimuth nearest to `az_pref` whose eye (dist, height) sees `target` unobstructed.

    Falls back to the azimuth with the longest clear sight line.
    """
    bpy.context.view_layer.update()
    ign = list(ignore)
    best, best_d = az_pref, -1.0
    k = 0.0
    while k <= spread:
        for az in ((az_pref + k, az_pref - k) if k else (az_pref,)):
            eye = orbit(target, dist, az, height - target.z + target.z)
            eye.z = target.z + height
            free = clear(target, eye, ign)
            if free >= dist * 0.98 * math.hypot(1, height / max(dist, 1e-3)) * 0.98:
                return az
            if free > best_d:
                best, best_d = az, free
        k += step
    return best
