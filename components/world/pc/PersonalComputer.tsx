"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, FOCUS_RING, Panel, UI, gridKeyNav } from "@/components/world/ui";
import { memoPanel, type WorldApi } from "@/components/world/panels/shared";
import { BoardApp } from "@/components/world/pc/BoardApp";
import { FilesApp } from "@/components/world/pc/FilesApp";
import { KnowledgeApp } from "@/components/world/pc/KnowledgeApp";
import { LearnApp } from "@/components/world/pc/LearnApp";
import { MailApp } from "@/components/world/pc/MailApp";
import { NotesApp } from "@/components/world/pc/NotesApp";
import { JADEOS_VERSION, SystemApp } from "@/components/world/pc/SystemApp";
import { AppWindow, Muted } from "@/components/world/pc/common";
import { clock } from "@/components/world/pc/sources";
import { getSettings } from "@/lib/world/settings";

/**
 * Jade's personal computer (Jade's Quarters) — "JadeOS": boot, desktop
 * with a dock of apps and one app window. Opened from the `jade_pc` prop.
 *
 * Keyboard: 1–8 open the apps, arrow keys move through the dock, Esc
 * closes the computer (the Panel's layer).
 */

export type PcAppId =
  | "files"
  | "knowledge"
  | "learn"
  | "mail"
  | "board"
  | "terminal"
  | "notes"
  | "system";

export const PC_APPS: readonly { id: PcAppId; label: string; icon: string }[] = [
  { id: "files", label: tr("pcapp::Files"), icon: "▤" },
  { id: "knowledge", label: tr("pcapp::Knowledge"), icon: "◈" },
  { id: "learn", label: tr("pcapp::Learn"), icon: "✎" },
  { id: "mail", label: tr("pcapp::Mail"), icon: "✉" },
  { id: "board", label: tr("pcapp::Board"), icon: "▦" },
  { id: "terminal", label: tr("pcapp::Terminal"), icon: ">_" },
  { id: "notes", label: tr("pcapp::Notes"), icon: "✐" },
  { id: "system", label: tr("pcapp::System"), icon: "⚙" },
];

const BOOT_LINES: readonly string[] = [
  tr("JadeOS {version} — cold boot", { version: JADEOS_VERSION }),
  tr("POST … memory ok, fans complaining, coffee not detected"),
  tr("Mounting /home/jade … ok"),
  tr("Linking to the lab network via NET-001 … ok"),
  tr("Loading desktop. Welcome back, J.L."),
];
const BOOT_STEP_MS = 220;

/** Boot animation plays once per page session; later openings show the desktop at once. */
let bootedThisSession = false;

/** For tests: play the boot again on the next opening. */
export function __resetPcBootForTests(): void {
  bootedThisSession = false;
}

function Boot({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (n >= BOOT_LINES.length) {
      const t = window.setTimeout(onDone, BOOT_STEP_MS * 2);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setN((x) => x + 1), BOOT_STEP_MS);
    return () => window.clearTimeout(t);
  }, [n, onDone]);
  return (
    <div
      className="min-h-[18rem] space-y-0.5 font-mono text-[11px]"
      data-pc-boot
      role="status"
      aria-live="polite"
    >
      {BOOT_LINES.slice(0, n).map((l) => (
        <p key={l} style={{ color: UI.green }}>
          {l}
        </p>
      ))}
      <span className="inline-block h-3 w-2 animate-pulse bg-[#33FF33] motion-reduce:animate-none" />
      <div className="pt-3">
        <CrtButton onClick={onDone}>{tr("Skip")}</CrtButton>
      </div>
    </div>
  );
}

