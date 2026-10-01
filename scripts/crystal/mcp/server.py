# /// script
# requires-python = ">=3.11"
# dependencies = ["mcp>=1.6,<2"]
# ///
"""unlabs-crystal — MCP server for the crystal pipeline (docs/CRYSTAL.md).

Gives Claude hands on Blender and the pipeline:

  * look-dev in a live Blender (`blender_open`, `crystal_load`,
    `crystal_render`, `blender_screenshot`, `blender_exec`) through the
    bridge (scripts/crystal/mcp/bridge.py: 127.0.0.1 + token);
  * headless previews without a Blender window (`crystal_preview`);
  * the pipeline's config — shape profiles, surface bindings, per-model
    overrides (`crystal_config`, `crystal_set_surface`, `crystal_bind`,
    `crystal_set_profile`, `crystal_override`);
  * the material library (`library_scan`, `library_search`, `library_assign`,
    `library_textures`);
  * builds (`crystal_export`, `crystal_build`) and the inventory
    (`crystal_status`, `crystal_find`).

Registered in .mcp.json as `crystal` (run: `uv run --script scripts/crystal/mcp/server.py`).
"""

from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import time
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP, Image

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / ".crystal"
CONFIG = ROOT / "scripts" / "crystal" / "config"
CLI = ROOT / "scripts" / "crystal" / "blender" / "cli.py"
BRIDGE = ROOT / "scripts" / "crystal" / "mcp" / "bridge.py"
CATALOG = WORK / "library" / "catalog.json"
MANIFEST = ROOT / "public" / "crystal" / "manifest.json"

mcp = FastMCP(
    "crystal",
    instructions=(
        "Crystal pipeline of _unLABS: voxel models → real rendered surfaces (Blender). "
        "Load the `crystal` skill (.claude/skills/crystal/SKILL.md) before look-dev. "
        "Models are found by use id prefix (dev-CDC-001/base, bot-b4c0n, decor-…, terrain-f0-…) or grid key."
    ),
)


def blender_bin() -> str:
    if os.environ.get("BLENDER"):
        return os.environ["BLENDER"]
    mac = "/Applications/Blender.app/Contents/MacOS/Blender"
    return mac if Path(mac).exists() else "blender"


def _json(path: Path, default: Any = None) -> Any:
    return json.loads(path.read_text()) if path.exists() else default


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n")


# ── Inventory ────────────────────────────────────────────────────


def _inventory() -> list[dict]:
    inv = _json(WORK / "inventory.json")
    if not inv:
        raise RuntimeError("No .crystal/inventory.json — run crystal_export first.")
    return inv["models"]


def _resolve(model: str) -> dict:
    """Model by grid key, dump file name, exact use id, or use-id prefix (first match)."""
    models = _inventory()
    for m in models:
        if model in (m["key"], m["file"]) or model in m["uses"]:
            return m
    hits = [m for m in models if any(u.startswith(model) for u in m["uses"])]
    if not hits:
        raise ValueError(f"no model matches {model!r} (try crystal_find)")
    return hits[0]


@mcp.tool()
def crystal_status() -> dict:
    """Pipeline state: inventory size, manifest (built models, tris, MB), library, bridge."""
    inv = _json(WORK / "inventory.json", {"models": []})["models"]
    man = _json(MANIFEST, {"models": {}})
    models = man.get("models", {})
    cat = _json(CATALOG, {"entries": {}})
    fam: dict[str, int] = {}
    for m in inv:
        fam[m["family"]] = fam.get(m["family"], 0) + 1
    return {
        "inventory": {"models": len(inv), "families": fam},
        "manifest": {
            "models": len(models),
            "tris": sum(m["tris"] for m in models.values()),
            "mb": round(sum(m["bytes"] for m in models.values()) / 1048576, 1),
            "missing": len([m for m in inv if m["key"] not in models]),
        },
        "library": {"entries": len(cat.get("entries", {})), "roots": cat.get("roots", [])},
        "bridge": _bridge_state(),
        "blender": blender_bin(),
    }


