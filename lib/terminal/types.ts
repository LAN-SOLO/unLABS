export interface TerminalLine {
  id: string
  type: 'input' | 'output' | 'error' | 'system' | 'ascii'
  content: string
  timestamp: Date
}

export interface Command {
  name: string
  aliases?: string[]
  description: string
  usage?: string
  execute: (args: string[], context: CommandContext) => Promise<CommandResult>
}

export interface CommandContext {
  userId: string
  username: string | null
  balance: number
  addOutput: (content: string, type?: TerminalLine['type']) => void
  clearScreen: () => void
  setTyping: (typing: boolean) => void
}

export interface CommandResult {
  success: boolean
  output?: string[]
  error?: string
}

export interface TerminalState {
  lines: TerminalLine[]
  history: string[]
  historyIndex: number
  isTyping: boolean
}
