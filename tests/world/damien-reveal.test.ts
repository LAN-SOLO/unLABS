/**
 * Damien stays veiled until he has been found.
 * =============================================
 *
 * - the reveal gate (lib/world/damien.ts) and that saves keep its flag;
 * - the veil transform (models/veil.ts): silhouette kept, colours scrambled,
 *   deterministic;
 * - the revealed model matches the reference (tall, heavy, long beard, no
 *   glasses);
 * - guard: nothing in the current game sets `damien_found` — no source file
 *   but the gate names it, no scene flags it, and a full simulated
 *   playthrough (every ending) leaves it unset.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { C } from "@/lib/world/content/palette";
import { DAMIEN_FOUND_FLAG, isDamienRevealed } from "@/lib/world/damien";
import { initialState } from "@/lib/world/game";
import { Model } from "@/lib/world/models/core";
import { damienRig, posedVoxels, rigBounds, type CharacterRigDef } from "@/lib/world/models/rig";
import {
  VEIL_COLORS,
  VEIL_FRAMES,
  damienFigureRigs,
  veilGrid,
  veilRig,
} from "@/lib/world/models/veil";
import { sanitizeSave } from "@/lib/world/save-sanitize";
import { SCENES } from "@/lib/world/scenes";
import { screenInfo } from "@/lib/world/screen-content";
import { play } from "./simPlayer";

const ROOT = join(__dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const colours = (def: CharacterRigDef): Set<number> =>
  new Set(posedVoxels(def).map((v) => v.color));

describe("reveal gate", () => {
  it("is closed unless the damien_found flag is set", () => {
    expect(DAMIEN_FOUND_FLAG).toBe("damien_found");
    const s = initialState();
    expect(isDamienRevealed(s)).toBe(false);
    expect(isDamienRevealed(null)).toBe(false);
    expect(isDamienRevealed(undefined)).toBe(false);
    s.flags[DAMIEN_FOUND_FLAG] = false;
    expect(isDamienRevealed(s)).toBe(false);
    s.flags[DAMIEN_FOUND_FLAG] = true;
    expect(isDamienRevealed(s)).toBe(true);
  });

  it("saves keep the flag (sanitize accepts it)", () => {
    const raw = JSON.parse(JSON.stringify(initialState())) as Record<string, unknown>;
    raw.flags = { ...(raw.flags as Record<string, boolean>), [DAMIEN_FOUND_FLAG]: true };
    const { state } = sanitizeSave(raw);
    expect(isDamienRevealed(state)).toBe(true);
  });

  it("screens know whether his face may resolve", () => {
    const s = initialState();
    expect(screenInfo(s, "ECR-001").damienRevealed).toBe(false);
    s.flags[DAMIEN_FOUND_FLAG] = true;
    expect(screenInfo(s, "ECR-001").damienRevealed).toBe(true);
  });
});

describe("veilGrid", () => {
  const solid = damienRig(false);

  it("keeps the silhouette of every part (bounding box and block occupancy)", () => {
    for (const p of solid.parts) {
      if (p.name === "brows" || p.name === "lids") continue;
      const src = p.model;
      const out = veilGrid(src, { seed: 3, block: 2, minFill: 2 });
      expect([out.w, out.h, out.d], p.name).toEqual([src.w, src.h, src.d]);
      const box = (m: Model): number[] => {
        const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        m.grid.forEach((x, y, z) => {
          b[0] = Math.min(b[0]!, x);
          b[1] = Math.min(b[1]!, y);
          b[2] = Math.min(b[2]!, z);
          b[3] = Math.max(b[3]!, x);
          b[4] = Math.max(b[4]!, y);
          b[5] = Math.max(b[5]!, z);
        });
        return b;
      };
      const a = box(src);
      const b = box(out);
      // Blocks snap to a 2-grid and torn rows slide ≤ 2 voxels: ≤ 3 voxels off per side.
      for (let i = 0; i < 6; i++)
        expect(Math.abs(a[i]! - b[i]!), `${p.name} ${i}`).toBeLessThanOrEqual(3);
      // Most source voxels keep a veil block within reach (dropouts are sparse).
      let kept = 0;
      let total = 0;
      src.grid.forEach((x, y, z) => {
        total++;
        let hit = false;
        for (let dx = -3; dx <= 3 && !hit; dx++)
          for (let dy = -1; dy <= 1 && !hit; dy++)
            for (let dz = -1; dz <= 1 && !hit; dz++)
              if (out.grid.get(x + dx, y + dy, z + dz)) hit = true;
        if (hit) kept++;
      });
      expect(kept / total, p.name).toBeGreaterThan(0.85);
    }
  });

  it("scrambles every colour into the cold noise palette", () => {
    const veil = new Set(VEIL_COLORS);
    const source = colours(solid);
    for (const k of [0, 1, 7]) {
      const out = colours(veilRig(solid, k));
      for (const c of out) {
        expect(veil.has(c), `colour ${c}`).toBe(true);
        expect(source.has(c), `source colour ${c} survived`).toBe(false);
      }
    }
    for (const c of [C.skin, C.skin_light, C.hair_gray, C.tile_cream_dk, C.white, C.hair_black])
      expect(veil.has(c)).toBe(false);
  });

  it("is deterministic per seed and differs between seeds", () => {
    const head = solid.parts.find((p) => p.name === "head")!.model;
    const cells = (m: Model): string => {
      const out: string[] = [];
      m.grid.forEach((x, y, z, v) => out.push(`${x},${y},${z}:${v}`));
      return out.join(" ");
    };
    expect(cells(veilGrid(head, { seed: 5 }))).toBe(cells(veilGrid(head, { seed: 5 })));
    expect(cells(veilGrid(head, { seed: 5 }))).not.toBe(cells(veilGrid(head, { seed: 6 })));
  });
});

describe("veiled rig", () => {
  it("keeps the joints, drops the face and stays the same size", () => {
    const solid = damienRig(false);
    const veiled = veilRig(solid, 0);
    expect(veiled.id).toBe("damien_veil");
    expect(veiled.hologram).toBe(true);
    const names = veiled.parts.map((p) => p.name);
    expect(names).not.toContain("brows");
    expect(names).not.toContain("lids");
    for (const p of veiled.parts) {
      const src = solid.parts.find((q) => q.name === p.name)!;
      expect(p.pivot).toEqual(src.pivot);
      expect(p.origin).toEqual(src.origin);
      expect(p.parent).toBe(src.parent);
    }
    const [a0, a1] = rigBounds(solid);
    const [b0, b1] = rigBounds(veiled);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(a0[i]! - b0[i]!)).toBeLessThan(0.35);
      expect(Math.abs(a1[i]! - b1[i]!)).toBeLessThan(0.35);
    }
  });

  it("damienFigureRigs: veiled frames until found, his hologram after", () => {
    const veiled = damienFigureRigs(false);
    expect(veiled.length).toBe(VEIL_FRAMES);
    for (const d of veiled) expect(d.id).toBe("damien_veil");
    const found = damienFigureRigs(true);
    expect(found.map((d) => d.id)).toEqual(["damien_holo"]);
  });
});

describe("revealed model (reference)", () => {
  const solid = damienRig(false);
  const vox = posedVoxels(solid);

  it("is tall (the tallest a rig may be under the doors) and heavy-set", () => {
    const [d0, d1] = rigBounds(solid);
    expect(d1[1] - d0[1]).toBeGreaterThan(5.7);
    expect(d1[1] - d0[1]).toBeLessThan(5.8);
    // Broad: an 18-voxel torso (Jade's was 16) with a belly that stands proud.
    const torso = solid.parts.find((p) => p.name === "torso")!.model;
    expect(torso.w).toBeGreaterThanOrEqual(18);
    expect(d1[0] - d0[0]).toBeGreaterThan(2.5);
    expect(d1[2] - d0[2]).toBeGreaterThan(1.4);
  });

  it("wears no glasses, a white shirt and a long beard below the chin", () => {
    expect(colours(solid).has(C.glass)).toBe(false);
    const torso = vox.filter((v) => v.part === "torso");
    expect(torso.filter((v) => v.color === C.white).length / torso.length).toBeGreaterThan(0.6);
    // The beard hangs from the head part well below the neck (onto the chest).
    const head = vox.filter((v) => v.part === "head");
    const neck = Math.min(...vox.filter((v) => v.part === "torso").map((v) => v.p[1])) + 18;
    const low = Math.min(...head.map((v) => v.p[1]));
    expect(neck - low).toBeGreaterThanOrEqual(7);
    const beardish = new Set([
      C.hair_gray,
      C.paint_gray_lt,
      C.paint_white,
      C.coat_shadow,
      C.paint_gray,
    ]);
    const below = head.filter((v) => v.p[1] < neck);
    expect(below.every((v) => beardish.has(v.color))).toBe(true);
  });
});

describe("nothing in the current game reveals Damien", () => {
  it("no source file but the gate names the flag", () => {
    const files = [
      ...sourceFiles(join(ROOT, "lib")),
      ...sourceFiles(join(ROOT, "components")),
      ...sourceFiles(join(ROOT, "app")),
    ];
    const hits = files.filter((f) => {
      if (f.endsWith(join("lib", "world", "damien.ts"))) return false;
      const src = readFileSync(f, "utf8");
      return src.includes(DAMIEN_FOUND_FLAG) || src.includes("DAMIEN_FOUND_FLAG");
    });
    expect(hits).toEqual([]);
  });

  it("no scene sets it; the return ending materialises him as a figure", () => {
    for (const sc of Object.values(SCENES))
      for (const st of sc.steps)
        if (st.kind === "flag") expect(st.flag).not.toBe(DAMIEN_FOUND_FLAG);
    const figures = SCENES.ending_rueckkehr.steps.filter((s) => s.kind === "figure");
    expect(figures.length).toBe(1);
  });

  it("a full simulated playthrough (all endings) leaves him veiled", () => {
    const run = play();
    expect(Object.keys(run.s.endings).length).toBeGreaterThanOrEqual(4);
    expect(isDamienRevealed(run.s)).toBe(false);
  });
});
