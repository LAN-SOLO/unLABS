import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CameraRig, VIEW_MODES, type ViewMode } from '@/render/cameras';
import { createVoxelMaterials } from '@/render/voxel-mesh';
import { WorldRenderer } from '@/render/world-renderer';
import { loadLevel } from '@/level/level';
import { Input } from '@/game/input';
import { Player } from '@/game/player';
import { raycastVoxels } from '@/voxel/raycast';
import { overlapsSolid } from '@/voxel/collision';
import { VoxelGrid } from '@/voxel/grid';
import { bakeIsoSprite } from '@/iso/iso-baker';

const params = new URLSearchParams(location.search);
const levelUrl = params.get('level') ?? '/levels/island.json';
const hud = document.getElementById('hud')!;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in r18x
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#8ec5ff');
// Metal voxels reflect the environment — without one they render black.
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new THREE.HemisphereLight('#dfefff', '#4a3b2a', 1.1));
const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, sun.target);

const materials = createVoxelMaterials();
const level = await loadLevel(levelUrl, materials);
const { world } = level;
const worldRenderer = new WorldRenderer(world, level.palette, materials, level.materialOf);
worldRenderer.syncAll();
scene.add(worldRenderer.root, level.props);

// Shadow camera covers the whole level.
const half = Math.max(world.sx, world.sz) / 2;
Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: half * 6 });
sun.position.set(world.sx / 2 + half, half * 2.5, world.sz / 2 + half * 0.6);
sun.target.position.set(world.sx / 2, 0, world.sz / 2);

const rig = new CameraRig(innerWidth / innerHeight);
rig.mode = (params.get('view') as ViewMode | null) ?? level.def.view ?? 'perspective';
rig.distance = 22;
rig.zoom = Math.max(24, half * 1.2);

const input = new Input();
const player = new Player(level.def.spawn);
const playerMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 1.7, 0.6).translate(0, 0.85, 0),
  new THREE.MeshStandardMaterial({ color: '#ff6b3d' }),
);
playerMesh.castShadow = true;
scene.add(playerMesh);

// Block placing: left click removes, right click places the selected palette index.
let selected = 1;
const cursor = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
  new THREE.LineBasicMaterial({ color: '#ffffff' }),
);
scene.add(cursor);
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
addEventListener('pointermove', (e) => pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointerdown', (e) => {
  const hit = pick();
  if (!hit) return;
  if (e.button === 0) world.set(hit.voxel[0], hit.voxel[1], hit.voxel[2], 0);
  if (e.button === 2) {
    const [x, y, z] = [hit.voxel[0] + hit.normal[0], hit.voxel[1] + hit.normal[1], hit.voxel[2] + hit.normal[2]];
    world.set(x, y, z, selected);
    // Never trap the player inside a new block.
    if (overlapsSolid(level.solids, player.box)) world.set(x, y, z, 0);
  }
});
addEventListener('wheel', (e) => {
  if (rig.mode === 'perspective') rig.distance = THREE.MathUtils.clamp(rig.distance * (1 + e.deltaY * 0.001), 5, 120);
  else rig.zoom = THREE.MathUtils.clamp(rig.zoom * (1 + e.deltaY * 0.001), 8, 200);
});
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  rig.resize(innerWidth / innerHeight);
});

function pick() {
  raycaster.setFromCamera(pointer, rig.camera);
  const { origin, direction } = raycaster.ray;
  // Orthographic rays start far away; the DDA handles that fine with a long max distance.
  return raycastVoxels(world, [origin.x, origin.y, origin.z], [direction.x, direction.y, direction.z], 2000);
}

function downloadIsoSprite(): void {
  const grid = new VoxelGrid(world.sx, world.sy, world.sz);
  for (let z = 0; z < world.sz; z++)
    for (let y = 0; y < world.sy; y++)
      for (let x = 0; x < world.sx; x++) {
        const v = world.get(x, y, z);
        if (v) grid.set(x, y, z, v);
      }
  const sprite = bakeIsoSprite(grid, level.palette, { scale: 4, outline: true });
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  canvas.getContext('2d')!.putImageData(new ImageData(sprite.data, sprite.width, sprite.height), 0, 0);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${level.def.name.replace(/\W+/g, '-').toLowerCase()}-iso.png`;
    a.click();
  });
}

// Dev-only handle for debugging and browser automation: window.game.player.position etc.
if (import.meta.env.DEV) Object.assign(window, { game: { level, world, player, rig, scene, renderer } });

const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
renderer.setAnimationLoop((now) => {
  acc = Math.min(acc + (now - last) / 1000, 0.25);
  last = now;

  VIEW_MODES.forEach((m, i) => { if (input.wasPressed(`Digit${i + 1}`)) rig.mode = m; });
  if (input.wasPressed('KeyQ')) rig.rotateQuarter(-1);
  if (input.wasPressed('KeyE')) rig.rotateQuarter(1);
  if (input.wasPressed('KeyB')) downloadIsoSprite();
  for (let i = 0; i < 9; i++) if (input.wasPressed(`Numpad${i + 1}`)) selected = i + 1;
  if (input.wasPressed('BracketRight')) selected = Math.min(255, selected + 1);
  if (input.wasPressed('BracketLeft')) selected = Math.max(1, selected - 1);

  // Movement relative to the camera's horizontal facing.
  const f = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
  const s = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
  if (input.isDown('ArrowLeft')) rig.yaw += 0.03;
  if (input.isDown('ArrowRight')) rig.yaw -= 0.03;
  const fx = -Math.sin(rig.yaw), fz = -Math.cos(rig.yaw);
  let mx = fx * f - fz * s, mz = fz * f + fx * s;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }

  while (acc >= STEP) {
    player.update(level.solids, { move: [mx, mz], jump: input.isDown('Space') }, STEP);
    acc -= STEP;
  }
  if (player.position[1] < -20) player.box.min.splice(0, 3, level.def.spawn[0], level.def.spawn[1], level.def.spawn[2]);

  const [px, py, pz] = player.position;
  playerMesh.position.set(px, py, pz);
  rig.target.set(px, py + 1, pz);
  rig.update();

  const hit = pick();
  cursor.visible = !!hit;
  if (hit) cursor.position.set(hit.voxel[0] + 0.5, hit.voxel[1] + 0.5, hit.voxel[2] + 0.5);

  worldRenderer.sync();
  renderer.render(scene, rig.camera);
  input.endFrame();

  hud.textContent =
    `${level.def.name} — view: ${rig.mode} [1-4]  rotate: Q/E ←/→  move: WASD Space\n` +
    `LMB remove · RMB place color ${selected} ([ ])  · B iso PNG`;
  hud.style.whiteSpace = 'pre';
});
