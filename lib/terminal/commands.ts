import type { Command, CommandContext, CommandResult } from './types'

// Simple text banner - no fancy ASCII art to avoid font issues
const ASCII_LOGO = `
 =============================================================
 |                                                           |
 |   U N S T A B L E   L A B O R A T O R I E S              |
 |                        unLABS                             |
 |                                                           |
 =============================================================
`

// Boot sequence messages for terminal (compact)
const TERMINAL_BOOT_SEQUENCE = [
  '[SYSTEM] Security level: MAXIMUM',
  '[SYSTEM] Network: SOLANA DEVNET',
  '[SYSTEM] Session: ENCRYPTED',
  '',
]

// Panel boot sequence
const PANEL_BOOT_SEQUENCE = [
  '',
  '╔═══════════════════════════════════════════════════════════════╗',
  '║            PANEL MODULE INITIALIZATION v2.1.0                 ║',
  '╚═══════════════════════════════════════════════════════════════╝',
  '',
  '[BOOT] Initializing Panel Subsystem...',
  '[BOOT] Loading hardware abstraction layer....',
  '[BOOT] Mounting virtual framebuffer...........',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                  PRE-FLIGHT DIAGNOSTICS                     │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[DIAG] Crystal Interface............ ONLINE    [  OK  ]',
  '[DIAG] Oscilloscope Array........... ONLINE    [  OK  ]',
  '[DIAG] Equipment Modules............ ONLINE    [  OK  ]',
  '[DIAG] Resource Monitors............ ONLINE    [  OK  ]',
  '[DIAG] Waveform Generators.......... ONLINE    [  OK  ]',
  '[DIAG] Frequency Synthesizers....... ONLINE    [  OK  ]',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                   EQUIPMENT DRIVERS                         │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[LOAD] CrystalDataCache............ v1.4.2    [LOADED]',
  '[LOAD] EnergyCore.................. v2.0.1    [LOADED]',
  '[LOAD] BatteryPack................. v1.8.0    [LOADED]',
  '[LOAD] HandmadeSynthesizer......... v3.2.1    [LOADED]',
  '[LOAD] EchoRecorder................ v1.1.0    [LOADED]',
  '[LOAD] Interpolator................ v2.5.3    [LOADED]',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                    SYSTEM CHECK                             │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[CHECK] Display Resolution......... 1920x1080 [  OK  ]',
  '[CHECK] Refresh Rate............... 60Hz      [  OK  ]',
  '[CHECK] Color Depth................ 32-bit    [  OK  ]',
  '[CHECK] GPU Memory................. 8192 MB   [  OK  ]',
  '[CHECK] Audio Subsystem............ 48kHz     [  OK  ]',
  '[CHECK] Input Latency.............. <1ms      [  OK  ]',
  '[CHECK] Oscilloscope Calibration... 99.9%     [  OK  ]',
  '[CHECK] Waveform Buffer............ 16384 pts [  OK  ]',
  '',
  '[INIT] Calibrating oscilloscope waveforms......',
  '[INIT] Synchronizing frequency generators......',
  '[INIT] Establishing quantum entanglement.......',
  '[INIT] Loading color mixing algorithms.........',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                  NETWORK CONNECTION                         │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[NET] Connecting to Solana devnet.............',
  '[NET] Handshake complete...................... OK',
  '[NET] Fetching volatility data................ OK',
  '[NET] TPS synchronization..................... OK',
  '[NET] Block height: 284,729,103',
  '',
  '╔═══════════════════════════════════════════════════════════════╗',
  '║  Module   : PANEL              Status : FULLY OPERATIONAL    ║',
  '║  Mode     : DEVELOPER          Uptime : 00:00:00             ║',
  '║  Access   : UNLOCKED           Memory : 2.4 GB / 8 GB        ║',
  '╚═══════════════════════════════════════════════════════════════╝',
  '',
  '> All systems nominal. Redirecting to PANEL interface...',
  '',
]

