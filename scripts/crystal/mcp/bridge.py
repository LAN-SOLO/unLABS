"""Crystal bridge — runs INSIDE a Blender GUI session and lets the crystal
MCP server (scripts/crystal/mcp/server.py) drive it.

Start it one of three ways:
  * `pnpm crystal:blender` (or the MCP tool `blender_open`) — launches
    Blender with this script;
  * Blender → Scripting → open this file → Run Script;
  * install scripts/crystal/mcp/unlabs_crystal_addon.py as an add-on.

Security: listens on 127.0.0.1 only, and every request must carry the
random token written to `.crystal/bridge.json` (0600) on start. The bridge
executes Python — never expose the port, never share the token.

Protocol: one JSON object per line → one JSON object per line
  {"token": "...", "cmd": "exec", "args": {...}} → {"ok": true, "result": ...}
Commands run on Blender's main thread (bpy.app.timers), one at a time.
"""

from __future__ import annotations

import base64
import contextlib
import io
import json
import os
import queue
import secrets
import socket
import sys
import threading
import traceback
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE.parent / "blender"))

STATE_FILE = ROOT / ".crystal" / "bridge.json"
_jobs: "queue.Queue[tuple[dict, dict, threading.Event]]" = queue.Queue()
_server: socket.socket | None = None
_ns: dict = {"bpy": bpy}


def _reload_pipeline() -> None:
    import importlib

    for name in sorted([n for n in sys.modules if n == "crystal" or n.startswith("crystal.")], reverse=True):
        importlib.reload(sys.modules[name])


# ── Commands (main thread) ───────────────────────────────────────


def cmd_ping(_: dict) -> dict:
    return {"blender": bpy.app.version_string, "file": bpy.data.filepath, "objects": len(bpy.data.objects)}


def cmd_exec(args: dict) -> dict:
    """Run Python in the session namespace; `result` (if set) is returned."""
    code = args["code"]
    out = io.StringIO()
    _ns.pop("result", None)
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        exec(compile(code, "<mcp>", "exec"), _ns)  # noqa: S102 — the bridge's purpose
    res = _ns.get("result")
    try:
        json.dumps(res)
    except TypeError:
        res = repr(res)
    return {"stdout": out.getvalue()[-20000:], "result": res}


def cmd_load(args: dict) -> dict:
    """Crystallise one model into the scene with look-dev materials and the studio."""
    _reload_pipeline()
    from crystal import look, render
    from crystal.config import Config
    from crystal.dump import load_dump
    from crystal.pipeline import crystallize

    cfg = Config.load()
    dump = load_dump(args["dump"])
    for ob in list(bpy.data.objects):
        if ob.get("crystal_id") or ob.name.startswith("crystal_"):
            bpy.data.objects.remove(ob, do_unlink=True)
    ob, report = crystallize(dump, cfg, ao=args.get("ao", True), shape=args.get("shape"))
    look.use_look(ob, cfg)
    render.stage(ob, yaw=args.get("yaw", 35.0), pitch=args.get("pitch", 24.0))
    render.studio_world(hdri=args.get("hdri"))
    if args.get("voxels"):
        # The original voxels next to it, for comparison.
        from crystal import geometry

        vox = geometry.shell_object(dump, name=f"{dump.id}#voxels")
        vox["crystal_id"] = dump.id
        w = ob.dimensions.x
        vox.location.x = ob.location.x - w * 1.3
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    _frame_view()
    return report


def cmd_render(args: dict) -> dict:
    from crystal import render

    path = args.get("path") or str(ROOT / ".crystal" / "mcp-render.png")
    render.render_still(path, size=int(args.get("size", 768)), samples=int(args.get("samples", 64)))
    return {"path": path, "png": base64.b64encode(Path(path).read_bytes()).decode()}


def cmd_screenshot(args: dict) -> dict:
    """PNG of the 3D viewport (GUI sessions only)."""
    path = str(ROOT / ".crystal" / "mcp-viewport.png")
    win = bpy.context.window_manager.windows[0]
    area = next((a for a in win.screen.areas if a.type == "VIEW_3D"), None)
    if not area:
        raise RuntimeError("no 3D viewport open")
    if args.get("shading"):
        area.spaces[0].shading.type = args["shading"]  # SOLID | MATERIAL | RENDERED
    with bpy.context.temp_override(window=win, area=area):
        bpy.ops.screen.screenshot_area(filepath=path)
    return {"path": path, "png": base64.b64encode(Path(path).read_bytes()).decode()}


def cmd_reload(_: dict) -> dict:
    _reload_pipeline()
    return {"reloaded": True}


COMMANDS = {
    "ping": cmd_ping,
    "exec": cmd_exec,
    "load": cmd_load,
    "render": cmd_render,
    "screenshot": cmd_screenshot,
    "reload": cmd_reload,
}


def _frame_view() -> None:
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type != "VIEW_3D":
                continue
            area.spaces[0].shading.type = "MATERIAL"
            region = next(r for r in area.regions if r.type == "WINDOW")
            with bpy.context.temp_override(window=win, area=area, region=region):
                bpy.ops.view3d.view_selected()


def _pump() -> float:
    """Timer on the main thread: run queued commands."""
    while not _jobs.empty():
        req, resp, done = _jobs.get()
        try:
            fn = COMMANDS.get(req.get("cmd", ""))
            if not fn:
                raise ValueError(f"unknown command {req.get('cmd')!r}")
            resp.update(ok=True, result=fn(req.get("args") or {}))
        except Exception as e:  # noqa: BLE001 — report every failure to the client
            resp.update(ok=False, error=str(e), trace=traceback.format_exc()[-4000:])
        done.set()
    return 0.05


# ── Socket (worker thread) ───────────────────────────────────────


def _handle(conn: socket.socket, token: str) -> None:
    with conn:
        f = conn.makefile("rwb")
        for line in f:
            try:
                req = json.loads(line)
            except json.JSONDecodeError:
                break
            if not secrets.compare_digest(str(req.get("token", "")), token):
                f.write(b'{"ok": false, "error": "bad token"}\n')
                f.flush()
                break
            resp: dict = {}
            done = threading.Event()
            _jobs.put((req, resp, done))
            done.wait(timeout=float(req.get("timeout", 600)))
            if not done.is_set():
                resp = {"ok": False, "error": "timeout (still running in Blender)"}
            f.write((json.dumps(resp) + "\n").encode())
            f.flush()


def _serve(sock: socket.socket, token: str) -> None:
    while True:
        try:
            conn, _ = sock.accept()
        except OSError:
            return
        threading.Thread(target=_handle, args=(conn, token), daemon=True).start()


def start(port: int = 0) -> int:
    global _server
    if _server:
        return _server.getsockname()[1]
    token = secrets.token_urlsafe(24)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", port or int(os.environ.get("CRYSTAL_BRIDGE_PORT", "0"))))
    sock.listen(4)
    _server = sock
    port = sock.getsockname()[1]
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(STATE_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as fh:
        json.dump({"port": port, "token": token, "pid": os.getpid()}, fh)
    threading.Thread(target=_serve, args=(sock, token), daemon=True).start()
    if not bpy.app.timers.is_registered(_pump):
        bpy.app.timers.register(_pump, persistent=True)
    print(f"[crystal-bridge] listening on 127.0.0.1:{port}")
    return port


def stop() -> None:
    global _server
    if _server:
        _server.close()
        _server = None
    with contextlib.suppress(FileNotFoundError):
        STATE_FILE.unlink()


if __name__ == "__main__":
    start()
