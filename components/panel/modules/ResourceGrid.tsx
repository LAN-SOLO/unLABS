"use client";

import { useEffect, useState } from "react";
import { PanelFrame } from "../PanelFrame";
import { useResourceManagerOptional } from "@/contexts/ResourceManager";
import { RESOURCE_CONTAINERS, TIER_LABELS, type ContainerState } from "@/types/resources";

export function ResourceGrid({ className }: { className?: string }) {
  const rm = useResourceManagerOptional();
  const [, setTick] = useState(0);

  // Re-render every 3s to reflect tick updates
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  if (!rm) return null;

  // Group containers by tier, only show tiers that have at least one unlocked container
  const tiers = new Map<
    number,
    { def: (typeof RESOURCE_CONTAINERS)[number]; state: ContainerState }[]
  >();

  for (const def of RESOURCE_CONTAINERS) {
    const cs = rm.getContainer(def.id);
    if (!cs) continue;
    if (!tiers.has(def.tier)) tiers.set(def.tier, []);
    tiers.get(def.tier)!.push({ def, state: cs });
  }

  const sortedTiers = [...tiers.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <PanelFrame variant="default" className={`p-1.5 ${className ?? ""}`}>
      <div className="mb-1 font-mono text-[7px] tracking-wider text-white/40">
        RESOURCE CONTAINERS
      </div>
      <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 max-h-[200px] overflow-y-auto">
        {sortedTiers.map(([tier, entries]) => {
          const hasUnlocked = entries.some((e) => e.state.isUnlocked);
          if (!hasUnlocked) return null;

          return (
            <div key={tier} className="mb-1">
              {/* Tier header */}
              <div className="mb-0.5 flex items-center gap-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className="px-1 font-mono text-[6px] text-white/30">
                  T{tier} · {TIER_LABELS[tier] ?? "???"}
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Container rows */}
              {entries.map(({ def, state }) => (
                <ContainerRow key={def.id} def={def} state={state} />
              ))}
            </div>
          );
        })}
      </div>
    </PanelFrame>
  );
}

function ContainerRow({
  def,
  state,
}: {
  def: (typeof RESOURCE_CONTAINERS)[number];
  state: ContainerState;
}) {
  const fillPercent = state.capacity > 0 ? (state.amount / state.capacity) * 100 : 0;
  const isLocked = !state.isUnlocked;

  if (isLocked) {
    return (
      <div className="flex h-5 items-center gap-1 px-1 opacity-30">
        <span className="text-[8px]" style={{ color: def.color }}>
          ○
        </span>
        <span className="w-[42px] shrink-0 font-mono text-[7px] text-white/40">{def.id}</span>
        <span className="flex-1 truncate font-mono text-[7px] text-white/30">{def.name}</span>
        <span className="font-mono text-[6px] text-white/20">── LOCKED</span>
      </div>
    );
  }

  return (
    <div className="flex h-5 items-center gap-1 px-1">
      {/* Status dot */}
      <span
        className="text-[8px] leading-none"
        style={{ color: def.color, filter: `drop-shadow(0 0 2px ${def.color})` }}
      >
        ●
      </span>

      {/* Container ID */}
      <span className="w-[42px] shrink-0 font-mono text-[7px] text-white/35">{def.id}</span>

      {/* Name */}
      <span className="w-[90px] shrink-0 truncate font-mono text-[7px] text-white/70">
        {def.name}
      </span>

      {/* Progress bar */}
      <div className="h-[5px] w-[48px] shrink-0 overflow-hidden rounded-sm bg-black/50">
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{
            width: `${fillPercent}%`,
            background: def.color,
            boxShadow: `0 0 3px ${def.color}`,
          }}
        />
      </div>

      {/* Amount/Capacity */}
      <span className="w-[58px] shrink-0 text-right font-mono text-[7px] text-white/60">
        {formatAmount(state.amount)}/{formatAmount(state.capacity)}
      </span>

      {/* Flow rate */}
      {state.flowRate > 0 && (
        <span className="w-[32px] shrink-0 text-right font-mono text-[6px] text-white/30">
          +{state.flowRate.toFixed(1)}/s
        </span>
      )}
    </div>
  );
}

function formatAmount(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return Math.floor(n).toString();
}
