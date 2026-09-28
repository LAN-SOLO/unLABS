/**
 * Device visuals (front = +z, DETAIL_SCALE = 0.25 world units per voxel).
 * =========================================================================
 *
 * Every device is a detailed static `base` plus animated parts, point
 * lights and live `screens` (see `anim.ts` for the placement contract and
 * the face-relative detail kit). Models are drawn at double resolution, so
 * a device keeps the world footprint its room was laid out for with twice
 * the voxels per side. Wall-mounted devices (CLK, TMP, PWD, VLT, BTK) are
 * shallow with their back plate at z = 0. Mount coordinates are continuous
 * (voxel index + 0.5 = voxel centre). Screens sit on the dark face that
 * `bezelScreen` leaves in the voxels.
 */
import { C } from "@/lib/world/content/palette";
import {
  bevelBox,
  bezelScreen,
  block,
  cableRun,
  chamferBox,
  coffeeRing,
  coolingFins,
  cornerScrews,
  detailVisual,
  discXY,
  discYZ,
  dust,
  faceCable,
  faceHarness,
  faceRect,
  faceSet,
  fanPort,
  fanRotor,
  gauge,
  gem,
  glassTube,
  glow,
  grille,
  harness,
  hash3,
  hazardFace,
  keypad,
  knob,
  label,
  ledRow,
  ledStrip,
  mount,
  mug,
  namePlate,
  needleModel,
  openHatch,
  orb,
  pipeDrop,
  pipeElbow,
  plate,
  plinth,
  portBank,
  powerInlet,
  reelModel,
  ringModel,
  rivetRow,
  rustStreak,
  scorch,
  screws,
  seam,
  serialPlate,
  serviceHatch,
  stencil,
  stickyNote,
  stud,
  switchBank,
  tapedNote,
  visual,
  warnSticker,
  type AnimPart,
  type DeviceVisual,
  type ScreenSpec,
} from "@/lib/world/models/anim";
import { Model } from "@/lib/world/models/core";

const TAU = Math.PI * 2;

// ── Local helpers ────────────────────────────────────────────────

/** Yellow/black hazard ring on the top face at height y. */
function hazardRing(m: Model, cx: number, cz: number, r: number, y: number): void {
  for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.hypot(x - cx, z - cz);
      if (Math.abs(d - r) > 0.6) continue;
      const a = Math.atan2(z - cz, x - cx);
      m.set(x, y, z, Math.floor((a / TAU) * 16 + 16) % 2 === 0 ? C.safety_yellow : C.hazard_black);
    }
}

/** Radial gradient disc facing +z (eyes, cores). `stops` = [maxDistSq, colour][]. */
function eyeDisc(r: number, stops: [number, number][]): Model {
  const s = 2 * Math.ceil(r) + 1;
  const ctr = (s - 1) / 2;
  const m = new Model(s, s, 1);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const dd = (x - ctr) ** 2 + (y - ctr) ** 2;
      const hit = stops.find(([max]) => dd <= max);
      if (hit && dd <= r * r + 0.3) m.set(x, y, 0, hit[1]);
    }
  return m;
}

/** Scattered emissive motes inside a cylinder (particles, bubbles). */
function motes(r: number, h: number, n: number, colors: number[], seed: number): Model {
  const s = 2 * Math.ceil(r) + 1;
  const m = new Model(s, h, s);
  const ctr = (s - 1) / 2;
  for (let i = 0; i < n; i++) {
    const a = ((i * 137.5 + seed * 31) * Math.PI) / 180;
    const rr = r * (0.35 + 0.65 * (((i * 7 + seed) % 10) / 10));
    const y = (i * 5 + seed * 3) % h;
    m.set(
      Math.round(ctr + Math.cos(a) * rr),
      y,
      Math.round(ctr + Math.sin(a) * rr),
      colors[i % colors.length]!,
    );
  }
  return m;
}

/** Spur gear facing +z (spins / steps about z): rim teeth, spokes, hub. */
function gearModel(r: number, c: number, hub: number = C.steel_dark, teeth = 8): Model {
  const s = 2 * Math.ceil(r) + 1;
  const ctr = (s - 1) / 2;
  const m = new Model(s, s, 1);
  for (let v = 0; v < s; v++)
    for (let u = 0; u < s; u++) {
      const d = Math.hypot(u - ctr, v - ctr);
      const a = Math.atan2(v - ctr, u - ctr);
      const tooth = Math.floor(((a / TAU) * teeth * 2 + teeth * 2) % 2) === 0;
      if (d < 1.2) m.set(u, v, 0, hub);
      else if (d <= r - 0.7 || (d <= r + 0.3 && tooth)) m.set(u, v, 0, c);
    }
  return m;
}

/** Vertical piston: chrome rod (h - 2) under a `cap` head (2 rows), footprint w×w. */
function pistonModel(h: number, w: number, cap: number, rod: number = C.chrome): Model {
  const m = new Model(w, h, w);
  const c = (w - 1) / 2;
  m.box(Math.floor(c), 0, Math.floor(c), Math.ceil(c), h - 3, Math.ceil(c), rod);
  m.box(0, h - 2, 0, w - 1, h - 1, w - 1, cap);
  return m;
}

/** Turn a +z-facing (w×h×1) part so it faces ±x (1×h×w): u → z. */
function yzModel(src: Model): Model {
  const m = new Model(src.d, src.h, src.w);
  src.grid.forEach((x, y, z, v) => m.set(z, y, x, v));
  return m;
}

/** Four rubber levelling feet with steel collars under a box footprint. */
function levelFeet(m: Model, x0: number, z0: number, x1: number, z1: number): void {
  for (const [x, z] of [
    [x0, z0],
    [x1 - 1, z0],
    [x0, z1 - 1],
    [x1 - 1, z1 - 1],
  ] as const) {
    m.box(x, 0, z, x + 1, 0, z + 1, C.rubber);
    m.box(x, 1, z, x + 1, 1, z + 1, C.steel);
  }
}

// ── Hero kit (the story devices) ─────────────────────────────────

/**
 * Glass viewport on a face: a proud `frame` around (u0..u1, v0..v1), the
 * cavity behind carved `depth` deep onto a dark `back`, and glass one voxel
 * proud — whatever is drawn (or mounted) in the cavity shows through, and
 * goes dark with the power.
 */
function viewport(
  m: Model,
  face: "+x" | "-x" | "+z" | "-z" | "+y",
  at: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  depth: number,
  frame: number = C.steel,
  glass: number = C.glass,
  back: number = C.black,
): void {
  faceRect(m, face, at, u0 - 1, v0 - 1, u1 + 1, v1 + 1, -1, frame);
  for (let d = 0; d < depth; d++) faceRect(m, face, at, u0, v0, u1, v1, d, 0);
  faceRect(m, face, at, u0, v0, u1, v1, depth, back);
  faceRect(m, face, at, u0, v0, u1, v1, -1, glass);
}

/** Hollow glass drum (single-voxel wall) between two metal collar rings. */
function glassDrum(
  m: Model,
  cx: number,
  cz: number,
  r: number,
  y0: number,
  y1: number,
  glass: number = C.glass,
  collar: number = C.steel_dark,
): void {
  for (let y = y0 + 1; y < y1; y++) m.ring(cx, cz, r, y, glass);
  m.ring(cx, cz, r, y0, collar);
  m.ring(cx, cz, r, y1, collar);
}

/** Copper coil stack (alternating copper / bronze turns) around a vertical core. */
function coilStack(m: Model, cx: number, cz: number, r: number, y0: number, y1: number): void {
  m.cyl(cx, cz, Math.max(0.8, r - 1.4), y0, y1, C.steel_dark);
  for (let y = y0; y <= y1; y++) m.ring(cx, cz, r, y, y % 2 ? C.copper : C.bronze);
}

/** Ring of single LEDs (radius r, n lights) in the xz plane — spun, the lights chase. */
function ledRing(r: number, n: number, colors: readonly number[], rail?: number): Model {
  const m =
    rail === undefined
      ? new Model(2 * Math.ceil(r) + 3, 1, 2 * Math.ceil(r) + 3)
      : ringModel(r, "xz", rail);
  const ctr = (m.w - 1) / 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    m.set(
      Math.round(ctr + Math.cos(a) * r),
      0,
      Math.round(ctr + Math.sin(a) * r),
      colors[i % colors.length]!,
    );
  }
  return m;
}

/** Nested gimbal ring (+y frame) with two bearing pins on the u axis. */
function gimbalRing(r: number, plane: "xy" | "yz" | "xz", c: number, pin: number): Model {
  const m = ringModel(r, plane, c);
  const ctr = (m.w - 1) / 2;
  const cy = (m.h - 1) / 2;
  const cz = (m.d - 1) / 2;
  const e = Math.round(r);
  if (plane === "xy") m.set(ctr - e, cy, 0, pin).set(ctr + e, cy, 0, pin);
  else if (plane === "yz") m.set(0, cy - e, cz, pin).set(0, cy + e, cz, pin);
  else m.set(ctr - e, 0, cz, pin).set(ctr + e, 0, cz, pin);
  return m;
}

// ── Tier 1 ───────────────────────────────────────────────────────

function mcp(): DeviceVisual {
  // Black monolith with the red eye; 36×40×20 at DETAIL_SCALE.
  const m = new Model(36, 40, 20);
  const F = "+z";
  plinth(m, 0, 0, 35, 19, 3);
  hazardFace(m, F, 19, 1, 1, 34, 2);
  chamferBox(m, 2, 3, 1, 33, 36, 15, C.paint_black, C.steel_dark);
  seam(m, F, 15, 3, 12, 32, 12);
  seam(m, F, 15, 3, 16, 32, 16);
  seam(m, F, 15, 9, 3, 9, 11);
  seam(m, F, 15, 25, 3, 25, 11);
  // Scanner slot.
  grille(m, F, 15, 7, 13, 27, 14, 2, C.black);
  // Eye socket: chrome ring, recessed black well.
  discXY(m, 17, 27, 15, 8.8, C.chrome);
  discXY(m, 17, 27, 15, 7.8, 0);
  discXY(m, 17, 27, 14, 7.8, 0);
  discXY(m, 17, 27, 13, 7.8, C.black);
  discXY(m, 17, 27, 16, 8.8, C.steel_dark, true);
  // Memory columns either side of the eye: smoked glass over a data bus
  // whose nodes glow red while the MCP thinks.
  for (const x0 of [4, 28]) {
    viewport(m, F, 15, x0, 18, x0 + 2, 35, 3, C.steel_dark, C.glass_dark);
    faceRect(m, F, 15, x0 + 1, 18, x0 + 1, 35, 3, C.steel_dark);
    for (let y = 19; y <= 34; y += 3)
      faceSet(m, F, 15, x0 + ((y / 3) % 2 ? 0 : 2), y, 2, y % 2 ? C.mcp_red : C.steel);
  }
  const screens: ScreenSpec[] = [
    bezelScreen(m, F, 15, 4, 5, 15, 10, "log", { color: "#ff2a1a" }),
    bezelScreen(m, F, 15, 19, 5, 30, 10, "face", { color: "#ff2a1a" }),
  ];
  // Ledge: key row and the big red button.
  for (let x = 6; x <= 26; x += 2) m.set(x, 3, 17, x === 16 ? C.safety_red : C.paint_gray);
  m.box(29, 3, 16, 32, 3, 19, C.safety_yellow).box(30, 4, 17, 31, 4, 18, C.safety_red);
  coffeeRing(m, 3.5, 2, 17.5, 1.3);
  stickyNote(m, F, 15, 29, 12);
  rustStreak(m, F, 15, 32, 17, 24);
  // Rivet line under the crown, a status row on the crown's lip.
  rivetRow(m, F, 15, 3, 31, 34, 4);
  ledRow(m, F, 12, 11, 37, 8, 2, [C.led_green, C.led_green, C.led_amber, C.led_red]);
  // Crown with a top grille.
  chamferBox(m, 9, 37, 3, 26, 38, 12, C.steel_dark, C.steel);
  grille(m, "+y", 38, 11, 5, 24, 10, 1);
  // Antenna collar on the crown (the array itself turns above it).
  m.box(15, 39, 6, 20, 39, 9, C.steel_dark).box(16, 39, 7, 19, 39, 8, C.chrome);
  // Side vents, name and cable harnesses to the floor.
  grille(m, "+x", 33, 3, 18, 13, 33, 2, C.steel_dark, C.steel);
  grille(m, "-x", 2, 3, 18, 13, 33, 2, C.steel_dark, C.steel);
  stencil(m, "+x", 33, 14, 6, "MCP", C.safety_red);
  scorch(m, "+x", 33, 8, 35, 2.2);
  harness(
    m,
    [
      [9, 37, 4],
      [1, 37, 4],
      [1, 0, 4],
    ],
    [C.cable_red, C.cable_black, C.cable_yellow],
    "z",
  );
  harness(
    m,
    [
      [26, 37, 6],
      [34, 37, 6],
      [34, 0, 6],
    ],
    [C.cable_black, C.safety_blue],
    "z",
  );
  dust(m, 3);
  const eye = eyeDisc(6.8, [
    [2.5, C.white_gold],
    [9, C.mcp_red],
    [26, C.led_red],
    [99, C.red_paint],
  ]);
  return detailVisual(
    m,
    [
      mount("eye", eye, [17.5, 27.5, 14.5], "pulse", {
        speed: 0.35,
        amplitude: 0.6,
      }),
      mount("iris", ringModel(6.6, "xy", C.steel_dark, C.mcp_red), [17.5, 27.5, 16.5], "spin", {
        axis: "z",
        speed: 0.4,
      }),
      mount(
        "status_l",
        ledStrip(8, [C.led_amber, C.led_green], 2, "y"),
        [5.5, 26.5, 14.5],
        "blink",
        {
          speed: 1.2,
          amplitude: 0.6,
        },
      ),
      mount(
        "status_r",
        ledStrip(8, [C.led_green, C.led_red], 2, "y"),
        [29.5, 26.5, 14.5],
        "blink",
        {
          speed: 0.9,
          amplitude: 0.5,
          phase: 2,
        },
      ),
      mount("aperture", ringModel(4, "xy", C.steel, C.mcp_red), [17.5, 27.5, 15.5], "step", {
        axis: "z",
        speed: 1.25,
        amplitude: -TAU / 8,
      }),
      mount("scanner", block(3, 1, 1, C.mcp_red), [17.5, 13.5, 14.5], "slide", {
        speed: 0.35,
        amplitude: 8,
      }),
      mount("array", mcpArray(), [18, 40, 8], "sweep", {
        speed: 0.08,
        amplitude: 0.7,
        pivot: [8.5, 0, 2.5],
      }),
      mount("beacon", block(1, 1, 1, C.mcp_red), [9, 11.5, 2.5], "blink", {
        speed: 0.5,
        amplitude: 0.25,
        parent: "array",
      }),
      mount("bus_l", block(1, 3, 1, C.mcp_red), [4.5, 26.5, 14.5], "slide", {
        axis: "y",
        speed: 0.6,
        amplitude: 7,
      }),
      mount("bus_r", block(1, 3, 1, C.mcp_red), [30.5, 26.5, 14.5], "slide", {
        axis: "y",
        speed: 0.45,
        amplitude: 7,
        phase: Math.PI,
      }),
    ],
    [glow([17.5, 27.5, 18], "mcp_red", 25, 12), glow([17.5, 13.5, 17], "mcp_red", 4, 4)],
    screens,
  );
}

/** The MCP's crown array: mast, two crossbars with dipoles, feed horn (pivot at the foot). */
function mcpArray(): Model {
  const a = new Model(17, 11, 5);
  a.box(8, 0, 2, 8, 10, 2, C.steel).box(7, 0, 1, 9, 1, 3, C.steel_dark);
  a.box(1, 4, 2, 15, 4, 2, C.chrome).box(3, 8, 2, 13, 8, 2, C.chrome);
  for (const x of [1, 5, 11, 15]) a.box(x, 3, 2, x, 5, 2, C.steel_dark);
  for (const x of [3, 13]) a.box(x, 7, 2, x, 9, 2, C.steel_dark);
  // Feed horn facing the room, a cable spiralling up the mast.
  a.box(7, 5, 3, 9, 6, 4, C.paint_black).set(8, 6, 4, C.mcp_red);
  for (let y = 1; y <= 9; y += 2) a.set(y % 4 === 1 ? 7 : 9, y, 2, C.cable_red);
  return a;
}

function clk(): DeviceVisual {
  // Wall clock: brass dial with sweeping hands over a digital readout.
  const m = new Model(22, 28, 8);
  const F = "+z";
  m.box(1, 0, 0, 20, 27, 1, C.steel_dark);
  cornerScrews(m, F, 1, 2, 1, 19, 26);
  seam(m, F, 1, 1, 8, 20, 8);
  // Dial: brass case, cream face, proud bezel, ticks.
  discXY(m, 10.5, 17, 2, 9.6, C.brass);
  discXY(m, 10.5, 17, 3, 9.6, C.brass);
  discXY(m, 10.5, 17, 3, 8.4, C.paint_cream);
  discXY(m, 10.5, 17, 4, 9.6, C.bronze, true);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const major = i % 3 === 0;
    for (const r of major ? [6.4, 7.4] : [7.2])
      m.set(Math.round(10.5 + Math.sin(a) * r), Math.round(17 + Math.cos(a) * r), 3, C.paint_black);
  }
  m.box(4, 1, 2, 17, 6, 2, C.metal_dark);
  const screens = [bezelScreen(m, F, 2, 5, 2, 16, 5, "clock", { color: "#33FF33" })];
  // Bezel screws, maker's plate over the dial, escapement window bottom-left.
  for (const a of [0.785, 2.356, 3.927, 5.498])
    m.set(Math.round(10.5 + Math.cos(a) * 9), Math.round(17 + Math.sin(a) * 9), 4, C.chrome);
  m.box(8, 12, 3, 13, 12, 3, C.brass).box(9, 12, 3, 12, 12, 3, C.bronze);
  // Escapement window: a glazed brass bezel over the ticking works (the
  // escape wheel proud, the balance wheel rocking in the well behind it).
  m.box(1, 2, 1, 3, 6, 1, C.black);
  for (let y = 1; y <= 7; y++)
    for (let x = 0; x <= 4; x++)
      m.set(x, y, 4, x === 0 || x === 4 || y === 1 || y === 7 ? C.brass : C.glass);
  stickyNote(m, F, 1, 17, 23, C.paper_pink);
  rustStreak(m, F, 1, 2, 9, 12);
  // Mains feed: a twin cable out of the case bottom-right, down to the skirting.
  harness(
    m,
    [
      [19, 7, 2],
      [19, 0, 2],
    ],
    [C.cable_black, C.cable_red],
    "x",
  );
  return detailVisual(
    m,
    [
      mount("hour_hand", needleModel(4, C.paint_black, C.brass), [11, 17.5, 4.5], "spin", {
        axis: "z",
        speed: -TAU / 43200,
        phase: 2.2,
        pivot: [0.5, 0.5, 0.5],
      }),
      mount("minute_hand", needleModel(6, C.paint_black, C.brass), [11, 17.5, 5.5], "spin", {
        axis: "z",
        speed: -TAU / 3600,
        phase: 1,
        pivot: [0.5, 0.5, 0.5],
      }),
      mount("second_hand", needleModel(7, C.safety_red, C.safety_red), [11, 17.5, 6.5], "step", {
        axis: "z",
        speed: 1,
        amplitude: -TAU / 60,
        pivot: [0.5, 0.5, 0.5],
      }),
      mount("escapement", gearModel(1.5, C.brass, C.chrome, 6), [2.5, 4.5, 3.5], "step", {
        axis: "z",
        speed: 2,
        amplitude: TAU / 12,
      }),
      mount("sync", block(1, 1, 1, C.led_green), [18.5, 3.5, 3.5], "blink", {
        speed: 1,
      }),
      mount("balance", ringModel(1, "xy", C.brass, C.chrome), [2.5, 4.5, 2.5], "sway", {
        axis: "z",
        speed: 2,
        amplitude: 0.9,
      }),
    ],
    [glow([11, 3.5, 4.5], "screen_green", 2, 3)],
    screens,
  );
}

function vnt(): DeviceVisual {
  // Fan cabinet with a guarded intake, top exhaust and a hose to the wall.
  const m = new Model(26, 36, 24);
  const F = "+z";
  plinth(m, 0, 0, 25, 23, 2);
  chamferBox(m, 1, 2, 1, 24, 29, 21, C.aluminium, C.steel_dark);
  seam(m, F, 21, 2, 28, 23, 28);
  // Intake: shroud, 2-deep well, motor hub, chrome guard.
  discXY(m, 12.5, 17, 22, 10.6, C.steel_dark, true);
  discXY(m, 12.5, 17, 21, 9.6, 0);
  discXY(m, 12.5, 17, 20, 9.6, 0);
  discXY(m, 12.5, 17, 19, 9.6, C.black);
  discXY(m, 12.5, 17, 19, 2.2, C.metal_dark);

  m.box(3, 17, 22, 22, 17, 22, C.chrome).box(12, 8, 22, 13, 26, 22, C.chrome);
  cornerScrews(m, F, 21, 3, 3, 22, 27);
  stencil(m, F, 21, 3, 2, "VNT-1", C.paint_black);
  rustStreak(m, F, 21, 3, 20, 26);
  stickyNote(m, F, 21, 19, 24, C.paper_yellow);
  // Side intake, control screen.
  grille(m, "+x", 24, 4, 4, 18, 16, 2, C.steel_dark, C.steel);
  grille(m, "-x", 1, 4, 4, 18, 16, 2, C.steel_dark, C.steel);
  const screens = [bezelScreen(m, "+x", 24, 10, 20, 18, 25, "bars", { color: "#00FFFF" })];
  // Filter-change tag and rivet lines along the cabinet shoulders.
  rivetRow(m, F, 21, 3, 22, 29, 3, C.steel_dark);
  rivetRow(m, "+x", 24, 3, 20, 27, 3, C.steel_dark);
  serialPlate(m, F, 21, 17, 2, [], { w: 5, barcode: true });
  ledRow(m, "+x", 24, 6, 22, 2, 2, [C.led_green, C.led_amber]);
  // Top exhaust with its fan, corrugated hose to the wall.
  chamferBox(m, 6, 30, 5, 19, 31, 17, C.steel, C.steel_dark);
  m.cyl(12.5, 11, 4.6, 31, 31, 0);
  m.cyl(12.5, 11, 4.6, 30, 30, C.black);
  for (let z = 0; z <= 4; z++) m.box(9, 30, z, 16, 31, z, z % 2 ? C.steel_dark : C.steel);
  // Rain-hat cowl on four stilts over the exhaust (the fan shows in the gap).
  for (const [x, z] of [
    [7, 6],
    [18, 6],
    [7, 16],
    [18, 16],
  ] as const)
    m.box(x, 32, z, x, 33, z, C.steel_dark);
  chamferBox(m, 5, 34, 4, 20, 35, 18, C.aluminium, C.steel);
  rivetRow(m, F, 18, 7, 18, 34, 3, C.steel_dark);
  // HEPA inspection window on the left flank: the pleated filter behind
  // glass, a flow vane turning in the airstream in front of it.
  viewport(m, "-x", 1, 5, 20, 17, 25, 3);
  for (let u = 5; u <= 17; u++)
    for (let v = 20; v <= 25; v++)
      faceSet(m, "-x", 1, u, v, 3, u % 2 ? C.paper : v < 22 ? C.dust : C.concrete_light);
  // Cassette rails above and below the window, the pull tab, and the
  // differential-pressure gauge that says when the filter is clogged.
  for (const v of [18, 27]) faceRect(m, "-x", 1, 3, v, 19, v, -1, C.steel_dark);
  faceRect(m, "-x", 1, 10, 26, 12, 26, -1, C.safety_orange);
  for (let v = 19; v <= 26; v++) faceSet(m, "-x", 1, 19, v, -1, C.steel_dark);
  // Motor feed: a yellow conduit from the exhaust housing down the back corner.
  harness(
    m,
    [
      [6, 30, 3],
      [0, 30, 3],
      [0, 0, 3],
    ],
    [C.cable_yellow, C.cable_black],
    "z",
  );
  dust(m, 3);
  const ribbon = new Model(1, 5, 1);
  ribbon.box(0, 0, 0, 0, 3, 0, C.fabric_red).set(0, 4, 0, C.cable_black);
  return detailVisual(
    m,
    [
      mount("fan", fanRotor(8, "xy", C.steel_dark, C.chrome), [13, 17.5, 20.5], "spin", {
        axis: "z",
        speed: 9,
      }),
      mount("top_fan", fanRotor(4, "xz"), [13, 31.5, 11.5], "spin", {
        speed: 7,
      }),
      mount("ribbon", ribbon, [18.5, 24.5, 23.5], "sway", {
        axis: "x",
        speed: 2.6,
        amplitude: 0.6,
        pivot: [0.5, 5, 0.5],
      }),
      mount("status", block(1, 1, 1, C.led_green), [20.5, 3.5, 22.5], "blink", {
        speed: 0.7,
        amplitude: 0.8,
      }),
      mount("flap", block(1, 3, 15, C.steel), [25.5, 17.5, 11.5], "sway", {
        axis: "z",
        speed: 1.7,
        amplitude: -0.3,
        pivot: [0.5, 3, 7.5],
      }),
      mount(
        "flow_vane",
        yzModel(fanRotor(2, "xy", C.safety_orange, C.steel_dark)),
        [2.5, 22.5, 11.5],
        "spin",
        { axis: "x", speed: 5 },
      ),
    ],
    [glow([22.5, 3.5, 23], "led_green", 2, 3), glow([25, 22.5, 14], "screen_cyan", 2, 3)],
    screens,
  );
}

function btk(): DeviceVisual {
  // Shadow-board tool wall above a drawer cabinet; one tool is missing.
  const m = new Model(28, 28, 10);
  const F = "+z";
  m.box(0, 6, 0, 27, 27, 1, C.steel_dark);
  cornerScrews(m, F, 1, 1, 7, 26, 26);
  m.box(2, 8, 2, 25, 26, 2, C.orange_paint);
  for (let x = 4; x <= 24; x += 3)
    for (let y = 10; y <= 25; y += 3) m.set(x, y, 2, 0).set(x, y, 1, C.black);
  // Wrench.
  m.box(5, 11, 3, 5, 20, 3, C.chrome);
  m.box(4, 21, 3, 6, 21, 3, C.chrome)
    .box(4, 22, 3, 4, 23, 3, C.chrome)
    .box(6, 22, 3, 6, 23, 3, C.chrome);
  m.box(4, 9, 3, 6, 10, 3, C.chrome).set(5, 9, 3, 0);
  // The missing screwdriver: painted outline + a note.
  for (const [x, y] of [
    [8, 17],
    [8, 18],
    [8, 19],
    [8, 20],
    [8, 21],
    [10, 17],
    [10, 18],
    [10, 19],
    [10, 20],
    [10, 21],
    [9, 21],
    [9, 16],
    [9, 15],
    [9, 14],
    [9, 13],
    [9, 12],
  ] as const)
    m.set(x, y, 2, C.paint_white);
  stickyNote(m, F, 2, 11, 22, C.paper_yellow, C.safety_red);
  // Hammer.
  m.box(15, 9, 3, 15, 20, 3, C.wood);
  m.box(15, 11, 3, 15, 12, 3, C.leather);
  m.box(13, 21, 3, 18, 23, 4, C.metal).box(17, 22, 3, 18, 23, 4, C.steel_dark);
  // Pliers.
  m.box(20, 9, 3, 20, 14, 3, C.safety_blue).box(23, 9, 3, 23, 14, 3, C.safety_blue);
  m.box(21, 15, 3, 22, 15, 3, C.chrome).box(21, 16, 3, 22, 19, 3, C.steel);
  m.set(21, 15, 4, C.chrome);
  // Jade's initials in white paint.
  stencil(m, F, 2, 19, 21, "JL", C.paint_white);
  // Work light across the top.
  m.box(3, 26, 3, 24, 27, 5, C.metal_dark);
  m.box(4, 26, 5, 23, 26, 5, C.white_gold);
  // Frosted diffuser in front of the work light, the gripper rail along
  // the foot of the board and the feed cable down the cabinet front.
  m.box(3, 25, 6, 24, 26, 6, C.glass).box(3, 27, 6, 24, 27, 6, C.metal_dark);
  m.box(1, 7, 4, 26, 7, 5, C.steel).box(1, 7, 6, 26, 7, 6, C.steel_dark);
  for (const x of [1, 26]) m.box(x, 7, 4, x, 8, 6, C.metal_dark);
  // Drawer cabinet.
  chamferBox(m, 0, 0, 0, 27, 6, 8, C.metal, C.steel_dark);
  hazardFace(m, "+y", 6, 1, 7, 26, 7);
  for (const [x0, x1] of [
    [1, 9],
    [18, 26],
  ] as const) {
    seam(m, F, 8, x0, 1, x1, 1);
    seam(m, F, 8, x0, 5, x1, 5);
    seam(m, F, 8, x0, 1, x0, 5);
    seam(m, F, 8, x1, 1, x1, 5);
    faceRect(m, F, 8, x0 + 3, 3, x1 - 3, 3, -1, C.chrome);
  }
  const screens = [bezelScreen(m, F, 8, 12, 2, 15, 4, "status", { color: "#FFB800" })];
  stencil(m, "+x", 27, 6, 1, "BTK", C.paint_black);
  // Pegboard hooks, drawer label cards and rivets along the board frame.
  for (const x of [12, 21]) m.box(x, 24, 3, x, 24, 4, C.chrome);
  for (const x0 of [3, 20]) m.box(x0, 4, 9, x0 + 3, 4, 9, C.paper);
  rivetRow(m, F, 1, 3, 25, 7, 4, C.steel);
  dust(m, 2);
  harness(
    m,
    [
      [10, 6, 9],
      [10, 0, 9],
    ],
    [C.cable_black],
    "x",
  );
  const arm = (): Model => {
    const a = new Model(3, 12, 2);
    a.box(1, 3, 0, 1, 11, 1, C.steel_dark).box(1, 7, 0, 1, 7, 1, C.brass);
    a.box(0, 2, 0, 2, 2, 1, C.chrome)
      .box(0, 0, 0, 0, 1, 1, C.chrome)
      .box(2, 0, 0, 2, 1, 1, C.chrome);
    return a;
  };
  return detailVisual(
    m,
    [
      mount("arm_l", arm(), [1.5, 26, 4], "sway", {
        speed: 0.25,
        amplitude: 0.35,
        pivot: [1.5, 12, 1],
      }),
      mount("arm_r", arm(), [26.5, 26, 4], "sway", {
        speed: 0.25,
        amplitude: 0.35,
        phase: Math.PI,
        pivot: [1.5, 12, 1],
      }),
      mount("status", block(1, 1, 1, C.led_amber), [24.5, 24.5, 3.5], "blink", {
        speed: 0.8,
        amplitude: 0.3,
      }),
      mount("carriage", btkCarriage(), [13.5, 8, 5], "slide", {
        speed: 0.12,
        amplitude: 9,
        pivot: [1.5, 0, 1],
      }),
      mount("claw", btkClaw(), [1.5, 3, 1], "piston", {
        speed: 0.24,
        amplitude: 1,
        pivot: [1.5, 0, 1],
        parent: "carriage",
      }),
      mount("tape", reelModel(1.6, C.safety_yellow, C.paint_black), [12.5, 21.5, 5.5], "sway", {
        axis: "z",
        speed: 0.4,
        amplitude: 0.35,
        power: false,
        pivot: [2.5, 4.5, 0.5],
      }),
    ],
    [glow([13.5, 25, 6], "white_gold", 4, 5), glow([24.5, 24.5, 4], "led_amber", 2, 3)],
    screens,
  );
}

