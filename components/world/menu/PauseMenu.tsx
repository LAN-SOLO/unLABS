"use client";

import { useEffect, useState } from "react";
import { SettingsPanel } from "@/components/world/menu/SettingsPanel";
import {
  ConfirmDialog,
  MenuKeyframes,
  MenuList,
  MenuPanel,
  Octahedron,
  SCANLINES,
  UiScale,
  isElectron,
  useMenuNav,
  type MenuItem,
} from "@/components/world/menu/shared";
import { SlotList } from "@/components/world/menu/SlotList";
import { isPostgame } from "@/lib/world/postgame";
import {
  SLOT_NAME,
  formatPlayTime,
  getActiveSlot,
  newGamePlusGame,
  saveToSlot,
  setActiveSlot,
  slotOf,
  type SlotId,
} from "@/lib/world/save";
import { useSettings } from "@/lib/world/settings";
import { tr } from "@/lib/i18n";
import type { WorldState } from "@/lib/world/types";

type View = "main" | "save" | "load" | "ngplus" | "settings" | "controls" | "mainmenu" | "quit";

export interface PauseMenuProps {
  /** The running world state (read for playtime/slot; saved on "Save"). */
  getState(): WorldState;
  /** Close the menu and resume play. Esc also calls this. */
  onResume(): void;
  /**
   * `slot` was made the active slot; remount the world from it (also used
   * after "New Game+", which writes the new run into `slot`).
   */
  onLoad(slot: SlotId): void;
  /** Leave to the title screen (progress is already saved). */
  onMainMenu(): void;
  /** Leave to the big _unOS terminal. */
  onTerminal(): void;
  /** Open the in-game help overlay. */
  onHelp(): void;
  /** Called after a successful "Save" (e.g. to show a toast). */
  onSaved?(slot: SlotId): void;
  /**
   * Desktop only ("Quit"): runs after the confirmation, before the window
   * closes — e.g. to autosave. Defaults to saving into the current slot.
   */
  onQuit?(): void;
}

export function PauseMenu({
  getState,
  onResume,
  onLoad,
  onMainMenu,
  onTerminal,
  onHelp,
  onSaved,
  onQuit,
}: PauseMenuProps) {
  const [s] = useSettings();
  const [view, setView] = useState<View>("main");
  const [notice, setNotice] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Playtime keeps counting while paused only if the world clock runs; re-read each second.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const state = getState();
  const slot = slotOf(state) ?? getActiveSlot();

  const items: MenuItem[] = [
    { id: "resume", label: tr("Resume"), onSelect: onResume },
    { id: "save", label: tr("Save"), onSelect: () => setView("save") },
    { id: "load", label: tr("Load"), onSelect: () => setView("load") },
    ...(isPostgame(state)
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
    { id: "settings", label: tr("Settings"), onSelect: () => setView("settings") },
    { id: "controls", label: tr("Controls"), onSelect: () => setView("controls") },
    { id: "help", label: tr("Help"), onSelect: onHelp },
    {
      id: "mainmenu",
      label: tr("Main menu"),
      tone: "amber",
      onSelect: () => (s.gameplay.confirmDestructive ? setView("mainmenu") : onMainMenu()),
    },
    { id: "terminal", label: tr("To the terminal"), tone: "cyan", onSelect: onTerminal },
    ...(isElectron()
      ? [
          {
            id: "quit",
            label: tr("Quit"),
            tone: "red" as const,
            hint: tr("Desktop"),
            onSelect: () => setView("quit"),
          },
        ]
      : []),
  ];
  const [index, setIndex] = useMenuNav(items, view === "main", onResume);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 font-mono text-[#33FF33]"
      role="dialog"
      aria-modal="true"
      aria-label={tr("Pause")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && view === "main") onResume();
      }}
    >
      <MenuKeyframes />
      <UiScale className="w-full max-w-sm">
        <div className="relative rounded-sm border border-[#FFB800]/40 bg-[#0D0D0D]/95 p-4 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: SCANLINES }}
          />
          <div className="relative mb-3 flex items-center gap-3 border-b border-[#FFB800]/25 pb-3">
            <Octahedron size={44} />
            <div className="flex-1">
              <h2 className="text-sm tracking-[0.3em] text-[#FFB800] uppercase">{tr("Pause")}</h2>
              <p className="text-[11px] text-[#33FF33]/60">
                {SLOT_NAME[slot]} ·{" "}
                {tr("Playtime {time}", { time: formatPlayTime(state.playTime) })}
              </p>
            </div>
          </div>
          {notice && (
            <p className="relative mb-2 rounded-sm border border-[#33FF33]/40 bg-[#33FF33]/5 px-2 py-1 text-[11px]">
              {notice}
            </p>
          )}
          <div className="relative">
            <MenuList items={items} index={index} onHover={setIndex} />
          </div>
          <p className="relative mt-2 px-3 text-[10px] text-[#33FF33]/35">
            {tr("↑ ↓ select · Enter confirm · Esc resume")}
          </p>
        </div>
      </UiScale>

      {view === "save" && (
        <MenuPanel
          title={tr("Save")}
          subtitle={tr("The game then continues in this slot.")}
          onClose={() => setView("main")}
        >
          <SlotList
            mode="save"
            onPick={(id) => {
              const ok = saveToSlot(id, getState(), { activate: true });
              setNotice(ok ? tr("Saved: {slot}", { slot: SLOT_NAME[id] }) : tr("Saving failed."));
              setView("main");
              if (ok) onSaved?.(id);
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
      {view === "ngplus" && (
        <MenuPanel
          title={tr("New Game+")}
          subtitle={tr(
            "Cold start with memories: achievements, handbook knowledge and recipes carry over, and so does a cup of coffee. Choose a save slot.",
          )}
          onClose={() => setView("main")}
        >
          <SlotList
            mode="new"
            onPick={(id) => {
              const current = getState();
              // Keep the finished run in its own slot unless it is overwritten.
              if (slotOf(current) !== id) saveToSlot(slot, current);
              newGamePlusGame(id, current);
              onLoad(id);
            }}
          />
        </MenuPanel>
      )}
      {view === "settings" && <SettingsPanel onClose={() => setView("main")} />}
      {view === "controls" && (
        <SettingsPanel initialTab="steuerung" onClose={() => setView("main")} />
      )}
      {view === "mainmenu" && (
        <ConfirmDialog
          title={tr("Back to the main menu?")}
          text={tr("Your progress has been saved automatically. You can continue at any time.")}
          confirmLabel={tr("Main menu")}
          onCancel={() => setView("main")}
          onConfirm={onMainMenu}
        />
      )}
      {view === "quit" && (
        <ConfirmDialog
          title={tr("Quit game?")}
          text={tr("Your current progress is saved to your slot, then the window closes.")}
          confirmLabel={tr("Quit")}
          onCancel={() => setView("main")}
          onConfirm={() => {
            if (onQuit) onQuit();
            else saveToSlot(slot, getState());
            window.close();
          }}
        />
      )}
    </div>
  );
}