@mcp.tool()
def crystal_find(query: str, limit: int = 25) -> list[dict]:
    """Search models by use id (substring or regex), e.g. 'CDC-001', 'bot-', 'decor-lamp', 'terrain-f2'."""
    try:
        rx = re.compile(query, re.I)
        match = lambda u: bool(rx.search(u))  # noqa: E731
    except re.error:
        match = lambda u: query.lower() in u.lower()  # noqa: E731
    man = _json(MANIFEST, {"models": {}}).get("models", {})
    out = []
    for m in _inventory():
        uses = [u for u in m["uses"] if match(u)]
        if not uses:
            continue
        built = man.get(m["key"])
        out.append(
            {
                "use": uses[0],
                "uses": len(m["uses"]),
                "key": m["key"],
                "family": m["family"],
                "size": m["size"],
                "voxels": m["voxels"],
                "built": bool(built),
                **({"tris": built["tris"], "profile": built["profile"]} if built else {}),
            }
        )
        if len(out) >= limit:
            break
    return out


# ── Bridge (live Blender) ────────────────────────────────────────


def _bridge_state() -> dict:
    st = _json(WORK / "bridge.json")
    if not st:
        return {"running": False}
    try:
        with socket.create_connection(("127.0.0.1", st["port"]), timeout=1):
            return {"running": True, "port": st["port"], "pid": st.get("pid")}
    except OSError:
        return {"running": False, "stale": True}


def _call(cmd: str, args: dict | None = None, timeout: float = 600) -> Any:
    st = _json(WORK / "bridge.json")
    if not st:
        raise RuntimeError("Blender bridge not running — call blender_open first.")
    with socket.create_connection(("127.0.0.1", st["port"]), timeout=timeout) as s:
        s.sendall((json.dumps({"token": st["token"], "cmd": cmd, "args": args or {}, "timeout": timeout}) + "\n").encode())
        f = s.makefile("rb")
        line = f.readline()
    resp = json.loads(line)
    if not resp.get("ok"):
        raise RuntimeError(f"{resp.get('error')}\n{resp.get('trace', '')}")
    return resp["result"]


@mcp.tool()
def blender_open(blend_file: str | None = None) -> dict:
    """Launch Blender (GUI) with the crystal bridge, or reuse a running one."""
    if _bridge_state().get("running"):
        return {"reused": True, **_call("ping")}
    (WORK / "bridge.json").unlink(missing_ok=True)
    args = [blender_bin()]
    if blend_file:
        args.append(blend_file)
    args += ["--python", str(BRIDGE)]
    subprocess.Popen(args, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(120):
        time.sleep(0.5)
        if _bridge_state().get("running"):
            return {"started": True, **_call("ping")}
    raise RuntimeError("Blender did not start the bridge within 60 s")


@mcp.tool()
def blender_exec(code: str) -> dict:
    """Run Python inside the live Blender session (bpy available; set `result` to return a value)."""
    return _call("exec", {"code": code})


@mcp.tool()
def blender_screenshot(shading: str | None = None) -> Image:
    """Screenshot of the 3D viewport. shading: SOLID | MATERIAL | RENDERED (optional)."""
    r = _call("screenshot", {"shading": shading} if shading else {})
    return Image(path=r["path"])


@mcp.tool()
def crystal_load(
    model: str,
    profile: str | None = None,
    shape: dict | None = None,
    voxels: bool = False,
    hdri: str | None = None,
    yaw: float = 35,
    pitch: float = 24,
) -> dict:
    """Crystallise a model into the live Blender scene (look-dev materials, studio, camera).

    model: use id / prefix / key. profile: named shape profile to try. shape: profile value
    overrides for this load only (e.g. {"blur": 0.8}). voxels: also place the source voxels
    beside it. hdri: library HDRI path for the studio.
    """
    m = _resolve(model)
    sh = dict(shape or {})
    if profile:
        sh["profile"] = profile
    return _call(
        "load",
        {
            "dump": str(WORK / "dumps" / m["file"]),
            "shape": sh or None,
            "voxels": voxels,
            "hdri": hdri,
            "yaw": yaw,
            "pitch": pitch,
        },
    )


@mcp.tool()
def crystal_render(size: int = 768, samples: int = 64) -> Image:
    """Cycles still of the live scene (camera from crystal_load)."""
    r = _call("render", {"size": size, "samples": samples})
    return Image(path=r["path"])


# ── Headless ─────────────────────────────────────────────────────


def _headless_preview(m: dict, shape: dict | None, size: int, samples: int, out: Path) -> dict:
    args = [
        blender_bin(), "-b", "--factory-startup", "-P", str(CLI), "--", "build",
        "--dump", str(WORK / "dumps" / m["file"]), "--preview", str(out),
        "--size", str(size), "--samples", str(samples),
    ]  # fmt: skip
    if shape:
        args += ["--shape", json.dumps(shape)]
    res = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=900)
    reports = [json.loads(l[10:]) for l in res.stdout.splitlines() if l.startswith("[crystal] ")]
    if not out.exists():
        raise RuntimeError((res.stdout + res.stderr)[-3000:])
    return reports[-1] if reports else {}


