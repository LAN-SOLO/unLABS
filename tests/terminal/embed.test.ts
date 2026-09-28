import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLOSE_TERMINAL_MESSAGE,
  isCloseTerminalMessage,
  isEmbedLeaveCommand,
  isEmbeddedFrame,
  requestCloseTerminal,
} from "@/lib/terminal/embed";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("terminal embed protocol", () => {
  it("recognises the close message only", () => {
    expect(isCloseTerminalMessage({ type: CLOSE_TERMINAL_MESSAGE })).toBe(true);
    expect(isCloseTerminalMessage({ type: "other" })).toBe(false);
    expect(isCloseTerminalMessage(CLOSE_TERMINAL_MESSAGE)).toBe(false);
    expect(isCloseTerminalMessage(null)).toBe(false);
  });

  it("`back` always leaves; `exit` only without a switched user", () => {
    expect(isEmbedLeaveCommand("back", [], false)).toBe(true);
    expect(isEmbedLeaveCommand("back", [], true)).toBe(true);
    expect(isEmbedLeaveCommand("exit", [], false)).toBe(true);
    expect(isEmbedLeaveCommand("quit", [], false)).toBe(true);
    expect(isEmbedLeaveCommand("exit", [], true)).toBe(false);
    expect(isEmbedLeaveCommand("back", ["now"], false)).toBe(false);
    expect(isEmbedLeaveCommand("labor", [], false)).toBe(false);
    expect(isEmbedLeaveCommand(undefined, [], false)).toBe(false);
  });

  it("does not post when not framed (top-level window)", () => {
    const post = vi.spyOn(window.parent, "postMessage");
    expect(isEmbeddedFrame()).toBe(false);
    expect(requestCloseTerminal()).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
