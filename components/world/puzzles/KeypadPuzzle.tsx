"use client";

import { useEffect, useRef, useState } from "react";
import { str } from "@/components/world/puzzles/logic";
import {
  HintBox,
  PuzzleFooter,
  SegmentDisplay,
  useFailFx,
  useFailHint,
  useHotkeys,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"] as const;

export function KeypadPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const code = str(params, "code", "0000").replace(/[^0-9]/g, "") || "0000";
  const len = code.length;
  const sfx = useSfx(sound);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);
  const [lastKey, setLastKey] = useState<{ key: string; n: number } | null>(null);
  const { fails, fail, hint } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const press = (key: string) => {
    if (solved) return;
    setLastKey((k) => ({ key, n: (k?.n ?? 0) + 1 }));
    if (key === "C") {
      setEntry("");
      sfx("ui_click");
      return;
    }
    if (key === "BACK") {
      setEntry((e) => e.slice(0, -1));
      sfx("ui_click");
      return;
    }
    if (key === "OK") {
      if (entry === code) {
        onSolve();
        return;
      }
      sfx("fail_buzz");
      fail();
      failFx();
      setError(true);
      setEntry("");
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setError(false), 600);
      return;
    }
    if (error) setError(false);
    if (entry.length < len) {
      setEntry(entry + key);
      sfx("keypad_beep");
    } else sfx("ui_click");
  };

  useHotkeys(
    (key) => {
      if (solved) return false;
      if (/^[0-9]$/.test(key)) press(key);
      else if (key === "Enter") press("OK");
      else if (key === "Backspace") press("BACK");
      else if (key === "Delete" || key === "c" || key === "C") press("C");
      else return false;
      return true;
    },
    !solved,
    { repeat: false },
  );

  const display = error
    ? "ERR".padEnd(len, " ")
    : solved
      ? code
      : Array.from({ length: len }, (_, i) => entry[i] ?? "_").join("");
  const color = error ? "#FF4040" : solved ? "#00FFFF" : "#33FF33";
  const full = entry.length === len;

  return (
    <div className="mx-auto flex w-full max-w-[300px] flex-col gap-3">
      <div
        tabIndex={0}
        data-pz-autofocus
        className={`flex justify-center rounded-sm border bg-black px-3 py-3 shadow-[inset_0_0_14px_rgba(0,0,0,0.9)] transition-colors outline-none focus-visible:border-[#00FFFF] ${failClass} ${
          error
            ? "border-red-500 bg-red-950/40"
            : full
              ? "border-[#00FFFF]/70"
              : "border-[#33FF33]/50"
        }`}
        aria-live="polite"
        aria-label={
          error
            ? tr("Wrong code")
            : tr("Input: {n} of {total} digits", { n: entry.length, total: len })
        }
      >
        <SegmentDisplay
          text={display}
          color={color}
          height={46}
          label={error ? tr("ERROR") : display}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] tracking-widest">
        <span className={error ? "text-red-400" : "text-[#33FF33]/60"}>
          {error
            ? `▲ ${tr("CODE REJECTED")}`
            : full
              ? `› ${tr("READY — PRESS OK")}`
              : `› ${entry.length}/${len}`}
        </span>
        <span className="text-[#FFB800]/70">{tr("Failed attempts: {n}", { n: fails })}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-md border border-[#2A2A2A] bg-[#141414] p-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)]">
        {KEYS.map((k) => {
          const flash = lastKey?.key === k;
          return (
            <button
              key={flash ? `${k}-${lastKey?.n}` : k}
              type="button"
              onClick={() => press(k)}
              disabled={solved}
              aria-label={
                k === "C" ? tr("Clear") : k === "OK" ? tr("Confirm") : tr("Digit {k}", { k })
              }
              className={`h-12 rounded-sm border font-mono text-lg shadow-[0_2px_0_#000] transition-[background-color,box-shadow] duration-100 active:translate-y-px active:shadow-none disabled:opacity-40 ${
                flash ? "pz-pop" : ""
              } ${
                k === "OK"
                  ? `border-[#00FFFF]/60 bg-[#0A1A1A] text-[#00FFFF] hover:bg-[#00FFFF]/10 hover:shadow-[0_0_10px_rgba(0,255,255,0.35)] ${full && !solved ? "shadow-[0_0_10px_rgba(0,255,255,0.45)]" : ""}`
                  : k === "C"
                    ? "border-[#FFB800]/60 bg-[#1A140A] text-[#FFB800] hover:bg-[#FFB800]/10 hover:shadow-[0_0_10px_rgba(255,184,0,0.35)]"
                    : "border-[#33FF33]/50 bg-[#1A1A1A] text-[#33FF33] hover:bg-[#33FF33]/10 hover:shadow-[0_0_10px_rgba(51,255,51,0.3)]"
              }`}
            >
              {k === "OK" ? "OK ✓" : k === "C" ? "C ✗" : k}
            </button>
          );
        })}
      </div>
      <HintBox show={hint && !solved}>
        {tr(
          "The clue is above the panel: a time, a date or the number stuck up all over this place. Colons and dots are decoration — only the digits count.",
        )}
        {fails >= 6 &&
          ` ${tr("Fine. I will reveal the first digit: {d}. You can manage the rest.", { d: code[0] ?? "?" })}`}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>0</kbd>–<kbd>9</kbd> {tr("type")} · <kbd>Enter</kbd> {tr("confirms")} ·{" "}
            <kbd>⌫</kbd> {tr("corrects")} · <kbd>C</kbd> {tr("clears")}
          </>
        }
      />
    </div>
  );
}
