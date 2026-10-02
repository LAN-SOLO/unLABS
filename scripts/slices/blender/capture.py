"""unETH captures, re-rendered in Blender — every crystal, all 30 slices.

  blender -b --factory-startup -P scripts/slices/blender/capture.py -- \
      --tokens 961,962 [--frames 0-29] [--size 1024] [--out .crystal/slices]

A capture (unStableCoins archive, released 2018-03-07) is a neon light
sculpture of the Ethereum octahedron, filmed turning 180° over 30 frames
(6° per slice). Modelled after the original frames of ID-0961
(research/_unSC_slices_TokenGIFS) and the trait overview film:

  shape   a flattened octahedron: apex, bottom, an upper ring (wide side
          points, higher front / back points) and a lower ring (the open
          "V" of the logo) — neon tubes along every edge, faint glass panes
  light   hot white tube cores, coloured halo, soft fog glow, six streaks
          (the X beams at ±60° and the horizontal flare)
  film    scanlines (every other row ~13 % darker), dust specks, the
          grey bot badge in the corner

Traits (lib/world/uneth-crystal.ts): colour, style (mono / pure px / RGB),
tier 1–5 (volatility: wobble, haze, sparks, tears), rotation CW / CCW,
state O / I (pulse) / IO (tubes drop out), era 16 / 32 / 64 bit (pixel
blocks, posterisation), stasis S / NOS. Deterministic per token ID.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
RELEASE = ROOT / "lib/world/content/uneth-release.json"

# Geometry in pixels of the 1024² frame, centre (512, 512), y up; z = depth.
APEX = (0.0, 0.0, 422.0)
BOTTOM = (0.0, 0.0, -433.0)
UP_SIDE = 268.0  # upper ring, wide points (x)
UP_SIDE_Z = -8.0
UP_FRONT_Z = 102.0  # upper ring, front / back points (higher)
LO_SIDE = 258.0
LO_SIDE_Z = -73.0
LO_FRONT_Z = -188.0
DEPTH = 90.0  # front / back points (the edge-on "Y" arms)

COLORS = {
    "white": (1.0, 1.0, 1.0),
    "green": (0.15, 1.0, 0.25),
    "yellow": (1.0, 0.92, 0.25),
    "blue": (0.12, 0.25, 1.0),
    "purple": (0.95, 0.2, 1.0),
    "red": (1.0, 0.12, 0.08),
    "orange": (1.0, 0.5, 0.05),
    "rgb": (1.0, 1.0, 1.0),
}


def tokens() -> dict[int, dict]:
    d = json.loads(RELEASE.read_text())
    cols = d["columns"]
    out = {}
    for row in d["tokens"]:
        t = dict(zip(cols, row))
        out[int(t["id"])] = t
    return out


def style_of(t: dict) -> str:
    return "mono" if t["phase"] == "P01" or t["style"] == "mono" else ("rgb" if t["color"] == "rgb" else "pure")


# ── Scene ────────────────────────────────────────────────────────


def px(v) -> Vector:
    """Pixel coords (x, y-depth, z-up) → Blender units (1 unit = 100 px)."""
    return Vector((v[0] / 100.0, v[1] / 100.0, v[2] / 100.0))


def vertices() -> dict[str, tuple]:
    # Wide axis along Y (depth) at rest: frame 0 shows the sculpture edge-on.
    return {
        "A": APEX,
        "B": BOTTOM,
        "uL": (0.0, -UP_SIDE, UP_SIDE_Z),
        "uR": (0.0, UP_SIDE, UP_SIDE_Z),
        "uF": (-DEPTH, 0.0, UP_FRONT_Z),
        "uK": (DEPTH, 0.0, UP_FRONT_Z),
        "lL": (0.0, -LO_SIDE, LO_SIDE_Z),
        "lR": (0.0, LO_SIDE, LO_SIDE_Z),
        "lF": (-DEPTH, 0.0, LO_FRONT_Z),
        "lK": (DEPTH, 0.0, LO_FRONT_Z),
    }


EDGES = [
    # upper pyramid
    ("A", "uL"), ("A", "uR"), ("A", "uF"), ("A", "uK"),
    ("uL", "uF"), ("uF", "uR"), ("uR", "uK"), ("uK", "uL"),
    # lower pyramid: the open "V" of the logo (no back half)
    ("B", "lL"), ("B", "lR"), ("B", "lF"),
    ("lL", "lF"), ("lF", "lR"),
]  # fmt: skip
PANES = [("A", "uL", "uF"), ("A", "uF", "uR"), ("A", "uR", "uK"), ("A", "uK", "uL"),
         ("B", "lL", "lF"), ("B", "lF", "lR")]  # fmt: skip


_MATS: dict[tuple, bpy.types.Material] = {}


def cached(key: tuple, make) -> bpy.types.Material:
    """Materials are reused across frames: EEVEE compiles a shader per new material."""
    m = _MATS.get(key)
    if m is None or m.name not in bpy.data.materials:
        m = make()
        m.use_fake_user = True
        _MATS[key] = m
    return m


def emission_mat(name: str, color, strength: float, alpha: float = 1.0) -> bpy.types.Material:
    return cached(("em", name, tuple(round(c, 4) for c in color), round(strength, 4), alpha), lambda: _emission_mat(name, color, strength, alpha))


def _emission_mat(name: str, color, strength: float, alpha: float = 1.0) -> bpy.types.Material:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    if alpha < 1.0:
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        add = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(em.outputs[0], add.inputs[0])
        nt.links.new(tr.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], out.inputs["Surface"])
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    else:
        nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def smoke_mat(color, strength: float, seed: int) -> bpy.types.Material:
    return cached(("smoke", tuple(round(c, 4) for c in color), round(strength, 4), seed), lambda: _smoke_mat(color, strength, seed))


def _smoke_mat(color, strength: float, seed: int) -> bpy.types.Material:
    """Glass panes as smoke: cloudy, brighter towards the edges, transparent."""
    m = bpy.data.materials.new("smoke")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    em = N.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 0.9
    nz.inputs["Detail"].default_value = 2.0
    if hasattr(nz, "noise_dimensions"):
        nz.noise_dimensions = "4D"
    if "W" in nz.inputs:
        nz.inputs["W"].default_value = seed * 0.37
    L.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = N.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = 0.3
    ramp.inputs["From Max"].default_value = 0.8
    L.new(nz.outputs["Fac"], ramp.inputs["Value"])
    mul = N.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = strength
    L.new(ramp.outputs["Result"], mul.inputs[0])
    L.new(mul.outputs["Value"], em.inputs["Strength"])
    tr = N.new("ShaderNodeBsdfTransparent")
    add = N.new("ShaderNodeAddShader")
    L.new(em.outputs[0], add.inputs[0])
    L.new(tr.outputs[0], add.inputs[1])
    L.new(add.outputs[0], out.inputs["Surface"])
    blended(m)
    return m


def cloud_mat(color, strength: float) -> bpy.types.Material:
    """A soft glow cloud: emission falling off towards the silhouette (facing²)."""
    m = bpy.data.materials.new("cloud")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    em = N.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    lw = N.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    inv = N.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    L.new(lw.outputs["Facing"], inv.inputs[1])
    pw = N.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 4.0
    L.new(inv.outputs["Value"], pw.inputs[0])
    mul = N.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = strength
    L.new(pw.outputs["Value"], mul.inputs[0])
    L.new(mul.outputs["Value"], em.inputs["Strength"])
    tr = N.new("ShaderNodeBsdfTransparent")
    add = N.new("ShaderNodeAddShader")
    L.new(em.outputs[0], add.inputs[0])
    L.new(tr.outputs[0], add.inputs[1])
    L.new(add.outputs[0], out.inputs["Surface"])
    blended(m)
    return m


def blended(m) -> None:
    """EEVEE: transparent emission needs the blended render method."""
    for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        if hasattr(m, attr):
            try:
                setattr(m, attr, val)
            except (TypeError, ValueError):
                pass


def tube(name: str, pts: list[Vector], radius: float, mat) -> bpy.types.Object:
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p.x, p.y, p.z, 1)
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(mat)
    return ob


def wobble(a: Vector, b: Vector, rng: random.Random, amount: float, n: int = 14) -> list[Vector]:
    """A hand-drawn light stroke: a few slow bends along the edge."""
    d = b - a
    side = d.cross(Vector((0.3, 0.2, 1.0))).normalized()
    side2 = d.cross(side).normalized()
    ph1, ph2 = rng.uniform(0, 6.28), rng.uniform(0, 6.28)
    pts = []
    for i in range(n + 1):
        t = i / n
        env = math.sin(math.pi * t)
        o = side * (math.sin(t * 7 + ph1) * amount * env) + side2 * (math.sin(t * 5 + ph2) * amount * 0.6 * env)
        pts.append(a + d * t + o)
    return pts


def build(t: dict, frame_seed: int, hidden: set[int]) -> bpy.types.Object:
    """The sculpture for one frame (tubes drop out per frame for state IO)."""
    rng = random.Random(int(t["id"]) * 7919 + frame_seed * 0)
    tier = int(t["tier"])
    col = COLORS.get(t["color"], (1, 1, 1))
    mono = style_of(t) == "mono"
    core_col = (1.0, 1.0, 1.0)
    halo_col = (1.0, 1.0, 1.0) if mono else col
    root = bpy.data.objects.new("crystal", None)
    bpy.context.scene.collection.objects.link(root)
    # Hand-built: every sculpture is a little crooked (fixed per token).
    vr = random.Random(int(t["id"]) * 104729)
    v = {
        k: px((p[0] + vr.gauss(0, 10), p[1] + vr.gauss(0, 14), p[2] + vr.gauss(0, 9)))
        for k, p in vertices().items()
    }
    # Neon: a white-hot core tinted with the gas colour; the halo is the glare pass.
    # Coloured gas glows in its colour; only white / mono burns white.
    tint = tuple(0.12 + 0.88 * c for c in halo_col)
    core = emission_mat("core", tint, 7.0)
    faint = emission_mat("faint", tint, 2.2)
    wob = 0.012 + 0.02 * (tier - 1)
    for i, (a, b) in enumerate(EDGES):
        if i in hidden:
            continue
        pts = wobble(v[a], v[b], rng, wob)
        # Edges into the front / back points are painted lighter in the originals.
        inner = ("uF" in (a, b) or "uK" in (a, b) or "lF" in (a, b)) and ("A" in (a, b) or "B" in (a, b))
        # Light painting: the stroke breaks off now and then and varies in weight.
        r0 = 0.032 if inner else 0.045
        cut = [0]
        for j in range(1, len(pts) - 1):
            if vr.random() < 0.025 + 0.03 * (tier - 1):
                cut.append(j)
        cut.append(len(pts) - 1)
        for c0, c1 in zip(cut, cut[1:]):
            seg = pts[c0 : c1 + 1] if c0 == 0 else pts[c0 + 1 : c1 + 1]
            if len(seg) < 2:
                continue
            ob = tube(f"e{i}_{c0}", seg, r0 * vr.uniform(0.75, 1.2), faint if inner else core)
            bpy.context.scene.collection.objects.link(ob)
            ob.parent = root
        # Light painting: a second, fainter stroke beside most edges.
        if rng.random() < 0.7:
            off = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * 0.06
            pts2 = [p + off for p in wobble(v[a], v[b], rng, wob * 1.5)]
            ob = tube(f"s{i}", pts2, 0.018, faint)
            bpy.context.scene.collection.objects.link(ob)
            ob.parent = root
    # The light source glare at the waist: a soft glowing cloud (camera-facing falloff).
    # (the waist glow itself is drawn in the film pass: a soft, wide column)
    # Glass panes: faint glow inside the upper faces (and the lower front).
    me = bpy.data.meshes.new("panes")
    verts = []
    faces = []
    for tri in PANES:
        base = len(verts)
        verts += [tuple(v[k]) for k in tri]
        faces.append((base, base + 1, base + 2))
    me.from_pydata(verts, [], faces)
    panes = bpy.data.objects.new("panes", me)
    panes.data.materials.append(smoke_mat(halo_col, 0.22 + 0.06 * (tier - 1), int(t["id"])))
    bpy.context.scene.collection.objects.link(panes)
    panes.parent = root
    return root


def scene_setup(size: int) -> None:
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE_NEXT"
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    try:
        sc.eevee.taa_render_samples = 24
    except AttributeError:
        pass
    w = bpy.data.worlds.new("black")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0, 0, 0, 1)
    sc.world = w
    cam_d = bpy.data.cameras.new("cam")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = 10.24
    cam = bpy.data.objects.new("cam", cam_d)
    cam.location = (0.0, -30.0, 0.0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    sc.collection.objects.link(cam)
    sc.camera = cam
    compositor(sc)


def _menu(sock, *names: str) -> None:
    for n in names:
        try:
            sock.default_value = n
            return
        except (TypeError, ValueError):
            continue


def compositor(sc) -> None:
    """Fog glow (the soft halo) + six streaks (X beams at ±60°, the horizontal flare).

    Blender 5: the compositor is a node group on `scene.compositing_node_group`
    and the glare settings are node inputs.
    """
    ng = bpy.data.node_groups.new("capture", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    out = ng.nodes.new("NodeGroupOutput")
    g1 = ng.nodes.new("CompositorNodeGlare")
    _menu(g1.inputs["Type"], "Fog Glow", "FOG_GLOW")
    _menu(g1.inputs["Quality"], "High", "HIGH")
    g1.inputs["Threshold"].default_value = 0.7
    g1.inputs["Size"].default_value = 0.72
    g1.inputs["Strength"].default_value = 0.95
    ng.links.new(rl.outputs["Image"], g1.inputs["Image"])
    ng.links.new(g1.outputs["Image"], out.inputs["Image"])
    sc.compositing_node_group = ng


# ── Film (2D) ────────────────────────────────────────────────────

def light_field(h: int, w: int, t: dict, frame: int) -> np.ndarray:
    """The capture's lens light: a soft glow at the waist (strongest edge-on) and the
    faint beams — an X at ±60° and a horizontal flare — through it."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    # The light sits off-centre and swings round with the turn (the lamp inside).
    swing = math.sin(math.radians(6.0 * frame) * (1 if t["rotation"] == "CW" else -1))
    cx, cy = w * (0.5 - 0.06 * swing), h * 0.55
    dx, dy = (xs - cx) / w, (ys - cy) / h
    edge_on = abs(math.cos(math.radians(6.0 * frame)))  # 1 at slices 1 / 30, 0 at 15
    face_on = 1.0 - edge_on
    glow = np.exp(-(dx * dx / 0.004 + dy * dy / 0.06)) * (0.75 * edge_on + 0.6 * face_on)
    # Side haze: a wing of light reaching out to one side, like the captures.
    hx = dx + 0.09 * swing
    haze = np.exp(-(hx * hx / 0.025 + dy * dy / 0.006)) * 0.22 + np.exp(-(dx * dx / 0.05 + dy * dy / 0.03)) * 0.08
    beams = np.zeros_like(dx)
    for ang in (60.0, -60.0, 0.0):
        r = math.radians(ang)
        # distance to the line through the centre at angle `ang` from horizontal
        d = np.abs(-math.sin(r) * dx + math.cos(r) * dy)
        along = np.abs(math.cos(r) * dx + math.sin(r) * dy)
        k = 0.05 if ang == 0.0 else 0.07
        beams += np.exp(-(d / 0.012) ** 2) * np.exp(-along / 0.35) * k
    tier = int(t["tier"])
    f = (glow + haze) * (1.0 + 0.15 * (tier - 1)) + beams
    col = np.array(COLORS.get(t["color"], (1, 1, 1))) if style_of(t) != "mono" else np.ones(3)
    return f[..., None] * (0.4 + 0.6 * col)[None, None, :]


