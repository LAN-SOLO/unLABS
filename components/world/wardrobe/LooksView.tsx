"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useState } from "react";
import type { Rotation } from "@/components/world/ModelPreview";
import type { WorldApi } from "@/components/world/panels";
import { CrtButton, FOCUS_RING, Meter, UI, gridKeyNav } from "@/components/world/ui";
import { JadePreview } from "@/components/world/wardrobe/JadePreview";
import { SIGNATURE_LOOKS, type SignatureLook } from "@/lib/world/content/looks";
import { WEAR_BY_ID, WEAR_SLOT_DEFS } from "@/lib/world/content/wardrobe";
import {
  lookMissing,
  lookUnlocked,
  looksProgress,
  wearLook,
  wearingLook,
} from "@/lib/world/wardrobe";
import type { WorldState } from "@/lib/world/types";
import { LOOKS_TAB_FLAG } from "@/lib/world/wardrobe-hints";

const KIND_LABEL: Record<SignatureLook["unlock"]["kind"], string> = {
  start: tr("From the start"),
  craft: tr("Replicator"),
  find: tr("Hidden pieces"),
  event: tr("Lab event"),
};

/** Spoiler-safe line for a locked look. */
function lockedLine(s: WorldState, l: SignatureLook): string {
  if (l.unlock.kind === "event") return l.unlock.hint;
  const m = lookMissing(s, l);
  const names = m.pieces.map((id) => WEAR_BY_ID.get(id)?.name ?? id);
  for (const key of m.dyes) {
    const [item, cw] = key.split(".") as [string, string];
    const w = WEAR_BY_ID.get(item);
    const c = w?.colorways.find((x) => x.id === cw);
    names.push(tr("{name} in {colour} (dye)", { name: w?.name ?? item, colour: c?.label ?? cw }));
  }
  return l.unlock.kind === "craft"
    ? tr("Replicate: {list}", { list: names.join(", ") })
    : tr("Still missing: {list}", { list: names.join(", ") });
}

/** A secret event look stays a mystery until it unlocks. */
const hidden = (s: WorldState, l: SignatureLook) =>
  l.unlock.kind === "event" && !!l.unlock.secret && !lookUnlocked(s, l.id);

/**
 * The "Looks" tab: Jade's eighteen signature looks, locked ones with how to
 * get them (event looks only as a hint), a preview and one-click "wear this
 * look". Away from the wardrobe only gadgets and accessories change.
 */
export function LooksView({
  api,
  atWardrobe,
  turn,
  onTurn,
}: {
  api: WorldApi;
  atWardrobe: boolean;
  turn: Rotation;
  onTurn: (r: Rotation) => void;
}) {
  const s = api.get();
  const [pick, setPick] = useState<string>(
    () => wearingLook(s.wardrobe.look) ?? SIGNATURE_LOOKS[0]!.id,
  );
  const [msg, setMsg] = useState<string | null>(null);
  // First visit: the looks hint has done its job.
  useEffect(() => {
    if (!api.get().flags[LOOKS_TAB_FLAG])
      api.act((st) => {
        st.flags[LOOKS_TAB_FLAG] = true;
      });
  }, [api]);
  const prog = looksProgress(s);
  const sel = SIGNATURE_LOOKS.find((l) => l.id === pick) ?? SIGNATURE_LOOKS[0]!;
  const selOpen = lookUnlocked(s, sel.id);
  // Event looks are not previewed before they unlock (no spoilers).
  const previewable = selOpen || sel.unlock.kind !== "event";
  const on = wearingLook(s.wardrobe.look);

  const wear = () => {
    const r = api.act((st) => wearLook(st, sel.id, atWardrobe));
    api.sound?.(r.changed.length ? "ui_click" : "fail_buzz");
    setMsg(
      r.waiting
        ? r.changed.length
          ? tr("Gadgets and accessories are on. The clothes wait at the wardrobe.")
          : tr("This look needs the wardrobe: clothes, shoes and hair change only there.")
        : r.changed.length
          ? tr("Jade puts on “{name}”.", { name: sel.name })
          : tr("Already wearing it."),
    );
  };

  const clothesDiffer = WEAR_SLOT_DEFS.some(
    (d) =>
      d.wardrobeOnly &&
      (sel.look[d.id]?.item !== s.wardrobe.look[d.id]?.item ||
        sel.look[d.id]?.colorway !== s.wardrobe.look[d.id]?.colorway),
  );

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]" data-looks="">
      <div className="flex flex-col items-center gap-2">
        {previewable ? (
          <JadePreview look={sel.look} turn={turn} onTurn={onTurn} size={220} />
        ) : (
          <div className="flex h-[220px] w-[220px] items-center justify-center rounded-sm border border-dashed border-[#E91E8C]/30 text-3xl text-white/25">
            ?
          </div>
        )}
        <p className="text-center text-xs text-[#ffd0ea]">
          {hidden(s, sel) ? tr("??? — a secret look") : sel.name}
        </p>
        {!hidden(s, sel) && (
          <p className="text-center text-[11px] text-white/55">{sel.description}</p>
        )}
        <CrtButton tone="green" disabled={!selOpen} onClick={wear} data-wear-look={sel.id}>
          {tr("Wear this look")}
        </CrtButton>
        {selOpen && !atWardrobe && clothesDiffer && (
          <p className="text-center text-[10px] text-[#ffe6a8]">
            {tr(
              "Away from the wardrobe only gadgets and accessories change — clothes, shoes and hair are changed at the wardrobe in Jade's quarters.",
            )}
          </p>
        )}
        {msg && (
          <p role="status" className="text-center text-[11px] text-[#FFB800]">
            {msg}
          </p>
        )}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2 text-[10px] text-white/55">
          <span>
            {tr("{n}/{total} looks unlocked · {worn} worn", {
              n: prog.unlocked,
              total: prog.total,
              worn: prog.worn,
            })}
          </span>
          <Meter
            value={prog.unlocked}
            max={prog.total}
            color={UI.magenta}
            className="flex-1"
            label={tr("Looks unlocked")}
          />
        </div>
        <ul
          className="grid gap-1.5 sm:grid-cols-2"
          aria-label={tr("Signature looks")}
          onKeyDown={gridKeyNav}
        >
          {SIGNATURE_LOOKS.map((l) => {
            const open = lookUnlocked(s, l.id);
            const secret = hidden(s, l);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  data-nav=""
                  data-look={l.id}
                  aria-pressed={pick === l.id}
                  onClick={() => {
                    setPick(l.id);
                    setMsg(null);
                  }}
                  className={`flex w-full flex-col rounded-sm border px-2 py-1 text-left text-[10px] ${FOCUS_RING} ${
                    pick === l.id
                      ? "border-[#E91E8C] bg-[#E91E8C]/10"
                      : "border-[#33FF33]/20 hover:border-[#33FF33]/50"
                  } ${open ? "" : "opacity-70"}`}
                >
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[11px] text-[#d8ffd8]">
                      {secret ? tr("??? — a secret look") : l.name}
                    </span>
                    {on === l.id && <span className="text-[#E91E8C]">✓</span>}
                    <span className="ml-auto shrink-0 text-white/40">
                      {open ? (s.wardrobe.looksWorn[l.id] ? tr("worn") : tr("new")) : "🔒"}
                    </span>
                  </span>
                  <span className="text-[9px] tracking-wider text-white/35 uppercase">
                    {KIND_LABEL[l.unlock.kind]}
                  </span>
                  {!open && <span className="text-white/55">{lockedLine(s, l)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
