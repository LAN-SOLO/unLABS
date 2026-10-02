"""Open Blender with Voxel God registered (pnpm voxel:blender [library]).

  blender --python scripts/voxel/blender/open.py -- [devices|doors|airlocks|frames]

Loads .voxel/blend/<library>.blend when given (build it with
`pnpm voxel:verify --blend`).
"""

import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
ROOT = HERE.parents[2]

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if argv:
    lib = ROOT / ".voxel" / "blend" / f"{argv[0]}.blend"
    if lib.exists():
        bpy.ops.wm.open_mainfile(filepath=str(lib))

import voxelgod  # noqa: E402

voxelgod.register()
print("[voxelgod] registered — 3D View › Sidebar (N) › Voxel", flush=True)
