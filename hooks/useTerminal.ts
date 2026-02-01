'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { TerminalLine, TerminalState, CommandContext, DataFetchers, CDCDeviceActions, UECDeviceActions, BATDeviceActions, HMSDeviceActions, ECRDeviceActions, IPLDeviceActions, MFRDeviceActions, AICDeviceActions, VNTDeviceActions, SCADeviceActions, EXDDeviceActions, QSMDeviceActions, EMCDeviceActions, QUADeviceActions, PWBDeviceActions, BTKDeviceActions, RMGDeviceActions, MSCDeviceActions, NETDeviceActions, TMPDeviceActions, DIMDeviceActions, CPUDeviceActions, CLKDeviceActions, MEMDeviceActions, ANDDeviceActions, QCPDeviceActions, TLPDeviceActions, LCTDeviceActions, P3DDeviceActions, SPKDeviceActions, DGNDeviceActions, ScrewButtonDeviceActions, FilesystemActions, UserActions, ThemeActions } from '@/lib/terminal/types'
import { executeCommand, getWelcomeMessage } from '@/lib/terminal/commands'
import { savePanelState } from '@/lib/panel/panelState'
import type { PanelSaveData } from '@/lib/panel/panelState'
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
  cdcDeviceActions?: CDCDeviceActions
  uecDeviceActions?: UECDeviceActions
  batDeviceActions?: BATDeviceActions
  hmsDeviceActions?: HMSDeviceActions
  ecrDeviceActions?: ECRDeviceActions
  iplDeviceActions?: IPLDeviceActions
  mfrDeviceActions?: MFRDeviceActions
  aicDeviceActions?: AICDeviceActions
  vntDeviceActions?: VNTDeviceActions
  scaDeviceActions?: SCADeviceActions
  exdDeviceActions?: EXDDeviceActions
  qsmDeviceActions?: QSMDeviceActions
  emcDeviceActions?: EMCDeviceActions
  quaDeviceActions?: QUADeviceActions
  pwbDeviceActions?: PWBDeviceActions
  btkDeviceActions?: BTKDeviceActions
  rmgDeviceActions?: RMGDeviceActions
  mscDeviceActions?: MSCDeviceActions
  netDeviceActions?: NETDeviceActions
  tmpDeviceActions?: TMPDeviceActions
  dimDeviceActions?: DIMDeviceActions
  cpuDeviceActions?: CPUDeviceActions
  clkDeviceActions?: CLKDeviceActions
  memDeviceActions?: MEMDeviceActions
  andDeviceActions?: ANDDeviceActions
  qcpDeviceActions?: QCPDeviceActions
  tlpDeviceActions?: TLPDeviceActions
  lctDeviceActions?: LCTDeviceActions
  p3dDeviceActions?: P3DDeviceActions
  spkDeviceActions?: SPKDeviceActions
  dgnDeviceActions?: DGNDeviceActions
  screwButtonDeviceActions?: ScrewButtonDeviceActions
  resourceManagerActions?: import('@/contexts/ResourceManager').ResourceManagerActions
  filesystemActions?: FilesystemActions
  userActions?: UserActions
  themeActions?: ThemeActions
  systemPowerActions?: {
    scheduleShutdown: (seconds: number, scope?: 'os' | 'system') => void
    scheduleReboot: (seconds: number, scope?: 'os' | 'system') => void
    shutdownNow: (scope?: 'os' | 'system') => void
    rebootNow: (scope?: 'os' | 'system') => void
    cancelCountdown: () => void
    getState: () => { systemState: string; countdownSeconds: number | null; countdownAction: string | null; powerScope: string | null }
  }
}

