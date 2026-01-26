'use client'

import { cn } from '@/lib/utils'
import { Terminal } from '@/components/terminal'
import { PanelFrame } from './PanelFrame'

interface TerminalModuleProps {
  userId: string
  username: string | null
  balance: number
  className?: string
}

export function TerminalModule({
  userId,
  username,
  balance,
  className,
}: TerminalModuleProps) {
  return (
    <PanelFrame
      variant="default"
      glow="green"
      className={cn('flex flex-col overflow-hidden h-full', className)}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--neon-green)]/20 bg-[#0a1a0a]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--neon-green)] text-xs font-mono">
            _unOS Terminal v1.0.0
          </span>
          <span className="text-[var(--neon-amber)] text-[10px] font-mono px-1 bg-[var(--neon-amber)]/10 rounded">
            # OFF
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-0.5 text-[10px] font-mono text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 rounded hover:bg-[var(--neon-cyan)]/20">
            START
          </button>
          <button className="px-2 py-0.5 text-[10px] font-mono text-white/50 bg-white/5 rounded hover:bg-white/10">
            STOP
          </button>
          <button className="px-2 py-0.5 text-[10px] font-mono text-white/50 bg-white/5 rounded hover:bg-white/10">
            Clear
          </button>
        </div>
      </div>

      {/* Terminal content with CRT effect */}
      <div className="flex-1 relative overflow-hidden bg-[#0a0f0a]">
        {/* CRT scanlines */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
          }}
        />

        {/* CRT glow */}
        <div
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            boxShadow: 'inset 0 0 60px rgba(34, 197, 94, 0.08)',
          }}
        />

        {/* Terminal */}
        <div className="h-full overflow-hidden p-2">
          <Terminal userId={userId} username={username} balance={balance} />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-[var(--neon-green)]/20 bg-[#0a1a0a] text-[9px] font-mono">
        <span className="text-[var(--neon-amber)]">System Offline</span>
        <span className="text-white/30">
          {new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      </div>
    </PanelFrame>
  )
}
