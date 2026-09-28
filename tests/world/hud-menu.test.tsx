import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HudMenu, type HudMenuItem } from "@/components/world/ui";
import { menuLayerOpen } from "@/components/world/menu";

function items(spy: (id: string) => void): HudMenuItem[] {
  return ["inventory", "workbench", "journal", "codex", "achievements", "pause", "help"].map(
    (id) => ({
      id,
      label: id,
      ...(id === "achievements" ? { ariaLabel: "Achievements: 1 of 40 (K)" } : {}),
      onSelect: () => spy(id),
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("compact HUD menu (☰)", () => {
  it("opens a menu with every panel action and runs the picked one", () => {
    const spy = vi.fn();
    render(<HudMenu items={items(spy)} label="Actions menu" />);
    const button = screen.getByRole("button", { name: "Actions menu" });
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(button, { detail: 1 });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const entries = screen.getAllByRole("menuitem");
    expect(entries).toHaveLength(7);
    expect(screen.getByRole("menuitem", { name: "Achievements: 1 of 40 (K)" })).toBeTruthy();

    fireEvent.click(screen.getByRole("menuitem", { name: "journal" }));
    expect(spy).toHaveBeenCalledWith("journal");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("is keyboard accessible: focus moves in, arrows cycle, Esc closes and refocuses", () => {
    const spy = vi.fn();
    render(<HudMenu items={items(spy)} label="Actions menu" />);
    const button = screen.getByRole("button", { name: "Actions menu" });
    button.focus();
    // Keyboard activation (click with detail 0) focuses the first entry.
    fireEvent.click(button, { detail: 0 });
    const entries = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(entries[0]);
    expect(menuLayerOpen()).toBe(true);

    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(entries[1]);
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(entries[6]);
    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(entries[0]);
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(entries[6]);

    // Keys inside the menu never reach the world hotkeys on window.
    const onWindow = vi.fn();
    window.addEventListener("keydown", onWindow);
    fireEvent.keyDown(menu, { key: "i", code: "KeyI" });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    window.removeEventListener("keydown", onWindow);
    expect(onWindow).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(menuLayerOpen()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("ArrowDown on the button opens it; a click outside closes it", () => {
    render(
      <div>
        <HudMenu items={items(vi.fn())} label="Actions menu" />
        <p>outside</p>
      </div>,
    );
    const button = screen.getByRole("button", { name: "Actions menu" });
    fireEvent.keyDown(button, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getAllByRole("menuitem")[0]);
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("HUD setting", () => {
  it("defaults to full and only accepts known modes", async () => {
    const { DEFAULT_SETTINGS, HUD_MODES, mergeSettings } = await import("@/lib/world/settings");
    expect(DEFAULT_SETTINGS.gameplay.hud).toBe("full");
    expect(HUD_MODES).toEqual(["full", "compact", "minimal"]);
    expect(mergeSettings(DEFAULT_SETTINGS, { gameplay: { hud: "compact" } }).gameplay.hud).toBe(
      "compact",
    );
    expect(mergeSettings(DEFAULT_SETTINGS, { gameplay: { hud: "tiny" } }).gameplay.hud).toBe(
      "full",
    );
  });
});
