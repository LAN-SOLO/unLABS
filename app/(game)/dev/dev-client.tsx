"use client";

/**
 * Dev area client
 * ===============
 *
 * Internal tools. Not shipped to regular players. Provides:
 *   - Live resource inspector (reads from GameTickProvider)
 *   - Manual resource grants (±)
 *   - Episode/quest jumper (writes profiles.current_episode)
 *   - Force-save button
 *   - Raw save blob viewer
 *
 * Intentionally styled minimally — this is a debug console, not a showpiece.
 */

import { useMemo, useState } from "react";
import Link from "next/link";

import { useGameTick } from "@/contexts/GameTickProvider";
import { useQuest } from "@/contexts/QuestProvider";
import { useProduction } from "@/contexts/ProductionProvider";
import { flushSave } from "@/lib/game/saveSync";
import { grantDevUnsc } from "./actions";
import type { ResourceId } from "@/lib/game/tickEngine";

const EPISODES = ["EP0", "EP1", "EP2", "EP3", "EP4", "EP5", "EP6"] as const;
const GRANT_AMOUNTS = [1, 10, 100, 1000] as const;
const RESOURCES: ResourceId[] = [
  "abstractum",
  "energy",
  "base_alloy",
  "advanced_alloy",
  "nanomaterial",
  "exotic_matter",
  "antimatter",
];

