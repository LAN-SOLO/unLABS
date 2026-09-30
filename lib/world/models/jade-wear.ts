/**
 * Jade's wardrobe — clothes: tops, jackets, trousers, shoes (pure — no three).
 * ===========================================================================
 *
 * Paints the clothes layers of the body parts on `Canvas`es at the rig's
 * nominal part sizes (see jade-rig.ts for the frames):
 *
 *   hips      16×6×10   rows 0..3 visible, 4..5 the top's plug
 *   torso     16×16×12  front = z 9, lapels z 10, back z 0
 *   upperArm  6×10×6    rows 0..8 visible, shoulder plug row 9
 *   forearm   6×12×6    sleeve 6..9, wrist 4..5, hand 0..3, elbow plug 10..11
 *   thigh     6×14×6    rows 0..11, hip plug 12..13
 *   shin      6×14×10   shoe 0..~5, trousers above, knee plug 12..13
 *   coatTail  20×8×14   the skirt of a coat below the hips (hips x ↔ x + 2, z ↔ z + 2)
 *
 * The default pieces (teal sweater, white lab coat, dark work trousers,
 * brown boots) reproduce the original Jade voxel for voxel; every other
 * piece is drawn from its colourway `Tone` (main / shade / accent).
 * Gloves, belts, neck/back/buddy pieces: jade-gear.ts / jade-accessories.ts.
 */
import { C } from "@/lib/world/content/palette";
import {
  Canvas,
  SKIN,
  SKIN_SHADE,
  lighter,
  roundEdges,
  tint,
  type LookCtx,
  type Tone,
  type Worn,
} from "@/lib/world/models/jade-kit";
import { drawPrint } from "@/lib/world/models/jade-prints";

// ── Classification ──────────────────────────────────────────────

/** Jackets cut like the lab coat: open front, a skirt below the hips. */
const OPEN_COATS = new Set(["labcoat", "labcoat_patched", "cardigan"]);
/** Jackets with sleeves (the top's sleeves only show at the wrist). */
const SLEEVED_OUTER = new Set(["labcoat", "labcoat_patched", "cardigan", "bomber", "raincoat"]);
/** Long-sleeved tops (show at the wrist under a jacket). */
const LONG_TOPS = new Set(["sweater_teal", "turtleneck", "hoodie", "hoodie_night_shift"]);
const TEES = new Set(["tee_unlab", "tee_do_not_lick", "tee_418", "tee_bot_lineup", "tee_residual"]);
const HOODIES = new Set(["hoodie", "hoodie_night_shift"]);

const T = (w: Worn | null, fallback: Tone): Tone => w?.t ?? fallback;
const NO_TOP: Tone = { main: SKIN, shade: SKIN_SHADE, accent: SKIN_SHADE };

/** Does the jacket have a skirt part (coatTail)? */
export function outerHasTail(ctx: LookCtx): boolean {
  const o = ctx.outer?.id;
  return !!o && (OPEN_COATS.has(o) || o === "raincoat" || o === "welding_apron");
}

// ── Hips ────────────────────────────────────────────────────────

/** Trousers (or skirt) over the hips, the jacket's hem, the top's plug. Belt: accessories. */
export function hipsClothes(k: Canvas, ctx: LookCtx): void {
  const legs = ctx.legs;
  const lt = T(legs, NO_TOP);
  const id = legs?.id ?? "";
  k.box(0, 0, 0, 15, 3, 9, lt.main);
  roundEdges(k, 0, 15, 0, 9, 0, 3);
  if (id === "skirt_plaid") {
    k.forEach((x, y, z) => k.set(x, y, z, tartan(lt, x + z, y)));
    k.set(12, 1, 9, C.chrome).set(12, 0, 9, C.steel).set(13, 1, 9, C.steel); // safety pin
  } else if (id === "shorts_tights") {
    k.forEach((x, y, z) => {
      if ((z === 9 || z === 0) && x % 2) k.set(x, y, z, lt.shade);
    });
    k.box(7, 0, 9, 7, 1, 9, lt.shade);
  } else {
    // Fly fold.
    k.box(7, 0, 9, 7, 1, 9, lt.shade);
    if (id === "jeans") {
      // Front pocket stitching with rivets, back pockets.
      for (const [x, y] of [
        [1, 1],
        [2, 0],
        [14, 1],
        [13, 0],
      ] as const)
        k.set(x, y, 9, lt.accent);
      k.set(3, 2, 9, C.brass).set(12, 2, 9, C.brass);
      for (const x0 of [2, 10]) {
        k.box(x0, 0, 0, x0 + 3, 0, 0, lt.accent).box(x0, 0, 0, x0, 2, 0, lt.accent);
        k.box(x0 + 3, 0, 0, x0 + 3, 2, 0, lt.accent);
      }
    } else if (id === "joggers") {
      // Waistband rib and the drawstring.
      k.forEach((x, y, z) => {
        if (y === 3 && (x === 0 || x === 15 || z === 0 || z === 9) && (x + z) % 2)
          k.set(x, y, z, lt.shade);
      });
      k.box(6, 0, 9, 6, 1, 9, lt.accent).box(9, 0, 9, 9, 1, 9, lt.accent);
    } else if (id === "workpants_hivis") {
      k.box(0, 1, 0, 15, 1, 9, lt.accent);
      roundEdges(k, 0, 15, 0, 9, 1, 1);
      k.box(7, 0, 9, 7, 1, 9, lt.shade);
    }
  }
  const o = ctx.outer;
  if (o && OPEN_COATS.has(o.id)) coatHips(k, o);
  else if (o?.id === "raincoat") {
    coatHips(k, o);
    k.box(4, 0, 9, 11, 3, 9, o.t.main).box(8, 0, 9, 8, 3, 9, o.t.shade);
    k.set(9, 1, 9, o.t.accent);
    for (let y = 0; y <= 3; y++) tint(k, 2, y, 0, lighter(o.t.main));
  } else if (o?.id === "bomber") {
    // Rib hem round the waist; the belt shows in front when one is worn.
    k.forEach((x, y, z) => {
      if (y < 2) return;
      const front = z === 9 && x >= 4 && x <= 11 && !!ctx.belt;
      const surf = x === 0 || x === 15 || z === 0 || z === 9 || x === 1 || x === 14;
      if (surf && !front) k.set(x, y, z, (x + z) % 2 ? o.t.shade : o.t.main);
    });
  } else if (o?.id === "welding_apron") {
    k.free(() => {
      k.box(3, 0, 10, 12, 3, 10, o.t.main);
      k.box(3, 3, 10, 12, 3, 10, o.t.shade);
      k.set(2, 3, 9, o.t.shade).set(13, 3, 9, o.t.shade).set(1, 2, 8, o.t.shade);
      k.set(14, 2, 8, o.t.shade);
    });
  }
  // The top's plug inside the torso.
  k.box(2, 4, 2, 13, 5, 7, T(ctx.top, NO_TOP).main);
}

function coatHips(k: Canvas, o: Worn): void {
  const { main, shade } = o.t;
  k.box(0, 0, 1, 1, 3, 8, main).box(14, 0, 1, 15, 3, 8, main);
  k.box(1, 0, 0, 14, 3, 1, main);
  k.box(2, 0, 8, 3, 3, 9, main).box(12, 0, 8, 13, 3, 9, main);
  k.box(3, 0, 9, 3, 3, 9, shade).box(12, 0, 9, 12, 3, 9, shade);
  // Back vent.
  k.box(7, 0, 0, 8, 3, 0, shade);
  if (o.id === "labcoat_patched") patch(k, 3, 1, 0, 3, 3, "z", o.t);
  if (o.id === "cardigan")
    k.forEach((x, y, z) => {
      if ((x === 0 || x === 15 || z === 0) && (x + y + z) % 3 === 0) k.set(x, y, z, shade);
    });
}

