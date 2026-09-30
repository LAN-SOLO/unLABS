/**
 * Garment silhouettes and Shirtigo print areas for the merch shop (pure data,
 * no imports — `scripts/merch/render.ts` loads this file directly with Node's
 * type stripping to draw the campaign mockups, so keep it dependency-free and
 * free of enums / parameter properties).
 *
 * Units: 1 unit = 1 mm on a size-M garment (kids: size 134/146), so print
 * areas sit at their real size on the silhouette.
 */

export type GarmentKind = "shirt" | "hoodie" | "kids";
export type PrintSide = "front" | "back";

export interface PrintArea {
  /** Placement on the silhouette (mm). */
  x: number;
  y: number;
  /** Shirtigo maximum print size (mm) — the print file keeps this aspect. */
  w: number;
  h: number;
}

export interface GarmentShape {
  /** SVG viewBox width / height. */
  vw: number;
  vh: number;
  /** Outline of the garment (front view; the back reuses it with `backNeck`). */
  body: string;
  /** Neckline / collar rib, front and back. */
  frontNeck: string;
  backNeck: string;
  /** Seams, folds, pocket, drawstrings (stroked with the shade colour). */
  details: { front: string; back: string };
  print: Record<PrintSide, PrintArea>;
}

const SHIRT_BODY =
  "M380 40 Q450 58 520 40 L642 58 L790 132 L862 292 L742 336 L717 262 L717 772 Q450 788 183 772 L183 262 L158 336 L38 292 L110 132 L258 58 Z";

/** Stanley/Stella Creator 2.0 (STTU169): front 330 × 450 mm. */
const SHIRT: GarmentShape = {
  vw: 900,
  vh: 800,
  body: SHIRT_BODY,
  frontNeck: "M380 40 Q450 128 520 40 Q450 104 380 40 Z",
  backNeck: "M380 40 Q450 70 520 40 Q450 58 380 40 Z",
  details: {
    front: "M183 262 L183 300 M717 262 L717 300 M742 336 L734 306 M158 336 L166 306",
    back: "M183 262 L183 300 M717 262 L717 300",
  },
  print: {
    front: { x: 285, y: 128, w: 330, h: 450 },
    back: { x: 285, y: 104, w: 330, h: 450 },
  },
};

/** Stanley/Stella Cruiser 2.0 (STSU177): front 330 × 280 mm (above the pocket). */
const HOODIE: GarmentShape = {
  vw: 1100,
  vh: 900,
  body: "M430 118 Q438 14 550 10 Q662 14 670 118 L720 126 Q790 138 832 176 L1000 780 L912 812 L842 470 L842 842 Q550 858 258 842 L258 470 L188 812 L100 780 L268 176 Q310 138 380 126 Z",
  frontNeck: "M452 128 Q456 44 550 40 Q644 44 648 128 Q600 196 550 200 Q500 196 452 128 Z",
  backNeck: "M430 118 Q438 14 550 10 Q662 14 670 118 Q610 140 550 142 Q490 140 430 118 Z",
  details: {
    front:
      "M520 196 L516 300 M580 196 L584 300 M400 600 L700 600 L740 790 L360 790 Z M258 820 L842 820 M188 812 L200 780 M912 812 L900 780",
    back: "M258 820 L842 820 M188 812 L200 780 M912 812 L900 780 M550 142 L550 160",
  },
  print: {
    front: { x: 385, y: 262, w: 330, h: 280 },
    back: { x: 385, y: 190, w: 330, h: 450 },
  },
};

/** Stanley/Stella Mini Creator 2.0 (STTK184): front 240 × 360 mm. */
const KIDS: GarmentShape = {
  vw: 700,
  vh: 620,
  body: "M296 30 Q350 44 404 30 L498 44 L612 102 L668 226 L574 260 L556 204 L556 598 Q350 610 144 598 L144 204 L126 260 L32 226 L88 102 L202 44 Z",
  frontNeck: "M296 30 Q350 98 404 30 Q350 80 296 30 Z",
  backNeck: "M296 30 Q350 54 404 30 Q350 44 296 30 Z",
  details: {
    front: "M144 204 L144 234 M556 204 L556 234",
    back: "M144 204 L144 234 M556 204 L556 234",
  },
  print: {
    front: { x: 230, y: 96, w: 240, h: 360 },
    back: { x: 230, y: 80, w: 240, h: 360 },
  },
};

