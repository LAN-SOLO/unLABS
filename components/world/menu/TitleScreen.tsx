"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Credits } from "@/components/world/menu/Credits";
import { MerchShop } from "@/components/world/menu/MerchShop";
import { BOOT_LINES, LORE_QUOTES } from "@/components/world/menu/lore";
import { SettingsPanel } from "@/components/world/menu/SettingsPanel";
import {
  ConfirmDialog,
  MenuKeyframes,
  MenuList,
  MenuPanel,
  SCANLINES,
  UiScale,
  isElectron,
  quitGame,
  useMenuNav,
  useRotatingIndex,
  type MenuItem,
} from "@/components/world/menu/shared";
import { TitleBackdrop } from "@/components/world/menu/TitleBackdrop";
import { UnethCrystal } from "@/components/world/menu/UnethCrystal";
import { SlotList } from "@/components/world/menu/SlotList";
import {
  finishedSlots,
  getActiveSlot,
  hasAnySave,
  latestSlot,
  loadSlot,
  newGame,
  newGamePlusGame,
  setActiveSlot,
  slotExists,
  type SlotId,
} from "@/lib/world/save";
import { LANGUAGE_LABEL, textCharsPerSecond, useSettings } from "@/lib/world/settings";
import { LOCALES, getLocale, setLocale, tr } from "@/lib/i18n";
import { VERSION_LABEL } from "@/lib/version";

/** Stable string snapshot for useSyncExternalStore (arrays would re-render forever). */
function finishedSlotsKey(): string {
  return finishedSlots().join(",");
}

export { isElectron, quitGame };

// ── Boot log typewriter ──────────────────────────────────────────

function BootLog() {
  const [s] = useSettings();
  const cps = textCharsPerSecond(s.gameplay.textSpeed);
  const instant = !Number.isFinite(cps) || s.accessibility.reduceMotion;
  const total = useMemo(() => BOOT_LINES.reduce((n, l) => n + l.length + 8, 0), []);
  const [chars, setChars] = useState(0);
  useEffect(() => {
    if (instant) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const n = Math.floor(((performance.now() - start) / 1000) * cps);
      setChars(n);
      if (n >= total) window.clearInterval(id);
    }, 30);
    return () => window.clearInterval(id);
  }, [cps, instant, total]);

  const shown = instant ? total : chars;
  let budget = shown;
  const lines: string[] = [];
  for (const l of BOOT_LINES) {
    if (budget <= 0) break;
    lines.push(l.slice(0, budget));
    budget -= l.length + 8; // small pause between lines
  }
  const done = shown >= total;
  // Once booted, fold down to the last line so the lab behind stays in view.
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setFolded(true), 4000);
    return () => window.clearTimeout(id);
  }, [done]);
  return (
    <div
      className="font-mono text-[11px] leading-5 text-[#33FF33]/70"
      aria-live="polite"
      aria-label={tr("Boot log")}
    >
      {lines.map((l, i) =>
        folded && i < lines.length - 1 ? null : (
          <div key={i} className={i === 2 || i === 3 ? "text-[#FFB800]" : ""}>
            <span className="text-[#33FF33]/35">[{String(i).padStart(2, "0")}]</span> {l}
          </div>
        ),
      )}
      <span
        aria-hidden
        className="inline-block h-3 w-2 bg-[#33FF33]/80 align-middle"
        style={{ animation: done ? "unlab-caret 1s steps(1) infinite" : undefined }}
      />
    </div>
  );
}

const noopSubscribe = (): (() => void) => () => {};

/** EN | DE switch in the top-right corner (switching reloads the page). */
function LanguageToggle() {
  const current = getLocale();
  return (
    <div
      className="absolute top-3 right-3 z-10 flex items-center gap-1 font-mono text-[10px]"
      role="radiogroup"
      aria-label={tr("Language / Sprache")}
    >
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className="text-[#33FF33]/30">|</span>}
          <button
            type="button"
            role="radio"
            aria-checked={l === current}
            title={LANGUAGE_LABEL[l]}
            onClick={() => {
              if (l !== current) setLocale(l);
            }}
            className={`rounded-sm px-1.5 py-0.5 tracking-[0.2em] uppercase focus-visible:outline-2 focus-visible:outline-[#00FFFF] ${
              l === current ? "text-[#FFB800]" : "text-[#33FF33]/50 hover:text-[#33FF33]"
            }`}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  );
}

