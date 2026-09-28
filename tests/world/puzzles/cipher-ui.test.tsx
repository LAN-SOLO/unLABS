import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CipherPuzzle } from "@/components/world/puzzles/CipherPuzzle";

afterEach(cleanup);

const params = { key: "HALO", plain: "DAS LABOR ERINNERT SICH" };

describe("cipher ui", () => {
  it("typing the key solves live", () => {
    const onSolve = vi.fn();
    render(<CipherPuzzle params={params} onSolve={onSolve} solved={false} />);
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "halo" } });
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("Enter on a wrong key buzzes, shakes and counts toward the hint", () => {
    const sound = vi.fn();
    const { container } = render(
      <CipherPuzzle params={params} onSolve={vi.fn()} solved={false} sound={sound} />,
    );
    const input = screen.getByLabelText("Key");
    fireEvent.change(input, { target: { value: "ABCD" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(container.querySelector(".pz-fail-a")).not.toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("note")).toHaveTextContent("4 letters");
  });

  it("reset clears the key", () => {
    render(<CipherPuzzle params={params} onSolve={vi.fn()} solved={false} />);
    const input = screen.getByLabelText<HTMLInputElement>("Key");
    fireEvent.change(input, { target: { value: "XY" } });
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(input.value).toBe("");
  });
});
