/**
 * Draw-call batching for the lab view.
 * ====================================
 *
 * Three tools, all keyed on the voxel material classes (solid/glass/emit/
 * metal → one draw per non-empty class and mesh):
 *
 * - `mergeByMaterial` — pure: bakes transformed voxel geometries into ONE
 *   geometry with one contiguous group per material class, plus an index
 *   of the shadow-casting triangles only.
 * - `StaticBatcher` — per floor: never-moving meshes (flagged with
 *   `markStatic`) and fixed parts (decor) are merged per map tile. A tile is
 *   re-merged only when its visible content changes (device stage/power,
 *   note visibility, secret door revealed, wall cutaway squashing doors).
 * - `AutoInstancer` — per floor: moving/blinking meshes that SHARE a
 *   geometry (flagged with `markInstanced`: door leaves, beacons, pickups,
 *   gate bars, repeated decor rig parts) are drawn as one InstancedMesh per
 *   geometry; matrices are copied from the (hidden) sources every frame.
 *
 * Sources stay in the scene graph (logical visibility, animation and
 * raycasting keep working) but move to `HIDDEN_LAYER`, which the camera
 * does not render — enable that layer on raycasters that must hit them.
 *
 * Shadows: batched meshes do not cast themselves. A proxy that shares the
 * vertex buffers casts instead, with a single material (one shadow draw
 * instead of one per material class). Proxies live on `SHADOW_LAYER`, which
 * the camera only sees during the shadow pass (`installShadowLayerHook`).
 */
import * as THREE from "three";

/** Layer of batched/instanced source meshes: raycastable, never rendered. */
export const HIDDEN_LAYER = 2;
/** Layer of shadow-only proxies: enabled on the camera during the shadow pass only. */
export const SHADOW_LAYER = 3;

type BatchFlag = "static" | "instance";

/** Merge this mesh into its floor's static tile batch (it must never move on its own). */
export function markStatic<T extends THREE.Object3D>(obj: T): T {
  obj.userData.batch = "static" satisfies BatchFlag;
  obj.layers.set(HIDDEN_LAYER);
  return obj;
}

/** Draw this mesh through the floor's auto-instancer (it may move; its geometry is shared). */
export function markInstanced<T extends THREE.Object3D>(obj: T): T {
  obj.userData.batch = "instance" satisfies BatchFlag;
  return obj;
}

function batchFlag(o: THREE.Object3D): BatchFlag | null {
  const f: unknown = o.userData.batch;
  return f === "static" || f === "instance" ? f : null;
}

/**
 * The shadow pass tests layers against the MAIN camera, so shadow-only
 * proxies are enabled on it just for the duration of `shadowMap.render`.
 * Returns an uninstall function.
 */
export function installShadowLayerHook(renderer: THREE.WebGLRenderer): () => void {
  const sm = renderer.shadowMap;
  const orig = sm.render;
  sm.render = function (
    lights: Parameters<typeof orig>[0],
    scene: Parameters<typeof orig>[1],
    camera: Parameters<typeof orig>[2],
  ): void {
    const had = camera.layers.isEnabled(SHADOW_LAYER);
    camera.layers.enable(SHADOW_LAYER);
    try {
      orig.call(sm, lights, scene, camera);
    } finally {
      if (!had) camera.layers.disable(SHADOW_LAYER);
    }
  };
  return () => {
    sm.render = orig;
  };
}

/** `o` and its ancestors up to (excluding) `root` are visible, and `o` hangs under `root`. */
export function visibleUnder(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p === root) return true;
    if (!p.visible) return false;
  }
  return false;
}

/** Map tile key of a world position (tiles are `size` × `size` voxels). */
export function tileKey(x: number, z: number, size: number): number {
  return Math.floor(x / size) + 4096 * Math.floor(z / size);
}

// ── Pure merge ─────────────────────────────────────────────────

export interface MergePart {
  /** Indexed or not; `position` required, `normal` / `color` (itemSize 3) optional. */
  geometry: THREE.BufferGeometry;
  /** Transform baked into the vertices (null = identity). */
  matrix?: THREE.Matrix4 | null;
  castShadow?: boolean;
}

export interface MergeResult {
  /** One group per non-empty material index, in ascending material order. */
  geometry: THREE.BufferGeometry;
  /** Indices of the triangles of shadow-casting parts (null = none cast). */
  casterIndex: THREE.BufferAttribute | null;
}

function indexOf(g: THREE.BufferGeometry): ArrayLike<number> {
  const idx = g.getIndex();
  if (idx) return idx.array;
  const n = g.getAttribute("position").count;
  const a = new Uint32Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  return a;
}

