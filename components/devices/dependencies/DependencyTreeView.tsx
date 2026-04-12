"use client";

import { useDependencyTree } from "../hooks/useDependencyTree";
import { TreeBranch } from "./TreeBranch";
import { InvestmentSummary } from "./InvestmentSummary";
import type { Device } from "@/types/devices";

interface DependencyTreeViewProps {
  deviceId: string;
  onViewInverse?: () => void;
  onBack?: () => void;
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  const titleLen = title.length + 2;
  const lineLen = Math.max(68, titleLen + 10);
  const afterTitle = lineLen - titleLen - 2;
  return (
    <div className="font-mono text-[10px]">
      <div className="whitespace-pre text-green-500/30">
        {"┌─ "}
        <span className="text-green-500/60">{title}</span>
        {" " + "─".repeat(Math.max(0, afterTitle)) + "┐"}
      </div>
      <div className="border-r border-l border-green-500/15 px-2 py-1">{children}</div>
      <div className="whitespace-pre text-green-500/30">{"└" + "─".repeat(lineLen) + "┘"}</div>
    </div>
  );
}

function UnlockItem({ device }: { device: Device }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] leading-[18px]">
      <span className="text-green-500/30">▸</span>
      <span className="text-green-400">{device.device_id}</span>
      <span className="text-green-500/60">{device.name}</span>
      <span className="text-green-500/30">│</span>
      <span className="text-cyan-400/60">{device.tech_tree}</span>
      <span className="text-green-500/30">│</span>
      <span className="text-green-500/60">T{device.tier}</span>
    </div>
  );
}

export function DependencyTreeView({ deviceId, onViewInverse, onBack }: DependencyTreeViewProps) {
  const { device, prerequisiteTree, unlockDevices, investment, loading, error } = useDependencyTree(
    { deviceId },
  );

  if (loading) {
    return (
      <div className="py-4 font-mono text-[10px] text-green-500/40">
        <span className="animate-pulse">RESOLVING DEPENDENCY TREE...</span>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="py-4 font-mono text-[10px] text-red-500">
        ERR: {error ?? "DEVICE NOT FOUND"}
      </div>
    );
  }

  const hasDeps = prerequisiteTree && prerequisiteTree.children.length > 0;
  const hasUnlocks = unlockDevices.length > 0;

  return (
    <div className="space-y-2">
      {/* Prerequisites */}
      <SectionBox title={`${device.tech_tree} ─ PREREQUISITES`}>
        {hasDeps ? (
          <div className="py-1">
            <TreeBranch node={prerequisiteTree} targetDeviceId={deviceId} />
          </div>
        ) : (
          <div className="py-2 text-green-500/40">NO PREREQUISITES ─ BASE TIER DEVICE</div>
        )}
      </SectionBox>

      {/* Cross-tree requirements */}
      {hasDeps && prerequisiteTree.children.some((c) => c.is_cross_tree) && (
        <SectionBox title="CROSS-TREE REQUIREMENTS">
          <div className="space-y-0.5 py-1">
            {prerequisiteTree.children
              .filter((c) => c.is_cross_tree)
              .map((c) => (
                <div key={c.device_id} className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="text-violet-400">⬡</span>
                  <span className="text-violet-400/80">{c.tech_tree}</span>
                  <span className="text-green-500/30">│</span>
                  <span className="text-green-500/60">
                    T{c.tier}: {c.name}
                  </span>
                  <span className="text-green-500/30">│</span>
                  <span
                    className={
                      c.status === "complete"
                        ? "text-green-400"
                        : c.status === "researching"
                          ? "animate-pulse text-cyan-400"
                          : "text-green-500/30"
                    }
                  >
                    {c.status === "complete" ? "✓" : c.status === "researching" ? "→" : "●"}{" "}
                    {c.status.toUpperCase()}
                  </span>
                </div>
              ))}
          </div>
        </SectionBox>
      )}

      {/* What this device unlocks */}
      <SectionBox title="UNLOCKS">
        {hasUnlocks ? (
          <div className="space-y-0.5 py-1">
            {unlockDevices.map((d) => (
              <UnlockItem key={d.device_id} device={d} />
            ))}
          </div>
        ) : (
          <div className="py-2 text-green-500/40">NO DOWNSTREAM UNLOCKS FOUND</div>
        )}
      </SectionBox>

      {/* Investment Summary */}
      <InvestmentSummary investment={investment} />

      {/* Legend */}
      <div className="flex gap-4 font-mono text-[9px] text-green-500/30">
        <span>
          <span className="text-green-400">✓</span> Complete
        </span>
        <span>
          <span className="text-amber-400">○</span> Available
        </span>
        <span>
          <span className="text-green-500/30">●</span> Locked
        </span>
        <span>
          <span className="text-cyan-400">→</span> Researching
        </span>
        {onViewInverse && (
          <>
            <span className="text-green-500/20">│</span>
            <button
              onClick={onViewInverse}
              className="cursor-pointer text-green-500/50 hover:text-green-400"
            >
              [V] VIEW INVERSE
            </button>
          </>
        )}
      </div>
    </div>
  );
}
