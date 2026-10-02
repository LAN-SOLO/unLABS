"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, FOCUS_RING, INPUT_CLASS, Panel, SectionTitle, UI } from "@/components/world/ui";
import { announce, memoPanel, type WorldApi } from "@/components/world/panels/shared";
import { RememberButton } from "@/components/world/knowledge/Remember";
import { trackAction } from "@/components/world/ops/track";
import { WidgetView, useUiClock, type WidgetHost } from "@/components/world/device-ui/widgets";
import { deviceUi, type UiAction, type UiCtx } from "@/lib/world/device-ui";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { HUB_BY_ID, BUS_LABEL } from "@/lib/world/content/links";
import { TIER_LABEL, visitSpot, type SpotView } from "@/lib/world/archive";
import {
  FLASH_PHASES,
  FLASH_PHASE_MS,
  features,
  installedImage,
  installedVersion,
  isUpdated,
  manifestOf,
  type FlashPhase,
} from "@/lib/world/firmware";
import {
  canLink,
  flashFirmware,
  linkCandidates,
  linkDevice,
  remoteToggle,
  rollbackFirmware,
  unlinkDevice,
  updateCheck,
} from "@/lib/world/device-ops";
import { hubsOf, linksOf } from "@/lib/world/links";
import {
  deviceHasUse,
  droneReady,
  flyDrone,
  isOnline,
  isSwitchedOn,
  operateDevice,
  power,
  toggleDevice,
} from "@/lib/world/game";
import type { WorldState } from "@/lib/world/types";

const FONT_CLASS: Record<string, string> = {
  mono: "font-mono",
  lcd: "font-mono tracking-wider",
  vfd: "font-mono tracking-[0.15em]",
  nixie: "font-mono tracking-[0.2em]",
  crt: "font-mono",
};

const PHASE_LABEL: Record<FlashPhase, string> = {
  checking: tr("fw::checking"),
  downloading: tr("fw::downloading"),
  verifying: tr("fw::verifying"),
  flashing: tr("fw::flashing"),
  rebooting: tr("fw::rebooting"),
};

