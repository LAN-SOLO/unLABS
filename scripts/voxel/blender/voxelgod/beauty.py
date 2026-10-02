"""Lit renders of voxel clones (Cycles): every side, and the inside.

Still 100 % voxels: the shell is the exact face set of the grid, materials
are the game's four classes (voxel-mesh.ts: solid roughness 0.9, metal 0.35 /
metallic 0.8, glass alpha 0.45, emit ×2.4), edges stay hard. The cutaway is
a real voxel cut — the grid is sliced on the lattice and the cut model's
shell is rendered, so the inside shows exactly the voxels that are there.
"""

from __future__ import annotations

import math
from dataclasses import replace
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

from . import build
from .uvox import Uvox

# Named views: (yaw°, pitch°) — yaw 0 = looking at the game's +z face (front).
VIEWS = {
    "iso-front-right": (35, 30),
    "iso-front-left": (-35, 30),
    "iso-back-right": (145, 30),
    "iso-back-left": (-145, 30),
    "front": (0, 8),
    "side": (90, 8),
    "top": (0, 89),
}


def _world(strength: float = 0.6) -> None:
    sc = bpy.context.scene
    w = bpy.data.worlds.get("voxel_world") or bpy.data.worlds.new("voxel_world")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.045, 0.05, 0.06, 1)
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def _lights(center: Vector, radius: float) -> None:
    coll = bpy.data.collections.get("voxel_lights") or bpy.data.collections.new("voxel_lights")
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    for o in list(coll.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for name, off, energy, size, color in (
        ("key", (2.4, -3.0, 3.4), 320, 1.6, (1.0, 0.95, 0.88)),
        ("fill", (-3.2, -1.6, 1.2), 90, 3.0, (0.75, 0.85, 1.0)),
        ("rim", (-0.6, 3.4, 2.6), 240, 1.2, (1.0, 0.8, 0.6)),
    ):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy * radius * radius
        ld.size = size * radius
        ld.color = color
        o = bpy.data.objects.new(name, ld)
        o.location = center + Vector(off) * radius
        o.rotation_euler = (center - o.location).to_track_quat("-Z", "Y").to_euler()
        coll.objects.link(o)


def _camera(center: Vector, radius: float, yaw: float, pitch: float, ortho: bool) -> None:
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None or cam.name != "voxel_cam":
        cam = bpy.data.objects.get("voxel_cam") or bpy.data.objects.new("voxel_cam", bpy.data.cameras.new("voxel_cam"))
        if cam.name not in sc.collection.objects:
            sc.collection.objects.link(cam)
        sc.camera = cam
    yr, pr = math.radians(yaw), math.radians(pitch)
    d = Vector((math.sin(yr) * math.cos(pr), -math.cos(yr) * math.cos(pr), math.sin(pr)))
    cam.data.type = "ORTHO" if ortho else "PERSP"
    cam.data.lens = 70
    if ortho:
        cam.data.ortho_scale = radius * 2.3
        dist = radius * 4
    else:
        dist = radius / math.tan(cam.data.angle / 2) * 1.12
    cam.location = center + d * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_start = radius * 0.01
    cam.data.clip_end = dist + radius * 4


def _bounds(obs) -> tuple[Vector, float]:
    pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2, max((hi - lo).length / 2, 1e-3)


def setup(samples: int = 64, size: int = 900) -> None:
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for dv in prefs.devices:
            dv.use = dv.type == "METAL"
        sc.cycles.device = "GPU"
    except Exception:  # noqa: BLE001 — CPU is fine
        sc.cycles.device = "CPU"
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.image_settings.file_format = "PNG"
    _world()


def cut(m: Uvox, axis: str = "z", keep: str = "back") -> Uvox:
    """Voxel-exact cutaway: drop the half of the grid in front of the middle plane."""
    g = m.grid.copy()
    i = {"x": 2, "y": 1, "z": 0}[axis]
    mid = g.shape[i] // 2
    sl = [slice(None)] * 3
    sl[i] = slice(mid, None) if keep == "back" else slice(None, mid)
    g[tuple(sl)] = 0
    return replace(m, id=f"{m.id}.cut", grid=g)


def render_views(objs, out: Path, views: dict[str, tuple[float, float]] | None = None, *, ortho: bool = True) -> list[Path]:
    center, radius = _bounds(objs)
    _lights(center, radius)
    done = []
    for name, (yaw, pitch) in (views or VIEWS).items():
        _camera(center, radius, yaw, pitch, ortho)
        p = out / f"{name}.png"
        p.parent.mkdir(parents=True, exist_ok=True)
        bpy.context.scene.render.filepath = str(p)
        bpy.ops.render.render(write_still=True)
        done.append(p)
    return done


def render_model(m: Uvox, out: Path, *, views=None, cutaway: bool = True) -> list[Path]:
    coll = bpy.data.collections.new(m.id)
    bpy.context.scene.collection.children.link(coll)
    shell = build.clone(replace(m, origin=(0, 0, 0), rot_y=0.0), coll)
    files = render_views([shell], out, views)
    if cutaway:
        shell.hide_render = True
        cshell = build.clone(replace(cut(m), origin=(0, 0, 0), rot_y=0.0), coll)
        files += render_views([cshell], out, {"cutaway": (25, 24)})
        cshell.hide_render = True
    return files
