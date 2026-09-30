"use client";

import { tr } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { PuzzleView } from "@/components/world/puzzles/PuzzleView";
import {
  DevicePanel,
  DialoguePanel,
  ElevatorPanel,
  ForgePanel,
  InventoryPanel,
  JournalPanel,
  NotePanel,
  PowerPanel,
  PrototypeUse,
  WorkbenchPanel,
  announce,
  runPrototypeUse,
  type ProtoUseHandler,
  type WorldApi,
} from "@/components/world/panels";
import {
  BuffHud,
  CrtButton,
  HudMenu,
  Panel,
  SPEAKER,
  trNodes,
  type HudMenuItem,
} from "@/components/world/ui";
import { MapOverlay, Minimap } from "@/components/world/Minimap";
import { DecorActionPanel } from "@/components/world/DecorActionPanel";
import { VERB_LABEL } from "@/components/world/map/dossier";
import {
  BioHud,
  BioPanel,
  BioStationPanel,
  STATION_VERB,
  announceBio,
} from "@/components/world/BioPanels";
import {
  BIO_STATION_BY_PROP,
  bioBarkDue,
  sleep as bioSleep,
  type BioStation,
} from "@/lib/world/biorhythm";
import { fmtNum } from "@/components/world/format";
import { IntroSequence, SceneTitleCard } from "@/components/world/IntroSequence";
import { poseForDecorVerb } from "@/lib/world/models/rig";
import { DeviceInterface } from "@/components/world/device-ui/DeviceInterface";
import { KnowledgePanel } from "@/components/world/knowledge/KnowledgePanel";
import { PersonalComputer } from "@/components/world/pc/PersonalComputer";
import { PC_PROP } from "@/lib/world/content/quarters";
import { STUDIO_PROP } from "@/lib/world/content/studio";
import { StudioPanel } from "@/components/world/studio/StudioPanel";
import { CharacterMenu, type CharacterTab } from "@/components/world/wardrobe/CharacterMenu";
import { WearIcon } from "@/components/world/wardrobe/WearIcon";
import { REPLICATOR_PROP } from "@/lib/world/content/wardrobe";
import { isWearPickupItem, lookSignature, visibleLook, wearIdFromItem } from "@/lib/world/wardrobe";
import { nextWardrobeHint } from "@/lib/world/wardrobe-hints";
import { TitleMusic } from "@/components/world/TitleMusic";
import { SpotEntries, SpotPanel } from "@/components/world/ArchiveSpot";
import { SEARCHABLE_DECOR, isArchiveDecor, spotName, visitSpot } from "@/lib/world/archive";
import type { ArchiveSpot } from "@/lib/world/content/archive";
import { usesInterface } from "@/lib/world/device-ops";
import {
  decorActionAt,
  hasDecorAction,
  propDecorAction,
  runDecorAction,
  runPropDecorAction,
  type DecorActionResult,
} from "@/lib/world/decor-actions";
import type { DecorPlacement } from "@/lib/world/content/interior";
import { EndingSequence } from "@/components/world/EndingSequence";
import { enterPostgame } from "@/lib/world/postgame";
import { ItemIcon } from "@/components/world/ItemIcon";
import { Codex } from "@/components/world/Codex";
import { HintBubble } from "@/components/world/HintBubble";
import { GENRE_LABEL } from "@/lib/world/audio/songs/labels";
import type { Genre } from "@/lib/world/audio/songs/types";
import type { CodexTab } from "@/lib/world/content/codex";
import {
  LEGEND_REVEAL_SECONDS,
  hasUsed,
  markHintSeen,
  markUsed,
  nextHint,
  showControlLegend,
  type Hint,
  type UsedAction,
} from "@/lib/world/tutorial";
import { RoomTerminal } from "@/components/world/RoomTerminal";
import { ROOM_TERMINAL_BY_ID } from "@/lib/world/content/terminals";
import { AchievementsPanel } from "@/components/world/AchievementsPanel";
import { achievementCount } from "@/lib/world/achievements";
import { hudObjective, objectivesCached } from "@/lib/world/quests";
import { ENDINGS, INSIGHT_BY_ID } from "@/lib/world/content/story";
import {
  LoadingScreen,
  PauseMenu,
  TitleScreen,
  UiScale,
  menuLayerOpen,
} from "@/components/world/menu";
import {
  actionForCode,
  colorblindFilter,
  getSettings,
  labelForCode,
  subscribeSettings,
  useSettings,
  type ControlAction,
} from "@/lib/world/settings";
import {
  SLOT_NAME,
  autosave,
  getActiveSlot,
  saveToSlot,
  saveWorld,
  slotOf,
} from "@/lib/world/save";
import { subscribeTerminalEvents } from "@/lib/world/bridge";
import { TerminalOverlay, absorbTerminalIntoWorld } from "@/components/world/TerminalOverlay";
import { useWorld } from "@/components/world/useWorld";
import { useLabDirector } from "@/components/world/useLabDirector";
import { BARK_SPEAKERS, type BarkContext } from "@/lib/world/barks";
import type { BarkTrigger } from "@/lib/world/content/barks";
import { SLICE_ITEM } from "@/lib/world/content/items";
import type { SfxName, Surface } from "@/lib/world/audio/sfx";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import {
  DOORS,
  ELEVATORS,
  FLOOR_BY_ID,
  NOTES,
  PICKUPS,
  PROPS,
  ROOM_BY_ID,
} from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { NPCS } from "@/lib/world/content/story";
import {
  doorIsOpen,
  evalCond,
  grant,
  isBuilt,
  itemDef,
  pickupNeedsTool,
  puzzleAvailable,
  puzzleLockHint,
  power,
  progress,
  prototypeUseOptions,
  reachEnding,
  readNote,
  solvePuzzle,
  stagesDone,
  takePickup,
} from "@/lib/world/game";
import type { LabEngine, Target } from "@/lib/world/render/engine";
import type { FxKind } from "@/lib/world/render/fx";
import type { ProtoEffectId } from "@/lib/world/combine";
import type { FloorId, WorldState } from "@/lib/world/types";

type Overlay =
  | { kind: "device"; id: string }
  /** The device's own interface (every built device is used through it). */
  | { kind: "deviceui"; id: string }
  /** An archive spot without an action of its own (board, locker, vent …). */
  | { kind: "spot"; placementId: string; decor: string }
  | { kind: "workbench" }
  | { kind: "inventory" }
  | { kind: "journal" }
  /** Jade's knowledge panel (N). */
  | { kind: "knowledge" }
  /** Jade's personal computer (prop `jade_pc`, Jade's Quarters). */
  | { kind: "pc" }
  /** Damien's Sound Studio: the mixing desk (prop `studio_console`, Level −2). */
  | { kind: "studio" }
  /**
   * Jade's character menu (O, pause menu, inventory; the wardrobe and the
   * replicator “Needle's Eye” in her quarters open it with `atWardrobe`).
   */
  | { kind: "character"; atWardrobe?: boolean; atReplicator?: boolean; tab?: CharacterTab }
  | { kind: "power" }
  | { kind: "dialogue"; npc: string }
  | { kind: "note"; id: string }
  | { kind: "elevator"; prop?: string }
  | { kind: "forge"; prop?: string }
  | { kind: "puzzle"; id: string }
  | { kind: "help" }
  | { kind: "intro" }
  | { kind: "boot"; prop?: string }
  | { kind: "pause" }
  | { kind: "map" }
  | { kind: "achievements" }
  | { kind: "codex"; tab?: CodexTab; entry?: string }
  | { kind: "decor"; result: DecorActionResult; prop?: string }
  /** Biorhythm: the Bio panel, or a station (replicator, fridge, bed, ergometer). */
  | { kind: "bio" }
  | { kind: "bio_station"; station: BioStation; first?: boolean }
  | { kind: "terminal"; id: string }
  /** The big _unOS terminal in-game (iframe overlay); `back` = where closing returns to. */
  | { kind: "console"; back?: "pause" }
  /** "Benutzen mit Prototyp …" at a target without a panel of its own (door, station, pile). */
  | { kind: "proto"; target: string; title: string; text: string }
  | null;

/** Panels the player opens on purpose (one of them teaches "panels" for the HUD legend). */
const PANEL_KINDS: ReadonlySet<string> = new Set([
  "inventory",
  "workbench",
  "journal",
  "knowledge",
  "power",
  "map",
  "codex",
  "achievements",
  "bio",
  "character",
]);

/** World effect per prototype effect family. */
const PROTO_FX: Record<ProtoEffectId, FxKind> = {
  ladung: "power_on",
  kuehlung: "steam",
  lichtbild: "insight_ring",
  dekodierung: "insight_ring",
  stimmung: "insight_ring",
  kalibrierung: "insight_ring",
  hebel: "dust",
  peilung: "power_wave",
  resonanzschluessel: "dust",
  reanimation: "sparks",
  kohaerenz: "rift_pulse",
};

