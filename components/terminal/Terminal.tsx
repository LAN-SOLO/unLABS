'use client'

import { useCallback, useMemo, useRef } from 'react'
import { VirtualFS, UserManager } from '@/lib/unos'
import { commands } from '@/lib/terminal/commands'
import { loadPanelState } from '@/lib/panel/panelState'
import type { FilesystemActions, UserActions } from '@/lib/terminal/types'
import { useTerminal } from '@/hooks/useTerminal'
import { TerminalOutput } from './TerminalOutput'
import { TerminalInput } from './TerminalInput'
import { useCDCManagerOptional } from '@/contexts/CDCManager'
import { useUECManagerOptional } from '@/contexts/UECManager'
import { useBATManagerOptional } from '@/contexts/BATManager'
import { useHMSManagerOptional } from '@/contexts/HMSManager'
import { useECRManagerOptional } from '@/contexts/ECRManager'
import { useIPLManagerOptional } from '@/contexts/IPLManager'
import { useMFRManagerOptional } from '@/contexts/MFRManager'
import { useAICManagerOptional } from '@/contexts/AICManager'
import { useVNTManagerOptional } from '@/contexts/VNTManager'
import { useSCAManagerOptional } from '@/contexts/SCAManager'
import { useEXDManagerOptional } from '@/contexts/EXDManager'
import { useQSMManagerOptional } from '@/contexts/QSMManager'
import { useEMCManagerOptional } from '@/contexts/EMCManager'
import { useQUAManagerOptional } from '@/contexts/QUAManager'
import { usePWBManagerOptional } from '@/contexts/PWBManager'
import { useBTKManagerOptional } from '@/contexts/BTKManager'
import { useRMGManagerOptional } from '@/contexts/RMGManager'
import { useMSCManagerOptional } from '@/contexts/MSCManager'
import { useScrewButtonManagerOptional } from '@/contexts/ScrewButtonManager'
import type { CDCDeviceActions, UECDeviceActions, BATDeviceActions, HMSDeviceActions, ECRDeviceActions, IPLDeviceActions, MFRDeviceActions, AICDeviceActions, VNTDeviceActions, SCADeviceActions, EXDDeviceActions, QSMDeviceActions, EMCDeviceActions, QUADeviceActions, PWBDeviceActions, BTKDeviceActions, RMGDeviceActions, MSCDeviceActions, ScrewButtonDeviceActions, ThemeActions } from '@/lib/terminal/types'

interface TerminalProps {
  userId: string
  username: string | null
  balance: number
  themeIndex?: number
  setThemeIndex?: (index: number) => void
  themes?: readonly { name: string; fg: string; glow: string; screen: string; bar: string }[]
}

