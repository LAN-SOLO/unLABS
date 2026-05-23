"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { PanelFrame } from "../PanelFrame";
import { LED } from "../controls/LED";
import { useNexusOptional, NXS_FIRMWARE } from "@/contexts/NexusManager";
import { useTechTreeOptional } from "@/contexts/TechTreeProvider";
import { useGameTick } from "@/contexts/GameTickProvider";
import { getTechNode, type TechNodeWithStatus } from "@/lib/game/techTree";

function fmtRemaining(sec: number): string {
  if (sec <= 0) return "READY";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

// ── SVG coordinates for the 6 MVP tech nodes ───────────────────────────
const GRAPH_LAYOUT: Record<string, { x: number; y: number }> = {
  "refine.alloy_efficiency.t1": { x: 25, y: 48 },
  "refine.power_condense.t2": { x: 25, y: 30 },
  "refine.nanomaterial_catalyst.t3": { x: 25, y: 12 },
  "tools.seep_tap.t1": { x: 75, y: 48 },
  "tools.explorer_drone.t2": { x: 75, y: 30 },
  "tools.drone_swarm.t3": { x: 75, y: 12 },
};

const GRAPH_EDGES: Array<[string, string]> = [
  ["refine.alloy_efficiency.t1", "refine.power_condense.t2"],
  ["refine.power_condense.t2", "refine.nanomaterial_catalyst.t3"],
  ["tools.seep_tap.t1", "tools.explorer_drone.t2"],
  ["tools.explorer_drone.t2", "tools.drone_swarm.t3"],
  ["refine.alloy_efficiency.t1", "tools.explorer_drone.t2"],
];

// ── Power button ────────────────────────────────────────────────────────
function NxsPowerButton({ isPowered, onToggle }: { isPowered: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center rounded-full transition-all"
      style={{
        width: "14px",
        height: "14px",
        background: isPowered ? "rgba(0,255,102,0.15)" : "#1a1a2a",
        border: `1px solid ${isPowered ? "var(--neon-green)" : "#333"}`,
        color: isPowered ? "var(--neon-green)" : "#555",
        boxShadow: isPowered ? "0 0 4px var(--neon-green)" : "none",
        cursor: "pointer",
        fontSize: "7px",
        lineHeight: 1,
      }}
      title={isPowered ? "Power OFF" : "Power ON"}
    >
      ⏻
    </button>
  );
}

// ── Mini tech-graph SVG ─────────────────────────────────────────────────
function TechGraph({ nodes, isOnline }: { nodes: TechNodeWithStatus[]; isOnline: boolean }) {
  const nodeMap = useMemo(() => {
    const m = new Map<string, TechNodeWithStatus>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const edgeUnlocked = useCallback(
    (from: string, to: string) => {
      const f = nodeMap.get(from);
      const t = nodeMap.get(to);
      return f?.status === "unlocked" && (t?.status === "unlocked" || t?.status === "in_progress");
    },
    [nodeMap],
  );

  const nodeColor = useCallback((s: TechNodeWithStatus["status"]) => {
    switch (s) {
      case "unlocked":
        return "var(--neon-green)";
      case "in_progress":
        return "var(--neon-cyan)";
      case "available":
        return "var(--neon-amber)";
      default:
        return "#334455";
    }
  }, []);

  return (
    <div
      className={cn("relative h-14 w-full overflow-hidden", !isOnline && "opacity-30")}
      style={{ animation: isOnline ? "nexus-flicker 3s steps(1) infinite" : "none" }}
    >
      <svg viewBox="0 0 100 60" className="h-full w-full">
        <defs>
          <filter id="nxs-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="nxs-scanlines" patternUnits="userSpaceOnUse" width="100" height="4">
            <rect width="100" height="2" fill="rgba(0,255,102,0.04)" />
          </pattern>
          <linearGradient id="nxs-sweep-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,255,255,0)" />
            <stop offset="50%" stopColor="rgba(0,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(0,255,255,0)" />
          </linearGradient>
        </defs>

        {/* prerequisite edges */}
        {GRAPH_EDGES.map(([from, to]) => {
          const a = GRAPH_LAYOUT[from];
          const b = GRAPH_LAYOUT[to];
          if (!a || !b) return null;
          const lit = edgeUnlocked(from, to);
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--neon-green)"
              strokeWidth={lit ? "0.6" : "0.4"}
              strokeOpacity={lit ? 0.5 : 0.12}
              strokeDasharray={lit ? "none" : "2 1.5"}
            />
          );
        })}

        {/* tech nodes */}
        {nodes.map((n) => {
          const pos = GRAPH_LAYOUT[n.id];
          if (!pos) return null;
          const c = nodeColor(n.status);
          const r = n.status === "locked" ? 2 : n.status === "available" ? 2.5 : 3;
          return (
            <g key={n.id}>
              {n.status === "unlocked" && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  fill={c}
                  filter="url(#nxs-glow)"
                  opacity={0.5}
                />
              )}
              <circle cx={pos.x} cy={pos.y} r={r} fill={c} opacity={0.9} />
              {n.status === "in_progress" && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={3}
                  fill="none"
                  stroke="var(--neon-cyan)"
                  strokeWidth="0.6"
                  opacity={0.6}
                  style={{ animation: "nexus-research-pulse 1.5s ease-in-out infinite" }}
                />
              )}
              {/* tree label under T1 nodes */}
              {n.tier === 1 && (
                <text
                  x={pos.x}
                  y={pos.y + 6}
                  textAnchor="middle"
                  fill="var(--neon-green)"
                  fontSize="3.5"
                  opacity={0.3}
                  fontFamily="monospace"
                >
                  {n.tree === "refine" ? "RFN" : "TLS"}
                </text>
              )}
            </g>
          );
        })}

        {/* holo sweep */}
        {isOnline && (
          <rect
            x={-4}
            y={0}
            width={4}
            height={60}
            fill="url(#nxs-sweep-grad)"
            style={{ animation: "nexus-sweep 4s linear infinite" }}
          />
        )}

        {/* CRT scanline pattern */}
        <rect x={0} y={0} width={100} height={60} fill="url(#nxs-scanlines)" />
      </svg>

      {/* center label */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-green-500/50">
        {isOnline ? "awaiting research" : "standby"}
      </div>
    </div>
  );
}

