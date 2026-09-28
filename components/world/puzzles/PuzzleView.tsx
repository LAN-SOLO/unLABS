"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { PUZZLE_KIND_LABEL } from "@/components/world/map/dossier";
import { UiScale, useEscLayer } from "@/components/world/menu/shared";
import { ArbitragePuzzle } from "@/components/world/puzzles/ArbitragePuzzle";
import { CipherPuzzle } from "@/components/world/puzzles/CipherPuzzle";
import { ClampPuzzle } from "@/components/world/puzzles/ClampPuzzle";
import { CoolantPuzzle } from "@/components/world/puzzles/CoolantPuzzle";
import { CrcPuzzle } from "@/components/world/puzzles/CrcPuzzle";
import { EraPuzzle } from "@/components/world/puzzles/EraPuzzle";
import { EthicsPuzzle } from "@/components/world/puzzles/EthicsPuzzle";
import { HeatPuzzle } from "@/components/world/puzzles/HeatPuzzle";
import { HuePuzzle } from "@/components/world/puzzles/HuePuzzle";
import { KeypadPuzzle } from "@/components/world/puzzles/KeypadPuzzle";
import { LaserPuzzle } from "@/components/world/puzzles/LaserPuzzle";
import { LayersPuzzle } from "@/components/world/puzzles/LayersPuzzle";
import { LissajousPuzzle } from "@/components/world/puzzles/LissajousPuzzle";
import { MemeticPuzzle } from "@/components/world/puzzles/MemeticPuzzle";
import { MorsePuzzle } from "@/components/world/puzzles/MorsePuzzle";
import { PalettePuzzle } from "@/components/world/puzzles/PalettePuzzle";
import { PipesPuzzle } from "@/components/world/puzzles/PipesPuzzle";
import { RadioPuzzle } from "@/components/world/puzzles/RadioPuzzle";
import { SigilsPuzzle } from "@/components/world/puzzles/SigilsPuzzle";
import { SolderPuzzle } from "@/components/world/puzzles/SolderPuzzle";
import { StencilPuzzle } from "@/components/world/puzzles/StencilPuzzle";
import { TemporalPuzzle } from "@/components/world/puzzles/TemporalPuzzle";
import { TonesPuzzle } from "@/components/world/puzzles/TonesPuzzle";
import { TrendPuzzle } from "@/components/world/puzzles/TrendPuzzle";
import { ValvePuzzle } from "@/components/world/puzzles/ValvePuzzle";
import { WiringPuzzle } from "@/components/world/puzzles/WiringPuzzle";
import {
  CrtButton,
  PuzzleFxProvider,
  PuzzleStyles,
  type PuzzleFx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";
import type { SfxName } from "@/lib/world/audio/sfx";
import { useSettings } from "@/lib/world/settings";
import type { PuzzleDef } from "@/lib/world/types";

/** Time the solve animation (scanline sweep + stamp) plays before `onSolved`. */
export const SOLVED_DELAY_MS = 1100;
/** Same SFX name faster than this is dropped (knob wheels, slider drags). */
const SOUND_THROTTLE_MS = 55;
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function PuzzleBody({ def, ...props }: PuzzleProps & { def: PuzzleDef }): ReactNode {
  switch (def.kind) {
    case "pipes":
      return <PipesPuzzle {...props} />;
    case "valve":
      return <ValvePuzzle {...props} />;
    case "lissajous":
      return <LissajousPuzzle {...props} />;
    case "cipher":
      return <CipherPuzzle {...props} />;
    case "tones":
      return <TonesPuzzle {...props} />;
    case "heat":
      return <HeatPuzzle {...props} />;
    case "coolant":
      return <CoolantPuzzle {...props} />;
    case "keypad":
      return <KeypadPuzzle {...props} />;
    case "crc":
      return <CrcPuzzle {...props} />;
    case "sigils":
      return <SigilsPuzzle {...props} />;
    case "temporal":
      return <TemporalPuzzle {...props} />;
    case "laser":
      return <LaserPuzzle {...props} />;
    case "hue":
      return <HuePuzzle {...props} />;
    case "era":
      return <EraPuzzle {...props} />;
    case "arbitrage":
      return <ArbitragePuzzle {...props} />;
    case "ethics":
      return <EthicsPuzzle {...props} />;
    case "memetic":
      return <MemeticPuzzle {...props} />;
    case "stencil":
      return <StencilPuzzle {...props} />;
    case "clamp":
      return <ClampPuzzle {...props} />;
    case "trend":
      return <TrendPuzzle {...props} />;
    case "palette":
      return <PalettePuzzle {...props} />;
    case "layers":
      return <LayersPuzzle {...props} />;
    case "solder":
      return <SolderPuzzle {...props} />;
    case "wiring":
      return <WiringPuzzle {...props} />;
    case "morse":
      return <MorsePuzzle {...props} />;
    case "radio":
      return <RadioPuzzle {...props} />;
    default: {
      const unknownKind: never = def.kind;
      return (
        <p className="text-red-400">
          {tr("Unknown puzzle type: {kind}", { kind: String(unknownKind) })}
        </p>
      );
    }
  }
}

function Screw({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute h-2 w-2 rounded-full bg-[#3A3A3A] shadow-[inset_0_0_1px_#000,0_0_0_1px_#555] ${className}`}
    />
  );
}

/** Screen-wide scanline sweep, white flash and the rotated SOLVED stamp. */
function SolvedOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-3 z-30 overflow-hidden rounded-sm"
      data-testid="puzzle-solved-overlay"
    >
      <div className="pz-flash absolute inset-0 bg-[#CCFFCC]/40" />
      <div className="pz-sweep absolute inset-x-0 top-0 h-1/5 bg-[linear-gradient(180deg,transparent,rgba(51,255,51,0.08)_40%,rgba(200,255,200,0.55)_92%,#E8FFE8)]" />
      <div className="absolute inset-0 bg-[#33FF33]/[0.06]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="pz-stamp rounded-md border-4 border-double border-[#33FF33] bg-black/80 px-8 py-3 text-4xl font-bold tracking-[0.45em] text-[#33FF33] shadow-[0_0_30px_rgba(51,255,51,0.45),inset_0_0_18px_rgba(51,255,51,0.25)] [text-shadow:0_0_10px_#33FF33]">
          {tr("SOLVED")}
        </div>
      </div>
    </div>
  );
}

export function PuzzleView({
  def,
  onSolved,
  onClose,
  onSound,
  extra,
}: {
  def: PuzzleDef;
  onSolved: () => void;
  onClose: () => void;
  /** Optional SFX sink, e.g. `director.sound`. Throttled per name. */
  onSound?: (name: SfxName) => void;
  /** Host content above the footer (e.g. "Use with prototype …"). */
  extra?: ReactNode;
}) {
  const [settings] = useSettings();
  const { reduceMotion, reduceFlicker, highContrastFocus } = settings.accessibility;
  const fx = useMemo<PuzzleFx>(
    () => ({ reduceMotion, reduceFlicker, highContrastFocus }),
    [reduceMotion, reduceFlicker, highContrastFocus],
  );
  const [solved, setSolved] = useState(false);
  const firedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onSolvedRef = useRef(onSolved);
  const onCloseRef = useRef(onClose);
  const onSoundRef = useRef(onSound);
  const lastSoundRef = useRef<Partial<Record<SfxName, number>>>({});
  useEffect(() => {
    onSolvedRef.current = onSolved;
    onCloseRef.current = onClose;
    onSoundRef.current = onSound;
  }, [onSolved, onClose, onSound]);

  const sound = useCallback((name: SfxName) => {
    const now = performance.now();
    const last = lastSoundRef.current[name];
    if (last !== undefined && now - last < SOUND_THROTTLE_MS) return;
    lastSoundRef.current[name] = now;
    onSoundRef.current?.(name);
  }, []);

  const handleSolve = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setSolved(true);
    // The scanline sweep gets its own swoosh; the host plays `puzzle_solved`.
    onSoundRef.current?.("scan_sweep");
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onSolvedRef.current();
    }, SOLVED_DELAY_MS);
  }, []);

  /**
   * Reports a solve whose animation is still running at once. Closing during
   * the sweep (Esc, backdrop, Cancel) or an unmount by the host must not
   * drop it — the host commits the solve only in `onSolved`.
   */
  const flushSolved = useCallback(() => {
    if (timerRef.current === null) return false;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
    onSolvedRef.current();
    return true;
  }, []);
  /** Close request: a pending solve is committed instead of cancelled. */
  const requestClose = useCallback(() => {
    if (!flushSolved()) onCloseRef.current();
  }, [flushSolved]);

  useEffect(() => () => void flushSolved(), [flushSolved]);

  // Esc closes only the top-most layer (settings opened above a puzzle win).
  useEscLayer(requestClose);

  // Focus moves into the puzzle (first control of the kind, else the box) so
  // keyboard play works at once; on close it is dropped, like `Panel`.
  const boxRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    const prev = document.activeElement;
    if (box && !(prev && box.contains(prev))) {
      if (prev instanceof HTMLElement && prev !== document.body) prev.blur();
      const first =
        bodyRef.current?.querySelector<HTMLElement>("[data-pz-autofocus]") ??
        bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? box).focus({ preventScroll: true });
    }
    return () => {
      const a = document.activeElement;
      if (a instanceof HTMLElement && a !== document.body) a.blur();
    };
  }, []);
  /** Keep Tab / Shift+Tab inside the puzzle. */
  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !boxRef.current) return;
    const items = [...boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === boxRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="pz-root fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="puzzle-title"
      data-rm={reduceMotion ? "1" : "0"}
      data-rf={reduceFlicker ? "1" : "0"}
      data-hc={highContrastFocus ? "1" : "0"}
      onMouseDown={(e) => {
        // Backdrop click (anywhere outside the device box) closes.
        if (e.target instanceof Node && !boxRef.current?.contains(e.target)) requestClose();
      }}
    >
      <PuzzleStyles />
      <UiScale className="flex max-h-[94vh] w-full justify-center">
        <div
          ref={boxRef}
          tabIndex={-1}
          onKeyDown={trapTab}
          className={`relative max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-md border-2 bg-[#1A1A1A] p-3 font-mono transition-shadow duration-500 ${
            solved
              ? "border-[#33FF33]/60 shadow-[0_0_60px_rgba(51,255,51,0.35)]"
              : "border-[#2A2A2A] shadow-[0_0_40px_rgba(51,255,51,0.12)]"
          } outline-none`}
        >
          <Screw className="top-1 left-1" />
          <Screw className="top-1 right-1" />
          <Screw className="bottom-1 left-1" />
          <Screw className="right-1 bottom-1" />
          <div className="relative max-h-[calc(94vh-1.5rem)] overflow-y-auto rounded-sm border border-[#33FF33]/30 bg-[#0D0D0D] p-4 text-[#33FF33] shadow-[inset_0_0_30px_rgba(0,0,0,0.9)]">
            {/* Scanlines + vignette + a faint phosphor flicker (off with reduceFlicker). */}
            <div
              aria-hidden
              className="pz-crt-flicker pointer-events-none absolute inset-0 z-10"
              style={{
                opacity: 0.5,
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 3px)",
              }}
            />
            <header className="mb-2 flex items-start justify-between gap-3 border-b border-[#33FF33]/20 pb-2">
              <h2
                id="puzzle-title"
                className="text-lg tracking-wider text-[#00FF66] [text-shadow:0_0_6px_#00FF66]"
              >
                {def.title}
              </h2>
              <span className="flex shrink-0 items-center gap-2 text-[10px] tracking-widest text-[#FFB800] uppercase">
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 rounded-full ${
                    solved
                      ? "bg-[#33FF33] shadow-[0_0_6px_#33FF33]"
                      : "pz-blink bg-[#FFB800] shadow-[0_0_6px_#FFB800]"
                  }`}
                />
                {PUZZLE_KIND_LABEL[def.kind]}
              </span>
            </header>
            <p className="mb-3 text-sm leading-relaxed text-[#33FF33]/85">{def.intro}</p>

            <PuzzleFxProvider value={fx}>
              <div ref={bodyRef} className={`relative ${solved ? "pointer-events-none" : ""}`}>
                <PuzzleBody
                  key={def.id}
                  def={def}
                  params={def.params}
                  onSolve={handleSolve}
                  solved={solved}
                  sound={sound}
                />
              </div>
            </PuzzleFxProvider>

            {solved && (
              <p className="sr-only" role="status">
                {tr("SOLVED")}
              </p>
            )}

            {extra && !solved && <div className="mt-4">{extra}</div>}

            <footer className="mt-4 flex items-center justify-between border-t border-[#33FF33]/20 pt-3">
              <span className="text-[10px] text-[#33FF33]/50">
                {tr("Esc closes · Tab switches controls · no way to fail")}
              </span>
              <CrtButton tone="red" onClick={requestClose} data-pz-native-keys>
                {tr("Cancel")}
              </CrtButton>
            </footer>
          </div>
          {solved && <SolvedOverlay />}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-3 z-20 rounded-sm shadow-[inset_0_0_60px_rgba(0,0,0,0.65)]"
          />
        </div>
      </UiScale>
    </div>
  );
}