/** BTK gripper carriage: a trolley riding the rail (pivot at its foot). */
function btkCarriage(): Model {
  const c = new Model(3, 3, 2);
  c.box(0, 0, 0, 2, 2, 1, C.safety_orange).box(0, 2, 0, 2, 2, 1, C.steel_dark);
  return c.set(1, 1, 1, C.led_amber);
}

/** BTK claw riding on the carriage: a stem and two chrome jaws reaching up. */
function btkClaw(): Model {
  const c = new Model(3, 3, 2);
  c.box(1, 0, 0, 1, 1, 1, C.steel);
  return c.box(0, 1, 0, 0, 2, 1, C.chrome).box(2, 1, 0, 2, 2, 1, C.chrome);
}

function bat(): DeviceVisual {
  // Three cells on a charge tray, bus bars on top, one cell leaking.
  const m = new Model(32, 24, 18);
  const F = "+z";
  plinth(m, 0, 0, 31, 16, 2);
  chamferBox(m, 0, 2, 0, 31, 7, 16, C.steel_dark, C.steel);
  const screens = [bezelScreen(m, F, 16, 3, 3, 12, 6, "power", { color: "#00FF66" })];
  ledRow(m, F, 16, 16, 5, 4, 2, [C.led_green, C.led_green, C.led_amber, C.led_red]);
  stickyNote(m, F, 16, 25, 3, C.paper_yellow);
  rivetRow(m, F, 16, 15, 23, 2, 2, C.steel);
  const levels = [9, 6, 3];
  const parts: AnimPart[] = [];
  for (let i = 0; i < 3; i++) {
    const x0 = 1 + i * 10;
    chamferBox(m, x0, 8, 3, x0 + 7, 21, 14, C.blue_paint, C.steel_dark);
    seam(m, F, 14, x0 + 1, 12, x0 + 6, 12);
    // Charge window with a steel frame.
    faceRect(m, F, 14, x0 + 1, 13, x0 + 6, 20, -1, C.steel);
    faceRect(m, F, 14, x0 + 2, 14, x0 + 5, 19, -1, C.glass_dark);
    faceRect(m, F, 14, x0 + 2, 14, x0 + 5, 19, 0, 0);
    faceRect(m, F, 14, x0 + 2, 14, x0 + 5, 19, 1, C.black);
    stencil(m, F, 14, x0 + 3, 7, `${i + 1}`, C.paint_white);
    // Terminals.
    m.box(x0 + 2, 22, 6, x0 + 3, 22, 7, C.copper).box(x0 + 2, 23, 6, x0 + 3, 23, 7, C.safety_red);
    m.box(x0 + 4, 22, 10, x0 + 5, 22, 11, C.copper).box(
      x0 + 4,
      23,
      10,
      x0 + 5,
      23,
      11,
      C.paint_black,
    );
    const bar = new Model(4, 6, 1);
    const lv = levels[i]!;
    for (let y = 0; y < 6; y++)
      if (y < Math.ceil((lv * 6) / 10))
        bar.box(0, y, 0, 3, y, 0, lv < 4 ? C.led_red : y >= 4 ? C.led_amber : C.led_green);
    parts.push(
      mount(`charge_${i}`, bar, [x0 + 4, 17, 14.5], "blink", {
        speed: 0.5,
        amplitude: 0.85,
        phase: i * 2,
      }),
    );
  }
  // Bus bars and the feed down the side, with bolted lugs and cell vents.
  m.box(3, 22, 8, 25, 22, 8, C.copper);
  m.box(5, 22, 12, 27, 22, 12, C.bronze);
  for (let i = 0; i < 3; i++) {
    const x0 = 1 + i * 10;
    m.set(x0 + 2, 22, 8, C.chrome).set(x0 + 4, 22, 12, C.chrome);
    for (const x of [x0 + 1, x0 + 6]) m.set(x, 21, 4, C.black).set(x, 21, 13, C.black);
  }
  harness(
    m,
    [
      [26, 22, 8],
      [31, 22, 8],
      [31, 0, 8],
    ],
    [C.cable_red],
    "z",
  );
  harness(
    m,
    [
      [28, 22, 12],
      [31, 22, 12],
      [31, 0, 12],
    ],
    [C.cable_black],
    "z",
  );
  // Leaking cell 3: rust and scorch at the base.
  rustStreak(m, F, 14, 27, 8, 12);
  scorch(m, "+y", 7, 27, 15, 1.6);
  // Tray cooling fan on the left end, pulling air across the cells.
  fanPort(m, "-x", 0, 8, 4.5, 2);
  dust(m, 2);
  parts.push(
    mount("arc", block(1, 1, 1, C.white_gold), [26.5, 24.5, 11.5], "blink", {
      speed: 7,
      amplitude: 0.3,
    }),
    mount("current", block(1, 1, 1, C.led_amber), [14.5, 23.5, 8.5], "slide", {
      speed: 0.6,
      amplitude: 10,
    }),
    mount("tray_fan", yzModel(fanRotor(1, "xy", C.steel, C.metal_dark)), [1.5, 5, 8.5], "spin", {
      axis: "x",
      speed: 8,
    }),
  );
  return detailVisual(
    m,
    parts,
    [
      glow([16, 12, 18], "led_green", 6, 5),
      glow([26.5, 24.5, 11.5], "white_gold", 2, 3, true, true),
    ],
    screens,
  );
}

function pwb(): DeviceVisual {
  // Workbench: oak top, pegboard back, vise, soldering station, magnifier lamp.
  const m = new Model(32, 28, 22);
  const F = "+z";
  for (const [x, z] of [
    [0, 1],
    [30, 1],
    [0, 19],
    [30, 19],
  ] as const) {
    m.box(x, 1, z, x + 1, 11, z + 1, C.steel_dark);
    m.box(x, 0, z, x + 1, 0, z + 1, C.rubber);
  }
  // Lower shelf with a toolbox and a crate.
  m.box(0, 3, 1, 31, 3, 20, C.steel);
  m.box(0, 4, 20, 31, 4, 20, C.steel_dark);
  chamferBox(m, 3, 4, 7, 11, 8, 15, C.safety_red, C.red_paint);
  m.box(5, 9, 11, 9, 9, 11, C.paint_black).box(6, 7, 16, 8, 7, 16, C.chrome);
  m.box(16, 4, 5, 27, 10, 16, C.cardboard);
  m.box(21, 4, 17, 22, 10, 17, C.paper_yellow).box(16, 10, 10, 27, 10, 11, C.paper_yellow);
  stencil(m, F, 16, 17, 5, "UNL", C.paint_black);
  // Oak top with a steel nosing and wood grain.
  m.box(0, 12, 0, 31, 13, 21, C.oak);
  m.box(0, 12, 21, 31, 13, 21, C.steel);
  for (const z of [4, 9, 15]) m.box(1, 13, z, 30, 13, z, C.wood_light);
  // Pegboard back with holes.
  m.box(0, 14, 0, 31, 27, 1, C.wood_dark);
  for (let x = 2; x <= 30; x += 3) for (let y = 16; y <= 26; y += 3) m.set(x, y, 1, C.black);
  // Mini monitor on the pegboard.
  m.box(12, 18, 2, 21, 25, 2, C.metal_dark);
  const screens = [bezelScreen(m, F, 2, 13, 19, 20, 24, "status", { color: "#FFAA00" })];
  m.box(16, 14, 2, 17, 17, 2, C.steel_dark);
  // Fume extractor.
  chamferBox(m, 1, 14, 2, 8, 21, 6, C.steel_dark, C.steel);
  discXY(m, 4.5, 17.5, 6, 2.6, C.black);
  // Vice.
  m.box(2, 14, 15, 6, 16, 20, C.safety_blue).box(2, 17, 16, 6, 17, 17, C.chrome);
  m.box(2, 17, 19, 6, 17, 19, C.chrome).box(4, 15, 21, 4, 15, 21, C.chrome);
  // Soldering station, iron holder spring, parts tray.
  chamferBox(m, 9, 14, 14, 13, 16, 18, C.paint_black, C.metal_dark);
  knob(m, F, 18, 10, 14, C.safety_red);
  m.set(12, 15, 19, C.led_red);
  for (let y = 14; y <= 17; y++) m.set(15, y, 16, y % 2 ? C.copper : C.bronze);
  m.box(15, 18, 16, 15, 18, 18, C.chrome);
  m.box(17, 14, 15, 23, 14, 20, C.steel_dark);
  m.set(18, 15, 16, C.copper).set(20, 15, 18, C.gold).set(22, 15, 17, C.safety_green);
  m.set(19, 15, 19, C.safety_red).set(21, 15, 16, C.chrome);
  // Mug and its coffee ring.
  m.cyl(27, 16, 1.6, 14, 16, C.ceramic);
  m.cyl(27, 16, 0.8, 16, 16, C.coffee);
  m.box(29, 15, 16, 29, 15, 16, C.ceramic);
  coffeeRing(m, 23.5, 13, 9.5, 1.6);
  // Magnifier lamp on a chrome arm.
  m.box(27, 14, 2, 28, 14, 3, C.paint_black);
  m.box(27, 15, 2, 27, 25, 2, C.chrome).box(27, 25, 3, 27, 25, 11, C.chrome);
  m.box(24, 22, 10, 30, 23, 15, C.paint_teal);
  m.box(25, 22, 11, 29, 22, 14, C.glass);
  m.box(26, 23, 12, 28, 23, 13, C.white_gold);
  stickyNote(m, F, 1, 22, 22, C.paper_blue);
  stencil(m, F, 1, 22, 15, "JL", C.paint_white);
  // Screwdriver on the pegboard, clamp screws on the vice, toolbox latches.
  m.box(10, 20, 2, 10, 22, 2, C.chrome).box(10, 23, 2, 10, 26, 2, C.safety_red);
  m.set(4, 16, 21, C.chrome).set(2, 14, 21, C.steel).set(6, 14, 21, C.steel);
  m.set(4, 6, 16, C.chrome).set(10, 6, 16, C.chrome);
  // Bench power supply: glazed moving-coil meter, knob, binding posts and
  // test leads to the soldering station.
  chamferBox(m, 19, 14, 3, 25, 19, 8, C.paint_cream, C.paint_gray);
  viewport(m, F, 8, 20, 16, 24, 18, 1, C.paint_black);
  for (let x = 20; x <= 24; x++) m.set(x, 16, 8, x % 2 ? C.paint_black : C.paper);
  knob(m, F, 8, 20, 14, C.paint_black, C.safety_red);
  m.set(23, 14, 9, C.safety_red).set(24, 14, 9, C.paint_black);
  cableRun(
    m,
    [
      [23, 14, 10],
      [23, 14, 12],
      [14, 14, 12],
    ],
    C.cable_red,
  );
  dust(m, 2, 0.3);
  const smoke = new Model(1, 3, 1);
  smoke.set(0, 0, 0, C.concrete_light).set(0, 2, 0, C.concrete_light);
  return detailVisual(
    m,
    [
      mount("extractor_fan", fanRotor(2, "xy"), [5, 18, 7.5], "spin", {
        axis: "z",
        speed: 10,
      }),
      mount("solder_led", block(1, 1, 1, C.led_red), [10.5, 16.5, 18.5], "blink", {
        speed: 0.6,
        amplitude: 0.7,
      }),
      mount("smoke", smoke, [15.5, 20.5, 17.5], "bob", {
        speed: 0.5,
        amplitude: 1,
      }),
      mount("solder_reel", reelModel(2, C.copper, C.chrome), [5, 24.5, 2.5], "spin", {
        axis: "z",
        speed: 0.8,
      }),
      mount("psu_needle", needleModel(2, C.safety_red, C.paint_black), [22.5, 16, 8.5], "sweep", {
        axis: "z",
        speed: 0.3,
        amplitude: 0.7,
        pivot: [0.5, 0.5, 0.5],
      }),
    ],
    [glow([27, 21, 12.5], "white_gold", 5, 5), glow([16.5, 21.5, 4], "screen_amber", 2, 3)],
    screens,
  );
}

function cdc(): DeviceVisual {
  // Chrome rack: glass door over crystal slot trays, crystal chamber on top.
  const m = new Model(26, 40, 20);
  const F = "+z";
  plinth(m, 0, 0, 23, 17, 3);
  chamferBox(m, 0, 3, 0, 23, 27, 16, C.chrome, C.steel);
  seam(m, F, 16, 1, 22, 22, 22);
  // Door frame, recessed trays, glass.
  faceRect(m, F, 16, 1, 5, 22, 21, -1, C.steel);
  faceRect(m, F, 16, 3, 7, 20, 19, -1, 0);
  faceRect(m, F, 16, 3, 7, 20, 19, 0, 0);
  faceRect(m, F, 16, 3, 7, 20, 19, 1, 0);
  faceRect(m, F, 16, 3, 7, 20, 19, 2, C.metal_dark);
  const warm: [number, number] = [13, 12];
  for (const y of [7, 11, 15]) {
    m.box(3, y, 14, 20, y, 16, C.steel_dark);
    for (let x = 4; x <= 18; x += 3)
      if (x !== warm[0] || y + 1 !== warm[1])
        m.box(x, y + 1, 15, x + 1, y + 2, 15, (x + y) % 2 ? C.crystal_cyan : C.crystal_violet);
  }
  faceRect(m, F, 16, 3, 7, 20, 19, -1, C.glass);
  cornerScrews(m, F, 16, 1, 5, 22, 21);
  // Door hinges, tray index tabs and a chamber collar with bolts.
  for (const y of [8, 17]) m.box(1, y, 18, 1, y + 1, 18, C.chrome);
  for (const y of [8, 12, 16]) m.set(2, y, 17, C.paper);
  faceRect(m, F, 16, 21, 11, 21, 15, -2, C.chrome);
  const screens = [
    bezelScreen(m, F, 16, 3, 23, 20, 26, "spectrum", { color: "#00FFFF" }),
    bezelScreen(m, "+x", 23, 4, 14, 11, 20, "code", { color: "#b070ff" }),
  ];
  grille(m, "+x", 23, 4, 4, 13, 11, 2, C.steel_dark);
  stickyNote(m, "+x", 23, 11, 22, C.paper_pink);
  stencil(m, F, 17, 6, 0, "CDC-1", C.safety_yellow);
  // Crystal chamber: posts, glass tube, emitter, cap.
  m.box(1, 28, 1, 22, 28, 15, C.metal_dark);
  m.cyl(11.5, 8, 2.2, 28, 28, C.neon_purple);
  glassTube(m, 11.5, 8, 5.2, 29, 36, C.glass_purple, C.chrome);
  for (const [x, z] of [
    [3, 2],
    [19, 2],
    [3, 13],
    [19, 13],
  ] as const)
    m.box(x, 29, z, x + 1, 36, z + 1, C.chrome);
  m.box(2, 37, 1, 21, 37, 15, C.steel).box(4, 37, 3, 19, 37, 13, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    m.set(Math.round(11.5 + Math.cos(a) * 6.6), 29, Math.round(8 + Math.sin(a) * 6.6), C.brass);
  }
  m.box(4, 37, 7, 19, 37, 8, C.steel_dark);
  // Crown: four chrome claws leaning over the chamber, a centre prong.
  for (const [x, z, dx, dz] of [
    [4, 3, 1, 1],
    [19, 3, -1, 1],
    [4, 13, 1, -1],
    [19, 13, -1, -1],
  ] as const) {
    m.set(x, 38, z, C.chrome).set(x + dx, 39, z + dz, C.chrome);
    m.set(x + 2 * dx, 39, z + 2 * dz, C.crystal_violet);
  }
  m.box(11, 38, 7, 12, 38, 8, C.steel_dark).box(11, 39, 7, 12, 39, 8, C.neon_purple);
  // Reader rail across the top of the tray bay (the head runs on it).
  m.box(3, 19, 14, 20, 19, 14, C.steel_dark);
  // Crystal feed line from the chamber down the side to the floor.
  pipeElbow(m, 24, 4, 15, 24, 0, "x", C.copper);
  m.box(22, 28, 15, 24, 28, 15, C.copper);
  harness(
    m,
    [
      [23, 27, 3],
      [25, 27, 3],
      [25, 0, 3],
    ],
    [C.cable_black, C.cable_yellow],
    "z",
  );
  rustStreak(m, F, 16, 2, 4, 8);
  dust(m, 3);
  const shard = gem(4, 1, C.crystal_cyan, C.screen_cyan);
  return detailVisual(
    m,
    [
      mount("crystal", gem(7, 2.4, C.crystal_violet, C.abstractum), [12, 33.5, 8.5], "spin", {
        speed: 0.8,
      }),
      mount("shard_a", shard, [12, 32, 8.5], "orbit", {
        speed: 1.4,
        amplitude: 3.5,
      }),
      mount("shard_b", shard, [12, 34, 8.5], "orbit", {
        speed: -1.1,
        amplitude: 3.5,
        phase: 3,
      }),
      mount("warm_slice", block(2, 2, 1, C.plasma), [14, 13, 15.5], "pulse", {
        speed: 0.3,
        amplitude: 0.6,
      }),
      mount(
        "slot_leds",
        ledStrip(3, [C.neon_purple, C.led_green, C.screen_cyan], 4, "y"),
        [22.5, 13.5, 18.5],
        "blink",
        { speed: 1.7, amplitude: 0.6 },
      ),
      mount("reader", cdcReader(), [12, 19, 16], "slide", {
        speed: 0.18,
        amplitude: 7,
      }),
      mount("laser", block(1, 2, 1, C.neon_purple), [12, 30, 8.5], "blink", {
        speed: 3.2,
        amplitude: 0.7,
      }),
      mount("read_ring", ringModel(6.4, "xz", C.chrome, C.neon_purple), [12, 32.5, 8.5], "piston", {
        speed: 0.35,
        amplitude: 3,
      }),
    ],
    [
      glow([12, 32.5, 8.5], "neon_purple", 8, 6),
      glow([12, 25, 18], "screen_cyan", 5, 5),
      glow([15, 13, 16.5], "plasma", 2, 3),
    ],
    screens,
  );
}

/** Tray reader head: chrome carriage with a cyan read laser underneath. */
function cdcReader(): Model {
  return new Model(3, 2, 2)
    .box(0, 1, 0, 2, 1, 1, C.chrome)
    .box(0, 0, 0, 2, 0, 0, C.steel_dark)
    .set(1, 0, 1, C.screen_cyan);
}

function mem(): DeviceVisual {
  // Green cabinet with a window onto the DIMM slots.
  const m = new Model(20, 30, 16);
  const F = "+z";
  plinth(m, 1, 0, 18, 14, 2);
  chamferBox(m, 1, 2, 1, 18, 28, 13, C.green_paint, C.steel_dark);
  seam(m, F, 13, 2, 10, 17, 10);
  // DIMM window.
  faceRect(m, F, 13, 3, 11, 16, 22, -1, C.steel);
  faceRect(m, F, 13, 4, 12, 15, 21, -1, 0);
  faceRect(m, F, 13, 4, 12, 15, 21, 0, 0);
  faceRect(m, F, 13, 4, 12, 15, 21, 1, C.black);
  // Three seated DIMMs; the fourth slot's module is being reseated (a part).
  m.box(13, 12, 12, 14, 12, 12, C.paint_black);
  for (const x of [4, 7, 10]) {
    m.box(x, 12, 12, x + 1, 21, 12, C.safety_green);
    m.box(x, 12, 12, x + 1, 12, 12, C.gold);
    for (const y of [14, 17, 20]) m.box(x, y, 12, x + 1, y, 12, C.paint_black);
  }
  faceRect(m, F, 13, 4, 12, 15, 21, -1, C.glass);
  cornerScrews(m, F, 13, 3, 11, 16, 22);
  const screens = [bezelScreen(m, F, 13, 4, 4, 15, 8, "bars", { color: "#33FF33" })];
  // Screen-panel screws, DIMM latches and a rivet band under the fins.
  cornerScrews(m, F, 13, 2, 2, 17, 9, C.steel);
  for (const x of [4, 7, 10]) m.set(x, 21, 12, C.paper).set(x + 1, 21, 12, C.paper);
  // SPD probe rail across the top of the window, a test clip on the side.
  m.box(3, 23, 14, 16, 23, 14, C.steel_dark);
  harness(
    m,
    [
      [1, 16, 6],
      [0, 16, 6],
      [0, 0, 6],
    ],
    [C.cable_yellow],
    "z",
  );
  rivetRow(m, F, 13, 3, 16, 27, 2, C.steel_dark);
  stencil(m, F, 13, 2, 23, "MEM", C.paint_white);
  // Heat-sink fins on top.
  for (let x = 3; x <= 16; x += 2) m.box(x, 29, 3, x, 29, 11, C.aluminium);
  grille(m, "+x", 18, 3, 4, 11, 20, 2, C.steel_dark);
  harness(
    m,
    [
      [18, 24, 4],
      [19, 24, 4],
      [19, 0, 4],
    ],
    [C.cable_black, C.cable_red],
    "z",
  );
  stickyNote(m, "+x", 18, 9, 22, C.paper_pink);
  rustStreak(m, F, 13, 17, 12, 18);
  dust(m, 2);
  return detailVisual(
    m,
    [
      mount("activity", ledStrip(3, [C.led_green]), [15.5, 24.5, 14.5], "blink", {
        speed: 3,
        amplitude: 0.55,
      }),
      mount("rw", block(1, 1, 1, C.led_amber), [15.5, 26.5, 14.5], "blink", {
        speed: 1.3,
        amplitude: 0.3,
        phase: 1,
      }),
      mount("dimm_led", ledStrip(4, [C.led_green, C.led_amber], 3), [10, 20.5, 13.5], "pulse", {
        speed: 0.8,
        amplitude: 0.7,
      }),
      mount("refresh", block(1, 1, 1, C.led_green), [10, 12.5, 13.5], "slide", {
        speed: 0.9,
        amplitude: 5.5,
      }),
      mount("dimm_test", memDimm(), [14, 13, 13.5], "piston", {
        speed: 0.25,
        amplitude: 1,
        pivot: [1, 0, 0.5],
      }),
      mount("spd_probe", memProbe(), [9.5, 23, 15.5], "slide", {
        speed: 0.15,
        amplitude: 5,
        phase: 1,
        pivot: [1, 1, 0.5],
      }),
    ],
    [glow([10, 6.5, 15], "screen_green", 3, 4)],
    screens,
  );
}

/** The DIMM under test: green board, gold fingers, black chips, a paper label. */
function memDimm(): Model {
  const d = new Model(2, 8, 1);
  d.box(0, 0, 0, 1, 7, 0, C.safety_green).box(0, 0, 0, 1, 0, 0, C.gold);
  for (const y of [2, 5]) d.box(0, y, 0, 1, y, 0, C.paint_black);
  return d.box(0, 7, 0, 1, 7, 0, C.paper);
}

/** SPD probe head riding the rail: a clamp with a status LED and a pin. */
function memProbe(): Model {
  const p = new Model(2, 3, 1);
  p.box(0, 1, 0, 1, 2, 0, C.steel).set(1, 2, 0, C.led_amber);
  return p.set(0, 0, 0, C.chrome);
}

function cpu(): DeviceVisual {
  // Dark tower: heat-sink fins and a top fan, chip badge, load graph.
  const m = new Model(20, 32, 18);
  const F = "+z";
  plinth(m, 0, 0, 19, 16, 2);
  chamferBox(m, 1, 2, 1, 18, 24, 15, C.metal_dark, C.steel);
  seam(m, F, 15, 2, 14, 17, 14);
  // Chip badge.
  faceRect(m, F, 15, 5, 6, 14, 12, -1, C.steel);
  for (let x = 6; x <= 13; x += 2) m.set(x, 6, 16, C.chrome).set(x, 12, 16, C.chrome);
  // Glass lid over the die (the die itself glows in the well while it computes).
  viewport(m, F, 15, 7, 8, 12, 10, 1, C.steel, C.glass, C.copper);
  stencil(m, F, 15, 4, 2, "CPU", C.paint_white);
  const screens = [
    bezelScreen(m, F, 15, 3, 16, 16, 22, "bars", { color: "#FFAA00" }),
    bezelScreen(m, "+x", 18, 4, 13, 12, 19, "code", { color: "#33FF33" }),
  ];
  grille(m, "+x", 18, 4, 4, 12, 10, 2, C.steel_dark);
  // Fins and fan shroud.
  for (let x = 2; x <= 17; x += 2) m.box(x, 25, 3, x, 28, 13, C.aluminium);
  m.box(1, 29, 1, 18, 30, 15, C.steel_dark);
  m.cyl(9.5, 8, 6.4, 30, 30, 0);
  m.cyl(9.5, 8, 6.4, 29, 29, C.black);
  cornerScrews(m, "+y", 30, 2, 2, 17, 14);
  // Badge screws, heat-pipe caps on the fins, feet.
  cornerScrews(m, F, 15, 4, 5, 15, 13, C.steel_dark);
  for (const x of [5, 9, 13]) m.box(x, 25, 2, x + 1, 28, 2, C.copper);
  // Heat pipes arching over the shroud from the die to the fin stack.
  for (const z of [3, 13])
    cableRun(
      m,
      [
        [0, 22, z],
        [0, 31, z],
        [19, 31, z],
        [19, 22, z],
      ],
      C.copper,
    );
  scorch(m, F, 15, 15, 23, 2);
  stickyNote(m, "+x", 18, 10, 21, C.paper_yellow);
  // Coolant pump with a glass cap on the flank; its impeller turns under it.
  viewport(m, "+x", 18, 4, 21, 7, 23, 1, C.steel, C.glass, C.safety_blue);
  dust(m, 2);
  return detailVisual(
    m,
    [
      mount(
        "impeller",
        yzModel(fanRotor(1, "xy", C.cerulean, C.steel_dark)),
        [18.5, 22.5, 6.5],
        "spin",
        { axis: "x", speed: 6 },
      ),
      mount("cooler", fanRotor(6, "xz", C.steel, C.safety_red), [10, 30.5, 8.5], "spin", {
        speed: 12,
      }),
      mount(
        "load",
        ledStrip(4, [C.led_green, C.led_amber, C.led_amber, C.led_red], 2),
        [15, 3.5, 16.5],
        "blink",
        {
          speed: 2.5,
          amplitude: 0.6,
        },
      ),
      mount("die", block(6, 3, 1, C.orange_neon), [10, 9.5, 15.5], "pulse", {
        speed: 1.1,
        amplitude: 0.7,
      }),
    ],
    [glow([10, 19.5, 17], "screen_amber", 4, 4), glow([10, 31, 8.5], "led_red", 2, 3)],
    screens,
  );
}

function net(): DeviceVisual {
  // Purple switch with three port rows, patch cables to the floor, antennas.
  const m = new Model(26, 30, 20);
  const F = "+z";
  plinth(m, 0, 0, 25, 15, 2);
  chamferBox(m, 0, 2, 1, 25, 20, 15, C.purple_paint, C.steel_dark);
  const parts: AnimPart[] = [];
  [3, 7].forEach((y, i) => {
    faceRect(m, F, 15, 2, y, 23, y + 2, 0, C.metal_dark);
    for (let x = 3; x <= 21; x += 3) {
      m.box(x, y, 15, x + 1, y + 1, 14, 0);
      m.box(x, y, 13, x + 1, y + 1, 13, C.black);
    }
    parts.push(
      mount(
        `ports_${i}`,
        ledStrip(7, [C.led_green, C.led_amber, C.led_green], 3),
        [12.5, y + 2.5, 16.5],
        "blink",
        {
          speed: 2.3 + i * 0.8,
          amplitude: 0.6,
          phase: i,
        },
      ),
    );
  });
  const screens = [
    bezelScreen(m, F, 15, 3, 13, 14, 18, "bars", { color: "#33FF33" }),
    bezelScreen(m, F, 15, 18, 13, 23, 18, "code", { color: "#00FFFF" }),
  ];
  // Patch cables hanging from the ports to the floor.
  const cables: [number, number, number][] = [
    [3, 3, C.cable_yellow],
    [9, 7, C.cable_red],
    [12, 3, C.safety_blue],
    [18, 7, C.cable_black],
    [21, 3, C.paint_lime],
  ];
  cables.forEach(([x, y, c], i) => {
    m.set(x, y, 16, C.chrome);
    cableRun(
      m,
      [
        [x, y, 17],
        [x, 0, 17],
        [x, 0, 18 + (i % 2)],
      ],
      c,
    );
  });
  grille(m, "+x", 25, 3, 4, 12, 17, 2, C.steel_dark);
  // Rack ears with screws, port labels.
  screws(m, F, 15, [
    [1, 4],
    [1, 18],
    [24, 4],
    [24, 18],
  ]);
  for (let x = 3; x <= 21; x += 6) m.set(x, 11, 16, C.paper);
  stickyNote(m, "+x", 25, 4, 13, C.paper_yellow);
  // Router cap with antenna bases and a glazed top over the switch fabric
  // (packets run along its bus while the network is up).
  chamferBox(m, 3, 21, 4, 22, 22, 12, C.steel_dark, C.steel);
  viewport(m, "+y", 22, 7, 6, 18, 10, 1, C.steel, C.glass, C.green_paint);
  for (let x = 8; x <= 17; x += 3) m.set(x, 21, 7, C.paint_black).set(x + 1, 21, 9, C.gold);
  m.box(4, 23, 7, 5, 23, 8, C.paint_black).box(20, 23, 7, 21, 23, 8, C.paint_black);
  dust(m, 2);
  const antenna = (): Model => {
    const a = new Model(1, 8, 1);
    return a.box(0, 0, 0, 0, 6, 0, C.paint_black).set(0, 3, 0, C.steel).set(0, 7, 0, C.led_green);
  };
  parts.push(
    mount("antenna_l", antenna(), [4.5, 24, 7.5], "sway", {
      speed: 0.7,
      amplitude: 0.12,
      pivot: [0.5, 0, 0.5],
    }),
    mount("antenna_r", antenna(), [21.5, 24, 7.5], "sway", {
      speed: 0.6,
      amplitude: 0.12,
      phase: 1.5,
      pivot: [0.5, 0, 0.5],
    }),
    mount("packets", ledStrip(2, [C.led_green, C.led_amber], 4), [12.5, 22.5, 8.5], "slide", {
      speed: 0.8,
      amplitude: 4,
    }),
  );
  return detailVisual(
    m,
    parts,
    [glow([13, 8, 18], "led_green", 4, 5), glow([8.5, 16, 17], "screen_green", 2, 3)],
    screens,
  );
}

