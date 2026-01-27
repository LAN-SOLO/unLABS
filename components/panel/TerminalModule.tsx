'use client'

import { useState, useEffect } from 'react'
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
  const [time, setTime] = useState<string>('--:--:--')

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])
  // Fixed 4:3 terminal size (640x480)
  return (
    <PanelFrame
      variant="default"
      glow="green"
      className={cn('flex flex-col overflow-hidden', className)}
      style={{
        width: '640px',
        height: '480px',
        minWidth: '640px',
        minHeight: '480px',
        maxWidth: '640px',
        maxHeight: '480px',
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      {/* Title bar - compact */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--neon-green)]/20 bg-[#0a1a0a] shrink-0">
        <span className="text-[var(--neon-green)] text-[10px] font-mono">
          _unOS Terminal v1.0
        </span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[var(--neon-green)]/60" />
          <span className="text-[8px] font-mono text-white/40">ONLINE</span>
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

      {/* Status bar - compact */}
      <div className="flex items-center justify-between px-2 py-0.5 border-t border-[var(--neon-green)]/20 bg-[#0a1a0a] text-[8px] font-mono shrink-0">
        <span className="text-[var(--neon-green)]/60">READY</span>
        <span className="text-white/30">{time}</span>
      </div>
    </PanelFrame>
  )
}
