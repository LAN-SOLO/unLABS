'use client'

import { cn } from '@/lib/utils'

interface GamePanelProps {
  children: React.ReactNode
  className?: string
}

export function GamePanel({ children, className }: GamePanelProps) {
  return (
    <div className={cn('game-panel', className)}>
      {children}
    </div>
  )
}

export function PanelToolbar({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1 bg-[var(--panel-surface)]',
        'border-b border-[rgba(255,184,0,0.2)]',
        className
      )}
      style={{ gridArea: 'toolbar' }}
    >
      {children}
    </div>
  )
}

export function PanelLeft({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 overflow-hidden p-1',
        'bg-[var(--panel-void)]',
        className
      )}
      style={{ gridArea: 'left' }}
    >
      {children}
    </div>
  )
}

export function PanelMain({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-2',
        'bg-[var(--panel-void)]',
        className
      )}
      style={{ gridArea: 'main' }}
    >
      {children}
    </div>
  )
}

export function PanelRight({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 overflow-hidden p-1',
        'bg-[var(--panel-void)]',
        className
      )}
      style={{ gridArea: 'right' }}
    >
      {children}
    </div>
  )
}

export function PanelResources({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1',
        'bg-[var(--panel-surface)]',
        className
      )}
      style={{ gridArea: 'resources' }}
    >
      {children}
    </div>
  )
}

export function PanelBottom({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 px-2 py-1',
        'bg-[var(--panel-surface)] border-t border-[rgba(255,184,0,0.2)]',
        className
      )}
      style={{ gridArea: 'bottom' }}
    >
      {children}
    </div>
  )
}
