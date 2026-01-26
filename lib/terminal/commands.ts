import type { Command, CommandContext, CommandResult } from './types'

// ASCII Art for various commands
const ASCII_LOGO = `
 _   _ _   _ _        _    ____  ____
| | | | \\ | | |      / \\  | __ )/ ___|
| | | |  \\| | |     / _ \\ |  _ \\\\___ \\
| |_| | |\\  | |___ / ___ \\| |_) |___) |
 \\___/|_| \\_|_____/_/   \\_\\____/|____/
`

// Reserved for future use
// const ASCII_CRYSTAL = `...`

// Command definitions
const helpCommand: Command = {
  name: 'help',
  aliases: ['?', 'h'],
  description: 'Display available commands',
  execute: async (_args, _ctx) => {
    const output = [
      '',
      '╔════════════════════════════════════════════════════════════╗',
      '║                    AVAILABLE COMMANDS                      ║',
      '╠════════════════════════════════════════════════════════════╣',
      '║  HELP      - Display this help message                     ║',
      '║  CLEAR     - Clear terminal screen                         ║',
      '║  STATUS    - Display system status                         ║',
      '║  INV       - View crystal inventory                        ║',
      '║  BALANCE   - Check _unSC token balance                     ║',
      '║  RESEARCH  - View tech tree progress                       ║',
      '║  SCAN      - Scan for volatility data                      ║',
      '║  HISTORY   - View command history                          ║',
      '║  WHOAMI    - Display operator information                  ║',
      '║  ECHO      - Echo text back                                ║',
      '║  ABOUT     - About UnstableLabs                            ║',
      '╚════════════════════════════════════════════════════════════╝',
      '',
      'Type a command and press ENTER to execute.',
      '',
    ]
    return { success: true, output }
  },
}

const clearCommand: Command = {
  name: 'clear',
  aliases: ['cls', 'c'],
  description: 'Clear terminal screen',
  execute: async (args, ctx) => {
    ctx.clearScreen()
    return { success: true }
  },
}

const statusCommand: Command = {
  name: 'status',
  aliases: ['stat', 's'],
  description: 'Display system status',
  execute: async (args, ctx) => {
    const now = new Date()
    const output = [
      '',
      '┌─────────────────────────────────────┐',
      '│         SYSTEM STATUS               │',
      '├─────────────────────────────────────┤',
      `│  OPERATOR  : ${(ctx.username || 'UNKNOWN').padEnd(20)} │`,
      `│  SESSION   : ${ctx.userId.slice(0, 8)}...             │`,
      `│  BALANCE   : ${ctx.balance.toFixed(2).padStart(10)} _unSC    │`,
      `│  NETWORK   : SOLANA DEVNET          │`,
      `│  STATUS    : OPERATIONAL            │`,
      `│  TIME      : ${now.toISOString().slice(11, 19)}              │`,
      '└─────────────────────────────────────┘',
      '',
    ]
    return { success: true, output }
  },
}

const invCommand: Command = {
  name: 'inv',
  aliases: ['inventory', 'i'],
  description: 'View crystal inventory',
  execute: async (_args, _ctx) => {
    // Placeholder - will fetch from database
    const output = [
      '',
      '┌─────────────────────────────────────┐',
      '│       CRYSTAL INVENTORY             │',
      '├─────────────────────────────────────┤',
      '│  No crystals found.                 │',
      '│                                     │',
      '│  Use MINT to create your first      │',
      '│  crystal, or acquire one from       │',
      '│  the marketplace.                   │',
      '└─────────────────────────────────────┘',
      '',
    ]
    return { success: true, output }
  },
}

const balanceCommand: Command = {
  name: 'balance',
  aliases: ['bal', 'b'],
  description: 'Check _unSC token balance',
  execute: async (args, ctx) => {
    const output = [
      '',
      '┌─────────────────────────────────────┐',
      '│         _unSC BALANCE               │',
      '├─────────────────────────────────────┤',
      `│  AVAILABLE : ${ctx.balance.toFixed(2).padStart(15)} _unSC │`,
      '│  STAKED    :            0.00 _unSC │',
      '│  LOCKED    :            0.00 _unSC │',
      '├─────────────────────────────────────┤',
      `│  TOTAL     : ${ctx.balance.toFixed(2).padStart(15)} _unSC │`,
      '└─────────────────────────────────────┘',
      '',
    ]
    return { success: true, output }
  },
}

const researchCommand: Command = {
  name: 'research',
  aliases: ['tech', 'r'],
  description: 'View tech tree progress',
  execute: async (_args, _ctx) => {
    const output = [
      '',
      '╔═══════════════════════════════════════════════════════════════╗',
      '║                     TECH TREE PROGRESS                        ║',
      '╠═══════════════════════════════════════════════════════════════╣',
      '║  DEVICES                                                      ║',
      '║    ├─ Oscilloscope      [█░░░░] Tier 1/5                     ║',
      '║    ├─ Spectrometer      [█░░░░] Tier 1/5                     ║',
      '║    └─ Synthesizer       [█░░░░] Tier 1/5                     ║',
      '║  OPTICS                                                       ║',
      '║    ├─ Optics Array      [█░░░░] Tier 1/5                     ║',
      '║    ├─ Prism Matrix      [█░░░░] Tier 1/5                     ║',
      '║    └─ Lens Chamber      [█░░░░] Tier 1/5                     ║',
      '║  ADAPTERS                                                     ║',
      '║    ├─ Signal Adapter    [█░░░░] Tier 1/5                     ║',
      '║    ├─ Freq Modulator    [█░░░░] Tier 1/5                     ║',
      '║    └─ Phase Shifter     [█░░░░] Tier 1/5                     ║',
      '║  SYNTHESIZERS                                                 ║',
      '║    ├─ Wave Synthesizer  [█░░░░] Tier 1/5                     ║',
      '║    ├─ Harmonic Gen      [█░░░░] Tier 1/5                     ║',
      '║    └─ Resonance Chamber [█░░░░] Tier 1/5                     ║',
      '╚═══════════════════════════════════════════════════════════════╝',
      '',
    ]
    return { success: true, output }
  },
}

