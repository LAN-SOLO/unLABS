import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArbitragePuzzle } from "@/components/world/puzzles/ArbitragePuzzle";
import { generateMarket, pathYield } from "@/components/world/puzzles/engine/arbitrage";

afterEach(cleanup);

const params = { seed: 7, nodes: 5, maxHops: 4, target: 1.08 };
const market = generateMarket(7, 5, 4, 1.08);
const key = (k: string) => fireEvent.keyDown(window, { key: k });

/** A legal 2-stop round trip that misses the target. */
function losingRoute(): number[] {
  const n = market.names.length;
  for (let a = 1; a < n; a++)
    for (let b = 1; b < n; b++) {
      if (a === b) continue;
      const r = [0, a, b, 0];
      if (pathYield(market, r) < market.target) return r;
    }
  throw new Error("no losing route");
}

describe("ArbitragePuzzle UI", () => {
  it("number keys build the planted route and Enter trades it", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<ArbitragePuzzle params={params} onSolve={onSolve} solved={false} sound={sound} />);
    for (const j of market.planted.slice(1)) key(String(j + 1));
    sound.mockClear();
    key("Enter");
    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalled();
  });

  it("a losing trade buzzes and restarts the route", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<ArbitragePuzzle params={params} onSolve={onSolve} solved={false} sound={sound} />);
    for (const j of losingRoute().slice(1)) key(String(j + 1));
    key("Enter");
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(onSolve).not.toHaveBeenCalled();
    expect(screen.getByText(/Route \(0\//)).toBeInTheDocument();
  });

  it("an illegal hop buzzes without counting; reset clears the route", () => {
    const sound = vi.fn();
    render(<ArbitragePuzzle params={params} onSolve={vi.fn()} solved={false} sound={sound} />);
    key("2");
    key("1"); // back to _unSC after one hop: illegal
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(screen.getByText(/Route \(1\//)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(screen.getByText(/Route \(0\//)).toBeInTheDocument();
  });

  it("never lets the route strand: the last hop must return home", () => {
    render(<ArbitragePuzzle params={params} onSolve={vi.fn()} solved={false} />);
    key("2");
    key("3");
    key("4");
    key("5"); // 4th hop to a non-home node is refused
    expect(screen.getByText(/Route \(3\//)).toBeInTheDocument();
    key("1");
    expect(screen.getByText(/Route \(4\//)).toBeInTheDocument();
  });
});
