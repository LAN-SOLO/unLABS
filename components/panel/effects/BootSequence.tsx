"use client";

import { useState, useEffect, useRef } from "react";

interface BootSequenceProps {
  active: boolean;
  onComplete: () => void;
  /** 'system' = full screen (fixed), 'os' = container-scoped (absolute) */
  scope?: "system" | "os";
}

type LineColor = "ok" | "amber" | "dim" | "warn" | "glitch" | "cyan";

interface BootLine {
  text: string;
  delay: number;
  color?: LineColor;
  triggerGlitch?: boolean;
}

const BOOT_LINES: BootLine[] = [
  // ── BIOS header ──────────────────────────────────────────────
  { text: "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓", delay: 80, color: "dim" },
  { text: " UNSTABLE LABORATORIES — QUANTUM BIOS v2.7", delay: 60, color: "amber" },
  { text: " (c) 2026 unSC Research Division", delay: 60, color: "dim" },
  { text: "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓", delay: 150, color: "dim" },
  { text: "", delay: 80 },

  // ── POST checks ──────────────────────────────────────────────
  { text: "POST: CPU .............. QX-7700K [2 cores]        OK", delay: 50, color: "ok" },
  { text: "POST: RAM .............. 2.4M QUANTUM-ECC          OK", delay: 50, color: "ok" },
  { text: "POST: CRYSTAL CACHE .... 64K COHERENT              OK", delay: 50, color: "ok" },
  { text: "POST: DIMENSION LOCK ... STABLE                    OK", delay: 50, color: "ok" },
  { text: "POST: ANOMALY SENSOR ... CALIBRATING               OK", delay: 70, color: "ok" },
  { text: "", delay: 60 },

  // ── Memory scan ──────────────────────────────────────────────
  { text: "MEM: 0x0000..0x03FF ████████████████ PASS", delay: 30, color: "dim" },
  { text: "MEM: 0x0400..0x09FF ████████████████ PASS", delay: 30, color: "dim" },
  { text: "MEM: 0x0A00..0x24FF ████████████████ 2.4M OK", delay: 50, color: "ok" },
  { text: "", delay: 80 },

  // ── Kernel boot ──────────────────────────────────────────────
  { text: "_unOS Kernel 6.1.0-_unSC (quantum-core)", delay: 180, color: "amber" },
  { text: "", delay: 60 },
  { text: "[  OK  ] Started quantum kernel", delay: 80, color: "ok" },
  { text: "[  OK  ] Mounted /dev/crystal_cache", delay: 60, color: "ok" },
  { text: "[  OK  ] Mounted /unboot /unsys /unproc", delay: 60, color: "ok" },
  { text: "[  OK  ] Started system journal", delay: 50, color: "ok" },
  { text: "[  OK  ] Loading equipment drivers", delay: 70, color: "ok" },
  { text: "[  OK  ] Started network subsystem", delay: 50, color: "ok" },
  { text: "[  OK  ] Configured uneth0: 10.0.0.100/24", delay: 50, color: "ok" },
  { text: "", delay: 120 },

  // ── Anomaly intercept (freaky) ───────────────────────────────
  {
    text: "[WARN ] Unidentified signal on crystal bus",
    delay: 160,
    color: "warn",
    triggerGlitch: true,
  },
  {
    text: "  >> 0x7F 0x45 0x4C 0x46 0xDE 0xAD 0xBE 0xEF 0x?? 0x??",
    delay: 100,
    color: "glitch",
  },
  { text: "[  OK  ] Containment field — signal suppressed", delay: 120, color: "ok" },
  { text: "", delay: 80 },

  // ── Services + ready ─────────────────────────────────────────
  { text: "[  OK  ] Started 6 system services", delay: 60, color: "ok" },
  { text: "[  OK  ] Reached target multi-user", delay: 60, color: "ok" },
  { text: "[  OK  ] Started panel interface", delay: 60, color: "ok" },
  { text: "", delay: 150 },
  { text: "> SYSTEM READY. WELCOME BACK, OPERATOR.", delay: 300, color: "cyan" },
  { text: "", delay: 250 },
];

