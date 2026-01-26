import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
        }}
      />

      {/* CRT glow */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          boxShadow: 'inset 0 0 150px rgba(34, 197, 94, 0.1)',
        }}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {/* ASCII Logo */}
        <pre className="text-green-500 text-xs sm:text-sm mb-8 leading-tight text-center">
{`
 _   _ _   _ _        _    ____  ____
| | | | \\ | | |      / \\  | __ )/ ___|
| | | |  \\| | |     / _ \\ |  _ \\\\___ \\
| |_| | |\\  | |___ / ___ \\| |_) |___) |
 \\___/|_| \\_|_____/_/   \\_\\____/|____/
`}
        </pre>

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl mb-2 text-green-400">
            UNSTABLE LABORATORIES
          </h1>
          <p className="text-green-500/70 text-sm">
            Quantum Crystal Research Facility
          </p>
        </div>

        {/* Terminal box */}
        <div className="w-full max-w-lg border border-green-500/30 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.15)]">
          <div className="bg-green-900/20 border-b border-green-500/30 px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            <span className="text-green-500/50 text-xs ml-2">system://init</span>
          </div>

          <div className="bg-black/90 p-6 space-y-4">
            <div className="text-sm space-y-1">
              <p className="text-green-500/70">&gt; SYSTEM ONLINE</p>
              <p className="text-green-500/70">&gt; QUANTUM CORES: STABLE</p>
              <p className="text-green-500/70">&gt; AWAITING OPERATOR...</p>
            </div>

            <div className="pt-4 space-y-3">
              <Link
                href="/login"
                className="block w-full bg-green-500/20 border border-green-500 text-green-400 px-4 py-3 text-center hover:bg-green-500/30 transition-colors"
              >
                &gt; AUTHENTICATE
              </Link>
              <Link
                href="/register"
                className="block w-full bg-transparent border border-green-500/50 text-green-500/70 px-4 py-3 text-center hover:border-green-500 hover:text-green-400 transition-colors"
              >
                &gt; REQUEST ACCESS
              </Link>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-12 text-center text-green-500/40 text-xs space-y-2">
          <p>Manage NFT crystals through a retro terminal interface</p>
          <p>Earn _unSC tokens through research and cultivation</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-green-500/30 text-xs">
        <p>v0.1.0-alpha | SOLANA DEVNET</p>
      </footer>
    </div>
  )
}
