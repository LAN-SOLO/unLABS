import type {
  UserBalance,
  Crystal,
  TechProgress,
  CommandHistoryEntry,
} from '@/app/(game)/terminal/actions/data'
import type {
  MintResult,
  CrystalDetails,
  RenameResult,
} from '@/app/(game)/terminal/actions/crystals'

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

export interface DataFetchers {
  fetchBalance: () => Promise<UserBalance | null>
  fetchCrystals: () => Promise<Crystal[]>
  fetchResearchProgress: () => Promise<TechProgress[]>
  fetchCommandHistory: (limit?: number) => Promise<CommandHistoryEntry[]>
  fetchVolatility: () => Promise<{ tps: number; tier: string; block_time_ms: number } | null>
  logCommand: (
    command: string,
    args: string[],
    output: string,
    success: boolean,
    executionTimeMs: number
  ) => Promise<void>
  mintCrystal: (name: string) => Promise<MintResult>
  fetchCrystalByName: (name: string) => Promise<CrystalDetails | null>
  renameCrystal: (oldName: string, newName: string) => Promise<RenameResult>
}

export interface CommandContext {
  userId: string
  username: string | null
  balance: number
  addOutput: (content: string, type?: TerminalLine['type']) => void
  clearScreen: () => void
  setTyping: (typing: boolean) => void
  data: DataFetchers
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
