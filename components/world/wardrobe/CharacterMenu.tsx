"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Rotation } from "@/components/world/ModelPreview";
import type { WorldApi } from "@/components/world/panels";
import {
  CrtButton,
  FilterChip,
  FOCUS_RING,
  INPUT_CLASS,
  NewBadge,
  Panel,
  SectionTitle,
  UI,
  gridKeyNav,
} from "@/components/world/ui";
import { CollectionView, howToGet } from "@/components/world/wardrobe/CollectionView";
import { JadePreview } from "@/components/world/wardrobe/JadePreview";
import { ReplicatorView } from "@/components/world/wardrobe/ReplicatorView";
import { WearIcon } from "@/components/world/wardrobe/WearIcon";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { colorHex } from "@/lib/world/content/palette";
import {
  WEAR_BY_ID,
  WEAR_GROUPS,
  WEAR_SLOT_DEFS,
  WEAR_SLOT_BY_ID,
  type JadeLook,
  type WearGroup,
  type WearSlot,
} from "@/lib/world/content/wardrobe";
import {
  applyPreset,
  clearPreset,
  cloneLook,
  colorwayAvailable,
  equip,
  equipBlocked,
  markSeen,
  ownedWear,
  renamePreset,
  replicatorIntro,
  savePreset,
  surpriseLook,
  wardrobeStats,
} from "@/lib/world/wardrobe";
import { WARDROBE_MENU_FLAG } from "@/lib/world/wardrobe-hints";
import { REPLICATOR_INTRO_FLAG } from "@/lib/world/content/wardrobe";

export type CharacterTab = "wardrobe" | "outfits" | "collection" | "replicator";

const TABS: { id: CharacterTab; label: string }[] = [
  { id: "wardrobe", label: tr("menuTab::Wardrobe") },
  { id: "outfits", label: tr("Outfits") },
  { id: "collection", label: tr("Collection") },
  { id: "replicator", label: tr("Replicator") },
];

/** A look with one slot swapped (hover preview). */
function withPiece(look: JadeLook, slot: WearSlot, item: string | null, cw?: string): JadeLook {
  const out = cloneLook(look);
  if (item === null) out[slot] = null;
  else out[slot] = { item, colorway: cw ?? WEAR_BY_ID.get(item)?.colorways[0]?.id ?? "" };
  return out;
}

/**
 * The character menu (key O, pause menu, inventory, the wardrobe and the
 * replicator in Jade's quarters): a turning preview of Jade, every slot
 * with the owned pieces and their colours, four outfit presets, the whole
 * collection with hints, and the replicator page. `atWardrobe` unlocks
 * clothes, shoes and hair; `atReplicator` lets the replicator start jobs.
 */
