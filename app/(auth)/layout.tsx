export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        {/* Terminal window frame */}
        <div className="overflow-hidden rounded-lg border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-green-500/30 bg-green-900/20 px-4 py-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
            </div>
            <span className="ml-2 font-mono text-xs text-green-500/70">unLABS://auth</span>
          </div>

          {/* Content */}
          <div className="bg-black/90 p-6">{children}</div>
        </div>

        {/* Scanline overlay */}
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)",
          }}
        />
      </div>
    </div>
  );
}
