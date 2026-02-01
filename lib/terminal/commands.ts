import type { Command, CommandContext, CommandResult } from './types'
import { parseTimeArg, formatCountdown } from '@/lib/power/timeParser'

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
      '|                    available commands                      |',
      '+------------------------------------------------------------+',
      '|  help      - display this help message                     |',
      '|  clear     - clear terminal screen                         |',
      '|  status    - display system status                         |',
      '+------------------------------------------------------------+',
      '|                      crystals                              |',
      '+------------------------------------------------------------+',
      '|  inv       - view crystal inventory                        |',
      '|  mint      - mint a new crystal (50 _unSC)                 |',
      '|  crystal   - view detailed crystal info                    |',
      '|  rename    - rename a crystal                              |',
      '+------------------------------------------------------------+',
      '|                      economy                               |',
      '+------------------------------------------------------------+',
      '|  balance   - check _unSC token balance                     |',
      '|  research  - view tech tree progress                       |',
      '|  scan      - scan for volatility data                      |',
      '+------------------------------------------------------------+',
      '|                     filesystem                              |',
      '+------------------------------------------------------------+',
      '|  ls        - list directory contents (dir)                  |',
      '|  cd        - change directory                               |',
      '|  pwd       - print working directory                        |',
      '|  cat       - display file contents                          |',
      '|  mkdir     - create directory (-p for parents)              |',
      '|  touch     - create empty file                              |',
      '|  rm        - remove file/directory (-r recursive)           |',
      '|  tree      - display directory tree                         |',
      '|  chmod     - change file permissions                        |',
      '|  chown     - change file owner/group (root)                |',
      '|  cp        - copy files and directories                    |',
      '|  mv        - move/rename files                             |',
      '|  ln        - create symbolic links (-s)                    |',
      '|  head      - display first lines of file                   |',
      '|  tail      - display last lines of file                    |',
      '+------------------------------------------------------------+',
      '|                  user management                            |',
      '+------------------------------------------------------------+',
      '|  whoami    - display current user                           |',
      '|  id        - show user/group info                           |',
      '|  su        - switch user                                    |',
      '|  sudo      - run command as root                            |',
      '|  passwd    - change password (simulated)                    |',
      '|  useradd   - create new user (root only)                    |',
      '|  userdel   - delete user account (root only)               |',
      '|  usermod   - modify user groups (root only)                |',
      '|  groups    - show user groups                               |',
      '+------------------------------------------------------------+',
      '|                     packages                                |',
      '+------------------------------------------------------------+',
      '|  unapt     - package manager (apt/dnf)                     |',
      '|             unapt update/install/remove/search/list         |',
      '+------------------------------------------------------------+',
      '|                    containers                               |',
      '+------------------------------------------------------------+',
      '|  unpod     - container runtime                              |',
      '|             unpod ps/run/stop/rm/images/pull/logs           |',
      '+------------------------------------------------------------+',
      '|                      network                                |',
      '+------------------------------------------------------------+',
      '|  unnet     - network management                             |',
      '|             unnet show/up/down/addr/ping/scan/fw            |',
      '+------------------------------------------------------------+',
      '|                    version control                          |',
      '+------------------------------------------------------------+',
      '|  ungit     - simulated version control                      |',
      '|             ungit status/add/commit/push/pull/log           |',
      '+------------------------------------------------------------+',
      '|                    file manager                              |',
      '+------------------------------------------------------------+',
      '|  unmc       - midnight commander file manager (interactive)   |',
      '|  unmcedit   - edit file in unMC editor                       |',
      '+------------------------------------------------------------+',
      '|                       other                                |',
      '+------------------------------------------------------------+',
      '|  history   - view command history                          |',
      '|  echo      - echo text back                                |',
      '|  about     - about UnstableLabs                            |',
      '|  exit      - exit current session                          |',
      '+------------------------------------------------------------+',
      '|                      modules                               |',
      '+------------------------------------------------------------+',
      '|  run       - launch a subsystem module                     |',
      '|  kill      - shut down a subsystem module                  |',
      '+------------------------------------------------------------+',
      '|                      devices                               |',
      '+------------------------------------------------------------+',
      '|  device    - list and control lab devices                  |',
      '|             device list    - show all connected devices    |',
      '|             device <n> test   - run device diagnostics     |',
      '|             device <n> reboot - reboot device (or reset)   |',
      '|             device <n> status - show device status         |',
      '|             device <n> info   - show device details        |',
      '|                                                            |',
      '|  device names: cache, core, battery, synth, recorder,      |',
      '|    reactor, ai, super, drone, magnet, tank, exotic, qsm,   |',
      '|    net, temp, dim, cpu, clock, mem, anomaly, compass,      |',
      '|    teleport, vent, matrix, qsm, diag, laser, printer,      |',
      '|    thermal, toolkit, scanner, workbench, bench, power,     |',
      '|    volt, powerdisplay                                       |',
      '+------------------------------------------------------------+',
      '|                      thermal                               |',
      '+------------------------------------------------------------+',
      '|  thermal   - panel thermal management system               |',
      '|             thermal status     - show thermal status       |',
      '|             thermal fan <id> <mode> - set fan mode         |',
      '|             thermal auto [on|off]  - toggle auto mode      |',
      '|             thermal emergency  - emergency cooling         |',
      '|                                                            |',
      '|  fan ids: cpu, gpu                                         |',
      '|  modes: auto, low, med, high, or 0-100 (speed %)           |',
      '+------------------------------------------------------------+',
      '|                       power                                |',
      '+------------------------------------------------------------+',
      '|  power     - power management system (pwrmgmt)             |',
      '|             power status      - show power overview        |',
      '|             power devices     - list power consumers       |',
      '|             power grid        - show power grid topology   |',
      '|             power on <id>     - turn on a device           |',
      '|             power off <id>    - turn off a device          |',
      '|             power fault       - show fault diagnostics     |',
      '|             power emergency   - emergency shutdown         |',
      '+------------------------------------------------------------+',
      '|                   screw buttons                            |',
      '+------------------------------------------------------------+',
      '|  screwstat  - screw button status overview (sbs, screws)  |',
      '|  nodesync   - NODE-SYNC network control (ns)              |',
      '|  poollink   - POOL-LINK mining pool (pl, pool)            |',
      '|  meshcast   - MESH-CAST broadcasting (mc, meme)           |',
      '|  qbridge    - QUANTUM-BRIDGE link (qb, bridge)            |',
      '+------------------------------------------------------------+',
      '|                   crystal data cache                       |',
      '+------------------------------------------------------------+',
      '|  cdc        - crystal data cache management (CDC-001)      |',
      '|             cdc status         - show device status        |',
      '|             cdc power [on|off] - toggle power/standby      |',
      '|             cdc firmware       - view firmware info        |',
      '|             cdc firmware update - check for updates        |',
      '|             cdc test           - run hardware diagnostics  |',
      '|             cdc reset          - reboot device             |',
      '|             cdc info           - full documentation        |',
      '+------------------------------------------------------------+',
      '|                  unstable energy core                      |',
      '+------------------------------------------------------------+',
      '|  uec        - energy core management (UEC-001)             |',
      '|             uec status         - show device status        |',
      '|             uec power [on|off] - toggle power/standby      |',
      '|             uec firmware       - view firmware info        |',
      '|             uec firmware update - check for updates        |',
      '|             uec test           - run hardware diagnostics  |',
      '|             uec reset          - reboot device             |',
      '|             uec info           - full documentation        |',
      '+------------------------------------------------------------+',
      '|                  portable battery pack                     |',
      '+------------------------------------------------------------+',
      '|  bat        - battery pack management (BAT-001)            |',
      '|             bat status         - show battery status       |',
      '|             bat power [on|off] - toggle power/standby      |',
      '|             bat firmware       - view firmware info        |',
      '|             bat firmware update - check for updates        |',
      '|             bat test           - run battery diagnostics   |',
      '|             bat reset          - reboot device             |',
      '|             bat regen [on|off] - toggle auto-regeneration  |',
      '|             bat info           - full documentation        |',
      '+------------------------------------------------------------+',
      '|                  handmade synthesizer                      |',
      '+------------------------------------------------------------+',
      '|  hms        - synthesizer management (HMS-001)             |',
      '|             hms status         - show synth status         |',
      '|             hms power [on|off] - toggle power/standby      |',
      '|             hms firmware       - view firmware info        |',
      '|             hms firmware update - check for updates        |',
      '|             hms test           - run synth diagnostics     |',
      '|             hms reset          - reboot device             |',
      '|             hms wave [type]    - set waveform type         |',
      '|             hms knob [k] [val] - adjust knob values        |',
      '|             hms info           - full documentation        |',
      '+------------------------------------------------------------+',
      '|                     echo recorder                         |',
      '+------------------------------------------------------------+',
      '|  ecr        - echo recorder management (ECR-001)          |',
      '|             ecr status         - show recorder status     |',
      '|             ecr power [on|off] - toggle power/standby     |',
      '|             ecr firmware       - view firmware info       |',
      '|             ecr firmware update - check for updates       |',
      '|             ecr test           - run recorder diagnostics |',
      '|             ecr reset          - reboot device            |',
      '|             ecr record [on|off] - toggle recording mode   |',
      '|             ecr knob [k] [val] - adjust knob values       |',
      '|             ecr info           - full documentation       |',
      '+------------------------------------------------------------+',
      '|                      interpolator                         |',
      '+------------------------------------------------------------+',
      '|  ipl        - interpolator management (INT-001)           |',
      '|             ipl status         - show device status       |',
      '|             ipl power [on|off] - toggle power/standby     |',
      '|             ipl firmware       - view firmware info       |',
      '|             ipl firmware update - check for updates       |',
      '|             ipl test           - run diagnostics          |',
      '|             ipl reset          - reboot device            |',
      '|             ipl info           - full documentation       |',
      '+------------------------------------------------------------+',
      '|                   microfusion reactor                     |',
      '+------------------------------------------------------------+',
      '|  mfr        - reactor management (MFR-001)                |',
      '|             mfr status         - show reactor status      |',
      '|             mfr power [on|off] - ignite/SCRAM reactor     |',
      '|             mfr firmware       - view firmware info       |',
      '|             mfr firmware update - check for updates       |',
      '|             mfr test           - run diagnostics          |',
      '|             mfr reset          - reboot reactor           |',
      '|             mfr info           - full documentation       |',
      '+------------------------------------------------------------+',
      '|                   ai assistant core                       |',
      '+------------------------------------------------------------+',
      '|  aic        - AI core management (AIC-001)               |',
      '|             aic status         - show core status        |',
      '|             aic power [on|off] - boot/shutdown core      |',
      '|             aic firmware       - view firmware info      |',
      '|             aic firmware update - check for updates      |',
      '|             aic test           - run neural diagnostics  |',
      '|             aic reset          - reboot neural core      |',
      '|             aic learn [on|off] - toggle learning mode    |',
      '|             aic info           - full documentation      |',
      '|  emc        - exotic matter containment (EMC-001)           |',
      '|  qua        - quantum analyzer (QUA-001)                  |',
      '|  qsm        - quantum state monitor (QSM-001)             |',
      '|  vnt        - ventilation management (VNT-001)           |',
      '|  sca        - supercomputer management (SCA-001)         |',
      '|  exd        - explorer drone management (EXD-001)        |',
      '|  pwb        - portable workbench (PWB-001)               |',
      '|  btk        - basic toolkit (BTK-001)                    |',
      '|  msc        - material scanner (MSC-001)                  |',
      '|  rmg        - resource magnet (RMG-001)                  |',
      '|  mem        - memory monitor (MEM-001)                    |',
      '|             mem status         - show device status       |',
      '|             mem firmware       - view firmware info       |',
      '|             mem test           - run diagnostics          |',
      '|             mem config         - view configuration       |',
      '|             mem mode           - cycle display mode       |',
      '|             mem reboot         - reboot device            |',
      '|  and        - anomaly detector (AND-001)                   |',
      '|             and status         - show device status       |',
      '|             and firmware       - view firmware info       |',
      '|             and test           - run diagnostics          |',
      '|             and config         - view configuration       |',
      '|             and mode           - cycle display mode       |',
      '|             and signal         - set signal strength      |',
      '|             and reboot         - reboot device            |',
      '|  qcp        - quantum compass (QCP-001)                    |',
      '|             qcp status         - show device status       |',
      '|             qcp firmware       - view firmware info       |',
      '|             qcp test           - run diagnostics          |',
      '|             qcp config         - view configuration       |',
      '|             qcp mode           - cycle display mode       |',
      '|             qcp bearing        - set anomaly direction    |',
      '|             qcp distance       - set anomaly distance     |',
      '|             qcp reboot         - reboot device            |',
      '|  tlp        - teleport pad (TLP-001)                      |',
      '|             tlp status         - show device status       |',
      '|             tlp on/off         - power control            |',
      '|             tlp firmware       - view firmware info       |',
      '|             tlp test           - run diagnostics          |',
      '|             tlp config         - view/set configuration   |',
      '|             tlp mode           - set transport mode       |',
      '|             tlp charge         - show charge level        |',
      '|             tlp dest           - show destination         |',
      '|             tlp reboot         - reboot device            |',
      '|  lct        - precision laser (LCT-001)                    |',
      '|             lct status         - show device status       |',
      '|             lct on/off         - power control            |',
      '|             lct firmware       - view firmware info       |',
      '|             lct test           - run diagnostics          |',
      '|             lct config         - view power specs         |',
      '|             lct mode           - set laser mode           |',
      '|             lct power          - set laser power          |',
      '|             lct precision      - set precision            |',
      '|             lct reboot         - reboot device            |',
      '|             btk status         - show device status       |',
      '|             btk firmware       - view firmware info       |',
      '|             btk test           - run diagnostics          |',
      '|             btk config         - view configuration       |',
      '|             btk tools          - tool status               |',
      '|             btk reboot         - reboot device            |',
      '|             pwb status         - show device status       |',
      '|             pwb firmware       - view firmware info       |',
      '|             pwb firmware update - check for updates       |',
      '|             pwb test           - run diagnostics          |',
      '|             pwb config         - view configuration       |',
      '|             pwb slots          - show slot status         |',
      '|             pwb reboot         - reboot device            |',
      '|             vnt status         - show fan status          |',
      '|             vnt power [on|off] - boot/shutdown system     |',
      '|             vnt fan <id> <cmd> - control individual fan   |',
      '|             vnt test           - run fan diagnostics      |',
      '|             vnt reset          - reboot fan controller    |',
      '|             vnt info           - full documentation       |',
      '+------------------------------------------------------------+',
      '|                      display                               |',
      '+------------------------------------------------------------+',
      '|  theme    - CRT theme manager                              |',
      '|             theme list       - show all themes             |',
      '|             theme set <name|#> - set active theme          |',
      '|             theme get        - show current theme          |',
      '|             theme save       - save to ~/.themerc          |',
      '|             theme load       - load from ~/.themerc        |',
      '+------------------------------------------------------------+',
      '|                      system                                |',
      '+------------------------------------------------------------+',
      '|  unsystemctl - system control (reboot, poweroff, status)   |',
      '+------------------------------------------------------------+',
      '',
      'usage: mint <name> | crystal <name> | rename <old> <new>',
      '       run panel dev -un | kill panel dev -un',
      '       thermal fan cpu 75 | thermal auto on',
      '       power status | power on tlp-001 | power emergency -now',
      '       cdc status | cdc power off | cdc firmware update',
      '       uec status | uec power off | uec firmware update',
      '       bat status | bat power off | bat regen on',
      '       hms status | hms wave sine | hms knob p 50',
      '       ecr status | ecr record on | ecr knob p 50',
      '       ipl status | ipl power on | ipl firmware update',
      '       mfr status | mfr power on | mfr test',
      '       aic status | aic power on | aic learn off',
      '       vnt status | vnt fan cpu mode auto | vnt power on',
      '       sca status | sca test | sca power on',
      '       exd status | exd power on | exd deploy',
      '       theme list | theme set amber | theme save',
      '       unsystemctl shutdown -now | unsystemctl reboot -now',
      'type a command and press enter to execute.',
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
        '|  use mint to create your first      |',
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
  aliases: ['who', 'unwhoami'],
  description: 'Display current user information',
  execute: async (_args, ctx) => {
    const userActions = ctx.data.userActions
    if (userActions) {
      const user = userActions.getCurrentUser()
      ctx.setTyping(true)
      const balance = await ctx.data.fetchBalance()
      const crystals = await ctx.data.fetchCrystals()
      ctx.setTyping(false)
      const total = balance ? balance.available + balance.staked + balance.locked : 0
      const output = [
        '',
        '+-------------------------------------+',
        '|         USER PROFILE                |',
        '+-------------------------------------+',
        `|  USER     : ${user.username.padEnd(22)} |`,
        `|  UID      : ${user.uid.toString().padEnd(22)} |`,
        `|  GROUPS   : ${user.groups.join(',').padEnd(22)} |`,
        `|  HOME     : ${user.home.padEnd(22)} |`,
        `|  ROOT     : ${(user.isRoot ? 'YES' : 'NO').padEnd(22)} |`,
        '+-------------------------------------+',
        `|  SESSION  : ${ctx.userId.slice(0, 20).padEnd(22)} |`,
        '+-------------------------------------+',
        `|  BALANCE  : ${total.toFixed(2).padStart(10)} _unSC        |`,
        `|  CRYSTALS : ${crystals.length.toString().padStart(10)}            |`,
        '+-------------------------------------+',
        '',
      ]
      return { success: true, output }
    }

    // Fallback when userActions not available
    return { success: true, output: [ctx.username || 'UNKNOWN'] }
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
        error: 'usage: mint <name>\nexample: mint my-crystal',
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
      '30 slices initialized. use crystal <name> for detailed view.',
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
        error: 'usage: crystal <name>\nexample: crystal my-crystal',
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
        error: 'usage: rename <old-name> <new-name>\nexample: rename my-crystal new-name',
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
        error: 'usage: unsystemctl <command> [flags]\n\navailable commands:\n  reboot         - reboot _unOS and terminal\n  shutdown       - shutdown _unOS and return to terminal\n  status         - show system status\n  daemon-reload  - reload system daemon configuration\n\nflags:\n  -now       execute immediately\n  -XhYmZs   schedule (e.g. -30m, -1h30m, -90s)\n  -cancel    cancel scheduled action\n\nFor full system power control: unsystem',
      }
    }

    if (command === 'daemon-reload') {
      ctx.addOutput('[systemd] Reloading daemon configuration...')
      ctx.setTyping(true)
      await new Promise(r => setTimeout(r, 400))
      ctx.addOutput('[systemd] Scanning unit files...')
      await new Promise(r => setTimeout(r, 350))
      ctx.addOutput('[systemd] Rebuilding dependency tree...')
      await new Promise(r => setTimeout(r, 300))
      ctx.addOutput('[systemd] Reloading service manifests...')
      await new Promise(r => setTimeout(r, 250))
      ctx.setTyping(false)
      return {
        success: true,
        output: ['[systemd] Daemon configuration reloaded successfully.'],
      }
    }

    if (command === 'reboot') {
      if (flags.includes('-cancel')) {
        if (ctx.data.systemPower) {
          const state = ctx.data.systemPower.getState()
          if (state.countdownAction === 'reboot' && state.systemState === 'countdown' && state.powerScope === 'os') {
            ctx.data.systemPower.cancelCountdown()
            return { success: true, output: ['', '[systemd] Scheduled reboot cancelled.', ''] }
          }
          return { success: true, output: ['', '[systemd] No _unOS reboot scheduled.', ''] }
        }
        return { success: false, error: 'System power control not available.' }
      }

      const timeFlag = args.slice(1).find(a => a.startsWith('-'))
      if (!timeFlag) {
        return {
          success: false,
          error: 'Reboot requires a time flag.\nUsage: unsystemctl reboot -now | -XhYmZs | -cancel',
        }
      }

      const parsed = parseTimeArg(timeFlag)
      if (parsed.error) {
        return { success: false, error: `[PWR] ${parsed.error}` }
      }

      if (parsed.seconds === 0 && ctx.data.systemPower) {
        ctx.data.saveAllDeviceState?.()
        ctx.data.systemPower.rebootNow('os')
        return {
          success: true,
          output: ['', '[systemd] Initiating _unOS reboot...', ''],
        }
      }

      if (ctx.data.systemPower && parsed.seconds > 0) {
        ctx.data.systemPower.scheduleReboot(parsed.seconds, 'os')
        const timeStr = formatCountdown(parsed.seconds)
        const output = ['', `[systemd] _unOS reboot scheduled in ${timeStr}.`]
        if (parsed.wasAdjusted) output.push('[systemd] Warning: adjusted to minimum 10 seconds.')
        output.push('')
        return { success: true, output }
      }

      // Fallback: no system power context
      ctx.data.saveAllDeviceState?.()
      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│                   PANEL AUTO-RESTART                        │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '[INIT] Restarting panel subsystem...........',
          '[INIT] Loading equipment drivers............',
          '',
          '> Returning to panel interface...',
          '',
        ],
        refresh: true,
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
      if (flags.includes('-cancel')) {
        if (ctx.data.systemPower) {
          const state = ctx.data.systemPower.getState()
          if (state.countdownAction === 'shutdown' && state.systemState === 'countdown' && state.powerScope === 'os') {
            ctx.data.systemPower.cancelCountdown()
            return { success: true, output: ['', '[systemd] Scheduled shutdown cancelled.', ''] }
          }
          return { success: true, output: ['', '[systemd] No _unOS shutdown scheduled.', ''] }
        }
        return { success: false, error: 'System power control not available.' }
      }

      const timeFlag = args.slice(1).find(a => a.startsWith('-'))
      if (!timeFlag) {
        return {
          success: false,
          error: 'Shutdown requires a time flag.\nUsage: unsystemctl shutdown -now | -XhYmZs | -cancel',
        }
      }

      const parsed = parseTimeArg(timeFlag)
      if (parsed.error) {
        return { success: false, error: `[PWR] ${parsed.error}` }
      }

      if (parsed.seconds === 0 && ctx.data.systemPower) {
        ctx.data.saveAllDeviceState?.()
        ctx.data.systemPower.shutdownNow('os')
        return {
          success: true,
          output: ['', '[systemd] Initiating _unOS shutdown...', ''],
        }
      }

      if (ctx.data.systemPower && parsed.seconds > 0) {
        ctx.data.systemPower.scheduleShutdown(parsed.seconds, 'os')
        const timeStr = formatCountdown(parsed.seconds)
        const output = ['', `[systemd] _unOS shutdown scheduled in ${timeStr}.`]
        if (parsed.wasAdjusted) output.push('[systemd] Warning: adjusted to minimum 10 seconds.')
        output.push('')
        return { success: true, output }
      }

      // Fallback: no system power context
      ctx.data.saveAllDeviceState?.()
      return {
        success: true,
        output: [
          '',
          '[systemd] Panel shutdown complete. Returning to terminal...',
          '',
        ],
        navigate: '/terminal',
        clearPanelAccess: true,
      }
    }

    return {
      success: false,
      error: `Unknown command: ${command}\nAvailable: reboot, shutdown, status, daemon-reload`,
    }
  },
}

const killCommand: Command = {
  name: 'kill',
  aliases: ['stop'],
  description: 'Shut down a subsystem module',
  usage: 'kill <module> <mode> [flags]',
  execute: async (args, ctx) => {
    const module = args[0]?.toLowerCase()
    const mode = args[1]?.toLowerCase()
    const flags = args.slice(2).join(' ')

    if (!module) {
      return {
        success: false,
        error: 'usage: kill <module> <mode> [flags]\navailable modules: panel',
      }
    }

    if (module === 'panel') {
      if (mode !== 'dev') {
        return {
          success: false,
          error: 'usage: kill panel dev -un\nmode "dev" required for panel shutdown.',
        }
      }

      if (!flags.toLowerCase().includes('-un')) {
        return {
          success: false,
          error: 'access denied. flag -un required.\nusage: kill panel dev -un',
        }
      }

      // Save device state before shutdown
      ctx.data.saveAllDeviceState?.()

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
        error: 'usage: run <module> <mode> [flags]\navailable modules: panel',
      }
    }

    if (module === 'panel') {
      if (mode !== 'dev') {
        return {
          success: false,
          error: 'usage: run panel dev -un\nmode "dev" required for panel access.',
        }
      }

      if (!flags.toLowerCase().includes('-un')) {
        return {
          success: false,
          error: 'access denied. flag -un required.\nusage: run panel dev -un',
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
      return { success: true, output: ['no command history found.', '', 'use up/down arrows to navigate recent commands.'] }
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
    output.push('use up/down arrows to navigate recent commands.')
    output.push('')

    return { success: true, output }
  },
}

const unhistoryCommand: Command = {
  name: 'unhistory',
  aliases: ['unhist'],
  description: 'Show command history (persists across reboots)',
  usage: 'unhistory [count] | unhistory -c',
  execute: async (args, ctx) => {
    if (args[0] === '-c') {
      try { localStorage.setItem('unlabs_cmd_history', '[]') } catch { /* ignore */ }
      return { success: true, output: ['  History cleared.'] }
    }

    const history = ctx.sessionHistory ?? []
    if (history.length === 0) {
      return { success: true, output: ['  No commands in history.'] }
    }

    const count = args[0] ? Math.min(parseInt(args[0]) || 200, history.length) : history.length
    // history is newest-first, reverse for display (oldest first, like Linux)
    const display = history.slice(0, count).reverse()

    const output = ['']
    display.forEach((cmd, i) => {
      output.push(`  ${String(i + 1).padStart(4)}  ${cmd}`)
    })
    output.push('')

    return { success: true, output }
  },
}

// Device control command
const deviceCommand: Command = {
  name: 'device',
  aliases: ['dev', 'devices', 'undev'],
  description: 'Control and monitor lab devices',
  usage: 'device [name] [command]',
  execute: async (args, ctx) => {
    const deviceName = args[0]?.toLowerCase()
    const action = args[1]?.toLowerCase()

    // List all devices
    if (!deviceName || deviceName === 'list') {
      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│                    DEVICE REGISTRY                          │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  ID        DEVICE                  VERSION   TIER  STATUS    ',
          '  ────────  ──────────────────────  ────────  ────  ──────────',
          '  P3D-001   3D Fabricator           v3.2.1    T2    ONLINE    ',
          '  ATK-001   Abstractum Tank         v2.1.0    T1    ONLINE    ',
          '  AIC-001   AI Assistant Core       v2.4.0    T3    ONLINE    ',
          '  AND-001   Anomaly Detector        v2.3.0    T2    ONLINE    ',
          '  BAT-001   Battery Pack            v1.8.0    T1    ONLINE    ',
          '  BTK-001   Basic Toolkit           v1.2.0    T1    ONLINE    ',
          '  CPU-001   CPU Monitor             v3.2.1    T1    ONLINE    ',
          '  CDC-001   Crystal Data Cache      v1.4.2    T1    ONLINE    ',
          '  DGN-001   Diagnostics Console     v2.0.4    T2    ONLINE    ',
          '  DIM-001   Dimension Monitor       v1.0.0    T2    ONLINE    ',
          '  ECR-001   Echo Recorder           v1.1.0    T1    ONLINE    ',
          '  EMC-001   Exotic Matter Contain.  v4.0.1    T3    ONLINE    ',
          '  EXD-001   Explorer Drone          v3.1.2    T2    ONLINE    ',
          '  HMS-001   Handmade Synthesizer    v3.2.1    T2    ONLINE    ',
          '  INT-001   Interpolator            v2.5.3    T2    ONLINE    ',
          '  CLK-001   Lab Clock               v2.4.0    T1    ONLINE    ',
          '  MSC-001   Material Scanner        v1.3.0    T1    ONLINE    ',
          '  MEM-001   Memory Monitor          v3.1.0    T1    ONLINE    ',
          '  MFR-001   Microfusion Reactor     v2.3.0    T3    ONLINE    ',
          '  SPK-001   Narrow Speaker          v1.0.0    T1    ONLINE    ',
          '  NET-001   Network Monitor         v2.1.0    T1    ONLINE    ',
          '  OSC-001   Oscilloscope Array      v4.6.0    T2    ONLINE    ',
          '  PWB-001   Portable Workbench      v1.1.0    T1    ONLINE    ',
          '  PWD-001   Power Display Panel     v1.0.0    T1    ONLINE    ',
          '  PWR-001   Power Management Sys.   v1.0.0    T1    ONLINE    ',
          '  LCT-001   Precision Laser         v2.1.0    T2    ONLINE    ',
          `  QAN-001   Quantum Analyzer        v3.7.2    T3    ${ctx.data.quaDevice?.getState().isPowered ? 'ONLINE' : 'STANDBY'}   `,
          '  QCP-001   Quantum Compass         v1.5.0    T2    ONLINE    ',
          '  QSM-001   Quantum State Monitor   v1.2.0    T3    ONLINE    ',
          '  RMG-001   Resource Magnet         v1.2.0    T1    ONLINE    ',
          '  SCA-001   Supercomputer Array     v5.2.0    T3    ONLINE    ',
          '  TLP-001   Teleport Pad            v2.2.0    T3    ONLINE    ',
          '  TMP-001   Temperature Monitor     v1.0.0    T1    ONLINE    ',
          '  THM-001   Thermal Manager         v1.0.0    T1    ONLINE    ',
          '  UEC-001   Unstable Energy Core    v2.0.1    T2    ONLINE    ',
          '  VNT-001   Ventilation System      v1.0.0    T1    ONLINE    ',
          '  VLT-001   Volt Meter Display      v1.0.0    T1    ONLINE    ',
          '',
          '  usage: device <name> [test|reset|status|info]',
          '  example: device cache test',
          '',
        ],
      }
    }

    // Manual page
    if (deviceName === 'unman' || deviceName === 'man') {
      return {
        success: true,
        output: [
          '',
          'UNDEV(1)              UnstableLabs Manual              UNDEV(1)',
          '',
          '═══════════════════════════════════════════════════════════════',
          '',
          'NAME',
          '    undev — control and monitor lab devices',
          '',
          'SYNOPSIS',
          '    undev [list]',
          '    undev <device-name> [info|test|reboot|status]',
          '    undev <device-name> power <on|off>',
          '    undev power <device-id> <on|off>',
          '    undev unman',
          '',
          'DESCRIPTION',
          '    The undev utility provides unified management of all',
          '    laboratory equipment installed in the UnstableLabs',
          '    research facility. It serves as the central device',
          '    registry, allowing operators to list, inspect, test,',
          '    reboot, and power-cycle any registered device.',
          '',
          '    Each device is identified by a unique device ID',
          '    (e.g. CDC-001) and can be referenced by its short',
          '    name (e.g. "cache", "core", "quantum").',
          '',
          '    In addition to this unified interface, most devices',
          '    have their own dedicated command (e.g. cdc, uec, bat)',
          '    that exposes device-specific functionality such as',
          '    firmware queries, fold/unfold, and real-time telemetry.',
          '',
          '───────────────────────────────────────────────────────────────',
          'DEVICE REGISTRY',
          '───────────────────────────────────────────────────────────────',
          '',
          '  ID        DEVICE                    TIER  CATEGORY',
          '  ────────  ────────────────────────  ────  ──────────',
          '',
          '  Power & Energy',
          '  UEC-001   Unstable Energy Core      T2    Generator',
          '  MFR-001   Microfusion Reactor        T3    Generator',
          '  BAT-001   Battery Pack               T1    Storage',
          '  PWR-001   Power Management System    T1    Control',
          '  PWD-001   Power Display Panel        T1    Monitor',
          '  VLT-001   Volt Meter Display         T1    Monitor',
          '',
          '  Compute & Memory',
          '  CPU-001   CPU Monitor                T1    Monitor',
          '  MEM-001   Memory Monitor             T1    Monitor',
          '  SCA-001   Supercomputer Array        T3    Compute',
          '  AIC-001   AI Assistant Core          T3    Compute',
          '',
          '  Quantum & Dimensional',
          '  QAN-001   Quantum Analyzer           T3    Analysis',
          '  QSM-001   Quantum State Monitor      T3    Monitor',
          '  QCP-001   Quantum Compass            T2    Navigation',
          '  DIM-001   Dimension Monitor          T2    Monitor',
          '  AND-001   Anomaly Detector           T2    Detection',
          '  TLP-001   Teleport Pad               T3    Transport',
          '',
          '  Data & Communications',
          '  CDC-001   Crystal Data Cache         T1    Storage',
          '  NET-001   Network Monitor            T1    Monitor',
          '  ECR-001   Echo Recorder              T1    Recording',
          '  INT-001   Interpolator               T2    Processing',
          '  OSC-001   Oscilloscope Array         T2    Analysis',
          '  SPK-001   Narrow Speaker             T1    Output',
          '',
          '  Thermal & Environmental',
          '  TMP-001   Temperature Monitor        T1    Monitor',
          '  THM-001   Thermal Manager            T1    Control',
          '  VNT-001   Ventilation System         T1    Cooling',
          '',
          '  Tools & Fabrication',
          '  BTK-001   Basic Toolkit              T1    Tools',
          '  PWB-001   Portable Workbench         T1    Crafting',
          '  MSC-001   Material Scanner           T1    Detection',
          '  LCT-001   Precision Laser            T2    Fabrication',
          '  P3D-001   3D Fabricator              T2    Fabrication',
          '  HMS-001   Handmade Synthesizer       T2    Synthesis',
          '',
          '  Exploration & Resources',
          '  EXD-001   Explorer Drone             T2    Exploration',
          '  RMG-001   Resource Magnet            T1    Collection',
          '  ATK-001   Abstractum Tank            T1    Storage',
          '  EMC-001   Exotic Matter Containment  T3    Containment',
          '',
          '  System',
          '  DGN-001   Diagnostics Console        T2    Diagnostics',
          '  CLK-001   Lab Clock                  T1    Utility',
          '',
          '───────────────────────────────────────────────────────────────',
          'COMMANDS',
          '───────────────────────────────────────────────────────────────',
          '',
          '    list',
          '        Show all registered devices with ID, version,',
          '        tier, and current status.',
          '',
          '    <device-name> info',
          '        Display detailed device information including',
          '        description, version, and compatible devices.',
          '        This is the default action if no command given.',
          '',
          '    <device-name> test',
          '        Run built-in diagnostic self-test. Checks memory',
          '        integrity, data bus, cache coherence, power, and',
          '        communication protocols.',
          '',
          '    <device-name> reboot',
          '        Power-cycle the device. Halts, flushes buffers,',
          '        runs POST, reinitializes subsystems, and syncs.',
          '        Also accepts "reset" as alias.',
          '',
          '    <device-name> status',
          '        Show runtime status: uptime, last test time,',
          '        error count, and online/standby state.',
          '',
          '    <device-name> power <on|off>',
          '        Control device power state by short name.',
          '        Example: undev cache power off',
          '',
          '    power <device-id> <on|off>',
          '        Control device power state by device ID.',
          '        Example: undev power CDC-001 on',
          '',
          '    unman',
          '        Display this manual page.',
          '',
          '───────────────────────────────────────────────────────────────',
          'DEVICE SHORT NAMES',
          '───────────────────────────────────────────────────────────────',
          '',
          '    Each device can be referenced by one or more short',
          '    names. Common mappings:',
          '',
          '    cache ............ CDC-001   Crystal Data Cache',
          '    core, energy ..... UEC-001   Unstable Energy Core',
          '    battery, pack .... BAT-001   Battery Pack',
          '    synth ............ HMS-001   Handmade Synthesizer',
          '    recorder ......... ECR-001   Echo Recorder',
          '    interpolator ..... INT-001   Interpolator',
          '    reactor .......... MFR-001   Microfusion Reactor',
          '    ai, assistant .... AIC-001   AI Assistant Core',
          '    super ............ SCA-001   Supercomputer Array',
          '    drone, explorer .. EXD-001   Explorer Drone',
          '    exotic ........... EMC-001   Exotic Matter Contain.',
          '    vent ............. VNT-001   Ventilation System',
          '    quantum, analyzer  QAN-001   Quantum Analyzer',
          '    qsm, state ....... QSM-001   Quantum State Monitor',
          '    compass .......... QCP-001   Quantum Compass',
          '    anomaly, detector  AND-001   Anomaly Detector',
          '    dim, dimension ... DIM-001   Dimension Monitor',
          '    teleport, pad .... TLP-001   Teleport Pad',
          '    laser, cutter .... LCT-001   Precision Laser',
          '    printer, 3d ...... P3D-001   3D Fabricator',
          '    toolkit, btk ..... BTK-001   Basic Toolkit',
          '    workbench, pwb ... PWB-001   Portable Workbench',
          '    scanner, msc ..... MSC-001   Material Scanner',
          '    magnet ........... RMG-001   Resource Magnet',
          '    tank ............. ATK-001   Abstractum Tank',
          '    network, net ..... NET-001   Network Monitor',
          '    temp, thermal .... TMP-001   Temperature Monitor',
          '    cpu, processor ... CPU-001   CPU Monitor',
          '    clock, time ...... CLK-001   Lab Clock',
          '    mem, memory ...... MEM-001   Memory Monitor',
          '    speaker .......... SPK-001   Narrow Speaker',
          '    scope ............ OSC-001   Oscilloscope Array',
          '    diag ............. DGN-001   Diagnostics Console',
          '    power, pwr ....... PWR-001   Power Management Sys.',
          '    volt, vlt ........ VLT-001   Volt Meter Display',
          '    powerdisplay ..... PWD-001   Power Display Panel',
          '    thmgr, cooling ... THM-001   Thermal Manager',
          '',
          '───────────────────────────────────────────────────────────────',
          'DEVICE-SPECIFIC COMMANDS',
          '───────────────────────────────────────────────────────────────',
          '',
          '    Most devices have a dedicated terminal command that',
          '    exposes advanced functionality beyond what undev',
          '    provides. These commands share a common pattern:',
          '',
          '    <cmd> status     Show device state and telemetry',
          '    <cmd> firmware   Show firmware and hardware info',
          '    <cmd> info       Detailed specs and diagnostics',
          '    <cmd> test       Run diagnostic self-test',
          '    <cmd> reboot     Restart the device',
          '    <cmd> power      Control power on/off',
          '    <cmd> fold       Collapse to compact view',
          '    <cmd> unfold     Expand to full view',
          '    <cmd> toggle     Toggle fold state',
          '',
          '    Available device commands:',
          '',
          '    cdc .... Crystal Data Cache management',
          '    uec .... Unstable Energy Core management',
          '    bat .... Battery Pack management',
          '    hms .... Handmade Synthesizer management',
          '    ecr .... Echo Recorder management',
          '    ipl .... Interpolator management',
          '    mfr .... Microfusion Reactor management',
          '    aic .... AI Assistant Core management',
          '    sca .... Supercomputer Array management',
          '    exd .... Explorer Drone management',
          '    emc .... Exotic Matter Containment management',
          '    vnt .... Ventilation System management',
          '    qua .... Quantum Analyzer management',
          '    qsm .... Quantum State Monitor management',
          '    btk .... Basic Toolkit management',
          '    pwb .... Portable Workbench management',
          '    rmg .... Resource Magnet management',
          '    msc .... Material Scanner management',
          '    net .... Network Monitor management',
          '    tmp .... Temperature Monitor management',
          '    dim .... Dimension Monitor management',
          '    cpu .... CPU Monitor management',
          '    clk .... Lab Clock management',
          '    mem .... Memory Monitor management',
          '    and .... Anomaly Detector management',
          '    qcp .... Quantum Compass management',
          '    tlp .... Teleport Pad management',
          '    lct .... Precision Laser management',
          '    p3d .... 3D Fabricator management',
          '',
          '    Type <cmd> help for command-specific options.',
          '',
          '───────────────────────────────────────────────────────────────',
          'POWER MANAGEMENT',
          '───────────────────────────────────────────────────────────────',
          '',
          '    Devices can be powered on/off through two methods:',
          '',
          '    1. Via undev:',
          '       undev <name> power <on|off>',
          '       undev power <ID> <on|off>',
          '',
          '    2. Via device command:',
          '       <cmd> power <on|off>',
          '',
          '    3. Via power command:',
          '       power on <ID>    power off <ID>',
          '       power devices    (list power states)',
          '       power grid       (grid overview)',
          '       power emergency  (emergency shutdown)',
          '',
          '    Power state persists across page reloads.',
          '    Powered-off devices auto-fold to compact view.',
          '    Powering on auto-unfolds to full view.',
          '',
          '───────────────────────────────────────────────────────────────',
          'DEVICE TIERS',
          '───────────────────────────────────────────────────────────────',
          '',
          '    T1 — Basic',
          '        Monitoring, utility, and storage devices.',
          '        Low power draw, always-on operation.',
          '        Examples: CDC, BAT, BTK, NET, TMP, CLK, MEM',
          '',
          '    T2 — Advanced',
          '        Analysis, processing, and fabrication.',
          '        Moderate power, specialized functions.',
          '        Examples: QCP, AND, DIM, LCT, P3D, HMS, INT',
          '',
          '    T3 — Quantum/Exotic',
          '        High-energy quantum and exotic systems.',
          '        Heavy power draw, critical operations.',
          '        Examples: QAN, QSM, TLP, EMC, MFR, SCA, AIC',
          '',
          '───────────────────────────────────────────────────────────────',
          'FOLD SYSTEM',
          '───────────────────────────────────────────────────────────────',
          '',
          '    All devices support physical fold/unfold animation.',
          '    Folded state shows a compact single-line display:',
          '',
          '    ┌──────────────────────────────────────────────┐',
          '    │ ● CDC-001  ONLINE      [T] [R] [⏻] [▼] │',
          '    └──────────────────────────────────────────────┘',
          '',
          '    Controls: T=test, R=reboot, ⏻=power, ▼=info/▲=fold',
          '',
          '    Unfolded state shows full device telemetry and',
          '    controls. Fold state persists in localStorage.',
          '',
          '    Commands: <cmd> fold | unfold | toggle',
          '',
          '───────────────────────────────────────────────────────────────',
          'ALIASES',
          '───────────────────────────────────────────────────────────────',
          '',
          '    The following aliases all invoke the device command:',
          '',
          '    dev, devices, undev → device',
          '',
          '───────────────────────────────────────────────────────────────',
          'EXAMPLES',
          '───────────────────────────────────────────────────────────────',
          '',
          '    List all devices:',
          '        $ undev list',
          '',
          '    Get info on a device:',
          '        $ undev cache info',
          '        $ undev quantum',
          '',
          '    Run diagnostics:',
          '        $ undev cache test',
          '        $ cdc test',
          '',
          '    Reboot a device:',
          '        $ undev reactor reboot',
          '',
          '    Power control:',
          '        $ undev power CDC-001 on',
          '        $ undev cache power off',
          '        $ cdc power on',
          '',
          '    Fold control:',
          '        $ cdc fold',
          '        $ uec unfold',
          '        $ bat toggle',
          '',
          '    Device-specific:',
          '        $ cdc status',
          '        $ uec firmware',
          '        $ qsm info',
          '',
          '───────────────────────────────────────────────────────────────',
          'SEE ALSO',
          '───────────────────────────────────────────────────────────────',
          '',
          '    power(1), thermal(1), help(1)',
          '    cat /home/operator/.local/docs/<device>.txt',
          '',
          '───────────────────────────────────────────────────────────────',
          'AUTHORS',
          '───────────────────────────────────────────────────────────────',
          '',
          '    UnstableLabs Engineering Division',
          '    Quantum Systems Research Group',
          '',
          '═══════════════════════════════════════════════════════════════',
          'UNSTABLELABS                   v1.0.0                UNDEV(1)',
          '',
        ],
      }
    }

    // Handle "device power <id> <on|off>" syntax
    if (deviceName === 'power' && action) {
      const powerId = action.toUpperCase()
      const powerAction = args[2]?.toLowerCase()

      if (!powerAction || (powerAction !== 'on' && powerAction !== 'off')) {
        return { success: false, error: 'usage: device power <device-id> <on|off>\nexample: device power UEC-001 on' }
      }

      // Build a temporary device lookup to find the name
      const idToName: Record<string, string> = {
        'CDC-001': 'Crystal Data Cache', 'UEC-001': 'Unstable Energy Core',
        'BAT-001': 'Battery Pack', 'HMS-001': 'Handmade Synthesizer',
        'ECR-001': 'Echo Recorder', 'INT-001': 'Interpolator',
        'MFR-001': 'Microfusion Reactor', 'AIC-001': 'AI Assistant Core',
        'SCA-001': 'Supercomputer Array', 'EXD-001': 'Explorer Drone',
        'EMC-001': 'Exotic Matter Contain.', 'VNT-001': 'Ventilation System',
        'QAN-001': 'Quantum Analyzer', 'QSM-001': 'Quantum State Monitor',
        'PWB-001': 'Portable Workbench',
        'BTK-001': 'Basic Toolkit',
        'RMG-001': 'Resource Magnet',
        'MSC-001': 'Material Scanner',
        'NET-001': 'Network Monitor',
        'TMP-001': 'Temperature Monitor',
        'DIM-001': 'Dimension Monitor',
        'CPU-001': 'CPU Monitor',
        'CLK-001': 'Lab Clock',
        'MEM-001': 'Memory Monitor',
        'AND-001': 'Anomaly Detector',
        'QCP-001': 'Quantum Compass',
        'TLP-001': 'Teleport Pad',
        'LCT-001': 'Precision Laser',
        'P3D-001': '3D Fabricator',
      }

      const devicePowerCtrl: Record<string, { on: () => Promise<void>; off: () => Promise<void>; isPowered: () => boolean } | undefined> = {
        'CDC-001': ctx.data.cdcDevice ? { on: () => ctx.data.cdcDevice!.powerOn(), off: () => ctx.data.cdcDevice!.powerOff(), isPowered: () => ctx.data.cdcDevice!.getState().isPowered } : undefined,
        'UEC-001': ctx.data.uecDevice ? { on: () => ctx.data.uecDevice!.powerOn(), off: () => ctx.data.uecDevice!.powerOff(), isPowered: () => ctx.data.uecDevice!.getState().isPowered } : undefined,
        'BAT-001': ctx.data.batDevice ? { on: () => ctx.data.batDevice!.powerOn(), off: () => ctx.data.batDevice!.powerOff(), isPowered: () => ctx.data.batDevice!.getState().isPowered } : undefined,
        'HMS-001': ctx.data.hmsDevice ? { on: () => ctx.data.hmsDevice!.powerOn(), off: () => ctx.data.hmsDevice!.powerOff(), isPowered: () => ctx.data.hmsDevice!.getState().isPowered } : undefined,
        'ECR-001': ctx.data.ecrDevice ? { on: () => ctx.data.ecrDevice!.powerOn(), off: () => ctx.data.ecrDevice!.powerOff(), isPowered: () => ctx.data.ecrDevice!.getState().isPowered } : undefined,
        'INT-001': ctx.data.iplDevice ? { on: () => ctx.data.iplDevice!.powerOn(), off: () => ctx.data.iplDevice!.powerOff(), isPowered: () => ctx.data.iplDevice!.getState().isPowered } : undefined,
        'MFR-001': ctx.data.mfrDevice ? { on: () => ctx.data.mfrDevice!.powerOn(), off: () => ctx.data.mfrDevice!.powerOff(), isPowered: () => ctx.data.mfrDevice!.getState().isPowered } : undefined,
        'AIC-001': ctx.data.aicDevice ? { on: () => ctx.data.aicDevice!.powerOn(), off: () => ctx.data.aicDevice!.powerOff(), isPowered: () => ctx.data.aicDevice!.getState().isPowered } : undefined,
        'SCA-001': ctx.data.scaDevice ? { on: () => ctx.data.scaDevice!.powerOn(), off: () => ctx.data.scaDevice!.powerOff(), isPowered: () => ctx.data.scaDevice!.getState().isPowered } : undefined,
        'EXD-001': ctx.data.exdDevice ? { on: () => ctx.data.exdDevice!.powerOn(), off: () => ctx.data.exdDevice!.powerOff(), isPowered: () => ctx.data.exdDevice!.getState().isPowered } : undefined,
        'EMC-001': ctx.data.emcDevice ? { on: () => ctx.data.emcDevice!.powerOn(), off: () => ctx.data.emcDevice!.powerOff(), isPowered: () => ctx.data.emcDevice!.getState().isPowered } : undefined,
        'VNT-001': ctx.data.vntDevice ? { on: () => ctx.data.vntDevice!.powerOn(), off: () => ctx.data.vntDevice!.powerOff(), isPowered: () => ctx.data.vntDevice!.getState().isPowered } : undefined,
        'QAN-001': ctx.data.quaDevice ? { on: () => ctx.data.quaDevice!.powerOn(), off: () => ctx.data.quaDevice!.powerOff(), isPowered: () => ctx.data.quaDevice!.getState().isPowered } : undefined,
        'QSM-001': ctx.data.qsmDevice ? { on: () => ctx.data.qsmDevice!.powerOn(), off: () => ctx.data.qsmDevice!.powerOff(), isPowered: () => ctx.data.qsmDevice!.getState().isPowered } : undefined,
        'PWB-001': ctx.data.pwbDevice ? { on: () => ctx.data.pwbDevice!.powerOn(), off: () => ctx.data.pwbDevice!.powerOff(), isPowered: () => ctx.data.pwbDevice!.getState().isPowered } : undefined,
        'BTK-001': ctx.data.btkDevice ? { on: () => ctx.data.btkDevice!.powerOn(), off: () => ctx.data.btkDevice!.powerOff(), isPowered: () => ctx.data.btkDevice!.getState().isPowered } : undefined,
        'RMG-001': ctx.data.rmgDevice ? { on: () => ctx.data.rmgDevice!.powerOn(), off: () => ctx.data.rmgDevice!.powerOff(), isPowered: () => ctx.data.rmgDevice!.getState().isPowered } : undefined,
        'MSC-001': ctx.data.mscDevice ? { on: () => ctx.data.mscDevice!.powerOn(), off: () => ctx.data.mscDevice!.powerOff(), isPowered: () => ctx.data.mscDevice!.getState().isPowered } : undefined,
        'NET-001': ctx.data.netDevice ? { on: () => ctx.data.netDevice!.powerOn(), off: () => ctx.data.netDevice!.powerOff(), isPowered: () => ctx.data.netDevice!.getState().isPowered } : undefined,
        'TMP-001': ctx.data.tmpDevice ? { on: () => ctx.data.tmpDevice!.powerOn(), off: () => ctx.data.tmpDevice!.powerOff(), isPowered: () => ctx.data.tmpDevice!.getState().isPowered } : undefined,
        'DIM-001': ctx.data.dimDevice ? { on: () => ctx.data.dimDevice!.powerOn(), off: () => ctx.data.dimDevice!.powerOff(), isPowered: () => ctx.data.dimDevice!.getState().isPowered } : undefined,
        'CPU-001': ctx.data.cpuDevice ? { on: () => ctx.data.cpuDevice!.powerOn(), off: () => ctx.data.cpuDevice!.powerOff(), isPowered: () => ctx.data.cpuDevice!.getState().isPowered } : undefined,
        'CLK-001': ctx.data.clkDevice ? { on: () => ctx.data.clkDevice!.powerOn(), off: () => ctx.data.clkDevice!.powerOff(), isPowered: () => ctx.data.clkDevice!.getState().isPowered } : undefined,
        'MEM-001': ctx.data.memDevice ? { on: () => ctx.data.memDevice!.powerOn(), off: () => ctx.data.memDevice!.powerOff(), isPowered: () => ctx.data.memDevice!.getState().isPowered } : undefined,
        'AND-001': ctx.data.andDevice ? { on: () => ctx.data.andDevice!.powerOn(), off: () => ctx.data.andDevice!.powerOff(), isPowered: () => ctx.data.andDevice!.getState().isPowered } : undefined,
        'QCP-001': ctx.data.qcpDevice ? { on: () => ctx.data.qcpDevice!.powerOn(), off: () => ctx.data.qcpDevice!.powerOff(), isPowered: () => ctx.data.qcpDevice!.getState().isPowered } : undefined,
        'TLP-001': ctx.data.tlpDevice ? { on: () => ctx.data.tlpDevice!.powerOn(), off: () => ctx.data.tlpDevice!.powerOff(), isPowered: () => ctx.data.tlpDevice!.getState().isPowered } : undefined,
        'LCT-001': ctx.data.lctDevice ? { on: () => ctx.data.lctDevice!.powerOn(), off: () => ctx.data.lctDevice!.powerOff(), isPowered: () => ctx.data.lctDevice!.getState().isPowered } : undefined,
        'P3D-001': ctx.data.p3dDevice ? { on: () => ctx.data.p3dDevice!.powerOn(), off: () => ctx.data.p3dDevice!.powerOff(), isPowered: () => ctx.data.p3dDevice!.getState().isPowered } : undefined,
      }

      const dName = idToName[powerId]
      if (!dName) {
        return { success: false, error: `device not found: ${powerId}\nuse device list to see available devices.` }
      }

      const ctrl = devicePowerCtrl[powerId]
      if (!ctrl) {
        return { success: true, output: ['', `[device] ${powerId} power control not available (no manager connected)`, ''] }
      }

      if (powerAction === 'on') {
        if (ctrl.isPowered()) return { success: true, output: ['', `[device] ${powerId} is already powered ON`, ''] }
        await ctrl.on()
        ctx.data.saveAllDeviceState?.()
        return { success: true, output: ['', `[device] ${dName} (${powerId}) powered ON`, ''] }
      } else {
        if (!ctrl.isPowered()) return { success: true, output: ['', `[device] ${powerId} is already powered OFF`, ''] }
        await ctrl.off()
        ctx.data.saveAllDeviceState?.()
        return { success: true, output: ['', `[device] ${dName} (${powerId}) powered OFF`, ''] }
      }
    }

    // Global status overview
    if (deviceName === 'status') {
      const statuses = ['ONLINE', 'ONLINE', 'STANDBY', 'ONLINE', 'OFFLINE', 'ONLINE']
      const devices = [
        { id: 'UEC-001', name: 'Unstable Energy Core', cat: 'GEN' },
        { id: 'CDC-001', name: 'Crystal Data Cache', cat: 'MED' },
        { id: 'BAT-001', name: 'Portable Battery Pack', cat: 'STO' },
        { id: 'MFR-001', name: 'Microfusion Reactor', cat: 'GEN' },
        { id: 'HMS-001', name: 'Handmade Synthesizer', cat: 'MED' },
        { id: 'QAN-001', name: 'Quantum Analyzer', cat: 'MED' },
      ]

      // Check context for actual device power states
      const getStatus = (id: string) => {
        const ctxMap: Record<string, (() => boolean) | undefined> = {
          'CDC-001': ctx.data.cdcDevice ? () => ctx.data.cdcDevice!.getState().isPowered : undefined,
          'UEC-001': ctx.data.uecDevice ? () => ctx.data.uecDevice!.getState().isPowered : undefined,
        }
        const check = ctxMap[id]
        if (check) return check() ? 'ONLINE' : 'OFFLINE'
        return statuses[Math.floor(Math.random() * statuses.length)]
      }

      const lines: string[] = [
        '',
        `┌─ Device Status Overview ${'─'.repeat(20)}`,
        '│',
        '│  ID        NAME                     CAT   STATE',
        '│  ─────────────────────────────────────────────────',
      ]

      for (const d of devices) {
        const st = getStatus(d.id)
        const stColor = st === 'ONLINE' ? '●' : st === 'STANDBY' ? '○' : '·'
        lines.push(`│  ${d.id}   ${d.name.padEnd(25)}${d.cat}   ${stColor} ${st}`)
      }

      lines.push(
        '│',
        '│  Use DEVICE <name> STATUS for individual device details.',
        `└${'─'.repeat(40)}`,
        '',
      )

      return { success: true, output: lines }
    }

    // Device-specific commands
    const deviceMap: Record<string, { name: string; id: string; version: string; desc: string; compatible: string[] }> = {
      'cache': {
        name: 'Crystal Data Cache',
        id: 'CDC-001',
        version: '1.4.2',
        desc: 'Crystalline data storage for research archives (Tech Tier 1).\nIndexes crystal (_unITM) and slice (_unSLC) data from blockchain.\nFeatures: crystal-index, slice-tracking, power-calc, auto-sync.\n\nPower: Full 15 E/s | Idle 5 E/s | Standby 1 E/s\nPriority: P1 (Critical) | Category: Medium\n\nUse CDC command for management: cdc status | cdc firmware | cdc info',
        compatible: ['UEC-001', 'BAT-001', 'HMS-001', 'AIC-001', 'SCA-001'],
      },
      'core': {
        name: 'Unstable Energy Core',
        id: 'UEC-001',
        version: '2.0.1',
        desc: 'Primary power generation via blockchain volatility monitoring.\nConverts TPS data to energy output for all lab equipment.\nFeatures: volatility-tracking, tps-monitor, tier-calc, network-sync, field-stabilizer.\n\nOutput: Max 500 E/s | Per Tier 100 E/s | Self 10 E/s | Standby 2 E/s\nPriority: P0 (Generator) | Category: Generator\n\nUse UEC command for management: uec status | uec firmware | uec info',
        compatible: ['CDC-001', 'BAT-001', 'QAN-001', 'HMS-001', 'MFR-001'],
      },
      'energy': {
        name: 'Unstable Energy Core',
        id: 'UEC-001',
        version: '2.0.1',
        desc: 'Primary power generation via blockchain volatility monitoring.\nConverts TPS data to energy output for all lab equipment.\nFeatures: volatility-tracking, tps-monitor, tier-calc, network-sync, field-stabilizer.\n\nOutput: Max 500 E/s | Per Tier 100 E/s | Self 10 E/s | Standby 2 E/s\nPriority: P0 (Generator) | Category: Generator\n\nUse UEC command for management: uec status | uec firmware | uec info',
        compatible: ['CDC-001', 'BAT-001', 'QAN-001', 'HMS-001', 'MFR-001'],
      },
      'energycore': {
        name: 'Unstable Energy Core',
        id: 'UEC-001',
        version: '2.0.1',
        desc: 'Primary power generation via blockchain volatility monitoring.\nConverts TPS data to energy output for all lab equipment.\nFeatures: volatility-tracking, tps-monitor, tier-calc, network-sync, field-stabilizer.\n\nOutput: Max 500 E/s | Per Tier 100 E/s | Self 10 E/s | Standby 2 E/s\nPriority: P0 (Generator) | Category: Generator\n\nUse UEC command for management: uec status | uec firmware | uec info',
        compatible: ['CDC-001', 'BAT-001', 'QAN-001', 'HMS-001', 'MFR-001'],
      },
      'battery': {
        name: 'Portable Battery Pack',
        id: 'BAT-001',
        version: '1.8.0',
        desc: 'Energy storage device with 4-cell array and auto-regeneration.\nStores excess power and releases during high-demand periods.\nFeatures: cell-monitor, auto-regen, capacity-track, thermal-protect, cdc-handshake.\n\nCapacity: 5,000 E | Charge 100 E/s | Discharge 150 E/s (burst)\nPriority: P2 (Storage) | Category: Storage\n\nUse BAT command for management: bat status | bat firmware | bat info',
        compatible: ['UEC-001', 'CDC-001', 'EXD-001'],
      },
      'pack': {
        name: 'Portable Battery Pack',
        id: 'BAT-001',
        version: '1.8.0',
        desc: 'Energy storage device with 4-cell array and auto-regeneration.\nStores excess power and releases during high-demand periods.\nFeatures: cell-monitor, auto-regen, capacity-track, thermal-protect, cdc-handshake.\n\nCapacity: 5,000 E | Charge 100 E/s | Discharge 150 E/s (burst)\nPriority: P2 (Storage) | Category: Storage\n\nUse BAT command for management: bat status | bat firmware | bat info',
        compatible: ['UEC-001', 'CDC-001', 'EXD-001'],
      },
      'synth': {
        name: 'Handmade Synthesizer',
        id: 'HMS-001',
        version: '3.2.1',
        desc: 'Enables slice synthesis and trait manipulation.\nProgress linked to Synthesizers tech tree.',
        compatible: ['CDC-001', 'INT-001'],
      },
      'recorder': {
        name: 'Echo Recorder',
        id: 'ECR-001',
        version: '1.1.0',
        desc: 'Records and replays trait patterns for analysis.\nProgress linked to Adapters tech tree.',
        compatible: ['HMS-001', 'OSC-001'],
      },
      'interpolator': {
        name: 'Interpolator',
        id: 'INT-001',
        version: '2.5.3',
        desc: 'Interpolates trait values for precision targeting.\nProgress linked to Optics tech tree.',
        compatible: ['HMS-001', 'OSC-001'],
      },
      'reactor': {
        name: 'Microfusion Reactor',
        id: 'MFR-001',
        version: '2.3.0',
        desc: 'Tier 2 power generation via plasma microfusion.\nProvides stable MW output for lab operations.',
        compatible: ['UEC-001', 'BAT-001', 'QAN-001'],
      },
      'ai': {
        name: 'AI Assistant Core',
        id: 'AIC-001',
        version: '2.4.0',
        desc: 'Semi-sentient AI for lab automation and optimization.\nAutomates tasks, learns patterns, boosts production efficiency.',
        compatible: ['MFR-001', 'CDC-001', 'QAN-001', 'DGN-001'],
      },
      'assistant': {
        name: 'AI Assistant Core',
        id: 'AIC-001',
        version: '2.4.0',
        desc: 'Semi-sentient AI for lab automation and optimization.\nAutomates tasks, learns patterns, boosts production efficiency.',
        compatible: ['MFR-001', 'CDC-001', 'QAN-001', 'DGN-001'],
      },
      'super': {
        name: 'Supercomputer Array',
        id: 'SCA-001',
        version: '5.2.0',
        desc: 'High-performance computing cluster for heavy calculations.\n16-node array accelerates research and runs complex simulations.',
        compatible: ['AIC-001', 'CDC-001', 'QAN-001', 'MFR-001'],
      },
      'supercomputer': {
        name: 'Supercomputer Array',
        id: 'SCA-001',
        version: '5.2.0',
        desc: 'High-performance computing cluster for heavy calculations.\n16-node array accelerates research and runs complex simulations.',
        compatible: ['AIC-001', 'CDC-001', 'QAN-001', 'MFR-001'],
      },
      'drone': {
        name: 'Explorer Drone',
        id: 'EXD-001',
        version: '3.1.2',
        desc: 'Remote-controlled drone for field exploration and resource collection.\nExpands gathering radius and enables autonomous harvesting.',
        compatible: ['AIC-001', 'QAN-001', 'CDC-001'],
      },
      'explorer': {
        name: 'Explorer Drone',
        id: 'EXD-001',
        version: '3.1.2',
        desc: 'Remote-controlled drone for field exploration and resource collection.\nExpands gathering radius and enables autonomous harvesting.',
        compatible: ['AIC-001', 'QAN-001', 'CDC-001'],
      },
      'magnet': {
        name: 'Resource Magnet',
        id: 'RMG-001',
        version: '1.2.0',
        desc: 'Handheld device that passively pulls in stray Abstractum fragments.\nBoosts idle resource gain with adjustable field strength.',
        compatible: ['BAT-001', 'QAN-001', 'UEC-001'],
      },
      'tank': {
        name: 'Abstractum Tank',
        id: 'ATK-001',
        version: '2.1.0',
        desc: 'Primary storage vessel for raw Abstractum resource.\nMonitors fill level, purity percentage, and flow state.',
        compatible: ['RMG-001', 'CDC-001', 'UEC-001', 'MFR-001'],
      },
      'exotic': {
        name: 'Exotic Matter Containment',
        id: 'EMC-001',
        version: '4.0.1',
        desc: 'Containment field for exotic matter particles.\nMonitors unit count and stability percentage.',
        compatible: ['MFR-001', 'QAN-001', 'DGN-001'],
      },
      'containment': {
        name: 'Exotic Matter Containment',
        id: 'EMC-001',
        version: '4.0.1',
        desc: 'Containment field for exotic matter particles.\nMonitors unit count and stability percentage.',
        compatible: ['MFR-001', 'QAN-001', 'DGN-001'],
      },
      'vent': {
        name: 'Ventilation System',
        id: 'VNT-001',
        version: '1.0.0',
        desc: 'Dual-fan cooling system for CPU and GPU.\nAuto-adjusts speed based on system load.',
        compatible: ['DGN-001'],
      },
      'speaker': {
        name: 'Narrow Speaker',
        id: 'SPK-001',
        version: '1.0.0',
        desc: 'Audio output with volume and filter controls.\nB/M/H frequency band filtering.',
        compatible: ['OSC-001'],
      },
      'scope': {
        name: 'Oscilloscope Array',
        id: 'OSC-001',
        version: '4.6.0',
        desc: 'Dual-channel waveform display (OZSC-460).\nVisualizes wallet balance and network frequencies.',
        compatible: ['QAN-001', 'ECR-001', 'INT-001'],
      },
      'quantum': {
        name: 'Quantum Analyzer',
        id: 'QAN-001',
        version: '3.7.2',
        desc: 'Universal Problem Solver with 6 analysis modes.\nANOMALY, RESOURCE, DECRYPT, DIAGNOSE, SIMULATE, SCAN.',
        compatible: ['OSC-001', 'UEC-001', 'QSM-001', 'DIM-001'],
      },
      'analyzer': {
        name: 'Quantum Analyzer',
        id: 'QAN-001',
        version: '3.7.2',
        desc: 'Universal Problem Solver with 6 analysis modes.\nANOMALY, RESOURCE, DECRYPT, DIAGNOSE, SIMULATE, SCAN.',
        compatible: ['OSC-001', 'UEC-001', 'QSM-001', 'DIM-001'],
      },
      'qsm': {
        name: 'Quantum State Monitor',
        id: 'QSM-001',
        version: '1.2.0',
        desc: '127-qubit quantum coherence monitor with real-time wave function display.\nTracks entanglement state, coherence, error rates, and cryogenic temperature.\nFeatures: qubit-array, coherence-tracking, entanglement-verify, error-correction, wave-function.\n\nPower: Full 12 E/s | Idle 7 E/s | Standby 1 E/s | Scan 18 E/s\nPriority: P2 (Standard) | Category: Medium\n\nUse QSM command for management: qsm status | qsm firmware | qsm info',
        compatible: ['QAN-001', 'SCA-001', 'AIC-001'],
      },
      'state': {
        name: 'Quantum State Monitor',
        id: 'QSM-001',
        version: '1.2.0',
        desc: '127-qubit quantum coherence monitor with real-time wave function display.\nTracks entanglement state, coherence, error rates, and cryogenic temperature.\n\nUse QSM command for management: qsm status | qsm firmware | qsm info',
        compatible: ['QAN-001', 'SCA-001', 'AIC-001'],
      },
      'network': {
        name: 'Network Monitor',
        id: 'NET-001',
        version: '2.1.0',
        desc: 'Monitors network throughput and connectivity.\nReal-time bandwidth visualization with latency tracking.\n\nUse NET command for management: net status | net firmware | net test',
        compatible: ['SCA-001', 'AIC-001', 'QSM-001', 'DGN-001'],
      },
      'net': {
        name: 'Network Monitor',
        id: 'NET-001',
        version: '2.1.0',
        desc: 'Monitors network throughput and connectivity.\nReal-time bandwidth visualization with latency tracking.\n\nUse NET command for management: net status | net firmware | net test',
        compatible: ['SCA-001', 'AIC-001', 'QSM-001', 'DGN-001'],
      },
      'temp': {
        name: 'Temperature Monitor',
        id: 'TMP-001',
        version: '1.0.0',
        desc: 'Thermal monitoring system for lab equipment.\nTracks CPU/GPU and ambient temperatures with alerts.\n\nUse TMP command for management: tmp status | tmp firmware | tmp test',
        compatible: ['VNT-001', 'MFR-001', 'SCA-001', 'DGN-001'],
      },
      'thermal': {
        name: 'Temperature Monitor',
        id: 'TMP-001',
        version: '1.0.0',
        desc: 'Thermal monitoring system for lab equipment.\nTracks CPU/GPU and ambient temperatures with alerts.\n\nUse TMP command for management: tmp status | tmp firmware | tmp test',
        compatible: ['VNT-001', 'MFR-001', 'SCA-001', 'DGN-001'],
      },
      'dim': {
        name: 'Dimension Monitor',
        id: 'DIM-001',
        version: '1.0.0',
        desc: 'Monitors dimensional stability and rift activity.\nTracks D-space coordinates and Halo Plane proximity.\nUse DIM command for device management.',
        compatible: ['QSM-001', 'EMC-001', 'QAN-001'],
      },
      'dimension': {
        name: 'Dimension Monitor',
        id: 'DIM-001',
        version: '1.0.0',
        desc: 'Monitors dimensional stability and rift activity.\nTracks D-space coordinates and Halo Plane proximity.\nUse DIM command for device management.',
        compatible: ['QSM-001', 'EMC-001', 'QAN-001'],
      },
      'cpu': {
        name: 'CPU Monitor',
        id: 'CPU-001',
        version: '3.2.1',
        desc: 'Multi-core processor utilization monitor.\nTracks core loads, frequency scaling, and thermal limits.\nUse CPU command for device management.',
        compatible: ['TMP-001', 'VNT-001', 'SCA-001', 'MFR-001'],
      },
      'processor': {
        name: 'CPU Monitor',
        id: 'CPU-001',
        version: '3.2.1',
        desc: 'Multi-core processor utilization monitor.\nTracks core loads, frequency scaling, and thermal limits.\nUse CPU command for device management.',
        compatible: ['TMP-001', 'VNT-001', 'SCA-001', 'MFR-001'],
      },
      'clock': {
        name: 'Lab Clock',
        id: 'CLK-001',
        version: '2.4.0',
        desc: 'Multi-mode time display system with 6 modes.\nLOCAL, UTC, DATE, UPTIME, COUNTDOWN, STOPWATCH.\nUse CLK command for device management.',
        compatible: ['DGN-001', 'SCA-001', 'ALL'],
      },
      'time': {
        name: 'Lab Clock',
        id: 'CLK-001',
        version: '2.4.0',
        desc: 'Multi-mode time display system with 6 modes.\nLOCAL, UTC, DATE, UPTIME, COUNTDOWN, STOPWATCH.\nUse CLK command for device management.',
        compatible: ['DGN-001', 'SCA-001', 'ALL'],
      },
      'mem': {
        name: 'Memory Monitor',
        id: 'MEM-001',
        version: '3.1.0',
        desc: 'Multi-mode RAM/memory display with 6 modes.\nUSAGE, HEAP, CACHE, SWAP, PROCESSES, ALLOCATION.\nUse MEM command for device management.',
        compatible: ['CPU-001', 'SCA-001', 'DGN-001'],
      },
      'memory': {
        name: 'Memory Monitor',
        id: 'MEM-001',
        version: '3.1.0',
        desc: 'Multi-mode RAM/memory display with 6 modes.\nUSAGE, HEAP, CACHE, SWAP, PROCESSES, ALLOCATION.\nUse MEM command for device management.',
        compatible: ['CPU-001', 'SCA-001', 'DGN-001'],
      },
      'ram': {
        name: 'Memory Monitor',
        id: 'MEM-001',
        version: '3.1.0',
        desc: 'Multi-mode RAM/memory display with 6 modes.\nUSAGE, HEAP, CACHE, SWAP, PROCESSES, ALLOCATION.\nUse MEM command for device management.',
        compatible: ['CPU-001', 'SCA-001', 'DGN-001'],
      },
      'anomaly': {
        name: 'Anomaly Detector',
        id: 'AND-001',
        version: '2.3.0',
        desc: 'Halo Plane anomaly scanner and signal analyzer.\nDetects dimensional rifts and quantum anomalies.\nUse AND command for device management.',
        compatible: ['QSM-001', 'DIM-001', 'EMC-001', 'QAN-001'],
      },
      'detector': {
        name: 'Anomaly Detector',
        id: 'AND-001',
        version: '2.3.0',
        desc: 'Halo Plane anomaly scanner and signal analyzer.\nDetects dimensional rifts and quantum anomalies.\nUse AND command for device management.',
        compatible: ['QSM-001', 'DIM-001', 'EMC-001', 'QAN-001'],
      },
      'compass': {
        name: 'Quantum Compass',
        id: 'QCP-001',
        version: '1.5.0',
        desc: 'Quantum-entangled anomaly direction finder.\nTracks anomaly direction and distance in real-time.\nUse QCP command for device management.',
        compatible: ['AND-001', 'DIM-001', 'QSM-001', 'EMC-001'],
      },
      'qcompass': {
        name: 'Quantum Compass',
        id: 'QCP-001',
        version: '1.5.0',
        desc: 'Quantum-entangled anomaly direction finder.\nTracks anomaly direction and distance in real-time.\nUse QCP command for device management.',
        compatible: ['AND-001', 'DIM-001', 'QSM-001', 'EMC-001'],
      },
      'teleport': {
        name: 'Teleport Pad',
        id: 'TLP-001',
        version: '2.2.0',
        desc: 'Quantum transport pad for inter-lab teleportation.\nRequires energy charge and stable quantum lock.\nUse TLP command for device management.',
        compatible: ['UEC-001', 'MFR-001', 'DIM-001', 'QSM-001'],
      },
      'pad': {
        name: 'Teleport Pad',
        id: 'TLP-001',
        version: '2.2.0',
        desc: 'Quantum transport pad for inter-lab teleportation.\nRequires energy charge and stable quantum lock.\nUse TLP command for device management.',
        compatible: ['UEC-001', 'MFR-001', 'DIM-001', 'QSM-001'],
      },
      'diag': {
        name: 'Diagnostics Console',
        id: 'DGN-001',
        version: '2.0.4',
        desc: 'Universal system diagnostics and health monitoring.\n6 categories: SYSTEMS, DEVICES, ENERGY, NETWORK, CRYSTALS, PROCESS.',
        compatible: ['ALL'],
      },
      'diagnostics': {
        name: 'Diagnostics Console',
        id: 'DGN-001',
        version: '2.0.4',
        desc: 'Universal system diagnostics and health monitoring.\n6 categories: SYSTEMS, DEVICES, ENERGY, NETWORK, CRYSTALS, PROCESS.',
        compatible: ['ALL'],
      },
      'laser': {
        name: 'Precision Laser',
        id: 'LCT-001',
        version: '2.1.0',
        desc: 'Tier 2 high-precision laser tool for cutting and shaping materials.\nEnables crafting of advanced components and fine-tolerance work.\nUse LCT command for device management.',
        compatible: ['UEC-001', 'MFR-001', 'INT-001', 'CDC-001'],
      },
      'lct': {
        name: 'Precision Laser',
        id: 'LCT-001',
        version: '2.1.0',
        desc: 'Tier 2 high-precision laser tool for cutting and shaping materials.\nEnables crafting of advanced components and fine-tolerance work.\nUse LCT command for device management.',
        compatible: ['UEC-001', 'MFR-001', 'INT-001', 'CDC-001'],
      },
      'cutter': {
        name: 'Precision Laser',
        id: 'LCT-001',
        version: '2.1.0',
        desc: 'Tier 2 high-precision laser tool for cutting and shaping materials.\nEnables crafting of advanced components and fine-tolerance work.\nUse LCT command for device management.',
        compatible: ['UEC-001', 'MFR-001', 'INT-001', 'CDC-001'],
      },
      'printer': {
        name: '3D Fabricator',
        id: 'P3D-001',
        version: '3.2.1',
        desc: 'Tier 2 fabricator that prints complex parts in plastic, metal or crystal.\nSpeeds up component production and prototyping of new devices.\nUse P3D command for device management.',
        compatible: ['LCT-001', 'CDC-001', 'AIC-001', 'HMS-001'],
      },
      '3d': {
        name: '3D Fabricator',
        id: 'P3D-001',
        version: '3.2.1',
        desc: 'Tier 2 fabricator that prints complex parts in plastic, metal or crystal.\nSpeeds up component production and prototyping of new devices.\nUse P3D command for device management.',
        compatible: ['LCT-001', 'CDC-001', 'AIC-001', 'HMS-001'],
      },
      'fabricator': {
        name: '3D Fabricator',
        id: 'P3D-001',
        version: '3.2.1',
        desc: 'Tier 2 fabricator that prints complex parts in plastic, metal or crystal.\nSpeeds up component production and prototyping of new devices.\nUse P3D command for device management.',
        compatible: ['LCT-001', 'CDC-001', 'AIC-001', 'HMS-001'],
      },
      'thmgr': {
        name: 'Thermal Manager',
        id: 'THM-001',
        version: '1.0.0',
        desc: 'Panel thermal management system with auto-cooling.\nMonitors CPU/GPU/Panel temperatures and controls dual-fan cooling system.\nAuto-adjusts fan speeds based on device loads and temperatures.',
        compatible: ['VNT-001', 'TMP-001', 'CPU-001', 'DGN-001', 'ALL'],
      },
      'thm': {
        name: 'Thermal Manager',
        id: 'THM-001',
        version: '1.0.0',
        desc: 'Panel thermal management system with auto-cooling.\nMonitors CPU/GPU/Panel temperatures and controls dual-fan cooling system.\nAuto-adjusts fan speeds based on device loads and temperatures.',
        compatible: ['VNT-001', 'TMP-001', 'CPU-001', 'DGN-001', 'ALL'],
      },
      'cooling': {
        name: 'Thermal Manager',
        id: 'THM-001',
        version: '1.0.0',
        desc: 'Panel thermal management system with auto-cooling.\nMonitors CPU/GPU/Panel temperatures and controls dual-fan cooling system.\nAuto-adjusts fan speeds based on device loads and temperatures.',
        compatible: ['VNT-001', 'TMP-001', 'CPU-001', 'DGN-001', 'ALL'],
      },
      'toolkit': {
        name: 'Basic Toolkit',
        id: 'BTK-001',
        version: '1.2.0',
        desc: 'Tier 1 hand tools for digital construction and lab maintenance.\nIncludes PROBE (I/O testing), CLAMP (assembly), LASER (micro-cuts), and DRILL.\nRequired to build any Tier 1 structures; prerequisite for all higher Tools.',
        compatible: ['PWB-001', 'MSC-001', 'LCT-001', 'P3D-001', 'ALL'],
      },
      'btk': {
        name: 'Basic Toolkit',
        id: 'BTK-001',
        version: '1.2.0',
        desc: 'Tier 1 hand tools for digital construction and lab maintenance.\nIncludes PROBE (I/O testing), CLAMP (assembly), LASER (micro-cuts), and DRILL.\nRequired to build any Tier 1 structures; prerequisite for all higher Tools.',
        compatible: ['PWB-001', 'MSC-001', 'LCT-001', 'P3D-001', 'ALL'],
      },
      'tools': {
        name: 'Basic Toolkit',
        id: 'BTK-001',
        version: '1.2.0',
        desc: 'Tier 1 hand tools for digital construction and lab maintenance.\nIncludes PROBE (I/O testing), CLAMP (assembly), LASER (micro-cuts), and DRILL.\nRequired to build any Tier 1 structures; prerequisite for all higher Tools.',
        compatible: ['PWB-001', 'MSC-001', 'LCT-001', 'P3D-001', 'ALL'],
      },
      'scanner': {
        name: 'Material Scanner',
        id: 'MSC-001',
        version: '1.3.0',
        desc: 'Tier 1 handheld scanner for resource detection.\nIdentifies nearby resource nodes and small anomalies.\nHelps locate Abstractum deposits and flags minor anomaly signals.',
        compatible: ['BTK-001', 'AND-001', 'QCP-001', 'RMG-001', 'ALL'],
      },
      'msc': {
        name: 'Material Scanner',
        id: 'MSC-001',
        version: '1.3.0',
        desc: 'Tier 1 handheld scanner for resource detection.\nIdentifies nearby resource nodes and small anomalies.\nHelps locate Abstractum deposits and flags minor anomaly signals.',
        compatible: ['BTK-001', 'AND-001', 'QCP-001', 'RMG-001', 'ALL'],
      },
      'matscan': {
        name: 'Material Scanner',
        id: 'MSC-001',
        version: '1.3.0',
        desc: 'Tier 1 handheld scanner for resource detection.\nIdentifies nearby resource nodes and small anomalies.\nHelps locate Abstractum deposits and flags minor anomaly signals.',
        compatible: ['BTK-001', 'AND-001', 'QCP-001', 'RMG-001', 'ALL'],
      },
      'workbench': {
        name: 'Portable Workbench',
        id: 'PWB-001',
        version: '1.1.0',
        desc: 'Tier 1 mobile bench for crafting small parts and prototypes.\nImproves assembly efficiency and lets you craft components on-site.\nFeatures 3 crafting slots, motor-driven work surface, and precision clamps.\nRequired for Automated Assembly Line research.',
        compatible: ['BTK-001', 'LCT-001', 'P3D-001', 'MSC-001', 'ALL'],
      },
      'pwb': {
        name: 'Portable Workbench',
        id: 'PWB-001',
        version: '1.1.0',
        desc: 'Tier 1 mobile bench for crafting small parts and prototypes.\nImproves assembly efficiency and lets you craft components on-site.\nFeatures 3 crafting slots, motor-driven work surface, and precision clamps.\nRequired for Automated Assembly Line research.',
        compatible: ['BTK-001', 'LCT-001', 'P3D-001', 'MSC-001', 'ALL'],
      },
      'bench': {
        name: 'Portable Workbench',
        id: 'PWB-001',
        version: '1.1.0',
        desc: 'Tier 1 mobile bench for crafting small parts and prototypes.\nImproves assembly efficiency and lets you craft components on-site.\nFeatures 3 crafting slots, motor-driven work surface, and precision clamps.\nRequired for Automated Assembly Line research.',
        compatible: ['BTK-001', 'LCT-001', 'P3D-001', 'MSC-001', 'ALL'],
      },
      'power': {
        name: 'Power Management System',
        id: 'PWR-001',
        version: '1.0.0',
        desc: 'Central power management and monitoring system.\nTracks power generation, consumption, storage, and grid health.\nManages device power states and provides fault protection.\nSupports emergency shutdown and load balancing.',
        compatible: ['UEC-001', 'MFR-001', 'BAT-001', 'THM-001', 'DGN-001', 'ALL'],
      },
      'pwr': {
        name: 'Power Management System',
        id: 'PWR-001',
        version: '1.0.0',
        desc: 'Central power management and monitoring system.\nTracks power generation, consumption, storage, and grid health.\nManages device power states and provides fault protection.\nSupports emergency shutdown and load balancing.',
        compatible: ['UEC-001', 'MFR-001', 'BAT-001', 'THM-001', 'DGN-001', 'ALL'],
      },
      'pwrmgmt': {
        name: 'Power Management System',
        id: 'PWR-001',
        version: '1.0.0',
        desc: 'Central power management and monitoring system.\nTracks power generation, consumption, storage, and grid health.\nManages device power states and provides fault protection.\nSupports emergency shutdown and load balancing.',
        compatible: ['UEC-001', 'MFR-001', 'BAT-001', 'THM-001', 'DGN-001', 'ALL'],
      },
      'volt': {
        name: 'Volt Meter Display',
        id: 'VLT-001',
        version: '1.0.0',
        desc: 'Amber LCD segment display for real-time voltage monitoring.\nConnects to power management system (PWR-001) for live data.\nShows system voltage calculated from power balance.\nStatus indicators: green (normal), amber (warning), red (critical).',
        compatible: ['PWR-001', 'UEC-001', 'MFR-001', 'BAT-001', 'PWD-001'],
      },
      'voltmeter': {
        name: 'Volt Meter Display',
        id: 'VLT-001',
        version: '1.0.0',
        desc: 'Amber LCD segment display for real-time voltage monitoring.\nConnects to power management system (PWR-001) for live data.\nShows system voltage calculated from power balance.\nStatus indicators: green (normal), amber (warning), red (critical).',
        compatible: ['PWR-001', 'UEC-001', 'MFR-001', 'BAT-001', 'PWD-001'],
      },
      'vlt': {
        name: 'Volt Meter Display',
        id: 'VLT-001',
        version: '1.0.0',
        desc: 'Amber LCD segment display for real-time voltage monitoring.\nConnects to power management system (PWR-001) for live data.\nShows system voltage calculated from power balance.\nStatus indicators: green (normal), amber (warning), red (critical).',
        compatible: ['PWR-001', 'UEC-001', 'MFR-001', 'BAT-001', 'PWD-001'],
      },
      'powerdisplay': {
        name: 'Power Display Panel',
        id: 'PWD-001',
        version: '1.0.0',
        desc: 'Comprehensive power monitoring panel with integrated VoltMeter.\nShows generation, consumption, load percentage, and battery status.\nReal-time power balance visualization with status indicators.\nConnects to all power devices for centralized monitoring.',
        compatible: ['PWR-001', 'VLT-001', 'UEC-001', 'MFR-001', 'BAT-001', 'ALL'],
      },
      'pwd': {
        name: 'Power Display Panel',
        id: 'PWD-001',
        version: '1.0.0',
        desc: 'Comprehensive power monitoring panel with integrated VoltMeter.\nShows generation, consumption, load percentage, and battery status.\nReal-time power balance visualization with status indicators.\nConnects to all power devices for centralized monitoring.',
        compatible: ['PWR-001', 'VLT-001', 'UEC-001', 'MFR-001', 'BAT-001', 'ALL'],
      },
      // Short-ID aliases (device_id prefix lowercase)
      'cdc': {
        name: 'Crystal Data Cache',
        id: 'CDC-001',
        version: '1.4.2',
        desc: 'Crystalline data storage for research archives (Tech Tier 1).\nUse CDC command for device management.',
        compatible: ['UEC-001', 'BAT-001', 'HMS-001', 'AIC-001', 'SCA-001'],
      },
      'uec': {
        name: 'Unstable Energy Core',
        id: 'UEC-001',
        version: '2.0.1',
        desc: 'Primary power generation via blockchain volatility monitoring.\nUse UEC command for device management.',
        compatible: ['CDC-001', 'BAT-001', 'QAN-001', 'HMS-001', 'MFR-001'],
      },
      'bat': {
        name: 'Portable Battery Pack',
        id: 'BAT-001',
        version: '1.8.0',
        desc: 'Energy storage device with 4-cell array and auto-regeneration.\nUse BAT command for device management.',
        compatible: ['UEC-001', 'CDC-001', 'EXD-001'],
      },
      'hms': {
        name: 'Handmade Synthesizer',
        id: 'HMS-001',
        version: '3.2.1',
        desc: 'Enables slice synthesis and trait manipulation.\nUse HMS command for device management.',
        compatible: ['CDC-001', 'INT-001'],
      },
      'ecr': {
        name: 'Echo Recorder',
        id: 'ECR-001',
        version: '1.1.0',
        desc: 'Records and replays trait patterns for analysis.\nUse ECR command for device management.',
        compatible: ['HMS-001', 'OSC-001'],
      },
      'int': {
        name: 'Interpolator',
        id: 'INT-001',
        version: '2.5.3',
        desc: 'Interpolates trait values for precision targeting.\nUse IPL command for device management.',
        compatible: ['HMS-001', 'OSC-001'],
      },
      'ipl': {
        name: 'Interpolator',
        id: 'INT-001',
        version: '2.5.3',
        desc: 'Interpolates trait values for precision targeting.\nUse IPL command for device management.',
        compatible: ['HMS-001', 'OSC-001'],
      },
      'mfr': {
        name: 'Microfusion Reactor',
        id: 'MFR-001',
        version: '2.3.0',
        desc: 'Tier 2 power generation via plasma microfusion.\nUse MFR command for device management.',
        compatible: ['UEC-001', 'BAT-001', 'QAN-001'],
      },
      'aic': {
        name: 'AI Assistant Core',
        id: 'AIC-001',
        version: '2.4.0',
        desc: 'Semi-sentient AI for lab automation and optimization.\nUse AIC command for device management.',
        compatible: ['MFR-001', 'CDC-001', 'QAN-001', 'DGN-001'],
      },
      'sca': {
        name: 'Supercomputer Array',
        id: 'SCA-001',
        version: '5.2.0',
        desc: 'High-performance computing cluster for heavy calculations.\nUse SCA command for device management.',
        compatible: ['AIC-001', 'CDC-001', 'QAN-001', 'MFR-001'],
      },
      'exd': {
        name: 'Explorer Drone',
        id: 'EXD-001',
        version: '3.1.2',
        desc: 'Remote-controlled drone for field exploration and resource collection.\nUse EXD command for device management.',
        compatible: ['AIC-001', 'QAN-001', 'CDC-001'],
      },
      'rmg': {
        name: 'Resource Magnet',
        id: 'RMG-001',
        version: '1.2.0',
        desc: 'Handheld device that passively pulls in stray Abstractum fragments.\nUse RMG command for device management.',
        compatible: ['BAT-001', 'QAN-001', 'UEC-001'],
      },
      'atk': {
        name: 'Abstractum Tank',
        id: 'ATK-001',
        version: '2.1.0',
        desc: 'Primary storage vessel for raw Abstractum resource.\nUse ATK command for device management.',
        compatible: ['RMG-001', 'CDC-001', 'UEC-001', 'MFR-001'],
      },
      'emc': {
        name: 'Exotic Matter Containment',
        id: 'EMC-001',
        version: '4.0.1',
        desc: 'Containment field for exotic matter particles.\nUse EMC command for device management.',
        compatible: ['MFR-001', 'QAN-001', 'DGN-001'],
      },
      'vnt': {
        name: 'Ventilation System',
        id: 'VNT-001',
        version: '1.0.0',
        desc: 'Dual-fan cooling system for CPU and GPU.\nUse VNT command for device management.',
        compatible: ['DGN-001'],
      },
      'spk': {
        name: 'Narrow Speaker',
        id: 'SPK-001',
        version: '1.0.0',
        desc: 'Audio output with volume and filter controls.\nUse SPK command for device management.',
        compatible: ['OSC-001'],
      },
      'osc': {
        name: 'Oscilloscope Array',
        id: 'OSC-001',
        version: '4.6.0',
        desc: 'Dual-channel waveform display (OZSC-460).\nUse OSC command for device management.',
        compatible: ['QAN-001', 'ECR-001', 'INT-001'],
      },
      'qan': {
        name: 'Quantum Analyzer',
        id: 'QAN-001',
        version: '3.7.2',
        desc: 'Universal Problem Solver with 6 analysis modes.\nUse QAN command for device management.',
        compatible: ['OSC-001', 'UEC-001', 'QSM-001', 'DIM-001'],
      },
      'dgn': {
        name: 'Diagnostics Console',
        id: 'DGN-001',
        version: '2.0.4',
        desc: 'Universal system diagnostics and health monitoring.\nUse DGN command for device management.',
        compatible: ['ALL'],
      },
      'p3d': {
        name: '3D Fabricator',
        id: 'P3D-001',
        version: '3.2.1',
        desc: 'Tier 2 fabricator for complex parts.\nUse P3D command for device management.',
        compatible: ['LCT-001', 'CDC-001', 'AIC-001', 'HMS-001'],
      },
      'and': {
        name: 'Anomaly Detector',
        id: 'AND-001',
        version: '2.3.0',
        desc: 'Halo Plane anomaly scanner and signal analyzer.\nUse AND command for device management.',
        compatible: ['QSM-001', 'DIM-001', 'EMC-001', 'QAN-001'],
      },
      'qcp': {
        name: 'Quantum Compass',
        id: 'QCP-001',
        version: '1.5.0',
        desc: 'Quantum-entangled anomaly direction finder.\nUse QCP command for device management.',
        compatible: ['AND-001', 'DIM-001', 'QSM-001', 'EMC-001'],
      },
      'tlp': {
        name: 'Teleport Pad',
        id: 'TLP-001',
        version: '2.2.0',
        desc: 'Quantum transport pad for inter-lab teleportation.\nUse TLP command for device management.',
        compatible: ['UEC-001', 'MFR-001', 'DIM-001', 'QSM-001'],
      },
    }

    const device = deviceMap[deviceName]
    if (!device) {
      return {
        success: false,
        error: `unknown device: ${deviceName}\nuse device list to see available devices.`,
      }
    }

    // Device info
    if (!action || action === 'info') {
      const compatList = device.compatible.join(', ')
      return {
        success: true,
        output: [
          '',
          `┌─ DEVICE: ${device.name} ${'─'.repeat(20)}`,
          '',
          `  ID:           ${device.id}`,
          `  Version:      ${device.version}`,
          `  Status:       ONLINE`,
          '',
          `  Description:`,
          ...device.desc.split('\n').map(line => `    ${line}`),
          '',
          `  Compatible:   ${compatList}`,
          '',
          `  Commands:`,
          `    DEVICE ${deviceName.toUpperCase()} TEST   - Run diagnostics`,
          `    DEVICE ${deviceName.toUpperCase()} REBOOT - Reboot device`,
          `    DEVICE ${deviceName.toUpperCase()} STATUS - Show current status`,
          `    DEVICE ${deviceName.toUpperCase()} COMBOS - Show compatible combinations`,
          `    DEVICE ${deviceName.toUpperCase()} DEPS   - Show tech tree dependencies`,
          `    DEVICE ${deviceName.toUpperCase()} INFLUENCE - Show device influence map`,
          `    DEVICE ${deviceName.toUpperCase()} TWEAKS - Show available tweaks`,
          '',
        ],
      }
    }

    // Device test
    if (action === 'test') {
      ctx.setTyping(true)
      await new Promise(resolve => setTimeout(resolve, 1500))
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          `[TEST] ${device.name} (${device.id})`,
          '────────────────────────────────────────',
          '[CHECK] Memory integrity............ OK',
          '[CHECK] Data bus connection......... OK',
          '[CHECK] Cache coherence............. OK',
          '[CHECK] Power supply................ OK',
          '[CHECK] Communication protocol...... OK',
          '',
          `[RESULT] All diagnostics PASSED`,
          `[TIME]   ${new Date().toISOString()}`,
          '',
        ],
      }
    }

    // Device reboot/reset
    if (action === 'reset' || action === 'reboot') {
      ctx.setTyping(true)
      await new Promise(resolve => setTimeout(resolve, 1500))
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          `[REBOOT] ${device.name} (${device.id})`,
          '────────────────────────────────────────',
          '[STOP]  Halting device.............. OK',
          '[FLUSH] Clearing data buffers....... OK',
          '[POST]  Power-on self test.......... OK',
          '[INIT]  Initializing subsystems..... OK',
          '[SYNC]  Re-synchronizing data....... OK',
          '[BOOT]  Device online............... OK',
          '',
          `[RESULT] Device reboot complete`,
          `[TIME]   ${new Date().toISOString()}`,
          '',
        ],
      }
    }

    // Device status
    if (action === 'status') {
      return {
        success: true,
        output: [
          '',
          `┌─ STATUS: ${device.name} ${'─'.repeat(20)}`,
          '',
          `  Device ID:     ${device.id}`,
          `  Version:       ${device.version}`,
          `  Status:        ● ONLINE`,
          `  Uptime:        ${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
          `  Last Test:     ${new Date(Date.now() - Math.random() * 3600000).toLocaleTimeString()}`,
          `  Errors:        0`,
          '',
        ],
      }
    }

    // Device power on/off
    if (action === 'power') {
      const powerAction = args[2]?.toLowerCase()
      if (!powerAction || (powerAction !== 'on' && powerAction !== 'off')) {
        return { success: false, error: `usage: device <name> power <on|off>` }
      }

      // Map device IDs to their context managers
      const devicePowerMap: Record<string, { on: () => Promise<void>; off: () => Promise<void>; isPowered: () => boolean } | undefined> = {
        'CDC-001': ctx.data.cdcDevice ? { on: () => ctx.data.cdcDevice!.powerOn(), off: () => ctx.data.cdcDevice!.powerOff(), isPowered: () => ctx.data.cdcDevice!.getState().isPowered } : undefined,
        'UEC-001': ctx.data.uecDevice ? { on: () => ctx.data.uecDevice!.powerOn(), off: () => ctx.data.uecDevice!.powerOff(), isPowered: () => ctx.data.uecDevice!.getState().isPowered } : undefined,
        'BAT-001': ctx.data.batDevice ? { on: () => ctx.data.batDevice!.powerOn(), off: () => ctx.data.batDevice!.powerOff(), isPowered: () => ctx.data.batDevice!.getState().isPowered } : undefined,
        'HMS-001': ctx.data.hmsDevice ? { on: () => ctx.data.hmsDevice!.powerOn(), off: () => ctx.data.hmsDevice!.powerOff(), isPowered: () => ctx.data.hmsDevice!.getState().isPowered } : undefined,
        'ECR-001': ctx.data.ecrDevice ? { on: () => ctx.data.ecrDevice!.powerOn(), off: () => ctx.data.ecrDevice!.powerOff(), isPowered: () => ctx.data.ecrDevice!.getState().isPowered } : undefined,
        'INT-001': ctx.data.iplDevice ? { on: () => ctx.data.iplDevice!.powerOn(), off: () => ctx.data.iplDevice!.powerOff(), isPowered: () => ctx.data.iplDevice!.getState().isPowered } : undefined,
        'MFR-001': ctx.data.mfrDevice ? { on: () => ctx.data.mfrDevice!.powerOn(), off: () => ctx.data.mfrDevice!.powerOff(), isPowered: () => ctx.data.mfrDevice!.getState().isPowered } : undefined,
        'AIC-001': ctx.data.aicDevice ? { on: () => ctx.data.aicDevice!.powerOn(), off: () => ctx.data.aicDevice!.powerOff(), isPowered: () => ctx.data.aicDevice!.getState().isPowered } : undefined,
        'SCA-001': ctx.data.scaDevice ? { on: () => ctx.data.scaDevice!.powerOn(), off: () => ctx.data.scaDevice!.powerOff(), isPowered: () => ctx.data.scaDevice!.getState().isPowered } : undefined,
        'EXD-001': ctx.data.exdDevice ? { on: () => ctx.data.exdDevice!.powerOn(), off: () => ctx.data.exdDevice!.powerOff(), isPowered: () => ctx.data.exdDevice!.getState().isPowered } : undefined,
        'EMC-001': ctx.data.emcDevice ? { on: () => ctx.data.emcDevice!.powerOn(), off: () => ctx.data.emcDevice!.powerOff(), isPowered: () => ctx.data.emcDevice!.getState().isPowered } : undefined,
        'VNT-001': ctx.data.vntDevice ? { on: () => ctx.data.vntDevice!.powerOn(), off: () => ctx.data.vntDevice!.powerOff(), isPowered: () => ctx.data.vntDevice!.getState().isPowered } : undefined,
        'QAN-001': ctx.data.quaDevice ? { on: () => ctx.data.quaDevice!.powerOn(), off: () => ctx.data.quaDevice!.powerOff(), isPowered: () => ctx.data.quaDevice!.getState().isPowered } : undefined,
        'QSM-001': ctx.data.qsmDevice ? { on: () => ctx.data.qsmDevice!.powerOn(), off: () => ctx.data.qsmDevice!.powerOff(), isPowered: () => ctx.data.qsmDevice!.getState().isPowered } : undefined,
        'PWB-001': ctx.data.pwbDevice ? { on: () => ctx.data.pwbDevice!.powerOn(), off: () => ctx.data.pwbDevice!.powerOff(), isPowered: () => ctx.data.pwbDevice!.getState().isPowered } : undefined,
        'BTK-001': ctx.data.btkDevice ? { on: () => ctx.data.btkDevice!.powerOn(), off: () => ctx.data.btkDevice!.powerOff(), isPowered: () => ctx.data.btkDevice!.getState().isPowered } : undefined,
        'RMG-001': ctx.data.rmgDevice ? { on: () => ctx.data.rmgDevice!.powerOn(), off: () => ctx.data.rmgDevice!.powerOff(), isPowered: () => ctx.data.rmgDevice!.getState().isPowered } : undefined,
        'MSC-001': ctx.data.mscDevice ? { on: () => ctx.data.mscDevice!.powerOn(), off: () => ctx.data.mscDevice!.powerOff(), isPowered: () => ctx.data.mscDevice!.getState().isPowered } : undefined,
        'NET-001': ctx.data.netDevice ? { on: () => ctx.data.netDevice!.powerOn(), off: () => ctx.data.netDevice!.powerOff(), isPowered: () => ctx.data.netDevice!.getState().isPowered } : undefined,
        'TMP-001': ctx.data.tmpDevice ? { on: () => ctx.data.tmpDevice!.powerOn(), off: () => ctx.data.tmpDevice!.powerOff(), isPowered: () => ctx.data.tmpDevice!.getState().isPowered } : undefined,
        'DIM-001': ctx.data.dimDevice ? { on: () => ctx.data.dimDevice!.powerOn(), off: () => ctx.data.dimDevice!.powerOff(), isPowered: () => ctx.data.dimDevice!.getState().isPowered } : undefined,
        'CPU-001': ctx.data.cpuDevice ? { on: () => ctx.data.cpuDevice!.powerOn(), off: () => ctx.data.cpuDevice!.powerOff(), isPowered: () => ctx.data.cpuDevice!.getState().isPowered } : undefined,
        'CLK-001': ctx.data.clkDevice ? { on: () => ctx.data.clkDevice!.powerOn(), off: () => ctx.data.clkDevice!.powerOff(), isPowered: () => ctx.data.clkDevice!.getState().isPowered } : undefined,
        'MEM-001': ctx.data.memDevice ? { on: () => ctx.data.memDevice!.powerOn(), off: () => ctx.data.memDevice!.powerOff(), isPowered: () => ctx.data.memDevice!.getState().isPowered } : undefined,
        'AND-001': ctx.data.andDevice ? { on: () => ctx.data.andDevice!.powerOn(), off: () => ctx.data.andDevice!.powerOff(), isPowered: () => ctx.data.andDevice!.getState().isPowered } : undefined,
        'QCP-001': ctx.data.qcpDevice ? { on: () => ctx.data.qcpDevice!.powerOn(), off: () => ctx.data.qcpDevice!.powerOff(), isPowered: () => ctx.data.qcpDevice!.getState().isPowered } : undefined,
        'TLP-001': ctx.data.tlpDevice ? { on: () => ctx.data.tlpDevice!.powerOn(), off: () => ctx.data.tlpDevice!.powerOff(), isPowered: () => ctx.data.tlpDevice!.getState().isPowered } : undefined,
        'LCT-001': ctx.data.lctDevice ? { on: () => ctx.data.lctDevice!.powerOn(), off: () => ctx.data.lctDevice!.powerOff(), isPowered: () => ctx.data.lctDevice!.getState().isPowered } : undefined,
        'P3D-001': ctx.data.p3dDevice ? { on: () => ctx.data.p3dDevice!.powerOn(), off: () => ctx.data.p3dDevice!.powerOff(), isPowered: () => ctx.data.p3dDevice!.getState().isPowered } : undefined,
      }

      const ctrl = devicePowerMap[device.id]
      if (!ctrl) {
        return { success: true, output: ['', `[device] ${device.id} power control not available (no manager connected)`, ''] }
      }

      if (powerAction === 'on') {
        if (ctrl.isPowered()) {
          return { success: true, output: ['', `[device] ${device.id} is already powered ON`, ''] }
        }
        await ctrl.on()
        ctx.data.saveAllDeviceState?.()
        return { success: true, output: ['', `[device] ${device.name} (${device.id}) powered ON`, ''] }
      } else {
        if (!ctrl.isPowered()) {
          return { success: true, output: ['', `[device] ${device.id} is already powered OFF`, ''] }
        }
        await ctrl.off()
        ctx.data.saveAllDeviceState?.()
        return { success: true, output: ['', `[device] ${device.name} (${device.id}) powered OFF`, ''] }
      }
    }

    // Device dependencies
    if (action === 'deps' || action === 'dependencies' || action === 'tree') {
      // Static tech tree data from device spec
      const techTreeMap: Record<string, { tree: string; tier: number }> = {
        'CDC-001': { tree: 'Tech', tier: 1 }, 'UEC-001': { tree: 'Tech', tier: 1 },
        'BAT-001': { tree: 'Tech', tier: 2 }, 'HMS-001': { tree: 'Synthesizers', tier: 1 },
        'ECR-001': { tree: 'Adapters', tier: 1 }, 'INT-001': { tree: 'Optics', tier: 1 },
        'MFR-001': { tree: 'Tech', tier: 2 }, 'AIC-001': { tree: 'Tech', tier: 3 },
        'SCA-001': { tree: 'Tech', tier: 4 }, 'EXD-001': { tree: 'Exploration', tier: 2 },
        'RMG-001': { tree: 'Economy', tier: 1 }, 'ATK-001': { tree: 'Economy', tier: 1 },
        'EMC-001': { tree: 'Science', tier: 3 }, 'VNT-001': { tree: 'Infrastructure', tier: 1 },
        'SPK-001': { tree: 'Audio', tier: 1 }, 'OSC-001': { tree: 'Audio', tier: 2 },
        'QAN-001': { tree: 'Science', tier: 2 }, 'QSM-001': { tree: 'Quantum', tier: 2 },
        'NET-001': { tree: 'Infrastructure', tier: 1 }, 'TMP-001': { tree: 'Infrastructure', tier: 1 },
        'DIM-001': { tree: 'Quantum', tier: 3 }, 'CPU-001': { tree: 'Infrastructure', tier: 1 },
        'CLK-001': { tree: 'Infrastructure', tier: 1 }, 'MEM-001': { tree: 'Infrastructure', tier: 1 },
        'AND-001': { tree: 'Science', tier: 2 }, 'QCP-001': { tree: 'Exploration', tier: 2 },
        'TLP-001': { tree: 'Quantum', tier: 4 }, 'DGN-001': { tree: 'Tech', tier: 2 },
        'P3D-001': { tree: 'Fabrication', tier: 2 }, 'LCT-001': { tree: 'Fabrication', tier: 2 },
        'THM-001': { tree: 'Infrastructure', tier: 1 }, 'BTK-001': { tree: 'Tools', tier: 1 },
        'MSC-001': { tree: 'Tools', tier: 1 }, 'PWB-001': { tree: 'Tools', tier: 1 },
        'PWR-001': { tree: 'Infrastructure', tier: 1 }, 'VLT-001': { tree: 'Infrastructure', tier: 1 },
        'PWD-001': { tree: 'Infrastructure', tier: 1 },
      }

      const info = techTreeMap[device.id]
      const treeName = info?.tree ?? 'Unknown'
      const tier = info?.tier ?? 1

      // Build prerequisite chain (lower tiers in same tree)
      const prereqs = Object.entries(techTreeMap)
        .filter(([id, t]) => t.tree === treeName && t.tier < tier && id !== device.id)
        .sort((a, b) => a[1].tier - b[1].tier)

      // Find what this device unlocks (higher tiers in same tree)
      const unlocks = Object.entries(techTreeMap)
        .filter(([id, t]) => t.tree === treeName && t.tier > tier && id !== device.id)
        .sort((a, b) => a[1].tier - b[1].tier)

      const lines: string[] = [
        '',
        `┌─ Dependencies: ${device.name} ${'─'.repeat(20)}`,
        '│',
        `│  Tech Tree:  ${treeName}`,
        `│  Tier:       ${tier}`,
        '│',
      ]

      if (prereqs.length > 0) {
        lines.push('│  Prerequisites:')
        for (const [id, t] of prereqs) {
          const pName = Object.values(deviceMap).find(d => d.id === id)?.name ?? id
          lines.push(`│    ├── T${t.tier} ${id} (${pName})`)
        }
        lines.push(`│    └── T${tier} ${device.id} (${device.name}) ◀ YOU`)
      } else {
        lines.push('│  Prerequisites: None (base tier)')
      }

      lines.push('│')

      if (unlocks.length > 0) {
        lines.push('│  Unlocks:')
        for (const [id, t] of unlocks) {
          const uName = Object.values(deviceMap).find(d => d.id === id)?.name ?? id
          const connector = id === unlocks[unlocks.length - 1][0] ? '└──' : '├──'
          lines.push(`│    ${connector} T${t.tier} ${id} (${uName})`)
        }
      } else {
        lines.push('│  Unlocks: None (top tier in tree)')
      }

      lines.push(
        '│',
        `└${'─'.repeat(40)}`,
        '',
      )

      return { success: true, output: lines }
    }

    // Device combinations / synergies
    if (action === 'combos' || action === 'combinations' || action === 'synergy') {
      const compatList = device.compatible.filter(c => c !== device.id && c !== 'ALL')

      if (compatList.length === 0) {
        return {
          success: true,
          output: [
            '',
            `┌─ Combinations: ${device.name} ${'─'.repeat(20)}`,
            '│  NO COMPATIBLE DEVICES FOUND',
            `└${'─'.repeat(40)}`,
            '',
          ],
        }
      }

      const lines: string[] = [
        '',
        `┌─ Combinations: ${device.name} ${'─'.repeat(20)}`,
        '│',
      ]

      for (const partnerId of compatList) {
        const partnerEntry = Object.values(deviceMap).find(d => d.id === partnerId)
        const partnerName = partnerEntry?.name ?? partnerId
        lines.push(`│  ○ ${device.id} + ${partnerId} (${partnerName})`)
      }

      lines.push(
        '│',
        `│  Total: ${compatList.length} compatible device(s)`,
        `└${'─'.repeat(40)}`,
        '',
        '  Use the Combos tab in device detail for link/unlink operations.',
        '',
      )

      return { success: true, output: lines }
    }

    // Device influence map
    if (action === 'influence' || action === 'affects' || action === 'impact') {
      // Find all devices that list this device as compatible
      const influencedBy: string[] = []
      const influences: string[] = []
      const seen = new Set<string>()

      for (const [, entry] of Object.entries(deviceMap)) {
        if (seen.has(entry.id) || entry.id === device.id) continue
        seen.add(entry.id)
        if (entry.compatible.includes(device.id)) {
          influencedBy.push(`${entry.id} (${entry.name})`)
        }
      }

      for (const cid of device.compatible) {
        if (cid === device.id || cid === 'ALL') continue
        const entry = Object.values(deviceMap).find(d => d.id === cid)
        influences.push(`${cid} (${entry?.name ?? cid})`)
      }

      const lines: string[] = [
        '',
        `┌─ Influence: ${device.name} ${'─'.repeat(20)}`,
        '│',
        '│  Influences (outgoing):',
      ]

      if (influences.length > 0) {
        for (const inf of influences) {
          lines.push(`│    → ${inf}`)
        }
      } else {
        lines.push('│    (none)')
      }

      lines.push('│', '│  Influenced by (incoming):')

      if (influencedBy.length > 0) {
        for (const inf of influencedBy) {
          lines.push(`│    ← ${inf}`)
        }
      } else {
        lines.push('│    (none)')
      }

      lines.push(
        '│',
        `│  Network: ${influences.length} out / ${influencedBy.length} in`,
        `└${'─'.repeat(40)}`,
        '',
      )

      return { success: true, output: lines }
    }

    // Device tweaks
    if (action === 'tweak' || action === 'tweaks' || action === 'config' || action === 'settings') {
      // Static tweak definitions by device category
      const defaultTweaks: Record<string, { id: string; name: string; type: string; default: string }[]> = {
        generator: [
          { id: 'power_mode', name: 'Power Mode', type: 'radio', default: 'balanced' },
          { id: 'output_limit', name: 'Output Limit', type: 'slider', default: '100%' },
          { id: 'auto_scale', name: 'Auto Scale', type: 'toggle', default: 'ON' },
          { id: 'priority', name: 'Consumer Priority', type: 'priority_list', default: '(device order)' },
        ],
        heavy: [
          { id: 'power_mode', name: 'Power Mode', type: 'radio', default: 'balanced' },
          { id: 'clock_speed', name: 'Clock Speed', type: 'slider', default: '80%' },
          { id: 'auto_standby', name: 'Auto Standby', type: 'toggle', default: 'ON' },
          { id: 'thermal_limit', name: 'Thermal Limit', type: 'slider', default: '85°C' },
        ],
        medium: [
          { id: 'power_mode', name: 'Power Mode', type: 'radio', default: 'balanced' },
          { id: 'refresh_rate', name: 'Refresh Rate', type: 'slider', default: '60Hz' },
          { id: 'auto_standby', name: 'Auto Standby', type: 'toggle', default: 'ON' },
          { id: 'data_logging', name: 'Data Logging', type: 'toggle', default: 'OFF' },
        ],
        light: [
          { id: 'power_mode', name: 'Power Mode', type: 'radio', default: 'eco' },
          { id: 'brightness', name: 'Brightness', type: 'slider', default: '70%' },
          { id: 'sleep_timer', name: 'Sleep Timer', type: 'toggle', default: 'ON' },
        ],
        storage: [
          { id: 'power_mode', name: 'Power Mode', type: 'radio', default: 'balanced' },
          { id: 'charge_rate', name: 'Charge Rate', type: 'slider', default: '80%' },
          { id: 'overflow_protect', name: 'Overflow Protect', type: 'toggle', default: 'ON' },
          { id: 'auto_discharge', name: 'Auto Discharge', type: 'toggle', default: 'OFF' },
        ],
      }

      // Determine category from techTreeMap
      const categoryMap: Record<string, string> = {
        'UEC-001': 'generator', 'MFR-001': 'generator',
        'SCA-001': 'heavy', 'AIC-001': 'heavy', 'EMC-001': 'heavy', 'TLP-001': 'heavy',
        'BAT-001': 'storage', 'ATK-001': 'storage',
        'SPK-001': 'light', 'CLK-001': 'light', 'VLT-001': 'light', 'PWD-001': 'light', 'NET-001': 'light',
      }
      const category = categoryMap[device.id] ?? 'medium'
      const tweaks = defaultTweaks[category] ?? defaultTweaks['medium']

      const typeIcon: Record<string, string> = {
        radio: '◉', toggle: '☐', slider: '▸', priority_list: '≡',
      }

      const lines: string[] = [
        '',
        `┌─ Tweaks: ${device.name} ${'─'.repeat(20)}`,
        '│',
        `│  Category: ${category.toUpperCase()}`,
        '│',
      ]

      for (const t of tweaks) {
        const icon = typeIcon[t.type] ?? '·'
        lines.push(`│  ${icon} ${t.name.padEnd(20)} [${t.type}]  default: ${t.default}`)
      }

      lines.push(
        '│',
        '│  Use the Tweaks tab in device detail to modify settings.',
        `└${'─'.repeat(40)}`,
        '',
      )

      return { success: true, output: lines }
    }

    // Device monitor (live-style snapshot)
    if (action === 'monitor' || action === 'mon' || action === 'watch') {
      const health = (75 + Math.random() * 25).toFixed(1)
      const load = (Math.random() * 100).toFixed(1)
      const temp = (25 + Math.random() * 40).toFixed(1)
      const uptime = `${Math.floor(Math.random() * 72)}h ${Math.floor(Math.random() * 60)}m`
      const power = device.compatible.length > 3 ? (10 + Math.random() * 30).toFixed(1) : (2 + Math.random() * 15).toFixed(1)

      const bar = (pct: number, len: number = 20) => {
        const filled = Math.round((pct / 100) * len)
        return '█'.repeat(filled) + '░'.repeat(len - filled)
      }

      const healthN = parseFloat(health)
      const loadN = parseFloat(load)
      const tempN = parseFloat(temp)
      const tempWarn = tempN > 55 ? ' ⚠' : ''

      const lines: string[] = [
        '',
        `┌─ Monitor: ${device.name} (${device.id}) ${'─'.repeat(15)}`,
        '│',
        `│  Health:      [${bar(healthN)}] ${health}%`,
        `│  Load:        [${bar(loadN)}] ${load}%`,
        `│  Temperature: [${bar(tempN / 0.85)}] ${temp}°C${tempWarn}`,
        `│  Power Draw:  ${power} E/s`,
        `│  Uptime:      ${uptime}`,
        '│',
        `│  Status:      ● ONLINE`,
        `│  Version:     ${device.version}`,
        '│',
        '│  Note: This is a point-in-time snapshot.',
        '│  Use device panels for real-time monitoring.',
        `└${'─'.repeat(40)}`,
        '',
      ]

      return { success: true, output: lines }
    }

    return {
      success: false,
      error: `Unknown action: ${action}\nAvailable: INFO, STATUS, TEST, REBOOT, POWER, DEPS, COMBOS, INFLUENCE, TWEAKS, MONITOR`,
    }
  },
}

// Power management command
const powerCommand: Command = {
  name: 'power',
  aliases: ['pwr', 'pwrmgmt', 'energy'],
  description: 'Power management system',
  usage: 'power [status|devices|grid|on|off|fault|emergency]',
  execute: async (args, ctx) => {
    const action = args[0]?.toLowerCase()
    const target = args[1]?.toLowerCase()
    const param = args[2]?.toLowerCase()

    // Power source definitions (from GD_SPEC_device-power_v1_0.md)
    // Units: E/s (Energy per second)
    const powerSources = [
      { id: 'UEC-001', name: 'Unstable Energy Core', output: 50, maxOutput: 50, status: 'online', efficiency: 75, tier: 1 },
      { id: 'MFR-001', name: 'Microfusion Reactor', output: 250, maxOutput: 250, status: 'online', efficiency: 92, tier: 2 },
    ]

    // Power storage definitions (from GD_SPEC_device-power_v1_0.md)
    const powerStorage = [
      { id: 'BAT-001', name: 'Battery Pack', stored: 4250, capacity: 5000, status: 'charging', chargeRate: 100 },
    ]

    // Consuming devices with power draw (idle state values from GD_SPEC_device-power_v1_0.md)
    // Most devices run in idle mode during normal operation
    const powerConsumers = [
      // Heavy Consumers
      { id: 'SCA-001', name: 'Supercomputer Array', draw: ctx.data.scaDevice?.getState().currentDraw ?? 45, priority: 3, status: ctx.data.scaDevice?.getState().isPowered ? 'on' : 'standby', category: 'heavy' },
      { id: 'TLP-001', name: 'Teleport Pad', draw: ctx.data.tlpDevice?.getState().currentDraw ?? 3, priority: 4, status: ctx.data.tlpDevice?.getState().isPowered ? 'on' : 'standby', category: 'heavy' },
      { id: 'QAN-001', name: 'Quantum Analyzer', draw: ctx.data.quaDevice?.getState().currentDraw ?? 10, priority: 2, status: ctx.data.quaDevice?.getState().isPowered ? 'on' : 'standby', category: 'heavy' },
      { id: 'EMC-001', name: 'Exotic Matter Contain.', draw: ctx.data.emcDevice?.getState().currentDraw ?? 18, priority: 1, status: ctx.data.emcDevice?.getState().isPowered ? 'on' : 'standby', category: 'heavy' },
      { id: 'P3D-001', name: '3D Fabricator', draw: ctx.data.p3dDevice?.getState().currentDraw ?? 2, priority: 3, status: ctx.data.p3dDevice?.getState().isPowered ? 'on' : 'standby', category: 'heavy' },
      { id: 'LCT-001', name: 'Precision Laser', draw: ctx.data.lctDevice?.getState().currentDraw ?? 2, priority: 3, status: ctx.data.lctDevice?.getState().isPowered ? 'on' : 'standby', category: 'heavy' },
      { id: 'EXD-001', name: 'Explorer Drone', draw: ctx.data.exdDevice?.getState().currentDraw ?? 1, priority: 3, status: ctx.data.exdDevice?.getState().isPowered ? 'on' : 'standby', category: 'heavy' },
      { id: 'AIC-001', name: 'AI Assistant Core', draw: 12, priority: 1, status: 'on', category: 'heavy' },
      // Medium Consumers
      { id: 'QSM-001', name: 'Quantum State Monitor', draw: ctx.data.qsmDevice?.getState().currentDraw ?? 7, priority: 2, status: ctx.data.qsmDevice?.getState().isPowered ? 'on' : 'standby', category: 'medium' },
      { id: 'INT-001', name: 'Interpolator', draw: 6, priority: 2, status: 'on', category: 'medium' },
      { id: 'OSC-001', name: 'Oscilloscope Array', draw: 5, priority: 2, status: 'on', category: 'medium' },
      { id: 'CDC-001', name: 'Crystal Data Cache', draw: 5, priority: 1, status: 'on', category: 'medium' },
      { id: 'AND-001', name: 'Anomaly Detector', draw: ctx.data.andDevice?.getState().currentDraw ?? 4, priority: 2, status: ctx.data.andDevice?.getState().isPowered ? 'on' : 'standby', category: 'medium' },
      { id: 'RMG-001', name: 'Resource Magnet', draw: 3, priority: 3, status: 'on', category: 'medium' },
      { id: 'HMS-001', name: 'Handmade Synthesizer', draw: 3, priority: 2, status: 'on', category: 'medium' },
      { id: 'ECR-001', name: 'Echo Recorder', draw: 2, priority: 2, status: 'on', category: 'medium' },
      // Light Consumers
      { id: 'VNT-001', name: 'Ventilation System', draw: 2, priority: 1, status: 'on', category: 'light' },
      { id: 'THM-001', name: 'Thermal Manager', draw: 1.5, priority: 1, status: 'on', category: 'light' },
      { id: 'DIM-001', name: 'Dimension Monitor', draw: ctx.data.dimDevice?.getState().currentDraw ?? 1.5, priority: 2, status: ctx.data.dimDevice?.getState().isPowered ? 'on' : 'standby', category: 'light' },
      { id: 'MSC-001', name: 'Material Scanner', draw: 1, priority: 2, status: 'on', category: 'light' },
      { id: 'NET-001', name: 'Network Monitor', draw: ctx.data.netDevice?.getState().currentDraw ?? 1.5, priority: 2, status: ctx.data.netDevice?.getState().isPowered ? 'on' : 'standby', category: 'light' },
      { id: 'DGN-001', name: 'Diagnostics Console', draw: 1, priority: 1, status: 'on', category: 'light' },
      { id: 'SPK-001', name: 'Narrow Speaker', draw: 0.5, priority: 3, status: 'on', category: 'light' },
      { id: 'QCP-001', name: 'Quantum Compass', draw: ctx.data.qcpDevice?.getState().currentDraw ?? 0.8, priority: 3, status: ctx.data.qcpDevice?.getState().isPowered ? 'on' : 'standby', category: 'light' },
      { id: 'PWR-001', name: 'Power Management Sys.', draw: 2.5, priority: 1, status: 'on', category: 'light' },
      { id: 'BTK-001', name: 'Basic Toolkit', draw: 0.3, priority: 2, status: 'on', category: 'light' },
      { id: 'PWB-001', name: 'Portable Workbench', draw: 2.5, priority: 2, status: 'on', category: 'light' },
      { id: 'CPU-001', name: 'CPU Monitor', draw: ctx.data.cpuDevice?.getState().currentDraw ?? 0.8, priority: 1, status: ctx.data.cpuDevice?.getState().isPowered ? 'on' : 'standby', category: 'light' },
      { id: 'MEM-001', name: 'Memory Monitor', draw: ctx.data.memDevice?.getState().currentDraw ?? 0.6, priority: 1, status: ctx.data.memDevice?.getState().isPowered ? 'on' : 'standby', category: 'light' },
      { id: 'TMP-001', name: 'Temperature Monitor', draw: ctx.data.tmpDevice?.getState().currentDraw ?? 0.8, priority: 1, status: ctx.data.tmpDevice?.getState().isPowered ? 'on' : 'standby', category: 'light' },
      { id: 'ATK-001', name: 'Abstractum Tank', draw: 0.3, priority: 1, status: 'on', category: 'light' },
      { id: 'PWD-001', name: 'Power Display Panel', draw: 1, priority: 1, status: 'on', category: 'light' },
      { id: 'CLK-001', name: 'Lab Clock', draw: ctx.data.clkDevice?.getState().currentDraw ?? 0.5, priority: 1, status: ctx.data.clkDevice?.getState().isPowered ? 'on' : 'standby', category: 'light' },
      { id: 'VLT-001', name: 'Volt Meter Display', draw: 0.8, priority: 1, status: 'on', category: 'light' },
    ]

    // Calculate totals
    const totalGeneration = powerSources.reduce((sum, s) => sum + s.output, 0)
    const totalMaxGeneration = powerSources.reduce((sum, s) => sum + s.maxOutput, 0)
    const activeConsumers = powerConsumers.filter(c => c.status === 'on')
    const totalConsumption = activeConsumers.reduce((sum, c) => sum + c.draw, 0)
    const totalStorage = powerStorage.reduce((sum, s) => sum + s.stored, 0)
    const totalCapacity = powerStorage.reduce((sum, s) => sum + s.capacity, 0)
    const powerBalance = totalGeneration - totalConsumption
    const loadPercent = Math.round((totalConsumption / totalGeneration) * 100)

    // Determine status based on surplus percentage (per GD_SPEC_device-power_v1_0.md)
    const surplusPercent = totalGeneration > 0 ? (powerBalance / totalGeneration) * 100 : 0
    const getStatus = () => {
      if (surplusPercent > 20) return { indicator: 'OPTIMAL', color: '●' }
      if (surplusPercent >= 0) return { indicator: 'CAUTION', color: '!' }
      if (surplusPercent > -20) return { indicator: 'CRITICAL', color: '!' }
      return { indicator: 'EMERGENCY', color: '!' }
    }

    // Default: show status overview
    if (!action || action === 'status') {
      const status = getStatus()

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│              POWER MANAGEMENT SYSTEM v1.0.0                 │',
          '│                        PWR-001                              │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  ╔═══════════════════════════════════════════════════════════╗',
          '  ║  POWER GRID OVERVIEW                                      ║',
          '  ╠═══════════════════════════════════════════════════════════╣',
          `  ║  GENERATION   : ${totalGeneration.toFixed(1).padStart(7)} E/s  (max ${totalMaxGeneration} E/s)          ║`,
          `  ║  CONSUMPTION  : ${totalConsumption.toFixed(1).padStart(7)} E/s  (${activeConsumers.length} devices active)        ║`,
          `  ║  BALANCE      : ${(powerBalance >= 0 ? '+' : '') + powerBalance.toFixed(1).padStart(6)} E/s                            ║`,
          `  ║  LOAD         : ${loadPercent.toString().padStart(7)}%                                   ║`,
          '  ╠═══════════════════════════════════════════════════════════╣',
          `  ║  STORAGE      : ${totalStorage.toString().padStart(6)} / ${totalCapacity} E  (${Math.round(totalStorage/totalCapacity*100)}%)                ║`,
          `  ║  STATUS       : ${status.color} ${status.indicator.padEnd(44)} ║`,
          '  ╚═══════════════════════════════════════════════════════════╝',
          '',
          '  ╔═══════════════════════════════════════════════════════════╗',
          '  ║  POWER SOURCES                                            ║',
          '  ╠═══════════════════════════════════════════════════════════╣',
          '  ║  ID        OUTPUT      MAX       EFF    STATUS            ║',
          '  ║  ───────   ─────────   ───────   ────   ──────            ║',
          ...powerSources.map(s =>
            `  ║  ${s.id}   ${s.output.toString().padStart(4)} E/s    ${s.maxOutput.toString().padStart(4)} E/s  ${s.efficiency}%   ${s.status.toUpperCase().padEnd(8)}      ║`
          ),
          '  ╚═══════════════════════════════════════════════════════════╝',
          '',
          '  ╔═══════════════════════════════════════════════════════════╗',
          '  ║  STORAGE BANKS                                            ║',
          '  ╠═══════════════════════════════════════════════════════════╣',
          '  ║  ID        STORED     CAPACITY  RATE     STATUS           ║',
          '  ║  ───────   ────────   ────────  ───────  ──────           ║',
          ...powerStorage.map(s =>
            `  ║  ${s.id}   ${s.stored.toString().padStart(5)} E    ${s.capacity.toString().padStart(5)} E   +${s.chargeRate} E/s  ${s.status.toUpperCase().padEnd(10)} ║`
          ),
          '  ╚═══════════════════════════════════════════════════════════╝',
          '',
          '  commands: power devices | power grid | power on/off <id>',
          '            power fault | power emergency',
          '',
        ],
      }
    }

    // Show all devices with power consumption
    if (action === 'devices' || action === 'dev' || action === 'list') {
      const sortedConsumers = [...powerConsumers].sort((a, b) => b.draw - a.draw)

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│                   POWER CONSUMERS                           │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  ID        DEVICE                  DRAW      PRI  STATUS',
          '  ───────   ────────────────────    ────────  ───  ──────',
          ...sortedConsumers.map(c =>
            `  ${c.id}   ${c.name.padEnd(20)}  ${c.draw.toFixed(1).padStart(6)} E/s  P${c.priority}   ${c.status.toUpperCase()}`
          ),
          '',
          '  ─────────────────────────────────────────────────────────────',
          `  TOTAL ACTIVE DRAW: ${totalConsumption.toFixed(1)} E/s (${activeConsumers.length}/${powerConsumers.length} devices)`,
          `  AVAILABLE POWER:   ${totalGeneration.toFixed(1)} E/s`,
          `  HEADROOM:          ${powerBalance >= 0 ? '+' : ''}${powerBalance.toFixed(1)} E/s`,
          '',
          '  Priority Levels:',
          '    P1 = Critical (always on)  P2 = Standard operations',
          '    P3 = Non-essential         P4 = High-power (manual)',
          '',
          '  use power on/off <device-id> to toggle power',
          '',
        ],
      }
    }

    // Show power grid topology
    if (action === 'grid' || action === 'topology') {
      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│                   POWER GRID TOPOLOGY                       │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  ┌─────────────────┐     ┌─────────────────┐',
          '  │   UEC-001       │     │   MFR-001       │',
          '  │ Unstable Core   │     │ Microfusion     │',
          '  │   50 E/s (T1)   │     │  250 E/s (T2)   │',
          '  │   [##########]  │     │   [##########]  │',
          '  └────────┬────────┘     └────────┬────────┘',
          '           │                       │',
          '           └───────────┬───────────┘',
          '                       │',
          '                       ▼',
          '           ┌─────────────────────────┐',
          '           │     MAIN POWER BUS      │',
          '           │  ════════════════════   │',
          '           │     300 E/s AVAILABLE   │',
          '           └───────────┬─────────────┘',
          '                       │',
          '           ┌───────────┴───────────┐',
          '           ▼                       ▼',
          '  ┌─────────────────┐     ┌─────────────────┐',
          '  │   BAT-001       │     │   LOAD CENTER   │',
          '  │ Battery Pack    │     │   36 Devices    │',
          `  │  4250 / 5000 E  │     │  ${totalConsumption.toFixed(1)} E/s Draw  │`,
          '  │   [########--]  │     │   [###########] │',
          '  └─────────────────┘     └─────────────────┘',
          '',
          '  LEGEND: [####] = Load/Capacity bar',
          '',
          '  Grid Protection:',
          '    - Overcurrent protection: ARMED',
          '    - Emergency shutdown: READY',
          '    - Battery backup: ONLINE',
          '',
        ],
      }
    }

    // Turn device power on
    if (action === 'on') {
      if (!target) {
        return {
          success: false,
          error: 'usage: power on <device-id>\nexample: power on tlp-001',
        }
      }

      const device = powerConsumers.find(c => c.id.toLowerCase() === target)
      if (!device) {
        return {
          success: false,
          error: `device not found: ${target}\nuse power devices to see available devices.`,
        }
      }

      if (device.status === 'on') {
        return {
          success: true,
          output: [
            '',
            `[power] ${device.id} is already powered on.`,
            '',
          ],
        }
      }

      // Check if we have enough power
      const newConsumption = totalConsumption + device.draw
      if (newConsumption > totalGeneration) {
        return {
          success: false,
          error: `insufficient power to activate ${device.id}\n` +
            `required: ${device.draw} E/s | available: ${(totalGeneration - totalConsumption).toFixed(1)} E/s\n` +
            `consider shutting down non-essential devices first.`,
        }
      }

      return {
        success: true,
        output: [
          '',
          `[power] activating ${device.name} (${device.id})...`,
          '[power] establishing power connection...... OK',
          '[power] device initialization............ OK',
          '[power] system handshake................. OK',
          '',
          `[power] ${device.id} is now ONLINE`,
          `[power] power draw: ${device.draw} E/s`,
          `[power] new total consumption: ${newConsumption.toFixed(1)} E/s`,
          '',
        ],
      }
    }

    // Turn device power off
    if (action === 'off') {
      if (!target) {
        return {
          success: false,
          error: 'usage: power off <device-id>\nexample: power off sca-001',
        }
      }

      const device = powerConsumers.find(c => c.id.toLowerCase() === target)
      if (!device) {
        return {
          success: false,
          error: `device not found: ${target}\nuse power devices to see available devices.`,
        }
      }

      if (device.status === 'off' || device.status === 'standby') {
        return {
          success: true,
          output: [
            '',
            `[power] ${device.id} is already powered off.`,
            '',
          ],
        }
      }

      // Warn about critical devices
      if (device.priority === 1) {
        if (param !== '-f' && param !== '--force') {
          return {
            success: false,
            error: `${device.id} is a CRITICAL device (P1 priority).\n` +
              `shutting it down may cause system instability.\n` +
              `use power off ${target} -f to force shutdown.`,
          }
        }
      }

      return {
        success: true,
        output: [
          '',
          `[power] shutting down ${device.name} (${device.id})...`,
          '[power] sending shutdown signal.......... OK',
          '[power] flushing device buffers.......... OK',
          '[power] disconnecting power.............. OK',
          '',
          `[power] ${device.id} is now OFFLINE`,
          `[power] power saved: ${device.draw} E/s`,
          `[power] new total consumption: ${(totalConsumption - device.draw).toFixed(1)} E/s`,
          '',
        ],
      }
    }

    // Show fault diagnostics
    if (action === 'fault' || action === 'faults' || action === 'diag') {
      // Simulate some potential faults
      const faults = [
        { level: 'WARN', device: 'UEC-001', message: 'Efficiency below optimal (75% < 80%)', time: '14:23:05' },
        { level: 'INFO', device: 'TLP-001', message: 'High-power device on standby', time: '14:20:00' },
      ]

      const hasCritical = faults.some(f => f.level === 'CRIT')
      const hasWarnings = faults.some(f => f.level === 'WARN')

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│                   POWER FAULT DIAGNOSTICS                   │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          `  SYSTEM STATUS: ${hasCritical ? '! CRITICAL' : hasWarnings ? '! WARNING' : '● NOMINAL'}`,
          '',
          '  FAULT LOG:',
          '  ─────────────────────────────────────────────────────────────',
          ...faults.map(f =>
            `  [${f.time}] ${f.level.padEnd(4)} ${f.device}  ${f.message}`
          ),
          '  ─────────────────────────────────────────────────────────────',
          '',
          '  PROTECTION STATUS:',
          '    Overcurrent Protection.... ARMED',
          '    Undervoltage Lockout...... ARMED',
          '    Thermal Shutdown.......... ARMED',
          '    Emergency Cutoff.......... READY',
          '',
          '  RECOMMENDED ACTIONS:',
          ...faults.filter(f => f.level !== 'INFO').map(f =>
            `    - ${f.device}: Check and resolve ${f.message.toLowerCase()}`
          ),
          '',
          '  use power emergency to initiate emergency shutdown',
          '',
        ],
      }
    }

    // Emergency power shutdown
    if (action === 'emergency' || action === 'shutdown' || action === 'kill') {
      if (target !== '-now' && target !== 'now') {
        return {
          success: false,
          error: 'emergency shutdown requires confirmation.\n' +
            'usage: power emergency -now\n\n' +
            'WARNING: This will shut down all non-critical devices\n' +
            'and switch to battery backup mode.',
        }
      }

      const nonCritical = powerConsumers.filter(c => c.priority > 1 && c.status === 'on')
      const savedPower = nonCritical.reduce((sum, c) => sum + c.draw, 0)

      return {
        success: true,
        output: [
          '',
          '╔═══════════════════════════════════════════════════════════════╗',
          '║              EMERGENCY POWER SHUTDOWN INITIATED               ║',
          '╚═══════════════════════════════════════════════════════════════╝',
          '',
          '[EMERGENCY] Activating emergency protocol...',
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│                   SHUTDOWN SEQUENCE                          │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '[SHUTDOWN] Disabling P4 devices (high-power)...... OK',
          '[SHUTDOWN] Disabling P3 devices (non-essential)... OK',
          '[SHUTDOWN] Disabling P2 devices (standard)........ OK',
          '[SHUTDOWN] P1 devices (critical) maintained....... OK',
          '',
          `[RESULT] ${nonCritical.length} devices shut down`,
          `[RESULT] ${savedPower.toFixed(1)} E/s power saved`,
          `[RESULT] Battery backup engaged`,
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│  CRITICAL SYSTEMS MAINTAINED:                               │',
          '└─────────────────────────────────────────────────────────────┘',
          ...powerConsumers.filter(c => c.priority === 1).map(c =>
            `  ● ${c.id}  ${c.name.padEnd(24)} ${c.draw} E/s`
          ),
          '',
          '[NOTICE] Lab running on minimum power mode.',
          '[NOTICE] Use power on <device-id> to restore devices.',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown power command: ${action}\n\navailable commands:\n` +
        '  power status     - show power overview\n' +
        '  power devices    - list all power consumers\n' +
        '  power grid       - show power grid topology\n' +
        '  power on <id>    - turn on a device\n' +
        '  power off <id>   - turn off a device\n' +
        '  power fault      - show fault diagnostics\n' +
        '  power emergency  - emergency shutdown',
    }
  },
}

// Thermal management command
const thermalCommand: Command = {
  name: 'thermal',
  aliases: ['therm', 'temp', 'cooling'],
  description: 'Panel thermal management system',
  usage: 'thermal [status|fan|auto|emergency]',
  execute: async (args, ctx) => {
    const action = args[0]?.toLowerCase()
    const param = args[1]?.toLowerCase()
    const value = args[2]

    // Default: show status
    if (!action || action === 'status') {
      // This will show simulated/current thermal status
      // Actual real-time data comes from ThermalManager context in panel UI
      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│                 THERMAL MANAGEMENT SYSTEM                    │',
          '│                        THM-001 v1.0.0                        │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  ╔═══════════════════════════════════════════════════════════╗',
          '  ║  THERMAL ZONES                                            ║',
          '  ╠═══════════════════════════════════════════════════════════╣',
          '  ║  ZONE     TEMP     TARGET   STATUS                        ║',
          '  ║  ────     ────     ──────   ──────                        ║',
          '  ║  CPU      ~32°C    45°C     NOMINAL                       ║',
          '  ║  GPU      ~28°C    50°C     NOMINAL                       ║',
          '  ║  PANEL    ~30°C    35°C     NOMINAL                       ║',
          '  ╚═══════════════════════════════════════════════════════════╝',
          '',
          '  ╔═══════════════════════════════════════════════════════════╗',
          '  ║  FAN STATUS                                               ║',
          '  ╠═══════════════════════════════════════════════════════════╣',
          '  ║  FAN      SPEED    RPM      MODE                          ║',
          '  ║  ───      ─────    ───      ────                          ║',
          '  ║  CPU      50%      2400     AUTO                          ║',
          '  ║  GPU      45%      2200     AUTO                          ║',
          '  ╚═══════════════════════════════════════════════════════════╝',
          '',
          '  OVERALL STATUS: NOMINAL',
          '  PERFORMANCE:    100%',
          '  AUTO MODE:      ENABLED',
          '',
          '  Note: Real-time data displayed in panel cooling modules.',
          '        use panel fan controls for manual adjustment.',
          '',
        ],
      }
    }

    // Fan control
    if (action === 'fan') {
      if (!param) {
        return {
          success: false,
          error: 'usage: thermal fan <cpu|gpu> <speed|auto|low|med|high>\nexample: thermal fan cpu 75',
        }
      }

      const fanId = param === 'cpu' || param === 'gpu' ? param : null
      if (!fanId) {
        return {
          success: false,
          error: `unknown fan: ${param}\navailable fans: cpu, gpu`,
        }
      }

      const mode = value?.toUpperCase()
      if (!mode) {
        return {
          success: false,
          error: `usage: thermal fan ${fanId} <speed|auto|low|med|high>`,
        }
      }

      // Validate mode/speed
      if (['AUTO', 'LOW', 'MED', 'HIGH'].includes(mode)) {
        return {
          success: true,
          output: [
            '',
            `[thermal] ${fanId} fan mode set to ${mode.toLowerCase()}`,
            `[thermal] speed will ${mode === 'AUTO' ? 'adjust automatically based on temperature' : `be set to ${mode === 'LOW' ? '25%' : mode === 'MED' ? '50%' : '100%'}`}`,
            '',
            'note: adjust fan controls directly in the panel for immediate effect.',
            '',
          ],
        }
      }

      const speedNum = parseInt(mode)
      if (isNaN(speedNum) || speedNum < 0 || speedNum > 100) {
        return {
          success: false,
          error: `invalid speed: ${mode}\nspeed must be 0-100 or auto/low/med/high`,
        }
      }

      return {
        success: true,
        output: [
          '',
          `[thermal] ${fanId} fan speed set to ${speedNum}%`,
          `[thermal] estimated rpm: ${Math.round((speedNum / 100) * 4000 + 800)}`,
          '',
          'note: use panel fan controls for real-time adjustment.',
          '',
        ],
      }
    }

    // Auto mode toggle
    if (action === 'auto') {
      const enabled = param !== 'off' && param !== '0' && param !== 'false'
      return {
        success: true,
        output: [
          '',
          `[thermal] auto mode ${enabled ? 'enabled' : 'disabled'}`,
          enabled
            ? '[thermal] fans will automatically adjust based on temperature.'
            : '[thermal] manual fan control enabled.',
          '',
        ],
      }
    }

    // Emergency cooling
    if (action === 'emergency' || action === 'cool') {
      return {
        success: true,
        output: [
          '',
          '╔═══════════════════════════════════════════════════════════════╗',
          '║              EMERGENCY COOLING ACTIVATED                      ║',
          '╚═══════════════════════════════════════════════════════════════╝',
          '',
          '[thermal] all fans set to maximum (100%)',
          '[thermal] cpu fan: 4800 rpm',
          '[thermal] gpu fan: 4800 rpm',
          '',
          '[notice] emergency mode will remain active until manually',
          '         disabled or temperature returns to safe levels.',
          '',
          'use thermal auto to restore automatic control.',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown thermal command: ${action}\n\navailable commands:\n  thermal status     - show thermal status\n  thermal fan <id> <mode>  - set fan mode\n  thermal auto [on|off]    - toggle auto mode\n  thermal emergency  - activate emergency cooling`,
    }
  },
}

// ==================================================
// CDC - Crystal Data Cache Management Command
// ==================================================
const cdcCommand: Command = {
  name: 'cdc',
  aliases: ['cache', 'crystalcache'],
  description: 'Crystal Data Cache management and firmware control',
  execute: async (args, ctx) => {
    const [action, ...params] = args

    // Get CDC device from context (for bidirectional sync)
    const cdcDevice = ctx.data.cdcDevice

    // Get firmware and power specs from device or use defaults
    const firmware = cdcDevice?.getFirmware() ?? {
      version: '1.4.2',
      build: '2024.01.15',
      checksum: 'A7F3B2E1',
      securityPatch: '2024.01.10',
      features: ['crystal-index', 'slice-tracking', 'power-calc', 'auto-sync'],
    }

    const powerSpecs = cdcDevice?.getPowerSpecs() ?? {
      full: 15,
      idle: 5,
      standby: 1,
      category: 'medium',
      priority: 1,
    }

    // Get current device state if available
    const deviceState = cdcDevice?.getState()
    const currentStatus = deviceState?.deviceState ?? 'online'
    const currentDraw = deviceState?.currentDraw ?? powerSpecs.idle
    const isPowered = deviceState?.isPowered ?? true

    // Show help if no action
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│          CDC-001: CRYSTAL DATA CACHE                        │',
          '│              Management Console v1.0                        │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  COMMANDS:',
          '    cdc status       - Show device status and power state',
          '    cdc power [on|off] - Toggle power (standby mode)',
          '    cdc firmware     - Show firmware information',
          '    cdc firmware update - Check for firmware updates',
          '    cdc firmware patch  - Apply security patches',
          '    cdc test         - Run hardware diagnostics',
          '    cdc reset        - Reboot device',
          '    cdc fold         - Fold device to compact view',
          '    cdc unfold       - Unfold device to full view',
          '    cdc toggle       - Toggle fold state',
          '    cdc info         - Show full device documentation',
          '',
          '  POWER INTEGRATION:',
          `    Full:    ${powerSpecs.full} E/s  |  Idle: ${powerSpecs.idle} E/s  |  Standby: ${powerSpecs.standby} E/s`,
          '',
        ],
      }
    }

    // FOLD command
    if (action === 'fold') {
      cdcDevice?.setExpanded(false)
      return {
        success: true,
        output: [
          '',
          '  CDC-001 >> Device folded to compact view.',
          '',
        ],
      }
    }

    // UNFOLD command
    if (action === 'unfold') {
      cdcDevice?.setExpanded(true)
      return {
        success: true,
        output: [
          '',
          '  CDC-001 >> Device unfolded to full view.',
          '',
        ],
      }
    }

    // TOGGLE command
    if (action === 'toggle') {
      cdcDevice?.toggleExpanded()
      return {
        success: true,
        output: [
          '',
          '  CDC-001 >> Device fold state toggled.',
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat') {
      ctx.setTyping(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      ctx.setTyping(false)

      const stateLabel = currentStatus === 'standby' ? 'STANDBY' :
                        currentStatus === 'booting' ? 'BOOTING' :
                        currentStatus === 'testing' ? 'TESTING' :
                        currentStatus === 'rebooting' ? 'REBOOTING' :
                        currentStatus === 'shutdown' ? 'SHUTDOWN' : 'ONLINE'
      const modeLabel = currentStatus === 'standby' ? 'STANDBY' :
                       currentStatus === 'testing' ? 'FULL (DIAG)' : 'IDLE'

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│          CDC-001: STATUS REPORT                             │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  DEVICE INFO:',
          '    Name:       Crystal Data Cache',
          '    ID:         CDC-001',
          `    Firmware:   v${firmware.version} (build ${firmware.build})`,
          '    Tech Tree:  Tech Tier 1',
          '',
          '  POWER STATE:',
          `    Status:     ${stateLabel}`,
          `    Mode:       ${modeLabel}`,
          `    Draw:       ${currentDraw} E/s`,
          '    Priority:   P1 (Critical)',
          '',
          '  STORAGE:',
          `    Crystal Index:    ${currentStatus === 'online' ? 'Active' : 'Inactive'}`,
          `    Slice Tracking:   ${currentStatus === 'online' ? 'Active' : 'Inactive'}`,
          `    Auto-Sync:        ${currentStatus === 'online' ? 'Enabled' : 'Disabled'}`,
          `    Cache Coherence:  ${currentStatus === 'online' ? '100%' : 'N/A'}`,
          ...(deviceState ? [
            '',
            '  CACHED DATA:',
            `    Crystals:   ${deviceState.crystalCount}`,
            `    Slices:     ${deviceState.sliceCount}`,
            `    Power Gen:  ${deviceState.totalPower.toFixed(1)} E/s`,
          ] : []),
          '',
          '  CONNECTIONS:',
          '    UEC-001:    Connected (Power)',
          '    BAT-001:    Connected (Backup)',
          '    HMS-001:    Connected (Synthesis)',
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power') {
      const powerState = params[0]?.toLowerCase()

      if (!powerState || (powerState !== 'on' && powerState !== 'off')) {
        return {
          success: true,
          output: [
            '',
            '  CDC-001 POWER CONTROL:',
            '',
            '    cdc power on   - Boot device from standby',
            '    cdc power off  - Enter standby mode (1 E/s)',
            '',
            `  Current State: ${currentStatus === 'standby' ? 'STANDBY' : 'ONLINE'}`,
            `  Current Draw:  ${currentDraw} E/s`,
            '',
          ],
        }
      }

      // Check if device is already in the requested state
      if (powerState === 'off' && currentStatus === 'standby') {
        return {
          success: false,
          error: '[CDC-001] Device is already in STANDBY mode',
        }
      }
      if (powerState === 'on' && currentStatus === 'online') {
        return {
          success: false,
          error: '[CDC-001] Device is already ONLINE',
        }
      }

      // Check if device is busy
      if (currentStatus === 'booting' || currentStatus === 'testing' || currentStatus === 'rebooting' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[CDC-001] Cannot change power state while device is ${currentStatus.toUpperCase()}`,
        }
      }

      ctx.setTyping(true)

      if (powerState === 'off') {
        // Trigger actual shutdown on device UI
        if (cdcDevice) {
          await cdcDevice.powerOff()
        } else {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[CDC-001] Initiating shutdown sequence...',
            '[CDC-001] Saving cache state...',
            '[CDC-001] Flushing buffers...',
            '[CDC-001] Releasing resources...',
            '[CDC-001] System halted',
            '',
            '[CDC-001] Device entered STANDBY mode',
            `[CDC-001] Power draw: ${powerSpecs.standby} E/s`,
            '',
          ],
        }
      } else {
        // Trigger actual boot on device UI
        if (cdcDevice) {
          await cdcDevice.powerOn()
        } else {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[CDC-001] Initiating boot sequence...',
            '[CDC-001] POST check.............. OK',
            '[CDC-001] Memory init............. OK',
            '[CDC-001] Cache allocate.......... OK',
            '[CDC-001] Bus connect............. OK',
            '[CDC-001] Data sync............... OK',
            '',
            '[CDC-001] Device is now ONLINE',
            `[CDC-001] Power draw: ${powerSpecs.idle} E/s`,
            '',
          ],
        }
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw') {
      const fwAction = params[0]?.toLowerCase()

      if (!fwAction) {
        return {
          success: true,
          output: [
            '',
            '┌─────────────────────────────────────────────────────────────┐',
            '│          CDC-001: FIRMWARE INFORMATION                      │',
            '└─────────────────────────────────────────────────────────────┘',
            '',
            '  INSTALLED FIRMWARE:',
            `    Version:        v${firmware.version}`,
            `    Build Date:     ${firmware.build}`,
            `    Checksum:       ${firmware.checksum}`,
            `    Security Patch: ${firmware.securityPatch}`,
            '',
            '  INSTALLED FEATURES:',
            ...firmware.features.map(f => `    • ${f}`),
            '',
            '  COMMANDS:',
            '    cdc firmware update  - Check for updates',
            '    cdc firmware patch   - Apply security patches',
            '    cdc firmware verify  - Verify firmware integrity',
            '',
          ],
        }
      }

      if (fwAction === 'update' || fwAction === 'check') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1200))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[FIRMWARE] Checking for updates...',
            '[FIRMWARE] Contacting update server...',
            '[FIRMWARE] Comparing versions...',
            '',
            `[FIRMWARE] Installed: v${firmware.version}`,
            '[FIRMWARE] Latest:    v1.4.2',
            '',
            '[FIRMWARE] Your firmware is up to date.',
            '',
          ],
        }
      }

      if (fwAction === 'patch') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[SECURITY] Checking for security patches...',
            '[SECURITY] Analyzing vulnerabilities...',
            '[SECURITY] Verifying patch signatures...',
            '',
            `[SECURITY] Last patch: ${firmware.securityPatch}`,
            '[SECURITY] No new security patches available.',
            '',
            '[SECURITY] Device is fully patched.',
            '',
          ],
        }
      }

      if (fwAction === 'verify') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1000))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[VERIFY] Running firmware integrity check...',
            '[VERIFY] Calculating checksum...',
            '[VERIFY] Comparing with manifest...',
            '',
            `[VERIFY] Expected: ${firmware.checksum}`,
            `[VERIFY] Actual:   ${firmware.checksum}`,
            '',
            '[VERIFY] Firmware integrity: VERIFIED',
            '',
          ],
        }
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag') {
      // Check if device is online
      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[CDC-001] Cannot run diagnostics - device is ${currentStatus.toUpperCase()}\n\nUse 'cdc power on' to boot the device first.`,
        }
      }

      ctx.setTyping(true)

      // Trigger actual test on device UI
      if (cdcDevice) {
        await cdcDevice.runTest()
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│          CDC-001: HARDWARE DIAGNOSTICS                      │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  [TEST] Memory integrity............ PASS',
          '  [TEST] Data bus connection......... PASS',
          '  [TEST] Cache coherence............. PASS',
          '  [TEST] Power supply................ PASS',
          '  [TEST] Communication protocol...... PASS',
          '',
          '  RESULT: All diagnostics PASSED',
          `  TIME:   ${new Date().toISOString()}`,
          '',
        ],
      }
    }

    // RESET command
    if (action === 'reset' || action === 'reboot') {
      // Check if device can be rebooted
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[CDC-001] Cannot reboot - device is ${currentStatus.toUpperCase()}\n\nUse 'cdc power on' to boot the device first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: `[CDC-001] Cannot reboot - device is currently ${currentStatus.toUpperCase()}`,
        }
      }

      ctx.setTyping(true)

      // Trigger actual reboot on device UI
      if (cdcDevice) {
        await cdcDevice.reboot()
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '[CDC-001] Initiating reboot...',
          '[STOP]  Halting device.............. OK',
          '[FLUSH] Clearing data buffers....... OK',
          '[POST]  Power-on self test.......... OK',
          '[INIT]  Initializing subsystems..... OK',
          '[SYNC]  Re-synchronizing data....... OK',
          '[BOOT]  Device online............... OK',
          '',
          '[CDC-001] Reboot complete',
          `[TIME]   ${new Date().toISOString()}`,
          '',
        ],
      }
    }

    // INFO command - full documentation
    if (action === 'info' || action === 'doc' || action === 'help') {
      return {
        success: true,
        output: [
          '',
          '╔═══════════════════════════════════════════════════════════════╗',
          '║          CDC-001: CRYSTAL DATA CACHE                          ║',
          '║              Technical Documentation                          ║',
          '╚═══════════════════════════════════════════════════════════════╝',
          '',
          '  OVERVIEW:',
          '    The Crystal Data Cache is a crystalline data storage device',
          '    used for research archives. It indexes and tracks all crystal',
          '    and slice data from the blockchain, providing real-time',
          '    inventory tracking and power calculations.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:    CDC-001',
          `    Firmware:     v${firmware.version}`,
          '    Tech Tree:    Tech Tier 1',
          '    Category:     Medium Power Consumer',
          '',
          '  POWER CONSUMPTION:',
          '    ┌───────────┬────────────┬───────────────────────────────┐',
          '    │ State     │ Draw (E/s) │ Notes                         │',
          '    ├───────────┼────────────┼───────────────────────────────┤',
          `    │ Full      │ ${String(powerSpecs.full).padStart(10)} │ Active indexing/sync          │`,
          `    │ Idle      │ ${String(powerSpecs.idle).padStart(10)} │ Monitoring mode               │`,
          `    │ Standby   │ ${String(powerSpecs.standby).padStart(10)} │ Minimal power (data retained) │`,
          '    └───────────┴────────────┴───────────────────────────────┘',
          '',
          '  FEATURES:',
          '    • Crystal indexing - Tracks all owned crystals (_unITM)',
          '    • Slice tracking   - Monitors 30 slices per crystal (_unSLC)',
          '    • Power calculation - Calculates total crystal power output',
          '    • Auto-sync        - Automatic blockchain synchronization',
          '',
          '  COMPATIBLE DEVICES:',
          '    UEC-001  Unstable Energy Core    (Power supply)',
          '    BAT-001  Battery Pack            (Backup power)',
          '    HMS-001  Handmade Synthesizer    (Slice synthesis)',
          '',
          '  COMMANDS:',
          '    cdc status          - Show device status',
          '    cdc power [on|off]  - Toggle power state',
          '    cdc firmware        - View firmware info',
          '    cdc firmware update - Check for updates',
          '    cdc firmware patch  - Apply security patches',
          '    cdc test            - Run diagnostics',
          '    cdc reset           - Reboot device',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/cdc-001/',
          '    /var/log/cdc/',
          '    /etc/cdc/firmware.conf',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown cdc command: ${action}\n\ntype cdc for available commands.`,
    }
  },
}

// ==================================================
// UEC COMMAND - Unstable Energy Core management
// ==================================================
const uecCommand: Command = {
  name: 'uec',
  aliases: ['energycore', 'core', 'energy'],
  description: 'Unstable Energy Core management and firmware control',
  execute: async (args, ctx) => {
    const [action, ...params] = args

    // Get UEC device from context (for bidirectional sync)
    const uecDevice = ctx.data.uecDevice

    // Get firmware and power specs from device or use defaults
    const firmware = uecDevice?.getFirmware() ?? {
      version: '2.0.1',
      build: '2024.02.08',
      checksum: 'E9C4F7A2',
      securityPatch: '2024.02.01',
      features: ['volatility-tracking', 'tps-monitor', 'tier-calc', 'network-sync', 'field-stabilizer'],
    }

    const powerSpecs = uecDevice?.getPowerSpecs() ?? {
      outputMax: 500,
      outputPerTier: 100,
      selfConsume: 10,
      standby: 2,
      category: 'generator',
      priority: 0,
    }

    // Get current device state if available
    const deviceState = uecDevice?.getState()
    const currentStatus = deviceState?.deviceState ?? 'online'
    const isPowered = deviceState?.isPowered ?? true
    const energyOutput = deviceState?.energyOutput ?? 0
    const fieldStability = deviceState?.fieldStability ?? 0
    const volatilityTier = deviceState?.volatilityTier ?? 1
    const tps = deviceState?.tps ?? 0

    // Show help if no action
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│          UEC-001: UNSTABLE ENERGY CORE                      │',
          '│              Management Console v1.0                        │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  COMMANDS:',
          '    uec status       - Show device status and power output',
          '    uec power [on|off] - Toggle power (standby mode)',
          '    uec firmware     - Show firmware information',
          '    uec firmware update - Check for firmware updates',
          '    uec firmware patch  - Apply security patches',
          '    uec test         - Run hardware diagnostics',
          '    uec reset        - Reboot device',
          '    uec fold         - Fold device to compact view',
          '    uec unfold       - Unfold device to full view',
          '    uec toggle       - Toggle fold state',
          '    uec info         - Show full device documentation',
          '',
          '  POWER OUTPUT:',
          `    Per Tier:  ${powerSpecs.outputPerTier} E/s  |  Max: ${powerSpecs.outputMax} E/s (T5)`,
          `    Self-Use:  ${powerSpecs.selfConsume} E/s  |  Standby: ${powerSpecs.standby} E/s`,
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat') {
      ctx.setTyping(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      ctx.setTyping(false)

      const stateLabel = currentStatus === 'standby' ? 'STANDBY' :
                        currentStatus === 'booting' ? 'BOOTING' :
                        currentStatus === 'testing' ? 'TESTING' :
                        currentStatus === 'rebooting' ? 'REBOOTING' :
                        currentStatus === 'shutdown' ? 'SHUTDOWN' : 'ONLINE'

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│          UEC-001: STATUS REPORT                             │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  DEVICE INFO:',
          '    Name:       Unstable Energy Core',
          '    ID:         UEC-001',
          `    Firmware:   v${firmware.version} (build ${firmware.build})`,
          '    Category:   Power Generator (P0 - Critical)',
          '',
          '  POWER STATE:',
          `    Status:     ${stateLabel}`,
          `    Output:     ${currentStatus === 'online' ? energyOutput : 0} E/s`,
          `    Max Output: ${powerSpecs.outputMax} E/s (at T5)`,
          `    Self-Use:   ${currentStatus === 'standby' ? powerSpecs.standby : powerSpecs.selfConsume} E/s`,
          '',
          '  ENERGY FIELD:',
          `    Volatility Tier: T${volatilityTier}`,
          `    Network TPS:     ${tps.toLocaleString()}`,
          `    Field Stability: ${currentStatus === 'online' ? fieldStability : 0}%`,
          `    Energy Level:    ${currentStatus === 'online' ? volatilityTier * 20 : 0}%`,
          '',
          '  CONNECTED CONSUMERS:',
          '    CDC-001:    Crystal Data Cache    (15 E/s)',
          '    BAT-001:    Battery Pack          (5 E/s)',
          '    HMS-001:    Handmade Synthesizer  (20 E/s)',
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power') {
      const powerState = params[0]?.toLowerCase()

      if (!powerState || (powerState !== 'on' && powerState !== 'off')) {
        return {
          success: true,
          output: [
            '',
            '  UEC-001 POWER CONTROL:',
            '',
            '    uec power on   - Boot core from standby',
            '    uec power off  - Enter standby mode',
            '',
            `  Current State: ${currentStatus === 'standby' ? 'STANDBY' : 'ONLINE'}`,
            `  Current Output: ${currentStatus === 'online' ? energyOutput : 0} E/s`,
            '',
            '  WARNING: Shutting down the Energy Core will affect',
            '           all connected devices!',
            '',
          ],
        }
      }

      // Check if device is already in the requested state
      if (powerState === 'off' && currentStatus === 'standby') {
        return {
          success: false,
          error: '[UEC-001] Core is already in STANDBY mode',
        }
      }
      if (powerState === 'on' && currentStatus === 'online') {
        return {
          success: false,
          error: '[UEC-001] Core is already ONLINE',
        }
      }

      // Check if device is busy
      if (currentStatus === 'booting' || currentStatus === 'testing' || currentStatus === 'rebooting' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[UEC-001] Cannot change power state while core is ${currentStatus.toUpperCase()}`,
        }
      }

      ctx.setTyping(true)

      if (powerState === 'off') {
        if (uecDevice) {
          await uecDevice.powerOff()
        } else {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[UEC-001] Initiating shutdown sequence...',
            '[UEC-001] Draining capacitors...',
            '[UEC-001] Releasing energy field...',
            '[UEC-001] Core halted',
            '',
            '[UEC-001] Core entered STANDBY mode',
            `[UEC-001] Power draw: ${powerSpecs.standby} E/s`,
            '',
            '  WARNING: Connected devices may lose power!',
            '',
          ],
        }
      } else {
        if (uecDevice) {
          await uecDevice.powerOn()
        } else {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[UEC-001] Initiating boot sequence...',
            '[UEC-001] POST check.............. OK',
            '[UEC-001] Voltage calibration..... OK',
            '[UEC-001] Frequency sync.......... OK',
            '[UEC-001] Network connect......... OK',
            '[UEC-001] Energy stabilize........ OK',
            '',
            '[UEC-001] Core is now ONLINE',
            `[UEC-001] Energy output: ${powerSpecs.outputPerTier * volatilityTier} E/s (T${volatilityTier})`,
            '',
          ],
        }
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw') {
      const fwAction = params[0]?.toLowerCase()

      if (!fwAction) {
        return {
          success: true,
          output: [
            '',
            '┌─────────────────────────────────────────────────────────────┐',
            '│          UEC-001: FIRMWARE INFORMATION                      │',
            '└─────────────────────────────────────────────────────────────┘',
            '',
            '  INSTALLED FIRMWARE:',
            `    Version:        v${firmware.version}`,
            `    Build Date:     ${firmware.build}`,
            `    Checksum:       ${firmware.checksum}`,
            `    Security Patch: ${firmware.securityPatch}`,
            '',
            '  INSTALLED FEATURES:',
            ...firmware.features.map(f => `    • ${f}`),
            '',
            '  COMMANDS:',
            '    uec firmware update  - Check for updates',
            '    uec firmware patch   - Apply security patches',
            '    uec firmware verify  - Verify firmware integrity',
            '',
          ],
        }
      }

      if (fwAction === 'update' || fwAction === 'check') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1200))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[FIRMWARE] Checking for updates...',
            '[FIRMWARE] Contacting update server...',
            '[FIRMWARE] Comparing versions...',
            '',
            `[FIRMWARE] Installed: v${firmware.version}`,
            '[FIRMWARE] Latest:    v2.0.1',
            '',
            '[FIRMWARE] Your firmware is up to date.',
            '',
          ],
        }
      }

      if (fwAction === 'patch') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[SECURITY] Checking for security patches...',
            '[SECURITY] Analyzing vulnerabilities...',
            '[SECURITY] Verifying patch signatures...',
            '',
            `[SECURITY] Last patch: ${firmware.securityPatch}`,
            '[SECURITY] No new security patches available.',
            '',
            '[SECURITY] Core is fully patched.',
            '',
          ],
        }
      }

      if (fwAction === 'verify') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1000))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[VERIFY] Running firmware integrity check...',
            '[VERIFY] Calculating checksum...',
            '[VERIFY] Comparing with manifest...',
            '',
            `[VERIFY] Expected: ${firmware.checksum}`,
            `[VERIFY] Actual:   ${firmware.checksum}`,
            '',
            '[VERIFY] Firmware integrity: VERIFIED',
            '',
          ],
        }
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag') {
      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[UEC-001] Cannot run diagnostics - core is ${currentStatus.toUpperCase()}\n\nUse 'uec power on' to boot the core first.`,
        }
      }

      ctx.setTyping(true)

      if (uecDevice) {
        await uecDevice.runTest()
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│          UEC-001: HARDWARE DIAGNOSTICS                      │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  [TEST] Voltage regulators.......... PASS',
          '  [TEST] Frequency sync.............. PASS',
          '  [TEST] Field stability............. PASS',
          '  [TEST] Power output................ PASS',
          '  [TEST] Network sync................ PASS',
          '',
          '  RESULT: All diagnostics PASSED',
          `  TIME:   ${new Date().toISOString()}`,
          '',
        ],
      }
    }

    // RESET command
    if (action === 'reset' || action === 'reboot') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[UEC-001] Cannot reboot - core is ${currentStatus.toUpperCase()}\n\nUse 'uec power on' to boot the core first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: `[UEC-001] Cannot reboot - core is currently ${currentStatus.toUpperCase()}`,
        }
      }

      ctx.setTyping(true)

      if (uecDevice) {
        await uecDevice.reboot()
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '[UEC-001] Initiating reboot...',
          '[STOP]  Draining capacitors......... OK',
          '[STOP]  Releasing energy field...... OK',
          '[POST]  Power-on self test.......... OK',
          '[INIT]  Voltage calibration......... OK',
          '[INIT]  Frequency synchronization... OK',
          '[BOOT]  Core online................. OK',
          '',
          '[UEC-001] Reboot complete',
          `[TIME]   ${new Date().toISOString()}`,
          '',
        ],
      }
    }

    // INFO command - full documentation
    if (action === 'info' || action === 'doc' || action === 'help') {
      return {
        success: true,
        output: [
          '',
          '╔═══════════════════════════════════════════════════════════════╗',
          '║          UEC-001: UNSTABLE ENERGY CORE                        ║',
          '║              Technical Documentation                          ║',
          '╚═══════════════════════════════════════════════════════════════╝',
          '',
          '  OVERVIEW:',
          '    The Unstable Energy Core is the primary power generator for',
          '    the laboratory. It converts blockchain volatility (TPS) into',
          '    usable energy, powering all connected devices.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:    UEC-001',
          `    Firmware:     v${firmware.version}`,
          '    Category:     Power Generator (P0 - Critical)',
          '    Priority:     0 (Highest - power source)',
          '',
          '  POWER OUTPUT:',
          '    ┌───────────┬────────────┬───────────────────────────────┐',
          '    │ Tier      │ Output E/s │ Notes                         │',
          '    ├───────────┼────────────┼───────────────────────────────┤',
          '    │ T1        │        100 │ Low network activity          │',
          '    │ T2        │        200 │ Normal activity               │',
          '    │ T3        │        300 │ Elevated activity             │',
          '    │ T4        │        400 │ High activity                 │',
          '    │ T5        │        500 │ Extreme volatility            │',
          '    ├───────────┼────────────┼───────────────────────────────┤',
          `    │ Self-Use  │ ${String(powerSpecs.selfConsume).padStart(10)} │ Internal consumption          │`,
          `    │ Standby   │ ${String(powerSpecs.standby).padStart(10)} │ Minimal power mode            │`,
          '    └───────────┴────────────┴───────────────────────────────┘',
          '',
          '  FEATURES:',
          '    • Volatility tracking - Monitors blockchain TPS',
          '    • Tier calculation    - Converts TPS to energy tiers',
          '    • Field stabilizer    - Maintains stable energy output',
          '    • Network sync        - Real-time blockchain connection',
          '    • Auto-scaling        - Adjusts output based on demand',
          '',
          '  CONNECTED DEVICES:',
          '    CDC-001  Crystal Data Cache      (Consumer)',
          '    BAT-001  Battery Pack            (Storage)',
          '    HMS-001  Handmade Synthesizer    (Consumer)',
          '',
          '  COMMANDS:',
          '    uec status          - Show core status',
          '    uec power [on|off]  - Toggle power state',
          '    uec firmware        - View firmware info',
          '    uec firmware update - Check for updates',
          '    uec firmware patch  - Apply security patches',
          '    uec test            - Run diagnostics',
          '    uec reset           - Reboot core',
          '    uec fold            - Fold to compact view',
          '    uec unfold          - Unfold to full view',
          '    uec toggle          - Toggle fold state',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/uec-001/',
          '    /var/log/uec/',
          '    /etc/uec/firmware.conf',
          '',
        ],
      }
    }

    // FOLD command
    if (action === 'fold') {
      if (!uecDevice) return { success: false, error: '[UEC-001] Device not connected' }
      uecDevice.setExpanded(false)
      return { success: true, output: ['', '[UEC-001] Device folded to compact view', ''] }
    }

    // UNFOLD command
    if (action === 'unfold') {
      if (!uecDevice) return { success: false, error: '[UEC-001] Device not connected' }
      uecDevice.setExpanded(true)
      return { success: true, output: ['', '[UEC-001] Device unfolded to full view', ''] }
    }

    // TOGGLE command
    if (action === 'toggle') {
      if (!uecDevice) return { success: false, error: '[UEC-001] Device not connected' }
      uecDevice.toggleExpanded()
      return { success: true, output: ['', '[UEC-001] Device fold state toggled', ''] }
    }

    return {
      success: false,
      error: `unknown uec command: ${action}\n\ntype uec for available commands.`,
    }
  },
}

// ==================================================
// BAT COMMAND - Portable Battery Pack management
// ==================================================
const batCommand: Command = {
  name: 'bat',
  aliases: ['battery', 'pack', 'batterypack'],
  description: 'Portable Battery Pack management and firmware control',
  execute: async (args, ctx) => {
    const [action, ...params] = args

    // Get BAT device from context (for bidirectional sync)
    const batDevice = ctx.data.batDevice

    // Get firmware and power specs from device or use defaults
    const firmware = batDevice?.getFirmware() ?? {
      version: '1.8.0',
      build: '2024.01.20',
      checksum: 'B4C7D9E2',
      securityPatch: '2024.01.15',
      features: ['cell-monitor', 'auto-regen', 'capacity-track', 'thermal-protect', 'cdc-handshake'],
    }

    const powerSpecs = batDevice?.getPowerSpecs() ?? {
      capacity: 5000,
      chargeRate: 100,
      dischargeRate: 150,
      selfDischarge: 0.5,
      standbyDrain: 0.1,
      category: 'storage',
      priority: 2,
    }

    // Get current device state if available
    const deviceState = batDevice?.getState()
    const currentStatus = deviceState?.deviceState ?? 'online'
    const isPowered = deviceState?.isPowered ?? true
    const chargePercent = deviceState?.chargePercent ?? 100
    const currentCharge = deviceState?.currentCharge ?? 5000
    const cellHealth = deviceState?.cellHealth ?? [98, 99, 97, 100]
    const temperature = deviceState?.temperature ?? 28
    const autoRegen = deviceState?.autoRegen ?? true

    // No action - show help
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│          BAT-001: PORTABLE BATTERY PACK                     │',
          '│              Management Console v1.0                        │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  COMMANDS:',
          '    bat status       - Show battery status and charge level',
          '    bat power [on|off] - Toggle power (standby mode)',
          '    bat firmware     - Show firmware information',
          '    bat firmware update - Check for firmware updates',
          '    bat firmware patch  - Apply security patches',
          '    bat test         - Run battery diagnostics',
          '    bat reset        - Reboot device',
          '    bat regen [on|off] - Toggle auto-regeneration',
          '    bat fold         - Fold device to compact view',
          '    bat unfold       - Unfold device to full view',
          '    bat toggle       - Toggle fold state',
          '    bat info         - Show full device documentation',
          '',
          '  STORAGE CAPACITY:',
          `    Capacity:  ${powerSpecs.capacity} E`,
          `    Charge:    ${powerSpecs.chargeRate} E/s  |  Discharge: ${powerSpecs.dischargeRate} E/s (burst)`,
          '',
          `  Current State: ${currentStatus.toUpperCase()}`,
          `  Charge Level:  ${chargePercent}% (${currentCharge}/${powerSpecs.capacity} E)`,
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat' || action === 's') {
      const avgCellHealth = cellHealth.reduce((a, b) => a + b, 0) / cellHealth.length

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│              BAT-001 STATUS                                 │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          `  State:        ${currentStatus.toUpperCase()}`,
          `  Powered:      ${isPowered ? 'YES' : 'NO (Standby)'}`,
          '',
          '  CHARGE STATUS:',
          `    Level:      ${chargePercent}%`,
          `    Stored:     ${currentCharge} / ${powerSpecs.capacity} E`,
          `    Auto-Regen: ${autoRegen ? 'ACTIVE' : 'DISABLED'}`,
          '',
          '  CELL HEALTH:',
          `    Cell 1:     ${cellHealth[0]}%`,
          `    Cell 2:     ${cellHealth[1]}%`,
          `    Cell 3:     ${cellHealth[2]}%`,
          `    Cell 4:     ${cellHealth[3]}%`,
          `    Average:    ${avgCellHealth.toFixed(1)}%`,
          '',
          '  THERMAL:',
          `    Temperature: ${temperature}°C`,
          `    Status:      ${temperature < 35 ? 'NOMINAL' : temperature < 45 ? 'WARM' : 'HOT'}`,
          '',
          '  TRANSFER RATES:',
          `    Charge:     ${powerSpecs.chargeRate} E/s`,
          `    Discharge:  ${powerSpecs.dischargeRate} E/s (burst)`,
          `    Self-drain: ${powerSpecs.selfDischarge} E/s`,
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power' || action === 'pwr') {
      const powerState = params[0]?.toLowerCase()

      if (!powerState) {
        return {
          success: true,
          output: [
            '',
            '  BAT-001 POWER CONTROL:',
            '',
            '    bat power on   - Boot pack from standby',
            '    bat power off  - Enter standby mode',
            '',
            `  Current State: ${currentStatus === 'standby' ? 'STANDBY' : 'ONLINE'}`,
            `  Charge Level:  ${chargePercent}%`,
            '',
            '  NOTE: Battery retains charge in standby mode.',
            '  Self-discharge rate in standby: 0.1 E/s',
            '',
          ],
        }
      }

      if (powerState !== 'on' && powerState !== 'off') {
        return {
          success: false,
          error: `invalid power state: ${powerState}\n\nUsage: bat power [on|off]`,
        }
      }

      if (powerState === 'off' && currentStatus === 'standby') {
        return {
          success: false,
          error: '[BAT-001] Pack already in standby mode.',
        }
      }

      if (powerState === 'on' && currentStatus !== 'standby') {
        return {
          success: false,
          error: '[BAT-001] Pack already online.',
        }
      }

      ctx.setTyping(true)

      if (powerState === 'off') {
        if (batDevice) {
          await batDevice.powerOff()
        } else {
          await new Promise(resolve => setTimeout(resolve, 600))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║   BAT-001 ENTERING STANDBY MODE           ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [✓] State saved',
            '  [✓] Connections paused',
            '  [✓] Pack hibernating',
            '',
            '  Status: STANDBY',
            '  Charge preserved at: ' + chargePercent + '%',
            '',
          ],
        }
      } else {
        if (batDevice) {
          await batDevice.powerOn()
        } else {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║   BAT-001 BOOTING FROM STANDBY            ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [✓] Cell array initialized',
            '  [✓] Voltage calibrated',
            '  [✓] CDC handshake complete',
            '  [✓] Auto-regen active',
            '',
            '  Status: ONLINE',
            '  Charge: ' + chargePercent + '%',
            '',
          ],
        }
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw') {
      const subAction = params[0]?.toLowerCase()

      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            '┌─────────────────────────────────────────────────────────────┐',
            '│              BAT-001 FIRMWARE                               │',
            '└─────────────────────────────────────────────────────────────┘',
            '',
            `  Version:        ${firmware.version}`,
            `  Build:          ${firmware.build}`,
            `  Checksum:       ${firmware.checksum}`,
            `  Security Patch: ${firmware.securityPatch}`,
            '',
            '  INSTALLED FEATURES:',
            ...firmware.features.map(f => `    • ${f}`),
            '',
            '  COMMANDS:',
            '    bat firmware update - Check for updates',
            '    bat firmware patch  - Apply security patches',
            '',
          ],
        }
      }

      if (subAction === 'update') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  BAT-001 FIRMWARE UPDATE CHECK',
            '  ─────────────────────────────',
            '',
            '  Checking UnstableLabs repository...',
            '',
            `  Current:   v${firmware.version}`,
            '  Available: v1.8.0 (latest)',
            '',
            '  ✓ Firmware is up to date.',
            '',
            '  Last check: ' + new Date().toISOString().slice(0, 19).replace('T', ' '),
            '',
          ],
        }
      }

      if (subAction === 'patch') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1200))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  BAT-001 SECURITY PATCH STATUS',
            '  ─────────────────────────────',
            '',
            `  Current Patch: ${firmware.securityPatch}`,
            '  Patch Status:  UP TO DATE',
            '',
            '  Recent Security Fixes:',
            '    • Cell isolation improved',
            '    • Thermal runaway protection',
            '    • CDC handshake hardened',
            '',
            '  No patches required.',
            '',
          ],
        }
      }

      return {
        success: false,
        error: `unknown firmware command: ${subAction}\n\nUsage: bat firmware [update|patch]`,
      }
    }

    // REGEN command
    if (action === 'regen' || action === 'regenerate' || action === 'autoregen') {
      const regenState = params[0]?.toLowerCase()

      if (!regenState) {
        return {
          success: true,
          output: [
            '',
            '  BAT-001 AUTO-REGENERATION:',
            '',
            '    bat regen on   - Enable auto-regeneration',
            '    bat regen off  - Disable auto-regeneration',
            '',
            `  Current: ${autoRegen ? 'ENABLED' : 'DISABLED'}`,
            '',
            '  Auto-regen passively restores charge over time',
            '  when connected to power sources.',
            '',
          ],
        }
      }

      if (regenState !== 'on' && regenState !== 'off') {
        return {
          success: false,
          error: `invalid regen state: ${regenState}\n\nUsage: bat regen [on|off]`,
        }
      }

      if (batDevice) {
        batDevice.setAutoRegen(regenState === 'on')
      }

      return {
        success: true,
        output: [
          '',
          `  [BAT-001] Auto-regeneration ${regenState === 'on' ? 'ENABLED' : 'DISABLED'}.`,
          '',
        ],
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag') {
      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[BAT-001] Cannot run diagnostics - pack is ${currentStatus.toUpperCase()}\n\nUse 'bat power on' to boot the pack first.`,
        }
      }

      ctx.setTyping(true)

      if (batDevice) {
        await batDevice.runTest()
      } else {
        await new Promise(resolve => setTimeout(resolve, 1800))
      }
      ctx.setTyping(false)

      const avgHealth = cellHealth.reduce((a, b) => a + b, 0) / cellHealth.length

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│           BAT-001 DIAGNOSTICS REPORT                        │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  TEST RESULTS:',
          '    [✓] Cell array integrity     PASS',
          '    [✓] Voltage levels           PASS',
          '    [✓] Capacity verification    PASS',
          '    [✓] Discharge rate test      PASS',
          '    [✓] Thermal sensors          PASS',
          '',
          '  SUMMARY:',
          `    Overall Status:  HEALTHY`,
          `    Cell Health:     ${avgHealth.toFixed(1)}%`,
          `    Charge Level:    ${chargePercent}%`,
          `    Temperature:     ${temperature}°C`,
          '',
          '  All systems operational.',
          '',
        ],
      }
    }

    // RESET command
    if (action === 'reset' || action === 'reboot') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[BAT-001] Cannot reboot - pack is ${currentStatus.toUpperCase()}\n\nUse 'bat power on' to boot the pack first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: '[BAT-001] Cannot reboot - operation in progress.',
        }
      }

      ctx.setTyping(true)

      if (batDevice) {
        await batDevice.reboot()
      } else {
        await new Promise(resolve => setTimeout(resolve, 1200))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      BAT-001 REBOOT SEQUENCE              ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [✓] State saved',
          '  [✓] Connections closed',
          '  [✓] Safe shutdown',
          '  [✓] Cell check passed',
          '  [✓] Voltage calibrated',
          '  [✓] CDC handshake established',
          '  [✓] Auto-regen active',
          '',
          '  Status: ONLINE',
          `  Charge: ${chargePercent}%`,
          '',
        ],
      }
    }

    // INFO command
    if (action === 'info' || action === 'docs' || action === 'documentation') {
      return {
        success: true,
        output: [
          '',
          '╔═════════════════════════════════════════════════════════════════╗',
          '║                 BAT-001: PORTABLE BATTERY PACK                   ║',
          '║                    Technical Documentation                       ║',
          '╠═════════════════════════════════════════════════════════════════╣',
          '',
          '  DEVICE OVERVIEW:',
          '    The Portable Battery Pack (BAT-001) provides energy storage',
          '    for the laboratory. It stores excess power from generators',
          '    and releases it during high-demand periods.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:      BAT-001',
          '    Category:       Storage',
          '    Priority:       P2 (Secondary)',
          '',
          '  STORAGE CHARACTERISTICS:',
          '    Capacity:       5,000 E',
          '    Charge Rate:    100 E/s',
          '    Discharge Rate: 150 E/s (burst)',
          '    Self-Discharge: 0.5 E/s (idle)',
          '    Standby Drain:  0.1 E/s',
          '',
          '  CELL ARRAY:',
          '    4 independent cells with health monitoring.',
          '    Each cell can be individually tested.',
          '    Thermal protection prevents overheating.',
          '',
          `  FIRMWARE: v${firmware.version}`,
          '  FEATURES:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  CONNECTED DEVICES:',
          '    UEC-001  Unstable Energy Core    (Charger)',
          '    CDC-001  Crystal Data Cache      (Consumer)',
          '    EXD-001  Explorer Drone          (Field Use)',
          '',
          '  COMMANDS:',
          '    bat status          - Show battery status',
          '    bat power [on|off]  - Toggle power state',
          '    bat firmware        - View firmware info',
          '    bat firmware update - Check for updates',
          '    bat firmware patch  - Apply security patches',
          '    bat regen [on|off]  - Toggle auto-regeneration',
          '    bat test            - Run diagnostics',
          '    bat reset           - Reboot pack',
          '    bat fold            - Fold to compact view',
          '    bat unfold          - Unfold to full view',
          '    bat toggle          - Toggle fold state',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/bat-001/',
          '    /var/log/bat/',
          '    /etc/bat/config',
          '',
          '╚═════════════════════════════════════════════════════════════════╝',
          '',
        ],
      }
    }

    // FOLD command
    if (action === 'fold') {
      if (!batDevice) return { success: false, error: '[BAT-001] Device not connected' }
      batDevice.setExpanded(false)
      return { success: true, output: ['', '[BAT-001] Device folded to compact view', ''] }
    }

    // UNFOLD command
    if (action === 'unfold') {
      if (!batDevice) return { success: false, error: '[BAT-001] Device not connected' }
      batDevice.setExpanded(true)
      return { success: true, output: ['', '[BAT-001] Device unfolded to full view', ''] }
    }

    // TOGGLE command
    if (action === 'toggle') {
      if (!batDevice) return { success: false, error: '[BAT-001] Device not connected' }
      batDevice.toggleExpanded()
      return { success: true, output: ['', '[BAT-001] Device fold state toggled', ''] }
    }

    return {
      success: false,
      error: `unknown bat command: ${action}\n\ntype bat for available commands.`,
    }
  },
}

// ==================================================
// HMS - Handmade Synthesizer Management Command
// ==================================================
const hmsCommand: Command = {
  name: 'hms',
  aliases: ['synth', 'synthesizer'],
  description: 'Handmade Synthesizer management and firmware control',
  execute: async (args, ctx) => {
    const [action, ...params] = args

    // Get HMS device from context (for bidirectional sync)
    const hmsDevice = ctx.data.hmsDevice

    // Get firmware and power specs from device or use defaults
    const firmware = hmsDevice?.getFirmware() ?? {
      version: '3.2.1',
      build: '2024.02.15',
      checksum: 'C5D8E3F1',
      securityPatch: '2024.02.10',
      features: ['multi-osc', 'waveform-gen', 'filter-bank', 'slice-synthesis', 'trait-morph'],
    }

    const powerSpecs = hmsDevice?.getPowerSpecs() ?? {
      full: 8,
      idle: 3,
      standby: 0.5,
      resonance: 12,
      category: 'medium',
      priority: 3,
    }

    // Get current device state if available
    const deviceState = hmsDevice?.getState()
    const currentStatus = deviceState?.deviceState ?? 'online'
    const isPowered = deviceState?.isPowered ?? true
    const pulseValue = deviceState?.pulseValue ?? 35
    const tempoValue = deviceState?.tempoValue ?? 40
    const freqValue = deviceState?.freqValue ?? 37
    const waveformType = deviceState?.waveformType ?? 'sine'
    const oscillatorCount = deviceState?.oscillatorCount ?? 4
    const currentTier = deviceState?.currentTier ?? 1

    // Calculate current draw based on state
    const currentDraw = currentStatus === 'standby' ? powerSpecs.standby :
                       currentStatus === 'testing' ? powerSpecs.full :
                       powerSpecs.idle

    // Show help if no action
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│          HMS-001: HANDMADE SYNTHESIZER                      │',
          '│              Management Console v1.0                        │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  COMMANDS:',
          '    hms status       - Show device status and parameters',
          '    hms power [on|off] - Toggle power (standby mode)',
          '    hms firmware     - Show firmware information',
          '    hms firmware update - Check for firmware updates',
          '    hms firmware patch  - Apply security patches',
          '    hms test         - Run hardware diagnostics',
          '    hms reset        - Reboot device',
          '    hms wave [type]  - Set waveform (sine|square|saw|triangle)',
          '    hms knob [p|t|f] [value] - Set knob value (0-100)',
          '    hms fold         - Fold device to compact view',
          '    hms unfold       - Unfold device to full view',
          '    hms toggle       - Toggle fold state',
          '    hms info         - Show full device documentation',
          '',
          '  POWER INTEGRATION:',
          `    Full: ${powerSpecs.full} E/s | Idle: ${powerSpecs.idle} E/s | Standby: ${powerSpecs.standby} E/s | Resonance: ${powerSpecs.resonance} E/s`,
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat') {
      ctx.setTyping(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      ctx.setTyping(false)

      const stateLabel = currentStatus === 'standby' ? 'STANDBY' :
                        currentStatus === 'booting' ? 'BOOTING' :
                        currentStatus === 'testing' ? 'TESTING' :
                        currentStatus === 'rebooting' ? 'REBOOTING' :
                        currentStatus === 'shutdown' ? 'SHUTDOWN' : 'ONLINE'
      const modeLabel = currentStatus === 'standby' ? 'STANDBY' :
                       currentStatus === 'testing' ? 'FULL (DIAG)' : 'IDLE'

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│          HMS-001: STATUS REPORT                             │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  DEVICE INFO:',
          '    Name:       Handmade Synthesizer',
          '    ID:         HMS-001',
          `    Firmware:   v${firmware.version} (build ${firmware.build})`,
          '    Tech Tree:  Synthesizers',
          `    Tier:       ${currentTier}/5`,
          '',
          '  POWER STATE:',
          `    Status:     ${stateLabel}`,
          `    Mode:       ${modeLabel}`,
          `    Draw:       ${currentDraw} E/s`,
          '    Priority:   P3 (Medium)',
          '',
          '  OSCILLATOR STATUS:',
          `    Oscillators:  ${oscillatorCount} active`,
          `    Waveform:     ${waveformType.toUpperCase()}`,
          '',
          '  KNOB VALUES:',
          `    PULSE:  ${pulseValue.toString().padStart(3)} [${'#'.repeat(Math.floor(pulseValue / 10))}${'-'.repeat(10 - Math.floor(pulseValue / 10))}]`,
          `    TEMPO:  ${tempoValue.toString().padStart(3)} [${'#'.repeat(Math.floor(tempoValue / 10))}${'-'.repeat(10 - Math.floor(tempoValue / 10))}]`,
          `    FREQ:   ${freqValue.toString().padStart(3)} [${'#'.repeat(Math.floor(freqValue / 10))}${'-'.repeat(10 - Math.floor(freqValue / 10))}]`,
          '',
          '  CONNECTED DEVICES:',
          '    CDC-001:    Connected (Data)',
          '    UEC-001:    Connected (Power)',
          '    IPL-001:    Connected (Optics)',
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power') {
      const powerState = params[0]?.toLowerCase()

      if (!powerState || (powerState !== 'on' && powerState !== 'off')) {
        return {
          success: true,
          output: [
            '',
            '  HMS-001 POWER CONTROL:',
            '',
            '    hms power on   - Boot synth from standby',
            '    hms power off  - Enter standby mode (0.5 E/s)',
            '',
            `  Current State: ${currentStatus === 'standby' ? 'STANDBY' : 'ONLINE'}`,
            `  Current Draw:  ${currentDraw} E/s`,
            '',
          ],
        }
      }

      // Check if device is already in the requested state
      if (powerState === 'off' && currentStatus === 'standby') {
        return {
          success: false,
          error: '[HMS-001] Synthesizer is already in STANDBY mode',
        }
      }
      if (powerState === 'on' && currentStatus === 'online') {
        return {
          success: false,
          error: '[HMS-001] Synthesizer is already ONLINE',
        }
      }

      // Check if device is busy
      if (currentStatus === 'booting' || currentStatus === 'testing' || currentStatus === 'rebooting' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[HMS-001] Cannot change power state while synth is ${currentStatus.toUpperCase()}`,
        }
      }

      ctx.setTyping(true)

      if (powerState === 'off') {
        // Trigger actual shutdown on device UI
        if (hmsDevice) {
          await hmsDevice.powerOff()
        } else {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[HMS-001] Initiating shutdown sequence...',
            '[HMS-001] Draining oscillator buffers...',
            '[HMS-001] Waveform generator offline...',
            '[HMS-001] Filter bank discharged...',
            '[HMS-001] System halted',
            '',
            '[HMS-001] Synthesizer entered STANDBY mode',
            `[HMS-001] Power draw: ${powerSpecs.standby} E/s`,
            '',
          ],
        }
      } else {
        // Trigger actual boot on device UI
        if (hmsDevice) {
          await hmsDevice.powerOn()
        } else {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[HMS-001] Initiating boot sequence...',
            '[HMS-001] Power on................. OK',
            '[HMS-001] Oscillator init.......... OK',
            '[HMS-001] Waveform generator....... OK',
            '[HMS-001] Filter bank.............. OK',
            '[HMS-001] Calibration.............. OK',
            '',
            '[HMS-001] Synthesizer is now ONLINE',
            `[HMS-001] Power draw: ${powerSpecs.idle} E/s`,
            '',
          ],
        }
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw') {
      const fwAction = params[0]?.toLowerCase()

      if (!fwAction) {
        return {
          success: true,
          output: [
            '',
            '┌─────────────────────────────────────────────────────────────┐',
            '│          HMS-001: FIRMWARE INFORMATION                      │',
            '└─────────────────────────────────────────────────────────────┘',
            '',
            '  INSTALLED FIRMWARE:',
            `    Version:        v${firmware.version}`,
            `    Build Date:     ${firmware.build}`,
            `    Checksum:       ${firmware.checksum}`,
            `    Security Patch: ${firmware.securityPatch}`,
            '',
            '  INSTALLED FEATURES:',
            ...firmware.features.map(f => `    • ${f}`),
            '',
            '  COMMANDS:',
            '    hms firmware update  - Check for updates',
            '    hms firmware patch   - Apply security patches',
            '    hms firmware verify  - Verify firmware integrity',
            '',
          ],
        }
      }

      if (fwAction === 'update' || fwAction === 'check') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1200))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[FIRMWARE] Checking for updates...',
            '[FIRMWARE] Contacting update server...',
            '[FIRMWARE] Comparing versions...',
            '',
            `[FIRMWARE] Installed: v${firmware.version}`,
            '[FIRMWARE] Latest:    v3.2.1',
            '',
            '[FIRMWARE] Your firmware is up to date.',
            '',
          ],
        }
      }

      if (fwAction === 'patch') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[SECURITY] Checking for security patches...',
            '[SECURITY] Analyzing vulnerabilities...',
            '[SECURITY] Verifying patch signatures...',
            '',
            `[SECURITY] Last patch: ${firmware.securityPatch}`,
            '[SECURITY] No new security patches available.',
            '',
            '[SECURITY] Device is fully patched.',
            '',
          ],
        }
      }

      if (fwAction === 'verify') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1000))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '[VERIFY] Running firmware integrity check...',
            '[VERIFY] Calculating checksum...',
            '[VERIFY] Comparing with manifest...',
            '',
            `[VERIFY] Expected: ${firmware.checksum}`,
            `[VERIFY] Actual:   ${firmware.checksum}`,
            '',
            '[VERIFY] Firmware integrity: VERIFIED',
            '',
          ],
        }
      }
    }

    // WAVE command - set waveform type
    if (action === 'wave' || action === 'waveform') {
      const waveType = params[0]?.toLowerCase()

      if (!waveType) {
        return {
          success: true,
          output: [
            '',
            '  HMS-001 WAVEFORM CONTROL:',
            '',
            '    hms wave sine     - Smooth sine wave',
            '    hms wave square   - Digital square wave',
            '    hms wave saw      - Sawtooth wave',
            '    hms wave triangle - Triangle wave',
            '',
            `  Current: ${waveformType.toUpperCase()}`,
            '',
          ],
        }
      }

      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[HMS-001] Cannot change waveform - synth is ${currentStatus.toUpperCase()}\n\nUse 'hms power on' to boot the synth first.`,
        }
      }

      const validWaves = ['sine', 'square', 'saw', 'triangle']
      if (!validWaves.includes(waveType)) {
        return {
          success: false,
          error: `invalid waveform: ${waveType}\n\nValid types: sine, square, saw, triangle`,
        }
      }

      if (hmsDevice) {
        hmsDevice.setWaveform(waveType as 'sine' | 'square' | 'saw' | 'triangle')
      }

      return {
        success: true,
        output: [
          '',
          `  [HMS-001] Waveform set to ${waveType.toUpperCase()}.`,
          '',
        ],
      }
    }

    // KNOB command - set knob values
    if (action === 'knob' || action === 'k') {
      const knobType = params[0]?.toLowerCase()
      const knobValue = params[1] ? parseInt(params[1], 10) : undefined

      if (!knobType) {
        return {
          success: true,
          output: [
            '',
            '  HMS-001 KNOB CONTROL:',
            '',
            '    hms knob p [value]  - Set PULSE (0-100)',
            '    hms knob t [value]  - Set TEMPO (0-100)',
            '    hms knob f [value]  - Set FREQ (0-100)',
            '',
            '  CURRENT VALUES:',
            `    PULSE:  ${pulseValue}`,
            `    TEMPO:  ${tempoValue}`,
            `    FREQ:   ${freqValue}`,
            '',
          ],
        }
      }

      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[HMS-001] Cannot adjust knobs - synth is ${currentStatus.toUpperCase()}\n\nUse 'hms power on' to boot the synth first.`,
        }
      }

      const knobMap: Record<string, 'pulse' | 'tempo' | 'freq'> = {
        p: 'pulse', pulse: 'pulse',
        t: 'tempo', tempo: 'tempo',
        f: 'freq', freq: 'freq',
      }

      const knob = knobMap[knobType]
      if (!knob) {
        return {
          success: false,
          error: `invalid knob: ${knobType}\n\nValid knobs: p (pulse), t (tempo), f (freq)`,
        }
      }

      if (knobValue === undefined || isNaN(knobValue) || knobValue < 0 || knobValue > 100) {
        return {
          success: false,
          error: `invalid value: ${params[1] ?? 'missing'}\n\nValue must be 0-100`,
        }
      }

      if (hmsDevice) {
        hmsDevice.setKnobValue(knob, knobValue)
      }

      return {
        success: true,
        output: [
          '',
          `  [HMS-001] ${knob.toUpperCase()} set to ${knobValue}.`,
          '',
        ],
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag') {
      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[HMS-001] Cannot run diagnostics - synth is ${currentStatus.toUpperCase()}\n\nUse 'hms power on' to boot the synth first.`,
        }
      }

      ctx.setTyping(true)

      if (hmsDevice) {
        await hmsDevice.runTest()
      } else {
        await new Promise(resolve => setTimeout(resolve, 1800))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│           HMS-001 DIAGNOSTICS REPORT                        │',
          '└─────────────────────────────────────────────────────────────┘',
          '',
          '  TEST RESULTS:',
          '    [✓] Oscillator array        PASS',
          '    [✓] Waveform generator      PASS',
          '    [✓] Filter bank             PASS',
          '    [✓] Output stage            PASS',
          '    [✓] Calibration             PASS',
          '',
          '  SUMMARY:',
          `    Oscillators:  ${oscillatorCount} active`,
          `    Waveform:     ${waveformType.toUpperCase()}`,
          `    Tier:         ${currentTier}/5`,
          '',
          '  All systems operational.',
          '',
        ],
      }
    }

    // RESET command
    if (action === 'reset' || action === 'reboot') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[HMS-001] Cannot reboot - synth is ${currentStatus.toUpperCase()}\n\nUse 'hms power on' to boot the synth first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: '[HMS-001] Cannot reboot - operation in progress.',
        }
      }

      ctx.setTyping(true)

      if (hmsDevice) {
        await hmsDevice.reboot()
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      HMS-001 REBOOT SEQUENCE              ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [✓] Buffers drained',
          '  [✓] Power cycled',
          '  [✓] Oscillators initialized',
          '  [✓] Waveform generator ready',
          '  [✓] Filter bank calibrated',
          '  [✓] System online',
          '',
          '  Status: ONLINE',
          `  Waveform: ${waveformType.toUpperCase()}`,
          '',
        ],
      }
    }

    // INFO command
    if (action === 'info' || action === 'docs' || action === 'documentation') {
      return {
        success: true,
        output: [
          '',
          '╔═════════════════════════════════════════════════════════════════╗',
          '║                 HMS-001: HANDMADE SYNTHESIZER                    ║',
          '║                    Technical Documentation                       ║',
          '╠═════════════════════════════════════════════════════════════════╣',
          '',
          '  DEVICE OVERVIEW:',
          '    The Handmade Synthesizer (HMS-001) is a multi-oscillator',
          '    waveform generator used for crystal slice synthesis and',
          '    trait morphing operations in the laboratory.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:      HMS-001',
          '    Category:       Medium Consumer',
          '    Priority:       P3 (Medium)',
          '    Tech Tree:      Synthesizers',
          '',
          '  POWER CHARACTERISTICS:',
          '    Full Operation: 8 E/s',
          '    Idle Mode:      3 E/s',
          '    Standby:        0.5 E/s',
          '    Resonance Mode: 12 E/s',
          '',
          '  OSCILLATOR SYSTEM:',
          '    Base oscillators: 4 (Tier 1)',
          '    Max oscillators:  8 (Tier 5)',
          '    Waveforms: sine, square, saw, triangle',
          '',
          '  KNOB CONTROLS:',
          '    PULSE - Controls oscillator pulse width (0-100)',
          '    TEMPO - Controls synthesis tempo/rate (0-100)',
          '    FREQ  - Controls output frequency (0-100)',
          '',
          `  FIRMWARE: v${firmware.version}`,
          '  FEATURES:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  TIER CAPABILITIES:',
          '    T1: Basic synthesis, 4 oscillators',
          '    T2: Slice morphing, 5 oscillators',
          '    T3: State manipulation, 6 oscillators',
          '    T4: Advanced synthesis, 7 oscillators',
          '    T5: Full spectrum, 8 oscillators',
          '',
          '  CONNECTED DEVICES:',
          '    CDC-001  Crystal Data Cache    (Data Feed)',
          '    UEC-001  Unstable Energy Core  (Power)',
          '    IPL-001  Interpolator          (Optics)',
          '',
          '  COMMANDS:',
          '    hms status          - Show synth status',
          '    hms power [on|off]  - Toggle power state',
          '    hms firmware        - View firmware info',
          '    hms wave [type]     - Set waveform type',
          '    hms knob [k] [val]  - Adjust knob values',
          '    hms test            - Run diagnostics',
          '    hms reset           - Reboot synth',
          '    hms fold            - Fold to compact view',
          '    hms unfold          - Unfold to full view',
          '    hms toggle          - Toggle fold state',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/hms-001/',
          '    /var/log/hms/',
          '    /etc/hms/config',
          '',
          '╚═════════════════════════════════════════════════════════════════╝',
          '',
        ],
      }
    }

    // FOLD command
    if (action === 'fold') {
      if (!hmsDevice) return { success: false, error: '[HMS-001] Device not connected' }
      hmsDevice.setExpanded(false)
      return { success: true, output: ['', '[HMS-001] Device folded to compact view', ''] }
    }

    // UNFOLD command
    if (action === 'unfold') {
      if (!hmsDevice) return { success: false, error: '[HMS-001] Device not connected' }
      hmsDevice.setExpanded(true)
      return { success: true, output: ['', '[HMS-001] Device unfolded to full view', ''] }
    }

    // TOGGLE command
    if (action === 'toggle') {
      if (!hmsDevice) return { success: false, error: '[HMS-001] Device not connected' }
      hmsDevice.toggleExpanded()
      return { success: true, output: ['', '[HMS-001] Device fold state toggled', ''] }
    }

    return {
      success: false,
      error: `unknown hms command: ${action}\n\ntype hms for available commands.`,
    }
  },
}

// ECR-001: Echo Recorder control command
const ecrCommand: Command = {
  name: 'ecr',
  aliases: ['echo-recorder', 'ecr001'],
  description: 'Echo Recorder management (ECR-001)',
  usage: 'ecr [status|power|firmware|test|reset|record|knob|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const ecrDevice = ctx.data.ecrDevice
    const action = args[0]?.toLowerCase()

    // Get current state from device if available
    const state = ecrDevice?.getState() ?? {
      deviceState: 'standby',
      statusMessage: '',
      isPowered: false,
      pulseValue: 0,
      bloomValue: 0,
      tickerTap: 0,
      isRecording: false,
      signalStrength: 0,
      currentTier: 1,
    }
    const firmware = ecrDevice?.getFirmware() ?? {
      version: '1.1.0',
      build: '2024.01.28',
      checksum: 'D7E9F2A3',
      features: ['blockchain-feed', 'rotation-track', 'oracle-sync', 'signal-decode', 'ticker-tap'],
      securityPatch: '2024.01.25',
    }
    const powerSpecs = ecrDevice?.getPowerSpecs() ?? {
      full: 5,
      idle: 2,
      standby: 0.3,
      recording: 7,
      category: 'low',
      priority: 4,
    }

    const currentStatus = state.deviceState
    const isPowered = state.isPowered
    const pulseValue = state.pulseValue
    const bloomValue = state.bloomValue
    const tickerTap = state.tickerTap
    const isRecording = state.isRecording
    const signalStrength = state.signalStrength
    const currentTier = state.currentTier

    // No args - show usage
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '╭─────────────────────────────────────────────────╮',
          '│          ECR-001 :: ECHO RECORDER               │',
          '╰─────────────────────────────────────────────────╯',
          '',
          '  USAGE:',
          '    ecr status          Show recorder status',
          '    ecr power [on|off]  Toggle power/standby',
          '    ecr firmware        View firmware info',
          '    ecr test            Run diagnostics',
          '    ecr reset           Reboot device',
          '    ecr record [on|off] Toggle recording mode',
          '    ecr knob [k] [val]  Adjust knob values (p=pulse, b=bloom)',
          '    ecr info            Full documentation',
          '    ecr fold            Fold device to compact view',
          '    ecr unfold          Unfold device to full view',
          '    ecr toggle          Toggle fold state',
          '',
          '  EXAMPLES:',
          '    ecr power on        Boot the recorder',
          '    ecr record on       Start recording blockchain feed',
          '    ecr knob p 75       Set pulse to 75%',
          '    ecr knob b 50       Set bloom to 50%',
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat' || action === 's') {
      const stateSymbol = currentStatus === 'online' ? '●' : currentStatus === 'standby' ? '○' : '◐'
      const stateColor = currentStatus === 'online' ? 'ONLINE' : currentStatus.toUpperCase()
      const recordSymbol = isRecording ? '◉ REC' : '○ IDLE'

      // Signal bar visualization
      const signalBars = Math.round(signalStrength / 20)
      const signalDisplay = '▁▂▃▅▆'.slice(0, signalBars).padEnd(5, ' ')

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         ECR-001 STATUS REPORT             │',
          '  └───────────────────────────────────────────┘',
          '',
          `     Device State:   ${stateSymbol} ${stateColor}`,
          `     Power:          ${isPowered ? 'ACTIVE' : 'STANDBY'}`,
          `     Recording:      ${recordSymbol}`,
          `     Signal:         ${signalDisplay} ${signalStrength}%`,
          '',
          '  ┌─────────────────────────────────────────────┐',
          '  │  KNOBS                 │  METRICS           │',
          '  ├─────────────────────────┼────────────────────┤',
          `  │  PULSE    [${String(pulseValue).padStart(3)}%]     │  Tier:      T${currentTier}      │`,
          `  │  BLOOM    [${String(bloomValue).padStart(3)}%]     │  Ticker:    ${String(tickerTap).padStart(3)}      │`,
          '  └─────────────────────────┴────────────────────┘',
          '',
          `  Firmware: v${firmware.version}   Category: ${powerSpecs.category.toUpperCase()}`,
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power' || action === 'pwr' || action === 'p') {
      const subAction = args[1]?.toLowerCase()

      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  ECR-001 Power: ${isPowered ? 'ACTIVE' : 'STANDBY'}`,
            '',
            '  Usage: ecr power [on|off]',
            '',
          ],
        }
      }

      if (subAction === 'on' || subAction === 'boot' || subAction === 'start') {
        if (isPowered && (currentStatus === 'online' || currentStatus === 'booting')) {
          return {
            success: false,
            error: `[ECR-001] Already ${currentStatus.toUpperCase()}.`,
          }
        }

        ctx.setTyping(true)

        if (ecrDevice) {
          await ecrDevice.powerOn()
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      ECR-001 BOOT SEQUENCE                ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [■□□□□□] Initializing blockchain receiver...',
            '  [■■□□□□] Loading oracle connections...',
            '  [■■■□□□] Calibrating signal decoder...',
            '  [■■■■□□] Starting ticker tap interface...',
            '  [■■■■■□] Syncing rotation tracker...',
            '  [■■■■■■] System ready',
            '',
            '  Status: ONLINE',
            '  Recording: STANDBY',
            '  Signal Locked: YES',
            '',
          ],
        }
      }

      if (subAction === 'off' || subAction === 'shutdown' || subAction === 'stop') {
        if (!isPowered || currentStatus === 'standby' || currentStatus === 'shutdown') {
          return {
            success: false,
            error: '[ECR-001] Already in standby mode.',
          }
        }
        if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
          return {
            success: false,
            error: `[ECR-001] Cannot shutdown - operation in progress (${currentStatus}).`,
          }
        }

        ctx.setTyping(true)

        if (ecrDevice) {
          await ecrDevice.powerOff()
        } else {
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      ECR-001 SHUTDOWN SEQUENCE            ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [✓] Recording stopped',
            '  [✓] Signal disconnected',
            '  [✓] Oracle feed closed',
            '  [✓] Buffers flushed',
            '  [✓] Power state saved',
            '',
            '  Status: STANDBY',
            '  Power Draw: 0.3 E/s',
            '',
          ],
        }
      }

      return {
        success: false,
        error: `Unknown power action: ${subAction}\n\nUsage: ecr power [on|off]`,
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw' || action === 'f') {
      const subAction = args[1]?.toLowerCase()

      if (subAction === 'update' || subAction === 'upgrade') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ┌─────────────────────────────────────────────┐',
            '  │       ECR-001 FIRMWARE UPDATE CHECK         │',
            '  └─────────────────────────────────────────────┘',
            '',
            `  Current Version:   v${firmware.version}`,
            '  Latest Version:    v1.1.0',
            '',
            '  [✓] Firmware is up to date.',
            '',
            `  Security Patch:    ${firmware.securityPatch}`,
            '  Status:            NO UPDATE REQUIRED',
            '',
          ],
        }
      }

      return {
        success: true,
        output: [
          '',
          '  ┌─────────────────────────────────────────────┐',
          '  │         ECR-001 FIRMWARE INFO               │',
          '  └─────────────────────────────────────────────┘',
          '',
          `  Version:       v${firmware.version}`,
          `  Build:         ${firmware.build}`,
          `  Checksum:      ${firmware.checksum}`,
          `  Security:      ${firmware.securityPatch}`,
          '',
          '  FEATURES:',
          ...firmware.features.map(f => `    ◆ ${f}`),
          '',
          '  Use: ecr firmware update - to check for updates',
          '',
        ],
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag' || action === 'diagnostics') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[ECR-001] Cannot run diagnostics - recorder is ${currentStatus.toUpperCase()}\n\nUse 'ecr power on' to boot the recorder first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: '[ECR-001] Cannot run diagnostics - operation in progress.',
        }
      }

      ctx.setTyping(true)

      if (ecrDevice) {
        await ecrDevice.runTest()
      } else {
        await new Promise(resolve => setTimeout(resolve, 2500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      ECR-001 DIAGNOSTIC SEQUENCE          ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  Running self-test...',
          '',
          '  [✓] Blockchain receiver      PASSED',
          '  [✓] Oracle connection        PASSED',
          '  [✓] Signal decoder           PASSED',
          '  [✓] Ticker tap interface     PASSED',
          '  [✓] Rotation tracker         PASSED',
          '  [✓] Recording buffer         PASSED',
          '  [✓] Memory integrity         PASSED',
          '  [✓] Power subsystem          PASSED',
          '',
          '  ─────────────────────────────────────────────',
          '  DIAGNOSTIC RESULT: ALL TESTS PASSED',
          `  Signal Strength: ${signalStrength}%`,
          `  Current Tier: T${currentTier}`,
          '  ─────────────────────────────────────────────',
          '',
        ],
      }
    }

    // RECORD command
    if (action === 'record' || action === 'rec' || action === 'r') {
      const subAction = args[1]?.toLowerCase()

      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[ECR-001] Cannot toggle recording - recorder is ${currentStatus.toUpperCase()}\n\nUse 'ecr power on' to boot the recorder first.`,
        }
      }

      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  ECR-001 Recording: ${isRecording ? '◉ ACTIVE' : '○ STANDBY'}`,
            '',
            '  Usage: ecr record [on|off]',
            '',
          ],
        }
      }

      if (subAction === 'on' || subAction === 'start') {
        if (isRecording) {
          return {
            success: false,
            error: '[ECR-001] Already recording.',
          }
        }

        ctx.setTyping(true)

        if (ecrDevice) {
          ecrDevice.setRecording(true)
        }
        await new Promise(resolve => setTimeout(resolve, 800))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      ECR-001 RECORDING STARTED            ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [✓] Blockchain feed locked',
            '  [✓] Oracle stream connected',
            '  [✓] Recording buffer active',
            '',
            '  Status: ◉ RECORDING',
            `  Power Draw: ${powerSpecs.recording} E/s`,
            '',
          ],
        }
      }

      if (subAction === 'off' || subAction === 'stop') {
        if (!isRecording) {
          return {
            success: false,
            error: '[ECR-001] Not currently recording.',
          }
        }

        ctx.setTyping(true)

        if (ecrDevice) {
          ecrDevice.setRecording(false)
        }
        await new Promise(resolve => setTimeout(resolve, 500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      ECR-001 RECORDING STOPPED            ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [✓] Recording buffer saved',
            '  [✓] Oracle stream paused',
            '',
            '  Status: ○ IDLE',
            `  Power Draw: ${powerSpecs.idle} E/s`,
            '',
          ],
        }
      }

      return {
        success: false,
        error: `Unknown record action: ${subAction}\n\nUsage: ecr record [on|off]`,
      }
    }

    // KNOB command
    if (action === 'knob' || action === 'k' || action === 'set') {
      const knobArg = args[1]?.toLowerCase()
      const valueArg = args[2]

      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[ECR-001] Cannot adjust knobs - recorder is ${currentStatus.toUpperCase()}\n\nUse 'ecr power on' to boot the recorder first.`,
        }
      }

      if (!knobArg) {
        return {
          success: true,
          output: [
            '',
            '  ECR-001 Knob Values:',
            '',
            `    PULSE [P]  ${String(pulseValue).padStart(3)}%  - Signal pulse width`,
            `    BLOOM [B]  ${String(bloomValue).padStart(3)}%  - Visual bloom intensity`,
            '',
            '  Usage: ecr knob [p|b] [0-100]',
            '',
            '  Examples:',
            '    ecr knob p 75    Set pulse to 75%',
            '    ecr knob b 50    Set bloom to 50%',
            '',
          ],
        }
      }

      // Map knob argument to full name
      let knobName: 'pulse' | 'bloom' | null = null
      if (knobArg === 'p' || knobArg === 'pulse') {
        knobName = 'pulse'
      } else if (knobArg === 'b' || knobArg === 'bloom') {
        knobName = 'bloom'
      }

      if (!knobName) {
        return {
          success: false,
          error: `Unknown knob: ${knobArg}\n\nAvailable knobs: p (pulse), b (bloom)`,
        }
      }

      if (!valueArg) {
        const currentValue = knobName === 'pulse' ? pulseValue : bloomValue
        return {
          success: true,
          output: [
            '',
            `  ECR-001 ${knobName.toUpperCase()}: ${currentValue}%`,
            '',
            `  Usage: ecr knob ${knobArg} [0-100]`,
            '',
          ],
        }
      }

      const newValue = parseInt(valueArg, 10)
      if (isNaN(newValue) || newValue < 0 || newValue > 100) {
        return {
          success: false,
          error: `Invalid value: ${valueArg}\n\nValue must be between 0 and 100.`,
        }
      }

      // Update knob via device actions
      if (ecrDevice) {
        ecrDevice.setKnobValue(knobName, newValue)
      }

      const displayName = knobName.toUpperCase()
      const oldValue = knobName === 'pulse' ? pulseValue : bloomValue
      const barLength = 20
      const filledOld = Math.round((oldValue / 100) * barLength)
      const filledNew = Math.round((newValue / 100) * barLength)
      const oldBar = '█'.repeat(filledOld) + '░'.repeat(barLength - filledOld)
      const newBar = '█'.repeat(filledNew) + '░'.repeat(barLength - filledNew)

      return {
        success: true,
        output: [
          '',
          `  ECR-001 ${displayName} adjusted:`,
          '',
          `    Old: [${oldBar}] ${String(oldValue).padStart(3)}%`,
          `    New: [${newBar}] ${String(newValue).padStart(3)}%`,
          '',
        ],
      }
    }

    // RESET/REBOOT command
    if (action === 'reset' || action === 'reboot') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[ECR-001] Cannot reboot - recorder is ${currentStatus.toUpperCase()}\n\nUse 'ecr power on' to boot the recorder first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: '[ECR-001] Cannot reboot - operation in progress.',
        }
      }

      ctx.setTyping(true)

      if (ecrDevice) {
        await ecrDevice.reboot()
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      ECR-001 REBOOT SEQUENCE              ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [✓] Recording stopped',
          '  [✓] Buffers flushed',
          '  [✓] Power cycled',
          '  [✓] Blockchain receiver initialized',
          '  [✓] Oracle connections restored',
          '  [✓] System online',
          '',
          '  Status: ONLINE',
          '  Recording: STANDBY',
          '',
        ],
      }
    }

    // FOLD command
    if (action === 'fold') {
      if (!ecrDevice) return { success: false, error: '[ECR-001] Device not connected' }
      ecrDevice.setExpanded(false)
      return {
        success: true,
        output: ['', '  ECR-001 folded.', ''],
      }
    }

    // UNFOLD command
    if (action === 'unfold') {
      if (!ecrDevice) return { success: false, error: '[ECR-001] Device not connected' }
      ecrDevice.setExpanded(true)
      return {
        success: true,
        output: ['', '  ECR-001 unfolded.', ''],
      }
    }

    // TOGGLE fold command
    if (action === 'toggle') {
      if (!ecrDevice) return { success: false, error: '[ECR-001] Device not connected' }
      ecrDevice.toggleExpanded()
      const st = ecrDevice.getState()
      return {
        success: true,
        output: ['', `  ECR-001 ${st.isExpanded ? 'unfolded' : 'folded'}.`, ''],
      }
    }

    // INFO command
    if (action === 'info' || action === 'docs' || action === 'documentation') {
      return {
        success: true,
        output: [
          '',
          '╔═════════════════════════════════════════════════════════════════╗',
          '║                  ECR-001: ECHO RECORDER                         ║',
          '║                    Technical Documentation                      ║',
          '╠═════════════════════════════════════════════════════════════════╣',
          '',
          '  DEVICE OVERVIEW:',
          '    The Echo Recorder (ECR-001) is a blockchain monitoring device',
          '    that captures and decodes on-chain activity signals for',
          '    crystal trait analysis and volatility tracking.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:      ECR-001',
          '    Category:       Low Consumer',
          '    Priority:       P4 (Low)',
          '    Tech Tree:      Signal Processing',
          '',
          '  POWER CHARACTERISTICS:',
          '    Full Operation: 5 E/s',
          '    Idle Mode:      2 E/s',
          '    Standby:        0.3 E/s',
          '    Recording Mode: 7 E/s',
          '',
          '  SIGNAL SYSTEM:',
          '    Signal decode:   Blockchain TPS analysis',
          '    Oracle sync:     Real-time price feeds',
          '    Ticker tap:      Block confirmation tracking',
          '    Rotation track:  Crystal spin direction analysis',
          '',
          '  KNOB CONTROLS:',
          '    PULSE - Controls signal pulse width (0-100)',
          '    BLOOM - Controls visual bloom intensity (0-100)',
          '',
          `  FIRMWARE: v${firmware.version}`,
          '  FEATURES:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  TIER CAPABILITIES:',
          '    T1: Basic recording, signal decode',
          '    T2: Oracle sync, price tracking',
          '    T3: Advanced analysis, pattern recognition',
          '    T4: Predictive algorithms, trend detection',
          '    T5: Full spectrum analysis, AI integration',
          '',
          '  CONNECTED DEVICES:',
          '    CDC-001  Crystal Data Cache    (Data Feed)',
          '    UEC-001  Unstable Energy Core  (Power)',
          '    HMS-001  Handmade Synthesizer  (Waveform Input)',
          '',
          '  COMMANDS:',
          '    ecr status           - Show recorder status',
          '    ecr power [on|off]   - Toggle power state',
          '    ecr firmware         - View firmware info',
          '    ecr record [on|off]  - Toggle recording mode',
          '    ecr knob [k] [val]   - Adjust knob values',
          '    ecr test             - Run diagnostics',
          '    ecr reset            - Reboot recorder',
          '    ecr fold             - Fold device to compact view',
          '    ecr unfold           - Unfold device to full view',
          '    ecr toggle           - Toggle fold state',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/ecr-001/',
          '    /var/log/ecr/',
          '    /etc/ecr/config',
          '',
          '╚═════════════════════════════════════════════════════════════════╝',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown ecr command: ${action}\n\ntype ecr for available commands.`,
    }
  },
}

// INT-001: Interpolator control command
const iplCommand: Command = {
  name: 'ipl',
  aliases: ['interpolator', 'int001'],
  description: 'Interpolator management (INT-001)',
  usage: 'ipl [status|power|firmware|test|reset|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const iplDevice = ctx.data.iplDevice
    const action = args[0]?.toLowerCase()

    // Get current state from device if available
    const state = iplDevice?.getState() ?? {
      deviceState: 'standby',
      statusMessage: '',
      isPowered: false,
      spectrumWidth: 0,
      interpolationAccuracy: 97.5,
      inputStreams: 8,
      predictionHorizon: 60,
      currentTier: 1,
    }
    const firmware = iplDevice?.getFirmware() ?? {
      version: '2.5.3',
      build: '2024.02.10',
      checksum: 'F3A8C5D7',
      features: ['color-interp', 'era-manipulate', 'prism-array', 'spectrum-lock', 'prediction-engine'],
      securityPatch: '2024.02.05',
    }
    const powerSpecs = iplDevice?.getPowerSpecs() ?? {
      full: 20,
      idle: 6,
      standby: 1,
      predictive: 30,
      category: 'medium',
      priority: 2,
    }

    const currentStatus = state.deviceState
    const isPowered = state.isPowered
    const accuracy = state.interpolationAccuracy
    const streams = state.inputStreams
    const horizon = state.predictionHorizon
    const currentTier = state.currentTier
    const spectrum = state.spectrumWidth

    // No args - show usage
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '╭─────────────────────────────────────────────────╮',
          '│          INT-001 :: INTERPOLATOR                │',
          '╰─────────────────────────────────────────────────╯',
          '',
          '  USAGE:',
          '    ipl status          Show interpolator status',
          '    ipl power [on|off]  Toggle power/standby',
          '    ipl firmware        View firmware info',
          '    ipl test            Run diagnostics',
          '    ipl reset           Reboot device',
          '    ipl info            Full documentation',
          '    ipl fold            Fold device to compact view',
          '    ipl unfold          Unfold device to full view',
          '    ipl toggle          Toggle fold state',
          '',
          '  EXAMPLES:',
          '    ipl power on        Boot the interpolator',
          '    ipl status          Check current state',
          '    ipl firmware update Check for updates',
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat' || action === 's') {
      const stateSymbol = currentStatus === 'online' ? '●' : currentStatus === 'standby' ? '○' : '◐'
      const stateColor = currentStatus === 'online' ? 'ONLINE' : currentStatus.toUpperCase()

      // Spectrum bar visualization
      const barLen = 20
      const filled = Math.round((spectrum / 100) * barLen)
      const spectrumBar = '█'.repeat(filled) + '░'.repeat(barLen - filled)

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         INT-001 STATUS REPORT             │',
          '  └───────────────────────────────────────────┘',
          '',
          `     Device State:   ${stateSymbol} ${stateColor}`,
          `     Power:          ${isPowered ? 'ACTIVE' : 'STANDBY'}`,
          `     Spectrum:       [${spectrumBar}] ${spectrum}%`,
          '',
          '  ┌─────────────────────────────────────────────┐',
          '  │  OPTICS                 │  METRICS           │',
          '  ├─────────────────────────┼────────────────────┤',
          `  │  Accuracy   ${accuracy.toFixed(1)}%     │  Tier:      T${currentTier}      │`,
          `  │  Streams    ${String(streams).padStart(3)}        │  Horizon:   ${horizon}s     │`,
          '  └─────────────────────────┴────────────────────┘',
          '',
          `  Firmware: v${firmware.version}   Category: ${powerSpecs.category.toUpperCase()}`,
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power' || action === 'pwr' || action === 'p') {
      const subAction = args[1]?.toLowerCase()

      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  INT-001 Power: ${isPowered ? 'ACTIVE' : 'STANDBY'}`,
            '',
            '  Usage: ipl power [on|off]',
            '',
          ],
        }
      }

      if (subAction === 'on' || subAction === 'boot' || subAction === 'start') {
        if (isPowered && (currentStatus === 'online' || currentStatus === 'booting')) {
          return {
            success: false,
            error: `[INT-001] Already ${currentStatus.toUpperCase()}.`,
          }
        }

        ctx.setTyping(true)

        if (iplDevice) {
          await iplDevice.powerOn()
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      INT-001 BOOT SEQUENCE                ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [■□□□□□] Aligning prism array...',
            '  [■■□□□□] Initializing spectrum engine...',
            '  [■■■□□□] Focusing lens subsystem...',
            '  [■■■■□□] Calibrating wavelengths...',
            '  [■■■■■□] Starting output stage...',
            '  [■■■■■■] System ready',
            '',
            '  Status: ONLINE',
            `  Accuracy: ${accuracy.toFixed(1)}%`,
            `  Input Streams: ${streams}`,
            '',
          ],
        }
      }

      if (subAction === 'off' || subAction === 'shutdown' || subAction === 'stop') {
        if (!isPowered || currentStatus === 'standby' || currentStatus === 'shutdown') {
          return {
            success: false,
            error: '[INT-001] Already in standby mode.',
          }
        }
        if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
          return {
            success: false,
            error: `[INT-001] Cannot shutdown - operation in progress (${currentStatus}).`,
          }
        }

        ctx.setTyping(true)

        if (iplDevice) {
          await iplDevice.powerOff()
        } else {
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      INT-001 SHUTDOWN SEQUENCE            ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [✓] Prism retracted',
            '  [✓] Lens parked',
            '  [✓] Spectrum engine off',
            '  [✓] Prediction buffers flushed',
            '  [✓] Power state saved',
            '',
            '  Status: STANDBY',
            `  Power Draw: ${powerSpecs.standby} E/s`,
            '',
          ],
        }
      }

      return {
        success: false,
        error: `Unknown power action: ${subAction}\n\nUsage: ipl power [on|off]`,
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw' || action === 'f') {
      const subAction = args[1]?.toLowerCase()

      if (subAction === 'update' || subAction === 'upgrade') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ┌─────────────────────────────────────────────┐',
            '  │       INT-001 FIRMWARE UPDATE CHECK         │',
            '  └─────────────────────────────────────────────┘',
            '',
            `  Current Version:   v${firmware.version}`,
            '  Latest Version:    v2.5.3',
            '',
            '  [✓] Firmware is up to date.',
            '',
            `  Security Patch:    ${firmware.securityPatch}`,
            '  Status:            NO UPDATE REQUIRED',
            '',
          ],
        }
      }

      return {
        success: true,
        output: [
          '',
          '  ┌─────────────────────────────────────────────┐',
          '  │         INT-001 FIRMWARE INFO               │',
          '  └─────────────────────────────────────────────┘',
          '',
          `  Version:       v${firmware.version}`,
          `  Build:         ${firmware.build}`,
          `  Checksum:      ${firmware.checksum}`,
          `  Security:      ${firmware.securityPatch}`,
          '',
          '  FEATURES:',
          ...firmware.features.map(f => `    ◆ ${f}`),
          '',
          '  Use: ipl firmware update - to check for updates',
          '',
        ],
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag' || action === 'diagnostics') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[INT-001] Cannot run diagnostics - interpolator is ${currentStatus.toUpperCase()}\n\nUse 'ipl power on' to boot the device first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: '[INT-001] Cannot run diagnostics - operation in progress.',
        }
      }

      ctx.setTyping(true)

      if (iplDevice) {
        await iplDevice.runTest()
      } else {
        await new Promise(resolve => setTimeout(resolve, 2500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      INT-001 DIAGNOSTIC SEQUENCE          ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  Running self-test...',
          '',
          '  [✓] Prism array alignment    PASSED',
          '  [✓] Spectrum engine          PASSED',
          '  [✓] Lens focus system        PASSED',
          '  [✓] Wavelength calibration   PASSED',
          '  [✓] Output stage             PASSED',
          '  [✓] Prediction engine        PASSED',
          '  [✓] Memory integrity         PASSED',
          '  [✓] Power subsystem          PASSED',
          '',
          '  ─────────────────────────────────────────────',
          '  DIAGNOSTIC RESULT: ALL TESTS PASSED',
          `  Interpolation Accuracy: ${accuracy.toFixed(1)}%`,
          `  Current Tier: T${currentTier}`,
          '  ─────────────────────────────────────────────',
          '',
        ],
      }
    }

    // RESET/REBOOT command
    if (action === 'reset' || action === 'reboot') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[INT-001] Cannot reboot - interpolator is ${currentStatus.toUpperCase()}\n\nUse 'ipl power on' to boot the device first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: '[INT-001] Cannot reboot - operation in progress.',
        }
      }

      ctx.setTyping(true)

      if (iplDevice) {
        await iplDevice.reboot()
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      INT-001 REBOOT SEQUENCE              ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [✓] Prism retracted',
          '  [✓] Lens parked',
          '  [✓] Power cycled',
          '  [✓] Prism aligned',
          '  [✓] Spectrum initialized',
          '  [✓] System online',
          '',
          '  Status: ONLINE',
          `  Accuracy: ${accuracy.toFixed(1)}%`,
          '',
        ],
      }
    }

    // FOLD command
    if (action === 'fold') {
      if (!iplDevice) return { success: false, error: '[INT-001] Device not connected' }
      iplDevice.setExpanded(false)
      return {
        success: true,
        output: ['', '  INT-001 folded.', ''],
      }
    }

    // UNFOLD command
    if (action === 'unfold') {
      if (!iplDevice) return { success: false, error: '[INT-001] Device not connected' }
      iplDevice.setExpanded(true)
      return {
        success: true,
        output: ['', '  INT-001 unfolded.', ''],
      }
    }

    // TOGGLE fold command
    if (action === 'toggle') {
      if (!iplDevice) return { success: false, error: '[INT-001] Device not connected' }
      iplDevice.toggleExpanded()
      const st = iplDevice.getState()
      return {
        success: true,
        output: ['', `  INT-001 ${st.isExpanded ? 'unfolded' : 'folded'}.`, ''],
      }
    }

    // INFO command
    if (action === 'info' || action === 'docs' || action === 'documentation') {
      return {
        success: true,
        output: [
          '',
          '╔═════════════════════════════════════════════════════════════════╗',
          '║                   INT-001: INTERPOLATOR                         ║',
          '║                    Technical Documentation                      ║',
          '╠═════════════════════════════════════════════════════════════════╣',
          '',
          '  DEVICE OVERVIEW:',
          '    The Interpolator (INT-001) is a data stream smoothing and',
          '    prediction device that uses prism optics to analyze crystal',
          '    color spectra and interpolate trait values with high accuracy.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:      INT-001',
          '    Category:       Medium Consumer',
          '    Priority:       P2 (Standard)',
          '    Tech Tree:      Optics',
          '',
          '  POWER CHARACTERISTICS:',
          '    Full Operation:  20 E/s',
          '    Idle Mode:       6 E/s',
          '    Standby:         1 E/s',
          '    Predictive Mode: 30 E/s',
          '',
          '  OPTICS SYSTEM:',
          '    Prism array:     Multi-band refraction',
          '    Spectrum engine: Full visible + UV/IR',
          '    Lens focus:      Auto-calibrating',
          '    Input streams:   8 simultaneous (base)',
          '    Accuracy:        97.5% (base)',
          '    Prediction:      60s horizon (base)',
          '',
          `  FIRMWARE: v${firmware.version}`,
          '  FEATURES:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  TIER CAPABILITIES:',
          '    T1: Basic interpolation, 8 streams',
          '    T2: Era manipulation, 10 streams',
          '    T3: Color prediction, 12 streams',
          '    T4: Advanced refraction, 14 streams',
          '    T5: Full spectrum mastery, 16 streams',
          '',
          '  CONNECTED DEVICES:',
          '    HMS-001  Handmade Synthesizer  (Waveform Source)',
          '    OSC-001  Oscilloscope Array    (Signal Display)',
          '    CDC-001  Crystal Data Cache    (Data Feed)',
          '',
          '  COMMANDS:',
          '    ipl status          - Show device status',
          '    ipl power [on|off]  - Toggle power state',
          '    ipl firmware        - View firmware info',
          '    ipl test            - Run diagnostics',
          '    ipl reset           - Reboot device',
          '    ipl fold            - Fold device to compact view',
          '    ipl unfold          - Unfold device to full view',
          '    ipl toggle          - Toggle fold state',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/int-001/',
          '    /var/log/ipl/',
          '    /etc/ipl/config',
          '',
          '╚═════════════════════════════════════════════════════════════════╝',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown ipl command: ${action}\n\ntype ipl for available commands.`,
    }
  },
}

// MFR-001: Microfusion Reactor control command
const mfrCommand: Command = {
  name: 'mfr',
  aliases: ['reactor', 'microfusion', 'mfr001'],
  description: 'Microfusion Reactor management (MFR-001)',
  usage: 'mfr [status|power|firmware|test|reset|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const mfrDevice = ctx.data.mfrDevice
    const action = args[0]?.toLowerCase()

    // Get current state from device if available
    const state = mfrDevice?.getState() ?? {
      deviceState: 'standby',
      statusMessage: '',
      isPowered: false,
      powerOutput: 0,
      stability: 0,
      plasmaTemp: 0,
      efficiency: 92,
      ringSpeed: 0,
    }
    const firmware = mfrDevice?.getFirmware() ?? {
      version: '2.3.0',
      build: '2024.02.01',
      checksum: 'B8D4E6F2',
      features: ['plasma-contain', 'power-regulate', 'thermal-manage', 'auto-scram', 'efficiency-tune'],
      securityPatch: '2024.01.28',
    }
    const powerSpecs = mfrDevice?.getPowerSpecs() ?? {
      full: 250,
      idle: 150,
      standby: 25,
      startupCost: 500,
      efficiency: 92,
      category: 'generator',
      tier: 2,
    }

    const currentStatus = state.deviceState
    const isPowered = state.isPowered
    const powerOutput = state.powerOutput
    const stability = state.stability
    const plasmaTemp = state.plasmaTemp
    const efficiency = state.efficiency

    // No args - show usage
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '╭─────────────────────────────────────────────────╮',
          '│          MFR-001 :: MICROFUSION REACTOR         │',
          '╰─────────────────────────────────────────────────╯',
          '',
          '  USAGE:',
          '    mfr status          Show reactor status',
          '    mfr power [on|off]  Ignite/SCRAM reactor',
          '    mfr firmware        View firmware info',
          '    mfr test            Run diagnostics',
          '    mfr reset           Reboot reactor',
          '    mfr info            Full documentation',
          '    mfr fold            Fold device to compact view',
          '    mfr unfold          Unfold device to full view',
          '    mfr toggle          Toggle fold state',
          '',
          '  EXAMPLES:',
          '    mfr power on        Ignite plasma core',
          '    mfr power off       Emergency SCRAM',
          '    mfr status          Check reactor state',
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat' || action === 's') {
      const stateSymbol = currentStatus === 'online' ? '●' : currentStatus === 'standby' ? '○' : '◐'
      const stateColor = currentStatus === 'online' ? 'ONLINE' : currentStatus.toUpperCase()

      // Power output bar
      const barLen = 20
      const outputPercent = (powerOutput / powerSpecs.full) * 100
      const filled = Math.round((outputPercent / 100) * barLen)
      const outputBar = '█'.repeat(filled) + '░'.repeat(barLen - filled)

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         MFR-001 STATUS REPORT             │',
          '  └───────────────────────────────────────────┘',
          '',
          `     Reactor State:  ${stateSymbol} ${stateColor}`,
          `     Plasma Core:    ${isPowered ? 'IGNITED' : 'COLD'}`,
          `     Output:         [${outputBar}] ${Math.round(powerOutput)} E/s`,
          '',
          '  ┌─────────────────────────────────────────────┐',
          '  │  PLASMA CORE            │  PERFORMANCE       │',
          '  ├─────────────────────────┼────────────────────┤',
          `  │  Stability   ${String(Math.round(stability)).padStart(3)}%     │  Efficiency: ${efficiency}%   │`,
          `  │  Temp     ${String(Math.round(plasmaTemp)).padStart(5)}K     │  Tier:       T${powerSpecs.tier}     │`,
          '  └─────────────────────────┴────────────────────┘',
          '',
          `  Firmware: v${firmware.version}   Type: ${powerSpecs.category.toUpperCase()}`,
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power' || action === 'pwr' || action === 'p') {
      const subAction = args[1]?.toLowerCase()

      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  MFR-001 Reactor: ${isPowered ? 'IGNITED' : 'COLD'}`,
            `  Output: ${Math.round(powerOutput)} E/s`,
            '',
            '  Usage: mfr power [on|off]',
            '  Note: "off" initiates emergency SCRAM',
            '',
          ],
        }
      }

      if (subAction === 'on' || subAction === 'ignite' || subAction === 'start') {
        if (isPowered && (currentStatus === 'online' || currentStatus === 'booting')) {
          return {
            success: false,
            error: `[MFR-001] Reactor already ${currentStatus.toUpperCase()}.`,
          }
        }

        ctx.setTyping(true)

        if (mfrDevice) {
          await mfrDevice.powerOn()
        } else {
          await new Promise(resolve => setTimeout(resolve, 2500))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      MFR-001 IGNITION SEQUENCE            ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [■□□□□□] Plasma ignition...',
            '  [■■□□□□] Containment field active...',
            '  [■■■□□□] Coolant system online...',
            '  [■■■■□□] Power ramping...',
            '  [■■■■■□] Stabilizing plasma...',
            '  [■■■■■■] Reactor online',
            '',
            '  Status: ONLINE',
            `  Output: ${powerSpecs.full} E/s`,
            '  Plasma: CONTAINED',
            '',
          ],
        }
      }

      if (subAction === 'off' || subAction === 'scram' || subAction === 'stop') {
        if (!isPowered || currentStatus === 'standby' || currentStatus === 'shutdown') {
          return {
            success: false,
            error: '[MFR-001] Reactor already in cold standby.',
          }
        }
        if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
          return {
            success: false,
            error: `[MFR-001] Cannot SCRAM - operation in progress (${currentStatus}).`,
          }
        }

        ctx.setTyping(true)

        if (mfrDevice) {
          await mfrDevice.powerOff()
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      MFR-001 SCRAM SEQUENCE               ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  ⚠ EMERGENCY SCRAM INITIATED',
            '',
            '  [✓] Control rods inserted',
            '  [✓] Plasma cooling initiated',
            '  [✓] Containment field collapsed',
            '  [✓] Core temperature falling',
            '  [✓] Reactor safe',
            '',
            '  Status: STANDBY',
            `  Output: ${powerSpecs.standby} E/s (containment minimum)`,
            '',
          ],
        }
      }

      return {
        success: false,
        error: `Unknown power action: ${subAction}\n\nUsage: mfr power [on|off]`,
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw' || action === 'f') {
      const subAction = args[1]?.toLowerCase()

      if (subAction === 'update' || subAction === 'upgrade') {
        ctx.setTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ┌─────────────────────────────────────────────┐',
            '  │       MFR-001 FIRMWARE UPDATE CHECK         │',
            '  └─────────────────────────────────────────────┘',
            '',
            `  Current Version:   v${firmware.version}`,
            '  Latest Version:    v2.3.0',
            '',
            '  [✓] Firmware is up to date.',
            '',
            `  Security Patch:    ${firmware.securityPatch}`,
            '  Status:            NO UPDATE REQUIRED',
            '',
          ],
        }
      }

      return {
        success: true,
        output: [
          '',
          '  ┌─────────────────────────────────────────────┐',
          '  │         MFR-001 FIRMWARE INFO               │',
          '  └─────────────────────────────────────────────┘',
          '',
          `  Version:       v${firmware.version}`,
          `  Build:         ${firmware.build}`,
          `  Checksum:      ${firmware.checksum}`,
          `  Security:      ${firmware.securityPatch}`,
          '',
          '  FEATURES:',
          ...firmware.features.map(f => `    ◆ ${f}`),
          '',
          '  Use: mfr firmware update - to check for updates',
          '',
        ],
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag' || action === 'diagnostics') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[MFR-001] Cannot run diagnostics - reactor is ${currentStatus.toUpperCase()}\n\nUse 'mfr power on' to ignite the reactor first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: '[MFR-001] Cannot run diagnostics - operation in progress.',
        }
      }

      ctx.setTyping(true)

      if (mfrDevice) {
        await mfrDevice.runTest()
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      MFR-001 DIAGNOSTIC SEQUENCE          ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  Running reactor self-test...',
          '',
          '  [✓] Plasma density           PASSED',
          '  [✓] Containment field        PASSED',
          '  [✓] Coolant system           PASSED',
          '  [✓] Power output             PASSED',
          '  [✓] Safety interlocks        PASSED',
          '  [✓] Control rod mechanism    PASSED',
          '  [✓] Thermal regulation       PASSED',
          '  [✓] Emergency SCRAM          PASSED',
          '',
          '  ─────────────────────────────────────────────',
          '  DIAGNOSTIC RESULT: ALL TESTS PASSED',
          `  Plasma Stability: ${Math.round(stability)}%`,
          `  Efficiency: ${efficiency}%`,
          '  ─────────────────────────────────────────────',
          '',
        ],
      }
    }

    // RESET/REBOOT command
    if (action === 'reset' || action === 'reboot') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: `[MFR-001] Cannot reboot - reactor is ${currentStatus.toUpperCase()}\n\nUse 'mfr power on' to ignite the reactor first.`,
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
        return {
          success: false,
          error: '[MFR-001] Cannot reboot - operation in progress.',
        }
      }

      ctx.setTyping(true)

      if (mfrDevice) {
        await mfrDevice.reboot()
      } else {
        await new Promise(resolve => setTimeout(resolve, 2500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      MFR-001 REBOOT SEQUENCE              ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [✓] SCRAM initiated',
          '  [✓] Plasma cooling',
          '  [✓] Field collapsed',
          '  [✓] Plasma re-ignition',
          '  [✓] Containment restored',
          '  [✓] Reactor online',
          '',
          '  Status: ONLINE',
          `  Output: ${powerSpecs.full} E/s`,
          '',
        ],
      }
    }

    // FOLD command
    if (action === 'fold') {
      if (!mfrDevice) return { success: false, error: '[MFR-001] Device not connected' }
      mfrDevice.setExpanded(false)
      return {
        success: true,
        output: ['', '  MFR-001 folded.', ''],
      }
    }

    // UNFOLD command
    if (action === 'unfold') {
      if (!mfrDevice) return { success: false, error: '[MFR-001] Device not connected' }
      mfrDevice.setExpanded(true)
      return {
        success: true,
        output: ['', '  MFR-001 unfolded.', ''],
      }
    }

    // TOGGLE fold command
    if (action === 'toggle') {
      if (!mfrDevice) return { success: false, error: '[MFR-001] Device not connected' }
      mfrDevice.toggleExpanded()
      const st = mfrDevice.getState()
      return {
        success: true,
        output: ['', `  MFR-001 ${st.isExpanded ? 'unfolded' : 'folded'}.`, ''],
      }
    }

    // INFO command
    if (action === 'info' || action === 'docs' || action === 'documentation') {
      return {
        success: true,
        output: [
          '',
          '╔═════════════════════════════════════════════════════════════════╗',
          '║                  MFR-001: MICROFUSION REACTOR                   ║',
          '║                    Technical Documentation                      ║',
          '╠═════════════════════════════════════════════════════════════════╣',
          '',
          '  DEVICE OVERVIEW:',
          '    The Microfusion Reactor (MFR-001) is a Tier 2 plasma fusion',
          '    power generator providing stable, high-output energy for',
          '    laboratory operations.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:      MFR-001',
          '    Category:       Power Generator',
          '    Tier:           T2 (Mid-Game)',
          '    Tech Tree:      Power Generation',
          '',
          '  POWER OUTPUT:',
          '    Full Operation:  +250 E/s',
          '    Idle Mode:       +150 E/s',
          '    Standby:         +25 E/s (containment minimum)',
          '    Startup Cost:    -500 E (one-time ignition)',
          '',
          '  PLASMA CORE:',
          '    Plasma type:     Deuterium-Tritium',
          '    Core temp:       15,000 K (nominal)',
          '    Containment:     Magnetic confinement',
          '    Efficiency:      92% (base)',
          '',
          `  FIRMWARE: v${firmware.version}`,
          '  FEATURES:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  SAFETY SYSTEMS:',
          '    • Auto-SCRAM on containment breach',
          '    • Thermal runaway protection',
          '    • Control rod emergency insertion',
          '    • Coolant backup system',
          '',
          '  CONNECTED DEVICES:',
          '    UEC-001  Unstable Energy Core  (Energy Grid)',
          '    BAT-001  Battery Pack          (Storage)',
          '    QAN-001  Quantum Analyzer      (Monitoring)',
          '',
          '  COMMANDS:',
          '    mfr status          - Show reactor status',
          '    mfr power [on|off]  - Ignite/SCRAM',
          '    mfr firmware        - View firmware info',
          '    mfr test            - Run diagnostics',
          '    mfr reset           - Reboot reactor',
          '    mfr fold            - Fold device to compact view',
          '    mfr unfold          - Unfold device to full view',
          '    mfr toggle          - Toggle fold state',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/mfr-001/',
          '    /var/log/mfr/',
          '    /etc/mfr/config',
          '',
          '╚═════════════════════════════════════════════════════════════════╝',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown mfr command: ${action}\n\ntype mfr for available commands.`,
    }
  },
}

// AIC-001: AI Assistant Core control command
const aicCommand: Command = {
  name: 'aic',
  aliases: ['ai', 'assistant', 'aic001'],
  description: 'AI Assistant Core management (AIC-001)',
  usage: 'aic [status|power|firmware|test|reset|learn|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const aicDevice = ctx.data.aicDevice
    const action = args[0]?.toLowerCase()

    // Get current state from device if available
    const state = aicDevice?.getState() ?? {
      deviceState: 'standby',
      statusMessage: '',
      isPowered: false,
      taskQueue: 0,
      efficiency: 0,
      isLearning: false,
      nodeActivity: [0, 0, 0, 0, 0],
      anomalyCount: 0,
      uptime: 0,
    }
    const firmware = aicDevice?.getFirmware() ?? {
      version: '2.4.0',
      build: '2024.02.20',
      checksum: 'E7A9C3B5',
      features: ['neural-core', 'task-queue', 'auto-optimize', 'learning-mode', 'anomaly-detect'],
      securityPatch: '2024.02.15',
    }
    const powerSpecs = aicDevice?.getPowerSpecs() ?? {
      full: 35,
      idle: 12,
      standby: 3,
      learning: 50,
      category: 'heavy',
      priority: 1,
    }

    const currentStatus = state.deviceState
    const isPowered = state.isPowered
    const taskQueue = state.taskQueue
    const efficiency = state.efficiency
    const isLearning = state.isLearning
    const nodeActivity = state.nodeActivity
    const anomalyCount = state.anomalyCount
    const uptime = state.uptime

    // No args - show usage
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '╭─────────────────────────────────────────────────╮',
          '│         AIC-001 :: AI ASSISTANT CORE            │',
          '╰─────────────────────────────────────────────────╯',
          '',
          '  USAGE:',
          '    aic status          Show core status',
          '    aic power [on|off]  Power on/shutdown core',
          '    aic firmware        View firmware info',
          '    aic test            Run neural diagnostics',
          '    aic reset           Reboot neural core',
          '    aic learn [on|off]  Toggle learning mode',
          '    aic info            Full documentation',
          '    aic fold            Fold device to compact view',
          '    aic unfold          Unfold device to full view',
          '    aic toggle          Toggle fold state',
          '',
          '  EXAMPLES:',
          '    aic power on        Boot the AI core',
          '    aic learn off       Disable learning mode',
          '    aic status          Check neural state',
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat' || action === 's') {
      const stateSymbol = currentStatus === 'online' ? '●' : currentStatus === 'standby' ? '○' : '◐'
      const stateColor = currentStatus === 'online' ? 'ONLINE' : currentStatus.toUpperCase()

      // Node activity visualization
      const nodeViz = nodeActivity.map(n => {
        const level = Math.round(n * 5)
        return '▁▂▃▄▅'[Math.min(level, 4)] || '▁'
      }).join('')

      // Efficiency bar
      const barLen = 20
      const effPercent = Math.min(efficiency / 200, 1) * 100
      const filled = Math.round((effPercent / 100) * barLen)
      const effBar = '█'.repeat(filled) + '░'.repeat(barLen - filled)

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         AIC-001 STATUS REPORT             │',
          '  └───────────────────────────────────────────┘',
          '',
          `     Neural State:   ${stateSymbol} ${stateColor}`,
          `     Learning Mode:  ${isLearning ? 'ENABLED' : 'DISABLED'}`,
          `     Efficiency:     [${effBar}] ${efficiency}%`,
          '',
          '  ┌─────────────────────────────────────────────┐',
          '  │  NEURAL NETWORK        │  PERFORMANCE       │',
          '  ├────────────────────────┼────────────────────┤',
          `  │  Task Queue   ${String(taskQueue).padStart(3)}     │  Uptime: ${String(Math.floor(uptime/60)).padStart(4)}m     │`,
          `  │  Nodes:    [${nodeViz}]   │  Anomalies: ${String(anomalyCount).padStart(3)}  │`,
          '  └────────────────────────┴────────────────────┘',
          '',
          `  Firmware: v${firmware.version}   Category: ${powerSpecs.category.toUpperCase()}`,
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power' || action === 'pwr' || action === 'p') {
      const subAction = args[1]?.toLowerCase()

      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  AIC-001 Neural Core: ${isPowered ? 'ACTIVE' : 'OFFLINE'}`,
            `  Power Draw: ${isPowered ? (isLearning ? powerSpecs.learning : powerSpecs.full) : powerSpecs.standby} E/s`,
            '',
            '  Usage: aic power [on|off]',
            '',
          ],
        }
      }

      if (subAction === 'on' || subAction === 'boot' || subAction === 'start') {
        if (isPowered && (currentStatus === 'online' || currentStatus === 'booting')) {
          return {
            success: false,
            error: `[AIC-001] Neural core already ${currentStatus.toUpperCase()}.`,
          }
        }

        ctx.setTyping(true)

        if (aicDevice) {
          await aicDevice.powerOn()
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      AIC-001 BOOT SEQUENCE                ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [■□□□□□] Loading neural core...',
            '  [■■□□□□] Initializing memory banks...',
            '  [■■■□□□] Activating neural nodes...',
            '  [■■■■□□] Training models...',
            '  [■■■■■□] Calibrating efficiency...',
            '  [■■■■■■] Core online',
            '',
            '  Status: ONLINE',
            `  Power Draw: ${powerSpecs.full} E/s`,
            '  Mode: LEARNING',
            '',
          ],
        }
      }

      if (subAction === 'off' || subAction === 'shutdown' || subAction === 'stop') {
        if (!isPowered || currentStatus === 'standby' || currentStatus === 'shutdown') {
          return {
            success: false,
            error: '[AIC-001] Neural core already in standby.',
          }
        }
        if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
          return {
            success: false,
            error: `[AIC-001] Cannot shutdown - operation in progress (${currentStatus}).`,
          }
        }

        ctx.setTyping(true)

        if (aicDevice) {
          await aicDevice.powerOff()
        } else {
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      AIC-001 SHUTDOWN SEQUENCE            ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [■■■■■■] Saving neural state...',
            '  [■■■■□□] Halting processes...',
            '  [■■□□□□] Neural shutdown...',
            '  [□□□□□□] Core offline',
            '',
            '  Status: STANDBY',
            `  Power Draw: ${powerSpecs.standby} E/s`,
            '',
          ],
        }
      }

      return {
        success: false,
        error: `Unknown power option: ${subAction}\n\nUsage: aic power [on|off]`,
      }
    }

    // LEARN command
    if (action === 'learn' || action === 'learning' || action === 'l') {
      const subAction = args[1]?.toLowerCase()

      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  AIC-001 Learning Mode: ${isLearning ? 'ENABLED' : 'DISABLED'}`,
            `  Power Draw: ${isLearning ? powerSpecs.learning : powerSpecs.full} E/s`,
            '',
            '  Usage: aic learn [on|off]',
            '  Note: Learning mode optimizes neural pathways',
            '',
          ],
        }
      }

      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[AIC-001] Neural core must be ONLINE to change learning mode (current: ${currentStatus.toUpperCase()}).`,
        }
      }

      if (subAction === 'on' || subAction === 'enable') {
        if (isLearning) {
          return {
            success: true,
            output: ['', '  [AIC-001] Learning mode already enabled.', ''],
          }
        }

        if (aicDevice) {
          aicDevice.setLearningMode(true)
        }

        return {
          success: true,
          output: [
            '',
            '  [AIC-001] Learning mode ENABLED',
            `  Power Draw: ${powerSpecs.learning} E/s`,
            '  Neural pathway optimization active.',
            '',
          ],
        }
      }

      if (subAction === 'off' || subAction === 'disable') {
        if (!isLearning) {
          return {
            success: true,
            output: ['', '  [AIC-001] Learning mode already disabled.', ''],
          }
        }

        if (aicDevice) {
          aicDevice.setLearningMode(false)
        }

        return {
          success: true,
          output: [
            '',
            '  [AIC-001] Learning mode DISABLED',
            `  Power Draw: ${powerSpecs.full} E/s`,
            '  Switched to monitoring mode.',
            '',
          ],
        }
      }

      return {
        success: false,
        error: `Unknown learn option: ${subAction}\n\nUsage: aic learn [on|off]`,
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw' || action === 'f') {
      const subAction = args[1]?.toLowerCase()

      if (subAction === 'update' || subAction === 'upgrade') {
        ctx.setTyping(true)
        await new Promise(r => setTimeout(r, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  [AIC-001] Checking for firmware updates...',
            '',
            `  Current: v${firmware.version}`,
            `  Latest:  v${firmware.version}`,
            '',
            '  ✓ Firmware is up to date.',
            '',
          ],
        }
      }

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         AIC-001 FIRMWARE INFO             │',
          '  └───────────────────────────────────────────┘',
          '',
          `  Version:        ${firmware.version}`,
          `  Build:          ${firmware.build}`,
          `  Checksum:       ${firmware.checksum}`,
          `  Security Patch: ${firmware.securityPatch}`,
          '',
          '  Features:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  Run "aic firmware update" to check for updates.',
          '',
        ],
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag' || action === 't') {
      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[AIC-001] Neural core must be ONLINE to run diagnostics (current: ${currentStatus.toUpperCase()}).`,
        }
      }

      ctx.setTyping(true)

      if (aicDevice) {
        await aicDevice.runTest()
      } else {
        await new Promise(resolve => setTimeout(resolve, 2500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      AIC-001 DIAGNOSTICS                  ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [✓] Neural pathways............ PASS',
          '  [✓] Memory integrity........... PASS',
          '  [✓] Logic gates................ PASS',
          '  [✓] Learning rate.............. PASS',
          '  [✓] Optimizer benchmark........ PASS',
          '',
          '  All diagnostics PASSED.',
          '',
          `  Efficiency: ${efficiency}%`,
          `  Anomalies:  ${anomalyCount}`,
          '',
        ],
      }
    }

    // RESET command
    if (action === 'reset' || action === 'reboot' || action === 'r') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: '[AIC-001] Neural core must be powered on to reboot.',
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting') {
        return {
          success: false,
          error: `[AIC-001] Boot/reboot already in progress.`,
        }
      }

      ctx.setTyping(true)

      if (aicDevice) {
        await aicDevice.reboot()
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      AIC-001 REBOOT SEQUENCE              ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [SAVE] Preserving neural state...',
          '  [HALT] Stopping all processes...',
          '  [DOWN] Core offline...',
          '  [BOOT] Reinitializing...',
          '  [LOAD] Restoring neural state...',
          '  [ OK ] Core online',
          '',
          '  Reboot complete. All systems nominal.',
          '',
        ],
      }
    }

    // FOLD command
    if (action === 'fold') {
      if (!aicDevice) return { success: false, error: '[AIC-001] Device not connected' }
      aicDevice.setExpanded(false)
      return {
        success: true,
        output: ['', '  AIC-001 folded.', ''],
      }
    }

    // UNFOLD command
    if (action === 'unfold') {
      if (!aicDevice) return { success: false, error: '[AIC-001] Device not connected' }
      aicDevice.setExpanded(true)
      return {
        success: true,
        output: ['', '  AIC-001 unfolded.', ''],
      }
    }

    // TOGGLE fold command
    if (action === 'toggle') {
      if (!aicDevice) return { success: false, error: '[AIC-001] Device not connected' }
      aicDevice.toggleExpanded()
      const st = aicDevice.getState()
      return {
        success: true,
        output: ['', `  AIC-001 ${st.isExpanded ? 'unfolded' : 'folded'}.`, ''],
      }
    }

    // INFO command
    if (action === 'info' || action === 'help' || action === 'doc') {
      return {
        success: true,
        output: [
          '',
          '╔═════════════════════════════════════════════════════════════════╗',
          '║                    AIC-001 DOCUMENTATION                        ║',
          '╠═════════════════════════════════════════════════════════════════╣',
          '',
          '  DEVICE OVERVIEW:',
          '    The AI Assistant Core (AIC-001) is a Tier 2 heavy compute',
          '    device providing neural processing, task automation, and',
          '    learning-optimized operations for laboratory efficiency.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:      AIC-001',
          '    Category:       Heavy Compute',
          '    Tier:           T2 (Mid-Game)',
          '    Tech Tree:      Automation / Computing',
          '',
          '  POWER CONSUMPTION:',
          '    Full Operation:  35 E/s',
          '    Idle Mode:       12 E/s',
          '    Standby:         3 E/s (wake-on-command)',
          '    Learning Mode:   50 E/s (neural optimization)',
          '',
          '  NEURAL NETWORK:',
          '    Node count:      5 primary nodes',
          '    Task queue:      Up to 15 concurrent tasks',
          '    Efficiency:      120-180% (optimized)',
          '    Anomaly detect:  Automatic pattern recognition',
          '',
          `  FIRMWARE: v${firmware.version}`,
          '  FEATURES:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  OPERATIONAL MODES:',
          '    LEARNING:    Neural pathway optimization (50 E/s)',
          '    MONITORING:  Passive observation (35 E/s)',
          '    STANDBY:     Minimal power, quick wake (3 E/s)',
          '',
          '  CONNECTED DEVICES:',
          '    CDC-001  Crystal Data Cache  (Data Access)',
          '    MFR-001  Microfusion Reactor (Power Supply)',
          '    HMS-001  Handmade Synthesizer (Automation)',
          '',
          '  COMMANDS:',
          '    aic status          - Show core status',
          '    aic power [on|off]  - Boot/shutdown',
          '    aic firmware        - View firmware info',
          '    aic test            - Run neural diagnostics',
          '    aic reset           - Reboot neural core',
          '    aic learn [on|off]  - Toggle learning mode',
          '    aic fold            - Fold device to compact view',
          '    aic unfold          - Unfold device to full view',
          '    aic toggle          - Toggle fold state',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/aic-001/',
          '    /var/log/aic/',
          '    /etc/aic/config',
          '',
          '╚═════════════════════════════════════════════════════════════════╝',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown aic command: ${action}\n\ntype aic for available commands.`,
    }
  },
}

// ═══════════════════════════════════════════════════════════════
// EMC Command - Exotic Matter Containment
// ═══════════════════════════════════════════════════════════════
const emcCommand: Command = {
  name: 'emc',
  aliases: ['exotic', 'emc001', 'containment'],
  description: 'Exotic Matter Containment management (EMC-001)',
  usage: 'emc [status|power|firmware|test|reset|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const emcDevice = ctx.data.emcDevice

    // Default state for when device is not available
    const state = emcDevice?.getState() ?? {
      deviceState: 'online' as const,
      statusMessage: 'CONTAINED',
      isPowered: true,
      units: 42,
      stability: 76,
      fieldStrength: 95,
      temperature: 1050,
      isContained: true,
      currentDraw: 18,
    }

    const firmware = emcDevice?.getFirmware() ?? {
      version: '4.0.1',
      build: '2026.01.15',
      checksum: 'E8X4M2C7',
      features: ['containment-field', 'particle-tracking', 'stability-calc', 'matter-compress', 'field-harmonics'],
      securityPatch: '2026.01.10',
    }

    const powerSpecs = emcDevice?.getPowerSpecs() ?? {
      full: 40,
      idle: 18,
      standby: 2,
      scan: 55,
      category: 'heavy',
      priority: 1,
    }

    const action = args[0]?.toLowerCase()

    if (!action) {
      return {
        success: true,
        output: [
          '',
          '  ┌──────────────────────────────────────────────┐',
          '  │      EMC-001 :: EXOTIC MATTER CONTAINMENT    │',
          '  │              Management Console               │',
          '  └──────────────────────────────────────────────┘',
          '',
          '    emc status              Show containment status',
          '    emc power [on|off]      Power on/shutdown field',
          '    emc firmware            View firmware info',
          '    emc firmware update     Check for firmware updates',
          '    emc test                Run containment diagnostics',
          '    emc reset               Reboot containment system',
          '    emc fold                Fold device to compact view',
          '    emc unfold              Unfold to full view',
          '    emc toggle              Toggle fold state',
          '    emc info                Full documentation',
          '',
          '  Examples:',
          '    emc power on            Boot containment field',
          '    emc test                Run diagnostics',
          '',
        ],
      }
    }

    if (action === 'status') {
      const stateLabel = state.deviceState === 'online' ? 'ONLINE' : state.deviceState.toUpperCase()
      return {
        success: true,
        output: [
          '',
          '  ┌──────────────────────────────────────────────┐',
          '  │         EMC-001 STATUS REPORT                │',
          '  └──────────────────────────────────────────────┘',
          '',
          `    State:          ${stateLabel}`,
          `    Status:         ${state.statusMessage}`,
          `    Contained:      ${state.isContained ? 'YES' : 'NO'}`,
          `    Units:          ${state.units} particles`,
          `    Stability:      ${state.stability}%`,
          `    Field Strength: ${state.fieldStrength}%`,
          `    Temperature:    ${state.temperature}°K`,
          `    Power Draw:     ${state.currentDraw} E/s`,
          '',
          `    Firmware:       v${firmware.version}`,
          '',
        ],
      }
    }

    if (action === 'power') {
      const subAction = args[1]?.toLowerCase()
      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  EMC-001 Power State: ${state.isPowered ? 'ON' : 'STANDBY'}`,
            '  usage: emc power [on|off]',
            '',
          ],
        }
      }
      if (subAction === 'on') {
        if (state.isPowered) {
          return { success: true, output: ['', '  EMC-001 is already powered on.', ''] }
        }
        ctx.addOutput('[emc] Initiating EMC-001 containment field boot...')
        await emcDevice?.powerOn()
        return {
          success: true,
          output: ['[emc] EMC-001 is now ONLINE', ''],
        }
      }
      if (subAction === 'off') {
        if (!state.isPowered) {
          return { success: true, output: ['', '  EMC-001 is already in standby.', ''] }
        }
        ctx.addOutput('[emc] Initiating EMC-001 containment shutdown...')
        await emcDevice?.powerOff()
        return {
          success: true,
          output: ['[emc] EMC-001 is now in STANDBY', ''],
        }
      }
      return { success: false, error: 'usage: emc power [on|off]' }
    }

    if (action === 'firmware') {
      const subAction = args[1]?.toLowerCase()
      if (subAction === 'update') {
        return { success: true, output: ['', '  [emc] Checking for firmware updates...', '  EMC-001 firmware is up to date (v' + firmware.version + ')', ''] }
      }
      return {
        success: true,
        output: [
          '',
          '  ┌──────────────────────────────────────────────┐',
          '  │         EMC-001 FIRMWARE INFO                │',
          '  └──────────────────────────────────────────────┘',
          '',
          `    Version:        v${firmware.version}`,
          `    Build:          ${firmware.build}`,
          `    Checksum:       ${firmware.checksum}`,
          `    Security Patch: ${firmware.securityPatch}`,
          `    Features:       ${firmware.features.join(', ')}`,
          '',
        ],
      }
    }

    if (action === 'test') {
      if (!state.isPowered || state.deviceState === 'standby') {
        return { success: false, error: 'EMC-001 must be online to run diagnostics.\nUse: emc power on' }
      }
      ctx.addOutput('[emc] Running EMC-001 containment diagnostics...')
      await emcDevice?.runTest()
      return {
        success: true,
        output: [
          '',
          '[emc] All diagnostics PASSED',
          '',
        ],
      }
    }

    if (action === 'reset') {
      if (!state.isPowered || state.deviceState === 'standby') {
        return { success: false, error: 'EMC-001 is in standby. Use: emc power on' }
      }
      ctx.addOutput('[emc] Rebooting EMC-001...')
      await emcDevice?.reboot()
      return {
        success: true,
        output: ['[emc] EMC-001 reboot complete', ''],
      }
    }

    if (action === 'fold') {
      emcDevice?.setExpanded(false)
      return { success: true, output: ['', '  EMC-001 folded to compact view.', ''] }
    }

    if (action === 'unfold' || action === 'expand') {
      if (state.deviceState === 'standby') {
        return { success: false, error: 'EMC-001 is in standby. Use: emc power on' }
      }
      emcDevice?.setExpanded(true)
      return { success: true, output: ['', '  EMC-001 unfolded to full view.', ''] }
    }

    if (action === 'toggle') {
      if (state.deviceState === 'standby') {
        return { success: false, error: 'EMC-001 is in standby. Use: emc power on' }
      }
      emcDevice?.toggleExpanded()
      return { success: true, output: ['', '  EMC-001 fold state toggled.', ''] }
    }

    if (action === 'info') {
      return {
        success: true,
        output: [
          '',
          '╔════════════════════════════════════════════════════════╗',
          '║            EMC-001 :: EXOTIC MATTER CONTAINMENT       ║',
          '║                 Device Specification v4.0              ║',
          '╚════════════════════════════════════════════════════════╝',
          '',
          '  OVERVIEW',
          '    High-energy containment field for exotic matter',
          '    particles. Monitors unit count, stability, and',
          '    field strength in real-time.',
          '',
          '  SPECIFICATIONS',
          `    Firmware:     v${firmware.version} (build ${firmware.build})`,
          `    Checksum:     ${firmware.checksum}`,
          '    Particles:    42 units (max capacity)',
          '    Field Type:   Magnetic confinement (CERN-class)',
          '',
          '  POWER',
          `    Full/Boot:    ${powerSpecs.full} E/s`,
          `    Idle:         ${powerSpecs.idle} E/s`,
          `    Standby:      ${powerSpecs.standby} E/s`,
          `    Scan/Test:    ${powerSpecs.scan} E/s`,
          `    Category:     ${powerSpecs.category} | Priority: P${powerSpecs.priority}`,
          '',
          '  COMMANDS',
          '    emc status       Show containment status',
          '    emc power on/off Power management',
          '    emc firmware     View firmware',
          '    emc test         Run diagnostics',
          '    emc reset        Reboot system',
          '    emc fold         Fold to compact view',
          '    emc unfold       Unfold to full view',
          '    emc toggle       Toggle fold state',
          '    emc info         This documentation',
          '',
          '  TROUBLESHOOTING',
          '    - Low stability: check field strength and temp',
          '    - Field collapse: immediate reboot with emc reset',
          '    - If containment offline, run: emc power on',
          '    - Run emc test to verify all containment systems',
          '',
          '  See also: cat ~/.local/docs/emc001.txt',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown emc subcommand: ${action}\nusage: emc [status|power|firmware|test|reset|fold|unfold|toggle|info]`,
    }
  },
}

// QUA Command - Quantum Analyzer
// ═══════════════════════════════════════════════════════════════
const quaCommand: Command = {
  name: 'qua',
  aliases: ['analyzer', 'qua001', 'quantum-analyzer'],
  description: 'Quantum Analyzer management (QUA-001)',
  usage: 'qua [status|power|firmware|test|reset|mode|sensitivity|depth|frequency|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const quaDevice = ctx.data.quaDevice

    const state = quaDevice?.getState() ?? {
      deviceState: 'online' as const,
      statusMessage: 'READY',
      isPowered: true,
      mode: 'ANOMALY',
      sensitivity: 65,
      depth: 50,
      frequency: 40,
      coherence: 87,
      isAnalyzing: false,
      currentDraw: 10,
    }

    const firmware = quaDevice?.getFirmware() ?? {
      version: '3.7.2',
      build: '2026.01.29',
      checksum: 'Q7A3N5X8',
      features: ['quantum-core', 'neural-network', 'multi-mode', 'waveform-gen', 'deep-scan'],
      securityPatch: '2026.01.25',
    }

    const powerSpecs = quaDevice?.getPowerSpecs() ?? {
      full: 25,
      idle: 10,
      standby: 2,
      analysis: 35,
      category: 'heavy',
      priority: 2,
    }

    const action = args[0]?.toLowerCase()

    if (!action) {
      return {
        success: true,
        output: [
          '',
          '  ┌──────────────────────────────────────────────┐',
          '  │       QUA-001 :: QUANTUM ANALYZER             │',
          '  │            Management Console                  │',
          '  └──────────────────────────────────────────────┘',
          '',
          '    qua status              Show analyzer status',
          '    qua power [on|off]      Power on/standby',
          '    qua firmware            View firmware info',
          '    qua firmware update     Check for firmware updates',
          '    qua test                Run diagnostics',
          '    qua reset               Reboot analyzer',
          '    qua mode <MODE>         Set analysis mode',
          '    qua sensitivity <0-100> Set sensitivity knob',
          '    qua depth <0-100>       Set depth knob',
          '    qua frequency <0-100>   Set frequency knob',
          '    qua fold                Fold device to compact view',
          '    qua unfold              Unfold to full view',
          '    qua toggle              Toggle fold state',
          '    qua info                Full documentation',
          '',
          '  Modes: ANOMALY, RESOURCE, DECRYPT, DIAGNOSE, SIMULATE, SCAN',
          '',
        ],
      }
    }

    if (action === 'status') {
      const stateLabel = state.deviceState === 'online' ? 'ONLINE' : state.deviceState.toUpperCase()
      return {
        success: true,
        output: [
          '',
          '  ┌──────────────────────────────────────────────┐',
          '  │         QUA-001 STATUS REPORT                 │',
          '  └──────────────────────────────────────────────┘',
          '',
          `    State:          ${stateLabel}`,
          `    Status:         ${state.statusMessage}`,
          `    Mode:           ${state.mode}`,
          `    Sensitivity:    ${state.sensitivity}%`,
          `    Depth:          ${state.depth}%`,
          `    Frequency:      ${state.frequency}Hz`,
          `    Coherence:      ${state.coherence}%`,
          `    Analyzing:      ${state.isAnalyzing ? 'YES' : 'NO'}`,
          `    Power Draw:     ${state.currentDraw} E/s`,
          '',
          `    Firmware:       v${firmware.version}`,
          '',
        ],
      }
    }

    if (action === 'power') {
      const subAction = args[1]?.toLowerCase()
      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  QUA-001 Power State: ${state.isPowered ? 'ON' : 'STANDBY'}`,
            '  usage: qua power [on|off]',
            '',
          ],
        }
      }
      if (subAction === 'on') {
        if (state.isPowered) {
          return { success: true, output: ['', '  QUA-001 is already powered on.', ''] }
        }
        ctx.addOutput('[qua] Initiating QUA-001 quantum analyzer boot...')
        await quaDevice?.powerOn()
        return {
          success: true,
          output: ['[qua] QUA-001 is now ONLINE', ''],
        }
      }
      if (subAction === 'off') {
        if (!state.isPowered) {
          return { success: true, output: ['', '  QUA-001 is already in standby.', ''] }
        }
        ctx.addOutput('[qua] Initiating QUA-001 shutdown...')
        await quaDevice?.powerOff()
        return {
          success: true,
          output: ['[qua] QUA-001 is now in STANDBY', ''],
        }
      }
      return { success: false, error: 'usage: qua power [on|off]' }
    }

    if (action === 'firmware') {
      const subAction = args[1]?.toLowerCase()
      if (subAction === 'update') {
        return { success: true, output: ['', '  [qua] Checking for firmware updates...', '  QUA-001 firmware is up to date (v' + firmware.version + ')', ''] }
      }
      return {
        success: true,
        output: [
          '',
          '  ┌──────────────────────────────────────────────┐',
          '  │         QUA-001 FIRMWARE INFO                 │',
          '  └──────────────────────────────────────────────┘',
          '',
          `    Version:        v${firmware.version}`,
          `    Build:          ${firmware.build}`,
          `    Checksum:       ${firmware.checksum}`,
          `    Security Patch: ${firmware.securityPatch}`,
          `    Features:       ${firmware.features.join(', ')}`,
          '',
        ],
      }
    }

    if (action === 'test') {
      if (!state.isPowered || state.deviceState === 'standby') {
        return { success: false, error: 'QUA-001 must be online to run diagnostics.\nUse: qua power on' }
      }
      ctx.addOutput('[qua] Running QUA-001 diagnostics...')
      await quaDevice?.runTest()
      return {
        success: true,
        output: [
          '',
          '[qua] All diagnostics PASSED',
          '',
        ],
      }
    }

    if (action === 'reset') {
      if (!state.isPowered || state.deviceState === 'standby') {
        return { success: false, error: 'QUA-001 is in standby. Use: qua power on' }
      }
      ctx.addOutput('[qua] Rebooting QUA-001...')
      await quaDevice?.reboot()
      return {
        success: true,
        output: ['[qua] QUA-001 reboot complete', ''],
      }
    }

    if (action === 'mode') {
      const modeArg = args[1]?.toUpperCase()
      const validModes = ['ANOMALY', 'RESOURCE', 'DECRYPT', 'DIAGNOSE', 'SIMULATE', 'SCAN'] as const
      if (!modeArg) {
        return {
          success: true,
          output: [
            '',
            `  Current mode: ${state.mode}`,
            `  Available: ${validModes.join(', ')}`,
            '  usage: qua mode <MODE>',
            '',
          ],
        }
      }
      if (!validModes.includes(modeArg as typeof validModes[number])) {
        return { success: false, error: `Invalid mode: ${modeArg}\nValid modes: ${validModes.join(', ')}` }
      }
      if (!state.isPowered) {
        return { success: false, error: 'QUA-001 must be online. Use: qua power on' }
      }
      quaDevice?.setMode(modeArg as typeof validModes[number])
      return {
        success: true,
        output: [`[qua] Analysis mode set to ${modeArg}`, ''],
      }
    }

    if (action === 'sensitivity') {
      const val = parseInt(args[1])
      if (isNaN(val) || val < 0 || val > 100) {
        return { success: false, error: 'usage: qua sensitivity <0-100>' }
      }
      if (!state.isPowered) {
        return { success: false, error: 'QUA-001 must be online. Use: qua power on' }
      }
      quaDevice?.setSensitivity(val)
      return {
        success: true,
        output: [`[qua] Sensitivity set to ${val}%`, ''],
      }
    }

    if (action === 'depth') {
      const val = parseInt(args[1])
      if (isNaN(val) || val < 0 || val > 100) {
        return { success: false, error: 'usage: qua depth <0-100>' }
      }
      if (!state.isPowered) {
        return { success: false, error: 'QUA-001 must be online. Use: qua power on' }
      }
      quaDevice?.setDepth(val)
      return {
        success: true,
        output: [`[qua] Depth set to ${val}%`, ''],
      }
    }

    if (action === 'frequency') {
      const val = parseInt(args[1])
      if (isNaN(val) || val < 0 || val > 100) {
        return { success: false, error: 'usage: qua frequency <0-100>' }
      }
      if (!state.isPowered) {
        return { success: false, error: 'QUA-001 must be online. Use: qua power on' }
      }
      quaDevice?.setFrequency(val)
      return {
        success: true,
        output: [`[qua] Frequency set to ${val}Hz`, ''],
      }
    }

    if (action === 'fold') {
      quaDevice?.setExpanded(false)
      return { success: true, output: ['', '  QUA-001 folded to compact view.', ''] }
    }

    if (action === 'unfold' || action === 'expand') {
      if (state.deviceState === 'standby') {
        return { success: false, error: 'QUA-001 is in standby. Use: qua power on' }
      }
      quaDevice?.setExpanded(true)
      return { success: true, output: ['', '  QUA-001 unfolded to full view.', ''] }
    }

    if (action === 'toggle') {
      if (state.deviceState === 'standby') {
        return { success: false, error: 'QUA-001 is in standby. Use: qua power on' }
      }
      quaDevice?.toggleExpanded()
      return { success: true, output: ['', '  QUA-001 fold state toggled.', ''] }
    }

    if (action === 'info') {
      return {
        success: true,
        output: [
          '',
          '╔════════════════════════════════════════════════════════╗',
          '║            QUA-001 :: QUANTUM ANALYZER                ║',
          '║              Device Specification v3.7                 ║',
          '╚════════════════════════════════════════════════════════╝',
          '',
          '  OVERVIEW',
          '    Universal problem solver with 6 analysis modes,',
          '    neural network processing, waveform generation,',
          '    and deep scan capability.',
          '',
          '  SPECIFICATIONS',
          `    Firmware:     v${firmware.version} (build ${firmware.build})`,
          `    Checksum:     ${firmware.checksum}`,
          '    Manufacturer: QNTX Corporation',
          '',
          '  ANALYSIS MODES',
          '    ANOMALY   - Detect dimensional anomalies',
          '    RESOURCE  - Optimize resource allocation',
          '    DECRYPT   - Decode encrypted signals',
          '    DIAGNOSE  - System health & faults',
          '    SIMULATE  - Predictive simulations',
          '    SCAN      - Deep scan for hidden objects',
          '',
          '  POWER',
          `    Full/Boot:    ${powerSpecs.full} E/s`,
          `    Idle:         ${powerSpecs.idle} E/s`,
          `    Standby:      ${powerSpecs.standby} E/s`,
          `    Analysis:     ${powerSpecs.analysis} E/s`,
          `    Category:     ${powerSpecs.category} | Priority: P${powerSpecs.priority}`,
          '',
          '  See also: cat ~/.local/docs/qua001.txt',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown qua subcommand: ${action}\nusage: qua [status|power|firmware|test|reset|mode|sensitivity|depth|frequency|fold|unfold|toggle|info]`,
    }
  },
}

// VNT Command - Ventilation System
// ═══════════════════════════════════════════════════════════════
const qsmCommand: Command = {
  name: 'qsm',
  aliases: ['quantum', 'qsm001', 'qubit'],
  description: 'Quantum State Monitor management (QSM-001)',
  usage: 'qsm [status|power|firmware|test|reset|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const qsmDevice = ctx.data.qsmDevice
    const action = args[0]?.toLowerCase()

    const state = qsmDevice?.getState() ?? {
      deviceState: 'online' as const,
      statusMessage: 'COHERENT',
      isPowered: true,
      coherence: 94,
      qubits: 127,
      isEntangled: true,
      currentDraw: 7,
      errorRate: 0.8,
      temperature: 15,
    }
    const firmware = qsmDevice?.getFirmware() ?? {
      version: '1.2.0',
      build: '2026.01.20',
      checksum: 'Q7S4M1N9',
      features: ['qubit-array', 'coherence-tracking', 'entanglement-verify', 'error-correction', 'wave-function'],
      securityPatch: '2026.01.18',
    }
    const powerSpecs = qsmDevice?.getPowerSpecs() ?? {
      full: 12,
      idle: 7,
      standby: 1,
      scan: 18,
      category: 'medium',
      priority: 2,
    }

    if (!action) {
      return {
        success: true,
        output: [
          '',
          '╭─────────────────────────────────────────────────╮',
          '│       QSM-001 :: QUANTUM STATE MONITOR           │',
          '╰─────────────────────────────────────────────────╯',
          '',
          '  USAGE:',
          '    qsm status              Show quantum state',
          '    qsm power [on|off]      Power on/shutdown monitor',
          '    qsm firmware            View firmware info',
          '    qsm firmware update     Check for firmware updates',
          '    qsm test                Run quantum diagnostics',
          '    qsm reset               Reboot quantum monitor',
          '    qsm fold                Fold device to compact view',
          '    qsm unfold              Unfold to full view',
          '    qsm toggle              Toggle fold state',
          '    qsm info                Full documentation',
          '',
          '  EXAMPLES:',
          '    qsm power on            Boot the quantum monitor',
          '    qsm test                Run coherence diagnostics',
          '    qsm status              Check qubit array state',
          '',
        ],
      }
    }

    if (action === 'status' || action === 'stat' || action === 's') {
      const stateSymbol = state.deviceState === 'online' ? '●' : state.deviceState === 'standby' ? '○' : '◐'
      const stateColor = state.deviceState === 'online' ? 'ONLINE' : state.deviceState.toUpperCase()

      const barLen = 15
      const cohFilled = Math.round((state.coherence / 100) * barLen)
      const cohBar = '█'.repeat(cohFilled) + '░'.repeat(barLen - cohFilled)

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         QSM-001 STATUS REPORT              │',
          '  └───────────────────────────────────────────┘',
          '',
          `     System State:   ${stateSymbol} ${stateColor}`,
          `     Power Draw:     ${state.currentDraw} E/s`,
          '',
          '  QUANTUM METRICS:',
          `     Coherence:  [${cohBar}] ${state.coherence}%`,
          `     Qubits:         ${state.qubits} active`,
          `     Entangled:      ${state.isEntangled ? 'YES ◉' : 'NO  ○'}`,
          `     Error Rate:     ${state.errorRate}%`,
          `     Temperature:    ${state.temperature}°K`,
          '',
          `  Firmware: v${firmware.version}   Category: ${powerSpecs.category.toUpperCase()}`,
          '',
        ],
      }
    }

    if (action === 'power') {
      const subAction = args[1]?.toLowerCase()
      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  QSM-001 Power State: ${state.isPowered ? 'ON' : 'STANDBY'}`,
            '  usage: qsm power [on|off]',
            '',
          ],
        }
      }
      if (subAction === 'on') {
        if (state.deviceState !== 'standby') {
          return { success: true, output: ['', '  QSM-001 is already powered on.', ''] }
        }
        ctx.addOutput('[qsm] Initiating QSM-001 boot sequence...')
        ctx.addOutput('[qsm] Cooling qubit array to 15°K...')
        await qsmDevice?.powerOn()
        return {
          success: true,
          output: ['[qsm] QSM-001 is now ONLINE — 127 qubits entangled', ''],
        }
      }
      if (subAction === 'off') {
        if (state.deviceState === 'standby') {
          return { success: true, output: ['', '  QSM-001 is already in standby.', ''] }
        }
        ctx.addOutput('[qsm] Initiating QSM-001 shutdown...')
        ctx.addOutput('[qsm] Collapsing quantum states...')
        await qsmDevice?.powerOff()
        return {
          success: true,
          output: ['[qsm] QSM-001 is now in STANDBY', ''],
        }
      }
      return { success: false, error: 'usage: qsm power [on|off]' }
    }

    if (action === 'firmware' || action === 'fw') {
      const subAction = args[1]?.toLowerCase()

      if (subAction === 'update' || subAction === 'upgrade') {
        return {
          success: true,
          output: [
            '',
            '[qsm] Checking for firmware updates...',
            '[qsm] Connecting to IBM Quantum Network...... OK',
            `[qsm] Current version: v${firmware.version}`,
            '[qsm] Latest version:  v1.2.0',
            '',
            `[qsm] Security patch: ${firmware.securityPatch}`,
            '[qsm] Firmware is up to date.',
            '',
          ],
        }
      }

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         QSM-001 FIRMWARE INFO              │',
          '  └───────────────────────────────────────────┘',
          '',
          `     Version:        v${firmware.version}`,
          `     Build:          ${firmware.build}`,
          `     Checksum:       ${firmware.checksum}`,
          `     Security Patch: ${firmware.securityPatch}`,
          '',
          '     Features:',
          ...firmware.features.map(f => `       - ${f}`),
          '',
          '  use: qsm firmware update   to check for updates',
          '',
        ],
      }
    }

    if (action === 'test' || action === 'diag') {
      if (state.deviceState !== 'online') {
        return { success: false, error: 'QSM-001 must be online to run diagnostics.\nUse: qsm power on' }
      }
      ctx.addOutput('[qsm] Running QSM-001 quantum diagnostics...')
      ctx.addOutput('[qsm] Measuring coherence time...')
      await qsmDevice?.runTest()
      return {
        success: true,
        output: [
          '[qsm] All diagnostics PASSED',
          '  - Coherence:      OK  (T2 = 120μs)',
          '  - Entanglement:   OK  (Bell state fidelity 99.2%)',
          '  - Decoherence:    OK  (within tolerance)',
          '  - Error correct:  OK  (surface code active)',
          '',
        ],
      }
    }

    if (action === 'reset' || action === 'reboot') {
      if (state.deviceState === 'standby') {
        return { success: false, error: 'QSM-001 is in standby. Use: qsm power on' }
      }
      ctx.addOutput('[qsm] Rebooting QSM-001...')
      ctx.addOutput('[qsm] Re-cooling qubit array...')
      await qsmDevice?.reboot()
      return {
        success: true,
        output: ['[qsm] QSM-001 reboot complete', ''],
      }
    }

    if (action === 'fold') {
      qsmDevice?.setExpanded(false)
      return { success: true, output: ['', '  QSM-001 folded to compact view.', ''] }
    }

    if (action === 'unfold' || action === 'expand') {
      if (state.deviceState === 'standby') {
        return { success: false, error: 'QSM-001 is in standby. Use: qsm power on' }
      }
      qsmDevice?.setExpanded(true)
      return { success: true, output: ['', '  QSM-001 unfolded to full view.', ''] }
    }

    if (action === 'toggle') {
      if (state.deviceState === 'standby') {
        return { success: false, error: 'QSM-001 is in standby. Use: qsm power on' }
      }
      qsmDevice?.toggleExpanded()
      return { success: true, output: ['', '  QSM-001 fold state toggled.', ''] }
    }

    if (action === 'info' || action === 'help') {
      return {
        success: true,
        output: [
          '',
          '╔═══════════════════════════════════════════════════════════╗',
          '║            QSM-001 :: QUANTUM STATE MONITOR               ║',
          '║                 Device Documentation                      ║',
          '╚═══════════════════════════════════════════════════════════╝',
          '',
          '  OVERVIEW:',
          '    127-qubit quantum coherence monitor with real-time wave',
          '    function display. Tracks entanglement state, coherence',
          '    percentage, error rates, and cryogenic temperature.',
          '',
          '  SPECIFICATIONS:',
          `    Firmware:      v${firmware.version} (build ${firmware.build})`,
          `    Checksum:      ${firmware.checksum}`,
          '    Qubit Array:   127 qubits (IBM Eagle topology)',
          '    Coherence:     T2 ~ 120μs',
          '    Error Correct: Surface code, distance 3',
          '    Cryogenics:    15°K dilution refrigerator',
          '',
          '  POWER CONSUMPTION:',
          `    Full Load:     ${powerSpecs.full} E/s`,
          `    Idle:          ${powerSpecs.idle} E/s`,
          `    Standby:       ${powerSpecs.standby} E/s`,
          `    Scan/Test:     ${powerSpecs.scan} E/s`,
          `    Category:      ${powerSpecs.category}`,
          `    Priority:      P${powerSpecs.priority}`,
          '',
          '  FEATURES:',
          ...firmware.features.map(f => `    - ${f}`),
          '',
          '  COMPATIBLE DEVICES:',
          '    QAN-001  Quantum Analyzer (quantum operations)',
          '    SCA-001  Supercomputer Array (classical control)',
          '    AIC-001  AI Assistant Core (error optimization)',
          '',
          '  TROUBLESHOOTING:',
          '    - Low coherence: check cryogenic system temperature',
          '    - No entanglement: run qsm test to verify Bell states',
          '    - High error rate: reboot with qsm reset',
          '',
          '  See also: cat ~/.local/docs/qsm001.txt',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown qsm subcommand: ${action}\nusage: qsm [status|power|firmware|test|reset|fold|unfold|toggle|info]`,
    }
  },
}

const vntCommand: Command = {
  name: 'vnt',
  aliases: ['vent', 'ventilation', 'fan', 'vnt001', 'cooling'],
  description: 'Ventilation System management (VNT-001)',
  usage: 'vnt [status|power|firmware|test|reset|fan|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const vntDevice = ctx.data.vntDevice
    const action = args[0]?.toLowerCase()

    // Get current state from device if available (fallback defaults for standalone terminal)
    const state = vntDevice?.getState() ?? {
      deviceState: 'online' as const,
      statusMessage: 'Fans operational',
      isPowered: true,
      cpuFan: { speed: 50, rpm: 2800, mode: 'AUTO', isOn: true },
      gpuFan: { speed: 45, rpm: 2600, mode: 'AUTO', isOn: true },
      cpuTemp: 34,
      gpuTemp: 38,
      currentDraw: 2,
      filterHealth: 98,
      airQuality: 95,
      humidity: 42,
    }
    const firmware = vntDevice?.getFirmware() ?? {
      version: '1.0.0',
      build: '2026.01.28',
      checksum: 'V4F1N7E2',
      features: ['air-exchange', 'hepa-filter', 'humidity-ctrl', 'damper-ctrl', 'dual-fan'],
      securityPatch: '2026.01.20',
    }
    const powerSpecs = vntDevice?.getPowerSpecs() ?? {
      full: 4,
      idle: 2,
      standby: 0.5,
      emergency: 12,
      category: 'light',
      priority: 1,
    }

    const currentStatus = state.deviceState
    const isPowered = state.isPowered
    const cpuFan = state.cpuFan
    const gpuFan = state.gpuFan
    const cpuTemp = state.cpuTemp
    const gpuTemp = state.gpuTemp

    // No args - show usage
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '╭─────────────────────────────────────────────────╮',
          '│         VNT-001 :: VENTILATION SYSTEM            │',
          '╰─────────────────────────────────────────────────╯',
          '',
          '  USAGE:',
          '    vnt status              Show fan status',
          '    vnt power [on|off]      Power on/shutdown system',
          '    vnt firmware            View firmware info',
          '    vnt test                Run fan diagnostics',
          '    vnt reset               Reboot fan controller',
          '    vnt fan <cpu|gpu> <cmd> Control individual fan',
          '    vnt mode <mode>        Set all fans mode',
          '    vnt emergency          Emergency purge (max airflow)',
          '    vnt fold               Fold device panel',
          '    vnt unfold             Unfold device panel',
          '    vnt toggle             Toggle fold state',
          '    vnt info               Full documentation',
          '',
          '  FAN COMMANDS:',
          '    vnt fan cpu speed 75    Set CPU fan to 75%',
          '    vnt fan gpu mode high   Set GPU fan mode',
          '    vnt fan cpu on|off      Toggle CPU fan',
          '',
          '  EXAMPLES:',
          '    vnt power on            Boot the ventilation system',
          '    vnt fan cpu mode auto   Set CPU fan to auto mode',
          '    vnt status              Check fan status',
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat' || action === 's') {
      const stateSymbol = currentStatus === 'online' ? '●' : currentStatus === 'standby' ? '○' : '◐'
      const stateColor = currentStatus === 'online' ? 'ONLINE' : currentStatus.toUpperCase()

      // Fan speed bars
      const barLen = 15
      const cpuFilled = Math.round((cpuFan.speed / 100) * barLen)
      const gpuFilled = Math.round((gpuFan.speed / 100) * barLen)
      const cpuBar = '█'.repeat(cpuFilled) + '░'.repeat(barLen - cpuFilled)
      const gpuBar = '█'.repeat(gpuFilled) + '░'.repeat(barLen - gpuFilled)

      const getTempIndicator = (temp: number) => {
        if (temp < 30) return '○'
        if (temp < 40) return '◐'
        if (temp < 50) return '●'
        return '◉'
      }

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         VNT-001 STATUS REPORT             │',
          '  └───────────────────────────────────────────┘',
          '',
          `     System State:   ${stateSymbol} ${stateColor}`,
          `     Power Draw:     ${state.currentDraw} E/s`,
          '',
          '  ┌──────────────────────────────────────────────┐',
          '  │  CPU FAN                │  GPU FAN            │',
          '  ├────────────────────────┼─────────────────────┤',
          `  │  State:  ${cpuFan.isOn ? 'ON ' : 'OFF'}           │  State:  ${gpuFan.isOn ? 'ON ' : 'OFF'}          │`,
          `  │  Mode:   ${cpuFan.mode.padEnd(4)}          │  Mode:   ${gpuFan.mode.padEnd(4)}         │`,
          `  │  Speed:  ${String(cpuFan.speed).padStart(3)}%          │  Speed:  ${String(gpuFan.speed).padStart(3)}%         │`,
          `  │  RPM:    ${String(cpuFan.rpm).padStart(4)}          │  RPM:    ${String(gpuFan.rpm).padStart(4)}         │`,
          `  │  [${cpuBar}]  │  [${gpuBar}] │`,
          '  └────────────────────────┴─────────────────────┘',
          '',
          '  THERMAL READINGS:',
          `     CPU: ${getTempIndicator(cpuTemp)} ${cpuTemp.toFixed(1)}°C     GPU: ${getTempIndicator(gpuTemp)} ${gpuTemp.toFixed(1)}°C`,
          '',
          '  ENVIRONMENT:',
          `     Filter Health: ${state.filterHealth}%   Air Quality: ${state.airQuality}%`,
          `     Humidity: ${state.humidity}%`,
          '',
          `  Firmware: v${firmware.version}   Category: ${powerSpecs.category.toUpperCase()}`,
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power' || action === 'pwr' || action === 'p') {
      const subAction = args[1]?.toLowerCase()

      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  VNT-001 Ventilation System: ${isPowered ? 'ACTIVE' : 'OFFLINE'}`,
            `  Power Draw: ${state.currentDraw} E/s`,
            '',
            '  Usage: vnt power [on|off]',
            '',
          ],
        }
      }

      if (subAction === 'on' || subAction === 'boot' || subAction === 'start') {
        if (isPowered && (currentStatus === 'online' || currentStatus === 'booting')) {
          return {
            success: false,
            error: `[VNT-001] Ventilation system already ${currentStatus.toUpperCase()}.`,
          }
        }

        ctx.setTyping(true)

        if (vntDevice) {
          await vntDevice.powerOn()
        } else {
          await new Promise(r => setTimeout(r, 1500))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      VNT-001 BOOT SEQUENCE                ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [■□□□□□] Power check...',
            '  [■■□□□□] Motor init...',
            '  [■■■□□□] HEPA filter check...',
            '  [■■■■□□] Damper control...',
            '  [■■■■■□] Calibrating sensors...',
            '  [■■■■■■] System online',
            '',
            '  Status: ONLINE',
            `  Power Draw: ${powerSpecs.idle} E/s`,
            '  Fans: OPERATIONAL',
            '',
          ],
        }
      }

      if (subAction === 'off' || subAction === 'shutdown' || subAction === 'stop') {
        if (!isPowered || currentStatus === 'standby' || currentStatus === 'shutdown') {
          return {
            success: false,
            error: '[VNT-001] Ventilation system already in standby.',
          }
        }
        if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
          return {
            success: false,
            error: `[VNT-001] Cannot shutdown - operation in progress (${currentStatus}).`,
          }
        }

        ctx.setTyping(true)

        if (vntDevice) {
          await vntDevice.powerOff()
        } else {
          await new Promise(r => setTimeout(r, 1200))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      VNT-001 SHUTDOWN SEQUENCE            ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [■■■■■■] Fan slowdown...',
            '  [■■■□□□] Closing dampers...',
            '  [□□□□□□] System offline',
            '',
            '  Status: STANDBY',
            `  Power Draw: ${powerSpecs.standby} E/s`,
            '',
            '  ⚠ WARNING: Thermal protection offline.',
            '    Ensure alternative cooling is available.',
            '',
          ],
        }
      }

      return {
        success: false,
        error: `Unknown power option: ${subAction}\n\nUsage: vnt power [on|off]`,
      }
    }

    // FAN command
    if (action === 'fan' || action === 'f') {
      const fanId = args[1]?.toLowerCase()
      const fanCmd = args[2]?.toLowerCase()

      if (!fanId) {
        return {
          success: true,
          output: [
            '',
            '  VNT-001 FAN CONTROL:',
            '',
            '  Usage: vnt fan <cpu|gpu> <command> [value]',
            '',
            '  Commands:',
            '    speed <0-100>         Set fan speed percentage',
            '    mode <auto|low|med|high>  Set fan mode',
            '    on | off              Toggle fan power',
            '',
            '  Examples:',
            '    vnt fan cpu speed 75',
            '    vnt fan gpu mode auto',
            '    vnt fan cpu off',
            '',
          ],
        }
      }

      if (fanId !== 'cpu' && fanId !== 'gpu') {
        return {
          success: false,
          error: `Unknown fan: ${fanId}\nAvailable fans: cpu, gpu`,
        }
      }

      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[VNT-001] System must be ONLINE to control fans (current: ${currentStatus.toUpperCase()}).`,
        }
      }

      if (!fanCmd) {
        const fan = fanId === 'cpu' ? cpuFan : gpuFan
        const temp = fanId === 'cpu' ? cpuTemp : gpuTemp
        return {
          success: true,
          output: [
            '',
            `  VNT-001 ${fanId.toUpperCase()} FAN:`,
            `    State:  ${fan.isOn ? 'ON' : 'OFF'}`,
            `    Mode:   ${fan.mode}`,
            `    Speed:  ${fan.speed}%`,
            `    RPM:    ${fan.rpm}`,
            `    Temp:   ${temp.toFixed(1)}°C`,
            '',
          ],
        }
      }

      if (fanCmd === 'speed' || fanCmd === 'spd') {
        const speedVal = parseInt(args[3] ?? '', 10)
        if (isNaN(speedVal) || speedVal < 0 || speedVal > 100) {
          return {
            success: false,
            error: `Invalid speed value. Usage: vnt fan ${fanId} speed <0-100>`,
          }
        }

        if (vntDevice) vntDevice.setFanSpeed(fanId as 'cpu' | 'gpu', speedVal)

        return {
          success: true,
          output: [
            '',
            `  [VNT-001] ${fanId.toUpperCase()} fan speed set to ${speedVal}%`,
            ...(vntDevice ? [] : ['  Note: open panel for bidirectional sync.']),
            '',
          ],
        }
      }

      if (fanCmd === 'mode') {
        const modeVal = args[3]?.toUpperCase()
        if (!modeVal || !['AUTO', 'LOW', 'MED', 'HIGH'].includes(modeVal)) {
          return {
            success: false,
            error: `Invalid mode. Usage: vnt fan ${fanId} mode <auto|low|med|high>`,
          }
        }

        if (vntDevice) vntDevice.setFanMode(fanId as 'cpu' | 'gpu', modeVal as 'AUTO' | 'LOW' | 'MED' | 'HIGH')

        return {
          success: true,
          output: [
            '',
            `  [VNT-001] ${fanId.toUpperCase()} fan mode set to ${modeVal}`,
            '  Note: use panel fan controls for real-time adjustment.',
            '',
          ],
        }
      }

      if (fanCmd === 'on' || fanCmd === 'start') {
        if (vntDevice) vntDevice.toggleFan(fanId as 'cpu' | 'gpu', true)

        return {
          success: true,
          output: [
            '',
            `  [VNT-001] ${fanId.toUpperCase()} fan started.`,
            '',
          ],
        }
      }

      if (fanCmd === 'off' || fanCmd === 'stop') {
        if (vntDevice) vntDevice.toggleFan(fanId as 'cpu' | 'gpu', false)

        return {
          success: true,
          output: [
            '',
            `  [VNT-001] ${fanId.toUpperCase()} fan stopped.`,
            '  ⚠ WARNING: Reduced cooling capacity.',
            '',
          ],
        }
      }

      return {
        success: false,
        error: `Unknown fan command: ${fanCmd}\n\nUsage: vnt fan ${fanId} <speed|mode|on|off>`,
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw') {
      const subAction = args[1]?.toLowerCase()

      if (subAction === 'update' || subAction === 'upgrade') {
        ctx.setTyping(true)
        await new Promise(r => setTimeout(r, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  [VNT-001] Checking for firmware updates...',
            '',
            `  Current: v${firmware.version}`,
            `  Latest:  v${firmware.version}`,
            '',
            '  ✓ Firmware is up to date.',
            '',
          ],
        }
      }

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         VNT-001 FIRMWARE INFO             │',
          '  └───────────────────────────────────────────┘',
          '',
          `  Version:        ${firmware.version}`,
          `  Build:          ${firmware.build}`,
          `  Checksum:       ${firmware.checksum}`,
          `  Security Patch: ${firmware.securityPatch}`,
          '',
          '  Features:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  Run "vnt firmware update" to check for updates.',
          '',
        ],
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag' || action === 't') {
      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[VNT-001] System must be ONLINE to run diagnostics (current: ${currentStatus.toUpperCase()}).`,
        }
      }

      ctx.setTyping(true)

      if (vntDevice) {
        await vntDevice.runTest()
      } else {
        await new Promise(r => setTimeout(r, 2500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      VNT-001 DIAGNOSTICS                  ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [✓] Motor bearings............ PASS',
          '  [✓] Airflow rate.............. PASS',
          '  [✓] HEPA filter............... PASS',
          '  [✓] Damper control............ PASS',
          '  [✓] Sensor calibration........ PASS',
          '',
          '  All diagnostics PASSED.',
          '',
          `  CPU Fan: ${cpuFan.rpm} RPM @ ${cpuFan.speed}%`,
          `  GPU Fan: ${gpuFan.rpm} RPM @ ${gpuFan.speed}%`,
          '',
        ],
      }
    }

    // RESET command
    if (action === 'reset' || action === 'reboot' || action === 'r') {
      if (currentStatus === 'standby' || currentStatus === 'shutdown') {
        return {
          success: false,
          error: '[VNT-001] System must be powered on to reboot.',
        }
      }
      if (currentStatus === 'booting' || currentStatus === 'rebooting') {
        return {
          success: false,
          error: '[VNT-001] Boot/reboot already in progress.',
        }
      }

      ctx.setTyping(true)

      if (vntDevice) {
        await vntDevice.reboot()
      } else {
        await new Promise(r => setTimeout(r, 2500))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      VNT-001 REBOOT SEQUENCE              ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [DECEL] Decelerating fans...',
          '  [SAVE ] Saving fan profiles...',
          '  [PARK ] Parking motors...',
          '  [HALT ] System halted...',
          '  [BOOT ] Reinitializing...',
          '  [SPIN ] Spinning up fans...',
          '  [ OK  ] System online',
          '',
          '  Reboot complete. All fans operational.',
          '',
        ],
      }
    }

    // FOLD commands
    if (action === 'fold') {
      vntDevice?.setExpanded(false)
      return { success: true, output: ['', '  VNT-001 panel folded.', ''] }
    }
    if (action === 'unfold' || action === 'expand') {
      vntDevice?.setExpanded(true)
      return { success: true, output: ['', '  VNT-001 panel unfolded.', ''] }
    }
    if (action === 'toggle') {
      const current = vntDevice?.getState().isExpanded ?? true
      vntDevice?.setExpanded(!current)
      return { success: true, output: ['', `  VNT-001 panel ${current ? 'folded' : 'unfolded'}.`, ''] }
    }

    // INFO command
    if (action === 'info' || action === 'help' || action === 'doc') {
      return {
        success: true,
        output: [
          '',
          '╔═════════════════════════════════════════════════════════════════╗',
          '║                    VNT-001 DOCUMENTATION                       ║',
          '╠═════════════════════════════════════════════════════════════════╣',
          '',
          '  DEVICE OVERVIEW:',
          '    The Ventilation System (VNT-001) is a dual-fan cooling unit',
          '    responsible for maintaining safe operating temperatures for',
          '    all laboratory equipment. Operates in auto or manual modes.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:      VNT-001',
          '    Category:       Light Consumer',
          '    Tier:           T1 (Starter)',
          '    Fan Count:      2 (CPU + GPU)',
          '    Max RPM:        4800',
          '',
          '  POWER CONSUMPTION:',
          `    Full Operation:  ${powerSpecs.full} E/s`,
          `    Idle Mode:       ${powerSpecs.idle} E/s`,
          `    Standby:         ${powerSpecs.standby} E/s`,
          `    Emergency:       ${powerSpecs.emergency} E/s (max cooling)`,
          '',
          '  FAN MODES:',
          '    AUTO:  Speed adjusts based on temperature',
          '    LOW:   25% speed (quiet operation)',
          '    MED:   50% speed (balanced)',
          '    HIGH:  100% speed (maximum cooling)',
          '',
          `  FIRMWARE: v${firmware.version}`,
          '  FEATURES:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  CONNECTED DEVICES:',
          '    THM-001  Thermal Manager (Temperature Data)',
          '    CPU-001  CPU Monitor (Load Data)',
          '    TMP-001  Temperature Monitor (Ambient)',
          '',
          '  COMMANDS:',
          '    vnt status              - Show fan status',
          '    vnt power [on|off]      - Boot/shutdown',
          '    vnt firmware            - View firmware info',
          '    vnt test                - Run fan diagnostics',
          '    vnt reset               - Reboot controller',
          '    vnt fan <cpu|gpu> <cmd> - Control individual fan',
          '    vnt fold                - Fold device panel',
          '    vnt unfold              - Unfold device panel',
          '    vnt toggle              - Toggle fold state',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/vnt-001/',
          '    /var/log/vnt/',
          '    /etc/vnt/config',
          '',
          '╚═════════════════════════════════════════════════════════════════╝',
          '',
        ],
      }
    }

    // EMERGENCY PURGE command
    if (action === 'emergency' || action === 'purge') {
      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[VNT-001] System must be ONLINE for emergency purge (current: ${currentStatus.toUpperCase()}).`,
        }
      }

      ctx.setTyping(true)
      if (vntDevice) {
        await vntDevice.emergencyPurge()
      } else {
        await new Promise(r => setTimeout(r, 3000))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      ⚠ EMERGENCY PURGE ACTIVATED ⚠       ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  All fans set to 100% - Maximum airflow',
          `  Power Draw: ${powerSpecs.emergency} E/s`,
          '',
          '  Purge complete. Returning to normal operation.',
          '',
        ],
      }
    }

    // MODE shortcut command (vnt mode auto/low/med/high)
    if (action === 'mode') {
      const modeVal = args[1]?.toUpperCase()
      if (!modeVal || !['AUTO', 'LOW', 'MED', 'HIGH'].includes(modeVal)) {
        return {
          success: false,
          error: 'Usage: vnt mode <auto|low|med|high>',
        }
      }

      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[VNT-001] System must be ONLINE to change mode (current: ${currentStatus.toUpperCase()}).`,
        }
      }

      if (vntDevice) {
        vntDevice.setFanMode('cpu', modeVal as 'AUTO' | 'LOW' | 'MED' | 'HIGH')
        vntDevice.setFanMode('gpu', modeVal as 'AUTO' | 'LOW' | 'MED' | 'HIGH')
      }

      return {
        success: true,
        output: [
          '',
          `  [VNT-001] All fans set to ${modeVal} mode.`,
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown vnt command: ${action}\n\ntype vnt for available commands.`,
    }
  },
}

const scaCommand: Command = {
  name: 'sca',
  aliases: ['super', 'supercomputer', 'sca001', 'cluster'],
  description: 'Supercomputer Array management (SCA-001)',
  usage: 'sca [status|power|firmware|test|reset|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const scaDevice = ctx.data.scaDevice
    const action = args[0]?.toLowerCase()

    // Get current state from device if available
    const state = scaDevice?.getState() ?? {
      deviceState: 'online' as const,
      statusMessage: 'READY',
      isPowered: true,
      flops: 2.4,
      utilization: 87,
      activeNodes: 16,
      jobQueue: 7,
      temperature: 42,
      memoryUsage: 62,
      interconnectBandwidth: 156,
      uptime: 0,
      currentDraw: 15,
    }
    const firmware = scaDevice?.getFirmware() ?? {
      version: '5.2.0',
      build: '2026.01.28',
      checksum: 'C8A5F2E7',
      features: ['16-node-cluster', 'ecc-memory', 'job-scheduler', 'linpack-bench', 'interconnect-mesh'],
      securityPatch: '2026.01.20',
    }
    const powerSpecs = scaDevice?.getPowerSpecs() ?? {
      full: 45,
      idle: 15,
      standby: 5,
      benchmark: 60,
      category: 'heavy',
      priority: 3,
    }

    const currentStatus = state.deviceState
    const isPowered = state.isPowered

    // No args - show usage
    if (!action) {
      return {
        success: true,
        output: [
          '',
          '╭─────────────────────────────────────────────────╮',
          '│     SCA-001 :: SUPERCOMPUTER ARRAY               │',
          '╰─────────────────────────────────────────────────╯',
          '',
          '  USAGE:',
          '    sca status          Show cluster status',
          '    sca power [on|off]  Power on/shutdown cluster',
          '    sca firmware        View firmware info',
          '    sca test            Run cluster diagnostics',
          '    sca reset           Reboot cluster',
          '    sca fold            Fold device panel',
          '    sca unfold          Unfold device panel',
          '    sca toggle          Toggle fold state',
          '    sca info            Full documentation',
          '',
          '  EXAMPLES:',
          '    sca power on        Boot the cluster',
          '    sca status          Check node status',
          '    sca test            Run LINPACK benchmark',
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat' || action === 's') {
      const stateSymbol = currentStatus === 'online' ? '●' : currentStatus === 'standby' ? '○' : '◐'
      const stateColor = currentStatus === 'online' ? 'ONLINE' : currentStatus.toUpperCase()

      // Node visualization
      const nodeViz = Array.from({ length: 16 }).map((_, i) =>
        i < state.activeNodes ? '■' : '□'
      ).join('')

      // Utilization bar
      const barLen = 20
      const filled = Math.round((state.utilization / 100) * barLen)
      const utilBar = '█'.repeat(filled) + '░'.repeat(barLen - filled)

      // Memory bar
      const memFilled = Math.round((state.memoryUsage / 100) * barLen)
      const memBar = '█'.repeat(memFilled) + '░'.repeat(barLen - memFilled)

      const formatUptime = (s: number) => {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        return `${h}h ${m}m`
      }

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         SCA-001 STATUS REPORT             │',
          '  └───────────────────────────────────────────┘',
          '',
          `     Cluster State:  ${stateSymbol} ${stateColor}`,
          `     Power Draw:     ${state.currentDraw.toFixed(1)} E/s`,
          `     Uptime:         ${formatUptime(state.uptime)}`,
          '',
          '  COMPUTE NODES:',
          `     [${nodeViz}]`,
          `     Active: ${state.activeNodes}/16    Jobs: ${state.jobQueue}`,
          '',
          '  PERFORMANCE:',
          `     PFLOPS:     ${state.flops.toFixed(1)}`,
          `     Load:       [${utilBar}] ${Math.round(state.utilization)}%`,
          `     Memory:     [${memBar}] ${Math.round(state.memoryUsage)}%`,
          `     Interconn:  ${state.interconnectBandwidth.toFixed(0)} GB/s`,
          '',
          '  THERMAL:',
          `     Avg Temp:   ${state.temperature.toFixed(1)}°C`,
          '',
          `  Firmware: v${firmware.version}   Category: ${powerSpecs.category.toUpperCase()}`,
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power' || action === 'pwr' || action === 'p') {
      const subAction = args[1]?.toLowerCase()

      if (!subAction) {
        return {
          success: true,
          output: [
            '',
            `  SCA-001 Power State: ${isPowered ? 'ON' : 'STANDBY'}`,
            `  Current Draw: ${state.currentDraw.toFixed(1)} E/s`,
            '',
            '  Usage: sca power [on|off]',
            '',
          ],
        }
      }

      if (subAction === 'on' || subAction === 'boot' || subAction === 'start') {
        if (isPowered && (currentStatus === 'online' || currentStatus === 'booting')) {
          return {
            success: false,
            error: `[SCA-001] Cluster already ${currentStatus.toUpperCase()}.`,
          }
        }

        ctx.setTyping(true)
        if (scaDevice) {
          await scaDevice.powerOn()
        } else {
          await new Promise(r => setTimeout(r, 2000))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      SCA-001 BOOT SEQUENCE                ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [■□□□□□□] POST check...',
            '  [■■□□□□□] Node discovery...',
            '  [■■■□□□□] Interconnect init...',
            '  [■■■■□□□] Memory allocation...',
            '  [■■■■■□□] Scheduler online...',
            '  [■■■■■■□] Benchmark calibrate...',
            '  [■■■■■■■] Cluster online',
            '',
            '  Status: ONLINE',
            `  Nodes: 16/16 active`,
            `  Power Draw: ${powerSpecs.idle} E/s`,
            '',
          ],
        }
      }

      if (subAction === 'off' || subAction === 'shutdown' || subAction === 'stop') {
        if (!isPowered || currentStatus === 'standby' || currentStatus === 'shutdown') {
          return {
            success: false,
            error: '[SCA-001] Cluster already in standby.',
          }
        }
        if (currentStatus === 'booting' || currentStatus === 'rebooting' || currentStatus === 'testing') {
          return {
            success: false,
            error: `[SCA-001] Cannot shutdown - operation in progress (${currentStatus}).`,
          }
        }

        ctx.setTyping(true)
        if (scaDevice) {
          await scaDevice.powerOff()
        } else {
          await new Promise(r => setTimeout(r, 1500))
        }
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  ╔═══════════════════════════════════════════╗',
            '  ║      SCA-001 SHUTDOWN SEQUENCE            ║',
            '  ╚═══════════════════════════════════════════╝',
            '',
            '  [■■■■■■■] Draining job queue...',
            '  [■■■□□□□] Node shutdown...',
            '  [□□□□□□□] Cluster offline',
            '',
            '  Status: STANDBY',
            `  Power Draw: ${powerSpecs.standby} E/s`,
            '',
            '  ⚠ WARNING: Compute resources unavailable.',
            '    Research and simulations suspended.',
            '',
          ],
        }
      }

      return {
        success: false,
        error: `Unknown power option: ${subAction}\n\nUsage: sca power [on|off]`,
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw') {
      const subAction = args[1]?.toLowerCase()

      if (subAction === 'update' || subAction === 'upgrade') {
        ctx.setTyping(true)
        await new Promise(r => setTimeout(r, 1500))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  [SCA-001] Checking for firmware updates...',
            '',
            `  Current: v${firmware.version}`,
            `  Latest:  v${firmware.version}`,
            '',
            '  ✓ Firmware is up to date.',
            '',
          ],
        }
      }

      if (subAction === 'patch') {
        ctx.setTyping(true)
        await new Promise(r => setTimeout(r, 1200))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  [SCA-001] Checking security patches...',
            '',
            `  Current Patch: ${firmware.securityPatch}`,
            `  Latest Patch:  ${firmware.securityPatch}`,
            '',
            '  ✓ Security patches are current.',
            '',
          ],
        }
      }

      if (subAction === 'verify') {
        ctx.setTyping(true)
        await new Promise(r => setTimeout(r, 1000))
        ctx.setTyping(false)

        return {
          success: true,
          output: [
            '',
            '  [SCA-001] Verifying firmware integrity...',
            '',
            `  Checksum: ${firmware.checksum}`,
            '  Status: ✓ VERIFIED',
            '',
          ],
        }
      }

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          '  │         SCA-001 FIRMWARE INFO             │',
          '  └───────────────────────────────────────────┘',
          '',
          `  Version:        ${firmware.version}`,
          `  Build:          ${firmware.build}`,
          `  Checksum:       ${firmware.checksum}`,
          `  Security Patch: ${firmware.securityPatch}`,
          '',
          '  Features:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  Run "sca firmware update" to check for updates.',
          '  Run "sca firmware verify" to verify integrity.',
          '  Run "sca firmware patch" to check security patches.',
          '',
        ],
      }
    }

    // TEST command
    if (action === 'test' || action === 'diag' || action === 't' || action === 'bench' || action === 'benchmark') {
      if (currentStatus !== 'online') {
        return {
          success: false,
          error: `[SCA-001] Cluster must be ONLINE to run diagnostics (current: ${currentStatus.toUpperCase()}).`,
        }
      }

      ctx.setTyping(true)
      if (scaDevice) {
        await scaDevice.runTest()
      } else {
        await new Promise(r => setTimeout(r, 3000))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      SCA-001 DIAGNOSTICS                  ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [✓] Compute nodes............ PASS  (16/16)',
          '  [✓] Interconnect mesh........ PASS',
          '  [✓] ECC memory............... PASS',
          '  [✓] L3 cache coherency....... PASS',
          '  [✓] Job scheduler............ PASS',
          '  [✓] LINPACK benchmark........ PASS',
          '',
          '  All diagnostics PASSED.',
          '',
          `  Peak PFLOPS: ${state.flops.toFixed(1)}`,
          `  Active Nodes: ${state.activeNodes}/16`,
          `  Cluster Temp: ${state.temperature.toFixed(1)}°C`,
          '',
        ],
      }
    }

    // RESET command
    if (action === 'reset' || action === 'reboot' || action === 'restart' || action === 'r') {
      if (currentStatus !== 'online' && currentStatus !== 'testing') {
        return {
          success: false,
          error: `[SCA-001] Cluster must be ONLINE to reboot (current: ${currentStatus.toUpperCase()}).`,
        }
      }

      ctx.setTyping(true)
      if (scaDevice) {
        await scaDevice.reboot()
      } else {
        await new Promise(r => setTimeout(r, 3000))
      }
      ctx.setTyping(false)

      return {
        success: true,
        output: [
          '',
          '  ╔═══════════════════════════════════════════╗',
          '  ║      SCA-001 REBOOT SEQUENCE              ║',
          '  ╚═══════════════════════════════════════════╝',
          '',
          '  [DRAIN] Draining job queue...',
          '  [SHUT ] Node shutdown...',
          '  [CYCLE] Power cycle...',
          '  [HALT ] Cluster offline...',
          '  [BOOT ] Reinitializing...',
          '  [BENCH] Benchmark calibrate...',
          '  [ OK  ] Cluster online',
          '',
          '  Reboot complete. All 16 nodes operational.',
          '',
        ],
      }
    }

    // FOLD commands
    if (action === 'fold') {
      scaDevice?.setExpanded(false)
      return { success: true, output: ['', '  SCA-001 panel folded.', ''] }
    }
    if (action === 'unfold' || action === 'expand') {
      scaDevice?.setExpanded(true)
      return { success: true, output: ['', '  SCA-001 panel unfolded.', ''] }
    }
    if (action === 'toggle') {
      const current = scaDevice?.getState().isExpanded ?? true
      scaDevice?.setExpanded(!current)
      return { success: true, output: ['', `  SCA-001 panel ${current ? 'folded' : 'unfolded'}.`, ''] }
    }

    // INFO command
    if (action === 'info' || action === 'help' || action === 'doc') {
      return {
        success: true,
        output: [
          '',
          '╔═════════════════════════════════════════════════════════════════╗',
          '║                    SCA-001 DOCUMENTATION                       ║',
          '╠═════════════════════════════════════════════════════════════════╣',
          '',
          '  DEVICE OVERVIEW:',
          '    The Supercomputer Array (SCA-001) is a 16-node high-performance',
          '    computing cluster. Accelerates research, runs simulations, and',
          '    provides heavy compute capacity for the laboratory.',
          '',
          '  SPECIFICATIONS:',
          '    Device ID:      SCA-001',
          '    Category:       Heavy Consumer',
          '    Tier:           T3 (Advanced)',
          '    Compute Nodes:  16 (mesh interconnect)',
          '    Peak PFLOPS:    2.8',
          '    Memory:         ECC Protected',
          '',
          '  POWER CONSUMPTION:',
          `    Full Compute:    ${powerSpecs.full} E/s`,
          `    Idle:            ${powerSpecs.idle} E/s`,
          `    Standby:         ${powerSpecs.standby} E/s`,
          `    Benchmark:       ${powerSpecs.benchmark} E/s (LINPACK)`,
          '',
          '  CLUSTER FEATURES:',
          '    • 16-node mesh interconnect topology',
          '    • ECC memory with automatic error correction',
          '    • Job scheduler with priority queuing',
          '    • LINPACK benchmark for performance validation',
          '    • Automatic load balancing across nodes',
          '',
          `  FIRMWARE: v${firmware.version}`,
          '  FEATURES:',
          ...firmware.features.map(f => `    • ${f}`),
          '',
          '  COMPATIBLE DEVICES:',
          '    AIC-001  AI Assistant Core (Neural compute offload)',
          '    CDC-001  Crystal Data Cache (Data indexing)',
          '    QAN-001  Quantum Analyzer (Quantum simulation)',
          '    MFR-001  Microfusion Reactor (Power supply)',
          '',
          '  COMMANDS:',
          '    sca status              - Show cluster status',
          '    sca power [on|off]      - Boot/shutdown',
          '    sca firmware            - View firmware info',
          '    sca test                - Run cluster diagnostics',
          '    sca reset               - Reboot cluster',
          '    sca fold                - Fold device panel',
          '    sca unfold              - Unfold device panel',
          '    sca toggle              - Toggle fold state',
          '',
          '  LOCATION IN unOS:',
          '    /sys/devices/sca-001/',
          '    /var/log/sca/',
          '    /etc/sca/config',
          '',
          '╚═════════════════════════════════════════════════════════════════╝',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown sca command: ${action}\n\ntype sca for available commands.`,
    }
  },
}

// ============================================================
// EXD - Explorer Drone Command
// ============================================================
const exdCommand: Command = {
  name: 'exd',
  aliases: ['drone', 'explorer', 'exd001'],
  description: 'Explorer Drone management (EXD-001)',
  usage: 'exd [status|power|firmware|test|reset|deploy|recall|fold|unfold|toggle|info]',
  execute: async (args, ctx) => {
    const exdDevice = ctx.data.exdDevice
    const action = args[0]?.toLowerCase()

    const state = exdDevice?.getState() ?? {
      deviceState: 'online' as const,
      statusMessage: 'DEPLOYED',
      isPowered: true,
      range: 2.4,
      battery: 78,
      altitude: 45,
      speed: 25,
      gpsSignal: 95,
      cargoLoad: 12,
      flightTime: 7200,
      radarActive: true,
      isDeployed: true,
      currentDraw: 40,
    }
    const firmware = exdDevice?.getFirmware() ?? {
      version: '3.1.2',
      build: '2026.01.28',
      checksum: 'D3X1F7A9',
      features: ['autonomous-nav', 'resource-scan', 'cargo-haul', 'gps-lock', 'imu-stabilize'],
      securityPatch: '2026.01.20',
    }
    const powerSpecs = exdDevice?.getPowerSpecs() ?? {
      full: 40,
      idle: 15,
      standby: 1,
      highSpeed: 65,
      category: 'heavy',
      priority: 3,
    }

    const currentStatus = state.deviceState
    const isPowered = state.isPowered

    if (!action) {
      return {
        success: true,
        output: [
          '',
          '╭─────────────────────────────────────────────────╮',
          '│       EXD-001 :: EXPLORER DRONE                  │',
          '╰─────────────────────────────────────────────────╯',
          '',
          '  USAGE:',
          '    exd status           Show drone status',
          '    exd power [on|off]   Power on/shutdown drone',
          '    exd firmware         View firmware info',
          '    exd test             Run preflight diagnostics',
          '    exd reset            Reboot drone systems',
          '    exd deploy           Deploy drone to field',
          '    exd recall           Recall drone to dock',
          '    exd fold             Fold device panel',
          '    exd unfold           Unfold device panel',
          '    exd toggle           Toggle fold state',
          '    exd info             Full documentation',
          '',
          '  EXAMPLES:',
          '    exd power on         Boot the drone',
          '    exd status           Check flight telemetry',
          '    exd deploy           Send drone to explore',
          '',
        ],
      }
    }

    // STATUS command
    if (action === 'status' || action === 'stat' || action === 's') {
      const stateSymbol = currentStatus === 'online' ? '●' : currentStatus === 'standby' ? '○' : '◐'
      const stateColor = currentStatus === 'online' ? (state.isDeployed ? 'DEPLOYED' : 'DOCKED') : currentStatus.toUpperCase()

      const formatFlightTime = (s: number) => {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        return `${h}h ${m}m`
      }

      // Battery bar
      const barLen = 20
      const batFilled = Math.round((state.battery / 100) * barLen)
      const batBar = '█'.repeat(batFilled) + '░'.repeat(barLen - batFilled)

      // GPS bar
      const gpsFilled = Math.round((state.gpsSignal / 100) * barLen)
      const gpsBar = '█'.repeat(gpsFilled) + '░'.repeat(barLen - gpsFilled)

      // Cargo bar
      const cargoFilled = Math.round((state.cargoLoad / 50) * barLen)
      const cargoBar = '█'.repeat(cargoFilled) + '░'.repeat(barLen - cargoFilled)

      return {
        success: true,
        output: [
          '',
          '  ┌───────────────────────────────────────────┐',
          `  │  EXD-001 :: EXPLORER DRONE  [${stateSymbol} ${stateColor}]`,
          '  ├───────────────────────────────────────────┤',
          `  │  Range:        ${state.range.toFixed(1)} km`,
          `  │  Altitude:     ${state.altitude.toFixed(0)} m`,
          `  │  Speed:        ${state.speed.toFixed(0)} km/h`,
          `  │  Flight Time:  ${formatFlightTime(state.flightTime)}`,
          '  │',
          `  │  Battery:      ${state.battery.toFixed(0)}%  [${batBar}]`,
          `  │  GPS Signal:   ${state.gpsSignal.toFixed(0)}%  [${gpsBar}]`,
          `  │  Cargo:        ${state.cargoLoad}/50  [${cargoBar}]`,
          '  │',
          `  │  Radar:        ${state.radarActive ? 'ACTIVE' : 'OFF'}`,
          `  │  Power Draw:   ${state.currentDraw.toFixed(1)} E/s`,
          `  │  Firmware:     v${firmware.version}`,
          '  └───────────────────────────────────────────┘',
          '',
        ],
      }
    }

    // POWER command
    if (action === 'power') {
      const sub = args[1]?.toLowerCase()

      if (sub === 'on') {
        if (currentStatus !== 'standby') {
          return { success: false, error: `EXD-001 is already ${currentStatus}. Cannot power on.` }
        }
        if (exdDevice) {
          ctx.addOutput('')
          ctx.addOutput('  [EXD-001] Initiating boot sequence...')
          await exdDevice.powerOn()
          ctx.addOutput('  [EXD-001] Boot complete. Drone ONLINE.')
          ctx.addOutput('')
        }
        return { success: true }
      }

      if (sub === 'off') {
        if (currentStatus !== 'online') {
          return { success: false, error: `EXD-001 is ${currentStatus}. Cannot shutdown.` }
        }
        if (exdDevice) {
          ctx.addOutput('')
          ctx.addOutput('  [EXD-001] Initiating shutdown sequence...')
          await exdDevice.powerOff()
          ctx.addOutput('  [EXD-001] Drone in STANDBY.')
          ctx.addOutput('')
        }
        return { success: true }
      }

      return {
        success: true,
        output: [
          '',
          `  EXD-001 Power: ${isPowered ? 'ON' : 'OFF'} (${currentStatus})`,
          `  Current Draw:  ${state.currentDraw.toFixed(1)} E/s`,
          '',
          '  Usage: exd power [on|off]',
          '',
        ],
      }
    }

    // FIRMWARE command
    if (action === 'firmware' || action === 'fw') {
      const sub = args[1]?.toLowerCase()

      if (sub === 'update') {
        return {
          success: true,
          output: [
            '',
            '  [EXD-001] Checking for firmware updates...',
            `  Current:  v${firmware.version} (build ${firmware.build})`,
            '  Latest:   v3.1.2',
            '  Status:   Up to date.',
            '',
          ],
        }
      }
      if (sub === 'verify') {
        return {
          success: true,
          output: [
            '',
            '  [EXD-001] Verifying firmware integrity...',
            `  Checksum:   ${firmware.checksum}`,
            '  Expected:   D3X1F7A9',
            `  Status:     ${firmware.checksum === 'D3X1F7A9' ? 'VERIFIED ✓' : 'MISMATCH ✗'}`,
            '',
          ],
        }
      }
      if (sub === 'patch') {
        return {
          success: true,
          output: [
            '',
            '  [EXD-001] Security patch status:',
            `  Installed:  ${firmware.securityPatch}`,
            '  Latest:     2026.01.20',
            '  Status:     All patches applied.',
            '',
          ],
        }
      }

      return {
        success: true,
        output: [
          '',
          '  ┌──────────────────────────────────────┐',
          '  │  EXD-001 FIRMWARE                     │',
          '  ├──────────────────────────────────────┤',
          `  │  Version:     v${firmware.version}`,
          `  │  Build:       ${firmware.build}`,
          `  │  Checksum:    ${firmware.checksum}`,
          `  │  Patch:       ${firmware.securityPatch}`,
          '  │',
          `  │  Features:    ${firmware.features.join(', ')}`,
          '  └──────────────────────────────────────┘',
          '',
          '  Commands: exd firmware [update|verify|patch]',
          '',
        ],
      }
    }

    // TEST command
    if (action === 'test' || action === 'preflight' || action === 'diag') {
      if (currentStatus !== 'online') {
        return { success: false, error: `EXD-001 is ${currentStatus}. Power on first.` }
      }

      if (exdDevice) {
        ctx.addOutput('')
        ctx.addOutput('  [EXD-001] Running preflight diagnostics...')
        ctx.addOutput('')
        await exdDevice.runTest()
        ctx.addOutput('  [EXD-001] All preflight checks PASSED.')
        ctx.addOutput('')
      } else {
        return {
          success: true,
          output: [
            '',
            '  [EXD-001] Running preflight diagnostics...',
            '  [1/6] Rotor motors ........... PASS',
            '  [2/6] GPS fix ................ PASS',
            '  [3/6] Camera calibration ..... PASS',
            '  [4/6] Radio link ............. PASS',
            '  [5/6] Battery health ......... PASS',
            '  [6/6] Gyroscope .............. PASS',
            '',
            '  Result: ALL CHECKS PASSED',
            '',
          ],
        }
      }
      return { success: true }
    }

    // RESET command
    if (action === 'reset' || action === 'reboot') {
      if (currentStatus === 'standby') {
        return { success: false, error: 'EXD-001 is in STANDBY. Power on first.' }
      }
      if (exdDevice) {
        ctx.addOutput('')
        ctx.addOutput('  [EXD-001] Initiating reboot sequence...')
        await exdDevice.reboot()
        ctx.addOutput('  [EXD-001] Reboot complete. Drone ONLINE.')
        ctx.addOutput('')
      }
      return { success: true }
    }

    // DEPLOY command
    if (action === 'deploy' || action === 'launch') {
      if (currentStatus !== 'online') {
        return { success: false, error: `EXD-001 is ${currentStatus}. Power on first.` }
      }
      if (state.isDeployed) {
        return { success: false, error: 'EXD-001 is already deployed.' }
      }
      if (exdDevice) {
        exdDevice.deploy()
      }
      return {
        success: true,
        output: [
          '',
          '  [EXD-001] Drone deployed to field.',
          '  Status: DEPLOYED',
          '  Radar: ACTIVE',
          '',
        ],
      }
    }

    // RECALL command
    if (action === 'recall' || action === 'dock' || action === 'rth') {
      if (currentStatus !== 'online') {
        return { success: false, error: `EXD-001 is ${currentStatus}.` }
      }
      if (!state.isDeployed) {
        return { success: false, error: 'EXD-001 is already docked.' }
      }
      if (exdDevice) {
        exdDevice.recall()
      }
      return {
        success: true,
        output: [
          '',
          '  [EXD-001] Return-to-home initiated.',
          '  Status: DOCKED',
          '',
        ],
      }
    }

    // FOLD commands
    if (action === 'fold') {
      exdDevice?.setExpanded(false)
      return { success: true, output: ['', '  EXD-001 panel folded.', ''] }
    }
    if (action === 'unfold' || action === 'expand') {
      exdDevice?.setExpanded(true)
      return { success: true, output: ['', '  EXD-001 panel unfolded.', ''] }
    }
    if (action === 'toggle') {
      const current = exdDevice?.getState().isExpanded ?? true
      exdDevice?.setExpanded(!current)
      return { success: true, output: ['', `  EXD-001 panel ${current ? 'folded' : 'unfolded'}.`, ''] }
    }

    // INFO command
    if (action === 'info' || action === 'docs' || action === 'help' || action === 'man') {
      return {
        success: true,
        output: [
          '',
          '╔═══════════════════════════════════════════════════════════╗',
          '║          EXD-001 :: EXPLORER DRONE - MANUAL              ║',
          '╠═══════════════════════════════════════════════════════════╣',
          '║                                                           ║',
          '║  OVERVIEW                                                 ║',
          '║  Remote-controlled drone for field exploration and        ║',
          '║  autonomous resource collection. Expands gathering        ║',
          '║  radius and enables resource scanning.                    ║',
          '║                                                           ║',
          '║  SPECS                                                    ║',
          '║  ┌──────────────────┬──────────────────┐                 ║',
          `║  │ Firmware         │ v${firmware.version.padEnd(15)}│                 ║`,
          `║  │ Build            │ ${firmware.build.padEnd(15)} │                 ║`,
          `║  │ Checksum         │ ${firmware.checksum.padEnd(15)} │                 ║`,
          '║  │ Category         │ Heavy            │                 ║',
          '║  │ Priority         │ P3 (Non-essent.) │                 ║',
          '║  │ Collection Range │ 200m             │                 ║',
          '║  │ Cargo Capacity   │ 50 Abstractum    │                 ║',
          '║  │ Flight Time      │ 2h (full load)   │                 ║',
          '║  └──────────────────┴──────────────────┘                 ║',
          '║                                                           ║',
          '║  POWER                                                    ║',
          `║  Full (Flight):     ${String(powerSpecs.full).padEnd(5)} E/s                        ║`,
          `║  Idle (Hover):      ${String(powerSpecs.idle).padEnd(5)} E/s                        ║`,
          `║  Standby (Docked):  ${String(powerSpecs.standby).padEnd(5)} E/s                        ║`,
          `║  High-Speed Mode:   ${String(powerSpecs.highSpeed).padEnd(5)} E/s                        ║`,
          '║                                                           ║',
          '║  FEATURES                                                 ║',
          '║  • Autonomous navigation with GPS lock                    ║',
          '║  • Resource scanning and collection                       ║',
          '║  • Cargo hauling (50 Abstractum units)                    ║',
          '║  • IMU stabilization for stable flight                    ║',
          '║  • Radar sweep for area mapping                           ║',
          '║                                                           ║',
          '║  COMPATIBLE DEVICES                                       ║',
          '║  • AIC-001 - AI Assistant Core (nav planning)             ║',
          '║  • QAN-001 - Quantum Analyzer (resource detection)        ║',
          '║  • CDC-001 - Crystal Data Cache (cargo indexing)          ║',
          '║  • BAT-001 - Battery Pack (+50% flight time)              ║',
          '║                                                           ║',
          '╚═══════════════════════════════════════════════════════════╝',
          '',
        ],
      }
    }

    return {
      success: false,
      error: `unknown exd command: ${action}\n\ntype exd for available commands.`,
    }
  },
}

// ============================================================
// Filesystem Commands
// ============================================================

const lsCommand: Command = {
  name: 'ls',
  aliases: ['dir', 'unls'],
  description: 'List directory contents',
  usage: 'ls [-l] [-a] [path]',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }

    let long = false
    let all = false
    let path: string | undefined

    for (const arg of args) {
      if (arg === '-l') long = true
      else if (arg === '-a') all = true
      else if (arg === '-la' || arg === '-al') { long = true; all = true }
      else path = arg
    }

    const result = fs.ls(path, { long, all })
    return { success: true, output: result.length > 0 ? result : [''] }
  },
}

const cdCommand: Command = {
  name: 'cd',
  aliases: ['uncd'],
  description: 'Change directory',
  usage: 'cd <path>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }

    const path = args[0] || '~'
    const err = fs.cd(path)
    if (err) return { success: false, error: err }
    return { success: true }
  },
}

const pwdCommand: Command = {
  name: 'pwd',
  aliases: ['unpwd'],
  description: 'Print working directory',
  execute: async (_args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }
    return { success: true, output: [fs.pwd()] }
  },
}

const catCommand: Command = {
  name: 'cat',
  aliases: ['uncat'],
  description: 'Display file contents',
  usage: 'cat <file>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }
    if (args.length === 0) return { success: false, error: 'cat: missing file operand' }

    const user = ctx.data.userActions
    const currentUser = user?.getCurrentUser()
    const result = fs.cat(args[0], currentUser?.username ?? 'operator', currentUser?.groups ?? ['operator'])
    if (result === null) return { success: false, error: `cat: ${args[0]}: No such file or directory` }
    return { success: true, output: result.split('\n') }
  },
}

const mkdirCommand: Command = {
  name: 'mkdir',
  aliases: ['unmkdir'],
  description: 'Create directory',
  usage: 'mkdir [-p] <path>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }

    let parents = false
    let path: string | undefined

    for (const arg of args) {
      if (arg === '-p') parents = true
      else path = arg
    }

    if (!path) return { success: false, error: 'mkdir: missing operand' }
    const err = fs.mkdir(path, parents)
    if (err) return { success: false, error: err }
    return { success: true }
  },
}

const touchCommand: Command = {
  name: 'touch',
  aliases: ['untouch'],
  description: 'Create empty file',
  usage: 'touch <file>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }
    if (args.length === 0) return { success: false, error: 'touch: missing file operand' }

    const err = fs.touch(args[0])
    if (err) return { success: false, error: err }
    return { success: true }
  },
}

const rmCommand: Command = {
  name: 'rm',
  aliases: ['unrm'],
  description: 'Remove file or directory',
  usage: 'rm [-r] <path>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }

    let recursive = false
    let path: string | undefined

    for (const arg of args) {
      if (arg === '-r' || arg === '-rf' || arg === '-R') recursive = true
      else path = arg
    }

    if (!path) return { success: false, error: 'rm: missing operand' }
    const err = fs.rm(path, recursive)
    if (err) return { success: false, error: err }
    return { success: true }
  },
}

const treeCommand: Command = {
  name: 'tree',
  aliases: ['untree'],
  description: 'Display directory tree',
  usage: 'tree [path] [depth]',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }

    const path = args[0]
    const depth = args[1] ? parseInt(args[1], 10) : 3
    const result = fs.tree(path, depth)
    return { success: true, output: result }
  },
}

const chmodCommand: Command = {
  name: 'chmod',
  aliases: ['unchmod'],
  description: 'Change file permissions',
  usage: 'chmod <mode> <path>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }
    const user = ctx.data.userActions
    if (user && !user.isRoot()) {
      return { success: false, error: 'chmod: Operation not permitted' }
    }

    if (args.length < 2) return { success: false, error: 'chmod: missing operand' }
    const mode = parseInt(args[0], 8)
    if (isNaN(mode)) return { success: false, error: `chmod: invalid mode: '${args[0]}'` }

    const err = fs.chmod(args[1], mode)
    if (err) return { success: false, error: err }
    return { success: true }
  },
}

// ============================================================
// User Management Commands
// ============================================================

const idCommand: Command = {
  name: 'id',
  aliases: ['unid'],
  description: 'Show user/group info',
  usage: 'id [user]',
  execute: async (args, ctx) => {
    const user = ctx.data.userActions
    if (!user) return { success: false, error: 'User management not available' }
    return { success: true, output: [user.id(args[0])] }
  },
}

const suCommand: Command = {
  name: 'su',
  aliases: ['unsu'],
  description: 'Switch user',
  usage: 'su <username>',
  execute: async (args, ctx) => {
    const user = ctx.data.userActions
    if (!user) return { success: false, error: 'User management not available' }

    if (args.length === 0) return { success: false, error: 'su: usage: su <username>' }
    const target = args[0]

    // su is handled by the terminal password mode for non-root targets
    // This execute path handles: su root, su <user> when already root
    const result = user.su(target)
    if (!result.success) return { success: false, error: result.message }
    return { success: true, output: [`[su] ${result.message}`] }
  },
}

const sudoCommand: Command = {
  name: 'sudo',
  aliases: ['unsudo'],
  description: 'Run command as root',
  usage: 'sudo <command>',
  execute: async (args, ctx) => {
    const user = ctx.data.userActions
    if (!user) return { success: false, error: 'User management not available' }

    if (args.length === 0) return { success: false, error: 'sudo: usage: sudo <command>' }

    if (!user.canSudo()) {
      return { success: false, error: `${user.whoami()} is not in the sudoers file. This incident will be reported.` }
    }

    // Save current user, escalate, run command, restore
    const prevUser = user.whoami()
    const wasRoot = user.isRoot()
    if (!wasRoot) {
      user.su('root')
    }

    const subInput = args.join(' ')
    const result = await executeCommand(subInput, ctx)

    if (!wasRoot) {
      user.su(prevUser, '') // restore — use empty password since we're root
    }

    return result
  },
}

const passwdCommand: Command = {
  name: 'passwd',
  aliases: ['unpasswd'],
  description: 'Change password (simulated)',
  usage: 'passwd [user]',
  execute: async (args, ctx) => {
    const user = ctx.data.userActions
    if (!user) return { success: false, error: 'User management not available' }

    const target = args[0] || user.whoami()
    const newPass = args[1] || 'changed'
    const result = user.passwd(target, newPass)
    return { success: result.success, output: result.success ? [result.message] : undefined, error: result.success ? undefined : result.message }
  },
}

const useraddCommand: Command = {
  name: 'useradd',
  aliases: ['unuseradd'],
  description: 'Create new user (root only)',
  usage: 'useradd <username>',
  execute: async (args, ctx) => {
    const user = ctx.data.userActions
    if (!user) return { success: false, error: 'User management not available' }

    if (args.length === 0) return { success: false, error: 'useradd: missing username' }
    const result = user.useradd(args[0])
    return { success: result.success, output: result.success ? [result.message] : undefined, error: result.success ? undefined : result.message }
  },
}

const groupsCommand: Command = {
  name: 'groups',
  aliases: ['ungroups'],
  description: 'Show user groups',
  usage: 'groups [user]',
  execute: async (args, ctx) => {
    const user = ctx.data.userActions
    if (!user) return { success: false, error: 'User management not available' }
    return { success: true, output: [user.groups(args[0])] }
  },
}

// Theme command
const themeCommand: Command = {
  name: 'theme',
  aliases: ['themes'],
  description: 'Manage CRT display theme',
  usage: 'theme [list|set|get|save|load]',
  execute: async (args, ctx) => {
    const ta = ctx.data.themeActions
    if (!ta) return { success: false, error: 'Theme system not available' }

    const sub = (args[0] || 'list').toLowerCase()

    if (sub === 'list') {
      const themes = ta.list()
      const current = ta.get()
      const lines = [
        '',
        '  _unOS THEME MANAGER v1.0',
        '  ════════════════════════════════════════',
        '',
        '  #   NAME        PREVIEW',
        '  ──  ──────────  ───────',
      ]
      for (const t of themes) {
        const idx = String(t.index).padStart(2, ' ')
        const name = t.name.padEnd(10, ' ')
        const marker = t.index === current.index ? '  ← active' : ''
        lines.push(`  ${idx}  ${name}  ██████${marker}`)
      }
      lines.push('')
      lines.push(`  ${themes.length} themes available. Use: theme set <name|#>`)
      lines.push('')
      return { success: true, output: lines }
    }

    if (sub === 'set') {
      const target = args.slice(1).join(' ')
      if (!target) return { success: false, error: 'Usage: theme set <name|index>' }

      // Try as number first
      const asNum = parseInt(target, 10)
      if (!isNaN(asNum)) {
        const themes = ta.list()
        if (asNum < 0 || asNum >= themes.length) {
          return { success: false, error: `Invalid theme index. Use 0-${themes.length - 1}` }
        }
        ta.set(asNum)
        return { success: true, output: [`  Theme set to ${themes[asNum].name}`] }
      }

      // Try as name
      const idx = ta.getByName(target)
      if (idx === null) return { success: false, error: `Unknown theme: ${target}` }
      ta.set(idx)
      const themes = ta.list()
      return { success: true, output: [`  Theme set to ${themes[idx].name}`] }
    }

    if (sub === 'get') {
      const current = ta.get()
      return { success: true, output: [`  Active theme: ${current.name} (${current.fg})`] }
    }

    if (sub === 'save') {
      const fs = ctx.data.filesystemActions
      const user = ctx.data.userActions
      if (!fs || !user) return { success: false, error: 'Filesystem not available' }
      const current = ta.get()
      const home = user.getCurrentUser().home
      const rcPath = `${home}/.themerc`
      fs.touch(rcPath)
      // Write theme name by touching the file (VirtualFS doesn't have write, store in content via touch + metadata approach)
      // Use a simpler approach: store in localStorage directly
      try {
        localStorage.setItem('unlabs_theme', current.name)
      } catch { /* ignore */ }
      return { success: true, output: [`  Theme saved to ~/.themerc`] }
    }

    if (sub === 'load') {
      try {
        const saved = localStorage.getItem('unlabs_theme')
        if (!saved) return { success: false, error: 'No saved theme found. Use: theme save' }
        const idx = ta.getByName(saved)
        if (idx === null) return { success: false, error: `Saved theme "${saved}" not found` }
        ta.set(idx)
        return { success: true, output: [`  Loaded theme ${saved.toUpperCase()} from ~/.themerc`] }
      } catch {
        return { success: false, error: 'Could not load theme preferences' }
      }
    }

    return { success: false, error: `Unknown subcommand: ${sub}. Use: theme [list|set|get|save|load]` }
  },
}

// ============================================================================
// SCREW BUTTON COMMANDS
// ============================================================================

const SCREW_IDS = ['SB-01', 'SB-02', 'SB-03', 'SB-04'] as const
const SCREW_NAMES: Record<string, string> = {
  'SB-01': 'NODE-SYNC',
  'SB-02': 'POOL-LINK',
  'SB-03': 'MESH-CAST',
  'SB-04': 'QUANTUM-BRIDGE',
}

const screwstatCommand: Command = {
  name: 'screwstat',
  aliases: ['sbs', 'screws'],
  description: 'Screw button status overview',
  usage: 'screwstat [sb-id]',
  execute: async (args, ctx) => {
    const sb = ctx.data.screwButtons
    if (!sb) {
      return { success: false, error: 'Screw button system not available' }
    }

    const states = sb.getAllStates()

    if (args.length > 0) {
      const id = args[0].toUpperCase().replace('SB', 'SB-') as 'SB-01' | 'SB-02' | 'SB-03' | 'SB-04'
      const normalized = id.startsWith('SB-') ? id : `SB-0${id}` as 'SB-01'
      const state = states[normalized as keyof typeof states]
      if (!state) {
        return { success: false, error: `Unknown screw button: ${args[0]}. Valid: SB-01, SB-02, SB-03, SB-04` }
      }
      const feature = sb.getFeature(normalized as 'SB-01')
      const output = [
        '',
        `  ┌─────────────────────────────────────────────┐`,
        `  │  ${feature.name.padEnd(14)} ${normalized.padEnd(8)} DETAIL  │`,
        `  └─────────────────────────────────────────────┘`,
        `  Full Name:   ${feature.fullName}`,
        `  Description: ${feature.description}`,
        `  Status:      ${state.active ? '● ACTIVE' : state.unlocked ? '○ INACTIVE' : '✕ LOCKED'}`,
        `  Unlocked:    ${state.unlocked ? 'YES' : 'NO'}`,
        `  Active Time: ${state.totalActiveTime}s total`,
        `  Cost:        ${feature.activationCost} _unSC`,
        '',
      ]
      return { success: true, output }
    }

    const output = [
      '',
      '  ┌─────────────────────────────────────────────────────────┐',
      '  │            SCREW BUTTON SYSTEM :: STATUS                 │',
      '  └─────────────────────────────────────────────────────────┘',
      '  ┌────────┬────────────────┬──────────┬──────────────────┐',
      '  │  ID    │  FEATURE       │  STATUS  │  POSITION        │',
      '  ├────────┼────────────────┼──────────┼──────────────────┤',
    ]

    const positions = ['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right']
    for (let i = 0; i < SCREW_IDS.length; i++) {
      const id = SCREW_IDS[i]
      const state = states[id]
      const status = state.active ? '● ACTIVE' : state.unlocked ? '○ IDLE  ' : '✕ LOCKED'
      output.push(`  │  ${id}  │  ${SCREW_NAMES[id].padEnd(14)}│  ${status}│  ${positions[i].padEnd(16)}│`)
    }
    output.push('  └────────┴────────────────┴──────────┴──────────────────┘')
    output.push('')
    output.push('  Use: screwstat <id> for detail. Commands: nodesync, poollink, meshcast, qbridge')
    output.push('')

    return { success: true, output }
  },
}

const nodesyncCommand: Command = {
  name: 'nodesync',
  aliases: ['ns'],
  description: 'NODE-SYNC network control (SB-01)',
  usage: 'nodesync [status|enable|disable|stats|peers]',
  execute: async (args, ctx) => {
    const sb = ctx.data.screwButtons
    if (!sb) return { success: false, error: 'Screw button system not available' }

    const sub = (args[0] || 'status').toLowerCase()

    if (sub === 'enable') {
      const ok = await sb.activate('SB-01')
      return ok
        ? { success: true, output: ['', '  [NODE-SYNC] ● Activated — synchronizing with lab network...', '  LED: GREEN  |  SB-01 Top-Left screw now glowing', ''] }
        : { success: false, error: 'Failed to activate NODE-SYNC' }
    }

    if (sub === 'disable') {
      const ok = await sb.deactivate('SB-01')
      return ok
        ? { success: true, output: ['', '  [NODE-SYNC] ○ Deactivated — disconnected from network', ''] }
        : { success: false, error: 'NODE-SYNC is not active' }
    }

    if (!sb.isActive('SB-01') && sub !== 'status') {
      return { success: false, error: 'NODE-SYNC is not active. Enable with: nodesync enable' }
    }

    if (sub === 'status') {
      const active = sb.isActive('SB-01')
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  NODE-SYNC :: SB-01 :: NETWORK STATUS    │',
        '  └─────────────────────────────────────────┘',
        `  Status:    ${active ? '● ONLINE' : '○ OFFLINE'}`,
        `  Button:    Top-Left Screw`,
      ]
      if (active) {
        const stats = sb.getNodeSyncStats()
        output.push(
          `  Nodes:     ${stats.connectedNodes}/${stats.totalNodes} connected`,
          `  Sync Rate: ${stats.syncRate}%`,
          `  Hash Rate: ${stats.hashRate}`,
          `  Latency:   ${stats.latency}`,
          `  Uptime:    ${stats.uptime}`,
        )
      }
      output.push('')
      return { success: true, output }
    }

    if (sub === 'stats') {
      const stats = sb.getNodeSyncStats()
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  NODE-SYNC :: NETWORK STATISTICS          │',
        '  └─────────────────────────────────────────┘',
        `  Connected:  ${stats.connectedNodes}/${stats.totalNodes} nodes`,
        `  Sync Rate:  ${stats.syncRate}%`,
        `  Hash Rate:  ${stats.hashRate}`,
        `  Latency:    ${stats.latency}`,
        `  Uptime:     ${stats.uptime}`,
        `  Last Sync:  ${stats.lastSync}`,
        `  BW In:      ${stats.bandwidthIn}`,
        `  BW Out:     ${stats.bandwidthOut}`,
        '',
      ]
      return { success: true, output }
    }

    if (sub === 'peers') {
      const stats = sb.getNodeSyncStats()
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  NODE-SYNC :: PEER LIST                   │',
        '  └─────────────────────────────────────────┘',
        `  Online Peers: ${stats.peersOnline}`,
      ]
      for (let i = 0; i < Math.min(stats.peersOnline, 8); i++) {
        const latency = 5 + Math.floor(Math.random() * 50)
        output.push(`  [${i + 1}] PEER-${String.fromCharCode(65 + i)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}  ${latency}ms  ● SYNC`)
      }
      if (stats.peersOnline > 8) output.push(`  ... and ${stats.peersOnline - 8} more`)
      output.push('')
      return { success: true, output }
    }

    return { success: false, error: `Unknown subcommand: ${sub}. Use: nodesync [status|enable|disable|stats|peers]` }
  },
}

const poollinkCommand: Command = {
  name: 'poollink',
  aliases: ['pl', 'pool'],
  description: 'POOL-LINK mining pool control (SB-02)',
  usage: 'poollink [status|join|leave|create|stats|list|members]',
  execute: async (args, ctx) => {
    const sb = ctx.data.screwButtons
    if (!sb) return { success: false, error: 'Screw button system not available' }

    const sub = (args[0] || 'status').toLowerCase()

    if (sub === 'join' || sub === 'enable') {
      const ok = await sb.activate('SB-02')
      return ok
        ? { success: true, output: ['', '  [POOL-LINK] ● Connected to mining pool', '  LED: GREEN  |  SB-02 Top-Right screw now glowing', ''] }
        : { success: false, error: 'Failed to join pool' }
    }

    if (sub === 'leave' || sub === 'disable') {
      const ok = await sb.deactivate('SB-02')
      return ok
        ? { success: true, output: ['', '  [POOL-LINK] ○ Left mining pool', ''] }
        : { success: false, error: 'POOL-LINK is not active' }
    }

    if (!sb.isActive('SB-02') && sub !== 'status') {
      return { success: false, error: 'POOL-LINK is not active. Join with: poollink join' }
    }

    if (sub === 'status') {
      const active = sb.isActive('SB-02')
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  POOL-LINK :: SB-02 :: POOL STATUS       │',
        '  └─────────────────────────────────────────┘',
        `  Status:    ${active ? '● LINKED' : '○ DISCONNECTED'}`,
        `  Button:    Top-Right Screw`,
      ]
      if (active) {
        const stats = sb.getPoolStats()
        output.push(
          `  Pool:      ${stats.poolName}`,
          `  Members:   ${stats.members}/${stats.maxMembers}`,
          `  Hash Rate: ${stats.totalHashRate}`,
          `  Your Share:${stats.yourContribution}`,
          `  Pending:   ${stats.pendingRewards} _unSC`,
        )
      }
      output.push('')
      return { success: true, output }
    }

    if (sub === 'stats') {
      const stats = sb.getPoolStats()
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  POOL-LINK :: MINING STATISTICS           │',
        '  └─────────────────────────────────────────┘',
        `  Pool Name:     ${stats.poolName}`,
        `  Members:       ${stats.members}/${stats.maxMembers}`,
        `  Total Hash:    ${stats.totalHashRate}`,
        `  Contribution:  ${stats.yourContribution}`,
        `  Pending:       ${stats.pendingRewards} _unSC`,
        `  Blocks Found:  ${stats.blocksFound}`,
        `  Efficiency:    ${stats.efficiency}`,
        `  Pool Uptime:   ${stats.uptime}`,
        '',
      ]
      return { success: true, output }
    }

    if (sub === 'list') {
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  AVAILABLE MINING POOLS                   │',
        '  └─────────────────────────────────────────┘',
      ]
      for (let i = 0; i < 5; i++) {
        const name = `POOL-${String.fromCharCode(65 + i)}${100 + Math.floor(Math.random() * 900)}`
        const members = 4 + Math.floor(Math.random() * 28)
        output.push(`  [${i + 1}] ${name}  ${members}/32 members  ● OPEN`)
      }
      output.push('')
      return { success: true, output }
    }

    if (sub === 'members') {
      const stats = sb.getPoolStats()
      const output = [
        '',
        `  ┌─────────────────────────────────────────┐`,
        `  │  ${stats.poolName} :: MEMBER LIST${' '.repeat(Math.max(0, 15 - stats.poolName.length))}│`,
        `  └─────────────────────────────────────────┘`,
      ]
      for (let i = 0; i < Math.min(stats.members, 10); i++) {
        const hash = (2 + Math.random() * 20).toFixed(1)
        const you = i === 0 ? ' (YOU)' : ''
        output.push(`  [${(i + 1).toString().padStart(2)}] LAB-${String.fromCharCode(65 + i)}  ${hash} TH/s${you}`)
      }
      if (stats.members > 10) output.push(`  ... and ${stats.members - 10} more`)
      output.push('')
      return { success: true, output }
    }

    if (sub === 'create') {
      return { success: true, output: ['', '  [POOL-LINK] Pool creation not yet implemented', '  Pools are auto-assigned in current version', ''] }
    }

    return { success: false, error: `Unknown subcommand: ${sub}. Use: poollink [status|join|leave|stats|list|members]` }
  },
}

const meshcastCommand: Command = {
  name: 'meshcast',
  aliases: ['mc', 'meme'],
  description: 'MESH-CAST memetic broadcasting (SB-03)',
  usage: 'meshcast [status|broadcast|receive|list|history|stats]',
  execute: async (args, ctx) => {
    const sb = ctx.data.screwButtons
    if (!sb) return { success: false, error: 'Screw button system not available' }

    const sub = (args[0] || 'status').toLowerCase()

    if (sub === 'enable' || sub === 'broadcast') {
      if (sub === 'enable') {
        const ok = await sb.activate('SB-03')
        return ok
          ? { success: true, output: ['', '  [MESH-CAST] ● Broadcasting enabled', '  LED: GREEN  |  SB-03 Bottom-Left screw now glowing', ''] }
          : { success: false, error: 'Failed to enable MESH-CAST' }
      }
      if (!sb.isActive('SB-03')) {
        return { success: false, error: 'MESH-CAST is not active. Enable with: meshcast enable' }
      }
      const memes = ['+15% Crystal Yield', '+10% Hash Rate', '-20% Energy Cost', '+25% Research Speed']
      const chosen = memes[Math.floor(Math.random() * memes.length)]
      return { success: true, output: ['', `  [MESH-CAST] Broadcasting meme: ${chosen}`, '  Reaching nearby labs...', ''] }
    }

    if (sub === 'disable') {
      const ok = await sb.deactivate('SB-03')
      return ok
        ? { success: true, output: ['', '  [MESH-CAST] ○ Broadcasting disabled', ''] }
        : { success: false, error: 'MESH-CAST is not active' }
    }

    if (!sb.isActive('SB-03') && sub !== 'status') {
      return { success: false, error: 'MESH-CAST is not active. Enable with: meshcast enable' }
    }

    if (sub === 'status') {
      const active = sb.isActive('SB-03')
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  MESH-CAST :: SB-03 :: BROADCAST STATUS  │',
        '  └─────────────────────────────────────────┘',
        `  Status:    ${active ? '● BROADCASTING' : '○ OFFLINE'}`,
        `  Button:    Bottom-Left Screw`,
      ]
      if (active) {
        const stats = sb.getMeshCastStats()
        output.push(
          `  Active:    ${stats.activeBroadcasts} broadcasts`,
          `  Reach:     ${stats.networkReach} labs`,
          `  Signal:    ${stats.signalStrength}`,
          `  Buffs:     ${stats.receivedBuffs.join(', ') || 'None'}`,
        )
      }
      output.push('')
      return { success: true, output }
    }

    if (sub === 'stats') {
      const stats = sb.getMeshCastStats()
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  MESH-CAST :: BROADCAST STATISTICS        │',
        '  └─────────────────────────────────────────┘',
        `  Active:        ${stats.activeBroadcasts} broadcasts`,
        `  Network Reach: ${stats.networkReach} labs`,
        `  Signal:        ${stats.signalStrength}`,
        `  Generated:     ${stats.memesGenerated} memes`,
        `  Received:      ${stats.memesReceived} memes`,
        `  Bandwidth:     ${stats.bandwidth}`,
        '',
        '  Active Buffs:',
      ]
      for (const buff of stats.receivedBuffs) {
        output.push(`    ◈ ${buff}`)
      }
      output.push('')
      return { success: true, output }
    }

    if (sub === 'list' || sub === 'receive') {
      const stats = sb.getMeshCastStats()
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  INCOMING MEME BUFFS                      │',
        '  └─────────────────────────────────────────┘',
      ]
      for (const buff of stats.receivedBuffs) {
        const from = `LAB-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`
        output.push(`  ◈ ${buff.padEnd(24)} from ${from}`)
      }
      if (stats.receivedBuffs.length === 0) output.push('  No active buffs received')
      output.push('')
      return { success: true, output }
    }

    if (sub === 'history') {
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  MESH-CAST :: RECENT HISTORY              │',
        '  └─────────────────────────────────────────┘',
      ]
      const memes = ['+15% Crystal Yield', '+10% Hash Rate', '-20% Energy Cost', '+25% Research Speed', '+8% Stability']
      for (let i = 0; i < 6; i++) {
        const time = `${Math.floor(Math.random() * 24).toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`
        const dir = Math.random() > 0.5 ? 'SENT' : 'RECV'
        output.push(`  [${time}] ${dir}  ${memes[i % memes.length]}`)
      }
      output.push('')
      return { success: true, output }
    }

    return { success: false, error: `Unknown subcommand: ${sub}. Use: meshcast [status|enable|disable|broadcast|list|stats|history]` }
  },
}

const qbridgeCommand: Command = {
  name: 'qbridge',
  aliases: ['qb', 'bridge'],
  description: 'QUANTUM-BRIDGE dimensional link (SB-04)',
  usage: 'qbridge [status|link|unlink|share|coassemble|chat]',
  execute: async (args, ctx) => {
    const sb = ctx.data.screwButtons
    if (!sb) return { success: false, error: 'Screw button system not available' }

    const sub = (args[0] || 'status').toLowerCase()

    if (sub === 'link' || sub === 'enable') {
      const ok = await sb.activate('SB-04')
      return ok
        ? { success: true, output: ['', '  [Q-BRIDGE] ● Quantum bridge established', '  LED: GREEN  |  SB-04 Bottom-Right screw now glowing', '  Entanglement fidelity: NOMINAL', ''] }
        : { success: false, error: 'Failed to establish quantum bridge' }
    }

    if (sub === 'unlink' || sub === 'disable') {
      const ok = await sb.deactivate('SB-04')
      return ok
        ? { success: true, output: ['', '  [Q-BRIDGE] ○ Quantum bridge collapsed', ''] }
        : { success: false, error: 'Q-BRIDGE is not active' }
    }

    if (!sb.isActive('SB-04') && sub !== 'status') {
      return { success: false, error: 'Q-BRIDGE is not active. Link with: qbridge link' }
    }

    if (sub === 'status') {
      const active = sb.isActive('SB-04')
      const output = [
        '',
        '  ┌─────────────────────────────────────────┐',
        '  │  Q-BRIDGE :: SB-04 :: BRIDGE STATUS      │',
        '  └─────────────────────────────────────────┘',
        `  Status:    ${active ? '● LINKED' : '○ OFFLINE'}`,
        `  Button:    Bottom-Right Screw`,
      ]
      if (active) {
        const stats = sb.getBridgeStats()
        output.push(
          `  Linked To: ${stats.linkedLab}`,
          `  Stability: ${stats.bridgeStability}`,
          `  Fidelity:  ${stats.entanglementFidelity}`,
          `  Channel:   ${stats.quantumChannel}`,
          `  Uptime:    ${stats.bridgeUptime}`,
        )
      }
      output.push('')
      return { success: true, output }
    }

    if (sub === 'share') {
      const stats = sb.getBridgeStats()
      return { success: true, output: [
        '',
        `  [Q-BRIDGE] Sharing resources with ${stats.linkedLab}...`,
        `  Shared Crystals: ${stats.sharedCrystals}`,
        `  Data Transferred: ${stats.dataTransferred}`,
        '',
      ] }
    }

    if (sub === 'coassemble') {
      const stats = sb.getBridgeStats()
      return { success: true, output: [
        '',
        `  [Q-BRIDGE] Co-assembly with ${stats.linkedLab}`,
        `  Active Co-Assemblies: ${stats.coAssemblies}`,
        '  Combined processing power applied to crystal synthesis',
        '',
      ] }
    }

    if (sub === 'chat') {
      const stats = sb.getBridgeStats()
      return { success: true, output: [
        '',
        `  [Q-BRIDGE] Quantum chat with ${stats.linkedLab}`,
        `  Messages: ${stats.chatMessages}`,
        '  (Quantum chat interface not yet available in terminal)',
        '',
      ] }
    }

    return { success: false, error: `Unknown subcommand: ${sub}. Use: qbridge [status|link|unlink|share|coassemble|chat]` }
  },
}

const cpCommand: Command = {
  name: 'cp',
  aliases: ['uncp', 'copy'],
  description: 'Copy files and directories',
  usage: 'cp [-r] <source> <destination>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }

    let recursive = false
    const paths: string[] = []

    for (const arg of args) {
      if (arg === '-r' || arg === '-R' || arg === '-rf') recursive = true
      else paths.push(arg)
    }

    if (paths.length < 2) return { success: false, error: 'cp: missing destination operand' }
    const err = fs.cp(paths[0], paths[1], recursive)
    if (err) return { success: false, error: err }
    return { success: true }
  },
}

const mvCommand: Command = {
  name: 'mv',
  aliases: ['unmv', 'move'],
  description: 'Move/rename files',
  usage: 'mv <source> <destination>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }
    if (args.length < 2) return { success: false, error: 'mv: missing destination operand' }
    const err = fs.mv(args[0], args[1])
    if (err) return { success: false, error: err }
    return { success: true }
  },
}

const lnCommand: Command = {
  name: 'ln',
  aliases: ['unln', 'link'],
  description: 'Create symbolic links',
  usage: 'ln -s <target> <link_name>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }

    let symbolic = false
    const paths: string[] = []

    for (const arg of args) {
      if (arg === '-s') symbolic = true
      else paths.push(arg)
    }

    if (paths.length < 2) return { success: false, error: 'ln: missing operand' }
    if (!symbolic) return { success: false, error: 'ln: hard links not supported (use -s)' }
    const err = fs.ln(paths[0], paths[1], symbolic)
    if (err) return { success: false, error: err }
    return { success: true }
  },
}

const chownCommand: Command = {
  name: 'chown',
  aliases: ['unchown'],
  description: 'Change file owner/group',
  usage: 'chown <owner[:group]> <path>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }
    const user = ctx.data.userActions
    if (!user?.isRoot()) return { success: false, error: 'chown: Permission denied (must be root)' }
    if (args.length < 2) return { success: false, error: 'chown: missing operand' }

    const [ownerSpec, path] = [args[0], args[1]]
    const parts = ownerSpec.split(':')
    const err = fs.chown(path, parts[0], parts[1])
    if (err) return { success: false, error: err }
    return { success: true, output: [`chown: owner of '${path}' changed to ${ownerSpec}`] }
  },
}

const headCommand: Command = {
  name: 'head',
  aliases: ['unhead'],
  description: 'Display first lines of file',
  usage: 'head [-n <lines>] <file>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }

    let lines = 10
    let path: string | undefined

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && args[i + 1]) { lines = parseInt(args[++i]) || 10 }
      else path = args[i]
    }

    if (!path) return { success: false, error: 'head: missing file operand' }
    const result = fs.head(path, lines)
    if (result === null) return { success: false, error: `head: ${path}: No such file or directory` }
    return { success: true, output: result.split('\n') }
  },
}

const tailCommand: Command = {
  name: 'tail',
  aliases: ['untail'],
  description: 'Display last lines of file',
  usage: 'tail [-n <lines>] <file>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: 'Filesystem not available' }

    let lines = 10
    let path: string | undefined

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && args[i + 1]) { lines = parseInt(args[++i]) || 10 }
      else path = args[i]
    }

    if (!path) return { success: false, error: 'tail: missing file operand' }
    const result = fs.tail(path, lines)
    if (result === null) return { success: false, error: `tail: ${path}: No such file or directory` }
    return { success: true, output: result.split('\n') }
  },
}

const userdelCommand: Command = {
  name: 'userdel',
  aliases: ['unuserdel'],
  description: 'Delete user account',
  usage: 'userdel <username>',
  execute: async (args, ctx) => {
    const user = ctx.data.userActions
    if (!user) return { success: false, error: 'User management not available' }
    if (args.length === 0) return { success: false, error: 'userdel: missing operand' }
    const result = user.userdel(args[0])
    return { success: result.success, output: result.success ? [result.message] : undefined, error: result.success ? undefined : result.message }
  },
}

const usermodCommand: Command = {
  name: 'usermod',
  aliases: ['unusermod'],
  description: 'Modify user account',
  usage: 'usermod -G <groups> <username>',
  execute: async (args, ctx) => {
    const user = ctx.data.userActions
    if (!user) return { success: false, error: 'User management not available' }

    let groups: string[] | undefined
    let username: string | undefined

    for (let i = 0; i < args.length; i++) {
      if ((args[i] === '-G' || args[i] === '-g' || args[i] === '--groups') && args[i + 1]) {
        groups = args[++i].split(',')
      } else {
        username = args[i]
      }
    }

    if (!username) return { success: false, error: 'usermod: missing username' }
    if (!groups) return { success: false, error: 'usermod: no modifications specified' }
    const result = user.usermod(username, { groups })
    return { success: result.success, output: result.success ? [result.message] : undefined, error: result.success ? undefined : result.message }
  },
}

const unaptCommand: Command = {
  name: 'unapt',
  aliases: ['apt', 'undnf', 'dnf'],
  description: 'Package manager',
  usage: 'unapt <update|install|remove|search|show|list|upgrade|clean> [package]',
  execute: async (args, ctx) => {
    if (args.length === 0) return { success: false, error: 'unapt: missing subcommand\nUsage: unapt <update|install|remove|search|show|list|upgrade|clean> [package]' }

    const sub = args[0]
    const pkg = args[1]
    const output: string[] = []

    switch (sub) {
      case 'update':
        output.push('Hit:1 https://github.com/unstablelabs/_unOS.git stable InRelease')
        output.push('Reading package lists... Done')
        output.push('Building dependency tree... Done')
        output.push('All packages are up to date.')
        return { success: true, output }

      case 'install':
        if (!pkg) return { success: false, error: 'unapt install: missing package name' }
        output.push(`Reading package lists... Done`)
        output.push(`Building dependency tree... Done`)
        output.push(`The following NEW packages will be installed:`)
        output.push(`  ${pkg}`)
        output.push(`0 upgraded, 1 newly installed, 0 to remove.`)
        output.push(`Setting up ${pkg} (1.0.0-1) ...`)
        output.push(`${pkg} installed successfully.`)
        return { success: true, output }

      case 'remove':
        if (!pkg) return { success: false, error: 'unapt remove: missing package name' }
        output.push(`Removing ${pkg} (1.0.0-1) ...`)
        output.push(`${pkg} removed.`)
        return { success: true, output }

      case 'search':
        if (!pkg) return { success: false, error: 'unapt search: missing search term' }
        output.push(`Searching for '${pkg}'...`)
        output.push(`${pkg}-core/stable 2.0.0-1 all`)
        output.push(`  Core ${pkg} library for _unOS`)
        output.push(`${pkg}-tools/stable 1.5.0-1 all`)
        output.push(`  ${pkg} command-line tools`)
        return { success: true, output }

      case 'show':
        if (!pkg) return { success: false, error: 'unapt show: missing package name' }
        output.push(`Package: ${pkg}`)
        output.push(`Version: 1.0.0-1`)
        output.push(`Priority: optional`)
        output.push(`Section: science`)
        output.push(`Maintainer: Unstable Laboratories <dev@unstablelabs.io>`)
        output.push(`Architecture: all`)
        output.push(`Description: ${pkg} package for _unOS Quantum`)
        return { success: true, output }

      case 'list':
        output.push('Listing installed packages...')
        output.push('unos-core/stable,now 2.0.0-1 all [installed]')
        output.push('unos-kernel/stable,now 2.0.0-1 all [installed]')
        output.push('unos-devices/stable,now 2.0.0-1 all [installed]')
        output.push('unos-network/stable,now 1.0.0-1 all [installed]')
        output.push('unos-quantum/stable,now 1.5.0-1 all [installed]')
        output.push('unos-crypto/stable,now 1.2.0-1 all [installed]')
        output.push('unos-terminal/stable,now 2.0.0-1 all [installed]')
        output.push('libcrystal/stable,now 3.1.0-1 all [installed]')
        output.push('solana-cli/stable,now 1.18.0-1 all [installed]')
        output.push('unchain-tools/stable,now 1.0.0-1 all [installed]')
        return { success: true, output }

      case 'upgrade':
        output.push('Reading package lists... Done')
        output.push('Building dependency tree... Done')
        output.push('Calculating upgrade... Done')
        output.push('0 upgraded, 0 newly installed, 0 to remove.')
        return { success: true, output }

      case 'clean':
        output.push('Cleaning package cache...')
        output.push('Cache cleaned. Freed 0 B.')
        return { success: true, output }

      default:
        return { success: false, error: `unapt: unknown subcommand '${sub}'` }
    }
  },
}

const unpodCommand: Command = {
  name: 'unpod',
  aliases: ['pod'],
  description: 'Container runtime',
  usage: 'unpod <run|ps|stop|rm|images|pull|logs|exec|inspect> [args]',
  execute: async (args, ctx) => {
    if (args.length === 0) return { success: false, error: 'unpod: missing subcommand\nUsage: unpod <run|ps|stop|rm|images|pull|logs|exec|inspect>' }

    const sub = args[0]
    const output: string[] = []

    switch (sub) {
      case 'ps':
        output.push('CONTAINER ID   IMAGE                    STATUS    PORTS     NAMES')
        output.push('unpod-abc123   unos/quantum-sim:latest  Running   8080/tcp  quantum-sim')
        output.push('unpod-def456   unos/chain-node:2.0      Running   9090/tcp  chain-node')
        return { success: true, output }

      case 'run': {
        const name = args[1] || 'container'
        const id = `unpod-${Date.now().toString(36).slice(-6)}`
        output.push(`Creating container '${name}'...`)
        output.push(`Container ${id} started.`)
        return { success: true, output }
      }

      case 'stop': {
        const target = args[1]
        if (!target) return { success: false, error: 'unpod stop: missing container name/id' }
        output.push(`Stopping container ${target}...`)
        output.push(`Container ${target} stopped.`)
        return { success: true, output }
      }

      case 'rm': {
        const target = args[1]
        if (!target) return { success: false, error: 'unpod rm: missing container name/id' }
        output.push(`Removing container ${target}...`)
        output.push(`Container ${target} removed.`)
        return { success: true, output }
      }

      case 'images':
        output.push('REPOSITORY               TAG       SIZE')
        output.push('unos/quantum-sim         latest    256 MB')
        output.push('unos/chain-node          2.0       128 MB')
        output.push('unos/crystal-worker      1.0       64 MB')
        return { success: true, output }

      case 'pull': {
        const image = args[1] || 'unos/base:latest'
        output.push(`Pulling ${image}...`)
        output.push(`latest: Pulling from ${image}`)
        output.push(`Digest: sha256:${Date.now().toString(16)}`)
        output.push(`Status: Downloaded newer image for ${image}`)
        return { success: true, output }
      }

      case 'logs': {
        const target = args[1]
        if (!target) return { success: false, error: 'unpod logs: missing container name/id' }
        output.push(`[${new Date().toISOString()}] Container ${target} started`)
        output.push(`[${new Date().toISOString()}] Service initialized`)
        output.push(`[${new Date().toISOString()}] Listening on port 8080`)
        return { success: true, output }
      }

      case 'exec': {
        const target = args[1]
        if (!target) return { success: false, error: 'unpod exec: missing container name/id' }
        output.push(`Executing in container ${target}...`)
        output.push(`(interactive shell not available in simulation)`)
        return { success: true, output }
      }

      case 'inspect': {
        const target = args[1]
        if (!target) return { success: false, error: 'unpod inspect: missing container name/id' }
        output.push(`{`)
        output.push(`  "Id": "${target}",`)
        output.push(`  "State": "running",`)
        output.push(`  "Image": "unos/quantum-sim:latest",`)
        output.push(`  "Created": "${new Date().toISOString()}"`)
        output.push(`}`)
        return { success: true, output }
      }

      default:
        return { success: false, error: `unpod: unknown subcommand '${sub}'` }
    }
  },
}

const unnetCommand: Command = {
  name: 'unnet',
  aliases: ['net', 'ifconfig'],
  description: 'Network management',
  usage: 'unnet <show|up|down|addr|gateway|dns|ping|trace|scan> [args]',
  execute: async (args, ctx) => {
    if (args.length === 0) return { success: false, error: 'unnet: missing subcommand\nUsage: unnet <show|up|down|addr|gateway|dns|ping|trace|scan>' }

    const sub = args[0]
    const output: string[] = []

    switch (sub) {
      case 'show':
        output.push('Interface    Status    Address            Type')
        output.push('─────────────────────────────────────────────────────')
        output.push('unlo         UP        127.0.0.1/8        loopback')
        output.push('uneth0       UP        10.0.1.100/24      ethernet')
        output.push('unbr0        UP        192.168.1.1/24     bridge')
        output.push('unq0         UP        fd00::1/128        quantum')
        return { success: true, output }

      case 'up': {
        const iface = args[1]
        if (!iface) return { success: false, error: 'unnet up: missing interface' }
        output.push(`Bringing up interface ${iface}...`)
        output.push(`${iface}: link is UP`)
        return { success: true, output }
      }

      case 'down': {
        const iface = args[1]
        if (!iface) return { success: false, error: 'unnet down: missing interface' }
        output.push(`Bringing down interface ${iface}...`)
        output.push(`${iface}: link is DOWN`)
        return { success: true, output }
      }

      case 'addr':
        output.push('1: unlo: <LOOPBACK,UP> mtu 65536')
        output.push('    inet 127.0.0.1/8 scope host unlo')
        output.push('2: uneth0: <BROADCAST,MULTICAST,UP> mtu 1500')
        output.push('    inet 10.0.1.100/24 brd 10.0.1.255 scope global uneth0')
        output.push('3: unbr0: <BROADCAST,MULTICAST,UP> mtu 1500')
        output.push('    inet 192.168.1.1/24 scope global unbr0')
        output.push('4: unq0: <QUANTUM,UP> mtu 9000')
        output.push('    inet6 fd00::1/128 scope global unq0')
        return { success: true, output }

      case 'gateway':
        output.push('default via 10.0.1.1 dev uneth0 proto static')
        output.push('10.0.1.0/24 dev uneth0 proto kernel scope link')
        output.push('192.168.1.0/24 dev unbr0 proto kernel scope link')
        return { success: true, output }

      case 'dns':
        output.push('nameserver 10.0.1.1')
        output.push('nameserver 1.1.1.1')
        output.push('search unstablelabs.local')
        return { success: true, output }

      case 'ping': {
        const target = args[1] || '10.0.1.1'
        output.push(`PING ${target}: 56 data bytes`)
        for (let i = 0; i < 4; i++) {
          const ms = (Math.random() * 5 + 1).toFixed(1)
          output.push(`64 bytes from ${target}: icmp_seq=${i} ttl=64 time=${ms} ms`)
        }
        output.push(`--- ${target} ping statistics ---`)
        output.push(`4 packets transmitted, 4 received, 0% packet loss`)
        return { success: true, output }
      }

      case 'trace': {
        const target = args[1] || '10.0.1.1'
        output.push(`traceroute to ${target}, 30 hops max`)
        output.push(` 1  10.0.1.1  1.2 ms  0.8 ms  1.1 ms`)
        output.push(` 2  192.168.0.1  5.4 ms  4.9 ms  5.1 ms`)
        output.push(` 3  ${target}  8.3 ms  7.9 ms  8.1 ms`)
        return { success: true, output }
      }

      case 'scan':
        output.push('Scanning local network 10.0.1.0/24...')
        output.push('')
        output.push('HOST             MAC                STATUS')
        output.push('10.0.1.1         UN:OS:GW:00:01     gateway')
        output.push('10.0.1.100       UN:OS:AA:BB:CC     this host')
        output.push('10.0.1.101       UN:OS:DD:EE:FF     peer')
        output.push('')
        output.push('3 hosts found.')
        return { success: true, output }

      case 'fw':
        output.push('Chain INPUT (policy ACCEPT)')
        output.push('target     prot   source       destination')
        output.push('ACCEPT     all    0.0.0.0/0    0.0.0.0/0    state ESTABLISHED')
        output.push('ACCEPT     tcp    0.0.0.0/0    0.0.0.0/0    tcp dpt:22')
        output.push('')
        output.push('Chain OUTPUT (policy ACCEPT)')
        output.push('Chain FORWARD (policy DROP)')
        return { success: true, output }

      default:
        return { success: false, error: `unnet: unknown subcommand '${sub}'` }
    }
  },
}

const exitCommand: Command = {
  name: 'exit',
  aliases: ['logout', 'quit'],
  description: 'Exit current session',
  execute: async (_args, ctx) => {
    const user = ctx.data.userActions
    if (user && !user.isRoot() && user.whoami() !== 'operator') {
      const result = user.su('operator')
      return { success: true, output: [`Returning to user: operator`, result.message] }
    }
    return { success: true, output: ['Session active. Use su to switch users.'] }
  },
}

const ungitCommand: Command = {
  name: 'ungit',
  aliases: ['git'],
  description: 'Version control (simulated)',
  usage: 'ungit <status|add|commit|push|pull|log|sync|backup|restore>',
  execute: async (args, _ctx) => {
    if (args.length === 0) return { success: false, error: 'ungit: missing subcommand' }

    const sub = args[0]
    const output: string[] = []

    switch (sub) {
      case 'status':
        output.push('On branch main')
        output.push('Your branch is up to date with \'origin/main\'.')
        output.push('')
        output.push('nothing to commit, working tree clean')
        return { success: true, output }

      case 'log':
        output.push('commit abc1234 (HEAD -> main, origin/main)')
        output.push('Author: operator <operator@unstablelabs.io>')
        output.push(`Date:   ${new Date().toUTCString()}`)
        output.push('')
        output.push('    System state checkpoint')
        return { success: true, output }

      case 'add':
        output.push(`Added ${args[1] || '.'} to staging area.`)
        return { success: true, output }

      case 'commit':
        output.push(`[main ${Date.now().toString(36).slice(-7)}] ${args.slice(1).join(' ') || 'System commit'}`)
        output.push(' 1 file changed')
        return { success: true, output }

      case 'push':
        output.push('Enumerating objects: 3, done.')
        output.push('Writing objects: 100% (3/3), done.')
        output.push('To origin/main')
        output.push('   abc1234..def5678  main -> main')
        return { success: true, output }

      case 'pull':
        output.push('Already up to date.')
        return { success: true, output }

      case 'sync':
      case 'update':
        output.push('Syncing with remote...')
        output.push('Already up to date.')
        return { success: true, output }

      case 'backup':
        output.push(`Creating backup... snapshot-${Date.now().toString(36)}`)
        output.push('Backup complete.')
        return { success: true, output }

      case 'restore':
        output.push('Restoring from latest backup...')
        output.push('Restore complete.')
        return { success: true, output }

      default:
        return { success: false, error: `ungit: unknown subcommand '${sub}'` }
    }
  },
}

// Basic Toolkit command
const btkCommand: Command = {
  name: 'btk',
  aliases: ['toolkit'],
  description: 'Basic Toolkit management',
  usage: 'btk <status|firmware|test|config|tools|reboot>',
  execute: async (args, ctx) => {
    const device = ctx.data.btkDevice
    if (!device) {
      return { success: false, output: ['[btk] Device not connected'] }
    }

    const sub = args[0]?.toLowerCase()

    if (!sub || sub === 'help') {
      return { success: true, output: [
        '',
        '  BTK-001 Basic Toolkit',
        '  ─────────────────────────────',
        '  btk status     Device status',
        '  btk firmware   Firmware info',
        '  btk test       Run diagnostics',
        '  btk config     View configuration',
        '  btk tools      Tool status',
        '  btk reboot     Reboot device',
        '  btk fold       Fold to compact view',
        '  btk unfold     Unfold to full view',
        '  btk toggle     Toggle fold state',
        '',
      ]}
    }

    const state = device.getState()

    if (sub === 'status') {
      const fw = device.getFirmware()
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '',
        '  ┌─ BTK-001 STATUS ────────────────┐',
        `  │ State:    ${state.deviceState.toUpperCase().padEnd(22)}│`,
        `  │ Power:    ${state.isPowered ? 'ON' : 'OFF'}${' '.repeat(state.isPowered ? 20 : 19)}│`,
        `  │ Draw:     ${state.currentDraw.toFixed(1)} E/s${' '.repeat(17 - state.currentDraw.toFixed(1).length)}│`,
        `  │ Firmware: v${fw.version}${' '.repeat(20 - fw.version.length)}│`,
        `  │ Tool:     ${(state.selectedTool ?? 'none').padEnd(22)}│`,
        '  └──────────────────────────────────┘',
        '',
      ]}
    }

    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') {
          return { success: false, output: ['[btk] Device must be online to update firmware'] }
        }
        ctx.addOutput('[btk] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[btk] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[btk] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '',
        '  BTK-001 FIRMWARE',
        '  ─────────────────────────────',
        `  Version:  v${fw.version}`,
        `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`,
        `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`,
        '',
      ]}
    }

    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') {
        return { success: false, output: ['[btk] Device must be online to run diagnostics'] }
      }
      ctx.addOutput('[btk] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[btk] Diagnostics complete — ALL PASSED'] }
    }

    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '',
        '  BTK-001 CONFIGURATION',
        '  ─────────────────────────────',
        `  Category: ${ps.category}`,
        `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`,
        `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`,
        `  Tools:    4 (PROBE, CLAMP, LASER, DRILL)`,
        '',
      ]}
    }

    if (sub === 'tools') {
      const toolList = ['PROBE', 'CLAMP', 'LASER', 'DRILL']
      return { success: true, output: [
        '',
        '  BTK-001 TOOL STATUS',
        '  ─────────────────────────────',
        ...toolList.map(t => `  ${t.padEnd(8)} ${state.deviceState === 'online' ? (state.selectedTool === t ? 'ACTIVE' : 'READY') : 'OFFLINE'}`),
        '',
      ]}
    }

    if (sub === 'reboot') {
      if (!state.isPowered) {
        return { success: false, output: ['[btk] Device is not powered on'] }
      }
      ctx.addOutput('[btk] Rebooting BTK-001...')
      await device.reboot()
      return { success: true, output: ['[btk] Reboot complete'] }
    }

    if (sub === 'fold') {
      device.setExpanded(false)
      return { success: true, output: ['', '[BTK-001] Device folded to compact view', ''] }
    }
    if (sub === 'unfold') {
      device.setExpanded(true)
      return { success: true, output: ['', '[BTK-001] Device unfolded to full view', ''] }
    }
    if (sub === 'toggle') {
      device.toggleExpanded()
      return { success: true, output: ['', '[BTK-001] Device view toggled', ''] }
    }

    return { success: false, output: [`[btk] Unknown subcommand: ${sub}`, 'Usage: btk <status|firmware|test|config|tools|reboot|fold|unfold|toggle>'] }
  }
}

// Portable Workbench command
const pwbCommand: Command = {
  name: 'pwb',
  aliases: ['workbench', 'bench'],
  description: 'Portable Workbench management',
  usage: 'pwb <status|firmware|test|config|slots|reboot|fold|unfold|toggle>',
  execute: async (args, ctx) => {
    const device = ctx.data.pwbDevice
    if (!device) {
      return { success: false, output: ['[pwb] Device not connected'] }
    }

    const sub = args[0]?.toLowerCase()

    if (sub === 'fold') {
      device.setExpanded(false)
      return { success: true, output: ['[pwb] Device folded'] }
    }
    if (sub === 'unfold') {
      device.setExpanded(true)
      return { success: true, output: ['[pwb] Device unfolded'] }
    }
    if (sub === 'toggle') {
      device.toggleExpanded()
      return { success: true, output: ['[pwb] Fold state toggled'] }
    }

    if (!sub || sub === 'help') {
      return { success: true, output: [
        '',
        '  PWB-001 Portable Workbench',
        '  ─────────────────────────────',
        '  pwb status     Device status',
        '  pwb firmware   Firmware info',
        '  pwb test       Run diagnostics',
        '  pwb config     View configuration',
        '  pwb slots      Slot status',
        '  pwb reboot     Reboot device',
        '  pwb fold       Fold to compact view',
        '  pwb unfold     Unfold to full view',
        '  pwb toggle     Toggle fold state',
        '',
      ]}
    }

    const state = device.getState()

    if (sub === 'status') {
      const fw = device.getFirmware()
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '',
        '  ┌─ PWB-001 STATUS ────────────────┐',
        `  │ State:    ${state.deviceState.toUpperCase().padEnd(22)}│`,
        `  │ Power:    ${state.isPowered ? 'ON' : 'OFF'}${' '.repeat(state.isPowered ? 20 : 19)}│`,
        `  │ Draw:     ${state.currentDraw.toFixed(1)} E/s${' '.repeat(17 - state.currentDraw.toFixed(1).length)}│`,
        `  │ Firmware: v${fw.version}${' '.repeat(20 - fw.version.length)}│`,
        `  │ Slots:    3 (${state.activeSlot !== null ? 'Slot ' + state.activeSlot + ' active' : 'none active'})${' '.repeat(Math.max(0, 14 - (state.activeSlot !== null ? ('Slot ' + state.activeSlot + ' active').length : 'none active'.length)))}│`,
        `  │ Queue:    ${String(state.queuedItems).padEnd(22)}│`,
        `  │ Progress: ${String(state.craftingProgress + '%').padEnd(22)}│`,
        '  └──────────────────────────────────┘',
        '',
      ]}
    }

    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') {
          return { success: false, output: ['[pwb] Device must be online to update firmware'] }
        }
        ctx.addOutput('[pwb] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[pwb] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[pwb] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '',
        '  PWB-001 FIRMWARE',
        '  ─────────────────────────────',
        `  Version:  v${fw.version}`,
        `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`,
        `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`,
        '',
      ]}
    }

    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') {
        return { success: false, output: ['[pwb] Device must be online to run diagnostics'] }
      }
      ctx.addOutput('[pwb] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[pwb] Diagnostics complete — ALL PASSED'] }
    }

    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '',
        '  PWB-001 CONFIGURATION',
        '  ─────────────────────────────',
        `  Category: ${ps.category}`,
        `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`,
        `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`,
        `  Slots:    3`,
        '',
      ]}
    }

    if (sub === 'slots') {
      return { success: true, output: [
        '',
        '  PWB-001 SLOT STATUS',
        '  ─────────────────────────────',
        `  Slot 0: ${state.queuedItems > 0 ? (state.activeSlot === 0 ? 'ACTIVE' : 'OCCUPIED') : 'EMPTY'}`,
        `  Slot 1: ${state.queuedItems > 1 ? (state.activeSlot === 1 ? 'ACTIVE' : 'OCCUPIED') : 'EMPTY'}`,
        `  Slot 2: ${state.queuedItems > 2 ? (state.activeSlot === 2 ? 'ACTIVE' : 'OCCUPIED') : 'EMPTY'}`,
        `  Progress: ${state.craftingProgress}%`,
        '',
      ]}
    }

    if (sub === 'reboot') {
      if (!state.isPowered) {
        return { success: false, output: ['[pwb] Device is not powered on'] }
      }
      ctx.addOutput('[pwb] Rebooting PWB-001...')
      await device.reboot()
      return { success: true, output: ['[pwb] Reboot complete'] }
    }

    return { success: false, output: [`[pwb] Unknown subcommand: ${sub}`, 'Usage: pwb <status|firmware|test|config|slots|reboot|fold|unfold|toggle>'] }
  }
}

// Resource Magnet command
const rmgCommand: Command = {
  name: 'rmg',
  aliases: ['magnet'],
  description: 'Resource Magnet management',
  usage: 'rmg <status|firmware|test|config|field|reboot>',
  execute: async (args, ctx) => {
    const device = ctx.data.rmgDevice
    if (!device) return { success: false, output: ['[rmg] Device not connected'] }
    const sub = args[0]?.toLowerCase()
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  RMG-001 Resource Magnet', '  ─────────────────────────────',
        '  rmg status     Device status', '  rmg firmware   Firmware info',
        '  rmg test       Run diagnostics', '  rmg config     View configuration',
        '  rmg field      Field status', '  rmg strength   Set strength (0-100)',
        '  rmg reboot     Reboot device',
        '  rmg fold       Fold to compact view', '  rmg unfold     Unfold to full view',
        '  rmg toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      return { success: true, output: [
        '', '  ┌─ RMG-001 STATUS ────────────────┐',
        `  │ State:    ${state.deviceState.toUpperCase().padEnd(22)}│`,
        `  │ Power:    ${state.isPowered ? 'ON' : 'OFF'}${' '.repeat(state.isPowered ? 20 : 19)}│`,
        `  │ Draw:     ${state.currentDraw.toFixed(1)} E/s${' '.repeat(17 - state.currentDraw.toFixed(1).length)}│`,
        `  │ Firmware: v${fw.version}${' '.repeat(20 - fw.version.length)}│`,
        `  │ Strength: ${String(state.strength + '%').padEnd(22)}│`,
        `  │ Field:    ${(state.fieldActive ? 'ACTIVE' : 'INACTIVE').padEnd(22)}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[rmg] Device must be online to update firmware'] }
        ctx.addOutput('[rmg] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[rmg] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[rmg] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  RMG-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[rmg] Device must be online to run diagnostics'] }
      ctx.addOutput('[rmg] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[rmg] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  RMG-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`, '',
      ]}
    }
    if (sub === 'field') {
      return { success: true, output: [
        '', '  RMG-001 FIELD STATUS', '  ─────────────────────────────',
        `  Active:   ${state.fieldActive ? 'YES' : 'NO'}`,
        `  Strength: ${state.strength}%`,
        `  Draw:     ${state.currentDraw.toFixed(1)} E/s`, '',
      ]}
    }
    if (sub === 'strength') {
      const val = parseInt(args[1])
      if (isNaN(val) || val < 0 || val > 100) return { success: false, output: ['[rmg] Usage: rmg strength <0-100>'] }
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[rmg] Device must be online'] }
      device.setStrength(val)
      return { success: true, output: [`[rmg] Strength set to ${val}%`] }
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[rmg] Device is not powered on'] }
      ctx.addOutput('[rmg] Rebooting RMG-001...')
      await device.reboot()
      return { success: true, output: ['[rmg] Reboot complete'] }
    }
    if (sub === 'fold') {
      device.setExpanded(false)
      return { success: true, output: ['', '[RMG-001] Device folded to compact view', ''] }
    }
    if (sub === 'unfold') {
      device.setExpanded(true)
      return { success: true, output: ['', '[RMG-001] Device unfolded to full view', ''] }
    }
    if (sub === 'toggle') {
      device.toggleExpanded()
      return { success: true, output: ['', '[RMG-001] Device view toggled', ''] }
    }
    return { success: false, output: [`[rmg] Unknown subcommand: ${sub}`, 'Usage: rmg <status|firmware|test|config|field|strength|reboot|fold|unfold|toggle>'] }
  }
}

const mscCommand: Command = {
  name: 'msc',
  aliases: ['scanner', 'matscan'],
  description: 'Material Scanner management',
  usage: 'msc <status|firmware|test|config|reboot>',
  execute: async (args, ctx) => {
    const device = ctx.data.mscDevice
    if (!device) return { success: false, output: ['[msc] Device not connected'] }
    const sub = args[0]?.toLowerCase()
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  MSC-001 Material Scanner', '  ─────────────────────────────',
        '  msc status     Device status', '  msc firmware   Firmware info',
        '  msc test       Run diagnostics', '  msc config     View configuration',
        '  msc reboot     Reboot device',
        '  msc fold       Fold to compact view', '  msc unfold     Unfold to full view',
        '  msc toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      return { success: true, output: [
        '', '  ┌─ MSC-001 STATUS ────────────────┐',
        `  │ State:    ${state.deviceState.toUpperCase().padEnd(22)}│`,
        `  │ Power:    ${state.isPowered ? 'ON' : 'OFF'}${' '.repeat(state.isPowered ? 20 : 19)}│`,
        `  │ Draw:     ${state.currentDraw.toFixed(1)} E/s${' '.repeat(17 - state.currentDraw.toFixed(1).length)}│`,
        `  │ Firmware: v${fw.version}${' '.repeat(20 - fw.version.length)}│`,
        `  │ Detected: ${String(state.detectedMaterials).padEnd(22)}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[msc] Device must be online to update firmware'] }
        ctx.addOutput('[msc] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[msc] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[msc] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  MSC-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[msc] Device must be online to run diagnostics'] }
      ctx.addOutput('[msc] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[msc] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  MSC-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`, '',
      ]}
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[msc] Device is not powered on'] }
      ctx.addOutput('[msc] Rebooting MSC-001...')
      await device.reboot()
      return { success: true, output: ['[msc] Reboot complete'] }
    }
    if (sub === 'fold') {
      device.setExpanded(false)
      return { success: true, output: ['', '[MSC-001] Device folded to compact view', ''] }
    }
    if (sub === 'unfold') {
      device.setExpanded(true)
      return { success: true, output: ['', '[MSC-001] Device unfolded to full view', ''] }
    }
    if (sub === 'toggle') {
      device.toggleExpanded()
      return { success: true, output: ['', '[MSC-001] Device view toggled', ''] }
    }
    return { success: false, output: [`[msc] Unknown subcommand: ${sub}`, 'Usage: msc <status|firmware|test|config|reboot|fold|unfold|toggle>'] }
  }
}

// ──────────────────────────────────────────────────────
// TMP — Temperature Monitor management
// ──────────────────────────────────────────────────────

const tmpCommand: Command = {
  name: 'tmp',
  aliases: ['temperature'],
  description: 'Temperature Monitor management',
  usage: 'tmp <status|firmware|test|config|reboot|fold|unfold|toggle>',
  execute: async (args, ctx) => {
    const device = ctx.data.tmpDevice
    if (!device) return { success: false, output: ['[tmp] Device not connected'] }
    const sub = args[0]?.toLowerCase()
    if (sub === 'fold') {
      device.setExpanded(false)
      return { success: true, output: ['[tmp] Device folded'] }
    }
    if (sub === 'unfold') {
      device.setExpanded(true)
      return { success: true, output: ['[tmp] Device unfolded'] }
    }
    if (sub === 'toggle') {
      device.toggleExpanded()
      return { success: true, output: ['[tmp] Fold state toggled'] }
    }
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  TMP-001 Temperature Monitor', '  ─────────────────────────────',
        '  tmp status     Device status', '  tmp firmware   Firmware info',
        '  tmp test       Run diagnostics', '  tmp config     View configuration',
        '  tmp reboot     Reboot device',
        '  tmp fold       Fold to compact view', '  tmp unfold     Unfold to full view',
        '  tmp toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      return { success: true, output: [
        '', '  ┌─ TMP-001 STATUS ────────────────┐',
        `  │ State:    ${state.deviceState.toUpperCase().padEnd(22)}│`,
        `  │ Power:    ${state.isPowered ? 'ON' : 'OFF'}${' '.repeat(state.isPowered ? 20 : 19)}│`,
        `  │ Draw:     ${state.currentDraw.toFixed(1)} E/s${' '.repeat(17 - state.currentDraw.toFixed(1).length)}│`,
        `  │ Firmware: v${fw.version}${' '.repeat(20 - fw.version.length)}│`,
        `  │ Temp:     ${(state.temperature.toFixed(1) + '°C').padEnd(22)}│`,
        `  │ Range:    ${(state.minTemp + '–' + state.maxTemp + '°C').padEnd(22)}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[tmp] Device must be online to update firmware'] }
        ctx.addOutput('[tmp] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[tmp] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[tmp] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  TMP-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[tmp] Device must be online to run diagnostics'] }
      ctx.addOutput('[tmp] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[tmp] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  TMP-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`, '',
      ]}
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[tmp] Device is not powered on'] }
      ctx.addOutput('[tmp] Rebooting TMP-001...')
      await device.reboot()
      return { success: true, output: ['[tmp] Reboot complete'] }
    }
    return { success: false, output: [`[tmp] Unknown subcommand: ${sub}`, 'Usage: tmp <status|firmware|test|config|reboot|fold|unfold|toggle>'] }
  }
}

// ──────────────────────────────────────────────────────
// CLK — Lab Clock management
// ──────────────────────────────────────────────────────

const clkCommand: Command = {
  name: 'clk',
  aliases: ['clock'],
  description: 'CLK-001 Lab Clock management',
  usage: 'clk <status|firmware|test|config|mode|reboot|fold|unfold|toggle>',
  execute: async (args, ctx) => {
    const device = ctx.data.clkDevice
    if (!device) return { success: false, output: ['[clk] CLK-001 not connected'] }
    const sub = args[0]?.toLowerCase()
    if (sub === 'fold') { device.setExpanded(false); return { success: true, output: ['[clk] Device folded'] } }
    if (sub === 'unfold') { device.setExpanded(true); return { success: true, output: ['[clk] Device unfolded'] } }
    if (sub === 'toggle') { device.toggleExpanded(); return { success: true, output: ['[clk] Fold state toggled'] } }
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  CLK-001 Lab Clock', '  ─────────────────────────────',
        '  clk status     Device status', '  clk firmware   Firmware info',
        '  clk test       Run diagnostics', '  clk config     View configuration',
        '  clk mode       Cycle display mode', '  clk reboot     Reboot device',
        '  clk fold       Fold to compact view', '  clk unfold     Unfold to full view',
        '  clk toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      const modeLabel = state.displayMode.toUpperCase()
      return { success: true, output: [
        '', '  ┌─ CLK-001 STATUS ────────────────┐',
        `  │ State:       ${state.deviceState.toUpperCase().padEnd(19)}│`,
        `  │ Power:       ${(state.isPowered ? 'ON' : 'OFF').padEnd(19)}│`,
        `  │ Draw:        ${(state.currentDraw.toFixed(2) + ' E/s').padEnd(19)}│`,
        `  │ Firmware:    v${fw.version.padEnd(17)}│`,
        `  │ Mode:        ${modeLabel.padEnd(19)}│`,
        `  │ Uptime:      ${(state.uptime + 's').padEnd(19)}│`,
        `  │ RTC Sync:    ${'OK'.padEnd(19)}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[clk] Device must be online to update firmware'] }
        ctx.addOutput('[clk] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[clk] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[clk] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  CLK-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[clk] Device must be online to run diagnostics'] }
      ctx.addOutput('[clk] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[clk] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  CLK-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`,
        `  Crystal:       32.768 kHz`,
        `  NTP Server:    time.unos.local`,
        `  Drift Comp:    Auto`,
        `  Modes:         LOCAL, UTC, DATE, UPTIME, COUNTDOWN, STOPWATCH`, '',
      ]}
    }
    if (sub === 'mode') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[clk] Device must be online to change mode'] }
      const modeName = args[1]?.toLowerCase()
      const validModes = ['local', 'utc', 'date', 'uptime', 'countdown', 'stopwatch']
      if (modeName && validModes.includes(modeName)) {
        device.setMode(modeName as any)
        return { success: true, output: [`[clk] Mode set to ${modeName.toUpperCase()}`] }
      }
      device.cycleMode()
      return { success: true, output: [`[clk] Mode cycled`] }
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[clk] Device is not powered on'] }
      ctx.addOutput('[clk] Rebooting CLK-001...')
      await device.reboot()
      return { success: true, output: ['[clk] Reboot complete'] }
    }
    return { success: false, output: [`[clk] Unknown subcommand: ${sub}`, 'Usage: clk <status|firmware|test|config|mode|reboot|fold|unfold|toggle>'] }
  }
}

// ──────────────────────────────────────────────────────
// CPU — CPU Monitor management
// ──────────────────────────────────────────────────────

const cpuCommand: Command = {
  name: 'cpu',
  aliases: ['processor'],
  description: 'CPU-001 CPU Monitor management',
  usage: 'cpu <status|firmware|test|config|reboot|fold|unfold|toggle>',
  execute: async (args, ctx) => {
    const device = ctx.data.cpuDevice
    if (!device) return { success: false, output: ['[cpu] CPU-001 not connected'] }
    const sub = args[0]?.toLowerCase()
    if (sub === 'fold') { device.setExpanded(false); return { success: true, output: ['[cpu] Device folded'] } }
    if (sub === 'unfold') { device.setExpanded(true); return { success: true, output: ['[cpu] Device unfolded'] } }
    if (sub === 'toggle') { device.toggleExpanded(); return { success: true, output: ['[cpu] Fold state toggled'] } }
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  CPU-001 CPU Monitor', '  ─────────────────────────────',
        '  cpu status     Device status', '  cpu firmware   Firmware info',
        '  cpu test       Run diagnostics', '  cpu config     View configuration',
        '  cpu reboot     Reboot device',
        '  cpu fold       Fold to compact view', '  cpu unfold     Unfold to full view',
        '  cpu toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      const avgLoad = state.coreLoads.length > 0 ? Math.round(state.coreLoads.reduce((a: number, b: number) => a + b, 0) / state.coreLoads.length) : 0
      const tempColor = state.temperature > 80 ? '\x1b[31m' : state.temperature > 65 ? '\x1b[33m' : '\x1b[32m'
      const loadColor = avgLoad > 80 ? '\x1b[31m' : avgLoad > 50 ? '\x1b[33m' : '\x1b[32m'
      const reset = '\x1b[0m'
      return { success: true, output: [
        '', '  ┌─ CPU-001 STATUS ────────────────┐',
        `  │ State:       ${state.deviceState.toUpperCase().padEnd(19)}│`,
        `  │ Power:       ${(state.isPowered ? 'ON' : 'OFF').padEnd(19)}│`,
        `  │ Draw:        ${(state.currentDraw.toFixed(1) + ' E/s').padEnd(19)}│`,
        `  │ Firmware:    v${fw.version.padEnd(17)}│`,
        `  │ Cores:       ${String(state.cores).padEnd(19)}│`,
        `  │ Frequency:   ${(state.frequency.toFixed(1) + ' GHz').padEnd(19)}│`,
        `  │ Avg Load:    ${loadColor}${(avgLoad + '%').padEnd(19)}${reset}│`,
        `  │ Temperature: ${tempColor}${(state.temperature.toFixed(0) + '°C').padEnd(19)}${reset}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[cpu] Device must be online to update firmware'] }
        ctx.addOutput('[cpu] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[cpu] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[cpu] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  CPU-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[cpu] Device must be online to run diagnostics'] }
      ctx.addOutput('[cpu] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[cpu] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  CPU-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`,
        `  Cores:         ${state.cores}`,
        `  Base Freq:     ${state.frequency.toFixed(1)} GHz`,
        `  Thermal Limit: 95°C`,
        `  Cache L1:      64 KB/core`,
        `  Cache L2:      512 KB/core`, '',
      ]}
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[cpu] Device is not powered on'] }
      ctx.addOutput('[cpu] Rebooting CPU-001...')
      await device.reboot()
      return { success: true, output: ['[cpu] Reboot complete'] }
    }
    return { success: false, output: [`[cpu] Unknown subcommand: ${sub}`, 'Usage: cpu <status|firmware|test|config|reboot|fold|unfold|toggle>'] }
  }
}

// ──────────────────────────────────────────────────────
// MEM — Memory Monitor management
// ──────────────────────────────────────────────────────

const memCommand: Command = {
  name: 'mem',
  aliases: ['memory', 'ram'],
  description: 'Memory Monitor device management',
  usage: 'mem [status|firmware|test|config|mode|reboot|fold|unfold|toggle]',
  execute: async (args, ctx) => {
    const device = ctx.data.memDevice
    if (!device) return { success: false, output: ['[mem] MEM-001 not connected'] }
    const sub = args[0]?.toLowerCase()
    if (sub === 'fold') { device.setExpanded(false); return { success: true, output: ['[mem] Device folded'] } }
    if (sub === 'unfold') { device.setExpanded(true); return { success: true, output: ['[mem] Device unfolded'] } }
    if (sub === 'toggle') { device.toggleExpanded(); return { success: true, output: ['[mem] Fold state toggled'] } }
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  MEM-001 Memory Monitor', '  ─────────────────────────────',
        '  mem status     Device status', '  mem firmware   Firmware info',
        '  mem test       Run diagnostics', '  mem config     View configuration',
        '  mem mode       Cycle display mode', '  mem reboot     Reboot device',
        '  mem fold       Fold to compact view', '  mem unfold     Unfold to full view',
        '  mem toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      const modeLabel = state.displayMode.toUpperCase()
      const usedPct = state.totalMemory > 0 ? Math.round((state.usedMemory / state.totalMemory) * 100) : 0
      const usedColor = usedPct > 80 ? '\x1b[31m' : usedPct > 50 ? '\x1b[33m' : '\x1b[32m'
      const reset = '\x1b[0m'
      return { success: true, output: [
        '', '  ┌─ MEM-001 STATUS ────────────────┐',
        `  │ State:       ${state.deviceState.toUpperCase().padEnd(19)}│`,
        `  │ Power:       ${(state.isPowered ? 'ON' : 'OFF').padEnd(19)}│`,
        `  │ Draw:        ${(state.currentDraw.toFixed(2) + ' E/s').padEnd(19)}│`,
        `  │ Firmware:    v${fw.version.padEnd(17)}│`,
        `  │ Mode:        ${modeLabel.padEnd(19)}│`,
        `  │ Total Mem:   ${(state.totalMemory + ' MB').padEnd(19)}│`,
        `  │ Used Mem:    ${usedColor}${(state.usedMemory + ' MB (' + usedPct + '%)').padEnd(19)}${reset}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[mem] Device must be online to update firmware'] }
        ctx.addOutput('[mem] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[mem] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[mem] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  MEM-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[mem] Device must be online to run diagnostics'] }
      ctx.addOutput('[mem] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[mem] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  MEM-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`,
        `  Total Memory:  ${state.totalMemory} MB`,
        `  Used Memory:   ${state.usedMemory} MB`,
        `  Display Mode:  ${state.displayMode.toUpperCase()}`,
        `  Current Draw:  ${state.currentDraw.toFixed(2)} E/s`,
        `  Modes:         USAGE, HEAP, CACHE, SWAP, PROCESSES, ALLOCATION`, '',
      ]}
    }
    if (sub === 'mode') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[mem] Device must be online to change mode'] }
      const modeName = args[1]?.toLowerCase()
      const validModes = ['usage', 'heap', 'cache', 'swap', 'processes', 'allocation']
      if (modeName && validModes.includes(modeName)) {
        device.setMode(modeName as any)
        return { success: true, output: [`[mem] Mode set to ${modeName.toUpperCase()}`] }
      }
      device.cycleMode()
      return { success: true, output: [`[mem] Mode cycled`] }
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[mem] Device is not powered on'] }
      ctx.addOutput('[mem] Rebooting MEM-001...')
      await device.reboot()
      return { success: true, output: ['[mem] Reboot complete'] }
    }
    return { success: false, output: [`[mem] Unknown subcommand: ${sub}`, 'Usage: mem [status|firmware|test|config|mode|reboot|fold|unfold|toggle]'] }
  }
}

// ──────────────────────────────────────────────────────
// AND — Anomaly Detector management
// ──────────────────────────────────────────────────────

const andCommand: Command = {
  name: 'and',
  aliases: ['anomaly', 'detector'],
  description: 'AND-001 Anomaly Detector management',
  usage: 'and [status|firmware|test|config|mode|signal|reboot|fold|unfold|toggle]',
  execute: async (args, ctx) => {
    const device = ctx.data.andDevice
    if (!device) return { success: false, output: ['[and] AND-001 not connected'] }
    const sub = args[0]?.toLowerCase()
    if (sub === 'fold') { device.setExpanded(false); return { success: true, output: ['[and] Device folded'] } }
    if (sub === 'unfold') { device.setExpanded(true); return { success: true, output: ['[and] Device unfolded'] } }
    if (sub === 'toggle') { device.toggleExpanded(); return { success: true, output: ['[and] Fold state toggled'] } }
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  AND-001 Anomaly Detector', '  ─────────────────────────────',
        '  and status     Device status', '  and firmware   Firmware info',
        '  and test       Run diagnostics', '  and config     View configuration',
        '  and mode       Cycle display mode', '  and signal     Set signal strength',
        '  and reboot     Reboot device',
        '  and fold       Fold to compact view', '  and unfold     Unfold to full view',
        '  and toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      const modeLabel = state.displayMode.toUpperCase()
      const signalPct = state.signalStrength ?? 0
      const signalColor = signalPct > 60 ? '\x1b[32m' : signalPct > 30 ? '\x1b[33m' : '\x1b[31m'
      const anomalyCount = state.anomaliesFound ?? 0
      const anomalyColor = anomalyCount > 0 ? '\x1b[31m' : '\x1b[32m'
      const reset = '\x1b[0m'
      return { success: true, output: [
        '', '  ┌─ AND-001 STATUS ────────────────┐',
        `  │ State:       ${state.deviceState.toUpperCase().padEnd(19)}│`,
        `  │ Power:       ${(state.isPowered ? 'ON' : 'OFF').padEnd(19)}│`,
        `  │ Draw:        ${(state.currentDraw.toFixed(2) + ' E/s').padEnd(19)}│`,
        `  │ Firmware:    v${fw.version.padEnd(17)}│`,
        `  │ Mode:        ${modeLabel.padEnd(19)}│`,
        `  │ Signal:      ${signalColor}${(signalPct + '%').padEnd(19)}${reset}│`,
        `  │ Anomalies:   ${anomalyColor}${String(anomalyCount).padEnd(19)}${reset}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[and] Device must be online to update firmware'] }
        ctx.addOutput('[and] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[and] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[and] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  AND-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[and] Device must be online to run diagnostics'] }
      ctx.addOutput('[and] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[and] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  AND-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`,
        `  Signal Strength: ${state.signalStrength ?? 0}%`,
        `  Anomalies Found: ${state.anomaliesFound ?? 0}`,
        `  Display Mode:  ${state.displayMode.toUpperCase()}`,
        `  Current Draw:  ${state.currentDraw.toFixed(2)} E/s`,
        `  Modes:         WAVEFORM, SPECTRUM, HEATMAP, TIMELINE, FREQUENCY, RADAR`, '',
      ]}
    }
    if (sub === 'mode') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[and] Device must be online to change mode'] }
      const modeName = args[1]?.toLowerCase()
      const validModes = ['waveform', 'spectrum', 'heatmap', 'timeline', 'frequency', 'radar']
      if (modeName && validModes.includes(modeName)) {
        device.setMode(modeName as any)
        return { success: true, output: [`[and] Mode set to ${modeName.toUpperCase()}`] }
      }
      device.cycleMode()
      return { success: true, output: [`[and] Mode cycled`] }
    }
    if (sub === 'signal') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[and] Device must be online to set signal strength'] }
      const val = parseInt(args[1], 10)
      if (isNaN(val) || val < 0 || val > 100) return { success: false, output: ['[and] Signal strength must be 0-100'] }
      device.setSignalStrength(val)
      return { success: true, output: [`[and] Signal strength set to ${val}%`] }
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[and] Device is not powered on'] }
      ctx.addOutput('[and] Rebooting AND-001...')
      await device.reboot()
      return { success: true, output: ['[and] Reboot complete'] }
    }
    return { success: false, output: [`[and] Unknown subcommand: ${sub}`, 'Usage: and [status|firmware|test|config|mode|signal|reboot|fold|unfold|toggle]'] }
  }
}

// ──────────────────────────────────────────────────────
// QCP — Quantum Compass management
// ──────────────────────────────────────────────────────

const qcpCommand: Command = {
  name: 'qcp',
  aliases: ['compass', 'qcompass'],
  description: 'QCP-001 Quantum Compass management',
  usage: 'qcp [status|firmware|test|config|mode|bearing|distance|reboot|fold|unfold|toggle]',
  execute: async (args, ctx) => {
    const device = ctx.data.qcpDevice
    if (!device) return { success: false, output: ['[qcp] QCP-001 not connected'] }
    const sub = args[0]?.toLowerCase()
    if (sub === 'fold') { device.setExpanded(false); return { success: true, output: ['[qcp] Device folded'] } }
    if (sub === 'unfold') { device.setExpanded(true); return { success: true, output: ['[qcp] Device unfolded'] } }
    if (sub === 'toggle') { device.toggleExpanded(); return { success: true, output: ['[qcp] Fold state toggled'] } }
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  QCP-001 Quantum Compass', '  ─────────────────────────────',
        '  qcp status     Device status', '  qcp firmware   Firmware info',
        '  qcp test       Run diagnostics', '  qcp config     View configuration',
        '  qcp mode       Cycle display mode', '  qcp bearing    Set anomaly direction',
        '  qcp distance   Set anomaly distance', '  qcp reboot     Reboot device',
        '  qcp fold       Fold to compact view', '  qcp unfold     Unfold to full view',
        '  qcp toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      const modeLabel = state.displayMode.toUpperCase()
      const direction = state.anomalyDirection ?? 0
      const distance = state.anomalyDistance ?? 0
      const distColor = distance < 50 ? '\x1b[32m' : distance < 100 ? '\x1b[33m' : '\x1b[31m'
      const anomalyStatus = distance > 0 ? 'DETECTED' : 'NONE'
      const anomalyColor = distance > 0 ? '\x1b[31m' : '\x1b[32m'
      const reset = '\x1b[0m'
      return { success: true, output: [
        '', '  ┌─ QCP-001 STATUS ────────────────┐',
        `  │ State:       ${state.deviceState.toUpperCase().padEnd(19)}│`,
        `  │ Power:       ${(state.isPowered ? 'ON' : 'OFF').padEnd(19)}│`,
        `  │ Draw:        ${(state.currentDraw.toFixed(2) + ' E/s').padEnd(19)}│`,
        `  │ Firmware:    v${fw.version.padEnd(17)}│`,
        `  │ Mode:        ${modeLabel.padEnd(19)}│`,
        `  │ Direction:   ${(direction + '°').padEnd(19)}│`,
        `  │ Distance:    ${distColor}${(distance + 'm').padEnd(19)}${reset}│`,
        `  │ Anomaly:     ${anomalyColor}${anomalyStatus.padEnd(19)}${reset}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[qcp] Device must be online to update firmware'] }
        ctx.addOutput('[qcp] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[qcp] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[qcp] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  QCP-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[qcp] Device must be online to run diagnostics'] }
      ctx.addOutput('[qcp] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[qcp] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  QCP-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`,
        `  Direction:     ${state.anomalyDirection ?? 0}°`,
        `  Distance:      ${state.anomalyDistance ?? 0}m`,
        `  Display Mode:  ${state.displayMode.toUpperCase()}`,
        `  Current Draw:  ${state.currentDraw.toFixed(2)} E/s`,
        `  Modes:         COMPASS, RADAR, HEATMAP, TRAJECTORY, TRIANGULATE, HISTORY`, '',
      ]}
    }
    if (sub === 'mode') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[qcp] Device must be online to change mode'] }
      const modeName = args[1]?.toLowerCase()
      const validModes = ['compass', 'radar', 'heatmap', 'trajectory', 'triangulate', 'history']
      if (modeName && validModes.includes(modeName)) {
        device.setMode(modeName as any)
        return { success: true, output: [`[qcp] Mode set to ${modeName.toUpperCase()}`] }
      }
      device.cycleMode()
      return { success: true, output: [`[qcp] Mode cycled`] }
    }
    if (sub === 'bearing') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[qcp] Device must be online to set bearing'] }
      const val = parseInt(args[1], 10)
      if (isNaN(val) || val < 0 || val > 360) return { success: false, output: ['[qcp] Bearing must be 0-360 degrees'] }
      device.setAnomalyDirection(val)
      return { success: true, output: [`[qcp] Anomaly bearing set to ${val}°`] }
    }
    if (sub === 'distance') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[qcp] Device must be online to set distance'] }
      const val = parseFloat(args[1])
      if (isNaN(val) || val < 0) return { success: false, output: ['[qcp] Distance must be a positive number (meters)'] }
      device.setAnomalyDistance(val)
      return { success: true, output: [`[qcp] Anomaly distance set to ${val}m`] }
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[qcp] Device is not powered on'] }
      ctx.addOutput('[qcp] Rebooting QCP-001...')
      await device.reboot()
      return { success: true, output: ['[qcp] Reboot complete'] }
    }
    return { success: false, output: [`[qcp] Unknown subcommand: ${sub}`, 'Usage: qcp [status|firmware|test|config|mode|bearing|distance|reboot|fold|unfold|toggle]'] }
  }
}

// ──────────────────────────────────────────────────────
// DIM — Dimension Monitor management
// ──────────────────────────────────────────────────────

const dimCommand: Command = {
  name: 'dim',
  aliases: ['dimension'],
  description: 'DIM-001 Dimension Monitor management',
  usage: 'dim <status|firmware|test|config|reboot|fold|unfold|toggle>',
  execute: async (args, ctx) => {
    const device = ctx.data.dimDevice
    if (!device) return { success: false, output: ['[dim] DIM-001 not connected'] }
    const sub = args[0]?.toLowerCase()
    if (sub === 'fold') { device.setExpanded(false); return { success: true, output: ['[dim] Device folded'] } }
    if (sub === 'unfold') { device.setExpanded(true); return { success: true, output: ['[dim] Device unfolded'] } }
    if (sub === 'toggle') { device.toggleExpanded(); return { success: true, output: ['[dim] Fold state toggled'] } }
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  DIM-001 Dimension Monitor', '  ─────────────────────────────',
        '  dim status     Device status', '  dim firmware   Firmware info',
        '  dim test       Run diagnostics', '  dim config     View configuration',
        '  dim reboot     Reboot device',
        '  dim fold       Fold to compact view', '  dim unfold     Unfold to full view',
        '  dim toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      const dimValue = state.dimension + (state.fluctuation ?? 0)
      const stabilityPct = state.stability ?? 0
      const riftPct = state.riftActivity ?? 0
      const haloProximity = Math.max(0, 100 - stabilityPct + riftPct * 100)
      const entanglement = stabilityPct > 90 ? 'STRONG' : stabilityPct > 70 ? 'MODERATE' : 'WEAK'
      const stabilityColor = stabilityPct > 90 ? '\x1b[32m' : stabilityPct > 70 ? '\x1b[33m' : '\x1b[31m'
      const reset = '\x1b[0m'
      return { success: true, output: [
        '', '  ┌─ DIM-001 STATUS ────────────────┐',
        `  │ State:       ${state.deviceState.toUpperCase().padEnd(19)}│`,
        `  │ Power:       ${(state.isPowered ? 'ON' : 'OFF').padEnd(19)}│`,
        `  │ Draw:        ${(state.currentDraw.toFixed(1) + ' E/s').padEnd(19)}│`,
        `  │ Firmware:    v${fw.version.padEnd(17)}│`,
        `  │ Dimension:   ${dimValue.toFixed(2).padEnd(19)}│`,
        `  │ Stability:   ${stabilityColor}${(stabilityPct.toFixed(1) + '%').padEnd(19)}${reset}│`,
        `  │ Rift Act.:   ${(riftPct.toFixed(1) + '%').padEnd(19)}│`,
        `  │ Halo Prox.:  ${haloProximity.toFixed(1).padEnd(19)}│`,
        `  │ Entangle.:   ${entanglement.padEnd(19)}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[dim] Device must be online to update firmware'] }
        ctx.addOutput('[dim] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[dim] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[dim] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  DIM-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[dim] Device must be online to run diagnostics'] }
      ctx.addOutput('[dim] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[dim] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  DIM-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`,
        `  Dim Lock Target:     D-3.7`,
        `  Stability Threshold: 85%`,
        `  Rift Sensitivity:    HIGH`,
        `  Halo Alert Distance: 25.0`,
        `  Scan Interval:       500ms`, '',
      ]}
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[dim] Device is not powered on'] }
      ctx.addOutput('[dim] Rebooting DIM-001...')
      await device.reboot()
      return { success: true, output: ['[dim] Reboot complete'] }
    }
    return { success: false, output: [`[dim] Unknown subcommand: ${sub}`, 'Usage: dim <status|firmware|test|config|reboot|fold|unfold|toggle>'] }
  }
}

// ──────────────────────────────────────────────────────
// NET — Network Monitor management
// ──────────────────────────────────────────────────────

const netCommand: Command = {
  name: 'net',
  aliases: ['network', 'netmon'],
  description: 'Network Monitor management',
  usage: 'net <status|firmware|test|config|reboot|fold|unfold|toggle>',
  execute: async (args, ctx) => {
    const device = ctx.data.netDevice
    if (!device) return { success: false, output: ['[net] Device not connected'] }
    const sub = args[0]?.toLowerCase()
    if (sub === 'fold') {
      device.setExpanded(false)
      return { success: true, output: ['[net] Device folded'] }
    }
    if (sub === 'unfold') {
      device.setExpanded(true)
      return { success: true, output: ['[net] Device unfolded'] }
    }
    if (sub === 'toggle') {
      device.toggleExpanded()
      return { success: true, output: ['[net] Fold state toggled'] }
    }
    if (!sub || sub === 'help') {
      return { success: true, output: [
        '', '  NET-001 Network Monitor', '  ─────────────────────────────',
        '  net status     Device status', '  net firmware   Firmware info',
        '  net test       Run diagnostics', '  net config     View configuration',
        '  net reboot     Reboot device',
        '  net fold       Fold to compact view', '  net unfold     Unfold to full view',
        '  net toggle     Toggle fold state', '',
      ]}
    }
    const state = device.getState()
    if (sub === 'status') {
      const fw = device.getFirmware()
      return { success: true, output: [
        '', '  ┌─ NET-001 STATUS ────────────────┐',
        `  │ State:    ${state.deviceState.toUpperCase().padEnd(22)}│`,
        `  │ Power:    ${state.isPowered ? 'ON' : 'OFF'}${' '.repeat(state.isPowered ? 20 : 19)}│`,
        `  │ Draw:     ${state.currentDraw.toFixed(1)} E/s${' '.repeat(17 - state.currentDraw.toFixed(1).length)}│`,
        `  │ Firmware: v${fw.version}${' '.repeat(20 - fw.version.length)}│`,
        `  │ Bandwidth:${(state.bandwidth.toFixed(1) + ' Gbps').padEnd(22)}│`,
        `  │ Latency:  ${(state.latencyMs + 'ms').padEnd(22)}│`,
        `  │ Connected:${(state.isConnected ? 'YES' : 'NO').padEnd(22)}│`,
        '  └──────────────────────────────────┘', '',
      ]}
    }
    if (sub === 'firmware') {
      const sub2 = args[1]?.toLowerCase()
      const fw = device.getFirmware()
      if (sub2 === 'update') {
        if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[net] Device must be online to update firmware'] }
        ctx.addOutput('[net] Checking for firmware updates...')
        await new Promise(r => setTimeout(r, 800))
        ctx.addOutput('[net] Current version: v' + fw.version)
        await new Promise(r => setTimeout(r, 500))
        ctx.addOutput('[net] No updates available. Firmware is up to date.')
        return { success: true }
      }
      return { success: true, output: [
        '', '  NET-001 FIRMWARE', '  ─────────────────────────────',
        `  Version:  v${fw.version}`, `  Build:    ${fw.build}`,
        `  Checksum: ${fw.checksum}`, `  Patch:    ${fw.securityPatch}`,
        `  Features: ${fw.features.join(', ')}`, '',
      ]}
    }
    if (sub === 'test' || sub === 'diag') {
      if (!state.isPowered || state.deviceState !== 'online') return { success: false, output: ['[net] Device must be online to run diagnostics'] }
      ctx.addOutput('[net] Starting diagnostics...')
      await device.runTest()
      return { success: true, output: ['[net] Diagnostics complete — ALL PASSED'] }
    }
    if (sub === 'config') {
      const ps = device.getPowerSpecs()
      return { success: true, output: [
        '', '  NET-001 CONFIGURATION', '  ─────────────────────────────',
        `  Category: ${ps.category}`, `  Priority: ${ps.priority}`,
        `  Power Full:    ${ps.full} E/s`, `  Power Idle:    ${ps.idle} E/s`,
        `  Power Standby: ${ps.standby} E/s`, '',
      ]}
    }
    if (sub === 'reboot') {
      if (!state.isPowered) return { success: false, output: ['[net] Device is not powered on'] }
      ctx.addOutput('[net] Rebooting NET-001...')
      await device.reboot()
      return { success: true, output: ['[net] Reboot complete'] }
    }
    return { success: false, output: [`[net] Unknown subcommand: ${sub}`, 'Usage: net <status|firmware|test|config|reboot|fold|unfold|toggle>'] }
  }
}

// ──────────────────────────────────────────────────────
// unMC — Midnight Commander for _unOS (interactive)
// ──────────────────────────────────────────────────────
const unmcCommand: Command = {
  name: 'unmc',
  aliases: ['mc'],
  description: 'Midnight Commander — interactive dual-pane file manager',
  usage: 'unmc',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: '[unmc] Filesystem not available' }

    if (args[0]?.toLowerCase() === 'info' || args[0]?.toLowerCase() === 'about') {
      return { success: true, output: [
        '',
        '  ┌─────────────────────────────────────────────┐',
        '  │           unMC — _unOS File Manager          │',
        '  │         Midnight Commander for _unOS          │',
        '  ├─────────────────────────────────────────────┤',
        '  │  Version:  2.0.0 (interactive)               │',
        '  │  Based on: GNU Midnight Commander            │',
        '  │  License:  _unOS Internal Use Only            │',
        '  │  Author:   _unLABS Dev Team                   │',
        '  │                                               │',
        '  │  github.com/MidnightCommander/mc              │',
        '  └─────────────────────────────────────────────┘',
        '',
      ]}
    }

    if (args[0]?.toLowerCase() === 'help' || args[0]?.toLowerCase() === 'h') {
      return { success: true, output: [
        '',
        '  unMC — Interactive Midnight Commander for _unOS',
        '  ───────────────────────────────────────────────',
        '  unmc           Launch interactive file manager',
        '  unmc info      About unMC',
        '',
        '  Keyboard (inside MC):',
        '  ↑/↓       Navigate files',
        '  Tab       Switch panes',
        '  Enter     Open directory / view file',
        '  Backspace Go to parent directory',
        '  F3        View file',
        '  F5        Copy to other pane',
        '  F6        Move/rename',
        '  F7        Create directory',
        '  F8        Delete',
        '  Esc/F10   Quit MC',
        '',
      ]}
    }

    // Launch interactive MC
    return { success: true, output: ['[unmc] Launching interactive mode...'], appMode: 'mc' }
  }
}

// ──────────────────────────────────────────────────────
// unmcedit — standalone editor command
// ──────────────────────────────────────────────────────
const unmceditCommand: Command = {
  name: 'unmcedit',
  aliases: ['mcedit'],
  description: 'Edit a file in the unMC editor',
  usage: 'unmcedit <file>',
  execute: async (args, ctx) => {
    const fs = ctx.data.filesystemActions
    if (!fs) return { success: false, error: '[unmcedit] Filesystem not available' }

    const target = args[0]
    if (!target) return { success: false, error: 'Usage: unmcedit <file>' }

    // Resolve path
    const cwd = fs.getCwd()
    let resolved: string
    if (target.startsWith('/')) resolved = target
    else if (target.startsWith('~')) resolved = target
    else resolved = cwd === '/' ? `/${target}` : `${cwd}/${target}`

    // Check if it exists — if not, create it
    const info = fs.stat(resolved)
    if (info && info.type === 'dir') return { success: false, error: `[unmcedit] "${resolved}" is a directory` }
    if (!info) {
      // Create new file
      const err = fs.touch(resolved)
      if (err) return { success: false, error: `[unmcedit] ${err}` }
    }

    return { success: true, output: [`[unmcedit] Opening ${resolved}...`], appMode: 'mcedit', appModeData: { editFile: resolved } }
  }
}

const tlpCommand: Command = {
  name: 'tlp',
  aliases: ['teleport'],
  description: 'Manage TLP-001 Teleport Pad',
  usage: 'tlp <subcommand>',
  execute: async (args, ctx) => {
    const sub = args[0]?.toLowerCase()
    const device = ctx.data.tlpDevice
    if (sub === 'fold') { device?.setExpanded(false); return { success: true, output: ['[TLP-001] Device folded'] } }
    if (sub === 'unfold') { device?.setExpanded(true); return { success: true, output: ['[TLP-001] Device unfolded'] } }
    if (sub === 'toggle') { device?.toggleExpanded(); return { success: true, output: ['[TLP-001] Fold state toggled'] } }

    if (!sub || sub === 'status') {
      // Show full status with firmware, power, state
      const state = device?.getState()
      const fw = device?.getFirmware()
      const power = device?.getPowerSpecs()
      return {
        success: true,
        output: [
          '┌─────────────────────────────────────────┐',
          '│         TLP-001 TELEPORT PAD             │',
          '│            WARP Industries                │',
          '├─────────────────────────────────────────┤',
          `│ Status:      ${(state?.deviceState ?? 'unknown').toUpperCase().padEnd(26)}│`,
          `│ Message:     ${(state?.statusMessage ?? '-').padEnd(26)}│`,
          `│ Powered:     ${(state?.isPowered ? 'YES' : 'NO').padEnd(26)}│`,
          `│ Draw:        ${((state?.currentDraw ?? 0).toFixed(1) + ' W').padEnd(26)}│`,
          `│ Charge:      ${((state?.chargeLevel ?? 0) + '%').padEnd(26)}│`,
          `│ Destination: ${(state?.lastDestination ?? '-').padEnd(26)}│`,
          `│ Mode:        ${(state?.displayMode ?? '-').toUpperCase().padEnd(26)}│`,
          '├─────────────────────────────────────────┤',
          `│ Firmware:    ${('v' + (fw?.version ?? '?')).padEnd(26)}│`,
          `│ Build:       ${(fw?.build ?? '?').padEnd(26)}│`,
          `│ Checksum:    ${(fw?.checksum ?? '?').padEnd(26)}│`,
          `│ Patch:       ${(fw?.securityPatch ?? '?').padEnd(26)}│`,
          '├─────────────────────────────────────────┤',
          `│ Power Full:  ${((power?.full ?? 0) + ' W').padEnd(26)}│`,
          `│ Power Idle:  ${((power?.idle ?? 0) + ' W').padEnd(26)}│`,
          `│ Standby:     ${((power?.standby ?? 0) + ' W').padEnd(26)}│`,
          `│ Category:    ${(power?.category ?? '?').padEnd(26)}│`,
          `│ Priority:    ${String(power?.priority ?? '?').padEnd(26)}│`,
          '└─────────────────────────────────────────┘',
        ],
      }
    }

    if (sub === 'on') {
      await device?.powerOn()
      return { success: true, output: ['[TLP-001] Powering on...'] }
    }
    if (sub === 'off') {
      await device?.powerOff()
      return { success: true, output: ['[TLP-001] Powering off...'] }
    }
    if (sub === 'test') {
      await device?.runTest()
      return { success: true, output: ['[TLP-001] Running diagnostics...'] }
    }
    if (sub === 'reboot') {
      await device?.reboot()
      return { success: true, output: ['[TLP-001] Rebooting...'] }
    }
    if (sub === 'firmware' || sub === 'fw') {
      const fw = device?.getFirmware()
      return {
        success: true,
        output: [
          `TLP-001 Firmware v${fw?.version ?? '?'}`,
          `Build:    ${fw?.build ?? '?'}`,
          `Checksum: ${fw?.checksum ?? '?'}`,
          `Patch:    ${fw?.securityPatch ?? '?'}`,
          `Features: ${fw?.features?.join(', ') ?? 'none'}`,
        ],
      }
    }
    if (sub === 'config' || sub === 'cfg') {
      const param = args[1]?.toLowerCase()
      const value = args[2]
      if (!param) {
        const state = device?.getState()
        return {
          success: true,
          output: [
            'TLP-001 Configuration:',
            `  charge:      ${state?.chargeLevel ?? 65}%`,
            `  destination: ${state?.lastDestination ?? 'LAB-Ω'}`,
            `  mode:        ${state?.displayMode ?? 'standard'}`,
            '',
            'Usage: tlp config <param> <value>',
            '  charge <0-100>         Set charge level',
            '  dest <name>            Set destination',
            '  mode <mode>            Set transport mode',
          ],
        }
      }
      if (param === 'charge' && value) {
        const v = parseInt(value)
        if (isNaN(v) || v < 0 || v > 100) return { success: false, error: 'charge must be 0-100' }
        device?.setChargeLevel(v)
        return { success: true, output: [`[TLP-001] Charge set to ${v}%`] }
      }
      if ((param === 'dest' || param === 'destination') && value) {
        device?.setLastDestination(args.slice(2).join(' '))
        return { success: true, output: [`[TLP-001] Destination set to ${args.slice(2).join(' ')}`] }
      }
      if (param === 'mode' && value) {
        const modes = ['standard', 'precision', 'express', 'stealth', 'cargo', 'emergency']
        if (!modes.includes(value.toLowerCase())) return { success: false, error: `invalid mode. valid: ${modes.join(', ')}` }
        device?.setMode(value.toLowerCase() as 'standard' | 'precision' | 'express' | 'stealth' | 'cargo' | 'emergency')
        return { success: true, output: [`[TLP-001] Mode set to ${value.toUpperCase()}`] }
      }
      return { success: false, error: 'unknown config parameter' }
    }
    if (sub === 'mode') {
      const mode = args[1]?.toLowerCase()
      if (!mode) {
        return { success: true, output: ['modes: standard, precision, express, stealth, cargo, emergency'] }
      }
      const modes = ['standard', 'precision', 'express', 'stealth', 'cargo', 'emergency']
      if (!modes.includes(mode)) return { success: false, error: `invalid mode. valid: ${modes.join(', ')}` }
      device?.setMode(mode as 'standard' | 'precision' | 'express' | 'stealth' | 'cargo' | 'emergency')
      return { success: true, output: [`[TLP-001] Transport mode: ${mode.toUpperCase()}`] }
    }
    if (sub === 'charge') {
      const state = device?.getState()
      return { success: true, output: [`[TLP-001] Charge: ${state?.chargeLevel ?? 0}%`] }
    }
    if (sub === 'dest' || sub === 'destination') {
      const state = device?.getState()
      return { success: true, output: [`[TLP-001] Destination: ${state?.lastDestination ?? 'unknown'}`] }
    }
    if (sub === 'help') {
      return {
        success: true,
        output: [
          'TLP-001 Teleport Pad — WARP Industries',
          '',
          'Usage: tlp <subcommand>',
          '',
          '  status       Show device status',
          '  on/off       Power control',
          '  test         Run diagnostics',
          '  reboot       Restart device',
          '  firmware     Show firmware info',
          '  config       View/set configuration',
          '  mode <m>     Set transport mode',
          '  charge       Show charge level',
          '  dest         Show destination',
          '  fold         Fold to compact view',
          '  unfold       Unfold to full view',
          '  toggle       Toggle fold state',
          '  help         Show this help',
        ],
      }
    }

    return { success: false, error: `unknown subcommand: ${sub}. try: tlp help` }
  },
}

const lctCommand: Command = {
  name: 'lct',
  aliases: ['laser-ctrl'],
  description: 'LCT-001 Precision Laser management',
  usage: 'lct <subcommand>',
  execute: async (args, ctx) => {
    const sub = args[0]?.toLowerCase()
    const device = ctx.data.lctDevice
    if (sub === 'fold') { device?.setExpanded(false); return { success: true, output: ['[LCT-001] Device folded'] } }
    if (sub === 'unfold') { device?.setExpanded(true); return { success: true, output: ['[LCT-001] Device unfolded'] } }
    if (sub === 'toggle') { device?.toggleExpanded(); return { success: true, output: ['[LCT-001] Fold state toggled'] } }

    if (!sub || sub === 'status') {
      const state = device?.getState()
      return {
        success: true,
        output: [
          '┌─────────────────────────────────────────┐',
          '│         LCT-001 PRECISION LASER          │',
          '├─────────────────────────────────────────┤',
          `│ Status:      ${(state?.deviceState ?? 'unknown').toUpperCase().padEnd(26)}│`,
          `│ Message:     ${(state?.statusMessage ?? '-').padEnd(26)}│`,
          `│ Powered:     ${(state?.isPowered ? 'YES' : 'NO').padEnd(26)}│`,
          `│ Draw:        ${((state?.currentDraw ?? 0).toFixed(1) + ' W').padEnd(26)}│`,
          `│ Laser Power: ${((state?.laserPower ?? 0) + ' W').padEnd(26)}│`,
          `│ Precision:   ${(String(state?.precision ?? 0)).padEnd(26)}│`,
          `│ Mode:        ${(state?.displayMode ?? '-').toUpperCase().padEnd(26)}│`,
          `│ Test Result: ${(state?.testResult ?? '-').padEnd(26)}│`,
          '└─────────────────────────────────────────┘',
        ],
      }
    }

    if (sub === 'on') {
      await device?.powerOn()
      return { success: true, output: ['[LCT-001] Powering on...'] }
    }
    if (sub === 'off') {
      await device?.powerOff()
      return { success: true, output: ['[LCT-001] Powering off...'] }
    }
    if (sub === 'test') {
      await device?.runTest()
      return { success: true, output: ['[LCT-001] Running diagnostics...'] }
    }
    if (sub === 'reboot') {
      await device?.reboot()
      return { success: true, output: ['[LCT-001] Rebooting...'] }
    }
    if (sub === 'firmware' || sub === 'fw') {
      const fw = device?.getFirmware()
      return {
        success: true,
        output: [
          `LCT-001 Firmware v${fw?.version ?? '?'}`,
          `Build:    ${fw?.build ?? '?'}`,
          `Checksum: ${fw?.checksum ?? '?'}`,
          `Features: ${fw?.features?.join(', ') ?? 'none'}`,
          `Patch:    ${fw?.securityPatch ?? '?'}`,
        ],
      }
    }
    if (sub === 'config' || sub === 'cfg') {
      const power = device?.getPowerSpecs()
      return {
        success: true,
        output: [
          'LCT-001 Power Configuration:',
          `  Full:      ${power?.full ?? '?'} W`,
          `  Idle:      ${power?.idle ?? '?'} W`,
          `  Standby:   ${power?.standby ?? '?'} W`,
          `  Category:  ${power?.category ?? '?'}`,
          `  Priority:  ${power?.priority ?? '?'}`,
        ],
      }
    }
    if (sub === 'mode') {
      const value = args[1]?.toLowerCase()
      const modes = ['cutting', 'engraving', 'welding', 'marking', 'drilling', 'scanning']
      if (!value) {
        await device?.cycleMode()
        const state = device?.getState()
        return { success: true, output: [`[LCT-001] Mode cycled to: ${(state?.displayMode ?? 'cutting').toUpperCase()}`] }
      }
      if (!modes.includes(value)) return { success: false, error: `invalid mode. valid: ${modes.join(', ')}` }
      device?.setMode(value as 'cutting' | 'engraving' | 'welding' | 'marking' | 'drilling' | 'scanning')
      return { success: true, output: [`[LCT-001] Mode set to ${value.toUpperCase()}`] }
    }
    if (sub === 'power') {
      const value = args[1]
      if (!value) {
        const state = device?.getState()
        return { success: true, output: [`[LCT-001] Laser power: ${state?.laserPower ?? 0} W`] }
      }
      const v = parseInt(value)
      if (isNaN(v) || v < 0 || v > 450) return { success: false, error: 'laser power must be 0-450' }
      device?.setLaserPower(v)
      return { success: true, output: [`[LCT-001] Laser power set to ${v} W`] }
    }
    if (sub === 'precision') {
      const value = args[1]
      if (!value) {
        const state = device?.getState()
        return { success: true, output: [`[LCT-001] Precision: ${state?.precision ?? 0}`] }
      }
      const v = parseFloat(value)
      if (isNaN(v) || v < 0.001 || v > 1.0) return { success: false, error: 'precision must be 0.001-1.0' }
      device?.setPrecision(v)
      return { success: true, output: [`[LCT-001] Precision set to ${v}`] }
    }
    if (sub === 'help') {
      return {
        success: true,
        output: [
          'LCT-001 Precision Laser',
          '',
          'Usage: lct <subcommand>',
          '',
          '  status       Show device status',
          '  on/off       Power control',
          '  test         Run diagnostics',
          '  reboot       Restart device',
          '  firmware     Show firmware info',
          '  config       View power specs',
          '  mode [name]  Cycle or set laser mode',
          '  power [val]  Get/set laser power (0-450)',
          '  precision [v] Get/set precision (0.001-1.0)',
          '  fold         Fold to compact view',
          '  unfold       Unfold to full view',
          '  toggle       Toggle fold state',
          '  help         Show this help',
        ],
      }
    }

    return { success: false, error: `unknown subcommand: ${sub}. try: lct help` }
  },
}

const p3dCommand: Command = {
  name: 'p3d',
  aliases: ['printer-ctrl', 'fab'],
  description: 'P3D-001 3D Fabricator management',
  usage: 'p3d <subcommand>',
  execute: async (args, ctx) => {
    const sub = args[0]?.toLowerCase()
    const device = ctx.data.p3dDevice

    if (!sub || sub === 'status') {
      const state = device?.getState()
      return {
        success: true,
        output: [
          '┌─────────────────────────────────────────┐',
          '│         P3D-001 3D FABRICATOR            │',
          '├─────────────────────────────────────────┤',
          `│ Status:      ${(state?.deviceState ?? 'unknown').toUpperCase().padEnd(26)}│`,
          `│ Message:     ${(state?.statusMessage ?? '-').padEnd(26)}│`,
          `│ Powered:     ${(state?.isPowered ? 'YES' : 'NO').padEnd(26)}│`,
          `│ Draw:        ${((state?.currentDraw ?? 0).toFixed(1) + ' W').padEnd(26)}│`,
          `│ Progress:    ${((state?.progress ?? 0) + '%').padEnd(26)}│`,
          `│ Layer Count: ${(String(state?.layerCount ?? 0)).padEnd(26)}│`,
          `│ Bed Temp:    ${((state?.bedTemp ?? 0) + '°C').padEnd(26)}│`,
          `│ Mode:        ${(state?.displayMode ?? '-').toUpperCase().padEnd(26)}│`,
          `│ Test Result: ${(state?.testResult ?? '-').padEnd(26)}│`,
          '└─────────────────────────────────────────┘',
        ],
      }
    }

    if (sub === 'on') {
      await device?.powerOn()
      return { success: true, output: ['[P3D-001] Powering on...'] }
    }
    if (sub === 'off') {
      await device?.powerOff()
      return { success: true, output: ['[P3D-001] Powering off...'] }
    }
    if (sub === 'test') {
      await device?.runTest()
      return { success: true, output: ['[P3D-001] Running diagnostics...'] }
    }
    if (sub === 'reboot') {
      await device?.reboot()
      return { success: true, output: ['[P3D-001] Rebooting...'] }
    }
    if (sub === 'firmware' || sub === 'fw') {
      const fw = device?.getFirmware()
      return {
        success: true,
        output: [
          `P3D-001 Firmware v${fw?.version ?? '?'}`,
          `Build:    ${fw?.build ?? '?'}`,
          `Checksum: ${fw?.checksum ?? '?'}`,
          `Features: ${fw?.features?.join(', ') ?? 'none'}`,
          `Patch:    ${fw?.securityPatch ?? '?'}`,
        ],
      }
    }
    if (sub === 'config' || sub === 'cfg') {
      const power = device?.getPowerSpecs()
      return {
        success: true,
        output: [
          'P3D-001 Power Configuration:',
          `  Full:      ${power?.full ?? '?'} W`,
          `  Idle:      ${power?.idle ?? '?'} W`,
          `  Standby:   ${power?.standby ?? '?'} W`,
          `  Category:  ${power?.category ?? '?'}`,
          `  Priority:  ${power?.priority ?? '?'}`,
        ],
      }
    }
    if (sub === 'mode') {
      const value = args[1]?.toLowerCase()
      const modes = ['plastic', 'metal', 'crystal', 'composite', 'nano', 'prototype']
      if (!value) {
        await device?.cycleMode()
        const state = device?.getState()
        return { success: true, output: [`[P3D-001] Mode cycled to: ${(state?.displayMode ?? 'plastic').toUpperCase()}`] }
      }
      if (!modes.includes(value)) return { success: false, error: `invalid mode. valid: ${modes.join(', ')}` }
      device?.setMode(value as 'plastic' | 'metal' | 'crystal' | 'composite' | 'nano' | 'prototype')
      return { success: true, output: [`[P3D-001] Mode set to ${value.toUpperCase()}`] }
    }
    if (sub === 'progress') {
      const value = args[1]
      if (!value) {
        const state = device?.getState()
        return { success: true, output: [`[P3D-001] Print progress: ${state?.progress ?? 0}%`] }
      }
      const v = parseInt(value)
      if (isNaN(v) || v < 0 || v > 100) return { success: false, error: 'progress must be 0-100' }
      device?.setProgress(v)
      return { success: true, output: [`[P3D-001] Print progress set to ${v}%`] }
    }
    if (sub === 'layer') {
      const value = args[1]
      if (!value) {
        const state = device?.getState()
        return { success: true, output: [`[P3D-001] Layer count: ${state?.layerCount ?? 0}`] }
      }
      const v = parseInt(value)
      if (isNaN(v) || v < 0) return { success: false, error: 'layer count must be >= 0' }
      device?.setLayerCount(v)
      return { success: true, output: [`[P3D-001] Layer count set to ${v}`] }
    }
    if (sub === 'bedtemp') {
      const value = args[1]
      if (!value) {
        const state = device?.getState()
        return { success: true, output: [`[P3D-001] Bed temperature: ${state?.bedTemp ?? 0}°C`] }
      }
      const v = parseInt(value)
      if (isNaN(v) || v < 0 || v > 120) return { success: false, error: 'bed temperature must be 0-120' }
      device?.setBedTemp(v)
      return { success: true, output: [`[P3D-001] Bed temperature set to ${v}°C`] }
    }
    if (sub === 'fold') {
      if (!device) return { success: false, error: '[P3D-001] Device not connected' }
      device.setExpanded(false)
      return { success: true, output: ['', '[P3D-001] Device folded to compact view', ''] }
    }
    if (sub === 'unfold') {
      if (!device) return { success: false, error: '[P3D-001] Device not connected' }
      device.setExpanded(true)
      return { success: true, output: ['', '[P3D-001] Device unfolded to full view', ''] }
    }
    if (sub === 'toggle') {
      if (!device) return { success: false, error: '[P3D-001] Device not connected' }
      device.toggleExpanded()
      return { success: true, output: ['', '[P3D-001] Device view toggled', ''] }
    }
    if (sub === 'help') {
      return {
        success: true,
        output: [
          'P3D-001 3D Fabricator',
          '',
          'Usage: p3d <subcommand>',
          '',
          '  status         Show device status',
          '  on/off         Power control',
          '  test           Run diagnostics',
          '  reboot         Restart device',
          '  firmware       Show firmware info',
          '  config         View power specs',
          '  mode [name]    Cycle or set print mode',
          '  progress [val] Get/set print progress (0-100)',
          '  layer [val]    Get/set layer count',
          '  bedtemp [val]  Get/set bed temperature (0-120)',
          '  fold           Fold to compact view',
          '  unfold         Unfold to full view',
          '  toggle         Toggle fold state',
          '  help           Show this help',
        ],
      }
    }

    return { success: false, error: `unknown subcommand: ${sub}. try: p3d help` }
  },
}

// Full system power control (CRT shutdown/boot effects)
const unsystemCommand: Command = {
  name: 'unsystem',
  description: 'Full system shutdown or reboot with power effects',
  usage: 'unsystem <shutdown|reboot> [-now | -XhYmZs | -cancel]',
  execute: async (args, ctx) => {
    const command = args[0]?.toLowerCase()
    const flag = args[1]

    if (!command) {
      return {
        success: false,
        error: 'usage: unsystem <command> [flags]\n\ncommands:\n  shutdown    full system shutdown (CRT power-off)\n  reboot      full system reboot (CRT off + boot sequence)\n  status      system power state\n\nflags:\n  -now       execute immediately\n  -XhYmZs   schedule (e.g. -30m, -1h30m, -90s)\n  -cancel    cancel scheduled action',
      }
    }

    if (command === 'status') {
      if (!ctx.data.systemPower) {
        return { success: true, output: ['', '[unsystem] System power: RUNNING', ''] }
      }
      const state = ctx.data.systemPower.getState()
      const output = [
        '',
        '┌─────────────────────────────────────────────────────────────┐',
        '│                    SYSTEM POWER STATE                       │',
        '└─────────────────────────────────────────────────────────────┘',
        '',
        `  State:     ${state.systemState.toUpperCase()}`,
      ]
      if (state.systemState === 'countdown' && state.countdownSeconds !== null) {
        output.push(`  Action:    ${(state.countdownAction ?? 'unknown').toUpperCase()}`)
        output.push(`  Remaining: ${formatCountdown(state.countdownSeconds)}`)
      }
      output.push('')
      return { success: true, output }
    }

    if (command === 'shutdown') {
      if (!flag) {
        return {
          success: false,
          error: 'usage: unsystem shutdown -now | -XhYmZs | -cancel',
        }
      }

      if (flag === '-cancel' || flag === 'cancel') {
        if (ctx.data.systemPower) {
          const state = ctx.data.systemPower.getState()
          if (state.systemState === 'countdown' && state.countdownAction === 'shutdown') {
            ctx.data.systemPower.cancelCountdown()
            return { success: true, output: ['', '[unsystem] Scheduled shutdown cancelled.', ''] }
          }
          return { success: true, output: ['', '[unsystem] No shutdown scheduled.', ''] }
        }
        return { success: false, error: 'System power control not available.' }
      }

      const parsed = parseTimeArg(flag)
      if (parsed.error) {
        return { success: false, error: `[PWR-${parsed.errorCode}] ${parsed.error}` }
      }

      if (!ctx.data.systemPower) {
        return { success: false, error: 'System power control not available. Are you in the panel?' }
      }

      if (parsed.seconds === 0) {
        ctx.data.saveAllDeviceState?.()
        ctx.data.systemPower.shutdownNow()
        return { success: true, output: ['', '[unsystem] Initiating full system shutdown...', ''] }
      }

      ctx.data.systemPower.scheduleShutdown(parsed.seconds)
      const timeStr = formatCountdown(parsed.seconds)
      const output = ['', `[unsystem] System shutdown scheduled in ${timeStr}.`]
      if (parsed.wasAdjusted) output.push('[unsystem] Warning: time adjusted to minimum 10 seconds.')
      output.push('')
      return { success: true, output }
    }

    if (command === 'reboot') {
      if (!flag) {
        return {
          success: false,
          error: 'usage: unsystem reboot -now | -XhYmZs | -cancel',
        }
      }

      if (flag === '-cancel' || flag === 'cancel') {
        if (ctx.data.systemPower) {
          const state = ctx.data.systemPower.getState()
          if (state.systemState === 'countdown' && state.countdownAction === 'reboot') {
            ctx.data.systemPower.cancelCountdown()
            return { success: true, output: ['', '[unsystem] Scheduled reboot cancelled.', ''] }
          }
          return { success: true, output: ['', '[unsystem] No reboot scheduled.', ''] }
        }
        return { success: false, error: 'System power control not available.' }
      }

      const parsed = parseTimeArg(flag)
      if (parsed.error) {
        return { success: false, error: `[PWR-${parsed.errorCode}] ${parsed.error}` }
      }

      if (!ctx.data.systemPower) {
        return { success: false, error: 'System power control not available. Are you in the panel?' }
      }

      if (parsed.seconds === 0) {
        ctx.data.saveAllDeviceState?.()
        ctx.data.systemPower.rebootNow()
        return { success: true, output: ['', '[unsystem] Initiating full system reboot...', ''] }
      }

      ctx.data.systemPower.scheduleReboot(parsed.seconds)
      const timeStr = formatCountdown(parsed.seconds)
      const output = ['', `[unsystem] System reboot scheduled in ${timeStr}.`]
      if (parsed.wasAdjusted) output.push('[unsystem] Warning: time adjusted to minimum 10 seconds.')
      output.push('')
      return { success: true, output }
    }

    return {
      success: false,
      error: `Unknown command: ${command}\nAvailable: shutdown, reboot, status`,
    }
  },
}

// Standalone shutdown command
const shutdownCommand: Command = {
  name: 'shutdown',
  description: 'Schedule or execute system shutdown',
  usage: 'shutdown -now | -XhYmZs | -cancel',
  execute: async (args, ctx) => {
    const flag = args[0]

    if (!flag) {
      return {
        success: false,
        error: 'usage: shutdown -now | -XhYmZs | -cancel\n\nexamples:\n  shutdown -now        immediate shutdown\n  shutdown -30m        shutdown in 30 minutes\n  shutdown -1h30m      shutdown in 1 hour 30 min\n  shutdown -cancel     cancel scheduled shutdown',
      }
    }

    if (flag === '-cancel' || flag === 'cancel') {
      if (ctx.data.systemPower) {
        const state = ctx.data.systemPower.getState()
        if (state.systemState === 'countdown' && state.countdownAction === 'shutdown') {
          ctx.data.systemPower.cancelCountdown()
          return { success: true, output: ['', '[power] Scheduled shutdown cancelled.', ''] }
        }
        return { success: true, output: ['', '[power] No shutdown scheduled.', ''] }
      }
      return { success: false, error: 'System power control not available.' }
    }

    const parsed = parseTimeArg(flag)
    if (parsed.error) {
      return { success: false, error: `[PWR-${parsed.errorCode}] ${parsed.error}` }
    }

    if (!ctx.data.systemPower) {
      // Fallback for terminal-only (no panel)
      ctx.data.saveAllDeviceState?.()
      return {
        success: true,
        output: ['', '[power] Shutdown initiated. Returning to terminal...', ''],
        navigate: '/terminal',
        clearPanelAccess: true,
      }
    }

    if (parsed.seconds === 0) {
      ctx.data.saveAllDeviceState?.()
      ctx.data.systemPower.shutdownNow()
      return { success: true, output: ['', '[power] Initiating system shutdown...', ''] }
    }

    ctx.data.systemPower.scheduleShutdown(parsed.seconds)
    const timeStr = formatCountdown(parsed.seconds)
    const output = ['', `[power] Shutdown scheduled in ${timeStr}.`]
    if (parsed.wasAdjusted) output.push('[power] Warning: time adjusted to minimum 10 seconds.')
    output.push('')
    return { success: true, output }
  },
}

// Standalone reboot command
const rebootCommand: Command = {
  name: 'reboot',
  description: 'Schedule or execute system reboot',
  usage: 'reboot -now | -XhYmZs | -cancel',
  execute: async (args, ctx) => {
    const flag = args[0]

    if (!flag) {
      return {
        success: false,
        error: 'usage: reboot -now | -XhYmZs | -cancel\n\nexamples:\n  reboot -now          immediate reboot\n  reboot -30s          reboot in 30 seconds\n  reboot -2h           reboot in 2 hours\n  reboot -cancel       cancel scheduled reboot',
      }
    }

    if (flag === '-cancel' || flag === 'cancel') {
      if (ctx.data.systemPower) {
        const state = ctx.data.systemPower.getState()
        if (state.systemState === 'countdown' && state.countdownAction === 'reboot') {
          ctx.data.systemPower.cancelCountdown()
          return { success: true, output: ['', '[power] Scheduled reboot cancelled.', ''] }
        }
        return { success: true, output: ['', '[power] No reboot scheduled.', ''] }
      }
      return { success: false, error: 'System power control not available.' }
    }

    const parsed = parseTimeArg(flag)
    if (parsed.error) {
      return { success: false, error: `[PWR-${parsed.errorCode}] ${parsed.error}` }
    }

    if (!ctx.data.systemPower) {
      // Fallback
      ctx.data.saveAllDeviceState?.()
      return { success: true, output: ['', '[power] Reboot initiated...', ''], refresh: true }
    }

    if (parsed.seconds === 0) {
      ctx.data.saveAllDeviceState?.()
      ctx.data.systemPower.rebootNow()
      return { success: true, output: ['', '[power] Initiating system reboot...', ''] }
    }

    ctx.data.systemPower.scheduleReboot(parsed.seconds)
    const timeStr = formatCountdown(parsed.seconds)
    const output = ['', `[power] Reboot scheduled in ${timeStr}.`]
    if (parsed.wasAdjusted) output.push('[power] Warning: time adjusted to minimum 10 seconds.')
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
  lsCommand,
  cdCommand,
  pwdCommand,
  catCommand,
  mkdirCommand,
  touchCommand,
  rmCommand,
  treeCommand,
  chmodCommand,
  idCommand,
  suCommand,
  sudoCommand,
  passwdCommand,
  useraddCommand,
  groupsCommand,
  echoCommand,
  aboutCommand,
  historyCommand,
  unhistoryCommand,
  runCommand,
  killCommand,
  unsystemctlCommand,
  deviceCommand,
  thermalCommand,
  powerCommand,
  cdcCommand,
  uecCommand,
  batCommand,
  hmsCommand,
  ecrCommand,
  iplCommand,
  mfrCommand,
  aicCommand,
  emcCommand,
  quaCommand,
  qsmCommand,
  vntCommand,
  scaCommand,
  exdCommand,
  btkCommand,
  pwbCommand,
  rmgCommand,
  mscCommand,
  dimCommand,
  clkCommand,
  cpuCommand,
  memCommand,
  andCommand,
  qcpCommand,
  netCommand,
  tmpCommand,
  tlpCommand,
  lctCommand,
  p3dCommand,
  themeCommand,
  screwstatCommand,
  nodesyncCommand,
  poollinkCommand,
  meshcastCommand,
  qbridgeCommand,
  cpCommand,
  mvCommand,
  lnCommand,
  chownCommand,
  headCommand,
  tailCommand,
  userdelCommand,
  usermodCommand,
  unaptCommand,
  unpodCommand,
  unnetCommand,
  exitCommand,
  ungitCommand,
  unmcCommand,
  unmceditCommand,
  unsystemCommand,
  shutdownCommand,
  rebootCommand,
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
    '|       UNSTABLE LABORATORIES TERMINAL v2.0.0                |',
    '|       _unOS Quantum Research Interface                    |',
    '+------------------------------------------------------------+',
    '',
    `> OPERATOR ${username || 'UNKNOWN'} authenticated.`,
    '> System initialized. All subsystems operational.',
    '> Type HELP for available commands.',
    '',
  ]
}
