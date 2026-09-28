import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  AutoInstancer,
  HIDDEN_LAYER,
  SHADOW_LAYER,
  StaticBatcher,
  installShadowLayerHook,
  markInstanced,
  markStatic,
  mergeByMaterial,
  shareVertices,
  tileKey,
  visibleUnder,
} from "@/lib/world/render/batching";
import { WorldRenderer } from "@/lib/world/render/world-renderer";
import { Palette } from "@/lib/voxel/palette";
import { VoxelWorld } from "@/lib/voxel/world";
import type { MaterialClass } from "@/lib/voxel/mesher";

/** A quad (2 triangles) at x offset `x`, material group `mat`. */
function quad(x: number, mat: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 1, 0]), 3),
  );
  g.setAttribute(
    "normal",
    new THREE.BufferAttribute(
      new Float32Array(12).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)),
      3,
    ),
  );
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(12).fill(0.5), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.addGroup(0, 6, mat);
  return g;
}

/** Two quads in one geometry: first material `a`, second `b`. */
function twoGroups(a: number, b: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]),
      3,
    ),
  );
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  g.addGroup(0, 6, a);
  g.addGroup(6, 6, b);
  return g;
}

const mats = (): THREE.Material[] => [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial());

describe("mergeByMaterial", () => {
  it("returns null for nothing", () => {
    expect(mergeByMaterial([])).toBeNull();
  });

  it("makes one contiguous group per material, ascending", () => {
    const r = mergeByMaterial([
      { geometry: twoGroups(3, 0) },
      { geometry: quad(5, 0) },
      { geometry: quad(7, 3) },
    ])!;
    expect(r.geometry.getAttribute("position").count).toBe(16);
    expect(r.geometry.groups).toEqual([
      { start: 0, count: 12, materialIndex: 0 },
      { start: 12, count: 12, materialIndex: 3 },
    ]);
    const idx = r.geometry.getIndex()!.array;
    // Material 0 range: part 0's second quad (verts 4..7), then part 1 (verts 8..11).
    expect(Array.from(idx.slice(0, 12))).toEqual([4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11]);
    // Material 3 range: part 0's first quad, then part 2 (verts 12..15).
    expect(Array.from(idx.slice(12))).toEqual([0, 1, 2, 0, 2, 3, 12, 13, 14, 12, 14, 15]);
    expect(r.casterIndex).toBeNull();
  });

  it("bakes transforms into positions and normals", () => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(10, 1, 20),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
      new THREE.Vector3(2, 2, 2),
    );
    const r = mergeByMaterial([{ geometry: quad(0, 0), matrix: m }])!;
    const p = r.geometry.getAttribute("position");
    const v = new THREE.Vector3(1, 0, 0).applyMatrix4(m);
    expect(p.getX(1)).toBeCloseTo(v.x);
    expect(p.getY(1)).toBeCloseTo(v.y);
    expect(p.getZ(1)).toBeCloseTo(v.z);
    const n = r.geometry.getAttribute("normal");
    // +z rotated a quarter turn about y → +x, unit length despite the scale.
    expect(n.getX(0)).toBeCloseTo(1);
    expect(n.getZ(0)).toBeCloseTo(0);
    expect(r.geometry.getAttribute("color").getX(0)).toBeCloseTo(0.5);
  });

  it("collects only the shadow casters' triangles in casterIndex", () => {
    const r = mergeByMaterial([
      { geometry: quad(0, 0), castShadow: true },
      { geometry: quad(2, 0), castShadow: false },
      { geometry: quad(4, 2), castShadow: true },
    ])!;
    expect(Array.from(r.casterIndex!.array).sort((a, b) => a - b)).toEqual([
      0, 0, 1, 2, 2, 3, 8, 8, 9, 10, 10, 11,
    ]);
    const proxy = shareVertices(r.geometry, r.casterIndex!);
    expect(proxy.getAttribute("position")).toBe(r.geometry.getAttribute("position"));
    expect(proxy.groups.length).toBe(0);
  });

  it("treats geometry without groups / index as material 0", () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    const r = mergeByMaterial([{ geometry: g }])!;
    expect(r.geometry.groups).toEqual([{ start: 0, count: 3, materialIndex: 0 }]);
    expect(r.geometry.getAttribute("color").getX(0)).toBe(1);
  });

  it("switches to 32-bit indices for big merges", () => {
    const parts = Array.from({ length: 16400 }, (_, i) => ({ geometry: quad(i, 0) }));
    const r = mergeByMaterial(parts)!;
    expect(r.geometry.getIndex()!.array).toBeInstanceOf(Uint32Array);
  });
});

