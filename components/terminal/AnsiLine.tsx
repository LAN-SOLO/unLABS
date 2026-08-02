"use client";

import { memo } from "react";
import { hasAnsi, parseAnsi, type AnsiColor } from "@/lib/terminal/ansi";

// CRT-palette mapping. Bright variants share the base neon color — the CRT
// look treats "bright" as bold glow rather than a separate hue.
const FG_STYLES: Record<AnsiColor, string> = {
  black: "#0a1a0a",
  red: "var(--neon-red)",
  green: "var(--neon-green)",
  yellow: "var(--neon-amber)",
  blue: "var(--neon-blue)",
  magenta: "var(--neon-magenta)",
  cyan: "var(--neon-cyan)",
  white: "#e8f0e8",
  gray: "#6f8a6f",
  brightRed: "var(--neon-red)",
  brightGreen: "var(--crt-phosphor)",
  brightYellow: "var(--neon-amber)",
  brightBlue: "var(--neon-blue)",
  brightMagenta: "var(--neon-pink)",
  brightCyan: "var(--neon-cyan)",
  brightWhite: "#ffffff",
};

interface AnsiLineProps {
  content: string;
}

/**
 * Renders one terminal line with ANSI SGR colors mapped to the CRT palette.
 * Memoized: lines are immutable, so the whole scrollback never re-tokenizes
 * when new output arrives.
 */
export const AnsiLine = memo(function AnsiLine({ content }: AnsiLineProps) {
  if (!content) return <> </>;
  if (!hasAnsi(content)) return <>{content}</>;

  const spans = parseAnsi(content);
  return (
    <>
      {spans.map((span, i) => {
        if (!span.fg && !span.bold && !span.italic) return span.text;
        return (
          <span
            key={i}
            style={{
              color: span.fg ? FG_STYLES[span.fg] : undefined,
              fontWeight: span.bold ? 700 : undefined,
              fontStyle: span.italic ? "italic" : undefined,
            }}
          >
            {span.text}
          </span>
        );
      })}
    </>
  );
});
