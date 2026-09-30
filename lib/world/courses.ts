/**
 * Study rules (pure). Content: content/courses.ts. Progress lives in
 * `WorldState.courses` (seconds studied); completion in `flags.course_<id>`,
 * perks in `flags.perk_<perk>`.
 */
import { tr } from "@/lib/i18n";
import { COURSES, COURSE_BY_ID, type CourseDef } from "@/lib/world/content/courses";
import { bioStudyFatigue } from "@/lib/world/biorhythm";
import { describeCond, evalCond, log } from "@/lib/world/game";
import { PERK_TUNING, hasPerk, perkFlag } from "@/lib/world/perks";
import type { BiorhythmMode } from "@/lib/world/settings";
import type { KnowledgeArea, WorldState } from "@/lib/world/types";

export { COURSES, COURSE_BY_ID, hasPerk, perkFlag };
export type { CourseDef };

export const courseFlag = (id: string): string => `course_${id}`;

export function courseDone(s: WorldState, id: string): boolean {
  return !!s.flags[courseFlag(id)];
}

/** Courses of one knowledge area (catalogue order). */
export function coursesIn(area: KnowledgeArea): CourseDef[] {
  return COURSES.filter((c) => c.area === area);
}

/** Every perk the courses grant, with the course that grants it. */
export function allPerks(): { id: string; label: string; text: string; course: CourseDef }[] {
  return COURSES.flatMap((c) => (c.perk ? [{ ...c.perk, course: c }] : []));
}

/** Study speed (1 = one course second per play second). */
export function studyRate(s: WorldState): number {
  return hasPerk(s, "speed_reader") ? PERK_TUNING.studyFactor : 1;
}

/** Play seconds of study still needed (with the current study speed). */
export function studySecondsLeft(s: WorldState, id: string): number {
  const c = COURSE_BY_ID.get(id);
  if (!c || courseDone(s, id)) return 0;
  const left = Math.max(0, c.minutes * 60 - (s.courses[id] ?? 0));
  return Math.ceil(left / studyRate(s));
}

/** Study progress 0…1. */
export function studyProgress(s: WorldState, id: string): number {
  const c = COURSE_BY_ID.get(id);
  if (!c) return 0;
  if (courseDone(s, id)) return 1;
  return Math.min(1, (s.courses[id] ?? 0) / (c.minutes * 60));
}

/** Lessons unlocked so far. */
export function lessonsOpen(s: WorldState, c: CourseDef): number {
  if (courseDone(s, c.id)) return c.lessons.length;
  return Math.min(
    c.lessons.length,
    Math.floor(studyProgress(s, c.id) * c.lessons.length + 1e-9) + 1,
  );
}

export function courseAvailable(s: WorldState, c: CourseDef): { ok: boolean; hint?: string } {
  if (evalCond(s, c.requires)) return { ok: true };
  return { ok: false, hint: c.requiresHint ?? (c.requires ? describeCond(c.requires) : undefined) };
}

/** Study for `seconds` (called by the computer while Jade sits at it). Returns the new progress. */
export function study(s: WorldState, id: string, seconds: number): number {
  const c = COURSE_BY_ID.get(id);
  if (!c || courseDone(s, id) || !courseAvailable(s, c).ok) return studyProgress(s, id);
  const dt = Math.max(0, seconds);
  // Perk `speed_reader` (course "How to study"): lessons go in faster.
  s.courses[id] = Math.min(c.minutes * 60, (s.courses[id] ?? 0) + dt * studyRate(s));
  s.counters.study_seconds = (s.counters.study_seconds ?? 0) + dt;
  return studyProgress(s, id);
}

/**
 * One study step from the computer: progress plus a little tiredness (rest,
 * through the biorhythm rules; nothing when the rhythm is off). Returns the
 * new progress and whether the lessons just finished.
 */
export function studyTick(
  s: WorldState,
  id: string,
  seconds: number,
  mode: BiorhythmMode,
): { progress: number; finished: boolean; opened: number } {
  const c = COURSE_BY_ID.get(id);
  if (!c) return { progress: 0, finished: false, opened: 0 };
  const before = studyProgress(s, id);
  const lessonsBefore = lessonsOpen(s, c);
  const progress = study(s, id, seconds);
  if (progress > before) bioStudyFatigue(s, seconds, mode);
  return {
    progress,
    finished: before < 1 && progress >= 1,
    opened: lessonsOpen(s, c) - lessonsBefore,
  };
}

export type QuizResult =
  | { ok: true; perk?: string }
  | { ok: false; message: string; wrong: number[] };

/** Hand in the check. All answers right completes the course. */
export function passCourse(s: WorldState, id: string, answers: readonly number[]): QuizResult {
  const c = COURSE_BY_ID.get(id);
  if (!c) return { ok: false, message: tr("Unknown course."), wrong: [] };
  if (courseDone(s, id)) return { ok: true, ...(c.perk ? { perk: c.perk.id } : {}) };
  if (studyProgress(s, id) < 1)
    return { ok: false, message: tr("Finish the lessons first."), wrong: [] };
  const wrong = c.quiz.flatMap((q, i) => (answers[i] === q.answer ? [] : [i]));
  s.counters.quiz_tries = (s.counters.quiz_tries ?? 0) + 1;
  if (wrong.length)
    return { ok: false, message: tr("Not quite. Go over the lessons again."), wrong };
  s.flags[courseFlag(id)] = true;
  s.counters.courses_done = (s.counters.courses_done ?? 0) + 1;
  if (c.perk) s.flags[perkFlag(c.perk.id)] = true;
  log(s, tr("Course completed — {title}", { title: c.title }));
  return { ok: true, ...(c.perk ? { perk: c.perk.id } : {}) };
}
