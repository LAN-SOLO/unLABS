"use client";

/**
 * DiscoveryLog
 * ============
 *
 * Journal-style panel showing discovered resonance protocols and
 * classified (undiscovered) entries. Accessible via the panel or
 * terminal command.
 */

import { useResonance } from "@/contexts/ResonanceProvider";
import { RARITY_COLORS, RARITY_LABELS, type ResonanceProtocol } from "@/lib/game/resonance/types";

export function DiscoveryLog() {
  const { allProtocols, discoveries } = useResonance();
  const discoveredSet = new Set(discoveries);

  // Sort: discovered first (by discovery order), then undiscovered by rarity
  const sorted = [...allProtocols].sort((a, b) => {
    const aDiscovered = discoveredSet.has(a.id);
    const bDiscovered = discoveredSet.has(b.id);
    if (aDiscovered && !bDiscovered) return -1;
    if (!aDiscovered && bDiscovered) return 1;
    return 0;
  });

  return (
    <div className="space-y-2 border border-green-500/30 bg-black/80 p-2 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green-500/20 pb-1">
        <span className="text-[10px] tracking-wider text-green-400 uppercase">
          Resonance Discovery Log
        </span>
        <span className="text-[8px] text-green-500/50">
          {discoveries.length}/{allProtocols.length} discovered
        </span>
      </div>

      {/* Entries */}
      <div className="scrollbar-thin scrollbar-thumb-green-500/20 max-h-[400px] space-y-1.5 overflow-y-auto">
        {sorted.map((protocol) => {
          const isDiscovered = discoveredSet.has(protocol.id);
          return (
            <DiscoveryEntry key={protocol.id} protocol={protocol} isDiscovered={isDiscovered} />
          );
        })}
      </div>

      {discoveries.length === 0 && (
        <div className="py-4 text-center text-[9px] text-gray-500">
          No resonance protocols discovered yet.
          <br />
          <span className="text-teal-400/40 italic">
            &quot;the lab holds secrets for those who listen&quot; — jade
          </span>
        </div>
      )}
    </div>
  );
}

function DiscoveryEntry({
  protocol,
  isDiscovered,
}: {
  protocol: ResonanceProtocol;
  isDiscovered: boolean;
}) {
  const rarityColor = RARITY_COLORS[protocol.rarity];
  const rarityLabel = RARITY_LABELS[protocol.rarity];

  if (!isDiscovered) {
    return (
      <div className="rounded border border-gray-700/30 bg-black/40 px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-600">[CLASSIFIED]</span>
          <span className={`text-[8px] ${rarityColor} tracking-wider uppercase`}>
            {rarityLabel}
          </span>
        </div>
        {protocol.loreClue && (
          <div className="mt-0.5 text-[8px] text-gray-600 italic">
            &quot;{protocol.loreClue}&quot;
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded border border-green-500/20 bg-green-500/5 px-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-green-300">{protocol.codename}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[8px] ${rarityColor} tracking-wider uppercase`}>
            {rarityLabel}
          </span>
          <span className="text-[8px] text-green-500/40">{protocol.id}</span>
        </div>
      </div>
      <div className="mt-0.5 text-[9px] text-gray-400">{protocol.description}</div>
      <div className="mt-0.5 text-[8px] text-teal-400/50 italic">
        &quot;{protocol.loreClue}&quot;
      </div>
    </div>
  );
}
