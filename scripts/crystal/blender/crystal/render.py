"""Studio previews: a lit stage, a camera framed on the object, Cycles stills."""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector

STAGE = "crystal_stage"


def gpu_on() -> str:
    """Use the GPU for Cycles if there is one (Metal on Apple silicon)."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            devs = [d for d in prefs.devices if d.type == kind]
            if devs:
                for d in prefs.devices:
                    d.use = d.type == kind
                bpy.context.scene.cycles.device = "GPU"
                return kind
    except Exception as e:  # noqa: BLE001 — preview must never fail on device setup
        print(f"[crystal] GPU setup failed: {e}")
    bpy.context.scene.cycles.device = "CPU"
    return "CPU"


def _coll() -> bpy.types.Collection:
    c = bpy.data.collections.get(STAGE)
    if not c:
        c = bpy.data.collections.new(STAGE)
        bpy.context.scene.collection.children.link(c)
    return c


def _clear_stage() -> None:
    c = bpy.data.collections.get(STAGE)
    if not c:
        return
    for o in list(c.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def stage(ob: bpy.types.Object, *, yaw: float = 35.0, pitch: float = 24.0, dark: bool = True) -> bpy.types.Object:
    """Ground, three area lights and a camera framing `ob`. Returns the camera."""
    _clear_stage()
    c = _coll()
    scene = bpy.context.scene
    bb = [ob.matrix_world @ Vector(v) for v in ob.bound_box]
    lo = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    hi = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 1e-3)

    # Floor (shadow catcher look: dark matte).
    bpy.ops.mesh.primitive_plane_add(size=radius * 12, location=(center.x, center.y, lo.z))
    floor = bpy.context.active_object
    floor.name = "crystal_floor"
    fm = bpy.data.materials.get("crystal_floor") or bpy.data.materials.new("crystal_floor")
    fm.use_nodes = True
    p = fm.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.03, 0.032, 0.036, 1) if dark else (0.6, 0.6, 0.62, 1)
    p.inputs["Roughness"].default_value = 0.6
    floor.data.materials.append(fm)
    for col in floor.users_collection:
        col.objects.unlink(floor)
    c.objects.link(floor)

    def area(name, loc, energy, size, color):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy * radius * radius
        ld.size = size * radius
        ld.color = color
        lo_ = bpy.data.objects.new(name, ld)
        lo_.location = center + Vector(loc) * radius
        d = center - lo_.location
        lo_.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        c.objects.link(lo_)

    area("key", (2.5, -3.0, 3.2), 260, 2.0, (1.0, 0.95, 0.88))
    area("fill", (-3.2, -1.5, 1.6), 70, 3.0, (0.75, 0.85, 1.0))
    area("rim", (-0.8, 3.4, 2.8), 220, 1.2, (1.0, 0.78, 0.55))

    studio_world(dark=dark)

    cam_d = bpy.data.cameras.new("crystal_cam")
    cam_d.lens = 70
    cam = bpy.data.objects.new("crystal_cam", cam_d)
    c.objects.link(cam)
    yr, pr = math.radians(yaw), math.radians(pitch)
    dist = radius / math.tan(cam_d.angle / 2) * 1.12
    # Front of the model is game +z → Blender -y.
    off = Vector((math.sin(yr) * math.cos(pr), -math.cos(yr) * math.cos(pr), math.sin(pr))) * dist
    cam.location = center + off
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return cam


def studio_world(*, dark: bool = True, hdri: str | None = None, strength: float = 1.0) -> None:
    """Environment the metals reflect: an HDRI from the library, else a softbox studio.

    The procedural studio is a vertical gradient (dark floor, warm horizon,
    cool ceiling) plus two bright softbox bands — enough for chrome and
    painted metal to read as metal. The camera sees a dark backdrop
    (light-path trick) so previews stay on the lab's dark background.
    """
    scene = bpy.context.scene
    world = bpy.data.worlds.get("crystal_world") or bpy.data.worlds.new("crystal_world")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputWorld")
    lit = N.new("ShaderNodeBackground")
    lit.inputs["Strength"].default_value = strength
    img = None
    if hdri:
        from .look import _img

        img = _img(hdri, "Linear Rec.709")
    if img:
        env = N.new("ShaderNodeTexEnvironment")
        env.image = img
        L.new(env.outputs["Color"], lit.inputs["Color"])
    else:
        tc = N.new("ShaderNodeTexCoord")
        sep = N.new("ShaderNodeSeparateXYZ")
        L.new(tc.outputs["Generated"], sep.inputs["Vector"])
        ramp = N.new("ShaderNodeValToRGB")
        cr = ramp.color_ramp
        cr.elements[0].position = 0.0
        cr.elements[0].color = (0.02, 0.02, 0.022, 1)
        cr.elements[1].position = 1.0
        cr.elements[1].color = (0.55, 0.6, 0.7, 1)
        e = cr.elements.new(0.5)
        e.color = (0.32, 0.27, 0.22, 1)
        e2 = cr.elements.new(0.7)
        e2.color = (2.2, 2.2, 2.3, 1)  # softbox band
        e3 = cr.elements.new(0.76)
        e3.color = (0.3, 0.32, 0.36, 1)
        mr = N.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = -1.0
        mr.inputs["From Max"].default_value = 1.0
        L.new(sep.outputs["Z"], mr.inputs["Value"])
        L.new(mr.outputs["Result"], ramp.inputs["Fac"])
        L.new(ramp.outputs["Color"], lit.inputs["Color"])
    # Camera rays see a plain backdrop; reflections and light see the studio.
    back = N.new("ShaderNodeBackground")
    back.inputs["Color"].default_value = (0.012, 0.013, 0.016, 1) if dark else (0.5, 0.52, 0.55, 1)
    lp = N.new("ShaderNodeLightPath")
    mix = N.new("ShaderNodeMixShader")
    L.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    L.new(lit.outputs["Background"], mix.inputs[1])
    L.new(back.outputs["Background"], mix.inputs[2])
    L.new(mix.outputs["Shader"], out.inputs["Surface"])


def render_still(path: str | Path, *, size: int = 768, samples: int = 96) -> Path:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    gpu_on()
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return path
