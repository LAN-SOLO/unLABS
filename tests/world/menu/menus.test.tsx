import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PauseMenu, SettingsPanel, SlotList, TitleScreen } from "@/components/world/menu";
import { initialState } from "@/lib/world/game";
import { getActiveSlot, loadSlot, newGame, saveToSlot } from "@/lib/world/save";
import { _resetSettingsCache, getSettings } from "@/lib/world/settings";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function key(code: string, key = code) {
  act(() => {
    fireEvent.keyDown(window, { code, key });
  });
}

const titleProps = () => ({
  onContinue: vi.fn(),
  onNewGame: vi.fn(),
  onLoad: vi.fn(),
  onTerminal: vi.fn(),
});

describe("TitleScreen", () => {
  it("disables Continue without a save and starts a new game in a slot", () => {
    const p = titleProps();
    render(<TitleScreen {...p} />);
    expect(screen.getByRole("menuitem", { name: /Continue/ })).toBeDisabled();
    // Cursor starts on the first enabled entry (New Game).
    key("Enter");
    const dialog = screen.getByRole("dialog", { name: "New Game" });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Start here" })[1]!);
    expect(p.onNewGame).toHaveBeenCalledWith("slot2");
    expect(getActiveSlot()).toBe("slot2");
    expect(loadSlot("slot2")).not.toBeNull();
  });

  it("asks before overwriting an existing slot", () => {
    const s = newGame("slot1");
    s.playTime = 999;
    saveToSlot("slot1", s);
    const p = titleProps();
    render(<TitleScreen {...p} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /New Game/ }));
    const dialog = screen.getByRole("dialog", { name: "New Game" });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Start here" })[0]!);
    expect(p.onNewGame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));
    expect(p.onNewGame).toHaveBeenCalledWith("slot1");
    expect(loadSlot("slot1")!.playTime).toBe(0);
  });

  it("continues the active slot with the keyboard", () => {
    saveToSlot("slot3", initialState());
    const p = titleProps();
    render(<TitleScreen {...p} />);
    key("Enter");
    expect(p.onContinue).toHaveBeenCalledTimes(1);
    expect(getActiveSlot()).toBe("slot3");
  });

  it("Esc closes only the top-most layer", () => {
    render(<TitleScreen {...titleProps()} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /^Settings/ }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(screen.getByRole("dialog", { name: "Restore defaults?" })).toBeInTheDocument();
    key("Escape");
    expect(screen.queryByRole("dialog", { name: "Restore defaults?" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    key("Escape");
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
  });
});

describe("SettingsPanel", () => {
  it("rebinds a key and swaps on conflict", () => {
    render(<SettingsPanel initialTab="steuerung" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Rebind Interact" }));
    key("KeyQ", "q");
    expect(getSettings().controls.interact).toBe("KeyQ");
    expect(getSettings().controls.rotateLeft).toBe("KeyE");
    expect(screen.getByText(/was bound to “Rotate camera left”/)).toBeInTheDocument();
  });

  it("Esc while capturing cancels the capture but keeps the panel open", () => {
    const onClose = vi.fn();
    render(<SettingsPanel initialTab="steuerung" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Rebind Journal" }));
    key("Escape");
    expect(onClose).not.toHaveBeenCalled();
    expect(getSettings().controls.journal).toBe("KeyJ");
  });

  it("applies toggles live", () => {
    render(<SettingsPanel initialTab="audio" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("switch", { name: "Mute" }));
    expect(getSettings().audio.mute).toBe(true);
  });
});

describe("SlotList", () => {
  it("disables empty slots when loading", () => {
    saveToSlot("slot2", initialState());
    const onPick = vi.fn();
    render(<SlotList mode="load" onPick={onPick} />);
    const load = screen.getAllByRole("button", { name: "Load" });
    expect(load).toHaveLength(4);
    expect(load[0]).toBeDisabled();
    fireEvent.click(load[1]!);
    expect(onPick).toHaveBeenCalledWith("slot2");
  });

  it("keeps Import usable on empty manual slots (row not aria-disabled)", () => {
    render(<SlotList mode="load" onPick={vi.fn()} />);
    const rows = screen.getAllByRole("option");
    const empty = rows.find((r) => r.getAttribute("aria-label")?.startsWith("Save slot 3"));
    expect(empty).toBeDefined();
    expect(empty!.getAttribute("aria-disabled")).toBe("false");
    expect(within(empty!).getByRole("button", { name: "Import" })).toBeEnabled();
    const auto = rows.find((r) => r.getAttribute("aria-label")?.startsWith("Autosave"));
    expect(auto?.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("PauseMenu", () => {
  it("resumes on Esc and saves into a slot", () => {
    const state = newGame("slot1");
    state.playTime = 3600;
    const onResume = vi.fn();
    const onSaved = vi.fn();
    render(
      <PauseMenu
        getState={() => state}
        onResume={onResume}
        onLoad={vi.fn()}
        onMainMenu={vi.fn()}
        onTerminal={vi.fn()}
        onHelp={vi.fn()}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByText(/Playtime 01:00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Save" }));
    const dialog = screen.getByRole("dialog", { name: "Save" });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Save" })[1]!);
    expect(onSaved).toHaveBeenCalledWith("slot2");
    expect(loadSlot("slot2")!.playTime).toBe(3600);
    expect(getActiveSlot()).toBe("slot2");
    key("Escape");
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("offers New Game+ only in the post-game and starts it in a slot", () => {
    const state = newGame("slot1");
    const props = {
      getState: () => state,
      onResume: vi.fn(),
      onLoad: vi.fn(),
      onMainMenu: vi.fn(),
      onTerminal: vi.fn(),
      onHelp: vi.fn(),
    };
    const { unmount } = render(<PauseMenu {...props} />);
    expect(screen.queryByRole("menuitem", { name: /New Game\+/ })).toBeNull();
    unmount();

    state.endings.frequenz = true;
    state.flags.postgame = true;
    state.flags.ach_first_light = true;
    render(<PauseMenu {...props} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /New Game\+/ }));
    const dialog = screen.getByRole("dialog", { name: "New Game+" });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Start here" })[1]!);
    expect(props.onLoad).toHaveBeenCalledWith("slot2");
    expect(getActiveSlot()).toBe("slot2");
    const ng = loadSlot("slot2")!;
    expect(ng.flags.ng_plus).toBe(true);
    expect(ng.flags.legacy_ending_frequenz).toBe(true);
    expect(ng.endings).toEqual({});
    // The finished run stays in its own slot.
    expect(loadSlot("slot1")!.endings.frequenz).toBe(true);
  });
});
