/**
 * Motif registry: every design is drawn in millimetres on its Shirtigo print
 * area. `light: true` → also rendered with the light-garment ink; `inks`
 * lists the ink sets explicitly (incl. `pop` / `pastel` for coloured
 * garments) and wins over `light`.
 */
import type { Ink } from "./kit.ts";
import type { InkId } from "../../lib/world/merch-garments.ts";
import * as bots from "./designs-bots.ts";
import * as brand from "./designs-brand.ts";
import * as color from "./designs-color.ts";
import * as crew from "./designs-crew.ts";
import * as lab from "./designs-lab.ts";

export type AreaId = "shirt-front" | "shirt-back" | "hoodie-front" | "hoodie-back" | "kids-front";

export interface Area {
  w: number;
  h: number;
  garment: "shirt" | "hoodie" | "kids";
  side: "front" | "back";
  folder: string;
}

export const AREAS: Record<AreaId, Area> = {
  "shirt-front": {
    w: 330,
    h: 450,
    garment: "shirt",
    side: "front",
    folder: "Shirt_Vorne_330x450mm",
  },
  "shirt-back": {
    w: 330,
    h: 450,
    garment: "shirt",
    side: "back",
    folder: "Shirt_Hinten_330x450mm",
  },
  "hoodie-front": {
    w: 330,
    h: 280,
    garment: "hoodie",
    side: "front",
    folder: "Hoodie_Vorne_330x280mm",
  },
  "hoodie-back": {
    w: 330,
    h: 450,
    garment: "hoodie",
    side: "back",
    folder: "Hoodie_Hinten_330x450mm",
  },
  "kids-front": { w: 240, h: 360, garment: "kids", side: "front", folder: "Kids_Vorne_240x360mm" },
};

export interface Design {
  id: string;
  title: string;
  area: AreaId;
  light?: boolean;
  inks?: readonly InkId[];
  draw(ink: Ink): string;
}

/** Ink sets a design is rendered in. */
export function designInks(d: Design): readonly InkId[] {
  return d.inks ?? (d.light ? ["dark", "light"] : ["dark"]);
}

const ALL: readonly InkId[] = ["dark", "light", "pop", "pastel"];