/**
 * A darned patch (paint_cream fill, copper stitches) on a face plane.
 * `axis` names the plane's constant axis; the patch spans a×b on the others.
 */
function patch(
  k: Canvas,
  x: number,
  y: number,
  z: number,
  a: number,
  b: number,
  axis: "x" | "z",
  t: Tone,
): void {
  for (let i = 0; i < a; i++)
    for (let j = 0; j < b; j++) {
      const [px, pz] = axis === "z" ? [x + i, z] : [x, z + i];
      const edge = i === 0 || j === 0 || i === a - 1 || j === b - 1;
      const c = edge ? ((i + j) % 2 ? t.accent : C.paint_cream) : C.paint_cream;
      tint(k, px, y + j, pz, c);
    }
}

/** Tartan: base, shade bands, thin accent lines (u runs round the body). */
function tartan(t: Tone, u: number, v: number): number {
  const bu = ((u % 5) + 5) % 5 === 0;
  const bv = ((v % 4) + 4) % 4 === 1;
  if (bu && bv) return C.paint_black;
  if (bu || bv) return t.shade;
  if (((u % 5) + 5) % 5 === 2 && ((v % 4) + 4) % 4 === 3) return t.accent;
  return t.main;
}

// ── Torso ───────────────────────────────────────────────────────

/** Width of the lab coat's opening per row: [a, b] columns showing the top. */
function coatOpening(y: number): [number, number] {
  return y <= 9 ? [6, 9] : y === 10 ? [5, 10] : [4, 11];
}

function bodyBlock(k: Canvas, c: number): void {
  k.box(0, 0, 0, 15, 15, 9, c);
  roundEdges(k, 0, 15, 0, 9, 0, 15);
  // Shoulders slope into the arms.
  k.box(0, 15, 0, 1, 15, 9, 0).box(14, 15, 0, 15, 15, 9, 0);
  k.box(0, 14, 0, 0, 14, 9, 0).box(15, 14, 0, 15, 14, 9, 0);
}

/**
 * Torso clothes: the jacket over the top (or the top alone), with every
 * garment detail. `hairMain` colours the photo on the lab badge.
 */
export function torsoClothes(k: Canvas, ctx: LookCtx, hairMain: number): void {
  const o = ctx.outer;
  const top = ctx.top;
  if (o && OPEN_COATS.has(o.id)) openCoat(k, o, top, hairMain);
  else if (o?.id === "raincoat") raincoat(k, o, top);
  else if (o?.id === "bomber") bomber(k, o, top);
  else {
    topBody(k, top);
    if (o?.id === "welding_apron") apronBib(k, o);
  }
  if (top && HOODIES.has(top.id) && o?.id !== "raincoat") hood(k, top.t);
  if (top?.id === "turtleneck") turtleCollar(k, top.t);
}

/** Lab coat / patched coat / cardigan: open front showing the top. */
function openCoat(k: Canvas, o: Worn, top: Worn | null, hairMain: number): void {
  const { main, shade, accent } = o.t;
  const tt = T(top, NO_TOP);
  bodyBlock(k, main);
  // Open coat over the top: a narrow strip low, a V widening at the lapels.
  for (let y = 0; y <= 15; y++) {
    const [a, b] = coatOpening(y);
    k.box(a, y, 9, b, y, 9, tt.main);
    k.set(a - 1, y, 9, shade).set(b + 1, y, 9, shade);
  }
  topFront(k, top, (x, y) => {
    const [a, b] = coatOpening(y);
    return x >= a && x <= b;
  });
  if (o.id === "cardigan") {
    // Knit bands along the opening, horn buttons, a soft knit texture.
    for (let y = 0; y <= 15; y++) {
      const [a, b] = coatOpening(y);
      k.set(a - 1, y, 10, shade).set(b + 1, y, 10, shade);
    }
    for (const y of [1, 4, 7]) k.set(10, y, 11, accent);
    k.forEach((x, y, z) => {
      if (z <= 8 && (x === 0 || x === 15 || z === 0) && (x + y * 3 + z * 2) % 7 === 0)
        k.set(x, y, z, shade);
    });
    for (let z = 1; z <= 8; z++) {
      tint(k, 1, 13, z, shade);
      tint(k, 14, 13, z, shade);
    }
    return;
  }
  // Folded lapels stand proud of the chest.
  for (let y = 10; y <= 15; y++) {
    const w = y >= 13 ? 2 : 1;
    k.box(4 - w, y, 10, 3, y, 10, main).box(12, y, 10, 11 + w, y, 10, main);
  }
  k.box(1, 10, 10, 3, 10, 10, shade).box(12, 10, 10, 14, 10, 10, shade);
  k.set(3, 14, 10, 0).set(12, 14, 10, 0);
  // ID badge "J. LAWRENCE" on the right chest: clip, header, photo, name lines.
  k.box(0, 3, 10, 3, 9, 10, C.paper);
  k.box(0, 8, 10, 3, 9, 10, accent);
  k.set(1, 9, 10, C.paper).set(2, 9, 10, C.paper);
  k.box(0, 5, 10, 1, 7, 10, C.skin);
  k.set(0, 7, 10, hairMain).set(1, 7, 10, hairMain);
  k.set(2, 7, 10, C.paint_black).set(3, 6, 10, C.paint_black).set(2, 5, 10, C.paint_black);
  k.box(0, 4, 10, 3, 4, 10, C.paint_black);
  k.set(1, 3, 10, C.paint_black).set(3, 3, 10, C.paint_black);
  k.box(1, 10, 10, 2, 11, 10, C.steel);
  // Breast pocket with pens on the left chest.
  k.box(11, 2, 9, 14, 2, 9, shade);
  k.box(11, 3, 9, 11, 6, 9, shade).box(14, 3, 9, 14, 6, 9, shade);
  k.box(11, 7, 9, 14, 7, 9, shade);
  k.box(12, 6, 10, 12, 8, 10, C.safety_blue).set(12, 6, 10, C.chrome);
  k.box(13, 6, 10, 13, 9, 10, C.safety_red).set(13, 6, 10, C.chrome).set(13, 9, 10, C.chrome);
  // Placket buttons, film dosimeter on the left lapel.
  k.set(5, 2, 9, C.steel).set(5, 6, 9, C.steel);
  k.box(12, 12, 11, 13, 13, 11, C.safety_yellow)
    .set(12, 11, 11, C.paint_black)
    .set(13, 11, 11, C.paint_black);
  // Back seam, yoke, a half belt with two buttons; sleeve-head seams.
  k.box(7, 0, 0, 8, 5, 0, shade);
  k.box(2, 12, 0, 13, 12, 0, shade);
  k.box(4, 4, 0, 11, 4, 0, shade);
  k.set(4, 4, 0, C.steel).set(11, 4, 0, C.steel);
  for (let z = 1; z <= 8; z++) {
    tint(k, 1, 13, z, shade);
    tint(k, 14, 13, z, shade);
  }
  // Folds under the arms.
  for (const [y, z] of [
    [9, 3],
    [8, 4],
    [5, 6],
  ] as const) {
    tint(k, 0, y, z, shade);
    tint(k, 15, y, z, shade);
  }
  if (o.id === "labcoat_patched") {
    // Copper-darned patches and scorch marks: every experiment that answered back.
    patch(k, 3, 7, 0, 4, 4, "z", o.t);
    patch(k, 10, 0, 0, 3, 3, "z", o.t);
    patch(k, 0, 1, 3, 3, 3, "x", o.t);
    patch(k, 15, 9, 4, 3, 3, "x", o.t);
    for (const [x, y, z] of [
      [12, 13, 0],
      [5, 1, 0],
      [15, 2, 7],
    ] as const)
      tint(k, x, y, z, C.grime);
    k.set(2, 1, 9, accent).set(13, 11, 9, C.grime);
  }
}

