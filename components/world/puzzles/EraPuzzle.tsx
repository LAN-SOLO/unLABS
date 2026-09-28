"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ERA_BITS,
  IMG,
  displayHex,
  generateEra,
  hex4,
  quantize,
  settingKey,
} from "@/components/world/puzzles/engine/era";
import { num } from "@/components/world/puzzles/logic";
import { mulberry32 } from "@/components/world/puzzles/rng";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  StatusLine,
  useFailFx,
  useFailHint,
  useHotkeys,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const ERA_NAME: Record<(typeof ERA_BITS)[number], string> = {
  8: tr("8 bit · 4 colours"),
  16: tr("16 bit · 16 colours"),
  32: tr("32 bit · 64 colours"),
  64: tr("64 bit · 256 colours + scanlines"),
};

const ERA_FONT: Record<(typeof ERA_BITS)[number], string> = {
  8: "font-bold tracking-[0.4em] [filter:blur(0.7px)] [text-shadow:0_0_4px_#33FF33,2px_0_0_#1a7a1a]",
  16: "tracking-[0.3em] [text-shadow:0_0_6px_#33FF33]",
  32: "tracking-[0.3em] [text-shadow:0_0_4px_#33FF33]",
  64: "tracking-[0.3em] [text-shadow:0_0_2px_#33FF33]",
};

type Status = { tone: "ok" | "bad" | "info"; text: string };

const ERA_KEYS = { claim: ["Enter", " "] } as const;

const START_STATUS: Status = {
  tone: "info",
  text: tr("Cycle the filters, compare the checksum, lock in."),
};