export function CharacterMenu({
  api,
  atWardrobe,
  atReplicator = false,
  initialTab = "wardrobe",
  onClose,
}: {
  api: WorldApi;
  atWardrobe: boolean;
  atReplicator?: boolean;
  initialTab?: CharacterTab;
  onClose: () => void;
}) {
  const s = api.get();
  const [tab, setTab] = useState<CharacterTab>(initialTab);
  const [group, setGroup] = useState<WearGroup>("clothes");
  const [slot, setSlot] = useState<WearSlot>("top");
  const [turn, setTurn] = useState<Rotation>(0);
  const [hover, setHover] = useState<JadeLook | null>(null);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Jade's intro card: the first time she stands at the replicator.
  const [intro, setIntro] = useState(() => atReplicator && !api.get().flags[REPLICATOR_INTRO_FLAG]);
  const opened = useRef(false);

  // First open: remember it (hints), and at the replicator Jade's intro card once.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    api.act((st) => {
      st.flags[WARDROBE_MENU_FLAG] = true;
    });
    if (atReplicator) api.act((st) => replicatorIntro(st));
  }, [api, atReplicator]);

  const look = s.wardrobe.look;
  const shown = hover ?? look;
  const stats = wardrobeStats(s);
  const slotDef = WEAR_SLOT_BY_ID.get(slot)!;
  const pieces = ownedWear(s, slot);
  const current = look[slot];
  const detailId = focusItem ?? current?.item ?? null;
  const detail = detailId ? WEAR_BY_ID.get(detailId) : undefined;
  const lockedHere = slotDef.wardrobeOnly && !atWardrobe;

  const say = (text: string, tone: "warn" | "info" = "warn") => {
    setNotice(text);
    if (tone === "warn") api.sound?.("fail_buzz");
  };

  const put = (item: string | null, cw?: string) => {
    const why = equipBlocked(api.get(), slot, item, cw, atWardrobe);
    if (why) return say(why);
    const changed = api.act((st) => equip(st, slot, item, cw, atWardrobe));
    if (changed) {
      api.sound?.("ui_click");
      setNotice(null);
    }
    setHover(null);
  };

  const peek = (item: string | null, cw?: string) => {
    setHover(withPiece(look, slot, item, cw));
    if (item) {
      setFocusItem(item);
      if (!s.wardrobe.seen[item]) api.act((st) => markSeen(st, [item]));
    }
  };

  const groupSlots = WEAR_SLOT_DEFS.filter((d) => d.group === group);

  return (
    <Panel
      title={tr("Character")}
      subtitle={
        atWardrobe
          ? tr("At the wardrobe — everything can be changed.")
          : tr("Gadgets and accessories change anywhere; clothes, shoes and hair at the wardrobe.")
      }
      onClose={onClose}
      wide
      accent={UI.magenta}
    >
      <div role="tablist" aria-label={tr("Character menu")} className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <FilterChip
            key={t.id}
            active={tab === t.id}
            accent={UI.magenta}
            onClick={() => {
              setTab(t.id);
              setHover(null);
            }}
          >
            {t.label}
          </FilterChip>
        ))}
        <span className="ml-auto self-center text-[10px] text-white/45">
          {tr("{owned}/{total} pieces", { owned: stats.owned, total: stats.total })}
        </span>
      </div>

      {tab === "wardrobe" && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-2">
            <JadePreview look={shown} turn={turn} onTurn={setTurn} size={220} />
            <CrtButton
              tone="amber"
              onClick={() => {
                const n = api.act((st) => surpriseLook(st, atWardrobe)).length;
                api.sound?.(n ? "ui_click" : "fail_buzz");
                setHover(null);
                setFocusItem(null);
                setNotice(
                  n
                    ? tr("Jade shrugs and puts it on.")
                    : tr("Nothing to shuffle — find or replicate more pieces."),
                );
              }}
            >
              {tr("Surprise me")}
            </CrtButton>
            {!atWardrobe && (
              <p className="text-center text-[10px] text-white/40">
                {tr("Surprise me only shuffles gadgets and accessories away from the wardrobe.")}
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <div role="tablist" aria-label={tr("Group")} className="flex flex-wrap gap-1">
              {WEAR_GROUPS.map((g) => (
                <FilterChip
                  key={g.id}
                  active={group === g.id}
                  accent={UI.magenta}
                  onClick={() => {
                    setGroup(g.id);
                    const first = WEAR_SLOT_DEFS.find((d) => d.group === g.id);
                    if (first) setSlot(first.id);
                    setHover(null);
                    setFocusItem(null);
                  }}
                >
                  {g.label}
                </FilterChip>
              ))}
            </div>
            <div role="tablist" aria-label={tr("Slot")} className="flex flex-wrap gap-1">
              {groupSlots.map((d) => {
                const worn = look[d.id];
                const newHere = ownedWear(s, d.id).some((w) => !s.wardrobe.seen[w.id]);
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="tab"
                    aria-selected={slot === d.id}
                    data-slot={d.id}
                    onClick={() => {
                      setSlot(d.id);
                      setHover(null);
                      setFocusItem(null);
                      setNotice(null);
                    }}
                    className={`flex min-w-[88px] flex-col rounded-sm border px-2 py-1 text-left text-[10px] ${FOCUS_RING} ${
                      slot === d.id
                        ? "border-[#E91E8C] bg-[#E91E8C]/10 text-[#ffd0ea]"
                        : "border-[#33FF33]/20 text-[#33FF33]/70 hover:border-[#33FF33]/50"
                    }`}
                  >
                    <span className="tracking-wider uppercase">
                      {d.label} {d.wardrobeOnly && !atWardrobe ? "🔒" : ""}
                      {newHere && <span className="ml-1 text-[#E91E8C]">●</span>}
                    </span>
                    <span className="truncate text-white/55 normal-case">
                      {worn ? (WEAR_BY_ID.get(worn.item)?.name ?? "?") : tr("— nothing —")}
                    </span>
                  </button>
                );
              })}
            </div>

            {lockedHere && (
              <p className="rounded-sm border border-[#FFB800]/40 bg-[#FFB800]/5 px-2 py-1 text-[11px] text-[#ffe6a8]">
                {tr("Clothes, shoes and hair are changed at the wardrobe in Jade's quarters.")}
              </p>
            )}

            <div
              role="group"
              aria-label={tr("Pieces for {slot}", { slot: slotDef.label })}
              className="flex flex-wrap gap-1.5"
              onKeyDown={gridKeyNav}
              onMouseLeave={() => setHover(null)}
            >
              {slotDef.optional && (
                <button
                  type="button"
                  data-nav=""
                  data-piece="none"
                  aria-pressed={current === null}
                  onClick={() => put(null)}
                  onFocus={() => peek(null)}
                  onMouseEnter={() => peek(null)}
                  className={`flex w-[72px] flex-col items-center rounded-sm border p-1 text-[9px] ${FOCUS_RING} ${
                    current === null
                      ? "border-[#E91E8C] bg-[#E91E8C]/10"
                      : "border-[#33FF33]/20 hover:border-[#33FF33]/60"
                  } ${lockedHere ? "opacity-60" : ""}`}
                >
                  <span className="flex h-[44px] w-[44px] items-center justify-center text-lg text-white/40">
                    ∅
                  </span>
                  <span className="text-white/70">{tr("wear::Take off")}</span>
                </button>
              )}
              {pieces.map((w) => {
                const worn = current?.item === w.id;
                const cw = worn ? current!.colorway : w.colorways[0]!.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    data-nav=""
                    data-piece={w.id}
                    aria-pressed={worn}
                    aria-label={worn ? tr("{name} (worn)", { name: w.name }) : w.name}
                    title={w.blurb}
                    onClick={() => put(w.id, worn ? current!.colorway : undefined)}
                    onFocus={() => peek(w.id, cw)}
                    onMouseEnter={() => peek(w.id, cw)}
                    className={`relative flex w-[72px] flex-col items-center rounded-sm border p-1 text-[9px] ${FOCUS_RING} ${
                      worn
                        ? "border-[#E91E8C] bg-[#E91E8C]/10"
                        : "border-[#33FF33]/20 hover:border-[#33FF33]/60"
                    } ${lockedHere && !worn ? "opacity-60" : ""}`}
                  >
                    <WearIcon item={w.id} colorway={cw} size={44} />
                    <span className="mt-0.5 w-full truncate text-center text-[#d8ffd8]/80">
                      {w.name}
                    </span>
                    {worn && (
                      <span className="absolute top-0.5 right-1 text-[10px] text-[#E91E8C]">✓</span>
                    )}
                    {!s.wardrobe.seen[w.id] && (
                      <NewBadge className="absolute top-0.5 left-0.5 bg-black/70" />
                    )}
                  </button>
                );
              })}
            </div>

            {notice && (
              <p role="status" className="text-[11px] text-[#FFB800]">
                {notice}
              </p>
            )}

            {detail && (
              <div
                className="rounded-sm border border-[#E91E8C]/25 p-2 text-xs"
                data-detail={detail.id}
              >
                <p className="text-[#ffd0ea]">{detail.name}</p>
                <p className="mt-0.5 text-[11px] text-white/60">{detail.blurb}</p>
                <p className="mt-0.5 text-[10px] text-white/40">{howToGet(s, detail)}</p>
                {s.wardrobe.owned[detail.id] && detail.colorways.length > 1 && (
                  <>
                    <SectionTitle accent={UI.magenta} className="mt-2">
                      {tr("Colours")}
                    </SectionTitle>
                    <div className="flex flex-wrap gap-1.5" onKeyDown={gridKeyNav}>
                      {detail.colorways.map((c) => {
                        const ok = colorwayAvailable(s, detail.id, c.id);
                        const on = current?.item === detail.id && current.colorway === c.id;
                        const cost = c.dye
                          ? Object.entries(c.dye)
                              .map(([id, n]) => `${n}× ${ITEM_BY_ID.get(id)?.name ?? id}`)
                              .join(", ")
                          : "";
                        return (
                          <button
                            key={c.id}
                            type="button"
                            data-nav=""
                            data-colorway={c.id}
                            aria-pressed={on}
                            aria-label={
                              ok
                                ? c.label
                                : tr("{colour} — dye at the replicator", { colour: c.label })
                            }
                            title={
                              ok ? c.label : tr("Dye at the replicator first ({cost}).", { cost })
                            }
                            onMouseEnter={() =>
                              setHover(withPiece(look, detail.slot, detail.id, c.id))
                            }
                            onFocus={() => setHover(withPiece(look, detail.slot, detail.id, c.id))}
                            onClick={() => {
                              if (detail.slot !== slot) return;
                              put(detail.id, c.id);
                            }}
                            className={`flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] ${FOCUS_RING} ${
                              on
                                ? "border-[#E91E8C] text-[#ffd0ea]"
                                : "border-white/15 text-white/70 hover:border-white/40"
                            } ${ok ? "" : "opacity-60"}`}
                          >
                            <span
                              aria-hidden
                              className="h-3 w-3 rounded-full border border-white/30"
                              style={{ background: colorHex(c.tones.main) }}
                            />
                            {c.label}
                            {!ok && <span className="text-[#FFB800]">🔒</span>}
                          </button>
                        );
                      })}
                    </div>
                    {detail.colorways.some(
                      (c) => c.dye && !colorwayAvailable(s, detail.id, c.id),
                    ) && (
                      <p className="mt-1 text-[10px] text-white/40">
                        {tr("Locked colours are dyed once at the replicator, then free.")}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "outfits" && (
        <OutfitsView api={api} atWardrobe={atWardrobe} turn={turn} onTurn={setTurn} />
      )}

      {tab === "collection" && <CollectionView s={s} />}

      {tab === "replicator" && (
        <ReplicatorView
          api={api}
          present={atReplicator}
          intro={intro}
          onIntroDone={() => setIntro(false)}
        />
      )}
    </Panel>
  );
}

/** Four named outfit slots: save the current look, apply, rename, clear. */
function OutfitsView({
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
  const [names, setNames] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const presets = s.wardrobe.presets;
  const empty = useMemo(() => presets.map((p) => p === null), [presets]);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-white/55">
        {atWardrobe
          ? tr("Save the current look into a slot, or put a saved outfit on.")
          : tr("Away from the wardrobe an outfit only changes gadgets and accessories.")}
      </p>
      {msg && (
        <p role="status" className="text-[11px] text-[#FFB800]">
          {msg}
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2" aria-label={tr("Outfits")}>
        {presets.map((p, i) => {
          const name = names[i] ?? p?.name ?? "";
          return (
            <li
              key={i}
              data-preset={i}
              className="flex gap-2 rounded-sm border border-[#E91E8C]/25 p-2"
            >
              {p ? (
                <JadePreview look={p.look} turn={turn} onTurn={onTurn} size={96} compact />
              ) : (
                <div className="flex h-[96px] w-[96px] items-center justify-center rounded-sm border border-dashed border-white/15 text-[10px] text-white/30">
                  {tr("empty")}
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <input
                  type="text"
                  value={name}
                  maxLength={24}
                  placeholder={tr("Outfit {n}", { n: i + 1 })}
                  aria-label={tr("Name of outfit {n}", { n: i + 1 })}
                  className={INPUT_CLASS}
                  onChange={(e) => setNames({ ...names, [i]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key !== "Escape") e.stopPropagation();
                  }}
                  onBlur={() => {
                    if (p && names[i] !== undefined)
                      api.act((st) => renamePreset(st, i, names[i]!));
                  }}
                />
                <div className="flex flex-wrap gap-1">
                  <CrtButton
                    tone="green"
                    onClick={() => {
                      api.act((st) => savePreset(st, i, names[i] ?? p?.name ?? ""));
                      api.sound?.("ui_click");
                      setMsg(tr("Outfit saved."));
                    }}
                  >
                    {empty[i] ? tr("Save look") : tr("Overwrite")}
                  </CrtButton>
                  <CrtButton
                    tone="cyan"
                    disabled={!p}
                    onClick={() => {
                      const changed = api.act((st) => applyPreset(st, i, atWardrobe));
                      api.sound?.(changed.length ? "ui_click" : "fail_buzz");
                      const skipped =
                        !atWardrobe &&
                        p !== null &&
                        WEAR_SLOT_DEFS.some(
                          (d) =>
                            d.wardrobeOnly &&
                            (p.look[d.id]?.item !== s.wardrobe.look[d.id]?.item ||
                              p.look[d.id]?.colorway !== s.wardrobe.look[d.id]?.colorway),
                        );
                      setMsg(
                        skipped
                          ? tr("Gadgets and accessories changed. The clothes wait at the wardrobe.")
                          : changed.length
                            ? tr("Outfit on.")
                            : tr("Already wearing it."),
                      );
                    }}
                  >
                    {tr("Put on")}
                  </CrtButton>
                  <CrtButton
                    tone="red"
                    disabled={!p}
                    onClick={() => {
                      api.act((st) => clearPreset(st, i));
                      setNames({ ...names, [i]: "" });
                    }}
                  >
                    {tr("Clear")}
                  </CrtButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
