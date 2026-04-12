"use client";

/**
 * PowerThermalBridge — couples the PowerManager to the ThermalManager.
 *
 * Every time a power consumer changes state (full / idle / standby / offline),
 * this component pushes the matching watts into the thermal model. The
 * thermal subsystem then drives the per-device sub-zone temperatures and the
 * VentilationFan displays automatically.
 *
 * Almost all electrical power consumed by an electronic device becomes waste
 * heat in the chassis, so we feed `currentDraw` (E/s, treated as watts) into
 * `syncDevicePower` directly without an extra fudge factor.
 *
 * Exception: `'standby'` and `'offline'` both contribute zero waste heat. From
 * the player's point of view, "powered off" should cool the chassis down.
 * Standby draw still counts toward the energy economy via PowerManager — we
 * just don't dissipate it inside the chassis (think: the power is held in
 * containment fields, vented externally, or simply too small to model).
 *
 * Mount this component once, as a child of both `<PowerManagerProvider>` and
 * `<ThermalManagerProvider>`. It renders nothing.
 */

import { useEffect, useMemo, useRef } from "react";
import { useThermalManagerOptional } from "@/contexts/ThermalManager";
import { usePowerManagerOptional } from "@/contexts/PowerManager";

// PowerManager IDs use 3-letter prefixes that don't always match the
// 3-letter device ids the thermal catalog uses. Map the exceptions here.
const POWER_PREFIX_TO_THERMAL_ID: Record<string, string> = {
  INT: "ipl", // Interpolator
  QAN: "qua", // Quantum Analyzer
};

function powerIdToThermalId(powerId: string): string {
  const prefix = powerId.split("-")[0] ?? powerId;
  return POWER_PREFIX_TO_THERMAL_ID[prefix] ?? prefix.toLowerCase();
}

export function PowerThermalBridge() {
  const thermal = useThermalManagerOptional();
  const power = usePowerManagerOptional();

  // Only re-sync when something that actually affects heat changes:
  // device id, current state, or its rated draw values. Avoids spamming
  // setState every render of PowerManagerProvider.
  const fingerprint = useMemo(() => {
    if (!power) return "";
    return power.consumers
      .map((c) => `${c.id}:${c.currentState}:${c.draw.full}:${c.draw.idle}:${c.draw.standby}`)
      .join("|");
  }, [power]);

  // Hold the latest contexts in refs so the sync effect only fires when the
  // fingerprint actually changes. Depending on `thermal`/`power` directly
  // would loop: calling syncDevicePower → ThermalManager setState → new
  // context value → effect re-runs → infinite update loop.
  const thermalRef = useRef(thermal);
  thermalRef.current = thermal;
  const powerRef = useRef(power);
  powerRef.current = power;

  useEffect(() => {
    const t = thermalRef.current;
    const p = powerRef.current;
    if (!t || !p) return;
    for (const c of p.consumers) {
      const id = powerIdToThermalId(c.id);
      const peakW = c.draw.full;
      // Both 'offline' and 'standby' contribute zero waste heat — see header.
      const currentW =
        c.currentState === "offline" || c.currentState === "standby" ? 0 : c.draw[c.currentState];
      t.syncDevicePower(id, currentW, peakW, c.name);
    }
  }, [fingerprint]);

  return null;
}
