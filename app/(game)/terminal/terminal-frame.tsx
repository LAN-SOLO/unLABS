"use client";

import { useEffect, useState } from "react";

interface TerminalFrameProps {
  username: string | null;
  availableBalance: number;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}

export function TerminalFrame({
  username,
  availableBalance,
  logoutAction,
  children,
}: TerminalFrameProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  return (
    <div
      className={
        isFullscreen
          ? "flex h-screen w-screen flex-col"
          : "flex h-screen items-center justify-center p-4"
      }
    >
      {/* Terminal window */}
      <div
        className={`flex flex-col overflow-hidden rounded-lg border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.15)] transition-all duration-200 ease-in-out ${
          isFullscreen ? "h-full w-full rounded-none" : ""
        }`}
        style={
          isFullscreen
            ? undefined
            : {
                width: "800px",
                height: "600px",
                minWidth: "800px",
                minHeight: "600px",
                maxWidth: "800px",
                maxHeight: "600px",
                flexShrink: 0,
                flexGrow: 0,
              }
        }
      >
        {/* Title bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-green-500/30 bg-green-900/20 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/70 transition-colors hover:bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70 transition-colors hover:bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500/70 transition-colors hover:bg-green-500" />
            </div>
            <span className="ml-2 text-xs text-green-500/70">
              unLABS://terminal — {username || "UNKNOWN"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-green-500/50">{availableBalance.toFixed(2)} _unSC</span>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-xs text-green-500/70 transition-colors hover:text-green-400"
            >
              {isFullscreen ? "[RESTORE]" : "[FULLSCREEN]"}
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs text-red-500/70 transition-colors hover:text-red-400"
              >
                [DISCONNECT]
              </button>
            </form>
          </div>
        </div>

        {/* Terminal content */}
        <div className="flex-1 overflow-hidden bg-black/95 p-4">{children}</div>
      </div>

      {/* Status bar - hidden in fullscreen */}
      {!isFullscreen && (
        <div className="mt-2 flex shrink-0 justify-between px-2 text-xs text-green-500/40">
          <span>SOLANA DEVNET</span>
          <span>v0.1.0-alpha</span>
          <span>↑↓ HISTORY | ESC CLEAR | ENTER EXECUTE</span>
        </div>
      )}
    </div>
  );
}
