"use client";

import { tr } from "@/lib/i18n";

/** Locale-aware watts: "1,5" in German, whole numbers without decimals. */
const watts = (w: number): string => fmtNum(w, Number.isInteger(w) ? 0 : 1);
import { useState } from "react";
import {
  CrtButton,
  FOCUS_RING,
  ItemChip,
  Meter,
  Panel,
  SectionTitle,
  UI,
} from "@/components/world/ui";
import { fmtNum } from "@/components/world/format";
import { useKeyText } from "@/components/world/keys";
import { ModelPreview } from "@/components/world/ModelPreview";
import {
  Missing,
  RecipeChain,
  announce,
  memoPanel,
  useSecondTick,
  type WorldApi,
} from "@/components/world/panels/shared";
import { PrototypeUse, type ProtoUseHandler } from "@/components/world/panels/prototype";
import { deviceVisual, stagedGrid } from "@/lib/world/models";
import { DEVICE_BY_ID, DEVICE_PUZZLES } from "@/lib/world/content/devices";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { ROOM_BY_ID } from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import {
  DRONE_COOLDOWN,
  autoAssign,
  buildStage,
  candidates,
  checkStage,
  deviceHasUse,
  droneReady,
  endingRevealed,
  endingsAt,
  evalCond,
  fabricable,
  fabricate,
  flyDrone,
  hint,
  isBuilt,
  isSwitchedOn,
  operateDevice,
  power,
  recipeChain,
  stagesDone,
  toggleDevice,
} from "@/lib/world/game";
import { AXIS_LABEL, dominantAxes, traits as mkTraits } from "@/lib/world/traits";
import type { ItemDef, Requirement, TraitAxis, WorldState } from "@/lib/world/types";

const previewCache = new Map<string, ReturnType<typeof stagedGrid>>();

/** Staged preview grid per (device, stage, power) — sorting voxels is not free. */
function previewGridFor(id: string, done: number, online: boolean): ReturnType<typeof stagedGrid> {
  const key = `${id}:${done}:${online ? 1 : 0}`;
  let g = previewCache.get(key);
  if (!g) {
    const total = DEVICE_BY_ID.get(id)?.stages.length ?? 1;
    g = stagedGrid(deviceVisual(id).base.grid, done / total, online);
    previewCache.set(key, g);
  }
  return g;
}

/** How many units in the inventory could fill a requirement slot. */
export function haveForRequirement(s: WorldState, req: Requirement): number {
  return candidates(s, req).reduce((a, d) => a + (s.inventory[d.id] ?? 0), 0);
}

function reqText(req: Requirement): string {
  const traitText = req.traits
    ? Object.entries(req.traits)
        .map(([k, v]) => `${AXIS_LABEL[k as TraitAxis]} ≥ ${v}`)
        .join(", ")
    : "";
  const named = req.item ? (ITEM_BY_ID.get(req.item)?.name ?? req.item) : "";
  return named && traitText ? tr("{a} or {b}", { a: named, b: traitText }) : named || traitText;
}

type Tone = "online" | "off" | "fault" | "build" | "unknown";
const TONE_COLOR: Record<Tone, string> = {
  online: UI.green,
  off: "#9aa0a6",
  fault: UI.red,
  build: UI.amber,
  unknown: "#ffffff66",
};

