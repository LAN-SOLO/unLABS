import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapOverlay, Minimap } from "@/components/world/Minimap";
import { initialState } from "@/lib/world/game";
import { buildMapModel, mapPin } from "@/lib/world/map-data";
import { trackedObjectiveId } from "@/lib/world/quests";
import type { WorldState } from "@/lib/world/types";

function explored(): WorldState {
  const s = initialState();
  for (const r of ["kontroll", "schleuse", "werkstatt", "aufzug0", "westflur"])
    s.flags[`visited_${r}`] = true;
  return s;
}

const player = () => ({ x: 66, z: 58, facing: 0, yaw: 0 });

/** The map marker (SVG) of an entity. */
function marker(key: string): Element {
  const el = document.querySelector(`svg [data-key="${key}"]`);
  if (!el) throw new Error(`no marker ${key}`);
  return el;
}

function renderMap(s: WorldState, extra: Partial<Parameters<typeof MapOverlay>[0]> = {}) {
  let version = 1;
  const onClose = vi.fn();
  const actFn = vi.fn((fn: (st: WorldState) => void) => {
    fn(s);
    version += 1;
    view.rerender(
      <MapOverlay
        state={s}
        version={version}
        player={player}
        act={actFn}
        onClose={onClose}
        {...extra}
      />,
    );
  });
  const view = render(
    <MapOverlay
      state={s}
      version={version}
      player={player}
      act={actFn}
      onClose={onClose}
      {...extra}
    />,
  );
  return { ...view, onClose, actFn };
}

describe("MapOverlay", () => {
  it("renders the floor plan, level tabs and markers with labels", () => {
    renderMap(explored());
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getAllByRole("tab").length).toBeGreaterThanOrEqual(6);
    // Markers are buttons with "name — status" labels.
    const m = marker("terminal:hauptkonsole");
    expect(m.getAttribute("role")).toBe("button");
    expect(m.getAttribute("aria-label")).toMatch(/^Main Console .* — /);
  });

  it("clicking a marker opens its dossier; Esc closes the dossier before the map", () => {
    const { onClose } = renderMap(explored());
    fireEvent.click(marker("device:CLK-001"));
    const dossier = screen.getByRole("region", { name: /Dossier/ });
    expect(within(dossier).getByText(/Next stage/)).toBeTruthy();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.queryByRole("region", { name: /Dossier/ })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("track and waypoint buttons mutate the world through act()", () => {
    const s = explored();
    s.flags.visited_geo = true;
    renderMap(s);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "seep valve" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Seep Valve/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(trackedObjectiveId(s)).toBe("strom_ventil");
    fireEvent.click(screen.getByRole("button", { name: "Set waypoint" }));
    expect(mapPin(s)?.floor).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove waypoint" }));
    expect(mapPin(s)).toBeNull();
  });

  it("search jumps to another floor", () => {
    const s = explored();
    s.flags.visited_geo = true;
    renderMap(s);
    expect(screen.getByRole("dialog", { name: /Level 0/ })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "seep valve" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Seep Valve/ })[0]!);
    expect(screen.getByRole("dialog", { name: /Level −1/ })).toBeTruthy();
  });

  it("category filters hide markers", () => {
    renderMap(explored());
    expect(document.querySelector('svg [data-key="device:CLK-001"]')).toBeTruthy();
    const filters = screen.getByRole("group", { name: "Map filters" });
    fireEvent.click(within(filters).getByRole("button", { name: /Devices/ }));
    expect(document.querySelector('svg [data-key="device:CLK-001"]')).toBeNull();
  });

  it("the Found tab shows progress per level", () => {
    const s = explored();
    s.taken.p_kontroll_kiste = 0;
    renderMap(s);
    fireEvent.click(screen.getByRole("tab", { name: "Found" }));
    expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Crate").length).toBeGreaterThan(0);
  });

  it("optional callbacks: handbook, go there, open note", () => {
    const s = explored();
    s.flags.bot_f1ndr_awake = true;
    const onOpenCodex = vi.fn();
    const onGoTo = vi.fn();
    renderMap(s, { onOpenCodex, onGoTo });
    fireEvent.click(marker("npc:f1ndr"));
    fireEvent.click(screen.getByRole("button", { name: "Show in handbook" }));
    expect(onOpenCodex).toHaveBeenCalledWith("p_f1ndr", "personen");
    fireEvent.click(screen.getByRole("button", { name: "Go there" }));
    expect(onGoTo).toHaveBeenCalled();
  });

  it("keyboard zoom and pan update the view", () => {
    renderMap(explored());
    const map = screen.getByRole("group", { name: /Map of/ });
    fireEvent.keyDown(map, { key: "+" });
    expect(screen.getByText(/×1\.4/)).toBeTruthy();
    fireEvent.keyDown(map, { key: "0" });
    expect(screen.getByText(/×1\.0/)).toBeTruthy();
  });
});

describe("Minimap", () => {
  it("renders an SVG map without interactive markers", () => {
    const s = explored();
    const { container } = render(
      <Minimap
        state={s}
        floor={0}
        player={player}
        version={1}
        target={{ floor: 0, x: 60, z: 60 }}
      />,
    );
    expect(container.querySelector("svg[aria-label='Level map']")).toBeTruthy();
    expect(container.querySelectorAll("[role='button']").length).toBe(0);
    // Room tints are drawn for every listed room.
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(
      buildMapModel(s).floors[0].rooms.length,
    );
  });
});
