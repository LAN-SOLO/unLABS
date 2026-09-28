import * as THREE from 'three';

export type ViewMode = 'perspective' | 'iso' | 'dimetric' | 'topdown';
export const VIEW_MODES: readonly ViewMode[] = ['perspective', 'iso', 'dimetric', 'topdown'];

/** Elevation angles of the orthographic views. */
export const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // 35.264° — true isometric
export const DIMETRIC_ELEVATION = Math.atan(0.5); // 26.565° — 2:1 pixel-art "isometric"

/**
 * One rig for all views. Orthographic views keep a fixed direction and follow
 * `target`; `zoom` is the number of world units visible vertically.
 */
export class CameraRig {
  readonly perspective: THREE.PerspectiveCamera;
  readonly ortho: THREE.OrthographicCamera;
  mode: ViewMode = 'perspective';
  readonly target = new THREE.Vector3();
  /** Horizontal angle around the target (radians). 45° gives the classic iso corner view. */
  yaw = Math.PI / 4;
  pitch = 0.6;
  distance = 40;
  zoom = 40;

  constructor(private aspect: number) {
    this.perspective = new THREE.PerspectiveCamera(50, aspect, 0.1, 2000);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
    this.update();
  }

  get camera(): THREE.Camera {
    return this.mode === 'perspective' ? this.perspective : this.ortho;
  }

  resize(aspect: number): void {
    this.aspect = aspect;
    this.update();
  }

  /** Rotate orthographic views in 90° steps so the pixel grid stays aligned. */
  rotateQuarter(dir: 1 | -1): void {
    this.yaw += (dir * Math.PI) / 2;
  }

  update(): void {
    const elevation =
      this.mode === 'iso' ? ISO_ELEVATION
      : this.mode === 'dimetric' ? DIMETRIC_ELEVATION
      : this.mode === 'topdown' ? Math.PI / 2 - 1e-4
      : this.pitch;
    const dir = new THREE.Vector3(
      Math.cos(elevation) * Math.sin(this.yaw),
      Math.sin(elevation),
      Math.cos(elevation) * Math.cos(this.yaw),
    );
    if (this.mode === 'perspective') {
      const cam = this.perspective;
      cam.aspect = this.aspect;
      cam.position.copy(this.target).addScaledVector(dir, this.distance);
      cam.lookAt(this.target);
      cam.updateProjectionMatrix();
    } else {
      const cam = this.ortho;
      const h = this.zoom / 2;
      cam.left = -h * this.aspect; cam.right = h * this.aspect; cam.top = h; cam.bottom = -h;
      cam.position.copy(this.target).addScaledVector(dir, 500);
      // Top-down: keep "north" (-Z) up on screen.
      cam.up.set(0, 1, 0);
      if (this.mode === 'topdown') cam.up.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      cam.lookAt(this.target);
      cam.updateProjectionMatrix();
    }
  }
}
