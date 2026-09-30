/** Lab safety, prototypes and terminal motifs. */
import {
  FONT,
  type Ink,
  barcode,
  burst,
  circle,
  frame,
  g,
  halftoneGlow,
  hazardStripes,
  line,
  poly,
  rect,
  rng,
  text,
  termWindow,
  warnTriangle,
} from "./kit.ts";
import { B4C0N, JADE, R3TR0, drawSprite } from "./sprites.ts";

const signYellow = (ink: Ink): string => (ink.light ? "#F2B705" : "#FFC400");
const signBlack = "#141414";

/** Warning sign: Please do not lick the anomalies. They lick back. */
export function doNotLick(ink: Ink): string {
  const cx = 165;
  let s = "";
  s += warnTriangle(cx, 22, 200, signYellow(ink), signBlack, 7);
  // Anomaly blob with a tongue.
  const blob = `<path d="M${cx - 42} 136 C ${cx - 50} 96, ${cx - 20} 78, ${cx} 88 C ${cx + 26} 74, ${cx + 50} 100, ${cx + 40} 136 C ${cx + 30} 156, ${cx - 30} 158, ${cx - 42} 136 Z" fill="${signBlack}"/>`;
  s += blob;
  s += circle(cx - 16, 112, 7, signYellow(ink)) + circle(cx - 14, 113, 3, signBlack);
  s += circle(cx + 16, 108, 9, signYellow(ink)) + circle(cx + 18, 110, 4, signBlack);
  s += `<path d="M${cx - 8} 138 Q ${cx} 170 ${cx + 12} 160 Q ${cx + 16} 148 ${cx + 10} 136 Z" fill="${ink.light ? "#E0457B" : "#FF5E8E"}"/>`;
  s += line(cx + 2, 142, cx + 6, 158, ink.light ? "#a3244f" : "#C2306A", 1.4);
  s += text(cx, 222, "PLEASE DO NOT LICK", {
    font: FONT.stencil,
    size: 27,
    fill: ink.fg,
    width: 290,
  });
  s += text(cx, 252, "THE ANOMALIES.", { font: FONT.stencil, size: 27, fill: ink.fg, width: 220 });
  s += text(cx, 284, "THEY LICK BACK.", {
    font: FONT.marker,
    size: 26,
    fill: ink.amber,
    width: 210,
  });
  s += text(cx, 304, "_unLAB SAFETY NOTICE · LEVEL −2", {
    font: FONT.mono,
    size: 7.8,
    fill: ink.dim,
  });
  return s;
}

/** Tools ready. Please count your fingers afterwards. (a six-fingered glove) */
export function countFingers(ink: Ink): string {
  const cx = 165;
  const glove = ink.light ? "#D98A00" : "#FFB800";
  const shade = ink.light ? "#9c6400" : "#C98A00";
  let s = hazardStripes("cf", 30, 24, 270, 14, glove, null, 10);
  // Palm + six fingers.
  s += rect(cx - 50, 110, 100, 86, glove, `rx="22"`);
  const fingers: [number, number, number][] = [
    [-44, 70, -10],
    [-26, 52, -4],
    [-8, 46, 0],
    [10, 48, 3],
    [28, 56, 7],
    [46, 76, 12],
  ];
  for (const [dx, top, rot] of fingers)
    s += g(
      rect(-8, 0, 16, 120 - top + 8, glove, `rx="8"`) + line(-3, 12, 3, 12, shade, 1.2),
      `translate(${cx + dx} ${top}) rotate(${rot})`,
    );
  s += g(rect(-9, 0, 18, 52, glove, `rx="9"`), `translate(${cx - 52} 142) rotate(-48)`);
  s += rect(cx - 50, 186, 100, 18, shade, `rx="4"`);
  for (let k = 0; k < 6; k++)
    s += text(
      cx - 44 + k * 17.6,
      88 - (k === 2 ? 30 : k === 1 || k === 3 ? 26 : 12),
      String(k + 1),
      { font: FONT.pixel, size: 7, fill: ink.fg },
    );
  s += text(cx, 238, "TOOLS READY.", { font: FONT.archivo, size: 28, fill: ink.fg, width: 250 });
  s += text(cx, 262, "PLEASE COUNT YOUR FINGERS", {
    font: FONT.mono,
    weight: 700,
    size: 13,
    fill: ink.green,
    width: 270,
  });
  s += text(cx, 280, "AFTERWARDS.", { font: FONT.mono, weight: 700, size: 13, fill: ink.green });
  s += hazardStripes("cf2", 30, 292, 270, 14, glove, null, 10);
  return s;
}