/** Group ranges of a geometry (a geometry without groups is one group of material 0). */
function groupsOf(g: THREE.BufferGeometry, indexCount: number): THREE.GeometryGroup[] {
  if (g.groups.length) return g.groups;
  return [{ start: 0, count: indexCount, materialIndex: 0 }];
}

/**
 * Bake `parts` into one geometry: vertices transformed, groups contiguous
 * per material index. Returns null when there is nothing to draw.
 */
export function mergeByMaterial(parts: readonly MergePart[]): MergeResult | null {
  let verts = 0;
  const idxs: ArrayLike<number>[] = [];
  let maxMat = -1;
  for (const p of parts) {
    verts += p.geometry.getAttribute("position").count;
    const idx = indexOf(p.geometry);
    idxs.push(idx);
    for (const g of groupsOf(p.geometry, idx.length))
      maxMat = Math.max(maxMat, g.materialIndex ?? 0);
  }
  if (verts === 0) return null;
  const pos = new Float32Array(verts * 3);
  const nrm = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3);
  const bases: number[] = [];
  const nm = new THREE.Matrix3();
  let v0 = 0;
  for (const p of parts) {
    bases.push(v0);
    const g = p.geometry;
    const pa = g.getAttribute("position");
    const na = g.getAttribute("normal");
    const ca = g.getAttribute("color");
    const n = pa.count;
    const e = p.matrix ? p.matrix.elements : null;
    if (e) nm.getNormalMatrix(p.matrix!);
    const ne = nm.elements;
    for (let i = 0; i < n; i++) {
      const o = (v0 + i) * 3;
      const x = pa.getX(i);
      const y = pa.getY(i);
      const z = pa.getZ(i);
      if (e) {
        pos[o] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
        pos[o + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
        pos[o + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
      } else {
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
      }
      if (na) {
        let nx = na.getX(i);
        let ny = na.getY(i);
        let nz = na.getZ(i);
        if (e) {
          const tx = ne[0]! * nx + ne[3]! * ny + ne[6]! * nz;
          const ty = ne[1]! * nx + ne[4]! * ny + ne[7]! * nz;
          const tz = ne[2]! * nx + ne[5]! * ny + ne[8]! * nz;
          const l = Math.hypot(tx, ty, tz) || 1;
          nx = tx / l;
          ny = ty / l;
          nz = tz / l;
        }
        nrm[o] = nx;
        nrm[o + 1] = ny;
        nrm[o + 2] = nz;
      }
      if (ca) {
        col[o] = ca.getX(i);
        col[o + 1] = ca.getY(i);
        col[o + 2] = ca.getZ(i);
      } else {
        col[o] = col[o + 1] = col[o + 2] = 1;
      }
    }
    v0 += n;
  }
  let total = 0;
  let casters = 0;
  parts.forEach((p, i) => {
    total += idxs[i]!.length;
    if (p.castShadow) casters += idxs[i]!.length;
  });
  const big = verts > 65535;
  const index = big ? new Uint32Array(total) : new Uint16Array(total);
  const cast = casters > 0 ? (big ? new Uint32Array(casters) : new Uint16Array(casters)) : null;
  const geometry = new THREE.BufferGeometry();
  let w = 0;
  let cw = 0;
  for (let m = 0; m <= maxMat; m++) {
    const start = w;
    parts.forEach((p, pi) => {
      const idx = idxs[pi]!;
      const base = bases[pi]!;
      for (const g of groupsOf(p.geometry, idx.length)) {
        if ((g.materialIndex ?? 0) !== m) continue;
        const end = Math.min(idx.length, g.start + g.count);
        for (let k = g.start; k < end; k++) {
          const v = idx[k]! + base;
          index[w++] = v;
          if (cast && p.castShadow) cast[cw++] = v;
        }
      }
    });
    if (w > start) geometry.addGroup(start, w - start, m);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geometry.setIndex(new THREE.BufferAttribute(w === total ? index : index.slice(0, w), 1));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  const casterIndex = cast && cw > 0 ? new THREE.BufferAttribute(cast.slice(0, cw), 1) : null;
  return { geometry, casterIndex };
}

/** Geometry sharing `src`'s vertex buffers with its own index (e.g. casters only). */
export function shareVertices(
  src: THREE.BufferGeometry,
  index: THREE.BufferAttribute,
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) g.setAttribute(name, attr);
  g.setIndex(index);
  if (src.boundingSphere) g.boundingSphere = src.boundingSphere.clone();
  if (src.boundingBox) g.boundingBox = src.boundingBox.clone();
  return g;
}

/** Shadow-only mesh: single material (one draw), visible to the shadow pass only. */
export function shadowProxy(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.layers.set(SHADOW_LAYER);
  m.castShadow = true;
  m.receiveShadow = false;
  m.matrixAutoUpdate = false;
  m.name = "shadow-proxy";
  return m;
}

function matrixHash(e: ArrayLike<number>): string {
  let h = 0;
  for (let i = 0; i < 16; i++) h += e[i]! * (i * 7.31 + 1.17);
  return h.toFixed(4);
}

// ── Static tile batches ────────────────────────────────────────

interface Tile {
  mesh: THREE.Mesh;
  proxy: THREE.Mesh | null;
  sig: string;
}

/**
 * Per-floor static batch. `update()` needs up-to-date world matrices (call
 * it after `scene.updateMatrixWorld()`); it re-merges only changed tiles.
 */
export class StaticBatcher {
  readonly group = new THREE.Group();
  private readonly fixed = new Map<number, MergePart[]>();
  private readonly tiles = new Map<number, Tile>();
  private readonly rootInv = new THREE.Matrix4();

  constructor(
    private readonly root: THREE.Object3D,
    private readonly materials: THREE.Material[],
    private readonly shadowMaterial: THREE.Material,
    private readonly tileSize = 64,
  ) {
    this.group.name = "static-batch";
    root.add(this.group);
  }

  /** A part that is always shown (e.g. one decor placement), in root space. */
  addFixed(part: MergePart, x: number, z: number): void {
    const k = tileKey(x, z, this.tileSize);
    const list = this.fixed.get(k) ?? [];
    list.push(part);
    this.fixed.set(k, list);
  }

  /** Forget every tile signature: the next `update` re-merges all tiles (fixed parts changed). */
  invalidate(): void {
    for (const t of this.tiles.values()) t.sig = "";
  }

  /** Number of tile meshes (each costs one draw per material class). */
  get tileCount(): number {
    return this.tiles.size;
  }

  /** Re-merge tiles whose visible content changed. Returns the number rebuilt. */
  update(): number {
    this.rootInv.copy(this.root.matrixWorld).invert();
    const dynamic = new Map<number, { mesh: THREE.Mesh; matrix: THREE.Matrix4 }[]>();
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || batchFlag(o) !== "static") return;
      o.layers.set(HIDDEN_LAYER);
      if (!visibleUnder(o, this.root)) return;
      const matrix = new THREE.Matrix4().multiplyMatrices(this.rootInv, o.matrixWorld);
      const e = matrix.elements;
      const k = tileKey(e[12]!, e[14]!, this.tileSize);
      const list = dynamic.get(k) ?? [];
      list.push({ mesh: o, matrix });
      dynamic.set(k, list);
    });
    const keys = new Set<number>([...this.fixed.keys(), ...dynamic.keys(), ...this.tiles.keys()]);
    let rebuilt = 0;
    for (const k of keys) {
      const fixed = this.fixed.get(k) ?? [];
      const dyn = dynamic.get(k) ?? [];
      const sig =
        `${fixed.length}|` +
        dyn
          .map(
            (d) =>
              `${d.mesh.geometry.id}:${matrixHash(d.matrix.elements)}:${d.mesh.castShadow ? 1 : 0}`,
          )
          .join(",");
      const old = this.tiles.get(k);
      if (old && old.sig === sig) continue;
      rebuilt++;
      if (old) this.dropTile(k, old);
      const merged = mergeByMaterial([
        ...fixed,
        ...dyn.map((d) => ({
          geometry: d.mesh.geometry,
          matrix: d.matrix,
          castShadow: d.mesh.castShadow,
        })),
      ]);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged.geometry, this.materials);
      mesh.name = `static-tile ${k}`;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      let proxy: THREE.Mesh | null = null;
      if (merged.casterIndex) {
        proxy = shadowProxy(
          shareVertices(merged.geometry, merged.casterIndex),
          this.shadowMaterial,
        );
        this.group.add(proxy);
      }
      this.tiles.set(k, { mesh, proxy, sig });
    }
    return rebuilt;
  }

  private dropTile(k: number, t: Tile): void {
    this.group.remove(t.mesh);
    t.mesh.geometry.dispose();
    if (t.proxy) {
      this.group.remove(t.proxy);
      t.proxy.geometry.dispose();
    }
    this.tiles.delete(k);
  }

  dispose(): void {
    for (const [k, t] of [...this.tiles]) this.dropTile(k, t);
  }
}

