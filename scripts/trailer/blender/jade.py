"""Trailer hero: the realistic Jade in Blender, rigged, for EEVEE cinematics.

Loads .voxel/trailer/jade/ (scripts/trailer/jade.ts) and builds what the
engine draws for the hero Jade (lib/world/render/hero/hero-rig.ts):

  - an armature with the 15 hero joints (skeleton.ts names, rest positions);
  - every sculpt layer as a mesh, skinned with the game's weights (vertex
    groups + Armature modifier), shaded with Principled BSDFs approximating
    lib/world/render/hero/materials.ts (skin with subsurface, cloth sheen,
    leather, the copper under-layer of the updo), the per-vertex field AO
    as the attribute ``ao``;
  - the real head (public/hero/jade-head.glb + jade-skin.jpg) in place of
    the sculpted one, aligned like head-glb.ts (it is authored in character
    space on JADE_EYES: only the axis swap + unit), shape key ``blink``;
  - two eyeballs (procedural iris, clearcoat cornea), bone-parented to head;
  - the strand hair as a Curves object (every child strand grown like the
    game's GPU strands), bone-parented to head, Principled Hair BSDF.

Space: Blender units = game world units (0.09 per model voxel, JADE_SCALE),
game (x, y, z) → Blender (x, −z, y): feet at the origin, facing −Y.

    import sys; sys.path.insert(0, "<repo>/scripts/trailer/blender")
    import jade
    rig = jade.build_jade()                     # armature, feet at origin
    jade.pose_joint(rig, "head", (0, 0.4, 0))   # game-space Euler (three.js XYZ), rad
    jade.pose_joint(rig, "upperArmL", (0, 0, 1.2))
    jade.set_blink(rig, 1.0)
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / ".voxel/trailer/jade"

#: game (x, y, z) → Blender (x, −z, y) as a rotation matrix.
G2B = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def g2b(a: np.ndarray, unit: float) -> np.ndarray:
    """(n, 3) game character-space points (voxels) → Blender (units)."""
    return np.stack([a[:, 0], -a[:, 2], a[:, 1]], axis=1) * unit


def srgb_to_linear(hex_: str) -> tuple[float, float, float, float]:
    h = hex_.lstrip("#")
    out = []
    for k in (0, 2, 4):
        c = int(h[k : k + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


def _arr(buf: bytes, entry: dict[str, int], dtype: Any) -> np.ndarray:
    return np.frombuffer(buf, dtype=dtype, count=entry["bytes"] // np.dtype(dtype).itemsize, offset=entry["offset"])


# ── Materials ──────────────────────────────────────────────────────


class _Nodes:
    """Tiny helper around a material node tree (keeps the builders readable)."""

    def __init__(self, mat: bpy.types.Material) -> None:
        mat.use_nodes = True
        self.nt = mat.node_tree
        self.nt.nodes.clear()
        self.out = self.new("ShaderNodeOutputMaterial")

    def new(self, kind: str, **inputs: Any) -> bpy.types.Node:
        n = self.nt.nodes.new(kind)
        for k, v in inputs.items():
            n.inputs[k].default_value = v
        return n

    def link(self, a: Any, b: Any) -> None:
        self.nt.links.new(a, b)

    def math(self, op: str, a: Any, b: Any = None) -> Any:
        n = self.new("ShaderNodeMath")
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                self.link(v, n.inputs[i])
        return n.outputs[0]

    def mix_rgb(self, op: str, a: Any, b: Any, fac: Any = 1.0) -> Any:
        n = self.new("ShaderNodeMix")
        n.data_type = "RGBA"
        n.blend_type = op
        for sock, v in ((n.inputs[6], a), (n.inputs[7], b), (n.inputs[0], fac)):
            if isinstance(v, (int, float, tuple)):
                sock.default_value = v
            else:
                self.link(v, sock)
        return n.outputs[2]

    def attr(self, name: str, kind: str = "GEOMETRY") -> bpy.types.Node:
        a = self.new("ShaderNodeAttribute")
        a.attribute_type = kind
        a.attribute_name = name
        return a

    def range(self, v: Any, a: float, b: float, lo: float, hi: float, smooth: bool = True) -> Any:
        n = self.new("ShaderNodeMapRange")
        n.interpolation_type = "SMOOTHSTEP" if smooth else "LINEAR"
        self.link(v, n.inputs["Value"])
        n.inputs["From Min"].default_value = a
        n.inputs["From Max"].default_value = b
        n.inputs["To Min"].default_value = lo
        n.inputs["To Max"].default_value = hi
        return n.outputs["Result"]

    def height(self, unit: float) -> Any:
        """Game y (voxels) of the shading point, from the object space (rest pose, feet at origin)."""
        tc = self.new("ShaderNodeTexCoord")
        sep = self.new("ShaderNodeSeparateXYZ")
        self.link(tc.outputs["Object"], sep.inputs[0])
        return self.math("DIVIDE", sep.outputs["Z"], unit)


def _ao(n: _Nodes, colour: Any, strength: float) -> Any:
    """Base colour × field AO (EEVEE adds its own horizon AO, so only part of it)."""
    ao = n.attr("ao")
    k = n.math("ADD", n.math("MULTIPLY", ao.outputs["Fac"], strength), 1.0 - strength)
    return n.mix_rgb("MULTIPLY", colour, _grey(n, k), 1.0)


def _grey(n: _Nodes, v: Any) -> Any:
    c = n.new("ShaderNodeCombineColor")
    for i in range(3):
        n.link(v, c.inputs[i])
    return c.outputs[0]


def _principled(n: _Nodes, **inputs: Any) -> bpy.types.Node:
    b = n.new("ShaderNodeBsdfPrincipled")
    for k, v in inputs.items():
        if k in b.inputs:
            b.inputs[k].default_value = v
    n.link(b.outputs[0], n.out.inputs["Surface"])
    return b


def _scalp_mask(n: _Nodes, unit: float) -> Any:
    """1 where the scalp grows hair (jade-sculpt.ts hairRegion < 0), soft at the hairline.

    hairRegion = max(min(line − y, z + 0.9), 54.2 − y), line = 56.5 + (z + 0.9)·0.55
    (the arch over the brow is left out); the ears stay skin.
    """
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    n.link(tc.outputs["Object"], sep.inputs[0])
    gx = n.math("DIVIDE", sep.outputs["X"], unit)
    gy = n.math("DIVIDE", sep.outputs["Z"], unit)
    gz = n.math("DIVIDE", sep.outputs["Y"], -unit)
    zb = n.math("ADD", gz, 0.9)
    line = n.math("ADD", n.math("MULTIPLY", zb, 0.55), 56.5)
    reg = n.math("MAXIMUM", n.math("MINIMUM", n.math("SUBTRACT", line, gy), zb), n.math("SUBTRACT", 54.2, gy))
    mask = n.range(reg, 0.05, -0.3, 0.0, 1.0)
    # MPFB ears: past |x| 3.0, y 54.2 … 57.0, z −2.0 … 0.0.
    ear = n.math(
        "MULTIPLY",
        n.math("MULTIPLY", n.range(n.math("ABSOLUTE", gx), 2.92, 3.02, 0.0, 1.0), n.range(gy, 57.2, 56.9, 0.0, 1.0)),
        n.math("MULTIPLY", n.range(gz, -2.2, -1.9, 0.0, 1.0), n.range(gz, 0.2, -0.1, 0.0, 1.0)),
    )
    return n.math("MULTIPLY", mask, n.math("SUBTRACT", 1.0, ear))


def skin_material(
    name: str,
    colour: str,
    unit: float,
    image: Path | None = None,
    scalp: str | None = None,
) -> bpy.types.Material:
    """Skin: subsurface (red scatters furthest), soft reddish sheen, fine pore bump.

    With ``image`` (the baked portrait on the MPFB head) the albedo is the texture,
    otherwise the look's skin tone with a little mottling (the sculpted hands/head).
    ``scalp`` (hair colour) paints the hair-growing scalp in dark copper so the skin
    between strands and at the hairline reads as tightly pulled hair, not bare skin.
    """
    m = bpy.data.materials.new(name)
    n = _Nodes(m)
    if image is not None and image.exists():
        tex = n.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(image), check_existing=True)
        tex.image.colorspace_settings.name = "sRGB"
        tex.interpolation = "Cubic"
        uv = n.new("ShaderNodeUVMap")
        uv.uv_map = "UVMap"
        n.link(uv.outputs["UV"], tex.inputs["Vector"])
        # The bake is de-lit and pale; AgX greys pale tones further. A little more
        # saturation brings it to the warm tone of the game's skin (#f3cfbb).
        hs = n.new("ShaderNodeHueSaturation", Saturation=1.4, Value=1.0)
        n.link(tex.outputs["Color"], hs.inputs["Color"])
        base = n.mix_rgb("MULTIPLY", hs.outputs["Color"], (1.0, 0.88, 0.8, 1.0), 1.0)
    else:
        noise = n.new("ShaderNodeTexNoise", Scale=2.6 / unit * 0.1, Detail=4.0)
        k = n.range(noise.outputs["Fac"], 0.3, 0.7, 0.95, 1.05, smooth=False)
        base = n.mix_rgb("MULTIPLY", srgb_to_linear(colour), _grey(n, k), 1.0)
    if scalp:
        streak = n.new("ShaderNodeTexNoise", Scale=60.0, Detail=2.0)
        streak.noise_dimensions = "3D"
        k = n.range(streak.outputs["Fac"], 0.35, 0.65, 0.32, 0.55, smooth=False)
        hair = n.mix_rgb("MULTIPLY", srgb_to_linear(scalp), _grey(n, k), 1.0)
        base = n.mix_rgb("MIX", base, hair, _scalp_mask(n, unit))
    b = _principled(
        n,
        **{
            "Roughness": 0.5,
            "Subsurface Weight": 0.35,
            "Subsurface Radius": (1.0, 0.36, 0.2),
            # ≈ 3 mm mean free path (1 unit ≈ 31 cm: 0.09 units per 2.78 cm voxel).
            "Subsurface Scale": 0.011,
            "Specular IOR Level": 0.45,
            "Sheen Weight": 0.25,
            "Sheen Roughness": 0.55,
            "Sheen Tint": (1.0, 0.48, 0.36, 1.0),
            "Coat Weight": 0.04,
            "Coat Roughness": 0.35,
        },
    )
    n.link(base, b.inputs["Base Color"])
    # Pores + fine lines (materials.ts: 45 and 9 cycles per voxel).
    pores = n.new("ShaderNodeTexNoise", Scale=45.0 / unit / 10.0, Detail=2.0)
    bump = n.new("ShaderNodeBump", Strength=0.08, Distance=0.004 * unit)
    n.link(pores.outputs["Fac"], bump.inputs["Height"])
    n.link(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def cloth_material(name: str, colour: str, rough: float, sheen: float, sheen_tint: str, unit: float, ao: float = 0.4) -> bpy.types.Material:
    """Shirt / coat / trousers: matte weave with a soft fabric sheen and a fine bump."""
    m = bpy.data.materials.new(name)
    n = _Nodes(m)
    noise = n.new("ShaderNodeTexNoise", Scale=1.6 / unit * 0.1, Detail=3.0)
    k = n.range(noise.outputs["Fac"], 0.3, 0.7, 0.94, 1.03, smooth=False)
    base = n.mix_rgb("MULTIPLY", srgb_to_linear(colour), _grey(n, k), 1.0)
    base = _ao(n, base, ao)
    b = _principled(
        n,
        **{
            "Roughness": rough,
            "Sheen Weight": sheen,
            "Sheen Roughness": 0.6,
            "Sheen Tint": srgb_to_linear(sheen_tint),
            "Specular IOR Level": 0.35,
        },
    )
    n.link(base, b.inputs["Base Color"])
    weave = n.new("ShaderNodeTexWave", Scale=60.0 / unit / 40.0, Distortion=0.0)
    weave.wave_type = "BANDS"
    bump = n.new("ShaderNodeBump", Strength=0.05, Distance=0.002 * unit)
    n.link(weave.outputs["Fac"], bump.inputs["Height"])
    n.link(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def leather_material(name: str, colour: str, unit: float, sole: bool = False) -> bpy.types.Material:
    """Boots / belt: grained leather; boots get the dark sole below 0.4 voxels."""
    m = bpy.data.materials.new(name)
    n = _Nodes(m)
    grain = n.new("ShaderNodeTexNoise", Scale=16.0 / unit / 10.0, Detail=6.0)
    k = n.range(grain.outputs["Fac"], 0.3, 0.7, 0.88, 1.04, smooth=False)
    base = n.mix_rgb("MULTIPLY", srgb_to_linear(colour), _grey(n, k), 1.0)
    rough: Any = 0.45
    if sole:
        s = n.range(n.height(unit), 0.34, 0.4, 1.0, 0.0)
        base = n.mix_rgb("MIX", base, (0.03, 0.028, 0.026, 1.0), s)
        rough = n.range(n.height(unit), 0.34, 0.4, 0.8, 0.42)
    base = _ao(n, base, 0.4)
    b = _principled(n, **{"Specular IOR Level": 0.45, "Coat Weight": 0.15, "Coat Roughness": 0.3})
    n.link(base, b.inputs["Base Color"])
    if isinstance(rough, float):
        b.inputs["Roughness"].default_value = rough
    else:
        n.link(rough, b.inputs["Roughness"])
    bump = n.new("ShaderNodeBump", Strength=0.1, Distance=0.004 * unit)
    n.link(grain.outputs["Fac"], bump.inputs["Height"])
    n.link(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def plain_material(name: str, colour: str, rough: float, metal: float = 0.0, emit: str | None = None) -> bpy.types.Material:
    m = bpy.data.materials.new(name)
    n = _Nodes(m)
    b = _principled(n, **{"Base Color": srgb_to_linear(colour), "Roughness": rough, "Metallic": metal})
    if emit:
        b.inputs["Emission Color"].default_value = srgb_to_linear(emit)
        b.inputs["Emission Strength"].default_value = 0.12  # a faint lit dial, not a glowing band
    return m


def hair_shell_material(name: str, colour: str, unit: float) -> bpy.types.Material:
    """The sculpted updo under the strands: deep copper, darker at roots and nape."""
    m = bpy.data.materials.new(name)
    n = _Nodes(m)
    k = n.range(n.height(unit), 54.0, 62.0, 0.62, 1.12)
    noise = n.new("ShaderNodeTexNoise", Scale=0.7 / unit * 0.1 * 6.0, Detail=5.0)
    k2 = n.range(noise.outputs["Fac"], 0.3, 0.7, 0.8, 1.05, smooth=False)
    base = n.mix_rgb("MULTIPLY", srgb_to_linear(colour), _grey(n, n.math("MULTIPLY", n.math("MULTIPLY", k, k2), 0.7)), 1.0)
    base = _ao(n, base, 0.6)
    b = _principled(
        n,
        **{
            # Mostly seen between strands: keep it matte so it never flashes through.
            "Roughness": 0.62,
            "Sheen Weight": 0.15,
            "Sheen Tint": srgb_to_linear("#ffb070"),
            "Specular IOR Level": 0.25,
            "Specular Tint": srgb_to_linear("#ffc49a"),
        },
    )
    n.link(base, b.inputs["Base Color"])
    return m


def strand_material(name: str, colour: str) -> bpy.types.Material:
    """Copper strands (hair-render.ts colour rules) on the Principled Hair BSDF.

    base = colour · (0.72 + 0.4·var) · (redder ↔ lighter by var), roots ×0.55 → tips ×1.05,
    deep strands (inside the clump) ×0.55 — per-strand ``jvar`` / ``jdepth`` attributes.
    """
    m = bpy.data.materials.new(name)
    n = _Nodes(m)
    info = n.new("ShaderNodeHairInfo")
    var = n.attr("jvar").outputs["Fac"]
    depth = n.attr("jdepth").outputs["Fac"]
    k = n.math("MULTIPLY", n.math("ADD", n.math("MULTIPLY", var, 0.4), 0.72), n.range(info.outputs["Intercept"], 0.0, 0.6, 0.55, 1.05))
    k = n.math("MULTIPLY", k, n.range(depth, 0.0, 1.0, 1.0, 0.55, smooth=False))
    tint = n.mix_rgb("MIX", (1.0, 0.82, 0.78, 1.0), (1.0, 1.05, 1.0, 1.0), var)
    base = n.mix_rgb("MULTIPLY", srgb_to_linear(colour), tint, 1.0)
    base = n.mix_rgb("MULTIPLY", base, _grey(n, k), 1.0)
    h = n.new("ShaderNodeBsdfHairPrincipled")
    h.parametrization = "COLOR"
    for key, v in (("Roughness", 0.3), ("Radial Roughness", 0.4), ("Coat", 0.05), ("IOR", 1.55)):
        if key in h.inputs:
            h.inputs[key].default_value = v
    n.link(base, h.inputs["Color"])
    n.link(h.outputs[0], n.out.inputs["Surface"])
    return m


def eye_material(name: str, iris: str) -> bpy.types.Material:
    """Sclera, a large dark fibrous iris, pupil, limbal ring; clearcoat cornea (materials.ts eye).

    Angle from the eye's front axis (object −Y = game +z): pupil < 0.26 rad, iris < 0.67.
    """
    m = bpy.data.materials.new(name)
    n = _Nodes(m)
    tc = n.new("ShaderNodeTexCoord")
    nv = n.new("ShaderNodeVectorMath")
    nv.operation = "NORMALIZE"
    n.link(tc.outputs["Object"], nv.inputs[0])
    d = n.new("ShaderNodeVectorMath")
    d.operation = "DOT_PRODUCT"
    n.link(nv.outputs["Vector"], d.inputs[0])
    d.inputs[1].default_value = (0.0, -1.0, 0.0)
    a = n.math("DIVIDE", n.math("ARCCOSINE", d.outputs["Value"]), math.pi)
    ramp = n.new("ShaderNodeValToRGB")
    n.link(a, ramp.inputs["Fac"])
    ir = srgb_to_linear(iris)
    els = ramp.color_ramp.elements
    stops = [
        (0.0, (0.004, 0.004, 0.004, 1)),
        (0.075, (0.004, 0.004, 0.004, 1)),
        (0.092, tuple(min(1.0, c * 1.6) for c in ir[:3]) + (1,)),
        (0.17, tuple(c * 0.8 for c in ir[:3]) + (1,)),
        (0.2, (0.02, 0.015, 0.012, 1)),
        (0.225, (0.5, 0.47, 0.45, 1)),
        (0.5, (0.36, 0.34, 0.33, 1)),
    ]
    els[0].position, els[0].color = stops[0]
    els[1].position, els[1].color = stops[-1]
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = col
    # Iris fibres: radial streaks.
    fib = n.new("ShaderNodeTexNoise", Scale=30.0, Detail=3.0)
    n.link(tc.outputs["Object"], fib.inputs["Vector"])
    kf = n.range(fib.outputs["Fac"], 0.3, 0.7, 0.75, 1.15, smooth=False)
    base = n.mix_rgb("MULTIPLY", ramp.outputs["Color"], _grey(n, kf), n.range(a, 0.19, 0.22, 1.0, 0.0))
    b = _principled(n, **{"Roughness": 0.25, "Coat Weight": 1.0, "Coat Roughness": 0.03, "Specular IOR Level": 0.5})
    n.link(base, b.inputs["Base Color"])
    return m


#: Optional hair colour override (hex) for cinematic grading; None = the look's colour.
HAIR_OVERRIDE: str | None = None


def build_materials(meta: dict[str, Any]) -> dict[str, bpy.types.Material]:
    u = meta["unit"]
    c = meta["colours"]
    return {
        "skin": skin_material("jade:skin", c["skin"], u),
        "hair": hair_shell_material("jade:hairShell", HAIR_OVERRIDE or c["hair"], u),
        "shirt": cloth_material("jade:shirt", c["shirt"], 0.78, 0.4, "#ffffff", u),
        "coat": cloth_material("jade:coat", c["coat"], 0.72, 0.35, "#ffffff", u),
        "trousers": cloth_material("jade:trousers", c["trousers"], 0.82, 0.6, "#8a93a8", u),
        "boots": leather_material("jade:boots", c["boots"], u, sole=True),
        "belt": leather_material("jade:belt", c["belt"], u),
        "trim": plain_material("jade:trim", "#d8d4cc", 0.22),
        "watch": plain_material("jade:watch", c["watch"], 0.35, 0.3, emit=c["watchFace"]),
    }


# ── Armature ───────────────────────────────────────────────────────


def build_armature(meta: dict[str, Any], coll: bpy.types.Collection) -> bpy.types.Object:
    """The 15 hero joints as bones (heads at the rest positions, tails down the chain)."""
    u = meta["unit"]
    arm = bpy.data.armatures.new("jade:rig")
    arm.display_type = "STICK"
    ob = bpy.data.objects.new("Jade", arm)
    coll.objects.link(ob)
    view = bpy.context.view_layer
    prev = view.objects.active
    view.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    for j in meta["joints"]:
        eb = arm.edit_bones.new(j["name"])
        eb.head = Vector(g2b(np.array([j["head"]], dtype=np.float64), u)[0])
        eb.tail = Vector(g2b(np.array([j["tail"]], dtype=np.float64), u)[0])
        # Bone Z towards her front (−Y) for limbs, up for the face bones.
        eb.align_roll(Vector((0, 0, 1)) if j["name"] in ("brows", "lids") else Vector((0, -1, 0)))
        eb.use_deform = True
    for j in meta["joints"]:
        if j["parent"]:
            arm.edit_bones[j["name"]].parent = arm.edit_bones[j["parent"]]
    bpy.ops.object.mode_set(mode="OBJECT")
    view.objects.active = prev
    return ob


def _bone_parent(child: bpy.types.Object, rig: bpy.types.Object, bone: str) -> None:
    """Parent to a bone keeping the child's current world transform (rest pose)."""
    world = child.matrix_world.copy()
    child.parent = rig
    child.parent_type = "BONE"
    child.parent_bone = bone
    pb = rig.pose.bones[bone]
    # A bone parent sits at the bone's tail.
    parent_m = rig.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))
    child.matrix_parent_inverse = parent_m.inverted()
    # world = parent_m @ parent_inverse @ basis = basis
    child.matrix_basis = world


