"""Jade's copper updo as real hair curves in Blender (Cycles, Principled Hair BSDF).

Grows every child strand of the game's groom (.crystal/jade/groom.json from
scripts/hero/export-groom.ts) with the same clump rules as the game's GPU
strands (lib/world/render/hero/hair-render.ts): offset across the flow
(spread root → tip), depth into the volume, curl around the guide, a little
frizz — then maps character space onto the MPFB head, aligned on the eyes.

Shading: Chiang's physically based hair model (R, TT, TRT lobes with
multiple scattering) with a dyed copper colour, slightly random per strand.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


def _frames(rest: np.ndarray, normals: np.ndarray):
    t = np.gradient(rest, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True) + 1e-9
    n = normals - (normals * t).sum(axis=1, keepdims=True) * t
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
    b = np.cross(t, n)
    return t, n, b


def grow(groom: dict, density: float = 1.0, seed: int = 7, segments: int = 24) -> list[np.ndarray]:
    """Child strands in character space (list of (segments, 3) arrays) + per-strand radius."""
    rng = np.random.default_rng(seed)
    P = groom["points"]
    strands, radii = [], []
    s_src = np.linspace(0, 1, P)
    s_dst = np.linspace(0, 1, segments)
    for g in groom["guides"]:
        rest = np.array(g["rest"], dtype=np.float64).reshape(P, 3)
        nrm = np.array(g["normals"], dtype=np.float64).reshape(P, 3)
        rest = np.stack([np.interp(s_dst, s_src, rest[:, i]) for i in range(3)], axis=1)
        nrm = np.stack([np.interp(s_dst, s_src, nrm[:, i]) for i in range(3)], axis=1)
        t, n, b = _frames(rest, nrm)
        flyaway = g["kind"] == "flyaway"
        k = max(1, int(round(g["children"] * density * (0.35 if flyaway else 1.0))))
        across = rng.uniform(-1, 1, k)
        depth = rng.uniform(0, 1, k) ** 1.5
        phase = rng.uniform(0, 2 * math.pi, k)
        curl_scale = rng.uniform(0.6, 1.4, k)
        # Real hair is never even: length jitter, slow waves, clumps pulling together at the tips.
        length = rng.uniform(0.82, 1.0, k)
        sd = s_dst[None, :] * length[:, None]
        rest_k = np.stack([np.interp(sd, s_dst, rest[:, i]) for i in range(3)], axis=-1)
        t_k = np.stack([np.interp(sd, s_dst, t[:, i]) for i in range(3)], axis=-1)
        n_k = np.stack([np.interp(sd, s_dst, n[:, i]) for i in range(3)], axis=-1)
        b_k = np.cross(t_k, n_k)
        wave_a = rng.uniform(0.04, 0.16, k)[:, None] * sd
        wave_f = rng.uniform(1.5, 4.0, k)[:, None]
        wave_p = rng.uniform(0, 2 * math.pi, k)[:, None]
        wave = np.sin(wave_f * 2 * math.pi * sd + wave_p) * wave_a
        wave2 = np.cos(wave_f * 1.7 * math.pi * sd + wave_p * 1.3) * wave_a * 0.7
        clump = 1.0 - 0.45 * sd ** 2  # tips gather towards their guide
        sp = g["spreadRoot"] + (g["spreadTip"] - g["spreadRoot"]) * sd
        off = (across[:, None] * sp * clump)[..., None] * b_k - (depth[:, None] * g["depth"])[..., None] * n_k
        off = off + wave[..., None] * n_k + wave2[..., None] * b_k
        if g["curl"] > 0:
            ang = phase[:, None] + 2 * math.pi * g["curlTurns"] * sd * curl_scale[:, None]
            r = g["curl"] * np.clip(sd * 3, 0, 1)
            off = off + (np.cos(ang) * r)[..., None] * n_k + (np.sin(ang) * r)[..., None] * b_k
        frizz = rng.normal(0, 1, (k, segments, 3)) * (0.06 if flyaway else 0.02) * sd[..., None]
        pts = rest_k + off + frizz
        strands.extend(pts)
        radii.extend([g["width"]] * k)
    return strands, radii


def make_curves(name: str, strands: list[np.ndarray], radii: list[float], to_world) -> bpy.types.Object:
    seg = strands[0].shape[0]
    curves = bpy.data.hair_curves.new(name)
    curves.add_curves([seg] * len(strands))
    pts = np.concatenate([to_world(s) for s in strands]).astype(np.float32)
    curves.position_data.foreach_set("vector", pts.ravel())
    rad = np.concatenate([np.linspace(r, r * 0.25, seg) for r in radii]).astype(np.float32)
    if "radius" not in curves.attributes:
        curves.attributes.new("radius", "FLOAT", "POINT")
    curves.attributes["radius"].data.foreach_set("value", rad)
    ob = bpy.data.objects.new(name, curves)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def hair_material(colour=(0.62, 0.11, 0.012)) -> bpy.types.Material:
    mat = bpy.data.materials.new("jade_hair")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    h = nt.nodes.new("ShaderNodeBsdfHairPrincipled")
    h.parametrization = "COLOR"
    h.inputs["Color"].default_value = (*colour, 1)
    h.inputs["Roughness"].default_value = 0.28
    h.inputs["Radial Roughness"].default_value = 0.35
    h.inputs["Coat"].default_value = 0.05
    h.inputs["IOR"].default_value = 1.55
    if "Random Color" in h.inputs:
        h.inputs["Random Color"].default_value = 0.12
    if "Random Roughness" in h.inputs:
        h.inputs["Random Roughness"].default_value = 0.2
    nt.links.new(h.outputs[0], out.inputs["Surface"])
    return mat


def build(groom_json: Path, basemesh, eye_mid_world: Vector, pupil_dist_world: float, density: float = 1.0):
    """Hair for the MPFB head: character space → Blender world, aligned on the eyes."""
    groom = json.loads(Path(groom_json).read_text())
    eyes = np.array(groom["eyes"], dtype=np.float64)
    c_mid = eyes.mean(axis=0)
    c_dist = float(np.linalg.norm(eyes[0] - eyes[1]))
    scale = pupil_dist_world / c_dist
    origin = np.array(eye_mid_world)

    def to_world(p: np.ndarray) -> np.ndarray:
        q = (p - c_mid) * scale
        # Character (x, y up, z front) → Blender (x, -z, y); MPFB faces -Y.
        return np.stack([q[:, 0], -q[:, 2], q[:, 1]], axis=1) + origin

    strands, radii = grow(groom, density)
    ob = make_curves("jade_hair", strands, [r * scale for r in radii], to_world)
    ob.data.materials.append(hair_material())
    print(f"[jade] hair: {len(strands)} strands, scale {scale:.4f} m/voxel")
    return ob