/** What of the top shows inside an open jacket (`inside`) — or on the whole front. */
function topFront(k: Canvas, top: Worn | null, inside: (x: number, y: number) => boolean): void {
  if (!top) return;
  const { main, shade, accent } = top.t;
  const id = top.id;
  if (id === "sweater_teal") {
    // Cable knit: two vertical cables and purl dots; the crew-neck rib.
    for (let y = 0; y <= 13; y++) {
      tint(k, 7, y, 9, y % 3 === 0 ? shade : main);
      tint(k, 8, y, 9, y % 3 === 1 ? shade : main);
    }
    for (let y = 11; y <= 13; y += 2) k.set(5, y, 9, shade).set(10, y, 9, shade);
    k.box(5, 14, 9, 10, 15, 9, shade);
    k.box(6, 15, 8, 9, 15, 9, shade);
    return;
  }
  const paint = (x: number, y: number, c: number) => {
    if (inside(x, y)) tint(k, x, y, 9, c);
  };
  if (id === "turtleneck") {
    for (let y = 0; y <= 15; y++) for (let x = 0; x <= 15; x += 2) paint(x, y, accent);
    k.box(5, 14, 9, 10, 15, 9, main);
    return;
  }
  if (TEES.has(id) || HOODIES.has(id)) {
    if (top.item.print) drawPrint(k, top.item.print, top.t, 7.5, 12, 9, inside);
    if (HOODIES.has(id)) {
      // Kangaroo pocket top edge, drawstrings with steel aglets.
      for (let x = 3; x <= 12; x++) paint(x, 5, shade);
      for (let y = 9; y <= 15; y++) {
        paint(6, y, accent);
        paint(9, y, accent);
      }
      paint(6, 9, C.steel);
      paint(9, 9, C.steel);
      k.box(6, 15, 9, 9, 15, 9, shade);
    } else {
      k.box(5, 15, 9, 10, 15, 9, shade);
      k.box(6, 14, 9, 9, 14, 9, shade);
      k.box(6, 15, 8, 9, 15, 8, shade);
    }
    return;
  }
  if (id === "flannel") {
    for (let y = 0; y <= 15; y++)
      for (let x = 0; x <= 15; x++) {
        const c = checkColor(top.t, x, y);
        if (c !== main) paint(x, y, c);
      }
    for (const y of [2, 5, 8, 11]) paint(8, y, C.paint_cream);
    k.box(5, 15, 9, 6, 15, 9, main).box(9, 15, 9, 10, 15, 9, main);
    k.set(6, 14, 9, shade).set(9, 14, 9, shade);
    return;
  }
  if (id === "overall_top") {
    // Rib and a scooped neckline showing skin.
    for (let y = 0; y <= 15; y++) for (let x = 1; x <= 15; x += 2) paint(x, y, shade);
    k.box(6, 13, 9, 9, 15, 9, SKIN);
    k.box(6, 15, 8, 9, 15, 8, SKIN);
    paint(11, 5, accent);
    paint(12, 6, accent);
  }
}

function checkColor(t: Tone, x: number, y: number): number {
  const a = x % 4 === 0;
  const b = y % 4 === 0;
  if (a && b) return t.accent;
  if (a || b) return t.shade;
  return t.main;
}

/** The top alone (no jacket, or under an apron). */
function topBody(k: Canvas, top: Worn | null): void {
  const t = T(top, NO_TOP);
  const { main, shade, accent } = t;
  bodyBlock(k, main);
  const id = top?.id ?? "";
  const hem = (c: (x: number, z: number) => number) =>
    k.forEach((x, y, z) => {
      if (y === 0) k.set(x, y, z, c(x, z));
    });
  const neck = () => {
    // Crew neck: the rib round the collar and down the front.
    for (let x = 5; x <= 10; x++) for (let z = 3; z <= 9; z++) tint(k, x, 15, z, shade);
    k.box(6, 15, 4, 9, 15, 8, main);
  };
  if (id === "sweater_teal") {
    // Two cables down each side of the chest, purl dots, rib hem, crew neck.
    for (let y = 1; y <= 13; y++)
      for (const x of [4, 10]) {
        tint(k, x, y, 9, y % 3 === 0 ? shade : main);
        tint(k, x + 1, y, 9, y % 3 === 1 ? shade : main);
      }
    for (let y = 2; y <= 12; y += 2) {
      tint(k, 7, y, 9, shade);
      tint(k, 2, y + 1, 9, shade);
      tint(k, 13, y + 1, 9, shade);
    }
    for (let y = 2; y <= 12; y += 3) {
      tint(k, 7, y, 0, shade);
      tint(k, 8, y + 1, 0, shade);
    }
    hem((x, z) => ((x + z) % 2 ? shade : main));
    neck();
    k.box(5, 14, 9, 10, 15, 9, shade);
    return;
  }
  if (id === "turtleneck") {
    k.forEach((x, y, z) => {
      if ((z === 9 || z === 0) && x % 2 === 0) k.set(x, y, z, accent);
    });
    hem(() => shade);
    return;
  }
  if (TEES.has(id)) {
    neck();
    k.box(5, 14, 9, 10, 14, 9, main).box(6, 14, 9, 9, 14, 9, shade);
    hem(() => shade);
    for (let y = 1; y <= 13; y++) {
      tint(k, 0, y, 5, shade);
      tint(k, 15, y, 5, shade);
    }
    if (top?.item.print) drawPrint(k, top.item.print, t, 7.5, 12, 9);
    return;
  }
  if (HOODIES.has(id)) {
    // Kangaroo pocket with slanted openings, drawstrings, rib hem, print above the pocket.
    k.box(3, 1, 9, 12, 5, 9, main);
    for (let x = 3; x <= 12; x++) k.set(x, 5, 9, shade);
    k.box(3, 1, 9, 3, 5, 9, shade).box(12, 1, 9, 12, 5, 9, shade);
    k.set(4, 4, 9, shade).set(4, 3, 9, shade).set(11, 4, 9, shade).set(11, 3, 9, shade);
    k.free(() => k.box(4, 1, 10, 11, 4, 10, main));
    k.set(3, 2, 10, 0);
    for (let y = 9; y <= 15; y++) k.set(6, y, 9, accent).set(9, y, 9, accent);
    k.free(() => k.set(6, 8, 10, C.steel).set(9, 8, 10, C.steel).set(6, 9, 10, accent));
    k.set(9, 9, 10, accent);
    hem((x, z) => ((x + z) % 2 ? shade : main));
    k.forEach((x, y, z) => {
      if (y === 1 && (x === 0 || x === 15 || z === 0)) k.set(x, y, z, shade);
    });
    neck();
    if (top?.item.print) drawPrint(k, top.item.print, t, 7.5, 14, 9);
    return;
  }
  if (id === "flannel") {
    k.forEach((x, y, z) => {
      if (z === 9 || z === 0) k.set(x, y, z, checkColor(t, x, y));
      else if (x === 0 || x === 15) k.set(x, y, z, checkColor(t, z, y));
    });
    // Placket with buttons, collar points, two chest pockets with flaps.
    for (let y = 0; y <= 14; y++) k.set(8, y, 9, main);
    for (const y of [2, 5, 8, 11]) k.set(8, y, 9, C.paint_cream);
    for (const x0 of [2, 11]) {
      k.box(x0, 9, 10, x0 + 2, 11, 10, main);
      k.box(x0, 11, 10, x0 + 2, 11, 10, shade);
    }
    k.box(5, 14, 10, 7, 15, 10, main).box(9, 14, 10, 11, 15, 10, main);
    k.set(5, 14, 10, shade).set(11, 14, 10, shade);
    k.box(6, 15, 3, 9, 15, 8, shade);
    hem(() => shade);
    return;
  }
  if (id === "overall_top") {
    // Rib tank: straps, bare shoulders, a scooped neck and a greasy thumbprint.
    k.forEach((x, y, z) => {
      if ((z === 9 || z === 0) && x % 2) k.set(x, y, z, shade);
      const shoulder = y >= 12 && (x <= 2 || x >= 13);
      const scoop = y >= 13 && x >= 5 && x <= 10 && (z >= 7 || z <= 1);
      if (shoulder || scoop || (y === 15 && x >= 5 && x <= 10)) k.set(x, y, z, SKIN);
    });
    for (let y = 11; y <= 13; y++) {
      tint(k, 3, y, 0, SKIN_SHADE);
      tint(k, 12, y, 0, SKIN_SHADE);
    }
    tint(k, 11, 5, 9, accent);
    tint(k, 12, 6, 9, accent);
    tint(k, 11, 6, 9, accent);
    hem(() => shade);
    return;
  }
  neck();
}