def _skin(ob: bpy.types.Object, rig: bpy.types.Object, joints: list[str], idx: np.ndarray, w: np.ndarray) -> None:
    """Vertex groups from 4 (bone, weight) slots per vertex, batched by quantised weight."""
    idx = idx.reshape(-1, 4)
    w = w.reshape(-1, 4)
    groups = {name: ob.vertex_groups.new(name=name) for name in joints}
    q = np.round(w * 1024).astype(np.int32)
    for bi, name in enumerate(joints):
        rows, cols = np.nonzero((idx == bi) & (q > 0))
        if not len(rows):
            continue
        wq = q[rows, cols]
        for val in np.unique(wq):
            groups[name].add(rows[wq == val].tolist(), float(val) / 1024.0, "ADD")
    mod = ob.modifiers.new("armature", "ARMATURE")
    mod.object = rig
    ob.parent = rig
    ob.matrix_parent_inverse.identity()


def _mesh(name: str, pos: np.ndarray, nor: np.ndarray | None, tri: np.ndarray) -> bpy.types.Mesh:
    me = bpy.data.meshes.new(name)
    nv = len(pos)
    nt = len(tri) // 3
    me.vertices.add(nv)
    me.vertices.foreach_set("co", pos.astype(np.float32).ravel())
    me.loops.add(nt * 3)
    me.loops.foreach_set("vertex_index", tri.astype(np.int32))
    me.polygons.add(nt)
    me.polygons.foreach_set("loop_start", np.arange(0, nt * 3, 3, dtype=np.int32))
    me.polygons.foreach_set("use_smooth", np.ones(nt, dtype=bool))
    me.update(calc_edges=True)
    me.validate(clean_customdata=False)
    if nor is not None and len(me.vertices) == nv:
        me.normals_split_custom_set_from_vertices(nor.astype(np.float32).reshape(-1, 3).tolist())
    return me


