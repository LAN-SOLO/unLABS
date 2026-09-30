/**
 * Knowledge UI smoke tests: the knowledge panel tabs, writing / moving memos,
 * the "Remember" button and a pin board.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { KnowledgePanel } from "@/components/world/knowledge/KnowledgePanel";
import { PinBoard } from "@/components/world/knowledge/PinBoard";
import { RememberButton } from "@/components/world/knowledge/Remember";
import type { WorldApi } from "@/components/world/panels/shared";
import { initialState } from "@/lib/world/game";
import { addMemo, boardPlace, pinnedAt } from "@/lib/world/memos";
import type { WorldState } from "@/lib/world/types";

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

const BOARD = "decor:kontroll:a2";

describe("KnowledgePanel", () => {
  it("renders every tab without crashing", () => {
    const { api } = makeApi((s) => {
      addMemo(s, { title: "Fuse", text: "red one", tags: ["power"] });
      addMemo(s, { title: "Pinned", text: "", place: boardPlace(BOARD) });
      s.readouts["UEC-001"] = { t: 5, lines: ["150 W"] };
      s.experiments.push({ t: 3, inputs: { kupferdraht: 1 }, outcome: "fail" });
      s.log.push({ t: 1, text: "Woke up." });
    });
    render(<KnowledgePanel api={api} onClose={() => undefined} />);
    // Overview: radar + ten area bars.
    expect(screen.getByRole("img", { name: /radar/i })).toBeTruthy();
    expect(document.querySelectorAll("[data-area]")).toHaveLength(10);
    for (const name of [/experience/i, /body/i, /systems/i, /processed/i, /memos/i]) {
      fireEvent.click(screen.getByRole("tab", { name }));
    }
    // Memos tab: both memos, the board listed.
    expect(document.querySelectorAll("[data-memo]")).toHaveLength(2);
    expect(document.querySelectorAll("[data-board]")).toHaveLength(1);
  });

  it("writes a new memo and takes a pinned one off", () => {
    const { api, state } = makeApi((s) => {
      addMemo(s, { title: "Pinned", text: "", place: boardPlace(BOARD) });
    });
    render(<KnowledgePanel api={api} onClose={() => undefined} initialTab="memos" />);
    fireEvent.click(screen.getByRole("button", { name: /new memo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Memo title" }), {
      target: { value: "Door code" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Memo text" }), {
      target: { value: "4-7-1-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save memo/i }));
    expect(state.memos.map((m) => m.title)).toContain("Door code");
    expect(state.memos.find((m) => m.title === "Door code")?.place).toBe("mind");
    fireEvent.click(screen.getByRole("button", { name: "Take off" }));
    expect(state.memos.find((m) => m.title === "Pinned")?.place).toBe("mind");
  });
});

describe("RememberButton", () => {
  it("stores once and then shows the noted state", () => {
    const { api, state } = makeApi();
    const src = { kind: "insight" as const, id: "i1", title: "Halo", text: "It hums." };
    const { rerender } = render(<RememberButton api={api} src={src} />);
    fireEvent.click(screen.getByRole("button", { name: /remember/i }));
    rerender(<RememberButton api={{ ...api, version: 1 }} src={src} />);
    fireEvent.click(screen.getByRole("button", { name: /noted/i }));
    expect(state.memos).toHaveLength(1);
    expect(state.memos[0]?.source).toEqual({ kind: "insight", id: "i1" });
  });
});

describe("PinBoard", () => {
  it("pins a carried memo and writes a note straight onto the board", () => {
    const { api, state } = makeApi((s) => {
      addMemo(s, { title: "Carry me", text: "" });
    });
    const { container } = render(<PinBoard api={api} placementId={BOARD} />);
    const box = within(container);
    fireEvent.change(box.getByRole("combobox", { name: "Memo to pin" }), {
      target: { value: state.memos[0]!.id },
    });
    fireEvent.click(box.getByRole("button", { name: "Pin" }));
    expect(pinnedAt(state, boardPlace(BOARD)).map((m) => m.title)).toEqual(["Carry me"]);
    fireEvent.click(box.getByRole("button", { name: /write a note here/i }));
    fireEvent.change(box.getByRole("textbox", { name: "Memo text" }), {
      target: { value: "Back at 3." },
    });
    fireEvent.click(box.getByRole("button", { name: "Pin note" }));
    expect(pinnedAt(state, boardPlace(BOARD))).toHaveLength(2);
  });
});