// ── Auto instancing ────────────────────────────────────────────

interface InstanceSet {
  key: string;
  sources: THREE.Mesh[];
  mesh: THREE.InstancedMesh;
  proxy: THREE.InstancedMesh | null;
  capacity: number;
}

function materialKey(m: THREE.Material | THREE.Material[]): string {
  return Array.isArray(m) ? m.map((x) => x.uuid).join(",") : m.uuid;
}

/**
 * Per-floor instancer: flagged meshes sharing geometry + materials are drawn
 * as one InstancedMesh (singletons render normally). Call `markDirty()`
 * whenever flagged meshes may have been added/removed (the scan is a
 * traversal), and `update()` every frame after the world matrices are fresh.
 */
export class AutoInstancer {
  readonly group = new THREE.Group();
  private sets = new Map<string, InstanceSet>();
  private dirty = true;
  private readonly rootInv = new THREE.Matrix4();
  private readonly tmp = new THREE.Matrix4();
  private instanced = 0;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly shadowMaterial: THREE.Material,
  ) {
    this.group.name = "auto-instances";
    root.add(this.group);
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** InstancedMeshes in use (each costs one draw per material class). */
  get setCount(): number {
    return this.sets.size;
  }

  /** Source meshes drawn through instancing. */
  get sourceCount(): number {
    return this.instanced;
  }

  private rescan(): void {
    this.dirty = false;
    const byKey = new Map<string, THREE.Mesh[]>();
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return;
      if (batchFlag(o) !== "instance") return;
      const k = `${o.geometry.id}|${materialKey(o.material)}`;
      const list = byKey.get(k) ?? [];
      list.push(o);
      byKey.set(k, list);
    });
    this.instanced = 0;
    for (const [k, list] of byKey) {
      if (list.length < 2) {
        list[0]!.layers.set(0);
        continue;
      }
      this.instanced += list.length;
      for (const s of list) s.layers.set(HIDDEN_LAYER);
      let set = this.sets.get(k);
      if (set && set.capacity < list.length) {
        this.dropSet(set);
        set = undefined;
      }
      if (!set) set = this.createSet(k, list[0]!, Math.max(list.length, 4));
      set.sources = list;
    }
    for (const set of [...this.sets.values()]) if (!byKey.has(set.key)) this.dropSet(set);
    for (const [k, list] of byKey) if (list.length < 2) this.dropSetKey(k);
  }

  private dropSetKey(k: string): void {
    const s = this.sets.get(k);
    if (s) this.dropSet(s);
  }

  private createSet(key: string, first: THREE.Mesh, capacity: number): InstanceSet {
    const mesh = new THREE.InstancedMesh(first.geometry, first.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.matrixAutoUpdate = false;
    mesh.count = 0;
    mesh.name = `instances ${first.geometry.id}`;
    this.group.add(mesh);
    let proxy: THREE.InstancedMesh | null = null;
    if (first.castShadow) {
      proxy = new THREE.InstancedMesh(first.geometry, this.shadowMaterial, capacity);
      proxy.instanceMatrix = mesh.instanceMatrix;
      proxy.layers.set(SHADOW_LAYER);
      proxy.castShadow = true;
      proxy.receiveShadow = false;
      proxy.frustumCulled = false;
      proxy.matrixAutoUpdate = false;
      proxy.count = 0;
      this.group.add(proxy);
    }
    const set: InstanceSet = { key, sources: [], mesh, proxy, capacity };
    this.sets.set(key, set);
    return set;
  }

  private dropSet(set: InstanceSet): void {
    this.group.remove(set.mesh);
    set.mesh.dispose();
    if (set.proxy) {
      this.group.remove(set.proxy);
      set.proxy.dispose();
    }
    this.sets.delete(set.key);
  }

  update(): void {
    if (this.dirty) this.rescan();
    this.rootInv.copy(this.root.matrixWorld).invert();
    const identity = isIdentity(this.root.matrixWorld.elements);
    for (const set of this.sets.values()) {
      const arr = set.mesh.instanceMatrix.array as Float32Array;
      let n = 0;
      let changed = false;
      for (const s of set.sources) {
        if (!visibleUnder(s, this.root)) continue;
        const e = identity
          ? s.matrixWorld.elements
          : this.tmp.multiplyMatrices(this.rootInv, s.matrixWorld).elements;
        const o = n * 16;
        for (let i = 0; i < 16; i++) {
          const val = e[i]!;
          if (arr[o + i] !== val) {
            arr[o + i] = val;
            changed = true;
          }
        }
        n++;
      }
      if (n !== set.mesh.count) changed = true;
      set.mesh.count = n;
      set.mesh.visible = n > 0;
      if (set.proxy) {
        set.proxy.count = n;
        set.proxy.visible = n > 0;
      }
      if (changed) set.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const s of [...this.sets.values()]) this.dropSet(s);
  }
}

function isIdentity(e: ArrayLike<number>): boolean {
  for (let i = 0; i < 16; i++) if (e[i] !== (i % 5 === 0 ? 1 : 0)) return false;
  return true;
}
