/**
 * Chromium switches for the game's renderer (pure — no electron import, so
 * tests can check it). The lab is a WebGL2 game with skinned PBR characters
 * and post-processing: it should always land on the fast GPU.
 *
 *  - force_high_performance_gpu: dual-GPU Macs use the discrete GPU.
 *  - ignore-gpu-blocklist: keep hardware WebGL on drivers Chromium
 *    blocklists conservatively (otherwise the game falls back to SwiftShader
 *    and runs at a few fps).
 *  - enable-gpu-rasterization / enable-zero-copy: cheaper UI compositing.
 *  - Linux: let Ozone pick Wayland when the session has it (X11 otherwise;
 *    matches the Flatpak's wayland + fallback-x11 sockets). ANGLE keeps its
 *    default GL backend — Vulkan-ANGLE on Linux is still experimental.
 *
 * `UNLABS_SAFE_GPU=1` skips all of it (driver trouble on a player machine).
 */
export type GpuSwitch = readonly [name: string, value?: string];

export function gpuSwitches(
  platform: NodeJS.Platform,
  env: Readonly<Record<string, string | undefined>>,
): GpuSwitch[] {
  if (env.UNLABS_SAFE_GPU === "1") return [];
  const out: GpuSwitch[] = [
    ["ignore-gpu-blocklist"],
    ["enable-gpu-rasterization"],
    ["enable-zero-copy"],
  ];
  if (platform === "darwin") out.push(["force_high_performance_gpu"]);
  if (platform === "linux") out.push(["ozone-platform-hint", "auto"]);
  return out;
}
