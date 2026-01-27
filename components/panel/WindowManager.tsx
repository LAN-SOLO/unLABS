'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface WindowLayout {
  leftWidth: number
  rightWidth: number
  toolbarHeight: number
  bottomHeight: number
}

interface WindowManagerContextType {
  layout: WindowLayout
  setLeftWidth: (width: number) => void
  setRightWidth: (width: number) => void
  isResizing: boolean
}

const defaultLayout: WindowLayout = {
  leftWidth: 150,
  rightWidth: 520,
  toolbarHeight: 48,
  bottomHeight: 32,
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(null)

export function useWindowManager() {
  const context = useContext(WindowManagerContext)
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider')
  }
  return context
}

interface WindowManagerProviderProps {
  children: React.ReactNode
  className?: string
}

export function WindowManagerProvider({ children, className }: WindowManagerProviderProps) {
  const [layout, setLayout] = useState<WindowLayout>(defaultLayout)
  const [isResizing, setIsResizing] = useState(false)
  const [activeResize, setActiveResize] = useState<'left' | 'right' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const setLeftWidth = useCallback((width: number) => {
    setLayout((prev) => ({
      ...prev,
      leftWidth: Math.max(100, Math.min(250, width)),
    }))
  }, [])

  const setRightWidth = useCallback((width: number) => {
    setLayout((prev) => ({
      ...prev,
      rightWidth: Math.max(400, Math.min(700, width)),
    }))
  }, [])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, side: 'left' | 'right') => {
      e.preventDefault()
      setIsResizing(true)
      setActiveResize(side)
      startX.current = e.clientX
      startWidth.current = side === 'left' ? layout.leftWidth : layout.rightWidth
    },
    [layout.leftWidth, layout.rightWidth]
  )

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX.current

      if (activeResize === 'left') {
        const newWidth = startWidth.current + deltaX
        setLeftWidth(newWidth)
      } else if (activeResize === 'right') {
        const newWidth = startWidth.current - deltaX
        setRightWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setActiveResize(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, activeResize, setLeftWidth, setRightWidth])

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `${layout.leftWidth}px minmax(400px, 1fr) ${layout.rightWidth}px`,
    gridTemplateRows: 'auto 1fr auto auto',
    gridTemplateAreas: `
      "toolbar toolbar toolbar"
      "left main right"
      "left resources right"
      "bottom bottom bottom"
    `,
    gap: '4px',
    height: '100vh',
    width: '100vw',
    background: 'var(--panel-void)',
    padding: '4px',
    overflow: 'hidden',
  }

  return (
    <WindowManagerContext.Provider value={{ layout, setLeftWidth, setRightWidth, isResizing }}>
      <div
        ref={containerRef}
        className={cn('relative', isResizing && 'select-none cursor-col-resize', className)}
        style={gridStyle}
      >
        {children}

        {/* Left resize handle */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1 cursor-col-resize z-50',
            'hover:bg-[var(--neon-amber)]/40 transition-colors',
            activeResize === 'left' && 'bg-[var(--neon-amber)]/60'
          )}
          style={{ left: layout.leftWidth + 2 }}
          onMouseDown={(e) => handleResizeStart(e, 'left')}
        />

        {/* Right resize handle */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1 cursor-col-resize z-50',
            'hover:bg-[var(--neon-amber)]/40 transition-colors',
            activeResize === 'right' && 'bg-[var(--neon-amber)]/60'
          )}
          style={{ right: layout.rightWidth + 2 }}
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        />
      </div>
    </WindowManagerContext.Provider>
  )
}
