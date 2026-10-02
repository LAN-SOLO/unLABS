import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DOORS } from "@/lib/world/content/map";
import { initialState } from "@/lib/world/game";
import {
  MECHS,
  doorStyle,
  doorStyles,
  mechKey,
  shapeKey,
  type DoorStyle,
} from "@/lib/world/doors/style";
import {
  PANEL_H,
  PANEL_W,
  doorPanelModel,
  doorPieces,
  inOpening,
  mechParts,
  splitX,
  styledFrameModel,
} from "@/lib/world/models/door-styles";
import { FRAME_D, FRAME_H, FRAME_W, LEAF_D } from "@/lib/world/models/doors";
import {
  AIRLOCKS,
  DEEP,
  EXTRACT_S,
  STEAM_S,
  initialAirlock,
  stepAirlock,
  type AirlockDef,
} from "@/lib/world/doors/airlock";
import { agingTick } from "@/lib/world/aging";
import {
  doorInfo,
  doorMode,
  doorPanelPoint,
  noteDoorOpened,
  setDoorMode,
} from "@/lib/world/doors/lock";
import { DoorSystem, type MeshModel } from "@/lib/world/render/doors";
import type { VoxelGrid } from "@/lib/voxel/grid";
import type { DoorDef } from "@/lib/world/types";

const mesher: MeshModel = (grid: VoxelGrid, scale: number) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(grid.sx, grid.sy, grid.sz).translate(0, grid.sy / 2, 0),
  );
  mesh.scale.setScalar(scale);
  return mesh;
};

describe("door styles", () => {
  it("every visible door has its own shape, every door its own mechanism", () => {
    const styles = [...doorStyles().values()];
    expect(styles).toHaveLength(DOORS.length);
    const visible = DOORS.filter((d) => !d.secret).map((d) => doorStyle(d.id));
    expect(new Set(visible.map(shapeKey)).size).toBe(visible.length);
    expect(new Set(styles.map(mechKey)).size).toBe(styles.length);
    // All mechanism kinds are in use.
    for (const m of MECHS)
      expect(
        styles.some((s) => s.mech === m),
        m,
      ).toBe(true);
  });

  it("is deterministic", () => {
    const a = doorStyle("d_mcp");
    expect(doorStyle("d_mcp")).toBe(a);
  });

  it("the airlock pair is clean-room white with portholes", () => {
    for (const id of ["d_rechen", "d_rechen_schleuse"]) {
      const s = doorStyle(id);
      expect(s.window).toBe("porthole");
      expect(s.frame).toBe("vault");
    }
  });
});

describe("door models", () => {
  const sample = (over: Partial<DoorStyle>): DoorStyle => ({ ...doorStyle("d_mcp"), ...over });

  it("pieces fill exactly the closed opening (no gap, no overlap)", () => {
    for (const motion of ["split", "stagger", "swing", "shutter"] as const)
      for (const edge of ["straight", "stepped", "toothed", "diagonal", "wave"] as const)
        for (const frame of ["square", "chamfer", "arch"] as const) {
          const st = sample({ motion, edge, frame });
          const panel = doorPanelModel(st, "green");
          let panelCells = 0;
          panel.grid.forEach((_x, _y, z) => {
            if (z === 1) panelCells++;
          });
          let pieceCells = 0;
          for (const p of doorPieces(st, "green"))
            p.model.grid.forEach((_x, _y, z) => {
              if (z === 1) pieceCells++;
            });
          expect(pieceCells, `${motion}/${edge}/${frame}`).toBe(panelCells);
        }
  });

  it("pieces stay inside the leaf depth; frames keep their footprint", () => {
    for (const s of doorStyles().values()) {
      for (const p of doorPieces(s, "red")) expect(p.model.d).toBe(LEAF_D);
      const f = styledFrameModel(s);
      expect([f.w, f.h, f.d]).toEqual([FRAME_W, FRAME_H, FRAME_D]);
    }
  });

  it("chamfer and arch cut the top corners only; the meeting edge stays near the middle", () => {
    expect(inOpening("chamfer", 0, PANEL_H - 1)).toBe(false);
    expect(inOpening("arch", 0, PANEL_H - 1)).toBe(false);
    expect(inOpening("arch", PANEL_W / 2, PANEL_H - 1)).toBe(true);
    for (let y = 0; y < PANEL_H; y++)
      for (const e of ["straight", "stepped", "toothed", "diagonal", "wave"] as const) {
        const x = splitX(e, y);
        expect(x).toBeGreaterThanOrEqual(PANEL_W / 2 - 2);
        expect(x).toBeLessThanOrEqual(PANEL_W / 2 + 2);
      }
  });

  it("every door has mechanism parts with a release motion", () => {
    for (const d of DOORS) {
      const parts = mechParts(doorStyle(d.id));
      expect(parts.length, d.id).toBeGreaterThan(0);
    }
  });
});

