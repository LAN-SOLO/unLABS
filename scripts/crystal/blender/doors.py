"""Door era renders — every door through all 42 clarity eras + the crystal age.

  blender -b --factory-startup -P scripts/crystal/blender/doors.py -- --jobs jobs.json

Written by scripts/crystal/doors.ts. Per door it loads the engine's voxel
meshes of each mesh tier (1, 2, 4, 6, 8 cubes per source voxel edge) and
renders every era of that tier with the era's look, then swaps in the
crystal GLBs:

- materials mirror lib/world/render/voxel-mesh.ts: solid (rough 0.9), metal
  (rough 0.35, metallic 0.8), glass (alpha 0.45), emit (unlit ×2.4); the
  era's `detail` drives the same colour mottle, roughness noise and fine
  relief as the game's `uDetail`
- `env` scales the studio reflections like `scene.environmentIntensity`
- the compositor applies ClarityGradePass's grade (saturation around Rec.709
  luma, contrast around 0.18) and a soft bloom for the emissive parts

Space: Blender units = world units (one source voxel = scale); the door
root is the engine's (x along the wall, game +z = front = Blender −y).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from crystal.render import gpu_on, studio_world  # noqa: E402

CLASSES = ("solid", "glass", "emit", "metal")  # MATERIAL_CLASSES order
DOOR = "door_parts"


# ── Scene ────────────────────────────────────────────────────────


def coll(name: str) -> bpy.types.Collection:
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def clear_coll(name: str) -> None:
    c = bpy.data.collections.get(name)
    if not c:
        return
    for o in list(c.objects):
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if isinstance(data, bpy.types.Mesh) and data.users == 0:
            bpy.data.meshes.remove(data)


def placement(at: list[float], rot_y: float, scale: float) -> Matrix:
    """Engine door-local (x, y, z; y up) → Blender (x, −z, y), turn about up, scale."""
    t = Matrix.Translation(Vector((at[0], -at[2], at[1])))
    return t @ Matrix.Rotation(rot_y, 4, "Z") @ Matrix.Scale(scale, 4)


# ── Voxel materials (the game's four classes + uDetail) ──────────


def _noise(N, L, coord, scale: float, detail: float = 2.0):
    n = N.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    L.new(coord, n.inputs["Vector"])
    # Fac 0..1 → −1..1 (the game's vdNoise range).
    m = N.new("ShaderNodeMath")
    m.operation = "MULTIPLY_ADD"
    m.inputs[1].default_value = 2.0
    m.inputs[2].default_value = -1.0
    L.new(n.outputs["Fac"], m.inputs[0])
    return m.outputs[0]


def voxel_material(cls: str) -> bpy.types.Material:
    """One material per class; the era's detail is the `detail` value node."""
    name = f"vox_{cls}"
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    N.clear()
    out = N.new("ShaderNodeOutputMaterial")
    col = N.new("ShaderNodeVertexColor")
    col.layer_name = "Col"
    if cls == "emit":
        em = N.new("ShaderNodeEmission")
        em.inputs["Strength"].default_value = 2.4
        L.new(col.outputs["Color"], em.inputs["Color"])
        L.new(em.outputs["Emission"], out.inputs["Surface"])
        return mat
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    if cls == "glass":
        L.new(col.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.1
        bsdf.inputs["Alpha"].default_value = 0.45
        return mat
    rough, metal, relief = (0.35, 0.8, 0.35) if cls == "metal" else (0.9, 0.0, 1.0)
    bsdf.inputs["Metallic"].default_value = metal
    det = N.new("ShaderNodeValue")
    det.name = "detail"
    det.outputs[0].default_value = 0.0
    # World-space position (the game's vWorldP), Blender units = world units.
    geo = N.new("ShaderNodeNewGeometry")
    wp = geo.outputs["Position"]
    # Colour mottle: × (1 + detail · 0.07 · (0.6 n(0.9 p) + 0.4 n(3.7 p))).
    n1 = _noise(N, L, wp, 0.9)
    n2 = _noise(N, L, wp, 3.7)
    mot = N.new("ShaderNodeMath")
    mot.operation = "MULTIPLY_ADD"
    L.new(n1, mot.inputs[0])
    mot.inputs[1].default_value = 0.6
    s2 = N.new("ShaderNodeMath")
    s2.operation = "MULTIPLY"
    L.new(n2, s2.inputs[0])
    s2.inputs[1].default_value = 0.4
    L.new(s2.outputs[0], mot.inputs[2])
    k = N.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    L.new(det.outputs[0], k.inputs[0])
    k.inputs[1].default_value = 0.07
    f = N.new("ShaderNodeMath")
    f.operation = "MULTIPLY_ADD"
    L.new(mot.outputs[0], f.inputs[0])
    L.new(k.outputs[0], f.inputs[1])
    f.inputs[2].default_value = 1.0
    tint = N.new("ShaderNodeVectorMath")
    tint.operation = "SCALE"
    L.new(col.outputs["Color"], tint.inputs[0])
    L.new(f.outputs[0], tint.inputs["Scale"])
    L.new(tint.outputs[0], bsdf.inputs["Base Color"])
    # Roughness: clamp(r + detail · 0.16 · relief · n(2.3 p + 7), 0.04, 1).
    n3 = _noise(N, L, wp, 2.3)
    rk = N.new("ShaderNodeMath")
    rk.operation = "MULTIPLY"
    L.new(det.outputs[0], rk.inputs[0])
    rk.inputs[1].default_value = 0.16 * relief
    r = N.new("ShaderNodeMath")
    r.operation = "MULTIPLY_ADD"
    r.use_clamp = False
    L.new(n3, r.inputs[0])
    L.new(rk.outputs[0], r.inputs[1])
    r.inputs[2].default_value = rough
    rc = N.new("ShaderNodeClamp")
    rc.inputs["Min"].default_value = 0.04
    rc.inputs["Max"].default_value = 1.0
    L.new(r.outputs[0], rc.inputs["Value"])
    L.new(rc.outputs[0], bsdf.inputs["Roughness"])
    # Fine relief: height = detail · 0.012 · relief · (n(9 p) + 0.5 n(23 p)).
    h9 = _noise(N, L, wp, 9.0, 1.0)
    h23 = _noise(N, L, wp, 23.0, 1.0)
    hs = N.new("ShaderNodeMath")
    hs.operation = "MULTIPLY_ADD"
    L.new(h23, hs.inputs[0])
    hs.inputs[1].default_value = 0.5
    L.new(h9, hs.inputs[2])
    hk = N.new("ShaderNodeMath")
    hk.operation = "MULTIPLY"
    L.new(det.outputs[0], hk.inputs[0])
    hk.inputs[1].default_value = 0.012 * relief
    hh = N.new("ShaderNodeMath")
    hh.operation = "MULTIPLY"
    L.new(hs.outputs[0], hh.inputs[0])
    L.new(hk.outputs[0], hh.inputs[1])
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 1.0
    L.new(hh.outputs[0], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def set_detail(v: float) -> None:
    for cls in ("solid", "metal"):
        m = bpy.data.materials.get(f"vox_{cls}")
        if m:
            m.node_tree.nodes["detail"].outputs[0].default_value = v


# ── Loading ──────────────────────────────────────────────────────


def load_mesh(path: str, name: str) -> bpy.types.Mesh:
    raw = Path(path).read_bytes()
    nv, ni, ng = np.frombuffer(raw, dtype=np.uint32, count=3)
    off = 12
    groups = np.frombuffer(raw, dtype=np.uint32, count=ng * 3, offset=off).reshape(-1, 3)
    off += int(ng) * 12
    pos = np.frombuffer(raw, dtype=np.float32, count=nv * 3, offset=off)
    off += int(nv) * 12
    col = np.frombuffer(raw, dtype=np.float32, count=nv * 3, offset=off)
    off += int(nv) * 12
    idx = np.frombuffer(raw, dtype=np.uint32, count=ni, offset=off)
    # Engine (x, y, z; y up) → Blender (x, −z, y).
    p = pos.reshape(-1, 3)
    co = np.empty_like(p)
    co[:, 0], co[:, 1], co[:, 2] = p[:, 0], -p[:, 2], p[:, 1]
    me = bpy.data.meshes.new(name)
    me.vertices.add(int(nv))
    me.vertices.foreach_set("co", co.ravel())
    nt = int(ni) // 3
    me.loops.add(int(ni))
    me.loops.foreach_set("vertex_index", idx.astype(np.int32))
    me.polygons.add(nt)
    me.polygons.foreach_set("loop_start", np.arange(0, ni, 3, dtype=np.int32))
    mats = np.zeros(nt, dtype=np.int32)
    for cls, start, count in groups:
        mats[start // 3 : (start + count) // 3] = cls
    for c in CLASSES:
        me.materials.append(voxel_material(c))
    me.polygons.foreach_set("material_index", mats)
    ca = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    rgba = np.ones((int(nv), 4), dtype=np.float32)
    rgba[:, :3] = col.reshape(-1, 3)
    ca.data.foreach_set("color", rgba.ravel())
    me.update()
    me.validate(clean_customdata=False)
    return me


def build_voxels(job: dict, tier: int, scale: float) -> list[bpy.types.Object]:
    c = coll(DOOR)
    made = []
    for i, p in enumerate(job["parts"]):
        me = load_mesh(p["tiers"][str(tier)], f"{job['id']}-{i}-t{tier}")
        ob = bpy.data.objects.new(me.name, me)
        ob.matrix_world = placement(p["at"], p["rotY"], scale)
        ob["mech"] = p["mech"]
        c.objects.link(ob)
        made.append(ob)
    return made


def build_crystal(job: dict, scale: float) -> list[bpy.types.Object]:
    c = coll(DOOR)
    made = []
    for p in job["parts"]:
        if not p["glb"]:
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=p["glb"])
        sx, _sy, sz = p["size"]
        # GLB: source voxel units, min corner at 0 → centre x/z like the engine.
        centre = Matrix.Translation(Vector((-sx / 2, sz / 2, 0)))
        m = placement(p["at"], p["rotY"], scale) @ centre
        for ob in set(bpy.data.objects) - before:
            for col in list(ob.users_collection):
                col.objects.unlink(ob)
            c.objects.link(ob)
            if ob.parent is None:
                ob.matrix_world = m @ ob.matrix_world
            if ob.type == "MESH":
                ob["mech"] = p["mech"]
                made.append(ob)
    game_emission()
    return made


def game_emission() -> None:
    """In the game, crystal emissive surfaces reuse the voxel `emit` material
    (vertex colour × 2.4, docs/CRYSTAL.md); the GLB's own emission is white.
    Glow in the part's colour, like the engine."""
    for m in bpy.data.materials:
        if m.get("game_emit") or not m.node_tree or m.name.startswith("vox_"):
            continue
        for n in m.node_tree.nodes:
            if n.type != "BSDF_PRINCIPLED":
                continue
            es = n.inputs["Emission Strength"]
            if es.is_linked or es.default_value <= 0:
                continue
            base = n.inputs["Base Color"]
            if base.is_linked:
                m.node_tree.links.new(base.links[0].from_socket, n.inputs["Emission Color"])
            es.default_value = 2.4
        m["game_emit"] = True


# ── Stage, camera, compositor ────────────────────────────────────


def bounds(obs: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    pts = [ob.matrix_world @ Vector(v) for ob in obs for v in ob.bound_box]
    lo = Vector((min(v.x for v in pts), min(v.y for v in pts), min(v.z for v in pts)))
    hi = Vector((max(v.x for v in pts), max(v.y for v in pts), max(v.z for v in pts)))
    return lo, hi


def make_stage(lo: Vector, hi: Vector) -> None:
    """Floor, key / fill / rim area lights (render.py's studio), sized to the door."""
    clear_coll("door_stage")
    c = coll("door_stage")
    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 1e-3)
    me = bpy.data.meshes.new("floor")
    s = radius * 8
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    fm = bpy.data.materials.get("door_floor") or bpy.data.materials.new("door_floor")
    fm.use_nodes = True
    b = fm.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.035, 0.037, 0.042, 1)
    b.inputs["Roughness"].default_value = 0.55
    me.materials.append(fm)
    fl = bpy.data.objects.new("floor", me)
    fl.location = (center.x, center.y, lo.z)
    c.objects.link(fl)

    def area(name, loc, energy, size, color):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy * radius * radius
        ld.size = size * radius
        ld.color = color
        o = bpy.data.objects.new(name, ld)
        o.location = center + Vector(loc) * radius
        o.rotation_euler = (center - o.location).to_track_quat("-Z", "Y").to_euler()
        c.objects.link(o)

    area("key", (2.2, -3.0, 3.0), 240, 2.0, (1.0, 0.95, 0.88))
    area("fill", (-3.2, -1.8, 1.4), 75, 3.0, (0.75, 0.85, 1.0))
    area("rim", (-0.8, 3.4, 2.8), 200, 1.2, (1.0, 0.78, 0.55))


def aim(lo: Vector, hi: Vector, yaw: float, pitch: float, *, lens: float = 60, margin: float = 1.08) -> None:
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None:
        cam = bpy.data.objects.new("door_cam", bpy.data.cameras.new("door_cam"))
        coll("door_stage").objects.link(cam)
        sc.camera = cam
    cam.data.lens = lens
    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 1e-3)
    yr, pr = math.radians(yaw), math.radians(pitch)
    dist = radius / math.tan(cam.data.angle / 2) * margin
    off = Vector((math.sin(yr) * math.cos(pr), -math.cos(yr) * math.cos(pr), math.sin(pr))) * dist
    cam.location = center + off
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_start = 0.01
    cam.data.clip_end = dist * 10