function TerminalApp({ onTerminal }: { onTerminal?: () => void }) {
  return (
    <AppWindow title={tr("pc::Terminal")}>
      <div className="space-y-2">
        <p className="text-[11px]" style={{ color: UI.text }}>
          {tr(
            "Your old private terminal still runs on this machine: mail to yourself, notes, and whatever cerulean means.",
          )}
        </p>
        <CrtButton tone="cyan" onClick={onTerminal} disabled={!onTerminal}>
          {tr("Open the terminal")}
        </CrtButton>
        {!onTerminal && <Muted>{tr("The terminal is not reachable from here.")}</Muted>}
      </div>
    </AppWindow>
  );
}

function PersonalComputerImpl({
  api,
  onClose,
  onTerminal,
}: {
  api: WorldApi;
  onClose: () => void;
  /** Opens Jade's private room terminal (`term_jadeq`). */
  onTerminal?: () => void;
}) {
  const [booted, setBooted] = useState(
    () => bootedThisSession || getSettings().accessibility.reduceMotion,
  );
  const [app, setApp] = useState<PcAppId>("files");
  const [since] = useState(() => Date.now());
  const finishBoot = useCallback(() => {
    bootedThisSession = true;
    setBooted(true);
  }, []);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!booted) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        finishBoot();
      }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const i = Number.parseInt(e.key, 10);
    if (i >= 1 && i <= PC_APPS.length) {
      e.preventDefault();
      e.stopPropagation();
      setApp(PC_APPS[i - 1]!.id);
      api.sound?.("ui_click");
    }
  };
  const s = api.get();
  const current = PC_APPS.find((a) => a.id === app)!;

  return (
    <Panel
      title={tr("Jade's computer")}
      subtitle={`JadeOS ${JADEOS_VERSION}`}
      onClose={onClose}
      wide
      accent={UI.cyan}
    >
      <div onKeyDown={onKey} data-pc={booted ? "desktop" : "boot"}>
        {!booted ? (
          <Boot onDone={finishBoot} />
        ) : (
          <div className="flex min-h-[26rem] flex-col gap-2">
            <div className="flex items-center justify-between rounded-sm border border-[#00FFFF]/20 bg-[#00FFFF]/5 px-2 py-0.5 text-[10px] tracking-wider text-[#00FFFF]/80 uppercase">
              <span>{`JadeOS · ${current.label}`}</span>
              <span>{tr("Lab time {time}", { time: clock(s.playTime) })}</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
              <nav
                aria-label={tr("pc::Apps")}
                onKeyDown={gridKeyNav}
                className="flex shrink-0 flex-row flex-wrap gap-1 sm:w-24 sm:flex-col"
              >
                {PC_APPS.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    data-nav
                    data-app={a.id}
                    aria-pressed={app === a.id}
                    title={tr("{app} (key {n})", { app: a.label, n: i + 1 })}
                    onClick={() => {
                      setApp(a.id);
                      api.sound?.("ui_click");
                    }}
                    className={`flex items-center gap-1.5 rounded-sm border px-1.5 py-1 text-left text-[10px] tracking-wider uppercase ${FOCUS_RING} ${
                      app === a.id
                        ? "border-[#00FFFF]/70 bg-[#00FFFF]/10 text-[#00FFFF]"
                        : "border-white/10 text-[#33FF33]/70 hover:border-[#33FF33]/40"
                    }`}
                  >
                    <span aria-hidden className="w-4 text-center text-xs">
                      {a.icon}
                    </span>
                    <span className="truncate">{a.label}</span>
                  </button>
                ))}
              </nav>
              <div className="min-w-0 flex-1 rounded-sm border border-white/10 bg-black/30 p-2">
                {app === "files" && <FilesApp api={api} />}
                {app === "knowledge" && <KnowledgeApp api={api} />}
                {app === "learn" && <LearnApp api={api} />}
                {app === "mail" && <MailApp api={api} />}
                {app === "board" && <BoardApp api={api} />}
                {app === "terminal" && <TerminalApp onTerminal={onTerminal} />}
                {app === "notes" && <NotesApp api={api} />}
                {app === "system" && <SystemApp api={api} since={since} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

export const PersonalComputer = memoPanel(PersonalComputerImpl);
