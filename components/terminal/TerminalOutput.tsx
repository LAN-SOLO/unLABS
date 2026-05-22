"use client";

import { useEffect, useRef, useCallback } from "react";
import type { TerminalLine } from "@/lib/terminal/types";

// Strip ANSI SGR escape sequences (\x1b[..m). Commands embed colors via
// \x1b[32m...\x1b[0m, but the renderer prints raw text — without stripping,
// the leading ESC byte is invisible but the trailing `[..m` shows literally.
// Color rendering can be added later; for now, drop them.

const ANSI_SGR = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string): string => s.replace(ANSI_SGR, "");

interface TerminalOutputProps {
  lines: TerminalLine[];
  isTyping: boolean;
}

export function TerminalOutput({ lines, isTyping }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  // Track whether user has scrolled away from the bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUp.current = distanceFromBottom > 30;
  }, []);

  // Reset scroll lock when new lines are added (user submitted a command)
  const prevLineCount = useRef(lines.length);
  useEffect(() => {
    if (lines.length > prevLineCount.current) {
      // New output arrived — check if an input line was just added
      const newLines = lines.slice(prevLineCount.current);
      if (newLines.some((l) => l.type === "input")) {
        isUserScrolledUp.current = false;
      }
    }
    prevLineCount.current = lines.length;
  }, [lines]);

  // Auto-scroll to bottom only if user hasn't scrolled up
  useEffect(() => {
    if (containerRef.current && !isUserScrolledUp.current) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
    }
  }, [lines, isTyping]);

  const getLineClass = (type: TerminalLine["type"]) => {
    switch (type) {
      case "input":
        return "text-green-400";
      case "error":
        return "text-red-500";
      case "system":
        return "text-green-500";
      case "ascii":
        return "text-green-500";
      default:
        return "text-green-500/80";
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto font-mono text-[10px] leading-tight"
      style={{
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      }}
    >
      <pre className="whitespace-pre">
        {lines.map((line) => (
          <div key={line.id} className={getLineClass(line.type)}>
            {stripAnsi(line.content) || " "}
          </div>
        ))}

        {isTyping && <div className="text-green-500/80">Processing...</div>}
      </pre>
    </div>
  );
}