function DeviceInterfaceImpl({
  id,
  api,
  onClose,
  onService,
  onTalk,
  onWorkbench,
  onInventory,
  onPower,
}: {
  id: string;
  api: WorldApi;
  onClose: () => void;
  /** Open the service view (build stages, tasks, endings). */
  onService: () => void;
  onTalk: (npc: string) => void;
  onWorkbench: () => void;
  onInventory: () => void;
  onPower: () => void;
}) {
  const s = api.get();
  const spec = deviceUi(id);
  const d = DEVICE_BY_ID.get(id);
  const p = power(s);
  const online = p.online.has(id);
  const switched = isSwitchedOn(s, id);
  const hub = HUB_BY_ID.get(id);
  const [page, setPage] = useState<string>(spec.pages[0]?.id ?? "info");
  const [output, setOutput] = useState<string[]>([]);
  const t = useUiClock(online);
  const [booted, setBooted] = useState(!online || spec.boot.length === 0);
  useEffect(() => {
    if (booted) return;
    const tm = window.setTimeout(() => setBooted(true), 350 * spec.boot.length + 300);
    return () => window.clearTimeout(tm);
  }, [booted, spec.boot.length]);

  const ctx: UiCtx = useMemo(
    () => ({
      s,
      id,
      power: p,
      online,
      t,
      get: (key, fallback = 0) => s.tuning[`${id}.${key}`] ?? fallback,
    }),
    // `api.version` covers every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, id, p, online, t, api.version],
  );

  const onAction = (a: UiAction) => {
    switch (a) {
      case "use": {
        const r = api.act((st) => operateDevice(st, id));
        setOutput(r.lines.length ? r.lines : [tr("No new data.")]);
        announce(api, r);
        trackAction(api, { kind: "use", id });
        setPage("info");
        return;
      }
      case "talk":
        return onTalk("mcp");
      case "workbench":
        return onWorkbench();
      case "salvage":
        return onInventory();
      case "drone": {
        const r = api.act((st) => flyDrone(st));
        if (r.ok) api.sound?.("drone_fly");
        api.toast(r.message, r.ok ? "good" : "warn");
        announce(api, { insights: r.insights });
        if (r.ok) trackAction(api, { kind: "drone", id: "drone" });
        return;
      }
      case "power":
        return onPower();
      case "fabricate":
      case "hint":
      case "service":
        return onService();
    }
  };

  const host: WidgetHost = {
    ctx,
    accent: spec.accent,
    font: FONT_CLASS[spec.font] ?? "font-mono",
    setTuning: (key, value) =>
      api.act((st: WorldState) => {
        st.tuning[`${id}.${key}`] = value;
      }),
    onAction,
  };

  const tabs: { id: string; label: string }[] = [
    ...spec.pages.map((pg) => ({ id: pg.id, label: pg.label })),
    ...(hub ? [{ id: "links", label: tr("tab::Links") }] : []),
    ...(manifestOf(id) ? [{ id: "firmware", label: tr("tab::Firmware") }] : []),
    { id: "info", label: tr("tab::Info") },
  ];
  const own = spec.pages.find((pg) => pg.id === page);

  return (
    <Panel title={spec.model} subtitle={d?.summary} onClose={onClose} wide accent={spec.accent}>
      <div
        className="rounded-md border-2 p-3"
        style={{
          background: `linear-gradient(160deg, ${spec.plate}, #0a0c0a)`,
          borderColor: `${spec.accent}33`,
        }}
        data-face={spec.face}
      >
        {/* Power strip */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: online ? UI.green : switched ? UI.red : "#333",
                boxShadow: online ? `0 0 8px ${UI.green}` : undefined,
              }}
            />
            <span className="text-white/60">
              {online ? tr("ONLINE") : switched ? tr("NO POWER") : tr("OFF")}
            </span>
            <span className="text-white/35">
              · {tr("fw {version}", { version: installedVersion(s, id) })}
              {hubsOf(s, id).length > 0 &&
                ` · ${hubsOf(s, id)
                  .map((h) => BUS_LABEL[h.bus])
                  .join(" / ")}`}
            </span>
          </div>
          <div className="flex gap-2">
            {id !== "MCP-000" && (
              <CrtButton
                tone={switched ? "red" : "green"}
                onClick={() => {
                  if (api.act((st) => toggleDevice(st, id)))
                    trackAction(api, { kind: "toggle", id });
                }}
              >
                {switched ? tr("Switch off") : tr("Switch on")}
              </CrtButton>
            )}
            <CrtButton tone="amber" onClick={onService}>
              {tr("Service")}
            </CrtButton>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-2 flex flex-wrap gap-1" role="tablist">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={page === tb.id}
              onClick={() => setPage(tb.id)}
              className={`rounded-t-sm border-b-2 px-3 py-1 text-[11px] tracking-widest uppercase ${FOCUS_RING}`}
              style={
                page === tb.id
                  ? { borderColor: spec.accent, color: spec.accent }
                  : { borderColor: "transparent", color: "#ffffff66" }
              }
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Display */}
        <div className="min-h-[14rem] rounded-sm bg-black/40 p-3">
          {!online && own ? (
            <p className="py-10 text-center text-xs text-white/35">
              {switched ? tr("— no power —") : tr("— switched off —")}
            </p>
          ) : !booted && own ? (
            <div className={`space-y-0.5 text-[11px] ${host.font}`} style={{ color: spec.accent }}>
              {spec.boot.map((l, i) => (
                <div key={i} style={{ animation: `unlab-fade 0.3s ${i * 0.35}s both` }}>
                  {l}
                </div>
              ))}
            </div>
          ) : own ? (
            <div className="flex flex-wrap items-end gap-3">
              {own.widgets.map((w, i) => (
                <WidgetView key={i} w={w} h={host} />
              ))}
            </div>
          ) : page === "links" && hub ? (
            <LinksPage id={id} api={api} accent={spec.accent} />
          ) : page === "firmware" ? (
            <FirmwarePage id={id} api={api} accent={spec.accent} />
          ) : (
            <InfoPage
              id={id}
              api={api}
              accent={spec.accent}
              output={output}
              onUse={() => onAction("use")}
            />
          )}
        </div>
      </div>
    </Panel>
  );
}

export const DeviceInterface = memoPanel(DeviceInterfaceImpl);

// ── LINKS (hubs) ─────────────────────────────────────────────────