// Panel shutdown sequence
const PANEL_SHUTDOWN_SEQUENCE = [
  '',
  '╔═══════════════════════════════════════════════════════════════╗',
  '║              PANEL MODULE SHUTDOWN SEQUENCE                   ║',
  '╚═══════════════════════════════════════════════════════════════╝',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                    STATE PRESERVATION                       │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[SAVE] Crystal configurations......... 12 items  [SAVED]',
  '[SAVE] Oscilloscope settings.......... 24 params [SAVED]',
  '[SAVE] Waveform presets............... 8 presets [SAVED]',
  '[SAVE] Color mixing profiles.......... 4 profiles[SAVED]',
  '[SAVE] Resource allocations........... 6 slots   [SAVED]',
  '[SAVE] User preferences............... 32 keys   [SAVED]',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                  PROCESS TERMINATION                        │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[STOP] Waveform Generators........... PID 2847  [STOPPED]',
  '[STOP] Frequency Synthesizers........ PID 2848  [STOPPED]',
  '[STOP] Audio Engine.................. PID 2849  [STOPPED]',
  '[STOP] Quantum Entanglement.......... PID 2850  [RELEASED]',
  '[STOP] Render Pipeline............... PID 2851  [STOPPED]',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                  SYSTEM CHECK - FINAL                       │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[CHECK] Memory Leaks................. 0 bytes   [  OK  ]',
  '[CHECK] Open File Handles............ 0         [  OK  ]',
  '[CHECK] Pending Transactions......... 0         [  OK  ]',
  '[CHECK] Unsaved Changes.............. None      [  OK  ]',
  '[CHECK] Network Sockets.............. Closed    [  OK  ]',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                  NETWORK DISCONNECT                         │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[NET] Flushing transaction queue...... OK',
  '[NET] Closing secure channels......... OK',
  '[NET] Session data synchronized....... OK',
  '[NET] Disconnected from Solana devnet. OK',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                  DRIVER UNLOAD                              │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[UNLOAD] CrystalDataCache........... v1.4.2  [RELEASED]',
  '[UNLOAD] EnergyCore................. v2.0.1  [RELEASED]',
  '[UNLOAD] BatteryPack................ v1.8.0  [RELEASED]',
  '[UNLOAD] HandmadeSynthesizer........ v3.2.1  [RELEASED]',
  '[UNLOAD] EchoRecorder............... v1.1.0  [RELEASED]',
  '[UNLOAD] Interpolator............... v2.5.3  [RELEASED]',
  '',
  '[SHUTDOWN] Oscilloscope Array.............. OFFLINE',
  '[SHUTDOWN] Equipment Modules............... OFFLINE',
  '[SHUTDOWN] Resource Monitors............... OFFLINE',
  '[SHUTDOWN] Display Subsystem............... OFFLINE',
  '',
  '╔═══════════════════════════════════════════════════════════════╗',
  '║  Module   : PANEL              Status : TERMINATED           ║',
  '║  Session  : SAVED              Uptime : 00:12:34             ║',
  '║  Exit     : CLEAN              Errors : 0                    ║',
  '╚═══════════════════════════════════════════════════════════════╝',
  '',
  '> Panel module offline. Returning to terminal...',
  '',
]

