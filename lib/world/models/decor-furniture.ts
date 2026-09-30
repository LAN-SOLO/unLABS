/**
 * Furniture at double detail (DETAIL_SCALE = 0.25 world units per voxel).
 * World sizes match the former half-scale pieces (every dimension doubled),
 * so rooms keep their proportions. Hosts declare `top` (see DecorDef).
 */
import { C } from "@/lib/world/content/palette";
import { fnv1a } from "@/lib/world/traits";
import { Model } from "@/lib/world/models/core";
import {
  DETAIL_SCALE,
  disc,
  fine,
  fridgeBack,
  L,
  legs,
  part,
  blob,
  plantPot,
  rich,
  screenWell,
  wisp,
  type DecorDef,
} from "@/lib/world/models/decor-kit";

/** Drawer front with a handle on the plane z. */
function drawer(m: Model, x0: number, y0: number, x1: number, y1: number, z: number, face: number) {
  m.box(x0, y0, z, x1, y1, z, face);
  const cx = Math.floor((x0 + x1) / 2);
  m.box(cx - 1, y1 - 1, z + 1, cx + 1, y1 - 1, z + 1, C.brass);
}

/** Five-star swivel base with casters around (cx, cz). */
function starBase(m: Model, cx: number, cz: number, r: number) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    for (let t = 1; t <= r; t++)
      m.set(Math.round(cx + Math.cos(a) * t), 1, Math.round(cz + Math.sin(a) * t), C.metal_dark);
    m.set(Math.round(cx + Math.cos(a) * r), 0, Math.round(cz + Math.sin(a) * r), C.rubber);
  }
}

/** Leaf cluster: a noisy sphere mixing three greens. */
function foliage(m: Model, cx: number, cy: number, cz: number, r: number, seed: string) {
  for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dd = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        if (dd > r * r + 0.3) continue;
        const h = fnv1a(`${seed}${x},${y},${z}`);
        if (dd > (r - 1) ** 2 && h % 4 === 0) continue; // ragged edge
        m.set(x, y, z, h % 5 === 0 ? C.leaf_light : h % 3 === 0 ? C.plant_green : C.leaf_dark);
      }
}

