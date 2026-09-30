"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConfirmDialog,
  CrtButton,
  MenuPanel,
  useMenuNav,
  type MenuItem,
} from "@/components/world/menu/shared";
import { FLOORS_TOP_DOWN } from "@/lib/world/content/map";
import { endingStats, isPostgame, type EndingStats } from "@/lib/world/postgame";
import {
  backupMeta,
  deleteSlot,
  exportSave,
  formatPlayTime,
  formatSavedAt,
  importSave,
  listSlots,
  loadSlot,
  restoreBackup,
  type SlotId,
  type SlotInfo,
  type SlotMeta,
} from "@/lib/world/save";
import { useSettings } from "@/lib/world/settings";
import { tr } from "@/lib/i18n";

export type SlotListMode = "load" | "save" | "new";

const MODE_ACTION: Record<SlotListMode, string> = {
  load: tr("Load"),
  save: tr("Save"),
  new: tr("Start here"),
};

/** Footer key hint per mode (whole sentences, never assembled from parts). */
const MODE_KEYS: Record<SlotListMode, string> = {
  load: tr("↑ ↓ select · Enter load · Del delete · Esc back"),
  save: tr("↑ ↓ select · Enter save · Del delete · Esc back"),
  new: tr("↑ ↓ select · Enter start here · Del delete · Esc back"),
};

/** Everything the slot card shows beyond the stored meta (read from the save itself). */
export interface SlotDetails {
  stats: EndingStats;
  /** NG+ cycle (0 = first run). */
  ngPlus: number;
  /** At least one ending reached in this run. */
  finished: boolean;
}

/** Parse a slot's save for the card (null for empty/corrupt slots). */
export function slotDetails(id: SlotId): SlotDetails | null {
  const st = loadSlot(id);
  if (!st) return null;
  const stats = endingStats(st);
  return { stats, ngPlus: stats.ngPlus, finished: isPostgame(st) };
}