export function EraPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 16);
  const targetBits = num(params, "target", 16);
  const targetDither = num(params, "dither", 1) !== 0;
  const puzzle = useMemo(
    () => generateEra(seed, targetBits, targetDither),
    [seed, targetBits, targetDither],
  );
  const [eraIdx, setEraIdx] = useState(0);
  const [dither, setDither] = useState(false);
  const [glitch, setGlitch] = useState(0);
  const [status, setStatus] = useState<Status>(START_STATUS);
  const sfx = useSfx(sound);
  const { fail, fails, hint } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glitchTimer = useRef<number | null>(null);

  const bits = ERA_BITS[eraIdx];
  const sum = puzzle.sums[settingKey({ bits, dither })] ?? 0;
  const shown = displayHex(hex4(sum), bits);
  /** Settings already locked in and rejected (shown as struck-through). */
  const [tried, setTried] = useState<string[]>([]);
  const currentKey = settingKey({ bits, dither });
  const triedCurrent = tried.includes(currentKey);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const q = quantize(puzzle.image, bits, dither);
    const data = ctx.createImageData(IMG, IMG);
    const rng = glitch > 0 ? mulberry32(glitch * 977) : null;
    for (let i = 0; i < IMG * IMG; i++) {
      let r = q[i * 3];
      let g = q[i * 3 + 1];
      let b = q[i * 3 + 2];
      if (rng && rng() < 0.45) {
        const v = Math.floor(rng() * 255);
        r = v;
        g = v;
        b = v;
      }
      data.data[i * 4] = r;
      data.data[i * 4 + 1] = g;
      data.data[i * 4 + 2] = b;
      data.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
  }, [puzzle, bits, dither, glitch]);

  useEffect(
    () => () => {
      if (glitchTimer.current !== null) window.clearTimeout(glitchTimer.current);
    },
    [],
  );

  const cycle = (delta: number) => {
    if (solved) return;
    sfx("ui_click");
    setEraIdx((i) => (i + delta + ERA_BITS.length) % ERA_BITS.length);
  };

  const pickEra = (i: number) => {
    if (solved) return;
    sfx("ui_click");
    setEraIdx(i);
  };

  const toggleDither = () => {
    if (solved) return;
    sfx("ui_click");
    setDither((d) => !d);
  };

  const lock = () => {
    if (solved) return;
    if (sum === puzzle.targetSum) {
      setStatus({
        tone: "ok",
        text: tr("{sum} — era locked in. The pixels sparkle.", { sum: hex4(sum) }),
      });
      onSolve();
      return;
    }
    fail();
    failFx();
    sfx("fail_buzz");
    setTried((t) => (t.includes(currentKey) ? t : [...t, currentKey]));
    setStatus({
      tone: "bad",
      text: dither
        ? tr("Wrong era ({bits} bit, dither on). This checksum belongs to another decade.", {
            bits,
          })
        : tr("Wrong era ({bits} bit, dither off). This checksum belongs to another decade.", {
            bits,
          }),
    });
    setGlitch((g) => g + 1);
    if (glitchTimer.current !== null) window.clearTimeout(glitchTimer.current);
    glitchTimer.current = window.setTimeout(() => setGlitch(0), 450);
  };

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    setEraIdx(0);
    setDither(false);
    setTried([]);
    setStatus(START_STATUS);
  };

  // Enter / Space are the documented lock-in / dither keys, also while an era
  // button has focus (the first one is autofocused on open).
  useHotkeys(
    (key) => {
      if (solved) return false;
      const n = Number(key);
      if (Number.isInteger(n) && n >= 1 && n <= ERA_BITS.length) pickEra(n - 1);
      else if (key === "ArrowRight" || key === "ArrowUp") cycle(1);
      else if (key === "ArrowLeft" || key === "ArrowDown") cycle(-1);
      else if (key === "d" || key === "D" || key === " ") toggleDither();
      else if (key === "Enter") lock();
      else return false;
      return true;
    },
    true,
    ERA_KEYS,
  );

  const lore =
    puzzle.target.bits === 16
      ? tr("16 bit — the era in which Jade and Damien first heard something answer back.")
      : tr("{bits} bit.", { bits: puzzle.target.bits });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative mx-auto shrink-0">
        <canvas
          ref={canvasRef}
          width={IMG}
          height={IMG}
          className={`h-48 w-48 rounded-sm border bg-black shadow-[0_0_14px_rgba(51,255,51,0.2)] [image-rendering:pixelated] sm:h-64 sm:w-64 ${
            glitch > 0 ? "border-red-500" : "border-[#33FF33]/40"
          } ${failClass}`}
          aria-label={tr("Crystal preview in the {filter} filter", { filter: ERA_NAME[bits] })}
        />
        {bits === 64 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-sm"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 4px)",
            }}
          />
        )}
        {solved && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-pulse rounded-sm bg-[radial-gradient(circle,rgba(255,255,255,0.35)_1px,transparent_2px)] [background-size:16px_16px]"
          />
        )}
      </div>
      <div className="flex w-full flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-sm border border-[#00FFFF]/40 bg-black p-2">
            <div className="mb-1 text-[#FFB800]">{tr("Target checksum")}</div>
            <div className="text-2xl tracking-[0.3em] text-[#00FFFF] [text-shadow:0_0_6px_#00FFFF]">
              {hex4(puzzle.targetSum)}
            </div>
          </div>
          <div
            className={`rounded-sm border bg-black p-2 ${
              glitch > 0 ? "border-red-500" : "border-[#33FF33]/40"
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-[#FFB800]">
              <span>{tr("Current")}</span>
              {triedCurrent && (
                <span className="text-[10px] text-red-400" aria-label={tr("already rejected")}>
                  ✗ {tr("rejected")}
                </span>
              )}
            </div>
            <div
              className={`text-2xl text-[#33FF33] [perspective:300px] ${ERA_FONT[bits]}`}
              aria-live="polite"
              aria-label={shown}
            >
              {shown.split("").map((ch, i) => (
                <span key={`${i}-${ch}-${bits}`} aria-hidden className="pz-flip">
                  {ch}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-[#FFB800]">{tr("Era filter")}</div>
          <div className="flex flex-wrap gap-2">
            {ERA_BITS.map((b, i) => (
              <CrtButton
                key={b}
                tone={i === eraIdx ? "cyan" : "green"}
                aria-pressed={i === eraIdx}
                aria-label={tr("Era {bits} bit (key {key})", { bits: b, key: i + 1 })}
                onClick={() => pickEra(i)}
                disabled={solved}
                data-pz-autofocus={i === 0 ? true : undefined}
                className={i === eraIdx ? "bg-[#00FFFF]/15" : ""}
              >
                <span aria-hidden className="mr-1 opacity-60">
                  {i === eraIdx ? "▣" : "□"}
                </span>
                {tr("{bits} bit", { bits: b })}
              </CrtButton>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-[#33FF33]/60">{ERA_NAME[bits]}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CrtButton
            tone={dither ? "cyan" : "green"}
            aria-pressed={dither}
            onClick={toggleDither}
            disabled={solved}
            data-pz-native-keys
          >
            <span aria-hidden className="mr-1 opacity-60">
              {dither ? "▦" : "□"}
            </span>
            {dither ? tr("Dither: on") : tr("Dither: off")}
          </CrtButton>
          <CrtButton tone="amber" onClick={lock} disabled={solved} data-pz-native-keys>
            {tr("Lock in")}
          </CrtButton>
        </div>
        <StatusLine tone={status.tone}>{status.text}</StatusLine>
        {tried.length > 0 && (
          <div className="text-[10px] text-[#33FF33]/60" aria-label={tr("Rejected settings")}>
            {tr("Rejected:")}{" "}
            {tried.map((k) => (
              <span key={k} className="mr-2 text-red-400/80 line-through">
                {k.replace("d", " Bit+D").replace("n", " Bit")}
              </span>
            ))}
          </div>
        )}
        <HintBox show={hint && !solved}>
          {lore}{" "}
          {puzzle.target.dither
            ? tr(
                "Dither has to be on. And in 8-bit mode, trust no digit: B looks like 8, D like 0.",
              )
            : tr(
                "Dither has to be off. And in 8-bit mode, trust no digit: B looks like 8, D like 0.",
              )}
          {fails >= 6 &&
            ` ${tr("Exactly eight combinations remain. Trying is allowed — I am merely counting.")}`}
        </HintBox>
        <PuzzleFooter
          help={
            <>
              <kbd>1</kbd>–<kbd>4</kbd> {tr("or")} <kbd>←</kbd>/<kbd>→</kbd> {tr("era")} ·{" "}
              <kbd>D</kbd> / <kbd>{tr("Spacebar")}</kbd> {tr("dither")} · <kbd>Enter</kbd>{" "}
              {tr("lock in")}
            </>
          }
          onReset={reset}
          resetDisabled={solved}
        />
      </div>
    </div>
  );
}
