"use client";

import { tr } from "@/lib/i18n";
import { CrtButton, Panel, SectionTitle, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { DOORS } from "@/lib/world/content/map";
import { doorInfo, setDoorMode, type DoorMode } from "@/lib/world/doors/lock";
import { AIRLOCK_BY_ID, EXTRACT_S, STEAM_S, type AirlockPhase } from "@/lib/world/doors/airlock";

/**
 * A door's lock interface (docs/DOORS.md): what the door is, how it locks,
 * its state, the mode (automatic / held open / sealed), the access log,
 * the keypad, and — for airlock doors — the cycle.
 */
export function DoorPanel({
  api,
  id,
  onClose,
  onKeypad,
  airlock,
}: {
  api: WorldApi;
  id: string;
  onClose: () => void;
  onKeypad: (puzzle: string) => void;
  /** Live airlock phase from the engine (null = not an airlock door / floor not built). */
  airlock?: (airlockId: string) => { phase: AirlockPhase; cycles: number } | null;
}) {
  const s = api.get();
  const d = DOORS.find((x) => x.id === id);
  if (!d) return null;
  const info = doorInfo(s, d);
  const set = (mode: DoorMode) => {
    const r = api.act((st) => setDoorMode(st, d, mode));
    api.toast(r.text, r.ok ? "info" : "warn");
    if (r.ok) api.sound?.(mode === "sealed" ? "latch_bolt" : "ui_click");
  };
  const al = d.airlock ? AIRLOCK_BY_ID.get(d.airlock) : undefined;
  const live = al && airlock ? airlock(al.id) : null;
  const ago = info.last === null ? null : Math.max(0, Math.round((s.playTime - info.last) / 60));
  const status = !info.open
    ? tr("Locked")
    : info.mode === "sealed"
      ? tr("Sealed")
      : info.mode === "hold"
        ? tr("Held open")
        : tr("Automatic");
  const statusColor =
    !info.open || info.mode === "sealed" ? UI.red : info.mode === "hold" ? UI.cyan : UI.green;
  return (
    <Panel
      title={info.name}
      subtitle={tr("Lock interface · {id}", { id: d.id.toUpperCase() })}
      onClose={onClose}
      accent={UI.amber}
    >
      <div className="space-y-3 text-xs">
        <p>
          <span style={{ color: statusColor }}>■ {status}</span>
          {info.hint && <span className="ml-2 text-white/55">{info.hint}</span>}
        </p>
        <div>
          <SectionTitle>{tr("Door")}</SectionTitle>
          <p className="text-white/70">
            {info.rooms[0] === info.rooms[1]
              ? info.rooms[0]
              : `${info.rooms[0]} ↔ ${info.rooms[1]}`}{" "}
            · {info.shape}
          </p>
        </div>
        <div>
          <SectionTitle>{tr("Locking mechanism")}</SectionTitle>
          <p className="text-white/80">{info.mech}</p>
          <p className="text-white/55">{info.mechText}</p>
        </div>
        <div>
          <SectionTitle>{tr("Mode")}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <CrtButton tone={info.mode === "auto" ? "green" : "amber"} onClick={() => set("auto")}>
              {tr("Automatic")}
            </CrtButton>
            <CrtButton
              tone={info.mode === "hold" ? "cyan" : "amber"}
              disabled={!info.open || info.airlock}
              onClick={() => set("hold")}
            >
              {tr("Hold open")}
            </CrtButton>
            <CrtButton
              tone={info.mode === "sealed" ? "red" : "amber"}
              onClick={() => set("sealed")}
            >
              {tr("Seal")}
            </CrtButton>
            {info.keypad && (
              <CrtButton tone="cyan" onClick={() => onKeypad(info.keypad!)}>
                {tr("Enter code")}
              </CrtButton>
            )}
          </div>
        </div>
        {al && (
          <div>
            <SectionTitle accent={UI.cyan}>{tr("Airlock")}</SectionTitle>
            <p className="text-white/70">
              {tr(
                "The two doors never open together. Step into the chamber: the doors seal, steam blows for {steam} s, the extraction pulls steam and dust through the floor grate for {extract} s, then the far door releases. The data center stays free of dust.",
                { steam: STEAM_S, extract: EXTRACT_S },
              )}
            </p>
            {live && (
              <p className="mt-1 text-white/55">
                {live.phase === "steam"
                  ? tr("Cycle: steam")
                  : live.phase === "extract"
                    ? tr("Cycle: extraction")
                    : live.phase === "release"
                      ? tr("Cycle: released")
                      : tr("Ready")}{" "}
                · {tr("{n} cycles", { n: live.cycles })}
              </p>
            )}
          </div>
        )}
        <div>
          <SectionTitle>{tr("Access log")}</SectionTitle>
          <p className="text-white/55">
            {info.opens === 0
              ? tr("Never opened.")
              : tr("Opened {n}× · last {m} min ago.", { n: info.opens, m: ago ?? 0 })}
          </p>
        </div>
      </div>
    </Panel>
  );
}
