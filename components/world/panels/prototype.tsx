"use client";

/**
 * "Use with prototype …" — the picker that lists which carried
 * prototypes would do something at a target (device, prop, door, bot,
 * pickup, puzzle or another prototype), plus the shared result handling
 * (toasts, sounds, insights). Hosts that know more (world position, open
 * overlays) pass their own `onUse` that wraps `runPrototypeUse`.
 */
import { tr } from "@/lib/i18n";
import { useState } from "react";
import { ItemIcon } from "@/components/world/ItemIcon";
import { FOCUS_RING, UI } from "@/components/world/ui";
import { announce, memoPanel, type WorldApi } from "@/components/world/panels/shared";
import { ARCHETYPE_BY_ID, PROTO_EFFECT_BY_ID, type ProtoEffectId } from "@/lib/world/combine";
import type { SfxName } from "@/lib/world/audio/sfx";
import {
  applyPrototype,
  itemDef,
  prototypeUseOptions,
  type PrototypeUseOption,
  type PrototypeUseReport,
} from "@/lib/world/game";

/** Runs one option at a target and returns the report. */
export type ProtoUseHandler = (target: string, opt: PrototypeUseOption) => PrototypeUseReport;

/** Sound per effect family (a door's own slide sound comes from the engine). */
export const PROTO_FAMILY_SOUND: Record<ProtoEffectId, SfxName> = {
  ladung: "device_on",
  kuehlung: "steam_hiss",
  lichtbild: "scan_sweep",
  dekodierung: "puzzle_solved",
  stimmung: "handshake_tone",
  kalibrierung: "puzzle_solved",
  hebel: "pickup",
  peilung: "radio_tune",
  resonanzschluessel: "rumble",
  reanimation: "power_up_cascade",
  kohaerenz: "rift",
};

/**
 * Apply a prototype inside `api.act` and report it: headline + detail
 * lines as toasts, "New effect discovered" the first time a family fires,
 * insights / blueprints like every other flow. Failed uses buzz and
 * explain; nothing is consumed then.
 */
export function runPrototypeUse(
  api: WorldApi,
  target: string,
  opt: PrototypeUseOption,
): PrototypeUseReport {
  const r = api.act((st) => applyPrototype(st, opt.protoId, target, opt.family));
  if (!r.ok) {
    api.sound?.("fail_buzz");
    api.toast(r.message, "warn");
    for (const l of r.lines) api.toast(l, "info");
    return r;
  }
  api.sound?.(r.family ? PROTO_FAMILY_SOUND[r.family] : "prototype");
  if (r.firstOfFamily && r.family) {
    api.sound?.("insight");
    api.toast(
      tr("New effect discovered: {name}", {
        name: PROTO_EFFECT_BY_ID.get(r.family)?.name ?? r.family,
      }),
      "insight",
    );
  }
  api.toast(r.message, "good", r.items[0]?.item);
  for (const l of r.lines) api.toast(l, "info");
  announce(api, r);
  return r;
}

function PrototypeUseImpl({
  api,
  target,
  onUse,
  onResult,
  defaultOpen = false,
  className = "",
}: {
  api: WorldApi;
  /** Device / prop / door / NPC / pickup / puzzle id, or a generated item id. */
  target: string;
  onUse?: ProtoUseHandler;
  /** Called after a use (e.g. the dialogue panel appends the bot's lines). */
  onResult?: (r: PrototypeUseReport) => void;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const s = api.get();
  const options = prototypeUseOptions(s, target);
  if (!options.length) return null;

  const use = (o: PrototypeUseOption) => {
    const r = onUse ? onUse(target, o) : runPrototypeUse(api, target, o);
    setOpen(defaultOpen);
    onResult?.(r);
  };

  return (
    <div className={`rounded-sm border border-[#E91E8C]/35 bg-[#E91E8C]/[0.04] ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-xs text-[#ffb0dc] hover:bg-[#E91E8C]/10 ${FOCUS_RING}`}
      >
        <span>{tr("⚗ Use with prototype …")}</span>
        <span className="text-[10px] text-white/45">
          {options.length === 1 ? tr("1 fits") : tr("{n} fit", { n: options.length })}{" "}
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-[#E91E8C]/20 p-1.5">
          {options.map((o) => {
            const def = itemDef(s, o.protoId);
            const arch = def?.archetype ? ARCHETYPE_BY_ID.get(def.archetype) : undefined;
            return (
              <li key={`${o.protoId}:${o.family}`}>
                <button
                  type="button"
                  onClick={() => use(o)}
                  title={PROTO_EFFECT_BY_ID.get(o.family)?.effect}
                  className={`flex w-full items-center gap-2 rounded-sm border border-white/10 px-1.5 py-1 text-left text-xs hover:border-[#E91E8C]/60 hover:bg-[#E91E8C]/10 ${FOCUS_RING}`}
                >
                  {def && <ItemIcon item={def} size={28} frame={false} />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[#d8ffd8]">{o.name}</span>
                      {arch && (
                        <span className="shrink-0 text-[9px]" style={{ color: arch.hex }}>
                          ◆ {arch.name}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[10px] text-white/55">
                      <span style={{ color: UI.magenta }}>{o.familyName}</span> · {o.preview}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[9px] tracking-wider uppercase ${o.consumes ? "text-[#FF6B00]/80" : "text-[#33FF33]/80"}`}
                  >
                    {o.consumes ? tr("will be used up") : tr("is kept")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Memoized on `api.version` + target (hosts re-render every frame). */
export const PrototypeUse = memoPanel(PrototypeUseImpl);
