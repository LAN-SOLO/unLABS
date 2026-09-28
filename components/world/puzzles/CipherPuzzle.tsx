"use client";

import { useMemo, useState } from "react";
import { str, vigenereDecrypt, vigenereEncrypt } from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  ProgressBar,
  PuzzleFooter,
  StatusLine,
  useFailFx,
  useFailHint,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

/** Share of letters that already decrypt correctly (0..1). */
function readability(decrypted: string, plain: string): number {
  let letters = 0;
  let hits = 0;
  for (let i = 0; i < plain.length; i++) {
    const p = plain[i];
    if (p < "A" || p > "Z") continue;
    letters++;
    if (decrypted[i] === p) hits++;
  }
  return letters === 0 ? 0 : hits / letters;
}

export function CipherPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const key = str(params, "key", "HALO");
  /** Optional nudge after the first-letter hint, specific to this key. */
  const keyNote = str(params, "keyNote", "");
  const plain = str(params, "plain", "").toUpperCase();
  const cipher = useMemo(() => vigenereEncrypt(plain, key), [plain, key]);
  const sfx = useSfx(sound);
  const [input, setInput] = useState("");
  const { fails, fail, hint: hint1 } = useFailHint(2, 60, sfx);
  const { hint: hint2Timed } = useFailHint(99, 120);
  const hint2 = hint2Timed || fails >= 4;
  const { failClass, fail: failFx } = useFailFx();
  const [status, setStatus] = useState<{ tone: "bad" | "info"; text: string } | null>(null);
  const preview = vigenereDecrypt(cipher, input);
  const read = input.length > 0 ? readability(preview, plain) : 0;
  const keyLetters = key.toUpperCase().replace(/[^A-Z]/g, "");

  const change = (raw: string) => {
    if (solved) return;
    const next = raw
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 16);
    if (next === input) return;
    setInput(next);
    setStatus(null);
    if (next.length > 0 && vigenereDecrypt(cipher, next) === plain) {
      onSolve();
      return;
    }
    const nextRead = next.length > 0 ? readability(vigenereDecrypt(cipher, next), plain) : 0;
    sfx(hint1 && nextRead > read ? "keypad_beep" : "ui_click");
  };

  /** Enter / "Check": an explicit attempt — a wrong key buzzes and counts. */
  const check = () => {
    if (solved) return;
    if (input.length === 0) {
      sfx("ui_click");
      setStatus({ tone: "info", text: tr("Enter a key first.") });
      return;
    }
    // A correct key already solved on input; anything reaching here is wrong.
    sfx("fail_buzz");
    fail();
    failFx();
    setStatus({
      tone: "bad",
      text:
        input.length !== keyLetters.length && fails >= 1
          ? tr("Key “{key}” yields no plaintext. Check the length.", { key: input })
          : tr("Key “{key}” yields no plaintext.", { key: input }),
    });
  };

  const clear = () => {
    setInput("");
    setStatus(null);
    sfx("ui_click");
  };

  const shown = input.length > 0 ? preview : "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-xs text-[#FFB800]">{tr("Ciphertext")}</div>
        <p className="rounded-sm border border-[#33FF33]/30 bg-black p-3 text-sm leading-relaxed tracking-widest break-words text-[#33FF33] [text-shadow:0_0_4px_rgba(51,255,51,0.6)]">
          {cipher}
        </p>
      </div>
      <label className="flex flex-col gap-1 text-xs text-[#FFB800]">
        {tr("Key (letters A–Z only)")}
        <div className={`flex gap-2 ${failClass}`}>
          <input
            type="text"
            value={input}
            disabled={solved}
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                check();
              }
            }}
            data-pz-autofocus
            maxLength={16}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-sm border border-[#00FFFF]/50 bg-black px-2 py-1 font-mono text-base tracking-[0.4em] text-[#00FFFF] uppercase caret-[#00FFFF] shadow-[inset_0_0_8px_rgba(0,255,255,0.15)] outline-none [text-shadow:0_0_6px_#00FFFF] focus:border-[#00FFFF] focus:shadow-[0_0_10px_rgba(0,255,255,0.35)]"
            placeholder="????"
            aria-label={tr("cipher::Key")}
            aria-invalid={status?.tone === "bad"}
          />
          <CrtButton tone="cyan" onClick={check} disabled={solved}>
            {tr("Check")}
          </CrtButton>
        </div>
      </label>
      <div>
        <div className="mb-1 text-xs text-[#FFB800]">{tr("Live decryption")}</div>
        <p
          className="min-h-[3rem] rounded-sm border border-[#00FFFF]/20 bg-black p-3 text-sm leading-relaxed tracking-widest break-words text-[#00FFFF]/90 [perspective:400px]"
          aria-live="polite"
          aria-label={shown || tr("empty")}
        >
          {shown
            ? shown.split("").map((ch, i) => (
                <span
                  key={`${i}-${ch}`}
                  aria-hidden
                  className={ch === " " ? undefined : "pz-flip"}
                  style={{ animationDelay: `${Math.min(i, 60) * 4}ms` }}
                >
                  {ch === " " ? " " : ch}
                </span>
              ))
            : "—"}
        </p>
      </div>
      <StatusLine tone={status?.tone ?? "info"}>
        {status?.text ??
          (input.length > 0
            ? tr("{n} letters · live preview running", { n: input.length })
            : tr("Waiting for key …"))}
      </StatusLine>
      {hint1 && !solved && (
        <ProgressBar
          value={read}
          label={tr("MCP readability analysis: {pct} %", { pct: Math.round(read * 100) })}
        />
      )}
      <HintBox show={hint1 && !solved}>
        {tr(
          "I am now measuring how much of the plaintext already makes sense. Every correct letter in the correct position raises the bar by an equal share — the key has {n} letters.",
          { n: keyLetters.length },
        )}
        {hint2 &&
          ` ${tr("And since you are asking without asking: it begins with “{letter}”.", { letter: keyLetters[0] ?? "?" })}${keyNote ? ` ${keyNote}` : ""}`}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>A</kbd>–<kbd>Z</kbd> {tr("type")} · {tr("plaintext appears live")} ·{" "}
            <kbd>Enter</kbd> {tr("checks")} · <kbd>⌫</kbd> {tr("corrects")}
          </>
        }
        onReset={clear}
        resetDisabled={solved || input.length === 0}
        resetLabel={tr("cipher::Clear")}
      />
    </div>
  );
}