const scanCommand: Command = {
  name: 'scan',
  aliases: ['v'],
  description: 'Scan for volatility data',
  execute: async (args, ctx) => {
    ctx.setTyping(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    ctx.setTyping(false)

    const tps = Math.floor(Math.random() * 3000) + 1000
    const tier = tps < 1500 ? 1 : tps < 2000 ? 2 : tps < 2500 ? 3 : tps < 3000 ? 4 : 5

    const output = [
      '',
      '┌─────────────────────────────────────┐',
      '│       VOLATILITY SCAN               │',
      '├─────────────────────────────────────┤',
      '│  Scanning Solana network...         │',
      '│  ████████████████████ 100%          │',
      '├─────────────────────────────────────┤',
      `│  NETWORK TPS  : ${tps.toString().padStart(4)}                │`,
      `│  VOLATILITY   : TIER ${tier}               │`,
      `│  BLOCK TIME   : ${(400 + Math.random() * 100).toFixed(0)}ms              │`,
      '│  STATUS       : STABLE               │',
      '└─────────────────────────────────────┘',
      '',
    ]
    return { success: true, output }
  },
}

const whoamiCommand: Command = {
  name: 'whoami',
  aliases: ['who'],
  description: 'Display operator information',
  execute: async (args, ctx) => {
    const output = [
      '',
      `OPERATOR: ${ctx.username || 'UNKNOWN'}`,
      `SESSION:  ${ctx.userId}`,
      `LEVEL:    INITIATE`,
      '',
    ]
    return { success: true, output }
  },
}

const echoCommand: Command = {
  name: 'echo',
  description: 'Echo text back',
  usage: 'echo <text>',
  execute: async (args, _ctx) => {
    const text = args.join(' ') || ''
    return { success: true, output: [text] }
  },
}

const aboutCommand: Command = {
  name: 'about',
  description: 'About UnstableLabs',
  execute: async (_args, _ctx) => {
    const output = [
      ASCII_LOGO,
      '╔═══════════════════════════════════════════════════════════════╗',
      '║                    UNSTABLE LABORATORIES                      ║',
      '║              Quantum Crystal Research Facility                ║',
      '╠═══════════════════════════════════════════════════════════════╣',
      '║  UnstableLabs is an idle laboratory game where operators      ║',
      '║  research and cultivate quantum crystals through a retro      ║',
      '║  terminal interface.                                          ║',
      '║                                                               ║',
      '║  TOKENS:                                                      ║',
      '║    _unSC  - UnstableCoin (utility token)                     ║',
      '║    _unITM - Crystal NFTs                                      ║',
      '║    _unSLC - Crystal Slices (30 per crystal)                  ║',
      '║                                                               ║',
      '║  VERSION: 0.1.0-alpha                                         ║',
      '╚═══════════════════════════════════════════════════════════════╝',
      '',
    ]
    return { success: true, output }
  },
}

const historyCommand: Command = {
  name: 'history',
  aliases: ['hist'],
  description: 'View command history',
  execute: async (_args, _ctx) => {
    // History is handled by the terminal component
    return { success: true, output: ['Use UP/DOWN arrows to navigate command history.'] }
  },
}

// Command registry
export const commands: Command[] = [
  helpCommand,
  clearCommand,
  statusCommand,
  invCommand,
  balanceCommand,
  researchCommand,
  scanCommand,
  whoamiCommand,
  echoCommand,
  aboutCommand,
  historyCommand,
]

// Find command by name or alias
export function findCommand(input: string): Command | undefined {
  const name = input.toLowerCase().trim()
  return commands.find(
    (cmd) => cmd.name === name || cmd.aliases?.includes(name)
  )
}

// Parse and execute command
export async function executeCommand(
  input: string,
  context: CommandContext
): Promise<CommandResult> {
  const parts = input.trim().split(/\s+/)
  const commandName = parts[0]?.toLowerCase()
  const args = parts.slice(1)

  if (!commandName) {
    return { success: true }
  }

  const command = findCommand(commandName)

  if (!command) {
    return {
      success: false,
      error: `Unknown command: ${commandName}. Type HELP for available commands.`,
    }
  }

  try {
    return await command.execute(args, context)
  } catch (error) {
    return {
      success: false,
      error: `Error executing ${commandName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// Get welcome message
export function getWelcomeMessage(username: string | null): string[] {
  return [
    ASCII_LOGO,
    '╔══════════════════════════════════════════════════════════════╗',
    '║       UNSTABLE LABORATORIES TERMINAL v0.1.0                  ║',
    '║       Quantum Crystal Research Interface                     ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `> OPERATOR ${username || 'UNKNOWN'} authenticated.`,
    '> System initialized. All subsystems operational.',
    '> Type HELP for available commands.',
    '',
  ]
}
