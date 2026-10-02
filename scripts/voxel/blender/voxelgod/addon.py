"""Voxel God — Blender UI (3D View sidebar → "Voxel").

Everything here works on voxel clones (build.py): a shell object with its
`.vox` volume child. Editing rules — the volume is the truth:
- paint: select volume vertices (Edit Mode on `<id>.vox`) → "Paint selected"
- add / remove voxels: duplicate / delete volume vertices, then "Snap volume"
  (centres onto the lattice, one voxel per cell) and "Rebuild shell"
- size: "Upsample ×k" (exact), "Downsample ×k" (majority), any unit
- combine: select several clones → "Combine" (exact on the finest lattice)
- new shapes: box / cylinder / sphere in a game colour, or "Voxelize" any
  closed mesh at a chosen unit
- in / out: import uvox (model or scene), export the active clone as uvox —
  the game loads it with `modelFromUvox` (lib/world/models/uvox-model.ts)
"""

from __future__ import annotations

import json
from pathlib import Path

import bpy
import numpy as np
from bpy.props import EnumProperty, FloatProperty, IntProperty, StringProperty
from bpy_extras.io_utils import ExportHelper, ImportHelper

from . import build, ops, uvox

ROOT = Path(__file__).resolve().parents[4]
PALETTE_FILE = ROOT / ".voxel" / "palette.json"


def game_palette() -> dict[int, dict]:
    if not PALETTE_FILE.exists():
        raise RuntimeError("no .voxel/palette.json — run `pnpm voxel:export` first")
    return {int(p["index"]): {"rgb": p["rgb"], "mat": p["mat"], "name": p["name"]} for p in json.loads(PALETTE_FILE.read_text())}


def _palette_items(_self, _ctx):
    try:
        pal = game_palette()
    except RuntimeError:
        return [("1", "1", "")]
    return [(str(i), f"{i} {p['name']}", f"rgb {p['rgb']} · {p['mat']}") for i, p in sorted(pal.items())]


def _clones(ctx) -> list[bpy.types.Object]:
    out = []
    for o in ctx.selected_objects or []:
        shell = o.parent if o.name.endswith(".vox") and o.parent else o
        if "uvox_id" in shell and shell not in out:
            out.append(shell)
    return out


def _replace(shell: bpy.types.Object, m: uvox.Uvox) -> bpy.types.Object:
    coll = shell.users_collection[0]
    for c in list(shell.children):
        bpy.data.objects.remove(c, do_unlink=True)
    bpy.data.objects.remove(shell, do_unlink=True)
    return build.clone(m, coll)


class VOXELGOD_OT_import(bpy.types.Operator, ImportHelper):
    bl_idname = "voxelgod.import_uvox"
    bl_label = "Import uvox"
    filename_ext = ".json"
    filter_glob: StringProperty(default="*.json", options={"HIDDEN"})

    def execute(self, ctx):
        got = uvox.load(self.filepath)
        if isinstance(got, list):
            build.clone_scene(got, Path(self.filepath).stem)
        else:
            build.clone(got)
        return {"FINISHED"}


class VOXELGOD_OT_export(bpy.types.Operator, ExportHelper):
    bl_idname = "voxelgod.export_uvox"
    bl_label = "Export uvox"
    filename_ext = ".uvox.json"

    def execute(self, ctx):
        cl = _clones(ctx)
        if not cl:
            self.report({"ERROR"}, "select a voxel clone")
            return {"CANCELLED"}
        uvox.save(build.read_back(cl[0]), self.filepath)
        return {"FINISHED"}


class VOXELGOD_OT_rebuild(bpy.types.Operator):
    bl_idname = "voxelgod.rebuild"
    bl_label = "Rebuild shell"
    bl_description = "Regenerate the shell from the edited volume"

    def execute(self, ctx):
        for s in _clones(ctx):
            build.rebuild_shell(s)
        return {"FINISHED"}