# ── Hair fit ───────────────────────────────────────────────────────


class HeadFit:
    """Moves the hair from the sculpted skull onto the MPFB skull.

    The groom and the sculpted updo were built around the SDF head; the MPFB
    head (jade-head.glb) is aligned on the same eyes but its skull is up to
    ~0.5 voxels larger at the back and the sides, which buries the pinned
    sides and the nape inside the scalp. For every direction from the skull
    centre this measures how far the MPFB skull lies outside the sculpted one
    (rays from outside, ears skipped, blurred) and pushes hair points out by
    that amount — thickness and flow of the updo stay as groomed.
    """

    def __init__(self, meta: dict[str, Any], sdf_head: tuple[np.ndarray, np.ndarray], glb: bpy.types.Object, res: int = 96) -> None:
        from mathutils.bvhtree import BVHTree

        u = meta["unit"]
        self.u = u
        self.c = g2b(np.array([[0.0, 57.2, -0.9]]), u)[0]
        pos, tri = sdf_head
        sdf = BVHTree.FromPolygons([tuple(v) for v in pos], tri.reshape(-1, 3).tolist())
        co = np.empty(len(glb.data.vertices) * 3, dtype=np.float32)
        glb.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        tris = [tuple(p.vertices) for p in glb.data.polygons]
        real = BVHTree.FromPolygons([tuple(v) for v in co], tris)
        self.nt, self.np_ = res, res * 2
        th = (np.arange(self.nt) + 0.5) / self.nt * math.pi
        ph = np.arange(self.np_) / self.np_ * 2 * math.pi
        off = np.zeros((self.nt, self.np_))
        for i, t in enumerate(th):
            for j, p in enumerate(ph):
                d = Vector((math.sin(t) * math.cos(p), math.sin(t) * math.sin(p), math.cos(t)))
                a, b = self._radius(sdf, d), self._radius(real, d)
                if a is not None and b is not None:
                    off[i, j] = b - a
        # Blur (wraps around in φ) and clamp: the skulls differ smoothly, features don't matter.
        for _ in range(6):
            off = (off + np.roll(off, 1, 1) + np.roll(off, -1, 1)) / 3
            off[1:-1] = (off[1:-1] + off[:-2] + off[2:]) / 3
        self.off = np.clip(off, -0.25 * u, 0.9 * u)

    def _radius(self, tree: Any, d: Vector) -> float | None:
        """Distance from the centre to the outermost surface along d, skipping the ears."""
        c = Vector(self.c)
        o = c + d * (12 * self.u)
        for _ in range(6):
            hit, _n, _i, _dist = tree.ray_cast(o, -d)
            if hit is None:
                return None
            gx, gy, gz = hit.x / self.u, hit.z / self.u, -hit.y / self.u
            # MPFB ears: they stand out past |x| 3.0 (the skull is ~2.9 wide there).
            ear = abs(gx) > 3.0 and 54.2 < gy < 57.0 and -2.0 < gz < 0.0
            if not ear:
                return (hit - c).length
            o = hit - d * (0.02 * self.u)
        return None

    def apply(self, pts: np.ndarray) -> np.ndarray:
        v = pts - self.c
        r = np.linalg.norm(v, axis=1) + 1e-9
        d = v / r[:, None]
        t = np.arccos(np.clip(d[:, 2], -1, 1)) / math.pi * self.nt - 0.5
        p = (np.arctan2(d[:, 1], d[:, 0]) % (2 * math.pi)) / (2 * math.pi) * self.np_
        t0 = np.clip(np.floor(t).astype(int), 0, self.nt - 1)
        t1 = np.clip(t0 + 1, 0, self.nt - 1)
        ft = np.clip(t - t0, 0, 1)
        p0 = np.floor(p).astype(int) % self.np_
        p1 = (p0 + 1) % self.np_
        fp = p - np.floor(p)
        o = self.off
        val = (o[t0, p0] * (1 - fp) + o[t0, p1] * fp) * (1 - ft) + (o[t1, p0] * (1 - fp) + o[t1, p1] * fp) * ft
        return pts + d * val[:, None]


