export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Terminal window frame */}
        <div className="border border-green-500/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(34,197,94,0.2)]">
          {/* Title bar */}
          <div className="bg-green-900/20 border-b border-green-500/30 px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <span className="text-green-500/70 text-xs font-mono ml-2">
              unLABS://auth
            </span>
          </div>

          {/* Content */}
          <div className="bg-black/90 p-6">{children}</div>
        </div>

        {/* Scanline overlay */}
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
          }}
        />
      </div>
    </div>
  )
}
