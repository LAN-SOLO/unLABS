"""Hero renders of voxel clones: product-shot quality for press and social.

Still 100 % voxels (the shell is build.clone's exact face set, the materials
are the game's four classes). What changes against beauty.py is only the
photography: a perspective lens, a studio light rig (soft key, cool fill,
orange and cyan rims), a dark glossy floor that catches reflections, a
gradient backdrop, depth of field, bloom on the emitters, high samples with
denoising, and three formats.
"""

from __future__ import annotations

import math
from dataclasses import replace
from pathlib import Path

import bpy
from mathutils import Vector

from . import build
from .uvox import Uvox

# name → (width, height, yaw°, pitch°, lens mm)
#   yaw 0 = looking at the game's +z face (the front); positive = from the right.
SHOTS: dict[str, tuple[int, int, float, float, float]] = {
    "hero-16x9": (3840, 2160, 32, 16, 85),
    "hero-4x5": (2160, 2700, -28, 12, 85),
    "hero-1x1": (2160, 2160, 14, 6, 100),
}


def setup(samples: int = 384) -> None:
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.005
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 10
    sc.cycles.glossy_bounces = 6
    sc.cycles.transparent_max_bounces = 16
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for dv in prefs.devices:
            dv.use = dv.type == "METAL"
        sc.cycles.device = "GPU"
    except Exception:  # noqa: BLE001 — CPU is fine
        sc.cycles.device = "CPU"
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = 0.0
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "16"
    sc.render.resolution_percentage = 100
    _world()
    _bloom()


def _world() -> None:
    """Near-black blue-grey, barely lighting the scene (the rig does that)."""
    sc = bpy.context.scene
    w = bpy.data.worlds.new("hero_world")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.012, 0.014, 0.018, 1)
    bg.inputs["Strength"].default_value = 0.35
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def _bloom() -> None:
    sc = bpy.context.scene
    try:
        ng = bpy.data.node_groups.new("hero_comp", "CompositorNodeTree")
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
        for k, v in (("Threshold", 2.0), ("Strength", 0.25), ("Size", 0.55)):
            if k in gl.inputs:
                gl.inputs[k].default_value = v
        L.new(rl.outputs["Image"], gl.inputs["Image"])
        L.new(gl.outputs["Image"], out.inputs[0])
        sc.render.use_compositing = True
    except Exception as e:  # noqa: BLE001
        print(f"[hero] bloom skipped: {e}", flush=True)


def _bounds(obs) -> tuple[Vector, Vector]:
    pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def _stage(lo: Vector, hi: Vector) -> None:
    """Glossy dark floor + a backdrop sweep with a soft light pool behind the model."""
    size = (hi - lo).length
    c = (lo + hi) / 2
    # Floor: dark, slightly glossy — the model's reflection grounds it.
    bpy.ops.mesh.primitive_plane_add(size=size * 40, location=(c.x, c.y, lo.z - 1e-3))
    floor = bpy.context.active_object
    floor.name = "hero_floor"
    m = bpy.data.materials.new("hero_floor")
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (0.012, 0.013, 0.016, 1)
    b.inputs["Roughness"].default_value = 0.3
    b.inputs["Specular IOR Level"].default_value = 0.6 if "Specular IOR Level" in b.inputs else 0.5
    floor.data.materials.append(m)
    # Light pool on the floor behind the model (reads as a studio sweep).
    pool = bpy.data.lights.new("hero_pool", "SPOT")
    pool.energy = 900 * size * size / 4
    pool.spot_size = math.radians(55)
    pool.spot_blend = 1.0
    pool.color = (0.55, 0.62, 0.75)
    po = bpy.data.objects.new("hero_pool", pool)
    bpy.context.scene.collection.objects.link(po)
    po.location = Vector((c.x, c.y + size * 1.4, hi.z + size * 1.2))
    tgt = Vector((c.x, c.y + size * 1.6, lo.z))
    po.rotation_euler = (tgt - po.location).to_track_quat("-Z", "Y").to_euler()