function hood(k: Canvas, t: Tone): void {
  const { main, shade } = t;
  k.free(() => {
    // The hood lies folded on the back: a rounded panel with a thick rim roll.
    for (let y = 8; y <= 15; y++) {
      const hw = y <= 8 ? 1 : y <= 10 ? 3 : 4;
      for (let x = 8 - hw - 1; x <= 7 + hw + 1; x++) {
        k.set(x, y, -1, main);
        if (y >= 10 && Math.abs(x - 7.5) < hw) k.set(x, y, -2, main);
      }
    }
    k.set(7, 8, -1, shade).set(8, 8, -1, shade);
    for (let x = 3; x <= 12; x++) for (let z = -2; z <= 2; z++) k.set(x, 16, z, main);
    k.box(5, 16, -1, 10, 16, 1, shade);
    k.box(3, 15, -2, 12, 15, -2, shade);
    for (let x = 4; x <= 11; x += 3) k.set(x, 12, -3, shade);
  });
}

function turtleCollar(k: Canvas, t: Tone): void {
  k.free(() => {
    for (let y = 16; y <= 17; y++)
      for (let x = 5; x <= 10; x++)
        for (let z = 2; z <= 9; z++) {
          const inner = x >= 6 && x <= 9 && z >= 3 && z <= 8;
          if (!inner) k.set(x, y, z, (x + z) % 2 ? t.main : t.accent);
        }
    k.box(5, 17, 9, 10, 17, 9, t.shade);
  });
}

function raincoat(k: Canvas, o: Worn, top: Worn | null): void {
  const { main, shade, accent } = o.t;
  const gloss = lighter(main);
  bodyBlock(k, main);
  // Storm placket with snaps, a big pointed collar round a small neck opening.
  for (let y = 0; y <= 13; y++) k.set(7, y, 9, shade);
  k.free(() => {
    for (const y of [2, 5, 8, 11]) k.set(8, y, 10, accent);
    for (let y = 13; y <= 15; y++) {
      const w = y - 12;
      k.box(7 - w - 2, y, 10, 6, y, 10, main).box(9, y, 10, 9 + w + 2, y, 10, main);
    }
    k.box(3, 13, 10, 6, 13, 10, shade).box(9, 13, 10, 12, 13, 10, shade);
  });
  k.box(7, 14, 9, 8, 15, 9, T(top, NO_TOP).main);
  // Flap pockets and a glossy sheen.
  for (const x0 of [1, 11]) {
    k.box(x0, 4, 9, x0 + 3, 4, 9, shade);
    k.free(() => k.box(x0, 5, 10, x0 + 3, 5, 10, main));
  }
  for (let y = 2; y <= 12; y++) {
    if (y % 4 !== 1) tint(k, 2, y, 9, gloss);
    if (y % 4 !== 3) tint(k, 12, y, 0, gloss);
  }
  for (let z = 2; z <= 7; z += 2) tint(k, 2, 15, z, gloss);
  k.box(7, 0, 0, 8, 12, 0, shade);
  hood(k, o.t);
  for (let x = 4; x <= 11; x += 2) k.free(() => k.set(x, 13, -2, gloss));
}

function bomber(k: Canvas, o: Worn, top: Worn | null): void {
  const { main, shade, accent } = o.t;
  bodyBlock(k, main);
  // Rib hem, zip, a small V at the neck lined in orange, welt pockets, rib collar.
  k.forEach((x, y, z) => {
    if (y <= 1) k.set(x, y, z, (x + z) % 2 ? shade : main);
  });
  for (let y = 1; y <= 11; y++) k.set(8, y, 9, y % 2 ? C.chrome : C.steel);
  k.set(8, 11, 9, C.chrome);
  for (let y = 12; y <= 15; y++) {
    const [a, b] = y <= 13 ? [7, 8] : [6, 9];
    k.box(a, y, 9, b, y, 9, T(top, NO_TOP).main);
    k.set(a - 1, y, 9, accent).set(b + 1, y, 9, accent);
  }
  for (const [x, y] of [
    [2, 3],
    [3, 4],
    [4, 5],
    [13, 3],
    [12, 4],
    [11, 5],
  ] as const)
    k.set(x, y, 9, shade);
  k.free(() => {
    for (let x = 3; x <= 12; x++)
      for (let z = 1; z <= 9; z++) {
        const inner = x >= 5 && x <= 10 && z >= 3 && z <= 8;
        if (!inner && !(z === 9 && x >= 6 && x <= 9)) k.set(x, 16, z, (x + z) % 2 ? shade : main);
      }
    k.box(5, 16, 9, 5, 16, 9, accent).box(10, 16, 9, 10, 16, 9, accent);
  });
  k.box(2, 12, 0, 13, 12, 0, shade);
  // Puffed quilting: soft shade lines across the back.
  for (let x = 1; x <= 14; x++) tint(k, x, 7, 0, shade);
}

function apronBib(k: Canvas, o: Worn): void {
  const { main, shade, accent } = o.t;
  // Split-leather bib with stitched edges, a striker pocket, scorch marks, straps.
  for (let y = 0; y <= 13; y++) {
    const [a, b] = y >= 9 ? [4, 11] : [3, 12];
    k.box(a, y, 10, b, y, 10, main);
    k.set(a, y, 10, shade).set(b, y, 10, shade);
  }
  k.box(4, 13, 10, 11, 13, 10, shade);
  k.box(6, 3, 11, 9, 6, 11, main).box(6, 6, 11, 9, 6, 11, shade);
  k.set(8, 7, 11, accent).set(8, 8, 11, accent).set(7, 7, 11, C.flower_yellow);
  for (const [x, y] of [
    [5, 8],
    [10, 4],
    [9, 11],
    [4, 2],
  ] as const)
    k.set(x, y, 10, C.grime);
  k.set(4, 13, 11, accent).set(11, 13, 11, accent);
  k.free(() => {
    k.set(4, 14, 10, main).set(5, 15, 10, main).set(11, 14, 10, main).set(10, 15, 10, main);
    for (let z = 2; z <= 9; z++) k.set(5, 16, z, main).set(10, 16, z, main);
    k.box(5, 16, 2, 10, 16, 2, main);
    for (let z = 1; z <= 8; z++) k.set(-1, 1, z, z % 3 ? shade : main).set(16, 1, z, shade);
    k.box(6, 1, -1, 9, 1, -1, shade);
  });
}

// ── Arms ────────────────────────────────────────────────────────

interface Sleeve {
  sleeve: number;
  shade: number;
  cuff: number;
}

function sleeveOf(ctx: LookCtx): { s: Sleeve | null; outer: boolean } {
  const o = ctx.outer;
  if (o && SLEEVED_OUTER.has(o.id))
    return { s: { sleeve: o.t.main, shade: o.t.shade, cuff: o.t.shade }, outer: true };
  const top = ctx.top;
  if (!top || top.id === "overall_top") return { s: null, outer: false };
  return { s: { sleeve: top.t.main, shade: top.t.shade, cuff: top.t.shade }, outer: false };
}

