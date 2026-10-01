"""Export Jade's MPFB head for the game (public/hero/jade-head.glb).

Character space (model voxels, feet y = 0, front +z, her right −x — the
frame of lib/world/hero/skeleton.ts), aligned on the eyes: the MPFB eye
centres land exactly on JADE_EYES, so the game's eyeballs, bones, lids,
groom and hair colliders all fit without changes. Cut below `cut_y` (inside
the collar). Morph target `blink` (both lids shut, MPFB expression units
eye-*-closure). Skin = the baked portrait texture; brows as alpha cards.
"""

from __future__ import annotations

import json
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

# lib/world/hero/jade-sculpt.ts JADE_EYES (keep in sync; scripts/hero/export-groom.ts writes them too).
JADE_EYES = ((-1.1, 56.55, 1.98), (1.1, 56.55, 1.98))


def eye_frame(eyes_ob) -> tuple[np.ndarray, float]:
    """MPFB eye centres (world, mid) and pupil distance."""
    pts = [eyes_ob.matrix_world @ v.co for v in eyes_ob.data.vertices]
    fronts = []
    for side in (False, True):
        half = [p for p in pts if (p.x > 0) == side]
        fronts.append(min(half, key=lambda p: p.y))
    mid = (fronts[0] + fronts[1]) / 2
    mid.y += 0.012  # eye centre sits behind the cornea
    return np.array(mid), (fronts[0] - fronts[1]).length


def to_char(world: np.ndarray, mid: np.ndarray, pupil: float) -> np.ndarray:
    c_mid = np.mean(JADE_EYES, axis=0)
    c_dist = abs(JADE_EYES[1][0] - JADE_EYES[0][0])
    scale = pupil / c_dist  # metres per voxel
    q = (world - mid) / scale
    # Blender (x, y back, z up) → character (x, y up, z front).
    return np.stack([q[:, 0], q[:, 2], -q[:, 1]], axis=1) + c_mid


def evaluated(ob, keys: dict[str, float]):
    """Positions (world) of the evaluated mesh with shape-key weights set (helpers masked)."""
    kb = ob.data.shape_keys.key_blocks if ob.data.shape_keys else {}
    saved = {k.name: k.value for k in kb} if kb else {}
    for name, v in keys.items():
        if name in kb:
            kb[name].value = v
    # Smooth enough for close-ups: subdivision at its render level.
    for m in ob.modifiers:
        if m.type == "SUBSURF":
            m.levels = max(m.levels, 1)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    mw = np.array(ob.matrix_world)
    co = co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
    data = {
        "co": co,
        "faces": [list(p.vertices) for p in me.polygons],
        "uv": None,
    }
    uvl = me.uv_layers.get("UVMap") or (me.uv_layers[0] if me.uv_layers else None)
    if uvl:
        uv = np.empty(len(me.loops) * 2)
        uvl.data.foreach_get("uv", uv)
        data["uv"] = uv.reshape(-1, 2)
        data["loop_start"] = [p.loop_start for p in me.polygons]
    ev.to_mesh_clear()
    for name, v in saved.items():
        kb[name].value = v
    return data


def build_head(basemesh, skin_png: Path, cut_y: float, mid, pupil) -> bpy.types.Object:
    blink_keys = [k for k in ("expr-eye-left-closure", "expr-eye-right-closure")]
    a = evaluated(basemesh, {k: 0.0 for k in blink_keys})
    b = evaluated(basemesh, {k: 1.0 for k in blink_keys})
    ca = to_char(a["co"], mid, pupil)
    cb = to_char(b["co"], mid, pupil)
    keep = [i for i, f in enumerate(a["faces"]) if all(ca[v][1] > cut_y for v in f)]
    used = sorted({v for i in keep for v in a["faces"][i]})
    remap = {v: j for j, v in enumerate(used)}
    me = bpy.data.meshes.new("jade_head")
    # Back to Blender axes for the glTF exporter (it converts to +Y up): char (x, y, z) → (x, −z, y).
    def to_bl(c):
        return [(p[0], -p[2], p[1]) for p in c]

    me.from_pydata(to_bl(ca[used]), [], [[remap[v] for v in a["faces"][i]] for i in keep])
    if a["uv"] is not None:
        uvl = me.uv_layers.new(name="UVMap")
        k = 0
        for i in keep:
            ls = a["loop_start"][i]
            for j in range(len(a["faces"][i])):
                uvl.data[k].uv = a["uv"][ls + j]
                k += 1
    me.update()
    ob = bpy.data.objects.new("head", me)
    bpy.context.scene.collection.objects.link(ob)
    ob.shape_key_add(name="Basis")
    sk = ob.shape_key_add(name="blink")
    sk.data.foreach_set("co", np.array(to_bl(cb[used]), dtype=np.float32).ravel())
    for p in me.polygons:
        p.use_smooth = True
    mat = bpy.data.materials.new("skinTex")
    mat.use_nodes = True
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(skin_png), check_existing=True)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.5
    me.materials.append(mat)
    return ob


