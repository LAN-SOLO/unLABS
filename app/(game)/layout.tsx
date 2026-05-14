import { loadPlayerSave } from "./actions/playerSave";
import { loadQuestState } from "./actions/quest";
import { loadMissionState } from "./actions/mission";
import { listJobs } from "./actions/production";
import { getBalance } from "./actions/economy";
import { loadAchievementState } from "./actions/achievement";
import { listResearch } from "./actions/research";
import { getTutorialStatus } from "./actions/tutorial";
import { GameShell } from "./game-shell";
import type { ResourceMap } from "@/lib/game/tickEngine";

/**
 * Game route group layout.
 *
 * Server component: fetches the player's last save blob + `last_tick_at`
 * (used for offline progress) and hands them to the client-side GameShell,
 * which mounts the tick provider and the save-sync hook.
 *
 * Route protection is handled by the root `middleware.ts` — if we reach this
 * layout, `user` is guaranteed to be authenticated.
 */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const [save, quest, missions, jobs, balance, achievements, research, tutorial] =
    await Promise.all([
      loadPlayerSave(),
      loadQuestState(),
      loadMissionState(),
      listJobs(),
      getBalance(),
      loadAchievementState(),
      listResearch(),
      getTutorialStatus(),
    ]);

  // Extract the resource slice of the save blob if present. Anything else in
  // the blob is passed through verbatim and consumed by device managers /
  // downstream providers.
  const savedData = save.ok && save.data ? save.data : {};
  const initialResources = (savedData as { resources?: ResourceMap }).resources;

  return (
    <GameShell
      initialResources={initialResources}
      initialLastTickAt={save.lastTickAt}
      initialSave={savedData}
      initialEpisodeId={quest.episodeId}
      initialQuestState={quest.state}
      initialJobs={jobs.ok ? jobs.jobs : []}
      initialBalance={balance.ok && balance.balance ? balance.balance.available : 0}
      initialMissionState={missions.ok ? missions.state : null}
      initialAchievementState={achievements}
      initialResearchState={research}
      initialTutorialState={tutorial.ok ? tutorial.state : null}
    >
      {children}
    </GameShell>
  );
}
