"""Iso renders that equal the game's iso baker pixel for pixel.

lib/voxel/iso-baker.ts draws voxel (x, y, z) at
    px = originX + (x − z)·s,   py = originY + (x + z)·s/2 − y·s
on a (W + D)·s + 2 × ((W + D)·s/2 + H·s + 2) canvas, shading top / +z / +x
faces 1 / 0.78 / 0.6, then a 1 px outline (20, 18, 28) and the book trims it.

That projection is linear with kernel (1, 1, 1): it is an orthographic view
along −(1, 1, 1) followed by a 2D affine map. Here the clone's visible faces
are laid out directly in pixel space (x = px, y = canvas height − py,
depth = x + y + z, so nearer voxels win the depth test exactly like the
painter's order) and Workbench renders them flat, unlit, without
anti-aliasing, with the baker's face colours (`Iso` corner colours) through
the Standard view transform. No edge case: with an even `s` no face edge
passes through a pixel centre, so rasterisation and the baker's stamp agree.
"""

from __future__ import annotations

from pathlib import Path

import bpy
import numpy as np

from .build import ISO_SHADE, exposed_faces, srgb_to_linear
from .uvox import Uvox

OUTLINE = (20, 18, 28, 255)
# Depth per unit of x + y + z. The camera sits just above the deepest voxel so
# the depth buffer resolves one step of the painter's order with room to spare.
DEPTH = 0.01
CAM_Z = 50.0


def _iso_mesh(m: Uvox, s: int, canvas_h: int, origin: tuple[int, int]) -> bpy.types.Mesh:
    g = m.grid
    ox, oy = origin
    # Visible faces only: +x, +y, +z (game).
    corners = {
        0: ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)),
        2: ((0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)),
        4: ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)),
    }
    verts, cols = [], []
    for d, xyz in exposed_faces(g, (0, 2, 4)):
        if not len(xyz):
            continue
        tpl = np.asarray(corners[d], dtype=np.float64)
        P = xyz[:, None, :].astype(np.float64) + tpl[None, :, :]  # game corner coords (n, 4, 3)
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        px = ox + (x - z) * s
        py = oy + (x + z) * s / 2 - y * s
        V = np.stack([px, canvas_h - py, (x + y + z) * DEPTH], axis=-1)
        verts.append(V.reshape(-1, 3))
        rgb = np.asarray([m.palette[int(v)]["rgb"] for v in g[xyz[:, 2], xyz[:, 1], xyz[:, 0]]], dtype=np.float64)
        byte = np.clip(np.rint(rgb * ISO_SHADE[d]), 0, 255)
        cols.append(srgb_to_linear(byte / 255.0))
    me = bpy.data.meshes.new(f"{m.id}.iso")
    if not verts:
        return me
    V = np.concatenate(verts)
    C = np.concatenate(cols)
    nf = len(C)
    me.vertices.add(nf * 4)
    me.vertices.foreach_set("co", V.astype(np.float64).ravel())
    me.loops.add(nf * 4)
    me.loops.foreach_set("vertex_index", np.arange(nf * 4, dtype=np.int32))
    me.polygons.add(nf)
    me.polygons.foreach_set("loop_start", np.arange(0, nf * 4, 4, dtype=np.int32))
    ca = me.color_attributes.new("Iso", "FLOAT_COLOR", "CORNER")
    rgba = np.ones((nf, 4), dtype=np.float32)
    rgba[:, :3] = C
    ca.data.foreach_set("color", np.repeat(rgba, 4, axis=0).ravel())
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    me.update()
    return me