class VOXELGOD_OT_snap(bpy.types.Operator):
    bl_idname = "voxelgod.snap"
    bl_label = "Snap volume"
    bl_description = "Move volume vertices onto voxel centres, one per cell; grow the grid if needed"

    def execute(self, ctx):
        if ctx.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
        for shell in _clones(ctx):
            vol = build.volume_of(shell)
            me = vol.data
            n = len(me.vertices)
            co = np.empty(n * 3, dtype=np.float32)
            me.vertices.foreach_get("co", co)
            pal = np.empty(n, dtype=np.int32)
            me.attributes["pal"].data.foreach_get("value", pal)
            cells = np.floor(co.reshape(-1, 3)).astype(np.int64)
            # Keep the last vertex per cell.
            _, idx = np.unique(cells[::-1], axis=0, return_index=True)
            keep = (n - 1 - idx)
            cells, pal = cells[keep], pal[keep]
            x, y, z = cells[:, 0], cells[:, 2], -cells[:, 1] - 1
            ox, oy, oz = min(0, x.min()), min(0, y.min()), min(0, z.min())
            sx0, sy0, sz0 = shell["uvox_size"]
            sx, sy, sz = max(sx0, x.max() + 1) - ox, max(sy0, y.max() + 1) - oy, max(sz0, z.max() + 1) - oz
            g = np.zeros((sz, sy, sx), dtype=np.uint8)
            g[z - oz, y - oy, x - ox] = pal.astype(np.uint8)
            pal_all = game_palette()
            used = {int(v): pal_all[int(v)] for v in np.unique(g) if v}
            a = shell["uvox_anchor"]
            new = uvox.Uvox(
                id=shell["uvox_id"],
                grid=g,
                unit=float(shell["uvox_unit"]),
                origin=tuple(shell["uvox_origin"]),
                anchor=(a[0] - ox, a[1] - oy, a[2] - oz),
                rot_y=float(shell["uvox_rotY"]),
                palette=used,
                meta=json.loads(shell["uvox_meta"]),
            )
            _replace(shell, new)
        return {"FINISHED"}


class VOXELGOD_OT_paint(bpy.types.Operator):
    bl_idname = "voxelgod.paint"
    bl_label = "Paint selected voxels"
    color: EnumProperty(name="Colour", items=_palette_items)

    def execute(self, ctx):
        ob = ctx.object
        if not ob or not ob.name.endswith(".vox"):
            self.report({"ERROR"}, "edit a .vox volume and select vertices")
            return {"CANCELLED"}
        bpy.ops.object.mode_set(mode="OBJECT")
        me = ob.data
        sel = np.empty(len(me.vertices), dtype=bool)
        me.vertices.foreach_get("select", sel)
        pal = np.empty(len(me.vertices), dtype=np.int32)
        me.attributes["pal"].data.foreach_get("value", pal)
        pal[sel] = int(self.color)
        me.attributes["pal"].data.foreach_set("value", pal)
        shell = ob.parent
        p = json.loads(shell["uvox_palette"])
        p[str(int(self.color))] = game_palette()[int(self.color)]
        shell["uvox_palette"] = json.dumps(p)
        build.rebuild_shell(shell)
        return {"FINISHED"}


class VOXELGOD_OT_resize(bpy.types.Operator):
    bl_idname = "voxelgod.resize"
    bl_label = "Resize voxels"
    mode: EnumProperty(items=[("UP", "Upsample (exact)", ""), ("DOWN", "Downsample (majority)", "")])
    k: IntProperty(name="Factor", default=2, min=2, max=8)

    def execute(self, ctx):
        for s in _clones(ctx):
            m = build.read_back(s)
            _replace(s, ops.upsample(m, self.k) if self.mode == "UP" else ops.downsample(m, self.k))
        return {"FINISHED"}


class VOXELGOD_OT_turn(bpy.types.Operator):
    bl_idname = "voxelgod.turn"
    bl_label = "Turn / mirror"
    action: EnumProperty(
        items=[("R90", "Turn 90°", ""), ("R180", "Turn 180°", ""), ("MX", "Mirror x", ""), ("MY", "Mirror y", ""), ("MZ", "Mirror z", "")]
    )

    def execute(self, ctx):
        for s in _clones(ctx):
            m = build.read_back(s)
            m = {
                "R90": lambda: ops.rotate_y90(m, 1),
                "R180": lambda: ops.rotate_y90(m, 2),
                "MX": lambda: ops.mirror(m, "x"),
                "MY": lambda: ops.mirror(m, "y"),
                "MZ": lambda: ops.mirror(m, "z"),
            }[self.action]()
            _replace(s, m)
        return {"FINISHED"}


class VOXELGOD_OT_combine(bpy.types.Operator):
    bl_idname = "voxelgod.combine"
    bl_label = "Combine"
    bl_description = "Merge the selected clones into one grid on the finest lattice (exact; the active one wins overlaps)"
    name: StringProperty(name="Name", default="combined")

    def execute(self, ctx):
        cl = _clones(ctx)
        if len(cl) < 2:
            self.report({"ERROR"}, "select two or more voxel clones")
            return {"CANCELLED"}
        act = ctx.active_object
        cl.sort(key=lambda s: s == act or (act is not None and act.parent == s))
        try:
            m = ops.combine([build.read_back(s) for s in cl], id=self.name)
        except ValueError as e:
            self.report({"ERROR"}, str(e))
            return {"CANCELLED"}
        build.clone(m, cl[0].users_collection[0])
        return {"FINISHED"}