function getLineStyle(color?: LineColor): React.CSSProperties {
  switch (color) {
    case "ok":
      return {
        color: "var(--neon-green, #00ff66)",
        textShadow: "0 0 6px rgba(0,255,100,0.4)",
      };
    case "amber":
      return {
        color: "var(--neon-amber, #ffb800)",
        textShadow: "0 0 4px rgba(255,184,0,0.3)",
      };
    case "dim":
      return { color: "rgba(0,255,100,0.35)" };
    case "warn":
      return {
        color: "var(--neon-red, #ff3333)",
        textShadow: "0 0 8px rgba(255,50,50,0.6)",
      };
    case "glitch":
      return {
        color: "var(--neon-magenta, #e91e8c)",
        textShadow: "0 0 6px rgba(233,30,140,0.5)",
        fontStyle: "italic",
        letterSpacing: "1px",
      };
    case "cyan":
      return {
        color: "var(--neon-cyan, #00e5ff)",
        textShadow: "0 0 10px rgba(0,229,255,0.6), 0 0 20px rgba(0,229,255,0.3)",
      };
    default:
      return { color: "rgba(0,255,100,0.7)" };
  }
}

export function BootSequence({ active, onComplete, scope = "system" }: BootSequenceProps) {
  const [visibleLines, setVisibleLines] = useState<BootLine[]>([]);
  const [fading, setFading] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!active) {
      setVisibleLines([]);
      setFading(false);
      setGlitching(false);
      return;
    }

    setVisibleLines([]);
    setFading(false);
    setGlitching(false);

    let cumulativeDelay = 400;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    BOOT_LINES.forEach((line) => {
      cumulativeDelay += line.delay;
      const t = setTimeout(() => {
        setVisibleLines((prev) => [...prev, line]);

        if (line.triggerGlitch) {
          setGlitching(true);
          setTimeout(() => setGlitching(false), 350);
        }
      }, cumulativeDelay);
      timeouts.push(t);
    });

    cumulativeDelay += 500;
    const fadeT = setTimeout(() => setFading(true), cumulativeDelay);
    timeouts.push(fadeT);

    cumulativeDelay += 500;
    const doneT = setTimeout(() => onComplete(), cumulativeDelay);
    timeouts.push(doneT);

    timeoutsRef.current = timeouts;

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [active, onComplete]);

  if (!active && visibleLines.length === 0) return null;

  return (
    <div
      className={`${scope === "os" ? "absolute" : "fixed"} inset-0 z-[9999] flex items-start justify-center overflow-hidden bg-black`}
      style={{
        opacity: fading ? 0 : 1,
        transition: "opacity 500ms ease-out",
        animation: glitching ? "boot-glitch 300ms steps(1) 1" : "none",
      }}
    >
      {/* CRT scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,100,0.025) 2px, rgba(0,255,100,0.025) 4px)",
          zIndex: 1,
        }}
      />

      {/* Glitch red flash */}
      {glitching && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "rgba(255,0,0,0.06)",
            mixBlendMode: "screen",
            zIndex: 2,
          }}
        />
      )}

      <div className="relative z-10 w-full max-w-2xl p-8 pt-16 font-mono text-sm">
        {visibleLines.map((line, i) => (
          <div key={i} className="leading-6" style={getLineStyle(line.color)}>
            {line.text || " "}
          </div>
        ))}
        {/* Blinking cursor */}
        {!fading && visibleLines.length > 0 && (
          <span
            className="mt-1 inline-block h-4 w-2"
            style={{
              backgroundColor: "var(--neon-green, #00ff66)",
              animation: "blink 1s step-end infinite",
            }}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes boot-glitch {
          0% {
            transform: translate(0, 0) skewX(0deg);
          }
          10% {
            transform: translate(-3px, 1px) skewX(-2deg);
            filter: hue-rotate(90deg) brightness(1.3);
          }
          20% {
            transform: translate(4px, -1px) skewX(1deg);
            filter: hue-rotate(-60deg) saturate(2);
          }
          30% {
            transform: translate(-2px, 2px) skewX(3deg);
            filter: invert(0.15);
          }
          40% {
            transform: translate(0, 0) skewX(0deg);
            filter: none;
          }
          50% {
            transform: translate(2px, -2px) skewX(-1deg);
            filter: hue-rotate(180deg);
          }
          60% {
            transform: translate(-4px, 1px) skewX(2deg);
            filter: brightness(1.8) saturate(3);
          }
          70% {
            transform: translate(1px, 0) skewX(0deg);
            filter: none;
          }
          80% {
            transform: translate(-1px, -1px) skewX(-1deg);
            filter: hue-rotate(45deg);
          }
          100% {
            transform: translate(0, 0) skewX(0deg);
            filter: none;
          }
        }
      `}</style>
    </div>
  );
}