export function useTerminal({ userId, username, balance, cdcDeviceActions, uecDeviceActions, batDeviceActions, hmsDeviceActions, ecrDeviceActions, iplDeviceActions, mfrDeviceActions, aicDeviceActions, vntDeviceActions, scaDeviceActions, exdDeviceActions, qsmDeviceActions, emcDeviceActions, quaDeviceActions, pwbDeviceActions, btkDeviceActions, rmgDeviceActions, mscDeviceActions, netDeviceActions, tmpDeviceActions, dimDeviceActions, cpuDeviceActions, clkDeviceActions, memDeviceActions, andDeviceActions, qcpDeviceActions, tlpDeviceActions, lctDeviceActions, p3dDeviceActions, spkDeviceActions, dgnDeviceActions, screwButtonDeviceActions, resourceManagerActions, filesystemActions, userActions, themeActions, systemPowerActions }: UseTerminalProps) {
  const router = useRouter()
  const [state, setState] = useState<TerminalState>(() => {
    let savedHistory: string[] = []
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('unlabs_cmd_history') : null
      if (raw) savedHistory = JSON.parse(raw)
    } catch { /* ignore */ }
    return {
      lines: [],
      history: savedHistory,
      historyIndex: -1,
      isTyping: false,
    }
  })

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

  const addLines = useCallback(
    (entries: { content: string; type: TerminalLine['type'] }[]) => {
      const now = new Date()
      const newLines: TerminalLine[] = entries.map((e) => ({
        id: generateId(),
        type: e.type,
        content: e.content,
        timestamp: now,
      }))
      setState((prev) => ({
        ...prev,
        lines: [...prev.lines, ...newLines],
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

  // Password input mode for su/sudo
  const [passwordMode, setPasswordMode] = useState(false)
  const pendingPasswordAction = useRef<{ command: 'su'; target: string } | null>(null)

  // Prompt refresh trigger — incremented after commands that change user/cwd
  const [promptTick, setPromptTick] = useState(0)

  // App mode — when set, an interactive app takes over the terminal UI
  const [appMode, setAppMode] = useState<string | null>(null)
  const [appModeData, setAppModeData] = useState<Record<string, string> | null>(null)

  // Save all device state to localStorage
  const saveAllDeviceState = useCallback(() => {
    const cdcState = cdcDeviceActions?.getState()
    const uecState = uecDeviceActions?.getState()
    const batState = batDeviceActions?.getState()
    const hmsState = hmsDeviceActions?.getState()
    const ecrState = ecrDeviceActions?.getState()
    const iplState = iplDeviceActions?.getState()
    const mfrState = mfrDeviceActions?.getState()
    const aicState = aicDeviceActions?.getState()
    const vntState = vntDeviceActions?.getState()
    const scaState = scaDeviceActions?.getState()
    const exdState = exdDeviceActions?.getState()
    const qsmState = qsmDeviceActions?.getState()
    const emcState = emcDeviceActions?.getState()
    const quaState = quaDeviceActions?.getState()
    const pwbState = pwbDeviceActions?.getState()
    const btkState = btkDeviceActions?.getState()
    const rmgState = rmgDeviceActions?.getState()
    const mscState = mscDeviceActions?.getState()
    const netState = netDeviceActions?.getState()
    const tmpState = tmpDeviceActions?.getState()
    const dimState = dimDeviceActions?.getState()
    const cpuState = cpuDeviceActions?.getState()
    const clkState = clkDeviceActions?.getState()
    const screwStates = screwButtonDeviceActions?.getAllStates()

    const data: PanelSaveData = {
      version: 1,
      timestamp: Date.now(),
      filesystem: filesystemActions?.toJSON(),
      users: userActions?.toJSON(),
      resources: resourceManagerActions?.toSaveData(),
      devices: {
        cdc: { isPowered: cdcState?.isPowered ?? true, isExpanded: cdcState?.isExpanded ?? true },
        uec: { isPowered: uecState?.isPowered ?? true, isExpanded: uecState?.isExpanded ?? true },
        bat: {
          isPowered: batState?.isPowered ?? true,
          currentCharge: batState?.currentCharge ?? 5000,
          autoRegen: batState?.autoRegen ?? true,
          isExpanded: batState?.isExpanded ?? true,
        },
        hms: {
          isPowered: hmsState?.isPowered ?? true,
          pulseValue: hmsState?.pulseValue ?? 35,
          tempoValue: hmsState?.tempoValue ?? 40,
          freqValue: hmsState?.freqValue ?? 37,
          waveformType: hmsState?.waveformType ?? 'sine',
          isExpanded: hmsState?.isExpanded ?? true,
        },
        ecr: {
          isPowered: ecrState?.isPowered ?? true,
          pulseValue: ecrState?.pulseValue ?? 40,
          bloomValue: ecrState?.bloomValue ?? 60,
          isRecording: ecrState?.isRecording ?? false,
          isExpanded: ecrState?.isExpanded ?? true,
        },
        ipl: { isPowered: iplState?.isPowered ?? true, isExpanded: iplState?.isExpanded ?? true },
        mfr: { isPowered: mfrState?.isPowered ?? true, isExpanded: mfrState?.isExpanded ?? true },
        aic: {
          isPowered: aicState?.isPowered ?? true,
          isLearning: aicState?.isLearning ?? true,
          isExpanded: aicState?.isExpanded ?? true,
        },
        vnt: {
          isPowered: vntState?.isPowered ?? true,
          cpuFanSpeed: vntState?.cpuFan?.speed ?? 65,
          gpuFanSpeed: vntState?.gpuFan?.speed ?? 65,
          fanMode: vntState?.cpuFan?.mode ?? 'AUTO',
          isExpanded: vntState?.isExpanded ?? true,
        },
        sca: { isPowered: scaState?.isPowered ?? true, isExpanded: scaState?.isExpanded ?? true },
        exd: { isPowered: exdState?.isPowered ?? true, isDeployed: exdState?.isDeployed ?? true, isExpanded: exdState?.isExpanded ?? true },
        qsm: { isPowered: qsmState?.isPowered ?? true, isExpanded: qsmState?.isExpanded ?? true },
        emc: { isPowered: emcState?.isPowered ?? true, isExpanded: emcState?.isExpanded ?? true },
        qua: {
          isPowered: quaState?.isPowered ?? true,
          mode: quaState?.mode ?? 'ANOMALY',
          sensitivity: quaState?.sensitivity ?? 65,
          depth: quaState?.depth ?? 50,
          frequency: quaState?.frequency ?? 40,
          isExpanded: quaState?.isExpanded ?? true,
        },
        pwb: { isPowered: pwbState?.isPowered ?? true, isExpanded: pwbState?.isExpanded ?? true },
        btk: { isPowered: btkState?.isPowered ?? true, isExpanded: btkState?.isExpanded ?? true },
        rmg: { isPowered: rmgState?.isPowered ?? true, strength: rmgState?.strength ?? 45, isExpanded: rmgState?.isExpanded ?? true },
        msc: { isPowered: mscState?.isPowered ?? true, isExpanded: mscState?.isExpanded ?? true },
        net: {
          isPowered: netState?.isPowered ?? true,
          bandwidth: netState?.bandwidth ?? 2.4,
          latencyMs: netState?.latencyMs ?? 12,
          isExpanded: netState?.isExpanded ?? true,
        },
        tmp: {
          isPowered: tmpState?.isPowered ?? true,
          temperature: tmpState?.temperature ?? 28.4,
          isExpanded: tmpState?.isExpanded ?? true,
        },
        dim: {
          isPowered: dimState?.isPowered ?? true,
          dimension: dimState?.dimension ?? 3.14,
          stability: dimState?.stability ?? 98,
          isExpanded: dimState?.isExpanded ?? true,
        },
        cpu: {
          isPowered: cpuState?.isPowered ?? true,
          cores: cpuState?.cores ?? 8,
          utilization: cpuState?.utilization ?? 67,
          frequency: cpuState?.frequency ?? 4.2,
          isExpanded: cpuState?.isExpanded ?? true,
        },
        clk: {
          isPowered: clkState?.isPowered ?? true,
          displayMode: clkState?.displayMode ?? 'local',
          isExpanded: clkState?.isExpanded ?? true,
        },
        mem: {
          isPowered: memDeviceActions?.getState().isPowered ?? true,
          totalMemory: memDeviceActions?.getState().totalMemory ?? 16,
          usedMemory: memDeviceActions?.getState().usedMemory ?? 11.5,
          displayMode: memDeviceActions?.getState().displayMode ?? 'usage',
          isExpanded: memDeviceActions?.getState().isExpanded ?? true,
        },
        and: {
          isPowered: andDeviceActions?.getState().isPowered ?? true,
          signalStrength: andDeviceActions?.getState().signalStrength ?? 67,
          anomaliesFound: andDeviceActions?.getState().anomaliesFound ?? 3,
          displayMode: andDeviceActions?.getState().displayMode ?? 'waveform',
          isExpanded: andDeviceActions?.getState().isExpanded ?? true,
        },
        qcp: {
          isPowered: qcpDeviceActions?.getState().isPowered ?? true,
          anomalyDirection: qcpDeviceActions?.getState().anomalyDirection ?? 127,
          anomalyDistance: qcpDeviceActions?.getState().anomalyDistance ?? 42,
          displayMode: qcpDeviceActions?.getState().displayMode ?? 'compass',
          isExpanded: qcpDeviceActions?.getState().isExpanded ?? true,
        },
        tlp: {
          isPowered: tlpDeviceActions?.getState().isPowered ?? true,
          chargeLevel: tlpDeviceActions?.getState().chargeLevel ?? 65,
          lastDestination: tlpDeviceActions?.getState().lastDestination ?? 'LAB-Ω',
          displayMode: tlpDeviceActions?.getState().displayMode ?? 'standard',
          isExpanded: tlpDeviceActions?.getState().isExpanded ?? true,
        },
        lct: {
          isPowered: lctDeviceActions?.getState().isPowered ?? true,
          laserPower: lctDeviceActions?.getState().laserPower ?? 450,
          precision: lctDeviceActions?.getState().precision ?? 0.01,
          displayMode: lctDeviceActions?.getState().displayMode ?? 'cutting',
          isExpanded: lctDeviceActions?.getState().isExpanded ?? true,
        },
        p3d: {
          isPowered: p3dDeviceActions?.getState().isPowered ?? true,
          progress: p3dDeviceActions?.getState().progress ?? 67,
          layerCount: p3dDeviceActions?.getState().layerCount ?? 234,
          bedTemp: p3dDeviceActions?.getState().bedTemp ?? 60,
          displayMode: p3dDeviceActions?.getState().displayMode ?? 'plastic',
          isExpanded: p3dDeviceActions?.getState().isExpanded ?? true,
        },
        spk: {
          isPowered: spkDeviceActions?.getState().isPowered ?? true,
          volume: spkDeviceActions?.getState().volume ?? 45,
          isMuted: spkDeviceActions?.getState().isMuted ?? false,
          filters: spkDeviceActions?.getState().filters ?? { bass: false, mid: true, high: false },
          isExpanded: spkDeviceActions?.getState().isExpanded ?? true,
        },
        dgn: {
          isPowered: dgnDeviceActions?.getState().isPowered ?? true,
          category: dgnDeviceActions?.getState().category ?? 'SYSTEMS',
          scanDepth: dgnDeviceActions?.getState().scanDepth ?? 75,
          isExpanded: dgnDeviceActions?.getState().isExpanded ?? true,
        },
        screwButtons: screwStates ? Object.fromEntries(
          Object.entries(screwStates).map(([k, v]) => [k, { unlocked: v.unlocked, active: v.active, totalActiveTime: v.totalActiveTime }])
        ) : undefined,
      },
    }

    savePanelState(data)
  }, [cdcDeviceActions, uecDeviceActions, batDeviceActions, hmsDeviceActions, ecrDeviceActions, iplDeviceActions, mfrDeviceActions, aicDeviceActions, vntDeviceActions, scaDeviceActions, qsmDeviceActions, emcDeviceActions, quaDeviceActions, pwbDeviceActions, btkDeviceActions, rmgDeviceActions, mscDeviceActions, netDeviceActions, tmpDeviceActions, dimDeviceActions, cpuDeviceActions, clkDeviceActions, memDeviceActions, andDeviceActions, qcpDeviceActions, tlpDeviceActions, lctDeviceActions, p3dDeviceActions, spkDeviceActions, screwButtonDeviceActions])

  // Data fetchers for commands - memoized for stability
  const dataFetchers: DataFetchers = useMemo(() => ({
    fetchBalance,
    fetchCrystals,
    fetchResearchProgress,
    fetchCommandHistory,
    fetchVolatility,
    logCommand,
    mintCrystal,
    fetchCrystalByName,
    renameCrystal,
    // Panel state save
    saveAllDeviceState,
    // Device actions for bidirectional sync
    cdcDevice: cdcDeviceActions,
    uecDevice: uecDeviceActions,
    batDevice: batDeviceActions,
    hmsDevice: hmsDeviceActions,
    ecrDevice: ecrDeviceActions,
    iplDevice: iplDeviceActions,
    mfrDevice: mfrDeviceActions,
    aicDevice: aicDeviceActions,
    vntDevice: vntDeviceActions,
    scaDevice: scaDeviceActions,
    exdDevice: exdDeviceActions,
    qsmDevice: qsmDeviceActions,
    emcDevice: emcDeviceActions,
    quaDevice: quaDeviceActions,
    pwbDevice: pwbDeviceActions,
    btkDevice: btkDeviceActions,
    rmgDevice: rmgDeviceActions,
    mscDevice: mscDeviceActions,
    netDevice: netDeviceActions,
    tmpDevice: tmpDeviceActions,
    dimDevice: dimDeviceActions,
    cpuDevice: cpuDeviceActions,
    clkDevice: clkDeviceActions,
    memDevice: memDeviceActions,
    andDevice: andDeviceActions,
    qcpDevice: qcpDeviceActions,
    tlpDevice: tlpDeviceActions,
    lctDevice: lctDeviceActions,
    p3dDevice: p3dDeviceActions,
    spkDevice: spkDeviceActions,
    dgnDevice: dgnDeviceActions,
    screwButtons: screwButtonDeviceActions,
    resourceManager: resourceManagerActions,
    filesystemActions,
    userActions,
    themeActions,
    systemPower: systemPowerActions,
  }), [cdcDeviceActions, uecDeviceActions, batDeviceActions, hmsDeviceActions, ecrDeviceActions, iplDeviceActions, mfrDeviceActions, aicDeviceActions, vntDeviceActions, scaDeviceActions, exdDeviceActions, qsmDeviceActions, emcDeviceActions, quaDeviceActions, pwbDeviceActions, btkDeviceActions, rmgDeviceActions, mscDeviceActions, netDeviceActions, tmpDeviceActions, dimDeviceActions, cpuDeviceActions, clkDeviceActions, andDeviceActions, qcpDeviceActions, tlpDeviceActions, lctDeviceActions, p3dDeviceActions, spkDeviceActions, dgnDeviceActions, screwButtonDeviceActions, resourceManagerActions, saveAllDeviceState, filesystemActions, userActions, themeActions, systemPowerActions])

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
      // Handle password mode - input is the password for a pending su command
      if (passwordMode && pendingPasswordAction.current) {
        const action = pendingPasswordAction.current
        pendingPasswordAction.current = null
        setPasswordMode(false)

        // Show masked password line
        addLine(`Password: ${'*'.repeat(input.length)}`, 'input')

        if (action.command === 'su') {
          const result = userActions?.su(action.target, input)
          if (result?.success) {
            addLine(`[su] ${result.message}`, 'output')
            setPromptTick(t => t + 1)
          } else {
            addLine(result?.message ?? 'su: Authentication failure', 'error')
          }
        }
        return
      }

      // Add input line with prompt
      const currentPrompt = userActions?.whoami() ? (() => {
        const user = userActions.whoami()
        const cwd = filesystemActions?.getCwd() ?? '~'
        const home = userActions.getCurrentUser()?.home ?? '/unhome/operator'
        const displayCwd = cwd === home ? '~' : cwd.startsWith(home + '/') ? '~' + cwd.slice(home.length) : cwd
        const suffix = user === 'root' ? '#' : '$'
        return `${user}@_unLAB:${displayCwd}${suffix}`
      })() : '>'
      addLine(`${currentPrompt} ${input}`, 'input')

      // Add to history (persisted to localStorage)
      setState((prev) => {
        const newHistory = [input, ...prev.history.filter((h) => h !== input)].slice(0, 200)
        try { localStorage.setItem('unlabs_cmd_history', JSON.stringify(newHistory)) } catch { /* ignore */ }
        return { ...prev, history: newHistory, historyIndex: -1 }
      })

      // Intercept su commands to use password mode instead of cleartext args
      const parts = input.trim().split(/\s+/)
      const cmd = parts[0]?.toLowerCase()
      if ((cmd === 'su' || cmd === 'unsu') && parts[1] && parts[1] !== 'root' && !parts[2]) {
        // Check if current user is root (no password needed)
        if (!userActions?.isRoot()) {
          pendingPasswordAction.current = { command: 'su', target: parts[1] }
          setPasswordMode(true)
          return
        }
      }

      // Create command context
      const context: CommandContext = {
        userId,
        username,
        balance,
        addOutput,
        clearScreen,
        setTyping,
        data: dataFetchers,
        sessionHistory: state.history,
      }

      // Execute command
      const result = await executeCommand(input, context)

      // Output results
      if (result.error) {
        addLine(result.error, 'error')
      } else if (result.output) {
        addLines(result.output.map((line) => ({ content: line, type: 'output' as const })))
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

      // Handle page refresh if specified (e.g., for reboot commands)
      if (result.refresh) {
        setTimeout(() => {
          window.location.reload()
        }, 1500) // Delay to let user see the output
      }

      // Handle app mode launch (e.g. Midnight Commander)
      if (result.appMode) {
        setAppMode(result.appMode)
        setAppModeData(result.appModeData ?? null)
      }

      // Refresh prompt after any command (user/cwd may have changed)
      setPromptTick(t => t + 1)
    },
    [userId, username, balance, addLine, addLines, addOutput, clearScreen, setTyping, dataFetchers, router, passwordMode, userActions, filesystemActions]
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

  const prompt = useMemo(() => {
    const user = userActions?.whoami() ?? username ?? 'operator'
    const cwd = filesystemActions?.getCwd() ?? '~'
    const home = userActions?.getCurrentUser()?.home ?? '/unhome/operator'
    const displayCwd = cwd === home ? '~' : cwd.startsWith(home + '/') ? '~' + cwd.slice(home.length) : cwd
    const suffix = user === 'root' ? '#' : '$'
    return `${user}@_unLAB:${displayCwd}${suffix}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userActions, filesystemActions, username, promptTick])

  const exitAppMode = useCallback(() => {
    setAppMode(null)
    setAppModeData(null)
  }, [])

  return {
    lines: state.lines,
    history: state.history,
    isTyping: state.isTyping,
    processCommand,
    navigateHistory,
    clearScreen,
    addOutput,
    prompt,
    passwordMode,
    appMode,
    appModeData,
    exitAppMode,
  }
}
