"""Trailer shots (docs/TRAILERS.md). One function per shot, registered in SHOTS.

A shot function receives a Ctx (format, fps, frame count, camera rig) after
the scene was reset and the look set up; it loads its sets, keys the camera
for both formats and keys every light / glow / effect. Frames are 1 … n.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

import bpy
from mathutils import Vector

import font
import fx
import lab

V = Vector


@dataclass
class Ctx:
    fmt: str  # "h" 16:9 · "v" 9:16
    fps: int
    n: int  # frames
    rig: fx.Rig

    def f(self, sec: float) -> int:
        """Seconds → frame (1-based)."""
        return max(1, int(round(sec * self.fps)) + 1)

    @property
    def vertical(self) -> bool:
        return self.fmt == "v"


@dataclass
class Shot:
    trailer: str
    id: str
    seconds: float
    build: Callable[[Ctx], None]
    note: str = ""


SHOTS: list[Shot] = []


def shot(trailer: str, sid: str, seconds: float, note: str = "") -> Callable[[Callable[[Ctx], None]], Callable[[Ctx], None]]:
    def deco(fn: Callable[[Ctx], None]) -> Callable[[Ctx], None]:
        SHOTS.append(Shot(trailer, sid, seconds, fn, note))
        return fn

    return deco


def shots_of(trailer: str) -> list[Shot]:
    return [s for s in SHOTS if s.trailer == trailer]


# ── Shared pieces ──────────────────────────────────────────────────

GREEN = (0.32, 1.0, 0.45)
AMBER = (1.0, 0.62, 0.18)
ORANGE = (0.91, 0.39, 0.17)
BONE = (0.93, 0.91, 0.86)
CERULEAN = (0.25, 0.62, 1.0)


def terminal(c: Ctx, lines: list[tuple[float, str]], color: tuple[float, float, float] = GREEN, per_char: float = 1.6, size: float = 0.05) -> None:
    """Black screen, CRT-green voxel text typed line by line, slow push in.

    `lines` = (start second, text). A block cursor blinks after the last line.
    """
    lab.world(0.0, (0.0, 0.0, 0.0))
    if c.vertical:
        # 9:16: wrap long lines at word boundaries (same timing per source line).
        wrapped: list[tuple[float, str]] = []
        for t0, txt in lines:
            cur = ""
            k = 0
            for w in txt.split(" "):
                if cur and len(cur) + 1 + len(w) > 22:
                    wrapped.append((t0 + k * len(cur) * per_char / c.fps, cur))
                    k += 1
                    cur = w
                else:
                    cur = f"{cur} {w}" if cur else w
            wrapped.append((t0 + k * 22 * per_char / c.fps, cur))
        lines = wrapped
    mat = font.text_material("crt", color, 7.0, rough=0.6)
    width = max(len(t) for _, t in lines)
    rows = len(lines)
    block_w = width * font.ADV * size
    block_h = rows * font.LINE * size
    end = 0
    for i, (t0, txt) in enumerate(lines):
        root, chars = font.text(txt, size, mat, align="left", name=f"term{i}")
        root.location = (-block_w / 2, 0, block_h / 2 - (i + 1) * font.LINE * size)
        end = font.reveal(chars, c.f(t0), per_char, "type")
    # Cursor: a full cell blinking at 2 Hz after the last character.
    me = bpy.data.meshes.new("cursor")
    V_, F_ = font._cubes([(x, z) for x in range(5) for z in range(7)], 1.0)
    me.from_pydata(V_.tolist(), [], F_)
    me.materials.append(mat)
    cur = bpy.data.objects.new("cursor", me)
    bpy.context.scene.collection.objects.link(cur)
    last = lines[-1][1]
    cur.scale = (size, size, size)
    # Glyphs sit centred on their line (z −3.5 … 3.5 px); the cursor's cubes start at 0.
    cur.location = (-block_w / 2 + (len(last) + 1) * font.ADV * size, 0, block_h / 2 - rows * font.LINE * size - 3.5 * size)
    cur["glow"] = 1.0
    seq = []
    f = end
    on = True
    while f <= c.n + 12:
        seq.append((f, on))
        f += c.fps // 4
        on = not on
    fx.show(cur, [(1, False)] + seq)
    # Faint phosphor haze behind the text.
    fx.Rig  # noqa: B018 — camera lives in c.rig
    # Fit the block: horizontal FOV of a 50 mm lens on a 36 mm sensor (≈ 39.6°).
    half = math.atan(18 / 50)
    d = (block_w / 2) / math.tan(half) * 1.34
    if c.vertical:
        d = (block_w / 2) / math.tan(half * 9 / 16) * 1.26
    c.rig.key(1, V((0.4, -d * 1.08, 0.1)), V((0, 0, 0)), 50, v={"eye": V((0.2, -d * 1.08, 0.05)), "target": V((0, 0, 0)), "lens": 50})
    c.rig.key(c.n, V((0, -d * 0.92, 0)), V((0, 0, 0)), 50, v={"eye": V((0, -d * 0.95, 0)), "target": V((0, 0, 0)), "lens": 50})
    lab.bloom(0.6, 0.9, 0.8)


def title_card(c: Ctx, logo: bool, tagline: str, sub: str = "", tag_at: float = 2.6) -> None:
    """The voxel logo `_unLABS` rising in, a tagline under it, a light sweep."""
    lab.world(0.006, (0.004, 0.004, 0.006))
    s = 0.07 if not c.vertical else 0.045
    if logo:
        m_logo = font.text_material("logo", BONE, 0.25, rough=0.35, metal=0.2)
        m_us = font.text_material("logo_us", ORANGE, 3.0, rough=0.4)
        root, chars = font.text("_unLABS", s * 2.2, m_logo, name="logo", depth=3.0)
        root.location = (0, 0, 0.9 if not c.vertical else 1.2)
        chars[0].data.materials[0] = m_us
        font.reveal(chars, c.f(0.1), c.fps * 0.1, "rise")
    m_tag = font.text_material("tag", BONE, 0.6, rough=0.5)
    lines = tagline if not c.vertical else tagline.replace(". ", ".\n")
    troot, tchars = font.text(lines, s * (0.62 if not c.vertical else 0.85), m_tag, name="tag")
    troot.location = (0, 0, -0.55 if logo else 0.2)
    font.reveal(tchars, c.f(tag_at), 1.2, "rise")
    if sub:
        sub_txt = sub if not c.vertical else sub.replace(" // ", "\n")
        sroot, schars = font.text(sub_txt, s * (0.4 if not c.vertical else 0.55), font.text_material("sub", (0.6, 0.66, 0.64), 0.2), name="sub")
        sroot.location = (0, 0, (-1.25 if logo else -0.6) - (0.35 if c.vertical and tagline.count(". ") else 0))
        font.reveal(schars, c.f(tag_at + 1.6), 0.8, "rise")
    # Key light sweeping across the letters.
    key = lab.spot("sweep", V((-6, -6, 3)), V((0, 0, 0)), 900, (1.0, 0.92, 0.82), angle=30, blend=0.9)
    key.keyframe_insert("location", frame=1)
    key.location = V((6, -6, 3))
    key.keyframe_insert("location", frame=c.n)
    rim = lab.spot("rim", V((0, 5, 2.5)), V((0, 0, 0.3)), 600, ORANGE, angle=60)
    fx.energy([rim], [(1, 0.0), (c.f(1.2), 1.0)])
    dist = 10.5 if not c.vertical else 13.0
    c.rig.key(1, V((0, -dist * 1.06, 0.25)), V((0, 0, 0.15)), 50, v={"eye": V((0, -dist * 1.06, 0.25)), "target": V((0, 0, 0.15)), "lens": 50})
    c.rig.key(c.n, V((0, -dist, 0.05)), V((0, 0, 0.1)), 50, v={"eye": V((0, -dist, 0.05)), "target": V((0, 0, 0.1)), "lens": 50})
    lab.bloom(0.9, 0.7, 0.75)


def lit_set(sid: str, fill: float = 1.0, lamp_gain: float = 6.0, fog: float = 0.006, ceiling: bool = True) -> lab.LabSet:
    s = lab.LabSet(sid)
    for l in s.lights:
        l.data.energy *= lamp_gain
        l["energy0"] = l.data.energy
    if ceiling:
        lab.ceiling(s)
    if fill > 0:
        lab.room_fill(s, fill)
    lab.world(fog, (0.002, 0.0022, 0.003))
    return s


def lights_of(s: lab.LabSet, kind: str | None = None, of: str | None = None) -> list[bpy.types.Object]:
    return [l for l in s.lights if (kind is None or l["kind"] == kind) and (of is None or l["of"] == of)]


def fill_of(s: lab.LabSet) -> list[bpy.types.Object]:
    return [o for o in s.coll.objects if o.name.endswith(":fill")]


def path(
    c: Ctx,
    s: lab.LabSet,
    e0: tuple[float, float, float],
    t0: tuple[float, float, float],
    e1: tuple[float, float, float],
    t1: tuple[float, float, float],
    lens: float,
    vback: float = 1.0,
    vlens: float | None = None,
    clamp: bool = True,
) -> None:
    """Camera move in GAME coordinates (x, height, z) of set `s`.

    9:16 uses the same aim, pulled back by `vback` along the view line and a
    slightly wider lens, so the subject stays centred and whole.
    """
    E0, T0, E1, T1 = (s.world(p) for p in (e0, t0, e1, t1))
    V0 = T0 + (E0 - T0) * vback
    V1 = T1 + (E1 - T1) * vback
    if clamp:
        E0, E1, V0, V1 = (_sightline(T, E) for T, E in ((T0, E0), (T1, E1), (T0, V0), (T1, V1)))
    vl = vlens or lens * 0.66
    c.rig.key(1, E0, T0, lens, v={"eye": V0, "target": T0, "lens": vl})
    c.rig.key(c.n, E1, T1, lens, v={"eye": V1, "target": T1, "lens": vl})


def _sightline(target: Vector, eye: Vector, lead: float = 1.5, margin: float = 0.6) -> Vector:
    """Pull `eye` towards `target` until nothing (a wall, a cabinet) blocks the view.

    The ray starts `lead` units off the target so a target on a surface does
    not count as blocked; a block closer than that is ignored (with a note).
    """
    d = eye - target
    full = d.length
    if full <= lead + margin:
        return eye
    dirn = d.normalized()
    start = target + dirn * lead
    free = fx.clear(start, eye) + lead
    if free >= full - 1e-3:
        return eye
    if free < full * 0.3:
        print(f"[trailer] sightline: blocked at {free:.1f}/{full:.1f}, kept")
        return eye
    print(f"[trailer] sightline: eye pulled in {full:.1f} -> {free - margin:.1f}")
    return target + dirn * (free - margin)


def move(
    c: Ctx,
    target: Vector,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    lens: float,
    az_pref: float,
    ignore: list[bpy.types.Object] | tuple = (),
    lift: float = 0.0,
    vdist: float = 1.18,
) -> float:
    """Key a clear camera move on `target`: (dist, height, Δazimuth) at start and end.

    The base azimuth is the one nearest `az_pref` with a free line of sight
    at the start distance (fx.find_view). 9:16 pulls back by `vdist` with a
    wider lens. `lift` raises the aim point at the end. Returns the azimuth.
    """
    d0, h0, a0 = start
    d1, h1, a1 = end
    az = fx.find_view(target, max(d0, d1), max(h0, h1), az_pref + a0, ignore)
    # Never start or end behind a wall: clamp each distance to the free sight line.
    for which in (0, 1):
        d, h, a = (d0, h0, a0) if which == 0 else (d1, h1, a1)
        far = fx.orbit(target, d * vdist, az - a0 + a, 0)
        far.z = target.z + h * 1.05
        free = fx.clear(target, far, ignore)
        full = (far - target).length
        if free < full:
            k = max(0.25, (free - 0.8) / full)
            d, h = d * k, h * k
        if which == 0:
            d0, h0 = d, h
        else:
            d1, h1 = d, h
    e0 = fx.orbit(target, d0, az, 0)
    e0.z = target.z + h0
    e1 = fx.orbit(target, d1, az - a0 + a1, 0)
    e1.z = target.z + h1
    v0 = fx.orbit(target, d0 * vdist, az, 0)
    v0.z = target.z + h0 * 1.05
    v1 = fx.orbit(target, d1 * vdist, az - a0 + a1, 0)
    v1.z = target.z + h1 * 1.05
    t1 = target + V((0, 0, lift))
    c.rig.key(1, e0, target, lens, v={"eye": v0, "target": target, "lens": lens * 0.8})
    c.rig.key(c.n, e1, t1, lens, v={"eye": v1, "target": t1, "lens": lens * 0.8})
    return az


# ── Trailer 1 · Still Running ──────────────────────────────────────


@shot("t1", "s1_boot", 7.0, "CRT type-on: cold start")
def t1_s1(c: Ctx) -> None:
    terminal(
        c,
        [
            (0.5, "_unOS // EXTERNAL LINK REQUEST"),
            (1.8, "HANDSHAKE 3648 ........ OK"),
            (3.0, "DORMANCY: 2,561 DAYS"),
            (4.1, "EXTERNAL CONTACT: ESTABLISHED"),
            (5.3, "MCP-000 ... RESPONDING (RELUCTANTLY)"),
        ],
        per_char=0.8,
    )


@shot("t1", "s2_control", 7.74, "control room wakes, lamps click on toward camera")
def t1_s2(c: Ctx) -> None:
    s = lit_set("kontroll", fill=0.9)
    console = s.by_id["hauptkonsole"]
    cm = fx.mid(console)
    # From the south door up the axis to the console (docs/TRAILERS.md T1·2).
    path(c, s, (88.6, 9.0, 51), (88.8, 2.5, 21), (88.6, 6.6, 39), (88.8, 2.8, 21), 30)
    c.rig.dof(s.world((88.8, 2.4, 20)), 5.6)
    # Dark at first: only screens and emissive panels glow, lamps off.
    lamps = lights_of(s, "lamp")
    fill = fill_of(s)
    terrain = s.by_kind.get("terrain", [])
    fx.energy(fill, [(1, 0.0)])
    fx.energy(lamps, [(1, 0.0)])
    fx.glow(terrain, [(1, 0.0)])
    # Lamps click on, farthest first (towards the camera).
    cam = c.rig.cam.location.copy()
    lamps.sort(key=lambda l: -(l.matrix_world.translation - cam).length)
    t = 1.6
    for i, l in enumerate(lamps):
        fx.click_on([], [l], c.f(t), seed=i)
        t += 0.5
    fx.glow(terrain, [(c.f(1.6) - 1, 0.0), (c.f(1.6), 1.0)])
    fx.constant(terrain)
    fx.energy(fill, [(c.f(t - 0.3), 0.0), (c.f(t + 1.0), 1.0)])


@shot("t1", "s3_mcp", 7.74, "MCP-000 breathing, racks wake in a wave")
def t1_s3(c: Ctx) -> None:
    s = lit_set("mcp", fill=0.25, lamp_gain=3.0, fog=0.01)
    core = s.by_id["MCP-000"]
    cm = fx.mid(core)
    lo, hi = fx.bbox(core)
    h = hi.z - lo.z
    # Low, almost on the floor, pushing in on the core from the south.
    path(c, s, (127, 10, 96), (141, 1.4, 80), (153, 7.5, 93), (141, 1.6, 80), 35)
    c.rig.dof(s.world((141, 1.4, 80)), 2.8)
    # The core breathes (emit gain), slow.
    seq = []
    for k in range(0, c.n + 24, 24):
        seq += [(1 + k, 0.55), (1 + k + 12, 1.6)]
    fx.glow(core, seq, prop="emit_gain")
    red = lab.spot("mcp_red", cm + V((0, 0, h * 1.4 + 4)), cm, 450, (1.0, 0.12, 0.08), angle=70, blend=0.8)
    fx.energy([red], [(f, 0.4 if i % 2 == 0 else 1.0) for i, (f, _) in enumerate(seq)])
    # Racks and decor wake in a wave from the core outwards.
    rest = [o for o in s.objects if o["kind"] in ("decor", "prop")]
    rest.sort(key=lambda o: (o.matrix_world.translation - cm).length)
    for i, o in enumerate(rest):
        f = c.f(1.0 + i * 0.08)
        fx.glow([o], [(f - 1, 0.0), (f, 1.0)])
    fx.constant(rest)
    fx.energy(lights_of(s, "lamp") + fill_of(s), [(1, 0.0), (c.f(3.5), 0.0), (c.f(5.5), 1.0)])


@shot("t1", "s4_build", 7.74, "a device assembles voxel by voxel, slow orbit")
def t1_s4(c: Ctx) -> None:
    s = lit_set("werkstatt", fill=0.7)
    dev = s.by_id["PWB-001"]
    cm = fx.mid(dev)
    lo, hi = fx.bbox(dev)
    h = max(hi.z - lo.z, 2.0)
    tgt = V((cm.x, cm.y, lo.z + h * 0.45))
    move(c, tgt, (h * 2.9, h * 0.9, -30), (h * 2.4, h * 0.65, 22), 32, fx.toward(cm, s.center()), dev)
    c.rig.dof(tgt, 3.2)
    for o in dev:
        fx.assemble(o, c.f(0.5), c.f(6.2), drop=h * 1.4)
        fx.glow([o], [(1, 0.0), (c.f(6.0), 0.0), (c.f(6.4), 1.6), (c.f(7.2), 1.0)])
    for l in lights_of(s, "device", "PWB-001"):
        fx.energy([l], [(1, 0.0), (c.f(6.0), 0.0), (c.f(6.4), 1.5), (c.f(7.2), 1.0)])
    work = lab.spot("work", tgt + V((0, 0, 6)), tgt, 700, (1.0, 0.9, 0.78), angle=45)
    fx.energy([work], [(1, 0.6), (c.n, 1.0)])


@shot("t1", "s5_racks", 5.81, "lateral track along the racks, 847 ms blink")
def t1_s5(c: Ctx) -> None:
    s = lit_set("rechen", fill=0.35, lamp_gain=3.0, fog=0.012)
    racks = [o for o in s.objects if o["kind"] in ("device", "prop") or "server" in str(o.get("oid", ""))]
    # Lateral track along the north rack row, eye height.
    path(c, s, (24, 6.0, 128), (28, 2.4, 113), (48, 6.0, 128), (44, 2.4, 113), 32)
    # 847 ms on, 847 ms off (the lore beat) on every rack.
    period = 0.847
    seq = []
    t = 0.0
    on = True
    while t < c.n / c.fps + 1:
        seq.append((c.f(t), 1.3 if on else 0.3))
        t += period
        on = not on
    fx.glow(racks, seq, prop="emit_gain")
    fx.constant(racks)


@shot("t1", "s6_bot", 5.81, "a dormant bot wakes in its dock")
def t1_s6(c: Ctx) -> None:
    s = lit_set("botdepot", fill=0.4, lamp_gain=3.0, fog=0.01)
    dock = s.by_id.get("bot_dock") or [o for o in s.objects if o["kind"] == "decor" and "dock" in o.name]
    dm = fx.mid(dock) if dock else s.center()
    room = s.center()
    az = fx.toward(dm, room)
    spot = dm + (room - dm).normalized() * 1.6
    spot.z = s.root.location.z + 1.0
    face = math.radians(az) - math.pi / 2  # models face game +z = Blender −Y; turn to the room
    sleep = lab.cast(_first_bot("dormant"), spot, face)
    wake = lab.cast(sleep.name.replace("_dormant", "_awake"), spot, face)
    t_wake = 3.0
    fx.show(sleep, [(1, True), (c.f(t_wake), False)])
    fx.show(wake, [(1, False), (c.f(t_wake), True)])
    fx.glow([wake], [(c.f(t_wake) - 1, 0.0), (c.f(t_wake), 0.2), (c.f(t_wake) + 3, 1.8), (c.f(t_wake + 1.2), 1.0)])
    lo, hi = fx.bbox([sleep])
    h = max(hi.z - lo.z, 1.0)
    tgt = V((spot.x, spot.y, lo.z + h * 0.6))
    move(c, tgt, (h * 4.2, h * 0.3, 12), (h * 2.6, h * 0.1, 4), 40, az, [sleep, wake])
    c.rig.dof(tgt, 2.0)
    key = lab.spot("botkey", tgt + V((0, 0, 4)), tgt, 300, (0.7, 0.85, 1.0), angle=40)
    fx.energy([key], [(1, 0.4), (c.f(t_wake), 0.4), (c.f(t_wake + 0.8), 1.0)])


@shot("t1", "s7_signal", 5.81, "crane up over the speaker wall as the room powers")
def t1_s7(c: Ctx) -> None:
    s = lit_set("signal", fill=1.6, lamp_gain=5.0)
    devs = [o for o in s.objects if o["kind"] == "device"]
    cm = fx.mid(devs)
    # Crane up from the speaker rug over the synth row.
    synth = s.find("synth")
    tgt = fx.mid(synth)
    print(f"[trailer] synth at {tgt}, bbox {fx.bbox(synth)}")
    move(c, tgt, (11.0, 2.0, -12), (8.0, 4.5, 8), 26, fx.toward(tgt, s.center()), synth)
    lab.spot("synthkey", s.world((38, 8.6, 121)), s.world((38, 1.5, 126)), 1400, (1.0, 0.85, 0.7), angle=60, blend=0.8)
    order = sorted(devs, key=lambda o: o.matrix_world.translation.x)
    for i, o in enumerate(order):
        f = c.f(1.2 + i * 0.6)
        fx.glow([o], [(f - 1, 0.0), (f, 1.4), (f + 8, 1.0)])
        fx.energy(lights_of(s, "device", o["oid"]), [(f - 1, 0.0), (f + 6, 1.0)])
    fx.energy(lights_of(s, "lamp") + fill_of(s), [(1, 0.15), (c.f(4.5), 1.0)])


@shot("t1", "s8_reveal", 7.74, "high pull-back over the lit control room")
def t1_s8(c: Ctx) -> None:
    s = lit_set("kontroll", fill=1.1, lamp_gain=7.0, fog=0.008, ceiling=False)
    # From behind Jade's chair at the console, crane up and back over the whole room.
    path(c, s, (88.6, 6.5, 32), (88.8, 3.0, 20), (89, 38, 66), (89, 0, 32), 28, vback=1.2)


@shot("t1", "s9_title", 9.68, "logo + tagline")
def t1_s9(c: Ctx) -> None:
    title_card(c, True, "THE LAB NEVER SLEPT.", "TRANSMISSION 01 // LINK ESTABLISHED", tag_at=3.0)


# ── helpers for the cast ───────────────────────────────────────────


def _cast_ids() -> set[str]:
    import json

    return {e["id"] for e in json.loads((lab.TR / "cast.json").read_text())}


def _first_bot(state: str) -> str:
    ids = sorted(i for i in _cast_ids() if i.startswith("bot_") and i.endswith(state))
    return ids[0]


# ── Shared: HUD, CCTV, Jade ────────────────────────────────────────


def hud(c: Ctx, txt: str, corner: str = "bl", size: float = 0.0016, color: tuple[float, float, float] = BONE, at: float = 0.4, per_char: float = 1.0) -> list[bpy.types.Object]:
    """Voxel text pinned to the camera (screen corner), revealed at `at` s."""
    cam = c.rig.cam
    dist = 1.0
    w = 36.0 / cam.data.lens * dist  # frame width at `dist` (sensor 36 mm on the long side)
    if c.vertical:
        fw, fh = w * 9 / 16, w
    else:
        fw, fh = w, w * 9 / 16
    mat = font.text_material(f"hud_{corner}", color, 1.6)
    s = size * (1.25 if c.vertical else 1.0) * (35.0 / cam.data.lens)
    root, chars = font.text(txt, s, mat, parent=cam, align="left", name=f"hud_{corner}")
    tw = (max(len(x) for x in txt.split("\n")) * font.ADV) * s
    mx, my = fw * 0.06, fh * 0.07
    x = -fw / 2 + mx if corner.endswith("l") else fw / 2 - mx - tw
    y = -fh / 2 + my if corner.startswith("b") else fh / 2 - my - 7 * s
    root.location = (x, y, -dist)
    root.rotation_euler = (-math.pi / 2, 0, 0)
    font.reveal(chars, c.f(at), per_char, "type")
    return chars



def cctv(c: Ctx, label: str) -> None:
    """Security-camera look: green-grey grade, coarse pixels, scanlines, label."""
    sc = bpy.context.scene
    ng = sc.compositing_node_group
    if ng is None:
        return
    N, L = ng.nodes, ng.links
    rl = next(n for n in N if n.bl_idname == "CompositorNodeRLayers")
    out = next(n for n in N if n.bl_idname == "NodeGroupOutput")
    for l in list(out.inputs[0].links):
        ng.links.remove(l)
    src = rl.outputs["Image"]
    try:
        px = N.new("CompositorNodePixelate")
        if "Size" in px.inputs:
            px.inputs["Size"].default_value = 4
        elif hasattr(px, "pixel_size"):
            px.pixel_size = 3
        L.new(src, px.inputs[0])
        src = px.outputs[0]
    except Exception as e:  # noqa: BLE001
        print(f"[trailer] pixelate skipped: {e}")
    hs = N.new("CompositorNodeHueSat")
    L.new(src, hs.inputs["Image"])
    hs.inputs["Saturation"].default_value = 0.12
    hs.inputs["Value"].default_value = 1.15
    cb = N.new("CompositorNodeColorBalance")
    L.new(hs.outputs[0], cb.inputs["Image"])
    try:
        gains = [i for i in cb.inputs if i.name == "Gain"]
        for g in gains:
            if g.type == "RGBA":
                g.default_value = (0.8, 1.12, 0.86, 1)
    except Exception as e:  # noqa: BLE001
        print(f"[trailer] cctv grade: {e}")
    L.new(cb.outputs[0], out.inputs[0])
    hud(c, label, "tl", color=(0.75, 1.0, 0.8), at=0.0)
    hud(c, "REC", "tr", color=(1.0, 0.25, 0.2), at=0.0)


def jade(pos: Vector, facing: float, pose: dict[str, tuple[float, float, float]] | None = None, keys: list[tuple[int, str, tuple[float, float, float]]] | None = None) -> bpy.types.Object | None:
    """The hero Jade (scripts/trailer/blender/jade.py) at `pos`, facing (rad about up).

    `pose` = joint → game-frame Euler (static); `keys` = (frame, joint, euler)
    keyframes. Returns None when the hero export is missing (the shot then
    runs without a figure).
    """
    try:
        import jade as J  # noqa: PLC0415
    except Exception as e:  # noqa: BLE001
        print(f"[trailer] jade unavailable: {e}")
        return None
    # Deep copper under cinematic light (the game's #e2561c reads as orange in AgX).
    J.HAIR_OVERRIDE = "#a4401a"
    try:
        rig = J.build_jade(hair_share=1.0, flyaways=0.25)
    except Exception as e:  # noqa: BLE001
        print(f"[trailer] jade build failed: {e}")
        return None
    rig.location = pos
    rig.rotation_euler[2] += facing
    for joint, eul in (pose or {}).items():
        J.pose_joint(rig, joint, eul)
    for f, joint, eul in keys or []:
        J.pose_joint(rig, joint, eul)
        pb = rig.pose.bones[joint]
        pb.keyframe_insert("rotation_quaternion" if pb.rotation_mode == "QUATERNION" else "rotation_euler", frame=f)
    return rig


# ── Trailer 2 · Where Is Damien? ───────────────────────────────────
# Letters to Damien: 58 BPM waltz, one bar = 3 beats ≈ 3.103 s.

BAR_58 = 60 / 58 * 3


@shot("t2", "s1_search", BAR_58 * 2, "type-on: searching for D. Fridge")
def t2_s1(c: Ctx) -> None:
    terminal(c, [(0.5, "SEARCHING FOR D. FRIDGE ..."), (3.4, "NO SIGNAL")], per_char=1.4)


@shot("t2", "s2_doorway", BAR_58 * 3, "Jade from behind in the control room door")
def t2_s2(c: Ctx) -> None:
    s = lit_set("kontroll", fill=0.22, lamp_gain=1.0, fog=0.014)
    fx.energy(lights_of(s, "lamp"), [(1, 0.0)])
    # Jade (5.45 units tall) just inside the south door, looking north at the console.
    jade(s.world((88.6, 1.0, 43.5)), math.pi)
    path(c, s, (89.6, 6.2, 49.0), (88.4, 4.6, 28), (89.2, 5.9, 47.2), (88.4, 4.4, 26), 30)
    c.rig.dof(s.world((88.6, 6.0, 43.5)), 2.4)
    # Backlight from the console side: she is a silhouette against the room.
    lab.spot("inside", s.world((88.7, 8.6, 30)), s.world((88.6, 4.0, 43.5)), 1600, (0.6, 0.8, 1.0), angle=30, blend=0.8)


@shot("t2", "s3_quarters", BAR_58 * 3, "lateral track over Damien's desk: legal pads, cold mugs")
def t2_s3(c: Ctx) -> None:
    s = lit_set("damienq", fill=0.6, lamp_gain=1.8, fog=0.01)
    path(c, s, (37.5, 7.0, 28.5), (42.5, 3.4, 38.5), (47.5, 6.6, 29.5), (47.0, 3.4, 38.5), 32)
    c.rig.dof(s.world((44.5, 3.4, 38.5)), 4.0)
    lamp = lab.spot("desk", s.world((44.5, 8.6, 36)), s.world((44.5, 3.4, 38.5)), 1400, (1.0, 0.78, 0.5), angle=55, blend=0.7)
    fx.energy([lamp], [(1, 0.85), (c.n, 1.0)])


@shot("t2", "s4_telescope", BAR_58 * 3, "slow orbit around the telescope")
def t2_s4(c: Ctx) -> None:
    s = lit_set("observatorium", fill=0.7, lamp_gain=3.0, fog=0.008, ceiling=False)
    t = (132.5, 5.0, 132.5)
    a0, a1, r, h = math.radians(200), math.radians(245), 12.0, 7.0
    e0 = (t[0] + math.cos(a0) * r, h, t[2] + math.sin(a0) * r)
    e1 = (t[0] + math.cos(a1) * r, h - 1.2, t[2] + math.sin(a1) * r)
    path(c, s, e0, t, e1, (132.5, 5.6, 132.5), 32)
    moon = lab.spot("moon", s.world((128, 30, 120)), s.world(t), 4000, (0.55, 0.7, 1.0), angle=25, blend=0.6, size=1.2)
    fx.energy([moon], [(1, 0.8), (c.n, 1.0)])


@shot("t2", "s5_morse", BAR_58 * 3, "the chalk morse line; the sconce pulses it")
def t2_s5(c: Ctx) -> None:
    s = lit_set("funkraum", fill=0.45, lamp_gain=1.5, fog=0.012)
    path(c, s, (42.5, 4.9, 141.5), (40.4, 4.3, 134), (41.2, 4.5, 138.6), (40.4, 4.25, 134), 40)
    c.rig.dof(s.world((40.4, 4.25, 134.1)), 2.2)
    sconce = s.find("wall_sconce")
    lights = [l for l in s.lights if l["of"] and any(l["of"] == o["oid"] for o in sconce)]
    lab.spot("chalk", s.world((44, 7.5, 138)), s.world((40.4, 4.2, 134)), 500, (0.85, 0.9, 1.0), angle=45)
    pulse = lab.spot("pulse", s.world((38.5, 7.0, 136)), s.world((40.4, 4.2, 133.5)), 900, (1.0, 0.8, 0.5), angle=35)
    # L-O-V-W, the game's own signal (pz_morse_whisper) — the hidden detail.
    fx.morse(lights + [pulse], sconce, ".-.. --- ...- .--", c.f(1.2), 4, low=0.12)


@shot("t2", "s6_corkwall", BAR_58 * 2, "push into the cork wall of the map room")
def t2_s6(c: Ctx) -> None:
    s = lit_set("kartenraum", fill=0.45, lamp_gain=1.5, fog=0.01)
    board = s.find("cork_board")[:1] or s.find("sticky_wall")[:1]
    tgt = fx.mid(board)
    move(c, tgt, (15.0, 1.6, -10), (10.0, 0.8, 4), 30, fx.toward(tgt, s.center()), board)
    c.rig.dof(tgt, 3.2)
    lab.spot("lamp", tgt + V((0, 0, 4)) + (s.center() - tgt).normalized() * 3, tgt, 1100, (1.0, 0.7, 0.45), angle=50)


@shot("t2", "s7_cctv", BAR_58 * 2, "security feed: a veiled figure for half a second")
def t2_s7(c: Ctx) -> None:
    s = lit_set("damienq", fill=0.25, lamp_gain=0.5, fog=0.006)
    # High corner camera, fixed; a slow digital zoom.
    path(c, s, (55.5, 8.2, 43.5), (44, 1.8, 27), (55.5, 8.2, 43.5), (44, 2.0, 27), 22, vlens=16)
    c.rig.cam.data.keyframe_insert("lens", frame=1)
    fig = lab.cast("damien_veil_idle_0", s.world((46.5, 1.0, 30.5)), math.radians(200))
    fig2 = lab.cast("damien_veil_idle_1", s.world((46.5, 1.0, 30.5)), math.radians(200))
    a, b = c.f(3.0), c.f(3.5)
    fx.show(fig, [(1, False), (a, True), (a + 3, False), (a + 6, True), (b, False)])
    fx.show(fig2, [(1, False), (a + 3, True), (a + 6, False)])
    cctv(c, "CAM 07  L+1  QUARTERS D.F.  03:12:44")


@shot("t2", "s8_profile", BAR_58 * 2, "close profile of Jade")
def t2_s8(c: Ctx) -> None:
    s = lit_set("kontroll", fill=0.12, lamp_gain=0.6, fog=0.01)
    # Over her shoulder at the console; she turns her head towards us — then cut.
    t_turn = c.f(1.4)
    jade(
        s.world((88.6, 1.0, 29.0)),
        math.pi,
        keys=[(1, "head", (0.0, 0.0, 0.0)), (t_turn, "head", (0.0, 0.0, 0.0)), (c.f(3.8), "head", (0.08, -1.05, 0.0))],
    )
    head = s.world((88.6, 6.0, 29.0))
    path(c, s, (91.4, 6.7, 33.6), (88.3, 5.8, 27.4), (91.0, 6.6, 33.0), (88.4, 5.9, 27.6), 45, vlens=34)
    c.rig.dof(head, 2.0)
    lab.spot("screen", s.world((88.7, 6.5, 22)), head, 500, (0.45, 1.0, 0.6), angle=40, size=0.8)
    lab.spot("rim", s.world((85.0, 8.0, 33.0)), head, 600, (1.0, 0.68, 0.42), angle=35, size=0.4)


@shot("t2", "s9_title", 9.31, "WHERE IS DAMIEN?")
def t2_s9(c: Ctx) -> None:
    title_card(c, True, "WHERE IS DAMIEN?", "TRANSMISSION 02 // D.F.: NO SIGNAL", tag_at=2.4)


# ── Trailer 3 · 847 Metres ─────────────────────────────────────────
# The Shaft Breathes: 56 BPM, one bar ≈ 4.286 s; shots are 2 bars.

BAR_56 = 60 / 56 * 4


def level(c: Ctx, label: str) -> None:
    hud(c, label, "bl", size=0.0022, color=(0.95, 0.93, 0.88), at=0.5)


@shot("t3", "s1_top", BAR_56 * 1.5, "L+1 rotunda, straight down the core")
def t3_s1(c: Ctx) -> None:
    s = lit_set("aufzug4", fill=0.3, lamp_gain=2.0, fog=0.006, ceiling=False)
    path(c, s, (88.5, 34, 80.6), (88.5, 0, 80.4), (88.5, 20, 80.6), (88.5, 0, 80.4), 30, vlens=24)
    c.rig.cam.rotation_euler = (0, 0, 0)


@shot("t3", "s2_l0", BAR_56 * 1.5, "through the L0 rotunda")
def t3_s2(c: Ctx) -> None:
    s = lit_set("aufzug0", fill=0.35, lamp_gain=2.5, fog=0.008)
    path(c, s, (88, 8.6, 99), (88, 1.5, 80), (88, 4.0, 92), (88, 2.0, 80), 26)


@shot("t3", "s3_l1", BAR_56 * 1.5, "L−1 data centre breathing")
def t3_s3(c: Ctx) -> None:
    s = lit_set("rechen", fill=0.25, lamp_gain=2.0, fog=0.012)
    path(c, s, (36, 8.6, 129), (36, 2.5, 113), (36, 4.2, 124), (36, 2.5, 113), 28)
    racks = [o for o in s.objects if o["kind"] in ("device", "prop")]
    seq, t, on = [], 0.0, True
    while t < c.n / c.fps + 1:
        seq.append((c.f(t), 1.3 if on else 0.3))
        t += 0.847
        on = not on
    fx.glow(racks, seq, prop="emit_gain")
    fx.constant(racks)


@shot("t3", "s4_l2", BAR_56 * 1.5, "L−2 anomaly chamber, glitching light")
def t3_s4(c: Ctx) -> None:
    s = lit_set("anomalie", fill=0.5, lamp_gain=3.0, fog=0.012, ceiling=False)
    path(c, s, (46, 8.0, 38), (29, 5, 52), (41, 6.0, 43), (28.6, 5.5, 50), 30)
    import random

    rnd = random.Random(7)
    seq = [(1, 1.0)]
    f = 6
    while f < c.n:
        seq += [(f, 0.1 + rnd.random() * 0.4), (f + rnd.randint(1, 3), 1.0)]
        f += rnd.randint(10, 30)
    fx.energy(s.lights + fill_of(s), seq)
    fx.constant(s.lights + fill_of(s))


@shot("t3", "s5_l3", BAR_56 * 1.5, "L−3 the Infinity Forge glows")
def t3_s5(c: Ctx) -> None:
    s = lit_set("forge", fill=0.7, lamp_gain=3.5, fog=0.01, ceiling=False)
    forge = s.find("infinity_forge")
    path(c, s, (88.5, 7.5, 152), (88.5, 6, 130.5), (88.5, 6.0, 145), (88.5, 7, 130.5), 26)
    seq = []
    for k in range(0, c.n + 30, 30):
        seq += [(1 + k, 0.8), (1 + k + 15, 1.8)]
    fx.glow(forge, seq, prop="emit_gain")
    core = lab.spot("forge_glow", s.world((88.5, 3, 138)), s.world((88.5, 8, 130.5)), 1500, (1.0, 0.45, 0.15), angle=60)
    fx.energy([core], [(f, 0.5 if i % 2 == 0 else 1.0) for i, (f, _) in enumerate(seq)])


@shot("t3", "s6_x9", BAR_56 * 1.5, "X9 chamber: halo dust in the light")
def t3_s6(c: Ctx) -> None:
    s = lit_set("x9kammer", fill=0.7, lamp_gain=3.5, fog=0.016)
    t = (140.5, 4.2, 32.5)
    pod = s.find("containment_pod")
    tgt = fx.mid(pod) if pod else s.world(t)
    move(c, tgt, (14.0, 3.5, 0), (9.5, 2.4, 0), 24, fx.toward(tgt, s.center()) if (tgt - s.center()).length > 1 else 180, pod)
    lab.spot("shaft", s.world((140.5, 30, 32.5)), s.world((140.5, 0, 32.5)), 2500, (1.0, 0.92, 0.75), angle=14, blend=0.4)


@shot("t3", "s7_bore", BAR_56 * 1.5, "Borehole #1: tilt down onto the drill")
def t3_s7(c: Ctx) -> None:
    s = lit_set("bohrung", fill=0.7, lamp_gain=3.5, fog=0.012)
    lab.spot("rigkey", s.world((126, 8.6, 128)), s.world((132.5, 3, 120.5)), 900, (1.0, 0.85, 0.7), angle=40)
    path(c, s, (132.5, 8.2, 134), (132.5, 3.0, 122), (132.5, 8.2, 129), (132.5, 0.5, 120.5), 26)
    heat = lab.spot("heat", s.world((132.5, 0.3, 120.5)), s.world((132.5, 8, 120.5)), 900, (1.0, 0.35, 0.08), angle=80)
    fx.energy([heat], [(1, 0.5), (c.n, 1.0)])


@shot("t3", "s8_cave", BAR_56 * 2, "the crystal cave wakes in cerulean")
def t3_s8(c: Ctx) -> None:
    s = lit_set("hoehle", fill=0.05, lamp_gain=0.5, fog=0.016)
    wall = s.find("kristallwand")
    j = jade(s.world((70.0, 1.0, 141.0)), math.radians(110))
    path(c, s, (58, 3.6, 146), (74, 3.2, 138.5), (62, 3.2, 144), (75, 3.4, 138.5), 30, clamp=False)
    fx.glow(wall, [(1, 0.0), (c.f(1.5), 0.0), (c.f(5.0), 2.2)], prop="emit_gain")
    a = lab.spot("halo_a", s.world((78, 5, 141)), s.world((66, 1, 142)), 0, CERULEAN, angle=70, size=0.3)
    b = lab.spot("halo_b", s.world((75, 3, 135)), s.world((64, 1, 145)), 0, (0.5, 0.75, 1.0), angle=70, size=0.3)
    a["energy0"], b["energy0"] = 1800.0, 1200.0
    fx.energy([a, b], [(1, 0.0), (c.f(1.5), 0.0), (c.f(5.0), 1.0)])
    if j is None:
        print("[trailer] t3/s8_cave: no Jade export — the shadows fall on the empty floor")


@shot("t3", "s9_title", 10.0, "847. NOT CHOSEN. GIVEN.")
def t3_s9(c: Ctx) -> None:
    title_card(c, True, "847. NOT CHOSEN. GIVEN.", "TRANSMISSION 03 // SOURCE: 847 M BELOW", tag_at=2.6)


# ── Transmission 00 · Signal (docs/TRANSMISSIONS.md) ───────────────
# The comeback post: a handshake that fails twice (847 ms apart) and holds,
# half a second of the lab (borrowed from t1/s8_reveal), then the card.


@shot("t0", "s1_handshake", 6.5, "handshake fails twice, then holds")
def t0_s1(c: Ctx) -> None:
    terminal(
        c,
        [
            (0.4, "_unOS // EXTERNAL LINK REQUEST"),
            (1.6, "HANDSHAKE 3648 ... FAILED"),
            (1.6 + 0.847 * 2, "HANDSHAKE 3648 ... FAILED"),
            (1.6 + 0.847 * 4, "HANDSHAKE 3648 ... OK"),
            (5.3, "LINK ESTABLISHED"),
        ],
        per_char=0.7,
    )


@shot("t0", "s3_title", 6.0, "logo + LINK ESTABLISHED")
def t0_s3(c: Ctx) -> None:
    title_card(c, True, "LINK ESTABLISHED.", "TRANSMISSION 00", tag_at=1.6)


# ── Intercepts (docs/TRANSMISSIONS.md § 6): short 9:16 posts between the
# transmissions, cut from the trailers' frames; only the end card is new.


@shot("i1", "s9_card", 4.5, "intercept card")
def i1_card(c: Ctx) -> None:
    title_card(c, True, "SOMETHING ANSWERED.", "INTERCEPT 01", tag_at=1.0)


@shot("i2", "s9_card", 4.5, "intercept card")
def i2_card(c: Ctx) -> None:
    title_card(c, True, "WHO SAT HERE?", "INTERCEPT 02", tag_at=1.0)


@shot("i3", "s9_card", 4.5, "intercept card")
def i3_card(c: Ctx) -> None:
    title_card(c, True, "PLAYBACK CORRUPTED.", "INTERCEPT 03 // CAM 07", tag_at=1.0)


@shot("i4", "s9_card", 4.5, "intercept card")
def i4_card(c: Ctx) -> None:
    title_card(c, True, "SIGNAL SOURCE: BELOW.", "INTERCEPT 04", tag_at=1.0)
