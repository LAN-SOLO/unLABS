// Minimal ANSI SGR (\x1b[..m) tokenizer for terminal output rendering.
// Supports exactly what in-game commands emit: reset (0), bold (1),
// italic (3), standard foregrounds 30-37, bright foregrounds 90-97,
// and the corresponding "off" codes (22/23/39). Unknown codes are ignored.

export type AnsiColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray"
  | "brightRed"
  | "brightGreen"
  | "brightYellow"
  | "brightBlue"
  | "brightMagenta"
  | "brightCyan"
  | "brightWhite";

export interface AnsiSpan {
  text: string;
  fg?: AnsiColor;
  bold?: boolean;
  italic?: boolean;
}

const ANSI_SGR = /\x1b\[([0-9;]*)m/g;

const FG_CODES: Record<number, AnsiColor> = {
  30: "black",
  31: "red",
  32: "green",
  33: "yellow",
  34: "blue",
  35: "magenta",
  36: "cyan",
  37: "white",
  90: "gray",
  91: "brightRed",
  92: "brightGreen",
  93: "brightYellow",
  94: "brightBlue",
  95: "brightMagenta",
  96: "brightCyan",
  97: "brightWhite",
};

export function stripAnsi(input: string): string {
  return input.replace(ANSI_SGR, "");
}

/** Fast check so plain lines can skip tokenization entirely. */
export function hasAnsi(input: string): boolean {
  return input.includes("\x1b[");
}

export function parseAnsi(input: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  let fg: AnsiColor | undefined;
  let bold = false;
  let italic = false;
  let lastIndex = 0;

  const pushText = (text: string) => {
    if (!text) return;
    const span: AnsiSpan = { text };
    if (fg) span.fg = fg;
    if (bold) span.bold = true;
    if (italic) span.italic = true;
    spans.push(span);
  };

  ANSI_SGR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANSI_SGR.exec(input)) !== null) {
    pushText(input.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;

    const params = match[1] === "" ? [0] : match[1].split(";").map((n) => Number(n));
    for (const code of params) {
      if (code === 0) {
        fg = undefined;
        bold = false;
        italic = false;
      } else if (code === 1) {
        bold = true;
      } else if (code === 3) {
        italic = true;
      } else if (code === 22) {
        bold = false;
      } else if (code === 23) {
        italic = false;
      } else if (code === 39) {
        fg = undefined;
      } else if (code in FG_CODES) {
        fg = FG_CODES[code];
      }
      // Anything else (backgrounds, cursor moves already filtered by the
      // regex shape) is silently ignored.
    }
  }
  pushText(input.slice(lastIndex));

  return spans;
}