export function DevClient({
  username,
  currentEpisode,
}: {
  username: string;
  currentEpisode: string;
}) {
  const { resources, tickCount, lastTickAt, offlineCatchUpSeconds, grant, setRate, setCapacity } =
    useGameTick();
  const quest = useQuest();
  const production = useProduction();

  const [episode, setEpisode] = useState(currentEpisode);
  const [flushing, setFlushing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [granting, setGranting] = useState(false);
  const [cascading, setCascading] = useState(false);

  const resourceRows = useMemo(() => {
    return RESOURCES.map((id) => {
      const r = resources[id];
      return {
        id,
        amount: r?.amount ?? 0,
        capacity: r?.capacity ?? 0,
        rate: r?.ratePerSecond ?? 0,
      };
    });
  }, [resources]);

  const handleForceSave = async () => {
    setFlushing(true);
    try {
      await flushSave();
    } finally {
      setFlushing(false);
    }
  };

  // Episode buttons select a target locally; the actual reset is applied by
  // RESET EPISODE so an accidental click doesn't nuke quest_state. Previous
  // behaviour wrote `current_episode` immediately and left `quest_state`
  // untouched, which split header/active labels apart and confused testing.
  const handleEpisodeChange = (next: string) => {
    setEpisode(next);
  };

  const handleGrantUnsc = async (amount: number) => {
    setGranting(true);
    try {
      await grantDevUnsc(amount);
      await production.refresh();
    } finally {
      setGranting(false);
    }
  };

  const handleCascadeAdvance = async () => {
    setCascading(true);
    try {
      await quest.cascade();
    } finally {
      setCascading(false);
    }
  };

  const handleResetEpisode = async () => {
    setResetting(true);
    try {
      await quest.reset(episode);
      // Also roll back the tick engine to cold-start so EP0 rewards take
      // effect again when the player replays the episode.
      setRate("energy", 0);
      setCapacity("energy", 0);
      setRate("abstractum", 0);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-black p-6 font-mono text-green-400">
      <header className="mb-6 border-b border-green-500/30 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-green-300">&#47;&#47; DEV CONSOLE</h1>
            <p className="text-xs text-green-500/60">
              operator: {username} · active: {quest.episode?.id ?? "(none)"} · ticks: {tickCount}
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
          </nav>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; TICK ENGINE</h2>
        <div className="space-y-1 border border-green-500/30 p-3 text-xs">
          <div>
            last_tick_at:{" "}
            <span className="text-green-300">
              {lastTickAt === 0 ? "—" : new Date(lastTickAt).toISOString()}
            </span>
          </div>
          <div>
            offline_catch_up: <span className="text-green-300">{offlineCatchUpSeconds}s</span>{" "}
            (applied on mount)
          </div>
          <div>
            <button
              onClick={handleForceSave}
              disabled={flushing}
              className="mt-2 border border-green-500 px-3 py-1 hover:bg-green-500/20 disabled:opacity-50"
            >
              {flushing ? "> FLUSHING..." : "> FORCE SAVE"}
            </button>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; RESOURCES</h2>
        <table className="w-full border border-green-500/30 text-xs">
          <thead className="bg-green-500/10">
            <tr>
              <th className="p-2 text-left">id</th>
              <th className="p-2 text-right">amount</th>
              <th className="p-2 text-right">capacity</th>
              <th className="p-2 text-right">rate/s</th>
              <th className="p-2 text-left">actions</th>
            </tr>
          </thead>
          <tbody>
            {resourceRows.map((row) => (
              <tr key={row.id} className="border-t border-green-500/20">
                <td className="p-2 text-green-300">{row.id}</td>
                <td className="p-2 text-right">{row.amount.toFixed(2)}</td>
                <td className="p-2 text-right">{row.capacity === Infinity ? "∞" : row.capacity}</td>
                <td className="p-2 text-right">{row.rate.toFixed(2)}</td>
                <td className="flex flex-wrap gap-1 p-2">
                  {GRANT_AMOUNTS.map((amount) => (
                    <button
                      key={`+${amount}`}
                      onClick={() => grant(row.id, amount)}
                      className="border border-green-500/50 px-2 hover:bg-green-500/20"
                    >
                      +{amount}
                    </button>
                  ))}
                  {GRANT_AMOUNTS.map((amount) => (
                    <button
                      key={`-${amount}`}
                      onClick={() => grant(row.id, -amount)}
                      className="border border-red-500/50 px-2 text-red-400 hover:bg-red-500/20"
                    >
                      −{amount}
                    </button>
                  ))}
                  <button
                    onClick={() => setRate(row.id, row.rate === 0 ? 1 : 0)}
                    className="border border-yellow-500/50 px-2 text-yellow-400 hover:bg-yellow-500/20"
                    title="Toggle rate 0 ↔ 1/s"
                  >
                    rate±
                  </button>
                  <button
                    onClick={() =>
                      setCapacity(row.id, row.capacity === 0 ? 1000 : row.capacity + 1000)
                    }
                    className="border border-cyan-500/50 px-2 text-cyan-400 hover:bg-cyan-500/20"
                    title="+1000 capacity"
                  >
                    cap+
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; _unSC LEDGER</h2>
        <div className="space-y-2 border border-green-500/30 p-3 text-xs">
          <div>
            available: <span className="text-green-300">{production.balance.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[10, 100, 1000].map((amount) => (
              <button
                key={amount}
                onClick={() => handleGrantUnsc(amount)}
                disabled={granting}
                className="border border-green-500/50 px-2 py-1 hover:bg-green-500/20 disabled:opacity-50"
              >
                + {amount} _unSC
              </button>
            ))}
            <button
              onClick={() => production.refresh()}
              className="border border-cyan-500/50 px-2 py-1 text-cyan-400 hover:bg-cyan-500/20"
            >
              refresh
            </button>
          </div>
          <div className="text-[10px] text-green-500/50">
            jobs: pending= {production.jobs.filter((j) => j.status === "pending").length} · claimed={" "}
            {production.jobs.filter((j) => j.status === "claimed").length} · cancelled={" "}
            {production.jobs.filter((j) => j.status === "cancelled").length}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; EPISODE JUMPER</h2>
        <div className="flex flex-wrap items-center gap-2 border border-green-500/30 p-3">
          {EPISODES.map((ep) => (
            <button
              key={ep}
              onClick={() => handleEpisodeChange(ep)}
              className={`border px-3 py-1 text-xs ${
                episode === ep
                  ? "border-green-400 bg-green-500/20 text-green-200"
                  : "border-green-500/40 hover:bg-green-500/10"
              }`}
            >
              {ep}
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-green-500/30" />
          <button
            onClick={handleResetEpisode}
            disabled={resetting}
            className="border border-yellow-500/50 px-3 py-1 text-xs text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
            title="Reset the active episode + roll back tick-engine rates"
          >
            {resetting ? "resetting..." : "> RESET EPISODE"}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-green-500/50">
          active: {quest.episode?.id ?? "(none)"} · step {quest.state.currentStepIndex + 1}/
          {quest.episode?.steps.length ?? 0}
          {quest.currentStep ? ` · ${quest.currentStep.id}` : " · complete"}
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; QUEST FLAGS</h2>
        <div className="border border-green-500/30 p-3 text-xs">
          {Object.keys(quest.state.flags).length === 0 ? (
            <p className="text-green-500/50">(no flags set)</p>
          ) : (
            <table className="w-full">
              <tbody>
                {Object.entries(quest.state.flags)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([flag, value]) => (
                    <tr key={flag} className="border-t border-green-500/10 first:border-t-0">
                      <td className="py-1 pr-4 text-green-300">{flag}</td>
                      <td className="py-1 text-right">
                        <span className={value ? "text-green-400" : "text-red-400/70"}>
                          {String(value)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[10px] text-green-500/50">
            completed steps:{" "}
            {quest.state.completedStepIds.length === 0
              ? "(none)"
              : quest.state.completedStepIds.join(", ")}
          </p>
          <button
            onClick={handleCascadeAdvance}
            disabled={cascading}
            className="mt-3 border border-cyan-500/50 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
            title="Walk the quest engine through every step whose trigger is currently satisfied (incl. out-of-order skips). Heals stuck saves."
          >
            {cascading ? "cascading..." : "> CASCADE ADVANCE"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; LIVE STATE DUMP</h2>
        <pre className="overflow-x-auto border border-green-500/30 p-3 text-[10px] text-green-500/80">
          {JSON.stringify({ resources, tickCount, lastTickAt, quest: quest.state }, null, 2)}
        </pre>
      </section>
    </div>
  );
}
