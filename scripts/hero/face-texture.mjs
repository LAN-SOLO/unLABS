/**
 * Jade's face texture from the portrait (the user's reference photo).
 *
 *   node scripts/hero/face-texture.mjs [path/to/Portrait_lawrence_usc.jpg]
 *
 * Landmarks measured on the 1833×1375 portrait: pupils at (800, 680) and
 * (1070, 678) → face centre u0 = 935, 122.7 px per model voxel (pupils are
 * ±1.1 voxels apart in jade-sculpt.ts), eye line v0 = 679 (y = 56.55).
 * Output: public/hero/jade-face.webp, an 800×800 window around the face
 * (photo x 535…1335, y 380…1180) — the skin shader projects it front-on
 * (lib/world/render/hero/materials.ts, FACE_MAP).
 *
 * The photo is lit from the front-left with a red rim on the right: the
 * well-lit half (image left = Jade's right) is mirrored onto the other
 * side, then the broad shading is divided out (the scene lights her).
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const src =
  process.argv[2] ?? path.join(os.homedir(), "Desktop/JadeLawrence/Portrait_lawrence_usc.jpg");
const out = path.join(here, "../../public/hero/jade-face.webp");
const X0 = 535;
const Y0 = 380;
const N = 800;
const CX = 935 - X0; // face centre in the crop

const { data, info } = await sharp(src)
  .extract({ left: X0, top: Y0, width: N, height: N })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const C = info.channels;
const img = new Float32Array(N * N * 3);
for (let i = 0; i < N * N; i++) for (let c = 0; c < 3; c++) img[i * 3 + c] = data[i * C + c] / 255;

// 1. Mirror the lit half onto the shaded one (soft seam over 16 px at the centre line).
const sym = new Float32Array(img.length);
for (let y = 0; y < N; y++)
  for (let x = 0; x < N; x++) {
    const xm = Math.max(0, Math.min(N - 1, 2 * CX - x));
    const t = Math.max(0, Math.min(1, (x - CX + 8) / 16)); // 0 left of the seam, 1 right
    for (let c = 0; c < 3; c++) {
      const a = img[(y * N + x) * 3 + c];
      const b = img[(y * N + xm) * 3 + c];
      sym[(y * N + x) * 3 + c] = a * (1 - t) + b * t;
    }
  }

// 2. Divide out the broad shading: luminance against a wide blur (3 box passes ≈ Gaussian).
function boxBlur(src, r) {
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  const pass = (a, b, horiz) => {
    for (let j = 0; j < N; j++) {
      let acc = 0;
      const at = (i) =>
        horiz
          ? a[j * N + Math.max(0, Math.min(N - 1, i))]
          : a[Math.max(0, Math.min(N - 1, i)) * N + j];
      for (let i = -r; i <= r; i++) acc += at(i);
      for (let i = 0; i < N; i++) {
        if (horiz) b[j * N + i] = acc / (2 * r + 1);
        else b[i * N + j] = acc / (2 * r + 1);
        acc += at(i + r + 1) - at(i - r);
      }
    }
  };
  let a = src;
  for (let k = 0; k < 3; k++) {
    pass(a, tmp, true);
    pass(tmp, dst, false);
    a = dst.slice();
  }
  return a;
}
const lum = new Float32Array(N * N);
for (let i = 0; i < N * N; i++)
  lum[i] = 0.2126 * sym[i * 3] + 0.7152 * sym[i * 3 + 1] + 0.0722 * sym[i * 3 + 2];
const wide = boxBlur(lum, 28);
// Target: the mean of the cheek area (well inside the face).
let tsum = 0;
let tn = 0;
for (let y = 430; y < 520; y++)
  for (let x = 220; x < 330; x++) {
    tsum += wide[y * N + x];
    tn++;
  }
const target = tsum / tn;
// 3. White balance: the cheek's mean colour → the game's skin tone (look-colors.ts
//    "#f3cfbb", a touch paler), so the photo's pink/red studio light is gone.
const SKIN = [238 / 255, 206 / 255, 188 / 255];
const lit = new Float32Array(N * N * 3);
const mean = [0, 0, 0];
for (let i = 0; i < N * N; i++) {
  const k = Math.pow(target / Math.max(0.05, wide[i]), 0.75);
  for (let c = 0; c < 3; c++) lit[i * 3 + c] = sym[i * 3 + c] * k;
}
for (let y = 430; y < 520; y++)
  for (let x = 220; x < 330; x++)
    for (let c = 0; c < 3; c++) mean[c] += lit[(y * N + x) * 3 + c] / tn;
const gain = mean.map((m, c) => SKIN[c] / Math.max(0.05, m));
const outBuf = Buffer.alloc(N * N * 3);
for (let i = 0; i < N * N; i++)
  for (let c = 0; c < 3; c++)
    outBuf[i * 3 + c] = Math.max(0, Math.min(255, Math.round(lit[i * 3 + c] * gain[c] * 255)));
console.log("white balance gain", gain.map((g) => g.toFixed(2)).join(" "));
await sharp(outBuf, { raw: { width: N, height: N, channels: 3 } })
  .webp({ quality: 90 })
  .toFile(out);
console.log(`wrote ${out}`);
