"""Bake Jade's face from the portrait into the MPFB skin texture.

The de-lit, mirrored face window (public/hero/jade-face.webp, built by
scripts/hero/face-texture.mjs from the portrait: photo x 535…1335,
y 380…1180) is projected from the front camera, aligned on the pupils,
onto the head and baked into a copy of the MPFB skin diffuse on the skin's
own UV layout. Blend weight per face corner:

  facing (normal · view, front only) × inside the window × not hair
  (copper texels: r − b high) × not on the neck

Outside the face the MPFB skin stays. The result replaces the skin
material's diffuse image (and is written to `out` for the game export).
"""

from __future__ import annotations

from pathlib import Path

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

PHOTO_PUPILS = ((800.0, 680.0), (1070.0, 678.0))
WINDOW = (535.0, 380.0, 800.0)  # x0, y0, size of jade-face.webp in photo pixels


def _rest_positions(ob: bpy.types.Object) -> np.ndarray:
    """World positions of the base mesh vertices with shape keys, without modifiers."""
    states = [(m, m.show_viewport) for m in ob.modifiers]
    for m, _ in states:
        m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    no = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("normal", no)
    ev.to_mesh_clear()
    for m, v in states:
        m.show_viewport = v
    mw = np.array(ob.matrix_world)
    co = co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
    no = no.reshape(-1, 3) @ mw[:3, :3].T
    no /= np.linalg.norm(no, axis=1, keepdims=True) + 1e-9
    return co, no


def project(ob: bpy.types.Object, cam: bpy.types.Object, size: tuple[int, int], pupils_px) -> None:
    """UV map `photo` (texture coords in jade-face.webp) + colour attribute `photo_mask`."""
    scene = bpy.context.scene
    co, no = _rest_positions(ob)
    (rl, rr) = sorted(pupils_px)
    s = (PHOTO_PUPILS[1][0] - PHOTO_PUPILS[0][0]) / max(1e-6, rr[0] - rl[0])
    cx_r, cy_r = (rl[0] + rr[0]) / 2, (rl[1] + rr[1]) / 2
    cx_p = (PHOTO_PUPILS[0][0] + PHOTO_PUPILS[1][0]) / 2
    cy_p = (PHOTO_PUPILS[0][1] + PHOTO_PUPILS[1][1]) / 2
    W, H = size
    uv = np.empty((len(co), 2))
    for i, p in enumerate(co):
        c = world_to_camera_view(scene, cam, Vector(p))
        px, py = c.x * W, (1 - c.y) * H
        fx = cx_p + (px - cx_r) * s
        fy = cy_p + (py - cy_r) * s
        uv[i] = ((fx - WINDOW[0]) / WINDOW[2], 1 - (fy - WINDOW[1]) / WINDOW[2])
    view = np.array(cam.matrix_world.to_quaternion() @ Vector((0, 0, -1)))
    f = np.clip((no @ -view - 0.2) / 0.55, 0, 1)
    facing = f * f * (3 - 2 * f)
    # Fade out towards the window's border (no hard patch edge).
    # Face oval in the window (eyes at v ≈ 0.62, chin ≈ 0.18): the photo's sides hold
    # hair and the red rim light — keep them out, fade softly into the body skin.
    ex = (uv[:, 0] - 0.5) / 0.37
    ey = (uv[:, 1] - 0.5) / 0.43
    r = np.sqrt(ex * ex + ey * ey)
    t = np.clip((1.0 - r) / 0.28, 0, 1)
    inside = t * t * (3 - 2 * t)
    # Neck and below: chin is ~ the bottom of the window's face; fade under it.
    below = np.clip((0.12 - uv[:, 1]) / 0.08, 0, 1)
    w = facing * inside * (1 - below)
    me = ob.data
    lv = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get("vertex_index", lv)
    lay = me.uv_layers.get("photo") or me.uv_layers.new(name="photo")
    lay.data.foreach_set("uv", uv[lv].astype(np.float32).ravel())
    if "photo_mask" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["photo_mask"])
    attr = me.color_attributes.new("photo_mask", "FLOAT_COLOR", "CORNER")
    m = w[lv]
    attr.data.foreach_set("color", np.stack([m, m, m, np.ones_like(m)], axis=1).astype(np.float32).ravel())


def _skin_diffuse_node(ob: bpy.types.Object):
    for mat in ob.data.materials:
        if not mat or not mat.node_tree:
            continue
        stack = [mat.node_tree]
        while stack:
            nt = stack.pop()
            for n in nt.nodes:
                if n.type == "TEX_IMAGE" and n.image and "diffuse" in n.image.name.lower():
                    return mat, nt, n
                if n.type == "GROUP" and n.node_tree:
                    stack.append(n.node_tree)
    return None, None, None


