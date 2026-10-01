"""Jade Lawrence as a real human (Blender + MPFB2, CC0 MakeHuman assets).

  blender -b --factory-startup -P scripts/hero/blender/jade_mpfb.py -- \
      [--params scripts/hero/blender/jade.json] [--out .crystal/jade] \
      [--render face|portrait|full|none] [--samples 128] [--blend]

Builds the character from `jade.json` (phenotype + face targets + body
parts + skin) and renders a frontal still for comparison with the
reference portrait. MPFB must be installed as an extension
(`blender --online-mode --command extension install --sync --enable mpfb`)
with the CC0 system assets unpacked into its user data directory.

Two-sided targets (l-/r-) may be given without the side prefix; both
sides get the weight.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import addon_utils
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
EXT = "bl_ext.blender_org.mpfb"


def mpfb():
    addon_utils.enable(EXT, default_set=True)
    from bl_ext.blender_org.mpfb.services.assetservice import AssetService
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.targetservice import TargetService

    return HumanService, TargetService, AssetService


def target_stack(targets: dict[str, float], TargetService) -> list[dict]:
    out = []
    for name, value in targets.items():
        if TargetService.target_full_path(name):
            out.append({"target": name, "value": float(value)})
            continue
        sided = [f"{s}-{name}" for s in ("l", "r") if TargetService.target_full_path(f"{s}-{name}")]
        if not sided:
            print(f"[jade] unknown target {name!r}")
        out += [{"target": n, "value": float(value)} for n in sided]
    return out


def build(params: dict):
    HumanService, TargetService, AssetService = mpfb()
    info = HumanService._create_default_human_info_dict()
    info["phenotype"].update(params["phenotype"])
    info["targets"] = target_stack(params.get("targets", {}), TargetService)
    parts = params.get("bodyparts", {})
    for k in ("eyes", "eyebrows", "eyelashes", "teeth", "tongue"):
        if parts.get(k):
            info[k] = f"{parts[k]}/{parts[k]}.mhclo"
    skin = params.get("skin")
    if skin:
        info["skin_mhmat"] = f"skins/{skin}/{skin}.mhmat"
        info["skin_material_type"] = "ENHANCED_SSS"
    info["eyes_material_type"] = "PROCEDURAL_EYES"
    info["alternative_materials"] = {}
    settings = HumanService.get_default_deserialization_settings()
    settings["subdiv_levels"] = int(params.get("subdiv", 1))
    # Never a bare body: Jade is always dressed (MPFB CC0 clothes, tinted to her look).
    info["clothes"] = [f"{c}/{c}.mhclo" for c in params.get("clothes", [])]
    settings["load_clothes"] = bool(info["clothes"])
    basemesh = HumanService.deserialize_from_dict(info, settings)
    # Tag the body-part objects (MPFB names them after the asset).
    for k in ("eyes", "eyebrows", "eyelashes", "teeth", "tongue"):
        if parts.get(k):
            ob = bpy.data.objects.get(f"{basemesh.name}.{parts[k]}")
            if ob:
                ob["jade_part"] = k
    if parts.get("eyes_material"):
        set_iris(basemesh, parts["eyes_material"])
    dress(basemesh, params.get("clothes", []), params.get("clothColor", [0.86, 0.86, 0.84]))
    load_expressions(basemesh, params.get("expressions", {}), TargetService)
    # Proxies fitted before all targets settled can sit off the body: refit them.
    try:
        HumanService.refit(basemesh)
    except Exception as e:  # noqa: BLE001
        print(f"[jade] refit skipped: {e}")
    return basemesh


def dress(basemesh, clothes: list[str], colour) -> None:
    """Jade's crisp white shirt: MPFB's garment shape, a clean cotton material instead of its print."""
    mat = bpy.data.materials.new("jade_shirt")
    mat.use_nodes = True
    p = mat.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*colour, 1)
    p.inputs["Roughness"].default_value = 0.62
    p.inputs["Sheen Weight"].default_value = 0.35
    for c in clothes:
        ob = bpy.data.objects.get(f"{basemesh.name}.{c}")
        if not ob:
            continue
        ob["jade_part"] = "clothes"
        ob.data.materials.clear()
        ob.data.materials.append(mat)


MPFB_DATA = None


def load_expressions(basemesh, units: dict[str, float], TargetService) -> None:
    """Facial expression units (MPFB `targets/expression/units/caucasian`) as shape keys.

    They stay separate shape keys (`expr-<unit>`) so a game export can keep
    them as morph targets (smile, blink, brows) instead of baking them in.
    """
    import bl_ext.blender_org.mpfb as m

    base = Path(m.__file__).parent / "data" / "targets" / "expression" / "units" / "caucasian"
    for unit, w in units.items():
        f = base / f"{unit}.target.gz"
        if not f.exists():
            print(f"[jade] unknown expression unit {unit!r}")
            continue
        TargetService.load_target(basemesh, str(f), weight=float(w), name=f"expr-{unit}")


IRIS = {
    # Jade (portrait): dark brown with a warm ring.
    "brown": {
        "IrisMajorColor": (0.11, 0.045, 0.018, 1.0),
        "IrisMinorColor": (0.035, 0.016, 0.008, 1.0),
        "IrisSection4Color": (0.02, 0.012, 0.008, 1.0),
    },
}


def set_iris(basemesh, colour: str) -> None:
    """Iris colours of MPFB's procedural EnhancedEye group."""
    spec = IRIS.get(colour)
    if not spec:
        return
    for ob in bpy.data.objects:
        if ob.get("jade_part") != "eyes":
            continue
        for m in ob.data.materials:
            for n in (m.node_tree.nodes if m and m.node_tree else []):
                if n.type != "GROUP":
                    continue
                for k, v in spec.items():
                    if k in n.inputs:
                        n.inputs[k].default_value = v