export const FURNITURE: DecorDef[] = [
  rich("office_desk", { solid: true, scale: DETAIL_SCALE, top: 12 }, () => {
    const m = new Model(28, 24, 16);
    m.box(0, 10, 0, 27, 11, 15, C.oak);
    m.box(0, 11, 15, 27, 11, 15, C.wood); // front lip
    m.box(0, 0, 1, 1, 9, 15, C.wood_dark); // side panel
    m.box(2, 6, 1, 17, 7, 1, C.wood_dark); // modesty panel
    m.box(18, 0, 1, 27, 9, 15, C.wood_dark); // pedestal
    for (const [y0, y1] of [
      [1, 3],
      [4, 6],
      [7, 9],
    ] as const)
      drawer(m, 19, y0, 26, y1, 15, C.wood);
    // Monitor on a stand.
    m.box(9, 12, 2, 16, 12, 5, C.metal_dark).box(12, 13, 2, 13, 15, 2, C.metal);
    m.box(6, 15, 1, 21, 23, 3, C.metal);
    m.box(6, 15, 0, 21, 23, 0, C.metal_dark);
    const scr = screenWell(m, 8, 17, 19, 22, 3, { content: "code", color: "#33FF33" });
    m.set(20, 16, 3, C.led_green);
    m.box(24, 12, 0, 25, 12, 1, C.cable_black).box(25, 0, 0, 25, 11, 0, C.cable_black);
    // Back: full-height modesty panel, cable tray under the top with a drop
    // to a floor strip, pedestal drawer backs, monitor vents and tag.
    m.box(2, 2, 1, 17, 7, 1, C.wood_dark);
    m.box(4, 8, 0, 16, 8, 1, C.steel_dark);
    m.box(5, 9, 1, 15, 9, 1, C.cable_black).box(6, 9, 0, 13, 9, 0, C.cable_red);
    m.box(16, 1, 0, 16, 7, 0, C.cable_black);
    m.box(9, 0, 0, 16, 0, 0, C.paint_white).set(11, 0, 0, C.led_red).set(14, 0, 0, C.black);
    for (const y of [3, 6]) m.box(19, y, 1, 26, y, 1, C.walnut);
    m.set(20, 8, 1, C.paper).set(21, 8, 1, C.paper);
    for (let y = 17; y <= 21; y += 2) m.box(8, y, 0, 19, y, 0, C.black);
    m.box(18, 16, 0, 20, 16, 0, C.paper);
    return { model: m, screens: [scr] };
  }),
  fine("swivel_chair", { solid: true }, () => {
    // Seat at knee height (5 × 0.25 = 1.25): star base, short gas column.
    const m = new Model(12, 14, 12);
    starBase(m, 5.5, 5.5, 5);
    m.box(5, 2, 5, 6, 2, 6, C.chrome);
    m.box(0, 3, 0, 11, 3, 11, C.fabric_blue);
    m.box(1, 4, 2, 10, 4, 10, C.fabric_blue);
    for (let x = 2; x <= 9; x += 3) m.box(x, 4, 3, x, 4, 9, C.paint_navy); // seams
    m.box(1, 4, 0, 10, 13, 2, C.fabric_blue);
    m.box(2, 13, 0, 9, 13, 2, C.leather_black);
    m.box(2, 6, 2, 9, 11, 2, C.paint_navy); // lumbar pad
    // Back: moulded shell, tag, height lever under the seat.
    m.box(2, 5, 0, 9, 12, 0, C.metal_dark);
    m.box(3, 6, 0, 8, 6, 0, C.steel_dark).set(5, 9, 0, C.paper);
    m.box(11, 2, 7, 11, 2, 9, C.metal_dark);
    for (const x of [0, 11]) {
      m.box(x, 4, 5, x, 6, 5, C.metal_dark);
      m.box(x, 7, 3, x, 7, 9, C.leather_black);
    }
    return m;
  }),
  fine("filing_cabinet", { solid: true, top: 20 }, () => {
    const m = new Model(10, 20, 10);
    m.box(0, 0, 0, 9, 19, 9, C.paint_gray);
    m.box(0, 0, 0, 9, 0, 9, C.metal_dark);
    for (const y of [1, 7, 13]) {
      m.box(1, y, 9, 8, y + 5, 9, C.steel);
      m.box(3, y + 4, 9, 6, y + 4, 9, C.chrome);
      m.box(4, y + 2, 9, 5, y + 2, 9, C.paper); // label holder
    }
    m.box(3, 14, 9, 6, 17, 9, C.steel_dark).box(2, 15, 9, 2, 17, 9, C.paper_yellow); // ajar
    m.box(0, 19, 0, 9, 19, 9, C.steel_dark);
    for (const y of [6, 12]) m.box(1, y, 0, 8, y, 0, C.steel_dark); // back seams
    m.box(6, 2, 0, 7, 3, 0, C.paper);
    return m;
  }),
  fine("sofa", { solid: true, top: 4 }, () => {
    // Cushions at knee height (4 × 0.25 = 1.0).
    const m = new Model(28, 10, 14);
    for (const [x, z] of [
      [1, 1],
      [26, 1],
      [1, 12],
      [26, 12],
    ] as const)
      m.set(x, 0, z, C.walnut);
    m.box(0, 1, 0, 27, 1, 13, C.fabric_red);
    for (let i = 0; i < 3; i++) {
      const x0 = 3 + i * 7;
      m.box(x0, 2, 4, x0 + 6, 3, 13, C.carpet_red);
      m.box(x0, 3, 4, x0, 3, 13, C.fabric_red); // seam
    }
    m.box(0, 2, 0, 27, 9, 3, C.fabric_red);
    m.box(3, 8, 2, 24, 9, 3, C.carpet_red);
    for (const x0 of [0, 25]) m.box(x0, 2, 0, x0 + 2, 5, 13, C.fabric_red);
    m.box(0, 6, 4, 2, 6, 13, C.walnut).box(25, 6, 4, 27, 6, 13, C.walnut);
    m.box(19, 4, 4, 23, 7, 6, C.fabric_mustard); // pillow
    m.set(21, 7, 6, C.fabric_mustard_shade).set(20, 5, 6, C.fabric_mustard_shade);
    // Tufted backrest: buttons in a diamond grid, piping along the arm tops.
    for (const y of [5, 7])
      for (let x = 4 + (y === 7 ? 2 : 0); x <= 23; x += 4) m.set(x, y, 3, C.fabric_red_shade);
    m.box(0, 5, 13, 2, 5, 13, C.fabric_red_shade).box(25, 5, 13, 27, 5, 13, C.fabric_red_shade);
    m.box(9, 3, 11, 11, 3, 12, C.fabric_red_shade); // a sat-in dent
    // Back: upholstery seams, a blanket thrown over the backrest.
    for (const x of [7, 14, 21]) m.box(x, 2, 0, x, 8, 0, C.carpet_red);
    m.box(4, 4, 0, 11, 9, 0, C.fabric_mustard).box(4, 9, 1, 11, 9, 3, C.fabric_mustard);
    for (let x = 4; x <= 11; x += 2) m.set(x, 4, 0, C.fabric_red);
    return m;
  }),
  fine("armchair", { solid: true }, () => {
    // Cushion at knee height (4 × 0.25 = 1.0).
    const m = new Model(14, 12, 14);
    for (const [x, z] of [
      [1, 1],
      [12, 1],
      [1, 12],
      [12, 12],
    ] as const)
      m.set(x, 0, z, C.walnut);
    m.box(0, 1, 0, 13, 2, 13, C.leather);
    m.box(3, 3, 3, 10, 3, 13, C.fabric_green);
    m.box(3, 3, 13, 10, 3, 13, C.fabric_green_shade); // cushion piping
    m.box(5, 3, 6, 8, 3, 9, C.fabric_green_shade); // sat-in dent
    m.box(0, 3, 0, 13, 11, 2, C.leather);
    m.box(1, 11, 0, 12, 11, 1, C.wood_dark);
    for (const x0 of [0, 11]) m.box(x0, 3, 0, x0 + 2, 6, 13, C.leather);
    m.set(1, 6, 13, C.leather_worn).set(12, 6, 13, C.leather_worn); // rubbed arm ends
    for (let y = 5; y <= 10; y += 3) for (let x = 3; x <= 10; x += 3) m.set(x, y, 3, C.brass);
    m.box(1, 3, 0, 12, 3, 0, C.wood_dark); // back rail
    for (const x of [4, 9]) m.box(x, 4, 0, x, 10, 0, C.leather_black); // back seams
    return m;
  }),
  fine("cot", { solid: true }, () => {
    const m = new Model(24, 8, 12);
    legs(m, 0, 0, 23, 11, 3, C.steel_dark);
    m.box(0, 4, 0, 23, 4, 11, C.steel_dark);
    m.box(1, 5, 1, 22, 5, 10, C.olive);
    m.box(1, 6, 2, 6, 7, 9, C.paint_white); // pillow
    m.box(2, 7, 4, 5, 7, 7, C.coat_shadow); // head dent
    m.box(10, 6, 0, 22, 6, 11, C.fabric_gray);
    for (let x = 10; x <= 22; x += 3) m.box(x, 6, 0, x, 6, 11, C.coat_shadow);
    m.box(10, 7, 3, 13, 7, 9, C.fabric_gray);
    return m;
  }),
  rich("plant_ficus", { solid: true, scale: DETAIL_SCALE }, () => {
    const m = new Model(14, 24, 14);
    plantPot(m, 6.5, 6.5, 5, 5);
    m.ring(6.5, 6.5, 5, 5, C.paint_brick);
    m.ring(6.5, 6.5, 5, 2, C.pot);
    for (let y = 6; y <= 13; y++) {
      const o = Math.round(Math.sin(y * 0.7));
      m.set(6 + o, y, 6, C.wood_dark).set(7 - o, y, 7, C.wood);
    }
    foliage(m, 6.5, 17.5, 6.5, 5.6, "fic");
    foliage(m, 4, 14, 9.5, 3, "fic2");
    // A few yellowing leaves and a water dish under the pot.
    for (const [x, y, z] of [
      [2, 16, 9],
      [11, 18, 5],
      [6, 22, 3],
    ] as const)
      if (m.grid.get(x, y, z)) m.set(x, y, z, C.leaf_yellow);
    m.set(8, 7, 9, C.leaf_light).set(4, 7, 4, C.leaf_yellow); // fallen leaves
    const crown = new Model(6, 6, 6);
    foliage(crown, 2.5, 2.5, 2.5, 2.8, "fic3");
    return {
      model: m,
      parts: [
        part("crown", crown, [10, 20.5, 4], "sway", {
          speed: 0.22,
          amplitude: 0.07,
          pivot: [3, 0, 3],
        }),
      ],
    };
  }),
  rich("plant_fern", { solid: true, scale: DETAIL_SCALE }, () => {
    const m = new Model(16, 16, 16);
    plantPot(m, 7.5, 7.5, 4.4, 4, C.ceramic);
    m.ring(7.5, 7.5, 4.4, 2, C.paint_teal);
    const frond = (o: Model, cx: number, cz: number, y0: number, a: number, len: number) => {
      for (let r = 0; r <= len; r++) {
        const x = Math.round(cx + Math.cos(a) * r);
        const z = Math.round(cz + Math.sin(a) * r);
        const y = y0 + Math.round(6 * Math.sin((r / 7) * 2.4));
        o.set(x, y, z, r % 2 ? C.leaf_light : C.plant_green);
        if (r > 2 && r % 2 === 0) o.set(x, y - 1, z, r === len ? C.leaf_yellow : C.leaf_dark);
      }
    };
    for (let i = 0; i < 11; i++) if (i % 4 !== 1) frond(m, 7.5, 7.5, 5, (i / 11) * Math.PI * 2, 7);
    m.box(7, 5, 7, 8, 9, 8, C.leaf_dark);
    // Three fronds on their own part: they breathe in the draught.
    const moving = new Model(16, 12, 16);
    for (const i of [1, 5, 9]) frond(moving, 7.5, 7.5, 0, (i / 11) * Math.PI * 2, 7);
    return {
      model: m,
      parts: [
        part("fronds", moving, [8, 5, 8], "sway", {
          speed: 0.3,
          amplitude: 0.05,
          axis: "x",
          pivot: [8, 0, 8],
        }),
      ],
    };
  }),
  fine("plant_cactus", { solid: true }, () => {
    const m = new Model(10, 22, 10);
    plantPot(m, 4.5, 4.5, 4, 4, C.paint_brick);
    m.cyl(4.5, 4.5, 2.2, 5, 18, C.plant_green);
    for (let y = 6; y <= 18; y += 2) m.set(4, y, 7, C.leaf_light).set(7, y + 1, 4, C.leaf_light);
    m.box(0, 9, 4, 1, 14, 5, C.leaf_dark).box(1, 9, 4, 2, 9, 5, C.leaf_dark);
    m.box(8, 12, 4, 9, 16, 5, C.leaf_dark).box(7, 12, 4, 8, 12, 5, C.leaf_dark);
    m.box(4, 19, 4, 5, 20, 5, C.flower_red).set(4, 21, 4, C.flower_yellow);
    return m;
  }),
  fine("floor_lamp", { solid: true, light: L([5, 20, 5], "#ffd9a0", 8, 8) }, () => {
    const m = new Model(10, 24, 10);
    m.cyl(4.5, 4.5, 3.4, 0, 0, C.brass).cyl(4.5, 4.5, 2, 1, 1, C.bronze);
    m.box(4, 2, 4, 5, 17, 5, C.brass);
    m.box(4, 10, 4, 5, 10, 5, C.bronze);
    m.cyl(4.5, 4.5, 4.4, 17, 23, C.paint_cream, true);
    m.grid.forEach((x, y, z, v) => {
      if (v === C.paint_cream && y >= 18 && (x + z) % 3 === 0) m.set(x, y, z, C.lampshade);
    });
    m.ring(4.5, 4.5, 4.4, 17, C.fabric_mustard).ring(4.5, 4.5, 4.4, 23, C.fabric_mustard);
    m.box(3, 18, 3, 6, 20, 6, C.lamp_warm);
    m.box(6, 8, 5, 6, 8, 5, C.chrome); // switch
    return m;
  }),
  fine("desk_lamp", { solid: true, top: 10, light: L([4.5, 14, 4], "#ffd9a0", 4, 5) }, () => {
    // Side table with a green banker's lamp.
    const m = new Model(12, 18, 10);
    m.box(0, 8, 0, 11, 9, 9, C.oak);
    legs(m, 1, 1, 10, 8, 7, C.wood_dark);
    m.box(1, 3, 1, 10, 3, 8, C.wood); // lower shelf
    m.box(2, 4, 2, 6, 5, 6, C.book_green).box(3, 6, 3, 6, 6, 6, C.book_red);
    m.box(2, 10, 2, 7, 10, 5, C.brass);
    m.box(4, 11, 3, 4, 14, 3, C.brass);
    m.box(1, 15, 2, 8, 16, 5, C.green_paint).box(2, 14, 3, 7, 14, 4, C.lamp_warm);
    m.box(1, 17, 3, 8, 17, 4, C.green_paint);
    m.set(7, 11, 4, C.brass).set(7, 12, 4, C.brass); // pull chain
    return m;
  }),
  rich("workstation_pc", { solid: true, scale: DETAIL_SCALE, top: 10 }, () => {
    const m = new Model(20, 22, 12);
    m.box(0, 8, 0, 19, 9, 11, C.metal);
    legs(m, 0, 0, 19, 11, 7, C.steel_dark);
    m.box(1, 2, 1, 14, 2, 10, C.metal_dark); // footrest shelf
    m.box(15, 0, 2, 19, 7, 10, C.beige); // tower
    m.box(16, 5, 10, 18, 5, 10, C.black).set(18, 2, 10, C.led_green).set(16, 2, 10, C.led_amber);
    for (const x0 of [0, 10]) m.box(x0, 10, 0, x0 + 9, 19, 2, C.metal_dark);
    const a = screenWell(m, 1, 12, 8, 18, 2, { content: "code", color: "#00FFFF" });
    const b = screenWell(m, 11, 12, 18, 18, 2, { content: "log", color: "#FFAA00" });
    m.box(4, 10, 3, 5, 10, 3, C.metal).box(14, 10, 3, 15, 10, 3, C.metal); // feet
    m.box(9, 20, 1, 10, 21, 1, C.led_red); // webcam
    // Backs: monitor vents and tags, tower fan and ports, a cable to the floor.
    for (const x0 of [0, 10]) {
      for (let y = 15; y <= 17; y += 2) m.box(x0 + 2, y, 0, x0 + 7, y, 0, C.black);
      m.box(x0 + 3, 11, 0, x0 + 5, 11, 0, C.paper);
    }
    m.box(16, 4, 2, 18, 6, 2, C.black).set(17, 5, 2, C.metal_light);
    m.box(16, 1, 2, 18, 1, 2, C.metal_dark).set(18, 2, 2, C.led_green);
    m.box(16, 0, 1, 16, 1, 1, C.cable_black);
    return { model: m, screens: [a, b] };
  }),
  fine("mug_table", { solid: true, top: 10 }, () => {
    // Small round side table — Damien leaves his cold coffee on it.
    const m = new Model(10, 12, 10);
    m.cyl(4.5, 4.5, 4.6, 8, 9, C.wood);
    m.ring(4.5, 4.5, 4.6, 9, C.wood_dark);
    m.cyl(4.5, 4.5, 4.6, 9, 9, C.wood);
    m.box(4, 1, 4, 5, 7, 5, C.wood_dark);
    m.box(1, 0, 4, 8, 0, 5, C.wood_dark).box(4, 0, 1, 5, 0, 8, C.wood_dark);
    return m;
  }),
  fine("stool", { solid: true }, () => {
    // Low lab stool: seat at knee height (5 × 0.25 = 1.25), a foot ring.
    const m = new Model(8, 5, 8);
    legs(m, 0, 0, 7, 7, 2, C.steel_dark);
    m.box(0, 1, 0, 7, 1, 0, C.steel).box(0, 1, 7, 7, 1, 7, C.steel);
    m.cyl(3.5, 3.5, 3.8, 3, 4, C.leather_black);
    m.ring(3.5, 3.5, 3.8, 3, C.metal_dark);
    return m;
  }),
  fine("microscope", { solid: true }, () => {
    const m = new Model(12, 22, 10);
    m.box(0, 8, 0, 11, 9, 9, C.paint_white);
    legs(m, 0, 0, 11, 9, 7, C.steel_dark);
    m.box(2, 10, 2, 8, 10, 7, C.paint_black); // base
    m.box(6, 11, 2, 7, 18, 3, C.paint_black); // arm
    m.box(3, 13, 3, 7, 13, 7, C.metal_dark).set(5, 13, 5, C.glass); // stage
    m.box(3, 13, 4, 4, 13, 6, C.paper); // slide
    m.box(4, 15, 4, 5, 18, 5, C.chrome); // objective turret
    m.box(4, 18, 3, 6, 19, 6, C.paint_black);
    m.box(4, 20, 2, 5, 21, 3, C.paint_black).set(4, 21, 2, C.black); // eyepiece
    m.box(8, 14, 2, 8, 15, 3, C.chrome); // focus knob
    m.box(9, 10, 6, 10, 10, 8, C.glass_green); // petri dish
    return m;
  }),
  fine("fridge", { solid: true }, () => {
    const m = new Model(14, 24, 12);
    m.box(0, 1, 0, 13, 23, 11, C.paint_cream);
    m.box(0, 0, 0, 13, 0, 11, C.paint_gray);
    m.box(0, 16, 11, 13, 16, 11, C.paint_gray); // freezer split
    m.box(11, 7, 11, 11, 14, 11, C.chrome).box(11, 18, 11, 11, 21, 11, C.chrome);
    // Magnets and a note: "D. F. — nicht öffnen, Experiment".
    m.box(2, 9, 11, 7, 14, 11, C.paper_yellow);
    for (let y = 10; y <= 13; y += 1) m.box(3, y, 11, 3 + ((y * 3) % 4), y, 11, C.blue_paint);
    m.set(4, 14, 11, C.red_paint).set(2, 19, 11, C.red_paint).set(6, 21, 11, C.wall_trim);
    m.set(4, 6, 11, C.green_paint).set(8, 18, 11, C.blue_paint);
    m.set(12, 23, 0, C.led_blue);
    m.box(0, 23, 0, 13, 23, 11, C.paint_white);
    fridgeBack(m);
    return m;
  }),
  rich(
    "kitchenette",
    { solid: true, scale: DETAIL_SCALE, top: 14, light: L([16, 17, 6], "#ffd9a0", 3, 5) },
    () => {
      const m = new Model(32, 24, 12);
      m.box(0, 1, 0, 31, 11, 11, C.paint_cream);
      m.box(0, 0, 1, 31, 0, 10, C.black); // kick plate
      for (let x = 0; x < 32; x += 8) {
        m.box(x, 1, 11, x, 11, 11, C.paint_gray);
        m.box(x + 5, 8, 11, x + 6, 8, 11, C.chrome);
      }
      m.box(0, 12, 0, 31, 13, 11, C.oak);
      // Sink well + faucet.
      m.box(18, 13, 3, 25, 13, 9, C.steel)
        .box(19, 13, 4, 24, 13, 8, 0)
        .box(19, 12, 4, 24, 12, 8, C.metal_dark);
      m.box(21, 14, 6, 22, 16, 6, C.chrome).box(21, 16, 6, 22, 16, 8, C.chrome);
      m.set(19, 14, 6, C.red_paint).set(24, 14, 6, C.blue_paint);
      // Kettle.
      m.cyl(4, 8, 2.2, 14, 18, C.steel).box(3, 19, 7, 5, 19, 9, C.metal_dark);
      m.box(7, 16, 8, 7, 17, 8, C.steel).set(4, 14, 10, C.led_red);
      // Wall cabinets + under-cabinet light.
      m.box(0, 17, 0, 31, 23, 5, C.paint_cream);
      for (let x = 0; x < 32; x += 8) {
        m.box(x, 17, 5, x, 23, 5, C.paint_gray);
        m.set(x + 6, 18, 5, C.chrome);
      }
      m.box(1, 17, 5, 30, 17, 5, C.lamp_warm);
      // Back: sink trap and water lines, the kettle's cord, cabinet screws.
      m.box(21, 1, 0, 22, 11, 0, C.steel).box(20, 3, 0, 23, 4, 0, C.chrome);
      m.box(19, 6, 0, 19, 11, 0, C.copper).set(19, 8, 0, C.red_paint);
      m.box(24, 6, 0, 24, 11, 0, C.copper).set(24, 8, 0, C.blue_paint);
      m.box(4, 1, 0, 4, 11, 0, C.cable_black);
      for (let x = 2; x < 32; x += 8) m.set(x, 21, 0, C.steel).set(x + 4, 19, 0, C.steel);
      return {
        model: m,
        parts: [
          part("kettle_steam", wisp(5, C.coat_white, 3), [7.5, 20.5, 8.5], "bob", {
            speed: 0.5,
            amplitude: 1.2,
          }),
        ],
      };
    },
  ),
  fine("sink", { solid: true }, () => {
    const m = new Model(16, 22, 10);
    m.box(0, 0, 0, 15, 10, 9, C.steel);
    m.box(1, 1, 9, 7, 9, 9, C.steel_dark).box(8, 1, 9, 14, 9, 9, C.steel_dark);
    m.set(6, 5, 9, C.chrome).set(9, 5, 9, C.chrome);
    m.box(0, 11, 0, 15, 11, 9, C.steel);
    m.box(2, 11, 2, 13, 11, 7, 0).box(2, 10, 2, 13, 10, 7, C.metal_dark);
    m.box(4, 10, 3, 11, 10, 6, C.water);
    m.box(7, 12, 0, 8, 19, 1, C.chrome).box(7, 19, 0, 8, 19, 4, C.chrome).set(7, 18, 4, C.chrome);
    m.box(3, 12, 0, 3, 13, 1, C.red_paint).box(12, 12, 0, 12, 13, 1, C.blue_paint);
    m.box(0, 12, 0, 15, 21, 0, C.tile_white);
    m.box(13, 14, 1, 14, 17, 1, C.safety_green); // soap
    m.box(7, 1, 0, 8, 10, 0, C.chrome).box(6, 3, 0, 9, 4, 0, C.steel); // drain + trap
    m.box(3, 5, 0, 3, 10, 0, C.copper).box(12, 5, 0, 12, 10, 0, C.copper);
    return m;
  }),
  fine("trash_bin", { solid: true }, () => {
    const m = new Model(8, 12, 8);
    m.cyl(3.5, 3.5, 3.6, 0, 9, C.paint_gray, true);
    m.cyl(3.5, 3.5, 2.6, 0, 0, C.metal_dark);
    m.ring(3.5, 3.5, 3.6, 9, C.steel);
    m.sphere(3, 10, 3, 1.6, C.paper).sphere(5, 10, 4.5, 1.4, C.paper_yellow);
    m.set(2, 11, 5, C.paper).set(6, 1, 7, C.paper); // one missed the bin
    return m;
  }),
  rich("water_cooler", { solid: true, scale: DETAIL_SCALE }, () => {
    const m = new Model(8, 24, 8);
    m.box(0, 0, 0, 7, 13, 7, C.paint_white);
    m.box(1, 8, 7, 6, 11, 7, C.paint_gray);
    m.set(2, 10, 7, C.blue_paint).set(5, 10, 7, C.red_paint);
    m.box(2, 7, 6, 5, 7, 7, C.metal_dark); // drip tray
    m.set(3, 7, 7, C.water);
    m.box(7, 4, 2, 7, 11, 3, C.paper); // cup dispenser
    m.box(2, 14, 2, 5, 14, 5, C.paint_gray);
    m.cyl(3.5, 3.5, 3, 15, 22, C.water);
    m.cyl(3.5, 3.5, 3, 18, 18, C.glass);
    m.box(3, 23, 3, 4, 23, 4, C.paper_blue);
    m.box(1, 16, 6, 2, 17, 6, C.paper); // "Wasser 04/2019" label
    for (let y = 2; y <= 10; y += 2) m.box(1, y, 0, 6, y, 0, C.metal_dark); // condenser
    m.box(6, 0, 0, 6, 3, 0, C.cable_black);
    m.set(1, 0, 8, C.paper); // a crushed cup beside it
    return {
      model: m,
      parts: [
        part("bubble", blob(1, 1, 1, C.ice), [3.5, 19, 6.5], "bob", {
          speed: 0.12,
          amplitude: 2.5,
        }),
      ],
    };
  }),
  rich(
    "oscilloscope_cart",
    { solid: true, scale: DETAIL_SCALE, light: L([7, 17, 12], "#33ff33", 2, 4) },
    () => {
      const m = new Model(16, 22, 12);
      legs(m, 0, 0, 15, 11, 12, C.steel_dark);
      for (const [x, z] of [
        [0, 0],
        [15, 0],
        [0, 11],
        [15, 11],
      ] as const)
        m.set(x, 0, z, C.rubber);
      m.box(0, 2, 0, 15, 2, 11, C.metal).box(0, 12, 0, 15, 12, 11, C.metal);
      m.box(1, 3, 1, 8, 6, 8, C.paint_gray).box(2, 4, 9, 7, 5, 9, C.metal_dark); // signal generator
      m.box(10, 3, 3, 13, 4, 8, C.cable_black).set(11, 5, 5, C.cable_red); // probe coil
      m.box(2, 13, 1, 13, 21, 11, C.beige);
      m.box(2, 21, 1, 13, 21, 11, C.paint_cream);
      const scr = screenWell(m, 3, 15, 8, 20, 11, { content: "scope", color: "#33FF33" });
      for (const [x, y] of [
        [11, 19],
        [11, 16],
        [13, 16],
      ] as const)
        disc(m, x, y, 0.8, 11, C.black);
      m.set(12, 20, 11, C.led_red).set(10, 14, 11, C.chrome).set(12, 14, 11, C.chrome);
      // Backs: scope vents and mains cord down the leg, generator connectors.
      for (let y = 15; y <= 19; y += 2) m.box(4, y, 1, 11, y, 1, C.black);
      m.box(12, 13, 0, 12, 20, 0, C.cable_black).box(12, 3, 0, 12, 11, 0, C.cable_black);
      m.box(2, 4, 0, 6, 5, 0, C.metal_dark).set(3, 5, 0, C.brass).set(5, 5, 0, C.brass);
      return { model: m, screens: [scr] };
    },
  ),
];