def _pixels(img: bpy.types.Image) -> np.ndarray:
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def _tone_gain(face: bpy.types.Image, base: bpy.types.Image) -> tuple[float, float, float]:
    """Per-channel gain that brings the MPFB skin to the portrait's cheek tone (medians)."""
    f = _pixels(face)
    h, w, _ = f.shape
    # Cheeks / forehead of the window (skip eyes, mouth, hair).
    ys, xs = np.mgrid[0:h, 0:w]
    u, v = xs / w, ys / h  # v from the image bottom (Blender rows)
    cheeks = (((u - 0.27) ** 2 + (v - 0.42) ** 2) < 0.006) | (((u - 0.73) ** 2 + (v - 0.42) ** 2) < 0.006)
    fc = f[cheeks][:, :3]
    fc = fc[(fc[:, 0] - fc[:, 2]) < 0.35]
    b = _pixels(base)[..., :3].reshape(-1, 3)
    b = b[(b.sum(axis=1) > 0.6) & ((b[:, 0] - b[:, 2]) < 0.4)]
    if len(fc) < 50 or len(b) < 50:
        return (1.0, 1.0, 1.0)
    g = np.median(fc, axis=0) / np.maximum(np.median(b, axis=0), 1e-3)
    return tuple(float(x) for x in np.clip(g, 0.6, 1.6))


def bake(ob: bpy.types.Object, face_png: Path, out: Path, res: int = 2048) -> Path | None:
    mat, nt, diff = _skin_diffuse_node(ob)
    if not diff:
        print("[jade] skin diffuse texture not found — face bake skipped")
        return None
    base_img = diff.image
    face = bpy.data.images.load(str(face_png), check_existing=True)
    gain = _tone_gain(face, base_img)
    print(f"[jade] skin tone gain {tuple(round(g, 3) for g in gain)}")
    target = bpy.data.images.new("jade_skin_albedo", res, res)
    target.colorspace_settings.name = "sRGB"
    tmp = bpy.data.materials.new("jade_bake")
    tmp.use_nodes = True
    N, L = tmp.node_tree.nodes, tmp.node_tree.links
    N.clear()
    out_n = N.new("ShaderNodeOutputMaterial")
    emit = N.new("ShaderNodeEmission")
    uv_base = N.new("ShaderNodeUVMap")
    uv_base.uv_map = ob.data.uv_layers[0].name
    uv_photo = N.new("ShaderNodeUVMap")
    uv_photo.uv_map = "photo"
    t_base = N.new("ShaderNodeTexImage")
    t_base.image = base_img
    t_face = N.new("ShaderNodeTexImage")
    t_face.image = face
    t_face.extension = "CLIP"
    L.new(uv_base.outputs["UV"], t_base.inputs["Vector"])
    L.new(uv_photo.outputs["UV"], t_face.inputs["Vector"])
    mask = N.new("ShaderNodeVertexColor")
    mask.layer_name = "photo_mask"
    # Hair: copper texels (r − b large) do not belong on the skin.
    sep = N.new("ShaderNodeSeparateColor")
    L.new(t_face.outputs["Color"], sep.inputs["Color"])
    rb = N.new("ShaderNodeMath")
    rb.operation = "SUBTRACT"
    L.new(sep.outputs["Red"], rb.inputs[0])
    L.new(sep.outputs["Blue"], rb.inputs[1])
    hair = N.new("ShaderNodeMapRange")
    hair.inputs["From Min"].default_value = 0.42
    hair.inputs["From Max"].default_value = 0.6
    hair.inputs["To Min"].default_value = 1.0
    hair.inputs["To Max"].default_value = 0.0
    L.new(rb.outputs["Value"], hair.inputs["Value"])
    w = N.new("ShaderNodeMath")
    w.operation = "MULTIPLY"
    L.new(mask.outputs["Color"], w.inputs[0])
    L.new(hair.outputs["Result"], w.inputs[1])
    # The whole body skin takes the portrait's tone (no seam around the face).
    tone = N.new("ShaderNodeMix")
    tone.data_type = "RGBA"
    tone.blend_type = "MULTIPLY"
    tone.inputs["Factor"].default_value = 1.0
    tone.inputs[7].default_value = (*gain, 1.0)
    L.new(t_base.outputs["Color"], tone.inputs[6])
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    L.new(w.outputs["Value"], mix.inputs["Factor"])
    L.new(tone.outputs[2], mix.inputs[6])
    L.new(t_face.outputs["Color"], mix.inputs[7])
    L.new(mix.outputs[2], emit.inputs["Color"])
    L.new(emit.outputs["Emission"], out_n.inputs["Surface"])
    tgt = N.new("ShaderNodeTexImage")
    tgt.image = target
    N.active = tgt
    saved = list(ob.data.materials)
    for i in range(len(ob.data.materials)):
        ob.data.materials[i] = tmp
    ob.data.uv_layers.active = ob.data.uv_layers[0]
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8
    scene.render.bake.target = "IMAGE_TEXTURES"
    scene.render.bake.margin = 8
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type="EMIT")
    for i, m in enumerate(saved):
        ob.data.materials[i] = m
    out.parent.mkdir(parents=True, exist_ok=True)
    target.filepath_raw = str(out)
    target.file_format = "PNG"
    target.save()
    diff.image = target
    print(f"[jade] face baked → {out}")
    return out
