"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { CrtButton, Panel, SPEAKER } from "@/components/world/ui";
import {
  Lines,
  Missing,
  announce,
  memoPanel,
  type WorldApi,
} from "@/components/world/panels/shared";
import { PrototypeUse, type ProtoUseHandler } from "@/components/world/panels/prototype";
import { FLOORS_TOP_DOWN, FLOOR_ACCESS, NOTES } from "@/lib/world/content/map";
import { NPCS } from "@/lib/world/content/story";
import {
  askedDialogueOptions,
  chooseDialogue,
  dialogueAnswer,
  dialogueGreeting,
  dialogueOptions,
  exchangeSignature,
  endingsAt,
  floorAccessible,
  power,
  saidKey,
} from "@/lib/world/game";
import type { DialogueLine, DialogueOption, FloorId } from "@/lib/world/types";

// ── Dialogue ─────────────────────────────────────────────────────

/** One block of the conversation log. */
interface LogEntry {
  /** `said_…` key of the option (or "greeting"/"proto-n"). */
  key: string;
  /** Exchange signature — a repeatable option's answer is logged once. */
  sig: string;
  lines: DialogueLine[];
}

function DialoguePanelImpl({
  npcId,
  api,
  onClose,
  onProto,
}: {
  npcId: string;
  api: WorldApi;
  onClose: () => void;
  onProto?: ProtoUseHandler;
}) {
  const npc = NPCS.find((n) => n.id === npcId)!;
  const s = api.get();
  const [log, setLog] = useState<LogEntry[]>(() => [
    { key: "greeting", sig: "greeting", lines: dialogueGreeting(s, npcId) },
  ]);
  const [flash, setFlash] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const g = dialogueGreeting(api.get(), npcId)[0];
    if (g) api.speak?.(g.text, g.who);
  }, [api, npcId]);
  const shown = new Set(log.map((e) => e.sig));
  const options = dialogueOptions(s, npcId, shown);
  const asked = askedDialogueOptions(s, npcId, shown);

  const choose = (o: DialogueOption) => {
    const r = api.act((st) => chooseDialogue(st, npcId, o.label));
    if (!r.ok) {
      api.toast(r.message, "warn");
      return;
    }
    const key = saidKey(npcId, o);
    const sig = exchangeSignature(npcId, o, r.lines);
    setLog((prev) =>
      prev.some((e) => e.sig === sig)
        ? prev
        : [...prev, { key, sig, lines: [{ who: "jade", text: o.label }, ...r.lines] }],
    );
    setFlash(null);
    const first = r.lines[0];
    if (first) api.speak?.(first.text, first.who);
    announce(api, r);
  };
  /** "Already asked": show the answer again — no effects, no duplicate. */
  const replay = (o: DialogueOption) => {
    const key = saidKey(npcId, o);
    if (log.some((e) => e.key === key)) {
      setFlash(key);
      return;
    }
    const answer = dialogueAnswer(api.get(), o);
    setLog((prev) => [
      ...prev,
      {
        key,
        sig: exchangeSignature(npcId, o, answer),
        lines: [{ who: "jade", text: o.label }, ...answer],
      },
    ]);
    setFlash(key);
  };
  // Follow the conversation; a replayed answer is scrolled into view instead.
  useEffect(() => {
    const box = logRef.current;
    if (!box) return;
    const target = flash
      ? Array.from(box.querySelectorAll<HTMLElement>("[data-entry]")).find(
          (n) => n.dataset.entry === flash,
        )
      : undefined;
    if (target && typeof target.scrollIntoView === "function")
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    else if (!flash) box.scrollTop = box.scrollHeight;
  }, [log, flash]);

  const sp = SPEAKER[npc.id] ?? { name: npc.name, color: "#fff" };
  return (
    <Panel title={npc.name} onClose={onClose} accent={sp.color}>
      <div ref={logRef} className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
        {log.map((e) => (
          <div
            key={e.sig}
            data-entry={e.key}
            className={
              flash === e.key ? "rounded-sm bg-[#FFB800]/10 ring-1 ring-[#FFB800]/30" : undefined
            }
          >
            <Lines lines={e.lines} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => choose(o)}
            className="rounded-sm border border-[#FFB800]/30 px-3 py-1.5 text-left text-xs text-[#FFB800] hover:bg-[#FFB800]/10"
          >
            › {o.label}
          </button>
        ))}
        {!options.length && (
          <p className="text-[13px]" data-testid="dialogue-idle">
            <span
              className="mr-2 text-[11px] tracking-widest uppercase"
              style={{ color: sp.color }}
            >
              {sp.name}
            </span>
            <span className="text-white/70">…</span>
            <span className="ml-2 text-[11px] text-white/40">
              {tr("Nothing left to ask right now.")}
            </span>
          </p>
        )}
      </div>
      {asked.length > 0 && (
        <details className="mt-3 text-xs" data-testid="dialogue-asked">
          <summary className="cursor-pointer text-white/45 select-none hover:text-white/70">
            {tr("Already asked ({n})", { n: asked.length })}
          </summary>
          <div className="mt-1.5 flex flex-col gap-1">
            {asked.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => replay(o)}
                title={tr("Show the answer again")}
                className="rounded-sm border border-white/10 px-3 py-1 text-left text-white/40 hover:bg-white/5 hover:text-white/60"
              >
                ✓ {o.label}
              </button>
            ))}
          </div>
        </details>
      )}
      {/* Dormant bots: a prototype instead of the missing part (Reanimation). */}
      <PrototypeUse
        api={api}
        target={npcId}
        onUse={onProto}
        className="mt-3"
        onResult={(r) => {
          if (!r.ok || !r.dialogue.length) return;
          setLog((prev) => [
            ...prev,
            { key: `proto-${prev.length}`, sig: `proto-${prev.length}`, lines: r.dialogue },
          ]);
          const first = r.dialogue[0];
          if (first) api.speak?.(first.text, first.who);
        }}
      />
      <div className="mt-4 flex justify-end">
        <CrtButton tone="amber" onClick={onClose}>
          {tr("dialogue::Leave")}
        </CrtButton>
      </div>
    </Panel>
  );
}