describe("helpers", () => {
  it("tileKey buckets positions", () => {
    expect(tileKey(0, 0, 64)).toBe(tileKey(63.9, 63.9, 64));
    expect(tileKey(64, 0, 64)).not.toBe(tileKey(63, 0, 64));
    expect(tileKey(0, 64, 64)).not.toBe(tileKey(64, 0, 64));
  });

  it("visibleUnder checks the chain up to the root", () => {
    const root = new THREE.Group();
    const a = new THREE.Group();
    const m = new THREE.Mesh();
    root.add(a);
    a.add(m);
    expect(visibleUnder(m, root)).toBe(true);
    a.visible = false;
    expect(visibleUnder(m, root)).toBe(false);
    root.visible = false;
    a.visible = true;
    expect(visibleUnder(m, root)).toBe(true); // the root's own flag is the floor switch
    expect(visibleUnder(new THREE.Mesh(), root)).toBe(false);
  });

  it("shadow layer hook enables the layer only during the shadow pass", () => {
    const camera = new THREE.PerspectiveCamera();
    let during = false;
    const shadowMap = {
      render: (_l: unknown, _s: unknown, cam: THREE.Camera) => {
        during = cam.layers.isEnabled(SHADOW_LAYER);
      },
    };
    const renderer = { shadowMap } as unknown as THREE.WebGLRenderer;
    const uninstall = installShadowLayerHook(renderer);
    renderer.shadowMap.render([], new THREE.Scene(), camera);
    expect(during).toBe(true);
    expect(camera.layers.isEnabled(SHADOW_LAYER)).toBe(false);
    uninstall();
    renderer.shadowMap.render([], new THREE.Scene(), camera);
    expect(during).toBe(false);
  });
});

describe("StaticBatcher", () => {
  function setup() {
    const root = new THREE.Group();
    const materials = mats();
    const batch = new StaticBatcher(root, materials, materials[0]!, 64);
    return { root, batch };
  }

  it("merges fixed parts and flagged meshes per tile, hiding the sources", () => {
    const { root, batch } = setup();
    batch.addFixed({ geometry: quad(0, 0), castShadow: true }, 10, 10);
    batch.addFixed({ geometry: quad(0, 1) }, 100, 10);
    const dev = new THREE.Group();
    dev.position.set(20, 1, 20);
    const m = markStatic(new THREE.Mesh(twoGroups(0, 2), mats()));
    m.castShadow = true;
    dev.add(m);
    root.add(dev);
    root.updateMatrixWorld();
    expect(batch.update()).toBe(2);
    expect(batch.tileCount).toBe(2);
    expect(m.layers.isEnabled(HIDDEN_LAYER)).toBe(true);
    expect(m.layers.isEnabled(0)).toBe(false);
    const tiles = batch.group.children.filter((c) => c.name.startsWith("static-tile"));
    const t0 = tiles.find((t) => t.name === `static-tile ${tileKey(10, 10, 64)}`) as THREE.Mesh;
    expect(t0.geometry.getAttribute("position").count).toBe(4 + 8);
    expect(t0.castShadow).toBe(false);
    const proxies = batch.group.children.filter((c) => c.name === "shadow-proxy");
    expect(proxies.length).toBe(1); // the tile at x=100 has no casters
    expect(proxies[0]!.layers.isEnabled(SHADOW_LAYER)).toBe(true);
    expect(proxies[0]!.layers.isEnabled(0)).toBe(false);
    // Unchanged content → no rebuild.
    expect(batch.update()).toBe(0);
    // Hiding the device re-merges its tile only.
    dev.visible = false;
    expect(batch.update()).toBe(1);
    const t0b = batch.group.children.find(
      (c) => c.name === `static-tile ${tileKey(10, 10, 64)}`,
    ) as THREE.Mesh;
    expect(t0b.geometry.getAttribute("position").count).toBe(4);
    // Moving (e.g. cutaway squash) re-merges too.
    dev.visible = true;
    batch.update();
    dev.scale.y = 0.5;
    root.updateMatrixWorld();
    expect(batch.update()).toBe(1);
    batch.dispose();
    expect(batch.tileCount).toBe(0);
  });

  it("drops tiles that become empty", () => {
    const { root, batch } = setup();
    const m = markStatic(new THREE.Mesh(quad(0, 0), mats()));
    root.add(m);
    root.updateMatrixWorld();
    batch.update();
    expect(batch.tileCount).toBe(1);
    m.visible = false;
    batch.update();
    expect(batch.tileCount).toBe(0);
  });
});

