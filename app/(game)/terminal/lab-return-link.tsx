"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { tr } from "@/lib/i18n";
import { formatLabSummary, labWorldActions, type LabSummary } from "@/lib/terminal/labWorld";

const REFRESH_MS = 10_000;

const noopSubscribe = (): (() => void) => () => {};

/**
 * False during SSR and hydration, true afterwards. The server always renders
 * English (`getLocale()` is "en" there), so the translated texts switch in
 * only after hydration to avoid a mismatch for German players.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * "< /world · back to the lab" — the way back from the big terminal into the
 * lab world, with a live one-line summary of the active world slot (so the
 * effect of `labor signal …` is visible without leaving). A full navigation
 * on purpose: the world remounts and reloads the slot the terminal wrote.
 */
export function LabReturnLink() {
  const [sum, setSum] = useState<LabSummary | null>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    let alive = true;
    const refresh = (): void => {
      labWorldActions
        .summary()
        .then((s) => {
          if (alive) setSum(s);
        })
        .catch(() => {
          // Optional decoration — keep the plain link.
        });
    };
    refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    const onVisible = (): void => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", refresh);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <a
      href="/world"
      title={
        sum
          ? tr("{slot} · Play time {time}", { slot: sum.slotName, time: sum.playTime })
          : hydrated
            ? tr("Enter the Lab World")
            : "Enter the Lab World"
      }
      className="fixed bottom-4 left-4 z-40 max-w-[calc(100vw-12rem)] truncate border border-[#FFB800]/60 bg-black/80 px-3 py-1 font-mono text-xs text-[#FFB800] hover:bg-[#FFB800]/20"
    >
      &lt; /world · {hydrated ? tr("back to the lab") : "back to the lab"}
      {sum ? <span className="text-[#FFB800]/60"> · {formatLabSummary(sum)}</span> : null}
    </a>
  );
}