// ── Note ─────────────────────────────────────────────────────────

function NotePanelImpl({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const n = NOTES.find((x) => x.id === noteId)!;
  const color =
    n.author === "jade"
      ? "#FFB800"
      : n.author === "damien"
        ? "#00FFFF"
        : n.author === "mcp"
          ? "#FF3333"
          : "#33FF33";
  const first = n.body.charAt(0);
  return (
    <Panel
      title={n.title}
      subtitle={
        n.model === "tape"
          ? tr("Tape · echo recorder")
          : n.model === "screen"
            ? tr("note::Screen")
            : tr("Paper")
      }
      onClose={onClose}
      accent={color}
    >
      <p className="font-mono text-[13px] whitespace-pre-line text-[#e8f0e0]">
        {n.author === "jade" ? (
          <>
            <span className="text-lg text-[#FFB800]">{first}</span>
            {n.body.slice(1)}
          </>
        ) : (
          n.body
        )}
      </p>
    </Panel>
  );
}

// ── Elevator ─────────────────────────────────────────────────────

function ElevatorPanelImpl({
  api,
  current,
  onClose,
  onGo,
  openPuzzle,
  protoTarget,
  onProto,
}: {
  api: WorldApi;
  current: FloorId;
  onClose: () => void;
  onGo: (f: FloorId) => void;
  openPuzzle: (id: string) => void;
  /** The elevator prop, when opened from one ("Use with prototype …"). */
  protoTarget?: string;
  onProto?: ProtoUseHandler;
}) {
  const s = api.get();
  const powered = power(s).generation >= 50;
  return (
    <Panel
      title={powered ? tr("Freight elevator") : tr("Emergency Ladder")}
      subtitle={
        powered
          ? tr("Power is on.")
          : tr("No power — only the emergency ladder to Level −1 can be used.")
      }
      onClose={onClose}
    >
      <div className="space-y-2">
        {FLOORS_TOP_DOWN.map((f) => {
          const ok = floorAccessible(s, f.id);
          const acc = FLOOR_ACCESS[f.id];
          return (
            <div
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-sm border border-white/10 p-2"
            >
              <div>
                <p
                  className={
                    f.id === current ? "text-[#00FFFF]" : ok ? "text-[#d8ffd8]" : "text-white/40"
                  }
                >
                  {f.name}
                </p>
                {!ok && <p className="text-[11px] text-white/40">{acc.hint}</p>}
              </div>
              <div className="flex gap-2">
                {!ok && acc.keypad && !s.puzzles[acc.keypad] && power(s).generation >= 100 && (
                  <CrtButton tone="cyan" onClick={() => openPuzzle(acc.keypad!)}>
                    {tr("Code")}
                  </CrtButton>
                )}
                <CrtButton
                  tone="amber"
                  disabled={!ok || f.id === current}
                  onClick={() => onGo(f.id)}
                >
                  {f.id === current ? tr("here") : tr("go")}
                </CrtButton>
              </div>
            </div>
          );
        })}
      </div>
      {protoTarget && (
        <PrototypeUse api={api} target={protoTarget} onUse={onProto} className="mt-3" />
      )}
    </Panel>
  );
}

// ── Forge ────────────────────────────────────────────────────────

function ForgePanelImpl({
  api,
  onClose,
  onEnding,
  protoTarget,
  onProto,
}: {
  api: WorldApi;
  onClose: () => void;
  onEnding: (id: string) => void;
  /** The forge prop, when opened from it (Coherence target). */
  protoTarget?: string;
  onProto?: ProtoUseHandler;
}) {
  const s = api.get();
  const list = endingsAt(s, "forge");
  return (
    <Panel
      title={tr("Infinity Forge")}
      subtitle={tr("Deep Lab Level 3 · 847 sensors · field: off")}
      onClose={onClose}
      accent="#E8F4FF"
    >
      <p className="mb-3 text-xs text-[#d8ffd8]/80">
        {tr(
          "The Forge where, on 02/14/2019 at 03:41:22, two people stopped being at their stations. The superconductors are cold; the sensors are still counting.",
        )}
      </p>
      {list.map(({ ending, ready }) =>
        s.endings[ending.id] ? (
          <p key={ending.id} className="text-xs text-[#33FF33]">
            ✓ {ending.title}
          </p>
        ) : (
          <div key={ending.id} className="rounded-sm border border-[#E8F4FF]/30 p-2">
            <p className="text-xs text-[#E8F4FF]">{ending.prompt}</p>
            <Missing cond={ending.requires} s={s} />
            <CrtButton
              tone="cyan"
              className="mt-2"
              disabled={!ready}
              onClick={() => onEnding(ending.id)}
            >
              {ready ? tr("Start the Forge") : tr("Not yet")}
            </CrtButton>
          </div>
        ),
      )}
      {protoTarget && (
        <PrototypeUse api={api} target={protoTarget} onUse={onProto} className="mt-3" />
      )}
    </Panel>
  );
}

export const DialoguePanel = memoPanel(DialoguePanelImpl);
export const NotePanel = memoPanel(NotePanelImpl);
export const ElevatorPanel = memoPanel(ElevatorPanelImpl);
export const ForgePanel = memoPanel(ForgePanelImpl);