def _rig(lo: Vector, hi: Vector, yaw: float) -> None:
    """Soft key (camera side, high), cool fill, orange + cyan rims behind."""
    c = (lo + hi) / 2
    r = max((hi - lo).length / 2, 1e-3)
    yr = math.radians(yaw)

    def around(deg: float, dist: float, h: float) -> Vector:
        a = yr + math.radians(deg)
        return Vector((c.x + math.sin(a) * dist * r, c.y - math.cos(a) * dist * r, c.z + h * r))

    # (name, position, energy, size, colour, spread°) — narrow spreads keep the
    # light on the model instead of pooling on the glossy floor.
    for name, pos, energy, size, color, spread in (
        ("key", around(38, 3.2, 2.8), 170, 2.0, (1.0, 0.95, 0.89), 50),
        ("fill", around(-60, 3.6, 1.0), 40, 2.6, (0.72, 0.82, 1.0), 60),
        ("rim_orange", around(145, 2.8, 2.6), 190, 0.8, (1.0, 0.55, 0.22), 30),
        ("rim_cyan", around(-145, 2.8, 2.4), 130, 0.8, (0.35, 0.85, 1.0), 30),
        ("top", Vector((c.x, c.y, hi.z + 3.2 * r)), 45, 2.4, (1.0, 1.0, 1.0), 40),
    ):
        ld = bpy.data.lights.new(f"hero_{name}", "AREA")
        ld.shape = "DISK"
        ld.energy = energy * r * r
        ld.size = size * r
        ld.color = color
        if hasattr(ld, "spread"):
            ld.spread = math.radians(spread)
        o = bpy.data.objects.new(ld.name, ld)
        bpy.context.scene.collection.objects.link(o)
        o.location = pos
        o.rotation_euler = (c - pos).to_track_quat("-Z", "Y").to_euler()


def _camera(lo: Vector, hi: Vector, w: int, h: int, yaw: float, pitch: float, lens: float) -> None:
    sc = bpy.context.scene
    cam = bpy.data.objects.new("hero_cam", bpy.data.cameras.new("hero_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = w, h
    cam.data.lens = lens
    cam.data.sensor_fit = "AUTO"
    c = (lo + hi) / 2
    yr, pr = math.radians(yaw), math.radians(pitch)
    d = Vector((math.sin(yr) * math.cos(pr), -math.cos(yr) * math.cos(pr), math.sin(pr)))
    # Fit: the bounding sphere fills ~92 % of the shorter frame side.
    rad = (hi - lo).length / 2
    fov_short = 2 * math.atan(18 / lens) * (min(w, h) / max(w, h))
    dist = rad / math.tan(fov_short / 2) / 0.92
    aim = Vector((c.x, c.y, lo.z + (hi.z - lo.z) * 0.46))
    cam.location = aim + d * dist
    cam.rotation_euler = (aim - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_start = dist * 0.01
    cam.data.clip_end = dist * 20
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = (aim - cam.location).length
    cam.data.dof.aperture_fstop = 5.6


def render_model(m: Uvox, out: Path, shots: dict | None = None) -> list[Path]:
    """Clone `m` (exact shell) on the stage and render every shot to `out`."""
    coll = bpy.data.collections.new(m.id)
    bpy.context.scene.collection.children.link(coll)
    shell = build.clone(replace(m, origin=(0, 0, 0), rot_y=0.0), coll)
    lo, hi = _bounds([shell])
    _stage(lo, hi)
    done = []
    for name, (w, h, yaw, pitch, lens) in (shots or SHOTS).items():
        for o in [o for o in bpy.context.scene.objects if o.name.startswith(("hero_key", "hero_fill", "hero_rim", "hero_top", "hero_cam"))]:
            bpy.data.objects.remove(o, do_unlink=True)
        _rig(lo, hi, yaw)
        _camera(lo, hi, w, h, yaw, pitch, lens)
        p = out / f"{name}.png"
        p.parent.mkdir(parents=True, exist_ok=True)
        bpy.context.scene.render.filepath = str(p)
        bpy.ops.render.render(write_still=True)
        done.append(p)
    return done