function DevicePanelImpl({
  id,
  api,
  onClose,
  openPuzzle,
  onTalk,
  onWorkbench,
  onInventory,
  onEnding,
  onPower,
  onProto,
}: {
  id: string;
  api: WorldApi;
  onClose: () => void;
  openPuzzle: (id: string) => void;
  onTalk: (npc: string) => void;
  onWorkbench: () => void;
  onInventory: () => void;
  onEnding: (id: string) => void;
  onPower: () => void;
  /** Host handler for "Use with prototype …" (world fx / overlays). */
  onProto?: ProtoUseHandler;
}) {
  const k = useKeyText();
  const s = api.get();
  const d = DEVICE_BY_ID.get(id)!;
  const done = stagesDone(s, id);
  const built = isBuilt(s, id);
  const known = !!s.discovered[id];
  const p = power(s);
  const online = p.online.has(id);
  const switched = isSwitchedOn(s, id);
  const starved = p.starved.find((x) => x.id === id);
  const check = checkStage(s, id);
  const current = check && !check.complete ? check.stageIndex : -1;
  // Manual slot choices apply to one stage at a time; otherwise the
  // automatic (cheapest) assignment is shown.
  const [override, setOverride] = useState<{ stage: number; picks: (string[] | null)[] } | null>(
    null,
  );
  const picks = override && override.stage === current ? override.picks : (check?.assignment ?? []);
  const setPicks = (next: (string[] | null)[]) => setOverride({ stage: current, picks: next });
  const [output, setOutput] = useState<string[]>([]);
  /** Stage shown in the stepper detail (defaults to the next one). */
  const [viewStage, setViewStage] = useState<number | null>(null);
  const shownStage = viewStage ?? (current >= 0 ? current : d.stages.length - 1);
  const drone = built && online && id === "EXD-001" && !droneReady(s);
  useSecondTick(drone);

  const room = ROOM_BY_ID.get(d.room);
  const [tone, status]: [Tone, string] = !known
    ? ["unknown", tr("Blueprint unknown")]
    : built
      ? online
        ? [
            "online",
            d.power < 0
              ? tr("Online · generates {w} W", {
                  w: watts(p.sources.find((x) => x.label === d.name)?.watts ?? -d.power),
                })
              : tr("Online · {w} W", { w: watts(d.power) }),
          ]
        : !switched
          ? ["off", tr("Switched off")]
          : starved?.reason === "hitze"
            ? ["fault", tr("Overheated — Thermal Manager missing")]
            : ["fault", tr("No power (brownout)")]
      : [
          "build",
          tr("Under construction · Stage {done}/{total}", { done, total: d.stages.length }),
        ];

  const build = () => {
    const assignment = picks.map((x) => x ?? []);
    const r = api.act((st) => buildStage(st, id, assignment));
    if (!r.ok) return api.toast(r.message, "warn");
    api.toast(r.finished ? `MCP: ${r.message}` : r.message, r.finished ? "good" : "info");
    setViewStage(null);
    announce(api, r);
  };

  const use = () => {
    const r = api.act((st) => operateDevice(st, id));
    setOutput(r.lines.length ? r.lines : [tr("No new data.")]);
    announce(api, r);
  };

  const pick = (i: number, req: Requirement, itemId: string) => {
    const need = req.count ?? 1;
    const next = [...picks];
    const have = s.inventory[itemId] ?? 0;
    next[i] = have >= need ? Array<string>(need).fill(itemId) : null;
    if (!next[i]) {
      // Top up with other candidates.
      const auto = autoAssign({ ...s, inventory: { ...s.inventory, [itemId]: 0 } }, [
        { ...req, count: need - have },
      ])[0];
      next[i] = auto ? [...Array<string>(have).fill(itemId), ...auto] : null;
    }
    setPicks(next);
  };

  const endings = endingsAt(s, id).filter(({ ending }) => endingRevealed(s, ending));
  const puzzles = DEVICE_PUZZLES[id] ?? [];
  const hasUse = deviceHasUse(id);
  const shown = d.stages[shownStage];
  const isCurrent = shownStage === current;

  return (
    <Panel
      title={`${d.name} · ${d.id}`}
      subtitle={`Tier ${d.tier} · ${room?.name ?? ""} · ${status}`}
      onClose={onClose}
      wide
    >
      <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        {/* Left column: model, status, summary */}
        <aside className="space-y-2">
          <div className="flex h-[180px] items-center justify-center rounded-sm border border-[#00FFFF]/20 bg-black/40">
            {known ? (
              <ModelPreview
                grid={previewGridFor(id, done, online)}
                cacheKey={`${id}:${done}:${online ? 1 : 0}`}
                size={170}
                rotate
                label={tr("Model {name}, stage {n} of {total}", {
                  name: d.name,
                  n: done,
                  total: d.stages.length,
                })}
              />
            ) : (
              <span className="text-2xl tracking-[0.3em] text-white/20">???</span>
            )}
          </div>
          <p
            role="status"
            className="flex items-center gap-2 rounded-sm border px-2 py-1 text-[11px]"
            style={{ borderColor: `${TONE_COLOR[tone]}55`, color: TONE_COLOR[tone] }}
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: TONE_COLOR[tone], boxShadow: `0 0 6px ${TONE_COLOR[tone]}` }}
            />
            {status}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-[10px] text-white/50">
            <dt>{tr("Power")}</dt>
            <dd className="text-right">
              {d.power < 0 ? `+${watts(-d.power)} W` : d.power > 0 ? `${watts(d.power)} W` : "—"}
            </dd>
            <dt>{tr("Room")}</dt>
            <dd className="truncate text-right">{room?.name ?? "—"}</dd>
            {d.needs.length > 0 && (
              <>
                <dt>{tr("Needs")}</dt>
                <dd className="text-right">
                  {d.needs.map((n) => (
                    <span key={n} className={isBuilt(s, n) ? "text-[#33FF33]" : "text-red-400/80"}>
                      {n}{" "}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>
          <p className="text-xs text-[#d8ffd8]/80">{d.summary}</p>
        </aside>

        {/* Right column */}
        <div className="min-w-0 space-y-3">
          {!known && (
            <div className="rounded-sm border border-white/10 p-3 text-xs text-white/60">
              <p>{tr("The blueprint is still unknown.")}</p>
              {d.needs.length > 0 && (
                <p className="mt-1">
                  {tr("Prerequisite: {devices} built.", {
                    devices: d.needs.map((n) => DEVICE_BY_ID.get(n)?.name ?? n).join(", "),
                  })}
                </p>
              )}
              <p className="mt-1">
                {tr("Or: a prototype with a focus on {axes} might recall this blueprint.", {
                  axes: dominantAxes(mkTraits(d.signature))
                    .slice(0, 2)
                    .map((a: TraitAxis) => AXIS_LABEL[a])
                    .join(" + "),
                })}
              </p>
            </div>
          )}

          {known && (
            <>
              <SectionTitle right={tr("{n}/{total} stages", { n: done, total: d.stages.length })}>
                {tr("Build stages")}
              </SectionTitle>
              <ol className="flex items-center gap-0" aria-label={tr("Build stages")}>
                {d.stages.map((st, i) => {
                  const state = i < done ? "done" : i === current ? "current" : "todo";
                  const color =
                    state === "done" ? UI.green : state === "current" ? UI.amber : "#ffffff40";
                  return (
                    <li key={i} className="flex min-w-0 flex-1 items-center last:flex-none">
                      <button
                        type="button"
                        onClick={() => setViewStage(i)}
                        aria-current={i === current ? "step" : undefined}
                        aria-pressed={shownStage === i}
                        title={`${i + 1}. ${st.name}`}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] ${FOCUS_RING}`}
                        style={{
                          borderColor: color,
                          color,
                          background: shownStage === i ? `${color}22` : "transparent",
                        }}
                      >
                        {state === "done" ? "✓" : i + 1}
                      </button>
                      {i < d.stages.length - 1 && (
                        <span
                          aria-hidden
                          className="mx-1 h-px flex-1"
                          style={{ background: i < done ? UI.green : "#ffffff22" }}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>

              {shown && (
                <div
                  className={`rounded-sm border p-2 ${isCurrent ? "border-[#FFB800]/50" : shownStage < done ? "border-[#33FF33]/30" : "border-white/10"}`}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span style={{ color: shownStage < done ? UI.green : UI.amber }}>
                      {shownStage + 1}. {shown.name}
                      {shownStage < done
                        ? ` · ${tr("done")}`
                        : isCurrent
                          ? ` · ${tr("up next")}`
                          : ""}
                    </span>
                    {shown.puzzle && (
                      <span className="text-[#00FFFF]">
                        ⌁ {PUZZLE_BY_ID.get(shown.puzzle)?.title}
                        {s.puzzles[shown.puzzle] ? " ✓" : ""}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {shown.requires.map((req, i) => {
                      const need = req.count ?? 1;
                      const have = haveForRequirement(s, req);
                      const ok = shownStage < done || have >= need;
                      const cands: ItemDef[] = isCurrent ? candidates(s, req) : [];
                      const chosen = isCurrent ? (picks[i] ?? null) : null;
                      return (
                        <li key={i} className="rounded-sm border border-white/10 p-1.5">
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="text-[#d8ffd8]">
                              {need}× {req.label}
                            </span>
                            <span
                              className={`shrink-0 tabular-nums ${ok ? "text-[#33FF33]" : "text-red-400/90"}`}
                              aria-label={tr("have {n} of {total}", {
                                n: Math.min(have, 99),
                                total: need,
                              })}
                            >
                              {shownStage < done ? "✓" : `${Math.min(have, 99)}/${need}`}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/40">{reqText(req)}</p>
                          {shownStage >= done && (
                            <Meter
                              value={Math.min(have, need)}
                              max={need}
                              color={ok ? UI.green : UI.orange}
                              label={tr("{title}: {n} of {total}", {
                                title: req.label,
                                n: have,
                                total: need,
                              })}
                              className="mt-1"
                              height={3}
                            />
                          )}
                          {isCurrent &&
                            (cands.length === 0 ? (
                              <p className="mt-1 text-[11px] text-red-400/80">
                                {tr("Nothing suitable in the inventory.")}
                              </p>
                            ) : (
                              <select
                                aria-label={tr("Part for {label}", { label: req.label })}
                                className="mt-1 w-full border border-[#33FF33]/30 bg-black px-1 py-0.5 text-xs text-[#33FF33]"
                                value={chosen?.[0] ?? ""}
                                onChange={(e) => pick(i, req, e.target.value)}
                              >
                                {!chosen && <option value="">{tr("— not enough —")}</option>}
                                {cands.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} (×{s.inventory[c.id]})
                                  </option>
                                ))}
                              </select>
                            ))}
                          {shownStage >= done && !ok && req.item && (
                            <RecipeChain lines={recipeChain(req.item, s)} />
                          )}
                        </li>
                      );
                    })}
                    {shown.requires.length === 0 && (
                      <li className="text-[11px] text-white/40">{tr("No parts needed.")}</li>
                    )}
                  </ul>
                  {isCurrent && check && (
                    <>
                      {check.blockers
                        .filter((b) => !check.itemBlockers.includes(b))
                        .map((b) => (
                          <p key={b} className="mt-1 text-xs text-red-400/90">
                            ⚠ {b}
                          </p>
                        ))}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {shown.puzzle && !s.puzzles[shown.puzzle] && (
                          <CrtButton tone="cyan" onClick={() => openPuzzle(shown.puzzle!)}>
                            {tr("Calibrate")}
                          </CrtButton>
                        )}
                        <CrtButton tone="amber" onClick={build} disabled={picks.some((x) => !x)}>
                          {tr("Build stage")}
                        </CrtButton>
                      </div>
                    </>
                  )}
                  <p className="mt-1 text-[11px] text-white/40">{shown.text}</p>
                </div>
              )}
            </>
          )}

          {built && (
            <div className="space-y-3">
              <SectionTitle>{tr("Controls")}</SectionTitle>
              <div className="flex flex-wrap gap-2">
                <CrtButton
                  tone={switched ? "red" : "green"}
                  onClick={() => api.act((st) => toggleDevice(st, id))}
                >
                  {switched ? tr("Switch off") : tr("Switch on")}
                </CrtButton>
                <CrtButton tone="amber" onClick={onPower}>
                  {tr("Power")}
                </CrtButton>
                {id === "MCP-000" && (
                  <CrtButton tone="cyan" onClick={() => onTalk("mcp")}>
                    {tr("Talk")}
                  </CrtButton>
                )}
                {online && hasUse && (
                  <CrtButton tone="cyan" onClick={use}>
                    {tr("Use")}
                  </CrtButton>
                )}
                {online && id === "PWB-001" && (
                  <CrtButton onClick={onWorkbench}>{tr("Workbench")}</CrtButton>
                )}
                {online && id === "BTK-001" && (
                  <CrtButton onClick={onInventory}>{tr("Salvage …")}</CrtButton>
                )}
                {online && id === "EXD-001" && (
                  <CrtButton
                    disabled={!droneReady(s)}
                    onClick={() => {
                      const r = api.act((st) => flyDrone(st));
                      if (r.ok) api.sound?.("drone_fly");
                      api.toast(r.message, r.ok ? "good" : "warn");
                      announce(api, { insights: r.insights });
                    }}
                  >
                    {droneReady(s)
                      ? tr("Launch drone")
                      : tr("Charging ({n} s)", {
                          n: Math.max(
                            0,
                            Math.ceil(DRONE_COOLDOWN - (s.playTime - (s.counters.drone_last ?? 0))),
                          ),
                        })}
                  </CrtButton>
                )}
              </div>
              {!online && switched && (
                <p className="text-[11px] text-red-400/80">
                  {starved?.reason === "hitze"
                    ? tr("Tier-3 devices need the Thermal Manager (THM-001) online.")
                    : k(
                        tr(
                          "Not enough power — switch off consumers or build sources in the Power Panel ({key:power}).",
                        ),
                      )}
                </p>
              )}
              {online && puzzles.length > 0 && (
                <div className="space-y-1">
                  <SectionTitle accent={UI.cyan}>{tr("Tasks at the device")}</SectionTitle>
                  {puzzles.map((pz) => {
                    const ok = evalCond(s, pz.requires);
                    const solved = !!s.puzzles[pz.puzzle];
                    return (
                      <div
                        key={pz.puzzle}
                        className="flex items-center justify-between gap-2 rounded-sm border border-white/10 px-2 py-1 text-xs"
                      >
                        <span className={solved ? "text-[#33FF33]" : "text-[#d8ffd8]"}>
                          {solved ? "✓ " : ""}
                          {pz.label}
                          {!solved && !ok && pz.hint && (
                            <span className="block text-[11px] text-white/40">{pz.hint}</span>
                          )}
                        </span>
                        {!solved && (
                          <CrtButton
                            tone="cyan"
                            disabled={!ok}
                            title={ok ? "" : pz.hint}
                            onClick={() => openPuzzle(pz.puzzle)}
                          >
                            {ok ? tr("Start") : tr("blocked")}
                          </CrtButton>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {online && id === "DGN-001" && (
                <p className="rounded-sm border border-[#33FF33]/30 p-2 text-xs">
                  {tr("DIAGNOSIS: {hint}", { hint: hint(s) })}
                </p>
              )}
              {online && id === "P3D-001" && (
                <div>
                  <p className="mb-1 text-xs text-[#FFB800]">
                    {tr("Print (1× Base Alloy per part, in stock: {n})", {
                      n: s.inventory.basislegierung ?? 0,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {fabricable(s).map((it) => (
                      <ItemChip
                        key={it.id}
                        item={it}
                        onClick={() => {
                          const r = api.act((st) => fabricate(st, it.id));
                          api.toast(r.message, r.ok ? "good" : "warn");
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {output.length > 0 && (
                <div
                  role="log"
                  className="space-y-1 rounded-sm border border-[#00FFFF]/30 p-2 text-xs text-[#aefcff]"
                >
                  {output.map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <PrototypeUse api={api} target={id} onUse={onProto} />

          {endings.map(({ ending, ready }) =>
            s.endings[ending.id] ? (
              <p key={ending.id} className="text-xs text-[#33FF33]">
                {tr("✓ Ending reached: {title}", { title: ending.title })}
              </p>
            ) : (
              <div key={ending.id} className="rounded-sm border border-[#E8F4FF]/30 p-2">
                <p className="text-xs text-[#E8F4FF]">
                  {ready
                    ? ending.prompt
                    : tr("A path to Damien lies here. Something is still missing:")}
                </p>
                {!ready && <Missing cond={ending.requires} s={s} />}
                {ready && (
                  <CrtButton tone="cyan" className="mt-2" onClick={() => onEnding(ending.id)}>
                    {ending.title}
                  </CrtButton>
                )}
              </div>
            ),
          )}
        </div>
      </div>
    </Panel>
  );
}

export const DevicePanel = memoPanel(DevicePanelImpl);
