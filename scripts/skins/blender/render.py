"""Skin renders (Cycles): every room's walls and floor in its moods.

  blender -b --factory-startup -P scripts/skins/blender/render.py -- [--only kontroll,mcp]
          [--samples 48] [--width 1600] [--frames] [--no-overview]

Reads .voxel/skins/<room>/{grid.uvox.json, skin.json} (pnpm skins:export) and
writes .voxel/skins/<room>/render/:
  overview.png            iso view of the whole room, signature mood
  eye-<n>-<preset>.png    eye-level view of the main wall, one per mood
  frames/f<k>.png         one loop of the signature mood (with --frames)

Still voxels only: the shell is the exact face set of the fine grid
(voxelgod.build.exposed_faces), hard edges, the game's material classes.
The three skin channels (skin_line / skin_node / skin_field) are tinted per
mood exactly like the planned shader: line and node emit colour × level ×
intensity, the field is paint plus fieldGlow × level × intensity emission.
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts/voxel/blender"))

from voxelgod import uvox  # noqa: E402
from voxelgod.build import _FACES, exposed_faces, srgb_to_linear  # noqa: E402

SK = ROOT / ".voxel/skins"
CLASSES = ("solid", "glass", "emit", "metal")
EMIT_STATIC = 2.4  # game emit class (voxel-mesh.ts)
EMIT_CHANNEL = 4.0  # skin line / node at full level
EMIT_FIELD = 2.2  # field glow at fieldGlow 1
FILL = 7.0  # overhead fill (W per fine voxel² of floor): the lab lamps, kept low


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def materials() -> list[bpy.types.Material]:
    """Four classes; base colour from `Col`, emission from `Emit` (per face corner)."""
    mats = []
    for cls in CLASSES:
        m = bpy.data.materials.new(f"skin:{cls}")
        m.use_nodes = True
        nt = m.node_tree
        N, L = nt.nodes, nt.links
        N.clear()
        out = N.new("ShaderNodeOutputMaterial")
        col = N.new("ShaderNodeVertexColor")
        col.layer_name = "Col"
        em = N.new("ShaderNodeVertexColor")
        em.layer_name = "Emit"
        b = N.new("ShaderNodeBsdfPrincipled")
        L.new(col.outputs["Color"], b.inputs["Base Color"])
        L.new(em.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 1.0
        rough, metal = {"solid": (0.85, 0.0), "metal": (0.35, 0.75), "glass": (0.08, 0.0), "emit": (0.6, 0.0)}[cls]
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
        if cls == "glass":
            b.inputs["Alpha"].default_value = 0.5
        L.new(b.outputs["BSDF"], out.inputs["Surface"])
        mats.append(m)
    return mats


class Room:
    """One room's shell with re-tintable channel faces."""

    def __init__(self, room: str, cut: bool = False) -> None:
        self.dir = SK / room
        full = uvox.load(self.dir / "grid.uvox.json")
        self.m = uvox.load(self.dir / "cut.uvox.json") if cut else full
        self.meta = json.loads((self.dir / "skin.json").read_text())
        g = self.m.grid
        self.sz, self.sy, self.sx = g.shape
        names = {i: p["name"] for i, p in full.palette.items()}
        self.ch = {n: next((i for i, v in names.items() if v == n), -1) for n in ("skin_line", "skin_node", "skin_field")}
        # Channel ordinals always count over the full grid (the export's level order).
        rank = np.cumsum(np.isin(full.grid, [v for v in self.ch.values() if v > 0]).ravel()) - 1
        mask = np.isin(g, [v for v in self.ch.values() if v > 0])
        verts, cells, dirs = [], [], []
        for d, xyz in exposed_faces(g):
            if not len(xyz):
                continue
            base = np.stack([xyz[:, 0], -xyz[:, 2] - 1, xyz[:, 1]], axis=1).astype(np.float64)
            tpl = np.asarray(_FACES[d], dtype=np.float64)
            verts.append((base[:, None, :] + tpl[None, :, :]).reshape(-1, 3))
            cells.append(xyz)
            dirs.append(np.full(len(xyz), d))
        V = np.concatenate(verts)
        X = np.concatenate(cells)
        nf = len(X)
        self.nf = nf
        me = bpy.data.meshes.new(room)
        me.vertices.add(nf * 4)
        me.vertices.foreach_set("co", V.astype(np.float32).ravel())
        me.loops.add(nf * 4)
        me.loops.foreach_set("vertex_index", np.arange(nf * 4, dtype=np.int32))
        me.polygons.add(nf)
        me.polygons.foreach_set("loop_start", np.arange(0, nf * 4, 4, dtype=np.int32))
        self.pal = g[X[:, 2], X[:, 1], X[:, 0]].astype(np.int32)
        flat = X[:, 0] + self.sx * (X[:, 1] + self.sy * X[:, 2])
        self.ordinal = np.where(mask.ravel()[flat], rank[flat], -1)
        cls_of = {i: CLASSES.index(p["mat"]) for i, p in self.m.palette.items()}
        me.polygons.foreach_set("material_index", np.asarray([cls_of[int(v)] for v in self.pal], dtype=np.int32))
        lut = np.zeros((256, 3))
        emit = np.zeros(256)
        for i, p in self.m.palette.items():
            lut[i] = srgb_to_linear(np.asarray(p["rgb"]) / 255.0)
            emit[i] = EMIT_STATIC if p["mat"] == "emit" else 0.0
        self.base_col = lut[self.pal]
        self.base_emit = lut[self.pal] * emit[self.pal][:, None]
        for nm in ("Col", "Emit"):
            me.color_attributes.new(nm, "FLOAT_COLOR", "CORNER")
        for mat in materials():
            me.materials.append(mat)
        me.update()
        self.mesh = me
        self.obj = bpy.data.objects.new(room + (":cut" if cut else ""), me)
        bpy.context.scene.collection.objects.link(self.obj)

    def tint(self, var: dict, frame: dict) -> None:
        lv = np.frombuffer(base64.b64decode(frame["levels"]), dtype=np.uint8).astype(np.float64) / 255.0
        col = self.base_col.copy()
        emi = self.base_emit.copy()
        k = float(var["intensity"])
        lin = lambda c: srgb_to_linear(np.asarray(c, dtype=np.float64) / 255.0)  # noqa: E731
        for name, rgb, glow, strength in (
            ("skin_line", frame["line"], 1.0, EMIT_CHANNEL),
            ("skin_node", var["node"], 1.0, EMIT_CHANNEL),
            ("skin_field", var["field"], float(var["fieldGlow"]), EMIT_FIELD),
        ):
            idx = self.ch[name]
            if idx < 0:
                continue
            sel = self.pal == idx
            if not sel.any():
                continue
            c = lin(rgb)
            level = lv[self.ordinal[sel]]
            if name == "skin_field":
                col[sel] = c
            else:
                col[sel] = c * 0.18
            emi[sel] = c[None, :] * (level * k * glow * strength)[:, None]
        for nm, arr in (("Col", col), ("Emit", emi)):
            rgba = np.ones((self.nf, 4), dtype=np.float32)
            rgba[:, :3] = arr
            self.mesh.color_attributes[nm].data.foreach_set("color", np.repeat(rgba, 4, axis=0).ravel())
        self.mesh.update()


