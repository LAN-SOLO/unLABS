/**
 * Root lab access rings (docs/ROOT-LAB.md § Rings): what Jade has to
 * bring online before the MCP hands her the next ring. Credentials stay
 * once granted (`su` only ever climbs one ring at a time; `su operator`
 * drops back down).
 *
 *   0 operator  every terminal, read-only views of the system
 *   1 wheel     sudo, cron, research/drone/aging tunables
 *   2 root      firmware tuning (clock/voltage), power tunables, profiles
 *   3 kernel    the wide ranges: overdrive, deep undervolt, kernel limits
 */
import { tr } from "@/lib/i18n";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { isOnline } from "@/lib/world/game";
import type { Ring } from "@/lib/world/root/state";
import type { WorldState } from "@/lib/world/types";

/** Room terminals Jade must have logged into before wheel. */
export const WHEEL_TERMINALS = 2;

interface RingNeed {
  /** Devices that must be online. */
  online: readonly string[];
  /** Why the MCP grants it (shown on success). */
  granted: () => string;
}

export const RING_NEEDS: Readonly<Record<1 | 2 | 3, RingNeed>> = {
  1: {
    online: ["DGN-001"],
    granted: () =>
      tr(
        "MCP> Diagnostics confirm you are not a fault. I am adding jade to wheel. Do not make me regret it.",
      ),
  },
  2: {
    online: ["CPU-001", "MEM-001", "TMP-001"],
    granted: () =>
      tr("MCP> You can see clock, memory and heat now. Then you may touch them. Root granted."),
  },
  3: {
    online: ["SCA-001"],
    granted: () =>
      tr(
        "MCP> The Supercomputer Array has compiled you a kernel. Ring 0. There is no one above you now, Dr. Lawrence. Not even me.",
      ),
  },
};

/** Room terminals used so far (flags `terminal_<id>_used`). */
export function terminalsUsed(s: WorldState): number {
  return Object.keys(s.flags).filter((f) => s.flags[f] && /^terminal_term_.+_used$/.test(f)).length;
}

/** What is still missing for `ring` (empty = may be granted). */
export function ringMissing(s: WorldState, ring: 1 | 2 | 3): string[] {
  const miss: string[] = [];
  if (s.root.ring < ring - 1) miss.push(tr("ring {n} first", { n: ring - 1 }));
  if (ring === 1 && terminalsUsed(s) < WHEEL_TERMINALS)
    miss.push(
      tr("log into {n} room terminals ({have} so far)", {
        n: WHEEL_TERMINALS,
        have: terminalsUsed(s),
      }),
    );
  for (const id of RING_NEEDS[ring].online)
    if (!isOnline(s, id))
      miss.push(tr("{name} ({id}) online", { name: DEVICE_BY_ID.get(id)?.name ?? id, id }));
  return miss;
}

/** Prompt user and sigil for a ring. */
export function promptFor(ring: Ring, room: string): string {
  if (ring >= 3) return `kernel@${room}:~#`;
  if (ring >= 2) return `root@${room}:~#`;
  return `jade@${room}:~$`;
}