@mcp.tool()
def crystal_preview(
    model: str,
    profile: str | None = None,
    shape: dict | None = None,
    size: int = 640,
    samples: int = 48,
) -> list:
    """Headless Cycles preview of one model (no Blender window needed). Returns [report, image]."""
    m = _resolve(model)
    sh = dict(shape or {})
    if profile:
        sh["profile"] = profile
    out = WORK / "mcp" / f"preview-{int(time.time() * 1000)}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    rep = _headless_preview(m, sh or None, size, samples, out)
    return [json.dumps(rep), Image(path=str(out))]


# ── Config ───────────────────────────────────────────────────────


@mcp.tool()
def crystal_config(section: str = "all") -> dict:
    """Read the pipeline config: 'profiles', 'surfaces', 'overrides' or 'all'."""
    files = {"profiles": "profiles.json", "surfaces": "surfaces.json", "overrides": "overrides.json"}
    keys = files if section == "all" else {section: files[section]}
    return {k: _json(CONFIG / f, {}) for k, f in keys.items()}


@mcp.tool()
def crystal_set_surface(surface: str, props: dict) -> dict:
    """Create / update a crystal surface (metal, rough, relief, wear, emit, transmission, clearcoat,
    sheen, subsurface, library, texScale, texDetail, texAlbedo). null values delete keys."""
    data = _json(CONFIG / "surfaces.json")
    s = data["surfaces"].setdefault(surface, {})
    for k, v in props.items():
        if v is None:
            s.pop(k, None)
        else:
            s[k] = v
    _write_json(CONFIG / "surfaces.json", data)
    return {surface: s}


@mcp.tool()
def crystal_bind(color: str, surface: str, model: str | None = None) -> dict:
    """Bind a palette colour name to a surface — globally (new first rule) or for one model only."""
    if model:
        m = _resolve(model)
        ov = _json(CONFIG / "overrides.json", {"models": {}})
        ov.setdefault("models", {}).setdefault(m["uses"][0], {}).setdefault("surfaces", {})[color] = surface
        _write_json(CONFIG / "overrides.json", ov)
        return {"model": m["uses"][0], color: surface}
    data = _json(CONFIG / "surfaces.json")
    if surface not in data["surfaces"]:
        raise ValueError(f"unknown surface {surface!r}")
    rule = {"match": f"^{re.escape(color)}$", "surface": surface}
    data["bindings"] = [r for r in data["bindings"] if r.get("match") != rule["match"]]
    data["bindings"].insert(0, rule)
    _write_json(CONFIG / "surfaces.json", data)
    return {"rule": rule}


@mcp.tool()
def crystal_set_profile(name: str, props: dict, family: str | None = None) -> dict:
    """Create / update a shape profile (mode, cell, blur, thinBlur, thinGain, sharpClasses, sharpBevel,
    colorBlur, planar, sharpAngle, maxTris, trisPerVoxel, …); optionally make it a family's default."""
    data = _json(CONFIG / "profiles.json")
    p = data["profiles"].setdefault(name, {})
    p.update({k: v for k, v in props.items() if v is not None})
    if family:
        data["families"][family] = name
    _write_json(CONFIG / "profiles.json", data)
    return {name: p, **({"family": {family: name}} if family else {})}


@mcp.tool()
def crystal_override(model: str, profile: str | None = None, shape: dict | None = None) -> dict:
    """Per-model override: another profile and/or shape values (applies to every use of that grid)."""
    m = _resolve(model)
    ov = _json(CONFIG / "overrides.json", {"models": {}})
    e = ov.setdefault("models", {}).setdefault(m["uses"][0], {})
    if profile:
        e["profile"] = profile
    if shape:
        e.setdefault("shape", {}).update(shape)
    _write_json(CONFIG / "overrides.json", ov)
    return {m["uses"][0]: e}