function tmp(): DeviceVisual {
  // Wall thermometer panel on a conduit, frost on the top edge.
  const m = new Model(20, 32, 8);
  const F = "+z";
  m.box(8, 0, 0, 11, 10, 1, C.steel_dark);
  for (const y of [2, 6]) m.box(7, y, 0, 12, y, 2, C.steel);
  chamferBox(m, 0, 10, 0, 19, 31, 3, C.red_paint, C.paint_brick);
  cornerScrews(m, F, 3, 1, 11, 18, 30);
  // Thermometer: bulb, glass tube, scale.
  m.box(2, 12, 4, 5, 14, 5, C.glass_red).box(3, 12, 4, 4, 13, 4, C.led_red);
  m.box(3, 26, 4, 4, 28, 4, C.black).box(3, 15, 5, 4, 28, 5, C.glass);
  m.box(3, 15, 4, 4, 17, 4, C.led_red);
  for (let y = 16; y <= 28; y += 2) m.box(5, y, 4, y % 6 === 4 ? 7 : 6, y, 4, C.paper);
  const screens = [bezelScreen(m, F, 3, 9, 23, 17, 28, "status", { color: "#FFAA00" })];
  gauge(m, 13, 16, 4, 3.2, undefined, C.paper, C.brass);
  // Frost along the top, a sticky note, the name.
  for (let x = 1; x <= 18; x++) if ((x * 7) % 5 < 3) m.set(x, 31, x % 3 === 0 ? 1 : 2, C.ice);
  m.set(2, 30, 4, C.ice).set(17, 30, 4, C.ice);
  stickyNote(m, F, 3, 15, 11, C.paper_yellow);
  rustStreak(m, F, 3, 18, 12, 17);
  // Conduit clamp screws and a calibration seal on the gauge.
  m.set(7, 2, 2, C.chrome).set(12, 6, 2, C.chrome);
  m.set(16, 13, 5, C.safety_red);
  // Probe lead from the panel's gland down to the floor, a steel probe tip
  // lying at its end.
  m.box(15, 9, 1, 17, 9, 2, C.steel_dark);
  harness(
    m,
    [
      [16, 8, 2],
      [16, 0, 2],
      [18, 0, 2],
    ],
    [C.cable_red],
    "x",
  );
  m.box(19, 0, 2, 19, 0, 3, C.steel);
  return detailVisual(
    m,
    [
      mount("mercury", block(2, 6, 1, C.led_red), [4, 21, 4.5], "bob", {
        speed: 0.08,
        amplitude: 2,
      }),
      mount("needle", needleModel(2, C.led_red, C.paint_black), [13.5, 16.5, 5.5], "sway", {
        speed: 0.2,
        amplitude: 0.6,
        pivot: [0.5, 0.5, 0.5],
      }),
      mount("alarm", block(1, 1, 1, C.led_amber), [17.5, 20.5, 4.5], "blink", {
        speed: 0.6,
        amplitude: 0.3,
      }),
      mount("sensor_fan", fanRotor(1, "xy", C.aluminium, C.metal_dark), [10, 4.5, 2.5], "spin", {
        axis: "z",
        speed: 6,
      }),
    ],
    [glow([13, 26, 5], "screen_amber", 2, 3)],
    screens,
  );
}

function thm(): DeviceVisual {
  // Cooling cabinet: twin intake fans, big top fan, frosty blue coolant loop.
  const m = new Model(30, 30, 30);
  const F = "+z";
  plinth(m, 0, 0, 29, 29, 2);
  chamferBox(m, 2, 2, 1, 27, 26, 27, C.paint_white, C.steel);
  seam(m, F, 27, 3, 19, 26, 19);
  for (const cx of [8.5, 20.5]) {
    discXY(m, cx, 12, 28, 5.6, C.steel_dark, true);
    discXY(m, cx, 12, 27, 4.8, 0);
    discXY(m, cx, 12, 26, 4.8, C.black);
    discXY(m, cx, 12, 26, 1.2, C.metal_dark);
    m.box(Math.floor(cx) - 4, 12, 28, Math.ceil(cx) + 4, 12, 28, C.chrome);
  }
  const screens = [bezelScreen(m, F, 27, 6, 20, 23, 24, "bars", { color: "#00FFFF" })];
  ledRow(m, F, 27, 4, 22, 1, 1, [C.led_green]);
  // Top fan housing.
  chamferBox(m, 4, 27, 4, 25, 28, 24, C.steel_dark, C.steel);
  m.cyl(14.5, 14, 8.4, 28, 28, 0);
  m.cyl(14.5, 14, 8.4, 27, 27, C.black);
  // Coolant loop: 2-voxel pipes up both sides and over the top, brass flanges.
  for (const x of [0, 28]) {
    m.box(x, 2, 20, x + 1, 25, 21, C.safety_blue);
    m.box(x, 26, 16, x + 1, 27, 21, C.safety_blue);
    for (const y of [6, 16]) m.box(x, y, 20, x + 1, y, 21, C.brass);
  }
  m.box(0, 26, 16, 29, 27, 17, C.safety_blue);
  m.box(4, 26, 16, 4, 27, 17, C.brass).box(25, 26, 16, 25, 27, 17, C.brass);
  for (let i = 0; i < 18; i++) {
    const x = i % 2;
    const y = 3 + ((i * 7) % 22);
    m.set(x, y, 22, C.ice);
  }
  for (let x = 3; x <= 26; x += 3) m.set(x, 26, 28, C.ice);
  grille(m, "+x", 27, 4, 4, 17, 17, 2, C.steel_dark);
  // Fan-shroud screws, rivet band over the seam and a frost-rated plate.
  for (const cx of [8.5, 20.5])
    for (const [dx, dy] of [
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4],
    ] as const)
      m.set(Math.round(cx + dx), 12 + dy, 28, C.chrome);
  rivetRow(m, F, 27, 4, 25, 18, 3, C.steel);
  // Heat-exchanger fin packs high on both flanks.
  coolingFins(m, "+x", 27, 4, 19, 17, 25, 2, C.aluminium);
  coolingFins(m, "-x", 2, 4, 19, 17, 25, 2, C.aluminium);
  stickyNote(m, "+x", 27, 20, 20, C.paper_blue);
  // Manifold sight glass under the fans: the coolant header behind glass,
  // a paddle-wheel flow meter and a bubble riding the stream.
  viewport(m, F, 27, 6, 3, 23, 5, 2, C.steel, C.glass, C.black);
  faceRect(m, F, 27, 6, 4, 23, 4, 2, C.safety_blue);
  for (const u of [7, 22]) faceRect(m, F, 27, u, 3, u, 5, 1, C.brass);
  dust(m, 2);
  return detailVisual(
    m,
    [
      mount("flow_wheel", fanRotor(1, "xy", C.safety_orange, C.brass), [14.5, 4.5, 26.5], "spin", {
        axis: "z",
        speed: 7,
      }),
      mount("bubble", block(1, 1, 1, C.ice), [19, 4.5, 26.5], "slide", {
        speed: 0.5,
        amplitude: 2.5,
      }),
      mount("fan_l", fanRotor(4, "xy", C.steel_dark, C.cerulean), [9, 12.5, 27.5], "spin", {
        axis: "z",
        speed: 10,
      }),
      mount("fan_r", fanRotor(4, "xy", C.steel_dark, C.cerulean), [21, 12.5, 27.5], "spin", {
        axis: "z",
        speed: -10,
        phase: 1,
      }),
      mount("top_fan", fanRotor(7, "xz", C.steel, C.metal_dark), [15, 28.5, 14.5], "spin", {
        speed: 6,
      }),
      mount("flow", block(2, 2, 1, C.plasma_blue), [29, 14, 22.5], "slide", {
        axis: "y",
        speed: 0.4,
        amplitude: 9,
      }),
      mount("flow_l", block(2, 2, 1, C.plasma_blue), [1, 14, 22.5], "slide", {
        axis: "y",
        speed: -0.4,
        amplitude: 9,
        phase: Math.PI,
      }),
    ],
    [glow([15, 22, 30], "screen_cyan", 4, 5), glow([15, 29, 14.5], "cerulean", 3, 4)],
    screens,
  );
}

function pwr(): DeviceVisual {
  // Red breaker cabinet: hazard plinth, gauge, breaker banks, knife lever.
  const m = new Model(24, 40, 18);
  const F = "+z";
  plinth(m, 0, 0, 23, 16, 4);
  hazardFace(m, F, 16, 1, 1, 22, 3);
  chamferBox(m, 1, 4, 1, 22, 35, 13, C.red_paint, C.paint_brick);
  // Door outline, hinges, lock.
  seam(m, F, 13, 3, 6, 20, 6);
  seam(m, F, 13, 3, 33, 20, 33);
  seam(m, F, 13, 3, 6, 3, 33);
  seam(m, F, 13, 20, 6, 20, 33);
  for (const y of [9, 29]) m.box(2, y, 14, 2, y + 2, 14, C.chrome);
  const screens = [bezelScreen(m, F, 13, 6, 27, 17, 31, "power", { color: "#33FF33" })];
  gauge(m, 11.5, 20, 14, 3.6, undefined, C.paper, C.brass);
  switchBank(m, F, 13, 6, 8, 6, 2);
  switchBank(m, F, 13, 6, 12, 6, 2, C.safety_red);
  // Knife-switch base on the right (the blade throws, see parts).
  m.box(19, 15, 14, 21, 17, 14, C.paint_black);
  m.box(19, 16, 15, 19, 17, 15, C.brass).box(21, 16, 15, 21, 17, 15, C.brass);
  scorch(m, F, 13, 18, 11, 2.2);
  rustStreak(m, F, 13, 2, 22, 28);
  // Side: vent, HV stencil and the Jacob's ladder in its glass chimney.
  grille(m, "+x", 22, 3, 7, 11, 12, 2, C.steel_dark);
  stencil(m, "+x", 22, 14, 14, "HV", C.safety_yellow);
  viewport(m, "+x", 22, 5, 21, 10, 34, 3, C.paint_black, C.glass);
  for (let v = 21; v <= 34; v++) {
    const k = Math.floor((v - 21) / 5);
    faceSet(m, "+x", 22, 7 - k, v, 2, C.copper);
    faceSet(m, "+x", 22, 8 + k, v, 2, C.copper);
  }
  faceRect(m, "+x", 22, 6, 21, 9, 21, 2, C.paint_white);
  harness(
    m,
    [
      [22, 36, 1],
      [23, 36, 1],
      [23, 0, 1],
    ],
    [C.cable_black, C.cable_red, C.cable_yellow],
    "z",
  );
  // Roof: glass fuse gallery (cartridge fuses on a copper bus), insulators.
  m.box(2, 36, 2, 15, 36, 12, C.paint_black);
  m.box(3, 37, 3, 14, 39, 11, C.glass).box(4, 37, 4, 13, 38, 10, 0);
  for (const z of [5, 7, 9]) {
    m.box(6, 37, z, 11, 37, z, C.paint_white).set(5, 37, z, C.copper).set(12, 37, z, C.copper);
    m.set(8, 37, z, C.safety_red);
  }
  m.box(13, 37, 4, 13, 38, 10, C.copper);
  for (const [x, z] of [
    [3, 3],
    [14, 3],
    [3, 11],
    [14, 11],
  ] as const)
    m.box(x, 37, z, x, 39, z, C.steel_dark);
  for (const x of [18, 21]) {
    for (let y = 36; y <= 39; y++)
      m.ring(x, 3, y % 2 ? 1.2 : 0.6, y, y % 2 ? C.paint_white : C.bronze);
    m.set(x, 39, 3, C.copper);
  }
  m.box(18, 39, 3, 21, 39, 3, C.copper);
  // Utility meter on the roof (its disc turns with the load), door rivets.
  m.box(17, 36, 7, 22, 36, 13, C.paint_black);
  for (const [x, z] of [
    [17, 7],
    [22, 7],
    [17, 13],
    [22, 13],
  ] as const)
    m.set(x, 37, z, C.glass);
  rivetRow(m, F, 13, 5, 18, 34, 3, C.paint_brick);
  stickyNote(m, F, 13, 15, 2, C.paper_yellow);
  dust(m, 3);
  return detailVisual(
    m,
    [
      mount("needle", needleModel(3, C.led_red, C.paint_black), [12, 20.5, 15.5], "sway", {
        speed: 0.15,
        amplitude: 0.6,
        pivot: [0.5, 0.5, 0.5],
      }),
      mount(
        "breaker_leds",
        ledStrip(4, [C.led_green, C.led_green, C.led_amber], 2, "y"),
        [19.5, 30, 14.5],
        "blink",
        { speed: 0.7, amplitude: 0.8 },
      ),
      mount("arc", block(1, 2, 1, C.white_gold), [21.5, 12, 14.5], "blink", {
        speed: 6,
        amplitude: 0.25,
      }),
      mount("lever", pwrLever(), [20.5, 17, 15.5], "sweep", {
        axis: "x",
        speed: 0.07,
        amplitude: 0.4,
        pivot: [1.5, 0, 0.5],
      }),
      mount("ladder", pwrArc(), [21.5, 22, 8], "piston", {
        speed: 0.6,
        amplitude: 11,
      }),
      mount("fuse_led", block(1, 1, 1, C.led_green), [8.5, 38.5, 7.5], "blink", {
        speed: 1.3,
        amplitude: 0.5,
      }),
      mount(
        "meter_disc",
        ringModel(1.6, "xz", C.aluminium, C.safety_red),
        [20, 37.5, 10.5],
        "spin",
        {
          speed: 3.5,
        },
      ),
    ],
    [
      glow([12, 29, 15], "screen_green", 3, 4),
      glow([21.5, 12, 15], "white_gold", 2, 3, true, true),
      glow([23, 28, 8], "plasma", 4, 4, true, true),
    ],
    screens,
  );
}

/** Knife-switch blade + red handle (pivot at the hinge, blade up). */
function pwrLever(): Model {
  const l = new Model(3, 7, 2);
  return l.box(1, 0, 0, 1, 5, 0, C.chrome).box(0, 6, 0, 2, 6, 1, C.safety_red);
}

/** The Jacob's-ladder arc: a jagged 4-voxel spark across the horns. */
function pwrArc(): Model {
  return new Model(1, 2, 4)
    .set(0, 0, 0, C.plasma)
    .set(0, 1, 1, C.white_gold)
    .set(0, 0, 2, C.white_gold)
    .set(0, 1, 3, C.plasma);
}

function pwd(): DeviceVisual {
  // Wall display of the power grid over a conduit, with an alarm beacon.
  const m = new Model(32, 31, 8);
  const F = "+z";
  m.box(14, 0, 0, 17, 8, 1, C.steel_dark);
  for (const y of [2, 5]) m.box(13, y, 0, 18, y, 2, C.steel);
  chamferBox(m, 0, 8, 0, 31, 26, 2, C.paint_black, C.metal_dark);
  cornerScrews(m, F, 2, 1, 9, 30, 25);
  const screens = [
    bezelScreen(m, F, 2, 3, 13, 28, 24, "power", { color: "#33FF33" }),
    bezelScreen(m, F, 2, 21, 9, 28, 11, "bars", { color: "#AAFF00" }),
  ];
  ledRow(m, F, 2, 4, 10, 6, 2, [C.led_green, C.led_green, C.led_amber]);
  // Rotating alarm beacon under a glass dome on the top rail.
  m.box(13, 27, 0, 18, 27, 4, C.steel_dark).box(14, 27, 5, 17, 27, 5, C.hazard_black);
  for (let y = 28; y <= 30; y++)
    for (let z = 1; z <= 4; z++)
      for (let x = 14; x <= 17; x++)
        if (x === 14 || x === 17 || z === 1 || z === 4 || y === 30) m.set(x, y, z, C.glass_amber);
  // Capacitor bank for the reactive-power compensation, on the conduit.
  for (const x of [11, 20]) {
    m.box(x, 1, 2, x + 1, 6, 3, C.safety_blue);
    m.box(x, 7, 2, x + 1, 7, 3, C.steel_dark).set(x, 7, 3, C.chrome);
  }
  // Rivets along the top rail, a grid-map legend and a conduit gland.
  rivetRow(m, F, 2, 3, 29, 26, 2, C.steel_dark);
  ledRow(m, F, 2, 17, 12, 1, 1, [C.led_red]);
  m.box(13, 7, 2, 18, 7, 2, C.steel);
  stickyNote(m, F, 2, 16, 8, C.paper_pink);
  harness(
    m,
    [
      [19, 8, 2],
      [19, 0, 2],
    ],
    [C.cable_red, C.cable_yellow],
    "x",
  );
  const beacon = new Model(2, 2, 2).box(0, 0, 0, 1, 1, 1, C.chrome);
  beacon.box(0, 0, 1, 1, 1, 1, C.led_amber).set(1, 1, 0, C.steel_dark);
  return detailVisual(
    m,
    [
      mount("beacon", beacon, [16, 28, 3], "spin", {
        speed: 5,
        pivot: [1, 0, 1],
      }),
      mount("heartbeat", block(1, 1, 1, C.lime), [2.5, 10.5, 3.5], "pulse", {
        speed: 1.1,
        amplitude: 0.9,
      }),
      mount("scan", ledStrip(1, [C.led_green]), [8, 10.5, 3.5], "slide", {
        speed: 0.5,
        amplitude: 4,
      }),
      mount("fault", block(1, 1, 1, C.led_red), [17.5, 12.5, 3.5], "blink", {
        speed: 0.35,
        amplitude: 0.12,
        phase: 1.3,
      }),
    ],
    [glow([16, 19, 4], "screen_green", 4, 5)],
    screens,
  );
}

function vlt(): DeviceVisual {
  // Analog voltmeter with a power readout and test leads hanging down.
  const m = new Model(20, 28, 8);
  const F = "+z";
  chamferBox(m, 0, 8, 0, 19, 27, 2, C.metal_dark, C.steel_dark);
  cornerScrews(m, F, 2, 1, 9, 18, 26);
  // Meter window: paper arc scale with a red zone.
  faceRect(m, F, 2, 2, 15, 17, 25, -1, C.steel);
  faceRect(m, F, 2, 3, 16, 16, 24, -1, C.paper);
  for (let i = 0; i <= 10; i++) {
    const a = -1.1 + (i / 10) * 2.2;
    const r = i % 5 === 0 ? [6.2, 7.2] : [6.8];
    for (const rr of r)
      m.set(
        Math.round(9.5 + Math.sin(a) * rr),
        Math.round(16 + Math.cos(a) * rr),
        3,
        i >= 8 ? C.safety_red : C.paint_black,
      );
  }
  stencil(m, F, 3, 8, 17, "V", C.paint_black, -1);
  // Meter case: a steel box proud of the panel with a glass front over the needle.
  // (The right wall stops short of the panel so the range knob can turn.)
  for (let z = 4; z <= 6; z++) {
    m.box(2, 15, z, 17, 15, z, C.steel).box(2, 25, z, 17, 25, z, C.steel);
    m.box(2, 16, z, 2, 24, z, C.steel);
    if (z > 4) m.box(17, 16, z, 17, 24, z, C.steel);
  }
  faceRect(m, F, 2, 3, 16, 16, 24, -5, C.glass);
  const screens = [bezelScreen(m, F, 2, 4, 10, 15, 13, "power", { color: "#33FF33" })];
  // Binding posts and test leads.
  m.box(2, 9, 3, 3, 10, 4, C.safety_red).box(16, 9, 3, 17, 10, 4, C.paint_black);
  cableRun(
    m,
    [
      [2, 8, 4],
      [2, 0, 4],
      [2, 0, 6],
    ],
    C.cable_red,
  );
  cableRun(
    m,
    [
      [17, 8, 4],
      [17, 0, 4],
      [15, 0, 4],
    ],
    C.cable_black,
  );
  m.set(2, 0, 7, C.chrome).set(14, 0, 4, C.chrome);
  // Range selector ring (its knob is a part) and zero-adjust screw.
  discXY(m, 18, 22, 3, 1.6, C.steel_dark, true);
  m.set(9, 14, 3, C.chrome);
  rustStreak(m, F, 2, 1, 9, 14);
  return detailVisual(
    m,
    [
      mount("needle", needleModel(6, C.safety_red, C.paint_black), [10, 16.5, 5.5], "sway", {
        speed: 0.3,
        amplitude: 0.7,
        pivot: [0.5, 0.5, 0.5],
      }),
      mount("peak", block(1, 1, 1, C.led_red), [17.5, 26.5, 4.5], "blink", {
        speed: 0.5,
        amplitude: 0.2,
      }),
      mount(
        "range",
        new Model(3, 3, 1).box(0, 0, 0, 2, 2, 0, C.paint_black).set(1, 2, 0, C.chrome),
        [18.5, 22.5, 4.5],
        "step",
        { axis: "z", speed: 0.25, amplitude: -TAU / 6 },
      ),
    ],
    [glow([10, 12, 4], "screen_green", 2, 3)],
    screens,
  );
}

function msc(): DeviceVisual {
  // Scanner console: glass stage, boom-mounted head, spinning sample.
  const m = new Model(28, 32, 24);
  const F = "+z";
  plinth(m, 0, 0, 27, 23, 3);
  chamferBox(m, 2, 3, 2, 25, 10, 21, C.teal, C.steel);
  const screens = [
    bezelScreen(m, F, 21, 5, 5, 18, 8, "spectrum", { color: "#00FFFF" }),
    bezelScreen(m, "+x", 25, 5, 4, 12, 8, "code", { color: "#33FF33" }),
  ];
  knob(m, F, 21, 20, 6, C.paint_black);
  ledRow(m, F, 21, 20, 9, 2, 2, [C.led_green, C.led_amber]);
  // Stage.
  m.box(3, 11, 3, 24, 11, 20, C.steel);
  m.cyl(12.5, 11.5, 5.6, 11, 11, C.metal_dark);
  m.ring(12.5, 11.5, 4.6, 11, C.cerulean);
  m.cyl(12.5, 11.5, 5, 12, 12, C.glass);
  // Column, boom and scan head.
  m.box(21, 11, 3, 23, 29, 5, C.steel);
  m.box(21, 14, 6, 23, 15, 6, C.safety_yellow);
  m.box(10, 28, 9, 23, 29, 13, C.steel).box(21, 28, 5, 23, 29, 9, C.steel);
  chamferBox(m, 8, 24, 7, 17, 28, 16, C.paint_white, C.steel);
  m.cyl(12.5, 11.5, 1.6, 23, 23, C.screen_cyan);
  cableRun(
    m,
    [
      [24, 29, 4],
      [24, 12, 4],
      [26, 12, 4],
      [26, 0, 4],
    ],
    C.cable_black,
  );
  stickyNote(m, F, 21, 3, 1, C.paper_yellow);
  // Column bolts, stage clamp screws, head vent slots.
  for (const y of [12, 20, 27]) m.set(22, y, 6, C.chrome);
  for (const [x, z] of [
    [4, 4],
    [23, 4],
    [4, 19],
    [23, 19],
  ] as const)
    m.set(x, 12, z, C.chrome);
  for (let x = 10; x <= 15; x += 2) m.set(x, 26, 17, C.black);
  coffeeRing(m, 5.5, 11, 17.5, 1.3);
  scorch(m, "+y", 11, 20, 17, 1.5);
  dust(m, 3);
  return detailVisual(
    m,
    [
      mount("sample", gem(7, 2, C.crystal_cyan, C.screen_cyan), [13, 17, 12], "spin", {
        speed: 1.2,
      }),
      mount("scan_ring", ringModel(4.6, "xz", C.cerulean, C.gamma), [13, 17, 12], "bob", {
        speed: 0.5,
        amplitude: 3,
      }),
      mount("head_led", block(1, 1, 1, C.led_green), [16.5, 26.5, 17.5], "blink", {
        speed: 1.4,
        amplitude: 0.5,
      }),
      mount("turntable", ringModel(3.5, "xz", C.steel, C.safety_yellow), [13, 13.5, 12], "spin", {
        speed: 1.2,
      }),
      mount("beam", block(1, 2, 1, C.screen_cyan), [13, 22, 12], "blink", {
        speed: 2.2,
        amplitude: 0.7,
      }),
      mount("focus", mscCarriage(), [22, 18, 6.5], "slide", {
        axis: "y",
        speed: 0.2,
        amplitude: 3,
      }),
    ],
    [glow([13, 20, 12], "screen_cyan", 5, 5), glow([12, 7, 23], "screen_cyan", 2, 3)],
    screens,
  );
}

/** MSC focus carriage riding the column: a clamp block with a pointer. */
function mscCarriage(): Model {
  const c = new Model(3, 3, 1).box(0, 0, 0, 2, 2, 0, C.safety_yellow);
  return c.set(1, 1, 0, C.paint_black).set(1, 2, 0, C.led_green);
}

function rmg(): DeviceVisual {
  // Coil-wound magnet pole on a hazard-ringed base, scrap stuck to it.
  const m = new Model(30, 36, 30);
  const c = 14.5;
  m.cyl(c, c, 14.4, 0, 1, C.steel_dark);
  hazardRing(m, c, c, 13.2, 1);
  m.cyl(c, c, 10.4, 2, 5, C.metal_dark);
  m.ring(c, c, 10.4, 5, C.steel);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    m.set(Math.round(c + Math.cos(a) * 9), 6, Math.round(c + Math.sin(a) * 9), C.chrome);
  }
  m.cyl(c, c, 3.2, 6, 29, C.steel);
  for (let y = 8; y <= 26; y++) m.cyl(c, c, 5.2, y, y, y % 3 === 0 ? C.bronze : C.copper, true);
  m.cyl(c, c, 5.8, 7, 7, C.steel_dark).cyl(c, c, 5.8, 27, 27, C.steel_dark);
  m.cyl(c, c, 6.4, 30, 32, C.safety_red);
  m.ring(c, c, 6.4, 31, C.paint_white);
  m.cyl(c, c, 3, 33, 33, C.steel_dark);
  m.box(12, 33, 14, 12, 35, 15, C.chrome).box(17, 33, 14, 17, 35, 15, C.chrome);
  // Cap bolts and pole-clamp rivets.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    m.set(Math.round(c + Math.cos(a) * 5.4), 33, Math.round(c + Math.sin(a) * 5.4), C.chrome);
    m.set(Math.round(c + Math.cos(a) * 12.6), 2, Math.round(c + Math.sin(a) * 12.6), C.steel);
  }
  // Scrap stuck to the pole.
  for (const [x, y, z, col] of [
    [9, 12, 14, C.steel],
    [20, 17, 15, C.iron_rust],
    [14, 21, 20, C.chrome],
    [19, 24, 11, C.metal],
    [10, 31, 16, C.brass],
    [15, 10, 9, C.rust],
  ] as const)
    m.set(x, y, z, col);
  // Control box in front.
  chamferBox(m, 10, 2, 23, 19, 9, 27, C.safety_yellow, C.yellow_paint);
  const screens = [bezelScreen(m, "+z", 27, 11, 5, 18, 8, "bars", { color: "#FFAA00" })];
  ledRow(m, "+z", 27, 12, 3, 4, 2, [C.led_green, C.led_amber]);
  cableRun(
    m,
    [
      [19, 4, 25],
      [22, 4, 25],
      [22, 0, 25],
    ],
    C.cable_black,
  );
  scorch(m, "+y", 5, 22, 12, 2);
  // Ferrofluid bottle on the base rim: iron filings dance in the field.
  glassTube(m, 5.5, 8.5, 1.8, 2, 12, C.glass, C.steel);
  m.cyl(5.5, 8.5, 1.2, 3, 4, C.metal_dark);
  // Field compass on the control box lid.
  m.cyl(14.5, 25, 2, 10, 10, C.paper).ring(14.5, 25, 2.2, 10, C.brass);
  dust(m, 2);
  cableRun(
    m,
    [
      [10, 4, 25],
      [7, 4, 25],
      [7, 0, 25],
      [3, 0, 25],
    ],
    C.cable_red,
  );
  const nut = new Model(2, 1, 2).box(0, 0, 0, 1, 0, 1, C.steel);
  nut.set(0, 0, 0, C.iron_rust);
  return detailVisual(
    m,
    [
      mount("coil_a", ringModel(9, "xz", C.copper, C.neon_magenta, 2), [15, 12, 15], "spin", {
        speed: 2,
      }),
      mount("coil_b", ringModel(9, "xz", C.copper, C.neon_magenta, 2), [15, 22, 15], "spin", {
        speed: -2.5,
      }),
      mount(
        "sparks",
        motes(3, 3, 8, [C.neon_pink, C.neon_magenta, C.white_gold], 3),
        [15, 37, 15],
        "jitter",
        {
          speed: 14,
          amplitude: 0.8,
        },
      ),
      mount("scrap", nut, [15, 16, 15], "orbit", {
        speed: 1.3,
        amplitude: 7.5,
      }),
      mount("filings", motes(1, 6, 7, [C.metal_dark, C.steel], 5), [6, 5, 9], "jitter", {
        speed: 9,
        amplitude: 0.4,
        pivot: [1.5, 0, 1.5],
      }),
      mount(
        "compass",
        new Model(3, 1, 1).set(0, 0, 0, C.safety_red).set(1, 0, 0, C.brass).set(2, 0, 0, C.steel),
        [15, 11.5, 25.5],
        "sweep",
        { speed: 0.6, amplitude: 0.9 },
      ),
    ],
    [glow([15, 18, 15], "neon_magenta", 8, 6, true, true), glow([15, 8, 28], "screen_amber", 2, 3)],
    screens,
  );
}

function atk(): DeviceVisual {
  // Glass tank of glowing abstractum on a teal base, valve wheel on top.
  const m = new Model(26, 38, 26);
  const c = 12.5;
  m.cyl(c, c, 12, 0, 1, C.metal_dark);
  m.cyl(c, c, 11.4, 2, 4, C.paint_teal);
  m.ring(c, c, 11.4, 3, C.steel_dark);
  // Liquid (static body), surface foam, glass wall.
  m.cyl(c, c, 8.2, 5, 24, C.abstractum);
  m.cyl(c, c, 8.2, 25, 25, C.neon_pink);
  m.cyl(c, c, 6, 25, 25, C.abstractum);
  glassTube(m, c, c, 9.4, 4, 32, C.glass, C.steel);
  m.cyl(c, c, 11.4, 33, 35, C.paint_teal);
  m.ring(c, c, 11.4, 34, C.steel_dark);
  m.cyl(c, c, 3.4, 36, 36, C.steel_dark);
  m.box(12, 37, 12, 13, 37, 13, C.chrome);
  for (const [x, z] of [
    [2, 2],
    [22, 2],
    [2, 22],
    [22, 22],
  ] as const) {
    m.box(x, 0, z, x + 1, 34, z + 1, C.steel);
    for (const y of [10, 22]) m.box(x, y, z, x + 1, y, z + 1, C.brass);
  }
  // Level scale on the front-right post.
  for (let y = 6; y <= 30; y += 2)
    m.set(22, y, 24, y > 26 ? C.safety_red : y % 6 === 0 ? C.paint_black : C.paper);
  // Control plate and inlet pipe.
  chamferBox(m, 8, 1, 21, 17, 7, 24, C.metal, C.steel_dark);
  const screens = [bezelScreen(m, "+z", 24, 9, 3, 16, 6, "bars", { color: "#b060ff" })];
  m.box(24, 2, 11, 25, 30, 12, C.copper).box(20, 29, 11, 25, 30, 12, C.copper);
  m.box(24, 16, 11, 25, 16, 12, C.brass);
  // Seep-valve drip chamber: a glass section of the inlet with brass collars.
  m.box(24, 19, 11, 25, 24, 12, C.glass).box(23, 18, 10, 26, 18, 13, C.brass);
  m.box(23, 25, 10, 26, 25, 13, C.brass);
  // Drips and a warning note; bolted lid flange and a sight-glass clamp.
  for (const x of [5, 18]) m.set(x, 4, 21 - (x % 3), C.neon_magenta);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    m.set(Math.round(c + Math.cos(a) * 10.6), 35, Math.round(c + Math.sin(a) * 10.6), C.chrome);
  }
  m.box(21, 18, 24, 23, 18, 24, C.steel_dark);
  stickyNote(m, "+z", 24, 18, 2, C.paper_pink, C.safety_red);
  dust(m, 2);
  harness(
    m,
    [
      [17, 3, 23],
      [19, 3, 23],
      [19, 0, 23],
    ],
    [C.cable_black, C.cable_red],
    "z",
  );
  return detailVisual(
    m,
    [
      mount("bubble_a", block(1, 1, 1, C.neon_pink), [10.5, 27.5, 14.5], "bob", {
        speed: 0.6,
        amplitude: 1.5,
      }),
      mount("bubble_b", block(1, 1, 1, C.gamma), [15.5, 28.5, 11.5], "bob", {
        speed: 0.45,
        amplitude: 1.5,
        phase: 2,
      }),
      mount("shard", gem(6, 1.6, C.crystal_violet, C.neon_pink), [13, 29, 13], "spin", {
        speed: 0.5,
      }),
      mount("surface", ringModel(7, "xz", C.neon_pink), [13, 26.5, 13], "pulse", {
        speed: 0.3,
        amplitude: 0.6,
      }),
      mount("float", block(1, 1, 1, C.safety_red), [22.5, 25.5, 25.5], "bob", {
        speed: 0.15,
        amplitude: 1.5,
      }),
      mount("valve", atkWheel(), [13, 37.5, 13], "step", {
        speed: 0.3,
        amplitude: TAU / 8,
      }),
      mount("drip", block(1, 1, 1, C.neon_pink), [25.5, 23.5, 12.5], "piston", {
        speed: 0.7,
        amplitude: -4,
      }),
    ],
    [glow([13, 16, 13], "abstractum", 8, 6), glow([12.5, 5, 25], "neon_purple", 2, 3)],
    screens,
  );
}