// ── Title screen ─────────────────────────────────────────────────

type View =
  | "main"
  | "new"
  | "ngplus"
  | "load"
  | "settings"
  | "controls"
  | "credits"
  | "merch"
  | "quit";

export interface TitleScreenProps {
  /** Resume the active slot (already selected by the title screen). */
  onContinue(): void;
  /** A fresh game was written into `slot` and made active (`newGame`). */
  onNewGame(slot: SlotId): void;
  /** `slot` was made the active slot; mount the world from it. */
  onLoad(slot: SlotId): void;
  /** Leave to the big _unOS terminal (`/terminal`). */
  onTerminal(): void;
  /** A dialog on top (e.g. a beta-save link) owns the keyboard. */
  blocked?: boolean;
}

export function TitleScreen({
  onContinue,
  onNewGame,
  onLoad,
  onTerminal,
  blocked = false,
}: TitleScreenProps) {
  const [s] = useSettings();
  const [view, setView] = useState<View>("main");
  // Client-only read of localStorage (false during SSR, re-read on every render).
  const canContinue = useSyncExternalStore(noopSubscribe, hasAnySave, () => false);
  const quoteIndex = useRotatingIndex(LORE_QUOTES.length, 14000, 0);
  const [quoteSeed] = useState(() => Math.floor(Math.random() * LORE_QUOTES.length));
  const quote = LORE_QUOTES[(quoteIndex + quoteSeed) % LORE_QUOTES.length]!;

  const cont = useCallback(() => {
    if (!slotExists(getActiveSlot())) {
      const latest = latestSlot();
      if (!latest) return;
      setActiveSlot(latest);
    }
    onContinue();
  }, [onContinue]);

  const finished = useSyncExternalStore(noopSubscribe, finishedSlotsKey, () => "")
    .split(",")
    .filter(Boolean);
  const flicker = !s.accessibility.reduceFlicker;
  const main = view === "main";

  const items: MenuItem[] = [
    {
      id: "continue",
      label: tr("Continue"),
      disabled: !canContinue,
      hint: canContinue ? undefined : tr("no save"),
      onSelect: cont,
    },
    { id: "new", label: tr("New Game"), onSelect: () => setView("new") },
    ...(finished.length
      ? [
          {
            id: "ngplus",
            label: tr("New Game+"),
            tone: "cyan" as const,
            hint: tr("Achievements & knowledge carry over"),
            onSelect: () => setView("ngplus"),
          },
        ]
      : []),
    { id: "load", label: tr("Load"), disabled: !canContinue, onSelect: () => setView("load") },
    { id: "settings", label: tr("Settings"), onSelect: () => setView("settings") },
    { id: "controls", label: tr("Controls"), onSelect: () => setView("controls") },
    {
      id: "merch",
      label: tr("Merch"),
      tone: "amber",
      hint: tr("Shirts & hoodies"),
      onSelect: () => setView("merch"),
    },
    { id: "credits", label: tr("Credits"), onSelect: () => setView("credits") },
    { id: "terminal", label: tr("To the terminal"), tone: "cyan", onSelect: onTerminal },
    {
      id: "quit",
      label: tr("Quit"),
      tone: "red",
      onSelect: () => (isElectron() ? setView("quit") : quitGame(onTerminal)),
    },
  ];
  const [index, setIndex] = useMenuNav(items, main && !blocked);

  // Once a save is detected (client-only), put the cursor on "Continue".
  useEffect(() => {
    if (canContinue) setIndex(0);
  }, [canContinue, setIndex]);

  return (
    <div
      className="fixed inset-0 z-[70] overflow-hidden bg-black font-mono text-[#33FF33] select-none"
      role="dialog"
      aria-label={tr("_unLAB main menu")}
    >
      <MenuKeyframes />
      <TitleBackdrop />
      <LanguageToggle />
      {/* Vignette (dark on the left so the menu column stays readable) + scanlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.72) 30%, rgba(0,0,0,0.15) 58%, transparent 75%), radial-gradient(ellipse at 65% 50%, transparent 40%, rgba(0,0,0,0.8) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: SCANLINES,
          animation: flicker ? "unlab-flicker 6s infinite" : undefined,
        }}
      />

      <UiScale className="relative flex h-full w-full flex-col gap-6 overflow-y-auto p-6 md:flex-row md:items-center md:justify-between md:p-12">
        <div className="flex max-w-md flex-col gap-6">
          <div className="flex items-center gap-4">
            <UnethCrystal size={120} />
            <div>
              <h1
                className="text-5xl font-bold tracking-[0.12em] text-[#33FF33] md:text-6xl"
                style={{
                  animation: flicker
                    ? "unlab-glow 4s ease-in-out infinite, unlab-flicker 9s infinite"
                    : undefined,
                  textShadow: flicker ? undefined : "0 0 12px rgba(51,255,51,.5)",
                }}
              >
                _unLAB
              </h1>
              <p className="mt-1 text-xs tracking-[0.35em] text-[#FFB800] uppercase">
                {tr("The Unstable Lab")}
              </p>
            </div>
          </div>

          <nav
            aria-label={tr("Main menu")}
            className="relative rounded-sm border border-[#33FF33]/25 bg-[#0D0D0D]/85 p-3 shadow-[0_0_30px_rgba(0,0,0,0.7)]"
          >
            <MenuList items={items} index={index} onHover={setIndex} />
            <p className="mt-2 flex justify-between gap-3 px-3 text-[10px] text-[#33FF33]/35">
              <span>{tr("↑ ↓ select · Enter confirm · Esc back")}</span>
              <span className="shrink-0 tabular-nums">{VERSION_LABEL}</span>
            </p>
          </nav>
        </div>

        {/* Bottom-right, so the diorama stays visible above it. */}
        <div className="flex max-w-lg flex-col gap-4 md:items-end md:self-end">
          <div className="rounded-sm border border-[#33FF33]/15 bg-black/60 p-3 md:w-[26rem]">
            <BootLog />
          </div>
          <figure
            key={quote.text}
            className="max-w-md border-l-2 border-[#FFB800]/50 pl-3 md:text-right"
            style={{ animation: s.accessibility.reduceMotion ? undefined : "unlab-fade 1.2s" }}
          >
            <blockquote className="text-sm leading-relaxed text-[#d8ffd8]/85 italic">
              {tr("“{text}”", { text: quote.text })}
            </blockquote>
            <figcaption className="mt-1 text-[10px] tracking-wider text-[#FFB800]/70">
              — {quote.by}
            </figcaption>
          </figure>
        </div>
      </UiScale>

      {view === "new" && (
        <MenuPanel
          title={tr("New Game")}
          subtitle={tr("Choose a save slot.")}
          onClose={() => setView("main")}
        >
          <SlotList
            mode="new"
            onPick={(id) => {
              newGame(id);
              onNewGame(id);
            }}
          />
        </MenuPanel>
      )}
      {view === "ngplus" && (
        <MenuPanel
          title={tr("New Game+")}
          subtitle={tr(
            "Achievements, handbook knowledge and recipes carry over. Choose a save slot.",
          )}
          onClose={() => setView("main")}
        >
          <SlotList
            mode="new"
            onPick={(id) => {
              // Source run: the active slot if it is finished, else the first finished one.
              const active = getActiveSlot();
              const src = loadSlot(finished.includes(active) ? active : (finished[0] as SlotId));
              if (src) newGamePlusGame(id, src);
              else newGame(id);
              onNewGame(id);
            }}
          />
        </MenuPanel>
      )}
      {view === "load" && (
        <MenuPanel
          title={tr("Load")}
          subtitle={tr("Choose a save.")}
          onClose={() => setView("main")}
        >
          <SlotList
            mode="load"
            onPick={(id) => {
              setActiveSlot(id);
              onLoad(id);
            }}
          />
        </MenuPanel>
      )}
      {view === "settings" && <SettingsPanel onClose={() => setView("main")} />}
      {view === "controls" && (
        <SettingsPanel initialTab="steuerung" onClose={() => setView("main")} />
      )}
      {view === "credits" && <Credits onClose={() => setView("main")} />}
      {view === "merch" && <MerchShop onClose={() => setView("main")} />}
      {view === "quit" && (
        <ConfirmDialog
          title={tr("Quit?")}
          text={tr("The lab keeps running without you. Your progress is saved.")}
          confirmLabel={tr("Quit")}
          onCancel={() => setView("main")}
          onConfirm={() => quitGame(onTerminal)}
        />
      )}
    </div>
  );
}
