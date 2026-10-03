"""voxelgod command line (headless Blender).

  blender -b --factory-startup -P scripts/voxel/blender/cli.py -- verify [--only CDC-001,d_mcp] [--blend]
  blender -b --factory-startup -P scripts/voxel/blender/cli.py -- beauty --only CDC-001 [--views 4]

verify: for every model in .voxel/inventory.json
  1. clone the uvox in Blender (shell + volume),
  2. read the clone's volume back and compare the sha (voxel-exact, inside too),
  3. render the clone with the iso-baker rules and compare it pixel by pixel
     with the game's reference picture (= the undevbook's picture),
  4. for assemblies (doors, airlock): clone every placed part and check each.
Writes .voxel/verify.json, .voxel/blender/iso/<kind>/<id>.png and, with
--blend, .voxel/blend/<kind>s.blend (the clone library).

beauty: lit Cycles renders of clones (several views + a cutaway through the
middle that shows the inside) → .voxel/blender/beauty/<id>/*.png
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from voxelgod import beauty, build, hero, iso, ops, uvox  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
VOX = ROOT / ".voxel"


def _inventory(only: list[str] | None) -> list[dict]:
    inv = json.loads((VOX / "inventory.json").read_text())["models"]
    return [e for e in inv if not only or any(e["id"].startswith(p) for p in only)]


def _reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def cmd_verify(a: argparse.Namespace) -> int:
    only = a.only.split(",") if a.only else None
    entries = _inventory(only)
    report: list[dict] = []
    t0 = time.time()
    libs: dict[str, list[dict]] = {}
    for e in entries:
        libs.setdefault(e["kind"], []).append(e)
    for kind, group in libs.items():
        _reset()
        lib = bpy.data.collections.new(f"{kind}s")
        bpy.context.scene.collection.children.link(lib)
        for e in group:
            r: dict = {"id": e["id"], "kind": kind, "voxels": e["voxels"]}
            m = uvox.load(VOX / e["uvox"])
            assert isinstance(m, uvox.Uvox)
            coll = bpy.data.collections.new(e["id"])
            lib.children.link(coll)
            shell = build.clone(m, coll)
            back = build.read_back(shell)
            r["sha"] = m.sha
            r["sha_clone"] = back.sha
            r["voxel_exact"] = back.sha == m.sha and bool((back.grid == m.grid).all())
            r["faces"] = len(shell.data.polygons)
            if e.get("scene"):
                parts = uvox.load(VOX / e["scene"])
                assert isinstance(parts, list)
                ok = 0
                pc = bpy.data.collections.new(f"{e['id']} (parts)")
                lib.children.link(pc)
                for p in parts:
                    ps = build.clone(p, pc)
                    ok += int(build.read_back(ps).sha == p.sha)
                r["parts"] = len(parts)
                r["parts_exact"] = ok
            # Iso picture: hide the library while the iso mesh renders.
            lib.hide_render = True
            out = VOX / "blender/iso" / f"{kind}s" / f"{e['id']}.png"
            got = iso.render_iso(m, int(e["scale"]), out)
            lib.hide_render = False
            ref = iso.load_png(VOX / e["ref"])
            r["vs_ref"] = iso.compare(got, ref)
            if e.get("book"):
                r["vs_book"] = iso.compare(got, iso.load_png(Path(e["book"])))
            r["pixel_exact"] = r["vs_ref"].get("pixels_differ", -1) == 0
            report.append(r)
            flag = "OK " if r["voxel_exact"] and r["pixel_exact"] and r.get("parts_exact", 0) == r.get("parts", 0) else "BAD"
            print(
                f"[verify] {flag} {kind:7s} {e['id']:24s} voxels {e['voxels']:>7d} faces {r['faces']:>7d} "
                f"sha {'=' if r['voxel_exact'] else '≠'} pixels≠ {r['vs_ref'].get('pixels_differ', 'size')}"
                + (f" parts {r['parts_exact']}/{r['parts']}" if "parts" in r else ""),
                flush=True,
            )
        if a.blend:
            (VOX / "blend").mkdir(parents=True, exist_ok=True)
            bpy.ops.wm.save_as_mainfile(filepath=str(VOX / "blend" / f"{kind}s.blend"), compress=True)
    summary = {
        "models": len(report),
        "voxel_exact": sum(r["voxel_exact"] for r in report),
        "pixel_exact": sum(r["pixel_exact"] for r in report),
        "parts": sum(r.get("parts", 0) for r in report),
        "parts_exact": sum(r.get("parts_exact", 0) for r in report),
        "seconds": round(time.time() - t0, 1),
    }
    out = VOX / ("verify.json" if not only else "verify.partial.json")
    out.write_text(json.dumps({"summary": summary, "models": report}, indent=1))
    print(f"[verify] {json.dumps(summary)}", flush=True)
    return 0


def cmd_selftest(_a: argparse.Namespace) -> int:
    """Python ops vs the TypeScript reference (lib/voxel/uvox.ts) on real models."""
    fx = json.loads((VOX / "fixtures/expect.json").read_text())
    a = uvox.load(VOX / fx["a"])
    b = uvox.load(VOX / fx["b"])
    got = {
        "rot1": ops.rotate_y90(a, 1).sha,
        "rot2": ops.rotate_y90(a, 2).sha,
        "rot3": ops.rotate_y90(a, 3).sha,
        "mirrorX": ops.mirror(a, "x").sha,
        "mirrorY": ops.mirror(a, "y").sha,
        "mirrorZ": ops.mirror(a, "z").sha,
        "up3": ops.upsample(a, 3).sha,
        "combine": ops.combine([a, uvox.Uvox(**{**b.__dict__, "origin": (1.75, 0.5, -0.25)})]).sha,
    }
    bad = 0
    for k, want in fx["expect"].items():
        ok = got[k] == want
        bad += not ok
        print(f"[selftest] {'OK ' if ok else 'BAD'} {k:8s} {got[k]} {'==' if ok else '!='} {want}", flush=True)
    # Lossless inverses and invariants.
    checks = {
        "rot4=id": ops.rotate_y90(a, 4).sha == a.sha,
        "rot1∘rot3=id": ops.rotate_y90(ops.rotate_y90(a, 1), 3).sha == a.sha,
        "mirror²=id": ops.mirror(ops.mirror(a, "x"), "x").sha == a.sha,
        "down(up(a,2),2)=a": ops.downsample(ops.upsample(a, 2), 2).sha == a.sha,
        "uvox json round trip": uvox.from_json(a.to_json()).sha == a.sha,
    }
    for k, ok in checks.items():
        bad += not ok
        print(f"[selftest] {'OK ' if ok else 'BAD'} {k}", flush=True)
    print(f"[selftest] {'all passed' if not bad else f'{bad} failed'}", flush=True)
    return 1 if bad else 0


def cmd_beauty(a: argparse.Namespace) -> int:
    """Lit renders of every side + a voxel cutaway (the inside)."""
    only = a.only.split(",") if a.only else None
    for e in _inventory(only):
        if a.kind and e["kind"] != a.kind:
            continue
        _reset()
        beauty.setup(samples=a.samples, size=a.size)
        out = VOX / "blender/beauty" / (e["id"] if e["kind"] != "device-detail" else f"{e['id']}.detail")
        if e.get("scene"):
            parts = uvox.load(VOX / e["scene"])
            coll = bpy.data.collections.new(e["id"])
            bpy.context.scene.collection.children.link(coll)
            objs = [build.clone(p, coll) for p in parts]
            files = beauty.render_views(objs, out)
            m = uvox.load(VOX / e["uvox"])
            for o in objs:
                o.hide_render = True
            cs = build.clone(beauty.cut(m), coll)
            files += beauty.render_views([cs], out, {"cutaway": (25, 24)})
        else:
            files = beauty.render_model(uvox.load(VOX / e["uvox"]), out)
        print(f"[beauty] {e['id']}: {len(files)} views", flush=True)
    return 0


def cmd_hero(a: argparse.Namespace) -> int:
    """Product-shot renders (hero.py) of the detailed devices → .voxel/blender/hero/<id>/."""
    only = a.only.split(",") if a.only else None
    shots = {k: v for k, v in hero.SHOTS.items() if not a.shots or k in a.shots.split(",")}
    for e in _inventory(only):
        if e["kind"] != a.kind:
            continue
        out = VOX / "blender/hero" / e["id"]
        if a.skip_done and all((out / f"{k}.png").exists() for k in shots):
            continue
        t0 = time.time()
        _reset()
        hero.setup(samples=a.samples)
        if a.scale != 100:
            bpy.context.scene.render.resolution_percentage = a.scale
        files = hero.render_model(uvox.load(VOX / e["uvox"]), out, shots)
        print(f"[hero] {e['id']}: {len(files)} shots in {time.time() - t0:.0f} s", flush=True)
    return 0


def cmd_uitest(_a: argparse.Namespace) -> int:
    """Drive every Voxel God operator headless and check the results are voxel-exact."""
    import numpy as np

    import voxelgod

    _reset()
    voxelgod.register()
    O = bpy.ops.voxelgod
    vl = bpy.context.view_layer
    fails = []

    def check(name: str, ok: bool) -> None:
        print(f"[uitest] {'OK ' if ok else 'BAD'} {name}", flush=True)
        if not ok:
            fails.append(name)

    def only(*obs) -> None:
        bpy.ops.object.select_all(action="DESELECT")
        for o in obs:
            o.select_set(True)
        vl.objects.active = obs[-1]

    def shells():
        return [o for o in bpy.data.objects if "uvox_id" in o]

    def by_id(i: str):
        return next(o for o in shells() if o["uvox_id"] == i)

    # Import a real device, export it again: identical voxels.
    src = VOX / "models/devices/CDC-001.uvox.json"
    O.import_uvox(filepath=str(src))
    dev = by_id("CDC-001")
    only(dev)
    out = VOX / "uitest/CDC-001.uvox.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    O.export_uvox(filepath=str(out))
    check("import → export keeps every voxel", uvox.load(out).sha == uvox.load(src).sha)

    # Primitives in game colours (steel = 4 is a solid grey; any index works).
    cur = bpy.context.scene.cursor
    cur.location = (0, 0, 0)
    O.primitive(shape="BOX", sx=4, sy=2, sz=3, unit=0.5, color="4")
    box = by_id("box")
    check(f"box 4×2×3 = 24 voxels ({build.info(box)['voxels']})", build.info(box)["voxels"] == 24)
    cur.location = (2.0, 0.0, 0.5)  # Blender (x, y, z) → game origin (2.0, 0.5, −0.0)
    O.primitive(shape="SPHERE", sx=6, unit=0.25, color="4")
    sph = by_id("sphere")
    g = build.read_back(sph).grid
    check("sphere is symmetric", bool((g == g[::-1]).all() and (g == g[:, :, ::-1]).all()))

    # Combine two sizes exactly.
    only(box, sph)
    O.combine(name="mix")
    mix = by_id("mix")
    mi = build.info(mix)
    check(f"combine: finest unit wins ({mi['unit']})", abs(mi["unit"] - 0.25) < 1e-9)
    check(f"combine: 24 coarse → 192 fine + sphere ({mi['voxels']})", mi["voxels"] == 24 * 8 + int((g > 0).sum()))

    # Resize exact both ways.
    only(box)
    O.resize(mode="UP", k=2)
    box = by_id("box")
    check(f"upsample ×2: 192 voxels ({build.info(box)['voxels']})", build.info(box)["voxels"] == 192)
    only(box)
    O.resize(mode="DOWN", k=2)
    box = by_id("box")
    check("downsample ×2: back to 24", build.info(box)["voxels"] == 24)

    # Turns.
    only(box)
    O.turn(action="R90")
    box = by_id("box")
    check(f"turn 90°: 4×2×3 → 3×2×4 ({list(build.info(box)['size'])})", list(build.info(box)["size"]) == [3, 2, 4])

    # Paint: select half the volume, paint it red (palette 'safety_red').
    pal = {p["name"]: p["index"] for p in json.loads((VOX / "palette.json").read_text())}
    vol = build.volume_of(box)
    sel = np.zeros(len(vol.data.vertices), dtype=bool)
    sel[::2] = True
    vol.data.vertices.foreach_set("select", sel)
    vol.hide_set(False)
    only(vol)
    O.paint(color=str(pal["safety_red"]))
    gb = build.read_back(box).grid
    check("paint: half the voxels red", int((gb == pal["safety_red"]).sum()) == int(sel.sum()))

    # Add a voxel by moving a volume vertex outside, snap: grid grows by one cell.
    vol = build.volume_of(box)
    vol.data.vertices[0].co.x = -0.5
    only(box)
    O.snap()
    box = by_id("box")
    check(f"snap: grid grows to hold the moved voxel ({list(build.info(box)['size'])})", build.info(box)["size"][0] == 4)

    # Voxelize a closed mesh (a 1 m cube) at 0.25: exactly 4×4×4.
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(10.0, 0.0, 0.5))
    cube = bpy.context.active_object
    O.voxelize(unit=0.25, color="4")
    vox = by_id(cube.name)
    check(f"voxelize 1 m cube @ 0.25 = 64 voxels ({build.info(vox)['voxels']})", build.info(vox)["voxels"] == 64)

    print(f"[uitest] {'all passed' if not fails else f'{len(fails)} failed: ' + ', '.join(fails)}", flush=True)
    _ = cube
    return 1 if fails else 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="voxelgod")
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("verify")
    v.add_argument("--only")
    v.add_argument("--blend", action="store_true")
    sub.add_parser("selftest")
    sub.add_parser("uitest")
    b = sub.add_parser("beauty")
    b.add_argument("--only")
    b.add_argument("--samples", type=int, default=64)
    b.add_argument("--size", type=int, default=900)
    b.add_argument("--kind", help="only this inventory kind (device, device-detail, door, airlock)")
    hr = sub.add_parser("hero")
    hr.add_argument("--only")
    hr.add_argument("--shots", help="comma list of hero.SHOTS names")
    hr.add_argument("--samples", type=int, default=384)
    hr.add_argument("--scale", type=int, default=100, help="resolution % (previews)")
    hr.add_argument("--kind", default="device-detail")
    hr.add_argument("--skip-done", action="store_true")
    a = ap.parse_args(argv)
    return {"verify": cmd_verify, "selftest": cmd_selftest, "beauty": cmd_beauty, "hero": cmd_hero, "uitest": cmd_uitest}[a.cmd](a)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    sys.exit(main(argv))
