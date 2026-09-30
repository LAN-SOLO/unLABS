"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { MapGlyph } from "@/components/world/map/MapIcon";
import {
  CATEGORY_Z,
  ICON_RADIUS,
  MAP_COLORS,
  MINI_ICON_RADIUS,
  THEME_TINT,
} from "@/components/world/map/theme";
import {
  VB,
  VIEWBOX,
  iconScale,
  scaleBar,
  viewTransform,
  type MapView,
} from "@/components/world/map/view";
import type {
  MapCategory,
  MapDoor,
  MapEntity,
  MapFloor,
  MapPin,
  MapRoom,
} from "@/lib/world/map-data";

export interface PlayerInfo {
  x: number;
  z: number;
  facing: number;
  yaw: number;
}

export interface MapSvgProps {
  floor: MapFloor;
  cats: ReadonlySet<MapCategory>;
  view: MapView;
  /** HUD minimap: no labels, no interaction, smaller details. */
  mini?: boolean;
  /** Animate zoom/pan changes (off while dragging). */
  smooth?: boolean;
  selectedKey?: string | null;
  /** Highlight from the side list (hover/focus). */
  hoverKey?: string | null;
  /** Objective marker on this floor. */
  target?: { x: number; z: number } | null;
  tracked?: boolean;
  pin?: MapPin | null;
  /** Player getter (only when the player is on this floor). */
  player?: (() => PlayerInfo | null) | null;
  onEntityHover?: (e: MapEntity | null, el: Element | null) => void;
  onEntitySelect?: (key: string) => void;
  onRoomSelect?: (id: string) => void;
  label: string;
  className?: string;
}

const WALL = 1.1;
const STYLE = `
.lwmap-pulse{animation:lwmapPulse 1.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
.lwmap-spin{animation:lwmapSpin 8s linear infinite;transform-box:fill-box;transform-origin:center}
.lwmap-blink{animation:lwmapBlink 1.2s ease-in-out infinite}
.lwmap-ent{cursor:pointer;outline:none}
.lwmap-ent:focus-visible .lwmap-focus{opacity:1}
@keyframes lwmapPulse{0%{transform:scale(.55);opacity:1}100%{transform:scale(1.9);opacity:0}}
@keyframes lwmapSpin{to{transform:rotate(360deg)}}
@keyframes lwmapBlink{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.lwmap-pulse,.lwmap-spin,.lwmap-blink{animation:none}}
`;

function roomFill(r: MapRoom): { fill: string; opacity: number } {
  const tint = THEME_TINT[r.theme] ?? THEME_TINT.generic;
  if (r.fog === "visited") return { fill: tint, opacity: r.lit ? 1 : 0.62 };
  if (r.fog === "known") return { fill: tint, opacity: 0.32 };
  return { fill: "#1a1d1b", opacity: 0.5 };
}