/** Upper arm (right; mirrored for the left). */
export function upperArmClothes(k: Canvas, ctx: LookCtx): void {
  const { s, outer } = sleeveOf(ctx);
  const o = ctx.outer;
  const top = ctx.top;
  const short = !outer && (!top || TEES.has(top.id) || top.id === "overall_top");
  const base = s?.sleeve ?? SKIN;
  const shade = s?.shade ?? SKIN_SHADE;
  k.box(0, 0, 0, 5, 9, 5, short ? SKIN : base);
  roundEdges(k, 0, 5, 0, 5, 0, 9);
  if (short) {
    for (const [x, y, z] of [
      [2, 1, 5],
      [0, 3, 3],
      [3, 2, 0],
    ] as const)
      tint(k, x, y, z, SKIN_SHADE);
    if (top && TEES.has(top.id)) {
      // Short sleeve with a hem.
      k.box(0, 5, 0, 5, 9, 5, base);
      roundEdges(k, 0, 5, 0, 5, 5, 9);
      k.free(() => {
        for (let x = 0; x <= 5; x++)
          for (let z = 0; z <= 5; z++)
            if (x === 0 || x === 5 || z === 0 || z === 5)
              if (!((x === 0 || x === 5) && (z === 0 || z === 5))) k.set(x, 5, z, shade);
      });
    } else {
      for (let z = 1; z <= 4; z++) tint(k, 5, 9, z, SKIN_SHADE);
    }
    return;
  }
  // Elbow crease, a fold down the back, the shoulder seam.
  for (const [x, y, z] of [
    [1, 1, 5],
    [2, 2, 5],
    [0, 4, 2],
    [0, 5, 3],
    [3, 3, 0],
    [2, 6, 0],
  ] as const)
    tint(k, x, y, z, shade);
  for (let z = 1; z <= 4; z++) tint(k, 0, 9, z, shade);
  const id = outer ? (o?.id ?? "") : (top?.id ?? "");
  if (id === "labcoat" || id === "labcoat_patched" || id === "bomber") {
    // _unLABS sleeve patch: orange shield with a black mark.
    k.box(0, 5, 1, 0, 7, 3, C.safety_orange);
    k.set(0, 6, 2, C.paint_black).set(0, 7, 1, C.orange_paint).set(0, 7, 3, C.orange_paint);
  }
  if (id === "labcoat_patched") patch(k, 5, 1, 1, 3, 3, "x", o!.t);
  if (id === "raincoat") for (let y = 1; y <= 7; y += 2) tint(k, 0, y, 4, lighter(base));
  if (id === "cardigan")
    k.forEach((x, y, z) => {
      if ((x + y * 3 + z * 2) % 7 === 0 && (x === 0 || x === 5 || z === 0 || z === 5))
        k.set(x, y, z, shade);
    });
  if (id === "flannel")
    k.forEach((x, y, z) => {
      if (x === 0 || x === 5 || z === 0 || z === 5) {
        const c = checkColor(top!.t, x + z, y + 1);
        if (c !== top!.t.main) k.set(x, y, z, c);
      }
    });
  if (id === "sweater_teal") {
    // A darned elbow in a contrasting yarn.
    k.box(2, 1, 0, 3, 2, 0, top!.t.accent).set(2, 1, 0, top!.t.shade);
  }
}

/**
 * Forearm without the hand (right; mirrored for the left): sleeve, cuff,
 * the top's sleeve (or skin) at the wrist, the elbow plug. Returns the
 * wrist hides under gloves or carries the watch (jade-gear / jade-accessories).
 */
export function forearmClothes(k: Canvas, ctx: LookCtx): void {
  const { s, outer } = sleeveOf(ctx);
  const top = ctx.top;
  const bare = !s || (!outer && top !== null && (TEES.has(top.id) || top.id === "overall_top"));
  const rolled = !outer && top?.id === "flannel";
  const oid = outer ? (ctx.outer?.id ?? "") : "";
  if (bare || rolled) {
    // Bare forearm (short sleeves, tank top, rolled flannel).
    k.box(0, 6, 0, 5, 9, 5, SKIN);
    roundEdges(k, 0, 5, 0, 5, 6, 9);
    k.box(1, 4, 1, 4, 5, 4, SKIN);
    for (const [x, y, z] of [
      [0, 8, 2],
      [2, 9, 5],
      [4, 7, 0],
    ] as const)
      tint(k, x, y, z, SKIN_SHADE);
    k.set(1, 5, 4, SKIN_SHADE);
    k.box(2, 10, 2, 3, 11, 3, SKIN);
    if (rolled && top) {
      // Rolled cuffs, two turns of check.
      k.box(0, 8, 0, 5, 9, 5, top.t.main);
      roundEdges(k, 0, 5, 0, 5, 8, 9);
      k.free(() => {
        for (let x = -1; x <= 6; x++)
          for (let z = -1; z <= 6; z++) {
            const edge = x === -1 || x === 6 || z === -1 || z === 6;
            const corner = (x === -1 || x === 6) && (z === -1 || z === 6);
            if (edge && !corner) k.set(x, 8, z, (x + z) % 3 ? top.t.shade : top.t.accent);
          }
      });
      k.box(2, 10, 2, 3, 11, 3, top.t.main);
    }
    return;
  }
  const sleeve = s.sleeve;
  k.box(0, 6, 0, 5, 9, 5, sleeve);
  roundEdges(k, 0, 5, 0, 5, 6, 9);
  k.box(0, 6, 0, 5, 6, 5, s.cuff);
  roundEdges(k, 0, 5, 0, 5, 6, 6);
  for (const [x, y, z] of [
    [0, 8, 2],
    [2, 9, 5],
    [0, 7, 3],
    [4, 8, 0],
  ] as const)
    tint(k, x, y, z, s.shade);
  // The wrist: the top's sleeve under a jacket, a rib cuff without one, or skin.
  const long = top && (LONG_TOPS.has(top.id) || top.id === "flannel");
  const wrist = outer ? (long ? top!.t.main : SKIN) : top!.t.main;
  const wristShade = outer ? (long ? top!.t.shade : SKIN_SHADE) : top!.t.shade;
  k.box(1, 4, 1, 4, 5, 4, wrist);
  k.set(1, 5, 4, wristShade).set(4, 4, 1, wristShade).set(1, 4, 2, wristShade);
  k.box(2, 10, 2, 3, 11, 3, sleeve);
  if (oid === "bomber" || oid === "cardigan" || (!outer && top && HOODIES.has(top.id))) {
    // Rib cuffs.
    for (let x = 0; x <= 5; x++)
      for (let z = 0; z <= 5; z++) if ((x + z) % 2) tint(k, x, 6, z, s.sleeve);
    if (oid === "bomber") for (let x = 0; x <= 5; x++) tint(k, x, 7, 0, s.shade);
  }
  if (oid === "raincoat") {
    tint(k, 0, 8, 4, lighter(sleeve));
    tint(k, 0, 9, 3, lighter(sleeve));
  }
  if (oid === "labcoat_patched") tint(k, 5, 8, 2, ctx.outer!.t.accent);
}

// ── Legs ────────────────────────────────────────────────────────