// ── Main module ─────────────────────────────────────────────────────────
export function NexusModule() {
  const nexus = useNexusOptional();
  const tree = useTechTreeOptional();
  const { tickCount: _tickCount, lastTickAt } = useGameTick();
  void _tickCount;

  const activeJob = tree?.activeJob ?? null;
  const node = useMemo(() => (activeJob ? getTechNode(activeJob.nodeId) : null), [activeJob]);

  const [showFoldedInfo, setShowFoldedInfo] = useState(false);
  const foldedInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleFoldedInfo = useCallback(() => {
    setShowFoldedInfo((prev) => {
      const next = !prev;
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current);
      if (next) {
        foldedInfoTimer.current = setTimeout(() => setShowFoldedInfo(false), 5 * 60 * 1000);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (foldedInfoTimer.current) clearTimeout(foldedInfoTimer.current);
    };
  }, []);

  if (!nexus || !tree) return null;
  if (!nexus.isBuilt) return null;

  const isExpanded = nexus.isExpanded;
  const isOnline = nexus.isOnline;

  const now = lastTickAt > 0 ? lastTickAt : (activeJob?.startedAt ?? 0);
  const remaining = activeJob ? Math.max(0, Math.ceil((activeJob.completesAt - now) / 1000)) : 0;
  const pct =
    activeJob && node
      ? Math.min(
          100,
          Math.max(0, Math.floor(((now - activeJob.startedAt) / (node.durationSec * 1000)) * 100)),
        )
      : 0;

  const stateLabel = !isOnline
    ? "STANDBY"
    : activeJob
      ? remaining === 0
        ? "READY"
        : "RESEARCHING"
      : "IDLE";

  const ledColor: "green" | "cyan" | "amber" | "red" =
    stateLabel === "READY"
      ? "amber"
      : stateLabel === "RESEARCHING"
        ? "cyan"
        : stateLabel === "STANDBY"
          ? "red"
          : "green";

  const stateLedCss =
    stateLabel === "READY"
      ? "var(--neon-amber)"
      : stateLabel === "RESEARCHING"
        ? "var(--neon-cyan)"
        : stateLabel === "STANDBY"
          ? "#555"
          : "var(--neon-green)";

  const unlocked = tree.treeState.unlocked.length;
  const total = tree.nodes.length;

  return (
    <PanelFrame
      variant="default"
      className={cn("relative overflow-hidden")}
      style={{ perspective: "600px" }}
    >
      {/* ═══════════ FOLDED FRONT PANEL ═══════════ */}
      <div
        style={{
          transform: isExpanded ? "rotateX(-90deg)" : "rotateX(0deg)",
          transformOrigin: "top center",
          transition: "transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease",
          opacity: isExpanded ? 0 : 1,
          position: isExpanded ? "absolute" : "relative",
          pointerEvents: isExpanded ? "none" : "auto",
          zIndex: isExpanded ? 0 : 2,
          width: "100%",
          left: 0,
          top: 0,
        }}
      >
        <div className="flex items-center gap-1 px-1.5 py-1">
          <div
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              backgroundColor: stateLedCss,
              boxShadow: stateLabel !== "STANDBY" ? `0 0 4px ${stateLedCss}` : "none",
            }}
          />
          <span
            className="shrink-0 font-mono text-[7px] font-bold"
            style={{ color: "var(--neon-green)" }}
          >
            NXS-01
          </span>
          <span className="shrink-0 font-mono text-[6px]" style={{ color: stateLedCss }}>
            {stateLabel}
          </span>
          <div className="flex-1" />
          <NxsPowerButton
            isPowered={isOnline}
            onToggle={() => (isOnline ? nexus.powerOff() : nexus.powerOn())}
          />
          <button
            onClick={toggleFoldedInfo}
            className="font-mono transition-all"
            style={{
              fontSize: "8px",
              lineHeight: 1,
              padding: "1px 2px",
              color: showFoldedInfo ? "var(--neon-green)" : "#556",
              cursor: "pointer",
              background: "none",
              border: "none",
            }}
            title={showFoldedInfo ? "Hide info" : "Show info"}
          >
            {showFoldedInfo ? "▲" : "▼"}
          </button>
          <button
            onClick={() => nexus.toggleExpanded()}
            className="font-mono transition-all"
            style={{
              fontSize: "8px",
              lineHeight: 1,
              padding: "1px 2px",
              color: "#556",
              cursor: "pointer",
              background: "none",
              border: "none",
            }}
            title="Unfold panel"
          >
            ▾
          </button>
        </div>

        {/* Folded info expansion */}
        <div
          style={{
            maxHeight: showFoldedInfo ? "40px" : "0px",
            overflow: "hidden",
            transition: "max-height 300ms ease",
          }}
        >
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 px-2 pb-1.5">
            {[
              { label: "Nodes", value: `${unlocked}/${total}` },
              { label: "Job", value: node?.title ?? "---" },
              { label: "Tier", value: "T2" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="font-mono text-[5px] text-white/30">{label}</span>
                <span className="font-mono text-[6px]" style={{ color: "var(--neon-green)" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ UNFOLDED INNER PANEL ═══════════ */}
      <div
        style={{
          transform: isExpanded ? "translateZ(0) rotateX(0deg)" : "translateZ(-20px) rotateX(8deg)",
          transformOrigin: "top center",
          transition: "transform 600ms cubic-bezier(0.25,0.1,0.25,1), opacity 500ms ease",
          opacity: isExpanded ? 1 : 0,
          position: isExpanded ? "relative" : "absolute",
          pointerEvents: isExpanded ? "auto" : "none",
          zIndex: isExpanded ? 2 : 0,
          width: "100%",
          left: 0,
          top: 0,
        }}
      >
        {/* Fold chevron */}
        <button
          onClick={() => nexus.toggleExpanded()}
          className="absolute top-0.5 right-0.5 z-20 font-mono transition-all"
          style={{
            fontSize: "7px",
            lineHeight: 1,
            padding: "1px 2px",
            color: "#445",
            cursor: "pointer",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid #222",
            borderRadius: "2px",
          }}
          title="Fold panel"
        >
          ▴
        </button>

        <div className={cn("flex min-h-0 flex-1 flex-col", !isOnline && "opacity-60")}>
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-green-500/20 px-1.5 py-1">
            <div className="flex items-center gap-1">
              <LED on={isOnline} color={ledColor} size="sm" />
              <LED
                on={stateLabel === "RESEARCHING"}
                color="cyan"
                size="sm"
                blink={stateLabel === "RESEARCHING"}
              />
              <span
                className="font-mono text-[7px] font-bold"
                style={{ color: "var(--neon-green)" }}
              >
                NXS-01
              </span>
              <NxsPowerButton
                isPowered={isOnline}
                onToggle={() => (isOnline ? nexus.powerOff() : nexus.powerOn())}
              />
              <span className="font-mono text-[5px] text-white/20">v{NXS_FIRMWARE.version}</span>
            </div>
            <span className="font-mono text-[6px]" style={{ color: stateLedCss }}>
              [{stateLabel}]
            </span>
          </div>

          {/* Content */}
          <div className="space-y-1 px-2 py-2">
            {activeJob && node ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-green-200">{node.title}</span>
                  <span className="text-[10px] text-gray-500 tabular-nums">
                    {fmtRemaining(remaining)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-sm bg-green-500/10">
                  <div
                    className="h-full"
                    style={
                      remaining === 0
                        ? {
                            width: "100%",
                            backgroundColor: "var(--neon-amber)",
                            opacity: 0.8,
                          }
                        : {
                            width: `${pct}%`,
                            background:
                              "linear-gradient(90deg, var(--neon-cyan) 0%, transparent 20%, var(--neon-cyan) 40%, transparent 60%, var(--neon-cyan) 80%, transparent 100%)",
                            backgroundSize: "200% 100%",
                            animation: "nexus-data-stream 2s linear infinite",
                          }
                    }
                  />
                </div>
                <p className="text-[9px] text-gray-500">{node.description}</p>
                {remaining === 0 && (
                  <button
                    type="button"
                    onClick={() => void tree.claimNode(activeJob.id)}
                    disabled={tree.busy}
                    className="mt-1 w-full border px-2 py-0.5 text-[10px] tracking-wider uppercase transition-colors disabled:opacity-50"
                    style={{
                      borderColor: "var(--neon-amber)",
                      backgroundColor: "rgba(255,184,0,0.1)",
                      color: "var(--neon-amber)",
                      animation: "nexus-claim-glow 1.2s ease-in-out infinite",
                    }}
                  >
                    Claim unlock
                  </button>
                )}
              </>
            ) : (
              <TechGraph nodes={tree.nodes} isOnline={isOnline} />
            )}
          </div>

          {/* Stats footer */}
          <div className="flex items-center justify-between border-t border-green-500/10 px-2 py-1">
            <span className="font-mono text-[9px] text-gray-500">
              {unlocked} unlocked / {total} nodes
            </span>
            <div className="flex gap-0.5">
              {tree.nodes.map((n) => (
                <div
                  key={n.id}
                  className="h-[3px] w-[3px] rounded-full"
                  style={{
                    backgroundColor:
                      n.status === "unlocked"
                        ? "var(--neon-green)"
                        : n.status === "in_progress"
                          ? "var(--neon-cyan)"
                          : n.status === "available"
                            ? "var(--neon-amber)"
                            : "#334",
                    boxShadow:
                      n.status === "unlocked"
                        ? "0 0 3px var(--neon-green)"
                        : n.status === "in_progress"
                          ? "0 0 3px var(--neon-cyan)"
                          : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* CRT scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,102,0.03) 2px, rgba(0,255,102,0.03) 4px)",
            mixBlendMode: "overlay",
          }}
        />
      </div>

      <style jsx global>{`
        @keyframes nexus-sweep {
          0% {
            transform: translateX(-10px);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateX(110px);
            opacity: 0;
          }
        }
        @keyframes nexus-flicker {
          0%,
          100% {
            opacity: 0.92;
          }
          8% {
            opacity: 1;
          }
          15% {
            opacity: 0.88;
          }
          20% {
            opacity: 1;
          }
          52% {
            opacity: 0.95;
          }
          53% {
            opacity: 0.85;
          }
          54% {
            opacity: 1;
          }
          78% {
            opacity: 0.93;
          }
        }
        @keyframes nexus-research-pulse {
          0%,
          100% {
            r: 3;
            opacity: 0.8;
          }
          50% {
            r: 5;
            opacity: 0.3;
          }
        }
        @keyframes nexus-data-stream {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        @keyframes nexus-claim-glow {
          0%,
          100% {
            box-shadow:
              0 0 4px var(--neon-amber),
              inset 0 0 2px var(--neon-amber);
          }
          50% {
            box-shadow:
              0 0 12px var(--neon-amber),
              0 0 20px var(--neon-amber),
              inset 0 0 4px var(--neon-amber);
          }
        }
      `}</style>
    </PanelFrame>
  );
}
