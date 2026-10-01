"""One model, end to end: dump → surface → light → slots → GLB (+ preview)."""

from __future__ import annotations

import json
import time
from pathlib import Path

import bpy

from . import geometry, look, render, surfaces
from .config import Config
from .dump import VoxelDump, load_dump
from .export import export_glb


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def crystallize(
    dump: VoxelDump, cfg: Config, *, ao: bool = True, shape: dict | None = None
) -> tuple[bpy.types.Object, dict]:
    """Build the crystal object in the current scene. Returns (object, report).

    ``shape`` overrides profile values for this run (look-dev); a ``profile``
    key in it picks another named profile first.
    """
    t0 = time.time()
    pname, prof = cfg.profile_for(dump.id, dump.family)
    if shape:
        if "profile" in shape:
            pname = shape["profile"]
            prof = dict(cfg.profiles["profiles"][pname])
        prof.update({k: v for k, v in shape.items() if k != "profile"})
    # Triangle budget scales with the model's voxel count (a bolt is not a reactor).
    n_vox = int((dump.labels > 0).sum())
    tpv = float(prof.get("trisPerVoxel", 10))
    prof["maxTris"] = int(min(prof.get("maxTris", 30000), max(prof.get("minTris", 400), n_vox * tpv)))
    from . import overlay

    dump, overlays = overlay.split(dump, cfg.profiles.get("overlays", {}) if prof.get("overlays", True) else {})
    ob = geometry.build_surface(dump, prof)
    t_shape = time.time()
    aoc = cfg.profiles.get("ao", {})
    ao_data = None
    if ao:
        render.gpu_on()
        ao_data = surfaces.bake_ao(ob, int(aoc.get("samples", 64)), float(aoc.get("distance", 2.0)) * 1.0)
    surfaces.write_colors(ob, cfg, ao_data, overlays, dump.unit)
    if dump.meta.get("crop"):
        geometry.crop(ob, dump.meta["crop"], dump.unit)
    surfaces.box_uv(ob, float(cfg.profiles.get("uvScale", 0.25)))
    sids = surfaces.fold_to_surfaces(ob, cfg, dump.id)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    report = {
        "id": dump.id,
        "key": dump.key,
        "family": dump.family,
        "profile": pname,
        "surfaces": sids,
        "tris": tris,
        "verts": len(ob.data.vertices),
        "seconds": {"shape": round(t_shape - t0, 2), "total": round(time.time() - t0, 2)},
    }
    return ob, report


def build_one(
    dump_path: str | Path,
    out_glb: str | Path | None,
    preview: str | Path | None = None,
    *,
    cfg: Config | None = None,
    ao: bool = True,
    preview_size: int = 768,
    preview_samples: int = 96,
    shape: dict | None = None,
) -> dict:
    cfg = cfg or Config.load()
    reset_scene()
    dump = load_dump(dump_path)
    ob, report = crystallize(dump, cfg, ao=ao, shape=shape)
    if out_glb:
        report["bytes"] = export_glb(ob, out_glb)
        report["glb"] = str(out_glb)
    if preview:
        look.use_look(ob, cfg)
        render.stage(ob)
        render.render_still(preview, size=preview_size, samples=preview_samples)
        look.use_export(ob, cfg)
        report["preview"] = str(preview)
    print("[crystal] " + json.dumps(report))
    return report
