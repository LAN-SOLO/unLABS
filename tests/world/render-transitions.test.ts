import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  ASSEMBLY_DROP,
  POWER_RAMP_DOWN,
  POWER_RAMP_UP,
  UNLOCK_CHIRP_AT,
  UNLOCK_HOLD,
  UNLOCK_TIME,
  assemblyPose,
  easeInCubic,
  easeInOut,
  easeOutBack,
  easeOutBounce,
  easeOutCubic,
  glowFactor,
  noteFold,
  pickupFlight,
  rampedTransform,
  shaftBandY,
  spinFactor,
  stepRamp,
  unlockPose,
} from "@/lib/world/render/transitions";
import { DoorSystem, ElevatorSystem, type MeshModel } from "@/lib/world/render/doors";
import { animTransform, type AnimPart } from "@/lib/world/models/anim";
import { Model } from "@/lib/world/models/core";
import { DOORS, ELEVATORS } from "@/lib/world/content/map";
import type { VoxelGrid } from "@/lib/voxel/grid";

const mesher: MeshModel = (grid: VoxelGrid, scale: number) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(grid.sx, grid.sy, grid.sz).translate(0, grid.sy / 2, 0),
  );
  mesh.scale.setScalar(scale);
  return mesh;
};

function part(kind: AnimPart["kind"], extra: Partial<AnimPart> = {}): AnimPart {
  return {
    name: kind,
    model: new Model(2, 2, 2),
    offset: [0, 0, 0],
    pivot: [1, 1, 1],
    kind,
    speed: 2,
    amplitude: 1,
    phase: 0.4,
    requiresPower: true,
    ...extra,
  };
}

