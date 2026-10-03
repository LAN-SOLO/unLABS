"""Trailer lab: loads exported sets (.voxel/trailer, pnpm trailer:export) into
Blender for EEVEE cinematics (docs/TRAILERS.md).

Voxels only: every object is the exact face shell of a game grid
(voxelgod.build.shell_mesh) placed like the engine places it. Materials are
the game's four classes; emission is driven per object by the custom
property ``glow`` (0 = dark, 1 = the game's emit level) so shots can power
rooms, devices and screens up and down with plain keyframes.

Space: Blender units = game world units, game (x, y, z) → Blender (x, −z, y).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/voxel/blender"))

from voxelgod import uvox  # noqa: E402
from voxelgod.build import CLASSES, placement, shell_mesh  # noqa: E402

TR = ROOT / ".voxel/trailer"
EMIT = 2.4  # the game's emit class strength (voxel-mesh.ts)


def g2b(p: tuple[float, float, float] | list[float]) -> Vector:
    """Game world position → Blender."""
    return Vector((p[0], -p[2], p[1]))


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ── Materials ──────────────────────────────────────────────────────


def _obj_attr(nt: bpy.types.NodeTree, name: str) -> bpy.types.Node:
    a = nt.nodes.new("ShaderNodeAttribute")
    a.attribute_type = "OBJECT"
    a.attribute_name = name
    return a


def materials() -> list[bpy.types.Material]:
    """Four classes, colour from the corner attribute ``Col``.

    emit: emission = Col × EMIT × glow × emit_gain (object props).
    solid/metal also take a little ``glow``-scaled emission of ``Col`` × ``self_lit``
    (0 by default) so a shot can fake a powered panel without a light.
    """
    out = []
    for cls in CLASSES:
        name = f"trailer:{cls}"
        m = bpy.data.materials.get(name)
        if m is None:
            m = bpy.data.materials.new(name)
            m.use_nodes = True
            nt = m.node_tree
            N, L = nt.nodes, nt.links
            N.clear()
            o = N.new("ShaderNodeOutputMaterial")
            col = N.new("ShaderNodeVertexColor")
            col.layer_name = "Col"
            b = N.new("ShaderNodeBsdfPrincipled")
            L.new(col.outputs["Color"], b.inputs["Base Color"])
            rough, metal = {"solid": (0.82, 0.0), "metal": (0.32, 0.8), "glass": (0.06, 0.0), "emit": (0.5, 0.0)}[cls]
            b.inputs["Roughness"].default_value = rough
            b.inputs["Metallic"].default_value = metal
            L.new(col.outputs["Color"], b.inputs["Emission Color"])
            glow = _obj_attr(nt, "glow")
            mul = N.new("ShaderNodeMath")
            mul.operation = "MULTIPLY"
            L.new(glow.outputs["Fac"], mul.inputs[0])
            if cls == "emit":
                gain = _obj_attr(nt, "emit_gain")
                mul2 = N.new("ShaderNodeMath")
                mul2.operation = "MULTIPLY"
                L.new(gain.outputs["Fac"], mul2.inputs[0])
                mul2.inputs[1].default_value = EMIT
                L.new(mul2.outputs[0], mul.inputs[1])
            else:
                lit = _obj_attr(nt, "self_lit")
                L.new(lit.outputs["Fac"], mul.inputs[1])
            L.new(mul.outputs[0], b.inputs["Emission Strength"])
            if cls == "glass":
                b.inputs["Alpha"].default_value = 0.45
                if hasattr(m, "surface_render_method"):
                    m.surface_render_method = "BLENDED"
            L.new(b.outputs["BSDF"], o.inputs["Surface"])
        out.append(m)
    return out


def dress(ob: bpy.types.Object, glow: float = 1.0) -> None:
    ob["glow"] = glow
    ob["emit_gain"] = 1.0
    ob["self_lit"] = 0.0
    me = ob.data
    me.materials.clear()
    for mat in materials():
        me.materials.append(mat)


# ── Loading ────────────────────────────────────────────────────────


class LabSet:
    """One exported set in its own collection, optionally offset (Blender units)."""

    def __init__(self, set_id: str, offset: tuple[float, float, float] = (0, 0, 0), lights: bool = True) -> None:
        self.id = set_id
        d = TR / "sets" / set_id
        self.meta: dict[str, Any] = json.loads((d / "set.json").read_text())
        self.coll = bpy.data.collections.new(f"set:{set_id}")
        bpy.context.scene.collection.children.link(self.coll)
        self.root = bpy.data.objects.new(f"set:{set_id}:root", None)
        self.coll.objects.link(self.root)
        self.root.location = offset
        self.objects: list[bpy.types.Object] = []
        self.by_kind: dict[str, list[bpy.types.Object]] = {}
        self.by_id: dict[str, list[bpy.types.Object]] = {}
        for rel in self.meta["parts"]:
            m = uvox.load(TR / rel)
            me = shell_mesh(m.id, m)
            ob = bpy.data.objects.new(m.id, me)
            self.coll.objects.link(ob)
            ob.parent = self.root
            ob.matrix_parent_inverse.identity()
            ob.matrix_basis = placement(m)
            dress(ob)
            ob["uvox_size"] = list(m.size)
            kind = str(m.meta.get("kind", "part"))
            ob["kind"] = kind
            oid = str(m.meta.get("id", m.id))
            ob["oid"] = oid
            if "room" in m.meta:
                ob["room"] = str(m.meta["room"])
            for k in ("decor", "model"):
                if k in m.meta:
                    ob[k] = str(m.meta[k])
            self.objects.append(ob)
            self.by_kind.setdefault(kind, []).append(ob)
            self.by_id.setdefault(oid, []).append(ob)
        self.lights: list[bpy.types.Object] = []
        if lights:
            self._lights()

    def _lights(self) -> None:
        for i, l in enumerate(self.meta["lights"]):
            kind = l["kind"]
            ld = bpy.data.lights.new(f"{self.id}:{kind}{i}", "POINT")
            c = l["color"].lstrip("#")
            ld.color = tuple(int(c[k : k + 2], 16) / 255.0 for k in (0, 2, 4))
            # three.js PointLight intensity → watts, tuned by eye against the game.
            base = {"lamp": 140.0, "decor": 60.0, "device": 45.0}[kind]
            ld.energy = base * float(l["intensity"])
            ld.shadow_soft_size = 0.35 if kind == "lamp" else 0.15
            if hasattr(ld, "use_custom_distance"):
                ld.use_custom_distance = True
                ld.cutoff_distance = max(4.0, float(l["distance"]) * 1.5)
            ob = bpy.data.objects.new(ld.name, ld)
            self.coll.objects.link(ob)
            ob.parent = self.root
            ob.location = g2b(l["pos"])
            ob["kind"] = kind
            ob["of"] = l.get("of", "")
            ob["room"] = l["room"]
            ob["energy0"] = ld.energy
            self.lights.append(ob)

    def find(self, name: str) -> list[bpy.types.Object]:
        """Objects whose id, decor kind or prop model is `name`."""
        return [o for o in self.objects if name in (o.get("oid"), o.get("decor"), o.get("model"))]

    def center(self) -> Vector:
        b = self.meta["box"]
        return self.root.location + g2b(((b["x0"] + b["x1"] + 1) / 2, 0, (b["z0"] + b["z1"] + 1) / 2))

    def world(self, p: tuple[float, float, float] | list[float]) -> Vector:
        """Game position inside this set → Blender world."""
        return self.root.location + g2b(p)

    def hide(self, hidden: bool) -> None:
        self.coll.hide_render = hidden
        self.coll.hide_viewport = hidden


def cast(fig: str, pos: Vector, facing: float = 0.0, coll: bpy.types.Collection | None = None) -> bpy.types.Object:
    """A cast figure (feet at y 0, facing +z) at a Blender position; `facing` = rotation about up (rad)."""
    m = uvox.load(TR / "cast" / f"{fig}.uvox.json")
    me = shell_mesh(m.id, m)
    ob = bpy.data.objects.new(fig, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    ob.matrix_world = placement(m)
    ob.location = pos
    ob.rotation_euler[2] += facing
    dress(ob)
    ob["uvox_size"] = list(m.size)
    ob["kind"] = "cast"
    return ob


# ── Look ───────────────────────────────────────────────────────────


def setup(width: int, height: int, fps: int = 24, samples: int = 32) -> None:
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = width
    sc.render.resolution_y = height
    sc.render.resolution_percentage = 100
    sc.render.fps = fps
    sc.render.film_transparent = False
    ee = sc.eevee
    for k, v in (
        ("taa_render_samples", samples),
        ("use_shadows", True),
        ("shadow_ray_count", 2),
        ("shadow_step_count", 8),
        ("use_raytracing", True),
        ("use_volumetric_shadows", True),
        ("volumetric_tile_size", "4"),
        ("volumetric_samples", 64),
        ("volumetric_end", 120.0),
        ("use_gtao", True),
        ("gtao_distance", 1.2),
        ("fast_gi_method", "GLOBAL_ILLUMINATION"),
    ):
        if hasattr(ee, k):
            try:
                setattr(ee, k, v)
            except Exception:  # noqa: BLE001 — version differences
                pass
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.view_settings.exposure = 0.9
    world(0.012, (0.02, 0.022, 0.028))
    bloom()


def world(fog: float, color: tuple[float, float, float]) -> None:
    """Dark world with an even haze (light shafts from lamps and screens)."""
    sc = bpy.context.scene
    w = bpy.data.worlds.get("trailer_world") or bpy.data.worlds.new("trailer_world")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (*color, 1)
    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    if fog > 0:
        vol = nt.nodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Density"].default_value = fog
        vol.inputs["Anisotropy"].default_value = 0.35
        vol.inputs["Color"].default_value = (0.9, 0.92, 1.0, 1)
        nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
        w["fog"] = fog


def bloom(threshold: float = 1.0, strength: float = 0.6, size: float = 0.7) -> None:
    sc = bpy.context.scene
    try:
        ng = bpy.data.node_groups.new("trailer_comp", "CompositorNodeTree")
        sc.compositing_node_group = ng
        N, L = ng.nodes, ng.links
        rl = N.new("CompositorNodeRLayers")
        gl = N.new("CompositorNodeGlare")
        out = N.new("NodeGroupOutput")
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        for k, v in (("Type", "Bloom"), ("Quality", "High")):
            if k in gl.inputs:
                gl.inputs[k].default_value = v
        if hasattr(gl, "glare_type"):
            gl.glare_type = "BLOOM"
        for k, v in (("Threshold", threshold), ("Strength", strength), ("Size", size)):
            if k in gl.inputs:
                gl.inputs[k].default_value = v
        L.new(rl.outputs["Image"], gl.inputs["Image"])
        L.new(gl.outputs["Image"], out.inputs[0])
        sc.render.use_compositing = True
    except Exception as e:  # noqa: BLE001
        print(f"[trailer] bloom skipped: {e}")


def camera(name: str = "cam", lens: float = 35.0) -> bpy.types.Object:
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.05
    cd.clip_end = 400
    ob = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    return ob


def aim(cam: bpy.types.Object, eye: Vector, target: Vector, roll: float = 0.0) -> None:
    cam.location = eye
    d = target - eye
    q = d.to_track_quat("-Z", "Y")
    cam.rotation_euler = q.to_euler()
    if roll:
        cam.rotation_euler.rotate_axis("Z", roll)


def key(ob: Any, path: str, frame: int, value: Any, index: int = -1) -> None:
    """Set + keyframe (custom props via '["name"]')."""
    if path.startswith('["'):
        ob[path[2:-2]] = value
    elif index >= 0:
        getattr(ob, path)[index] = value
    else:
        setattr(ob, path, value)
    ob.keyframe_insert(path, frame=frame, index=index)


def smooth_all() -> None:
    """Bezier ease on every keyframe (no linear robot moves)."""
    for a in bpy.data.actions:
        for fc in _fcurves(a):
            for k in fc.keyframe_points:
                k.interpolation = "BEZIER"
                k.easing = "AUTO"


def _fcurves(a: bpy.types.Action) -> list[Any]:
    if hasattr(a, "fcurves"):
        try:
            return list(a.fcurves)
        except Exception:  # noqa: BLE001
            pass
    out = []
    for layer in getattr(a, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out


def ease(t: float) -> float:
    return t * t * (3 - 2 * t)


def lerp(a: Vector, b: Vector, t: float) -> Vector:
    return a + (b - a) * t


def deg(a: float) -> float:
    return math.radians(a)


def ceiling(s: LabSet, y: float = 9.0, color: tuple[float, float, float] = (0.015, 0.016, 0.02)) -> bpy.types.Object:
    """A dark slab over the set (the game has none; a camera inside a room needs one)."""
    b = s.meta["box"]
    w = b["x1"] - b["x0"] + 1
    d = b["z1"] - b["z0"] + 1
    me = bpy.data.meshes.new(f"{s.id}:ceiling")
    me.from_pydata([(0, 0, 0), (w, 0, 0), (w, -d, 0), (0, -d, 0)], [], [(3, 2, 1, 0)])
    ob = bpy.data.objects.new(me.name, me)
    s.coll.objects.link(ob)
    ob.parent = s.root
    ob.location = g2b((b["x0"], y, b["z0"]))
    mat = bpy.data.materials.new(f"{s.id}:ceiling")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    me.materials.append(mat)
    return ob


def room_fill(s: LabSet, energy: float = 2.0, color: tuple[float, float, float] = (1.0, 0.93, 0.85), y: float = 8.6) -> bpy.types.Object:
    """Soft overhead fill over the whole set: `energy` W per square unit of floor."""
    b = s.meta["box"]
    w = b["x1"] - b["x0"] + 1
    d = b["z1"] - b["z0"] + 1
    ld = bpy.data.lights.new(f"{s.id}:fill", "AREA")
    ld.shape = "RECTANGLE"
    ld.size = w * 0.8
    ld.size_y = d * 0.8
    ld.energy = energy * w * d
    ld.color = color
    ob = bpy.data.objects.new(ld.name, ld)
    s.coll.objects.link(ob)
    ob.parent = s.root
    ob.location = g2b(((b["x0"] + b["x1"] + 1) / 2, y, (b["z0"] + b["z1"] + 1) / 2))
    ob["energy0"] = ld.energy
    return ob


def spot(name: str, pos: Vector, target: Vector, energy: float, color: tuple[float, float, float], angle: float = 50.0, blend: float = 0.6, size: float = 0.4) -> bpy.types.Object:
    """A key spot (volumetric light shafts through the haze)."""
    ld = bpy.data.lights.new(name, "SPOT")
    ld.energy = energy
    ld.color = color
    ld.spot_size = math.radians(angle)
    ld.spot_blend = blend
    ld.shadow_soft_size = size
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    aim(ob, pos, target)
    ob["energy0"] = energy
    return ob
