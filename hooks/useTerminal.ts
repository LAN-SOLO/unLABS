'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { TerminalLine, TerminalState, CommandContext, DataFetchers } from '@/lib/terminal/types'
import { executeCommand, getWelcomeMessage } from '@/lib/terminal/commands'
import {
  fetchBalance,
  fetchCrystals,
  fetchResearchProgress,
  fetchCommandHistory,
  fetchVolatility,
  logCommand,
} from '@/app/(game)/terminal/actions/data'
import {
  mintCrystal,
  fetchCrystalByName,
  renameCrystal,
} from '@/app/(game)/terminal/actions/crystals'

interface UseTerminalProps {
  userId: string
  username: string | null
  balance: number
}

export function useTerminal({ userId, username, balance }: UseTerminalProps) {
  const router = useRouter()
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

  // Data fetchers for commands
  const dataFetchers: DataFetchers = {
    fetchBalance,
    fetchCrystals,
    fetchResearchProgress,
    fetchCommandHistory,
    fetchVolatility,
    logCommand,
    mintCrystal,
    fetchCrystalByName,
    renameCrystal,
  }

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
        data: dataFetchers,
      }

      // Execute command
      const result = await executeCommand(input, context)

      // Output results
      if (result.error) {
        addLine(result.error, 'error')
      } else if (result.output) {
        result.output.forEach((line) => addLine(line, 'output'))
      }

      // Handle panel access changes
      if (result.clearPanelAccess) {
        sessionStorage.removeItem('panel_access')
      }

      // Handle navigation if specified
      if (result.navigate) {
        // Store access token in session for panel protection
        if (result.navigate === '/panel') {
          sessionStorage.setItem('panel_access', 'unlocked')
        }
        setTimeout(() => {
          router.push(result.navigate!)
        }, 1500) // Delay to let user see the output
      }
    },
    [userId, username, balance, addLine, addOutput, clearScreen, setTyping, dataFetchers, router]
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