/** Relative "last saved" label (falls back to the absolute date after a week). */
export function savedAgo(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return tr("just now");
  const m = Math.round(s / 60);
  if (m < 60) return tr("{n} min ago", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return tr("{n} h ago", { n: h });
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? tr("yesterday") : tr("{n} days ago", { n: d });
  return formatSavedAt(iso);
}

function Meter({ label, cur, total }: { label: string; cur: number; total: number }) {
  const f = total > 0 ? Math.min(1, cur / total) : 0;
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-14 shrink-0 text-[#33FF33]/50">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-[1px] bg-[#33FF33]/10">
        <span
          className="absolute inset-y-0 left-0 bg-[#33FF33]/70 shadow-[0_0_4px_#33FF33]"
          style={{ width: `${f * 100}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right text-[#d8ffd8]/80 tabular-nums">
        {cur}/{total}
      </span>
    </div>
  );
}

/** Mini elevator panel: the six floors top-down, the saved one lit. */
function FloorStrip({ floor }: { floor: number }) {
  return (
    <div
      className="flex w-10 shrink-0 flex-col gap-0.5 rounded-sm border border-[#33FF33]/20 bg-black/60 p-1"
      aria-hidden
    >
      {FLOORS_TOP_DOWN.map((f) => {
        const on = f.id === floor;
        return (
          <span
            key={f.id}
            className={`rounded-[1px] px-0.5 text-center font-mono text-[8px] leading-3 ${
              on
                ? "bg-[#FFB800] text-black shadow-[0_0_6px_#FFB800]"
                : "bg-[#33FF33]/5 text-[#33FF33]/35"
            }`}
          >
            {f.short}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Shared slot picker. `load` disables empty slots; `save`/`new` hide the
 * autosave slot and ask before overwriting (when confirmDestructive is on).
 * Deleting always asks. Keys: ↑/↓ select · Enter confirm · Del delete.
 */
export function SlotList({
  mode,
  onPick,
  active = true,
  z = 85,
}: {
  mode: SlotListMode;
  onPick: (id: SlotId) => void;
  /** False while a parent dialog owns the keyboard. */
  active?: boolean;
  /** Stacking level for dialogs opened from the list. */
  z?: number;
}) {
  const [settings] = useSettings();
  const [rev, setRev] = useState(0);
  const [confirm, setConfirm] = useState<
    | { kind: "overwrite"; id: SlotId }
    | { kind: "delete"; id: SlotId }
    | { kind: "restore"; id: SlotId }
    | null
  >(null);
  const [transfer, setTransfer] = useState<{ kind: "export" | "import"; id: SlotId } | null>(null);
  const [now] = useState(() => Date.now());

  const slots = useMemo(() => {
    void rev;
    const all = listSlots();
    return mode === "load" ? all : all.filter((s) => s.id !== "auto");
  }, [mode, rev]);

  const details = useMemo(() => {
    const out = new Map<SlotId, SlotDetails>();
    for (const info of slots) {
      if (info.empty) continue;
      const d = slotDetails(info.id);
      if (d) out.set(info.id, d);
    }
    return out;
  }, [slots]);

  /** Restorable backups of manual slots (kept when a beta-save link overwrote the slot). */
  const backups = useMemo(() => {
    const out = new Map<SlotId, SlotMeta>();
    for (const info of slots) {
      const m = backupMeta(info.id);
      if (m) out.set(info.id, m);
    }
    return out;
  }, [slots]);

  const refresh = useCallback(() => setRev((r) => r + 1), []);

  const pick = useCallback(
    (info: SlotInfo) => {
      if (mode === "load") {
        if (!info.empty) onPick(info.id);
        return;
      }
      if (!info.empty && settings.gameplay.confirmDestructive) {
        setConfirm({ kind: "overwrite", id: info.id });
        return;
      }
      onPick(info.id);
    },
    [mode, onPick, settings.gameplay.confirmDestructive],
  );

  const items: MenuItem[] = slots.map((info) => ({
    id: info.id,
    label: info.name,
    disabled: mode === "load" && info.empty,
    onSelect: () => pick(info),
  }));
  const navActive = active && !confirm && !transfer;
  const [index, setIndex] = useMenuNav(items, navActive);

  // Del / Backspace: delete the highlighted slot (always confirmed).
  const slotsRef = useRef(slots);
  const indexRef = useRef(index);
  useEffect(() => {
    slotsRef.current = slots;
    indexRef.current = index;
  });
  useEffect(() => {
    if (!navActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Delete" && e.code !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const info = slotsRef.current[indexRef.current];
      if (!info || (info.empty && !info.corrupt)) return;
      e.preventDefault();
      setConfirm({ kind: "delete", id: info.id });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navActive]);

  // Keep the keyboard cursor in view in long (scrolling) panels.
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    cardRefs.current[index]?.scrollIntoView?.({ block: "nearest" });
  }, [index]);

  return (
    <div className="flex flex-col gap-2" role="listbox" aria-label={tr("Save slots")}>
      {slots.map((info, i) => {
        const m = info.meta;
        const d = details.get(info.id);
        const sel = i === index;
        const disabled = mode === "load" && info.empty;
        return (
          <div
            key={info.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            role="option"
            aria-selected={sel}
            // An empty slot cannot be loaded, but a manual slot still offers Import —
            // only mark the row disabled when none of its actions is available.
            aria-disabled={disabled && info.id === "auto"}
            aria-label={`${info.name} · ${m ? m.label : info.corrupt ? tr("corrupted") : tr("empty")}`}
            onMouseEnter={() => !disabled && setIndex(i)}
            onDoubleClick={() => !disabled && pick(info)}
            className={`relative rounded-sm border p-3 transition-colors ${
              sel ? "border-[#00FFFF]/70 bg-[#00FFFF]/5" : "border-[#33FF33]/20"
            } ${disabled ? "opacity-50" : ""}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs tracking-[0.2em] text-[#FFB800] uppercase">{info.name}</span>
              {info.active && (
                <span className="rounded-sm border border-[#00FFFF]/50 px-1 text-[9px] tracking-widest text-[#00FFFF] uppercase">
                  {tr("active")}
                </span>
              )}
              {d && d.ngPlus > 0 && (
                <span
                  className="rounded-sm border border-[#B388FF]/60 px-1 text-[9px] tracking-widest text-[#B388FF] uppercase"
                  title={tr("New Game+ · run {n}", { n: d.ngPlus + 1 })}
                >
                  NG+{d.ngPlus > 1 ? ` ${d.ngPlus}` : ""}
                </span>
              )}
              {d?.finished && (
                <span className="rounded-sm border border-[#FFB800]/60 px-1 text-[9px] tracking-widest text-[#FFB800] uppercase">
                  {tr("completed")}
                </span>
              )}
              {m && <span className="truncate text-sm text-[#d8ffd8]">{m.label}</span>}
              {m && (
                <span
                  className="ml-auto text-[10px] text-[#33FF33]/50"
                  title={formatSavedAt(m.savedAt)}
                >
                  {savedAgo(m.savedAt, now)}
                </span>
              )}
            </div>
            {m ? (
              <div className="mt-2 flex gap-3">
                <FloorStrip floor={m.floor} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap gap-x-4 text-[11px]">
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
                  </div>
                  <Meter label={tr("Devices")} cur={m.devices} total={m.totalDevices} />
                  <Meter label={tr("Paths")} cur={m.endings} total={m.totalEndings} />
                  {d && (
                    <>
                      <Meter
                        label={tr("Slices")}
                        cur={d.stats.slices.current}
                        total={d.stats.slices.total}
                      />
                      <Meter
                        label={tr("Bots")}
                        cur={d.stats.bots.current}
                        total={d.stats.bots.total}
                      />
                    </>
                  )}
                </div>
              </div>
            ) : info.corrupt ? (
              <p className="mt-1 text-xs text-red-400/80">
                {tr("— corrupted — save unreadable. Overwrite or delete it.")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#33FF33]/40">{tr("— empty —")}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <CrtButton
                tone={mode === "load" ? "cyan" : "amber"}
                disabled={disabled}
                onClick={() => pick(info)}
              >
                {MODE_ACTION[mode]}
              </CrtButton>
              {!info.empty && (
                <CrtButton onClick={() => setTransfer({ kind: "export", id: info.id })}>
                  {tr("Export")}
                </CrtButton>
              )}
              {info.id !== "auto" && (
                <CrtButton onClick={() => setTransfer({ kind: "import", id: info.id })}>
                  {tr("Import")}
                </CrtButton>
              )}
              {backups.has(info.id) && (
                <CrtButton onClick={() => setConfirm({ kind: "restore", id: info.id })}>
                  {tr("Restore backup")}
                </CrtButton>
              )}
              {(!info.empty || info.corrupt) && (
                <CrtButton tone="red" onClick={() => setConfirm({ kind: "delete", id: info.id })}>
                  {tr("Delete")}
                </CrtButton>
              )}
            </div>
          </div>
        );
      })}
      <p className="px-1 text-[10px] text-[#33FF33]/35">{MODE_KEYS[mode]}</p>

      {confirm?.kind === "overwrite" && (
        <ConfirmDialog
          z={z + 10}
          title={tr("Overwrite save?")}
          text={tr("{slot} already contains a save ({label}). It will be lost for good.", {
            slot: slots.find((s) => s.id === confirm.id)?.name ?? "",
            label: slots.find((s) => s.id === confirm.id)?.meta?.label ?? "",
          })}
          confirmLabel={tr("Overwrite")}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const id = confirm.id;
            setConfirm(null);
            onPick(id);
          }}
        />
      )}
      {confirm?.kind === "delete" && (
        <ConfirmDialog
          z={z + 10}
          title={tr("Delete save?")}
          text={tr("{slot} will be deleted permanently. Export it first if you want to keep it.", {
            slot: slots.find((s) => s.id === confirm.id)?.name ?? tr("This save"),
          })}
          confirmLabel={tr("Delete")}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            deleteSlot(confirm.id);
            setConfirm(null);
            refresh();
          }}
        />
      )}
      {confirm?.kind === "restore" && (
        <ConfirmDialog
          z={z + 10}
          title={tr("Restore backup?")}
          text={tr(
            "{slot} gets its previous save back ({label}). The current save becomes the backup, so you can switch back.",
            {
              slot: slots.find((s) => s.id === confirm.id)?.name ?? "",
              label: backups.get(confirm.id)?.label ?? "",
            },
          )}
          confirmLabel={tr("Restore")}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            restoreBackup(confirm.id);
            setConfirm(null);
            refresh();
          }}
        />
      )}
      {transfer && (
        <TransferDialog
          z={z + 5}
          kind={transfer.kind}
          id={transfer.id}
          overwrites={!slots.find((s) => s.id === transfer.id)?.empty}
          onClose={() => {
            setTransfer(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function TransferDialog({
  kind,
  id,
  overwrites,
  onClose,
  z,
}: {
  kind: "export" | "import";
  id: SlotId;
  overwrites: boolean;
  onClose: () => void;
  z: number;
}) {
  const [code] = useState(() => (kind === "export" ? exportSave(id) : ""));
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(code).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  const doImport = () => {
    const r = importSave(id, text);
    setStatus(
      r.ok
        ? {
            ok: true,
            text:
              r.repaired > 0
                ? tr("Imported: {label} ({time}) · {n} outdated entries cleaned up", {
                    label: r.meta.label,
                    time: formatPlayTime(r.meta.playTime),
                    n: r.repaired,
                  })
                : tr("Imported: {label} ({time})", {
                    label: r.meta.label,
                    time: formatPlayTime(r.meta.playTime),
                  }),
          }
        : { ok: false, text: r.error },
    );
  };

  return (
    <MenuPanel
      z={z}
      title={kind === "export" ? tr("Export save") : tr("Import save")}
      subtitle={
        kind === "export"
          ? tr("Copy the code and keep it somewhere safe.")
          : overwrites
            ? tr("Warning: the existing save in this slot will be replaced.")
            : tr("Paste an exported save code.")
      }
      onClose={onClose}
      accent="#00FFFF"
    >
      {kind === "export" ? (
        <>
          <textarea
            readOnly
            value={code}
            onFocus={(e) => e.currentTarget.select()}
            className="h-40 w-full resize-none rounded-sm border border-[#33FF33]/30 bg-black p-2 font-mono text-[10px] break-all text-[#33FF33]/80 outline-none focus:border-[#00FFFF]"
            aria-label={tr("Save code")}
          />
          <div className="mt-2 flex items-center gap-2">
            <CrtButton tone="cyan" onClick={copy}>
              {tr("Copy")}
            </CrtButton>
            {copied && <span className="text-xs text-[#33FF33]">{tr("Copied to clipboard.")}</span>}
          </div>
        </>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tr("Paste save code here …")}
            className="h-40 w-full resize-none rounded-sm border border-[#33FF33]/30 bg-black p-2 font-mono text-[10px] break-all text-[#33FF33] outline-none placeholder:text-[#33FF33]/30 focus:border-[#00FFFF]"
            aria-label={tr("Paste save code")}
          />
          <div className="mt-2 flex items-center gap-2">
            <CrtButton tone="amber" onClick={doImport} disabled={!text.trim() || !!status?.ok}>
              {tr("Import")}
            </CrtButton>
            {status && (
              <span className={`text-xs ${status.ok ? "text-[#33FF33]" : "text-red-400"}`}>
                {status.text}
              </span>
            )}
          </div>
        </>
      )}
    </MenuPanel>
  );
}