def build_card(src, name: str, mid, pupil) -> bpy.types.Object | None:
    """A proxy (brows) as alpha card mesh in character space, with its texture."""
    if not src:
        return None
    dg = bpy.context.evaluated_depsgraph_get()
    ev = src.evaluated_get(dg)
    m = ev.to_mesh()
    co = np.empty(len(m.vertices) * 3)
    m.vertices.foreach_get("co", co)
    mw = np.array(src.matrix_world)
    co = co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
    c = to_char(co, mid, pupil)
    me = bpy.data.meshes.new(name)
    me.from_pydata([(p[0], -p[2], p[1]) for p in c], [], [list(p.vertices) for p in m.polygons])
    if m.uv_layers:
        uvl = me.uv_layers.new(name="UVMap")
        src_uv = np.empty(len(m.loops) * 2)
        m.uv_layers[0].data.foreach_get("uv", src_uv)
        uvl.data.foreach_set("uv", src_uv.astype(np.float32))
    ev.to_mesh_clear()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    img = None
    for mm in src.data.materials:
        for n in (mm.node_tree.nodes if mm and mm.node_tree else []):
            if n.type == "TEX_IMAGE" and n.image:
                img = n.image
                break
    mat = bpy.data.materials.new("cards")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    if img:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = img
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        mat.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    mat.blend_method = "CLIP" if hasattr(mat, "blend_method") else None
    me.materials.append(mat)
    return ob


def save_image(img, path: Path, fmt: str) -> None:
    scene = bpy.context.scene
    scene.render.image_settings.file_format = fmt
    if fmt == "JPEG":
        scene.render.image_settings.quality = 88
    else:
        scene.render.image_settings.color_mode = "RGBA"
    img.save_render(str(path), scene=scene)


def export(basemesh, skin_png: Path, out: Path, cut_y: float = 49.5) -> dict:
    eyes = next(o for o in bpy.data.objects if o.get("jade_part") == "eyes")
    mid, pupil = eye_frame(eyes)
    head = build_head(basemesh, skin_png, cut_y, mid, pupil)
    # Brows: the portrait's thin arched brows are baked into the skin; MPFB's brow cards
    # read as heavy black bars in the game light — leave them out (build_card stays for other looks).
    brows = None
    bpy.ops.object.select_all(action="DESELECT")
    for o in (head, brows):
        if o:
            o.select_set(True)
    bpy.context.view_layer.objects.active = head
    out.parent.mkdir(parents=True, exist_ok=True)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    opts = dict(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_morph=True,
        export_morph_normal=True,
        export_skins=False,
        export_animations=False,
        # Textures as separate files (the app's CSP blocks the blob: URLs the
        # GLTFLoader uses for embedded images): jade-skin.jpg, jade-brows.png.
        export_image_format="NONE",
        export_materials="EXPORT",
    )
    bpy.ops.export_scene.gltf(**{k: v for k, v in opts.items() if k in props})
    save_image(bpy.data.images.load(str(skin_png), check_existing=True), out.parent / "jade-skin.jpg", "JPEG")
    if brows:
        for n in brows.data.materials[0].node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                save_image(n.image, out.parent / "jade-brows.png", "PNG")
    info = {"verts": len(head.data.vertices), "faces": len(head.data.polygons), "bytes": out.stat().st_size}
    print("[jade] head export " + json.dumps(info))
    return info