# ── Build ──────────────────────────────────────────────────────────


def _layer_geometry(meta: dict[str, Any], entry: dict[str, Any], data: Path) -> tuple[np.ndarray, np.ndarray]:
    """Positions (Blender units) and triangle indices of an exported layer."""
    buf = (data / entry["file"]).read_bytes()
    pos = g2b(_arr(buf, entry["positions"], np.float32).reshape(-1, 3).astype(np.float64), meta["unit"])
    return pos, _arr(buf, entry["indices"], np.uint32)


def _layer(
    meta: dict[str, Any],
    entry: dict[str, Any],
    mats: dict[str, bpy.types.Material],
    rig: bpy.types.Object,
    coll: bpy.types.Collection,
    data: Path,
    fit: HeadFit | None = None,
) -> bpy.types.Object:
    u = meta["unit"]
    buf = (data / entry["file"]).read_bytes()
    pos = g2b(_arr(buf, entry["positions"], np.float32).reshape(-1, 3).astype(np.float64), u)
    nrm = g2b(_arr(buf, entry["normals"], np.float32).reshape(-1, 3).astype(np.float64), 1.0)
    tri = _arr(buf, entry["indices"], np.uint32)
    if fit is not None:
        # The flat bottom edge of the sculpted cap (nape, y 54.2) stands off the
        # thinner MPFB neck: drop it, the strands cover the nape.
        gy = pos[:, 2] / u
        t3 = tri.reshape(-1, 3)
        tri = t3[gy[t3].min(axis=1) >= 55.0].ravel()
        pos = fit.apply(pos)
    me = _mesh(f"jade:{entry['id']}", pos, nrm, tri)
    ao = me.attributes.new("ao", "FLOAT", "POINT")
    ao.data.foreach_set("value", _arr(buf, entry["ao"], np.float32))
    me.materials.append(mats[entry["material"]])
    ob = bpy.data.objects.new(f"jade:{entry['id']}", me)
    coll.objects.link(ob)
    names = [j["name"] for j in meta["joints"]]
    _skin(ob, rig, names, _arr(buf, entry["skinIndex"], np.uint16), _arr(buf, entry["skinWeight"], np.float32))
    return ob


