"use client";

/**
 * Wraps a game page: in a desktop-only build, a plain browser gets the
 * download page instead of the game (lib/native/gate.ts).
 */
import { useSyncExternalStore, type ReactNode } from "react";
import { tr } from "@/lib/i18n";
import { DESKTOP_ONLY, inDesktopShell, nativeGate } from "@/lib/native/gate";

const noopSubscribe = (): (() => void) => () => {};

export function DesktopGate({ children }: { children: ReactNode }) {
  // Server snapshot: undecided (null) — nothing renders until the client knows.
  const desktop = useSyncExternalStore<boolean | null>(
    noopSubscribe,
    () => inDesktopShell(),
    () => null,
  );
  if (!DESKTOP_ONLY) return <>{children}</>;
  if (desktop === null) return <div className="fixed inset-0 bg-[#07080b]" />;
  if (nativeGate(DESKTOP_ONLY, desktop) === "play") return <>{children}</>;
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-[#07080b] p-4 font-mono text-green-300">
      <div className="max-w-lg border border-green-500/40 bg-black/70 p-6">
        <h1 className="mb-3 text-lg tracking-widest text-amber-300">
          {tr("UnstableLabs is a desktop game")}
        </h1>
        <p className="mb-3 text-sm leading-relaxed">
          {tr(
            "The lab runs as a native app on macOS, Windows and Linux — with its own local database and the full graphics engine. It does not run in a web browser.",
          )}
        </p>
        <ul className="mb-4 list-inside list-disc text-sm text-green-200/80">
          <li>{tr("macOS: the .dmg installer (Apple Silicon)")}</li>
          <li>{tr("Windows: the setup .exe")}</li>
          <li>{tr("Linux: the Flatpak (or the AppImage)")}</li>
        </ul>
        <p className="text-xs text-green-500/70">
          {tr("Ask the UnstableLabs team for the current download link.")}
        </p>
      </div>
    </main>
  );
}