class VOXELGOD_OT_primitive(bpy.types.Operator):
    bl_idname = "voxelgod.primitive"
    bl_label = "Add voxel shape"
    bl_options = {"REGISTER", "UNDO"}
    shape: EnumProperty(items=[("BOX", "Box", ""), ("CYL", "Cylinder", ""), ("SPHERE", "Sphere", "")])
    sx: IntProperty(name="Size x / radius·2", default=8, min=1, max=512)
    sy: IntProperty(name="Size y / height", default=8, min=1, max=512)
    sz: IntProperty(name="Size z", default=8, min=1, max=512)
    unit: FloatProperty(name="Voxel size", default=0.125, min=1 / 1024, max=8, precision=5)
    color: EnumProperty(name="Colour", items=_palette_items)

    def execute(self, ctx):
        pal = game_palette()
        c = int(self.color)
        if self.shape == "BOX":
            m = ops.box("box", (self.sx, self.sy, self.sz), c, pal, self.unit)
        elif self.shape == "CYL":
            m = ops.cylinder("cylinder", self.sx / 2, self.sy, c, pal, self.unit)
        else:
            m = ops.sphere("sphere", self.sx / 2, c, pal, self.unit)
        loc = ctx.scene.cursor.location
        m.origin = (loc.x, loc.z, -loc.y)
        build.clone(m, ctx.collection)
        return {"FINISHED"}


class VOXELGOD_OT_voxelize(bpy.types.Operator):
    bl_idname = "voxelgod.voxelize"
    bl_label = "Voxelize mesh"
    bl_options = {"REGISTER", "UNDO"}
    unit: FloatProperty(name="Voxel size", default=0.125, min=1 / 1024, max=8, precision=5)
    color: EnumProperty(name="Colour", items=_palette_items)

    def execute(self, ctx):
        ob = ctx.object
        if not ob or ob.type != "MESH" or "uvox_id" in ob:
            self.report({"ERROR"}, "select a closed mesh (not a clone)")
            return {"CANCELLED"}
        m = ops.voxelize_object(ob, self.unit, int(self.color), game_palette())
        build.clone(m, ctx.collection)
        return {"FINISHED"}


class VOXELGOD_PT_panel(bpy.types.Panel):
    bl_label = "Voxel God"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Voxel"

    def draw(self, ctx):
        L = self.layout
        cl = _clones(ctx)
        if cl:
            i = build.info(cl[0])
            box = L.box()
            box.label(text=f"{i['id']}")
            box.label(text=f"{i['size'][0]}×{i['size'][1]}×{i['size'][2]} · unit {i['unit']:g}")
            box.label(text=f"{i['voxels']:,} voxels · {i['faces']:,} faces")
        col = L.column(align=True)
        col.operator("voxelgod.import_uvox", icon="IMPORT")
        col.operator("voxelgod.export_uvox", icon="EXPORT")
        col = L.column(align=True)
        col.label(text="Edit")
        col.operator("voxelgod.snap", icon="SNAP_GRID")
        col.operator("voxelgod.rebuild", icon="FILE_REFRESH")
        col.operator("voxelgod.paint", icon="BRUSH_DATA")
        col = L.column(align=True)
        col.label(text="Size & form")
        r = col.row(align=True)
        r.operator("voxelgod.resize", text="Up ×2").mode = "UP"
        r.operator("voxelgod.resize", text="Down ×2").mode = "DOWN"
        r = col.row(align=True)
        r.operator("voxelgod.turn", text="90°").action = "R90"
        r.operator("voxelgod.turn", text="Mx").action = "MX"
        r.operator("voxelgod.turn", text="My").action = "MY"
        r.operator("voxelgod.turn", text="Mz").action = "MZ"
        col.operator("voxelgod.combine", icon="AUTOMERGE_ON")
        col = L.column(align=True)
        col.label(text="Create")
        col.operator("voxelgod.primitive", icon="MESH_CUBE")
        col.operator("voxelgod.voxelize", icon="MOD_REMESH")


CLASSES = (
    VOXELGOD_OT_import,
    VOXELGOD_OT_export,
    VOXELGOD_OT_rebuild,
    VOXELGOD_OT_snap,
    VOXELGOD_OT_paint,
    VOXELGOD_OT_resize,
    VOXELGOD_OT_turn,
    VOXELGOD_OT_combine,
    VOXELGOD_OT_primitive,
    VOXELGOD_OT_voxelize,
    VOXELGOD_PT_panel,
)


def register() -> None:
    for c in CLASSES:
        bpy.utils.register_class(c)


def unregister() -> None:
    for c in reversed(CLASSES):
        bpy.utils.unregister_class(c)