def setup(samples: int, width: int, height: int) -> None:
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
    sc.cycles.max_bounces = 6
    sc.render.resolution_x = width
    sc.render.resolution_y = height
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.image_settings.file_format = "PNG"
    w = bpy.data.worlds.new("skin_world")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.02, 0.022, 0.026, 1)
    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    bloom()


def bloom() -> None:
    """Compositor glare (the game's bloom pass). Optional — skipped if the API differs."""
    sc = bpy.context.scene
    try:
        ng = bpy.data.node_groups.new("skin_comp", "CompositorNodeTree")
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
        for k, v in (("Threshold", 1.2), ("Strength", 0.55), ("Size", 0.6)):
            if k in gl.inputs:
                gl.inputs[k].default_value = v
        L.new(rl.outputs["Image"], gl.inputs["Image"])
        L.new(gl.outputs["Image"], out.inputs[0])
        sc.render.use_compositing = True
    except Exception as e:  # noqa: BLE001
        print(f"[skins] bloom skipped: {e}")


def lights(room: Room) -> None:
    """Soft overhead fill: the lab's lamps, low so the skins carry the mood."""
    sx, sz = room.sx, room.sz
    ld = bpy.data.lights.new("fill", "AREA")
    ld.shape = "RECTANGLE"
    ld.size = sx * 0.9
    ld.size_y = sz * 0.9
    ld.energy = FILL * sx * sz
    ld.color = (1.0, 0.96, 0.9)
    o = bpy.data.objects.new("fill", ld)
    o.location = (sx / 2, -sz / 2, 120)
    bpy.context.scene.collection.objects.link(o)


def camera() -> bpy.types.Object:
    sc = bpy.context.scene
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def aim(cam: bpy.types.Object, eye: Vector, target: Vector) -> None:
    cam.location = eye
    cam.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()


