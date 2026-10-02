"""Assembled crystal stills — a whole figure from its crystal GLBs (base + rig parts).

  blender -b --factory-startup -P scripts/crystal/blender/assemble.py -- --jobs jobs.json

jobs.json: [{"out": ".../x.png", "pieces": [{"glb": ".../a.glb", "at": [x, y, z]}], "size": 640}]
`at` = the piece's origin in the base model's voxel frame (y up, like the engine);
the GLBs are in voxel units with their origin at the grid corner. Written by
scripts/crystal/assemble-bots.ts (bots incl. upgrade levels, service dock).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from crystal.render import render_still, stage, studio_world  # noqa: E402


def clear() -> None:
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    # Fresh materials per figure (tame_emission must not compound across jobs).
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def assemble(pieces: list[dict]) -> bpy.types.Object:
    made: list[bpy.types.Object] = []
    for p in pieces:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=p["glb"])
        x, y, z = p["at"]
        for ob in set(bpy.data.objects) - before:
            if ob.type != "MESH":
                continue
            # glTF y-up → Blender z-up (the importer already rotated the mesh).
            ob.location.x += x
            ob.location.y += -z
            ob.location.z += y
            made.append(ob)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in made:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = made[0]
    if len(made) > 1:
        bpy.ops.object.join()
    tame_emission()
    return bpy.context.view_layer.objects.active


def tame_emission(k: float = 0.12) -> None:
    """Stills only: the game's emissive strength blows LEDs and light bands out
    to white under the studio exposure; scaled down they keep their colour."""
    for m in bpy.data.materials:
        if not m.node_tree:
            continue
        for n in m.node_tree.nodes:
            s = n.inputs.get("Emission Strength") if hasattr(n, "inputs") else None
            if s is not None and not s.is_linked and s.default_value > 0:
                s.default_value *= k
            if n.type == "EMISSION" and not n.inputs["Strength"].is_linked:
                n.inputs["Strength"].default_value *= k


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", required=True)
    ap.add_argument("--samples", type=int, default=128)
    a = ap.parse_args(argv)
    jobs = json.loads(Path(a.jobs).read_text())
    for job in jobs:
        clear()
        ob = assemble(job["pieces"])
        stage(ob, yaw=job.get("yaw", 35.0), pitch=job.get("pitch", 26.0), dark=True)
        studio_world(dark=True)
        render_still(job["out"], size=job.get("size", 640), samples=a.samples)
        print(f"[assemble] {job['out']}", flush=True)
    return 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    sys.exit(main(argv))
