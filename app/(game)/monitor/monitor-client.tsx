"use client";

/**
 * MonitorClient — resource ledger, device roster, and tech-tree overview.
 * ========================================================================
 *
 * Three stacked sections, same visual language as LabClient:
 *
 *   1. Resource ledger: current amount + rate + lifetime produced/consumed,
 *      per tick-engine resource plus _unSC.
 *   2. Devices: panel-device roster (flag-gated) and Lab production-device
 *      roster (recipe-based), shown as two separate lists — they answer
 *      different questions and are not merged.
 *   3. Tech tree: the existing TechGraph mind-map (components/nexus/), just
 *      embedded here behind a collapsible toggle instead of only being
 *      reachable as a full-screen terminal app.
 *
 * All live data comes from the same global providers LabClient uses.
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { useGameTick } from "@/contexts/GameTickProvider";
import { useQuest } from "@/contexts/QuestProvider";
import { TechGraph } from "@/components/nexus/TechGraph";
import { TECH_TREES, TECH_NODES } from "@/lib/game/techTree";
import { buildPanelDeviceRoster, buildProductionDeviceRoster } from "@/lib/game/devices/roster";
import type { ResourceId } from "@/lib/game/tickEngine";

const RESOURCE_LABEL: Record<ResourceId, string> = {
  abstractum: "Abs",
  energy: "E",
  base_alloy: "B.Alloy",
  advanced_alloy: "A.Alloy",
  nanomaterial: "Nano",
  exotic_matter: "Exotic",
  antimatter: "AntiM",
  research: "Research",
};

export function MonitorClient({
  username,
  balance,
  unscTotalEarned,
  unscTotalSpent,
}: {
  username: string;
  balance: number;
  unscTotalEarned: number;
  unscTotalSpent: number;
}) {
  const { resources, tickCount } = useGameTick();
  const { state: questState } = useQuest();
  const [showTechGraph, setShowTechGraph] = useState(false);

  const panelDevices = useMemo(() => buildPanelDeviceRoster(questState.flags), [questState.flags]);
  const productionDevices = useMemo(
    () => buildProductionDeviceRoster(questState.flags),
    [questState.flags],
  );

  const panelBuiltCount = panelDevices.filter((d) => d.built).length;
  const productionBuiltCount = productionDevices.filter((d) => d.built).length;
  const populatedTreeCount = TECH_TREES.filter((t) =>
    TECH_NODES.some((n) => n.tree === t.id),
  ).length;

  return (
    <div className="h-screen overflow-y-auto bg-black p-6 font-mono text-green-400">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-green-500/30 pb-4">
        <div>
          <h1 className="text-2xl text-green-300">&#47;&#47; _unLAB · MONITOR</h1>
          <p className="text-[11px] text-green-500/60">
            operator: {username} · ep: {questState.episodeId} · tick: {tickCount}
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/terminal" className="underline hover:text-green-300">
            terminal
          </Link>
          <Link href="/panel" className="underline hover:text-green-300">
            panel
          </Link>
          <Link href="/lab" className="underline hover:text-green-300">
            lab
          </Link>
          <Link href="/dev" className="underline hover:text-green-300">
            dev
          </Link>
        </nav>
      </header>

      {/* ── Resource ledger ── */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; RESOURCE LEDGER</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LedgerCard
            label="_unSC"
            amount={balance.toFixed(2)}
            produced={unscTotalEarned.toFixed(2)}
            consumed={unscTotalSpent.toFixed(2)}
            highlight
          />
          {(Object.keys(RESOURCE_LABEL) as ResourceId[]).map((id) => {
            const r = resources[id];
            if (!r) return null;
            return (
              <LedgerCard
                key={id}
                label={RESOURCE_LABEL[id]}
                amount={r.amount.toFixed(2)}
                rate={`${r.ratePerSecond >= 0 ? "+" : ""}${r.ratePerSecond.toFixed(2)}/s`}
                produced={(r.totalProduced ?? 0).toFixed(2)}
                consumed={(r.totalConsumed ?? 0).toFixed(2)}
              />
            );
          })}
        </div>
      </section>

      {/* ── Devices ── */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; DEVICES</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="border border-green-500/30 bg-black/40 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-green-500/60">
              <span>PANEL DEVICES</span>
              <span>
                {panelBuiltCount} / {panelDevices.length} built
              </span>
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto pr-1 text-[11px]">
              {panelDevices.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between border-b border-green-500/10 py-1"
                >
                  <span className={d.built ? "text-green-300" : "text-green-500/40"}>
                    {d.built ? "●" : "○"} {d.name}
                  </span>
                  <span className="text-green-500/50">
                    {d.tier != null ? `T${d.tier}` : ""}
                    {!d.built && d.requiredFlag ? ` · needs ${d.requiredFlag}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-green-500/30 bg-black/40 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-green-500/60">
              <span>LAB PRODUCTION DEVICES</span>
              <span>
                {productionBuiltCount} / {productionDevices.length} built
              </span>
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto pr-1 text-[11px]">
              {productionDevices.map((d) => (
                <div
                  key={d.recipeId}
                  className="flex items-center justify-between border-b border-green-500/10 py-1"
                >
                  <span className={d.built ? "text-green-300" : "text-green-500/40"}>
                    {d.built ? "●" : "○"} {d.label}
                  </span>
                  <span className="text-green-500/50">T{d.tier}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tech tree mind map ── */}
      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm text-green-300">&#47;&#47; TECH TREE</h2>
          <button
            type="button"
            onClick={() => setShowTechGraph((v) => !v)}
            className="border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs text-green-300 hover:bg-green-500/20"
          >
            {showTechGraph ? "> CLOSE TECH TREE" : "> OPEN TECH TREE"}
          </button>
        </div>
        <p className="mb-2 text-[11px] text-green-500/50">
          {populatedTreeCount} of {TECH_TREES.length} trees are populated today — the remaining{" "}
          {TECH_TREES.length - populatedTreeCount} are reserved columns, filled in with future
          content.
        </p>
        {showTechGraph && (
          <div className="crt-scanlines crt-glow relative h-[600px] overflow-hidden border border-green-500/30 bg-black">
            <TechGraph onExit={() => setShowTechGraph(false)} />
          </div>
        )}
      </section>
    </div>
  );
}

function LedgerCard({
  label,
  amount,
  rate,
  produced,
  consumed,
  highlight,
}: {
  label: string;
  amount: string;
  rate?: string;
  produced: string;
  consumed: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border p-2 ${
        highlight ? "border-green-400 bg-green-500/10" : "border-green-500/30"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-green-500/60 uppercase">{label}</span>
        {rate ? <span className="text-[9px] text-green-500/50">{rate}</span> : null}
      </div>
      <div className={`text-lg ${highlight ? "text-green-200" : "text-green-300"}`}>{amount}</div>
      <div className="mt-1 flex justify-between text-[9px] text-green-500/50">
        <span>produced: {produced}</span>
        <span>consumed: {consumed}</span>
      </div>
    </div>
  );
}
