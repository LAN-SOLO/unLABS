/**
 * JadeOS smoke tests: the computer boots to its desktop, every app renders,
 * the Files app files memos, the Learn app studies on its interval and the
 * Terminal app hands over to the room terminal.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PC_APPS,
  PersonalComputer,
  __resetPcBootForTests,
} from "@/components/world/pc/PersonalComputer";
import { STUDY_STEP } from "@/components/world/pc/LearnApp";
import { importSource, importSources, pcFolders, parseTags } from "@/components/world/pc/sources";
import type { WorldApi } from "@/components/world/panels/shared";
import { COURSES, courseAvailable } from "@/lib/world/courses";
import { initialState } from "@/lib/world/game";
import { addMemo, memosIn } from "@/lib/world/memos";
import type { WorldState } from "@/lib/world/types";

// Mail and Board talk to Supabase (messaging module) — stubbed here.
vi.mock("@/components/world/pc/MailApp", () => ({ MailApp: () => <p>mail stub</p> }));
vi.mock("@/components/world/pc/BoardApp", () => ({ BoardApp: () => <p>board stub</p> }));

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

function makeApi(setup?: (s: WorldState) => void): { api: WorldApi; state: WorldState } {
  const state = initialState();
  setup?.(state);
  const api: WorldApi = {
    get: () => state,
    act: (fn) => fn(state),
    toast: vi.fn(),
    version: 0,
    sound: vi.fn(),
  };
  return { api, state };
}

function desktop(api: WorldApi, onTerminal?: () => void) {
  const r = render(<PersonalComputer api={api} onClose={() => {}} onTerminal={onTerminal} />);
  const skip = screen.queryByRole("button", { name: "Skip" });
  if (skip) fireEvent.click(skip);
  return r;
}

function openApp(container: HTMLElement, id: string): void {
  const b = container.querySelector(`[data-app="${id}"]`);
  expect(b).not.toBeNull();
  fireEvent.click(b!);
}

describe("JadeOS", () => {
  beforeEach(() => __resetPcBootForTests());
  afterEach(() => vi.useRealTimers());

  it("boots and shows the desktop with every app", () => {
    const { api } = makeApi();
    const { container } = render(<PersonalComputer api={api} onClose={() => {}} />);
    expect(container.querySelector('[data-pc="boot"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(container.querySelector('[data-pc="desktop"]')).not.toBeNull();
    for (const a of PC_APPS) expect(container.querySelector(`[data-app="${a.id}"]`)).not.toBeNull();
  });

  it("renders every app without crashing (number keys switch apps)", () => {
    const { api } = makeApi((s) => {
      addMemo(s, { title: "Fuse", text: "red one", place: "pc", tags: ["power"] });
      s.readouts["UEC-001"] = { t: 5, lines: ["150 W"] };
    });
    const { container } = desktop(api);
    const root = container.querySelector("[data-pc]")!;
    for (const [i, a] of PC_APPS.entries()) {
      fireEvent.keyDown(root, { key: String(i + 1) });
      expect(container.querySelector(`[data-app="${a.id}"]`)?.getAttribute("aria-pressed")).toBe(
        "true",
      );
    }
  });

  it("the Terminal app opens the room terminal", () => {
    const { api } = makeApi();
    const onTerminal = vi.fn();
    const { container } = desktop(api, onTerminal);
    openApp(container, "terminal");
    fireEvent.click(screen.getByRole("button", { name: "Open the terminal" }));
    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  it("the Learn app studies while a course is open", () => {
    vi.useFakeTimers();
    const c = COURSES.find((x) => !x.requires)!;
    const { api, state } = makeApi();
    expect(courseAvailable(state, c).ok).toBe(true);
    const { container } = desktop(api);
    openApp(container, "learn");
    fireEvent.click(container.querySelector(`[data-course-item="${c.id}"]`)!);
    expect(container.querySelector(`[data-course="${c.id}"]`)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(STUDY_STEP * 1000 * 3);
    });
    expect(state.courses[c.id]).toBeGreaterThan(0);
  });
});

describe("JadeOS sources", () => {
  it("imports what Jade knows onto the computer once", () => {
    const { state } = makeApi((s) => {
      s.readouts["UEC-001"] = { t: 5, lines: ["150 W"] };
    });
    const src = importSources(state).find((x) => x.kind === "readout")!;
    expect(src).toBeDefined();
    expect(importSource(state, src)).toBe(true);
    expect(importSources(state).some((x) => x.kind === "readout" && x.id === src.id)).toBe(false);
    const pc = memosIn(state, "pc");
    expect(pc.length).toBe(1);
    expect(pcFolders(pc)).toEqual([{ tag: src.tag, n: 1 }]);
  });

  it("parses tags", () => {
    expect(parseTags(" a, b ,, a ,c")).toEqual(["a", "b", "c"]);
  });
});
