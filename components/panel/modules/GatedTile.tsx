"use client";

/**
 * GatedTile
 * =========
 *
 * Wraps a device-tile component in a quest-flag unlock check. If the player
 * has not yet earned the device, the children are replaced with a LOCKED
 * placeholder so the panel still shows the slot — the player can see what's
 * coming without being able to interact with it.
 *
 * Starter devices and any device id missing from the unlock map render their
 * children unchanged. The check is reactive: when the relevant quest flag
 * flips, the wrapped tile mounts in place.
 */

import type { ReactNode } from "react";
import { useDeviceUnlocked } from "@/hooks/useDeviceUnlocked";
import { getDeviceUnlockFlag } from "@/lib/game/devices/unlocks";
import { PanelFrame } from "@/components/panel/PanelFrame";

interface GatedTileProps {
  deviceId: string;
  /** Display label for the locked placeholder (defaults to deviceId). */
  label?: string;
  children: ReactNode;
}

export function GatedTile({ deviceId, label, children }: GatedTileProps) {
  const unlocked = useDeviceUnlocked(deviceId);
  if (unlocked) return <>{children}</>;
  return <LockedPlaceholder deviceId={deviceId} label={label} />;
}

function LockedPlaceholder({ deviceId, label }: { deviceId: string; label?: string }) {
  const flag = getDeviceUnlockFlag(deviceId);
  return (
    <PanelFrame variant="default" className="p-2 opacity-60">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] tracking-wider text-white/40 uppercase">
            {label ?? deviceId}
          </div>
          <div className="font-mono text-[8px] text-white/30">{deviceId}</div>
        </div>
        <span className="font-mono text-[9px] tracking-wider text-[var(--neon-amber)]">
          ◆ LOCKED
        </span>
      </div>
      <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[9px] leading-tight text-white/40">
        {flag ? (
          <>
            requires:&nbsp;
            <span className="text-white/60">{flag}</span>
          </>
        ) : (
          <>device not yet available</>
        )}
      </div>
    </PanelFrame>
  );
}
