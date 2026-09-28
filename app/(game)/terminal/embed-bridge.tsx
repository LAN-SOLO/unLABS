"use client";

import { useEffect } from "react";
import { isEmbeddedFrame, requestCloseTerminal } from "@/lib/terminal/embed";

/**
 * Esc on an empty terminal line closes the Lab World overlay (embed mode
 * only). Runs in the capture phase so it sees the input value before the
 * terminal's own Esc handler clears it: a non-empty line is just cleared.
 */
export function EmbedBridge() {
  useEffect(() => {
    if (!isEmbeddedFrame()) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const el = document.activeElement;
      const onEmptyLine =
        el instanceof HTMLInputElement && el.hasAttribute("data-terminal-input") && el.value === "";
      const nothingFocused = el === null || el === document.body;
      if (!onEmptyLine && !nothingFocused) return;
      e.preventDefault();
      requestCloseTerminal();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return null;
}
