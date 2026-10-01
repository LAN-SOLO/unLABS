"""Look-dev materials (Cycles): the full surface, as the library defines it.

The game gets vertex colour + shared tileable surface textures; this module
builds the same idea as real node trees for previews, merch and stills:
palette colour (vertex colour) × library albedo detail, library roughness /
normal / AO, box-mapped in object space at ``uvScale``. Surfaces without a
library entry fall back to a procedural recipe (noise relief, roughness
breakup) so the pipeline works before the library is wired up.
"""

from __future__ import annotations

from pathlib import Path

import bpy

from .config import ROOT, Config


def _img(path: str, colorspace: str) -> bpy.types.Image | None:
    p = Path(path)
    if not p.is_absolute():
        p = ROOT / p
    if not p.exists():
        return None
    img = bpy.data.images.load(str(p), check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def look_material(sid: str, cfg: Config) -> bpy.types.Material:
    name = f"look:{sid}"
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    s = cfg.surface(sid)
    lib = cfg.library_entry(sid) or {}
    if lib.get("kind") == "blend":
        return blend_material(sid, lib, cfg)
    maps = lib.get("maps", {})
    scale = float(cfg.profiles.get("uvScale", 0.25)) * float(s.get("texScale", 1.0)) * 4.0

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    bsdf = N.get("Principled BSDF")
    out = N.get("Material Output")

    vc = N.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    L.new(tc.outputs["Object"], mp.inputs["Vector"])

    def box(path: str | None, colorspace: str):
        img = _img(path, colorspace) if path else None
        if not img:
            return None
        t = N.new("ShaderNodeTexImage")
        t.image = img
        t.projection = "BOX"
        t.projection_blend = 0.2
        L.new(mp.outputs["Vector"], t.inputs["Vector"])
        return t

    albedo = box(maps.get("albedo"), "sRGB")
    rough = box(maps.get("roughness"), "Non-Color")
    normal = box(maps.get("normal"), "Non-Color")
    ao = box(maps.get("ao"), "Non-Color")

    # Base colour: palette colour × albedo detail (normalised around its mean grey).
    base = vc.outputs["Color"]
    if albedo:
        mul = N.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = float(s.get("texDetail", 0.85))
        gain = N.new("ShaderNodeMath")
        gain.operation = "MULTIPLY"
        gain.inputs[1].default_value = 1.0 / max(0.05, mean_luminance(albedo.image))
        bw = N.new("ShaderNodeRGBToBW")
        L.new(albedo.outputs["Color"], bw.inputs["Color"])
        L.new(bw.outputs["Val"], gain.inputs[0])
        L.new(vc.outputs["Color"], mul.inputs[6])
        L.new(gain.outputs["Value"], mul.inputs[7])
        base = mul.outputs[2]
    if ao:
        m2 = N.new("ShaderNodeMix")
        m2.data_type = "RGBA"
        m2.blend_type = "MULTIPLY"
        m2.inputs["Factor"].default_value = 1.0
        L.new(base, m2.inputs[6])
        L.new(ao.outputs["Color"], m2.inputs[7])
        base = m2.outputs[2]
    L.new(base, bsdf.inputs["Base Color"])

    bsdf.inputs["Metallic"].default_value = float(s.get("metal", 0))
    if rough:
        rr = N.new("ShaderNodeMapRange")
        rr.inputs["To Min"].default_value = max(0.0, float(s.get("rough", 0.5)) - 0.25)
        rr.inputs["To Max"].default_value = min(1.0, float(s.get("rough", 0.5)) + 0.25)
        L.new(rough.outputs["Color"], rr.inputs["Value"])
        L.new(rr.outputs["Result"], bsdf.inputs["Roughness"])
    else:
        # Procedural breakup.
        nz = N.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 6.0
        L.new(mp.outputs["Vector"], nz.inputs["Vector"])
        rr = N.new("ShaderNodeMapRange")
        r0 = float(s.get("rough", 0.5))
        rr.inputs["To Min"].default_value = max(0.02, r0 - 0.12)
        rr.inputs["To Max"].default_value = min(1.0, r0 + 0.12)
        L.new(nz.outputs["Fac"], rr.inputs["Value"])
        L.new(rr.outputs["Result"], bsdf.inputs["Roughness"])

    relief = float(s.get("relief", 0.3))
    if normal:
        nm = N.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = relief
        ncol = normal.outputs["Color"]
        if lib.get("normalDX"):
            # DirectX normal map: flip green for Blender / glTF (OpenGL convention).
            sep = N.new("ShaderNodeSeparateColor")
            inv = N.new("ShaderNodeMath")
            inv.operation = "SUBTRACT"
            inv.inputs[0].default_value = 1.0
            comb = N.new("ShaderNodeCombineColor")
            L.new(ncol, sep.inputs["Color"])
            L.new(sep.outputs["Red"], comb.inputs["Red"])
            L.new(sep.outputs["Green"], inv.inputs[1])
            L.new(inv.outputs["Value"], comb.inputs["Green"])
            L.new(sep.outputs["Blue"], comb.inputs["Blue"])
            ncol = comb.outputs["Color"]
        L.new(ncol, nm.inputs["Color"])
        L.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    elif relief > 0:
        nz2 = N.new("ShaderNodeTexNoise")
        nz2.inputs["Scale"].default_value = 40.0
        nz2.inputs["Detail"].default_value = 8.0
        L.new(mp.outputs["Vector"], nz2.inputs["Vector"])
        bump = N.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.08 * relief
        L.new(nz2.outputs["Fac"], bump.inputs["Height"])
        L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    if s.get("emit"):
        L.new(vc.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = float(s["emit"]) * 2.0
    if s.get("transmission"):
        bsdf.inputs["Transmission Weight"].default_value = float(s["transmission"])
    if s.get("clearcoat"):
        bsdf.inputs["Coat Weight"].default_value = float(s["clearcoat"])
    if s.get("sheen"):
        bsdf.inputs["Sheen Weight"].default_value = float(s["sheen"])
    if s.get("subsurface"):
        bsdf.inputs["Subsurface Weight"].default_value = float(s["subsurface"])
        bsdf.inputs["Subsurface Scale"].default_value = 0.05
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    mat["crystal_surface"] = sid
    return mat


def mean_luminance(img: bpy.types.Image) -> float:
    """Average luminance of an albedo map (the palette colour is multiplied by albedo / mean)."""
    import numpy as np

    try:
        w, h = img.size
        if w * h == 0:
            return 0.5
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(-1, 4)[:: max(1, (w * h) // 65536)]
        return float(max(0.05, (px[:, :3] @ np.array([0.2126, 0.7152, 0.0722])).mean()))
    except Exception:  # noqa: BLE001 — a weird image must not break look-dev
        return 0.5


def blend_material(sid: str, lib: dict, cfg: Config) -> bpy.types.Material:
    """Append a library .blend material and tint it with the palette (vertex colour × its base colour)."""
    name = f"look:{sid}"
    with bpy.data.libraries.load(lib["path"], link=False) as (src, dst):
        if lib["material"] not in src.materials:
            raise ValueError(f"{lib['path']}: no material {lib['material']!r}")
        dst.materials = [lib["material"]]
    mat = dst.materials[0]
    mat.name = name
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = float(cfg.surface(sid).get("texDetail", 0.85))
        inp = bsdf.inputs["Base Color"]
        if inp.links:
            src_sock = inp.links[0].from_socket
            nt.links.remove(inp.links[0])
            # Albedo luminance only, normalised: the palette decides the hue.
            bw = nt.nodes.new("ShaderNodeRGBToBW")
            gain = nt.nodes.new("ShaderNodeMath")
            gain.operation = "MULTIPLY"
            gain.inputs[1].default_value = 2.0
            nt.links.new(src_sock, bw.inputs["Color"])
            nt.links.new(bw.outputs["Val"], gain.inputs[0])
            nt.links.new(gain.outputs["Value"], mul.inputs[7])
        else:
            mul.inputs[7].default_value = (1, 1, 1, 1)
        nt.links.new(vc.outputs["Color"], mul.inputs[6])
        nt.links.new(mul.outputs[2], inp)
    mat["crystal_surface"] = sid
    return mat


def use_look(ob: bpy.types.Object, cfg: Config) -> None:
    """Swap the export materials (crystal:<sid>) for look-dev materials (look:<sid>)."""
    for i, m in enumerate(ob.data.materials):
        sid = m.get("crystal_surface") if m else None
        if sid:
            ob.data.materials[i] = look_material(sid, cfg)


def use_export(ob: bpy.types.Object, cfg: Config) -> None:
    from .surfaces import export_material

    for i, m in enumerate(ob.data.materials):
        sid = m.get("crystal_surface") if m else None
        if sid:
            ob.data.materials[i] = export_material(sid, cfg)
