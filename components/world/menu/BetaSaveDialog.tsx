"use client";

/**
 * Confirmation dialog for `/world#beta-save=<code>` links from the _unLABS
 * Beta Lab (lib/world/beta-save.ts). Shows what the link contains and lets
 * the player pick a manual slot; nothing is written before "Import & load".
 * The target slot's previous save is kept as a restorable backup
 * (Load → slot → "Restore backup").
 */
import { useEffect, useMemo, useState } from "react";
import { CrtButton, MenuPanel } from "@/components/world/menu/shared";
import { previewBetaSave, type BetaSavePreview } from "@/lib/world/beta-save";
import {
  MANUAL_SLOTS,
  backupSlot,
  formatPlayTime,
  importSave,
  listSlots,
  setActiveSlot,
  type SlotId,
} from "@/lib/world/save";
import { tr } from "@/lib/i18n";

export function BetaSaveDialog({
  code,
  onCancel,
  onLoaded,
  z = 95,
}: {
  code: string;
  onCancel: () => void;
  /** The save was imported into the (now active) slot — start playing. */
  onLoaded: () => void;
  z?: number;
}) {
  const [preview, setPreview] = useState<BetaSavePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slots = useMemo(() => listSlots().filter((s) => MANUAL_SLOTS.includes(s.id)), []);
  const [slot, setSlot] = useState<SlotId>(
    () => slots.find((s) => s.empty && !s.corrupt)?.id ?? "slot3",
  );

  useEffect(() => {
    let live = true;
    void previewBetaSave(code).then((p) => {
      if (live) setPreview(p);
    });
    return () => {
      live = false;
    };
  }, [code]);

  const target = slots.find((s) => s.id === slot);
  const overwrites = !!target && !target.empty;

  const confirm = () => {
    if (!preview?.ok) return;
    if (overwrites) backupSlot(slot);
    const r = importSave(slot, preview.text);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setActiveSlot(slot);
    onLoaded();
  };

  const m = preview?.ok ? preview.meta : null;
  return (
    <MenuPanel
      z={z}
      title={tr("Load test save?")}
      subtitle={tr("A link from the _unLABS Beta Lab wants to load a save state.")}
      onClose={onCancel}
      accent="#00FFFF"
    >
      {!preview && <p className="text-[#33FF33]/60">{tr("Checking save code …")}</p>}
      {preview && !preview.ok && (
        <>
          <p className="text-red-400">{preview.error}</p>
          <div className="mt-4 flex justify-end">
            <CrtButton onClick={onCancel}>{tr("Close")}</CrtButton>
          </div>
        </>
      )}
      {m && (
        <>
          <div className="rounded-sm border border-[#33FF33]/25 p-3 text-[11px]">
            <div className="mb-1 text-sm text-[#d8ffd8]">{m.label}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <span className="text-[#33FF33]/50">{tr("Floor")} </span>
                {m.floorName}
              </span>
              {m.room && (
                <span>
                  <span className="text-[#33FF33]/50">{tr("Room")} </span>
                  {m.room}
                </span>
              )}
              <span>
                <span className="text-[#33FF33]/50">{tr("Playtime")} </span>
                <span className="tabular-nums">{formatPlayTime(m.playTime)}</span>
              </span>
              <span>
                <span className="text-[#33FF33]/50">{tr("Devices")} </span>
                <span className="tabular-nums">
                  {m.devices}/{m.totalDevices}
                </span>
              </span>
              <span>
                <span className="text-[#33FF33]/50">{tr("Paths")} </span>
                <span className="tabular-nums">
                  {m.endings}/{m.totalEndings}
                </span>
              </span>
            </div>
            {preview?.ok && preview.repaired > 0 && (
              <p className="mt-1 text-[#FFB800]/80">
                {tr("{n} outdated entries will be cleaned up.", { n: preview.repaired })}
              </p>
            )}
          </div>

          <p className="mt-3 mb-1 text-xs text-[#33FF33]/60">{tr("Load into which slot?")}</p>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={tr("Save slots")}>
            {slots.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-baseline gap-2 rounded-sm border px-2 py-1.5 text-xs ${
                  s.id === slot ? "border-[#00FFFF]/70 bg-[#00FFFF]/5" : "border-[#33FF33]/20"
                }`}
              >
                <input
                  type="radio"
                  name="beta-slot"
                  checked={s.id === slot}
                  onChange={() => setSlot(s.id)}
                  className="accent-[#00FFFF]"
                />
                <span className="tracking-[0.15em] text-[#FFB800] uppercase">{s.name}</span>
                <span className="truncate text-[#d8ffd8]/80">
                  {s.meta ? s.meta.label : s.corrupt ? tr("corrupted") : tr("— empty —")}
                </span>
              </label>
            ))}
          </div>
          {overwrites && (
            <p className="mt-2 text-xs text-[#FFB800]">
              {tr(
                "{slot} is not empty. Its current save is kept as a backup: Load → {slot} → Restore backup.",
                { slot: target?.name ?? "" },
              )}
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <CrtButton onClick={onCancel}>{tr("Cancel")}</CrtButton>
            <CrtButton tone="cyan" onClick={confirm} autoFocus>
              {tr("Import & load")}
            </CrtButton>
          </div>
        </>
      )}
    </MenuPanel>
  );
}
