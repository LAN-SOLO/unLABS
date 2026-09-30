"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, Panel, SectionTitle, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { TIER_LABEL, visitSpot, type SpotView } from "@/lib/world/archive";
import type { ArchiveEntry, ArchiveSpot } from "@/lib/world/content/archive";
import { RememberButton } from "@/components/world/knowledge/Remember";
import { PinBoard } from "@/components/world/knowledge/PinBoard";
import { isPinBoard } from "@/components/world/knowledge/boards";

/** What an empty hiding place gives you (picked by spot, so it stays the same). */
const EMPTY: readonly string[] = [
  tr("Nothing. Dust, and a paper clip bent into a question mark."),
  tr("Empty. Someone was here before you — the dust has finger marks."),
  tr("Only cobwebs. The spider looks annoyed."),
  tr("A dead battery and a sweet wrapper. Not what you were after."),
  tr("Nothing useful. You put everything back exactly as it was."),
];

function emptyLine(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return EMPTY[h % EMPTY.length]!;
}

export function EntryCard({
  e,
  fresh,
  api,
}: {
  e: ArchiveEntry;
  fresh?: boolean;
  /** With the world api the card offers "Remember". */
  api?: WorldApi;
}) {
  return (
    <article
      className="rounded-sm border p-2 text-xs"
      style={{ borderColor: fresh ? `${UI.amber}88` : "#ffffff1a" }}
    >
      <SectionTitle
        accent={UI.amber}
        right={
          api ? (
            <RememberButton
              api={api}
              src={{
                kind: "archive",
                id: e.id,
                title: e.title,
                text: e.by ? `${e.text}\n— ${e.by}` : e.text,
                tags: [e.topic],
              }}
            />
          ) : undefined
        }
      >
        {e.title} <span className="text-white/30">· {TIER_LABEL[e.tier]}</span>
      </SectionTitle>
      <p className="whitespace-pre-line text-[#d8ffd8]/80">{e.text}</p>
      {e.by && <p className="mt-1 text-right text-[10px] text-white/40">— {e.by}</p>}
    </article>
  );
}

/**
 * Archive entries at a spot (visited on mount) and, for searchable furniture,
 * a "Search" action. Used inside the decor action panel and on its own.
 */
export function SpotEntries({
  api,
  spot,
  searchable,
  spotId,
}: {
  api: WorldApi;
  spot: ArchiveSpot;
  searchable: boolean;
  /** Stable key for the empty-search line. */
  spotId: string;
}) {
  const [view, setView] = useState<SpotView | null>(null);
  const [searched, setSearched] = useState<SpotView | null>(null);
  // Guard against the dev double-invoked effect (it would replace the view
  // and drop the "fresh" highlight).
  const visited = useRef(false);
  useEffect(() => {
    if (visited.current) return;
    visited.current = true;
    const v = api.act((st) => visitSpot(st, spot, "read"));
    for (const e of v.fresh) api.toast(tr("Archive — {title}", { title: e.title }), "insight");
    setView(v);
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const search = () => {
    const v = api.act((st) => visitSpot(st, spot, "search"));
    for (const e of v.fresh) api.toast(tr("Archive — {title}", { title: e.title }), "insight");
    api.sound?.(v.fresh.length ? "item_rare" : "ui_click");
    setSearched(v);
  };
  const shown = searched ?? view;
  const fresh = new Set([...(view?.fresh ?? []), ...(searched?.fresh ?? [])].map((e) => e.id));
  // Boards (cork boards, whiteboards, fridge magnets …) also hold Jade's memos.
  const board = "decor" in spot ? spot.decor : undefined;
  const pinBoard = useMemo(() => (board ? isPinBoard(board) : false), [board]);
  if (!shown) return null;
  return (
    <div className="space-y-2">
      {shown.entries.map((e) => (
        <EntryCard key={e.id} e={e} fresh={fresh.has(e.id)} api={api} />
      ))}
      {shown.hints.map((h) => (
        <p key={h} className="text-xs text-white/40 italic">
          {h}
        </p>
      ))}
      {searchable && !searched && (
        <CrtButton tone="amber" onClick={search}>
          {tr("Search")}
        </CrtButton>
      )}
      {searched && searched.fresh.length === 0 && searched.entries.length === 0 && (
        <p className="text-xs text-white/50">{emptyLine(spotId)}</p>
      )}
      {board && pinBoard && <PinBoard api={api} placementId={board} />}
    </div>
  );
}

/** Stand-alone panel for a spot without an action of its own (boards, lockers, vents …). */
export function SpotPanel({
  api,
  spot,
  title,
  searchable,
  spotId,
  onClose,
}: {
  api: WorldApi;
  spot: ArchiveSpot;
  title: string;
  searchable: boolean;
  spotId: string;
  onClose: () => void;
}) {
  return (
    <Panel title={title} onClose={onClose}>
      <SpotEntries api={api} spot={spot} searchable={searchable} spotId={spotId} />
    </Panel>
  );
}