export const GARMENTS: Readonly<Record<GarmentKind, GarmentShape>> = {
  shirt: SHIRT,
  hoodie: HOODIE,
  kids: KIDS,
};

/**
 * Print ink set of a motif, chosen by the garment colour:
 * - `dark`   — neon palette for black / navy / deep colours (the default),
 * - `light`  — dark ink for white and heather grey,
 * - `pop`    — white + cream + black for saturated mid colours (red, royal
 *              blue, teal, fresh green): no neon that would vanish or clash,
 * - `pastel` — near-black ink with deep accents for bright / pastel colours
 *              (ochre, pink, lilac, khaki).
 * Files: `<design>.png` / `_hell` / `_farbig` / `_pastell` (print),
 * `<design>[-light|-pop|-pastel].webp` (shop preview).
 */
export type InkId = "dark" | "light" | "pop" | "pastel";

export const INK_IDS: readonly InkId[] = ["dark", "light", "pop", "pastel"];

/** Garment colours (Stanley/Stella names, approximate screen values). */
export interface GarmentColor {
  id: string;
  /** Manufacturer colour name (kept in English, it is what Shirtigo lists). */
  name: string;
  hex: string;
  /** Light garment (mockup shading). */
  light: boolean;
  /** Ink set printed on this colour. */
  ink: InkId;
  /** Kids shirts (Mini Creator 2.0) come in fewer colours. */
  kids: boolean;
}

export const GARMENT_COLORS: readonly GarmentColor[] = [
  { id: "black", name: "Black", hex: "#141414", light: false, ink: "dark", kids: true },
  { id: "anthracite", name: "Anthracite", hex: "#3b3d40", light: false, ink: "dark", kids: true },
  { id: "french_navy", name: "French Navy", hex: "#1c2233", light: false, ink: "dark", kids: true },
  {
    id: "bottle_green",
    name: "Glazed Green",
    hex: "#1f3a30",
    light: false,
    ink: "dark",
    kids: false,
  },
  { id: "burgundy", name: "Burgundy", hex: "#4a1d24", light: false, ink: "dark", kids: false },
  { id: "red", name: "Red", hex: "#c8202f", light: false, ink: "pop", kids: true },
  { id: "royal_blue", name: "Royal Blue", hex: "#2350a8", light: false, ink: "pop", kids: true },
  { id: "stargazer", name: "Stargazer", hex: "#1f6d73", light: false, ink: "pop", kids: false },
  { id: "fresh_green", name: "Fresh Green", hex: "#3f9a4f", light: false, ink: "pop", kids: false },
  { id: "ochre", name: "Ochre", hex: "#d99a2b", light: true, ink: "pastel", kids: false },
  {
    id: "cotton_pink",
    name: "Cotton Pink",
    hex: "#f2c4cc",
    light: true,
    ink: "pastel",
    kids: true,
  },
  {
    id: "lilac_dream",
    name: "Lilac Dream",
    hex: "#c0b3da",
    light: true,
    ink: "pastel",
    kids: false,
  },
  { id: "khaki", name: "Khaki", hex: "#a39a78", light: true, ink: "pastel", kids: false },
  {
    id: "heather_grey",
    name: "Heather Grey",
    hex: "#b8babb",
    light: true,
    ink: "light",
    kids: true,
  },
  { id: "white", name: "White", hex: "#f3f3f1", light: true, ink: "light", kids: true },
];

export const GARMENT_COLOR_BY_ID: ReadonlyMap<string, GarmentColor> = new Map(
  GARMENT_COLORS.map((c) => [c.id, c]),
);

/** Mockup colours per ink (campaign images: one or two per ink set). */
export const MOCKUP_COLORS: Readonly<Record<InkId, readonly string[]>> = {
  dark: ["black"],
  light: ["white"],
  pop: ["red", "royal_blue"],
  pastel: ["ochre", "cotton_pink"],
};
