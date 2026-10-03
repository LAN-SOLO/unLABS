/**
 * Skin documentation from the data (lib/world/skins/rooms.ts):
 *
 *   pnpm skins:doc
 *
 * - docs/SKINS.md § 13 Rooms (between the rooms:begin / rooms:end markers), English
 * - ../unlabsundevbook/docs/features/walls-floors.json (bilingual feature doc,
 *   status "new"; screenshots = the contact sheets from pnpm skins:sheets)
 *
 * German comes from lib/i18n/de/skins.ts (the game's own dictionary).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { __setLocaleForTests } from "@/lib/i18n";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const BOOK = join(ROOT, "../unlabsundevbook");
const VERSION = (
  JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }
).version;
const SHEETS = join(ROOT, ".voxel/skins/sheets");

async function main(): Promise<void> {
  __setLocaleForTests("en");
  const { DE } = await import("@/lib/i18n/de");
  const { ROOMS } = await import("@/lib/world/content/map");
  const { ROOM_SKINS } = await import("@/lib/world/skins/rooms");
  const { SKIN_PRESETS } = await import("@/lib/world/skins/presets");
  const { SKIN_MODES, MODE_DUTY } = await import("@/lib/world/skins/modes");
  const { resolveSkin, skinWatts } = await import("@/lib/world/skins/state");

  const de = (en: string): string => DE.get(en) ?? DE.get(`skin::${en}`) ?? en;
  const presetName = (id: string): string => SKIN_PRESETS.find((p) => p.id === id)?.name ?? id;
  const FLOOR_NAME = ["L0", "L−1", "L−2", "L−3", "L−4", "L−5"];
  const FLOOR_DE = ["Ebene 0", "Ebene −1", "Ebene −2", "Ebene −3", "Ebene −4", "Ebene −5"];
  const bandList = (b: { kind: string; v0: number; v1: number }[]) =>
    b.map((x) => `${x.kind} (v ${x.v0}–${x.v1})`).join(", ") || "—";

  // ── docs/SKINS.md § 13 ─────────────────────────────────────────
  const md: string[] = [];
  for (let f = 0; f <= 5; f++) {
    md.push(`### ${FLOOR_NAME[f]}`, "");
    for (const s of ROOM_SKINS) {
      const room = ROOMS.find((r) => r.id === s.room)!;
      if (room.floor !== f) continue;
      const w = s.wall;
      const fl = s.floor;
      const sig = s.signature;
      const watts = skinWatts(s.room, resolveSkin(s.room, undefined));
      md.push(
        `#### ${room.name} (\`${s.room}\`) — ${s.title}`,
        "",
        s.idea,
        "",
        `| | |`,
        `| --- | --- |`,
        `| Wall | \`${w.family}\` · panel ${w.panel} × rows ${w.rows} · seam ${w.seam} (${w.relief}) · base ${w.base}${w.pillar ? ` · pillar every ${w.pillar}` : ""}${w.dark ? ` · dark every ${w.dark}th` : ""}${w.inlays ? ` · ${Math.round(w.inlays * 100)} % ${w.glyphs} inlays` : ""}${w.nodes ? " · LED pairs" : ""}${w.bezel ? " · bezels" : ""}${w.cracks ? " · glowing cracks" : ""} · cornice ${w.cornice} |`,
        `| Paint | panel ${w.paint.panel} · seam ${w.paint.seam} · base ${w.paint.base} · cap ${w.paint.cap} · inlay ${w.paint.inlay} · accent ${w.paint.accent} |`,
        `| Bands | ${bandList(w.bands)} |`,
        `| Floor | \`${fl.family}\` · tile ${fl.tile} · ${fl.paint.a} / ${fl.paint.b}, grout ${fl.paint.grout}${fl.lines !== "none" ? ` · ${fl.lines} light lines` : ""}${fl.diamonds ? " · diamond markers" : ""}${fl.cracks ? " · glowing cracks" : ""} |`,
        `| Signature | **${sig.name}** — line ${sig.line}${sig.line2 ? ` ↔ ${sig.line2}` : ""}, node ${sig.node}, field ${sig.field} (glow ${sig.fieldGlow}), \`${sig.mode}\` × ${Math.round(sig.speed * 100) / 100}${sig.source && sig.source !== "none" ? `, source \`${sig.source}\`` : ""} · ≈ ${watts} W |`,
        `| Also offered | ${s.alts.map(presetName).join(", ")} |`,
        `| Events | ${s.events.join(" ") || "—"} |`,
        `| References | ${s.ref.length ? s.ref.map((r) => `#${r}`).join(", ") : "—"} |`,
        "",
      );
    }
  }
  const docPath = join(ROOT, "docs/SKINS.md");
  const doc = readFileSync(docPath, "utf8");
  const a = doc.indexOf("<!-- rooms:begin -->");
  const b = doc.indexOf("<!-- rooms:end -->");
  if (a < 0 || b < 0) throw new Error("SKINS.md: room markers missing");
  writeFileSync(docPath, `${doc.slice(0, a + 20)}\n\n${md.join("\n")}\n${doc.slice(b)}`);
  console.log(`[skins] docs/SKINS.md: ${ROOM_SKINS.length} rooms`);

  // ── undevbook feature ──────────────────────────────────────────
  if (!existsSync(BOOK)) return;
  const sheets = existsSync(SHEETS)
    ? readdirSync(SHEETS)
        .filter((f) => /\.(png|jpe?g|gif)$/.test(f))
        .sort()
        .map((f) => join(SHEETS, f))
    : [];
  const roomRows = ROOM_SKINS.map((s) => {
    const room = ROOMS.find((r) => r.id === s.room)!;
    return {
      en: [
        `${FLOOR_NAME[room.floor]} · ${room.name}`,
        s.title,
        `${s.wall.family} / ${s.floor.family}`,
        s.signature.name,
        s.signature.mode,
        s.alts.map(presetName).join(", "),
      ],
      de: [
        `${FLOOR_DE[room.floor]} · ${de(room.name)}`,
        de(s.title),
        `${s.wall.family} / ${s.floor.family}`,
        de(s.signature.name),
        s.signature.mode,
        s.alts.map((x) => de(presetName(x))).join(", "),
      ],
    };
  });
  const ideaRows = ROOM_SKINS.map((s) => {
    const room = ROOMS.find((r) => r.id === s.room)!;
    return {
      en: [room.name, s.idea, s.events.join(" ") || "—"],
      de: [de(room.name), de(s.idea), s.events.map(de).join(" ") || "—"],
    };
  });
  const feature = {
    status: "new",
    version: 1,
    date: "2026-10-03",
    gameVersion: VERSION,
    changeLogs: [],
    dbUpdates: [],
    id: "walls-floors",
    order: 0,
    title: {
      en: "Walls & floors: a designed, dynamic skin for every room (concept + Blender renders)",
      de: "Wände & Böden: eine gestaltete, dynamische Haut für jeden Raum (Konzept + Blender-Renders)",
    },
    summary: {
      en: `Every one of the ${ROOM_SKINS.length} rooms gets its own wall and floor concept in voxels (4 × finer, like device detail): panel families, bands, inlays, cornices and floor patterns that tell the room's story. Three light channels (line, node, field) carry the mood; colour, motion (${SKIN_MODES.length} modes) and brightness are set per room at the surveillance station, synced per floor or lab-wide, scheduled, and paid for in watts. One geometry, many moods — the mood board's amber, sodium, lemon and red walls are the same wall. Status: concept, generator, tests and Blender renders; the engine integration is planned (docs/SKINS.md § 11).`,
      de: `Jeder der ${ROOM_SKINS.length} Räume bekommt ein eigenes Wand- und Bodenkonzept in Voxeln (4 × feiner, wie das Geräte-Detail): Paneelfamilien, Bänder, Einlagen, Gesimse und Bodenmuster, die die Geschichte des Raums erzählen. Drei Lichtkanäle (Linie, Knoten, Feld) tragen die Stimmung; Farbe, Bewegung (${SKIN_MODES.length} Modi) und Helligkeit stellt man pro Raum an der Überwachungsstation ein, synchron pro Ebene oder laborweit, per Zeitplan, bezahlt in Watt. Eine Geometrie, viele Stimmungen — die bernsteinfarbene, Natrium-, Zitronen- und rote Wand des Moodboards sind dieselbe Wand. Stand: Konzept, Generator, Tests und Blender-Renders; die Engine-Integration ist geplant (docs/SKINS.md § 11).`,
    },
    sections: [
      {
        id: "principles",
        title: { en: "Principles", de: "Grundsätze" },
        body: {
          en: [
            "**Voxels only.** The mood board is smooth line art; the skins translate it into voxels on the 4 × 4 × 4 fine lattice. Walls stay in their wall line, floors in the slab; relief is carved one fine voxel deep; only the cornice (y 7–8) reaches into the room, above Jade's head. Collision and all game coordinates stay on the source grid.",
            "**One geometry, many moods.** Every surface voxel is a fixed colour or one of three channels — line (seams, outlines, guide lines, cove light), node (LEDs, keyholes, veins, stars), field (panel faces). A mood sets their colours, the field's own glow, a motion mode, speed and intensity. Mood changes never remesh.",
            "**Readable play, light costs power.** Door frames, keypads, hazard markings and interaction highlights keep their colours; channels stay below the highlight brightness. Each room's skin is a consumer on the power grid; without power it falls back to emergency light.",
          ],
          de: [
            "**Nur Voxel.** Das Moodboard ist glatte Strichgrafik; die Häute übersetzen es in Voxel auf dem feinen 4 × 4 × 4-Gitter. Wände bleiben in ihrer Wandlinie, Böden in der Platte; Relief wird einen Feinvoxel tief eingeschnitten; nur das Gesims (y 7–8) ragt in den Raum, über Jades Kopf. Kollision und alle Spielkoordinaten bleiben auf dem Quellgitter.",
            "**Eine Geometrie, viele Stimmungen.** Jeder Oberflächenvoxel ist eine feste Farbe oder einer von drei Kanälen — Linie (Fugen, Konturen, Leitlinien, Voutenlicht), Knoten (LEDs, Schlüssellöcher, Adern, Sterne), Feld (Paneelflächen). Eine Stimmung setzt ihre Farben, das Eigenleuchten des Felds, einen Bewegungsmodus, Tempo und Intensität. Stimmungswechsel vernetzen nie neu.",
            "**Lesbares Spiel, Licht kostet Strom.** Türrahmen, Tastenfelder, Warnmarkierungen und Interaktions-Hervorhebungen behalten ihre Farben; die Kanäle bleiben unter der Helligkeit der Hervorhebung. Die Haut jedes Raums ist ein Verbraucher im Stromnetz; ohne Strom fällt sie auf Notlicht zurück.",
          ],
        },
      },
      {
        id: "station",
        title: {
          en: "Control: surveillance station → Skins",
          de: "Steuerung: Überwachungsstation → Häute",
        },
        body: {
          en: [
            "A sixth tab next to Cams, Routines, Schedule, Bots and Doors: room list per floor with the current swatch, the live camera feed of the selected room, preset list (signature first, then recommendations, then the library), three colour swatches (free hue wheel from root ring wheel), mode, speed 0.25–4 ×, intensity with the live watt cost, sync room / floor / lab, copy / paste / reset.",
            "The task schedule gets a task kind “skin” (e.g. 22:00 all of L−4 → Night watch); the root shell gets `skin <room> <preset> [mode] [speed]` and the tunables skin.max_intensity and skin.budget_w; a skin change is an OpsStep, so Jade can learn “evening lights” as a habit.",
          ],
          de: [
            "Ein sechster Reiter neben Kameras, Routinen, Zeitplan, Bots und Türen: Raumliste pro Ebene mit der aktuellen Farbe, das Live-Kamerabild des gewählten Raums, Preset-Liste (Signatur zuerst, dann Empfehlungen, dann die Bibliothek), drei Farbfelder (freies Farbrad ab Root-Ring wheel), Modus, Tempo 0,25–4 ×, Intensität mit den laufenden Watt, Synchron Raum / Ebene / Labor, Kopieren / Einfügen / Zurücksetzen.",
            "Der Zeitplan bekommt eine Aufgabenart „skin“ (z. B. 22:00 ganz Ebene −4 → Nachtwache); die Root-Shell bekommt `skin <Raum> <Preset> [Modus] [Tempo]` und die Tunables skin.max_intensity und skin.budget_w; ein Hautwechsel ist ein OpsStep, also kann Jade „Abendlicht“ als Gewohnheit lernen.",
          ],
        },
        table: {
          head: { en: ["Mode", "Average power"], de: ["Modus", "Mittlere Leistung"] },
          rows: SKIN_MODES.map((m) => ({
            en: [m, `${Math.round(MODE_DUTY[m] * 100)} %`],
            de: [m, `${Math.round(MODE_DUTY[m] * 100)} %`],
          })),
        },
      },
      {
        id: "presets",
        title: { en: "Preset library", de: "Preset-Bibliothek" },
        body: {
          en: [
            "Moods every room can wear, plus one signature per room. References #1–#9 are the mood-board pictures.",
          ],
          de: [
            "Stimmungen, die jeder Raum tragen kann, dazu eine Signatur pro Raum. Referenzen #1–#9 sind die Moodboard-Bilder.",
          ],
        },
        table: {
          head: {
            en: ["Preset", "Line / node / field", "Mode", "Ref"],
            de: ["Preset", "Linie / Knoten / Feld", "Modus", "Ref"],
          },
          rows: SKIN_PRESETS.map((p) => ({
            en: [
              p.name,
              `${p.line} / ${p.node} / ${p.field} (glow ${p.fieldGlow})`,
              p.mode,
              (p.ref ?? []).map((r) => `#${r}`).join(" "),
            ],
            de: [
              de(p.name),
              `${p.line} / ${p.node} / ${p.field} (Glühen ${p.fieldGlow})`,
              p.mode,
              (p.ref ?? []).map((r) => `#${r}`).join(" "),
            ],
          })),
        },
      },
      {
        id: "rooms",
        title: { en: "Rooms at a glance", de: "Räume im Überblick" },
        body: {
          en: ["Wall family / floor family, signature mood and the presets offered first."],
          de: ["Wandfamilie / Bodenfamilie, Signatur-Stimmung und die zuerst angebotenen Presets."],
        },
        table: {
          head: {
            en: ["Room", "Concept", "Wall / floor", "Signature", "Mode", "Also offered"],
            de: ["Raum", "Konzept", "Wand / Boden", "Signatur", "Modus", "Außerdem"],
          },
          rows: roomRows,
        },
      },
      {
        id: "ideas",
        title: { en: "Room concepts", de: "Raumkonzepte" },
        body: {
          en: ["The idea of each room and the events that take its skin over for a moment."],
          de: ["Die Idee jedes Raums und die Ereignisse, die seine Haut kurz übernehmen."],
        },
        table: {
          head: { en: ["Room", "Idea", "Events"], de: ["Raum", "Idee", "Ereignisse"] },
          rows: ideaRows,
        },
      },
      {
        id: "build",
        title: { en: "Build & renders", de: "Bau & Renders" },
        body: {
          en: [
            "Data and generator: lib/world/skins/ (types, rooms, presets, modes, voxels, state); tests: tests/world/skins.test.ts (one concept per room, silhouette rule, determinism, modes in range, sanitising, sync, forced moods, power). Palette: skin_line, skin_node, skin_field (indices 253–255, the palette is now full).",
            "Renders: pnpm skins:export → pnpm skins:render (Blender 5.1, Cycles, voxelgod shell: one quad per exposed fine face, channels tinted like the planned shader) → pnpm skins:sheets (contact sheets, GIF loops). Per room: iso overview (cutaway), eye-level views of the main wall in up to four moods, an eight-frame loop of the signature.",
          ],
          de: [
            "Daten und Generator: lib/world/skins/ (types, rooms, presets, modes, voxels, state); Tests: tests/world/skins.test.ts (ein Konzept pro Raum, Silhouettenregel, Determinismus, Modi im Bereich, Bereinigung, Synchronisierung, erzwungene Stimmungen, Strom). Palette: skin_line, skin_node, skin_field (Indizes 253–255, die Palette ist jetzt voll).",
            "Renders: pnpm skins:export → pnpm skins:render (Blender 5.1, Cycles, voxelgod-Hülle: ein Quad pro sichtbarer Feinfläche, Kanäle getönt wie im geplanten Shader) → pnpm skins:sheets (Kontaktbögen, GIF-Loops). Pro Raum: Iso-Übersicht (Schnitt), Augenhöhe auf die Hauptwand in bis zu vier Stimmungen, ein Loop der Signatur in acht Bildern.",
          ],
        },
      },
    ],
    numbers: {
      rooms: ROOM_SKINS.length,
      presets: SKIN_PRESETS.length,
      modes: SKIN_MODES.length,
      wallFamilies: new Set(ROOM_SKINS.map((s) => s.wall.family)).size,
      floorFamilies: new Set(ROOM_SKINS.map((s) => s.floor.family)).size,
      fine: 4,
      channels: 3,
      plannedSaveVersion: 11,
    },
    entities: { rooms: ROOM_SKINS.map((s) => s.room) },
    screenshots: sheets,
    files: [
      "docs/SKINS.md",
      "lib/world/skins/types.ts",
      "lib/world/skins/rooms.ts",
      "lib/world/skins/presets.ts",
      "lib/world/skins/modes.ts",
      "lib/world/skins/voxels.ts",
      "lib/world/skins/state.ts",
      "lib/world/content/palette.ts",
      "lib/i18n/de/skins.ts",
      "scripts/skins/export.ts",
      "scripts/skins/blender/render.py",
      "scripts/skins/sheets.mjs",
      "scripts/skins/doc.ts",
    ],
    tests: ["tests/world/skins.test.ts"],
  };
  writeFileSync(
    join(BOOK, "docs/features/walls-floors.json"),
    JSON.stringify(feature, null, 2) + "\n",
  );
  console.log(`[skins] undevbook feature walls-floors.json (${sheets.length} pictures)`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