/** ATK valve handwheel (xz): red rim, four spokes, chrome boss. */
function atkWheel(): Model {
  const w = ringModel(3.2, "xz", C.safety_red);
  w.box(5, 0, 2, 5, 0, 8, C.safety_red).box(2, 0, 5, 8, 0, 5, C.safety_red);
  return w.set(5, 0, 5, C.chrome);
}

/** INT filter wheel (yz): a steel disc with four coloured glass windows. */
function intFilterWheel(): Model {
  const w = new Model(1, 7, 7);
  const tints = [C.glass_red, C.glass_green, C.glass_amber, C.glass_purple];
  for (let z = 0; z < 7; z++)
    for (let y = 0; y < 7; y++) {
      const d = Math.hypot(y - 3, z - 3);
      if (d > 3.3) continue;
      const q = (y >= 3 ? 1 : 0) + (z >= 3 ? 2 : 0);
      w.set(0, y, z, d < 1 ? C.chrome : d > 2.4 || y === 3 || z === 3 ? C.steel_dark : tints[q]!);
    }
  return w;
}

// ── Tier 2 ───────────────────────────────────────────────────────

function uec(): DeviceVisual {
  // Containment drum inside a pylon cage: jittering core, counter-rotating
  // rings, vent pistons stroking in sequence, Tesla crown with a live arc.
  const m = new Model(36, 48, 36);
  const c = 17.5;
  m.cyl(c, c, 17.4, 0, 3, C.metal_dark);
  m.cyl(c, c, 14.4, 4, 4, C.steel_dark);
  hazardRing(m, c, c, 15.8, 3);
  m.cyl(c, c, 6.4, 5, 8, C.steel);
  m.ring(c, c, 6.4, 7, C.steel_dark);
  m.cyl(c, c, 4.2, 9, 9, C.neon_purple);
  for (const [x, z] of [
    [5, 5],
    [29, 5],
    [5, 29],
    [29, 29],
  ] as const) {
    m.box(x - 1, 4, z - 1, x + 2, 6, z + 2, C.steel_dark);
    m.box(x, 7, z, x + 1, 31, z + 1, C.steel_dark);
    for (let y = 22; y <= 29; y++)
      m.box(x - 1, y, z - 1, x + 2, y, z + 2, y % 2 ? C.copper : C.bronze);
    m.box(x, 32, z, x + 1, 33, z + 1, C.neon_pink);
    // Anchor bolts and insulator collars on each pylon.
    for (const [bx, bz] of [
      [x - 1, z - 1],
      [x + 2, z - 1],
      [x - 1, z + 2],
      [x + 2, z + 2],
    ] as const)
      m.set(bx, 7, bz, C.chrome);
    for (const y of [12, 17]) m.box(x, y, z, x + 1, y, z + 1, C.paint_white);
  }
  // Containment drum: glass wall between collars, chrome staves, struts.
  glassDrum(m, c, c, 13.5, 9, 31, C.glass, C.steel_dark);
  m.ring(c, c, 13.5, 10, C.steel_dark).ring(c, c, 13.5, 30, C.steel_dark);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + TAU / 16;
    const x = Math.round(c + Math.cos(a) * 13.5);
    const z = Math.round(c + Math.sin(a) * 13.5);
    m.box(x, 11, z, x, 29, z, C.chrome);
    m.set(x, 20, z, C.neon_pink);
  }
  for (const [x, z] of [
    [8, 8],
    [27, 8],
    [8, 27],
    [27, 27],
  ] as const)
    m.box(x, 5, z, x, 8, z, C.steel);
  // Vent-piston housings on both flanks (the pistons stroke in sequence).
  for (const x0 of [1, 32])
    for (const z0 of [11, 22]) {
      m.box(x0, 4, z0, x0 + 2, 7, z0 + 2, C.steel_dark);
      m.box(x0, 7, z0, x0 + 2, 7, z0 + 2, C.black).set(x0 + 1, 7, z0 + 1, C.metal_dark);
      m.set(x0 + (x0 === 1 ? 2 : 0), 5, z0 + 1, C.led_amber);
    }
  m.ring(c, c, 16, 34, C.steel, 2);
  m.cyl(c, c, 3, 36, 39, C.steel_dark);
  m.cyl(c, c, 2, 35, 35, C.neon_purple);
  // Tesla crown: coil stack and a chrome toroid; the arc dances on top.
  coilStack(m, c, c, 2.4, 40, 44);
  m.ring(c, c, 3.6, 45, C.chrome, 2);
  m.cyl(c, c, 1.2, 45, 46, C.steel_dark);
  // Leads from the crown ring down two pylons to the floor.
  harness(
    m,
    [
      [3, 35, 16],
      [2, 35, 16],
      [2, 8, 16],
    ],
    [C.cable_black, C.cable_red],
    "z",
  );
  // Console on the rim.
  chamferBox(m, 11, 4, 29, 24, 8, 33, C.metal, C.steel_dark);
  const screens = [
    bezelScreen(m, "+z", 33, 12, 5, 19, 7, "wave", { color: "#FFAA00" }),
    bezelScreen(m, "+x", 24, 30, 5, 32, 7, "status", { color: "#b060ff" }),
  ];
  switchBank(m, "+z", 33, 21, 5, 2, 2, C.safety_red);
  // Instability scars.
  scorch(m, "+y", 4, 10, 25, 2.5);
  scorch(m, "+y", 4, 26, 11, 2);
  stickyNote(m, "+z", 33, 21, 1, C.paper_yellow, C.safety_red);
  dust(m, 2);
  const shard = gem(5, 1, C.crystal_rose, C.neon_pink);
  const arc = new Model(5, 2, 5);
  arc
    .set(0, 0, 2, C.neon_pink)
    .set(1, 1, 2, C.white_gold)
    .set(2, 0, 2, C.neon_pink)
    .set(3, 1, 1, C.white_gold)
    .set(4, 0, 0, C.neon_pink)
    .set(2, 1, 4, C.neon_pink);
  const vent = pistonModel(6, 3, C.safety_yellow);
  vent.box(0, 5, 0, 2, 5, 2, C.hazard_black).set(1, 5, 1, C.led_red);
  return detailVisual(
    m,
    [
      mount("core", orb(5.5, C.neon_purple, C.abstractum, 3.5), [18, 20.5, 18], "jitter", {
        speed: 9,
        amplitude: 0.4,
      }),
      mount("ring_v", ringModel(9, "xy", C.chrome, C.neon_pink), [18, 20.5, 18], "wobble", {
        speed: 0.45,
        amplitude: 0.5,
      }),
      mount("ring_h", ringModel(11.5, "xz", C.copper, C.neon_pink, 2), [18, 20.5, 18], "spin", {
        speed: -0.7,
      }),
      mount("ring_g", ringModel(10.4, "yz", C.steel, C.neon_purple), [18, 20.5, 18], "spin", {
        speed: 1.1,
      }),
      mount("shard_a", shard, [18, 14, 18], "orbit", {
        speed: 1.5,
        amplitude: 11,
      }),
      mount("shard_b", shard, [18, 27, 18], "orbit", {
        speed: 1.1,
        amplitude: 10.5,
        phase: 2,
      }),
      mount("shard_c", shard, [18, 31, 18], "orbit", {
        speed: -0.9,
        amplitude: 8,
        phase: 4,
      }),
      ...[
        [2.5, 12.5],
        [2.5, 23.5],
        [33.5, 23.5],
        [33.5, 12.5],
      ].map(([x, z], i) =>
        mount(`vent_${i}`, vent, [x!, 8, z!], "piston", {
          speed: 0.5,
          amplitude: 3,
          phase: (i * TAU) / 4,
          pivot: [1.5, 0, 1.5],
        }),
      ),
      mount("arc", arc, [18, 47.5, 18], "jitter", { speed: 14, amplitude: 0.6 }),
    ],
    [
      glow([18, 20.5, 18], "abstractum", 30, 12, true, true),
      glow([18, 46, 18], "neon_pink", 6, 6, true, true),
    ],
    screens,
  );
}

function dgn(): DeviceVisual {
  // Diagnostics desk: three monitors, keyboard, switch banks, cable loom.
  const m = new Model(40, 32, 24);
  const F = "+z";
  chamferBox(m, 0, 1, 5, 39, 11, 21, C.metal, C.steel_dark);
  m.box(1, 0, 6, 38, 0, 20, C.black);
  levelFeet(m, 1, 6, 39, 21);
  for (const x0 of [2, 21]) {
    seam(m, F, 21, x0, 2, x0 + 16, 2);
    seam(m, F, 21, x0, 10, x0 + 16, 10);
    grille(m, F, 21, x0 + 2, 4, x0 + 8, 8, 2, C.steel_dark);
    cornerScrews(m, F, 21, x0 + 1, 3, x0 + 15, 9);
  }
  stencil(m, F, 21, 31, 5, "DGN", C.paint_black);
  // Desktop.
  m.box(0, 12, 4, 39, 13, 23, C.steel);
  m.box(0, 12, 23, 39, 13, 23, C.rubber);
  m.box(8, 14, 16, 29, 14, 21, C.paint_black);
  for (let x = 9; x <= 28; x += 2)
    for (let z = 17; z <= 20; z++)
      m.set(x, 15, z, z === 20 && x > 12 && x < 25 ? C.paint_gray : C.coat_shadow);
  switchBank(m, "+y", 13, 32, 17, 4, 2);
  knob(m, "+y", 13, 33, 21, C.paint_black);
  knob(m, "+y", 13, 36, 21, C.safety_red);
  // Mug, ring, notes.
  m.cyl(4, 19, 1.6, 14, 16, C.ceramic);
  m.cyl(4, 19, 0.8, 16, 16, C.coffee);
  coffeeRing(m, 6.5, 13, 15.5, 1.4);
  // Monitors on stands.
  const kinds = ["status", "log", "bars"] as const;
  const cols = ["#33FF33", "#FFAA00", "#33FF33"];
  const screens: ScreenSpec[] = [];
  for (let i = 0; i < 3; i++) {
    const x0 = 1 + i * 13;
    m.box(x0 + 5, 14, 5, x0 + 6, 16, 6, C.steel_dark).box(
      x0 + 3,
      14,
      4,
      x0 + 8,
      14,
      7,
      C.steel_dark,
    );
    chamferBox(m, x0, 17, 3, x0 + 11, 29, 6, C.metal_dark, C.steel_dark);
    screens.push(
      bezelScreen(m, F, 6, x0 + 1, 18, x0 + 10, 27, kinds[i]!, {
        color: cols[i]!,
      }),
    );
  }
  stickyNote(m, F, 7, 35, 26, C.paper_pink);
  stickyNote(m, F, 7, 1, 17, C.paper_yellow);
  // Monitor badges and power LEDs, desk-edge rivets, a missing key.
  for (let i = 0; i < 3; i++) {
    const x0 = 1 + i * 13;
    m.set(x0 + 5, 17, 7, C.chrome).set(x0 + 9, 17, 7, C.led_green);
  }
  rivetRow(m, F, 23, 2, 37, 12, 5, C.steel_dark);
  m.set(15, 15, 18, 0);
  // Cable loom behind the desk.
  harness(
    m,
    [
      [18, 17, 2],
      [18, 0, 2],
    ],
    [C.cable_black, C.cable_red, C.cable_yellow, C.safety_blue],
    "x",
  );
  m.box(18, 12, 2, 21, 12, 2, C.chrome);
  // Radiation survey meter on the desk (the bulkhead check): yellow case,
  // glazed dial, the Geiger tube in its glass sleeve on top, coiled lead.
  chamferBox(m, 31, 14, 9, 38, 19, 14, C.yellow_paint, C.safety_yellow);
  viewport(m, F, 14, 32, 15, 37, 18, 1, C.paint_black, C.glass, C.paper);
  for (const x of [32, 34, 36]) m.set(x, 18, 13, C.paint_black);
  m.set(37, 18, 13, C.safety_red);
  m.box(32, 20, 11, 37, 20, 12, C.glass).box(31, 20, 11, 31, 20, 12, C.chrome);
  m.box(38, 20, 11, 38, 20, 12, C.paint_black);
  cableRun(
    m,
    [
      [31, 20, 12],
      [30, 20, 12],
      [30, 14, 12],
      [30, 14, 16],
    ],
    C.cable_black,
  );
  dust(m, 2);
  return detailVisual(
    m,
    [
      mount("beacon", block(2, 1, 2, C.led_amber), [20, 30.5, 4.5], "blink", {
        speed: 0.6,
        amplitude: 0.3,
      }),
      mount("hdd", block(1, 1, 1, C.led_green), [36.5, 10.5, 22.5], "blink", {
        speed: 3.2,
        amplitude: 0.4,
      }),
      mount("fan", fanRotor(2, "xy"), [8.5, 6.5, 21.5], "spin", {
        axis: "z",
        speed: 11,
      }),
      mount("backlight", block(10, 1, 1, C.screen_cyan), [18.5, 14.5, 22.5], "pulse", {
        speed: 0.4,
        amplitude: 0.6,
      }),
      mount("key", block(1, 1, 1, C.coat_shadow), [15.5, 15.5, 18.5], "piston", {
        speed: 2.6,
        amplitude: -0.6,
      }),
      mount("dose", needleModel(2, C.safety_red, C.paint_black), [35, 15.5, 14.5], "sweep", {
        axis: "z",
        speed: 0.9,
        amplitude: 0.5,
        pivot: [0.5, 0.5, 0.5],
      }),
    ],
    [glow([7, 23, 9], "screen_green", 4, 5), glow([33, 23, 9], "screen_amber", 3, 5)],
    screens,
  );
}

function ecr(): DeviceVisual {
  // Walnut tape deck under a brass mast; the side screen still shows Damien.
  const m = new Model(30, 48, 30);
  const c = 14.5;
  m.cyl(c, c, 13, 0, 1, C.metal_dark);
  m.cyl(c, c, 11.6, 2, 2, C.bronze);
  chamferBox(m, 6, 3, 6, 23, 18, 23, C.walnut, C.wood_dark);
  const F = "+z";
  // Reel deck: two recessed wells, tape path, head.
  for (const cx of [10, 18]) {
    discXY(m, cx, 13, 23, 3.8, 0);
    discXY(m, cx, 13, 22, 3.8, C.black);
  }
  m.box(10, 8, 24, 19, 8, 24, C.coffee);
  m.box(14, 8, 24, 15, 9, 24, C.chrome);
  const screens = [
    bezelScreen(m, F, 23, 8, 4, 21, 6, "wave", {
      color: "#FFAA00",
      frame: C.bronze,
    }),
    bezelScreen(m, "+x", 23, 9, 5, 20, 15, "damien", {
      color: "#ff5fd0",
      frame: C.bronze,
    }),
  ];
  // Mast with bronze collars and a cable drop.
  m.box(14, 19, 14, 15, 40, 15, C.brass);
  for (const y of [19, 26, 33]) m.box(13, y, 13, 16, y, 16, C.bronze);
  m.box(12, 19, 12, 17, 19, 17, C.brass);
  cableRun(
    m,
    [
      [6, 10, 12],
      [3, 10, 12],
      [3, 0, 12],
    ],
    C.cable_black,
  );
  m.set(3, 0, 13, C.chrome);
  stickyNote(m, "-x", 6, 15, 12, C.paper_yellow);
  stickyNote(m, F, 23, 18, 15, C.paper_pink, C.paint_navy);
  // Brass corner caps, tape guide rollers and the record lamp's bezel.
  for (const [x, z] of [
    [7, 7],
    [22, 7],
    [7, 22],
    [22, 22],
  ] as const)
    m.box(x, 18, z, x, 18, z, C.brass);
  m.set(8, 9, 24, C.chrome).set(21, 9, 24, C.chrome);
  m.box(8, 16, 24, 10, 18, 24, C.bronze);
  // Valve amplifier on the deck: glass case over two glowing tubes and a
  // rectifier, a copper output transformer beside it.
  m.box(7, 19, 7, 12, 19, 11, C.wood_dark);
  m.box(7, 20, 7, 12, 24, 11, C.glass).box(8, 20, 8, 11, 23, 10, 0);
  for (const [x, z] of [
    [7, 7],
    [12, 7],
    [7, 11],
    [12, 11],
  ] as const)
    m.box(x, 20, z, x, 24, z, C.brass);
  for (const x of [8, 10]) m.set(x, 20, 9, C.black).box(x, 21, 9, x, 22, 9, C.orange_neon);
  m.set(11, 20, 9, C.black).set(11, 21, 9, C.plasma);
  coilStack(m, 19.5, 9.5, 1.8, 19, 22);
  m.box(18, 23, 8, 21, 23, 11, C.steel_dark);
  // VU meter window on the left flank (its needle kicks with the echo).
  viewport(m, "-x", 6, 8, 13, 12, 16, 2, C.bronze, C.glass_amber, C.paper);
  faceRect(m, "-x", 6, 8, 16, 12, 16, 2, C.paper);
  faceSet(m, "-x", 6, 12, 16, 2, C.safety_red);
  // Leads from the amplifier to the mast foot and the transformer.
  cableRun(
    m,
    [
      [12, 19, 12],
      [13, 19, 12],
    ],
    C.cable_black,
  );
  cableRun(
    m,
    [
      [16, 19, 10],
      [18, 19, 10],
    ],
    C.cable_red,
  );
  dust(m, 2);
  const head = new Model(21, 3, 21);
  for (let i = 2; i <= 7; i++)
    head
      .set(10 + i, 1, 10, C.brass)
      .set(10 - i, 1, 10, C.brass)
      .set(10, 1, 10 + i, C.brass)
      .set(10, 1, 10 - i, C.brass);
  for (const [x, z, tx, tz] of [
    [18, 10, 20, 10],
    [2, 10, 0, 10],
    [10, 18, 10, 20],
    [10, 2, 10, 0],
  ] as const) {
    head.sphere(x, 1, z, 1.3, C.brass);
    head.set(tx, 1, tz, C.neon_magenta);
  }
  return detailVisual(
    m,
    [
      mount("reel_l", reelModel(3.4, C.paint_black, C.chrome), [10.5, 13.5, 23.5], "spin", {
        axis: "z",
        speed: -2,
      }),
      mount("reel_r", reelModel(3.4, C.paint_black, C.chrome), [18.5, 13.5, 23.5], "spin", {
        axis: "z",
        speed: -2.4,
      }),
      mount("antenna_head", head, [15, 37.5, 15], "spin", { speed: 0.6 }),
      mount("bloom", orb(2.5, C.neon_magenta, C.white_gold, 1), [15, 44, 15], "bob", {
        speed: 0.5,
        amplitude: 0.8,
      }),
      mount("whiskers", ecrWhiskers(), [15, 30, 15], "spin", { speed: -0.45 }),
      mount("vu_needle", yzModel(needleModel(2, C.safety_red)), [6.5, 13.5, 10.5], "sweep", {
        axis: "x",
        speed: 1.7,
        amplitude: 0.6,
        pivot: [0.5, 0.5, 0.5],
      }),
      mount("rec", block(1, 1, 1, C.led_red), [9.5, 17.5, 25.5], "blink", {
        speed: 0.8,
        amplitude: 0.6,
      }),
    ],
    [
      glow([15, 44, 15], "neon_magenta", 6, 6),
      glow([25, 10, 15], "neon_pink", 3, 4),
      glow([10, 22, 9], "orange_neon", 2, 3, true, true),
    ],
    screens,
  );
}

/** Brass whiskers on the mast: four rods with sounding spheres (turn against the head). */
function ecrWhiskers(): Model {
  const k = new Model(17, 3, 17);
  k.box(1, 1, 8, 15, 1, 8, C.brass).box(8, 1, 1, 8, 1, 15, C.brass);
  for (const [x, z] of [
    [1, 8],
    [15, 8],
    [8, 1],
    [8, 15],
  ] as const)
    k.sphere(x, 1, z, 1.1, C.gold);
  k.box(7, 0, 7, 9, 2, 9, C.bronze).set(8, 1, 1, C.neon_magenta).set(8, 1, 15, C.neon_magenta);
  return k;
}

function spk(): DeviceVisual {
  // Studio speaker on a tripod: walnut cabinet, flared horn, top spectrum display.
  const m = new Model(22, 34, 22);
  for (const [fx, fz] of [
    [1, 1],
    [20, 1],
    [10.5, 21],
  ] as const) {
    for (let t = 0; t <= 12; t++) {
      const x = Math.round(10.5 + ((fx - 10.5) * t) / 12);
      const z = Math.round(10.5 + ((fz - 10.5) * t) / 12);
      m.box(x, 12 - t, z, x + 1, 13 - t, z + 1, C.steel_dark);
    }
    m.set(Math.round(fx), 0, Math.round(fz), C.rubber);
  }
  m.box(10, 12, 10, 11, 15, 11, C.chrome);
  m.box(6, 14, 9, 15, 15, 12, C.steel_dark);
  m.box(3, 16, 10, 3, 19, 11, C.steel_dark).box(18, 16, 10, 18, 19, 11, C.steel_dark);
  // Cabinet, baffle, woofer well, horn flare, tweeter.
  chamferBox(m, 4, 16, 4, 17, 31, 15, C.walnut, C.wood_dark);
  faceRect(m, "+z", 15, 5, 17, 16, 30, -1, C.paint_black);
  discXY(m, 10.5, 24, 16, 5.2, 0);
  discXY(m, 10.5, 24, 15, 5.2, 0);
  discXY(m, 10.5, 24, 14, 5.2, C.black);
  m.box(10, 18, 16, 11, 19, 16, 0);
  discXY(m, 10.5, 24, 16, 5.6, C.rubber, true);
  discXY(m, 10.5, 24, 17, 6.4, C.chrome, true);
  cornerScrews(m, "+z", 16, 5, 17, 16, 30, C.brass);
  const screens = [bezelScreen(m, "+y", 31, 6, 6, 15, 12, "spectrum", { color: "#E91E8C" })];
  cableRun(
    m,
    [
      [10, 16, 4],
      [10, 13, 4],
      [10, 13, 9],
    ],
    C.cable_black,
  );
  stencil(m, "+x", 17, 13, 18, "SPK", C.gold);
  // Tripod clamp knobs, bass-port ring, cabinet corner protectors.
  m.box(12, 13, 10, 12, 13, 11, C.safety_red);
  for (const [x, y] of [
    [4, 16],
    [17, 16],
    [4, 31],
    [17, 31],
  ] as const)
    m.box(x, y, 15, x, y, 15, C.brass);
  stickyNote(m, "+x", 17, 13, 25, C.paper_yellow);
  // Glazed VU meter on the left cheek, a talkback mic on a gooseneck from
  // the tripod head, and the amp feed down to the floor.
  viewport(m, "-x", 4, 7, 20, 12, 23, 1, C.brass, C.glass, C.paper);
  for (const u of [8, 10, 12])
    faceSet(m, "-x", 4, u, 23, 1, u === 12 ? C.safety_red : C.paint_black);
  cableRun(
    m,
    [
      [15, 14, 12],
      [15, 14, 17],
      [16, 14, 17],
      [16, 17, 17],
      [17, 17, 18],
    ],
    C.chrome,
  );
  harness(
    m,
    [
      [11, 13, 12],
      [11, 0, 12],
      [11, 0, 15],
    ],
    [C.cable_black],
    "x",
  );
  const cone = new Model(9, 9, 3);
  for (let v = 0; v < 9; v++)
    for (let u = 0; u < 9; u++) {
      const d = Math.hypot(u - 4, v - 4);
      if (d > 4.3) continue;
      const z = d < 1.3 ? 2 : d < 3 ? 1 : 0;
      cone.set(u, v, z, d < 1.3 ? C.chrome : d < 3 ? C.steel_dark : C.paint_black);
    }
  return detailVisual(
    m,
    [
      mount("cone", cone, [11, 24.5, 16.5], "bob", {
        axis: "z",
        speed: 6,
        amplitude: 0.4,
      }),
      mount(
        "level",
        ledStrip(5, [C.led_green, C.led_green, C.led_green, C.led_amber, C.led_red], 2),
        [11, 14.5, 13.5],
        "blink",
        { speed: 4, amplitude: 0.7 },
      ),
      mount("tweeter", block(2, 2, 1, C.neon_magenta), [11, 19, 16.5], "bob", {
        axis: "z",
        speed: 9,
        amplitude: 0.25,
      }),
      mount(
        "vu",
        yzModel(needleModel(2, C.safety_red, C.paint_black)),
        [4.5, 20.5, 10.5],
        "sweep",
        { axis: "x", speed: 1.6, amplitude: 0.6, pivot: [0.5, 0.5, 0.5] },
      ),
      mount("mic", spkMic(), [17, 18, 18], "sway", {
        axis: "x",
        speed: 0.5,
        amplitude: 0.2,
        pivot: [1, 0, 1],
      }),
    ],
    [glow([11, 24.5, 19], "neon_magenta", 3, 4), glow([11, 33, 9], "neon_magenta", 2, 3)],
    screens,
  );
}

/** SPK talkback mic head: mesh grille over a chrome ring with a tally LED. */
function spkMic(): Model {
  const h = new Model(2, 4, 2).box(0, 0, 0, 1, 0, 1, C.chrome);
  h.box(0, 1, 0, 1, 3, 1, C.steel_dark).set(1, 3, 1, C.paint_black);
  return h.set(0, 1, 1, C.led_red);
}

function hms(): DeviceVisual {
  // Handmade synth: walnut cheeks, keys, knob panel, patch bay full of cables.
  const m = new Model(40, 34, 22);
  for (const x of [4, 34]) {
    m.box(x, 1, 11, x + 1, 11, 12, C.steel_dark);
    m.box(x, 0, 5, x + 1, 0, 18, C.steel_dark);
    m.set(x, 0, 5, C.rubber).set(x, 0, 18, C.rubber);
  }
  m.box(4, 6, 11, 35, 6, 12, C.steel_dark);
  m.box(0, 12, 4, 39, 15, 21, C.walnut);
  m.box(0, 12, 4, 1, 21, 21, C.walnut).box(38, 12, 4, 39, 21, 21, C.walnut);
  m.box(0, 22, 4, 1, 27, 8, C.walnut).box(38, 22, 4, 39, 27, 8, C.walnut);
  // Keys.
  m.box(2, 16, 16, 37, 16, 21, C.paint_white);
  for (let x = 3; x <= 37; x += 3) m.box(x, 16, 16, x, 16, 21, C.coat_shadow);
  for (let x = 2; x <= 36; x++) {
    const k = Math.floor((x - 2) / 3) % 7;
    if ((x - 2) % 3 === 2 && k !== 2 && k !== 6) m.box(x, 17, 16, x + 1, 17, 18, C.paint_black);
  }
  // Knob panel with two table displays.
  m.box(2, 16, 4, 37, 20, 15, C.orange_paint);
  const screens = [
    bezelScreen(m, "+y", 20, 4, 7, 13, 12, "wave", { color: "#E91E8C" }),
    bezelScreen(m, "+y", 20, 26, 7, 35, 12, "spectrum", { color: "#FFB800" }),
  ];
  for (let x = 16; x <= 23; x += 3) {
    knob(m, "+y", 20, x, 7, C.paint_black);
    // (The red cutoff knob at x = 19 is a part: the filter sweeps itself.)
    if (x !== 19) knob(m, "+y", 20, x, 11, C.paint_cream);
  }
  faceRect(m, "+z", 15, 2, 17, 37, 17, 0, C.paint_black);
  // Patch bay with cables.
  m.box(2, 21, 4, 37, 27, 6, C.paint_black);
  for (let x = 4; x <= 35; x += 3) for (const y of [24, 26]) m.set(x, y, 7, C.brass);
  const patch: [number, number, number][] = [
    [4, 13, C.cable_red],
    [10, 22, C.cable_yellow],
    [16, 31, C.safety_blue],
    [25, 34, C.paint_lime],
  ];
  patch.forEach(([a, b, c], i) => {
    const y = i % 2 ? 24 : 26;
    cableRun(
      m,
      [
        [a, y, 7],
        [a, 22 + (i % 2), 7],
        [b, 22 + (i % 2), 7],
        [b, y, 7],
      ],
      c,
    );
  });
  stickyNote(m, "+x", 39, 15, 22, C.paper_yellow, C.safety_red);
  // Cheek screws and jack labels.
  for (const x of [0, 39]) for (const y of [13, 20]) m.set(x, y, 20, C.brass);
  for (let x = 4; x <= 28; x += 6) m.set(x, 22, 7, C.paper);
  coffeeRing(m, 35.5, 15, 19.5, 1.2);
  // Three glass valves on the patch bay (the oscillator core glows through
  // them), a tube-cage rail around them and the mains lead to the floor.
  for (const x of [9, 15, 21]) {
    glassTube(m, x, 5, 1.1, 28, 32, C.glass, C.steel_dark);
    m.box(x, 29, 5, x, 30, 5, C.orange_neon).set(x, 31, 5, C.steel);
  }
  m.box(6, 28, 3, 24, 28, 3, C.steel).box(6, 28, 7, 24, 28, 7, C.steel);
  dust(m, 1, 0.3);
  harness(
    m,
    [
      [2, 12, 10],
      [2, 0, 10],
      [0, 0, 10],
    ],
    [C.cable_black],
    "z",
  );
  return detailVisual(
    m,
    [
      mount(
        "osc_leds",
        ledStrip(8, [C.neon_magenta, C.led_amber], 4),
        [20.5, 18.5, 16.5],
        "blink",
        {
          speed: 2,
        },
      ),
      mount("sequencer", block(1, 1, 1, C.lime), [20, 21.5, 14.5], "slide", {
        speed: 0.5,
        amplitude: 14,
      }),
      mount("lfo", block(2, 1, 2, C.neon_magenta), [39, 28.5, 6], "blink", {
        speed: 1.3,
        amplitude: 0.5,
      }),
      mount("tape_echo", reelModel(2.4, C.paint_black, C.chrome), [36.5, 24.5, 7.5], "spin", {
        axis: "z",
        speed: -2.2,
      }),
      mount(
        "cutoff",
        new Model(2, 2, 2).box(0, 0, 0, 1, 0, 1, C.safety_red).set(1, 1, 1, C.chrome),
        [20, 21, 12],
        "sweep",
        { speed: 0.25, amplitude: 1.2, pivot: [1, 0, 1] },
      ),
    ],
    [glow([9, 21, 10], "neon_magenta", 4, 5), glow([31, 21, 10], "led_amber", 2, 4)],
    screens,
  );
}

