/**
 * Board lookups for the knowledge UI: which decor piece / room a memo board
 * place refers to. Placement ids carry their room (`decor:<room>:<slot>`), so
 * the room is cheap; the decor type needs the floor's interior (cached by
 * content/interior.ts, and already built by the engine in the game).
 */
import { tr } from "@/lib/i18n";
import { spotName } from "@/lib/world/archive";
import { interiorFor } from "@/lib/world/content/interior";
import { ROOM_BY_ID } from "@/lib/world/content/map";
import { PIN_DECOR, boardRoomId } from "@/lib/world/memos";
import type { MemoPlace } from "@/lib/world/types";

/** Decor type of a placement (`undefined` when unknown). */
export function placementDecor(placementId: string): string | undefined {
  const room = ROOM_BY_ID.get(boardRoomId(`decor:${placementId}`) ?? "");
  if (!room) return undefined;
  return interiorFor(room.floor).find((p) => p.id === placementId)?.decor;
}

/** The placement is a board memos can be pinned to. */
export function isPinBoard(placementId: string): boolean {
  const d = placementDecor(placementId);
  return d !== undefined && PIN_DECOR.has(d);
}

/** "Cork board · Kitchen" for a memo place; "In your head" / "On your computer" otherwise. */
export function placeLabel(place: MemoPlace): string {
  if (place === "mind") return tr("In your head");
  if (place === "pc") return tr("On your computer");
  const pl = place.slice("decor:".length);
  const room = ROOM_BY_ID.get(boardRoomId(place) ?? "")?.name ?? tr("somewhere in the lab");
  const decor = placementDecor(pl);
  return tr("{board} · {room}", {
    board: decor ? spotName(decor) : tr("Board"),
    room,
  });
}
