'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface TerminalInputProps {
  onSubmit: (command: string) => void
  onNavigateHistory: (direction: 'up' | 'down') => string
  disabled?: boolean
  prompt?: string
}

export function TerminalInput({
  onSubmit,
  onNavigateHistory,
  disabled = false,
  prompt = '>',
}: TerminalInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount and when clicked anywhere
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim())
      setValue('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const historyValue = onNavigateHistory('up')
      setValue(historyValue)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const historyValue = onNavigateHistory('down')
      setValue(historyValue)
    } else if (e.key === 'Escape') {
      setValue('')
    }
  }

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div
      className="flex items-center gap-2 border-t border-green-500/30 pt-2 mt-2 cursor-text"
      onClick={handleContainerClick}
    >
      <span className="text-green-400 font-mono text-[10px] select-none whitespace-nowrap">{prompt}</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="flex-1 bg-transparent text-green-400 font-mono text-[10px] outline-none border-none caret-green-400 placeholder-green-500/30 disabled:opacity-50"
        placeholder={disabled ? 'PROCESSING...' : 'ENTER COMMAND'}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <span className="text-green-500 animate-pulse font-mono text-[10px]">█</span>
    </div>
  )
}
