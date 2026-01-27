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
        return 'text-green-500'
      default:
        return 'text-green-500/80'
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden font-mono text-[10px] leading-tight"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
    >
      <pre className="whitespace-pre">
        {lines.map((line) => (
          <div key={line.id} className={getLineClass(line.type)}>
            {line.content || ' '}
          </div>
        ))}

        {isTyping && (
          <div className="text-green-500/80">
            Processing...
          </div>
        )}
      </pre>
    </div>
  )
}
