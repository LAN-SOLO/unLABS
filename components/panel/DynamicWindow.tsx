'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface DynamicWindowProps {
  children: React.ReactNode
  title?: string
  initialWidth?: number
  initialHeight?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  resizable?: boolean
  collapsible?: boolean
  className?: string
  titleBarClassName?: string
  onResize?: (width: number, height: number) => void
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null

export function DynamicWindow({
  children,
  title,
  initialWidth,
  initialHeight,
  minWidth = 100,
  minHeight = 50,
  maxWidth = 2000,
  maxHeight = 2000,
  resizable = true,
  collapsible = true,
  className,
  titleBarClassName,
  onResize,
}: DynamicWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDir, setResizeDir] = useState<ResizeDirection>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const startSize = useRef({ width: 0, height: 0 })

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: ResizeDirection) => {
      if (!resizable || !containerRef.current) return
      e.preventDefault()
      e.stopPropagation()

      setIsResizing(true)
      setResizeDir(direction)
      startPos.current = { x: e.clientX, y: e.clientY }

      const rect = containerRef.current.getBoundingClientRect()
      startSize.current = { width: rect.width, height: rect.height }
    },
    [resizable]
  )

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.current.x
      const deltaY = e.clientY - startPos.current.y

      let newWidth = startSize.current.width
      let newHeight = startSize.current.height

      if (resizeDir?.includes('e')) {
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.current.width + deltaX))
      }
      if (resizeDir?.includes('w')) {
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.current.width - deltaX))
      }
      if (resizeDir?.includes('s')) {
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.current.height + deltaY))
      }
      if (resizeDir?.includes('n')) {
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.current.height - deltaY))
      }

      setSize({ width: newWidth, height: newHeight })
      onResize?.(newWidth, newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeDir(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeDir, minWidth, minHeight, maxWidth, maxHeight, onResize])

  const resizeHandleClass = 'absolute bg-transparent hover:bg-[var(--neon-amber)]/30 transition-colors z-20'

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col overflow-hidden',
        isResizing && 'select-none',
        className
      )}
      style={{
        width: size.width,
        height: isCollapsed ? 'auto' : size.height,
      }}
    >
      {/* Title bar with collapse button */}
      {title && (
        <div
          className={cn(
            'flex items-center justify-between px-2 py-1',
            'bg-[var(--panel-surface)] border-b border-[var(--neon-amber)]/20',
            'cursor-default select-none',
            titleBarClassName
          )}
        >
          <span className="font-mono text-[10px] text-[var(--neon-amber)] uppercase tracking-wider">
            {title}
          </span>
          <div className="flex items-center gap-1">
            {collapsible && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-4 h-4 flex items-center justify-center text-[var(--neon-amber)] hover:bg-[var(--neon-amber)]/20 rounded transition-colors"
              >
                <span className="text-[10px]">{isCollapsed ? '▼' : '▲'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      )}

      {/* Resize handles */}
      {resizable && !isCollapsed && (
        <>
          {/* Edge handles */}
          <div
            className={cn(resizeHandleClass, 'top-0 left-2 right-2 h-1 cursor-n-resize')}
            onMouseDown={(e) => handleResizeStart(e, 'n')}
          />
          <div
            className={cn(resizeHandleClass, 'bottom-0 left-2 right-2 h-1 cursor-s-resize')}
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div
            className={cn(resizeHandleClass, 'left-0 top-2 bottom-2 w-1 cursor-w-resize')}
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />
          <div
            className={cn(resizeHandleClass, 'right-0 top-2 bottom-2 w-1 cursor-e-resize')}
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />

          {/* Corner handles */}
          <div
            className={cn(resizeHandleClass, 'top-0 left-0 w-2 h-2 cursor-nw-resize')}
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
          <div
            className={cn(resizeHandleClass, 'top-0 right-0 w-2 h-2 cursor-ne-resize')}
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div
            className={cn(resizeHandleClass, 'bottom-0 left-0 w-2 h-2 cursor-sw-resize')}
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div
            className={cn(resizeHandleClass, 'bottom-0 right-0 w-2 h-2 cursor-se-resize')}
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />

          {/* Visual resize indicator in corner */}
          <div className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none">
            <svg viewBox="0 0 12 12" className="w-full h-full text-[var(--neon-amber)]/40">
              <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </div>
        </>
      )}
    </div>
  )
}