def overview(room: Room, cam: bpy.types.Object) -> None:
    """Iso-like view (the game's camera direction), orthographic, whole room."""
    sx, sy, sz = room.sx, room.sy, room.sz
    c = Vector((sx / 2, -sz / 2, sy * 0.35))
    yaw, pitch = math.radians(35), math.radians(42)
    d = Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
    cam.data.type = "ORTHO"
    r = math.hypot(sx, sz) / 2
    cam.data.ortho_scale = r * 2.05
    cam.data.clip_start = 1
    cam.data.clip_end = r * 10
    aim(cam, c + d * r * 4, c)


def main_wall(room: Room) -> tuple[float, float, float]:
    """The north wall's run (fine x0, x1) and its z, at the bounding box's min z side."""
    g = room.m.grid
    # Wall face columns: first non-empty z per x at panel height (fine y 20).
    yy = 20
    best = None
    for z in range(min(room.sz // 2, 60)):
        row = g[z, yy, :]
        filled = np.flatnonzero(row)
        if len(filled) > room.sx * 0.3:
            best = (float(filled.min()), float(filled.max()), float(z))
            break
    return best or (0.0, float(room.sx), 0.0)


def eye(room: Room, cam: bpy.types.Object) -> None:
    """Eye level, facing the best straight wall run (export hint), like the mood board.

    Game (x, y, z) → Blender (x, −z, y), fine units. The camera stands in
    front of the wall along its inward normal, so the wall (36 fine high)
    fills about three quarters of the frame.
    """
    h = room.meta.get("eye") or {}
    cam.data.type = "PERSP"
    cam.data.lens = 18
    cam.data.sensor_width = 36
    cam.data.clip_start = 0.5
    cam.data.clip_end = 4000
    eye_y = 17.0  # fine voxels: Jade's eye height (~4.3 voxels) on the slab
    if h.get("a1", 0) > h.get("a0", 0):
        d = h["dir"]
        dist = max(18.0, min(48.0, h["depth"] - 6))
        mid = (h["a0"] + h["a1"]) / 2
        face = h["face"]
        if d in ("n", "s"):
            sgn = 1 if d == "n" else -1  # room toward +z (n) or −z (s)
            e = Vector((mid, -(face + sgn * dist), eye_y))
            t = Vector((mid, -face, eye_y + 2.0))
        else:
            sgn = 1 if d == "w" else -1  # room toward +x (w) or −x (e)
            e = Vector((face + sgn * dist, -mid, eye_y))
            t = Vector((face, -mid, eye_y + 2.0))
    else:
        x0, x1, wz = main_wall(room)
        e = Vector(((x0 + x1) / 2, -(wz + 40), eye_y))
        t = Vector(((x0 + x1) / 2, -wz, eye_y + 2.0))
    aim(cam, e, t)


def render(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--frames", action="store_true")
    ap.add_argument("--no-overview", action="store_true")
    ap.add_argument("--moods", type=int, default=4)
    a = ap.parse_args(argv)
    idx = json.loads((SK / "index.json").read_text())["rooms"] if (SK / "index.json").exists() else []
    rooms = [r["room"] for r in idx]
    if a.only:
        rooms = [r for r in a.only.split(",") if (SK / r / "skin.json").exists()]
    t_all = time.time()
    for room_id in rooms:
        t0 = time.time()
        reset()
        W, H = a.width, round(a.width * 9 / 16)
        setup(a.samples, W, H)
        room = Room(room_id)
        lights(room)
        cam = camera()
        out = room.dir / "render"
        vars_ = room.meta["variants"]
        sig = vars_[0]
        if not a.no_overview:
            room.obj.hide_render = True
            cut = Room(room_id, cut=True)
            cut.tint(sig, sig["frames"][0])
            overview(cut, cam)
            sc = bpy.context.scene
            sc.render.resolution_x, sc.render.resolution_y = W, round(W * 0.66)
            render(out / "overview.png")
            sc.render.resolution_x, sc.render.resolution_y = W, H
            cut.obj.hide_render = True
            room.obj.hide_render = False
        eye(room, cam)
        for n, var in enumerate(vars_[: a.moods]):
            room.tint(var, var["frames"][0])
            render(out / f"eye-{n}-{var['id']}.png")
        if a.frames:
            sc = bpy.context.scene
            sc.render.resolution_x, sc.render.resolution_y = 800, 450
            sc.cycles.samples = max(8, a.samples // 4)
            for k, fr in enumerate(sig["frames"]):
                room.tint(sig, fr)
                render(out / "frames" / f"f{k}.png")
        print(f"[skins] {room_id}: {room.nf} faces, {time.time() - t0:.1f}s")
    print(f"[skins] done: {len(rooms)} rooms in {time.time() - t_all:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