// Command definitions
const helpCommand: Command = {
  name: 'help',
  aliases: ['?', 'h'],
  description: 'Display available commands',
  execute: async (_args, _ctx) => {
    const output = [
      '',
      '+------------------------------------------------------------+',
      '|                    AVAILABLE COMMANDS                      |',
      '+------------------------------------------------------------+',
      '|  HELP      - Display this help message                     |',
      '|  CLEAR     - Clear terminal screen                         |',
      '|  STATUS    - Display system status                         |',
      '+------------------------------------------------------------+',
      '|                      CRYSTALS                              |',
      '+------------------------------------------------------------+',
      '|  INV       - View crystal inventory                        |',
      '|  MINT      - Mint a new crystal (50 _unSC)                 |',
      '|  CRYSTAL   - View detailed crystal info                    |',
      '|  RENAME    - Rename a crystal                              |',
      '+------------------------------------------------------------+',
      '|                      ECONOMY                               |',
      '+------------------------------------------------------------+',
      '|  BALANCE   - Check _unSC token balance                     |',
      '|  RESEARCH  - View tech tree progress                       |',
      '|  SCAN      - Scan for volatility data                      |',
      '+------------------------------------------------------------+',
      '|                       OTHER                                |',
      '+------------------------------------------------------------+',
      '|  HISTORY   - View command history                          |',
      '|  WHOAMI    - Display operator information                  |',
      '|  ECHO      - Echo text back                                |',
      '|  ABOUT     - About UnstableLabs                            |',
      '+------------------------------------------------------------+',
      '|                      MODULES                               |',
      '+------------------------------------------------------------+',
      '|  RUN       - Launch a subsystem module                     |',
      '|  KILL      - Shut down a subsystem module                  |',
      '+------------------------------------------------------------+',
      '|                      SYSTEM                                |',
      '+------------------------------------------------------------+',
      '|  UNSYSTEMCTL - System control (reboot, poweroff, status)   |',
      '+------------------------------------------------------------+',
      '',
      'Usage: MINT <name> | CRYSTAL <name> | RENAME <old> <new>',
      '       RUN panel dev -un | KILL panel dev -un',
      '       UNSYSTEMCTL shutdown -now | UNSYSTEMCTL reboot -now',
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
  execute: async (_args, ctx) => {
    ctx.clearScreen()
    return { success: true }
  },
}

const statusCommand: Command = {
  name: 'status',
  aliases: ['stat', 's'],
  description: 'Display system status',
  execute: async (_args, ctx) => {
    ctx.setTyping(true)
    const balance = await ctx.data.fetchBalance()
    ctx.setTyping(false)

    const now = new Date()
    const total = balance ? balance.available + balance.staked + balance.locked : ctx.balance

    const output = [
      '',
      '+-------------------------------------+',
      '|           SYSTEM STATUS             |',
      '+-------------------------------------+',
      `|  OPERATOR  : ${(ctx.username || 'UNKNOWN').padEnd(20)} |`,
      `|  SESSION   : ${ctx.userId.slice(0, 8)}...             |`,
      `|  BALANCE   : ${total.toFixed(2).padStart(10)} _unSC    |`,
      '|  NETWORK   : SOLANA DEVNET          |',
      '|  STATUS    : OPERATIONAL            |',
      `|  TIME      : ${now.toISOString().slice(11, 19)}              |`,
      '+-------------------------------------+',
      '',
    ]
    return { success: true, output }
  },
}

const invCommand: Command = {
  name: 'inv',
  aliases: ['inventory', 'i'],
  description: 'View crystal inventory',
  execute: async (_args, ctx) => {
    ctx.setTyping(true)
    const crystals = await ctx.data.fetchCrystals()
    ctx.setTyping(false)

    if (crystals.length === 0) {
      const output = [
        '',
        '+-------------------------------------+',
        '|         CRYSTAL INVENTORY           |',
        '+-------------------------------------+',
        '|  No crystals found.                 |',
        '|                                     |',
        '|  Use MINT to create your first      |',
        '|  crystal, or acquire one from       |',
        '|  the marketplace.                   |',
        '+-------------------------------------+',
        '',
      ]
      return { success: true, output }
    }

    const output = [
      '',
      '+---------------------------------------------------------------+',
      '|                    CRYSTAL INVENTORY                          |',
      '+---------------------------------------------------------------+',
    ]

    crystals.forEach((crystal, index) => {
      const genesisTag = crystal.is_genesis ? ' [GENESIS]' : ''
      output.push(`|  ${(index + 1).toString().padStart(2)}. ${crystal.name.padEnd(20)} ${crystal.color.toUpperCase().padEnd(10)}${genesisTag.padEnd(12)} |`)
      output.push(`|      Era: ${crystal.era.padEnd(8)} | Slices: ${crystal.slice_count.toString().padEnd(2)}/30 | Power: ${crystal.total_power.toFixed(1).padStart(6)} |`)
      output.push(`|      State: ${crystal.state.padEnd(10)} | Rotation: ${crystal.rotation.padEnd(4)} | Vol: T${crystal.volatility}    |`)
      output.push('+---------------------------------------------------------------+')
    })

    output.push(`|  Total Crystals: ${crystals.length}                                         |`)
    output.push('+---------------------------------------------------------------+')
    output.push('')

    return { success: true, output }
  },
}

const balanceCommand: Command = {
  name: 'balance',
  aliases: ['bal', 'b'],
  description: 'Check _unSC token balance',
  execute: async (_args, ctx) => {
    ctx.setTyping(true)
    const balance = await ctx.data.fetchBalance()
    ctx.setTyping(false)

    const available = balance?.available || 0
    const staked = balance?.staked || 0
    const locked = balance?.locked || 0
    const total = available + staked + locked
    const earned = balance?.total_earned || 0
    const spent = balance?.total_spent || 0

    const output = [
      '',
      '+-------------------------------------+',
      '|           _unSC BALANCE             |',
      '+-------------------------------------+',
      `|  AVAILABLE : ${available.toFixed(2).padStart(15)} _unSC |`,
      `|  STAKED    : ${staked.toFixed(2).padStart(15)} _unSC |`,
      `|  LOCKED    : ${locked.toFixed(2).padStart(15)} _unSC |`,
      '+-------------------------------------+',
      `|  TOTAL     : ${total.toFixed(2).padStart(15)} _unSC |`,
      '+-------------------------------------+',
      `|  Lifetime Earned: ${earned.toFixed(2).padStart(10)} _unSC |`,
      `|  Lifetime Spent:  ${spent.toFixed(2).padStart(10)} _unSC |`,
      '+-------------------------------------+',
      '',
    ]
    return { success: true, output }
  },
}

const researchCommand: Command = {
  name: 'research',
  aliases: ['tech', 'r'],
  description: 'View tech tree progress',
  execute: async (_args, ctx) => {
    ctx.setTyping(true)
    const progress = await ctx.data.fetchResearchProgress()
    ctx.setTyping(false)

    if (progress.length === 0) {
      return { success: true, output: ['No research progress found.'] }
    }

    // Group by category
    const categories: Record<string, typeof progress> = {}
    progress.forEach((p) => {
      if (!categories[p.category]) {
        categories[p.category] = []
      }
      categories[p.category].push(p)
    })

    const output = [
      '',
      '+---------------------------------------------------------------+',
      '|                     TECH TREE PROGRESS                        |',
      '+---------------------------------------------------------------+',
    ]

    const tierBar = (tier: number) => {
      const filled = '#'.repeat(tier)
      const empty = '-'.repeat(5 - tier)
      return `[${filled}${empty}]`
    }

    Object.entries(categories).forEach(([category, items]) => {
      output.push(`|  ${category.toUpperCase().padEnd(60)} |`)
      items.forEach((item) => {
        const bar = tierBar(item.current_tier)
        const name = item.tech_tree_name.padEnd(20)
        output.push(`|    - ${name} ${bar} Tier ${item.current_tier}/5                   |`)
      })
    })

    output.push('+---------------------------------------------------------------+')
    output.push('')

    return { success: true, output }
  },
}

const scanCommand: Command = {
  name: 'scan',
  aliases: ['v'],
  description: 'Scan for volatility data',
  execute: async (_args, ctx) => {
    ctx.setTyping(true)
    const volatility = await ctx.data.fetchVolatility()
    ctx.setTyping(false)

    const tps = volatility?.tps || 0
    const tier = volatility?.tier || '1'
    const blockTime = volatility?.block_time_ms || 0

    const output = [
      '',
      '+-------------------------------------+',
      '|         VOLATILITY SCAN             |',
      '+-------------------------------------+',
      '|  Scanning Solana network...         |',
      '|  [####################] 100%        |',
      '+-------------------------------------+',
      `|  NETWORK TPS  : ${tps.toString().padStart(4)}                |`,
      `|  VOLATILITY   : TIER ${tier}               |`,
      `|  BLOCK TIME   : ${blockTime.toString().padStart(3)}ms              |`,
      '|  STATUS       : STABLE              |',
      '+-------------------------------------+',
      '',
    ]
    return { success: true, output }
  },
}

const whoamiCommand: Command = {
  name: 'whoami',
  aliases: ['who'],
  description: 'Display operator information',
  execute: async (_args, ctx) => {
    ctx.setTyping(true)
    const balance = await ctx.data.fetchBalance()
    const crystals = await ctx.data.fetchCrystals()
    ctx.setTyping(false)

    const total = balance ? balance.available + balance.staked + balance.locked : 0

    const output = [
      '',
      '+-------------------------------------+',
      '|         OPERATOR PROFILE            |',
      '+-------------------------------------+',
      `|  USERNAME : ${(ctx.username || 'UNKNOWN').padEnd(22)} |`,
      `|  SESSION  : ${ctx.userId.slice(0, 20).padEnd(22)} |`,
      `|  LEVEL    : INITIATE                |`,
      '+-------------------------------------+',
      `|  BALANCE  : ${total.toFixed(2).padStart(10)} _unSC        |`,
      `|  CRYSTALS : ${crystals.length.toString().padStart(10)}            |`,
      '+-------------------------------------+',
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
      '+---------------------------------------------------------------+',
      '|                    UNSTABLE LABORATORIES                      |',
      '|              Quantum Crystal Research Facility                |',
      '+---------------------------------------------------------------+',
      '|                                                               |',
      '|  UnstableLabs is an idle laboratory game where operators      |',
      '|  research and cultivate quantum crystals through a retro      |',
      '|  terminal interface.                                          |',
      '|                                                               |',
      '|  TOKENS:                                                      |',
      '|    _unSC  - UnstableCoin (utility token)                      |',
      '|    _unITM - Crystal NFTs                                      |',
      '|    _unSLC - Crystal Slices (30 per crystal)                   |',
      '|                                                               |',
      '|  VERSION: 0.1.0-alpha                                         |',
      '+---------------------------------------------------------------+',
      '',
    ]
    return { success: true, output }
  },
}

// Crystal ASCII art generator
function generateCrystalArt(color: string, era: string): string[] {
  const colorSymbol = color.charAt(0).toUpperCase()
  const eraPrefix = era.replace('-bit', '')

  return [
    '              /\\',
    '             /  \\',
    `            / ${colorSymbol}  \\`,
    '           /______\\',
    '          /\\      /\\',
    `         /  \\${eraPrefix.padStart(2)}  /  \\`,
    '        /    \\  /    \\',
    '       /______\\/______\\',
    '       \\      /\\      /',
    '        \\    /  \\    /',
    `         \\  / ${colorSymbol}  \\  /`,
    '          \\/______\\/',
    '           \\      /',
    '            \\    /',
    '             \\  /',
    '              \\/',
  ]
}

const mintCommand: Command = {
  name: 'mint',
  aliases: ['m'],
  description: 'Mint a new crystal',
  usage: 'mint <name>',
  execute: async (args, ctx) => {
    const name = args[0]

    if (!name) {
      return {
        success: false,
        error: 'Usage: MINT <name>\nExample: MINT my-crystal',
      }
    }

    ctx.setTyping(true)
    const result = await ctx.data.mintCrystal(name)
    ctx.setTyping(false)

    if (!result.success) {
      return { success: false, error: result.error }
    }

    const crystal = result.crystal!
    const art = generateCrystalArt(crystal.color, crystal.era)

    const output = [
      '',
      '+---------------------------------------------------------------+',
      '|                    CRYSTAL MINTED                             |',
      '+---------------------------------------------------------------+',
      '',
      ...art.map(line => `  ${line}`),
      '',
      '+---------------------------------------------------------------+',
      `|  NAME       : ${crystal.name.padEnd(46)} |`,
      `|  COLOR      : ${crystal.color.toUpperCase().padEnd(46)} |`,
      `|  ERA        : ${crystal.era.padEnd(46)} |`,
      `|  VOLATILITY : TIER ${crystal.volatility.padEnd(41)} |`,
      `|  ROTATION   : ${crystal.rotation.padEnd(46)} |`,
      `|  STATE      : ${crystal.state.toUpperCase().padEnd(46)} |`,
      '+---------------------------------------------------------------+',
      `|  NEW BALANCE: ${(result.newBalance || 0).toFixed(2).padStart(10)} _unSC                         |`,
      '+---------------------------------------------------------------+',
      '',
      '30 slices initialized. Use CRYSTAL <name> for detailed view.',
      '',
    ]

    return { success: true, output }
  },
}

const crystalCommand: Command = {
  name: 'crystal',
  aliases: ['cr', 'view'],
  description: 'View detailed crystal info',
  usage: 'crystal <name>',
  execute: async (args, ctx) => {
    const name = args[0]

    if (!name) {
      return {
        success: false,
        error: 'Usage: CRYSTAL <name>\nExample: CRYSTAL my-crystal',
      }
    }

    ctx.setTyping(true)
    const crystal = await ctx.data.fetchCrystalByName(name)
    ctx.setTyping(false)

    if (!crystal) {
      return { success: false, error: `Crystal "${name}" not found.` }
    }

    const art = generateCrystalArt(crystal.color, crystal.era)

    // Calculate slice stats
    const activeSlices = crystal.slices.filter(s => s.is_active).length
    const avgPower = crystal.slices.length > 0
      ? crystal.slices.reduce((sum, s) => sum + s.power, 0) / crystal.slices.length
      : 0

    const genesisTag = crystal.is_genesis ? ' [GENESIS]' : ''
    const createdDate = new Date(crystal.created_at).toLocaleDateString()

    const output = [
      '',
      '+---------------------------------------------------------------+',
      `|                    CRYSTAL: ${(crystal.name.toUpperCase() + genesisTag).padEnd(32)} |`,
      '+---------------------------------------------------------------+',
      '',
      ...art.map(line => `  ${line}`),
      '',
      '+---------------------------------------------------------------+',
      '|                        ATTRIBUTES                             |',
      '+---------------------------------------------------------------+',
      `|  COLOR      : ${crystal.color.toUpperCase().padEnd(46)} |`,
      `|  ERA        : ${crystal.era.padEnd(46)} |`,
      `|  VOLATILITY : TIER ${crystal.volatility.padEnd(41)} |`,
      `|  ROTATION   : ${crystal.rotation.padEnd(46)} |`,
      `|  STATE      : ${crystal.state.toUpperCase().padEnd(46)} |`,
      '+---------------------------------------------------------------+',
      '|                         SLICES                                |',
      '+---------------------------------------------------------------+',
      `|  TOTAL      : ${crystal.slice_count.toString().padEnd(2)}/30                                           |`,
      `|  ACTIVE     : ${activeSlices.toString().padEnd(2)}/30                                           |`,
      `|  AVG POWER  : ${avgPower.toFixed(2).padStart(6)}                                        |`,
      `|  TOTAL PWR  : ${crystal.total_power.toFixed(2).padStart(6)}                                        |`,
      '+---------------------------------------------------------------+',
      `|  CREATED    : ${createdDate.padEnd(46)} |`,
      '+---------------------------------------------------------------+',
      '',
    ]

    // Add slice visualization (simplified bar representation)
    output.push('  SLICE POWER DISTRIBUTION:')
    output.push('')

    // Show 3 rows of 10 slices each
    for (let row = 0; row < 3; row++) {
      let rowStr = '  '
      for (let col = 0; col < 10; col++) {
        const idx = row * 10 + col
        const slice = crystal.slices[idx]
        if (slice) {
          // Use power to determine bar height (1-5 blocks)
          const height = Math.min(5, Math.max(1, Math.round(slice.power)))
          const bar = '#'.repeat(height).padEnd(5, '-')
          rowStr += `[${bar}] `
        }
      }
      output.push(rowStr)
    }

    output.push('')

    return { success: true, output }
  },
}

const renameCommand: Command = {
  name: 'rename',
  aliases: ['rn'],
  description: 'Rename a crystal',
  usage: 'rename <old-name> <new-name>',
  execute: async (args, ctx) => {
    const [oldName, newName] = args

    if (!oldName || !newName) {
      return {
        success: false,
        error: 'Usage: RENAME <old-name> <new-name>\nExample: RENAME my-crystal new-name',
      }
    }

    ctx.setTyping(true)
    const result = await ctx.data.renameCrystal(oldName, newName)
    ctx.setTyping(false)

    if (!result.success) {
      return { success: false, error: result.error }
    }

    const output = [
      '',
      '+-------------------------------------+',
      '|         CRYSTAL RENAMED             |',
      '+-------------------------------------+',
      `|  OLD NAME : ${(result.oldName || '').padEnd(22)} |`,
      `|  NEW NAME : ${(result.newName || '').padEnd(22)} |`,
      '+-------------------------------------+',
      '',
    ]

    return { success: true, output }
  },
}

// System reboot sequence
const REBOOT_SEQUENCE = [
  '',
  '╔═══════════════════════════════════════════════════════════════╗',
  '║                    SYSTEM REBOOT INITIATED                    ║',
  '╚═══════════════════════════════════════════════════════════════╝',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                   SHUTDOWN PHASE                            │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[STOP] Terminating user processes............ OK',
  '[STOP] Closing active connections............ OK',
  '[STOP] Flushing disk buffers................. OK',
  '[STOP] Saving system state................... OK',
  '',
  '[UNMOUNT] /dev/quantum0...................... OK',
  '[UNMOUNT] /dev/crystal_cache................. OK',
  '[UNMOUNT] /dev/oscilloscope.................. OK',
  '[UNMOUNT] /home/operator..................... OK',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                   SYSTEM CHECK - PRE-REBOOT                 │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[CHECK] Open File Handles............ 0         [  OK  ]',
  '[CHECK] Pending I/O Operations....... 0         [  OK  ]',
  '[CHECK] Memory Mapped Files.......... Flushed   [  OK  ]',
  '[CHECK] Network Sockets.............. Closed    [  OK  ]',
  '[CHECK] Session Data................. Saved     [  OK  ]',
  '',
  '[POWER] Sending ACPI shutdown signal...',
  '[POWER] Hardware acknowledges shutdown...',
  '',
  '╔═══════════════════════════════════════════════════════════════╗',
  '║                    SYSTEM HALTED                              ║',
  '╚═══════════════════════════════════════════════════════════════╝',
  '',
  '[POWER] ████████████████████████████████ 100%',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                   REBOOT PHASE                              │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[BIOS] POST Check............................ OK',
  '[BIOS] Memory Test: 16384 MB................. OK',
  '[BIOS] CPU: Quantum-Core X99 @ 4.7GHz........ OK',
  '',
  '[BOOT] Loading UnstableLabs Kernel v4.2.1...',
  '[BOOT] Remounting filesystems................',
  '[BOOT] Restoring system state................',
  '',
  '┌─────────────────────────────────────────────────────────────┐',
  '│                   SYSTEM CHECK - POST-REBOOT                │',
  '└─────────────────────────────────────────────────────────────┘',
  '',
  '[CHECK] CPU Temperature............... 36°C    [  OK  ]',
  '[CHECK] Memory Integrity.............. 100%    [  OK  ]',
  '[CHECK] Quantum Coherence............. 99.9%   [  OK  ]',
  '[CHECK] Network Status................ Online  [  OK  ]',
  '[CHECK] Security Protocols............ Active  [  OK  ]',
  '',
  '[INIT] Starting system services..............',
  '[INIT] Loading terminal environment..........',
  '[INIT] Restoring user session................',
  '',
  '╔═══════════════════════════════════════════════════════════════╗',
  '║  REBOOT COMPLETE | ALL SYSTEMS OPERATIONAL                   ║',
  '║  Uptime: 00:00:00 | Ready for commands                       ║',
  '╚═══════════════════════════════════════════════════════════════╝',
  '',
  '> System rebooted successfully. Type HELP for commands.',
  '',
]

const unsystemctlCommand: Command = {
  name: 'unsystemctl',
  aliases: ['systemctl', 'sysctl'],
  description: 'System control commands',
  usage: 'unsystemctl <command> [flags]',
  execute: async (args, ctx) => {
    const command = args[0]?.toLowerCase()
    const flags = args.slice(1).join(' ').toLowerCase()

    if (!command) {
      return {
        success: false,
        error: 'Usage: unsystemctl <command> [flags]\n\nAvailable commands:\n  reboot    - Reboot the system\n  shutdown  - Shutdown panel and return to terminal\n  status    - Show system status\n\nFlags:\n  -now      - Execute immediately',
      }
    }

    if (command === 'reboot') {
      if (!flags.includes('-now')) {
        return {
          success: false,
          error: 'Reboot requires -now flag for immediate execution.\nUsage: unsystemctl reboot -now',
        }
      }

      // Reboot sequence ends with panel restart
      const rebootWithPanelRestart = [
        ...REBOOT_SEQUENCE.slice(0, -2), // Remove last 2 lines
        '',
        '┌─────────────────────────────────────────────────────────────┐',
        '│                   PANEL AUTO-RESTART                        │',
        '└─────────────────────────────────────────────────────────────┘',
        '',
        '[INIT] Restarting panel subsystem...........',
        '[INIT] Loading equipment drivers............',
        '[INIT] Calibrating oscilloscope.............',
        '[INIT] Connecting to network................',
        '',
        '╔═══════════════════════════════════════════════════════════════╗',
        '║  REBOOT COMPLETE | PANEL RESTORED                            ║',
        '║  All systems operational | Resuming session                  ║',
        '╚═══════════════════════════════════════════════════════════════╝',
        '',
        '> Returning to panel interface...',
        '',
      ]

      return {
        success: true,
        output: rebootWithPanelRestart,
        navigate: '/panel',
        // Don't clear panel access - keep it so panel loads
      }
    }

    if (command === 'status') {
      const output = [
        '',
        '╔═══════════════════════════════════════════════════════════════╗',
        '║                      SYSTEM STATUS                            ║',
        '╚═══════════════════════════════════════════════════════════════╝',
        '',
        '  System:     UnstableLabs OS v4.2.1',
        '  Kernel:     quantum-core 5.15.0-generic',
        '  Uptime:     ' + new Date().toISOString().slice(11, 19),
        '  Load Avg:   0.42, 0.38, 0.35',
        '',
        '  CPU:        Quantum-Core X99 @ 4.7GHz (8 cores)',
        '  Memory:     2.4 GB / 16 GB (15%)',
        '  Swap:       0 B / 4 GB (0%)',
        '',
        '  Network:    SOLANA DEVNET (Connected)',
        '  Security:   MAXIMUM',
        '  Session:    ENCRYPTED',
        '',
        '  Services:   12 running, 0 failed',
        '',
      ]
      return { success: true, output }
    }

    if (command === 'shutdown') {
      if (!flags.includes('-now')) {
        return {
          success: false,
          error: 'Shutdown requires -now flag.\nUsage: unsystemctl shutdown -now',
        }
      }

      const output = [
        '',
        '╔═══════════════════════════════════════════════════════════════╗',
        '║                    PANEL SHUTDOWN                             ║',
        '╚═══════════════════════════════════════════════════════════════╝',
        '',
        '┌─────────────────────────────────────────────────────────────┐',
        '│                   SHUTDOWN SEQUENCE                         │',
        '└─────────────────────────────────────────────────────────────┘',
        '',
        '[STOP] Terminating panel processes.......... OK',
        '[STOP] Closing display subsystem............ OK',
        '[STOP] Releasing equipment drivers.......... OK',
        '[STOP] Saving panel state................... OK',
        '',
        '┌─────────────────────────────────────────────────────────────┐',
        '│                   SYSTEM CHECK                              │',
        '└─────────────────────────────────────────────────────────────┘',
        '',
        '[CHECK] Memory Released............. 2.4 GB   [  OK  ]',
        '[CHECK] GPU Resources............... Freed    [  OK  ]',
        '[CHECK] Audio Subsystem............. Stopped  [  OK  ]',
        '[CHECK] Network Connections......... Closed   [  OK  ]',
        '',
        '[UNMOUNT] /dev/oscilloscope................. OK',
        '[UNMOUNT] /dev/equipment.................... OK',
        '[UNMOUNT] /dev/crystal_cache................ OK',
        '',
        '╔═══════════════════════════════════════════════════════════════╗',
        '║  PANEL MODULE OFFLINE | RETURNING TO TERMINAL                ║',
        '╚═══════════════════════════════════════════════════════════════╝',
        '',
        '> Panel shutdown complete. Returning to terminal...',
        '',
      ]
      return { success: true, output, navigate: '/terminal', clearPanelAccess: true }
    }

    return {
      success: false,
      error: `Unknown command: ${command}\nAvailable: reboot, shutdown, status`,
    }
  },
}

const killCommand: Command = {
  name: 'kill',
  aliases: ['stop', 'shutdown'],
  description: 'Shut down a subsystem module',
  usage: 'kill <module> <mode> [flags]',
  execute: async (args, _ctx) => {
    const module = args[0]?.toLowerCase()
    const mode = args[1]?.toLowerCase()
    const flags = args.slice(2).join(' ')

    if (!module) {
      return {
        success: false,
        error: 'Usage: KILL <module> <mode> [flags]\nAvailable modules: panel',
      }
    }

    if (module === 'panel') {
      if (mode !== 'dev') {
        return {
          success: false,
          error: 'Usage: KILL panel dev -un\nMode "dev" required for panel shutdown.',
        }
      }

      if (!flags.toLowerCase().includes('-un')) {
        return {
          success: false,
          error: 'Access denied. Flag -un required.\nUsage: KILL panel dev -un',
        }
      }

      return { success: true, output: PANEL_SHUTDOWN_SEQUENCE, navigate: '/terminal', clearPanelAccess: true }
    }

    return {
      success: false,
      error: `Unknown module: ${module}\nAvailable modules: panel`,
    }
  },
}

const runCommand: Command = {
  name: 'run',
  aliases: ['exec', 'launch'],
  description: 'Run a subsystem module',
  usage: 'run <module> <mode> [flags]',
  execute: async (args, _ctx) => {
    const module = args[0]?.toLowerCase()
    const mode = args[1]?.toLowerCase()
    const flags = args.slice(2).join(' ')

    if (!module) {
      return {
        success: false,
        error: 'Usage: RUN <module> <mode> [flags]\nAvailable modules: panel',
      }
    }

    if (module === 'panel') {
      if (mode !== 'dev') {
        return {
          success: false,
          error: 'Usage: RUN panel dev -un\nMode "dev" required for panel access.',
        }
      }

      if (!flags.toLowerCase().includes('-un')) {
        return {
          success: false,
          error: 'Access denied. Flag -un required.\nUsage: RUN panel dev -un',
        }
      }

      return { success: true, output: PANEL_BOOT_SEQUENCE, navigate: '/panel' }
    }

    return {
      success: false,
      error: `Unknown module: ${module}\nAvailable modules: panel`,
    }
  },
}

const historyCommand: Command = {
  name: 'history',
  aliases: ['hist'],
  description: 'View command history',
  execute: async (_args, ctx) => {
    ctx.setTyping(true)
    const history = await ctx.data.fetchCommandHistory(15)
    ctx.setTyping(false)

    if (history.length === 0) {
      return { success: true, output: ['No command history found.', '', 'Use UP/DOWN arrows to navigate recent commands.'] }
    }

    const output = [
      '',
      '+-------------------------------------+',
      '|         COMMAND HISTORY             |',
      '+-------------------------------------+',
    ]

    history.forEach((entry, index) => {
      const time = new Date(entry.created_at).toLocaleTimeString()
      output.push(`|  ${(index + 1).toString().padStart(2)}. ${entry.command.padEnd(20)} ${time.padStart(8)} |`)
    })

    output.push('+-------------------------------------+')
    output.push('')
    output.push('Use UP/DOWN arrows to navigate recent commands.')
    output.push('')

    return { success: true, output }
  },
}

// Command registry
export const commands: Command[] = [
  helpCommand,
  clearCommand,
  statusCommand,
  invCommand,
  mintCommand,
  crystalCommand,
  renameCommand,
  balanceCommand,
  researchCommand,
  scanCommand,
  whoamiCommand,
  echoCommand,
  aboutCommand,
  historyCommand,
  runCommand,
  killCommand,
  unsystemctlCommand,
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
  const startTime = Date.now()
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
    const result = await command.execute(args, context)

    // Log command to database
    const executionTime = Date.now() - startTime
    context.data.logCommand(
      commandName,
      args,
      result.output?.join('\n') || result.error || '',
      result.success,
      executionTime
    ).catch(console.error) // Fire and forget

    return result
  } catch (error) {
    return {
      success: false,
      error: `Error executing ${commandName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// Get welcome message with boot sequence
export function getWelcomeMessage(username: string | null): string[] {
  return [
    ...TERMINAL_BOOT_SEQUENCE,
    ASCII_LOGO,
    '+------------------------------------------------------------+',
    '|       UNSTABLE LABORATORIES TERMINAL v0.1.0                |',
    '|       Quantum Crystal Research Interface                   |',
    '+------------------------------------------------------------+',
    '',
    `> OPERATOR ${username || 'UNKNOWN'} authenticated.`,
    '> System initialized. All subsystems operational.',
    '> Type HELP for available commands.',
    '',
  ]
}
