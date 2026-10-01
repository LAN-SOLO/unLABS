"""glTF export of one crystal object (geometry, normals, UV, COLOR_0, surface slots)."""

from __future__ import annotations

from pathlib import Path

import bpy


def _supported(**kw) -> dict:
    """Keep only the exporter options this Blender version knows."""
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    return {k: v for k, v in kw.items() if k in props}


def export_glb(ob: bpy.types.Object, path: str | Path) -> int:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    opts = _supported(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=True,
        export_attributes=False,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_draco_mesh_compression_enable=False,
        export_image_format="NONE",
    )
    bpy.ops.export_scene.gltf(**opts)
    return path.stat().st_size