def _glb_head(meta: dict[str, Any], rig: bpy.types.Object, coll: bpy.types.Collection) -> bpy.types.Object | None:
    """The MPFB head: imported (glTF y-up → Blender z-up is exactly our axis swap), scaled by the unit."""
    h = meta["head"]
    glb = Path(h["glb"])
    if not glb.exists():
        return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    new = [o for o in bpy.data.objects if o not in before]
    head = next((o for o in new if o.type == "MESH" and "head" in o.name.lower()), None)
    if head is None:
        for o in new:
            bpy.data.objects.remove(o)
        return None
    for o in new:
        if o is not head:
            bpy.data.objects.remove(o)
    head.matrix_world = Matrix.Identity(4)  # node transform is identity; keep it explicit
    head.data.transform(Matrix.Scale(h["transform"]["scale"], 4), shape_keys=True)
    for c in list(head.users_collection):
        c.objects.unlink(head)
    coll.objects.link(head)
    head.name = "jade:head"
    _trim_neck(head, meta["unit"])
    head.data.materials.clear()
    head.data.materials.append(skin_material(
            "jade:skinTex",
            meta["colours"]["skin"],
            meta["unit"],
            Path(h["skin"]),
            scalp=meta["colours"]["hair"],
        ))
    for p in head.data.polygons:
        p.use_smooth = True
    # Skin weights (hero-rig.ts headSkin): neck hands over from torso to head over y 50.4 … 52.6.
    n = len(head.data.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    head.data.vertices.foreach_get("co", co)
    y = co.reshape(-1, 3)[:, 2] / meta["unit"]
    sk = h["weights"]
    t = np.clip((y - sk["blendFrom"]) / (sk["blendTo"] - sk["blendFrom"]), 0, 1)
    s = t * t * (3 - 2 * t)
    names = [j["name"] for j in meta["joints"]]
    hi, ti = names.index("head"), names.index("torso")
    idx = np.zeros((n, 4), dtype=np.uint16)
    w = np.zeros((n, 4), dtype=np.float32)
    idx[:, 0], w[:, 0] = hi, s
    idx[:, 1], w[:, 1] = ti, 1 - s
    _skin(head, rig, names, idx, w)
    return head


def _trim_neck(head: bpy.types.Object, unit: float) -> None:
    """Tuck the MPFB neck into the collar.

    Below the jaw the MPFB neck is thicker than the game's stand collar (its
    back reaches z −3.7 at y 51, the collar tube is ~2.07 around x 0, z −0.8)
    and flares into the shoulders (|x| 4.3 at y 50): in the game the clothes
    hide it, in close-ups it poked out of the collar. Pull every vertex below
    y 52.4 radially into a tube of radius 1.9, fully from y 51.4 down — on the
    basis and on every shape key, so ``blink`` stays a pure lid motion.
    """
    keys = head.data.shape_keys.key_blocks if head.data.shape_keys else []
    targets = [head.data.vertices] + [k.data for k in keys]
    for data in targets:
        co = np.empty(len(data) * 3, dtype=np.float32)
        data.foreach_get("co", co)
        co = co.reshape(-1, 3)
        gx, gy, gz = co[:, 0] / unit, co[:, 2] / unit, -co[:, 1] / unit
        r = np.hypot(gx, gz + 0.8)
        t = np.clip((52.4 - gy) / 1.0, 0, 1)
        t = t * t * (3 - 2 * t)
        nr = np.where(r > 1.9, r - (r - 1.9) * t, r)
        k = nr / np.maximum(r, 1e-6)
        co[:, 0] = gx * k * unit
        co[:, 1] = -((gz + 0.8) * k - 0.8) * unit
        data.foreach_set("co", co.ravel())
    head.data.update()


def _eyes(meta: dict[str, Any], rig: bpy.types.Object, coll: bpy.types.Collection) -> list[bpy.types.Object]:
    import bmesh

    u = meta["unit"]
    e = meta["eyes"]
    mat = eye_material("jade:eye", e["iris"])
    out = []
    for i, (c, inward) in enumerate(zip(e["centres"], e["inward"])):
        me = bpy.data.meshes.new(f"jade:eye{i}")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=28, radius=e["radius"] * u)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = True
        me.materials.append(mat)
        ob = bpy.data.objects.new(f"jade:eye{'RL'[i]}", me)
        coll.objects.link(ob)
        ob.location = Vector(g2b(np.array([c], dtype=np.float64), u)[0])
        # Relaxed near gaze: game rotation.y (about up) = rotation about Blender Z.
        ob.rotation_euler = (0.0, 0.0, inward)
        bpy.context.view_layer.update()
        _bone_parent(ob, rig, e["bone"])
        out.append(ob)
    return out


