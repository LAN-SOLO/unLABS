'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface TerminalInputProps {
  onSubmit: (command: string) => void
  onNavigateHistory: (direction: 'up' | 'down') => string
  onAutocomplete?: (input: string) => string[]
  disabled?: boolean
  prompt?: string
  passwordMode?: boolean
}

export function TerminalInput({
  onSubmit,
  onNavigateHistory,
  onAutocomplete,
  disabled = false,
  prompt = '>',
  passwordMode = false,
}: TerminalInputProps) {
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastSpaceTime = useRef(0)

  // Focus input on mount and when clicked anywhere
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Clear suggestions when value changes normally
  useEffect(() => {
    setSuggestions([])
    setSuggestionIndex(0)
  }, [value])

  const triggerAutocomplete = (overrideValue?: string) => {
    if (!onAutocomplete || passwordMode) return

    const trimmed = (overrideValue ?? value).trimEnd()
    const completions = onAutocomplete(trimmed)

    if (completions.length === 1) {
      setValue(completions[0])
      setSuggestions([])
    } else if (completions.length > 1) {
      setSuggestions(completions)
      setSuggestionIndex(0)
      setValue(completions[0])
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim())
      setValue('')
      setSuggestions([])
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
      setSuggestions([])
    } else if (e.key === 'Tab') {
      // Prevent browser tab behavior, use as secondary autocomplete trigger
      e.preventDefault()
      triggerAutocomplete()
    } else if (e.key === ' ') {
      const now = Date.now()
      if (suggestions.length > 1) {
        // Cycling through suggestions
        e.preventDefault()
        const nextIndex = (suggestionIndex + 1) % suggestions.length
        setSuggestionIndex(nextIndex)
        setValue(suggestions[nextIndex])
      } else if (now - lastSpaceTime.current < 350 && value.endsWith(' ')) {
        // Double-space detected — trigger autocomplete
        e.preventDefault()
        const trimmed = value.trimEnd()
        triggerAutocomplete(trimmed)
      }
      lastSpaceTime.current = now
    }
  }

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col">
      {suggestions.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0 font-mono text-[9px] text-green-500/60 px-0 pb-0.5">
          {suggestions.map((s, i) => {
            // Show just the completed word, not the full input
            const parts = s.trimEnd().split(/\s+/)
            const word = parts[parts.length - 1]
            return (
              <span key={s} className={i === suggestionIndex ? 'text-green-400' : ''}>
                {word}
              </span>
            )
          })}
        </div>
      )}
      <div
        className="flex items-center gap-2 cursor-text"
        onClick={handleContainerClick}
      >
        <span className="text-green-400 font-mono text-[10px] select-none whitespace-nowrap">{prompt}</span>
        <input
          ref={inputRef}
          type={passwordMode ? 'password' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="flex-1 bg-transparent text-green-400 font-mono text-[10px] outline-none border-none caret-green-400 placeholder-green-500/30 disabled:opacity-50"
          placeholder={disabled ? 'PROCESSING...' : passwordMode ? '' : 'ENTER COMMAND'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <span className="text-green-500 animate-pulse font-mono text-[10px]">█</span>
      </div>
    </div>
  )
}