/** Map position of a prototype target (for effects), if it has one. */
function protoSpot(id: string): { floor: FloorId; x: number; z: number } | undefined {
  const spot =
    DOORS.find((d) => d.id === id) ??
    NPCS.find((n) => n.id === id) ??
    PROPS.find((p) => p.id === id) ??
    PICKUPS.find((p) => p.id === id) ??
    NOTES.find((n) => n.id === id);
  if (spot) return { floor: spot.floor, x: spot.x, z: spot.z };
  const dev = DEVICE_BY_ID.get(id);
  const room = dev ? ROOM_BY_ID.get(dev.room) : undefined;
  return dev && room ? { floor: room.floor, x: dev.x, z: dev.z } : undefined;
}

function targetLabel(
  s: WorldState,
  t: Target,
  decorOf: (id: string) => DecorPlacement | undefined,
): { title: string; sub: string } {
  switch (t.kind) {
    case "device": {
      const d = DEVICE_BY_ID.get(t.id)!;
      if (!s.discovered[t.id]) return { title: tr("Unknown socket"), sub: tr("Blueprint missing") };
      if (isBuilt(s, t.id))
        return { title: d.name, sub: power(s).online.has(t.id) ? tr("online") : tr("no power") };
      return {
        title: d.name,
        sub: tr("Blueprint · Stage {done}/{total}", {
          done: stagesDone(s, t.id),
          total: d.stages.length,
        }),
      };
    }
    case "pickup": {
      const p = PICKUPS.find((x) => x.id === t.id)!;
      return {
        title: p.label,
        sub:
          p.puzzle && !s.puzzles[p.puzzle]
            ? tr("locked")
            : pickupNeedsTool(s, p)
              ? tr("needs a tool")
              : tr("search"),
      };
    }
    case "note": {
      const n = NOTES.find((x) => x.id === t.id)!;
      return { title: n.title, sub: s.read[t.id] ? tr("note::read") : tr("read it") };
    }
    case "prop": {
      const p = PROPS.find((x) => x.id === t.id)!;
      if (!evalCond(s, p.requires)) return { title: p.label, sub: tr("blocked") };
      const station = BIO_STATION_BY_PROP.get(p.id);
      if (station) return { title: p.label, sub: STATION_VERB[station] };
      const da = propDecorAction(p);
      if (da) {
        const v = decorActionAt({ decor: da.decor, room: da.room }, s);
        if (v)
          return {
            title: p.label,
            sub: v.available ? VERB_LABEL[v.verb] : (v.hint ?? tr("blocked")),
          };
      }
      return {
        title: p.label,
        sub: p.kind === "puzzle" && s.puzzles[p.puzzle ?? ""] ? tr("solved") : tr("use"),
      };
    }
    case "door": {
      const d = DOORS.find((x) => x.id === t.id)!;
      if (d.secret && !doorIsOpen(s, d))
        return { title: tr("Hollow wall"), sub: tr("sounds hollow") };
      return {
        title: d.keypad ? tr("Keypad") : tr("Locked door"),
        sub: doorIsOpen(s, d) ? tr("open") : d.keypad ? tr("enter code") : tr("locked"),
      };
    }
    case "npc": {
      const n = NPCS.find((x) => x.id === t.id)!;
      return { title: n.name, sub: tr("talk") };
    }
    case "terminal": {
      const d = ROOM_TERMINAL_BY_ID.get(t.id);
      return {
        title: d?.label ?? tr("Terminal"),
        sub: d && evalCond(s, d.requires) ? tr("log in") : tr("no signal"),
      };
    }
    case "decor": {
      const pl = decorOf(t.id);
      const v = pl ? decorActionAt(pl, s) : null;
      if (pl && !v)
        return {
          title: spotName(pl.decor),
          sub: SEARCHABLE_DECOR.has(pl.decor) ? tr("search") : tr("look"),
        };
      return {
        title: v?.label ?? "…",
        sub: v?.available ? VERB_LABEL[v.verb] : (v?.hint ?? tr("blocked")),
      };
    }
  }
}