describe("easing", () => {
  const all = { easeInOut, easeInCubic, easeOutCubic, easeOutBack, easeOutBounce };
  it("every ease starts at 0, ends at 1 and clamps outside [0, 1]", () => {
    for (const [name, f] of Object.entries(all)) {
      expect(f(0), name).toBeCloseTo(0, 6);
      expect(f(1), name).toBeCloseTo(1, 6);
      expect(f(-3), name).toBeCloseTo(0, 6);
      expect(f(7), name).toBeCloseTo(1, 6);
    }
  });

  it("monotonic eases never go backwards", () => {
    for (const f of [easeInOut, easeInCubic, easeOutCubic]) {
      let last = -1;
      for (let i = 0; i <= 100; i++) {
        const y = f(i / 100);
        expect(y).toBeGreaterThanOrEqual(last - 1e-12);
        last = y;
      }
    }
  });

  it("easeOutBack overshoots, easeOutBounce stays within [0, 1]", () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(i / 100)));
    expect(peak).toBeGreaterThan(1.05);
    for (let i = 0; i <= 200; i++) {
      const y = easeOutBounce(i / 200);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe("power ramp", () => {
  it("reaches the target in the configured time and lands exactly on it", () => {
    let r = 0;
    let t = 0;
    while (r < 1 && t < 10) {
      r = stepRamp(r, 1, 1 / 60);
      t += 1 / 60;
    }
    expect(r).toBe(1);
    expect(t).toBeCloseTo(POWER_RAMP_UP, 1);
    t = 0;
    while (r > 0 && t < 10) {
      r = stepRamp(r, 0, 1 / 60);
      t += 1 / 60;
    }
    expect(r).toBe(0);
    expect(t).toBeCloseTo(POWER_RAMP_DOWN, 1);
    expect(stepRamp(0.4, 1, 0)).toBe(0.4);
    expect(stepRamp(0.4, 1, 1, 0)).toBe(1);
  });

  it("spin factor eases 0 → 1", () => {
    expect(spinFactor(0)).toBe(0);
    expect(spinFactor(1)).toBe(1);
    expect(spinFactor(0.1)).toBeLessThan(0.1);
  });

  it("glow is 0 dark, 1 on, flickers while striking and fades plainly when calm", () => {
    for (const rising of [true, false]) {
      for (const calm of [true, false]) {
        expect(glowFactor(0, 3.3, rising, calm)).toBe(0);
        expect(glowFactor(1, 3.3, rising, calm)).toBe(1);
      }
    }
    // Striking: over many time samples at a low ramp value the glow jumps around.
    const samples = Array.from({ length: 60 }, (_, i) => glowFactor(0.2, i / 24, true, false));
    const distinct = new Set(samples.map((x) => x.toFixed(3)));
    expect(distinct.size).toBeGreaterThan(1);
    // Calm: a single value per ramp value, rising monotonically.
    const calm = Array.from({ length: 60 }, (_, i) => glowFactor(0.2, i / 24, true, true));
    expect(new Set(calm).size).toBe(1);
    let last = -1;
    for (let i = 0; i <= 20; i++) {
      const g = glowFactor(i / 20, 1.234, true, true);
      expect(g).toBeGreaterThanOrEqual(last);
      last = g;
    }
    // Everything stays in [0, 1].
    for (let i = 0; i <= 50; i++)
      for (const rising of [true, false]) {
        const g = glowFactor(i / 50, i * 0.37, rising, false);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
      }
  });
});

describe("rampedTransform", () => {
  it("matches the powered pose at full speed and glow", () => {
    for (const kind of ["spin", "bob", "sway", "piston", "wobble", "sweep", "pulse"] as const) {
      const p = part(kind);
      const a = rampedTransform(p, 1.7, 1, 1);
      const b = animTransform(p, 1.7, true);
      expect(a.rot).toEqual(b.rot);
      expect(a.pos).toEqual(b.pos);
      expect(a.intensity).toBeCloseTo(b.intensity);
    }
  });

  it("dark oscillators settle at the unpowered rest pose", () => {
    for (const kind of ["bob", "sway", "slide", "piston", "wobble", "jitter", "sweep"] as const) {
      const p = part(kind);
      const a = rampedTransform(p, 5.3, 0, 0);
      const rest = animTransform(p, 0, false);
      for (let i = 0; i < 3; i++) {
        expect(a.rot[i]).toBeCloseTo(rest.rot[i]!);
        expect(a.pos[i]).toBeCloseTo(rest.pos[i]!);
      }
      expect(a.intensity).toBe(0);
    }
  });

  it("spinners keep their angle when stopped (no snap back to the phase)", () => {
    const p = part("spin");
    const a = rampedTransform(p, 5, 0, 0);
    expect(a.rot[1]).toBeCloseTo(0.4 + 2 * 5);
  });

  it("dark blink overlays are hidden, glowing ones follow the duty cycle", () => {
    const p = part("blink", { amplitude: 1 });
    expect(rampedTransform(p, 0.1, 1, 1).visible).toBe(true);
    expect(rampedTransform(p, 0.1, 0, 0).visible).toBe(false);
  });
});

describe("assembly flourish", () => {
  it("drops from above, lands, and ends at rest with the scan line done", () => {
    const start = assemblyPose(0);
    expect(start.lift).toBeCloseTo(ASSEMBLY_DROP);
    expect(start.landed).toBe(false);
    const end = assemblyPose(1);
    expect(end.lift).toBeCloseTo(0);
    expect(end.squashY).toBeCloseTo(1);
    expect(end.scan).toBeCloseTo(1);
    expect(end.scanAlpha).toBeCloseTo(0);
    let landedAt = -1;
    let minSquash = 1;
    for (let i = 0; i <= 100; i++) {
      const p = assemblyPose(i / 100);
      expect(p.lift).toBeGreaterThanOrEqual(-1e-9);
      expect(p.lift).toBeLessThanOrEqual(ASSEMBLY_DROP + 1e-9);
      if (p.landed && landedAt < 0) landedAt = i / 100;
      minSquash = Math.min(minSquash, p.squashY);
    }
    expect(landedAt).toBeGreaterThan(0.1);
    expect(landedAt).toBeLessThan(0.4);
    expect(minSquash).toBeLessThan(1);
    expect(minSquash).toBeGreaterThan(0.8);
  });

  it("reduce motion keeps the model still (scan line only)", () => {
    for (let i = 0; i <= 10; i++) {
      const p = assemblyPose(i / 10, true);
      expect(p.lift).toBe(0);
      expect(p.squashY).toBe(1);
    }
    expect(assemblyPose(0.5, true).scanAlpha).toBeGreaterThan(0);
  });
});

describe("pickup flight and note fold", () => {
  it("a pickup starts at home, arrives at the player small", () => {
    const a = pickupFlight(0);
    expect(a.travel).toBe(0);
    expect(a.scale).toBe(1);
    expect(a.arc).toBeCloseTo(0);
    const b = pickupFlight(1);
    expect(b.travel).toBe(1);
    expect(b.scale).toBeCloseTo(0.15);
    expect(b.arc).toBeCloseTo(0);
    expect(pickupFlight(0.5).arc).toBeGreaterThan(1);
  });

  it("a note folds to a sliver and its glow fades out", () => {
    const a = noteFold(0);
    expect([a.scaleX, a.scaleZ, a.glow]).toEqual([1, 1, 1]);
    const mid = noteFold(0.5);
    expect(mid.scaleZ).toBeCloseTo(0.5);
    const b = noteFold(1);
    expect(b.scaleX).toBeCloseTo(0);
    expect(b.scaleZ).toBeCloseTo(0.1);
    expect(b.glow).toBe(0);
  });
});

describe("door unlock", () => {
  it("bolts retract before release; beacon strobes, then turns green at the chirp", () => {
    expect(unlockPose(0).bolt).toBe(0);
    expect(unlockPose(0).release).toBe(false);
    expect(unlockPose(UNLOCK_HOLD).bolt).toBe(1);
    expect(unlockPose(UNLOCK_HOLD).release).toBe(true);
    expect(unlockPose(UNLOCK_CHIRP_AT - 0.01, true).light).toBe("old");
    expect(unlockPose(UNLOCK_CHIRP_AT + 0.01).light).toBe("green");
    expect(unlockPose(UNLOCK_TIME).done).toBe(true);
    expect(unlockPose(UNLOCK_TIME + 1).light).toBe("green");
    const strobe = new Set(
      Array.from({ length: 30 }, (_, i) => unlockPose((i / 30) * UNLOCK_CHIRP_AT).light),
    );
    expect(strobe).toEqual(new Set(["old", "off"]));
    const calm = new Set(
      Array.from({ length: 30 }, (_, i) => unlockPose((i / 30) * UNLOCK_TIME, true).light),
    );
    expect(calm.has("off")).toBe(false);
  });

  it("DoorSystem: unlocking a locked door chirps once and opens after the bolts", () => {
    const door = DOORS.find((d) => d.lock && !d.keypad && !d.secret) ?? DOORS[0]!;
    const chirps: string[] = [];
    const sys = new DoorSystem({ onUnlock: (id) => chirps.push(id) });
    const g = new THREE.Group();
    sys.addDoor(door, g, mesher);
    sys.setState(door.id, false, "locked");
    const root = g.children[0]!;
    const before = countMeshes(root);
    sys.setState(door.id, true, "locked");
    expect(sys.isUnlocking(door.id)).toBe(true);
    expect(countMeshes(root)).toBe(before + 2); // two transient bolts
    const near: [number, number, number] = [door.x + 3, 1, door.z];
    sys.update(UNLOCK_HOLD * 0.5, near);
    expect(sys.openAmount(door.id)).toBe(0); // held shut while the bolts move
    for (let i = 0; i < 60; i++) sys.update(1 / 60, near);
    expect(chirps).toEqual([door.id]);
    expect(sys.isUnlocking(door.id)).toBe(false);
    expect(countMeshes(root)).toBe(before);
    expect(sys.openAmount(door.id)).toBeGreaterThan(0);
  });

  it("keypad doors add a flash plate; a snap cancels the sequence", () => {
    const door = DOORS.find((d) => d.keypad) ?? DOORS[0]!;
    const sys = new DoorSystem();
    const g = new THREE.Group();
    sys.addDoor(door, g, mesher);
    sys.setState(door.id, false, "keypad");
    const root = g.children[0]!;
    const before = countMeshes(root);
    sys.setState(door.id, true, "keypad");
    expect(countMeshes(root)).toBe(before + 3);
    sys.snap([door.x, 1, door.z]);
    expect(sys.isUnlocking(door.id)).toBe(false);
    expect(countMeshes(root)).toBe(before);
  });

  it("first state and normal doors never play the unlock", () => {
    const door = DOORS[0]!;
    const sys = new DoorSystem();
    sys.addDoor(door, new THREE.Group(), mesher);
    sys.setState(door.id, true, "locked");
    expect(sys.isUnlocking(door.id)).toBe(false);
    const sys2 = new DoorSystem();
    sys2.addDoor(door, new THREE.Group(), mesher);
    sys2.setState(door.id, false, "normal");
    sys2.setState(door.id, true, "normal");
    expect(sys2.isUnlocking(door.id)).toBe(false);
  });
});

describe("elevator cage light", () => {
  it("band height wraps inside [0, gap) and slides opposite to travel", () => {
    for (let o = -6; o <= 6; o += 0.37) {
      const y = shaftBandY(o, 5);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(5);
    }
    // Going down (offset decreasing) the band moves up relative to the cage.
    expect(shaftBandY(-0.5, 5)).toBeGreaterThan(shaftBandY(0, 5));
  });

  it("the band shows only while the cage moves", () => {
    const sys = new ElevatorSystem(mesher);
    const groups = new Map<number, THREE.Group>();
    for (const e of ELEVATORS) {
      const g = new THREE.Group();
      groups.set(e.floor, g);
      sys.addFloor(e.floor, g, e);
    }
    const band = (): THREE.Object3D | undefined =>
      groups.get(ELEVATORS[0]!.floor)!.getObjectByName("cage-band");
    expect(band()?.visible).toBe(false);
    sys.ride(ELEVATORS[0]!.floor, ELEVATORS[1]!.floor, () => undefined);
    let seen = false;
    for (let i = 0; i < 60; i++) {
      sys.update(1 / 60);
      if (band()?.visible) seen = true;
    }
    expect(seen).toBe(true);
  });
});

function countMeshes(o: THREE.Object3D): number {
  let n = 0;
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) n++;
  });
  return n;
}
