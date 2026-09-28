"use client";

import { tr } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { settle } from "@/lib/world/game";
import { bioTick } from "@/lib/world/biorhythm";
import { loadWorld, resetWorld, saveWorld } from "@/lib/world/save";
import { getSettings } from "@/lib/world/settings";
import { ACHIEVEMENT_BY_ID, evaluateAchievements } from "@/lib/world/achievements";
import type { WorldState } from "@/lib/world/types";

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "good" | "warn" | "insight";
  /** Optional item id shown as an icon. */
  item?: string;
}

/**
 * World state lives in a ref (the 3D engine reads it every frame); React
 * re-renders via a version counter after each action. Every action saves.
 */
export function useWorld() {
  const ref = useRef<WorldState | null>(null);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const listeners = useRef(new Set<() => void>());
  const paused = useRef(false);
  const toastRef = useRef<((text: string, tone?: Toast["tone"]) => void) | null>(null);

  if (ref.current === null && typeof window !== "undefined") {
    ref.current = loadWorld();
    settle(ref.current);
  }

  const get = useCallback((): WorldState => ref.current!, []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info", item?: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-4), item ? { id, text, tone, item } : { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      (tone === "insight" ? 1.4 : 1) * getSettings().gameplay.toastSeconds * 1000,
    );
  }, []);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const act = useCallback(<T>(fn: (s: WorldState) => T): T => {
    const s = ref.current!;
    const result = fn(s);
    for (const id of evaluateAchievements(s)) {
      const a = ACHIEVEMENT_BY_ID.get(id);
      if (a) toastRef.current?.(tr("★ Achievement: {title}", { title: a.title }), "good");
    }
    saveWorld(s);
    setVersion((v) => v + 1);
    listeners.current.forEach((l) => l());
    return result;
  }, []);

  const onChange = useCallback((l: () => void) => {
    listeners.current.add(l);
    return () => {
      listeners.current.delete(l);
    };
  }, []);

  const reset = useCallback(() => {
    ref.current = resetWorld();
    settle(ref.current);
    setVersion((v) => v + 1);
    listeners.current.forEach((l) => l());
  }, []);

  // Play clock: advances respawn timers; saves every 10 s.
  useEffect(() => {
    let n = 0;
    const id = window.setInterval(() => {
      const s = ref.current;
      if (!s || document.hidden || paused.current) return;
      s.playTime += 1;
      // Biorhythm: slow decay; starts on the first visit to Level +1.
      if (bioTick(s, 1, getSettings().gameplay.biorhythm).activated) {
        toastRef.current?.(
          tr(
            "MCP: Dr. Lawrence, welcome to the Living Quarters. From now on I will keep an eye on your food, water and sleep. Gently.",
          ),
          "info",
        );
        saveWorld(s);
        setVersion((v) => v + 1);
        listeners.current.forEach((l) => l());
      }
      if (++n % 10 === 0) {
        saveWorld(s);
        setVersion((v) => v + 1);
        listeners.current.forEach((l) => l());
      }
    }, 1000);
    const flush = () => ref.current && saveWorld(ref.current);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  const setPaused = useCallback((p: boolean) => {
    paused.current = p;
  }, []);

  return { get, act, version, toasts, toast, onChange, reset, setPaused };
}
