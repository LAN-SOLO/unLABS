"use client";

import { useEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, FOCUS_RING, FilterChip, Meter, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { AppWindow, Muted } from "@/components/world/pc/common";
import { clock } from "@/components/world/pc/sources";
import { AREAS, AREA_LABEL } from "@/lib/world/knowledge";
import {
  COURSES,
  COURSE_BY_ID,
  courseAvailable,
  courseDone,
  hasPerk,
  lessonsOpen,
  passCourse,
  studyProgress,
  studyRate,
  studySecondsLeft,
  studyTick,
  type CourseDef,
} from "@/lib/world/courses";
import { getSettings } from "@/lib/world/settings";
import type { KnowledgeArea } from "@/lib/world/types";

/** Real seconds per study step (1 play second of study per real second). */
export const STUDY_STEP = 2;

function statusOf(api: WorldApi, c: CourseDef): "done" | "ready" | "study" | "locked" {
  const s = api.get();
  if (courseDone(s, c.id)) return "done";
  if (!courseAvailable(s, c).ok) return "locked";
  return studyProgress(s, c.id) >= 1 ? "ready" : "study";
}

const STATUS_COLOR = {
  done: UI.green,
  ready: UI.amber,
  study: UI.cyan,
  locked: "#666",
} as const;

function statusLabel(st: ReturnType<typeof statusOf>): string {
  switch (st) {
    case "done":
      return tr("pccourse::completed");
    case "ready":
      return tr("pccourse::check ready");
    case "study":
      return tr("pccourse::open");
    default:
      return tr("pccourse::locked");
  }
}

function Quiz({ api, c }: { api: WorldApi; c: CourseDef }) {
  const [answers, setAnswers] = useState<number[]>(() => c.quiz.map(() => -1));
  const [wrong, setWrong] = useState<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const submit = () => {
    const r = api.act((s) => passCourse(s, c.id, answers));
    if (r.ok) {
      api.sound?.("puzzle_solved");
      api.toast(tr("Course completed — {title}", { title: c.title }), "good");
      if (c.perk) api.toast(tr("Perk unlocked — {perk}", { perk: c.perk.label }), "insight");
    } else {
      api.sound?.("fail_buzz");
      setWrong(r.wrong);
      setMsg(r.message);
    }
  };
  return (
    <div className="space-y-2 rounded-sm border border-[#FFB800]/30 p-2" data-quiz={c.id}>
      <p className="text-[10px] tracking-widest uppercase" style={{ color: UI.amber }}>
        {tr("pc::Final check")}
      </p>
      {c.quiz.map((q, i) => (
        <fieldset key={q.q} className="space-y-0.5">
          <legend
            className="text-xs"
            style={{ color: wrong.includes(i) ? UI.red : UI.text }}
          >{`${i + 1}. ${q.q}`}</legend>
          {q.options.map((o, j) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2 text-[11px] text-white/70"
            >
              <input
                type="radio"
                name={`${c.id}-q${i}`}
                checked={answers[i] === j}
                onChange={() => {
                  setAnswers((a) => a.map((x, k) => (k === i ? j : x)));
                  setWrong((w) => w.filter((k) => k !== i));
                }}
                className="accent-[#00FFFF]"
              />
              {o}
            </label>
          ))}
        </fieldset>
      ))}
      {msg && (
        <p role="status" className="text-[11px]" style={{ color: UI.red }}>
          {msg}
        </p>
      )}
      <CrtButton tone="amber" onClick={submit} disabled={answers.some((a) => a < 0)}>
        {tr("pc::Hand in")}
      </CrtButton>
    </div>
  );
}