function LinksPage({ id, api, accent }: { id: string; api: WorldApi; accent: string }) {
  const s = api.get();
  const hub = HUB_BY_ID.get(id)!;
  const linked = linksOf(s, id);
  const cands = linkCandidates(s, id);
  const [pick, setPick] = useState("");
  const name = (x: string) => DEVICE_BY_ID.get(x)?.name ?? x;
  const run = (fn: (st: WorldState) => { ok: boolean; message: string }) => {
    const r = api.act(fn);
    if (r.message) api.toast(r.message, r.ok ? "good" : "warn");
    return r.ok;
  };
  const probe = pick ? canLink(s, id, pick) : null;
  return (
    <div className="space-y-3 text-xs">
      <div>
        <SectionTitle accent={accent}>
          {hub.label} · {BUS_LABEL[hub.bus]} · {linked.length}/{hub.capacity}
        </SectionTitle>
        <p className="text-white/55">{hub.text}</p>
      </div>
      {linked.length === 0 ? (
        <p className="text-white/35">{tr("Nothing linked yet.")}</p>
      ) : (
        <ul className="space-y-1">
          {linked.map((x) => {
            const on = isOnline(s, x);
            return (
              <li
                key={x}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-white/10 px-2 py-1"
              >
                <span>
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ background: on ? UI.green : isSwitchedOn(s, x) ? UI.red : "#444" }}
                  />
                  {name(x)} <span className="text-white/35">{x}</span>
                  <span className="ml-2 text-white/35">fw {installedVersion(s, x)}</span>
                </span>
                <span className="flex gap-1">
                  {(hub.bus === "admin" || hub.bus === "power") && (
                    <CrtButton onClick={() => run((st) => remoteToggle(st, id, x))}>
                      {isSwitchedOn(s, x) ? tr("Off") : tr("On")}
                    </CrtButton>
                  )}
                  {manifestOf(x)?.update &&
                    !isUpdated(s, x) &&
                    updateCheck(s, x).ok &&
                    manifestOf(x)?.world?.source !== "manual" && (
                      <CrtButton tone="cyan" onClick={() => run((st) => flashFirmware(st, x))}>
                        {tr("Flash {version}", { version: manifestOf(x)!.update!.version })}
                      </CrtButton>
                    )}
                  <CrtButton
                    tone="red"
                    onClick={() => {
                      if (run((st) => unlinkDevice(st, id, x)))
                        trackAction(api, { kind: "unlink", id, arg: x });
                    }}
                  >
                    {tr("Unlink")}
                  </CrtButton>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
        <select
          className={INPUT_CLASS}
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          aria-label={tr("Device to link")}
        >
          <option value="">{tr("— choose a device —")}</option>
          {cands.map((x) => (
            <option key={x} value={x}>
              {x} · {name(x)}
            </option>
          ))}
        </select>
        <CrtButton
          tone="green"
          disabled={!pick || !probe?.ok}
          onClick={() => {
            if (run((st) => linkDevice(st, id, pick)))
              trackAction(api, { kind: "link", id, arg: pick });
            setPick("");
          }}
        >
          {tr("Link")}
        </CrtButton>
        {cands.length === 0 && (
          <span className="text-white/35">{tr("No device can be linked right now.")}</span>
        )}
      </div>
    </div>
  );
}

// ── FIRMWARE ─────────────────────────────────────────────────────

function FirmwarePage({ id, api, accent }: { id: string; api: WorldApi; accent: string }) {
  const s = api.get();
  const m = manifestOf(id)!;
  const img = installedImage(s, id)!;
  const updated = isUpdated(s, id);
  const check = updateCheck(s, id);
  const [phase, setPhase] = useState<FlashPhase | null>(null);
  const [sum, setSum] = useState("");
  const manual = m.world?.source === "manual";

  const start = () => {
    let i = 0;
    const next = () => {
      const ph = FLASH_PHASES[i];
      if (!ph) {
        setPhase(null);
        const r = api.act((st) => flashFirmware(st, id, sum));
        api.toast(r.message, r.ok ? "good" : "warn");
        api.sound?.(r.ok ? "build_stage" : "door_locked");
        return;
      }
      setPhase(ph);
      i++;
      window.setTimeout(next, FLASH_PHASE_MS[ph]);
    };
    next();
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-4">
        <span className="text-white/40">{tr("Version")}</span>
        <span style={{ color: accent }}>{img.version}</span>
        <span className="text-white/40">{tr("fw::Build")}</span>
        <span>{img.build}</span>
        <span className="text-white/40">{tr("Checksum")}</span>
        <span className="font-mono">{img.checksum}</span>
        <span className="text-white/40">{tr("Security patch")}</span>
        <span>{m.factory.securityPatch}</span>
      </div>
      <div>
        <SectionTitle accent={accent}>{tr("Features")}</SectionTitle>
        <div className="flex flex-wrap gap-1">
          {features(s, id).map((f) => (
            <span
              key={f}
              className="rounded-sm border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-white/70"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
      {m.update && m.world && (
        <div className="space-y-2 rounded-sm border border-white/10 p-2">
          <SectionTitle accent={accent}>
            {updated
              ? tr("Update {version} installed", { version: m.update.version })
              : tr("Update {version} available", { version: m.update.version })}
          </SectionTitle>
          <p className="text-white/70">
            <b style={{ color: accent }}>{m.world.unlock.label}</b> — {m.world.unlock.text}
          </p>
          <ul className="list-disc pl-4 text-white/50">
            {m.world.changelog.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {phase ? (
            <div>
              <div className="mb-1 flex gap-2">
                {FLASH_PHASES.map((ph) => (
                  <span
                    key={ph}
                    className="text-[10px] uppercase"
                    style={{ color: ph === phase ? accent : "#ffffff40" }}
                  >
                    {PHASE_LABEL[ph]}
                  </span>
                ))}
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-white/10">
                <div
                  className="h-full"
                  style={{
                    width: `${((FLASH_PHASES.indexOf(phase) + 1) / FLASH_PHASES.length) * 100}%`,
                    background: accent,
                    transition: "width 0.4s",
                  }}
                />
              </div>
            </div>
          ) : updated ? (
            <CrtButton
              tone="red"
              onClick={() => {
                const r = api.act((st) => rollbackFirmware(st, id));
                api.toast(r.message, r.ok ? "info" : "warn");
              }}
            >
              {tr("Roll back to factory image")}
            </CrtButton>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {manual && (
                <input
                  className={`${INPUT_CLASS} w-28 font-mono uppercase`}
                  maxLength={8}
                  value={sum}
                  onChange={(e) => setSum(e.target.value)}
                  placeholder={tr("checksum")}
                  aria-label={tr("Image checksum")}
                />
              )}
              <CrtButton
                tone="cyan"
                disabled={!check.ok || (manual && sum.trim().length < 8)}
                onClick={start}
              >
                {tr("Flash")}
              </CrtButton>
              {!check.ok && <span className="text-white/45">{check.message}</span>}
              {check.ok && manual && (
                <span className="text-white/45">
                  {tr("Service image on board — enter its checksum to verify.")}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── INFO ─────────────────────────────────────────────────────────

function InfoPage({
  id,
  api,
  accent,
  output,
  onUse,
}: {
  id: string;
  api: WorldApi;
  accent: string;
  output: string[];
  onUse: () => void;
}) {
  const s = api.get();
  const online = isOnline(s, id);
  const readout = s.readouts[id];
  const devName = DEVICE_BY_ID.get(id)?.name ?? id;
  // Device entries of the archive appear while the device is online
  // (visited once per opening of the INFO page).
  const [view, setView] = useState<SpotView | null>(null);
  const visited = useRef(false);
  useEffect(() => {
    if (visited.current || !isOnline(api.get(), id)) return;
    visited.current = true;
    const v = api.act((st) => visitSpot(st, { device: id }, "device"));
    for (const e of v.fresh) api.toast(tr("Archive — {title}", { title: e.title }), "insight");
    setView(v);
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-3 text-xs">
      {online && deviceHasUse(id) && (
        <div className="flex items-center gap-2">
          <CrtButton tone="cyan" onClick={onUse}>
            {tr("Read out")}
          </CrtButton>
          {id === "EXD-001" && !droneReady(s) && (
            <span className="text-white/40">{tr("drone charging")}</span>
          )}
        </div>
      )}
      {output.length > 0 && (
        <div className="rounded-sm border border-white/10 p-2" style={{ color: accent }}>
          {readout && (
            <div className="float-right">
              <RememberButton
                api={api}
                src={{
                  kind: "readout",
                  id: `${id}@${readout.t}`,
                  title: tr("Readout {name}", { name: devName }),
                  text: readout.lines.join("\n"),
                  tags: [id.toLowerCase()],
                }}
              />
            </div>
          )}
          {output.map((l, i) => (
            <div key={i}>› {l}</div>
          ))}
        </div>
      )}
      {(view?.entries ?? []).map((e) => (
        <article key={e.id} className="rounded-sm border border-white/10 p-2">
          <SectionTitle
            accent={accent}
            right={
              <RememberButton
                api={api}
                src={{ kind: "archive", id: e.id, title: e.title, text: e.text, tags: [e.topic] }}
              />
            }
          >
            {e.title} <span className="text-white/30">· {TIER_LABEL[e.tier]}</span>
          </SectionTitle>
          <p className="whitespace-pre-line text-white/70">{e.text}</p>
        </article>
      ))}
      {view?.hints.map((h) => (
        <p key={h} className="text-white/40 italic">
          {h}
        </p>
      ))}
      {!online && <p className="text-white/35">{tr("The device is offline — no data.")}</p>}
    </div>
  );
}