function osc(): DeviceVisual {
  // Three beige CRT scopes on a steel cart, signal generator on the shelf.
  const m = new Model(36, 30, 22);
  const F = "+z";
  for (const [x, z] of [
    [0, 1],
    [34, 1],
    [0, 19],
    [34, 19],
  ] as const) {
    m.box(x, 1, z, x + 1, 10, z + 1, C.steel_dark);
    m.box(x, 0, z, x + 1, 0, z + 1, C.rubber);
  }
  m.box(1, 3, 2, 34, 3, 19, C.steel_dark);
  // Signal generator.
  chamferBox(m, 3, 4, 5, 16, 8, 17, C.paint_gray, C.steel_dark);
  for (let x = 5; x <= 11; x += 3) knob(m, F, 17, x, 5, C.paint_black);
  m.set(14, 6, 18, C.brass).set(14, 5, 18, C.led_green);
  cableRun(
    m,
    [
      [14, 6, 19],
      [14, 6, 20],
      [22, 6, 20],
      [22, 11, 20],
    ],
    C.cable_black,
  );
  // Reference oscillator on the shelf: a glazed crystal oven with the
  // calibration tuning fork ringing inside.
  chamferBox(m, 19, 4, 7, 31, 9, 16, C.paint_cream, C.paint_gray);
  viewport(m, F, 16, 21, 5, 29, 8, 2, C.steel, C.glass, C.black);
  m.box(27, 5, 14, 28, 7, 14, C.crystal_cyan).box(21, 5, 14, 29, 5, 14, C.steel_dark);
  ledRow(m, F, 16, 21, 9, 2, 2, [C.led_amber, C.led_green]);
  // Cart top.
  m.box(0, 10, 1, 35, 11, 20, C.steel);
  m.box(0, 10, 20, 35, 11, 20, C.steel_dark);
  coffeeRing(m, 33.5, 11, 18.5, 1.2);
  const screens: ScreenSpec[] = [];
  for (let i = 0; i < 3; i++) {
    const x0 = i * 12;
    chamferBox(m, x0, 12, 4, x0 + 11, 27, 17, C.beige, C.paint_cream);
    m.box(x0 + 3, 15, 1, x0 + 8, 24, 3, C.beige);
    m.box(x0 + 4, 28, 8, x0 + 7, 28, 8, C.chrome).box(x0 + 4, 28, 13, x0 + 7, 28, 13, C.chrome);
    screens.push(
      bezelScreen(m, F, 17, x0 + 1, 17, x0 + 7, 25, "scope", {
        color: "#AAFF00",
        frame: C.paint_gray,
      }),
    );
    for (const y of [23, 20]) knob(m, F, 17, x0 + 9, y, C.paint_black);
    m.set(x0 + 9, 14, 18, C.brass).set(x0 + 10, 14, 18, C.brass);
    grille(m, "+x", x0 + 11, 6, 13, 14, 16, 1, C.paint_cream);
  }
  stickyNote(m, F, 18, 13, 13, C.paper_pink, C.safety_red);
  // Cart-edge rivets and probe clips on the shelf lip.
  rivetRow(m, F, 20, 2, 33, 10, 4, C.steel);
  for (const x of [19, 25, 31]) m.box(x, 4, 18, x, 5, 18, C.chrome);
  scorch(m, "+y", 27, 30, 10, 2);
  dust(m, 1, 0.3);
  return detailVisual(
    m,
    [
      ...[0, 1, 2].map((i) =>
        mount(`power_${i}`, block(1, 1, 1, C.led_green), [i * 12 + 9.5, 17.5, 18.5], "blink", {
          speed: 0.5 + i * 0.2,
          amplitude: 0.85,
          phase: i,
        }),
      ),
      mount("sweep", block(1, 1, 1, C.lime), [9.5, 7.5, 18.5], "slide", {
        speed: 0.6,
        amplitude: 3,
      }),
      mount("freq_dial", gearModel(1.5, C.paint_black, C.chrome, 6), [6.5, 6.5, 18.5], "step", {
        axis: "z",
        speed: 0.5,
        amplitude: TAU / 12,
      }),
      mount("fork", oscFork(), [24.5, 6, 15.5], "sway", {
        axis: "z",
        speed: 7,
        amplitude: 0.06,
        pivot: [1.5, 0, 0.5],
      }),
    ],
    [glow([18, 21, 20], "screen_green", 5, 6)],
    screens,
  );
}

/** OSC tuning fork (stem at the pivot, two chrome prongs up). */
function oscFork(): Model {
  const f = new Model(3, 3, 1).box(0, 0, 0, 2, 0, 0, C.steel);
  return f.box(0, 1, 0, 0, 2, 0, C.chrome).box(2, 1, 0, 2, 2, 0, C.chrome);
}

function int(): DeviceVisual {
  // Optical bench: source, chopper, lenses, prism, spectrum on a paper screen.
  const m = new Model(40, 24, 22);
  for (const x of [2, 35]) {
    m.box(x, 0, 4, x + 2, 7, 5, C.steel_dark).box(x, 0, 16, x + 2, 7, 17, C.steel_dark);
    m.box(x, 3, 5, x + 2, 3, 16, C.steel_dark);
  }
  m.box(0, 8, 2, 39, 9, 19, C.metal);
  for (let x = 2; x <= 38; x += 3) for (let z = 3; z <= 18; z += 3) m.set(x, 9, z, C.black);
  m.box(1, 10, 10, 34, 10, 11, C.steel_dark);
  // Source.
  chamferBox(m, 1, 10, 6, 8, 17, 15, C.red_paint, C.paint_brick);
  for (let x = 2; x <= 7; x += 2) m.box(x, 18, 8, x, 18, 13, C.aluminium);
  hazardFace(m, "+z", 15, 2, 11, 7, 12, -1);
  m.box(9, 13, 10, 9, 14, 11, C.chrome);
  // Beam, lens posts.
  m.box(10, 14, 10, 22, 14, 10, C.gamma).set(12, 14, 10, 0);
  for (const x of [15, 19]) {
    m.box(x, 11, 10, x, 12, 11, C.steel);
    discYZ(m, x, 14, 10.5, 2.2, C.glass);
  }
  // Receiver board with the painted spectrum.
  m.box(37, 10, 4, 38, 21, 17, C.paper);
  const bands = [
    C.led_red,
    C.orange_neon,
    C.led_amber,
    C.lime,
    C.screen_cyan,
    C.neon_blue,
    C.neon_purple,
  ];
  bands.forEach((c, i) => m.box(36, 12 + i, 6 + i, 36, 12 + i, 15 - i, c));
  // Control box with the live displays.
  chamferBox(m, 12, 10, 16, 31, 14, 19, C.paint_gray, C.steel_dark);
  const screens = [
    bezelScreen(m, "+z", 19, 13, 11, 21, 13, "spectrum", { color: "#00FFFF" }),
    bezelScreen(m, "+z", 19, 24, 11, 29, 13, "bars", { color: "#FFB800" }),
  ];
  stickyNote(m, "+y", 9, 32, 14, C.paper_blue);
  // Breadboard thumbscrews on the lens posts and source cooling-fin caps.
  for (const x of [15, 19]) m.set(x, 11, 12, C.brass);
  for (const [x, z] of [
    [1, 3],
    [38, 3],
    [1, 18],
    [38, 18],
  ] as const)
    m.set(x, 9, z, C.chrome);
  // Filter-wheel post between the lenses and the source's mains lead.
  m.box(17, 10, 10, 17, 10, 11, C.steel).set(17, 10, 12, C.brass);
  dust(m, 1, 0.3);
  harness(
    m,
    [
      [1, 12, 16],
      [1, 12, 20],
      [1, 0, 20],
    ],
    [C.cable_black, C.cable_red],
    "x",
  );
  const spectrum = new Model(11, 7, 1);
  bands.forEach((c, i) => {
    for (let x = 0; x < 11; x++)
      spectrum.set(x, Math.min(6, Math.max(0, Math.round(3 + ((i - 3) * x) / 10))), 0, c);
  });
  const prism = new Model(5, 6, 5);
  for (let y = 0; y < 6; y++)
    for (let z = 0; z < 5; z++) for (let x = 0; x <= 4 - z; x++) prism.set(x, y, z, C.crystal_cyan);
  const chopper = new Model(1, 7, 7);
  for (let z = 0; z < 7; z++)
    for (let y = 0; y < 7; y++) {
      const d = Math.hypot(y - 3, z - 3);
      if (d <= 3.3 && (d < 1 || Math.floor((Math.atan2(y - 3, z - 3) / TAU) * 8 + 8) % 2 === 0))
        chopper.set(0, y, z, d < 1 ? C.chrome : C.paint_black);
    }
  return detailVisual(
    m,
    [
      mount("prism", prism, [25, 14, 11], "sway", {
        axis: "y",
        speed: 0.3,
        amplitude: 0.25,
      }),
      mount("spectrum", spectrum, [30.5, 14.5, 10.5], "pulse", {
        speed: 0.7,
        amplitude: 0.4,
      }),
      mount("chopper", chopper, [12.5, 14.5, 10.5], "spin", {
        axis: "x",
        speed: 8,
      }),
      mount("photon", block(2, 1, 1, C.gamma), [17, 14.5, 10.5], "slide", {
        speed: 0.9,
        amplitude: 5,
      }),
      mount("filters", intFilterWheel(), [17.5, 14.5, 10.5], "step", {
        axis: "x",
        speed: 0.4,
        amplitude: TAU / 4,
      }),
    ],
    [glow([30, 15, 11], "neon_purple", 4, 5), glow([9, 14, 11], "gamma", 4, 4)],
    screens,
  );
}

function and(): DeviceVisual {
  // Anomaly detector: purple console, sensor spikes, big spinning dish.
  const m = new Model(34, 42, 34);
  const c = 16.5;
  m.cyl(c, c, 16.2, 0, 1, C.metal_dark);
  hazardRing(m, c, c, 14.6, 1);
  m.box(2, 2, 16, 31, 2, 17, C.steel_dark).box(16, 2, 2, 17, 2, 31, C.steel_dark);
  // Sensor spikes: coil-wound posts with insulators, each with its lead
  // running in along the floor to the console.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.5;
    const x = Math.round(c + Math.cos(a) * 13);
    const z = Math.round(c + Math.sin(a) * 13);
    m.box(x - 1, 2, z - 1, x + 1, 2, z + 1, C.steel_dark);
    m.box(x, 2, z, x, 10, z, C.steel);
    for (const y of [3, 4, 5])
      m.box(x - 1, y, z, x + 1, y, z, y % 2 ? C.copper : C.bronze).box(
        x,
        y,
        z - 1,
        x,
        y,
        z + 1,
        y % 2 ? C.copper : C.bronze,
      );
    m.set(x, 7, z, C.paint_white).set(x, 11, z, C.neon_blue);
    const ex = Math.round(c + Math.cos(a) * 8.5);
    const ez = Math.round(c + Math.sin(a) * 8.5);
    cableRun(
      m,
      [
        [x, 2, z],
        [ex, 2, z],
        [ex, 2, ez],
      ],
      i % 2 ? C.cable_black : C.safety_blue,
    );
  }
  chamferBox(m, 9, 2, 9, 24, 12, 24, C.purple_paint, C.steel_dark);
  const screens = [
    bezelScreen(m, "+z", 24, 11, 4, 22, 10, "radar", { color: "#33FF33" }),
    bezelScreen(m, "+x", 24, 12, 4, 21, 10, "noise", { color: "#6ad4ff" }),
  ];
  cornerScrews(m, "+y", 12, 10, 10, 23, 23);
  // Anomaly vial (glass, a shard floats inside) and a glass seismo dial.
  m.box(10, 13, 20, 13, 13, 23, C.steel_dark).box(10, 18, 20, 13, 18, 23, C.steel_dark);
  m.box(10, 14, 20, 13, 17, 23, C.glass_purple).box(11, 14, 21, 12, 17, 22, 0);
  m.set(10, 18, 20, C.chrome).set(13, 18, 23, C.chrome);
  m.box(20, 13, 10, 23, 13, 13, C.paint_white).box(20, 14, 10, 23, 15, 13, C.glass);
  m.box(21, 14, 11, 22, 15, 12, 0).set(21, 13, 11, C.safety_red);
  // Mast and yoke.
  m.box(15, 13, 15, 18, 14, 18, C.steel);
  m.box(16, 15, 16, 17, 20, 17, C.steel);
  cableRun(
    m,
    [
      [18, 18, 17],
      [19, 18, 17],
      [19, 13, 17],
    ],
    C.cable_black,
  );
  stickyNote(m, "+z", 24, 18, 12 - 1, C.paper_yellow);
  // Yoke bearing bolts and spike collars.
  for (const [x, z] of [
    [15, 15],
    [18, 15],
    [15, 18],
    [18, 18],
  ] as const)
    m.set(x, 14, z, C.chrome);
  scorch(m, "+y", 1, 5, 24, 2);
  dust(m, 2);
  const dish = new Model(19, 21, 7);
  dish.box(9, 0, 3, 9, 2, 3, C.steel);
  for (let v = 3; v <= 20; v++)
    for (let u = 0; u <= 18; u++) {
      const d = Math.hypot(u - 9, v - 11.5);
      if (d > 8.8) continue;
      dish.set(
        u,
        v,
        Math.min(6, Math.round((d * d) / 14)),
        d < 1.6 ? C.neon_blue : d > 7.6 ? C.purple_paint : C.paint_white,
      );
    }
  dish.box(9, 11, 1, 9, 11, 5, C.steel).set(9, 11, 6, C.screen_cyan);
  return detailVisual(
    m,
    [
      mount("dish", dish, [17, 21, 17], "spin", {
        speed: 0.7,
        pivot: [9.5, 0, 3.5],
      }),
      mount("beacon", block(1, 1, 1, C.led_red), [21.5, 13.5, 23.5], "blink", {
        speed: 0.9,
        amplitude: 0.3,
      }),
      mount("sweep", block(8, 1, 1, C.lime), [17, 13.5, 17], "spin", {
        speed: 1.6,
        pivot: [-2, 0.5, 0.5],
      }),
      mount("feed_led", block(1, 1, 1, C.led_red), [9.5, 11.5, 6.5], "blink", {
        speed: 1.8,
        amplitude: 0.35,
        parent: "dish",
      }),
      mount(
        "vial_shard",
        new Model(2, 3, 2)
          .box(0, 0, 0, 1, 2, 1, C.crystal_violet)
          .box(0, 1, 1, 1, 1, 1, C.neon_purple),
        [12, 15.5, 22],
        "jitter",
        {
          speed: 7,
          amplitude: 0.35,
        },
      ),
      mount(
        "seismo",
        new Model(2, 1, 1).set(0, 0, 0, C.safety_red).set(1, 0, 0, C.paint_black),
        [22.5, 14.5, 12.5],
        "sweep",
        {
          speed: 1.9,
          amplitude: 0.5,
          pivot: [1.5, 0.5, 0.5],
        },
      ),
      mount("spike_arcs", andSparks(), [16.5, 12.5, 16.5], "blink", {
        speed: 2.6,
        amplitude: 0.2,
      }),
    ],
    [glow([17, 34, 20], "neon_blue", 5, 6), glow([17, 8, 26], "screen_green", 2, 3)],
    screens,
  );
}

/** Sparks over the six spike tips (they crackle together). */
function andSparks(): Model {
  const k = new Model(29, 1, 29);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.5;
    const x = Math.round(16.5 + Math.cos(a) * 13) - 2;
    const z = Math.round(16.5 + Math.sin(a) * 13) - 2;
    k.set(x, 0, z, i % 2 ? C.neon_blue : C.white_gold);
  }
  return k;
}

function qcp(): DeviceVisual {
  // Brass compass drum under a glass dome; the needle never quite settles.
  const m = new Model(26, 38, 26);
  const c = 12.5;
  m.cyl(c, c, 11.6, 0, 2, C.walnut);
  m.ring(c, c, 11.4, 2, C.bronze);
  m.cyl(c, c, 9.4, 3, 8, C.brass);
  m.ring(c, c, 9.4, 5, C.bronze, 2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    m.set(Math.round(c + Math.cos(a) * 9.4), 8, Math.round(c + Math.sin(a) * 9.4), C.bronze);
  }
  m.cyl(c, c, 8.6, 9, 9, C.paper);
  m.box(12, 9, 5, 13, 9, 20, C.paint_black).box(5, 9, 12, 20, 9, 13, C.paint_black);
  m.box(12, 9, 4, 13, 9, 5, C.safety_red);
  m.ring(c, c, 6.5, 9, C.paint_black);
  for (let z = 0; z < 26; z++)
    for (let y = 10; y < 20; y++)
      for (let x = 0; x < 26; x++) {
        const d = Math.hypot(x - c, y - 9, z - c);
        if (d >= 8.6 && d <= 9.6) m.set(x, y, z, C.glass);
      }
  m.box(12, 19, 12, 13, 20, 13, C.brass);
  // Armillary over the dome: mast, collar, a fixed meridian and horizon ring
  // (the two inner rings turn inside them).
  m.box(12, 21, 12, 13, 23, 13, C.bronze).box(11, 22, 11, 14, 22, 14, C.brass);
  for (let z = 0; z < 26; z++)
    for (let y = 22; y < 38; y++) {
      const d = Math.hypot(y - 29.5, z - 12.5);
      if (Math.abs(d - 6.6) <= 0.55) m.box(12, y, z, 13, y, z, C.brass);
    }
  m.ring(12.5, 12.5, 6.6, 29, C.bronze);
  for (const z of [6, 19]) m.box(12, 29, z, 13, 30, z, C.chrome);
  m.box(12, 36, 12, 13, 37, 13, C.brass).set(12, 37, 12, C.safety_red);
  // Front plate with a radar readout.
  chamferBox(m, 7, 1, 20, 18, 7, 23, C.bronze, C.brass);
  const screens = [
    bezelScreen(m, "+z", 23, 9, 2, 16, 5, "radar", {
      color: "#b070ff",
      frame: C.brass,
    }),
  ];
  // Drum screws and a compass-rose plate.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    m.set(Math.round(c + Math.cos(a) * 9.4), 4, Math.round(c + Math.sin(a) * 9.4), C.chrome);
  }
  m.box(11, 9, 3, 14, 9, 3, C.bronze);
  dust(m, 1, 0.3);
  const needle = new Model(1, 1, 13);
  needle.box(0, 0, 0, 0, 0, 5, C.safety_red).set(0, 0, 6, C.brass).box(0, 0, 7, 0, 0, 12, C.chrome);
  return detailVisual(
    m,
    [
      mount("needle", needle, [13, 10.5, 13], "sway", {
        axis: "y",
        speed: 0.35,
        amplitude: 0.6,
      }),
      mount("orb", orb(1.5, C.neon_purple, C.white_gold, 0.6), [13, 14.5, 13], "bob", {
        speed: 0.4,
        amplitude: 1,
      }),
      mount("gimbal", ringModel(2, "yz", C.brass, C.neon_purple), [13, 14.5, 13], "spin", {
        speed: 0.5,
      }),
      mount("gimbal_outer", ringModel(3.4, "xy", C.bronze, C.brass), [13, 14.5, 13], "wobble", {
        speed: 0.3,
        amplitude: 0.35,
      }),
      mount("arm_outer", gimbalRing(5, "xy", C.brass, C.chrome), [13, 30, 13], "spin", {
        speed: 0.35,
      }),
      mount("arm_inner", gimbalRing(3.4, "xz", C.bronze, C.brass), [6.5, 6.5, 0.5], "spin", {
        axis: "x",
        speed: -0.6,
        parent: "arm_outer",
      }),
      mount("lodestar", gem(3, 1, C.crystal_violet, C.neon_purple), [5.5, 0.5, 5.5], "pulse", {
        speed: 0.5,
        amplitude: 0.6,
        parent: "arm_inner",
      }),
      mount("bezel", ringModel(10.2, "xz", C.bronze, C.safety_red), [13, 7.5, 13], "step", {
        speed: 0.4,
        amplitude: TAU / 16,
      }),
    ],
    [glow([13, 15, 13], "neon_purple", 4, 4), glow([13, 30, 13], "neon_purple", 3, 4)],
    screens,
  );
}

function dim(): DeviceVisual {
  // Glass column with a twisting vortex, probe posts, console with radar + noise.
  const m = new Model(34, 48, 34);
  const c = 16.5;
  m.cyl(c, c, 16.2, 0, 3, C.metal_dark);
  m.ring(c, c, 16, 2, C.steel_dark);
  m.cyl(c, c, 12, 4, 4, C.steel_dark);
  m.ring(c, c, 8.6, 4, C.black);
  m.cyl(c, c, 7.4, 5, 6, C.steel);
  glassTube(m, c, c, 5.8, 7, 33, C.glass, C.chrome);
  m.cyl(c, c, 7.4, 34, 36, C.steel);
  m.ring(c, c, 7.4, 35, C.steel_dark);
  m.box(16, 37, 16, 17, 40, 17, C.steel_dark).box(16, 41, 16, 17, 41, 17, C.exotic);
  // Tuning fork over the column: two tines, the lens turns between them.
  m.box(10, 37, 16, 23, 37, 17, C.chrome);
  for (const x of [10, 22]) {
    m.box(x, 38, 16, x + 1, 45, 17, C.chrome);
    for (const y of [40, 43]) m.box(x, y, 16, x + 1, y, 17, C.copper);
    m.box(x, 46, 16, x + 1, 47, 17, C.exotic);
  }
  // Field-coil clamps on the glass (four pads per band, the view stays open).
  for (const y of [13, 20, 27])
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + TAU / 8;
      const x = Math.round(c + Math.cos(a) * 6.6);
      const z = Math.round(c + Math.sin(a) * 6.6);
      m.box(x, y, z, x, y + 1, z, C.copper);
    }
  // Feed loom from the top collar down the back-left to the floor.
  harness(
    m,
    [
      [9, 35, 12],
      [2, 35, 12],
      [2, 4, 12],
    ],
    [C.cable_black, C.safety_blue, C.cable_black],
    "z",
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26;
    const x = Math.round(c + Math.cos(a) * 12.5);
    const z = Math.round(c + Math.sin(a) * 12.5);
    m.box(x - 1, 4, z - 1, x + 1, 5, z + 1, C.steel_dark);
    m.box(x, 6, z, x, 12, z, C.steel);
    m.set(x, 13, z, C.exotic);
  }
  chamferBox(m, 8, 4, 26, 25, 10, 31, C.metal, C.steel_dark);
  const screens = [
    bezelScreen(m, "+z", 31, 10, 5, 15, 8, "radar", { color: "#00FFFF" }),
    bezelScreen(m, "+z", 31, 18, 5, 23, 8, "noise", { color: "#4B3BFF" }),
  ];
  stickyNote(m, "+y", 10, 20, 27, C.paper_pink, C.safety_red);
  scorch(m, "+y", 3, 6, 22, 2.2);
  // Collar bolts top and bottom.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const x = Math.round(c + Math.cos(a) * 7);
    const z = Math.round(c + Math.sin(a) * 7);
    m.set(x, 6, z, C.chrome).set(x, 34, z, C.chrome);
  }
  dust(m, 2);
  const vortex = new Model(9, 25, 9);
  for (let y = 0; y < 25; y++)
    for (let k = 0; k < 2; k++) {
      const a = y * 0.5 + k * Math.PI;
      const r = 3.2 - Math.abs(y - 12) * 0.1;
      vortex.set(
        Math.round(4 + Math.cos(a) * r),
        y,
        Math.round(4 + Math.sin(a) * r),
        k ? C.neon_blue : C.exotic,
      );
    }
  vortex.box(4, 0, 4, 4, 24, 4, C.glass_purple);
  const probe = orb(1.5, C.steel, C.exotic, 0.6);
  return detailVisual(
    m,
    [
      mount("vortex", vortex, [17, 20.5, 17], "spin", { speed: 3 }),
      mount("probe_a", probe, [17, 16, 17], "orbit", {
        speed: 0.9,
        amplitude: 10,
      }),
      mount("probe_b", probe, [17, 23, 17], "orbit", {
        speed: -1.2,
        amplitude: 10,
        phase: 2,
      }),
      mount("probe_c", probe, [17, 30, 17], "orbit", {
        speed: 0.7,
        amplitude: 9.5,
        phase: 4,
      }),
      mount("field_ring", ringModel(6.8, "xz", C.chrome, C.exotic), [17, 10.5, 17], "piston", {
        speed: 0.25,
        amplitude: 20,
      }),
      mount("lens", ringModel(4.2, "xy", C.chrome, C.exotic), [17, 42.5, 17], "spin", {
        speed: 1.4,
      }),
      mount("lens_core", orb(1.5, C.glass_purple, C.exotic, 0.8), [17, 42.5, 17], "wobble", {
        speed: 0.7,
        amplitude: 0.4,
      }),
      mount("spark", dimSpark(), [17, 46.5, 17], "jitter", { speed: 11, amplitude: 0.5 }),
      mount("chase", ledRing(8.6, 12, [C.exotic, C.neon_blue, 0]), [17, 5.5, 17], "spin", {
        speed: -1.8,
      }),
    ],
    [glow([17, 22, 17], "exotic", 8, 7), glow([17, 7, 33], "screen_cyan", 2, 3)],
    screens,
  );
}

/** Spark jumping between the fork's tine tips. */
function dimSpark(): Model {
  const k = new Model(9, 2, 2);
  for (let x = 0; x < 9; x++)
    k.set(x, (x * 3) % 5 < 2 ? 1 : 0, x % 3 === 0 ? 1 : 0, x % 2 ? C.exotic : C.neon_blue);
  return k;
}

function exd(): DeviceVisual {
  // Landing pad with a charge post and a windsock mast; the drone hovers on four rotors.
  const m = new Model(36, 27, 36);
  m.box(0, 0, 0, 35, 1, 35, C.steel_dark);
  m.box(1, 2, 1, 34, 2, 34, C.metal);
  for (let i = 0; i < 34; i += 3) m.box(1 + i, 2, 1, 1 + i, 2, 34, C.steel_dark);
  // Yellow H.
  m.box(11, 2, 10, 13, 2, 25, C.safety_yellow).box(22, 2, 10, 24, 2, 25, C.safety_yellow);
  m.box(11, 2, 17, 24, 2, 18, C.safety_yellow);
  hazardFace(m, "+y", 2, 1, 1, 8, 2);
  hazardFace(m, "+y", 2, 27, 33, 34, 34);
  hazardFace(m, "+z", 35, 1, 0, 26, 1);
  for (const [x, z] of [
    [1, 34],
    [34, 1],
    [1, 17],
    [34, 17],
    [17, 1],
  ] as const)
    m.set(x, 3, z, C.led_green);
  // Charge post.
  chamferBox(m, 28, 2, 28, 34, 7, 34, C.safety_yellow, C.yellow_paint);
  const screens = [bezelScreen(m, "+z", 34, 30, 3, 33, 6, "radar", { color: "#00FFFF" })];
  cableRun(
    m,
    [
      [28, 3, 30],
      [18, 3, 30],
      [18, 3, 26],
    ],
    C.cable_black,
  );
  m.set(18, 3, 25, C.chrome);
  scorch(m, "+y", 2, 17.5, 17.5, 3.5);
  stickyNote(m, "+y", 2, 3, 30, C.paper_yellow);
  // Pad tie-down bolts and the charge post's contact plate.
  for (const [x, z] of [
    [4, 4],
    [31, 4],
    [4, 31],
    [14, 31],
  ] as const)
    m.set(x, 3, z, C.chrome);
  m.box(29, 7, 29, 33, 7, 33, C.copper);
  // Windsock mast in the back corner with a glazed obstruction lamp on top.
  m.box(1, 3, 1, 3, 3, 3, C.steel_dark).box(2, 4, 2, 2, 23, 2, C.steel);
  for (const y of [9, 16]) m.box(1, y, 2, 3, y, 2, C.safety_orange);
  for (let y = 24; y <= 26; y++)
    for (let z = 1; z <= 3; z++)
      for (let x = 1; x <= 3; x++)
        m.set(x, y, z, x === 2 && z === 2 && y < 26 ? C.led_red : C.glass_red);
  // Charge feed: from the post down its side and along a duct in the pad edge.
  cableRun(
    m,
    [
      [35, 6, 31],
      [35, 1, 31],
      [35, 1, 18],
    ],
    C.cable_black,
  );
  m.box(35, 0, 17, 35, 1, 17, C.steel);
  const drone = new Model(24, 8, 24);
  chamferBox(drone, 8, 2, 8, 15, 6, 15, C.paint_white, C.steel);
  drone.box(10, 7, 10, 13, 7, 13, C.glass);
  drone.box(10, 3, 16, 13, 5, 16, C.black).box(11, 4, 16, 12, 4, 16, C.screen_cyan);
  drone.box(8, 0, 9, 8, 1, 14, C.steel_dark).box(15, 0, 9, 15, 1, 14, C.steel_dark);
  for (const [x, z] of [
    [2, 2],
    [20, 2],
    [2, 20],
    [20, 20],
  ] as const) {
    for (let t = 0; t <= 6; t++) {
      const px = x + Math.sign(11.5 - x) * t;
      const pz = z + Math.sign(11.5 - z) * t;
      drone.box(px, 4, pz, px + 1, 4, pz + 1, C.steel);
    }
    drone.box(x, 2, z, x + 1, 5, z + 1, C.metal_dark);
  }
  drone.set(2, 5, 21, C.led_red).set(21, 5, 21, C.led_green);
  const rotor = (i: number, x: number, z: number) =>
    mount(`rotor_${i}`, fanRotor(4, "xz", C.rubber, C.steel), [x + 1, 6.5, z + 1], "spin", {
      speed: 25 * (i % 2 ? -1 : 1),
      parent: "drone",
    });
  return detailVisual(
    m,
    [
      mount("drone", drone, [18, 13, 18], "bob", {
        speed: 0.4,
        amplitude: 1.6,
      }),
      rotor(0, 2, 2),
      rotor(1, 20, 2),
      rotor(2, 2, 20),
      rotor(3, 20, 20),
      mount("nav", block(1, 1, 1, C.led_red), [12, 3.5, 17.5], "blink", {
        speed: 1.5,
        amplitude: 0.2,
        parent: "drone",
      }),
      mount("charge", block(1, 1, 1, C.led_green), [31.5, 8.5, 31.5], "blink", {
        speed: 0.9,
        amplitude: 0.5,
      }),
      mount("windsock", exdSock(), [2.5, 21, 2.5], "sway", {
        axis: "y",
        speed: 0.25,
        amplitude: 0.5,
        phase: 0.8,
        pivot: [0.5, 1, 1.5],
      }),
    ],
    [glow([18, 6, 18], "screen_cyan", 4, 4), glow([31, 5, 35], "screen_cyan", 2, 3)],
    screens,
  );
}

/** EXD windsock: a hoop on the mast, orange/white bands tapering along +x. */
function exdSock(): Model {
  const w = new Model(8, 3, 3);
  for (let x = 1; x < 8; x++) {
    const c = Math.floor((x - 1) / 2) % 2 ? C.paint_white : C.safety_orange;
    const r = x < 4 ? 1 : 0;
    w.box(x, 1 - r, 1 - r, x, 1 + r, 1 + r, c);
  }
  return w.set(0, 1, 1, C.steel);
}

