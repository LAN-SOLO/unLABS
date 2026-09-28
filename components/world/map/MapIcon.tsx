"use client";

import {
  GLYPH,
  GLYPH_EVENODD,
  entityBadge,
  entityColor,
  entityHollow,
  type Badge,
} from "@/components/world/map/theme";
import type { MapCategory, MapStatus } from "@/lib/world/map-data";

const BADGE_PATH: Record<Exclude<Badge, null>, string> = {
  check: "M-0.45,0L-0.1,0.35L0.45,-0.3",
  bang: "M0,-0.45V0.1M0,0.3V0.35",
  lock: "M-0.3,-0.05H0.3V0.4H-0.3ZM-0.18,-0.05V-0.25A0.18,0.18 0 0 1 0.18,-0.25V-0.05",
  dot: "",
  q: "M-0.2,-0.2A0.2,0.2 0 1 1 0,0V0.12M0,0.3V0.34",
};

/**
 * One map glyph (unit box −1…1, the caller scales it). Hollow statuses draw
 * a dashed outline, done statuses are dimmed; the badge in the upper right
 * is a colour-independent status cue.
 */
export function MapGlyph({
  category,
  status,
  done = false,
  mini = false,
}: {
  category: MapCategory;
  status: MapStatus;
  done?: boolean;
  mini?: boolean;
}) {
  const color = entityColor(category, status);
  const hollow = entityHollow(status);
  const badge = mini ? null : entityBadge(status);
  return (
    <g opacity={done ? 0.5 : 1}>
      <path
        d={GLYPH[category]}
        fill={hollow ? "rgba(0,0,0,0.55)" : color}
        fillRule={GLYPH_EVENODD.has(category) ? "evenodd" : "nonzero"}
        stroke={hollow ? color : "#000"}
        strokeWidth={hollow ? 0.22 : 0.18}
        strokeDasharray={hollow ? "0.35 0.2" : undefined}
        strokeLinejoin="round"
      />
      {badge && (
        <g transform="translate(0.85 -0.85) scale(0.6)">
          <circle r={0.62} fill="#0b0b0b" stroke={color} strokeWidth={0.14} />
          {badge === "dot" ? (
            <circle r={0.28} fill={color} />
          ) : (
            <path
              d={BADGE_PATH[badge]}
              fill={badge === "lock" ? color : "none"}
              fillRule="evenodd"
              stroke={color}
              strokeWidth={0.16}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      )}
    </g>
  );
}

/** Stand-alone inline icon (legend, lists, dossier header). */
export function MapIcon({
  category,
  status,
  done,
  size = 14,
  title,
}: {
  category: MapCategory;
  status: MapStatus;
  done?: boolean;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1.3 -1.3 2.6 2.6"
      className="inline-block shrink-0 align-middle"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      <MapGlyph category={category} status={status} done={done} />
    </svg>
  );
}
