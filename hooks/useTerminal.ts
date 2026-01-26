'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { TerminalLine, TerminalState, CommandContext } from '@/lib/terminal/types'
import { executeCommand, getWelcomeMessage } from '@/lib/terminal/commands'

interface UseTerminalProps {
  userId: string
  username: string | null
  balance: number
}

export function useTerminal({ userId, username, balance }: UseTerminalProps) {
  const [state, setState] = useState<TerminalState>(() => ({
    lines: [],
    history: [],
    historyIndex: -1,
    isTyping: false,
  }))

  const initializedRef = useRef(false)
  const idCounter = useRef(0)

  const generateId = useCallback(() => {
    idCounter.current += 1
    return `line-${Date.now()}-${idCounter.current}`
  }, [])

  const addLine = useCallback(
    (content: string, type: TerminalLine['type'] = 'output') => {
      const line: TerminalLine = {
        id: generateId(),
        type,
        content,
        timestamp: new Date(),
      }
      setState((prev) => ({
        ...prev,
        lines: [...prev.lines, line],
      }))
    },
    [generateId]
  )

  const addOutput = useCallback(
    (content: string, type: TerminalLine['type'] = 'output') => {
      addLine(content, type)
    },
    [addLine]
  )

  const clearScreen = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lines: [],
    }))
  }, [])

  const setTyping = useCallback((typing: boolean) => {
    setState((prev) => ({
      ...prev,
      isTyping: typing,
    }))
  }, [])

  // Initialize with welcome message
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      const welcomeLines = getWelcomeMessage(username)
      welcomeLines.forEach((line) => {
        addLine(line, line.startsWith('>') ? 'system' : 'ascii')
      })
    }
  }, [username, addLine])

  const processCommand = useCallback(
    async (input: string) => {
      // Add input line
      addLine(`> ${input}`, 'input')

      // Add to history
      setState((prev) => ({
        ...prev,
        history: [input, ...prev.history.filter((h) => h !== input)].slice(0, 50),
        historyIndex: -1,
      }))

      // Create command context
      const context: CommandContext = {
        userId,
        username,
        balance,
        addOutput,
        clearScreen,
        setTyping,
      }

      // Execute command
      const result = await executeCommand(input, context)

      // Output results
      if (result.error) {
        addLine(result.error, 'error')
      } else if (result.output) {
        result.output.forEach((line) => addLine(line, 'output'))
      }
    },
    [userId, username, balance, addLine, addOutput, clearScreen, setTyping]
  )

  const navigateHistory = useCallback(
    (direction: 'up' | 'down'): string => {
      let newIndex: number

      if (direction === 'up') {
        newIndex = Math.min(state.historyIndex + 1, state.history.length - 1)
      } else {
        newIndex = Math.max(state.historyIndex - 1, -1)
      }

      setState((prev) => ({
        ...prev,
        historyIndex: newIndex,
      }))

      return newIndex >= 0 ? state.history[newIndex] || '' : ''
    },
    [state.history, state.historyIndex]
  )

  return {
    lines: state.lines,
    history: state.history,
    isTyping: state.isTyping,
    processCommand,
    navigateHistory,
    clearScreen,
    addOutput,
  }
}
