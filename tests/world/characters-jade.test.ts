import { describe, expect, it } from "vitest";
import { C } from "@/lib/world/content/palette";
import { RIG_PART_NAMES, jadeRig, posedVoxels, type RigPartName } from "@/lib/world/models/rig";

const jade = jadeRig();
const part = (n: RigPartName) => jade.parts.find((p) => p.name === n)!.model.grid;

describe("jade lawrence model details", () => {
  it("keeps the rig part set and the voxel budget", () => {
    expect(jade.parts.map((p) => p.name).sort()).toEqual([...RIG_PART_NAMES].sort());
    // Fine scale (2× per axis): ~5× the old budget of 1800 voxels / 420 per part.
    expect(posedVoxels(jade).length).toBeLessThan(10000);
    for (const p of jade.parts) expect(p.model.grid.count(), p.name).toBeLessThanOrEqual(2600);
  });

  it("wears the LAWRENCE badge: clip, header, photo and two text lines on the chest", () => {
    const g = part("torso");
    expect(g.get(0, 8, 10)).toBe(C.badge_blue);
    expect(g.get(0, 5, 10)).toBe(C.skin);
    expect(g.get(1, 10, 10)).toBe(C.steel);
    const text = [g.get(0, 3, 10), g.get(1, 3, 10), g.get(2, 3, 10), g.get(3, 3, 10)];
    expect(text.filter((c) => c === C.paint_black).length).toBe(2);
    expect(text.filter((c) => c === C.paper).length).toBe(2);
    for (let x = 0; x <= 3; x++) expect(g.get(x, 4, 10)).toBe(C.paint_black);
  });

  it("has a real face: green eyes with pupils, lashes, a nose and lips", () => {
    const head = part("head");
    const colours = new Set<number>();
    head.forEach((_x, _y, z, c) => {
      if (z >= 12) colours.add(c);
    });
    for (const c of [C.eye_white, C.eye_green, C.hair_black, C.walnut_dk, C.lips])
      expect(colours.has(c), String(c)).toBe(true);
    // The nose stands proud of the face plane.
    expect(head.get(6, 6, 14)).toBe(C.skin);
    // Goggles pushed up on the forehead: amber (solid, non-glowing) lenses in a frame.
    expect(head.get(3, 15, 15)).toBe(C.fabric_mustard);
    expect(head.get(2, 15, 14)).toBe(C.goggles);
  });

  it("has loose hair strands, a worn coat hem and a screwdriver in the pocket", () => {
    const head = part("head");
    expect(head.get(12, 5, 13)).toBe(C.wood_red);
    expect(head.get(6, 17, 14)).not.toBe(0);
    const tail = part("coatTail");
    let grime = 0;
    tail.forEach((_x, y, _z, c) => {
      if (y === 0 && (c === C.grime || c === C.dust)) grime++;
    });
    expect(grime).toBeGreaterThanOrEqual(3);
    expect(tail.get(18, 0, 1)).toBe(0); // torn corner
    expect(tail.get(0, 6, 7)).toBe(C.safety_yellow);
    expect(part("hairBack").get(5, 4, 2)).toBe(C.wood_red);
  });

  it("has hands with fingers and a thumb", () => {
    const fore = part("forearmR");
    // Four fingertips along z on the bottom row, the thumb on the inner (+x) side.
    let tips = 0;
    for (let z = 1; z <= 4; z++) if (fore.get(2, 0, z)) tips++;
    expect(tips).toBe(4);
    expect(fore.get(4, 2, 4)).toBe(C.skin);
  });
});
