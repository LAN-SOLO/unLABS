"use client";

/**
 * TechGraph
 * =========
 *
 * Full-screen in-terminal app for the NXS-01 Nexus. Renders the tech tree
 * as an interactive SVG node graph — no third-party layout library; node
 * positions come from the catalog's `layout` field.
 *
 * Interaction:
 *   - Click a node → detail panel (right side) with cost / prereqs /
 *     effects + Start button when available
 *   - Arrow keys / WASD pan the viewport
 *   - ESC / q / the on-screen button exits back to the terminal
 *
 * Scope-wise this is the MVP: branch columns, tier rows, prereq edges,
 * one active research highlighted. No zoom, no drag — by design, since
 * the layout is authored.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { useTechTree } from "@/contexts/TechTreeProvider";
import { useNexus } from "@/contexts/NexusManager";
import { useGameTick } from "@/contexts/GameTickProvider";
import {
  TECH_TREES,
  getTechNode,
  type TechNodeWithStatus,
  type TechTreeId,
} from "@/lib/game/techTree";

const COL_WIDTH = 220;
const ROW_HEIGHT = 150;
const NODE_RADIUS = 38;
const PAD_X = 100;
const PAD_Y = 80;

interface TechGraphProps {
  onExit: () => void;
}

function nodeColor(status: string, ready: boolean): string {
  if (status === "unlocked") return "rgb(110 231 183)"; // green-300
  if (status === "in_progress") return ready ? "rgb(252 211 77)" : "rgb(103 232 249)"; // amber-300 / cyan-300
  if (status === "available") return "rgb(74 222 128)"; // green-400
  return "rgb(64 64 64)"; // gray-700 — locked
}

export function TechGraph({ onExit }: TechGraphProps) {
  const tree = useTechTree();
  const nexus = useNexus();
  const { lastTickAt } = useGameTick();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Keyboard: ESC / q to exit; WASD / arrows to pan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "q" || e.key === "Q") {
        e.preventDefault();
        onExit();
        return;
      }
      const step = 40;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        setPan((p) => ({ ...p, x: p.x + step }));
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        setPan((p) => ({ ...p, x: p.x - step }));
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        setPan((p) => ({ ...p, y: p.y + step }));
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        setPan((p) => ({ ...p, y: p.y - step }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  // Node world-coords (col index × col width; tier × row height).
  const placements = useMemo(() => {
    const out = new Map<string, { x: number; y: number; node: TechNodeWithStatus }>();
    for (const node of tree.nodes) {
      const col = TECH_TREES.findIndex((t) => t.id === (node.tree as TechTreeId));
      const x = PAD_X + (col < 0 ? 0 : col) * COL_WIDTH;
      // Flip y so tier 1 sits low.
      const y = PAD_Y + (5 - node.tier) * ROW_HEIGHT;
      out.set(node.id, { x, y, node });
    }
    return out;
  }, [tree.nodes]);

  const edges = useMemo(() => {
    const list: Array<{ from: string; to: string; satisfied: boolean }> = [];
    for (const node of tree.nodes) {
      for (const req of node.requires) {
        list.push({
          from: req,
          to: node.id,
          satisfied: tree.treeState.unlocked.includes(req),
        });
      }
    }
    return list;
  }, [tree.nodes, tree.treeState.unlocked]);

  const selected = useMemo(
    () => (selectedId ? tree.nodes.find((n) => n.id === selectedId) : null),
    [selectedId, tree.nodes],
  );

  const activeReady = useMemo(() => {
    if (!tree.activeJob) return false;
    // lastTickAt is driven by the 1Hz tick interval; acceptable for UI
    // readiness checks and keeps the render pure.
    return tree.activeJob.completesAt <= (lastTickAt || tree.activeJob.completesAt);
  }, [tree.activeJob, lastTickAt]);

  const handleStart = useCallback(async () => {
    if (!selected) return;
    const res = await tree.startNode(selected.id);
    if (!res.ok) {
      // Keep it simple — errors bubble via the global toast in the provider.
    }
  }, [selected, tree]);

  const handleClaim = useCallback(async () => {
    if (!tree.activeJob) return;
    await tree.claimNode(tree.activeJob.id);
  }, [tree]);

  const handleCancel = useCallback(async () => {
    if (!tree.activeJob) return;
    await tree.cancelNode(tree.activeJob.id);
  }, [tree]);

  // Not-available guard
  if (!nexus.isBuilt) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black font-mono text-green-400">
        <p className="mb-4">NXS-01 not built. Research subsystem offline.</p>
        <button
          type="button"
          onClick={onExit}
          className="border border-green-500/50 px-4 py-1 text-sm hover:bg-green-500/10"
        >
          Exit
        </button>
      </div>
    );
  }

  const viewWidth = Math.max(1200, PAD_X * 2 + TECH_TREES.length * COL_WIDTH);
  const viewHeight = PAD_Y * 2 + 5 * ROW_HEIGHT;

  return (
    <div className="relative flex h-full flex-col bg-black font-mono text-green-400">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-green-500/40 px-4 py-2">
        <div className="flex items-center gap-4">
          <span className="tracking-wider text-green-300">[ NXS-01 · TECH GRAPH ]</span>
          <span className="text-xs text-gray-500">
            {tree.treeState.unlocked.length} / {tree.nodes.length} unlocked
          </span>
          {tree.activeJob && (
            <span className="text-xs text-cyan-300">
              {activeReady ? "READY TO CLAIM" : "RESEARCHING"}:{" "}
              {getTechNode(tree.activeJob.nodeId)?.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>WASD / arrows — pan</span>
          <span>click — inspect</span>
          <span>ESC / Q — exit</span>
          <button
            type="button"
            onClick={onExit}
            className="border border-green-500/50 px-2 py-0.5 text-green-400 hover:bg-green-500/10"
          >
            Exit
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Graph */}
        <div className="relative flex-1 overflow-hidden">
          <svg
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            className="h-full w-full"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            {/* Tree column headers */}
            {TECH_TREES.map((t, i) => (
              <g key={t.id}>
                <text
                  x={PAD_X + i * COL_WIDTH}
                  y={24}
                  textAnchor="middle"
                  fontSize={12}
                  fill="currentColor"
                  className={t.color}
                >
                  {t.label.toUpperCase()}
                </text>
                <line
                  x1={PAD_X + i * COL_WIDTH}
                  y1={40}
                  x2={PAD_X + i * COL_WIDTH}
                  y2={viewHeight - 20}
                  stroke="currentColor"
                  strokeOpacity={0.07}
                  strokeDasharray="4 4"
                />
              </g>
            ))}

            {/* Edges */}
            {edges.map((edge, i) => {
              const a = placements.get(edge.from);
              const b = placements.get(edge.to);
              if (!a || !b) return null;
              return (
                <line
                  key={`${edge.from}->${edge.to}-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={edge.satisfied ? "rgb(74 222 128)" : "rgb(64 64 64)"}
                  strokeWidth={edge.satisfied ? 1.5 : 1}
                  strokeOpacity={edge.satisfied ? 0.6 : 0.3}
                />
              );
            })}

            {/* Nodes */}
            {Array.from(placements.values()).map(({ x, y, node }) => {
              const isSelected = selectedId === node.id;
              const isActive = tree.activeJob?.nodeId === node.id;
              const ready = isActive && activeReady;
              const fill = nodeColor(node.status, !!ready);
              return (
                <g
                  key={node.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(node.id)}
                >
                  <circle
                    r={NODE_RADIUS}
                    fill="black"
                    stroke={fill}
                    strokeWidth={isSelected ? 3 : 1.5}
                    strokeOpacity={isSelected ? 1 : 0.8}
                  />
                  {isActive && !ready && (
                    <circle
                      r={NODE_RADIUS - 4}
                      fill="none"
                      stroke={fill}
                      strokeDasharray="4 4"
                      strokeOpacity={0.6}
                    >
                      <animateTransform
                        attributeName="transform"
                        attributeType="XML"
                        type="rotate"
                        from="0"
                        to="360"
                        dur="6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <text y={-4} textAnchor="middle" fontSize={10} fill={fill}>
                    T{node.tier}
                  </text>
                  <text
                    y={10}
                    textAnchor="middle"
                    fontSize={9}
                    fill="currentColor"
                    className="text-gray-300"
                  >
                    {node.title.length > 16 ? node.title.slice(0, 14) + "…" : node.title}
                  </text>
                  {node.status === "unlocked" && (
                    <text y={26} textAnchor="middle" fontSize={9} fill="rgb(110 231 183)">
                      ✓
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Detail panel */}
        <aside className="w-80 shrink-0 border-l border-green-500/40 bg-black/95 p-4">
          {!selected ? (
            <div className="text-xs text-gray-500">
              <p className="mb-2 tracking-wider text-green-300">LEGEND</p>
              <ul className="space-y-1">
                <li>
                  <span className="inline-block h-2 w-2 rounded-full bg-green-300" /> unlocked
                </li>
                <li>
                  <span className="inline-block h-2 w-2 rounded-full bg-cyan-300" /> researching
                </li>
                <li>
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-300" /> ready to claim
                </li>
                <li>
                  <span className="inline-block h-2 w-2 rounded-full bg-green-400" /> available
                </li>
                <li>
                  <span className="inline-block h-2 w-2 rounded-full bg-gray-700" /> locked
                </li>
              </ul>
              <p className="mt-4">Click a node to inspect it.</p>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] tracking-wider text-green-500/60 uppercase">
                  {selected.tree} · tier {selected.tier}
                </div>
                <div className="text-sm text-green-200">{selected.title}</div>
                <div className="text-[10px] text-gray-500">{selected.id}</div>
              </div>
              <p className="text-gray-300">{selected.description}</p>

              <div>
                <div className="mb-1 text-[10px] tracking-wider text-green-500/60 uppercase">
                  status
                </div>
                <div className="text-green-200">{selected.status.toUpperCase()}</div>
              </div>

              <div>
                <div className="mb-1 text-[10px] tracking-wider text-green-500/60 uppercase">
                  cost
                </div>
                <ul className="space-y-0.5">
                  {selected.costs.map((c) => (
                    <li key={c.resourceId} className="flex justify-between">
                      <span>{c.resourceId}</span>
                      <span className="tabular-nums">{c.amount}</span>
                    </li>
                  ))}
                  {selected.unscBurn > 0 && (
                    <li className="flex justify-between text-amber-300">
                      <span>_unSC (burned from reserve path)</span>
                      <span className="tabular-nums">{selected.unscBurn}</span>
                    </li>
                  )}
                  <li className="flex justify-between pt-1 text-gray-400">
                    <span>duration</span>
                    <span className="tabular-nums">
                      {Math.floor(selected.durationSec / 60)}m {selected.durationSec % 60}s
                    </span>
                  </li>
                </ul>
              </div>

              {selected.requires.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] tracking-wider text-green-500/60 uppercase">
                    requires
                  </div>
                  <ul className="space-y-0.5 text-[11px]">
                    {selected.requires.map((r) => {
                      const sat = tree.treeState.unlocked.includes(r);
                      return (
                        <li key={r} className={sat ? "text-green-300" : "text-gray-500"}>
                          {sat ? "✓" : "·"} {getTechNode(r)?.title ?? r}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div>
                <div className="mb-1 text-[10px] tracking-wider text-green-500/60 uppercase">
                  effects
                </div>
                <ul className="space-y-0.5 text-[11px] text-gray-300">
                  {selected.effects.map((e, i) => (
                    <li key={i}>
                      {e.kind === "set_flag" && `Flag ${e.flag} = ${e.value}`}
                      {e.kind === "set_resource_rate" &&
                        `${e.resourceId} rate → ${(e.ratePerSecond * 60).toFixed(1)}/min`}
                      {e.kind === "set_resource_capacity" &&
                        `${e.resourceId} capacity → ${e.capacity}`}
                      {e.kind === "grant_resource" && `+${e.amount} ${e.resourceId}`}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2">
                {selected.status === "available" && !tree.activeJob && (
                  <button
                    type="button"
                    onClick={() => void handleStart()}
                    disabled={tree.busy || !nexus.isOnline}
                    className="w-full border border-green-400/70 bg-green-500/10 py-1 text-xs tracking-wider text-green-300 uppercase hover:bg-green-500/20 disabled:opacity-50"
                  >
                    Start research
                  </button>
                )}
                {selected.status === "available" && tree.activeJob && (
                  <p className="text-[10px] text-gray-500">
                    Another job is active. Cancel it first to switch.
                  </p>
                )}
                {selected.status === "in_progress" && activeReady && (
                  <button
                    type="button"
                    onClick={() => void handleClaim()}
                    disabled={tree.busy}
                    className="w-full border border-amber-400/70 bg-amber-500/10 py-1 text-xs tracking-wider text-amber-200 uppercase hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    Claim unlock
                  </button>
                )}
                {selected.status === "in_progress" && !activeReady && (
                  <button
                    type="button"
                    onClick={() => void handleCancel()}
                    disabled={tree.busy}
                    className="w-full border border-red-500/60 bg-red-500/10 py-1 text-xs tracking-wider text-red-300 uppercase hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Cancel research
                  </button>
                )}
                {selected.status === "locked" && (
                  <p className="text-[10px] text-gray-500">
                    Complete prerequisite nodes to unlock.
                  </p>
                )}
                {selected.status === "unlocked" && (
                  <p className="text-[10px] text-green-400">✓ Already unlocked.</p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
