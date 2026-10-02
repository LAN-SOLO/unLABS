"use client";

import { useEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import {
  CrtButton,
  FilterChip,
  INPUT_CLASS,
  Meter,
  Panel,
  SectionTitle,
  UI,
} from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { doorInfo, knownDoors, setDoorMode, type DoorMode } from "@/lib/world/doors/lock";
import { FLOORS_TOP_DOWN, ROOMS } from "@/lib/world/content/map";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { dutiesOf, DUTY_BY_ID } from "@/lib/world/content/bot-duties";
import { BOT_IDS } from "@/lib/world/models/characters";
import { hasCamera } from "@/lib/world/content/interior";
import { MAX_LEVEL } from "@/lib/world/ops/state";
import {
  botAwake,
  botName,
  canUpgrade,
  runDuty,
  surveillanceIssues,
  upgradeBot,
  upgradeCost,
  WORN,
} from "@/lib/world/ops/bots";
import {
  combineRoutines,
  describeStep,
  expandRoutine,
  forgetRoutine,
  runRoutine,
  setRoutineAuto,
  startRecording,
  stopRecording,
} from "@/lib/world/ops/routines";
import { addTask, removeTask, updateTask } from "@/lib/world/ops/schedule";
import type { OpsTask, Routine, WorldState } from "@/lib/world/types";

/**
 * The surveillance station (Control Room, docs/OPS.md): live feeds of the
 * moving camera in every room, what needs attention, Jade's routines
 * (record, combine, run, habits), the task schedule for Jade and the bots,
 * and the bot roster (duties from the design database, wear, service,
 * upgrades).
 */
type Tab = "cams" | "routines" | "schedule" | "bots" | "doors";

const EVERY_OPTIONS: readonly { s: number; label: () => string }[] = [
  { s: 0, label: () => tr("once") },
  { s: 300, label: () => tr("every 5 min") },
  { s: 900, label: () => tr("every 15 min") },
  { s: 1800, label: () => tr("every 30 min") },
  { s: 3600, label: () => tr("every hour") },
];

function clock(sec: number): string {
  const m = Math.max(0, Math.round(sec));
  if (m >= 3600)
    return `${Math.floor(m / 3600)}h ${String(Math.floor((m % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function agentName(who: string): string {
  return who === "jade" ? "Jade" : botName(who);
}

function taskLabel(s: WorldState, t: OpsTask): string {
  if (t.what.kind === "routine")
    return s.ops.routines.find((r) => r.id === t.what.id)?.name ?? t.what.id;
  const d = DUTY_BY_ID.get(t.what.id);
  const arg = t.arg ? s.ops.routines.find((r) => r.id === t.arg)?.name : undefined;
  return `${d?.label ?? t.what.id}${arg ? ` · ${arg}` : ""}`;
}

export function OpsPanel({
  api,
  onClose,
  camFeed,
}: {
  api: WorldApi;
  onClose: () => void;
  /** Engine hook: render a room's camera into the canvas (false = no signal). */
  camFeed?: (roomId: string, canvas: HTMLCanvasElement) => boolean;
}) {
  const s = api.get();
  const [tab, setTab] = useState<Tab>("cams");
  return (
    <Panel
      title={tr("Surveillance Station")}
      subtitle={tr("Every room, every routine, every bot")}
      onClose={onClose}
      wide
      accent={UI.cyan}
    >
      <div role="tablist" className="mb-3 flex flex-wrap gap-2">
        <FilterChip active={tab === "cams"} onClick={() => setTab("cams")} accent={UI.cyan}>
          {tr("Cameras")}
        </FilterChip>
        <FilterChip
          active={tab === "routines"}
          onClick={() => setTab("routines")}
          accent={UI.cyan}
          count={s.ops.routines.length}
        >
          {tr("Routines")}
        </FilterChip>
        <FilterChip
          active={tab === "schedule"}
          onClick={() => setTab("schedule")}
          accent={UI.cyan}
          count={s.ops.tasks.length}
        >
          {tr("Schedule")}
        </FilterChip>
        <FilterChip active={tab === "bots"} onClick={() => setTab("bots")} accent={UI.cyan}>
          {tr("Bots")}
        </FilterChip>
        <FilterChip active={tab === "doors"} onClick={() => setTab("doors")} accent={UI.cyan}>
          {tr("Doors")}
        </FilterChip>
      </div>
      {tab === "cams" && <Cams api={api} camFeed={camFeed} />}
      {tab === "routines" && <Routines api={api} />}
      {tab === "schedule" && <Schedule api={api} />}
      {tab === "bots" && <Bots api={api} />}
      {tab === "doors" && <Doors api={api} />}
    </Panel>
  );
}

// ── Cameras ──────────────────────────────────────────────────────

function Cams({
  api,
  camFeed,
}: {
  api: WorldApi;
  camFeed?: (r: string, c: HTMLCanvasElement) => boolean;
}) {
  const s = api.get();
  const [room, setRoom] = useState<string>("kontroll");
  const [signal, setSignal] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !camFeed) return;
    const draw = () => setSignal(camFeed(room, c));
    draw();
    const id = window.setInterval(draw, 200);
    return () => window.clearInterval(id);
  }, [room, camFeed]);
  const issues = surveillanceIssues(s);
  const name = ROOMS.find((r) => r.id === room)?.name ?? room;
  return (
    <div className="grid gap-4 text-xs md:grid-cols-[1fr_15rem]">
      <div>
        <div className="relative overflow-hidden rounded-sm border border-white/10 bg-black">
          <canvas
            ref={canvas}
            width={384}
            height={216}
            className="block aspect-video w-full [image-rendering:pixelated]"
            style={{
              filter:
                "grayscale(0.55) sepia(0.35) hue-rotate(60deg) brightness(1.35) contrast(1.15)",
            }}
            aria-label={tr("Camera feed: {room}", { room: name })}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 1px, transparent 1px, transparent 3px)",
            }}
          />
          <span className="absolute top-1 left-2 text-[10px] tracking-widest text-white/80">
            CAM · {name}
          </span>
          <span className="absolute top-1 right-2 animate-pulse text-[10px] text-red-500 motion-reduce:animate-none">
            ● REC
          </span>
          {!signal && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white/50">
              {tr("No signal — nobody has been on this level yet.")}
            </div>
          )}
        </div>
        <SectionTitle accent={UI.cyan}>{tr("Needs attention")}</SectionTitle>
        {issues.length === 0 ? (
          <p className="text-white/40">{tr("All cameras quiet.")}</p>
        ) : (
          <ul className="space-y-0.5 text-[#FFB800]">
            {issues.slice(0, 12).map((x) => (
              <li key={x}>▸ {x}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
        {FLOORS_TOP_DOWN.map((f) => (
          <div key={f.id}>
            <SectionTitle accent={UI.cyan}>{f.name}</SectionTitle>
            <div className="flex flex-wrap gap-1">
              {ROOMS.filter((r) => r.floor === f.id && hasCamera(r.id)).map((r) => (
                <FilterChip
                  key={r.id}
                  role="button"
                  active={room === r.id}
                  onClick={() => setRoom(r.id)}
                  accent={UI.cyan}
                >
                  {r.name}
                </FilterChip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Routines ─────────────────────────────────────────────────────

const SOURCE_LABEL: Record<Routine["source"], () => string> = {
  recorded: () => tr("recorded"),
  learned: () => tr("habit"),
  combined: () => tr("combined"),
};

function Routines({ api }: { api: WorldApi }) {
  const s = api.get();
  const [name, setName] = useState("");
  const [pick, setPick] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [out, setOut] = useState<string[]>([]);
  const recording = s.ops.recording;
  const run = (id: string) => {
    const r = api.act((st) => runRoutine(st, id));
    setOut(r.lines);
    api.toast(
      tr("Jade ran the routine: {done}/{total} steps.", { done: r.done, total: r.total }),
      r.ok ? "good" : "warn",
    );
  };
  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-sm border border-white/10 p-2">
        <SectionTitle accent={UI.cyan}>{tr("Record a routine")}</SectionTitle>
        {recording ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="animate-pulse text-red-500 motion-reduce:animate-none">●</span>
            <span>
              {tr("Recording — {n} steps so far. Play on; close this panel.", {
                n: recording.length,
              })}
            </span>
            <input
              className={INPUT_CLASS}
              value={name}
              placeholder={tr("Name")}
              aria-label={tr("Routine name")}
              onChange={(e) => setName(e.target.value)}
            />
            <CrtButton
              tone="green"
              onClick={() => {
                const r = api.act((st) =>
                  stopRecording(st, name || tr("Routine {n}", { n: st.ops.next })),
                );
                setName("");
                if (r) api.toast(tr("Jade memorised “{name}”.", { name: r.name }), "good");
              }}
            >
              {tr("Stop & keep")}
            </CrtButton>
            <CrtButton tone="red" onClick={() => api.act((st) => stopRecording(st))}>
              {tr("Discard")}
            </CrtButton>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-white/55">
              {tr(
                "Jade notes every step you take. Do something three times and she knows it by heart.",
              )}
            </span>
            <CrtButton tone="red" onClick={() => api.act((st) => startRecording(st))}>
              {tr("● Record")}
            </CrtButton>
          </div>
        )}
      </div>

      {s.ops.routines.length === 0 ? (
        <p className="text-white/40">{tr("No routines yet.")}</p>
      ) : (
        <ul className="space-y-1">
          {s.ops.routines.map((r) => {
            const steps = expandRoutine(s, r.id);
            return (
              <li key={r.id} className="rounded-sm border border-white/10 px-2 py-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pick.includes(r.id)}
                      onChange={(e) =>
                        setPick((p) =>
                          e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id),
                        )
                      }
                      aria-label={tr("Select for combining")}
                    />
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                    >
                      {r.name}
                    </button>
                    <span className="text-white/35">
                      {SOURCE_LABEL[r.source]()} · {tr("{n} steps", { n: steps.length })} ·{" "}
                      {tr("{n}× used", { n: r.uses })}
                    </span>
                  </label>
                  <span className="flex gap-1">
                    <CrtButton tone="green" onClick={() => run(r.id)}>
                      {tr("Run")}
                    </CrtButton>
                    <CrtButton
                      tone={r.auto ? "cyan" : "amber"}
                      onClick={() => api.act((st) => setRoutineAuto(st, r.id, !r.auto))}
                      title={tr("Habit: Jade finishes it herself when you start it")}
                    >
                      {r.auto ? tr("Auto on") : tr("Auto off")}
                    </CrtButton>
                    <CrtButton tone="red" onClick={() => api.act((st) => forgetRoutine(st, r.id))}>
                      {tr("Forget")}
                    </CrtButton>
                  </span>
                </div>
                {open === r.id && (
                  <ol className="mt-1 list-decimal pl-6 text-white/60">
                    {steps.map((st, i) => (
                      <li key={i}>{describeStep(st, s)}</li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {pick.length >= 2 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={INPUT_CLASS}
            value={name}
            placeholder={tr("Name of the combination")}
            aria-label={tr("Name of the combination")}
            onChange={(e) => setName(e.target.value)}
          />
          <CrtButton
            tone="cyan"
            onClick={() => {
              const r = api.act((st) => combineRoutines(st, pick, name));
              if (!r) return api.toast(tr("These routines cannot be combined."), "warn");
              setPick([]);
              setName("");
              api.toast(tr("Combined: “{name}”.", { name: r.name }), "good");
            }}
          >
            {tr("Combine {n} in this order", { n: pick.length })}
          </CrtButton>
        </div>
      )}
      {out.length > 0 && (
        <pre className="max-h-40 overflow-y-auto rounded-sm bg-black/50 p-2 whitespace-pre-wrap text-white/70">
          {out.join("\n")}
        </pre>
      )}
      {s.ops.log.length > 0 && (
        <div>
          <SectionTitle accent={UI.cyan}>{tr("Last steps")}</SectionTitle>
          <p className="text-white/45">
            {s.ops.log
              .slice(-8)
              .map((x) => describeStep(x, s))
              .join(" → ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Schedule ─────────────────────────────────────────────────────

function Schedule({ api }: { api: WorldApi }) {
  const s = api.get();
  // The state is mutated in place (no memo: it would go stale).
  const agents = ["jade", ...BOT_IDS.filter((b) => botAwake(s, b))];
  const [who, setWho] = useState("jade");
  const options =
    who === "jade"
      ? s.ops.routines.map((r) => ({ v: `routine:${r.id}`, label: r.name }))
      : dutiesOf(who)
          .filter((d) => !d.ownSchedule)
          .map((d) => ({ v: `duty:${d.id}`, label: d.label }));
  const [what, setWhat] = useState("");
  const [arg, setArg] = useState("");
  const [every, setEvery] = useState(0);
  const [prio, setPrio] = useState(5);
  const chosen = what || options[0]?.v || "";
  const needsRoutine =
    chosen.startsWith("duty:") && DUTY_BY_ID.get(chosen.slice(5))?.effect === "macro";
  const tasks = [...s.ops.tasks].sort((a, b) => b.priority - a.priority || a.at - b.at);
  const add = () => {
    const [kind, id] = chosen.split(":") as ["routine" | "duty", string];
    const t = api.act((st) =>
      addTask(st, { who, what: { kind, id }, every, priority: prio, ...(arg ? { arg } : {}) }),
    );
    if (!t) api.toast(tr("That task cannot be planned."), "warn");
  };
  return (
    <div className="space-y-3 text-xs">
      <p className="text-white/55">
        {tr(
          "Tasks run on the play clock, highest priority first — one per agent at a time. During a long pause Jade works off her own queue before she rests.",
        )}
      </p>
      {tasks.length === 0 ? (
        <p className="text-white/40">{tr("Nothing planned.")}</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => {
            const own = t.what.kind === "duty" && DUTY_BY_ID.get(t.what.id)?.ownSchedule;
            return (
              <li
                key={t.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-sm border border-white/10 px-2 py-1 ${t.off ? "opacity-50" : ""}`}
              >
                <span>
                  <span className="text-[#00D4FF]">{agentName(t.who)}</span> · {taskLabel(s, t)}
                  <span className="ml-2 text-white/35">
                    {t.at <= s.playTime ? tr("due") : tr("in {t}", { t: clock(t.at - s.playTime) })}
                    {t.every ? ` · ↻ ${clock(t.every)}` : ""} · P{t.priority}
                  </span>
                  {t.lastResult && <span className="block text-white/35">{t.lastResult}</span>}
                </span>
                <span className="flex gap-1">
                  <CrtButton
                    tone="amber"
                    onClick={() =>
                      api.act((st) => updateTask(st, t.id, { priority: t.priority - 1 }))
                    }
                    aria-label={tr("Lower priority")}
                  >
                    −
                  </CrtButton>
                  <CrtButton
                    tone="amber"
                    onClick={() =>
                      api.act((st) => updateTask(st, t.id, { priority: t.priority + 1 }))
                    }
                    aria-label={tr("Raise priority")}
                  >
                    +
                  </CrtButton>
                  <CrtButton
                    tone="cyan"
                    onClick={() => api.act((st) => updateTask(st, t.id, { in: 0 }))}
                  >
                    {tr("Now")}
                  </CrtButton>
                  <CrtButton
                    tone={t.off ? "green" : "amber"}
                    onClick={() => api.act((st) => updateTask(st, t.id, { off: !t.off }))}
                  >
                    {t.off ? tr("Resume") : tr("Hold")}
                  </CrtButton>
                  {!own && (
                    <CrtButton tone="red" onClick={() => api.act((st) => removeTask(st, t.id))}>
                      {tr("Remove")}
                    </CrtButton>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
        <select
          className={INPUT_CLASS}
          value={who}
          onChange={(e) => (setWho(e.target.value), setWhat(""))}
          aria-label={tr("Who")}
        >
          {agents.map((a) => (
            <option key={a} value={a}>
              {agentName(a)}
            </option>
          ))}
        </select>
        <select
          className={INPUT_CLASS}
          value={chosen}
          onChange={(e) => setWhat(e.target.value)}
          aria-label={tr("Task")}
        >
          {options.length === 0 && <option value="">{tr("— record a routine first —")}</option>}
          {options.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
        {needsRoutine && (
          <select
            className={INPUT_CLASS}
            value={arg}
            onChange={(e) => setArg(e.target.value)}
            aria-label={tr("Routine")}
          >
            <option value="">{tr("— which routine —")}</option>
            {s.ops.routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        <select
          className={INPUT_CLASS}
          value={every}
          onChange={(e) => setEvery(Number(e.target.value))}
          aria-label={tr("Repeat")}
        >
          {EVERY_OPTIONS.map((o) => (
            <option key={o.s} value={o.s}>
              {o.label()}
            </option>
          ))}
        </select>
        <select
          className={INPUT_CLASS}
          value={prio}
          onChange={(e) => setPrio(Number(e.target.value))}
          aria-label={tr("Priority")}
        >
          {[9, 7, 5, 3, 1].map((p) => (
            <option key={p} value={p}>
              P{p}
            </option>
          ))}
        </select>
        <CrtButton tone="green" disabled={!chosen} onClick={add}>
          {tr("Plan")}
        </CrtButton>
      </div>
    </div>
  );
}

// ── Bots ─────────────────────────────────────────────────────────

function Bots({ api }: { api: WorldApi }) {
  const s = api.get();
  return (
    <ul className="grid gap-2 text-xs md:grid-cols-2">
      {BOT_IDS.map((b) => {
        const awake = botAwake(s, b);
        const o = s.ops.bots[b] ?? { level: 0, wear: 0, runs: 0, serviced: 0 };
        const cost = awake ? upgradeCost(s, b) : null;
        return (
          <li
            key={b}
            className={`rounded-sm border border-white/10 p-2 ${awake ? "" : "opacity-45"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[#00D4FF]">
                {botName(b)} {"◆".repeat(o.level)}
                {"◇".repeat(MAX_LEVEL - o.level)}
              </span>
              <span className="text-white/35">
                {awake ? tr("{n} runs", { n: o.runs }) : tr("dormant")}
              </span>
            </div>
            {dutiesOf(b).map((d) => (
              <p key={d.id} className="mt-1">
                <span className="text-white/80">{d.label}</span> —{" "}
                <span className="text-white/55">{d.blurb}</span>
                <span className="block text-[10px] text-white/30">{d.source}</span>
              </p>
            ))}
            {awake && (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-12 text-white/45">{tr("Wear")}</span>
                  <Meter
                    value={o.wear}
                    max={WORN}
                    label={tr("Wear")}
                    color={o.wear >= 80 ? UI.red : o.wear >= 50 ? UI.amber : UI.green}
                  />
                  <CrtButton
                    tone="green"
                    onClick={() => {
                      const r = api.act((st) => runDuty(st, `${b}_service`));
                      api.toast(r.text, r.ok ? "good" : "warn");
                    }}
                  >
                    {tr("Service")}
                  </CrtButton>
                </div>
                {cost && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-white/45">
                      {tr("Upgrade to {n}:", { n: o.level + 1 })}{" "}
                      {Object.entries(cost)
                        .map(
                          ([id, n]) =>
                            `${n}× ${ITEM_BY_ID.get(id)?.name ?? id} (${s.inventory[id] ?? 0})`,
                        )
                        .join(", ")}
                    </span>
                    <CrtButton
                      tone="cyan"
                      disabled={!canUpgrade(s, b)}
                      onClick={() => {
                        const r = api.act((st) => upgradeBot(st, b));
                        api.toast(r.text, r.ok ? "good" : "warn");
                      }}
                    >
                      {tr("Upgrade")}
                    </CrtButton>
                  </div>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Doors (lock system) ──────────────────────────────────────────

function Doors({ api }: { api: WorldApi }) {
  const s = api.get();
  const set = (id: string, mode: DoorMode) => {
    const d = knownDoors(s).find((x) => x.id === id);
    if (!d) return;
    const r = api.act((st) => setDoorMode(st, d, mode));
    if (!r.ok) api.toast(r.text, "warn");
  };
  return (
    <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1 text-xs">
      <p className="text-white/55">
        {tr(
          "The lock system: every door has its own mechanism and an interface on its jamb. Sealed doors stay shut until you open them here or at the door.",
        )}
      </p>
      {FLOORS_TOP_DOWN.map((f) => {
        const doors = knownDoors(s, f.id);
        if (!doors.length) return null;
        return (
          <div key={f.id}>
            <SectionTitle accent={UI.cyan}>{f.name}</SectionTitle>
            <ul className="space-y-1">
              {doors.map((d) => {
                const i = doorInfo(s, d);
                const color =
                  !i.open || i.mode === "sealed" ? UI.red : i.mode === "hold" ? UI.cyan : UI.green;
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-white/10 px-2 py-1"
                  >
                    <span>
                      <span style={{ color }}>■</span> {i.name}
                      <span className="ml-2 text-white/35">
                        {i.mech} · {i.shape} · {tr("{n}× opened", { n: i.opens })}
                      </span>
                    </span>
                    <span className="flex gap-1">
                      <CrtButton
                        tone={i.mode === "auto" ? "green" : "amber"}
                        onClick={() => set(d.id, "auto")}
                      >
                        {tr("Auto")}
                      </CrtButton>
                      <CrtButton
                        tone={i.mode === "hold" ? "cyan" : "amber"}
                        disabled={!i.open || i.airlock}
                        onClick={() => set(d.id, "hold")}
                      >
                        {tr("Open")}
                      </CrtButton>
                      <CrtButton
                        tone={i.mode === "sealed" ? "red" : "amber"}
                        onClick={() => set(d.id, "sealed")}
                      >
                        {tr("Seal")}
                      </CrtButton>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