def _hair(
    meta: dict[str, Any],
    rig: bpy.types.Object,
    coll: bpy.types.Collection,
    data: Path,
    share: float,
    thickness: float,
    fit: HeadFit | None = None,
    flyaways: float = 0.35,
) -> bpy.types.Object:
    """Every grown strand as a hair Curves object (rigid to the head bone)."""
    u = meta["unit"]
    h = meta["hair"]
    buf = (data / h["file"]).read_bytes()
    S, P = h["strands"], h["pointsPerStrand"]
    pos = _arr(buf, h["positions"], np.float32).reshape(S, P, 3)
    rad = _arr(buf, h["radius"], np.float32).reshape(S, P)
    depth = _arr(buf, h["depth"], np.float32)
    var = _arr(buf, h["var"], np.float32)
    kind = _arr(buf, h["kind"], np.uint8)
    # Flyaways stand straight off the updo at rest (the game's simulation droops them):
    # keep only a share of them so the silhouette doesn't read as a flame.
    keep_p = np.where(kind == h["kinds"].index("flyaway"), share * flyaways, share)
    keep = np.nonzero(np.random.default_rng(3).random(S) < keep_p)[0]
    pos, rad, depth, var = pos[keep], rad[keep], depth[keep], var[keep]
    n = len(keep)
    curves = bpy.data.hair_curves.new("jade:strands")
    curves.add_curves([P] * n)
    pts = g2b(pos.reshape(-1, 3).astype(np.float64), u)
    if fit is not None:
        pts = fit.apply(pts)
    pts = pts.astype(np.float32)
    curves.position_data.foreach_set("vector", pts.ravel())
    if "radius" not in curves.attributes:
        curves.attributes.new("radius", "FLOAT", "POINT")
    curves.attributes["radius"].data.foreach_set("value", (rad.ravel() * u * thickness).astype(np.float32))
    for name, vals in (("jdepth", depth), ("jvar", var)):
        a = curves.attributes.new(name, "FLOAT", "CURVE")
        a.data.foreach_set("value", vals.astype(np.float32))
    curves.materials.append(strand_material("jade:strands", HAIR_OVERRIDE or h["colour"]))
    ob = bpy.data.objects.new("jade:strands", curves)
    coll.objects.link(ob)
    bpy.context.view_layer.update()
    _bone_parent(ob, rig, h["bone"])
    return ob