/** Thigh (right; mirrored for the left). */
export function thighClothes(k: Canvas, ctx: LookCtx): void {
  const lt = T(ctx.legs, NO_TOP);
  const id = ctx.legs?.id ?? "";
  const { main: pants, shade: fold, accent: gap } = lt;
  if (id === "skirt_plaid" || id === "shorts_tights") {
    const tights = id === "skirt_plaid" ? C.paint_black : lt.accent;
    k.box(0, 0, 0, 5, 11, 5, tights);
    roundEdges(k, 0, 5, 0, 5, 0, 11);
    tint(k, 2, 1, 5, C.paint_black_lt);
    tint(k, 3, 2, 5, C.paint_black_lt);
    k.box(2, 12, 2, 3, 13, 3, tights);
    if (id === "shorts_tights") {
      // Corduroy shorts to mid-thigh with a turned-up hem.
      k.box(0, 5, 0, 5, 11, 5, pants);
      roundEdges(k, 0, 5, 0, 5, 5, 11);
      k.forEach((x, y, z) => {
        if (y >= 5 && (z === 5 || z === 0) && x % 2) k.set(x, y, z, fold);
        if (y >= 5 && (x === 0 || x === 5) && z % 2) k.set(x, y, z, fold);
      });
      k.free(() => {
        for (let x = -1; x <= 6; x++)
          for (let z = -1; z <= 6; z++) {
            const edge = x === -1 || x === 6 || z === -1 || z === 6;
            const corner = (x === -1 || x === 6) && (z === -1 || z === 6);
            if (edge && !corner) k.set(x, 5, z, fold);
          }
      });
      k.box(2, 12, 2, 3, 13, 3, pants);
    }
    return;
  }
  k.box(0, 0, 0, 5, 11, 5, pants);
  roundEdges(k, 0, 5, 0, 5, 0, 11);
  // Creases: a knee fold, a diagonal pull from the hip, a back seam.
  for (const [x, y] of [
    [1, 2],
    [2, 3],
    [3, 7],
    [2, 8],
    [1, 9],
  ] as const)
    tint(k, x, y, 5, fold);
  for (let y = 0; y <= 11; y += 1) tint(k, 3, y, 0, y % 3 ? pants : fold);
  for (let y = 0; y <= 11; y++) tint(k, 5, y, 4, gap);
  // Side seam.
  for (let y = 0; y <= 11; y += 2) tint(k, 0, y, 2, fold);
  k.box(2, 12, 2, 3, 13, 3, pants);
  if (id === "jeans") {
    for (let y = 0; y <= 11; y += 2) tint(k, 0, y, 2, lt.accent);
    for (const [x, y] of [
      [2, 1],
      [3, 1],
      [2, 0],
      [3, 2],
      [1, 1],
    ] as const)
      tint(k, x, y, 5, lighter(pants));
  } else if (id === "workpants_hivis") {
    k.forEach((x, y, z) => {
      if (y >= 3 && y <= 4) k.set(x, y, z, lt.accent);
    });
    // Knee pad pocket.
    k.box(1, 0, 5, 4, 2, 5, fold);
  } else if (id === "joggers") {
    for (let y = 0; y <= 11; y++) {
      tint(k, 0, y, 2, lt.accent);
      tint(k, 0, y, 3, lt.accent);
    }
  }
}

interface ShoeFit {
  /** First trouser row above the shoe. */
  top: number;
  /** Trousers break over the shoe's tongue. */
  brk: boolean;
}

/** Shin + shoe (right; mirrored for the left). */
export function shinClothes(k: Canvas, ctx: LookCtx): void {
  const fit = shoe(k, ctx.feet);
  legsOnShin(k, ctx, fit);
}

function shoe(k: Canvas, feet: Worn | null): ShoeFit {
  if (!feet) {
    // Bare foot (only for icons: every look wears shoes).
    k.box(1, 0, 2, 4, 1, 8, SKIN).box(1, 2, 2, 4, 3, 5, SKIN);
    for (let x = 1; x <= 4; x++) k.set(x, 0, 8, SKIN_SHADE);
    return { top: 4, brk: false };
  }
  const t = feet?.t ?? { main: C.paint_white, shade: C.paint_white_dk, accent: C.paint_white };
  const { main, shade, accent } = t;
  switch (feet?.id ?? "") {
    case "sneakers": {
      k.box(0, 0, 1, 5, 0, 9, C.paint_white);
      k.box(0, 1, 1, 5, 1, 9, accent);
      k.box(0, 2, 1, 5, 3, 8, main);
      k.box(1, 1, 9, 4, 2, 9, C.paint_white).box(0, 1, 8, 5, 2, 8, C.paint_white);
      roundEdges(k, 0, 5, 1, 9, 0, 2);
      k.set(0, 1, 9, 0).set(5, 1, 9, 0);
      k.box(0, 3, 1, 5, 3, 3, shade);
      roundEdges(k, 0, 5, 1, 8, 2, 3);
      for (let z = 4; z <= 7; z++) k.set(2, 3, z, z % 2 ? C.paint_white : shade);
      for (let z = 4; z <= 7; z++) k.set(3, 3, z, z % 2 ? shade : C.paint_white);
      k.set(1, 3, 6, shade).set(4, 3, 6, shade).set(1, 3, 4, shade).set(4, 3, 4, shade);
      k.box(2, 4, 6, 3, 4, 7, main);
      k.box(2, 2, 0, 3, 3, 0, accent === main ? shade : accent);
      tint(k, 0, 2, 5, shade);
      tint(k, 5, 2, 5, shade);
      return { top: 4, brk: false };
    }
    case "rubber_boots": {
      const gloss = lighter(main);
      k.box(0, 0, 1, 5, 0, 9, shade);
      for (let z = 2; z <= 8; z += 2) k.set(0, 0, z, accent).set(5, 0, z, accent);
      k.box(0, 1, 1, 5, 3, 8, main).box(1, 1, 9, 4, 2, 9, main);
      roundEdges(k, 0, 5, 1, 9, 1, 3);
      k.box(0, 4, 1, 5, 9, 7, main);
      roundEdges(k, 0, 5, 1, 7, 4, 9);
      k.forEach((x, y, z) => {
        if (y === 9 && (x === 0 || x === 5 || z === 1 || z === 7)) k.set(x, y, z, shade);
      });
      for (let y = 4; y <= 8; y++) tint(k, 1, y, 7, gloss);
      k.set(1, 2, 9, gloss).set(2, 2, 9, gloss);
      for (let y = 5; y <= 8; y++) tint(k, 4, y, 1, gloss);
      k.free(() => k.box(2, 8, 0, 3, 9, 0, accent));
      return { top: 10, brk: false };
    }
    case "mag_boots": {
      k.box(0, 0, 1, 5, 1, 9, shade);
      for (let z = 2; z <= 8; z += 2) k.set(0, 1, z, C.copper).set(5, 1, z, C.copper);
      k.set(0, 0, 3, accent).set(0, 0, 7, accent).set(5, 0, 3, accent).set(5, 0, 7, accent);
      k.box(2, 0, 9, 3, 0, 9, accent);
      k.box(0, 2, 1, 5, 3, 8, main).box(1, 2, 9, 4, 3, 9, shade);
      roundEdges(k, 0, 5, 1, 9, 2, 3);
      k.box(0, 4, 1, 5, 5, 7, main);
      roundEdges(k, 0, 5, 1, 7, 4, 5);
      k.forEach((x, y, z) => {
        if (y === 4 && (x === 0 || x === 5 || z === 1 || z === 7)) k.set(x, y, z, C.copper);
      });
      k.box(0, 5, 7, 5, 5, 7, shade).set(2, 5, 8, C.chrome).set(3, 3, 9, accent);
      k.set(1, 3, 8, C.chrome).set(4, 3, 8, C.chrome);
      return { top: 6, brk: true };
    }
    case "slippers": {
      k.box(0, 0, 0, 5, 3, 9, main);
      roundEdges(k, 0, 5, 0, 9, 0, 3);
      k.box(0, 3, 8, 5, 3, 9, 0).set(0, 3, 7, 0).set(5, 3, 7, 0);
      k.box(0, 0, 0, 5, 0, 9, shade);
      k.set(0, 0, 0, 0).set(5, 0, 0, 0).set(0, 0, 9, 0).set(5, 0, 9, 0);
      // Face on the toe: eyes, a pink nose, whisker dots.
      k.set(1, 2, 9, C.paint_black).set(4, 2, 9, C.paint_black);
      k.box(2, 1, 9, 3, 1, 9, accent);
      k.set(1, 1, 9, shade).set(4, 1, 9, shade);
      // Ears (the right one chewed on the grey pair).
      const chewed = main === C.fabric_gray;
      k.box(1, 3, 8, 1, chewed ? 5 : 7, 8, main).box(1, 4, 9, 1, chewed ? 4 : 6, 9, accent);
      k.box(4, 3, 8, 4, 7, 8, main).box(4, 4, 9, 4, 6, 9, accent);
      k.set(1, 3, 7, main).set(4, 3, 7, main);
      // A fluffy cuff round the ankle.
      k.box(0, 3, 1, 5, 3, 6, main);
      roundEdges(k, 0, 5, 1, 6, 3, 3);
      return { top: 4, brk: false };
    }
    case "clogs": {
      k.box(0, 0, 1, 5, 1, 9, accent);
      for (let z = 1; z <= 9; z++) k.set(0, 1, z, C.wood_dark).set(5, 1, z, C.wood_dark);
      k.set(0, 0, 1, 0).set(5, 0, 1, 0).set(0, 0, 9, 0).set(5, 0, 9, 0);
      k.box(0, 2, 4, 5, 3, 8, main).box(1, 2, 9, 4, 2, 9, main);
      roundEdges(k, 0, 5, 4, 9, 2, 3);
      k.box(1, 2, 1, 4, 3, 3, C.paint_cream);
      k.set(2, 3, 6, shade).set(3, 3, 7, shade).set(2, 3, 8, shade);
      k.box(0, 3, 4, 5, 3, 4, shade);
      return { top: 4, brk: false };
    }
    case "roller_boots": {
      for (const zc of [1, 7])
        for (const xc of [0, 4]) {
          k.box(xc, 0, zc, xc + 1, 1, zc + 1, accent);
          k.set(xc === 0 ? 1 : 4, 1, zc, C.steel);
        }
      k.box(0, 2, 1, 5, 2, 8, C.steel);
      k.box(2, 1, 9, 3, 2, 9, C.rubber);
      k.box(0, 3, 1, 5, 4, 8, main).box(0, 5, 1, 5, 7, 7, main);
      roundEdges(k, 0, 5, 1, 8, 3, 4);
      roundEdges(k, 0, 5, 1, 7, 5, 7);
      for (let y = 4; y <= 7; y++)
        k.set(2, y, y === 4 ? 8 : 7, shade).set(3, y, y === 4 ? 8 : 7, accent);
      k.forEach((x, y, z) => {
        if (y === 7 && (x === 0 || x === 5 || z === 1)) k.set(x, y, z, shade);
      });
      k.box(2, 3, 0, 3, 6, 0, accent);
      return { top: 8, brk: true };
    }
    default: {
      // Work boots: a welted sole with a heel, a rounded toe cap, laces up the front.
      k.box(0, 0, 1, 5, 0, 9, C.rubber);
      k.box(1, 0, 4, 4, 0, 5, 0);
      k.box(0, 1, 1, 5, 1, 9, shade);
      k.box(0, 2, 1, 5, 3, 8, main);
      k.box(1, 2, 9, 4, 2, 9, main);
      k.box(0, 4, 1, 5, 5, 7, main);
      roundEdges(k, 0, 5, 1, 9, 2, 3);
      k.set(0, 2, 8, 0).set(5, 2, 8, 0);
      // Laces up the front, a heel counter and a pull tab.
      for (let y = 3; y <= 5; y++)
        k.set(2, y, 7 + (y === 3 ? 1 : 0), accent).set(3, y, 7 + (y === 3 ? 1 : 0), accent);
      k.set(1, 4, 7, shade).set(4, 4, 7, shade).set(1, 3, 8, shade).set(4, 3, 8, shade);
      k.box(1, 2, 1, 4, 3, 1, shade);
      k.box(2, 5, 0, 3, 6, 0, shade);
      return { top: 6, brk: true };
    }
  }
}

