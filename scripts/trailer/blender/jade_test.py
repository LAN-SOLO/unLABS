"""Smoke test for the trailer hero: three EEVEE stills of the rigged Jade.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
        -P scripts/trailer/blender/jade_test.py -- [out_dir] [--samples=64] [--pose]

Needs .voxel/trailer/jade/ (scripts/trailer/jade.ts). Renders, on a dark
background with simple three-point lighting and the AgX view transform:

  jade_front34.png   full figure, front three-quarter
  jade_back.png      from behind, upper body (the updo, the knot, the nape)
  jade_profile.png   close-up profile of the head

``--pose`` turns the head and lifts the left arm first (checks the rig).
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import jade  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = Path(next((a for a in ARGS if not a.startswith("--")), "/tmp/jade"))
SAMPLES = int(next((a.split("=")[1] for a in ARGS if a.startswith("--samples=")), "64"))
POSE = "--pose" in ARGS


def scene_setup() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    ee = sc.eevee
    ee.taa_render_samples = SAMPLES
    for attr, val in (("use_shadows", True), ("use_raytracing", True), ("shadow_ray_count", 2), ("shadow_step_count", 8)):
        if hasattr(ee, attr):
            setattr(ee, attr, val)
    sc.render.resolution_x = 1080
    sc.render.resolution_y = 1350
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = -0.3
    sc.render.hair_type = "STRIP"
    sc.render.hair_subdiv = 1
    world = bpy.data.worlds.new("dark")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.012, 0.013, 0.016, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.world = world
    return sc


def area(name: str, loc: tuple[float, float, float], target: Vector, energy: float, size: float, colour: tuple[float, float, float]) -> None:
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    ld.color = colour
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def lights(head: Vector) -> None:
    """Key (warm, front-left high), fill (cool, front-right low), rim (behind, for the copper glow)."""
    area("key", (-4.5, -6.0, 7.0), head, 800, 3.0, (1.0, 0.93, 0.85))
    area("fill", (6.0, -5.0, 3.5), head, 180, 4.0, (0.8, 0.88, 1.0))
    area("rim", (2.5, 6.0, 7.5), head, 900, 2.0, (1.0, 0.9, 0.8))
    area("rim2", (-3.0, 5.0, 4.0), head - Vector((0, 0, 1.5)), 300, 2.0, (0.85, 0.9, 1.0))
    # A dark floor so the boots stand on something.
    me = bpy.data.meshes.new("floor")
    me.from_pydata([(-20, -20, 0), (20, -20, 0), (20, 20, 0), (-20, 20, 0)], [], [(0, 1, 2, 3)])
    m = bpy.data.materials.new("floor")
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.02, 0.02, 0.022, 1)
    p.inputs["Roughness"].default_value = 0.6
    me.materials.append(m)
    ob = bpy.data.objects.new("floor", me)
    bpy.context.scene.collection.objects.link(ob)


def shot(name: str, loc: tuple[float, float, float], target: Vector, lens: float) -> None:
    sc = bpy.context.scene
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.01
    cam = bpy.data.objects.new(name, cd)
    sc.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[jade_test] {sc.render.filepath}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    scene_setup()
    rig = jade.build_jade()
    if POSE:
        jade.pose_joint(rig, "head", (0.0, 0.45, 0.0))
        jade.pose_joint(rig, "upperArmL", (0.0, 0.0, 1.1))
        jade.pose_joint(rig, "forearmL", (-0.9, 0.0, 0.0))
    u = rig["jade_unit"]
    head = Vector((0, 0, 56.5 * u))
    lights(head)
    mid = Vector((0, 0, 30.0 * u))
    shot("jade_front34", (4.6, -9.0, 3.6), mid + Vector((0, 0, 0.1)), 50)
    shot("jade_back", (-1.4, 5.2, 6.2), Vector((0, 0, 52.0 * u)), 50)
    shot("jade_profile", (2.7, -0.15, 5.1), Vector((0, 0.05, 56.8 * u)), 85)


if __name__ == "__main__":
    main()
