"use client";

import { fmtNum } from "@/components/world/format";

import { tr } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { CrtButton, Meter, Panel, SectionTitle, UI } from "@/components/world/ui";
import { memoPanel, type WorldApi } from "@/components/world/panels/shared";
import {
  brownoutOrder,
  consumerRows,
  lightRows,
  pushSample,
  type PowerSample,
} from "@/components/world/panels/derive";
import { DEVICE_BY_ID, NEEDS_COOLING } from "@/lib/world/content/devices";
import { power, toggleDevice, type PowerStatus } from "@/lib/world/game";

/** Session history of generation vs. load (survives closing the panel). */
let history: PowerSample[] = [];

/** Take one sample now (wall-clock seconds; same second overwrites). */
export function samplePower(p: PowerStatus, now = Date.now()): readonly PowerSample[] {
  history = pushSample(history, {
    t: Math.floor(now / 1000),
    generation: p.generation,
    demand: p.demand,
  });
  return history;
}

export function _resetPowerHistory(): void {
  history = [];
}

/** Line graph of generation (green) and load (amber). */
export function PowerGraph({
  samples,
  width = 320,
  height = 84,
}: {
  samples: readonly PowerSample[];
  width?: number;
  height?: number;
}) {
  const top = Math.max(10, ...samples.map((x) => Math.max(x.generation, x.demand))) * 1.15;
  const n = Math.max(2, samples.length);
  const x = (i: number) => (i / (n - 1)) * width;
  const y = (v: number) => height - (v / top) * (height - 4) - 2;
  const line = (key: "generation" | "demand") =>
    samples.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const last = samples[samples.length - 1];
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        last
          ? tr("History: generation {gen} W, load {load} W", {
              gen: last.generation,
              load: last.demand,
            })
          : tr("No history yet")
      }
      className="block rounded-sm border border-white/10 bg-black/40"
    >
      {[0.25, 0.5, 0.75].map((k) => (
        <line
          key={k}
          x1={0}
          x2={width}
          y1={height * k}
          y2={height * k}
          stroke="#ffffff10"
          strokeWidth={1}
        />
      ))}
      {samples.length > 1 && (
        <>
          <polyline
            points={`0,${height} ${line("generation")} ${width},${height}`}
            fill={`${UI.green}14`}
            stroke="none"
          />
          <polyline
            points={line("generation")}
            fill="none"
            stroke={UI.green}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={line("demand")}
            fill="none"
            stroke={UI.amber}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}

function PowerPanelImpl({ api, onClose }: { api: WorldApi; onClose: () => void }) {
  const s = api.get();
  const version = api.version;
  const p = power(s);
  const [samples, setSamples] = useState<readonly PowerSample[]>(() => history);

  // Sample once a second while the panel is open.
  useEffect(() => {
    const tick = () => setSamples([...samplePower(power(api.get()))]);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [api]);

  const rows = useMemo(
    () => consumerRows(s, p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, p, version],
  );
  const order = brownoutOrder(rows);
  const lights = lightRows(s, p);
  const reserve = Math.round((p.generation - p.demand) * 10) / 10;
  const load = p.generation > 0 ? p.demand / p.generation : p.demand > 0 ? 1 : 0;
  const loadColor = load > 0.9 ? UI.red : load > 0.7 ? UI.orange : UI.green;
  const baseLight = p.generation >= 50;

  return (
    <Panel
      title={tr("Power · load distribution")}
      subtitle={tr("Generation {gen} W · Load {load} W · Reserve {reserve} W", {
        gen: fmtNum(p.generation, 1),
        load: fmtNum(p.demand, 1),
        reserve: fmtNum(reserve, 1),
      })}
      onClose={onClose}
      wide
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-3">
          <div>
            <SectionTitle right={tr("{pct} % utilisation", { pct: Math.round(load * 100) })}>
              {tr("Balance")}
            </SectionTitle>
            <Meter
              value={p.demand}
              max={Math.max(p.generation, p.demand, 1)}
              color={loadColor}
              label={tr("Load {load} of {gen} W", { load: p.demand, gen: p.generation })}
              height={8}
            />
            <div className="mt-2">
              <PowerGraph samples={samples} />
              <div className="mt-1 flex gap-3 text-[10px] text-white/50">
                <span>
                  <span style={{ color: UI.green }}>━</span> {tr("Generation")}
                </span>
                <span>
                  <span style={{ color: UI.amber }}>┅</span> {tr("power::Load")}
                </span>
                <span className="ml-auto">{tr("last {n} s", { n: samples.length })}</span>
              </div>
            </div>
          </div>

          <div>
            <SectionTitle>{tr("Sources")}</SectionTitle>
            <ul className="text-xs">
              {p.sources.map((x) => (
                <li key={x.label} className="flex justify-between gap-2">
                  <span className="truncate">{x.label}</span>
                  <span className="shrink-0 text-[#33FF33] tabular-nums">+{x.watts} W</span>
                </li>
              ))}
              {p.sources.length === 0 && (
                <li className="text-white/40">
                  {tr("None. Check the geothermal distributor on Level −1.")}
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-sm border border-[#FFB800]/25 p-2 text-[11px] text-white/60">
            <SectionTitle>{tr("Brownout")}</SectionTitle>
            <p>
              {tr(
                "If generation falls short, the grid supplies in a fixed priority: the MCP first, then the battery buffer, power plant and cooling, then all other devices in catalogue order. Whatever no longer fits stays dark — tier-3 devices also without the Thermal Manager.",
              )}
            </p>
            {order.length > 0 && (
              <p className="mt-1">
                {tr("First to go dark:")}{" "}
                {order.slice(0, 3).map((r, i) => (
                  <span key={r.device.id} className="text-[#FF6B00]">
                    {i > 0 ? " → " : ""}
                    {r.device.name}
                  </span>
                ))}
              </p>
            )}
          </div>

          <div>
            <SectionTitle right={baseLight ? tr("Base light on") : tr("Emergency light")}>
              {tr("Room lighting")}
            </SectionTitle>
            <ul className="space-y-0.5 text-xs">
              <li className="flex justify-between">
                <span>{tr("Base lighting (from 50 W)")}</span>
                <span className={baseLight ? "text-[#33FF33]" : "text-red-400"}>
                  {baseLight ? tr("on") : tr("red")}
                </span>
              </li>
              {lights.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className={l.visited ? "" : "text-white/40"}>
                    {l.visited ? l.name : tr("Unknown room")}
                    <span className="ml-1 text-white/30">
                      · {DEVICE_BY_ID.get(l.by ?? "")?.name ?? l.by}
                    </span>
                  </span>
                  <span className={l.lit ? "text-[#33FF33]" : "text-white/40"}>
                    {l.lit ? tr("lit") : tr("dark")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="min-w-0">
          <SectionTitle
            right={tr("{n}/{total} online", {
              n: rows.filter((r) => r.online).length,
              total: rows.length,
            })}
          >
            {tr("Consumers (priority from the top)")}
          </SectionTitle>
          <ul className="space-y-1 text-xs">
            {rows.map((r) => {
              const d = r.device;
              const share = p.generation > 0 ? d.power / p.generation : 0;
              return (
                <li
                  key={d.id}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-white/5 px-1.5 py-1"
                >
                  <span className="text-right text-[10px] text-white/35 tabular-nums">
                    {r.priority}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${r.online ? "text-[#d8ffd8]" : "text-white/40"}`}>
                        {d.name}
                        {NEEDS_COOLING(d) && (
                          <span
                            className="ml-1 text-[9px] text-[#00FFFF]/60"
                            title={tr("needs cooling")}
                          >
                            ❄
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[10px] text-white/45 tabular-nums">
                        {fmtNum(d.power, Number.isInteger(d.power) ? 0 : 1)} W
                      </span>
                    </div>
                    <Meter
                      value={r.online ? share : 0}
                      max={1}
                      color={r.online ? UI.amber : "#ffffff22"}
                      label={`${d.name}: ${fmtNum(d.power, Number.isInteger(d.power) ? 0 : 1)} W`}
                      height={2}
                      className="mt-0.5"
                    />
                    {r.starved && (
                      <span className="text-[10px] text-red-400">
                        {r.starved === "hitze"
                          ? tr("overheated — THM-001 missing")
                          : tr("no power")}
                      </span>
                    )}
                  </div>
                  <CrtButton
                    tone={r.switchedOn ? "green" : "red"}
                    aria-pressed={r.switchedOn}
                    aria-label={
                      r.switchedOn
                        ? tr("Switch off {name}", { name: d.name })
                        : tr("Switch on {name}", { name: d.name })
                    }
                    onClick={() => api.act((w) => toggleDevice(w, d.id))}
                  >
                    {r.switchedOn ? tr("on") : tr("off")}
                  </CrtButton>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li className="text-white/40">{tr("No consumers built yet.")}</li>
            )}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

export const PowerPanel = memoPanel(PowerPanelImpl);