def build_jade(
    collection: bpy.types.Collection | None = None,
    *,
    data: Path | str = DATA,
    real_head: bool = True,
    garments: dict[str, bool] | None = None,
    hair: bool = True,
    hair_share: float = 1.0,
    hair_thickness: float = 1.0,
    flyaways: float = 0.35,
) -> bpy.types.Object:
    """Build the rigged hero Jade; returns her armature (object "Jade", feet at the origin).

    collection    target collection (default: a new "Jade" collection in the scene)
    real_head     the MPFB head (jade-head.glb + jade-skin.jpg) instead of the sculpted head
    garments      override optional layers, e.g. {"coat": False, "coatSleeves": False, "belt": False,
                  "watch": False}; default = the first-day look (lab coat, tool belt, watch)
    hair          strand hair (Curves); hair_share thins it (0..1), hair_thickness scales radii,
                  flyaways = share of the fine flyaway strands kept (they stand straight at rest)
    """
    data = Path(data)
    meta: dict[str, Any] = json.loads((data / "jade.json").read_text())
    if collection is None:
        collection = bpy.data.collections.new("Jade")
        bpy.context.scene.collection.children.link(collection)
    mats = build_materials(meta)
    rig = build_armature(meta, collection)
    rig["jade_unit"] = meta["unit"]
    head = _glb_head(meta, rig, collection) if real_head else None
    fit = None
    if head is not None:
        sdf_head = next(e for e in meta["layers"] if e["id"] == "head")
        fit = HeadFit(meta, _layer_geometry(meta, sdf_head, data), head)
    shown = {e["id"]: e["worn"] for e in meta["layers"]}
    shown.update(garments or {})
    for entry in meta["layers"]:
        if entry["id"] == "head" and head is not None:
            continue
        if not shown.get(entry["id"], True):
            continue
        _layer(meta, entry, mats, rig, collection, data, fit if entry["material"] == "hair" else None)
    _eyes(meta, rig, collection)
    if hair:
        _hair(meta, rig, collection, data, hair_share, hair_thickness, fit, flyaways)
    return rig