function StudyView({ api, c, onBack }: { api: WorldApi; c: CourseDef; onBack: () => void }) {
  const s = api.get();
  const avail = courseAvailable(s, c);
  const done = courseDone(s, c.id);
  const progress = studyProgress(s, c.id);
  const open = lessonsOpen(s, c);
  const canStudy = avail.ok && !done && progress < 1;
  const [running, setRunning] = useState(true);
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });
  // Study runs while this view is open: one tick every STUDY_STEP seconds.
  // The interval only depends on the course and the switch, never on the
  // world (api.act re-renders; an effect on [world] would loop).
  const active = running && canStudy;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const a = apiRef.current;
      const r = a.act((st) => studyTick(st, c.id, STUDY_STEP, getSettings().gameplay.biorhythm));
      if (r.opened > 0 && !r.finished) {
        a.sound?.("page_turn");
        a.toast(tr("New lesson unlocked — {title}", { title: c.title }), "info");
      }
      if (r.finished) {
        a.sound?.("achievement");
        a.toast(tr("Lessons complete — time for the final check."), "good");
      }
    }, STUDY_STEP * 1000);
    return () => window.clearInterval(id);
  }, [active, c.id, c.title]);

  return (
    <div className="space-y-2" data-course={c.id}>
      <button
        type="button"
        onClick={onBack}
        className={`text-[11px] text-[#00FFFF]/80 hover:text-[#00FFFF] ${FOCUS_RING}`}
      >
        {tr("← course catalogue")}
      </button>
      <div>
        <p className="text-sm" style={{ color: UI.amber }}>
          {c.title}
        </p>
        <Muted>{`${AREA_LABEL[c.area]} · ${c.blurb}`}</Muted>
      </div>
      <Meter
        value={Math.round(progress * 100)}
        max={100}
        color={UI.cyan}
        label={tr("pc::Study progress")}
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
        {done ? (
          <span style={{ color: UI.green }}>{tr("pc::Completed.")}</span>
        ) : !avail.ok ? (
          <span>{tr("Locked: {hint}", { hint: avail.hint ?? "?" })}</span>
        ) : progress < 1 ? (
          <>
            <span aria-live="polite">
              {running
                ? tr("Studying … {left} left", { left: clock(studySecondsLeft(s, c.id)) })
                : tr("Paused — {left} left", { left: clock(studySecondsLeft(s, c.id)) })}
            </span>
            <CrtButton tone="cyan" onClick={() => setRunning((r) => !r)}>
              {running ? tr("Pause") : tr("Continue")}
            </CrtButton>
            {studyRate(s) > 1 && <span style={{ color: UI.green }}>{tr("pc::Speed reading")}</span>}
          </>
        ) : (
          <span style={{ color: UI.amber }}>
            {tr("All lessons open. Hand in the final check.")}
          </span>
        )}
      </div>
      <ol className="space-y-1">
        {c.lessons.map((l, i) => (
          <li
            key={l}
            className="rounded-sm border px-2 py-1 text-[11px]"
            style={{ borderColor: i < open ? `${UI.green}33` : "#ffffff14" }}
          >
            <span className="mr-1 text-white/35">{`${i + 1}.`}</span>
            {i < open ? (
              <span style={{ color: UI.text }}>{l}</span>
            ) : (
              <span className="text-white/30 italic">{tr("Locked — keep studying.")}</span>
            )}
          </li>
        ))}
      </ol>
      {c.perk && (
        <p className="text-[11px]" style={{ color: hasPerk(s, c.perk.id) ? UI.green : UI.magenta }}>
          {hasPerk(s, c.perk.id)
            ? tr("Perk active — {perk}: {text}", { perk: c.perk.label, text: c.perk.text })
            : tr("Perk on completion — {perk}: {text}", { perk: c.perk.label, text: c.perk.text })}
        </p>
      )}
      {avail.ok && !done && progress >= 1 && <Quiz key={c.id} api={api} c={c} />}
    </div>
  );
}

/** JadeOS "Learn": course catalogue by knowledge area, study view, final check. */
export function LearnApp({ api }: { api: WorldApi }) {
  const s = api.get();
  const [area, setArea] = useState<KnowledgeArea | "all">("all");
  const [sel, setSel] = useState<string | null>(null);
  const course = sel ? COURSE_BY_ID.get(sel) : undefined;
  const list = COURSES.filter((c) => area === "all" || c.area === area);
  const doneCount = COURSES.filter((c) => courseDone(s, c.id)).length;
  return (
    <AppWindow
      title={tr("pc::Learn")}
      right={tr("{done} of {total} courses completed", { done: doneCount, total: COURSES.length })}
    >
      {course ? (
        <StudyView key={course.id} api={api} c={course} onBack={() => setSel(null)} />
      ) : (
        <div className="space-y-2">
          <div
            role="tablist"
            aria-label={tr("pc::Knowledge areas")}
            className="flex flex-wrap gap-1"
          >
            <FilterChip active={area === "all"} onClick={() => setArea("all")}>
              {tr("All")}
            </FilterChip>
            {AREAS.map((a) => (
              <FilterChip
                key={a}
                active={area === a}
                onClick={() => setArea(a)}
                count={COURSES.filter((c) => c.area === a).length}
              >
                {AREA_LABEL[a]}
              </FilterChip>
            ))}
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {list.map((c) => {
              const st = statusOf(api, c);
              const hint = st === "locked" ? courseAvailable(s, c).hint : undefined;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSel(c.id)}
                    className={`block h-full w-full rounded-sm border border-white/10 px-2 py-1 text-left hover:border-[#00FFFF]/40 ${FOCUS_RING}`}
                    data-course-item={c.id}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className="text-xs"
                        style={{ color: st === "locked" ? "#888" : UI.text }}
                      >
                        {c.title}
                      </span>
                      <span
                        className="shrink-0 text-[9px] tracking-wider uppercase"
                        style={{ color: STATUS_COLOR[st] }}
                      >
                        {statusLabel(st)}
                      </span>
                    </span>
                    <span className="block text-[10px] text-white/40">
                      {tr("{area} · {min} min", { area: AREA_LABEL[c.area], min: c.minutes })}
                      {c.perk ? ` · ${tr("Perk: {perk}", { perk: c.perk.label })}` : ""}
                    </span>
                    {hint && <span className="block text-[10px] text-white/30 italic">{hint}</span>}
                    {st === "study" && studyProgress(s, c.id) > 0 && (
                      <Meter
                        className="mt-1"
                        value={Math.round(studyProgress(s, c.id) * 100)}
                        max={100}
                        color={UI.cyan}
                        label={tr("pc::Study progress")}
                        height={2}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <Muted>
            {tr(
              "Studying runs while a course is open here. It tires you a little — the bed is next door.",
            )}
          </Muted>
        </div>
      )}
    </AppWindow>
  );
}
