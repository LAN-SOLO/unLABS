/**
 * The lab archive (all entries). Rules: ./types.ts, lib/world/archive.ts.
 */
import { ARCHIVE_COMBOS } from "@/lib/world/content/archive/combos";
import { ARCHIVE_SYSTEMS } from "@/lib/world/content/archive/systems";
import { ARCHIVE_FLOOR_0 } from "@/lib/world/content/archive/floor0";
import { ARCHIVE_FLOOR_1 } from "@/lib/world/content/archive/floor1";
import { ARCHIVE_FLOOR_2 } from "@/lib/world/content/archive/floor2";
import { ARCHIVE_FLOOR_3 } from "@/lib/world/content/archive/floor3";
import { ARCHIVE_FLOOR_4 } from "@/lib/world/content/archive/floor4";
import { ARCHIVE_FLOOR_5 } from "@/lib/world/content/archive/floor5";
import type { ArchiveEntry } from "@/lib/world/content/archive/types";

export * from "@/lib/world/content/archive/types";

export const ARCHIVE: readonly ArchiveEntry[] = [
  ...ARCHIVE_FLOOR_0,
  ...ARCHIVE_FLOOR_1,
  ...ARCHIVE_FLOOR_2,
  ...ARCHIVE_FLOOR_3,
  ...ARCHIVE_FLOOR_4,
  ...ARCHIVE_FLOOR_5,
  ...ARCHIVE_SYSTEMS,
  ...ARCHIVE_COMBOS,
];

export const ARCHIVE_BY_ID: ReadonlyMap<string, ArchiveEntry> = new Map(
  ARCHIVE.map((e) => [e.id, e]),
);