function legsOnShin(k: Canvas, ctx: LookCtx, fit: ShoeFit): void {
  const lt = T(ctx.legs, NO_TOP);
  const id = ctx.legs?.id ?? "";
  const { main: pants, shade: fold, accent: gap } = lt;
  const p0 = fit.top;
  if (id === "skirt_plaid" || id === "shorts_tights") {
    const tights = id === "skirt_plaid" ? C.paint_black : lt.accent;
    if (p0 <= 7) k.box(1, p0, 3, 4, 7, 6, tights);
    k.box(0, Math.max(8, p0), 2, 5, 11, 7, tights);
    roundEdges(k, 0, 5, 2, 7, Math.max(8, p0), 11);
    tint(k, 2, 11, 7, C.paint_black_lt);
    tint(k, 3, 10, 7, C.paint_black_lt);
    k.box(2, 12, 4, 3, 13, 5, tights);
    return;
  }
  if (id === "joggers" && p0 <= 9) {
    // Cuffed ankles: a tighter rib under the loose leg.
    k.box(1, p0, 3, 4, p0 + 1, 6, fold);
    for (let x = 1; x <= 4; x++) if (x % 2) tint(k, x, p0, 6, pants);
    k.box(0, p0 + 2, 2, 5, 11, 7, pants);
    roundEdges(k, 0, 5, 2, 7, p0 + 2, 11);
    k.box(1, p0 + 2, 1, 4, p0 + 2, 8, pants);
    for (let y = p0 + 2; y <= 11; y++) {
      tint(k, 0, y, 4, gap);
      tint(k, 0, y, 5, gap);
    }
    tint(k, 2, 9, 7, fold);
    tint(k, 1, 10, 7, fold);
    k.box(2, 12, 4, 3, 13, 5, pants);
    return;
  }
  // Trousers with a break over the shoe and creases.
  k.box(0, p0, 2, 5, 11, 7, pants);
  roundEdges(k, 0, 5, 2, 7, p0, 11);
  if (fit.brk) {
    k.box(1, p0, 8, 4, p0, 8, pants);
    k.box(1, p0 - 1, 7, 4, p0 - 1, 7, pants);
  }
  tint(k, 2, 9, 7, fold);
  tint(k, 3, 8, 7, fold);
  tint(k, 1, 7, 7, fold);
  tint(k, 0, 10, 4, fold);
  tint(k, 0, 8, 5, fold);
  if (id !== "joggers") for (let y = p0; y <= 11; y++) tint(k, 5, y, 6, gap);
  k.box(2, 12, 4, 3, 13, 5, pants);
  if (id === "jeans") {
    for (let y = p0; y <= 11; y += 2) tint(k, 0, y, 5, lt.accent);
    tint(k, 2, 11, 7, lighter(pants));
    tint(k, 3, 11, 7, lighter(pants));
    tint(k, 2, 10, 7, lighter(pants));
    if (!fit.brk) k.forEach((x, y, z) => y === p0 && k.set(x, y, z, fold));
  } else if (id === "workpants_hivis") {
    k.forEach((x, y, z) => {
      if (y >= 8 && y <= 9) k.set(x, y, z, lt.accent);
    });
  } else if (id === "joggers") {
    for (let y = p0; y <= 11; y++) {
      tint(k, 0, y, 4, gap);
      tint(k, 0, y, 5, gap);
    }
  }
}

// ── Coat skirt ──────────────────────────────────────────────────

/**
 * The skirt below the hips: coat tails, the cardigan to the knees, the
 * slicker, the apron's lower panel, the plaid skirt. False when nothing
 * hangs there (the part is then a hidden placeholder).
 */
