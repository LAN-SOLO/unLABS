"use client";

/**
 * LabClient — the production hub UI.
 * ==================================
 *
 * Everything lives in three stacked panels:
 *
 *   1. Header: username + balance + energy/abstractum readouts + link nav
 *   2. Recipe catalog: available recipes filtered by unlock flags,
 *      Start button disabled when costs are unmet
 *   3. Active jobs: in-progress timers with live progress bars + Claim
 *      buttons when ready
 *
 * All live data comes from the existing providers:
 *   - useGameTick:    resources + tick count (for progress re-renders)
 *   - useQuest:       flags (for filtering recipes by unlockRequires)
 *   - useProduction:  jobs + balance + startJob/claimJob
 *
 * The component deliberately re-renders on every tick via useGameTick's
 * tickCount so job progress bars animate smoothly without a dedicated
 * rAF loop.
 */

import Link from "next/link";
import { useMemo } from "react";

import { useGameTick } from "@/contexts/GameTickProvider";
import { useQuest } from "@/contexts/QuestProvider";
import { useProduction } from "@/contexts/ProductionProvider";
import { RECIPES, isRecipeBuilt, visibleRecipes, type Recipe } from "@/lib/game/recipes";
import {
  computeJobProgress,
  isJobClaimable,
  remainingSeconds,
  type ProductionJob,
} from "@/lib/game/production";
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

export function LabClient({ username }: { username: string }) {
  const { resources, tickCount } = useGameTick();
  const { state: questState } = useQuest();
  const { jobs, balance, busy, lastError, startJob, claimJob } = useProduction();

  const availableRecipes = useMemo(() => visibleRecipes(questState.flags), [questState.flags]);

  // Locked = not visible AND not already built. We exclude built one-shot
  // devices so the "N locked" hint doesn't double-count permanent completions.
  const lockedRecipes = useMemo(
    () =>
      RECIPES.filter(
        (r) => !availableRecipes.some((a) => a.id === r.id) && !isRecipeBuilt(r, questState.flags),
      ),
    [availableRecipes, questState.flags],
  );

  const pendingJobs = jobs.filter((j) => j.status === "pending");
  const historyJobs = jobs.filter((j) => j.status !== "pending").slice(0, 10);

  return (
    <div className="h-screen overflow-y-auto bg-black p-6 font-mono text-green-400">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-green-500/30 pb-4">
        <div>
          <h1 className="text-2xl text-green-300">&#47;&#47; _unLAB · PRODUCTION</h1>
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
          <Link href="/dev" className="underline hover:text-green-300">
            dev
          </Link>
        </nav>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <ResourceCard label="_unSC" value={balance.toFixed(2)} highlight />
        {(Object.keys(RESOURCE_LABEL) as ResourceId[]).map((id) => {
          const r = resources[id];
          if (!r) return null;
          return (
            <ResourceCard
              key={id}
              label={RESOURCE_LABEL[id]}
              value={r.amount.toFixed(2)}
              sub={`${r.ratePerSecond >= 0 ? "+" : ""}${r.ratePerSecond.toFixed(2)}/s`}
            />
          );
        })}
      </section>

      {lastError ? (
        <div className="mb-4 border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
          &gt; last error: {lastError}
        </div>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; ACTIVE JOBS</h2>
        {pendingJobs.length === 0 ? (
          <p className="border border-green-500/20 px-3 py-2 text-[11px] text-green-500/50">
            no active jobs. pick a recipe below to start one.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingJobs.map((job) => (
              <JobRow key={job.id} job={job} onClaim={() => claimJob(job.id)} busy={busy} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm text-green-300">&#47;&#47; RECIPES</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              balance={balance}
              resources={resources}
              busy={busy}
              onStart={() => startJob(recipe.id)}
            />
          ))}
        </div>
        {lockedRecipes.length > 0 ? (
          <div className="mt-4 text-[11px] text-green-500/50">
            &gt; {lockedRecipes.length} recipe(s) locked behind quest progress
          </div>
        ) : null}
      </section>

      {historyJobs.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm text-green-300">&#47;&#47; RECENT HISTORY</h2>
          <div className="space-y-1 text-[11px]">
            {historyJobs.map((job) => (
              <div
                key={job.id}
                className="flex justify-between border-b border-green-500/10 py-1 text-green-500/60"
              >
                <span>{job.recipeId}</span>
                <span>{job.status}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ResourceCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border p-2 ${
        highlight ? "border-green-400 bg-green-500/10" : "border-green-500/30"
      }`}
    >
      <div className="text-[10px] text-green-500/60 uppercase">{label}</div>
      <div className={`text-lg ${highlight ? "text-green-200" : "text-green-300"}`}>{value}</div>
      {sub ? <div className="text-[9px] text-green-500/50">{sub}</div> : null}
    </div>
  );
}

function RecipeCard({
  recipe,
  balance,
  resources,
  busy,
  onStart,
}: {
  recipe: Recipe;
  balance: number;
  resources: ReturnType<typeof useGameTick>["resources"];
  busy: boolean;
  onStart: () => void;
}) {
  // Check whether the player can afford the recipe right now.
  const missingCosts = recipe.costs.filter(
    (c) => (resources[c.resourceId]?.amount ?? 0) < c.amount,
  );
  const missingUnsc = balance < recipe.unscBurn;
  const canAfford = missingCosts.length === 0 && !missingUnsc;

  return (
    <div className="border border-green-500/30 bg-black/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-green-200">{recipe.label}</div>
          <div className="text-[10px] text-green-500/60">
            T{recipe.tier} · {recipe.category} · {formatDuration(recipe.durationSec)}
          </div>
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-green-500/70">{recipe.flavor}</p>

      <div className="mt-2 space-y-0.5 text-[11px]">
        {recipe.costs.map((c) => {
          const have = resources[c.resourceId]?.amount ?? 0;
          const ok = have >= c.amount;
          return (
            <div key={c.resourceId} className={ok ? "text-green-400" : "text-amber-300"}>
              &gt; {c.amount} {RESOURCE_LABEL[c.resourceId] ?? c.resourceId} ({have.toFixed(1)})
            </div>
          );
        })}
        {recipe.unscBurn > 0 ? (
          <div className={missingUnsc ? "text-amber-300" : "text-green-400"}>
            &gt; burn {recipe.unscBurn} _unSC
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={!canAfford || busy}
        className="mt-3 w-full border border-green-400 bg-green-500/10 py-1 text-xs text-green-200 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:border-green-500/30 disabled:text-green-500/50"
      >
        {canAfford ? "> START" : "> INSUFFICIENT"}
      </button>
    </div>
  );
}

function JobRow({
  job,
  busy,
  onClaim,
}: {
  job: ProductionJob;
  busy: boolean;
  onClaim: () => void;
}) {
  const progress = Math.min(1, computeJobProgress(job));
  const pct = Math.round(progress * 100);
  const remaining = remainingSeconds(job);
  const claimable = isJobClaimable(job);

  return (
    <div className="border border-green-500/40 bg-black/60 p-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-green-200">{job.recipeId}</span>
        <span className="text-green-500/70">{claimable ? "READY" : `${remaining}s`}</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-green-500/10">
        <div
          className={`h-full ${claimable ? "bg-lime-300" : "bg-green-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {claimable ? (
        <button
          type="button"
          onClick={onClaim}
          disabled={busy}
          className="mt-2 w-full border border-lime-300 bg-lime-500/10 py-1 text-xs text-lime-200 hover:bg-lime-500/20 disabled:opacity-50"
        >
          {busy ? "..." : "> CLAIM"}
        </button>
      ) : null}
    </div>
  );
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}