def compositor() -> None:
    """Bloom on the emissive parts, then ClarityGradePass.grade():
    c = max(mix(luma, c, saturation), 0); c = max((c − 0.18) · contrast + 0.18, 0)."""
    sc = bpy.context.scene
    ng = bpy.data.node_groups.new("door_grade", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    N, L = ng.nodes, ng.links
    rl = N.new("CompositorNodeRLayers")
    out = N.new("NodeGroupOutput")
    glare = N.new("CompositorNodeGlare")
    for v in ("Bloom", "BLOOM", "Fog Glow", "FOG_GLOW"):
        try:
            glare.inputs["Type"].default_value = v
            break
        except (TypeError, ValueError):
            continue
    glare.inputs["Threshold"].default_value = 1.2
    glare.inputs["Strength"].default_value = 0.35
    if "Size" in glare.inputs:
        glare.inputs["Size"].default_value = 0.6
    L.new(rl.outputs["Image"], glare.inputs["Image"])
    luma = N.new("CompositorNodeRGBToBW")
    L.new(glare.outputs["Image"], luma.inputs["Image"])
    diff = N.new("ShaderNodeVectorMath")
    diff.operation = "SUBTRACT"
    L.new(glare.outputs["Image"], diff.inputs[0])
    L.new(luma.outputs[0], diff.inputs[1])
    sat = N.new("ShaderNodeVectorMath")
    sat.name = "saturation"
    sat.operation = "MULTIPLY_ADD"
    L.new(diff.outputs[0], sat.inputs[0])
    sat.inputs[1].default_value = (1.0, 1.0, 1.0)
    L.new(luma.outputs[0], sat.inputs[2])
    m0 = N.new("ShaderNodeVectorMath")
    m0.operation = "MAXIMUM"
    m0.inputs[1].default_value = (0.0, 0.0, 0.0)
    L.new(sat.outputs[0], m0.inputs[0])
    con = N.new("ShaderNodeVectorMath")
    con.name = "contrast"
    con.operation = "MULTIPLY_ADD"
    L.new(m0.outputs[0], con.inputs[0])
    con.inputs[1].default_value = (1.0, 1.0, 1.0)
    con.inputs[2].default_value = (0.0, 0.0, 0.0)
    m1 = N.new("ShaderNodeVectorMath")
    m1.operation = "MAXIMUM"
    m1.inputs[1].default_value = (0.0, 0.0, 0.0)
    L.new(con.outputs[0], m1.inputs[0])
    L.new(m1.outputs[0], out.inputs["Image"])
    sc.compositing_node_group = ng


def set_grade(saturation: float, contrast: float) -> None:
    ng = bpy.context.scene.compositing_node_group
    ng.nodes["saturation"].inputs[1].default_value = (saturation,) * 3
    c = ng.nodes["contrast"]
    c.inputs[1].default_value = (contrast,) * 3
    c.inputs[2].default_value = (0.18 * (1 - contrast),) * 3


def set_env(env: float) -> None:
    """The game scales its environment light with `env` (0.35 → 1.3); 1.3 = full studio."""
    w = bpy.context.scene.world
    for n in w.node_tree.nodes:
        if n.type == "BACKGROUND" and n.inputs["Color"].is_linked:
            n.inputs["Strength"].default_value = env / 1.3


def render(path: Path, size: tuple[int, int], samples: int) -> None:
    sc = bpy.context.scene
    sc.cycles.samples = samples
    sc.render.resolution_x, sc.render.resolution_y = size
    path.parent.mkdir(parents=True, exist_ok=True)
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def setup(samples: int) -> None:
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    gpu_on()
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.cycles.transparent_max_bounces = 16
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.image_settings.file_format = "PNG"
    studio_world(dark=True)
    compositor()


# ── Contact sheet ────────────────────────────────────────────────


def sheet(folder: Path, eras: int, cols: int = 6, tile: int = 300) -> None:
    """All eras, one chapter (6 eras) per row, + the crystal age (front, back) as the last row."""
    files = [folder / f"era-{i:02d}.png" for i in range(eras)] + [
        folder / f
        for f in ("crystal-front.png", "crystal-back.png", "mech-crystal.png", "iface-crystal.png")
        if (folder / f).exists()
    ]
    rows = math.ceil(len(files) / cols)
    W, H = cols * tile, rows * tile
    canvas = np.zeros((H, W, 4), dtype=np.float32)
    canvas[..., 3] = 1
    for k, f in enumerate(files):
        if not f.exists():
            continue
        img = bpy.data.images.load(str(f))
        img.scale(tile, tile)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(tile, tile, 4)
        bpy.data.images.remove(img)
        r, c = divmod(k, cols)
        y0 = H - (r + 1) * tile  # image rows run bottom-up
        canvas[y0 : y0 + tile, c * tile : (c + 1) * tile] = px
    out = bpy.data.images.new("sheet", W, H, alpha=False)
    out.pixels.foreach_set(canvas.ravel())
    out.filepath_raw = str(folder / "sheet.png")
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)


