import { describe, expect, it } from "vitest";
import { C } from "@/lib/world/content/palette";
import { fitPoint, type Fit, type V3 } from "@/lib/world/models/jade-kit";
import { ARM_FIT, HEAD_FIT, TORSO_FIT } from "@/lib/world/models/jade-rig";
import {
  RIG_PART_NAMES,
  jadeRig,
  posedVoxels,
  rigBounds,
  type RigPartName,
} from "@/lib/world/models/rig";

const jade = jadeRig();
const partOf = (n: RigPartName) => jade.parts.find((p) => p.name === n)!;
const part = (n: RigPartName) => partOf(n).model.grid;

/**
 * Colour of a voxel given in the *painted* frame of a part (jade-wear /
 * jade-hair coordinates, before the tall-and-slim fit), read from the
 * built model: fitted, then moved by the part's growth shift.
 */
function painted(n: RigPartName, fit: Fit, origin: V3, p: V3): number {
  const pt = partOf(n);
  const o = fitPoint(fit, origin);
  const shift = [pt.origin[0] - o[0], pt.origin[1] - o[1], pt.origin[2] - o[2]];
  const [x, y, z] = fitPoint(fit, p);
  return pt.model.grid.get(x + shift[0]!, y + shift[1]!, z + shift[2]!);
}
const torso = (x: number, y: number, z: number) =>
  painted("torso", TORSO_FIT, [8, 0, 5], [x, y, z]);
const head = (x: number, y: number, z: number) => painted("head", HEAD_FIT, [7, 0, 7], [x, y, z]);

const HAIR = new Set<number>([C.hair_copper, C.hair_copper_dk, C.hair_copper_lt]);

describe("jade lawrence model details", () => {
  it("keeps the rig part set and the voxel budget", () => {
    expect(jade.parts.map((p) => p.name).sort()).toEqual([...RIG_PART_NAMES].sort());
    // Fine scale (2× per axis): ~5× the old budget of 1800 voxels / 420 per part.
    expect(posedVoxels(jade).length).toBeLessThan(10000);
    for (const p of jade.parts) expect(p.model.grid.count(), p.name).toBeLessThanOrEqual(2600);
  });

  it("is tall and slim: taller than before, narrower than before, still under Damien", () => {
    const [min, max] = rigBounds(jade);
    const h = max[1] - min[1];
    // The 2025 Jade was 5.58 units tall and 2.52 wide (arms included).
    expect(h).toBeGreaterThan(5.6);
    expect(h).toBeLessThan(5.75);
    expect(max[0] - min[0]).toBeLessThan(2.4);
    // Torso 14 and hips 12 voxels wide (from 16), the arms 5 (from 6).
    expect(part("hips").sx).toBe(12);
    expect(part("torso").sx).toBeLessThanOrEqual(14);
    expect(part("upperArmR").sx).toBe(5);
  });

  it("wears the LAWRENCE badge on the lab coat: clip, header, photo, name lines", () => {
    expect(torso(0, 8, 10)).toBe(C.badge_blue);
    expect(torso(0, 5, 10)).toBe(C.skin_pale);
    expect(torso(2, 10, 10)).toBe(C.steel);
    for (const x of [0, 2, 3]) expect(torso(x, 4, 10)).toBe(C.paint_black);
  });

  it("wears the stand-collar shirt: white, the collar lined with a grey-black shard pattern", () => {
    const g = part("torso");
    const collar: number[] = [];
    g.forEach((_x, y, _z, c) => {
      if (y >= fitPoint(TORSO_FIT, [0, 16, 0])[1]) collar.push(c);
    });
    expect(collar).toContain(C.white);
    expect(collar.some((c) => c === C.paint_black || c === C.paint_gray_dk)).toBe(true);
    expect(collar).toContain(C.paint_gray_lt);
  });

  it("has her face: pale skin, green eyes, silver lids with a black winged liner, a smile", () => {
    const colours = new Set<number>();
    part("head").forEach((_x, _y, z, c) => {
      if (z >= fitPoint(HEAD_FIT, [0, 0, 12])[2]) colours.add(c);
    });
    for (const c of [
      C.eye_white,
      C.eye_brown,
      C.hair_black,
      C.paint_black,
      C.lid_silver,
      C.lips,
      C.skin_pale,
    ])
      expect(colours.has(c), String(c)).toBe(true);
    // The wing: liner at the outer corner, one row above the lash line.
    expect(head(2, 11, 13)).toBe(C.paint_black);
    expect(head(3, 11, 13)).toBe(C.lid_silver);
    // The nose stands proud of the face plane; the smile turns up at the corners.
    expect(head(6, 6, 14)).toBe(C.skin_pale);
    expect(head(4, 4, 13)).toBe(C.lips);
    expect(head(4, 3, 13)).not.toBe(C.lips);
    // No goggles and no glasses on the first day.
    expect(colours.has(C.goggles)).toBe(false);
    expect(colours.has(C.glass)).toBe(false);
  });

  it("wears the copper updo: a pompadour above the skull, waves at the temples", () => {
    const g = part("head");
    let top = 0;
    let crown = 0;
    g.forEach((_x, y, _z, c) => {
      if (!HAIR.has(c)) return;
      top = Math.max(top, y);
      if (y >= 17) crown++;
    });
    expect(top).toBe(18);
    expect(crown).toBeGreaterThan(30);
    expect(HAIR.has(head(1, 5, 10) || head(1, 4, 11))).toBe(true);
    // Nothing hangs from the hairBack joint (a placeholder voxel only).
    expect(part("hairBack").count()).toBe(1);
  });

  it("has a worn coat hem, a torn corner and a screwdriver in the pocket", () => {
    const tail = part("coatTail");
    let grime = 0;
    tail.forEach((_x, y, _z, c) => {
      if (y === 0 && (c === C.grime || c === C.dust)) grime++;
    });
    expect(grime).toBeGreaterThanOrEqual(3);
    let yellow = 0;
    tail.forEach((_x, _y, _z, c) => {
      if (c === C.safety_yellow) yellow++;
    });
    expect(yellow).toBeGreaterThanOrEqual(1);
  });

  it("has hands with fingers and a thumb", () => {
    const fore = part("forearmR");
    // Four fingertips along z on the bottom row, the thumb on the inner (+x) side.
    let tips = 0;
    const [fx] = fitPoint(ARM_FIT, [2, 0, 0]);
    for (let z = 1; z <= 4; z++) if (fore.get(fx, 0, z)) tips++;
    expect(tips).toBe(4);
    expect(fore.get(fitPoint(ARM_FIT, [4, 0, 0])[0], 2, 4)).toBe(C.skin_pale);
  });
});