export const DESIGNS: readonly Design[] = [
  {
    id: "logo-classic",
    title: "_unLAB Classic",
    area: "shirt-front",
    inks: ALL,
    draw: brand.logoClassic,
  },
  {
    id: "logo-wide",
    title: "_unLAB Wide",
    area: "hoodie-front",
    inks: ALL,
    draw: brand.logoWide,
  },
  { id: "unstable-glitch", title: "UNSTABLE", area: "shirt-front", draw: brand.unstableGlitch },
  {
    id: "mcp-reluctantly",
    title: "Responding (reluctantly)",
    area: "shirt-front",
    light: true,
    draw: brand.mcpReluctantly,
  },
  {
    id: "mcp-3-percent",
    title: "I had put 3 % on you",
    area: "shirt-front",
    light: true,
    draw: brand.mcp3Percent,
  },
  {
    id: "nobody-ordered",
    title: "Nobody ordered this",
    area: "shirt-front",
    light: true,
    draw: brand.nobodyOrdered,
  },
  { id: "crystal-0089", title: "Crystal #0089", area: "shirt-back", draw: brand.crystal0089 },
  {
    id: "element-un",
    title: "Element of Surprise",
    area: "shirt-front",
    inks: ALL,
    draw: brand.elementUn,
  },
  {
    id: "inverted",
    title: "It is inverted",
    area: "shirt-front",
    inks: ALL,
    draw: brand.inverted,
  },
  {
    id: "do-not-lick",
    title: "Do not lick the anomalies",
    area: "shirt-front",
    inks: ALL,
    draw: lab.doNotLick,
  },
  {
    id: "count-fingers",
    title: "Count your fingers",
    area: "shirt-front",
    light: true,
    draw: lab.countFingers,
  },
  {
    id: "laser-eye",
    title: "With your remaining eye",
    area: "shirt-front",
    light: true,
    draw: lab.laserEye,
  },
  { id: "goggles", title: "Safety goggles", area: "shirt-front", light: true, draw: lab.goggles },
  {
    id: "five-prototypes",
    title: "Five prototypes",
    area: "shirt-front",
    light: true,
    draw: lab.fivePrototypes,
  },
  {
    id: "fast-learning",
    title: "Very fast learning process",
    area: "shirt-front",
    light: true,
    draw: lab.fastLearning,
  },
  { id: "sudoers", title: "Not in the sudoers file", area: "shirt-front", draw: lab.sudoers },
  { id: "boot-log", title: "Cold start boot log", area: "shirt-back", draw: lab.bootLog },
  {
    id: "bad-request",
    title: "400 Bad Request",
    area: "shirt-front",
    light: true,
    draw: lab.badRequest,
  },
  {
    id: "level-404",
    title: "Level −4 not found",
    area: "shirt-front",
    inks: ALL,
    draw: lab.level404,
  },
  {
    id: "residual-charge",
    title: "Residual charge 0.3 %",
    area: "shirt-front",
    light: true,
    draw: lab.residualCharge,
  },
  {
    id: "canteen",
    title: "The nothing is gluten-free",
    area: "shirt-front",
    light: true,
    draw: lab.canteen,
  },
  { id: "r3tr0-mhz", title: "4.77 MHz", area: "shirt-front", light: true, draw: lab.r3tr0Mhz },
  {
    id: "think-quietly",
    title: "Please think more quietly",
    area: "hoodie-front",
    inks: ALL,
    draw: lab.thinkQuietly,
  },
  { id: "night-shift", title: "Night shift 03:27", area: "hoodie-front", draw: lab.nightShift },
  {
    id: "tour-front",
    title: "_unstables Tour (front)",
    area: "shirt-front",
    light: true,
    draw: crew.tourFront,
  },
  {
    id: "tour-back",
    title: "_unstables Tour (back)",
    area: "shirt-back",
    light: true,
    draw: crew.tourBack,
  },
  {
    id: "bot-lineup",
    title: "Reactivate all 10",
    area: "hoodie-front",
    light: true,
    draw: crew.botLineup,
  },
  {
    id: "between-measurements",
    title: "Between your measurements",
    area: "hoodie-front",
    draw: crew.betweenMeasurements,
  },
  {
    id: "halo-intent",
    title: "The Halo responds to intent",
    area: "shirt-front",
    light: true,
    draw: crew.haloIntent,
  },
  {
    id: "damien-echo",
    title: "Resonance pattern D.F.",
    area: "hoodie-back",
    draw: crew.damienEcho,
  },
  {
    id: "hoodie-crystal",
    title: "Crystal #0089 (hoodie back)",
    area: "hoodie-back",
    draw: brand.crystal0089,
  },
  {
    id: "hoodie-boot-log",
    title: "Boot log (hoodie back)",
    area: "hoodie-back",
    draw: lab.bootLog,
  },
  {
    id: "kids-junior",
    title: "Junior Lab Assistant",
    area: "kids-front",
    light: true,
    draw: crew.kidsJunior,
  },
  {
    id: "kids-prototype",
    title: "Please do not eat",
    area: "kids-front",
    light: true,
    draw: crew.kidsPrototype,
  },
  {
    id: "kids-collect",
    title: "Collect all 10",
    area: "kids-front",
    light: true,
    draw: crew.kidsCollect,
  },
  {
    id: "kids-finder",
    title: "Finder of lost socks",
    area: "kids-front",
    light: true,
    draw: crew.kidsFinder,
  },
  // ── Colour drop 2026-09: made for coloured garments too ──
  {
    id: "crystal-variants",
    title: "Know your crystal",
    area: "shirt-back",
    light: true,
    draw: color.crystalVariants,
  },
  {
    id: "hoodie-crystal-variants",
    title: "Know your crystal (hoodie back)",
    area: "hoodie-back",
    light: true,
    draw: color.crystalVariants,
  },
  { id: "status-418", title: "Status 418", area: "shirt-front", inks: ALL, draw: color.status418 },
  {
    id: "sporting",
    title: "From low to sporting",
    area: "shirt-front",
    inks: ALL,
    draw: color.sporting,
  },
  {
    id: "not-pets",
    title: "Anomalies are not pets",
    area: "shirt-front",
    inks: ALL,
    draw: color.notPets,
  },
  {
    id: "inventory-2019",
    title: "Last inventory 2019",
    area: "shirt-front",
    inks: ALL,
    draw: color.inventory,
  },
  {
    id: "hot-surfaces",
    title: "Hot surfaces are hot",
    area: "shirt-front",
    inks: ALL,
    draw: color.hotSurfaces,
  },
  {
    id: "tools-dusty",
    title: "Workshop report",
    area: "shirt-front",
    inks: ALL,
    draw: color.toolsDusty,
  },
  {
    id: "quiet-hours",
    title: "Quiet hours abolished",
    area: "hoodie-front",
    inks: ALL,
    draw: color.quietHours,
  },
  {
    id: "dont-unplug",
    title: "Don't unplug anything that looks like me",
    area: "hoodie-front",
    inks: ["dark", "light", "pastel"],
    draw: color.dontUnplug,
  },
  { id: "forge", title: "Infinity Forge", area: "hoodie-back", inks: ALL, draw: color.forge },
  {
    id: "basement",
    title: "The basement with ambitions",
    area: "hoodie-back",
    inks: ALL,
    draw: color.basement,
  },
  { id: "bot-depot", title: "Bot depot", area: "hoodie-back", inks: ALL, draw: color.botDepot },
  // ── Drop 3 2026-09-30: bot squad, drawn from the hi-res voxel models ──
  {
    id: "mcp-off-on",
    title: "Turn yourself off and on again",
    area: "shirt-front",
    inks: ALL,
    draw: bots.mcpOffOn,
  },
  {
    id: "hoodie-off-on",
    title: "Turn yourself off and on again (hoodie)",
    area: "hoodie-front",
    inks: ALL,
    draw: bots.mcpOffOnHoodie,
  },
  {
    id: "catalogued",
    title: "You have been catalogued",
    area: "shirt-front",
    inks: ALL,
    draw: bots.catalogued,
  },
  {
    id: "found-it",
    title: "Found it. It was behind you.",
    area: "shirt-front",
    inks: ALL,
    draw: bots.foundIt,
  },
  {
    id: "found-it-back",
    title: "IT (back)",
    area: "shirt-back",
    inks: ALL,
    draw: bots.foundItBack,
  },
  {
    id: "hold-still",
    title: "Hold still — one century",
    area: "shirt-front",
    inks: ALL,
    draw: bots.holdStill,
  },
  {
    id: "volts-full",
    title: "The glass is 0.3 V full",
    area: "shirt-front",
    inks: ALL,
    draw: bots.voltsFull,
  },
  {
    id: "colours-decoration",
    title: "Colours are decoration",
    area: "shirt-front",
    inks: ALL,
    draw: bots.coloursDecoration,
  },
  {
    id: "lore-bot",
    title: "It's not a bug, it's a lore bot",
    area: "shirt-front",
    inks: ALL,
    draw: bots.loreBot,
  },
  {
    id: "my-voxel",
    title: "Works on my voxel",
    area: "shirt-front",
    inks: ALL,
    draw: bots.myVoxel,
  },
  {
    id: "unimpressed",
    title: "Reactivated. Unimpressed.",
    area: "shirt-front",
    inks: ALL,
    draw: bots.unimpressed,
  },
  {
    id: "hoodie-unimpressed",
    title: "Reactivated. Unimpressed. (hoodie back)",
    area: "hoodie-back",
    inks: ALL,
    draw: bots.unimpressed,
  },
  {
    id: "before-cool",
    title: "Before it was cool",
    area: "shirt-front",
    inks: ALL,
    draw: bots.beforeCool,
  },
  {
    id: "coworkers",
    title: "My coworkers are machines",
    area: "shirt-front",
    light: true,
    draw: bots.coworkers,
  },
  {
    id: "hoodie-coworkers",
    title: "My coworkers are machines (hoodie)",
    area: "hoodie-front",
    light: true,
    draw: bots.coworkersHoodie,
  },
  {
    id: "ping-pong",
    title: "0 % packet loss",
    area: "shirt-front",
    inks: ALL,
    draw: bots.pingPong,
  },
  {
    id: "bot-crossing",
    title: "Bot crossing",
    area: "shirt-front",
    inks: ALL,
    draw: bots.botCrossing,
  },
  {
    id: "tour-bnet-front",
    title: "Reactivation tour (front)",
    area: "shirt-front",
    inks: ALL,
    draw: bots.tourBnetFront,
  },
  {
    id: "tour-bnet-back",
    title: "Reactivation tour (back)",
    area: "shirt-back",
    inks: ALL,
    draw: bots.tourBnetBack,
  },
  {
    id: "hoodie-tour-bnet-back",
    title: "Reactivation tour (hoodie back)",
    area: "hoodie-back",
    inks: ALL,
    draw: bots.tourBnetBack,
  },
  {
    id: "bnet-crest",
    title: "BNET-001 crest",
    area: "hoodie-front",
    inks: ALL,
    draw: bots.bnetCrest,
  },
  {
    id: "sticker-sheet",
    title: "Bot squad sticker sheet",
    area: "hoodie-back",
    inks: ALL,
    draw: bots.stickerSheet,
  },
  {
    id: "playing-dead",
    title: "Playing dead since 1997",
    area: "hoodie-front",
    light: true,
    draw: bots.playingDead,
  },
  {
    id: "holo-cards",
    title: "Trading cards",
    area: "shirt-back",
    light: true,
    draw: bots.holoCards,
  },
  {
    id: "kids-batteries",
    title: "Batteries not included",
    area: "kids-front",
    inks: ALL,
    draw: bots.kidsBatteries,
  },
  {
    id: "kids-five-more",
    title: "Just five more centuries",
    area: "kids-front",
    inks: ALL,
    draw: bots.kidsFiveMore,
  },
];