describe("lock system", () => {
  const plain = DOORS.find((d) => !d.lock && !d.keypad && !d.secret && !d.airlock)!;
  const locked = DOORS.find((d) => d.lock && !d.keypad && !d.secret && !d.airlock)!;

  it("modes: hold needs an open door and no airlock; sealed always; auto clears", () => {
    const s = initialState();
    expect(doorMode(s, plain.id)).toBe("auto");
    expect(setDoorMode(s, plain, "hold").ok).toBe(true);
    expect(doorMode(s, plain.id)).toBe("hold");
    expect(setDoorMode(s, locked, "hold").ok).toBe(false);
    expect(setDoorMode(s, DOORS.find((d) => d.id === "d_rechen_schleuse")!, "hold").ok).toBe(false);
    expect(setDoorMode(s, plain, "sealed").ok).toBe(true);
    expect(setDoorMode(s, plain, "auto").ok).toBe(true);
    expect(s.counters[`door_mode:${plain.id}`]).toBeUndefined();
  });

  it("secret doors have no interface until revealed", () => {
    const s = initialState();
    const sec = DOORS.find((d) => d.secret)!;
    expect(setDoorMode(s, sec, "sealed").ok).toBe(false);
  });

  it("access log and info", () => {
    const s = initialState();
    noteDoorOpened(s, plain.id);
    noteDoorOpened(s, plain.id);
    const i = doorInfo(s, plain);
    expect(i.opens).toBe(2);
    expect(i.mech.length).toBeGreaterThan(3);
    const p = doorPanelPoint(plain);
    expect(Math.hypot(p.x - (plain.x + 0.5), p.z - (plain.z + 0.5))).toBeCloseTo(3.05);
  });

  it("a sealed door stays shut but never closes on the player in the doorway", () => {
    const sys = new DoorSystem();
    sys.addDoor(plain, new THREE.Group(), mesher);
    sys.setState(plain.id, true, "normal");
    const inside: [number, number, number] = [plain.x + 0.5, 1, plain.z + 0.5];
    for (let i = 0; i < 30; i++) sys.update(0.05, inside);
    expect(sys.isPassable(plain.id)).toBe(true);
    sys.setMode(plain.id, "sealed");
    for (let i = 0; i < 30; i++) sys.update(0.05, inside);
    expect(sys.isPassable(plain.id)).toBe(true);
    const away: [number, number, number] = [plain.x + 0.5 + 6, 1, plain.z + 0.5 + 6];
    for (let i = 0; i < 40; i++) sys.update(0.05, away);
    expect(sys.openAmount(plain.id)).toBe(0);
    expect(sys.lockedAt(plain.x, plain.z)).toBe(true);
    expect(sys.lockAmount(plain.id)).toBe(1);
  });

  it("the mechanism releases before the leaves move and engages after they closed", () => {
    const events: boolean[] = [];
    const sys = new DoorSystem({ onMech: (_id, engage) => events.push(engage) });
    sys.addDoor(plain, new THREE.Group(), mesher);
    sys.setState(plain.id, true, "normal");
    const near: [number, number, number] = [plain.x + 0.5, 1, plain.z + 3.5];
    sys.update(0.1, near);
    expect(sys.openAmount(plain.id)).toBe(0);
    expect(sys.lockAmount(plain.id)).toBeLessThan(1);
    for (let i = 0; i < 20; i++) sys.update(0.05, near);
    expect(sys.lockAmount(plain.id)).toBe(0);
    expect(sys.openAmount(plain.id)).toBeGreaterThan(0.5);
    const far: [number, number, number] = [plain.x + 30, 1, plain.z + 30];
    for (let i = 0; i < 40; i++) sys.update(0.05, far);
    expect(sys.openAmount(plain.id)).toBe(0);
    expect(sys.lockAmount(plain.id)).toBe(1);
    expect(events).toEqual([false, true]);
  });
});