describe("AutoInstancer", () => {
  it("instances meshes sharing geometry + materials; singletons stay plain", () => {
    const root = new THREE.Group();
    const materials = mats();
    const shadow = materials[0]!;
    const inst = new AutoInstancer(root, shadow);
    const geo = quad(0, 0);
    const srcs = [0, 1, 2].map((i) => {
      const g = new THREE.Group();
      g.position.set(i * 5, 0, 0);
      const m = markInstanced(new THREE.Mesh(geo, materials));
      m.castShadow = true;
      g.add(m);
      root.add(g);
      return m;
    });
    const single = markInstanced(new THREE.Mesh(quad(3, 0), materials));
    single.layers.set(HIDDEN_LAYER); // e.g. cloned from a hidden source
    root.add(single);
    root.updateMatrixWorld();
    inst.update();
    expect(inst.setCount).toBe(1);
    expect(inst.sourceCount).toBe(3);
    expect(single.layers.isEnabled(0)).toBe(true);
    for (const s of srcs) expect(s.layers.isEnabled(0)).toBe(false);
    const im = inst.group.children.find(
      (c) => c instanceof THREE.InstancedMesh && !c.layers.isEnabled(SHADOW_LAYER),
    ) as THREE.InstancedMesh;
    const proxy = inst.group.children.find(
      (c) => c instanceof THREE.InstancedMesh && c.layers.isEnabled(SHADOW_LAYER),
    ) as THREE.InstancedMesh;
    expect(im.count).toBe(3);
    expect(im.castShadow).toBe(false);
    expect(proxy.instanceMatrix).toBe(im.instanceMatrix);
    const m = new THREE.Matrix4();
    im.getMatrixAt(1, m);
    expect(m.elements[12]).toBe(5);
    // Hide one, move another.
    srcs[0]!.parent!.visible = false;
    srcs[2]!.parent!.position.x = 42;
    root.updateMatrixWorld();
    inst.update();
    expect(im.count).toBe(2);
    expect(proxy.count).toBe(2);
    im.getMatrixAt(1, m);
    expect(m.elements[12]).toBe(42);
    // A source removed from the tree is dropped after a rescan.
    srcs[1]!.parent!.remove(srcs[1]!);
    srcs[0]!.parent!.visible = true;
    inst.markDirty();
    inst.update();
    expect(inst.sourceCount).toBe(2);
    expect(im.count).toBe(2);
    inst.dispose();
    expect(inst.setCount).toBe(0);
  });
});

describe("WorldRenderer", () => {
  it("draws the whole terrain as one mesh + one shadow proxy", () => {
    const world = new VoxelWorld(70, 8, 40);
    for (let x = 0; x < 70; x++) for (let z = 0; z < 40; z++) world.set(x, 0, z, 1);
    world.set(3, 1, 3, 2);
    world.set(40, 1, 3, 2);
    const palette = Palette.fromHex(["#808080", "#ff8000"]);
    const materials: Record<MaterialClass, THREE.Material> = {
      solid: new THREE.MeshBasicMaterial(),
      glass: new THREE.MeshBasicMaterial(),
      emit: new THREE.MeshBasicMaterial(),
      metal: new THREE.MeshBasicMaterial(),
    };
    const r = new WorldRenderer(world, palette, materials, (i) => (i === 2 ? "emit" : "solid"));
    r.syncAll();
    expect(r.chunkCount).toBeGreaterThan(1);
    const meshes = r.root.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
    expect(meshes.length).toBe(2);
    const terrain = meshes.find((m) => m.name === "terrain")!;
    const proxy = meshes.find((m) => m.name === "shadow-proxy")!;
    expect(terrain.geometry.groups.map((g) => g.materialIndex)).toEqual([0, 2]);
    expect(terrain.castShadow).toBe(false);
    expect(proxy.geometry).toBe(terrain.geometry);
    expect(proxy.layers.isEnabled(SHADOW_LAYER)).toBe(true);
    // An edit re-merges (still one mesh).
    world.set(10, 1, 10, 2);
    expect(r.sync(8)).toBeGreaterThan(0);
    expect(r.root.children.length).toBe(2);
    expect(r.sync(8)).toBe(0);
    r.dispose();
    expect(r.root.children.length).toBe(0);
  });
});
