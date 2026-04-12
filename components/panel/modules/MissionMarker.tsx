"use client";

/**
 * MissionMarker
 * =============
 *
 * Small pulsing cyan dot rendered on device tiles that are related to
 * active mission objectives. Acts as a visual breadcrumb so the player
 * can see which devices need attention without reading the mission text.
 */

interface MissionMarkerProps {
  /** Whether to show the marker. */
  active: boolean;
}

export function MissionMarker({ active }: MissionMarkerProps) {
  if (!active) return null;

  return (
    <div className="absolute top-1 left-1 z-10" title="Related to an active mission">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.6)]" />
      </span>
    </div>
  );
}
