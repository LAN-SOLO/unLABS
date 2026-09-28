import * as THREE from "three";
import type { MaterialClass, MeshData } from "@/lib/voxel/mesher";
import { MATERIAL_CLASSES } from "@/lib/voxel/mesher";

/** One shared material per class; vertex colors carry palette color + AO. */
export function createVoxelMaterials(): Record<MaterialClass, THREE.Material> {
  return {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.1,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
    // Emissive voxels ignore lighting; pair with UnrealBloomPass for glow.
    // HDR boost: emissive voxels exceed the bloom threshold, lit surfaces don't.
    emit: new THREE.MeshBasicMaterial({
      vertexColors: true,
      color: new THREE.Color(2.4, 2.4, 2.4),
    }),
  };
}

export function toGeometry(mesh: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  g.setAttribute("color", new THREE.BufferAttribute(mesh.colors, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  mesh.groups.forEach((grp) =>
    g.addGroup(grp.start, grp.count, MATERIAL_CLASSES.indexOf(grp.material)),
  );
  g.computeBoundingSphere();
  return g;
}

/** Mesh with a material array indexed like MATERIAL_CLASSES. */
export function toMesh(
  mesh: MeshData,
  materials: Record<MaterialClass, THREE.Material>,
): THREE.Mesh {
  const m = new THREE.Mesh(
    toGeometry(mesh),
    MATERIAL_CLASSES.map((c) => materials[c]),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Dispose geometry of a mesh tree (materials are shared — dispose them once at shutdown). */
export function disposeGeometry(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