/** Laser online. Do not look into it. With your remaining eye. */
export function laserEye(ink: Ink): string {
  const cx = 165;
  let s = "";
  // Laser emitter on the left, beam across.
  s += halftoneGlow(70, 100, 60, ink.red, 3, 1.2, 8);
  s += rect(24, 84, 52, 32, ink.light ? "#555" : "#8C939B", `rx="4"`);
  s += rect(72, 90, 16, 20, ink.light ? "#333" : "#C9CED6", `rx="2"`);
  s += rect(88, 97, 214, 6, ink.red);
  s += rect(88, 99, 214, 2, ink.light ? "#ffd0c8" : "#FFE2DC");
  s += circle(30, 90, 2, ink.lime);
  // Eye patch smiley.
  const ey = 170;
  s += circle(cx, ey, 38, ink.amber);
  s += circle(cx - 13, ey - 8, 5, signBlack);
  s += poly(
    [
      [cx + 2, ey - 20],
      [cx + 28, ey - 20],
      [cx + 26, ey + 2],
      [cx + 6, ey + 2],
    ],
    signBlack,
  );
  s += line(cx - 38, ey - 28, cx + 38, ey - 8, signBlack, 2.4);
  s += `<path d="M${cx - 18} ${ey + 14} Q ${cx} ${ey + 26} ${cx + 18} ${ey + 14}" fill="none" stroke="${signBlack}" stroke-width="3.4" stroke-linecap="round"/>`;
  s += text(cx, 244, "LASER ONLINE.", { font: FONT.stencil, size: 30, fill: ink.fg, width: 260 });
  s += text(cx, 266, "DO NOT LOOK INTO IT.", {
    font: FONT.mono,
    weight: 700,
    size: 14,
    fill: ink.red,
    width: 260,
  });
  s += text(cx, 296, "with your remaining eye.", {
    font: FONT.marker,
    size: 20,
    fill: ink.amber,
    width: 240,
  });
  s += text(cx, 316, "LCT-001 PRECISION LASER · CLASS: YES", {
    font: FONT.mono,
    size: 7.6,
    fill: ink.dim,
  });
  return s;
}

/** Jade's goggles: safety goggles are mandatory, and the only goggles. */
export function goggles(ink: Ink): string {
  const cx = 165;
  const strap = ink.light ? "#3a2a1a" : "#6B4423";
  let s = "";
  s += rect(10, 92, 310, 18, strap, `rx="4"`);
  s += text(cx, 105, "J.L. — NOT FOR SOLAR ECLIPSES", {
    font: FONT.mono,
    weight: 700,
    size: 8.5,
    fill: ink.light ? "#F3D38A" : "#FFD98A",
    width: 200,
  });
  for (const dx of [-62, 62]) {
    s += circle(cx + dx, 100, 50, ink.light ? "#6b4a10" : "#8C6A1E");
    s += circle(cx + dx, 100, 43, ink.light ? "#9c6a00" : "#C98A00");
    s += circle(cx + dx, 100, 36, ink.amber);
    s += halftoneGlow(cx + dx - 10, 90, 30, "#FFFFFF", 2.6, 1.1, 0);
    s += circle(cx + dx + 14, 116, 5, ink.light ? "#FFE9A8" : "#FFF3C4");
  }
  s += rect(cx - 16, 88, 32, 16, ink.light ? "#6b4a10" : "#8C6A1E", `rx="6"`);
  s += text(cx, 200, "SAFETY GOGGLES", { font: FONT.archivo, size: 28, fill: ink.fg, width: 280 });
  s += text(cx, 224, "ARE MANDATORY.", { font: FONT.archivo, size: 28, fill: ink.fg, width: 250 });
  s += text(cx, 250, "SAFETY GOGGLES ARE ALSO THE ONLY GOGGLES.", {
    font: FONT.mono,
    weight: 700,
    size: 9.4,
    fill: ink.amber,
    width: 290,
  });
  s += text(cx, 272, "WE CHECKED.", { font: FONT.marker, size: 22, fill: ink.green });
  return s;
}

