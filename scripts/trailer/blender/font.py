"""Voxel text for the trailers: a 5 × 7 bitmap font built from cubes.

Every glyph pixel is a cube (one mesh per character, so characters can be
revealed one by one). Text is laid out in the XZ plane facing −Y (towards a
camera looking along +Y), baseline at z 0, left edge at x 0, in "pixels";
`text()` scales it to Blender units.
"""

from __future__ import annotations

import bpy
import numpy as np

# 5 × 7 glyphs, rows top → bottom.
GLYPHS: dict[str, list[str]] = {
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "G": [".####", "#....", "#....", "#..##", "#...#", "#...#", ".###."],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    "J": ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
    ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
    ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
    ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
    "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
    "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
    "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    "−": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    "_": [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
    "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
    "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
    ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
    "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
    "%": ["##..#", "##..#", "...#.", "..#..", ".#...", "#..##", "#..##"],
    "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
    ">": ["#....", ".#...", "..#..", "...#.", "..#..", ".#...", "#...."],
    "|": ["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    " ": ["....."] * 7,
}
# Lower case for the logo only ("_unLABS"): x-height 5.
GLYPHS.update(
    {
        "u": [".....", ".....", "#...#", "#...#", "#...#", "#..##", ".##.#"],
        "n": [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
    }
)
ADV = 6  # advance per character (5 + 1 spacing)
LINE = 10  # line height in pixels


def _cubes(pixels: list[tuple[int, int]], depth: float) -> tuple[np.ndarray, list[tuple[int, ...]]]:
    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for x, z in pixels:
        b = len(verts)
        for dy in (0.0, depth):
            for dz in (0, 1):
                for dx in (0, 1):
                    verts.append((x + dx, dy, z + dz))
        # 0 (0,0,0) 1 (1,0,0) 2 (0,0,1) 3 (1,0,1) 4..7 same at y=depth
        faces += [
            (b + 0, b + 1, b + 3, b + 2),  # front (−Y)
            (b + 5, b + 4, b + 6, b + 7),  # back
            (b + 2, b + 3, b + 7, b + 6),  # top
            (b + 4, b + 5, b + 1, b + 0),  # bottom
            (b + 4, b + 0, b + 2, b + 6),  # left
            (b + 1, b + 5, b + 7, b + 3),  # right
        ]
    return np.asarray(verts, dtype=np.float32), faces


def text_material(name: str, color: tuple[float, float, float], emit: float, rough: float = 0.4, metal: float = 0.0) -> bpy.types.Material:
    """Text material: base colour, emission colour × emit × object ``glow``."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Emission Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    a = nt.nodes.new("ShaderNodeAttribute")
    a.attribute_type = "OBJECT"
    a.attribute_name = "glow"
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = emit
    nt.links.new(a.outputs["Fac"], mul.inputs[0])
    nt.links.new(mul.outputs[0], b.inputs["Emission Strength"])
    return m


def text(
    s: str,
    size: float,
    material: bpy.types.Material,
    parent: bpy.types.Object | None = None,
    align: str = "center",
    depth: float = 1.0,
    name: str = "text",
) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    """Build `s` (multi-line with \\n). `size` = Blender units per pixel.

    Returns (root empty, characters in reading order). The root's origin is
    the block's centre (align centre) or its left edge; children are per char.
    """
    lines = s.split("\n")
    width = max(len(ln) for ln in lines) * ADV - 1
    height = len(lines) * LINE - 3
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    if parent:
        root.parent = parent
    chars: list[bpy.types.Object] = []
    for li, ln in enumerate(lines):
        lw = len(ln) * ADV - 1
        x0 = {"center": -lw / 2, "left": -width / 2 if align == "block" else 0.0}.get(align, 0.0)
        z0 = height / 2 - 7 - li * LINE
        for ci, ch in enumerate(ln):
            g = GLYPHS.get(ch) or GLYPHS.get(ch.upper()) or GLYPHS["?"]
            px = [(c, 6 - r) for r, row in enumerate(g) for c, v in enumerate(row) if v == "#"]
            if not px:
                continue
            V, F = _cubes(px, depth)
            me = bpy.data.meshes.new(f"{name}:{li}:{ci}")
            me.from_pydata(V.tolist(), [], F)
            me.materials.append(material)
            ob = bpy.data.objects.new(me.name, me)
            bpy.context.scene.collection.objects.link(ob)
            ob.parent = root
            ob.location = ((x0 + ci * ADV) * size, 0, z0 * size)
            ob.scale = (size, size, size)
            ob["glow"] = 1.0
            chars.append(ob)
    return root, chars


def reveal(chars: list[bpy.types.Object], start: int, per_char: float, mode: str = "type") -> int:
    """Keyframe characters appearing from `start` (frames), `per_char` frames apart.

    mode "type": pop in (terminal); "rise": float up 4 px while scaling in.
    Returns the frame after the last character.
    """
    f = float(start)
    for ob in chars:
        s0 = ob.scale.copy()
        loc = ob.location.copy()
        fi = int(round(f))
        ob.scale = (0, 0, 0)
        ob.keyframe_insert("scale", frame=fi - 1)
        if mode == "rise":
            ob.location = (loc.x, loc.y, loc.z - 4 * s0.x)
            ob.keyframe_insert("location", frame=fi)
            ob.scale = s0 * 0.01
            ob.keyframe_insert("scale", frame=fi)
            ob.location = loc
            ob.keyframe_insert("location", frame=fi + 10)
            ob.scale = s0
            ob.keyframe_insert("scale", frame=fi + 8)
        else:
            ob.scale = s0
            ob.keyframe_insert("scale", frame=fi)
            for fc in _scale_curves(ob):
                for k in fc.keyframe_points:
                    k.interpolation = "CONSTANT"
        f += per_char
    return int(round(f))


def _scale_curves(ob: bpy.types.Object) -> list:
    ad = ob.animation_data
    if not ad or not ad.action:
        return []
    a = ad.action
    curves = []
    if hasattr(a, "fcurves"):
        try:
            curves = [fc for fc in a.fcurves if fc.data_path == "scale"]
        except Exception:  # noqa: BLE001
            curves = []
    if not curves:
        for layer in getattr(a, "layers", []):
            for strip in layer.strips:
                for bag in getattr(strip, "channelbags", []):
                    curves += [fc for fc in bag.fcurves if fc.data_path == "scale"]
    return curves