BADGE = [
    "..XXXXXX..",
    ".XXXXXXXX.",
    "XXXXXXXXXX",
    "XXWWXXXXXX",
    "XXWWXXWWXX",
    "XXXXXXXXXX",
    "XXDDDDDDXX",
    "XXXXXXXXXX",
    ".XXXXXXXX.",
    "..XXXXXX..",
]


def film(img: np.ndarray, t: dict, frame: int, rng: np.random.Generator) -> np.ndarray:
    """Post: style colour, era, tier effects, scanlines, specks, badge. img: (h, w, 3) linear 0..∞ → 0..1."""
    h, w, _ = img.shape
    style = style_of(t)
    tier = int(t["tier"])
    era = int(t["era"])
    a = np.clip(img, 0, None)
    a = a + light_field(h, w, t, frame)
    a = a / (1.0 + a * 0.15)  # soft shoulder: hot cores burn to white
    if style == "mono":
        lum = a @ np.array([0.299, 0.587, 0.114])
        a = np.repeat(lum[..., None], 3, axis=2)
    elif style == "rgb":
        # RGB line: the channels drift apart (chromatic split).
        sh = 4 + tier * 2
        a = np.stack([np.roll(a[..., 0], sh, axis=1), a[..., 1], np.roll(a[..., 2], -sh, axis=1)], axis=2)
    # State I: the tubes pulse; IO handled in the scene (tubes drop out).
    if t["io"] == "I":
        a *= 0.65 + 0.35 * (0.5 + 0.5 * math.sin(frame / 30 * 4 * math.pi))
    # Volatility: the image tears (horizontal slips) and sparks fly.
    if tier >= 4:
        n = 2 + (tier - 4) * 4
        for _ in range(n):
            y0 = int(rng.integers(0, h - 40))
            hh = int(rng.integers(6, 40))
            a[y0 : y0 + hh] = np.roll(a[y0 : y0 + hh], int(rng.integers(-40, 40)) * (tier - 3), axis=1)
    if tier >= 3:
        k = 60 * (tier - 2)
        ys = rng.integers(int(h * 0.15), int(h * 0.85), k)
        xs = (w / 2 + rng.normal(0, w * 0.12, k)).astype(int).clip(0, w - 3)
        for y, x in zip(ys, xs):
            a[y : y + 2, x : x + 3] = np.maximum(a[y : y + 2, x : x + 3], rng.uniform(0.6, 1.0))
    # Era: 16 bit = big soft pixel blocks, 32 bit = smaller blocks + posterised.
    if era in (16, 32):
        b = 32 if era == 16 else 12
        if era == 16:
            # The 16-bit captures read soft and smeared: blur first, then big dim blocks.
            k = np.ones(25) / 25
            a = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 0, a)
            a = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 1, a)
            a = np.clip(a * 1.25, 0, 1) * 0.8
        hb, wb = h // b, w // b
        small = a[: hb * b, : wb * b].reshape(hb, b, wb, b, 3).mean(axis=(1, 3))
        a = np.repeat(np.repeat(small, b, axis=0), b, axis=1)
        # The block grid may not divide the frame: repeat the last blocks into the margin.
        a = np.pad(a, ((0, h - a.shape[0]), (0, w - a.shape[1]), (0, 0)), mode="edge")
        levels = 6 if era == 16 else 10
        a = np.round(np.clip(a, 0, 1) * levels) / levels
    # Film: scanlines (every other row darker), dust specks.
    a[1::2] *= 0.87
    m = rng.random((h, w)) < 0.00012
    a[m] = np.maximum(a[m], rng.uniform(0.3, 0.8, (m.sum(), 1)))
    a = np.clip(a, 0, 1)
    # The grey bot badge, bottom right (tinted with the capture's colour line).
    cell = max(1, w // 160)
    bx, by = w - 16 * cell, h - 16 * cell
    tint = np.array(COLORS.get(t["color"], (1, 1, 1))) if style != "mono" else np.array([1, 1, 1])
    for j, row in enumerate(BADGE):
        for i, ch in enumerate(row):
            if ch == ".":
                continue
            c = {"X": 0.5, "W": 0.95, "D": 0.18}[ch]
            col = np.clip(c * (0.6 + 0.4 * tint) if ch != "D" else np.array([c] * 3), 0, 1)
            a[by + j * cell : by + (j + 1) * cell, bx + i * cell : bx + (i + 1) * cell] = col
    return a


# ── Render loop ──────────────────────────────────────────────────


def clear_crystal() -> None:
    for ob in list(bpy.data.objects):
        if ob.type in ("CURVE", "MESH", "EMPTY"):
            bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.curves, bpy.data.meshes):
        for x in list(coll):
            if x.users == 0:
                coll.remove(x)