export function Terminal({ userId, username, balance, themeIndex, setThemeIndex, themes }: TerminalProps) {
  const cdcManager = useCDCManagerOptional()
  const uecManager = useUECManagerOptional()
  const batManager = useBATManagerOptional()
  const hmsManager = useHMSManagerOptional()
  const ecrManager = useECRManagerOptional()
  const iplManager = useIPLManagerOptional()
  const mfrManager = useMFRManagerOptional()
  const aicManager = useAICManagerOptional()
  const vntManager = useVNTManagerOptional()
  const scaManager = useSCAManagerOptional()
  const exdManager = useEXDManagerOptional()
  const qsmManager = useQSMManagerOptional()
  const emcManager = useEMCManagerOptional()
  const quaManager = useQUAManagerOptional()
  const pwbManager = usePWBManagerOptional()
  const btkManager = useBTKManagerOptional()
  const rmgManager = useRMGManagerOptional()
  const mscManager = useMSCManagerOptional()
  const screwButtonManager = useScrewButtonManagerOptional()

  // Initialize VirtualFS and UserManager (persisted via refs, restored from localStorage)
  const fsRef = useRef<VirtualFS | null>(null)
  const userMgrRef = useRef<UserManager | null>(null)

  if (!fsRef.current) {
    const saved = loadPanelState()
    fsRef.current = saved?.filesystem ? VirtualFS.fromJSON(saved.filesystem) : new VirtualFS()
  }
  if (!userMgrRef.current) {
    const saved = loadPanelState()
    userMgrRef.current = saved?.users ? UserManager.fromJSON(saved.users) : new UserManager()
  }

  const syncFsHomeUser = useCallback(() => {
    if (fsRef.current && userMgrRef.current) {
      const username = userMgrRef.current.currentUsername
      const home = userMgrRef.current.currentUser.home
      fsRef.current.setHomeUser(username)
      // Ensure home dir exists
      fsRef.current.mkdir(home, true)
      // cd to new user's home
      fsRef.current.cd(home)
    }
  }, [])

  // Build filesystem actions (stable ref)
  const filesystemActions: FilesystemActions = useMemo(() => ({
    getCwd: () => fsRef.current!.cwd,
    ls: (path, flags) => fsRef.current!.ls(path, flags),
    cd: (path) => {
      const err = fsRef.current!.cd(path)
      return err
    },
    cat: (path, user, groups) => {
      const node = fsRef.current!.stat(path)
      if (!node) return null
      // Permission check for reading
      if (!fsRef.current!.checkPermission(node, user, groups, 'r')) {
        return `cat: ${path}: Permission denied`
      }
      return fsRef.current!.cat(path)
    },
    mkdir: (path, parents) => fsRef.current!.mkdir(path, parents),
    touch: (path) => fsRef.current!.touch(path),
    rm: (path, recursive) => fsRef.current!.rm(path, recursive),
    tree: (path, depth) => fsRef.current!.tree(path, depth),
    stat: (path) => {
      const node = fsRef.current!.stat(path)
      if (!node) return null
      return { permissions: node.permissions, owner: node.owner, group: node.group, size: node.size, modified: node.modified, type: node.type }
    },
    chmod: (path, mode) => fsRef.current!.chmod(path, mode),
    chown: (path, owner, group) => fsRef.current!.chown(path, owner, group),
    cp: (src, dest, recursive) => fsRef.current!.cp(src, dest, recursive),
    mv: (src, dest) => fsRef.current!.mv(src, dest),
    ln: (target, linkName, symbolic) => fsRef.current!.ln(target, linkName, symbolic),
    head: (path, lines) => fsRef.current!.head(path, lines),
    tail: (path, lines) => fsRef.current!.tail(path, lines),
    write: (path, content) => fsRef.current!.write(path, content),
    pwd: () => fsRef.current!.pwd(),
    resolve: (path) => fsRef.current!.resolve(path) !== null,
    formatPermissions: (path) => {
      const node = fsRef.current!.stat(path)
      if (!node) return null
      return fsRef.current!.formatPermissions(node)
    },
    toJSON: () => fsRef.current!.toJSON(),
  }), [])

  // Build user actions (stable ref)
  const userActions: UserActions = useMemo(() => ({
    whoami: () => userMgrRef.current!.whoami(),
    id: (username) => userMgrRef.current!.id(username),
    su: (target, password) => {
      const result = userMgrRef.current!.su(target, password)
      if (result.success) syncFsHomeUser()
      return result
    },
    sudo: (callback) => {
      if (!userMgrRef.current!.canSudo()) return false
      callback()
      return true
    },
    canSudo: () => userMgrRef.current!.canSudo(),
    isRoot: () => userMgrRef.current!.isRoot(),
    passwd: (user, newPass) => userMgrRef.current!.passwd(user, newPass),
    useradd: (name, opts) => userMgrRef.current!.useradd(name, opts),
    userdel: (name) => userMgrRef.current!.userdel(name),
    usermod: (name, opts) => userMgrRef.current!.usermod(name, opts),
    groups: (user) => userMgrRef.current!.groups(user),
    getCurrentUser: () => {
      const u = userMgrRef.current!.currentUser
      return { uid: u.uid, username: u.username, groups: u.groups, home: u.home, isRoot: u.isRoot }
    },
    verifyPassword: (username, password) => userMgrRef.current!.verifyPassword(username, password),
    toJSON: () => userMgrRef.current!.toJSON(),
  }), [syncFsHomeUser])

  // Use refs to always access the latest context values
  const cdcManagerRef = useRef(cdcManager)
  cdcManagerRef.current = cdcManager

  const uecManagerRef = useRef(uecManager)
  uecManagerRef.current = uecManager

  const batManagerRef = useRef(batManager)
  batManagerRef.current = batManager

  const hmsManagerRef = useRef(hmsManager)
  hmsManagerRef.current = hmsManager

  const ecrManagerRef = useRef(ecrManager)
  ecrManagerRef.current = ecrManager

  const iplManagerRef = useRef(iplManager)
  iplManagerRef.current = iplManager

  const mfrManagerRef = useRef(mfrManager)
  mfrManagerRef.current = mfrManager

  const aicManagerRef = useRef(aicManager)
  aicManagerRef.current = aicManager

  const vntManagerRef = useRef(vntManager)
  vntManagerRef.current = vntManager

  const scaManagerRef = useRef(scaManager)
  scaManagerRef.current = scaManager

  const exdManagerRef = useRef(exdManager)
  exdManagerRef.current = exdManager

  const qsmManagerRef = useRef(qsmManager)
  qsmManagerRef.current = qsmManager

  const emcManagerRef = useRef(emcManager)
  emcManagerRef.current = emcManager

  const quaManagerRef = useRef(quaManager)
  quaManagerRef.current = quaManager

  const pwbManagerRef = useRef(pwbManager)
  pwbManagerRef.current = pwbManager

  const btkManagerRef = useRef(btkManager)
  btkManagerRef.current = btkManager

  const rmgManagerRef = useRef(rmgManager)
  rmgManagerRef.current = rmgManager

  const mscManagerRef = useRef(mscManager)
  mscManagerRef.current = mscManager

  const screwButtonManagerRef = useRef(screwButtonManager)
  screwButtonManagerRef.current = screwButtonManager

  // Build screw button device actions
  const screwButtonDeviceActions: ScrewButtonDeviceActions | undefined = useMemo(() => {
    if (!screwButtonManager) return undefined
    return {
      activate: (id) => screwButtonManagerRef.current?.activate(id) ?? Promise.resolve(false),
      deactivate: (id) => screwButtonManagerRef.current?.deactivate(id) ?? Promise.resolve(false),
      isUnlocked: (id) => screwButtonManagerRef.current?.isUnlocked(id) ?? false,
      isActive: (id) => screwButtonManagerRef.current?.isActive(id) ?? false,
      getState: (id) => screwButtonManagerRef.current?.getState(id) ?? { unlocked: false, active: false, unlockedAt: null, activatedAt: null, totalActiveTime: 0 },
      getAllStates: () => screwButtonManagerRef.current?.getAllStates() ?? { 'SB-01': { unlocked: false, active: false, unlockedAt: null, activatedAt: null, totalActiveTime: 0 }, 'SB-02': { unlocked: false, active: false, unlockedAt: null, activatedAt: null, totalActiveTime: 0 }, 'SB-03': { unlocked: false, active: false, unlockedAt: null, activatedAt: null, totalActiveTime: 0 }, 'SB-04': { unlocked: false, active: false, unlockedAt: null, activatedAt: null, totalActiveTime: 0 } },
      getNodeSyncStats: () => screwButtonManagerRef.current?.getNodeSyncStats() ?? { connectedNodes: 0, totalNodes: 0, syncRate: '0', hashRate: '0', latency: '0', uptime: '0', lastSync: '', peersOnline: 0, bandwidthIn: '0', bandwidthOut: '0' },
      getPoolStats: () => screwButtonManagerRef.current?.getPoolStats() ?? { poolName: '', members: 0, maxMembers: 0, totalHashRate: '0', yourContribution: '0', pendingRewards: 0, blocksFound: 0, efficiency: '0', uptime: '0' },
      getMeshCastStats: () => screwButtonManagerRef.current?.getMeshCastStats() ?? { activeBroadcasts: 0, receivedBuffs: [], networkReach: 0, signalStrength: '0', memesGenerated: 0, memesReceived: 0, bandwidth: '0' },
      getBridgeStats: () => screwButtonManagerRef.current?.getBridgeStats() ?? { linkedLab: '', bridgeStability: '0', entanglementFidelity: '0', dataTransferred: '0', sharedCrystals: 0, coAssemblies: 0, chatMessages: 0, bridgeUptime: '0', quantumChannel: '' },
      getFeature: (id) => screwButtonManagerRef.current?.getFeature(id) ?? { id, name: '', fullName: '', description: '', unlockRequirement: '', activationCost: 0 },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screwButtonManager !== undefined])

  // Build CDC device actions - stable reference that accesses latest values via ref
  const cdcDeviceActions: CDCDeviceActions | undefined = useMemo(() => {
    if (!cdcManager) return undefined
    return {
      powerOn: () => cdcManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => cdcManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => cdcManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => cdcManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = cdcManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          crystalCount: m?.crystalCount ?? 0,
          sliceCount: m?.sliceCount ?? 0,
          totalPower: m?.totalPower ?? 0,
          currentDraw: m?.currentDraw ?? 0,
        }
      },
      getFirmware: () => cdcManagerRef.current?.firmware ?? {
        version: '1.4.2',
        build: '2024.01.15',
        checksum: 'A7F3B2E1',
        features: ['crystal-index', 'slice-tracking', 'power-calc', 'auto-sync'],
        securityPatch: '2024.01.10',
      },
      getPowerSpecs: () => cdcManagerRef.current?.powerSpecs ?? {
        full: 15,
        idle: 5,
        standby: 1,
        category: 'medium',
        priority: 1,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdcManager !== undefined])

  // Build UEC device actions - stable reference that accesses latest values via ref
  const uecDeviceActions: UECDeviceActions | undefined = useMemo(() => {
    if (!uecManager) return undefined
    return {
      powerOn: () => uecManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => uecManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => uecManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => uecManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = uecManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          volatilityTier: m?.volatilityTier ?? 1,
          tps: m?.tps ?? 0,
          energyOutput: m?.energyOutput ?? 0,
          fieldStability: m?.fieldStability ?? 0,
        }
      },
      getFirmware: () => uecManagerRef.current?.firmware ?? {
        version: '2.0.1',
        build: '2024.02.08',
        checksum: 'E9C4F7A2',
        features: ['volatility-tracking', 'tps-monitor', 'tier-calc', 'network-sync', 'field-stabilizer'],
        securityPatch: '2024.02.01',
      },
      getPowerSpecs: () => uecManagerRef.current?.powerSpecs ?? {
        outputMax: 500,
        outputPerTier: 100,
        selfConsume: 10,
        standby: 2,
        category: 'generator',
        priority: 0,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uecManager !== undefined])

  // Build BAT device actions - stable reference that accesses latest values via ref
  const batDeviceActions: BATDeviceActions | undefined = useMemo(() => {
    if (!batManager) return undefined
    return {
      powerOn: () => batManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => batManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => batManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => batManagerRef.current?.reboot() ?? Promise.resolve(),
      setAutoRegen: (enabled: boolean) => batManagerRef.current?.setAutoRegen(enabled),
      getState: () => {
        const m = batManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          currentCharge: m?.currentCharge ?? 0,
          chargePercent: m?.chargePercent ?? 0,
          isCharging: m?.isCharging ?? false,
          isDischarging: m?.isDischarging ?? false,
          cellHealth: m?.cellHealth ?? [0, 0, 0, 0],
          temperature: m?.temperature ?? 0,
          autoRegen: m?.autoRegen ?? false,
        }
      },
      getFirmware: () => batManagerRef.current?.firmware ?? {
        version: '1.8.0',
        build: '2024.01.20',
        checksum: 'B4C7D9E2',
        features: ['cell-monitor', 'auto-regen', 'capacity-track', 'thermal-protect', 'cdc-handshake'],
        securityPatch: '2024.01.15',
      },
      getPowerSpecs: () => batManagerRef.current?.powerSpecs ?? {
        capacity: 5000,
        chargeRate: 100,
        dischargeRate: 150,
        selfDischarge: 0.5,
        standbyDrain: 0.1,
        category: 'storage',
        priority: 2,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batManager !== undefined])

  // Build HMS device actions - stable reference that accesses latest values via ref
  const hmsDeviceActions: HMSDeviceActions | undefined = useMemo(() => {
    if (!hmsManager) return undefined
    return {
      powerOn: () => hmsManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => hmsManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => hmsManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => hmsManagerRef.current?.reboot() ?? Promise.resolve(),
      setKnobValue: (knob: 'pulse' | 'tempo' | 'freq', value: number) => hmsManagerRef.current?.setKnobValue(knob, value),
      setWaveform: (type: 'sine' | 'square' | 'saw' | 'triangle') => hmsManagerRef.current?.setWaveform(type),
      getState: () => {
        const m = hmsManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          pulseValue: m?.pulseValue ?? 0,
          tempoValue: m?.tempoValue ?? 0,
          freqValue: m?.freqValue ?? 0,
          currentTier: m?.currentTier ?? 1,
          oscillatorCount: m?.oscillatorCount ?? 4,
          waveformType: m?.waveformType ?? 'sine',
        }
      },
      getFirmware: () => hmsManagerRef.current?.firmware ?? {
        version: '3.2.1',
        build: '2024.02.15',
        checksum: 'C5D8E3F1',
        features: ['multi-osc', 'waveform-gen', 'filter-bank', 'slice-synthesis', 'trait-morph'],
        securityPatch: '2024.02.10',
      },
      getPowerSpecs: () => hmsManagerRef.current?.powerSpecs ?? {
        full: 8,
        idle: 3,
        standby: 0.5,
        resonance: 12,
        category: 'medium',
        priority: 3,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hmsManager !== undefined])

  // Build ECR device actions - stable reference that accesses latest values via ref
  const ecrDeviceActions: ECRDeviceActions | undefined = useMemo(() => {
    if (!ecrManager) return undefined
    return {
      powerOn: () => ecrManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => ecrManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => ecrManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => ecrManagerRef.current?.reboot() ?? Promise.resolve(),
      setKnobValue: (knob: 'pulse' | 'bloom', value: number) => ecrManagerRef.current?.setKnobValue(knob, value),
      setRecording: (recording: boolean) => ecrManagerRef.current?.setRecording(recording),
      getState: () => {
        const m = ecrManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          pulseValue: m?.pulseValue ?? 0,
          bloomValue: m?.bloomValue ?? 0,
          tickerTap: m?.tickerTap ?? 0,
          isRecording: m?.isRecording ?? false,
          signalStrength: m?.signalStrength ?? 0,
          currentTier: m?.currentTier ?? 1,
        }
      },
      getFirmware: () => ecrManagerRef.current?.firmware ?? {
        version: '1.1.0',
        build: '2024.01.28',
        checksum: 'D7E9F2A3',
        features: ['blockchain-feed', 'rotation-track', 'oracle-sync', 'signal-decode', 'ticker-tap'],
        securityPatch: '2024.01.25',
      },
      getPowerSpecs: () => ecrManagerRef.current?.powerSpecs ?? {
        full: 5,
        idle: 2,
        standby: 0.3,
        recording: 7,
        category: 'low',
        priority: 4,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecrManager !== undefined])

  // Build IPL device actions - stable reference that accesses latest values via ref
  const iplDeviceActions: IPLDeviceActions | undefined = useMemo(() => {
    if (!iplManager) return undefined
    return {
      powerOn: () => iplManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => iplManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => iplManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => iplManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = iplManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          spectrumWidth: m?.spectrumWidth ?? 0,
          interpolationAccuracy: m?.interpolationAccuracy ?? 97.5,
          inputStreams: m?.inputStreams ?? 8,
          predictionHorizon: m?.predictionHorizon ?? 60,
          currentTier: m?.currentTier ?? 1,
        }
      },
      getFirmware: () => iplManagerRef.current?.firmware ?? {
        version: '2.5.3',
        build: '2024.02.10',
        checksum: 'F3A8C5D7',
        features: ['color-interp', 'era-manipulate', 'prism-array', 'spectrum-lock', 'prediction-engine'],
        securityPatch: '2024.02.05',
      },
      getPowerSpecs: () => iplManagerRef.current?.powerSpecs ?? {
        full: 20,
        idle: 6,
        standby: 1,
        predictive: 30,
        category: 'medium',
        priority: 2,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iplManager !== undefined])

  // Build MFR device actions - stable reference that accesses latest values via ref
  const mfrDeviceActions: MFRDeviceActions | undefined = useMemo(() => {
    if (!mfrManager) return undefined
    return {
      powerOn: () => mfrManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => mfrManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => mfrManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => mfrManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = mfrManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          powerOutput: m?.powerOutput ?? 0,
          stability: m?.stability ?? 0,
          plasmaTemp: m?.plasmaTemp ?? 0,
          efficiency: m?.efficiency ?? 92,
          ringSpeed: m?.ringSpeed ?? 0,
        }
      },
      getFirmware: () => mfrManagerRef.current?.firmware ?? {
        version: '2.3.0',
        build: '2024.02.01',
        checksum: 'B8D4E6F2',
        features: ['plasma-contain', 'power-regulate', 'thermal-manage', 'auto-scram', 'efficiency-tune'],
        securityPatch: '2024.01.28',
      },
      getPowerSpecs: () => mfrManagerRef.current?.powerSpecs ?? {
        full: 250,
        idle: 150,
        standby: 25,
        startupCost: 500,
        efficiency: 92,
        category: 'generator',
        tier: 2,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfrManager !== undefined])

  // Build AIC device actions - stable reference that accesses latest values via ref
  const aicDeviceActions: AICDeviceActions | undefined = useMemo(() => {
    if (!aicManager) return undefined
    return {
      powerOn: () => aicManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => aicManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => aicManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => aicManagerRef.current?.reboot() ?? Promise.resolve(),
      setLearningMode: (enabled: boolean) => aicManagerRef.current?.setLearningMode(enabled),
      getState: () => {
        const m = aicManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          taskQueue: m?.taskQueue ?? 0,
          efficiency: m?.efficiency ?? 0,
          isLearning: m?.isLearning ?? false,
          nodeActivity: m?.nodeActivity ?? [0, 0, 0, 0, 0],
          anomalyCount: m?.anomalyCount ?? 0,
          uptime: m?.uptime ?? 0,
        }
      },
      getFirmware: () => aicManagerRef.current?.firmware ?? {
        version: '2.4.0',
        build: '2024.02.20',
        checksum: 'E7A9C3B5',
        features: ['neural-core', 'task-queue', 'auto-optimize', 'learning-mode', 'anomaly-detect'],
        securityPatch: '2024.02.15',
      },
      getPowerSpecs: () => aicManagerRef.current?.powerSpecs ?? {
        full: 35,
        idle: 12,
        standby: 3,
        learning: 50,
        category: 'heavy',
        priority: 1,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aicManager !== undefined])

  // Build VNT device actions - stable reference that accesses latest values via ref
  const vntDeviceActions: VNTDeviceActions | undefined = useMemo(() => {
    if (!vntManager) return undefined
    return {
      powerOn: () => vntManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => vntManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => vntManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => vntManagerRef.current?.reboot() ?? Promise.resolve(),
      setFanSpeed: (fanId: 'cpu' | 'gpu', speed: number) => vntManagerRef.current?.setFanSpeed(fanId, speed),
      setFanMode: (fanId: 'cpu' | 'gpu', mode: 'AUTO' | 'LOW' | 'MED' | 'HIGH') => vntManagerRef.current?.setFanMode(fanId, mode),
      toggleFan: (fanId: 'cpu' | 'gpu', on: boolean) => vntManagerRef.current?.toggleFan(fanId, on),
      emergencyPurge: () => vntManagerRef.current?.emergencyPurge() ?? Promise.resolve(),
      getState: () => {
        const m = vntManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          cpuFan: m?.cpuFan ?? { speed: 0, rpm: 0, mode: 'AUTO', isOn: false },
          gpuFan: m?.gpuFan ?? { speed: 0, rpm: 0, mode: 'AUTO', isOn: false },
          cpuTemp: m?.cpuTemp ?? 0,
          gpuTemp: m?.gpuTemp ?? 0,
          currentDraw: m?.currentDraw ?? 0,
          filterHealth: m?.filterHealth ?? 0,
          airQuality: m?.airQuality ?? 0,
          humidity: m?.humidity ?? 0,
        }
      },
      getFirmware: () => vntManagerRef.current?.firmware ?? {
        version: '1.0.0',
        build: '2026.01.28',
        checksum: 'V4F1N7E2',
        features: ['air-exchange', 'hepa-filter', 'humidity-ctrl', 'damper-ctrl', 'dual-fan'],
        securityPatch: '2026.01.20',
      },
      getPowerSpecs: () => vntManagerRef.current?.powerSpecs ?? {
        full: 4,
        idle: 2,
        standby: 0.5,
        emergency: 12,
        category: 'light',
        priority: 1,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vntManager !== undefined])

  // Build SCA device actions
  const scaDeviceActions: SCADeviceActions | undefined = useMemo(() => {
    if (!scaManager) return undefined
    return {
      powerOn: () => scaManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => scaManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => scaManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => scaManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = scaManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          flops: m?.flops ?? 0,
          utilization: m?.utilization ?? 0,
          activeNodes: m?.activeNodes ?? 0,
          jobQueue: m?.jobQueue ?? 0,
          temperature: m?.temperature ?? 28,
          memoryUsage: m?.memoryUsage ?? 0,
          interconnectBandwidth: m?.interconnectBandwidth ?? 0,
          uptime: m?.uptime ?? 0,
          currentDraw: m?.currentDraw ?? 0,
        }
      },
      getFirmware: () => scaManagerRef.current?.firmware ?? {
        version: '5.2.0',
        build: '2026.01.28',
        checksum: 'C8A5F2E7',
        features: ['16-node-cluster', 'ecc-memory', 'job-scheduler', 'linpack-bench', 'interconnect-mesh'],
        securityPatch: '2026.01.20',
      },
      getPowerSpecs: () => scaManagerRef.current?.powerSpecs ?? {
        full: 45,
        idle: 15,
        standby: 5,
        benchmark: 60,
        category: 'heavy',
        priority: 3,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaManager !== undefined])

  // Build EXD device actions
  const exdDeviceActions: EXDDeviceActions | undefined = useMemo(() => {
    if (!exdManager) return undefined
    return {
      powerOn: () => exdManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => exdManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => exdManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => exdManagerRef.current?.reboot() ?? Promise.resolve(),
      deploy: () => exdManagerRef.current?.deploy(),
      recall: () => exdManagerRef.current?.recall(),
      getState: () => {
        const m = exdManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          range: m?.range ?? 0,
          battery: m?.battery ?? 0,
          altitude: m?.altitude ?? 0,
          speed: m?.speed ?? 0,
          gpsSignal: m?.gpsSignal ?? 0,
          cargoLoad: m?.cargoLoad ?? 0,
          flightTime: m?.flightTime ?? 0,
          radarActive: m?.radarActive ?? false,
          isDeployed: m?.isDeployed ?? false,
          currentDraw: m?.currentDraw ?? 0,
        }
      },
      getFirmware: () => exdManagerRef.current?.firmware ?? {
        version: '3.1.2',
        build: '2026.01.28',
        checksum: 'D3X1F7A9',
        features: ['autonomous-nav', 'resource-scan', 'cargo-haul', 'gps-lock', 'imu-stabilize'],
        securityPatch: '2026.01.20',
      },
      getPowerSpecs: () => exdManagerRef.current?.powerSpecs ?? {
        full: 40,
        idle: 15,
        standby: 1,
        highSpeed: 65,
        category: 'heavy',
        priority: 3,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exdManager !== undefined])

  // Build QSM device actions
  const qsmDeviceActions: QSMDeviceActions | undefined = useMemo(() => {
    if (!qsmManager) return undefined
    return {
      powerOn: () => qsmManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => qsmManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => qsmManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => qsmManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = qsmManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          coherence: m?.coherence ?? 0,
          qubits: m?.qubits ?? 0,
          isEntangled: m?.isEntangled ?? false,
          currentDraw: m?.currentDraw ?? 0,
          errorRate: m?.errorRate ?? 0,
          temperature: m?.temperature ?? 15,
        }
      },
      getFirmware: () => qsmManagerRef.current?.firmware ?? {
        version: '1.2.0',
        build: '2026.01.20',
        checksum: 'Q7S4M1N9',
        features: ['qubit-array', 'coherence-tracking', 'entanglement-verify', 'error-correction', 'wave-function'],
        securityPatch: '2026.01.18',
      },
      getPowerSpecs: () => qsmManagerRef.current?.powerSpecs ?? {
        full: 12,
        idle: 7,
        standby: 1,
        scan: 18,
        category: 'medium',
        priority: 2,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qsmManager !== undefined])

  // Build EMC device actions
  const emcDeviceActions: EMCDeviceActions | undefined = useMemo(() => {
    if (!emcManager) return undefined
    return {
      powerOn: () => emcManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => emcManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => emcManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => emcManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = emcManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          units: m?.units ?? 0,
          stability: m?.stability ?? 0,
          fieldStrength: m?.fieldStrength ?? 0,
          temperature: m?.temperature ?? 800,
          isContained: m?.isContained ?? false,
          currentDraw: m?.currentDraw ?? 0,
        }
      },
      getFirmware: () => emcManagerRef.current?.firmware ?? {
        version: '4.0.1',
        build: '2026.01.29',
        checksum: 'E8X4M2C7',
        features: ['containment-field', 'particle-tracking', 'stability-calc', 'matter-compress', 'field-harmonics'],
        securityPatch: '2026.01.25',
      },
      getPowerSpecs: () => emcManagerRef.current?.powerSpecs ?? {
        full: 40,
        idle: 18,
        standby: 2,
        scan: 55,
        category: 'heavy',
        priority: 1,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emcManager !== undefined])

  // Build QUA device actions
  const quaDeviceActions: QUADeviceActions | undefined = useMemo(() => {
    if (!quaManager) return undefined
    return {
      powerOn: () => quaManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => quaManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => quaManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => quaManagerRef.current?.reboot() ?? Promise.resolve(),
      setMode: (mode: 'ANOMALY' | 'RESOURCE' | 'DECRYPT' | 'DIAGNOSE' | 'SIMULATE' | 'SCAN') => quaManagerRef.current?.setMode(mode),
      setSensitivity: (value: number) => quaManagerRef.current?.setSensitivity(value),
      setDepth: (value: number) => quaManagerRef.current?.setDepth(value),
      setFrequency: (value: number) => quaManagerRef.current?.setFrequency(value),
      getState: () => {
        const m = quaManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          mode: m?.mode ?? 'ANOMALY',
          sensitivity: m?.sensitivity ?? 65,
          depth: m?.depth ?? 50,
          frequency: m?.frequency ?? 40,
          coherence: m?.coherence ?? 0,
          isAnalyzing: m?.isAnalyzing ?? false,
          currentDraw: m?.currentDraw ?? 2,
        }
      },
      getFirmware: () => quaManagerRef.current?.firmware ?? {
        version: '3.7.2',
        build: '2026.01.29',
        checksum: 'Q7A3N5X8',
        features: ['quantum-core', 'neural-network', 'multi-mode', 'waveform-gen', 'deep-scan'],
        securityPatch: '2026.01.25',
      },
      getPowerSpecs: () => quaManagerRef.current?.powerSpecs ?? {
        full: 25,
        idle: 10,
        standby: 2,
        analysis: 35,
        category: 'heavy',
        priority: 2,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quaManager !== undefined])

  const pwbDeviceActions: PWBDeviceActions | undefined = useMemo(() => {
    if (!pwbManager) return undefined
    return {
      powerOn: () => pwbManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => pwbManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => pwbManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => pwbManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = pwbManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          currentDraw: m?.currentDraw ?? 0,
          activeSlot: m?.activeSlot ?? null,
          queuedItems: m?.queuedItems ?? 0,
          craftingProgress: m?.craftingProgress ?? 0,
        }
      },
      getFirmware: () => pwbManagerRef.current?.firmware ?? {
        version: '1.1.0',
        build: '2024.02.20',
        checksum: 'D4E8F1A3',
        features: ['slot-management', 'auto-calibrate', 'tool-tracking', 'assembly-queue'],
        securityPatch: '2024.02.15',
      },
      getPowerSpecs: () => pwbManagerRef.current?.powerSpecs ?? {
        full: 3,
        idle: 0.8,
        standby: 0.15,
        category: 'light',
        priority: 2,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwbManager !== undefined])

  const btkDeviceActions: BTKDeviceActions | undefined = useMemo(() => {
    if (!btkManager) return undefined
    return {
      powerOn: () => btkManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => btkManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => btkManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => btkManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = btkManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          currentDraw: m?.currentDraw ?? 0,
          selectedTool: m?.selectedTool ?? null,
        }
      },
      getFirmware: () => btkManagerRef.current?.firmware ?? {
        version: '1.2.0',
        build: '2024.03.10',
        checksum: 'B3A7C5D2',
        features: ['probe-calibrate', 'clamp-feedback', 'laser-safety', 'drill-torque-ctrl'],
        securityPatch: '2024.03.05',
      },
      getPowerSpecs: () => btkManagerRef.current?.powerSpecs ?? {
        full: 0.5,
        idle: 0.3,
        standby: 0.05,
        category: 'light',
        priority: 2,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btkManager !== undefined])

  const rmgDeviceActions: RMGDeviceActions | undefined = useMemo(() => {
    if (!rmgManager) return undefined
    return {
      powerOn: () => rmgManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => rmgManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => rmgManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => rmgManagerRef.current?.reboot() ?? Promise.resolve(),
      setStrength: (value: number) => rmgManagerRef.current?.setStrength(value),
      getState: () => {
        const m = rmgManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          currentDraw: m?.currentDraw ?? 0,
          strength: m?.strength ?? 45,
          fieldActive: m?.fieldActive ?? false,
        }
      },
      getFirmware: () => rmgManagerRef.current?.firmware ?? {
        version: '1.2.0',
        build: '2024.03.15',
        checksum: 'E2C4A8F6',
        features: ['coil-feedback', 'flux-stabilize', 'field-calibrate', 'auto-attract'],
        securityPatch: '2024.03.10',
      },
      getPowerSpecs: () => rmgManagerRef.current?.powerSpecs ?? {
        full: 5,
        idle: 3,
        standby: 0.2,
        category: 'medium',
        priority: 3,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rmgManager !== undefined])

  const mscDeviceActions: MSCDeviceActions | undefined = useMemo(() => {
    if (!mscManager) return undefined
    return {
      powerOn: () => mscManagerRef.current?.powerOn() ?? Promise.resolve(),
      powerOff: () => mscManagerRef.current?.powerOff() ?? Promise.resolve(),
      runTest: () => mscManagerRef.current?.runTest() ?? Promise.resolve(),
      reboot: () => mscManagerRef.current?.reboot() ?? Promise.resolve(),
      getState: () => {
        const m = mscManagerRef.current
        return {
          deviceState: m?.deviceState ?? 'standby',
          statusMessage: m?.statusMessage ?? '',
          isPowered: m?.isPowered ?? false,
          currentDraw: m?.currentDraw ?? 0,
          scanLine: m?.scanLine ?? 0,
          detectedMaterials: m?.detectedMaterials ?? 0,
        }
      },
      getFirmware: () => mscManagerRef.current?.firmware ?? {
        version: '1.3.0',
        build: '2024.02.28',
        checksum: 'F7A3C9D2',
        features: ['material-detect', 'anomaly-flag', 'sweep-scan', 'auto-calibrate'],
        securityPatch: '2024.02.20',
      },
      getPowerSpecs: () => mscManagerRef.current?.powerSpecs ?? {
        full: 2,
        idle: 1,
        standby: 0.1,
        category: 'light',
        priority: 2,
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mscManager !== undefined])

  // Build theme actions from props - use refs for stable reference
  const themeIndexRef = useRef(themeIndex)
  themeIndexRef.current = themeIndex
  const setThemeIndexRef = useRef(setThemeIndex)
  setThemeIndexRef.current = setThemeIndex
  const themesRef = useRef(themes)
  themesRef.current = themes

  const themeActions: ThemeActions | undefined = useMemo(() => {
    if (!themes || themeIndex === undefined || !setThemeIndex) return undefined
    return {
      list: () => themesRef.current!.map((t, i) => ({ name: t.name, fg: t.fg, index: i })),
      get: () => {
        const idx = themeIndexRef.current!
        const t = themesRef.current!
        return { name: t[idx].name, fg: t[idx].fg, index: idx }
      },
      set: (index: number) => {
        const t = themesRef.current!
        if (index >= 0 && index < t.length) setThemeIndexRef.current!(index)
      },
      getByName: (name: string) => {
        const idx = themesRef.current!.findIndex(t => t.name.toLowerCase() === name.toLowerCase())
        return idx >= 0 ? idx : null
      },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themes !== undefined, themeIndex !== undefined, setThemeIndex !== undefined])

  const { lines, isTyping, processCommand, navigateHistory, prompt, passwordMode } = useTerminal({
    userId,
    username,
    balance,
    cdcDeviceActions,
    uecDeviceActions,
    batDeviceActions,
    hmsDeviceActions,
    ecrDeviceActions,
    iplDeviceActions,
    mfrDeviceActions,
    aicDeviceActions,
    vntDeviceActions,
    scaDeviceActions,
    exdDeviceActions,
    qsmDeviceActions,
    emcDeviceActions,
    quaDeviceActions,
    pwbDeviceActions,
    btkDeviceActions,
    rmgDeviceActions,
    mscDeviceActions,
    screwButtonDeviceActions,
    filesystemActions,
    userActions,
    themeActions,
  })

  const handleAutocomplete = useCallback((input: string): string[] => {
    const parts = input.split(/\s+/)

    if (parts.length <= 1) {
      // Completing a command name
      const partial = (parts[0] || '').toLowerCase()
      if (!partial) return []

      const matches: string[] = []
      for (const cmd of commands) {
        if (cmd.name.startsWith(partial)) matches.push(cmd.name + ' ')
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            if (alias.startsWith(partial) && alias !== cmd.name) matches.push(alias + ' ')
          }
        }
      }
      return [...new Set(matches)].sort().slice(0, 12)
    }

    // Completing a file/directory path argument
    const cmd = parts[0]
    const partial = parts[parts.length - 1] || ''
    const prefix = parts.slice(0, -1).join(' ') + ' '

    // Get directory to list and the partial filename
    let dirPath: string
    let filePrefix: string

    const lastSlash = partial.lastIndexOf('/')
    if (lastSlash >= 0) {
      dirPath = partial.slice(0, lastSlash) || '/'
      filePrefix = partial.slice(lastSlash + 1)
    } else {
      dirPath = '.'
      filePrefix = partial
    }

    try {
      const entries = fsRef.current?.ls(dirPath, { all: false }) ?? []
      const matches: string[] = []
      for (const entry of entries) {
        // Strip trailing / from dirs for comparison
        const clean = entry.replace(/\/$/, '')
        if (clean.toLowerCase().startsWith(filePrefix.toLowerCase())) {
          const pathBase = lastSlash >= 0 ? partial.slice(0, lastSlash + 1) : ''
          matches.push(prefix + pathBase + entry)
        }
      }
      return matches.slice(0, 12)
    } catch {
      return []
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <TerminalOutput lines={lines} isTyping={isTyping} />
      <TerminalInput
        onSubmit={processCommand}
        onNavigateHistory={navigateHistory}
        onAutocomplete={handleAutocomplete}
        disabled={isTyping}
        prompt={passwordMode ? 'Password:' : prompt}
        passwordMode={passwordMode}
      />
    </div>
  )
}