def _setup_scene(w: int, h: int) -> bpy.types.Object:
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "FLAT"
    sh.color_type = "VERTEX"
    sh.show_object_outline = False
    sh.show_cavity = False
    sh.show_shadows = False
    sh.show_specular_highlight = False
    sh.show_xray = False
    sh.show_backface_culling = False
    sc.display.render_aa = "OFF"
    sc.render.film_transparent = True
    sc.render.dither_intensity = 0.0
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.render.pixel_aspect_x = 1
    sc.render.pixel_aspect_y = 1
    vs = sc.view_settings
    vs.view_transform = "Standard"
    vs.look = "None"
    vs.exposure = 0
    vs.gamma = 1
    sc.sequencer_colorspace_settings.name = "sRGB"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    cam = sc.camera
    if cam is None:
        cam = bpy.data.objects.new("iso_cam", bpy.data.cameras.new("iso_cam"))
        sc.collection.objects.link(cam)
        sc.camera = cam
    cam.data.type = "ORTHO"
    cam.data.sensor_fit = "AUTO"
    cam.data.ortho_scale = max(w, h)
    cam.data.shift_x = 0
    cam.data.shift_y = 0
    cam.data.clip_start = 0.01
    cam.data.clip_end = CAM_Z + 1
    cam.location = (w / 2, h / 2, CAM_Z)
    cam.rotation_euler = (0, 0, 0)
    return cam


def _pixels(path: Path) -> np.ndarray:
    """PNG → uint8 RGBA, top-left origin."""
    img = bpy.data.images.load(str(path), check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return np.rint(px.reshape(h, w, 4)[::-1] * 255).astype(np.uint8)


def _write(rgba: np.ndarray, path: Path) -> None:
    h, w, _ = rgba.shape
    img = bpy.data.images.new("iso_out", w, h, alpha=True)
    img.pixels.foreach_set((rgba[::-1].astype(np.float32) / 255.0).ravel())
    img.filepath_raw = str(path)
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def outline(rgba: np.ndarray) -> np.ndarray:
    """iso-baker `addOutline`: empty pixels with a solid 4-neighbour turn dark."""
    a = rgba[..., 3] > 0
    p = np.pad(a, 1)
    nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    out = rgba.copy()
    out[~a & nb] = OUTLINE
    return out


def trim(rgba: np.ndarray) -> np.ndarray:
    """The book's trim: crop to the opaque box plus a 1 px margin."""
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    if not len(xs):
        return np.zeros((1, 1, 4), dtype=np.uint8)
    h, w = rgba.shape[:2]
    y0, y1 = max(0, ys.min() - 1), min(h - 1, ys.max() + 1)
    x0, x1 = max(0, xs.min() - 1), min(w - 1, xs.max() + 1)
    return rgba[y0 : y1 + 1, x0 : x1 + 1]


def render_iso(m: Uvox, s: int, out: Path) -> np.ndarray:
    """Render the clone like the book's picture (outline + trim). Returns RGBA."""
    sz, sy, sx = m.grid.shape
    W, D, H = sx, sz, sy
    pad = 1
    w = (W + D) * s + pad * 2
    h = (W + D) * s // 2 + H * s + pad * 2
    origin = (D * s + pad, H * s + pad)
    _setup_scene(w, h)
    me = _iso_mesh(m, s, h, origin)
    ob = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(ob)
    raw = Path(str(out) + ".raw.png")
    bpy.context.scene.render.filepath = str(raw)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
    rgba = trim(outline(_pixels(raw)))
    raw.unlink()
    out.parent.mkdir(parents=True, exist_ok=True)
    _write(rgba, out)
    return rgba


def compare(a: np.ndarray, b: np.ndarray) -> dict[str, int]:
    """Pixel difference of two RGBA pictures (sizes must match)."""
    if a.shape != b.shape:
        return {"same_size": 0, "w": a.shape[1], "h": a.shape[0], "ref_w": b.shape[1], "ref_h": b.shape[0]}
    d = np.abs(a.astype(np.int16) - b.astype(np.int16))
    return {
        "same_size": 1,
        "pixels_differ": int((d.max(axis=2) > 0).sum()),
        "max_channel_diff": int(d.max()),
        "pixels": int(a.shape[0] * a.shape[1]),
    }


def load_png(path: Path) -> np.ndarray:
    return _pixels(path)
