"use client";

/**
 * PowerThermalBridge — bidirectional coupling between PowerManager and ThermalManager.
 *
 * Direction 1 (Power → Thermal): When a power consumer changes state, push the
 * matching watts into the thermal model as waste heat. The thermal subsystem
 * then drives per-device sub-zone temperatures and fan auto-control.
 *
 * Direction 2 (Thermal → Power): When ThermalManager computes a performance
 * throttle (due to overheating), feed it back into PowerManager so effective
 * consumer draw is reduced. This creates a self-stabilizing loop:
 *   heat → throttle → reduced draw → less heat → throttle lifts
 *
 * Mount this component once, as a child of both providers. It renders nothing.
 */

import { useEffect, useMemo, useRef } from "react";
import { useThermalManagerOptional } from "@/contexts/ThermalManager";
import { usePowerManagerOptional } from "@/contexts/PowerManager";

const POWER_PREFIX_TO_THERMAL_ID: Record<string, string> = {
  INT: "ipl",
  QAN: "qua",
};

function powerIdToThermalId(powerId: string): string {
  const prefix = powerId.split("-")[0] ?? powerId;
  return POWER_PREFIX_TO_THERMAL_ID[prefix] ?? prefix.toLowerCase();
}

export function PowerThermalBridge() {
  const thermal = useThermalManagerOptional();
  const power = usePowerManagerOptional();

  const thermalRef = useRef(thermal);
  thermalRef.current = thermal;
  const powerRef = useRef(power);
  powerRef.current = power;

  // ── Power → Thermal: sync consumer watts as waste heat ───────────

  const fingerprint = useMemo(() => {
    if (!power) return "";
    const throttle = power.performanceThrottle ?? 1;
    return (
      power.consumers
        .map((c) => `${c.id}:${c.currentState}:${c.draw.full}:${c.draw.idle}:${c.draw.standby}`)
        .join("|") + `|t:${throttle.toFixed(2)}`
    );
  }, [power]);

  useEffect(() => {
    const t = thermalRef.current;
    const p = powerRef.current;
    if (!t || !p) return;
    const throttle = p.performanceThrottle ?? 1;
    for (const c of p.consumers) {
      const id = powerIdToThermalId(c.id);
      const peakW = c.draw.full;
      const currentW =
        c.currentState === "offline" || c.currentState === "standby"
          ? 0
          : c.draw[c.currentState] * throttle;
      t.syncDevicePower(id, currentW, peakW, c.name);
    }
  }, [fingerprint]);

  // ── Thermal → Power: feed performanceThrottle back ───────────────

  const thermalThrottle = thermal?.state.performanceThrottle;
  const lastThrottleRef = useRef(thermalThrottle);

  useEffect(() => {
    const p = powerRef.current;
    if (!p || thermalThrottle === undefined) return;
    if (thermalThrottle === lastThrottleRef.current) return;
    lastThrottleRef.current = thermalThrottle;
    p.setPerformanceThrottle(thermalThrottle);
  }, [thermalThrottle]);

  return null;
}
