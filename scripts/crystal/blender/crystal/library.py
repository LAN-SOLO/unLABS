"""Material library helpers that need Blender: .blend asset listing and
engine texture export (library maps → public/crystal/textures/<surface>/)."""

from __future__ import annotations

import json
from pathlib import Path

import bpy
import numpy as np

from .config import PUBLIC_DIR, Config


def list_blend_assets(files: list[str]) -> None:
    """Print one `[crystal-asset] {...}` line per material in each .blend."""
    for f in files:
        try:
            with bpy.data.libraries.load(f, link=False, assets_only=False) as (src, _):
                names = list(src.materials)
            with bpy.data.libraries.load(f, link=False, assets_only=True) as (asrc, _):
                assets = set(asrc.materials)
        except Exception as e:  # noqa: BLE001 — skip unreadable files
            print(f"[crystal] skip {f}: {e}")
            continue
        for n in names:
            if n.startswith(("Dots Stroke", "Material")) and n not in assets:
                continue  # Blender defaults
            print("[crystal-asset] " + json.dumps({"file": f, "material": n, "asset": n in assets}))


def _save_scaled(path: str, out: Path, size: int, *, srgb: bool, flip_green: bool = False) -> None:
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    if img.size[0] != size or img.size[1] != size:
        img.scale(size, size)
    if flip_green:
        px = np.empty(size * size * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(-1, 4)
        px[:, 1] = 1.0 - px[:, 1]
        img.pixels.foreach_set(px.ravel())
    out.parent.mkdir(parents=True, exist_ok=True)
    img.filepath_raw = str(out)
    img.file_format = "JPEG"
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 88
    img.save_render(str(out), scene=scene)
    bpy.data.images.remove(img)


def export_textures(cfg: Config, *, size: int = 1024, only: set[str] | None = None) -> None:
    """Every surface bound to a texture-set entry: tileable maps for the engine."""
    for sid in cfg.surfaces["surfaces"]:
        if only and sid not in only:
            continue
        lib = cfg.library_entry(sid)
        dst = PUBLIC_DIR / "textures" / sid
        if not lib or lib.get("kind") != "textures":
            continue
        maps = lib.get("maps", {})
        done = []
        if maps.get("normal"):
            _save_scaled(maps["normal"], dst / "normal.jpg", size, srgb=False, flip_green=bool(lib.get("normalDX")))
            done.append("normal")
        if maps.get("roughness"):
            _save_scaled(maps["roughness"], dst / "rough.jpg", size, srgb=False)
            done.append("roughness")
        if maps.get("albedo") and cfg.surface(sid).get("texAlbedo", False):
            _save_scaled(maps["albedo"], dst / "albedo.jpg", size, srgb=True)
            done.append("albedo")
        print(f"[crystal] textures {sid}: {', '.join(done) or 'none'} ← {lib['id']}")