# ── Library ──────────────────────────────────────────────────────


@mcp.tool()
def library_scan(roots: list[str] | None = None, blend: bool = False) -> str:
    """Scan the material library (texture sets, HDRIs, optionally .blend materials) into the catalog.
    roots are remembered in .crystal/library/roots.json."""
    if roots:
        (WORK / "library").mkdir(parents=True, exist_ok=True)
        cur = _json(WORK / "library" / "roots.json", {"roots": []})
        cur["roots"] = sorted(set(cur["roots"]) | set(roots))
        _write_json(WORK / "library" / "roots.json", cur)
    args = ["uv", "run", "--script", str(ROOT / "scripts" / "crystal" / "library" / "scan.py")]
    if blend:
        args.append("--blend")
    res = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=1800)
    return (res.stdout + res.stderr)[-4000:]


@mcp.tool()
def library_search(query: str, kind: str | None = None, limit: int = 30) -> list[dict]:
    """Search the library catalog (words match name / tags / path; kind: textures | hdri | blend)."""
    cat = _json(CATALOG)
    if not cat:
        raise RuntimeError("No library catalog — run library_scan first.")
    words = [w.lower() for w in query.split()]
    scored = []
    for e in cat["entries"].values():
        if kind and e["kind"] != kind:
            continue
        hay = " ".join([e["name"].lower(), " ".join(e.get("tags", [])), e["id"].lower()])
        score = sum(hay.count(w) for w in words)
        if score:
            scored.append((score, e))
    scored.sort(key=lambda t: -t[0])
    return [
        {"id": e["id"], "kind": e["kind"], "name": e["name"], "maps": sorted(e.get("maps", {})), "resolution": e.get("resolution")}
        for _, e in scored[:limit]
    ]


@mcp.tool()
def library_assign(surface: str, entry: str | None, tex_scale: float | None = None, tex_detail: float | None = None) -> dict:
    """Use a library entry (id from library_search) for a crystal surface (None = procedural fallback).
    tex_scale: texture repeats per source voxel ×4 (default 1); tex_detail: albedo detail mix 0..1."""
    cat = _json(CATALOG, {"entries": {}})
    if entry and entry not in cat["entries"]:
        raise ValueError(f"unknown library entry {entry!r}")
    props: dict[str, Any] = {"library": entry}
    if tex_scale is not None:
        props["texScale"] = tex_scale
    if tex_detail is not None:
        props["texDetail"] = tex_detail
    return crystal_set_surface(surface, props)


@mcp.tool()
def library_textures(surfaces: list[str] | None = None, size: int = 1024) -> str:
    """Export the bound library maps as tileable engine textures (public/crystal/textures/<surface>/)."""
    args = [blender_bin(), "-b", "--factory-startup", "-P", str(CLI), "--", "textures", "--size", str(size)]
    if surfaces:
        args += ["--only", ",".join(surfaces)]
    res = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=1800)
    return "\n".join(l for l in res.stdout.splitlines() if l.startswith("[crystal]"))[-4000:] or res.stderr[-2000:]


# ── Builds ───────────────────────────────────────────────────────


def _pnpm(args: list[str], timeout: int) -> str:
    res = subprocess.run(["pnpm", *args], cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    out = (res.stdout + res.stderr).replace("\r", "\n")
    lines = [l for l in out.splitlines() if l.strip() and "WARN" not in l]
    return "\n".join(lines[-25:])


@mcp.tool()
def crystal_export() -> str:
    """Re-dump every model grid + terrain chunk from the game sources (.crystal/inventory.json)."""
    return _pnpm(["crystal:export"], 900)


@mcp.tool()
def crystal_build(only: str | None = None, force: bool = False, previews: bool = False, workers: int | None = None) -> str:
    """Build changed models → public/crystal (GLB + manifest). only: comma-separated use-id prefixes."""
    args = ["crystal:build"]
    if only:
        args += ["--only", only]
    if force:
        args.append("--force")
    if previews:
        args.append("--previews")
    if workers:
        args += ["--workers", str(workers)]
    return _pnpm(args, 7200)


if __name__ == "__main__":
    mcp.run()