function LabGame({ onMainMenu, onReload }: { onMainMenu: () => void; onReload: () => void }) {
  const world = useWorld();
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LabEngine | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [focus, setFocus] = useState<Target | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [floor, setFloor] = useState<FloorId>(0);
  const [labelPos, setLabelPos] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<Overlay>(null);
  const soundRef = useRef<((n: SfxName) => void) | null>(null);
  const footstepRef = useRef<((s: Surface, at?: [number, number]) => void) | null>(null);
  const barkRef = useRef<((t: BarkTrigger, ctx?: BarkContext) => void) | null>(null);
  const lastFloorRef = useRef<FloorId | null>(null);
  const moveOriginRef = useRef<{ floor: FloorId; x: number; z: number } | null>(null);
  const puzzleReturn = useRef<Overlay>(null);

  const director = useLabDirector(world, engineRef, floor, room);
  /** Dev handle (`window.__lab.audio`) reads the audio system through this ref. */
  const getAudioRef = useRef(director.getAudio);
  getAudioRef.current = director.getAudio;
  const cinematicRef = useRef(false);
  const skipSceneRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    cinematicRef.current = director.cinematic;
    skipSceneRef.current = director.skipScene;
    // A scene re-enables engine input when it ends; keep it off while a panel is open.
    if (!director.cinematic) engineRef.current?.setInputEnabled(overlayRef.current === null);
  }, [director.cinematic, director.skipScene]);
  /** Where "Esc" from the help panel returns to (the pause menu when opened from there). */
  const helpReturn = useRef<Overlay>(null);
  const api: WorldApi = {
    get: world.get,
    act: world.act,
    toast: world.toast,
    version: world.version,
    sound: director.sound,
    speak: director.speak,
    workbenchFx: (k) => engineRef.current?.workbenchFx(k),
  };
  useEffect(() => {
    soundRef.current = director.sound;
    footstepRef.current = director.footstep;
    barkRef.current = director.bark;
  }, [director.sound, director.footstep, director.bark]);
  const apiRef = useRef(api);
  apiRef.current = api;

  /** Record a usage signal once (drives tutorial hints and the compact HUD legend). */
  const noteUsed = useCallback((a: UsedAction) => {
    const w = apiRef.current;
    if (!hasUsed(w.get(), a)) w.act((st) => markUsed(st, a));
  }, []);
  /** Play time until which the compact HUD shows the control legend again (help key). */
  const [legendUntil, setLegendUntil] = useState<number | null>(null);

  const open = useCallback(
    (o: Overlay) => {
      const was = overlayRef.current;
      if (o) {
        if (PANEL_KINDS.has(o.kind)) noteUsed("panel");
        if (o.kind === "codex") noteUsed("codex");
        if (o.kind === "achievements") noteUsed("achievements");
        if (o.kind === "help")
          setLegendUntil(apiRef.current.get().playTime + LEGEND_REVEAL_SECONDS);
      }
      if (o && !was) soundRef.current?.("ui_open");
      else if (!o && was) soundRef.current?.("ui_close");
      overlayRef.current = o;
      setOverlay(o);
      engineRef.current?.setInputEnabled(o === null);
    },
    [noteUsed],
  );

  const openPuzzle = useCallback(
    (id: string) => {
      puzzleReturn.current = overlayRef.current;
      soundRef.current?.("puzzle_open");
      open({ kind: "puzzle", id });
    },
    [open],
  );

  /** "Benutzen mit Prototyp …": toasts/sounds via runPrototypeUse, plus world fx and overlays. */
  const protoUse = useCallback<ProtoUseHandler>(
    (target, opt) => {
      const a = apiRef.current;
      const r = runPrototypeUse(a, target, opt);
      if (!r.ok) return r;
      const eng = engineRef.current;
      const here = a.get().floor;
      const at = protoSpot(target);
      if (eng && at && at.floor === here && r.family)
        eng.fxAt(PROTO_FX[r.family], at.x + 0.5, 1.4, at.z + 0.5);
      for (const id of r.revealed) {
        const o = protoSpot(id);
        if (eng && o && o.floor === here) eng.fxAt("pickup_glint", o.x + 0.5, 1.6, o.z + 0.5);
      }
      const cur = overlayRef.current;
      if (r.puzzle && cur?.kind === "puzzle") {
        // Solved by the prototype: leave the minigame like a manual solve.
        const pk = PUZZLE_BY_ID.get(r.puzzle)?.kind;
        if (pk) window.setTimeout(() => barkRef.current?.("puzzle_solved", { kind: pk }), 1500);
        open(puzzleReturn.current);
        puzzleReturn.current = null;
      } else if (cur?.kind === "proto") open(null);
      return r;
    },
    [open],
  );

  const interact = useCallback(
    (t: Target) => {
      const a = apiRef.current;
      noteUsed("interact");
      const s = a.get();
      /** Sound, toasts and popover for a decor(-style) action result. */
      const showDecor = (r: DecorActionResult, prop?: string) => {
        if (!r.ok) {
          soundRef.current?.("fail_buzz");
          a.toast(r.text, "warn");
          return;
        }
        const verbSound: Partial<Record<string, SfxName>> = {
          trinken: "coffee_brew",
          hören: "radio_tune",
          lesen: "page_turn",
          sitzen: "sit",
          liegen: "sit",
        };
        soundRef.current?.(verbSound[r.verb] ?? "ui_click");
        if (r.buff) soundRef.current?.("buff_on");
        if (r.items[0])
          a.toast(
            tr("{label}: {text}", {
              label: r.label,
              text: r.items
                .map((it) => `${it.count}× ${itemDef(a.get(), it.item)?.name ?? it.item}`)
                .join(", "),
            }),
            "good",
            r.items[0].item,
          );
        announce(a, { insights: r.insights });
        open(prop ? { kind: "decor", result: r, prop } : { kind: "decor", result: r });
      };
      /** Read entries at a note / prop / terminal land in the journal archive. */
      const archiveVisit = (spot: ArchiveSpot) => {
        const v = a.act((st) => visitSpot(st, spot, "read"));
        for (const e of v.fresh) a.toast(tr("Archive — {title}", { title: e.title }), "insight");
      };
      switch (t.kind) {
        case "device":
          // Built devices are always used through their interface; the
          // build / service view is one click away inside it.
          open(
            usesInterface(s, t.id) ? { kind: "deviceui", id: t.id } : { kind: "device", id: t.id },
          );
          return;
        case "npc":
          a.act((st) => {
            st.flags[`met_${t.id}`] = true;
          });
          open({ kind: "dialogue", npc: t.id });
          return;
        case "decor": {
          const pl = engineRef.current?.decorPlacement(t.id);
          if (!pl) return;
          if (!hasDecorAction(pl.decor, pl.room)) {
            soundRef.current?.("ui_open");
            open({ kind: "spot", placementId: t.id, decor: pl.decor });
            return;
          }
          // Jade's wardrobe: its flavour line, then the character menu in wardrobe mode.
          if (pl.decor === "wardrobe" && pl.room === "jadeq") {
            const r = a.act((st) => runDecorAction(st, t.id, pl.decor, pl.room, st.playTime));
            if (r.ok && !r.resting) {
              a.toast(r.who === "mcp" ? `MCP: ${r.text}` : r.text, "info");
              if (r.buff) soundRef.current?.("buff_on");
            }
            open({ kind: "character", atWardrobe: true });
            return;
          }
          showDecor(a.act((st) => runDecorAction(st, t.id, pl.decor, pl.room, st.playTime)));
          return;
        }
        case "terminal":
          soundRef.current?.("ui_open");
          archiveVisit({ terminal: t.id });
          open({ kind: "terminal", id: t.id });
          return;
        case "note": {
          const note = NOTES.find((x) => x.id === t.id);
          soundRef.current?.(note?.model === "tape" ? "tape_play" : "note_paper");
          if (note && !s.read[note.id]) barkRef.current?.("note_read", { author: note.author });
          const fresh = a.act((st) => readNote(st, t.id));
          announce(a, { insights: fresh });
          archiveVisit({ note: t.id });
          open({ kind: "note", id: t.id });
          return;
        }
        case "pickup": {
          const p = PICKUPS.find((x) => x.id === t.id)!;
          if (p.puzzle && !s.puzzles[p.puzzle]) {
            if (!puzzleAvailable(s, p.puzzle)) {
              soundRef.current?.("door_locked");
              a.toast(puzzleLockHint(s, p.puzzle) ?? tr("Not yet."), "warn");
              return;
            }
            openPuzzle(p.puzzle);
            return;
          }
          const r = a.act((st) => takePickup(st, t.id));
          if (!r.ok) soundRef.current?.("fail_buzz");
          else {
            engineRef.current?.fxAt("pickup_glint", p.x + 0.5, 1.6, p.z + 0.5);
            engineRef.current?.playGesture("crouch");
            const rare = r.items.some((it) => {
              const d = itemDef(a.get(), it.item);
              return !!d && (d.volatility >= 4 || d.kind === "relikt" || it.item === SLICE_ITEM);
            });
            if (rare) barkRef.current?.("pickup_rare");
          }
          if (r.ok)
            world.toast(
              tr("{label}: {text}", { label: p.label, text: r.message }),
              "good",
              r.items[0]?.item,
            );
          else if (prototypeUseOptions(a.get(), p.id).length)
            open({ kind: "proto", target: p.id, title: p.label, text: r.message });
          else a.toast(r.message, "warn");
          return;
        }
        case "door": {
          const d = DOORS.find((x) => x.id === t.id)!;
          if (doorIsOpen(s, d)) return;
          if (d.keypad) openPuzzle(d.keypad);
          else {
            soundRef.current?.("door_locked");
            if (prototypeUseOptions(s, d.id).length)
              open({
                kind: "proto",
                target: d.id,
                title: d.secret ? tr("Hollow wall") : tr("Locked door"),
                text: d.lockHint ?? tr("Locked."),
              });
            else a.toast(d.lockHint ?? tr("Locked."), "warn");
          }
          return;
        }
        case "prop": {
          const p = PROPS.find((x) => x.id === t.id)!;
          if (!evalCond(s, p.requires)) {
            a.toast(p.requiresHint ?? tr("That does not work yet."), "warn");
            return;
          }
          if (p.grants?.length) announce(a, { insights: a.act((st) => grant(st, p.grants)) });
          archiveVisit({ prop: p.id });
          if (p.id === PC_PROP) {
            soundRef.current?.("ui_open");
            open({ kind: "pc" });
            return;
          }
          if (p.id === STUDIO_PROP) {
            open({ kind: "studio" });
            return;
          }
          // Jade's wardrobe replicator “Needle's Eye” (stands at the wardrobe, mirror included).
          if (p.id === REPLICATOR_PROP) {
            open({ kind: "character", atWardrobe: true, atReplicator: true, tab: "replicator" });
            return;
          }
          // Biorhythm stations: Food Replicator, Neutro-Fridge, Jade's bed, ergometer.
          const station = BIO_STATION_BY_PROP.get(p.id);
          if (station) {
            const first =
              station === "fridge" &&
              a.act((st) => {
                const fresh = !st.flags.bio_fridge_seen;
                st.flags.bio_fridge_seen = true;
                return fresh;
              });
            open(
              first ? { kind: "bio_station", station, first } : { kind: "bio_station", station },
            );
            return;
          }
          // Prop variants with a decor action (Kantine coffee machine, beds, shelves …).
          if (propDecorAction(p)) {
            const r = a.act((st) => runPropDecorAction(st, p, st.playTime));
            if (r) {
              showDecor(r, p.id);
              return;
            }
          }
          /** Info line, or the prototype overlay when a carried prototype would do something here. */
          const say = (text: string) => {
            if (prototypeUseOptions(a.get(), p.id).length)
              open({ kind: "proto", target: p.id, title: p.label, text });
            else a.toast(text, "info");
          };
          if (p.kind === "terminal") open({ kind: "boot", prop: p.id });
          else if (p.kind === "workbench") open({ kind: "workbench" });
          else if (p.kind === "elevator") open({ kind: "elevator", prop: p.id });
          else if (p.kind === "forge") open({ kind: "forge", prop: p.id });
          else if (p.kind === "puzzle" && p.puzzle) {
            if (s.puzzles[p.puzzle]) say(tr("{label}: already solved.", { label: p.label }));
            else openPuzzle(p.puzzle);
          } else if (p.kind === "station")
            say(
              p.id === "damien_station"
                ? tr("{label}. The headset is still warm.", { label: p.label })
                : tr("{label}: {text}", {
                    label: p.label,
                    text: INSIGHT_BY_ID.get(p.grants?.[0] ?? "")?.text ?? tr("Nothing new."),
                  }),
            );
          else if (prototypeUseOptions(a.get(), p.id).length)
            open({
              kind: "proto",
              target: p.id,
              title: p.label,
              text: tr("Something could be tried here."),
            });
          return;
        }
      }
    },
    [open, openPuzzle, world, noteUsed],
  );

  // Mount the engine once (three.js is loaded lazily, client-only).
  useEffect(() => {
    let cancelled = false;
    let engine: LabEngine | null = null;
    const offChange = world.onChange(() => engineRef.current?.sync());
    import("@/lib/world/render/engine")
      .then(({ LabEngine }) => {
        if (cancelled || !mountRef.current) return;
        engine = new LabEngine(mountRef.current, world.get, {
          onFocus: (t) => setFocus(t),
          onInteract: (t) => interact(t),
          onRoom: (id) => {
            setRoom(id);
            if (id) barkRef.current?.("enter_room", { room: id });
            const r = id ? ROOM_BY_ID.get(id) : undefined;
            if (r && !world.get().flags[`visited_${r.id}`]) {
              world.act((st) => {
                st.flags[`visited_${r.id}`] = true;
              });
              world.toast(`${r.name} — ${r.blurb}`, "info");
            }
          },
          onWallMode: (label) => world.toast(label, "info"),
          onFootstep: (x, z, surface) => footstepRef.current?.(surface, [x, z]),
          onDoorMove: (_id, opening) => soundRef.current?.(opening ? "door_slide" : "door_close"),
          onDoorUnlock: () => soundRef.current?.("door_open"),
          onPathBlocked: (reason) => {
            if (reason === "locked") {
              soundRef.current?.("door_locked");
              world.toast(tr("The way is locked."), "warn");
            }
          },
          onMove: (f, pos) => {
            const s = world.get();
            // First real step away from where the session started → "move" learned.
            const from = moveOriginRef.current;
            if (!from || from.floor !== f)
              moveOriginRef.current = { floor: f, x: pos[0], z: pos[2] };
            else if (Math.abs(pos[0] - from.x) + Math.abs(pos[2] - from.z) > 1.5) noteUsed("move");
            if (lastFloorRef.current !== f) {
              lastFloorRef.current = f;
              barkRef.current?.("enter_floor", { floor: f });
            }
            s.floor = f;
            s.pos = [pos[0], Math.max(1, pos[1]), pos[2]];
            setFloor(f);
          },
        });
        engineRef.current = engine;
        // Dev-only handle for debugging and browser automation.
        if (process.env.NODE_ENV !== "production")
          Object.assign(window, {
            __lab: {
              engine,
              world,
              get audio() {
                return getAudioRef.current();
              },
            },
          });
        setLoading(false);
        if (!world.get().flags.intro_seen) open({ kind: "intro" });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      offChange();
      engine?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus label follows the object on screen; also notices the first camera
  // rotation (the engine turns on its own keys, so watch the yaw).
  useEffect(() => {
    let raf = 0;
    let yaw: number | null = null;
    const tick = () => {
      const eng = engineRef.current;
      setLabelPos(eng?.focusScreenPos() ?? null);
      if (eng) {
        const y = eng.cameraYaw();
        if (cinematicRef.current || yaw === null) yaw = y;
        else if (Math.abs(y - yaw) > 0.3) {
          yaw = y;
          noteUsed("camera");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [noteUsed]);

  // Global hotkeys (rebindable via settings).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F11") {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => undefined);
        return;
      }
      const action = actionForCode(e.code, getSettings().controls);
      if (action === "quicksave") {
        e.preventDefault();
        noteUsed("quicksave");
        const st = world.get();
        const slot = slotOf(st) ?? getActiveSlot();
        if (saveToSlot(slot, st))
          world.toast(tr("Quicksave: {slot}", { slot: SLOT_NAME[slot] }), "good");
        return;
      }
      if (action === "quickload") {
        e.preventDefault();
        onReload();
        return;
      }
      // During a cutscene the HUD is hidden: Esc (pause) skips the scene, panels stay shut.
      if (cinematicRef.current) {
        if (action === "pause" && !overlayRef.current && !menuLayerOpen()) {
          e.preventDefault();
          skipSceneRef.current();
        }
        return;
      }
      if (overlayRef.current || menuLayerOpen()) return;
      if (action === "pause") open({ kind: "pause" });
      else if (action === "inventory") {
        e.preventDefault();
        open({ kind: "inventory" });
      } else if (action === "journal") open({ kind: "journal" });
      else if (action === "power") open({ kind: "power" });
      else if (action === "help") open({ kind: "help" });
      else if (action === "workbench") open({ kind: "workbench" });
      // Fixed keys (not rebindable) — only when no rebindable action uses them.
      else if (action === null && e.code === "KeyM") open({ kind: "map" });
      else if (action === null && e.code === "KeyN") open({ kind: "knowledge" });
      else if (action === null && e.code === "KeyK") open({ kind: "achievements" });
      else if (action === null && e.code === "KeyC") open({ kind: "codex" });
      else if (action === null && e.code === "KeyO") open({ kind: "character" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, world, onReload, noteUsed]);

  // Contextual first-time hints (tutorial.ts), polled twice a second.
  const [hint, setHint] = useState<Hint | null>(null);
  const hintCtx = useRef({
    focus: null as Target | null,
    room: null as string | null,
    floor: 0 as FloorId,
    cinematic: false,
  });
  useEffect(() => {
    hintCtx.current = { focus, room, floor, cinematic: director.cinematic };
  }, [focus, room, floor, director.cinematic]);
  const hintRef = useRef<Hint | null>(null);
  useEffect(() => {
    hintRef.current = hint;
  }, [hint]);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (hintRef.current) return;
      const st = world.get();
      const c = hintCtx.current;
      const hctx = {
        focus: c.focus,
        room: c.room,
        floor: c.floor,
        overlay: overlayRef.current?.kind ?? null,
        powerGeneration: power(st).generation,
        hintsEnabled: getSettings().gameplay.hints,
        cinematic: c.cinematic,
      };
      // The tutorial first; the wardrobe's own first-time hints when it is quiet.
      const h = nextHint(st, hctx, st.playTime) ?? nextWardrobeHint(st, hctx, st.playTime);
      if (h) {
        world.act((x) => markHintSeen(x, h.id));
        soundRef.current?.("hint_pop");
        setHint(h);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [world]);

  // Biorhythm: an occasional gentle nudge while a need is low (rate-limited in
  // biorhythm.ts, then by the bark engine's own gaps). Mount-only: `world.get` is stable.
  const getWorld = world.get;
  useEffect(() => {
    const id = window.setInterval(() => {
      const st = getWorld();
      if (bioBarkDue(st, getSettings().gameplay.biorhythm, st.playTime))
        barkRef.current?.("bio_low");
    }, 10_000);
    return () => window.clearInterval(id);
  }, [getWorld]);

  // Events sent from the big terminal (`labor signal …`) — re-applied onto the
  // live state (idempotent) so a stale flush can never lose them.
  // `world` is a fresh object every render; act() re-renders, so this effect
  // must run once (mount) and read the latest api through a ref.
  const absorbWorldRef = useRef(world);
  absorbWorldRef.current = world;
  // The terminal overlay's iframe is another same-origin document, so its
  // queue writes arrive here as `storage` events while it is open.
  useEffect(() => {
    const absorb = (): number => absorbTerminalIntoWorld(absorbWorldRef.current);
    if (absorb() || absorbWorldRef.current.get().flags.terminal_used) {
      window.setTimeout(() => barkRef.current?.("return_from_terminal"), 2500);
    }
    return subscribeTerminalEvents(() => void absorb());
  }, []);

  // Autosave on the configured interval.
  useEffect(() => {
    let id = 0;
    const arm = () => {
      window.clearInterval(id);
      const sec = getSettings().gameplay.autosaveSeconds;
      if (sec > 0) id = window.setInterval(() => autosave(world.get()), sec * 1000);
    };
    arm();
    const off = subscribeSettings(arm);
    return () => {
      window.clearInterval(id);
      off();
    };
  }, [world]);

  // Jade's look on the 3D model: whenever the wardrobe look changes (and once
  // the engine is up, e.g. after loading a save). Compared by signature in a
  // ref — never `act` here (useWorld re-renders on every act).
  const lookSigRef = useRef<string | null>(null);
  const getLookState = world.get;
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || loading) return;
    const look = visibleLook(getLookState().wardrobe.look);
    const sig = lookSignature(look);
    if (sig === lookSigRef.current) return;
    lookSigRef.current = sig;
    eng.setPlayerLook(look);
  }, [world.version, loading, getLookState]);

  // Needle's Eye: a ping when a replicator job finishes (useWorld's tick clears the job).
  const replicatorJobRef = useRef<string | null>(null);
  useEffect(() => {
    const job = getLookState().wardrobe.job;
    const id = job ? `${job.kind}:${job.id}:${job.start}` : null;
    if (replicatorJobRef.current && !id) soundRef.current?.("replicator_ping");
    replicatorJobRef.current = id;
  }, [world.version, getLookState]);

  const [settings] = useSettings();
  /** Current key for a rebindable action ("I", "Esc", …). */
  const key = (a: ControlAction): string => labelForCode(settings.controls[a]);
  const playerInfo = useCallback(() => {
    const e = engineRef.current;
    if (!e) return null;
    const [x, , z] = e.playerPosition();
    return { x, z, facing: e.playerFacing(), yaw: e.cameraYaw() };
  }, []);
  /** Screen-space angle (deg, 0 = up) from the player toward a target. */
  const compassAngle = (t: { x: number; z: number; floor: FloorId }): number => {
    const e = engineRef.current;
    if (!e || t.floor !== floor) return 0;
    const [px, , pz] = e.playerPosition();
    const dx = t.x + 0.5 - px;
    const dz = t.z + 0.5 - pz;
    const yaw = e.cameraYaw();
    // Camera right = (cos yaw, -sin yaw), camera "up on screen" = (-sin yaw, -cos yaw).
    const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const up = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
    return (Math.atan2(right, up) * 180) / Math.PI;
  };
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!settings.graphics.showFps) return;
    const id = window.setInterval(() => setFps(Math.round(engineRef.current?.fps ?? 0)), 500);
    return () => window.clearInterval(id);
  }, [settings.graphics.showFps]);

  const close = useCallback(() => open(null), [open]);
  /** Open the big terminal in-game (the world stays loaded and paused underneath). */
  const openConsole = useCallback(
    (from?: "pause", markUsed = false) => {
      if (markUsed) {
        world.act((st) => {
          st.flags.terminal_used = true;
        });
      }
      open(from ? { kind: "console", back: from } : { kind: "console" });
    },
    [open, world],
  );
  const closeConsole = useCallback(() => {
    const cur = overlayRef.current;
    if (cur?.kind !== "console") return;
    // Fallback to the live `storage` sync: take whatever the terminal queued.
    absorbTerminalIntoWorld(absorbWorldRef.current);
    open(cur.back ? { kind: cur.back } : null);
    if (!cur.back) window.setTimeout(() => barkRef.current?.("return_from_terminal"), 1200);
  }, [open]);
  const closeHelp = useCallback(() => {
    const back = helpReturn.current;
    helpReturn.current = null;
    open(back);
  }, [open]);
  const s = world.get();
  const p = power(s);
  const prog = progress(s);
  const publicEndings = ENDINGS.filter((e) => !e.secret);
  const endingsDone =
    publicEndings.filter((e) => s.endings[e.id]).length + (s.endings.kristall ? 1 : 0);
  // One objective sweep per world version (and floor) feeds line, compass and minimap.
  const hud = settings.gameplay.hints
    ? hudObjective(s, objectivesCached(s, world.version))
    : { objective: undefined, target: null, tracked: false };
  const objective = hud.objective;
  const target = hud.target;
  const hudMode = settings.gameplay.hud;
  const legendVisible = showControlLegend(hudMode, s, legendUntil);
  const achievements = achievementCount(s);
  const label = focus ? targetLabel(s, focus, (id) => engineRef.current?.decorPlacement(id)) : null;
  const floorDef = FLOOR_BY_ID[floor];
  const roomDef = room ? ROOM_BY_ID.get(room) : undefined;

  const rotateCamera = (dir: 1 | -1) => {
    engineRef.current?.rotate(dir);
    noteUsed("camera");
  };
  /** The panel buttons — a row in the full HUD, the ☰ menu in the compact one. */
  const hudItems: (HudMenuItem & { tone: "green" | "cyan" | "amber" })[] = [
    {
      id: "inventory",
      tone: "green",
      label: tr("Inventory [{key}]", { key: key("inventory") }),
      onSelect: () => open({ kind: "inventory" }),
    },
    {
      id: "workbench",
      tone: "green",
      label: tr("Workbench [{key}]", { key: key("workbench") }),
      title: tr("Combine ({key})", { key: key("workbench") }),
      onSelect: () => open({ kind: "workbench" }),
    },
    {
      id: "journal",
      tone: "cyan",
      label: tr("Journal [{key}]", { key: key("journal") }),
      onSelect: () => open({ kind: "journal" }),
    },
    {
      id: "character",
      tone: "cyan",
      label: tr("Character [O]"),
      title: tr("Jade's wardrobe and replicator (O)"),
      onSelect: () => open({ kind: "character" }),
    },
    {
      id: "knowledge",
      tone: "cyan",
      label: tr("Knowledge [N]"),
      title: tr("What Jade knows, has done and has written down (N)"),
      onSelect: () => open({ kind: "knowledge" }),
    },
    {
      id: "codex",
      tone: "cyan",
      label: tr("Handbook [C]"),
      title: tr("Lab handbook (C)"),
      onSelect: () => open({ kind: "codex" }),
    },
    {
      id: "achievements",
      tone: "cyan",
      label: `★ ${achievements.unlocked}/${achievements.total}`,
      title: tr("Achievements (K)"),
      ariaLabel: tr("Achievements: {n} of {total} (K)", {
        n: achievements.unlocked,
        total: achievements.total,
      }),
      onSelect: () => open({ kind: "achievements" }),
    },
    {
      id: "pause",
      tone: "amber",
      label: tr("Menu"),
      title: tr("Menu ({key})", { key: key("pause") }),
      onSelect: () => open({ kind: "pause" }),
    },
    {
      id: "help",
      tone: "amber",
      label: `? [${key("help")}]`,
      title: tr("Controls & hints ({key})", { key: key("help") }),
      ariaLabel: tr("Controls & hints ({key})", { key: key("help") }),
      onSelect: () => open({ kind: "help" }),
    },
  ];

  const [fading, setFading] = useState(false);
  /**
   * Sleep in Jade's bed: she walks to it and lies down, then a short fade to
   * black while rest → 100 and a few minutes pass. She stays lying until the
   * player moves.
   */
  const sleepNow = () => {
    close();
    const eta = engineRef.current?.restIn({ kind: "prop", id: "jades_bett" }) ?? null;
    // Fade once she lies (capped, so a long walk never delays the rest).
    const wait = eta === null ? 700 : Math.min(5000, Math.max(700, eta * 1000));
    window.setTimeout(
      () => {
        setFading(true);
        window.setTimeout(() => {
          announceBio(
            apiRef.current,
            world.act((st) => bioSleep(st)),
          );
          window.setTimeout(() => setFading(false), 500);
        }, 700);
      },
      wait - 700 > 0 ? wait - 700 : 0,
    );
  };
  // Endings: trigger → the director plays the ending scene → epilogue sequence.
  const [pendingEnding, setPendingEnding] = useState<string | null>(null);
  const [endingShown, setEndingShown] = useState(false);
  const triggerEnding = (id: string) => {
    close();
    setPendingEnding(id);
    setEndingShown(false);
    world.act((st) => reachEnding(st, id));
  };
  useEffect(() => {
    if (!pendingEnding || endingShown) return;
    const seen = !!world.get().flags[`scene_ending_${pendingEnding}`];
    if (seen && !director.cinematic) {
      setEndingShown(true);
      return;
    }
    // Fallback if no scene starts (e.g. scenes disabled): show the epilogue anyway.
    if (director.cinematic) return;
    const t = window.setTimeout(() => {
      if (!world.get().flags[`scene_ending_${pendingEnding}`]) setEndingShown(true);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [pendingEnding, endingShown, director.cinematic, world, world.version]);

  const goFloor = (f: FloorId) => {
    const eng = engineRef.current;
    if (!eng) return;
    close();
    eng.setInputEnabled(false);
    const target = ELEVATORS.find((x) => x.floor === f)!;
    const ok = eng.rideElevator(f, {
      onEvent: (e) => {
        if (e === "gate-close" || e === "gate-open") director.sound("gate_rattle");
        if (e === "depart") director.sound("elevator_start");
        if (e === "arrive") director.sound("elevator_stop");
        if (e === "fade-out") setFading(true);
      },
      onMidpoint: () => {
        eng.setFloor(f, [target.x + 0.5, 1, target.z + 0.5]);
        world.act((st) => {
          st.floor = f;
        });
        setFading(false);
      },
      onDone: () => {
        eng.setInputEnabled(true);
        director.floorReached(f);
      },
    });
    if (!ok) eng.setInputEnabled(true);
  };
  useEffect(() => {
    world.setPaused(overlay?.kind === "pause" || overlay?.kind === "console");
  }, [overlay, world]);
  // Puzzle/workbench focus thins the score; closing (incl. Esc) restores it.
  const setMusicFocus = director.setFocus;
  useEffect(() => {
    const k = overlay?.kind;
    setMusicFocus(k === "puzzle" || k === "workbench");
  }, [overlay, setMusicFocus]);
  // Lawrence's body language follows what the player is doing.
  useEffect(() => {
    const k = overlay?.kind;
    engineRef.current?.setPlayerMode(
      endingShown
        ? "celebrate"
        : k === "dialogue"
          ? "talk"
          : k === "terminal"
            ? "typing"
            : k === "decor" && overlay?.kind === "decor"
              ? (overlay.result.pose ??
                poseForDecorVerb(
                  overlay.result.verb,
                  engineRef.current?.decorPlacement(overlay.result.placementId)?.decor ??
                    overlay.result.placementId,
                ))
              : k === "puzzle" || k === "workbench"
                ? "think"
                : "idle",
    );
  }, [overlay, endingShown]);

  const onPuzzleSolved = (id: string) => {
    director.sound("puzzle_solved");
    const r = world.act((st) => solvePuzzle(st, id));
    const pkind = PUZZLE_BY_ID.get(id)?.kind;
    if (pkind) window.setTimeout(() => director.bark("puzzle_solved", { kind: pkind }), 1500);
    const pz = PUZZLE_BY_ID.get(id);
    if (pz) world.toast(`MCP: ${pz.mcpSolved}`, "good");
    if (r.items.length) world.toast(tr("Received: {items}", { items: r.items.join(", ") }), "good");
    announce(api, r);
    // A solve flushed while the host already switched away (PuzzleView
    // unmounted mid-animation) must not reopen the panel it came from.
    const cur = overlayRef.current;
    if (cur?.kind === "puzzle" && cur.id === id) {
      open(puzzleReturn.current);
      puzzleReturn.current = null;
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07080b] font-mono text-[#33FF33] select-none">
      <div
        ref={mountRef}
        className="absolute inset-0"
        style={{ filter: colorblindFilter(settings.accessibility.colorblindMode) || undefined }}
      />

      {/* Scanlines + vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ boxShadow: "inset 0 0 160px rgba(0,0,0,0.85)" }}
      />

      {(loading || error) && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <p className={error ? "text-red-400" : "animate-pulse text-[#FFB800]"}>
            {error ? tr("Error: {error}", { error }) : tr("COLD START · Loading the lab …")}
          </p>
        </div>
      )}

      <UiScale
        className={
          director.cinematic
            ? "pointer-events-none opacity-0 transition-opacity"
            : "transition-opacity"
        }
      >
        {/* HUD — status */}
        <div className="absolute top-3 left-3 z-20 w-72 rounded-sm border border-[#FFB800]/30 bg-black/70 p-3 text-xs">
          <p className="tracking-[0.2em] text-[#FFB800] uppercase">_unLAB · {floorDef.short}</p>
          <p className="text-[#d8ffd8]">{floorDef.name}</p>
          <p className="mb-2 text-[#00FFFF]">{roomDef?.name ?? "—"}</p>
          <button
            type="button"
            className="block w-full text-left"
            onClick={() => open({ kind: "power" })}
            title={tr("Power ({key})", { key: key("power") })}
          >
            <div className="flex justify-between">
              <span>{tr("Power")}</span>
              <span className={p.starved.length ? "text-red-400" : "text-[#33FF33]"}>
                {fmtNum(p.demand, 1)} / {fmtNum(p.generation, 0)} W
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-white/10">
              <div
                className="h-full"
                style={{
                  width: `${p.generation ? Math.min(100, (p.demand / p.generation) * 100) : 0}%`,
                  background: p.starved.length ? "#FF3333" : "#33FF33",
                }}
              />
            </div>
          </button>
          <div className="mt-2 flex justify-between text-white/60">
            <span>{tr("Devices {n}/{total}", { n: prog.devices, total: prog.totalDevices })}</span>
            <span>{tr("Insights {n}", { n: prog.insights })}</span>
            <span>{tr("Paths {n}/{total}", { n: endingsDone, total: publicEndings.length })}</span>
          </div>
          <BuffHud getState={world.get} />
          <BioHud
            getState={world.get}
            mode={settings.gameplay.biorhythm}
            hud={hudMode}
            onOpen={() => open({ kind: "bio" })}
          />
        </div>

        {/* Compass: the most urgent open objective */}
        {objective && !overlay && (
          <div className="pointer-events-none absolute top-14 left-1/2 z-20 flex max-w-[46vw] -translate-x-1/2 items-center gap-2 rounded-sm border border-[#E91E8C]/40 bg-black/70 px-3 py-1.5 text-xs">
            {target && (
              <span
                className="inline-block text-base text-[#E91E8C]"
                style={{ transform: `rotate(${compassAngle(target)}deg)` }}
                aria-hidden
              >
                {target.floor === floor
                  ? "▲"
                  : target.floor > floor || target.floor === 4
                    ? "⇡"
                    : "⇣"}
              </span>
            )}
            {hud.tracked && (
              <span
                className="shrink-0 text-[#E91E8C]"
                role="img"
                aria-label={tr("Tracked objective")}
                title={tr("Tracked objective")}
              >
                ⚑
              </span>
            )}
            <span className="truncate text-[#ffd0ea]">{objective.text}</span>
            {target && target.floor !== floor && (
              <span className="shrink-0 text-white/50">· {FLOOR_BY_ID[target.floor].short}</span>
            )}
          </div>
        )}

        {/* HUD — buttons (full: one row · compact: ☰ menu + rotate · minimal: none) */}
        {hudMode !== "minimal" && (
          <div className="absolute top-3 right-3 z-20 flex flex-wrap justify-end gap-1.5">
            {hudMode === "full" ? (
              hudItems.map((it) => (
                <CrtButton
                  key={it.id}
                  tone={it.tone}
                  onClick={it.onSelect}
                  title={it.title}
                  aria-label={it.ariaLabel}
                >
                  {it.label}
                </CrtButton>
              ))
            ) : (
              <HudMenu items={hudItems} label={tr("hud::Actions menu")} />
            )}
            <CrtButton
              tone="amber"
              onClick={() => rotateCamera(-1)}
              title={tr("Rotate camera ({key})", { key: key("rotateLeft") })}
              aria-label={tr("hud::Rotate camera left")}
            >
              ⟲
            </CrtButton>
            <CrtButton
              tone="amber"
              onClick={() => rotateCamera(1)}
              title={tr("Rotate camera ({key})", { key: key("rotateRight") })}
              aria-label={tr("hud::Rotate camera right")}
            >
              ⟳
            </CrtButton>
          </div>
        )}

        {/* Focus label */}
        {label && labelPos && !overlay && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-sm border border-[#FFB800]/50 bg-black/80 px-2 py-1 text-center text-xs"
            style={{ left: labelPos.x, top: labelPos.y }}
          >
            <p className="text-[#FFB800]">{label.title}</p>
            <p className="text-[10px] text-white/60">
              <span className="text-[#00FFFF]">[{key("interact")}]</span> {label.sub}
            </p>
          </div>
        )}

        {hint && !director.cinematic && (
          <HintBubble key={hint.id} hint={hint} onDismiss={() => setHint(null)} />
        )}

        {/* Floor transition */}
        <div
          className="pointer-events-none absolute inset-0 z-30 bg-black transition-opacity duration-300"
          style={{ opacity: fading ? 1 : 0 }}
        />

        {/* Cinematic subtitles */}
        {director.subtitle && (
          <div className="pointer-events-none absolute bottom-[24vh] left-1/2 z-40 w-[min(760px,90vw)] -translate-x-1/2 text-center">
            <p
              className="text-[11px] tracking-[0.3em] uppercase"
              style={{ color: SPEAKERS[director.subtitle.who]?.color ?? "#E8F4FF" }}
            >
              {SPEAKERS[director.subtitle.who]?.name ?? director.subtitle.who}
            </p>
            <p
              className="mt-1 leading-snug text-[#f0f6ee] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
              style={{ fontSize: "calc(1rem * var(--unlab-subtitle-scale, 1))" }}
            >
              {director.subtitle.text}
            </p>
          </div>
        )}
        {/* Now playing: title and genre of a song that just started */}
        {director.nowPlaying && !director.cinematic && (
          <div
            key={director.nowPlaying.key}
            role="status"
            aria-live="polite"
            data-now-playing
            className="unlab-now-playing pointer-events-none absolute bottom-[11vh] left-1/2 z-30 -translate-x-1/2 border border-[#00FFFF]/25 bg-black/55 px-3 py-1 text-center font-mono text-[11px] text-[#9FF7FF]"
          >
            <span className="text-[#FFB800]">♪</span> {director.nowPlaying.title}
            <span className="text-white/45">
              {" · "}
              {GENRE_LABEL[director.nowPlaying.genre as Genre] ?? director.nowPlaying.genre}
              {director.nowPlaying.jukebox ? ` · ${tr("Studio")}` : ""}
            </span>
          </div>
        )}
        {director.titleCard && (
          <SceneTitleCard
            key={director.titleCard.key}
            title={director.titleCard.title}
            {...(director.titleCard.sub ? { sub: director.titleCard.sub } : {})}
            seconds={director.titleCard.seconds}
          />
        )}
        {director.cinematic && (
          <button
            type="button"
            onClick={director.skipScene}
            className="absolute right-4 bottom-[4vh] z-40 border border-white/30 bg-black/60 px-3 py-1 text-[11px] text-white/70 hover:text-white"
          >
            {tr("Skip ›")}
          </button>
        )}

        {/* Minimap */}
        {!overlay && (
          <button
            type="button"
            onClick={() => open({ kind: "map" })}
            title={tr("Map (M)")}
            className="absolute right-3 bottom-10 z-20 rounded-sm border border-[#FFB800]/30 bg-black/60 p-1"
          >
            <Minimap
              state={s}
              floor={floor}
              player={playerInfo}
              version={world.version}
              target={target}
              tracked={hud.tracked}
            />
          </button>
        )}
        {settings.graphics.showFps && (
          <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2 text-[11px] text-[#FFB800]">
            {fps} FPS
          </div>
        )}

        {/* Toasts */}
        <div className="pointer-events-none absolute bottom-12 left-3 z-30 flex max-w-lg flex-col gap-1.5">
          {world.toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-sm border bg-black/85 px-3 py-1.5 text-xs ${
                t.tone === "good"
                  ? "border-[#33FF33]/50 text-[#b8ffb8]"
                  : t.tone === "warn"
                    ? "border-red-500/50 text-red-300"
                    : t.tone === "insight"
                      ? "border-[#00FFFF]/60 text-[#aefcff]"
                      : "border-white/20 text-[#d8ffd8]"
              } flex items-center gap-2`}
            >
              {t.item && itemDef(s, t.item) && (
                <ItemIcon item={itemDef(s, t.item)!} size={26} frame={false} />
              )}
              {t.item && isWearPickupItem(t.item) && wearIdFromItem(t.item) && (
                <WearIcon item={wearIdFromItem(t.item)!} size={26} />
              )}
              <span>{t.text}</span>
            </div>
          ))}
        </div>

        <div
          className={`pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 text-[11px] text-white/40 transition-opacity duration-1000 ${
            legendVisible ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!legendVisible}
        >
          {tr(
            "{move} / click move · {interact} use · {rotL}/{rotR} rotate · V walls · {inv} Inventory · {wb} Workbench · {journal} Journal · {power} Power · C Handbook · M Map · {pause} Menu",
            {
              move: `${key("moveUp")}${key("moveLeft")}${key("moveDown")}${key("moveRight")}`,
              interact: key("interact"),
              rotL: key("rotateLeft"),
              rotR: key("rotateRight"),
              inv: key("inventory"),
              wb: key("workbench"),
              journal: key("journal"),
              power: key("power"),
              pause: key("pause"),
            },
          )}
        </div>

        {/* Overlays */}
        {overlay?.kind === "knowledge" && (
          <KnowledgePanel
            api={api}
            onClose={close}
            onAchievements={() => open({ kind: "achievements" })}
          />
        )}
        {overlay?.kind === "pc" && (
          <PersonalComputer
            api={api}
            onClose={close}
            onTerminal={() => open({ kind: "terminal", id: "term_jadeq" })}
          />
        )}
        {overlay?.kind === "studio" && <StudioPanel getAudio={director.getAudio} onClose={close} />}
        {overlay?.kind === "deviceui" && (
          <DeviceInterface
            key={overlay.id}
            id={overlay.id}
            api={api}
            onClose={close}
            onService={() => open({ kind: "device", id: overlay.id })}
            onTalk={(npc) => open({ kind: "dialogue", npc })}
            onWorkbench={() => open({ kind: "workbench" })}
            onInventory={() => open({ kind: "inventory" })}
            onPower={() => open({ kind: "power" })}
          />
        )}
        {overlay?.kind === "spot" && (
          <SpotPanel
            key={overlay.placementId}
            api={api}
            spot={{ decor: overlay.placementId }}
            title={spotName(overlay.decor)}
            searchable={SEARCHABLE_DECOR.has(overlay.decor)}
            spotId={overlay.placementId}
            onClose={close}
          />
        )}
        {overlay?.kind === "device" && (
          <DevicePanel
            onInterface={
              usesInterface(api.get(), overlay.id)
                ? () => open({ kind: "deviceui", id: overlay.id })
                : undefined
            }
            id={overlay.id}
            api={api}
            onClose={close}
            openPuzzle={openPuzzle}
            onTalk={(npc) => open({ kind: "dialogue", npc })}
            onWorkbench={() => open({ kind: "workbench" })}
            onInventory={() => open({ kind: "inventory" })}
            onEnding={triggerEnding}
            onPower={() => open({ kind: "power" })}
            onProto={protoUse}
          />
        )}
        {overlay?.kind === "workbench" && <WorkbenchPanel api={api} onClose={close} />}
        {overlay?.kind === "inventory" && (
          <InventoryPanel
            api={api}
            onClose={close}
            onProto={protoUse}
            onWardrobe={() => open({ kind: "character" })}
          />
        )}
        {overlay?.kind === "character" && (
          <CharacterMenu
            key={`${overlay.atWardrobe ? "w" : "-"}${overlay.atReplicator ? "r" : "-"}${overlay.tab ?? ""}`}
            api={api}
            atWardrobe={!!overlay.atWardrobe}
            atReplicator={!!overlay.atReplicator}
            initialTab={overlay.tab ?? "wardrobe"}
            onClose={close}
          />
        )}
        {overlay?.kind === "journal" && <JournalPanel api={api} onClose={close} />}
        {overlay?.kind === "power" && <PowerPanel api={api} onClose={close} />}
        {overlay?.kind === "dialogue" && (
          <DialoguePanel npcId={overlay.npc} api={api} onClose={close} onProto={protoUse} />
        )}
        {overlay?.kind === "note" && <NotePanel noteId={overlay.id} onClose={close} />}
        {overlay?.kind === "elevator" && (
          <ElevatorPanel
            api={api}
            current={floor}
            onClose={close}
            onGo={goFloor}
            openPuzzle={openPuzzle}
            protoTarget={overlay.prop}
            onProto={protoUse}
          />
        )}
        {endingShown && pendingEnding && (
          <EndingSequence
            endingId={pendingEnding}
            state={world.get()}
            onContinue={() => {
              world.act((st) => enterPostgame(st, pendingEnding));
              setPendingEnding(null);
              setEndingShown(false);
            }}
            onMainMenu={() => {
              world.act((st) => enterPostgame(st, pendingEnding));
              setPendingEnding(null);
              setEndingShown(false);
              onMainMenu();
            }}
          />
        )}
        {overlay?.kind === "forge" && (
          <ForgePanel
            api={api}
            onClose={close}
            onEnding={triggerEnding}
            protoTarget={overlay.prop}
            onProto={protoUse}
          />
        )}
        {overlay?.kind === "puzzle" && PUZZLE_BY_ID.get(overlay.id) && (
          <PuzzleView
            key={overlay.id}
            def={PUZZLE_BY_ID.get(overlay.id)!}
            onSolved={() => onPuzzleSolved(overlay.id)}
            onSound={director.sound}
            extra={<PrototypeUse api={api} target={overlay.id} onUse={protoUse} />}
            onClose={() => {
              const pk = PUZZLE_BY_ID.get(overlay.id)?.kind;
              if (pk) director.bark("puzzle_failed", { kind: pk });
              open(puzzleReturn.current);
              puzzleReturn.current = null;
            }}
          />
        )}
        {overlay?.kind === "boot" && (
          <Panel title={tr("Main Console")} subtitle={tr("_unOS · kernel ready")} onClose={close}>
            <p className="mb-3 text-xs text-[#d8ffd8]/80">
              {trNodes(
                tr(
                  "The big console wakes up. Green phosphor, a blinking cursor. From here Jade ran the whole lab through the terminal. Codes and signals can be sent there with {signal}; {status} shows the lab status.",
                ),
                {
                  signal: <span className="text-[#FFB800]">labor signal &lt;code&gt;</span>,
                  status: <span className="text-[#FFB800]">labor</span>,
                },
              )}
            </p>
            <div className="flex gap-2">
              <CrtButton tone="green" onClick={() => openConsole(undefined, true)}>
                {tr("Open terminal")}
              </CrtButton>
              <CrtButton tone="amber" onClick={close}>
                {tr("Later")}
              </CrtButton>
            </div>
            {overlay.prop && (
              <PrototypeUse api={api} target={overlay.prop} onUse={protoUse} className="mt-3" />
            )}
          </Panel>
        )}
        {overlay?.kind === "proto" && (
          <Panel
            title={overlay.title}
            subtitle={tr("Try it with a prototype")}
            onClose={close}
            accent="#E91E8C"
          >
            <p className="mb-3 text-xs text-[#d8ffd8]/80">{overlay.text}</p>
            <PrototypeUse api={api} target={overlay.target} onUse={protoUse} defaultOpen />
          </Panel>
        )}
        {overlay?.kind === "help" && (
          <Panel title={tr("Controls & hints")} onClose={closeHelp}>
            <ul className="space-y-1 text-xs text-[#d8ffd8]">
              <li>
                <b className="text-[#FFB800]">
                  {key("moveUp")} {key("moveLeft")} {key("moveDown")} {key("moveRight")} /{" "}
                  {tr("arrows")}
                </b>{" "}
                {tr("walk")} · <b className="text-[#FFB800]">{tr("Left click")}</b>{" "}
                {tr("walk there / use an object")}
              </li>
              <li>
                <b className="text-[#FFB800]">
                  {key("interact")} / {tr("key::Space")}
                </b>{" "}
                {tr("interact with the highlighted object")}
              </li>
              <li>
                <b className="text-[#FFB800]">
                  {key("rotateLeft")} / {key("rotateRight")}
                </b>{" "}
                {tr("rotate the camera by 90°")} ·{" "}
                <b className="text-[#FFB800]">
                  {tr("Mouse wheel")}, {key("zoomIn")} / {key("zoomOut")}
                </b>{" "}
                {tr("zoom")} · <b className="text-[#FFB800]">V</b> {tr("hide walls")}
              </li>
              <li>
                <b className="text-[#FFB800]">{key("inventory")}</b> {tr("Inventory")} ·{" "}
                <b className="text-[#FFB800]">{key("workbench")}</b> {tr("Workbench")} ·{" "}
                <b className="text-[#FFB800]">{key("journal")}</b> {tr("Journal")} ·{" "}
                <b className="text-[#FFB800]">{key("power")}</b> {tr("Power")} ·{" "}
                <b className="text-[#FFB800]">C</b> {tr("Handbook")} ·{" "}
                <b className="text-[#FFB800]">M</b> {tr("Map")} ·{" "}
                <b className="text-[#FFB800]">K</b> {tr("Achievements")} ·{" "}
                <b className="text-[#FFB800]">O</b> {tr("Character")}
              </li>
              <li>
                <b className="text-[#FFB800]">{key("quicksave")}</b> {tr("Quicksave")} ·{" "}
                <b className="text-[#FFB800]">{key("quickload")}</b> {tr("Quickload")} ·{" "}
                <b className="text-[#FFB800]">F11</b> {tr("Fullscreen")} ·{" "}
                <b className="text-[#FFB800]">{key("help")}</b> {tr("Help")} ·{" "}
                <b className="text-[#FFB800]">{key("pause")}</b> {tr("Menu / close")}
              </li>
            </ul>
            <p className="mt-3 text-xs text-white/60">
              {tr(
                "Devices are built in three stages: frame → core → calibration. Slots accept the named part or any part with enough traits — including prototypes you combined yourself. You can combine anything; the same ingredients always give the same result. Jade's Main Console in the Control Room opens the big terminal. Coffee, fresh air and the greenhouse give short effects — they are listed top left under the power display.",
              )}
            </p>
            <p className="mt-2 text-xs text-white/40">
              {tr(
                "Almost every key can be rebound under Menu → Settings → Controls; V, M, K, C and O are fixed.",
              )}
            </p>
            <div className="mt-4 flex gap-2">
              <CrtButton tone="amber" onClick={closeHelp}>
                {helpReturn.current ? tr("Back") : tr("Keep playing")}
              </CrtButton>
              <CrtButton tone="cyan" onClick={() => openConsole()}>
                {tr("To the terminal (shortcut)")}
              </CrtButton>
            </div>
          </Panel>
        )}
        {overlay?.kind === "pause" && (
          <PauseMenu
            getState={world.get}
            onResume={close}
            onLoad={onReload}
            onMainMenu={onMainMenu}
            onTerminal={() => openConsole("pause")}
            onCharacter={() => open({ kind: "character" })}
            onHelp={() => {
              helpReturn.current = { kind: "pause" };
              open({ kind: "help" });
            }}
            onSaved={(id) => world.toast(tr("Saved: {slot}", { slot: SLOT_NAME[id] }), "good")}
          />
        )}
        {overlay?.kind === "achievements" && (
          <AchievementsPanel state={s} version={world.version} onClose={close} />
        )}
        {overlay?.kind === "codex" && (
          <Codex
            state={s}
            version={world.version}
            onClose={close}
            initialTab={overlay.tab}
            {...(overlay.entry ? { initialEntry: overlay.entry } : {})}
          />
        )}
        {overlay?.kind === "decor" && (
          <DecorActionPanel
            key={overlay.result.placementId + overlay.result.actionId + world.version}
            result={overlay.result}
            onClose={close}
            extra={
              overlay.prop ? (
                <PrototypeUse api={api} target={overlay.prop} onUse={protoUse} />
              ) : (
                (() => {
                  const pl = engineRef.current?.decorPlacement(overlay.result.placementId);
                  return pl && isArchiveDecor(pl.id, pl.decor) ? (
                    <SpotEntries
                      api={api}
                      spot={{ decor: pl.id }}
                      searchable={SEARCHABLE_DECOR.has(pl.decor)}
                      spotId={pl.id}
                    />
                  ) : undefined;
                })()
              )
            }
          />
        )}
        {overlay?.kind === "bio" && (
          <BioPanel api={api} mode={settings.gameplay.biorhythm} onClose={close} />
        )}
        {overlay?.kind === "bio_station" && (
          <BioStationPanel
            api={api}
            station={overlay.station}
            mode={settings.gameplay.biorhythm}
            first={overlay.first ?? false}
            onClose={close}
            onSleep={sleepNow}
          />
        )}
        {overlay?.kind === "terminal" && (
          <RoomTerminal
            terminalId={overlay.id}
            getState={world.get}
            act={world.act}
            onClose={close}
            onOpenBigTerminal={() => openConsole(undefined, true)}
          />
        )}
        {overlay?.kind === "console" && (
          <TerminalOverlay onOpen={() => saveWorld(world.get())} onClose={closeConsole} />
        )}
        {overlay?.kind === "map" && (
          <MapOverlay
            state={s}
            version={world.version}
            player={playerInfo}
            target={target}
            tracked={hud.tracked}
            act={world.act}
            onClose={close}
            onOpenCodex={(entry, tab) => open({ kind: "codex", tab, entry })}
            onGoTo={(x, z) => {
              close();
              engineRef.current?.goTo(x, z);
            }}
            onOpenNote={(id) => open({ kind: "note", id })}
          />
        )}
        {overlay?.kind === "intro" && (
          <IntroSequence
            onDone={() => {
              world.act((st) => {
                st.flags.intro_seen = true;
              });
              engineRef.current?.director.fadeTo(1, 0);
              close();
              director.playIntro();
            }}
            onTick={() => director.sound("typewriter_tick", undefined, 0.25)}
          />
        )}
      </UiScale>
    </div>
  );
}

/** Subtitle speakers: NPCs, Jade, the Halo and the lab PA ("Announcement"). */
const SPEAKERS: Record<string, { name: string; color: string }> = { ...SPEAKER, ...BARK_SPEAKERS };

type Phase = "title" | "loading" | "play";

/**
 * Root of the lab world: title screen → loading → game. The game subtree
 * is keyed by `worldKey`, so loading another slot remounts it and
 * `useWorld` reads the newly active slot.
 */
export function LabWorld() {
  const [phase, setPhase] = useState<Phase>("title");
  const [worldKey, setWorldKey] = useState(0);
  const [progress, setProgress] = useState(0);
  /** The terminal overlay opened from the title screen (no world loaded yet). */
  const [titleConsole, setTitleConsole] = useState(false);

  const startPlay = useCallback(() => {
    setPhase("loading");
    setProgress(0);
    let p = 0;
    const id = window.setInterval(() => {
      p += 0.2;
      setProgress(Math.min(1, p));
      if (p >= 1) {
        window.clearInterval(id);
        setWorldKey((k) => k + 1);
        setPhase("play");
      }
    }, 120);
  }, []);

  return (
    <>
      {phase === "title" && <TitleMusic />}
      {phase === "title" && (
        <UiScale>
          <TitleScreen
            onContinue={startPlay}
            onNewGame={startPlay}
            onLoad={startPlay}
            onTerminal={() => setTitleConsole(true)}
          />
        </UiScale>
      )}
      {phase === "title" && titleConsole && (
        <TerminalOverlay onClose={() => setTitleConsole(false)} />
      )}
      {phase === "loading" && (
        <UiScale>
          <LoadingScreen progress={progress} />
        </UiScale>
      )}
      {phase === "play" && (
        <LabGame key={worldKey} onMainMenu={() => setPhase("title")} onReload={startPlay} />
      )}
    </>
  );
}