/** Built five prototypes today — lab log #0107. */
export function fivePrototypes(ink: Ink): string {
  let s = "";
  s += text(165, 46, "LAB LOG #0107", { font: FONT.pixel, size: 10, fill: ink.amber, width: 150 });
  s += text(165, 80, "BUILT FIVE PROTOTYPES TODAY.", {
    font: FONT.archivo,
    size: 17,
    fill: ink.fg,
    width: 300,
  });
  const y = 150;
  const xs = [45, 105, 165, 225, 285];
  for (let i = 0; i < 3; i++) {
    s += burst(xs[i]!, y, 12, 30, 11, ink.orange, 11 + i);
    s += burst(xs[i]!, y, 7, 18, 9, ink.amber, 21 + i);
    s += circle(xs[i]!, y, 6, ink.light ? "#FFE9A8" : "#FFF6D0");
  }
  // Works: a check.
  s += `<path d="M${xs[3]! - 18} ${y} L ${xs[3]! - 5} ${y + 14} L ${xs[3]! + 20} ${y - 16}" fill="none" stroke="${ink.green}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  // Something else: a question mark with eyes.
  s += text(xs[4]!, y + 16, "?", { font: FONT.archivo, size: 50, fill: ink.violet });
  s += circle(xs[4]! - 7, y - 26, 4, ink.hi) + circle(xs[4]! + 7, y - 28, 4, ink.hi);
  s += circle(xs[4]! - 6, y - 25, 1.8, signBlack) + circle(xs[4]! + 8, y - 27, 1.8, signBlack);
  const labels = ["BOOM", "BOOM", "BOOM", "WORKS", "???"];
  labels.forEach(
    (l, i) =>
      (s += text(xs[i]!, 206, l, {
        font: FONT.pixel,
        size: 7,
        fill: i < 3 ? ink.orange : i === 3 ? ink.green : ink.violet,
      })),
  );
  s += line(20, 222, 310, 222, ink.dim, 0.8);
  s += text(165, 246, "THREE EXPLODED. ONE WORKS.", {
    font: FONT.mono,
    weight: 700,
    size: 12.5,
    fill: ink.fg,
    width: 280,
  });
  s += text(165, 266, "ONE BECAME SOMETHING I DID NOT DESIGN.", {
    font: FONT.mono,
    weight: 700,
    size: 12.5,
    fill: ink.violet,
    width: 300,
  });
  s += text(165, 294, "The last one worries me.", { font: FONT.marker, size: 18, fill: ink.amber });
  s += text(165, 312, "— D.F.", { font: FONT.mono, size: 8, fill: ink.dim });
  return s;
}

/** B4C-0N: An explosion is just a very fast learning process! */
export function fastLearning(ink: Ink): string {
  const cx = 165;
  let s = "";
  s += burst(cx, 110, 58, 104, 16, ink.orange, 5);
  s += burst(cx, 110, 44, 78, 14, ink.amber, 6);
  s += burst(cx, 110, 30, 52, 12, ink.light ? "#FFE08A" : "#FFF1B8", 7);
  s += drawSprite(B4C0N, ink, cx, 140, 4.4);
  s += text(cx, 226, "AN EXPLOSION IS JUST A", {
    font: FONT.archivo,
    size: 18,
    fill: ink.fg,
    width: 290,
  });
  s += text(cx, 262, "VERY FAST", { font: FONT.shade, size: 36, fill: ink.amber, width: 270 });
  s += text(cx, 290, "LEARNING PROCESS!", {
    font: FONT.archivo,
    size: 22,
    fill: ink.fg,
    width: 290,
  });
  s += text(cx, 308, "— B4C-0N, relentless optimist", { font: FONT.mono, size: 8, fill: ink.dim });
  return s;
}

/** sudo: you are not in the sudoers file. */
export function sudoers(ink: Ink): string {
  let s = termWindow(20, 30, 290, 190, "jade@_unOS: ~", ink, ink.green);
  const lines: [string, string][] = [
    ["$ sudo make me a coffee", ink.fg],
    ["[sudo] password for jade:", ink.dim],
    ["", ink.fg],
    ["jade is not in the sudoers file.", ink.red],
    ["This incident will be reported.", ink.red],
    ["", ink.fg],
    ["$ whoami", ink.fg],
    ["the one who built the sudoers file", ink.amber],
    ["$ _", ink.green],
  ];
  lines.forEach(
    ([l, c], i) =>
      (s += text(32, 64 + i * 17.5, l, { font: FONT.term, size: 19, fill: c, anchor: "start" })),
  );
  s += rect(56, 199, 9, 14, ink.green);
  s += text(165, 252, "THIS INCIDENT", { font: FONT.archivo, size: 26, fill: ink.fg, width: 240 });
  s += text(165, 282, "WILL BE REPORTED.", {
    font: FONT.archivo,
    size: 26,
    fill: ink.fg,
    width: 290,
  });
  return s;
}

/** Boot log back print (the title-screen BIOS). */
export function bootLog(ink: Ink): string {
  let s = "";
  s += text(165, 40, "_unOS BIOS", { font: FONT.pixel, size: 20, fill: ink.green, width: 240 });
  s += text(165, 58, "UNSTABLELABS UNDERGROUND FACILITY", {
    font: FONT.mono,
    weight: 700,
    size: 9,
    fill: ink.dim,
    width: 250,
  });
  const log: [string, string][] = [
    ["COLD START PROTOCOL … initiated", ink.green],
    ["Dormancy: 2,561 days", ink.amber],
    ["Residual charge: 0.3 %", ink.amber],
    ["Geothermal borehole … no response", ink.green],
    ["MCP-000 … responding (reluctantly)", ink.red],
    ["Cryo pod J. Lawrence … opened", ink.green],
    ["Searching for D. Fridge … no signal", ink.cyan],
    ["Halo layer … noise. Or not.", ink.violet],
    ["Coffee machine … NOT FOUND", ink.red],
    ["Ready.", ink.fg],
  ];
  log.forEach(([l, c], i) => {
    const y = 100 + i * 27;
    s += text(20, y, `[${String(i).padStart(2, "0")}]`, {
      font: FONT.term,
      size: 20,
      fill: ink.dim,
      anchor: "start",
    });
    s += text(56, y, l, {
      font: FONT.term,
      size: 20,
      fill: c,
      anchor: "start",
      width: Math.min(254, l.length * 8.1),
    });
  });
  s += rect(56, 100 + 10 * 27 - 15, 10, 17, ink.green);
  s += line(20, 400, 310, 400, ink.green, 1);
  s += text(165, 424, "WELCOME BACK, DR. LAWRENCE.", {
    font: FONT.pixel,
    size: 10,
    fill: ink.fg,
    width: 290,
  });
  s += text(165, 442, "PLEASE DO NOT PANIC. THE KERNEL DOES THAT FOR YOU.", {
    font: FONT.mono,
    size: 7.4,
    fill: ink.dim,
    width: 290,
  });
  return s;
}

/** 400 Bad Request. The request was you. */
export function badRequest(ink: Ink): string {
  let s = "";
  s += text(165, 150, "400", {
    font: FONT.chunky,
    size: 118,
    fill: ink.fg,
    width: 300,
    squash: true,
  });
  s += rect(15, 162, 300, 30, ink.red);
  s += text(165, 184, "BAD REQUEST", {
    font: FONT.pixel,
    size: 19,
    fill: ink.light ? "#fff" : "#141414",
    width: 270,
  });
  s += text(165, 226, "The request was you.", {
    font: FONT.marker,
    size: 28,
    fill: ink.amber,
    width: 270,
  });
  s += text(165, 248, "FAILED. STATUS 400. — MCP-000", {
    font: FONT.mono,
    size: 8.5,
    fill: ink.dim,
  });
  return s;
}

/** Level −4: Error 404. */
export function level404(ink: Ink): string {
  let s = "";
  // Stacked floors, the last one glitching.
  const floors = ["+1", "0", "−1", "−2", "−3"];
  floors.forEach((f, i) => {
    const y = 34 + i * 26;
    s += rect(70, y, 190, 18, i === 0 ? ink.dim : ink.light ? "#8a8f8a" : "#39403A", `rx="2"`);
    s += text(84, y + 13.5, f, { font: FONT.pixel, size: 9, fill: ink.fg, anchor: "start" });
  });
  const y4 = 34 + 5 * 26;
  const rnd = rng(404);
  for (let k = 0; k < 16; k++)
    s += rect(70 + rnd() * 180, y4 + rnd() * 16, 4 + rnd() * 16, 2.4, k % 2 ? ink.red : ink.cyan);
  s += text(84, y4 + 13.5, "−4", { font: FONT.pixel, size: 9, fill: ink.red, anchor: "start" });
  s += rect(160, y4 + 20, 18, 30, ink.amber, `rx="2"`); // you are here
  s += circle(169, y4 + 12, 6, ink.amber);
  s += text(200, y4 + 44, "← YOU", { font: FONT.pixel, size: 8, fill: ink.amber, anchor: "start" });
  s += text(165, 262, "ERROR 404", { font: FONT.chunky, size: 36, fill: ink.fg, width: 290 });
  s += text(165, 286, "LEVEL −4 NOT IN MY PLANS.", {
    font: FONT.mono,
    weight: 700,
    size: 14,
    fill: ink.red,
    width: 290,
  });
  s += text(165, 312, "You're standing on it anyway.", {
    font: FONT.marker,
    size: 19,
    fill: ink.amber,
  });
  return s;
}

/** Residual charge 0.3 % battery. */
export function residualCharge(ink: Ink): string {
  const x = 50;
  const y = 50;
  let s = "";
  s += rect(x, y, 210, 100, ink.fg, `rx="12"`);
  s += rect(x + 8, y + 8, 194, 84, ink.light ? "#F3F3F1" : "#141414", `rx="6"`);
  s += rect(x + 210, y + 30, 18, 40, ink.fg, `rx="4"`);
  s += rect(x + 14, y + 14, 5, 72, ink.red, `rx="1"`);
  s += text(x + 110, y + 64, "0.3 %", { font: FONT.pixel, size: 26, fill: ink.red });
  s += text(165, 196, "RESIDUAL CHARGE", {
    font: FONT.archivo,
    size: 26,
    fill: ink.fg,
    width: 280,
  });
  s += text(165, 222, "I AM SAVING ENERGY BY", {
    font: FONT.mono,
    weight: 700,
    size: 13,
    fill: ink.green,
    width: 240,
  });
  s += text(165, 240, "BEING LESS SARCASTIC.", {
    font: FONT.mono,
    weight: 700,
    size: 13,
    fill: ink.green,
    width: 240,
  });
  s += text(165, 262, "(it is not working)", { font: FONT.marker, size: 16, fill: ink.amber });
  return s;
}

/** Canteen menu board: today the canteen recommends nothing. */
export function canteen(ink: Ink): string {
  const board = ink.light ? "#1f2a22" : "#16261B";
  const chalk = "#EEF2E8";
  let s = "";
  s += rect(28, 26, 274, 250, ink.light ? "#6b4423" : "#8B5A36", `rx="8"`);
  s += rect(38, 36, 254, 230, board, `rx="4"`);
  s += text(165, 76, "CANTEEN", { font: FONT.marker, size: 34, fill: chalk, width: 190 });
  s += text(165, 98, "LEVEL −2 · TODAY'S SPECIAL", { font: FONT.mono, size: 8.4, fill: "#A8C2A8" });
  s += line(70, 110, 260, 110, chalk, 1, `stroke-dasharray="4 3"`);
  s += text(165, 150, "Nothing.", { font: FONT.marker, size: 40, fill: "#FFD36B" });
  s += text(165, 184, "The nothing is", { font: FONT.marker, size: 20, fill: chalk });
  s += text(165, 208, "gluten-free.", { font: FONT.marker, size: 24, fill: "#8CFF8C" });
  s += text(80, 246, "0,00 €", { font: FONT.marker, size: 16, fill: chalk, anchor: "start" });
  s += text(250, 246, "vegan ✓", { font: FONT.marker, size: 16, fill: chalk, anchor: "end" });
  s += text(165, 300, "TODAY THE CANTEEN RECOMMENDS: NOTHING.", {
    font: FONT.mono,
    weight: 700,
    size: 9,
    fill: ink.fg,
    width: 280,
  });
  return s;
}

/** R3-TR0: In my day everything ran at 4.77 megahertz. */
export function r3tr0Mhz(ink: Ink): string {
  let s = "";
  s += drawSprite(R3TR0, ink, 165, 150, 7.4);
  s += text(165, 190, "IN MY DAY", { font: FONT.pixel, size: 18, fill: ink.fg, width: 200 });
  s += text(165, 214, "EVERYTHING RAN AT", {
    font: FONT.pixel,
    size: 12,
    fill: ink.fg,
    width: 260,
  });
  s += text(165, 266, "4.77 MHz", { font: FONT.chunky, size: 44, fill: ink.green, width: 290 });
  s += text(165, 290, "AND WE WERE GRATEFUL.", {
    font: FONT.mono,
    weight: 700,
    size: 11,
    fill: ink.amber,
    width: 220,
  });
  s += text(165, 308, "— R3-TR0 · GUIs DON'T EXIST", { font: FONT.mono, size: 8, fill: ink.dim });
  return s;
}

/** Hoodie: Energy saving measure active. Please think more quietly. */
export function thinkQuietly(ink: Ink): string {
  let s = "";
  // Big "quiet" brain bulb: a light bulb with a volume slider.
  const cx = 70;
  s += halftoneGlow(cx, 110, 64, ink.amber, 3, 1.2, 26);
  s += circle(cx, 104, 36, ink.amber);
  s += rect(cx - 16, 136, 32, 22, ink.light ? "#777" : "#9AA39A", `rx="3"`);
  for (let k = 0; k < 3; k++)
    s += line(cx - 16, 142 + k * 6, cx + 16, 142 + k * 6, ink.light ? "#444" : "#5a605a", 1.4);
  s += text(cx, 116, "zZ", { font: FONT.pixel, size: 16, fill: "#141414" });
  s += text(130, 92, "ENERGY SAVING", {
    font: FONT.archivo,
    size: 22,
    fill: ink.fg,
    anchor: "start",
    width: 186,
  });
  s += text(130, 116, "MEASURE ACTIVE.", {
    font: FONT.archivo,
    size: 22,
    fill: ink.fg,
    anchor: "start",
    width: 186,
  });
  s += text(130, 150, "PLEASE THINK", {
    font: FONT.mono,
    weight: 700,
    size: 17,
    fill: ink.green,
    anchor: "start",
    width: 186,
  });
  s += text(130, 172, "MORE QUIETLY.", {
    font: FONT.mono,
    weight: 700,
    size: 17,
    fill: ink.green,
    anchor: "start",
    width: 186,
  });
  // Volume slider at 0.3.
  s += rect(130, 190, 186, 6, ink.dim, `rx="3"`);
  s += rect(130, 190, 12, 6, ink.amber, `rx="3"`);
  s += circle(142, 193, 7, ink.amber);
  s += text(316, 212, "THOUGHT VOLUME 0.3 %", {
    font: FONT.mono,
    size: 7.4,
    fill: ink.dim,
    anchor: "end",
  });
  s += barcode(20, 250, 110, 10, ink.dim, 3);
  s += text(316, 258, "— MCP-000", { font: FONT.mono, size: 8, fill: ink.red, anchor: "end" });
  return s;
}

/** Hoodie: Jade + her goggles, "Cold start" — night shift at 03:27. */
export function nightShift(ink: Ink): string {
  let s = "";
  s += drawSprite(JADE, ink, 62, 250, 7.6);
  s += text(128, 70, "NIGHT SHIFT", {
    font: FONT.pixel,
    size: 16,
    fill: ink.amber,
    anchor: "start",
    width: 188,
  });
  s += text(128, 140, "03:27", {
    font: FONT.chunky,
    size: 54,
    fill: ink.fg,
    anchor: "start",
    width: 190,
  });
  s += text(128, 170, "COHERENCE σ-15", {
    font: FONT.mono,
    weight: 700,
    size: 13,
    fill: ink.cyan,
    anchor: "start",
    width: 188,
  });
  s += frame(128, 186, 188, 52, ink.green, 1.2);
  s += text(138, 206, "SYNAPSIS SYNC", {
    font: FONT.mono,
    weight: 700,
    size: 8,
    fill: ink.dim,
    anchor: "start",
  });
  s += text(138, 226, "J.L. 97.3 %", {
    font: FONT.term,
    size: 16,
    fill: ink.green,
    anchor: "start",
  });
  s += text(310, 226, "D.F. 94.8 %", { font: FONT.term, size: 16, fill: ink.cyan, anchor: "end" });
  s += text(128, 262, "NOTHING GOOD HAPPENS AFTER 3 AM. EXCEPT SCIENCE.", {
    font: FONT.mono,
    size: 6.4,
    fill: ink.dim,
    anchor: "start",
    width: 188,
  });
  return s;
}