describe("airlock", () => {
  const def = AIRLOCKS[0]!;
  const outer = DOORS.find((d) => d.id === def.outer)!;
  const inner = DOORS.find((d) => d.id === def.inner)!;

  /** Simulated doors: open towards their gate at 2/s. */
  function run(path: [number, number][], al: AirlockDef = def) {
    const st = initialAirlock();
    const open = { o: 0, i: 0 };
    const log: string[] = [];
    let both = false;
    for (const [x, z] of path) {
      for (let k = 0; k < 10; k++) {
        const out = stepAirlock(
          st,
          al,
          outer,
          inner,
          { x, z, outerOpen: open.o, innerOpen: open.i },
          0.05,
        );
        open.o = Math.max(0, Math.min(1, open.o + (out.allowOuter ? 0.1 : -0.1)));
        open.i = Math.max(0, Math.min(1, open.i + (out.allowInner ? 0.1 : -0.1)));
        if (open.o > 0 && open.i > 0) both = true;
        log.push(...out.events);
      }
    }
    return { st, log, both, open };
  }

  const cx = (def.chamber.x0 + def.chamber.x1 + 1) / 2;
  const mid = (outer.z + inner.z + 1) / 2;

  it("both doors are interlocked and belong to the airlock", () => {
    expect(outer.airlock).toBe(def.id);
    expect(inner.airlock).toBe(def.id);
    expect(outer.axis).toBe(inner.axis);
    expect(Math.abs(inner.z - outer.z) / 2).toBeGreaterThanOrEqual(DEEP);
  });

  it("walking through: seal → steam → extraction → release → cleared, never both open", () => {
    const path: [number, number][] = [];
    for (let z = outer.z - 4; z <= mid; z += 0.5) path.push([cx, z]);
    const wait = Math.ceil((STEAM_S + EXTRACT_S + 1.5) / 0.5);
    for (let i = 0; i < wait; i++) path.push([cx, mid]);
    for (let z = mid; z <= inner.z + 4; z += 0.5) path.push([cx, z]);
    const r = run(path);
    expect(r.both).toBe(false);
    expect(r.log).toEqual(["seal", "steam", "extract", "release", "cleared"]);
    expect(r.st.cycles).toBe(1);
  });

  it("never traps: stepping back out before the seal works", () => {
    const path: [number, number][] = [];
    for (let z = outer.z - 3; z <= outer.z + 1; z += 0.5) path.push([cx, z]);
    for (let z = outer.z + 1; z >= outer.z - 3; z -= 0.5) path.push([cx, z]);
    const r = run(path);
    expect(r.log).toEqual([]);
    expect(r.both).toBe(false);
  });

  it("keeps the data center free of dust", () => {
    const s = initialState();
    agingTick(s, 5000, () => true, [def.clean, "batterie"]);
    expect(s.counters[`dust:${def.clean}`] ?? 0).toBe(0);
    expect(s.counters["dust:batterie"] ?? 0).toBeGreaterThan(0);
  });
});

describe("door list", () => {
  it("has the airlock's outer door in the passage to the data center", () => {
    const d: DoorDef | undefined = DOORS.find((x) => x.id === "d_rechen_schleuse");
    expect(d).toBeDefined();
    expect(d!.floor).toBe(1);
  });
});
