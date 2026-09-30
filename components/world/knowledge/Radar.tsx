"use client";

import { tr } from "@/lib/i18n";
import { UI } from "@/components/world/ui";
import { AREA_LABEL, type AreaScore } from "@/lib/world/knowledge";

/** Short axis labels for the radar (full names are in the bars). */
const SHORT: Readonly<Record<AreaScore["area"], string>> = {
  power: tr("radar::Power"),
  building: tr("radar::Build"),
  combining: tr("radar::Combine"),
  signals: tr("radar::Signals"),
  anomalies: tr("radar::Anomalies"),
  quantum: tr("radar::Quantum"),
  systems: tr("radar::Systems"),
  people: tr("radar::People"),
  exploration: tr("radar::Explore"),
  body: tr("radar::Body"),
};

/** Knowledge radar: one axis per area, 0…100 %, rings at the level thresholds. */
export function KnowledgeRadar({
  areas,
  size = 220,
}: {
  areas: readonly AreaScore[];
  size?: number;
}) {
  const c = size / 2;
  const r = c - 34;
  const n = areas.length;
  const at = (i: number, f: number): [number, number] => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [c + Math.cos(a) * r * f, c + Math.sin(a) * r * f];
  };
  const ring = (f: number) =>
    areas
      .map((_, i) =>
        at(i, f)
          .map((v) => v.toFixed(1))
          .join(","),
      )
      .join(" ");
  const shape = areas
    .map((x, i) =>
      at(i, Math.max(0.02, x.pct / 100))
        .map((v) => v.toFixed(1))
        .join(","),
    )
    .join(" ");
  const summary = areas.map((x) => `${AREA_LABEL[x.area]} ${x.pct}%`).join(", ");
  // Side room for the axis labels left and right of the rings (German ones run ~11 chars).
  const pad = 48;
  return (
    <svg
      viewBox={`${-pad} 0 ${size + pad * 2} ${size}`}
      width={size + pad * 2}
      height={size}
      role="img"
      aria-label={tr("Knowledge radar: {summary}", { summary })}
      className="shrink-0"
    >
      {[0.25, 0.45, 0.7, 0.9, 1].map((f) => (
        <polygon
          key={f}
          points={ring(f)}
          fill="none"
          stroke={f === 1 ? "#33FF3355" : "#33FF3322"}
          strokeWidth={1}
        />
      ))}
      {areas.map((_, i) => {
        const [x, y] = at(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#33FF3322" strokeWidth={1} />;
      })}
      <polygon
        points={shape}
        fill={`${UI.cyan}33`}
        stroke={UI.cyan}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {areas.map((x, i) => {
        const [px, py] = at(i, Math.max(0.02, x.pct / 100));
        const [lx, ly] = at(i, 1.2);
        return (
          <g key={x.area}>
            <circle cx={px} cy={py} r={2.2} fill={UI.cyan} />
            <text
              x={lx}
              y={ly}
              fontSize={9}
              fill={x.level > 0 ? UI.amber : "#ffffff66"}
              textAnchor={Math.abs(lx - c) < 6 ? "middle" : lx < c ? "end" : "start"}
              dominantBaseline="middle"
              fontFamily="monospace"
            >
              {SHORT[x.area]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
