import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Credits,
  FULL_CREDITS,
  PauseMenu,
  SettingsPanel,
  SlotList,
  TitleScreen,
} from "@/components/world/menu";
import { savedAgo, slotDetails } from "@/components/world/menu/SlotList";
import { newGame, newGamePlusGame, saveToSlot, loadSlot } from "@/lib/world/save";
import { _resetSettingsCache, getSettings, updateSettings } from "@/lib/world/settings";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function key(code: string, key = code) {
  act(() => {
    fireEvent.keyDown(window, { code, key });
  });
}

describe("TitleScreen backdrop", () => {
  it("falls back to the 2D field without WebGL", () => {
    const { container } = render(
      <TitleScreen
        onContinue={vi.fn()}
        onNewGame={vi.fn()}
        onLoad={vi.fn()}
        onTerminal={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-backdrop="fallback"]')).not.toBeNull();
  });

  it("stays on the 2D field when the diorama is switched off", () => {
    updateSettings({ graphics: { menuScene: false } });
    const { container } = render(
      <TitleScreen
        onContinue={vi.fn()}
        onNewGame={vi.fn()}
        onLoad={vi.fn()}
        onTerminal={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-backdrop="fallback"]')).not.toBeNull();
  });
});

describe("SlotList details", () => {
  it("shows NG+, finished and progress info for a slot", () => {
    const done = newGame("slot1");
    done.endings.frequenz = true;
    done.flags.postgame = true;
    saveToSlot("slot1", done);
    newGamePlusGame("slot2", loadSlot("slot1")!);
    expect(slotDetails("slot2")!.ngPlus).toBe(1);
    expect(slotDetails("slot1")!.finished).toBe(true);
    expect(slotDetails("slot3")).toBeNull();

    render(<SlotList mode="load" onPick={vi.fn()} />);
    expect(screen.getByText("NG+")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getAllByText("Slices").length).toBeGreaterThan(0);
  });

  it("navigates with the keyboard and confirms delete with Del", () => {
    saveToSlot("slot1", newGame("slot1"));
    const onPick = vi.fn();
    render(<SlotList mode="load" onPick={onPick} />);
    key("Delete");
    const dialog = screen.getByRole("dialog", { name: "Delete save?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(loadSlot("slot1")).not.toBeNull();
    key("Delete");
    const again = screen.getByRole("dialog", { name: "Delete save?" });
    fireEvent.click(within(again).getByRole("button", { name: "Delete" }));
    expect(loadSlot("slot1")).toBeNull();
  });

  it("always confirms delete, even with confirmations off", () => {
    updateSettings({ gameplay: { confirmDestructive: false } });
    saveToSlot("slot2", newGame("slot2"));
    render(<SlotList mode="save" onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete save?" })).toBeInTheDocument();
  });

  it("formats the last-saved time relatively", () => {
    const now = Date.parse("2026-09-28T12:00:00Z");
    expect(savedAgo("2026-09-28T11:59:40Z", now)).toBe("just now");
    expect(savedAgo("2026-09-28T11:30:00Z", now)).toBe("30 min ago");
    expect(savedAgo("2026-09-28T07:00:00Z", now)).toBe("5 h ago");
    expect(savedAgo("2026-09-27T10:00:00Z", now)).toBe("yesterday");
    expect(savedAgo("nope", now)).toBe("");
  });
});

describe("Credits", () => {
  it("lists staff, departments and archive sources and is skippable", () => {
    const onClose = vi.fn();
    render(<Credits onClose={onClose} />);
    expect(screen.getByText("Dr. Jade Lawrence")).toBeInTheDocument();
    expect(screen.getByText("Voxel workshop")).toBeInTheDocument();
    expect(screen.getByText("Archive 09")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    key("Enter");
    expect(onClose).toHaveBeenCalledTimes(2);
    key("Escape");
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(FULL_CREDITS.length).toBeGreaterThan(5);
  });
});

describe("SettingsPanel extras", () => {
  it("shows binding conflicts and resets all keys", () => {
    render(<SettingsPanel initialTab="steuerung" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Rebind Journal" }));
    key("Tab");
    expect(getSettings().controls.journal).toBe("Tab");
    expect(screen.getByRole("list", { name: "Conflicts" })).toHaveTextContent(/Inventory/);
    fireEvent.click(screen.getByRole("button", { name: "Reset all keys" }));
    expect(getSettings().controls.journal).toBe("KeyJ");
    expect(screen.queryByRole("list", { name: "Conflicts" })).toBeNull();
  });

  it("toggles the menu diorama and switches tabs with the arrow keys", () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("switch", { name: "Title screen diorama" }));
    expect(getSettings().graphics.menuScene).toBe(false);
    const tab = screen.getByRole("tab", { name: "Graphics" });
    fireEvent.keyDown(tab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Camera" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Randscrollen")).toBeNull();
  });
});

describe("PauseMenu desktop quit", () => {
  const props = () => {
    const state = newGame("slot1");
    return {
      state,
      p: {
        getState: () => state,
        onResume: vi.fn(),
        onLoad: vi.fn(),
        onMainMenu: vi.fn(),
        onTerminal: vi.fn(),
        onHelp: vi.fn(),
      },
    };
  };

  it("has no Quit entry on the web", () => {
    render(<PauseMenu {...props().p} />);
    expect(screen.queryByRole("menuitem", { name: /Quit/ })).toBeNull();
  });

  it("confirms, saves and closes the window in Electron", () => {
    vi.stubGlobal("__ELECTRON_CONFIG__", {});
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    const { state, p } = props();
    state.playTime = 77;
    render(<PauseMenu {...p} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /Quit/ }));
    const dialog = screen.getByRole("dialog", { name: "Quit game?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Quit" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(loadSlot("slot1")!.playTime).toBe(77);
  });
});
