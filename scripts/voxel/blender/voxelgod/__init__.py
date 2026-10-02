"""voxelgod — the game's voxel engine, cloned in Blender (docs/VOXEL-BLENDER.md).

uvox.py (format, no bpy) · build.py (clones) · iso.py (pixel-exact iso
renders) · beauty.py (lit renders, cutaways) · ops.py (exact lattice ops,
primitives, voxelize) · addon.py (UI: 3D View sidebar → Voxel).
"""

bl_info = {
    "name": "Voxel God (_unLABS)",
    "author": "_unLABS",
    "version": (1, 0, 0),
    "blender": (5, 1, 0),
    "location": "3D View › Sidebar › Voxel",
    "description": "Clone, edit, combine and render the game's voxel models voxel for voxel",
    "category": "Import-Export",
}


def register() -> None:
    from . import addon

    addon.register()


def unregister() -> None:
    from . import addon

    addon.unregister()