function nxs(): DeviceVisual {
  // Salvaged holo-projector: pillars, crown ring, emitter lens, tech-graph globe.
  const m = new Model(44, 48, 44);
  const c = 21.5;
  m.box(0, 0, 0, 43, 3, 43, C.metal);
  m.box(1, 0, 43, 42, 3, 43, C.wall_trim);
  for (let x = 3; x <= 40; x += 6) m.set(x, 2, 43, C.hazard_black);
  m.cyl(c, c, 16, 4, 6, C.metal_dark);
  m.ring(c, c, 16, 6, C.steel);
  m.cyl(c, c, 10.4, 7, 8, C.steel);
  m.cyl(c, c, 6.4, 9, 9, C.screen_cyan);
  m.cyl(c, c, 3.2, 9, 9, C.gamma);
  for (const [x, z] of [
    [5, 5],
    [36, 5],
    [5, 36],
    [36, 36],
  ] as const) {
    m.box(x - 1, 4, z - 1, x + 3, 5, z + 3, C.steel_dark);
    m.box(x, 6, z, x + 2, 38, z + 2, C.steel);
    for (const y of [16, 27]) m.box(x, y, z, x + 2, y + 1, z + 2, C.chrome);
    m.box(x, 39, z, x + 2, 40, z + 2, C.screen_cyan);
    cornerScrews(m, "+y", 5, x - 1, z - 1, x + 3, z + 3);
  }
  m.ring(c, c, 19.5, 41, C.steel, 2);
  // Canopy: four arms rise from the pillar tops to an overhead lens.
  for (const [x, z] of [
    [6, 6],
    [37, 6],
    [6, 37],
    [37, 37],
  ] as const)
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      const ax = Math.round(x + (c - x) * f * 0.78);
      const az = Math.round(z + (c - z) * f * 0.78);
      m.box(
        ax,
        43 + Math.round(f * 3),
        az,
        ax,
        43 + Math.round(f * 3),
        az,
        i % 4 === 0 ? C.chrome : C.steel,
      );
      if (i === 0) m.box(x, 41, z, x, 42, z, C.steel);
    }
  m.ring(c, c, 4.4, 46, C.steel, 2);
  m.cyl(c, c, 2.2, 45, 45, C.gamma).cyl(c, c, 3.4, 47, 47, C.steel_dark);
  // Lens turret: a glass drum round the floor emitter.
  glassDrum(m, c, c, 11.4, 8, 13, C.glass, C.chrome);
  // Floor looms from every pillar into the plinth.
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    const px = sx > 0 ? 8 : 35;
    const pz = sz > 0 ? 6 : 37;
    for (const [k, col] of [
      [0, C.cable_black],
      [1, sx > 0 ? C.safety_blue : C.cable_red],
    ] as const)
      cableRun(
        m,
        [
          [px, 4, pz + sz * k],
          [px + sx * (4 - k), 4, pz + sz * k],
          [px + sx * (4 - k), 4, pz + sz * 7],
        ],
        col,
      );
  }
  // Console.
  chamferBox(m, 15, 4, 35, 28, 10, 40, C.metal_dark, C.steel_dark);
  const screens = [
    bezelScreen(m, "+z", 40, 17, 5, 26, 9, "map", { color: "#00FFFF" }),
    bezelScreen(m, "+y", 10, 17, 36, 26, 38, "code", { color: "#3fa7ff" }),
  ];
  // Damien's aquarium relics: a treasure chest and a little diver.
  m.box(30, 4, 30, 33, 5, 32, C.wood).box(30, 6, 30, 33, 6, 32, C.wood_dark);
  m.set(31, 5, 33, C.gold).set(32, 6, 31, C.gold);
  m.box(10, 4, 29, 10, 6, 29, C.safety_orange).set(10, 7, 29, C.brass);
  stickyNote(m, "+z", 43, 36, 0, C.paper_yellow);
  // Emitter-ring bolts.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    m.set(Math.round(c + Math.cos(a) * 13), 6, Math.round(c + Math.sin(a) * 13), C.chrome);
  }
  dust(m, 2);
  const core = new Model(17, 17, 17);
  for (let z = 0; z < 17; z++)
    for (let y = 0; y < 17; y++)
      for (let x = 0; x < 17; x++) {
        const d = Math.hypot(x - 8, y - 8, z - 8);
        if (d <= 2.4) core.set(x, y, z, C.neon_blue);
        else if (d >= 7.2 && d <= 8.2 && (x * 3 + y * 5 + z * 7) % 9 === 0)
          core.set(x, y, z, C.screen_cyan);
      }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    for (let r = 3; r <= 7; r++)
      core.set(
        Math.round(8 + Math.cos(a) * r),
        8 + ((i % 3) - 1) * Math.round(r / 3),
        Math.round(8 + Math.sin(a) * r),
        C.holo_cyan,
      );
  }
  const graph = new Model(29, 5, 29);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const x = Math.round(14 + Math.cos(a) * 13);
    const z = Math.round(14 + Math.sin(a) * 13);
    graph.box(x, i % 5, z, x + 1, i % 5, z + 1, i % 2 ? C.screen_cyan : C.cerulean);
  }
  return detailVisual(
    m,
    [
      mount("core", core, [22, 25, 22], "spin", { speed: 0.5 }),
      mount("graph", graph, [22, 25, 22], "spin", { speed: -0.3 }),
      mount("emitter", ringModel(8, "xz", C.screen_cyan, C.gamma), [22, 10.5, 22], "bob", {
        speed: 0.6,
        amplitude: 1.2,
      }),
      mount("crown_scan", block(2, 1, 2, C.screen_cyan), [22, 43.5, 22], "orbit", {
        speed: 0.8,
        amplitude: 19.5,
      }),
      mount("lens", ringModel(3, "xz", C.chrome, C.screen_cyan), [22, 44.5, 22], "spin", {
        speed: -2.2,
      }),
      mount("globe_ring", ringModel(9.6, "xz", C.holo_cyan, C.gamma), [22, 25, 22], "wobble", {
        speed: 0.35,
        amplitude: 0.45,
      }),
      mount("pillar_chase", nxsChase(), [22, 8.5, 22], "slide", {
        axis: "y",
        speed: 0.25,
        amplitude: 14,
        pivot: [14, 0, 14],
      }),
    ],
    [glow([22, 25, 22], "screen_cyan", 12, 9), glow([22, 11, 22], "neon_blue", 5, 5)],
    screens,
  );
}

/** Four light carriages, one on each pillar's inner edge (they ride up together). */
function nxsChase(): Model {
  const k = new Model(28, 2, 28);
  for (const [x, z] of [
    [0, 0],
    [27, 0],
    [0, 27],
    [27, 27],
  ] as const)
    k.box(x, 0, z, x, 1, z, C.screen_cyan);
  return k;
}

function lct(): DeviceVisual {
  // Laser cutter: finned head, beam across the bed, scorched stage, beam dump.
  const m = new Model(40, 24, 20);
  const F = "+z";
  chamferBox(m, 0, 0, 2, 39, 8, 17, C.metal, C.steel_dark);
  m.box(1, 0, 3, 38, 0, 16, C.black);
  grille(m, F, 17, 3, 2, 12, 6, 2, C.steel_dark);
  cornerScrews(m, F, 17, 1, 1, 38, 7);
  const screens = [bezelScreen(m, F, 17, 25, 2, 34, 6, "bars", { color: "#ff4040" })];
  knob(m, F, 17, 16, 3, C.safety_red);
  knob(m, F, 17, 20, 3, C.paint_black);
  m.box(0, 9, 2, 39, 9, 17, C.steel);
  // Laser head.
  chamferBox(m, 2, 10, 4, 13, 19, 15, C.red_paint, C.paint_brick);
  for (let x = 3; x <= 12; x += 2) m.box(x, 20, 6, x, 21, 13, C.aluminium);
  hazardFace(m, F, 15, 3, 11, 12, 12, -1);
  m.box(14, 13, 9, 15, 15, 10, C.chrome);
  // Stage with clamps, beam dump.
  m.box(26, 10, 5, 35, 11, 14, C.steel_dark);
  m.box(26, 12, 5, 27, 13, 6, C.safety_blue).box(34, 12, 13, 35, 13, 14, C.safety_blue);
  scorch(m, "+y", 11, 31, 9, 3);
  m.box(37, 10, 6, 39, 19, 13, C.metal_dark);
  m.box(37, 12, 8, 37, 17, 11, C.black);
  // Hose to the floor, notes.
  cableRun(
    m,
    [
      [6, 17, 3],
      [6, 17, 1],
      [6, 0, 1],
    ],
    C.cable_black,
  );
  cableRun(
    m,
    [
      [8, 15, 3],
      [8, 15, 0],
      [8, 0, 0],
    ],
    C.safety_blue,
  );
  stickyNote(m, "+x", 13, 6, 15, C.paper_yellow, C.safety_red);
  // Head rail with end stops, bed-clamp screws.
  m.box(1, 21, 2, 14, 21, 2, C.chrome).box(1, 20, 2, 1, 21, 3, C.safety_red);
  m.set(26, 14, 5, C.chrome).set(35, 14, 14, C.chrome);
  // Amber laser-safety hood over the stage: steel frame, tinted panes on
  // the front, top and back, the beam port open on the head side.
  for (const [x, z] of [
    [24, 3],
    [36, 3],
    [24, 16],
    [36, 16],
  ] as const)
    m.box(x, 10, z, x, 18, z, C.steel_dark);
  m.box(25, 10, 16, 35, 17, 16, C.glass_amber).box(25, 10, 3, 35, 17, 3, C.glass_amber);
  m.box(25, 18, 4, 35, 18, 15, C.glass_amber);
  m.box(24, 18, 3, 36, 18, 3, C.steel_dark).box(24, 18, 16, 36, 18, 16, C.steel_dark);
  m.box(24, 18, 4, 24, 18, 15, C.steel_dark).box(36, 18, 4, 36, 18, 15, C.steel_dark);
  m.box(29, 18, 16, 31, 18, 17, C.safety_yellow);
  dust(m, 2);
  const head = fanRotor(3, "xz", C.steel_dark, C.chrome);
  return detailVisual(
    m,
    [
      mount("beam", block(15, 1, 1, C.led_red), [23.5, 14.5, 10], "blink", {
        speed: 3,
        amplitude: 0.8,
      }),
      mount("spark", motes(1.5, 2, 4, [C.white_gold, C.orange_neon], 2), [31, 13, 10], "jitter", {
        speed: 15,
        amplitude: 0.6,
      }),
      mount("workpiece", gem(5, 2, C.crystal_violet, C.abstractum), [31, 14.5, 10], "spin", {
        speed: 0.8,
      }),
      mount("head_fan", head, [8, 22.5, 10], "spin", { speed: 9 }),
      mount("galvo", block(1, 3, 2, C.chrome), [25.5, 14.5, 10], "sweep", {
        speed: 0.8,
        amplitude: 0.5,
      }),
    ],
    [glow([31, 14, 10], "led_red", 6, 5, true, true), glow([30, 5, 19], "led_red", 2, 3)],
    screens,
  );
}

function p3d(): DeviceVisual {
  // Box-frame printer: glass side, gantry, spool, sliding head and bed.
  const m = new Model(34, 42, 34);
  const F = "+z";
  chamferBox(m, 0, 0, 0, 33, 5, 31, C.paint_white, C.steel);
  const screens = [bezelScreen(m, F, 31, 4, 1, 13, 4, "status", { color: "#FFAA00" })];
  keypad(m, 20, 2, 4, 1, 32);
  m.set(29, 3, 32, C.safety_red);
  for (const [x, z] of [
    [0, 0],
    [32, 0],
    [0, 30],
    [32, 30],
  ] as const)
    m.box(x, 6, z, x + 1, 39, z + 1, C.paint_white);
  m.box(0, 40, 0, 33, 41, 31, C.paint_white).box(2, 40, 2, 31, 41, 29, 0);
  m.box(2, 6, 0, 31, 39, 1, C.paint_gray);
  m.box(33, 6, 2, 33, 39, 29, C.glass);
  m.box(0, 6, 2, 0, 39, 29, C.paint_gray);
  // Gantry rails.
  m.box(2, 34, 16, 31, 34, 16, C.chrome);
  m.box(1, 35, 2, 1, 35, 29, C.steel_dark).box(32, 35, 2, 32, 35, 29, C.steel_dark);
  m.box(15, 6, 15, 18, 7, 18, C.chrome);
  // Filament spool on the back wall, filament to the head.
  discXY(m, 24, 26, 2, 1.6, C.steel_dark);
  m.box(24, 26, 2, 24, 26, 3, C.chrome);
  cableRun(
    m,
    [
      [24, 31, 3],
      [24, 36, 3],
      [17, 36, 3],
      [17, 36, 15],
    ],
    C.safety_orange,
  );
  // A failed print on the floor of the chamber, and a note.
  for (const [x, z] of [
    [4, 24],
    [5, 25],
    [6, 24],
    [5, 26],
    [7, 27],
  ] as const)
    m.set(x, 6, z, C.safety_orange);
  stickyNote(m, F, 31, 26, 38, C.paper_pink);
  // Frame corner brackets and rail end caps.
  for (const [x, z] of [
    [0, 0],
    [32, 0],
    [0, 30],
    [32, 30],
  ] as const)
    for (const y of [6, 39]) m.box(x, y, z, x + 1, y, z + 1, C.steel_dark);
  m.set(2, 34, 16, C.safety_red).set(31, 34, 16, C.safety_red);
  // Z lead-screw bearings (the screws turn as the bed steps).
  for (const x of [4, 29]) m.box(x - 1, 6, 3, x + 1, 6, 5, C.steel_dark).set(x, 33, 4, C.brass);
  dust(m, 2);
  harness(
    m,
    [
      [31, 3, 32],
      [31, 0, 32],
      [33, 0, 32],
    ],
    [C.cable_black],
    "z",
  );
  const head = new Model(6, 6, 6);
  head.box(0, 2, 0, 5, 5, 5, C.steel_dark).box(1, 3, 5, 4, 4, 5, C.black);
  head.box(2, 1, 2, 3, 1, 3, C.chrome).set(2, 0, 2, C.orange_neon);
  head.set(5, 5, 5, C.led_green);
  const bed = new Model(20, 7, 20);
  bed.box(0, 0, 0, 19, 0, 19, C.metal_dark);
  bed.box(2, 1, 2, 17, 1, 17, C.steel_dark);
  for (let y = 2; y <= 6; y++) {
    const r = y < 5 ? 3 : 2;
    bed.box(10 - r, y, 10 - r, 9 + r, y, 9 + r, y === 6 ? C.orange_neon : C.safety_orange);
    if (y < 6) bed.box(11 - r, y, 11 - r, 8 + r, y, 8 + r, 0);
  }
  return detailVisual(
    m,
    [
      mount("print_head", head, [17, 31, 17], "slide", {
        speed: 0.35,
        amplitude: 9,
      }),
      mount("bed", bed, [17, 12, 17], "slide", {
        axis: "z",
        speed: 0.17,
        amplitude: 2.5,
      }),
      mount("status", block(1, 1, 1, C.led_green), [30.5, 4.5, 32.5], "blink", {
        speed: 0.5,
        amplitude: 0.8,
      }),
      mount("hotend_fan", fanRotor(1, "xy", C.steel, C.metal_dark), [3, 3.5, 6.5], "spin", {
        axis: "z",
        speed: 14,
        parent: "print_head",
      }),
      mount("spool", reelModel(4.6, C.safety_orange, C.steel_dark), [24.5, 26.5, 4.5], "spin", {
        axis: "z",
        speed: 0.5,
      }),
      mount("screw_l", leadScrew(26), [4.5, 7, 4.5], "spin", {
        speed: 1.4,
        pivot: [1.5, 0, 1.5],
      }),
      mount("screw_r", leadScrew(26), [29.5, 7, 4.5], "spin", {
        speed: 1.4,
        pivot: [1.5, 0, 1.5],
      }),
    ],
    [glow([17, 24, 17], "orange_neon", 5, 5), glow([9, 3, 33], "screen_amber", 2, 3)],
    screens,
  );
}

/** Threaded lead screw (3×h×3): a chrome core with a steel helix (spun about y). */
function leadScrew(h: number): Model {
  const s = new Model(3, h, 3);
  for (let y = 0; y < h; y++) {
    s.set(1, y, 1, C.chrome);
    const a = y * 1.1;
    s.set(1 + Math.round(Math.cos(a)), y, 1 + Math.round(Math.sin(a)), C.steel_dark);
  }
  return s;
}

// ── Tier 3 ───────────────────────────────────────────────────────

function mfr(): DeviceVisual {
  // Microfusion reactor: glass containment, magnetic rings, twin coolant loops.
  const m = new Model(52, 52, 52);
  const c = 25.5;
  m.box(0, 0, 0, 51, 5, 51, C.steel_dark);
  hazardFace(m, "+z", 51, 0, 1, 51, 4);
  hazardFace(m, "+x", 51, 0, 1, 51, 4);
  m.cyl(c, c, 21, 6, 9, C.metal_dark);
  m.ring(c, c, 20.6, 9, C.safety_yellow);
  m.cyl(c, c, 13.4, 10, 10, C.chrome);
  m.cyl(c, c, 8, 10, 10, C.steel);
  glassTube(m, c, c, 12.6, 11, 38, C.glass, C.chrome);
  m.cyl(c, c, 16, 39, 44, C.metal_dark);
  m.ring(c, c, 16, 41, C.steel);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    m.box(
      Math.round(c + Math.cos(a) * 16),
      42,
      Math.round(c + Math.sin(a) * 16),
      Math.round(c + Math.cos(a) * 16),
      43,
      Math.round(c + Math.sin(a) * 16),
      C.black,
    );
  }
  m.cyl(c, c, 10, 45, 45, C.steel);
  m.cyl(c, c, 4, 46, 49, C.steel_dark);
  m.cyl(c, c, 2, 50, 50, C.black);
  // Struts and top frame.
  for (const [x, z] of [
    [7, 7],
    [42, 7],
    [7, 42],
    [42, 42],
  ] as const) {
    m.box(x - 1, 6, z - 1, x + 3, 7, z + 3, C.steel_dark);
    m.box(x, 6, z, x + 2, 44, z + 2, C.steel);
    for (const y of [16, 30]) m.box(x, y, z, x + 2, y, z + 2, C.brass);
  }
  m.box(7, 43, 7, 44, 44, 9, C.steel).box(7, 43, 42, 44, 44, 44, C.steel);
  m.box(7, 43, 7, 9, 44, 44, C.steel).box(42, 43, 7, 44, 44, 44, C.steel);
  // Coolant loops: cold (blue, frosty) left, hot (red, scorched) right.
  for (const [x, col, dir] of [
    [1, C.safety_blue, 1],
    [49, C.safety_red, -1],
  ] as const) {
    m.box(x, 6, 24, x + 1, 46, 27, col);
    m.box(x, 45, 24, x + dir * 12 + (dir > 0 ? 1 : 0), 46, 27, col);
    for (const y of [14, 28]) m.box(x - 0, y, 23, x + 1, y + 1, 28, C.brass);
    m.box(x, 20, 28, x + 1, 21, 29, C.safety_red);
  }
  for (let y = 7; y <= 44; y += 3) m.set(0, y, 25 + (y % 2), C.ice);
  scorch(m, "+x", 51, 26, 30, 3);
  // Control console.
  chamferBox(m, 16, 6, 44, 35, 15, 49, C.metal, C.steel_dark);
  const screens = [
    bezelScreen(m, "+z", 49, 18, 8, 28, 14, "reactor", { color: "#FF6B00" }),
    bezelScreen(m, "+z", 49, 30, 8, 33, 14, "status", { color: "#FFAA00" }),
  ];
  switchBank(m, "+y", 15, 19, 46, 6, 2, C.safety_red);
  stickyNote(m, "+x", 35, 45, 9, C.paper_yellow, C.safety_red);
  // Base-ring bolts, strut rivets and the vent cap's guard.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    m.set(Math.round(c + Math.cos(a) * 18.5), 9, Math.round(c + Math.sin(a) * 18.5), C.chrome);
  }
  for (const [x, z] of [
    [7, 7],
    [42, 7],
    [7, 42],
    [42, 42],
  ] as const)
    for (let y = 10; y <= 40; y += 6) m.set(x + 1, y, z + 3 > 44 ? z - 1 : z + 3, C.steel_dark);
  m.box(25, 50, 22, 26, 50, 29, C.chrome).box(22, 50, 25, 29, 50, 26, C.chrome);
  // SCRAM rod housings on the lid (the rods themselves stroke as the core breathes).
  for (const x of [16, 34]) m.box(x, 45, 25, x + 1, 45, 26, C.safety_yellow);
  dust(m, 3);
  // Console feed down over the hazard band into the floor duct.
  harness(
    m,
    [
      [36, 9, 50],
      [36, 9, 51],
      [36, 0, 51],
    ],
    [C.cable_red, C.cable_black],
    "x",
  );
  const ring = () => ringModel(16.5, "xz", C.copper, C.orange_neon, 2);
  return detailVisual(
    m,
    [
      mount("core", orb(6.5, C.plasma, C.white_gold, 3.5), [26, 25, 26], "pulse", {
        speed: 0.9,
        amplitude: 0.5,
      }),
      mount("ring_low", ring(), [26, 16, 26], "spin", { speed: 1.5 }),
      mount("ring_mid", ring(), [26, 25, 26], "spin", { speed: -1.5 }),
      mount("ring_high", ring(), [26, 34, 26], "spin", {
        speed: 1.5,
        phase: 1,
      }),
      mount(
        "arcs",
        motes(9, 20, 14, [C.plasma, C.white_gold, C.orange_neon], 7),
        [26, 25, 26],
        "jitter",
        {
          speed: 12,
          amplitude: 0.8,
        },
      ),
      mount("vent_fan", fanRotor(3, "xz", C.steel, C.metal_dark), [26, 49.5, 26], "spin", {
        speed: 11,
      }),
      mount("scram_a", pistonModel(4, 2, C.safety_yellow), [17, 46, 26], "piston", {
        speed: 0.3,
        amplitude: 2,
        pivot: [1, 0, 1],
      }),
      mount("scram_b", pistonModel(4, 2, C.safety_yellow), [35, 46, 26], "piston", {
        speed: 0.3,
        amplitude: 2,
        phase: Math.PI,
        pivot: [1, 0, 1],
      }),
    ],
    [glow([26, 25, 26], "plasma", 40, 16, true, true), glow([26, 11, 52], "screen_amber", 3, 4)],
    screens,
  );
}

function emc(): DeviceVisual {
  // Glass containment cube: purple panes, emitter pads, floating exotic matter.
  const m = new Model(36, 51, 36);
  m.box(0, 0, 0, 35, 5, 33, C.metal_dark);
  hazardFace(m, "+z", 33, 0, 1, 35, 2);
  m.box(0, 42, 0, 35, 47, 33, C.metal_dark);
  for (let x = 4; x <= 31; x += 3) m.box(x, 47, 4, x, 47, 29, C.black);
  for (const [x, z] of [
    [0, 0],
    [33, 0],
    [0, 31],
    [33, 31],
  ] as const)
    m.box(x, 6, z, x + 2, 41, z + 2, C.steel);
  m.box(3, 6, 1, 32, 41, 1, C.glass_purple).box(3, 6, 32, 32, 41, 32, C.glass_purple);
  m.box(1, 6, 3, 1, 41, 30, C.glass_purple).box(34, 6, 3, 34, 41, 30, C.glass_purple);
  for (const y of [16, 31]) {
    m.box(3, y, 32, 32, y, 32, C.steel).box(34, y, 3, 34, y, 30, C.steel);
  }
  m.cyl(17.5, 16.5, 6, 6, 6, C.cerulean);
  m.cyl(17.5, 16.5, 6, 41, 41, C.cerulean);
  m.ring(17.5, 16.5, 7, 6, C.steel);
  // Base console and labels.
  const screens = [
    bezelScreen(m, "+z", 33, 4, 1, 13, 4, "status", { color: "#4B3BFF" }),
    bezelScreen(m, "+x", 35, 6, 1, 13, 4, "wave", { color: "#3fa7ff" }),
  ];
  cornerScrews(m, "+z", 33, 1, 1, 34, 4);
  namePlate(m, "+z", 33, 20, 43, "EMC", C.safety_yellow, C.paint_black);
  harness(
    m,
    [
      [2, 44, 34],
      [2, 0, 34],
    ],
    [C.cable_yellow, C.cable_black],
    "x",
  );
  stickyNote(m, "+z", 33, 26, 1, C.paper_pink, C.safety_red);
  scorch(m, "+y", 5, 10, 10, 2);
  // Pane clamps on every post and emitter-pad bolts.
  for (const [x, z] of [
    [0, 0],
    [33, 0],
    [0, 31],
    [33, 31],
  ] as const)
    for (const y of [10, 24, 37]) m.box(x, y, z, x + 2, y, z + 2, C.chrome);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const x = Math.round(17.5 + Math.cos(a) * 7);
    const z = Math.round(16.5 + Math.sin(a) * 7);
    m.set(x, 5, z, C.chrome).set(x, 42, z, C.chrome);
  }
  // Breach beacon on the lid: a red glass dome over a turning reflector.
  m.box(29, 47, 26, 34, 47, 31, C.steel_dark);
  for (let y = 48; y <= 50; y++)
    for (let z = 27; z <= 30; z++)
      for (let x = 30; x <= 33; x++)
        if (x === 30 || x === 33 || z === 27 || z === 30 || y === 50) m.set(x, y, z, C.glass_red);
  dust(m, 3);
  return detailVisual(
    m,
    [
      mount("matter", orb(6, C.exotic, C.neon_pink, 3), [18, 24, 17], "bob", {
        speed: 0.3,
        amplitude: 2,
      }),
      mount("ring_a", ringModel(10.5, "xy", C.cerulean, C.gamma), [18, 24, 17], "spin", {
        speed: 0.8,
      }),
      mount("ring_b", ringModel(9.5, "yz", C.cerulean, C.gamma), [18, 24, 17], "spin", {
        speed: -0.6,
      }),
      mount("sparks", motes(6, 16, 10, [C.neon_pink, C.gamma], 4), [18, 24, 17], "jitter", {
        speed: 10,
        amplitude: 0.8,
      }),
      mount("emitter_top", ringModel(4, "xz", C.steel, C.cerulean), [18, 40.5, 17], "piston", {
        speed: 0.3,
        amplitude: -2,
      }),
      mount("emitter_low", ringModel(4, "xz", C.steel, C.cerulean), [18, 7.5, 17], "piston", {
        speed: 0.3,
        amplitude: 2,
      }),
      mount("beacon", emcBeacon(), [32, 48, 29], "spin", {
        speed: 4,
        pivot: [1, 0, 1],
      }),
    ],
    [glow([18, 24, 17], "exotic", 20, 10), glow([18, 24, 17], "neon_pink", 5, 6, true, true)],
    screens,
  );
}

/** EMC breach beacon: a chrome reflector block with a red lamp on one face. */
function emcBeacon(): Model {
  const b = new Model(2, 2, 2).box(0, 0, 0, 1, 1, 1, C.chrome);
  return b.box(0, 0, 1, 1, 1, 1, C.led_red).set(0, 1, 0, C.steel_dark);
}

function qsm(): DeviceVisual {
  // Dilution fridge: glass cryostat with a gold chandelier, qubit monitor.
  const m = new Model(36, 44, 28);
  const F = "+z";
  chamferBox(m, 0, 0, 0, 35, 11, 25, C.paint_white, C.steel);
  m.box(1, 0, 1, 34, 0, 24, C.black);
  levelFeet(m, 1, 1, 35, 25);
  grille(m, F, 25, 3, 3, 14, 8, 2, C.steel_dark);
  const screens = [bezelScreen(m, F, 25, 18, 3, 26, 8, "qubits", { color: "#00FFFF" })];
  keypad(m, 29, 3, 3, 3, 26, C.wood, C.screen_cyan);
  // Cryostat.
  m.cyl(12.5, 12.5, 12.2, 12, 12, C.chrome);
  glassTube(m, 12.5, 12.5, 11.4, 13, 39, C.glass, C.chrome);
  m.cyl(12.5, 12.5, 12.2, 40, 42, C.chrome);
  m.ring(12.5, 12.5, 12.2, 41, C.steel);
  m.cyl(12.5, 12.5, 4, 43, 43, C.steel_dark);
  for (let i = 0; i < 16; i++) m.set(1 + ((i * 5) % 23), 13, 12 + ((i * 3) % 12) - 6, C.ice);
  // Monitor on a stand.
  m.box(29, 12, 16, 32, 12, 19, C.steel_dark).box(30, 13, 17, 31, 15, 18, C.steel_dark);
  chamferBox(m, 26, 16, 12, 35, 28, 17, C.paint_black, C.metal_dark);
  screens.push(bezelScreen(m, F, 17, 27, 17, 34, 27, "qubits", { color: "#00FFFF" }));
  harness(
    m,
    [
      [18, 43, 3],
      [33, 43, 3],
      [33, 12, 3],
    ],
    [C.cable_black, C.cable_yellow],
    "z",
  );
  stickyNote(m, F, 17, 31, 29, C.paper_blue);
  // Pulse-tube compressor beside the cryostat, its helium line and bolted flanges.
  chamferBox(m, 27, 12, 3, 33, 15, 9, C.steel, C.steel_dark);
  m.box(29, 16, 5, 31, 16, 7, C.steel_dark);
  cableRun(
    m,
    [
      [27, 14, 6],
      [24, 14, 6],
      [24, 12, 6],
    ],
    C.chrome,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    m.set(
      Math.round(12.5 + Math.cos(a) * 11.6),
      12,
      Math.round(12.5 + Math.sin(a) * 11.6),
      C.brass,
    );
  }
  dust(m, 2);
  harness(
    m,
    [
      [28, 5, 26],
      [28, 0, 26],
      [31, 0, 26],
    ],
    [C.cable_black],
    "z",
  );
  const chand = new Model(19, 24, 19);
  const tiers: [number, number][] = [
    [22, 8.4],
    [16, 6.8],
    [10, 5.2],
    [4, 3.6],
  ];
  for (const [y, r] of tiers) chand.cyl(9, 9, r, y, y + 1, C.gold);
  for (let y = 3; y <= 21; y++)
    if (!tiers.some(([ty]) => ty === y || ty + 1 === y))
      for (const [x, z] of [
        [7, 7],
        [11, 11],
        [7, 11],
        [11, 7],
      ] as const)
        chand.set(x, y, z, C.copper);
  chand.box(9, 0, 9, 9, 3, 9, C.chrome).set(9, 0, 9, C.screen_cyan);
  return detailVisual(
    m,
    [
      mount("chandelier", chand, [13, 27, 13], "spin", { speed: 0.25 }),
      mount("chip", block(2, 1, 2, C.screen_cyan), [13, 14.5, 13], "pulse", {
        speed: 0.4,
        amplitude: 0.6,
      }),
      mount("cold_led", block(1, 1, 1, C.led_green), [16.5, 10.5, 26.5], "blink", {
        speed: 0.7,
        amplitude: 0.5,
      }),
      mount("compressor", pistonModel(5, 3, C.safety_blue), [30.5, 18.5, 6.5], "piston", {
        speed: 1.2,
        amplitude: 1.5,
      }),
      mount(
        "flange_chase",
        ledRing(12.6, 12, [C.led_green, C.screen_cyan, C.led_green]),
        [13, 41.5, 13],
        "spin",
        { speed: 0.9 },
      ),
    ],
    [glow([13, 18, 13], "screen_cyan", 6, 6), glow([31, 22, 19], "screen_cyan", 3, 4)],
    screens,
  );
}