export function coatTailClothes(k: Canvas, ctx: LookCtx): boolean {
  let any = false;
  const legs = ctx.legs;
  const o = ctx.outer;
  if (legs?.id === "skirt_plaid") {
    skirt(k, legs.t, outerHasTail(ctx) && o?.id !== "welding_apron");
    any = true;
  }
  if (!o) return any;
  if (o.id === "labcoat" || o.id === "labcoat_patched") {
    labTail(k, o);
    return true;
  }
  if (o.id === "cardigan") {
    cardiganTail(k, o);
    return true;
  }
  if (o.id === "raincoat") {
    rainTail(k, o);
    return true;
  }
  if (o.id === "welding_apron") {
    apronTail(k, o);
    return true;
  }
  return any;
}

function labTail(k: Canvas, o: Worn): void {
  const { main, shade, accent } = o.t;
  // Flare: the hem (rows 0..1) is one voxel wider than the top.
  k.box(2, 2, 2, 17, 7, 3, main);
  k.box(2, 2, 2, 3, 7, 11, main).box(16, 2, 2, 17, 7, 11, main);
  k.box(1, 0, 1, 18, 1, 2, main);
  k.box(1, 0, 1, 2, 1, 12, main).box(17, 0, 1, 18, 1, 12, main);
  k.box(3, 0, 12, 3, 1, 12, main).box(16, 0, 12, 16, 1, 12, main);
  // Hip pockets with flaps on the sides, the back vent, fold shading on the hem.
  k.box(1, 4, 6, 1, 6, 9, shade).box(1, 6, 5, 1, 6, 10, main);
  k.box(18, 4, 6, 18, 6, 9, shade).box(18, 6, 5, 18, 6, 10, main);
  k.box(9, 0, 1, 10, 4, 1, 0);
  k.box(9, 2, 2, 10, 4, 2, shade);
  for (const z of [4, 8]) {
    tint(k, 1, 0, z, shade);
    tint(k, 18, 0, z, shade);
  }
  for (const x of [5, 13]) tint(k, x, 0, 1, shade);
  // Hem wear: scuffed grime at the back, a torn corner, a scorch by the vent.
  k.set(4, 0, 1, C.grime).set(6, 0, 1, C.dust).set(14, 0, 1, C.grime).set(1, 0, 10, C.grime);
  k.set(12, 0, 1, C.dust);
  k.box(18, 0, 1, 18, 0, 2, 0);
  k.set(12, 2, 2, C.grime).set(11, 3, 2, C.grime);
  // Screwdriver in the right hip pocket, handle sticking out.
  k.box(1, 6, 7, 1, 7, 7, C.steel).box(0, 6, 7, 0, 7, 7, C.safety_yellow);
  k.set(0, 7, 7, C.paint_black);
  // Blue nitrile glove poking out of the left hip pocket.
  k.box(18, 6, 8, 19, 7, 8, C.paint_sky).set(19, 5, 8, C.safety_blue).set(19, 6, 9, C.paint_sky);
  if (o.id === "labcoat_patched") {
    patch(k, 4, 3, 2, 4, 4, "z", o.t);
    patch(k, 17, 2, 8, 3, 3, "x", o.t);
    k.set(15, 1, 1, accent).set(7, 0, 1, C.grime);
  }
}

/** A coat skirt from row `bottom` (below 0 = longer) to the hips, with a flared hem. */
function longSkirt(k: Canvas, main: number, shade: number, bottom: number, closed: boolean): void {
  k.free(() => {
    for (let y = bottom; y <= 7; y++) {
      const flare = y <= bottom + 1 ? 1 : y <= bottom + 5 ? 0.5 : 0;
      const e = Math.floor(flare);
      k.box(2 - e, y, 2 - e, 17 + e, y, 3 - e, main);
      k.box(2 - e, y, 2 - e, 3 - e, y, 11 + e, main).box(16 + e, y, 2 - e, 17 + e, y, 11 + e, main);
      if (closed) k.box(4 - e, y, 11 + e, 15 + e, y, 11 + e, main);
      else k.set(4 - e, y, 11 + e, main).set(15 + e, y, 11 + e, main);
    }
    for (let y = bottom; y <= 7; y++) k.set(9, y, 1, shade);
  });
}

function cardiganTail(k: Canvas, o: Worn): void {
  const { main, shade, accent } = o.t;
  const bottom = -6;
  longSkirt(k, main, shade, bottom, false);
  k.free(() => {
    // Knit texture, a rib hem, deep patch pockets, buttons down the band.
    k.forEach((x, y, z) => {
      if ((x + y * 3 + z * 2) % 7 === 0) k.set(x, y, z, shade);
      if (y === bottom) k.set(x, y, z, (x + z) % 2 ? shade : main);
    });
    for (const x0 of [1, 17])
      for (let y = -3; y <= 2; y++)
        for (let z = 5; z <= 9; z++) {
          const edge = y === 2 || z === 5 || z === 9;
          k.set(x0 === 1 ? 0 : 19, y, z, edge ? shade : main);
        }
    for (const y of [5, 1, -3]) k.set(4, y, 12, accent).set(15, y, 12, accent);
  });
}

function rainTail(k: Canvas, o: Worn): void {
  const { main, shade, accent } = o.t;
  const gloss = lighter(main);
  longSkirt(k, main, shade, 0, true);
  for (let y = 0; y <= 7; y++) k.set(9, y, 11, shade);
  for (const y of [1, 4, 7]) k.set(10, y, 12, accent);
  k.set(10, 7, 12, accent);
  for (let y = 1; y <= 6; y += 2) {
    tint(k, 2, y, 6, gloss);
    tint(k, 5, y + 1, 11, gloss);
  }
  k.box(1, 4, 5, 1, 4, 9, shade).box(18, 4, 5, 18, 4, 9, shade);
  k.box(1, 0, 1, 18, 0, 12, 0);
  k.forEach((x, y, z) => {
    if (y === 1 && (x <= 2 || x >= 17 || z <= 2 || z >= 11)) k.set(x, y, z, shade);
  });
}

function apronTail(k: Canvas, o: Worn): void {
  const { main, shade } = o.t;
  k.free(() => {
    for (let y = -4; y <= 7; y++) {
      const [a, b] = y <= -1 ? [4, 15] : [5, 14];
      k.box(a, y, 12, b, y, 12, main);
      k.set(a, y, 12, shade).set(b, y, 12, shade);
    }
    k.box(4, -4, 12, 15, -4, 12, shade);
    for (const [x, y] of [
      [7, 2],
      [12, -1],
      [8, -3],
      [11, 5],
    ] as const)
      k.set(x, y, 12, C.grime);
    k.set(9, 0, 12, C.iron_rust).set(10, 0, 12, C.grime);
  });
}

function skirt(k: Canvas, t: Tone, underCoat: boolean): void {
  k.free(() => {
    // A pleated tube from the waist to mid-thigh, flaring out.
    for (let y = 0; y <= 7; y++) {
      const e = underCoat ? 0 : y <= 1 ? 2 : y <= 4 ? 1 : 0;
      const x0 = 3 - e;
      const x1 = 16 + e;
      const z0 = 3 - e;
      const z1 = 11 + e;
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const edge = x === x0 || x === x1 || z === z0 || z === z1;
          if (!edge) continue;
          const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
          if (corner && y > 1) continue;
          const u = x === x0 || x === x1 ? z + (x === x1 ? 20 : 0) : x;
          const pleat = u % 3 === 0 && y <= 5;
          k.set(x, y, z, pleat ? t.shade : tartan(t, u, y));
        }
    }
    // A big safety pin on the front hem.
    k.set(14, 1, 12 + (underCoat ? -1 : 1), C.chrome).set(
      14,
      2,
      12 + (underCoat ? -1 : 1),
      C.steel,
    );
  });
}
