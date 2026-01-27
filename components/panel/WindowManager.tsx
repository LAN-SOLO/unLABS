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

        {/* Left metal frame - heavily used industrial look */}
        <div
          className="absolute w-5 z-50 pointer-events-none"
          style={{
            left: layout.leftWidth - 4,
            top: `${layout.toolbarHeight + 8}px`,
            bottom: `${layout.bottomHeight + 8}px`,
            background: 'linear-gradient(90deg, #0a0a0a 0%, #2a2a2a 15%, #3a3a3a 30%, #4a4a4a 50%, #3a3a3a 70%, #2a2a2a 85%, #0a0a0a 100%)',
            boxShadow: 'inset 2px 0 3px rgba(0,0,0,0.9), inset -2px 0 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)',
            borderRadius: '2px',
          }}
        >
          {/* Wear marks and scratches */}
          <div
            className="absolute inset-0 rounded-sm overflow-hidden"
            style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, transparent 0px, transparent 8px, rgba(0,0,0,0.4) 8px, rgba(0,0,0,0.4) 9px, transparent 9px, transparent 20px),
                repeating-linear-gradient(0deg, transparent 0px, transparent 15px, rgba(255,255,255,0.06) 15px, rgba(255,255,255,0.06) 16px)
              `,
            }}
          />
          {/* Deep scratches */}
          <div className="absolute top-[8%] left-0.5 right-0.5 h-px bg-black/60" />
          <div className="absolute top-[25%] left-0 right-0.5 h-px bg-black/40" />
          <div className="absolute top-[63%] left-0.5 right-0 h-px bg-black/50" />
          {/* Rust spots */}
          <div className="absolute top-[15%] left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#4a3020]/50 to-transparent" />
          <div className="absolute top-[45%] left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#3a2515]/40 to-transparent" />
          <div className="absolute top-[72%] left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#4a3525]/45 to-transparent" />
          {/* Top cap - rounded metal end */}
          <div className="absolute top-0 left-0 right-0 h-3 rounded-t-sm" style={{ background: 'linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 50%, transparent 100%)' }} />
          {/* Bottom cap - rounded metal end */}
          <div className="absolute bottom-0 left-0 right-0 h-3 rounded-b-sm" style={{ background: 'linear-gradient(0deg, #2a2a2a 0%, #1a1a1a 50%, transparent 100%)' }} />
          {/* Center highlight */}
          <div className="absolute inset-y-3 left-1/2 w-px bg-white/10 -translate-x-1/2" />
        </div>

        {/* Right metal frame - heavily used industrial look */}
        <div
          className="absolute w-5 z-50 pointer-events-none"
          style={{
            right: layout.rightWidth - 4,
            top: `${layout.toolbarHeight + 8}px`,
            bottom: `${layout.bottomHeight + 8}px`,
            background: 'linear-gradient(90deg, #0a0a0a 0%, #2a2a2a 15%, #3a3a3a 30%, #4a4a4a 50%, #3a3a3a 70%, #2a2a2a 85%, #0a0a0a 100%)',
            boxShadow: 'inset 2px 0 3px rgba(0,0,0,0.9), inset -2px 0 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)',
            borderRadius: '2px',
          }}
        >
          {/* Wear marks and scratches */}
          <div
            className="absolute inset-0 rounded-sm overflow-hidden"
            style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, transparent 0px, transparent 12px, rgba(0,0,0,0.35) 12px, rgba(0,0,0,0.35) 13px, transparent 13px, transparent 25px),
                repeating-linear-gradient(0deg, transparent 0px, transparent 18px, rgba(255,255,255,0.05) 18px, rgba(255,255,255,0.05) 19px)
              `,
            }}
          />
          {/* Deep scratches */}
          <div className="absolute top-[12%] left-0 right-0.5 h-px bg-black/50" />
          <div className="absolute top-[38%] left-0.5 right-0 h-px bg-black/45" />
          <div className="absolute top-[78%] left-0 right-0.5 h-px bg-black/55" />
          {/* Rust spots */}
          <div className="absolute top-[22%] left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#3a2515]/45 to-transparent" />
          <div className="absolute top-[55%] left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#4a3020]/50 to-transparent" />
          <div className="absolute top-[85%] left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#3a2520]/40 to-transparent" />
          {/* Top cap - rounded metal end */}
          <div className="absolute top-0 left-0 right-0 h-3 rounded-t-sm" style={{ background: 'linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 50%, transparent 100%)' }} />
          {/* Bottom cap - rounded metal end */}
          <div className="absolute bottom-0 left-0 right-0 h-3 rounded-b-sm" style={{ background: 'linear-gradient(0deg, #2a2a2a 0%, #1a1a1a 50%, transparent 100%)' }} />
          {/* Center highlight */}
          <div className="absolute inset-y-3 left-1/2 w-px bg-white/10 -translate-x-1/2" />
        </div>
      </div>
    </WindowManagerContext.Provider>
  )
}