function qan(): DeviceVisual {
  // Tall analyzer: blue header, qubit readout, code screen, valve window.
  const m = new Model(36, 52, 24);
  const F = "+z";
  plinth(m, 0, 0, 35, 21, 4);
  chamferBox(m, 0, 4, 0, 35, 38, 19, C.metal_dark, C.steel);
  m.box(0, 39, 0, 35, 43, 19, C.blue_paint);
  m.box(0, 39, 19, 35, 39, 19, C.steel);
  stencil(m, F, 19, 3, 39, "QAN", C.paint_white);
  m.set(33, 41, 20, C.screen_cyan);
  for (let x = 3; x <= 32; x += 2) if (x < 10 || x > 25) m.box(x, 44, 3, x, 45, 16, C.aluminium);
  // Cryostat on the header: a frosted well, glass case, chrome posts —
  // the gimbal stack tumbles inside around the qubit.
  m.box(13, 41, 5, 22, 43, 14, 0).box(13, 40, 5, 22, 40, 14, C.black);
  m.ring(17.5, 9.5, 3, 40, C.screen_cyan);
  m.box(11, 43, 3, 24, 43, 16, C.steel).box(13, 43, 5, 22, 43, 14, 0);
  m.box(11, 44, 3, 24, 51, 16, C.glass).box(12, 44, 4, 23, 50, 15, 0);
  for (const [x, z] of [
    [11, 3],
    [24, 3],
    [11, 16],
    [24, 16],
  ] as const)
    m.box(x, 43, z, x, 51, z, C.chrome);
  m.box(11, 51, 3, 24, 51, 3, C.steel).box(11, 51, 16, 24, 51, 16, C.steel);
  m.box(11, 51, 3, 11, 51, 16, C.steel).box(24, 51, 3, 24, 51, 16, C.steel);
  for (const x of [13, 22]) m.box(x, 43, 4, x, 43, 4, C.ice).box(x, 43, 15, x, 43, 15, C.ice);
  // Cryo lines from the case down the right flank.
  for (const [z, c] of [
    [6, C.copper],
    [9, C.ice],
  ] as const)
    cableRun(
      m,
      [
        [25, 46, z],
        [35, 46, z],
        [35, 33, z],
      ],
      c,
    );
  const screens = [
    bezelScreen(m, F, 19, 3, 26, 32, 36, "qubits", { color: "#33FF33" }),
    bezelScreen(m, F, 19, 3, 16, 17, 23, "code", { color: "#00FFFF" }),
  ];
  for (const x of [22, 26, 30]) knob(m, F, 19, x, 20, C.paint_black);
  gauge(m, 26.5, 17, 20, 1.6, 0.6);
  keypad(m, 3, 12, 8, 1, 20, C.paint_gray, C.screen_cyan);
  // Vacuum-tube window.
  faceRect(m, F, 19, 20, 6, 33, 12, -1, C.steel);
  faceRect(m, F, 19, 21, 7, 32, 11, -1, 0);
  faceRect(m, F, 19, 21, 7, 32, 11, 0, 0);
  faceRect(m, F, 19, 21, 7, 32, 11, 1, 0);
  faceRect(m, F, 19, 21, 7, 32, 11, 2, C.black);
  faceRect(m, F, 19, 21, 7, 32, 7, 1, C.steel_dark);
  faceRect(m, F, 19, 21, 8, 32, 11, -1, C.glass);
  grille(m, "+x", 35, 3, 6, 16, 30, 2, C.steel_dark);
  harness(
    m,
    [
      [35, 34, 18],
      [35, 0, 18],
    ],
    [C.cable_black],
    "z",
  );
  stickyNote(m, F, 19, 3, 6, C.paper_yellow);
  rustStreak(m, F, 19, 34, 20, 30);
  // Header bolts, tube-socket screws and a calibration seal.
  rivetRow(m, F, 19, 2, 33, 42, 3, C.steel);
  for (const x of [22, 25, 28, 31]) m.set(x, 6, 20, C.chrome);
  m.set(33, 14, 20, C.safety_red);
  dust(m, 3);
  const tube = (): Model => {
    const t = new Model(2, 4, 1);
    return t.box(0, 0, 0, 1, 0, 0, C.black).box(0, 1, 0, 1, 3, 0, C.orange_neon);
  };
  return detailVisual(
    m,
    [
      ...[23, 26, 29].map((x, i) =>
        mount(`tube_${i}`, tube(), [x + 1, 10, 18.5], "pulse", {
          speed: 0.7,
          amplitude: 0.6,
          phase: i * 2,
        }),
      ),
      mount("activity", ledStrip(4, [C.screen_cyan, C.led_green], 2), [26.5, 24.5, 20.5], "blink", {
        speed: 2.4,
        amplitude: 0.5,
      }),
      mount("gimbal_outer", gimbalRing(4, "xy", C.chrome, C.brass), [18, 46.5, 10], "spin", {
        speed: 0.6,
      }),
      mount("gimbal_mid", gimbalRing(2.8, "xz", C.brass, C.chrome), [5.5, 5.5, 0.5], "spin", {
        axis: "x",
        speed: 0.9,
        parent: "gimbal_outer",
      }),
      mount("gimbal_inner", ringModel(1.7, "xy", C.screen_cyan), [4.5, 0.5, 4.5], "spin", {
        speed: -1.4,
        parent: "gimbal_mid",
      }),
      mount("qubit", orb(1, C.white_gold), [3.5, 3.5, 0.5], "pulse", {
        speed: 0.8,
        amplitude: 0.7,
        parent: "gimbal_inner",
      }),
      mount(
        "side_fan",
        yzModel(fanRotor(5, "xy", C.steel_dark, C.chrome)),
        [35.5, 18.5, 10],
        "spin",
        { axis: "x", speed: 7 },
      ),
      mount("valve_needle", needleModel(1, C.led_red, C.paint_black), [27, 17.5, 21.5], "sweep", {
        axis: "z",
        speed: 0.3,
        amplitude: 0.9,
        pivot: [0.5, 0.5, 0.5],
      }),
    ],
    [
      glow([18, 31, 22], "screen_green", 4, 5),
      glow([18, 46.5, 10], "screen_cyan", 5, 5),
      glow([27, 9, 21], "orange_neon", 3, 4),
    ],
    screens,
  );
}

function aic(): DeviceVisual {
  // AI core: black monolith, radiator flanks, face screen inside a spinning halo.
  const m = new Model(36, 52, 28);
  const F = "+z";
  plinth(m, 0, 0, 35, 25, 4);
  chamferBox(m, 4, 4, 2, 31, 47, 23, C.paint_black, C.steel_dark);
  for (const x0 of [0, 32]) {
    m.box(x0, 4, 4, x0 + 3, 37, 21, C.metal_dark);
    for (let y = 5; y <= 36; y += 2) m.box(x0, y, 4, x0 + 3, y, 21, C.steel);
  }
  seam(m, F, 23, 5, 16, 30, 16);
  seam(m, F, 23, 5, 43, 30, 43);
  discXY(m, 17.5, 30, 24, 11.5, C.chrome, true);
  const screens = [bezelScreen(m, F, 23, 10, 22, 25, 37, "face", { color: "#3fa7ff" })];
  namePlate(m, F, 23, 11, 6, "AIC", C.steel, C.paint_black);
  grille(m, F, 23, 7, 14, 28, 14, 1, C.black);
  for (let x = 6; x <= 29; x += 2) if (x < 11 || x > 24) m.box(x, 48, 5, x, 51, 20, C.aluminium);
  // Thought dome: a glass case on the crown over a lattice of neurons.
  m.box(11, 48, 6, 24, 48, 19, C.steel_dark);
  m.box(12, 49, 7, 23, 51, 18, C.glass).box(13, 49, 8, 22, 50, 17, 0);
  for (const [x, z] of [
    [12, 7],
    [23, 7],
    [12, 18],
    [23, 18],
  ] as const)
    m.box(x, 48, z, x, 51, z, C.chrome);
  for (let i = 0; i < 9; i++) {
    const x = 14 + ((i * 5) % 8);
    const z = 9 + ((i * 3) % 8);
    m.box(x, 49, z, 17 + (i % 2), 49, z, i % 3 ? C.steel_dark : C.metal_dark);
    m.set(x, 49, z, i % 3 ? C.cerulean : C.neon_blue);
  }
  // Coolant columns: glass tubes on the radiator fronts (the slugs rise in them).
  for (const x0 of [0, 33]) {
    for (let y = 7; y <= 34; y++) {
      m.box(x0, y, 21, x0 + 2, y, 23, C.glass).set(x0 + 1, y, 22, 0);
    }
    m.box(x0, 6, 21, x0 + 2, 6, 23, C.steel).box(x0, 35, 21, x0 + 2, 35, 23, C.steel);
    m.box(x0, 20, 21, x0 + 2, 20, 23, C.steel).set(x0 + 1, 20, 22, 0);
  }
  harness(
    m,
    [
      [8, 40, 1],
      [8, 0, 1],
    ],
    [C.cable_black, C.cable_yellow, C.safety_blue],
    "x",
  );
  stickyNote(m, F, 23, 27, 5, C.paper_yellow);
  scorch(m, F, 23, 28, 45, 2);
  // Radiator end caps with bolts, rivets along the upper seam.
  for (const x0 of [0, 32])
    for (const y of [4, 37]) {
      m.box(x0, y, 4, x0 + 3, y, 21, C.steel_dark);
      m.set(x0 + 1, y, 21, C.chrome).set(x0 + 2, y, 4, C.chrome);
    }
  rivetRow(m, F, 23, 6, 30, 45, 4, C.steel_dark);
  dust(m, 3);
  return detailVisual(
    m,
    [
      mount("halo", ringModel(12.6, "xy", C.chrome, C.cerulean), [18, 30.5, 25.5], "spin", {
        axis: "z",
        speed: 0.6,
      }),
      mount("leds", ledStrip(11, [C.cerulean, C.neon_blue], 2), [18.5, 14.5, 23.5], "blink", {
        speed: 2.2,
      }),
      mount("leds_b", ledStrip(10, [C.neon_blue, C.cerulean], 2), [18.5, 14.5, 23.5], "blink", {
        speed: 2.2,
        phase: Math.PI,
      }),
      mount("chase", aicChase(), [18, 30.5, 25.5], "spin", { axis: "z", speed: -0.9 }),
      mount(
        "synapses",
        motes(4.5, 1, 12, [C.cerulean, C.white_gold, C.neon_blue], 3),
        [18, 50.5, 13],
        "spin",
        {
          speed: 1.3,
        },
      ),
      mount("thought", ledStrip(3, [C.cerulean], 3), [18, 45.5, 24.5], "slide", {
        speed: 0.4,
        amplitude: 4,
      }),
      mount("coolant_l", block(1, 2, 1, C.cerulean), [1.5, 20, 22.5], "slide", {
        axis: "y",
        speed: 0.3,
        amplitude: 12,
      }),
      mount("coolant_r", block(1, 2, 1, C.cerulean), [34.5, 20, 22.5], "slide", {
        axis: "y",
        speed: 0.3,
        amplitude: 12,
        phase: Math.PI,
      }),
    ],
    [glow([18, 30, 27], "cerulean", 12, 9), glow([18, 14.5, 25], "neon_blue", 3, 4)],
    screens,
  );
}

/** Neural chase: 16 lights on a ring inside the halo (+z facing). */
function aicChase(): Model {
  const k = new Model(25, 25, 1);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    k.set(
      Math.round(12 + Math.cos(a) * 11.4),
      Math.round(12 + Math.sin(a) * 11.4),
      0,
      i % 4 === 0 ? C.white_gold : i % 2 ? C.cerulean : C.neon_blue,
    );
  }
  return k;
}

function sca(): DeviceVisual {
  // Four rack cabinets under a cable tray; the harness drops down the right side.
  const m = new Model(56, 44, 20);
  const F = "+z";
  m.box(0, 0, 0, 53, 1, 17, C.steel_dark);
  const parts: AnimPart[] = [];
  const screens: ScreenSpec[] = [];
  for (let i = 0; i < 4; i++) {
    const x0 = i * 13 + 1;
    chamferBox(m, x0, 2, 0, x0 + 11, 39, 15, C.metal_dark, C.steel);
    grille(m, F, 15, x0 + 2, 4, x0 + 9, 8, 2, C.steel_dark);
    for (let y = 12; y <= 32; y += 4) seam(m, F, 15, x0 + 1, y, x0 + 10, y);
    stencil(m, F, 15, x0 + 3, 34, `N${i + 1}`, C.paint_white);
    if (i !== 2)
      screens.push(
        bezelScreen(m, F, 15, x0 + 2, 25, x0 + 9, 31, i === 3 ? "bars" : "code", {
          color: i === 3 ? "#00FFFF" : "#33FF33",
        }),
      );
    else {
      // N3 is the plotter rack: a glazed door onto the Halo chart, where the
      // pen arm marks the coordinates the cluster computes.
      viewport(m, F, 15, x0 + 2, 24, x0 + 9, 32, 2, C.steel, C.glass, C.paper);
      for (const [u, v, c] of [
        [3, 26, C.paint_navy],
        [5, 29, C.paint_navy],
        [7, 27, C.safety_red],
        [4, 31, C.paint_navy],
        [8, 30, C.paint_navy],
      ] as const)
        faceSet(m, F, 15, x0 + u, v, 2, c);
      faceRect(m, F, 15, x0 + 2, 28, x0 + 9, 28, 2, C.paper_blue);
      stickyNote(m, F, 15, x0 + 4, 9, C.paper_pink);
    }
    // Rack handles and corner screws.
    for (const x of [x0 + 1, x0 + 10]) m.box(x, 10, 16, x, 14, 16, C.chrome);
    cornerScrews(m, F, 15, x0 + 2, 3, x0 + 9, 37, C.steel);
    const grid = new Model(7, 13, 1);
    for (let y = 0; y <= 12; y += 4)
      for (let x = 0; x <= 6; x += 2)
        if ((x + y + i) % 3 !== 0) grid.set(x, y, 0, (y + i) % 8 ? C.screen_cyan : C.led_green);
    parts.push(
      mount(`nodes_${i}`, grid, [x0 + 6, 17.5, 16.5], "blink", {
        speed: 1.3 + i * 0.4,
        amplitude: 0.7,
        phase: i,
      }),
    );
  }
  // Cable tray and harness.
  m.box(0, 40, 2, 53, 41, 13, C.steel_dark);
  m.box(1, 42, 3, 53, 42, 4, C.cable_yellow).box(1, 42, 6, 53, 42, 7, C.cable_black);
  m.box(1, 42, 9, 53, 42, 10, C.safety_blue);
  harness(
    m,
    [
      [53, 42, 3],
      [55, 42, 3],
      [55, 0, 3],
    ],
    [C.cable_yellow, C.cable_black, C.cable_black, C.safety_blue],
    "z",
  );
  // Vertical cable managers in the gaps between the racks: black ducts with
  // steel fingers, the odd patch lead looping out of them.
  for (const x of [13, 26, 39]) {
    m.box(x, 2, 11, x, 39, 15, C.paint_black);
    for (let y = 4; y <= 37; y += 3) m.set(x, y, 16, C.steel);
  }
  for (const [x, y, c] of [
    [13, 20, C.cable_yellow],
    [26, 14, C.safety_blue],
    [39, 29, C.cable_red],
  ] as const)
    m.box(x, y, 16, x, y + 2, 17, c);
  rustStreak(m, F, 15, 13, 3, 10);
  coffeeRing(m, 20.5, 39, 7.5, 1.4);
  dust(m, 2);
  parts.push(
    mount("fan", fanRotor(4, "xz", C.steel_dark, C.chrome), [33, 43.5, 8], "spin", { speed: 8 }),
    mount("packet", block(2, 1, 1, C.screen_cyan), [20, 43.5, 5.5], "slide", {
      speed: 0.35,
      amplitude: 18,
    }),
    mount("plotter", needleModel(6, C.steel, C.paint_black), [33.5, 24.5, 14.5], "sweep", {
      axis: "z",
      speed: 0.18,
      amplitude: 0.55,
      pivot: [0.5, 0.5, 0.5],
    }),
    mount("pen", block(1, 1, 1, C.led_red), [0.5, 7.5, 0.5], "blink", {
      speed: 1.1,
      amplitude: 0.5,
      parent: "plotter",
    }),
  );
  return detailVisual(
    m,
    parts,
    [glow([14, 22, 20], "screen_cyan", 5, 7), glow([42, 22, 20], "led_green", 5, 7)],
    screens,
  );
}

function tlp(): DeviceVisual {
  // Teleport pad: glowing disc, four pylons with emitters, crown ring.
  const m = new Model(48, 50, 48);
  const c = 23.5;
  m.cyl(c, c, 23.4, 0, 3, C.metal_dark);
  m.ring(c, c, 23, 3, C.steel);
  hazardRing(m, c, c, 20, 4);
  m.cyl(c, c, 18.6, 4, 4, C.steel_dark);
  hazardRing(m, c, c, 20, 4);
  m.cyl(c, c, 17, 5, 5, C.steel);
  m.cyl(c, c, 14, 6, 6, C.cerulean);
  m.ring(c, c, 10, 6, C.gamma);
  m.ring(c, c, 6, 6, C.steel);
  m.cyl(c, c, 3, 6, 6, C.white_gold);
  for (const [x, z] of [
    [8, 8],
    [38, 8],
    [8, 38],
    [38, 38],
  ] as const) {
    m.box(x - 2, 4, z - 2, x + 3, 7, z + 3, C.steel_dark);
    m.box(x, 8, z, x + 1, 35, z + 1, C.steel);
    const dx = Math.sign(c - x);
    const dz = Math.sign(c - z);
    for (const y of [18, 28]) m.box(x + dx, y, z + dz, x + 1 + dx, y + 1, z + 1 + dz, C.cerulean);
    m.box(x, 36, z, x + 1, 37, z + 1, C.white_gold);
    // Pylon foot bolts and insulator bands.
    for (const [bx, bz] of [
      [x - 2, z - 2],
      [x + 3, z - 2],
      [x - 2, z + 3],
      [x + 3, z + 3],
    ] as const)
      m.set(bx, 8, bz, C.chrome);
    for (const y of [12, 23, 32]) m.box(x, y, z, x + 1, y, z + 1, C.paint_white);
  }
  m.ring(c, c, 21.6, 38, C.steel, 2);
  // Overhead emitter: a halo hung from the pylon tops by four struts, and
  // a stepped cone with a glass lens pointing down at the pad.
  for (const [x, z] of [
    [8, 8],
    [39, 8],
    [8, 39],
    [39, 39],
  ] as const)
    for (let i = 0; i <= 10; i++) {
      const f = i / 10;
      const ax = Math.round(x + (c - x) * f * 0.62);
      const az = Math.round(z + (c - z) * f * 0.62);
      m.set(ax, 40 + Math.round(f * 5), az, i === 10 ? C.chrome : C.steel);
    }
  m.ring(c, c, 10, 45, C.steel, 2);
  m.ring(c, c, 10, 44, C.cerulean);
  for (let y = 41; y <= 49; y++)
    m.cyl(c, c, 1.2 + (y - 41) * 0.45, y, y, y % 3 ? C.steel : C.chrome);
  m.cyl(c, c, 1.6, 41, 41, C.glass).cyl(c, c, 0.8, 42, 42, C.gamma);
  // Floor feeds from the front pylons into the console.
  for (const [x0, x1] of [
    [11, 17],
    [36, 30],
  ] as const) {
    cableRun(
      m,
      [
        [x0, 4, 40],
        [x1, 4, 40],
        [x1, 4, 43],
      ],
      C.cable_black,
    );
    cableRun(
      m,
      [
        [x0, 4, 39],
        [x1 + Math.sign(x1 - x0), 4, 39],
        [x1 + Math.sign(x1 - x0), 4, 42],
      ],
      C.safety_blue,
    );
  }
  chamferBox(m, 18, 4, 41, 29, 9, 45, C.metal, C.steel_dark);
  const screens = [bezelScreen(m, "+z", 45, 20, 5, 27, 8, "radar", { color: "#3fa7ff" })];
  stickyNote(m, "+y", 9, 26, 42, C.paper_yellow, C.safety_red);
  scorch(m, "+y", 5, 30, 12, 2.5);
  dust(m, 3);
  return detailVisual(
    m,
    [
      mount("ring_a", ringModel(16, "xz", C.chrome, C.cerulean), [24, 17, 24], "spin", {
        speed: 1.2,
      }),
      mount("ring_b", ringModel(14, "xz", C.chrome, C.white_gold), [24, 27, 24], "spin", {
        speed: -1.6,
      }),
      mount("motes", motes(8, 24, 20, [C.gamma, C.cerulean], 1), [24, 20, 24], "spin", {
        speed: 0.9,
      }),
      mount("motes_b", motes(6, 20, 14, [C.white_gold, C.cerulean], 5), [24, 20, 24], "bob", {
        speed: 0.5,
        amplitude: 3,
      }),
      mount("glyph", ringModel(12, "xz", C.gamma, C.white_gold), [24, 7.5, 24], "step", {
        speed: 0.5,
        amplitude: TAU / 16,
      }),
      // Pad sequence: outer → middle → inner ring light up in turn.
      ...(
        [
          [15.5, C.cerulean, 0],
          [9, C.gamma, (2 * TAU) / 3],
          [4.5, C.white_gold, TAU / 3],
        ] as const
      ).map(([r, col, ph], i) =>
        mount(`seq_${i}`, ringModel(r, "xz", col), [24, 7.5, 24], "blink", {
          speed: 0.7,
          amplitude: 0.3,
          phase: ph,
        }),
      ),
      mount("charge", tlpCharge(), [24, 10, 24], "piston", {
        speed: 0.35,
        amplitude: 22,
        pivot: [17, 0, 17],
      }),
      mount("lens", ringModel(2.6, "xz", C.chrome, C.cerulean), [24, 40.5, 24], "spin", {
        speed: 2.5,
      }),
    ],
    [glow([24, 12, 24], "cerulean", 20, 12), glow([24, 40, 24], "white_gold", 5, 6)],
    screens,
  );
}

/** Charge carriers on the four pylons' outer corners (they climb together). */
function tlpCharge(): Model {
  const k = new Model(34, 2, 34);
  for (const [x, z] of [
    [0, 0],
    [33, 0],
    [0, 33],
    [33, 33],
  ] as const)
    k.box(x, 0, z, x, 1, z, C.white_gold);
  return k;
}

// ── Rear & side dressing ─────────────────────────────────────────
//
// The camera turns in 90° steps, so every device is seen from behind and
// from both sides. Each device gets a pass that dresses those faces with
// service hatches, rear vents and fans, sockets with cables to the floor,
// serial plates, warning stickers and the odd human touch. Runs after the
// front build (it never touches the front face, screens or part mounts);
// a final light `dust` pass grimes the new cables and feet. Wall-mounted
// devices keep their back plate flat at z = 0 and only get side detail.
// Only EMISSIVE_OFF colours (led_red / led_green / led_amber) glow here.

function mcpRear(m: Model): void {
  const B = "-z";
  fanPort(m, B, 1, 10, 28, 5);
  fanPort(m, B, 1, 25, 28, 5);
  serviceHatch(m, B, 1, 4, 4, 12, 19, { panel: C.steel_dark });
  warnSticker(m, B, 1, 5, 9, true);
  powerInlet(m, B, 1, 14, 3, { cable: C.cable_black, rocker: true, run: 2 });
  tapedNote(m, B, 1, 22, 3, "!");
  serialPlate(m, B, 1, 30, 15, ["0001"]);
  serviceHatch(m, "-x", 2, 4, 4, 13, 14, { panel: C.steel_dark, tag: true });
  warnSticker(m, "+x", 33, 5, 8);
  mug(m, 28, 37, 13);
}

function clkRear(m: Model): void {
  // Conduit down the wall into a junction box beside the back plate.
  m.box(20, 2, 0, 21, 6, 2, C.paint_gray).set(21, 5, 2, C.chrome).set(21, 3, 2, C.chrome);
  m.box(21, 7, 0, 21, 16, 0, C.paint_gray).box(21, 0, 0, 21, 1, 0, C.paint_gray);
  m.box(0, 20, 0, 0, 23, 1, C.paint_black).set(0, 22, 1, C.led_green);
}

function vntRear(m: Model): void {
  const B = "-z";
  grille(m, B, 1, 5, 17, 20, 26, 2, C.steel_dark, C.steel);
  serialPlate(m, B, 1, 20, 9, ["0112"], { bg: C.paint_cream });
  powerInlet(m, B, 1, 5, 3, { cable: C.cable_black, rocker: true, run: -3 });
  warnSticker(m, B, 1, 13, 3);
  rustStreak(m, B, 1, 19, 4, 16);
  serviceHatch(m, "-x", 1, 5, 19, 17, 27, { tag: true });
}

function btkRear(m: Model): void {
  // Power strip on the cabinet side, a roll of tape on the cabinet top.
  plate(m, "-x", 0, 1, 1, 7, 4, C.paint_white);
  for (const u of [2, 4, 6]) stud(m, "-x", 0, u, 3, C.black, 0);
  stud(m, "-x", 0, 2, 2, C.led_red, 0);
  m.cyl(23.5, 6.5, 1.6, 7, 8, C.paint_gray, true);
  warnSticker(m, "+x", 27, 1, 0);
}

function batRear(m: Model): void {
  const B = "-z";
  // Tray back (flush with the grid edge): vent, carved socket, stencil.
  grille(m, B, 0, 4, 3, 13, 6, 1, C.steel);
  powerInlet(m, B, 0, 17, 3);
  stencil(m, B, 0, 29, 3, "48V", C.safety_yellow);
  // Cell backs: labels, charge leads down to the tray, one cell swelling.
  for (let i = 0; i < 3; i++) {
    const x0 = 1 + i * 10;
    serialPlate(m, B, 3, x0 + 6, 14, [`${i + 1}`], { bg: C.paper });
    faceHarness(
      m,
      B,
      3,
      [
        [x0 + 2, 12, -1],
        [x0 + 2, 8, -1],
        [x0 + 2, 8, -3],
      ],
      [C.cable_red, C.cable_black],
    );
  }
  warnSticker(m, B, 3, 11, 9, true);
  rustStreak(m, B, 3, 25, 9, 13);
}

function pwbRear(m: Model): void {
  const B = "-z";
  // Back of the pegboard: holes go through, battens, a stencil.
  for (let x = 2; x <= 30; x += 3) for (let y = 16; y <= 26; y += 3) m.set(x, y, 0, C.black);
  for (const y of [14, 27]) faceRect(m, B, 0, 0, y, 31, y, 0, C.wood);
  for (const x of [0, 15, 31]) faceRect(m, B, 0, x, 14, x, 27, 0, C.wood);
  stencil(m, B, 0, 13, 20, "UNL", C.paint_cream);
  // Monitor lead through a hole, down behind the bench to a power strip.
  m.box(17, 0, 0, 17, 11, 0, C.cable_black);
  m.box(8, 0, 0, 20, 0, 1, C.paint_white);
  for (const x of [10, 13, 16]) m.set(x, 0, 1, C.black);
  m.set(19, 0, 1, C.led_red);
  m.box(8, 0, 2, 8, 0, 5, C.cable_black).box(8, 0, 5, 3, 0, 5, C.cable_black);
  // Lower shelf rear lip and a clamp lamp's spare bulb box.
  m.box(0, 4, 1, 31, 4, 1, C.steel_dark);
  m.box(25, 4, 2, 28, 6, 4, C.cardboard).set(26, 6, 2, C.paper);
}

function cdcRear(m: Model): void {
  const B = "-z";
  // Rear door (flush): hinges, louvres, serial plate.
  serviceHatch(m, B, 0, 2, 3, 21, 25, { handle: false });
  for (const y of [6, 20]) faceRect(m, B, 0, 2, y, 2, y + 2, 0, C.steel_dark);
  grille(m, B, 0, 5, 18, 18, 23, 1, C.steel_dark);
  serialPlate(m, B, 0, 19, 10, ["0213"], { d: 0, bg: C.paint_cream });
  warnSticker(m, B, 0, 12, 4);
  faceRect(m, B, 0, 19, 5, 20, 8, 0, C.steel_dark);
  serviceHatch(m, "-x", 0, 3, 5, 12, 20, { tag: true });
}

function memRear(m: Model): void {
  const B = "-z";
  fanPort(m, B, 1, 9.5, 21, 4.5);
  serialPlate(m, B, 1, 14, 11, [], { barcode: true, w: 11, bg: C.paint_cream });
  portBank(m, B, 1, 4, 5, [C.safety_blue, 0, C.cable_yellow, C.safety_blue]);
  serviceHatch(m, "-x", 1, 3, 4, 12, 16, { panel: C.green_paint });
  tapedNote(m, "-x", 1, 4, 19);
}

function cpuRear(m: Model): void {
  const B = "-z";
  fanPort(m, B, 1, 9.5, 19, 4.5);
  portBank(m, B, 1, 4, 10, [C.cable_black, C.safety_blue, 0]);
  powerInlet(m, B, 1, 10, 3, { cable: C.cable_black, run: 3 });
  serviceHatch(m, "-x", 1, 3, 4, 13, 20, { tag: true });
  warnSticker(m, "-x", 1, 5, 9);
}

function netRear(m: Model): void {
  const B = "-z";
  // Redundant power supplies, rear fans, uplink ports.
  for (const u of [2, 13]) {
    serviceHatch(m, B, 1, u, 3, u + 10, 10, { handle: false, panel: C.steel_dark });
    powerInlet(m, B, 1, u + 2, 4, { cable: C.cable_black, run: u === 2 ? -1 : 2 });
    stud(m, B, 1, u + 8, 8, C.led_green);
  }
  fanPort(m, B, 1, 7, 15.5, 3.5);
  fanPort(m, B, 1, 18, 15.5, 3.5);
  serialPlate(m, "-x", 0, 3, 13, [], { barcode: true, w: 11, bg: C.paint_cream, d: 0 });
  warnSticker(m, "-x", 0, 5, 4);
  portBank(m, "+x", 25, 12, 4, [C.paint_lime, C.cable_yellow]);
}

function tmpRear(m: Model): void {
  // Box sides: louvres, a cable gland with its lead to the conduit.
  grille(m, "-x", 0, 1, 20, 2, 27, 1, C.paint_brick);
  grille(m, "+x", 19, 1, 20, 2, 27, 1, C.paint_brick);
  for (const f of ["-x", "+x"] as const) {
    const at = f === "-x" ? 0 : 19;
    stud(m, f, at, 1, 13, C.chrome, 0);
    stud(m, f, at, 1, 30, C.chrome, 0);
  }
  m.box(12, 0, 0, 12, 9, 0, C.cable_black).set(12, 9, 1, C.steel_dark);
}

function thmRear(m: Model): void {
  const B = "-z";
  // Radiator block, coolant returns, power feed.
  coolingFins(m, B, 1, 5, 13, 24, 24, 2, C.aluminium);
  for (let u = 5; u <= 24; u += 2) if (hash3(u, 24, 1) < 0.6) stud(m, B, 1, u, 24, C.ice);
  pipeDrop(m, B, 1, 7, 9, C.safety_blue);
  pipeDrop(m, B, 1, 22, 9, C.safety_blue);
  powerInlet(m, B, 1, 12, 3, { cable: C.cable_black, rocker: true, run: 2 });
  serialPlate(m, B, 1, 18, 5, [], { barcode: true, w: 7, bg: C.paint_cream });
  serviceHatch(m, "-x", 2, 3, 4, 16, 17, { tag: true });
  warnSticker(m, "-x", 2, 18, 8);
}

function pwrRear(m: Model): void {
  const B = "-z";
  // Transformer fins, serial plate, the HV feed coming up out of the floor.
  coolingFins(m, B, 1, 4, 27, 19, 33, 2, C.steel);
  serialPlate(m, B, 1, 20, 19, ["0230"], { bg: C.paint_cream });
  warnSticker(m, B, 1, 4, 11, true);
  plate(m, B, 1, 12, 13, 18, 15, C.steel_dark);
  faceHarness(
    m,
    B,
    1,
    [
      [13, 13, -1],
      [13, 0, -1],
    ],
    [C.cable_black, C.cable_red, C.cable_yellow],
  );
  stencil(m, B, 1, 9, 5, "HV", C.safety_yellow);
  serviceHatch(m, "-x", 1, 3, 8, 11, 30, { tag: true });
  warnSticker(m, "-x", 1, 4, 12, true);
}

