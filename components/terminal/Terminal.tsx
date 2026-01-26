'use client'

import { useTerminal } from '@/hooks/useTerminal'
import { TerminalOutput } from './TerminalOutput'
import { TerminalInput } from './TerminalInput'

interface TerminalProps {
  userId: string
  username: string | null
  balance: number
}

export function Terminal({ userId, username, balance }: TerminalProps) {
  const { lines, isTyping, processCommand, navigateHistory } = useTerminal({
    userId,
    username,
    balance,
  })

  return (
    <div className="flex flex-col h-full">
      <TerminalOutput lines={lines} isTyping={isTyping} />
      <TerminalInput
        onSubmit={processCommand}
        onNavigateHistory={navigateHistory}
        disabled={isTyping}
      />
    </div>
  )
}