# ── Posing ─────────────────────────────────────────────────────────


def pose_joint(
    rig: bpy.types.Object,
    joint: str,
    euler: tuple[float, float, float] = (0.0, 0.0, 0.0),
    offset: tuple[float, float, float] | None = None,
) -> None:
    """Pose a joint like the game does (models/rig.ts poses on the hero skeleton).

    ``euler``: rotation in the game's frame (x right… her left, y up, z front), three.js
    order XYZ, radians — the same numbers a game pose writes into ``joint.rotation``.
    ``offset``: optional translation from rest in model voxels (game frame).
    For a hanging arm: negative x swings it forward, +z lifts the left arm sideways
    (−z the right one); head (0, +y, 0) turns her face to her left.
    """
    pb = rig.pose.bones[joint]
    r_game = Matrix.Rotation(euler[0], 3, "X") @ Matrix.Rotation(euler[1], 3, "Y") @ Matrix.Rotation(euler[2], 3, "Z")
    r_arm = G2B @ r_game @ G2B.transposed()
    m = pb.bone.matrix_local.to_3x3()
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (m.transposed() @ r_arm @ m).to_quaternion()
    if offset is not None:
        u = float(rig.get("jade_unit", 0.09))
        pb.location = m.transposed() @ (G2B @ Vector(offset) * u)


def set_blink(rig: bpy.types.Object, value: float) -> None:
    """Lids 0 open … 1 shut (shape key ``blink`` of the real head)."""
    for ob in rig.children:
        keys = getattr(ob.data, "shape_keys", None)
        if keys and "blink" in keys.key_blocks:
            keys.key_blocks["blink"].value = value
