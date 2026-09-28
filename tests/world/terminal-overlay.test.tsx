import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TerminalOverlay,
  absorbTerminalIntoWorld,
  type TerminalWorldApi,
} from "@/components/world/TerminalOverlay";
import { CLOSE_TERMINAL_MESSAGE, EMBED_TERMINAL_PATH } from "@/lib/terminal/embed";
import { TERMINAL_EVENTS_KEY, labSetDevicePower } from "@/lib/world/bridge";
import { DEVICES } from "@/lib/world/content/devices";
import { initialState, isSwitchedOn } from "@/lib/world/game";
import { loadWorld, saveWorld } from "@/lib/world/save";
import type { WorldState } from "@/lib/world/types";

function frame(): HTMLIFrameElement {
  const f = document.querySelector("iframe");
  if (!f) throw new Error("no iframe");
  return f;
}

function postFromFrame(data: unknown, opts: { origin?: string; foreign?: boolean } = {}): void {
  const source = opts.foreign ? window : frame().contentWindow;
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data,
        origin: opts.origin ?? window.location.origin,
        source,
      }),
    );
  });
}

function fakeWorld(state: WorldState): TerminalWorldApi & { toasts: string[] } {
  const toasts: string[] = [];
  return {
    toasts,
    get: () => state,
    act: (fn) => {
      const r = fn(state);
      saveWorld(state);
      return r;
    },
    toast: (text) => {
      toasts.push(text);
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TerminalOverlay (big terminal in-game)", () => {
  it("flushes the world save before the terminal starts loading", () => {
    const order: string[] = [];
    const onOpen = vi.fn(() => {
      order.push(`flush:${frame().getAttribute("src") ?? "none"}`);
    });
    render(<TerminalOverlay onClose={() => undefined} onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["flush:none"]);
    expect(frame().getAttribute("src")).toBe(EMBED_TERMINAL_PATH);
  });

  it("has a visible Back button that closes", () => {
    const onClose = vi.fn();
    render(<TerminalOverlay onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Back to the lab/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc closes, and no key reaches the game underneath", () => {
    const onClose = vi.fn();
    const game = vi.fn();
    window.addEventListener("keydown", game);
    try {
      render(<TerminalOverlay onClose={onClose} />);
      fireEvent.keyDown(window, { key: "KeyI", code: "KeyI" });
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(game).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", game);
    }
  });

  it("closes on the terminal's close message — only from its own frame and origin", () => {
    const onClose = vi.fn();
    render(<TerminalOverlay onClose={onClose} />);
    postFromFrame({ type: CLOSE_TERMINAL_MESSAGE }, { origin: "https://evil.example" });
    postFromFrame({ type: CLOSE_TERMINAL_MESSAGE }, { foreign: true });
    postFromFrame({ type: "something-else" });
    expect(onClose).not.toHaveBeenCalled();
    postFromFrame({ type: CLOSE_TERMINAL_MESSAGE });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops listening after unmount", () => {
    const onClose = vi.fn();
    const { unmount } = render(<TerminalOverlay onClose={onClose} />);
    unmount();
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("absorbing terminal events when the overlay closes", () => {
  function builtWorld(): WorldState {
    const s = initialState();
    const d = DEVICES[0]!;
    s.built[d.id] = d.stages.length;
    s.discovered[d.id] = true;
    return s;
  }

  it("re-applies a power switch the terminal made while the overlay was open", () => {
    const id = DEVICES[0]!.id;
    saveWorld(builtWorld());
    // The running world holds its copy from before the terminal opened.
    const live = loadWorld();
    const wasOn = isSwitchedOn(live, id);
    // The terminal (in the iframe) flips the switch in the slot + queues an event.
    expect(labSetDevicePower(id, !wasOn).status).toBe("switched");
    expect(localStorage.getItem(TERMINAL_EVENTS_KEY)).toContain(id);

    const w = fakeWorld(live);
    const onClose = vi.fn(() => absorbTerminalIntoWorld(w));
    render(<TerminalOverlay onClose={onClose} />);
    postFromFrame({ type: CLOSE_TERMINAL_MESSAGE });

    expect(onClose).toHaveReturnedWith(1);
    expect(isSwitchedOn(live, id)).toBe(!wasOn);
    expect(w.toasts[0]).toMatch(/^Main Console: /);
    // Taken from the queue: a second absorb finds nothing.
    expect(absorbTerminalIntoWorld(w)).toBe(0);
  });
});