def eye_centre(basemesh) -> Vector:
    """Midpoint between the eyes (the eyes proxy object), world space."""
    for ob in bpy.data.objects:
        if ob.type == "MESH" and ob.parent == basemesh and ob.get("jade_part") == "eyes":
            pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
            return sum(pts, Vector()) / 8
    # Fallback: 93 % of the visible height.
    zs = [basemesh.matrix_world @ v.co for v in basemesh.data.vertices]
    top = max(p.z for p in zs)
    return Vector((0, 0, top * 0.93))


def pupil_pixels(basemesh, size: tuple[int, int]) -> list[list[float]]:
    """Image pixel positions (x right, y down) of both pupils: the eye mesh halves' front points."""
    from bpy_extras.object_utils import world_to_camera_view

    scene = bpy.context.scene
    ob = next(o for o in bpy.data.objects if o.get("jade_part") == "eyes")
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    out = []
    for side in (-1, 1):  # image left = her right = +x? decide by projection below
        half = [p for p in pts if (p.x > 0) == (side > 0)]
        front = min(half, key=lambda p: p.y)  # MPFB front = -Y
        c = world_to_camera_view(scene, scene.camera, front)
        out.append([c.x * size[0], (1 - c.y) * size[1]])
    return sorted(out)


def studio(basemesh, view: str) -> None:
    scene = bpy.context.scene
    eyes = eye_centre(basemesh)
    cam_d = bpy.data.cameras.new("jade_cam")
    cam_d.lens = 85 if view != "full" else 50
    cam = bpy.data.objects.new("jade_cam", cam_d)
    scene.collection.objects.link(cam)
    # Framing in metres (MPFB scale 0.1 → metres): face ≈ the reference portrait's crop.
    if view == "face":
        target, dist = eyes + Vector((0, 0, 0.02)), 1.15
    elif view == "portrait":
        target, dist = eyes + Vector((0, 0, -0.07)), 1.55
    else:
        target, dist = Vector((eyes.x, eyes.y, eyes.z * 0.52)), 4.6
    # Front of an MPFB human is -Y.
    cam.location = target + Vector((0, -dist, 0))
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam

    def area(name, loc, energy, size, colour):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = size
        ld.color = colour
        ob = bpy.data.objects.new(name, ld)
        ob.location = target + Vector(loc)
        ob.rotation_euler = (target - ob.location).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(ob)

    # Close to the portrait: warm key from camera left, a red-orange rim from the right.
    # Like the portrait: a strong warm key from camera left (hard-ish, real shadow side),
    # almost no fill, an orange-red rim from behind right.
    area("key", (-1.0, -1.0, 0.55), 95, 0.55, (1.0, 0.8, 0.62))
    area("fill", (0.9, -1.2, 0.0), 4, 1.6, (0.85, 0.82, 0.95))
    area("rim", (0.75, 0.55, 0.45), 160, 0.35, (1.0, 0.3, 0.12))
    world = bpy.data.worlds.new("jade_world")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.09, 0.022, 0.016, 1)
    bg.inputs["Strength"].default_value = 1.0
    # Camera / light matrices must be current before projecting through the camera.
    bpy.context.view_layer.update()