function pwdRear(m: Model): void {
  // Side screws and vent slots, a lead down the wall to a floor socket.
  for (const [f, at] of [
    ["-x", 0],
    ["+x", 31],
  ] as const) {
    grille(m, f, at, 1, 14, 1, 21, 1, C.metal_dark);
    stud(m, f, at, 1, 10, C.chrome, 0);
    stud(m, f, at, 1, 24, C.chrome, 0);
  }
  m.box(27, 1, 0, 27, 7, 0, C.cable_black);
  m.box(25, 0, 0, 29, 2, 1, C.paint_white).set(26, 1, 2, C.black).set(28, 1, 2, C.black);
  m.set(27, 1, 2, C.cable_black);
}

function vltRear(m: Model): void {
  // Fuse holder on one side, calibration seal and screws on the other.
  plate(m, "-x", 0, 0, 18, 1, 21, C.paint_black, 0);
  stud(m, "-x", 0, 1, 20, C.safety_red, 0);
  stud(m, "+x", 19, 1, 22, C.safety_blue, 0);
  stud(m, "+x", 19, 1, 12, C.chrome, 0);
  stud(m, "-x", 0, 1, 12, C.chrome, 0);
  grille(m, "+x", 19, 1, 14, 1, 19, 1, C.steel_dark);
}

function mscRear(m: Model): void {
  const B = "-z";
  powerInlet(m, B, 2, 5, 4, { cable: C.cable_black, run: -2 });
  portBank(m, B, 2, 12, 5, [C.cable_yellow, C.safety_blue, 0]);
  stud(m, B, 2, 22, 8, C.led_amber);
  // Scan-head exhaust and the column's cable clips.
  grille(m, B, 7, 10, 25, 15, 27, 1, C.steel_dark);
  for (const y of [14, 20, 26]) stud(m, B, 3, 22, y, C.steel_dark);
  serviceHatch(m, "-x", 2, 4, 4, 11, 9, { handle: false, panel: C.paint_teal });
  serialPlate(m, "-x", 2, 13, 4, [], { barcode: true, w: 7, bg: C.paint_cream });
}

function rmgRear(m: Model): void {
  const B = "-z";
  // Coil junction box on the base with the coil leads and a mains feed.
  chamferBox(m, 11, 2, 1, 18, 9, 5, C.safety_yellow, C.yellow_paint);
  warnSticker(m, B, 1, 11, 3);
  stud(m, B, 1, 17, 7, C.led_amber);
  faceHarness(
    m,
    B,
    1,
    [
      [13, 5, -1],
      [13, 0, -1],
    ],
    [C.cable_black, C.cable_red],
  );
  for (const [x, c] of [
    [13, C.cable_red],
    [16, C.cable_black],
  ] as const)
    cableRun(
      m,
      [
        [x, 18, 9],
        [x, 18, 3],
        [x, 10, 3],
      ],
      c,
    );
  serialPlate(m, "+y", 9, 12, 4, [], { barcode: true, w: 6, bg: C.paper, d: 0 });
}

function atkRear(m: Model): void {
  const B = "-z";
  // Overflow line from cap to base, a drain valve box, level sensor lead.
  m.box(12, 5, 2, 13, 32, 3, C.copper);
  for (const y of [5, 18, 32]) m.box(11, y, 2, 14, y, 3, C.brass);
  m.box(11, 12, 1, 14, 12, 1, C.safety_red);
  chamferBox(m, 16, 1, 1, 21, 6, 4, C.metal, C.steel_dark);
  warnSticker(m, B, 1, 16, 1);
  stud(m, B, 1, 20, 5, C.led_green);
  cableRun(
    m,
    [
      [21, 4, 2],
      [23, 4, 2],
      [23, 0, 2],
    ],
    C.cable_black,
  );
  serialPlate(m, B, 2, 9, 14, [], { barcode: true, w: 6, bg: C.paper });
}

function uecRear(m: Model): void {
  const B = "-z";
  // Feed cabinet between the rear pylons, heavy leads over the rim.
  chamferBox(m, 11, 4, 1, 24, 13, 5, C.metal, C.steel_dark);
  grille(m, B, 1, 13, 9, 22, 11, 1, C.steel_dark);
  warnSticker(m, B, 1, 13, 5, true);
  serialPlate(m, B, 1, 22, 5, [], { barcode: true, w: 6, bg: C.paint_cream });
  faceHarness(
    m,
    B,
    1,
    [
      [17, 8, -1],
      [17, 4, -1],
      [17, 4, -2],
    ],
    [C.cable_black, C.cable_red, C.cable_black],
  );
  scorch(m, B, 1, 23, 12, 1.5);
}

function dgnRear(m: Model): void {
  const B = "-z";
  // Monitor backs: vents, a VESA plate, leads routed along to the loom.
  for (let i = 0; i < 3; i++) {
    const x0 = 1 + i * 13;
    grille(m, B, 3, x0 + 2, 24, x0 + 9, 27, 1, C.steel_dark);
    plate(m, B, 3, x0 + 4, 19, x0 + 7, 21, C.steel_dark);
    cableRun(
      m,
      [
        [x0 + 3, 18, 2],
        [x0 + 3, 16, 2],
        [18, 16, 2],
      ],
      i === 1 ? C.cable_red : C.cable_black,
    );
  }
  // Modesty panel: two hatches, a power strip, a serial plate.
  serviceHatch(m, B, 5, 2, 2, 18, 10, { handle: false });
  serviceHatch(m, B, 5, 23, 2, 37, 10, { handle: false });
  serialPlate(m, B, 5, 17, 3, ["0907"], { bg: C.paint_cream });
  powerInlet(m, B, 5, 26, 3, { cable: C.cable_black, rocker: true, run: 3 });
  warnSticker(m, B, 5, 31, 3, true);
  serviceHatch(m, "-x", 0, 7, 2, 19, 10, { tag: true });
  warnSticker(m, "+x", 39, 10, 4);
}

function ecrRear(m: Model): void {
  const B = "-z";
  // Deck back: wooden louvres, RCA jacks, mains lead, inventory tag.
  grille(m, B, 6, 9, 11, 20, 16, 2, C.wood_dark);
  for (const [u, c] of [
    [8, C.safety_red],
    [10, C.paint_white],
  ] as const) {
    stud(m, B, 6, u, 6, c);
    cableRun(
      m,
      [
        [u, 5, 5],
        [u, 2, 5],
        [u, 2, 3],
      ],
      c === C.safety_red ? C.cable_red : C.cable_black,
    );
  }
  powerInlet(m, B, 6, 12, 4, { cable: C.cable_black, run: 2 });
  serialPlate(m, B, 6, 22, 4, [], { barcode: true, w: 5, bg: C.paper });
  // A spare cassette on the base behind the deck.
  m.box(18, 2, 2, 23, 3, 5, C.paint_black).box(19, 3, 3, 22, 3, 4, C.paper);
}

function spkRear(m: Model): void {
  const B = "-z";
  // Bass port, amp fins, binding posts, inventory sticker.
  for (let d = 0; d < 3; d++) {
    for (let v = 21; v <= 25; v++)
      for (let u = 8; u <= 12; u++)
        if (Math.hypot(u - 10, v - 23) <= 2.3) faceSet(m, B, 4, u, v, d, d === 2 ? C.black : 0);
  }
  coolingFins(m, B, 4, 6, 27, 15, 30, 2, C.steel_dark);
  plate(m, B, 4, 12, 17, 15, 19, C.paint_black);
  stud(m, B, 4, 13, 18, C.safety_red, -2);
  stud(m, B, 4, 15, 18, C.paint_black, -2);
  serialPlate(m, B, 4, 9, 17, [], { barcode: true, w: 5, bg: C.paper });
  for (let d = 0; d < 2; d++) faceRect(m, "-x", 4, 7, 27, 12, 28, d, 0);
  faceRect(m, "-x", 4, 7, 27, 12, 28, 2, C.black);
}

function hmsRear(m: Model): void {
  const B = "-z";
  // Synth back: jack row with two patch leads, mains, vents, a handmade label.
  plate(m, B, 4, 3, 17, 17, 19, C.paint_black);
  for (let u = 4; u <= 16; u += 3) stud(m, B, 4, u, 18, C.brass);
  for (const [u, c] of [
    [7, C.cable_red],
    [13, C.safety_blue],
  ] as const) {
    stud(m, B, 4, u, 18, c, -2);
    faceCable(
      m,
      B,
      4,
      [
        [u, 17, -2],
        [u, 0, -2],
        [u + 2, 0, -2],
      ],
      c,
    );
  }
  powerInlet(m, B, 4, 30, 16, { cable: C.cable_black, run: -3 });
  grille(m, B, 4, 4, 22, 20, 26, 1, C.metal_dark);
  tapedNote(m, B, 4, 26, 21);
  plate(m, "-x", 0, 9, 13, 15, 15, C.brass, 0);
  for (let d = 0; d < 2; d++) faceRect(m, "+x", 39, 9, 13, 15, 13, d, 0);
}

function oscRear(m: Model): void {
  const B = "-z";
  // CRT necks with vents and HV stickers; mains cords to a floor strip.
  for (let i = 0; i < 3; i++) {
    const x0 = i * 12;
    grille(m, B, 1, x0 + 4, 18, x0 + 7, 22, 1, C.paint_cream);
    stud(m, B, 1, x0 + 5, 16, C.paint_black);
    cableRun(
      m,
      [
        [x0 + 5, 16, 0],
        [x0 + 5, 0, 0],
      ],
      C.cable_black,
    );
    stud(m, B, 4, x0 + 10, 25, C.safety_yellow);
  }
  m.box(4, 0, 0, 30, 0, 0, C.cable_black);
  m.box(31, 0, 0, 34, 1, 1, C.paint_white).set(33, 1, 0, C.led_red);
  // Signal generator back: mains inlet, BNC outputs.
  powerInlet(m, B, 5, 5, 4, { cable: C.cable_black, run: 0 });
  for (const u of [11, 13]) stud(m, B, 5, u, 6, C.brass);
  serialPlate(m, B, 4, 21, 13, [], { barcode: true, w: 7, bg: C.paper });
  serviceHatch(m, "-x", 0, 6, 13, 15, 25, { handle: false, panel: C.paint_cream });
  tapedNote(m, "-x", 0, 7, 15);
}

function intRear(m: Model): void {
  const B = "-z";
  // Source housing: fan, mains, laser warning. Receiver board bracing.
  fanPort(m, B, 6, 6, 15, 1.6);
  powerInlet(m, B, 6, 1, 10, { cable: C.cable_black, run: 0 });
  warnSticker(m, "-x", 1, 7, 11);
  faceRect(m, "+x", 38, 4, 10, 17, 10, -1, C.wood);
  faceRect(m, "+x", 38, 4, 21, 17, 21, -1, C.wood);
  faceRect(m, "+x", 38, 10, 11, 11, 20, -1, C.wood);
  serialPlate(m, B, 16, 30, 10, [], { barcode: true, w: 9, bg: C.paint_cream });
  ledRow(m, B, 16, 14, 13, 3, 2, [C.led_green, C.led_green, C.led_amber]);
  // Cable tray under the bench's back edge, a lead to the floor.
  m.box(6, 6, 2, 33, 7, 3, C.steel_dark);
  m.box(7, 7, 2, 32, 7, 2, C.cable_black).box(12, 7, 3, 28, 7, 3, C.cable_red);
  m.box(20, 0, 2, 20, 5, 2, C.cable_black).box(18, 0, 1, 23, 1, 2, C.paint_white);
}

function andRear(m: Model): void {
  const B = "-z";
  fanPort(m, B, 9, 14, 8, 3);
  powerInlet(m, B, 9, 18, 3, { cable: C.cable_black, run: 0 });
  stud(m, B, 9, 20, 10, C.led_amber);
  serialPlate(m, B, 9, 22, 7, [], { barcode: true, w: 5, bg: C.paper_blue });
  warnSticker(m, "-x", 9, 13, 5);
  serviceHatch(m, "-x", 9, 11, 3, 22, 11, { handle: false, panel: C.purple_paint });
}

function qcpRear(m: Model): void {
  // Maker's plaque on the drum, a winding crank on the side.
  m.box(7, 3, 3, 17, 9, 5, C.bronze);
  serialPlate(m, "-z", 3, 17, 3, ["QCP"], { bg: C.brass, ink: C.walnut, d: 0 });
  m.box(1, 6, 12, 2, 6, 13, C.brass).box(1, 6, 11, 1, 9, 11, C.brass).set(1, 9, 10, C.walnut);
  // A curio drawer in the base, a latch and an inventory tag on a string.
  m.box(8, 0, 1, 17, 2, 2, C.wood_dark).box(12, 1, 0, 13, 1, 0, C.brass);
  m.box(2, 4, 16, 3, 5, 18, C.gold);
  m.box(23, 3, 11, 23, 6, 13, C.paper).set(23, 7, 12, C.cable_red).set(22, 7, 12, C.cable_red);
  m.box(23, 5, 12, 23, 5, 12, C.paint_navy).set(23, 7, 13, C.cable_red);
  m.box(22, 4, 16, 22, 5, 18, C.gold);
  for (const x of [6, 19]) m.box(x, 4, 4, x, 6, 5, C.gold);
}

function dimRear(m: Model): void {
  const B = "-z";
  // Exotic-matter feed box on the base with its line into the column.
  chamferBox(m, 12, 4, 2, 21, 11, 6, C.metal, C.steel_dark);
  grille(m, B, 2, 14, 8, 19, 10, 1, C.steel_dark);
  warnSticker(m, B, 2, 13, 4, true);
  stud(m, B, 2, 20, 5, C.led_green);
  m.box(16, 12, 4, 17, 13, 10, C.copper);
  m.box(15, 12, 10, 18, 13, 10, C.brass);
  faceHarness(
    m,
    B,
    2,
    [
      [16, 6, -1],
      [16, 3, -1],
    ],
    [C.cable_black, C.safety_blue],
  );
}

function exdRear(m: Model): void {
  // Traffic cone, a toolbox and a coiled charge lead on the pad; edge markings.
  m.box(2, 3, 2, 6, 3, 6, C.rubber);
  m.box(3, 4, 3, 5, 4, 5, C.safety_orange).box(3, 5, 3, 5, 5, 5, C.paint_white);
  m.box(4, 6, 4, 4, 7, 4, C.safety_orange);
  m.box(15, 3, 2, 20, 5, 4, C.safety_red).box(16, 6, 3, 19, 6, 3, C.paint_black);
  m.ring(30, 5, 2.5, 3, C.cable_black);
  m.set(30, 3, 5, C.chrome);
  for (let x = 2; x <= 33; x += 4) m.box(x, 0, 0, x + 1, 1, 0, C.safety_yellow);
  for (let z = 2; z <= 33; z += 4) {
    m.box(0, 0, z, 0, 1, z + 1, C.safety_yellow);
    m.box(35, 0, z, 35, 1, z + 1, C.safety_yellow);
  }
}

function nxsRear(m: Model): void {
  const B = "-z";
  // Base edge trim like the front; a salvaged power-distribution box behind the core.
  m.box(1, 0, 0, 42, 3, 0, C.wall_trim);
  for (let x = 3; x <= 40; x += 6) m.set(x, 2, 0, C.hazard_black);
  chamferBox(m, 15, 4, 1, 28, 15, 5, C.metal_dark, C.steel_dark);
  fanPort(m, B, 1, 19, 10.5, 2.5);
  powerInlet(m, B, 1, 23, 5, { cable: C.cable_black, run: 0 });
  portBank(m, B, 1, 23, 11, [C.safety_blue, C.paint_lime]);
  warnSticker(m, B, 1, 16, 5, true);
  for (const [x, c] of [
    [17, C.cable_black],
    [26, C.cable_red],
  ] as const)
    cableRun(
      m,
      [
        [x, 4, 6],
        [x, 4, 8],
      ],
      c,
    );
}

function lctRear(m: Model): void {
  const B = "-z";
  // Fume exhaust, mains, serial plate; coolant lines from the head.
  fanPort(m, B, 2, 7, 4.5, 3);
  powerInlet(m, B, 2, 13, 1, { cable: C.cable_black, rocker: true, run: 3 });
  serialPlate(m, B, 2, 36, 1, ["0640"], { bg: C.paint_cream });
  warnSticker(m, B, 4, 4, 12);
  for (const [x, c] of [
    [11, C.safety_blue],
    [12, C.cable_red],
  ] as const)
    cableRun(
      m,
      [
        [x, 15, 3],
        [x, 10, 3],
        [x, 10, 1],
        [x, 0, 1],
      ],
      c,
    );
  portBank(m, "-x", 0, 5, 3, [0, 0, 0]);
  warnSticker(m, "-x", 0, 1, 1);
}

function p3dRear(m: Model): void {
  const B = "-z";
  // Back wall (flush): filter vent, spool axle, PSU fan, inlet, plates.
  grille(m, B, 0, 6, 10, 16, 20, 1, C.steel_dark, C.paint_white);
  stud(m, B, 0, 24, 26, C.chrome, 0);
  for (const [u, v] of [
    [22, 24],
    [26, 24],
    [22, 28],
    [26, 28],
  ] as const)
    stud(m, B, 0, u, v, C.steel_dark, 0);
  serialPlate(m, B, 0, 30, 31, ["0317"], { d: 0, bg: C.paint_cream });
  warnSticker(m, B, 0, 4, 31);
  fanPort(m, B, 0, 8, 2.5, 2);
  powerInlet(m, B, 0, 14, 1);
  serviceHatch(m, "-x", 0, 4, 8, 27, 36, { tag: true, panel: C.paint_white });
  warnSticker(m, "-x", 0, 20, 30);
  grille(m, "+x", 33, 4, 2, 14, 3, 1, C.steel_dark);
  warnSticker(m, "+x", 33, 20, 30);
}

function mfrRear(m: Model): void {
  const B = "-z";
  // Hazard skirt all round; the feed cabinet with plate, note and a mug.
  hazardFace(m, B, 0, 0, 1, 51, 4);
  hazardFace(m, "-x", 0, 0, 1, 51, 4);
  chamferBox(m, 13, 6, 1, 38, 24, 5, C.metal, C.steel_dark);
  serialPlate(m, B, 1, 36, 12, ["MFR", "0847"], { bg: C.paint_cream });
  tapedNote(m, B, 1, 14, 7, "!");
  warnSticker(m, B, 1, 14, 18, true);
  faceHarness(
    m,
    B,
    1,
    [
      [24, 11, -1],
      [24, 6, -1],
    ],
    [C.cable_black, C.cable_red, C.cable_yellow, C.cable_black],
  );
  mug(m, 30, 25, 2);
}

function emcRear(m: Model): void {
  const B = "-z";
  // Base and lid backs (flush), a conduit up the back, a sticker on the glass.
  grille(m, B, 0, 4, 2, 14, 4, 1, C.steel_dark);
  powerInlet(m, B, 0, 24, 1);
  hazardFace(m, B, 0, 30, 1, 34, 4);
  grille(m, B, 0, 4, 43, 20, 46, 1, C.steel_dark);
  serialPlate(m, B, 0, 31, 42, [], { barcode: true, w: 9, bg: C.paint_cream, d: 0 });
  m.box(4, 6, 0, 5, 41, 0, C.steel_dark);
  for (const y of [12, 24, 36]) m.box(3, y, 0, 6, y, 0, C.chrome);
  warnSticker(m, B, 1, 24, 30);
  grille(m, "-x", 0, 4, 2, 14, 4, 1, C.steel_dark);
  warnSticker(m, "-x", 1, 22, 30);
  stencil(m, "-x", 0, 20, 0, "EMC", C.safety_yellow);
}

function qsmRear(m: Model): void {
  const B = "-z";
  // Pump vent, mains, plate on the base; gas lines up into the cryostat cap.
  grille(m, B, 0, 2, 3, 11, 8, 1, C.steel_dark);
  powerInlet(m, B, 0, 13, 3, { rocker: true });
  serialPlate(m, B, 0, 33, 3, ["QSM"], { d: 0, bg: C.paint_cream });
  pipeElbow(m, 22, 12, 3, 28, 2, "-x", C.chrome, C.brass);
  pipeElbow(m, 24, 12, 5, 28, 3, "-x", C.copper, C.brass);
  grille(m, B, 12, 28, 23, 33, 26, 1, C.metal_dark);
  plate(m, B, 12, 29, 18, 32, 20, C.steel_dark);
  serviceHatch(m, "-x", 0, 3, 2, 14, 9, { tag: true });
  warnSticker(m, "-x", 0, 16, 3);
}

function qanRear(m: Model): void {
  const B = "-z";
  // Tall rear door, an open service bay, vents, mains, header tag.
  serviceHatch(m, B, 0, 2, 6, 16, 36, { tag: true });
  openHatch(m, B, 0, 20, 21, 32, 34);
  grille(m, B, 0, 20, 7, 32, 13, 1, C.steel_dark);
  powerInlet(m, B, 0, 24, 15);
  serialPlate(m, B, 0, 12, 39, [], { barcode: true, w: 9, bg: C.paint_cream, d: 0 });
  stencil(m, B, 0, 31, 39, "QAN", C.paint_white);
  warnSticker(m, "-x", 0, 8, 8, true);
}

function aicRear(m: Model): void {
  const B = "-z";
  // Twin exhaust fans, a service bay left ajar, the plate, and the note.
  fanPort(m, B, 2, 13, 38, 4.5);
  fanPort(m, B, 2, 23, 38, 4.5);
  openHatch(m, B, 2, 14, 20, 27, 31, { door: "left", panel: C.metal_dark });
  serialPlate(m, B, 2, 30, 8, ["AIC"], { bg: C.aluminium });
  tapedNote(m, B, 2, 11, 5, "!");
}

function scaRear(m: Model): void {
  const B = "-z";
  // Rear doors: three open racks showing server backs and cabling, one closed.
  for (let i = 0; i < 4; i++) {
    const x0 = i * 13 + 1;
    stencil(m, B, 0, x0 + 8, 33, `N${i + 1}`, C.paint_white);
    if (i === 2) {
      grille(m, B, 0, x0 + 2, 6, x0 + 9, 29, 1, C.steel_dark);
      serialPlate(m, B, 0, x0 + 9, 2, [], { barcode: true, w: 8, bg: C.paint_cream, d: 0 });
      continue;
    }
    for (let d = 0; d < 2; d++) faceRect(m, B, 0, x0 + 2, 4, x0 + 9, 31, d, 0);
    for (let y = 4; y <= 31; y++) {
      const row = (y - 4) % 3;
      faceRect(m, B, 0, x0 + 2, y, x0 + 9, y, 2, row === 2 ? C.black : C.steel_dark);
      if (row === 0) {
        faceSet(m, B, 0, x0 + 3, y + 1, 2, (y + i) % 4 ? C.led_green : C.led_amber);
        faceSet(m, B, 0, x0 + 6, y + 1, 2, C.black);
        faceSet(m, B, 0, x0 + 7, y + 1, 2, C.chrome);
      }
    }
    const cols = [C.safety_blue, C.cable_yellow, C.cable_black];
    faceRect(m, B, 0, x0 + 9, 4, x0 + 9, 31, 1, cols[i % 3]!);
    for (let y = 5; y <= 30; y += 6) faceRect(m, B, 0, x0 + 4, y, x0 + 8, y, 1, cols[(y + i) % 3]!);
  }
  serviceHatch(m, "-x", 1, 2, 5, 13, 30, { handle: false });
  tapedNote(m, "-x", 1, 4, 18, "!");
}

function tlpRear(m: Model): void {
  const B = "-z";
  // Power conditioner behind the pad, leads to the rear pylons.
  chamferBox(m, 18, 4, 1, 29, 11, 5, C.metal, C.steel_dark);
  grille(m, B, 1, 20, 8, 27, 10, 1, C.steel_dark);
  warnSticker(m, B, 1, 20, 4, true);
  serialPlate(m, B, 1, 28, 4, [], { barcode: true, w: 5, bg: C.paint_cream });
  for (const [x, c] of [
    [17, C.cable_black],
    [30, C.cable_red],
  ] as const)
    cableRun(
      m,
      [
        [x, 5, 3],
        [x < 24 ? 10 : 37, 5, 3],
        [x < 24 ? 10 : 37, 5, 6],
      ],
      c,
    );
}

// ── Registry ─────────────────────────────────────────────────────

const DEVICE_VISUALS: Record<string, () => DeviceVisual> = {
  "MCP-000": mcp,
  "CLK-001": clk,
  "VNT-001": vnt,
  "BTK-001": btk,
  "BAT-001": bat,
  "PWB-001": pwb,
  "CDC-001": cdc,
  "MEM-001": mem,
  "CPU-001": cpu,
  "NET-001": net,
  "TMP-001": tmp,
  "THM-001": thm,
  "PWR-001": pwr,
  "PWD-001": pwd,
  "VLT-001": vlt,
  "MSC-001": msc,
  "RMG-001": rmg,
  "ATK-001": atk,
  "UEC-001": uec,
  "DGN-001": dgn,
  "ECR-001": ecr,
  "SPK-001": spk,
  "HMS-001": hms,
  "OSC-001": osc,
  "INT-001": int,
  "AND-001": and,
  "QCP-001": qcp,
  "DIM-001": dim,
  "EXD-001": exd,
  "NXS-01": nxs,
  "LCT-001": lct,
  "P3D-001": p3d,
  "MFR-001": mfr,
  "EMC-001": emc,
  "QSM-001": qsm,
  "QAN-001": qan,
  "AIC-001": aic,
  "SCA-001": sca,
  "TLP-001": tlp,
};

/** Ids with a hand-made visual (everything else gets a crate). */
export const DEVICE_VISUAL_IDS: readonly string[] = Object.keys(DEVICE_VISUALS);

/**
 * Apply a rear dressing, then grime only the voxels it added or changed
 * (the front keeps its own dust pass untouched).
 */
function dressRear(m: Model, rear: (m: Model) => void): void {
  const before = m.grid.data.slice();
  rear(m);
  const grimed = new Model(m.w, m.h, m.d);
  grimed.grid.data.set(m.grid.data);
  dust(grimed, 2);
  const { data } = m.grid;
  for (let i = 0; i < data.length; i++)
    if (data[i] !== before[i] && data[i]) data[i] = grimed.grid.data[i]!;
}

/** Rear/side dressing per device id (see "Rear & side dressing"). */
const DEVICE_REAR: Record<string, (m: Model) => void> = {
  "MCP-000": mcpRear,
  "CLK-001": clkRear,
  "VNT-001": vntRear,
  "BTK-001": btkRear,
  "BAT-001": batRear,
  "PWB-001": pwbRear,
  "CDC-001": cdcRear,
  "MEM-001": memRear,
  "CPU-001": cpuRear,
  "NET-001": netRear,
  "TMP-001": tmpRear,
  "THM-001": thmRear,
  "PWR-001": pwrRear,
  "PWD-001": pwdRear,
  "VLT-001": vltRear,
  "MSC-001": mscRear,
  "RMG-001": rmgRear,
  "ATK-001": atkRear,
  "UEC-001": uecRear,
  "DGN-001": dgnRear,
  "ECR-001": ecrRear,
  "SPK-001": spkRear,
  "HMS-001": hmsRear,
  "OSC-001": oscRear,
  "INT-001": intRear,
  "AND-001": andRear,
  "QCP-001": qcpRear,
  "DIM-001": dimRear,
  "EXD-001": exdRear,
  "NXS-01": nxsRear,
  "LCT-001": lctRear,
  "P3D-001": p3dRear,
  "MFR-001": mfrRear,
  "EMC-001": emcRear,
  "QSM-001": qsmRear,
  "QAN-001": qanRear,
  "AIC-001": aicRear,
  "SCA-001": scaRear,
  "TLP-001": tlpRear,
};

/**
 * Rear fan guards laid by the rear pass (`fanPort` on "-z": at, u, v, r):
 * each gets a rotor spinning just behind its guard, so the backs move too.
 */
const REAR_FANS: Record<string, readonly (readonly [number, number, number, number])[]> = {
  "MCP-000": [
    [1, 10, 28, 5],
    [1, 25, 28, 5],
  ],
  "MEM-001": [[1, 9.5, 21, 4.5]],
  "CPU-001": [[1, 9.5, 19, 4.5]],
  "NET-001": [
    [1, 7, 15.5, 3.5],
    [1, 18, 15.5, 3.5],
  ],
  "INT-001": [[6, 6, 15, 1.6]],
  "AND-001": [[9, 14, 8, 3]],
  "NXS-01": [[1, 19, 10.5, 2.5]],
  "LCT-001": [[2, 7, 4.5, 3]],
  "P3D-001": [[0, 8, 2.5, 2]],
  "AIC-001": [
    [2, 13, 38, 4.5],
    [2, 23, 38, 4.5],
  ],
};

/** Paint → what shows through where it has chipped off an edge. */
const CHIP: Record<number, number> = {
  [C.red_paint]: C.steel_dark,
  [C.paint_brick]: C.steel_dark,
  [C.green_paint]: C.steel_dark,
  [C.blue_paint]: C.steel_dark,
  [C.purple_paint]: C.steel_dark,
  [C.orange_paint]: C.steel,
  [C.safety_yellow]: C.steel,
  [C.yellow_paint]: C.steel,
  [C.paint_white]: C.steel,
  [C.paint_cream]: C.aluminium,
  [C.beige]: C.aluminium,
  [C.teal]: C.steel_dark,
  [C.paint_teal]: C.steel_dark,
  [C.paint_gray]: C.steel,
  [C.walnut]: C.wood_light,
  [C.wood_dark]: C.wood,
};

/**
 * Edge wear: painted voxels on an outer edge (open on two axes) chip to
 * the metal (or bare wood) underneath, sparsely and deterministically.
 * Never touches screens, emissives or the dusty bottom rows.
 */
function edgeWear(m: Model, density = 0.24): void {
  const g = m.grid;
  const hits: [number, number, number, number][] = [];
  g.forEach((x, y, z, v) => {
    const bare = CHIP[v];
    if (bare === undefined || y < 3) return;
    const ox = !g.get(x + 1, y, z) || !g.get(x - 1, y, z);
    const oz = !g.get(x, y, z + 1) || !g.get(x, y, z - 1);
    const oy = !g.get(x, y + 1, z);
    if ((ox ? 1 : 0) + (oz ? 1 : 0) + (oy ? 1 : 0) < 2) return;
    if (hash3(x * 3 + 1, y * 5, z * 7 + 2) < density) hits.push([x, y, z, bare]);
  });
  for (const [x, y, z, c] of hits) m.set(x, y, z, c);
}

function rearFanParts(id: string): AnimPart[] {
  return (REAR_FANS[id] ?? []).map(([at, u, v, r], i) =>
    mount(
      `rear_fan_${i}`,
      fanRotor(Math.max(1, Math.floor(r - 1)), "xy", C.steel_dark, C.metal_dark),
      [u + 0.5, v + 0.5, at + 1.5],
      "spin",
      { axis: "z", speed: i % 2 ? 9 : -9, phase: i },
    ),
  );
}

export function deviceVisual(id: string): DeviceVisual {
  const f = DEVICE_VISUALS[id];
  if (f) {
    const v = f();
    const rear = DEVICE_REAR[id];
    if (rear) dressRear(v.base, rear);
    edgeWear(v.base);
    v.parts.push(...rearFanParts(id));
    return v;
  }
  const m = new Model(8, 8, 8);
  bevelBox(m, 0, 0, 0, 7, 7, 7, C.metal, C.steel_dark);
  label(m, 2, 5, 4, 7);
  return visual(m, [], []);
}

/** Static base model (compatibility with the pre-animation engine). */
export function deviceModel(id: string): Model {
  return deviceVisual(id).base;
}
