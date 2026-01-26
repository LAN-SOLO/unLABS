'use client'

import { useEffect, useRef } from 'react'
import type { TerminalLine } from '@/lib/terminal/types'

interface TerminalOutputProps {
  lines: TerminalLine[]
  isTyping: boolean
}

export function TerminalOutput({ lines, isTyping }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines, isTyping])

  const getLineClass = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input':
        return 'text-green-400'
      case 'error':
        return 'text-red-500'
      case 'system':
        return 'text-green-500'
      case 'ascii':
        return 'text-green-500 whitespace-pre'
      default:
        return 'text-green-500/80'
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-sm leading-relaxed scrollbar-thin scrollbar-thumb-green-500/30 scrollbar-track-transparent"
    >
      {lines.map((line) => (
        <div key={line.id} className={`${getLineClass(line.type)} break-words`}>
          {line.content || '\u00A0'}
        </div>
      ))}

      {isTyping && (
        <div className="text-green-500/80 flex items-center gap-1">
          <span>Processing</span>
          <span className="animate-pulse">...</span>
        </div>
      )}
    </div>
  )
}