ATLAS_TILE = 256
ATLAS_COLS = 6  # 6 × 5 = the 30 slices


def to_webp(png: Path, webp: Path, q: int) -> None:
    import subprocess

    subprocess.run(["cwebp", "-quiet", "-q", str(q), str(png), "-o", str(webp)], check=True)
    png.unlink()


def save_png(a: np.ndarray, path: Path) -> None:
    h, w, _ = a.shape
    o = bpy.data.images.new("o", w, h)
    rgba = np.concatenate([a[::-1], np.ones((h, w, 1))], axis=2).astype(np.float32)
    o.pixels.foreach_set(rgba.ravel())
    o.filepath_raw = str(path)
    o.file_format = "PNG"
    o.save()
    bpy.data.images.remove(o)


def render_token(t: dict, frames: list[int], size: int, out: Path, atlas_dir: Path | None = None) -> None:
    sc = bpy.context.scene
    sign = -1 if t["rotation"] == "CW" else 1
    io = t["io"]
    out.mkdir(parents=True, exist_ok=True)
    tmp = out / "_raw.exr"
    k = size // ATLAS_TILE
    atlas = np.zeros((ATLAS_TILE * 5, ATLAS_TILE * ATLAS_COLS, 3), np.float32)
    for f in frames:
        clear_crystal()
        rng = random.Random(int(t["id"]) * 31 + f)
        hidden: set[int] = set()
        if io == "IO":
            hidden = {i for i in range(len(EDGES)) if rng.random() < 0.28}
        root = build(t, f, hidden)
        ang = math.radians(6.0 * f) * sign
        # Stasis: a calm hand; no stasis (and higher tiers) shake the sculpture a little.
        shake = (0.0 if t["stasis"] == "S" else 0.004) * int(t["tier"])
        root.rotation_euler = (rng.uniform(-shake, shake), rng.uniform(-shake, shake), ang)
        sc.render.filepath = str(tmp)
        sc.render.image_settings.file_format = "OPEN_EXR"
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(str(tmp), check_existing=False)
        wpx = np.empty(size * size * 4, dtype=np.float32)
        img.pixels.foreach_get(wpx)
        bpy.data.images.remove(img)
        a = wpx.reshape(size, size, 4)[::-1, :, :3]
        a = film(a, t, f, np.random.default_rng(int(t["id"]) * 1000 + f))
        png = out / f"{f + 1:02d}.png"
        save_png(a, png)
        to_webp(png, png.with_suffix(".webp"), 85)
        # Atlas tile (box downsample).
        tile = a.reshape(ATLAS_TILE, k, ATLAS_TILE, k, 3).mean(axis=(1, 3))
        r, c = divmod(f, ATLAS_COLS)
        atlas[r * ATLAS_TILE : (r + 1) * ATLAS_TILE, c * ATLAS_TILE : (c + 1) * ATLAS_TILE] = tile
    if atlas_dir and len(frames) == 30:
        atlas_dir.mkdir(parents=True, exist_ok=True)
        png = atlas_dir / f"{int(t['id']):04d}.png"
        save_png(atlas, png)
        to_webp(png, png.with_suffix(".webp"), 80)
    tmp.unlink(missing_ok=True)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tokens", default="961")
    ap.add_argument("--frames", default="0-29")
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--out", default=str(ROOT / ".crystal/slices"))
    ap.add_argument("--atlas", default=str(ROOT / "public/slices"))
    ap.add_argument("--skip-done", action="store_true")
    a = ap.parse_args(argv)
    lo, hi = (int(x) for x in a.frames.split("-"))
    allt = tokens()
    ids = list(allt) if a.tokens == "all" else [int(x) for x in a.tokens.split(",")]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene_setup(a.size)
    for i in ids:
        t = allt[i]
        if a.skip_done and (Path(a.atlas) / f"{i:04d}.webp").exists():
            continue
        render_token(t, list(range(lo, hi + 1)), a.size, Path(a.out) / f"{i:04d}", Path(a.atlas))
        print(f"[slices] {i}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []))
