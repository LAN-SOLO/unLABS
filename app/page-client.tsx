"use client";

import { useState } from "react";
import Link from "next/link";
import { BootSequence } from "@/components/BootSequence";

export function LandingPageClient() {
  const [showBoot, setShowBoot] = useState(true);
  const [showContent, setShowContent] = useState(false);

  const handleBootComplete = () => {
    setShowBoot(false);
    setShowContent(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-black font-mono text-green-500">
      {/* Boot Sequence */}
      {showBoot && <BootSequence variant="landing" onComplete={handleBootComplete} />}

      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)",
        }}
      />

      {/* CRT glow */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          boxShadow: "inset 0 0 150px rgba(34, 197, 94, 0.1)",
        }}
      />

      <main
        className={`flex flex-1 flex-col items-center justify-center p-8 transition-opacity duration-500 ${
          showContent ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* ASCII Logo */}
        <pre className="mb-8 text-center text-xs leading-tight text-green-500 sm:text-sm">
          {`
 _   _ _   _ _        _    ____  ____
| | | | \\ | | |      / \\  | __ )/ ___|
| | | |  \\| | |     / _ \\ |  _ \\\\___ \\
| |_| | |\\  | |___ / ___ \\| |_) |___) |
 \\___/|_| \\_|_____/_/   \\_\\____/|____/
`}
        </pre>

        {/* Title */}
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-2xl text-green-400 sm:text-3xl">UNSTABLE LABORATORIES</h1>
          <p className="text-sm text-green-500/70">Quantum Crystal Research Facility</p>
        </div>

        {/* Terminal box */}
        <div className="w-full max-w-lg overflow-hidden rounded-lg border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
          <div className="flex items-center gap-2 border-b border-green-500/30 bg-green-900/20 px-4 py-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
            </div>
            <span className="ml-2 text-xs text-green-500/50">system://init</span>
          </div>

          <div className="space-y-4 bg-black/90 p-6">
            <div className="space-y-1 text-sm">
              <p className="text-green-500/70">&gt; SYSTEM ONLINE</p>
              <p className="text-green-500/70">&gt; QUANTUM CORES: STABLE</p>
              <p className="text-green-500/70">&gt; AWAITING OPERATOR...</p>
            </div>

            <div className="space-y-3 pt-4">
              <Link
                href="/login"
                className="block w-full border border-green-500 bg-green-500/20 px-4 py-3 text-center text-green-400 transition-colors hover:bg-green-500/30"
              >
                &gt; AUTHENTICATE
              </Link>
              <Link
                href="/register"
                className="block w-full border border-green-500/50 bg-transparent px-4 py-3 text-center text-green-500/70 transition-colors hover:border-green-500 hover:text-green-400"
              >
                &gt; REQUEST ACCESS
              </Link>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-12 space-y-2 text-center text-xs text-green-500/40">
          <p>Manage NFT crystals through a retro terminal interface</p>
          <p>Earn _unSC tokens through research and cultivation</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-green-500/30">
        <p>v{process.env.NEXT_PUBLIC_APP_VERSION} | SOLANA DEVNET</p>
      </footer>
    </div>
  );
}