function truncate(text: string, maxChars: number): string {
  if (maxChars < 3) return "";
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

function Rooms({
  rooms,
  mini,
  k,
  uid,
}: {
  rooms: MapRoom[];
  mini: boolean;
  k: number;
  uid: string;
}) {
  return (
    <g>
      {rooms.map((r) => {
        const f = roomFill(r);
        return (
          <g key={r.id}>
            <path d={r.outline} fill={f.fill} opacity={f.opacity} />
            {r.fog === "visited" && (
              <path d={r.outline} fill={mini ? "none" : `url(#${uid}-grid)`} />
            )}
            {r.fog === "unknown" && <path d={r.outline} fill={`url(#${uid}-hatch)`} />}
            {r.fog === "visited" && !r.lit && <path d={r.outline} fill={`url(#${uid}-dark)`} />}
          </g>
        );
      })}
      {/* Walls on top of every floor tint (shared walls overlap). */}
      {rooms.map((r) => (
        <path
          key={`w-${r.id}`}
          d={r.outline}
          fill="none"
          stroke={r.fog === "visited" ? MAP_COLORS.wallVisited : MAP_COLORS.wall}
          strokeOpacity={r.fog === "visited" ? 0.9 : r.fog === "known" ? 0.55 : 0.25}
          strokeWidth={mini ? WALL * 1.2 : WALL}
          strokeDasharray={r.fog === "unknown" ? "2 1.5" : undefined}
        />
      ))}
      {!mini &&
        rooms
          .filter((r) => r.fog === "known")
          .map((r) => (
            <path
              key={`k-${r.id}`}
              d={r.outline}
              transform={`translate(${r.x + r.w / 2} ${r.z + r.d / 2}) scale(${Math.max(0.5, 1 - 3.2 / Math.max(8, r.w))} ${Math.max(0.5, 1 - 3.2 / Math.max(8, r.d))}) translate(${-(r.x + r.w / 2)} ${-(r.z + r.d / 2)})`}
              fill="none"
              stroke={MAP_COLORS.amber}
              strokeOpacity={0.45}
              strokeWidth={0.35 / k}
              strokeDasharray={`${1.4 / k} ${1 / k}`}
            />
          ))}
    </g>
  );
}

function Doors({ doors, mini }: { doors: MapDoor[]; mini: boolean }) {
  return (
    <g>
      {doors.map((d) => {
        const half = d.width / 2;
        const along = d.axis === "x";
        const gap = along
          ? { x: d.x - half, y: d.z - WALL, width: d.width, height: WALL * 2 }
          : { x: d.x - WALL, y: d.z - half, width: WALL * 2, height: d.width };
        const line = along
          ? { x1: d.x - half, y1: d.z, x2: d.x + half, y2: d.z }
          : { x1: d.x, y1: d.z - half, x2: d.x, y2: d.z + half };
        if (d.state === "suspected")
          return (
            <line
              key={d.id}
              {...line}
              stroke="#B388FF"
              strokeWidth={0.7}
              strokeDasharray="0.5 0.6"
              className={mini ? undefined : "lwmap-blink"}
            />
          );
        const jambs = along
          ? [
              { x1: d.x - half, y1: d.z - WALL, x2: d.x - half, y2: d.z + WALL },
              { x1: d.x + half, y1: d.z - WALL, x2: d.x + half, y2: d.z + WALL },
            ]
          : [
              { x1: d.x - WALL, y1: d.z - half, x2: d.x + WALL, y2: d.z - half },
              { x1: d.x - WALL, y1: d.z + half, x2: d.x + WALL, y2: d.z + half },
            ];
        const color =
          d.state === "open"
            ? "#33FF33"
            : d.state === "keypad"
              ? "#FFB800"
              : d.state === "secret"
                ? "#E91E8C"
                : "#FF3333";
        return (
          <g key={d.id}>
            <rect {...gap} fill={MAP_COLORS.bg} />
            {jambs.map((j, i) => (
              <line key={i} {...j} stroke={color} strokeWidth={0.45} strokeOpacity={0.9} />
            ))}
            {d.state !== "open" && (
              <line
                {...line}
                stroke={color}
                strokeWidth={d.state === "secret" ? 0.5 : 0.9}
                strokeDasharray={d.state === "secret" ? "0.8 0.5" : undefined}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

function RoomLabels({
  rooms,
  k,
  onRoomSelect,
}: {
  rooms: MapRoom[];
  k: number;
  onRoomSelect?: (id: string) => void;
}) {
  const font = 2.2 / k;
  const small = 1.6 / k;
  return (
    <g fontFamily="ui-monospace, monospace">
      {rooms.map((r) => {
        if (r.fog === "unknown")
          return (
            <text
              key={r.id}
              x={r.ax}
              y={r.az}
              fontSize={Math.max(3.2 / Math.sqrt(k), font * 1.6)}
              fill="#ffffff"
              fillOpacity={0.28}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
            >
              ?
            </text>
          );
        const maxChars = Math.floor((r.w - 2.4) / (font * 0.62));
        const name = truncate(r.name, maxChars);
        return (
          <g
            key={r.id}
            onClick={onRoomSelect ? () => onRoomSelect(r.id) : undefined}
            style={onRoomSelect ? { cursor: "pointer" } : undefined}
          >
            <text
              x={r.x + 1.3}
              y={r.z + 1.3 + font}
              fontSize={font}
              fill={MAP_COLORS.text}
              fillOpacity={r.fog === "visited" ? 0.85 : 0.45}
            >
              {name}
            </text>
            {r.d * k > 10 && (
              <text
                x={r.x + 1.3}
                y={r.z + 1.6 + font + small}
                fontSize={small}
                fill={MAP_COLORS.amber}
                fillOpacity={r.fog === "visited" ? 0.7 : 0.35}
              >
                {r.code}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Entities({
  entities,
  k,
  mini,
  selectedKey,
  hoverKey,
  onHover,
  onSelect,
}: {
  entities: MapEntity[];
  k: number;
  mini: boolean;
  selectedKey?: string | null;
  hoverKey?: string | null;
  onHover?: (e: MapEntity | null, el: Element | null) => void;
  onSelect?: (key: string) => void;
}) {
  const sorted = [...entities].sort((a, b) => CATEGORY_Z[a.category] - CATEGORY_Z[b.category]);
  const r = (mini ? MINI_ICON_RADIUS : ICON_RADIUS) * (mini ? 1 : iconScale(k));
  const interactive = !mini && !!onSelect;
  return (
    <g>
      {sorted.map((e) => {
        const small = e.category === "decor" ? 0.75 : 1;
        const sel = e.key === selectedKey;
        const hov = e.key === hoverKey;
        const onKey = (ev: KeyboardEvent<SVGGElement>) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            ev.stopPropagation();
            onSelect?.(e.key);
          }
        };
        return (
          <g
            key={e.key}
            transform={`translate(${e.x} ${e.z}) scale(${r * small})`}
            className={interactive ? "lwmap-ent" : undefined}
            data-key={e.key}
            {...(interactive
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": tr("{name} — {status}", { name: e.name, status: e.statusText }),
                  "aria-pressed": sel,
                  onClick: () => onSelect?.(e.key),
                  onKeyDown: onKey,
                  onMouseEnter: (ev: { currentTarget: Element }) => onHover?.(e, ev.currentTarget),
                  onMouseLeave: () => onHover?.(null, null),
                  onFocus: (ev: { currentTarget: Element }) => onHover?.(e, ev.currentTarget),
                  onBlur: () => onHover?.(null, null),
                }
              : {})}
          >
            {interactive && <circle r={1.6} fill="transparent" />}
            {interactive && (
              <circle
                className="lwmap-focus"
                r={1.45}
                fill="none"
                stroke={MAP_COLORS.cyan}
                strokeWidth={0.18}
                opacity={0}
              />
            )}
            {(sel || hov) && (
              <circle
                r={1.55}
                fill="none"
                stroke={sel ? MAP_COLORS.cyan : "#ffffff"}
                strokeWidth={0.22}
                strokeDasharray="0.5 0.35"
                className={sel ? "lwmap-spin" : undefined}
              />
            )}
            <MapGlyph category={e.category} status={e.status} done={e.done} mini={mini} />
          </g>
        );
      })}
    </g>
  );
}

function Compass() {
  const x = VB.x + VB.w - 7;
  const z = VB.z + 7;
  return (
    <g transform={`translate(${x} ${z})`} aria-hidden fontFamily="ui-monospace, monospace">
      <circle
        r={4.6}
        fill="rgba(0,0,0,0.55)"
        stroke={MAP_COLORS.amber}
        strokeOpacity={0.5}
        strokeWidth={0.25}
      />
      <path d="M0,-4 L1,0 L0,-0.6 L-1,0 Z" fill={MAP_COLORS.amber} />
      <path d="M0,4 L1,0 L0,0.6 L-1,0 Z" fill={MAP_COLORS.amber} fillOpacity={0.35} />
      <path d="M-4,0 L0,-0.7 L4,0 L0,0.7 Z" fill={MAP_COLORS.amber} fillOpacity={0.25} />
      <text y={-5.2} fontSize={2.2} textAnchor="middle" fill={MAP_COLORS.amber}>
        {tr("compass::N")}
      </text>
    </g>
  );
}

function ScaleBar({ k }: { k: number }) {
  const { metres, units } = scaleBar(k);
  const x = VB.x + 3;
  const z = VB.z + VB.h - 2.5;
  return (
    <g aria-hidden fontFamily="ui-monospace, monospace">
      <rect x={x - 1} y={z - 4} width={units + 12} height={5.4} fill="rgba(0,0,0,0.55)" />
      <path
        d={`M${x},${z - 1.4} V${z} H${x + units} V${z - 1.4} M${x + units / 2},${z} V${z - 0.8}`}
        fill="none"
        stroke={MAP_COLORS.text}
        strokeWidth={0.3}
      />
      <text x={x + units + 1.2} y={z} fontSize={2} fill={MAP_COLORS.text}>
        {tr("{n} m", { n: metres })}
      </text>
    </g>
  );
}

/** Animated player arrow with view cone; updated at ~10 Hz without React renders. */
function PlayerMarker({
  player,
  k,
  mini,
  uid,
}: {
  player: () => PlayerInfo | null;
  k: number;
  mini: boolean;
  uid: string;
}) {
  const ref = useRef<SVGGElement>(null);
  const coneRef = useRef<SVGPathElement>(null);
  const arrowRef = useRef<SVGGElement>(null);
  const playerRef = useRef(player);
  const kRef = useRef(k);
  useEffect(() => {
    playerRef.current = player;
    kRef.current = k;
  }, [player, k]);
  useEffect(() => {
    const tick = () => {
      const g = ref.current;
      const pl = playerRef.current();
      if (!g) return;
      if (!pl) {
        g.setAttribute("visibility", "hidden");
        return;
      }
      g.setAttribute("visibility", "visible");
      g.setAttribute("transform", `translate(${pl.x} ${pl.z})`);
      const s = mini ? 1.4 : 1.6 * iconScale(kRef.current);
      arrowRef.current?.setAttribute(
        "transform",
        `scale(${s}) rotate(${(-pl.facing * 180) / Math.PI})`,
      );
      // The camera looks along (-sin yaw, -cos yaw) in map space.
      const va = Math.atan2(-Math.cos(pl.yaw), -Math.sin(pl.yaw));
      const R = mini ? 16 : 14;
      const a0 = va - 0.5;
      const a1 = va + 0.5;
      coneRef.current?.setAttribute(
        "d",
        `M0,0 L${R * Math.cos(a0)},${R * Math.sin(a0)} A${R},${R} 0 0 1 ${R * Math.cos(a1)},${R * Math.sin(a1)} Z`,
      );
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [mini]);
  return (
    <g ref={ref} visibility="hidden" pointerEvents="none">
      <defs>
        <radialGradient id={`${uid}-cone`}>
          <stop offset="0%" stopColor={MAP_COLORS.cyan} stopOpacity={0.35} />
          <stop offset="100%" stopColor={MAP_COLORS.cyan} stopOpacity={0} />
        </radialGradient>
      </defs>
      <path ref={coneRef} fill={`url(#${uid}-cone)`} />
      <g ref={arrowRef}>
        <circle
          r={1.5}
          fill="none"
          stroke={MAP_COLORS.cyan}
          strokeWidth={0.2}
          className="lwmap-pulse"
        />
        <path
          d="M0,1.3 L0.95,-0.9 L0,-0.45 L-0.95,-0.9 Z"
          fill={MAP_COLORS.cyan}
          stroke="#000"
          strokeWidth={0.15}
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

function TargetMarker({
  x,
  z,
  k,
  tracked,
  mini,
}: {
  x: number;
  z: number;
  k: number;
  tracked: boolean;
  mini: boolean;
}) {
  const s = mini ? 1.5 : 2 * iconScale(k);
  return (
    <g transform={`translate(${x} ${z}) scale(${s})`} pointerEvents="none">
      <circle
        r={1.2}
        fill="none"
        stroke={MAP_COLORS.magenta}
        strokeWidth={0.25}
        className="lwmap-pulse"
      />
      <circle r={1.1} fill="none" stroke={MAP_COLORS.magenta} strokeWidth={0.22} />
      {tracked && (
        <>
          <path
            d="M-1.8,0H-0.6M0.6,0H1.8M0,-1.8V-0.6M0,0.6V1.8"
            stroke={MAP_COLORS.magenta}
            strokeWidth={0.22}
          />
          <circle r={0.35} fill={MAP_COLORS.magenta} />
        </>
      )}
    </g>
  );
}

function PinMarker({ x, z, k, mini }: { x: number; z: number; k: number; mini: boolean }) {
  const s = mini ? 1.4 : 1.9 * iconScale(k);
  return (
    <g transform={`translate(${x} ${z}) scale(${s})`} pointerEvents="none">
      <path
        d="M0,0 C-0.3,-0.6 -0.9,-1 -0.9,-1.6 A0.9,0.9 0 1 1 0.9,-1.6 C0.9,-1 0.3,-0.6 0,0 Z"
        fill={MAP_COLORS.cyan}
        stroke="#000"
        strokeWidth={0.15}
      />
      <circle cy={-1.6} r={0.35} fill="#000" />
    </g>
  );
}

/**
 * The floor plan as crisp SVG: tinted rooms with a tile pattern, thick
 * walls with door gaps (state-coloured jambs), fog of war, entity icons,
 * objective, waypoint and the live player marker. Pure presentation — the
 * caller owns zoom/pan (`view`) and selection.
 */
export function MapSvg({
  floor,
  cats,
  view,
  mini = false,
  smooth = true,
  selectedKey,
  hoverKey,
  target,
  tracked = false,
  pin,
  player,
  onEntityHover,
  onEntitySelect,
  onRoomSelect,
  label,
  className = "",
}: MapSvgProps) {
  const uid = `lwmap${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const k = view.k;
  const entities = floor.entities.filter((e) => cats.has(e.category));
  const extra: ReactNode = (
    <>
      {pin && <PinMarker x={pin.x} z={pin.z} k={k} mini={mini} />}
      {target && <TargetMarker x={target.x} z={target.z} k={k} tracked={tracked} mini={mini} />}
      {player && <PlayerMarker player={player} k={k} mini={mini} uid={uid} />}
    </>
  );
  return (
    <svg
      viewBox={VIEWBOX}
      className={`block h-full w-full select-none ${className}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
    >
      <style>{STYLE}</style>
      <defs>
        <pattern id={`${uid}-grid`} width={4} height={4} patternUnits="userSpaceOnUse">
          <path
            d="M4,0 H0 V4"
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.06}
            strokeWidth={0.12}
          />
        </pattern>
        <pattern
          id={`${uid}-hatch`}
          width={2.4}
          height={2.4}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path d="M0,0 V2.4" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={0.5} />
        </pattern>
        <pattern id={`${uid}-dark`} width={1.6} height={1.6} patternUnits="userSpaceOnUse">
          <rect width={1.6} height={1.6} fill="#000" fillOpacity={0.25} />
          <circle cx={0.8} cy={0.8} r={0.18} fill="#000" fillOpacity={0.5} />
        </pattern>
      </defs>
      <rect x={VB.x} y={VB.z} width={VB.w} height={VB.h} fill={MAP_COLORS.bg} />
      <g
        style={{
          transform: viewTransform(view),
          transition: smooth ? "transform 180ms ease-out" : undefined,
        }}
      >
        <Rooms rooms={floor.rooms} mini={mini} k={k} uid={uid} />
        <Doors doors={floor.doors} mini={mini} />
        {!mini && <RoomLabels rooms={floor.rooms} k={k} onRoomSelect={onRoomSelect} />}
        <Entities
          entities={entities}
          k={k}
          mini={mini}
          selectedKey={selectedKey}
          hoverKey={hoverKey}
          onHover={onEntityHover}
          onSelect={onEntitySelect}
        />
        {extra}
      </g>
      {!mini && <Compass />}
      {!mini && <ScaleBar k={k} />}
      {/* CRT scanlines */}
      <rect
        x={VB.x}
        y={VB.z}
        width={VB.w}
        height={VB.h}
        fill={`url(#${uid}-scan)`}
        pointerEvents="none"
      />
      <defs>
        <pattern id={`${uid}-scan`} width={VB.w} height={0.9} patternUnits="userSpaceOnUse">
          <rect width={VB.w} height={0.3} fill="#000" fillOpacity={mini ? 0.12 : 0.16} />
        </pattern>
      </defs>
    </svg>
  );
}