def render(path: Path, samples: int, size: tuple[int, int]) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception:  # noqa: BLE001
        scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.3
    scene.render.filepath = str(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--params", default=str(ROOT / "scripts/hero/blender/jade.json"))
    ap.add_argument("--set", default=None, help="JSON merged into the params (look-dev)")
    ap.add_argument("--out", default=str(ROOT / ".crystal/jade"))
    ap.add_argument("--render", default="face")
    ap.add_argument("--samples", type=int, default=96)
    ap.add_argument("--blend", action="store_true")
    ap.add_argument("--name", default="jade")
    ap.add_argument("--export-head", default=None, help="write the game head GLB here")
    ap.add_argument("--hair", default=str(ROOT / ".crystal/jade/groom.json"), help="groom JSON ('' = bald)")
    ap.add_argument("--hair-density", type=float, default=1.6)
    ap.add_argument("--face", default=str(ROOT / "public/hero/jade-face.webp"), help="de-lit face window to bake ('' = off)")
    a = ap.parse_args(argv)
    params = json.loads(Path(a.params).read_text())
    if a.set:
        extra = json.loads(a.set)
        for k, v in extra.items():
            if isinstance(v, dict) and isinstance(params.get(k), dict):
                params[k].update(v)
            else:
                params[k] = v
    bpy.ops.wm.read_factory_settings(use_empty=True)
    basemesh = build(params)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    if a.face and Path(a.face).exists():
        import skin_bake

        studio(basemesh, "face")
        skin_bake.project(basemesh, bpy.context.scene.camera, (1000, 750), pupil_pixels(basemesh, (1000, 750)))
        skin_bake.bake(basemesh, Path(a.face), out / f"{a.name}-skin.png")
        for ob in [o for o in bpy.data.objects if o.type in ("CAMERA", "LIGHT")]:
            bpy.data.objects.remove(ob, do_unlink=True)
    if a.export_head:
        import export_head

        # Blink morph: lid-closure units as zero-weight shape keys.
        _, TargetService, _ = mpfb()
        load_expressions(basemesh, {"eye-left-closure": 0.0, "eye-right-closure": 0.0}, TargetService)
        export_head.export(basemesh, out / f"{a.name}-skin.png", Path(a.export_head))
    if a.hair and Path(a.hair).exists():
        import hair

        eyes = next(o for o in bpy.data.objects if o.get("jade_part") == "eyes")
        pts = [eyes.matrix_world @ v.co for v in eyes.data.vertices]
        fronts = []
        for side in (False, True):
            half = [p for p in pts if (p.x > 0) == side]
            fronts.append(min(half, key=lambda p: p.y))
        mid = (fronts[0] + fronts[1]) / 2
        # Eye centres sit behind the pupils (eyeball radius ≈ 12 mm).
        mid.y += 0.012
        hair.build(Path(a.hair), basemesh, mid, (fronts[0] - fronts[1]).length, a.hair_density)
    if a.render != "none":
        studio(basemesh, a.render)
        size = (1000, 750) if a.render != "full" else (750, 1000)
        render(out / f"{a.name}-{a.render}.png", a.samples, size)
        (out / f"{a.name}-{a.render}.json").write_text(json.dumps({"pupils": pupil_pixels(basemesh, size)}))
    if a.blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / f"{a.name}.blend"))
    print("[jade] ok", basemesh.name, len(basemesh.data.vertices))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []))