# ── Main ─────────────────────────────────────────────────────────


def closeups(obs: list[bpy.types.Object]) -> dict[str, tuple[Vector, Vector]]:
    """Close-up boxes: the first locking part ("mech") and the lock interface ("iface")."""
    out: dict[str, tuple[Vector, Vector]] = {}
    pad = Vector((0.35, 0.35, 0.35))
    mech = [o for o in obs if o.get("mech") == "mech"]
    if mech:
        lo, hi = bounds(mech[:1])
        out["mech"] = (lo - pad, hi + pad)
    iface = [o for o in obs if o.get("mech") == "iface"]
    if iface:
        lo, hi = bounds(iface)
        out["iface"] = (lo - pad, hi + pad)
    return out


def close_aim(kind: str, box: tuple[Vector, Vector], job: dict) -> None:
    """Close-up camera: nearly frontal, turned from the door's middle towards
    the part (jamb hardware is not hidden behind the frame)."""
    cx = (box[0].x + box[1].x) / 2
    side = -1.0 if cx > 0 else 1.0
    yaw = side * 14.0 if kind == "mech" else job["yaw"] + 14
    aim(box[0], box[1], yaw, job["pitch"] + 8, lens=80, margin=1.0)


def run_job(job: dict, eras: list[dict], scale: float, samples: int, size: int, make_sheet: bool) -> None:
    folder = Path(job["out"])
    t0 = time.time()
    by_tier: dict[int, list[dict]] = {}
    for e in eras:
        by_tier.setdefault(e["tier"], []).append(e)
    lo = hi = None
    close: dict[str, tuple[Vector, Vector]] = {}
    last = eras[-1]
    for tier, group in sorted(by_tier.items()):
        clear_coll(DOOR)
        obs = build_voxels(job, tier, scale)
        if lo is None:
            # One framing for every era (the voxel tiers share source units).
            lo, hi = bounds(obs)
            make_stage(lo, hi)
            # The airlock overview has no close-ups: its doors have their own (the chamber hardware blocks the view).
            close = {} if job["id"].startswith("airlock-") else closeups(obs)
        for e in group:
            out = folder / f"era-{e['index']:02d}.png"
            if out.exists():
                continue
            aim(lo, hi, job["yaw"], job["pitch"])
            set_detail(e["detail"])
            set_env(e["env"])
            set_grade(e["saturation"], e["contrast"])
            render(out, (size, size), samples)
        if tier == last["tier"]:
            for kind, box in close.items():
                close_aim(kind, box, job)
                render(folder / f"{kind}-era{last['index']}.png", (size, size), samples)
    # Crystal age: the last era's grade on the Blender-built surfaces.
    clear_coll(DOOR)
    cobs = build_crystal(job, scale)
    if cobs:
        set_env(last["env"])
        set_grade(last["saturation"], last["contrast"])
        aim(lo, hi, job["yaw"], job["pitch"])
        render(folder / "crystal-front.png", (size, size), samples * 2)
        aim(lo, hi, 180 - job["yaw"], job["pitch"])
        render(folder / "crystal-back.png", (size, size), samples * 2)
        for kind, box in close.items():
            close_aim(kind, box, job)
            render(folder / f"{kind}-crystal.png", (size, size), samples * 2)
    if make_sheet:
        sheet(folder, len(eras))
    print(f"[doors] {job['id']} {time.time() - t0:.0f}s", flush=True)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", required=True)
    ap.add_argument("--sheets-only", action="store_true")
    a = ap.parse_args(argv)
    if a.sheets_only:
        spec = json.loads(Path(a.jobs).read_text())
        for job in spec["jobs"]:
            sheet(Path(job["out"]), len(spec["eras"]))
        return 0
    spec = json.loads(Path(a.jobs).read_text())
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    setup(spec["samples"])
    for job in spec["jobs"]:
        run_job(job, spec["eras"], spec["scale"], spec["samples"], spec["size"], spec.get("sheet", True))
    return 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    sys.exit(main(argv))
