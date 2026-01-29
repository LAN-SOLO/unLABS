'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { ScrewButtonId, ScrewButtonState } from '@/components/panel/ScrewButton'
import { SCREW_FEATURES } from '@/components/panel/ScrewButton'

// ============================================================================
// SIMULATED NETWORK STATS
// ============================================================================

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getNodeSyncStats() {
  return {
    connectedNodes: randomInt(12, 48),
    totalNodes: 64,
    syncRate: (95 + Math.random() * 5).toFixed(1),
    hashRate: `${(120 + Math.random() * 40).toFixed(1)} TH/s`,
    latency: `${randomInt(8, 35)}ms`,
    uptime: `${randomInt(1, 72)}h ${randomInt(0, 59)}m`,
    lastSync: new Date().toISOString().slice(11, 19),
    peersOnline: randomInt(8, 32),
    bandwidthIn: `${(1.2 + Math.random() * 2).toFixed(1)} Gbps`,
    bandwidthOut: `${(0.8 + Math.random() * 1.5).toFixed(1)} Gbps`,
  }
}

function getPoolStats() {
  return {
    poolName: `POOL-${String.fromCharCode(65 + randomInt(0, 25))}${randomInt(100, 999)}`,
    members: randomInt(4, 24),
    maxMembers: 32,
    totalHashRate: `${(0.8 + Math.random() * 3).toFixed(2)} PH/s`,
    yourContribution: `${(2 + Math.random() * 15).toFixed(1)}%`,
    pendingRewards: randomInt(10, 500),
    blocksFound: randomInt(0, 12),
    efficiency: `${(88 + Math.random() * 12).toFixed(1)}%`,
    uptime: `${randomInt(1, 168)}h`,
  }
}

function getMeshCastStats() {
  const memes = [
    '+15% Crystal Yield', '+10% Hash Rate', '-20% Energy Cost',
    '+25% Research Speed', '+8% Stability Boost', 'Double Slice Drop',
    'Quantum Flux +30%', 'Crit Rate +12%', 'Shield Regen +20%',
  ]
  const activeMemes = memes.slice(0, randomInt(1, 4))
  return {
    activeBroadcasts: randomInt(2, 8),
    receivedBuffs: activeMemes,
    networkReach: randomInt(12, 64),
    signalStrength: `${(75 + Math.random() * 25).toFixed(0)}%`,
    memesGenerated: randomInt(0, 50),
    memesReceived: randomInt(5, 100),
    bandwidth: `${(0.5 + Math.random() * 2).toFixed(1)} Mbps`,
  }
}

function getBridgeStats() {
  const labNames = ['LAB-Ω', 'LAB-Δ', 'LAB-Σ', 'LAB-Φ', 'LAB-Ψ', 'LAB-Λ']
  return {
    linkedLab: labNames[randomInt(0, labNames.length - 1)],
    bridgeStability: `${(90 + Math.random() * 10).toFixed(1)}%`,
    entanglementFidelity: `${(92 + Math.random() * 8).toFixed(1)}%`,
    dataTransferred: `${(1.2 + Math.random() * 10).toFixed(1)} GB`,
    sharedCrystals: randomInt(0, 5),
    coAssemblies: randomInt(0, 3),
    chatMessages: randomInt(0, 100),
    bridgeUptime: `${randomInt(0, 48)}h ${randomInt(0, 59)}m`,
    quantumChannel: `QCH-${randomInt(1000, 9999)}`,
  }
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface ScrewButtonDeviceActions {
  activate: (id: ScrewButtonId) => Promise<boolean>
  deactivate: (id: ScrewButtonId) => Promise<boolean>
  isUnlocked: (id: ScrewButtonId) => boolean
  isActive: (id: ScrewButtonId) => boolean
  getState: (id: ScrewButtonId) => ScrewButtonState
  getAllStates: () => Record<ScrewButtonId, ScrewButtonState>
  getNodeSyncStats: () => ReturnType<typeof getNodeSyncStats>
  getPoolStats: () => ReturnType<typeof getPoolStats>
  getMeshCastStats: () => ReturnType<typeof getMeshCastStats>
  getBridgeStats: () => ReturnType<typeof getBridgeStats>
  getFeature: (id: ScrewButtonId) => typeof SCREW_FEATURES[ScrewButtonId]
}

interface ScrewButtonManagerContextValue extends ScrewButtonDeviceActions {
  states: Record<ScrewButtonId, ScrewButtonState>
}

// ============================================================================
// CONTEXT
// ============================================================================

const ScrewButtonManagerContext = createContext<ScrewButtonManagerContextValue | null>(null)

const DEFAULT_STATE: ScrewButtonState = {
  unlocked: false,
  unlockedAt: null,
  active: false,
  activatedAt: null,
  totalActiveTime: 0,
}

interface ScrewButtonManagerProviderProps {
  children: ReactNode
  initialState?: Partial<Record<string, { unlocked?: boolean; active?: boolean; totalActiveTime?: number }>>
}

export function ScrewButtonManagerProvider({ children, initialState }: ScrewButtonManagerProviderProps) {
  const [states, setStates] = useState<Record<ScrewButtonId, ScrewButtonState>>(() => {
    const ids: ScrewButtonId[] = ['SB-01', 'SB-02', 'SB-03', 'SB-04']
    const result = {} as Record<ScrewButtonId, ScrewButtonState>
    for (const id of ids) {
      const saved = initialState?.[id]
      result[id] = {
        ...DEFAULT_STATE,
        unlocked: saved?.unlocked ?? true, // All unlockable for now
        unlockedAt: saved?.unlocked ? Date.now() : null,
        active: saved?.active ?? false,
        activatedAt: saved?.active ? Date.now() : null,
        totalActiveTime: saved?.totalActiveTime ?? 0,
      }
    }
    return result
  })

  const activate = useCallback(async (id: ScrewButtonId): Promise<boolean> => {
    setStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        unlocked: true,
        unlockedAt: prev[id].unlockedAt ?? Date.now(),
        active: true,
        activatedAt: Date.now(),
      },
    }))
    return true
  }, [])

  const deactivate = useCallback(async (id: ScrewButtonId): Promise<boolean> => {
    setStates(prev => {
      const state = prev[id]
      const activeTime = state.activatedAt
        ? Math.floor((Date.now() - state.activatedAt) / 1000)
        : 0
      return {
        ...prev,
        [id]: {
          ...state,
          active: false,
          activatedAt: null,
          totalActiveTime: state.totalActiveTime + activeTime,
        },
      }
    })
    return true
  }, [])

  const isUnlocked = useCallback((id: ScrewButtonId) => {
    return states[id]?.unlocked ?? true // All unlocked for now
  }, [states])

  const isActive = useCallback((id: ScrewButtonId) => {
    return states[id]?.active ?? false
  }, [states])

  const getState = useCallback((id: ScrewButtonId) => {
    return states[id] ?? DEFAULT_STATE
  }, [states])

  const getAllStates = useCallback(() => states, [states])

  const getFeature = useCallback((id: ScrewButtonId) => SCREW_FEATURES[id], [])

  const value = useMemo<ScrewButtonManagerContextValue>(() => ({
    states,
    activate,
    deactivate,
    isUnlocked,
    isActive,
    getState,
    getAllStates,
    getNodeSyncStats,
    getPoolStats,
    getMeshCastStats,
    getBridgeStats,
    getFeature,
  }), [states, activate, deactivate, isUnlocked, isActive, getState, getAllStates, getFeature])

  return (
    <ScrewButtonManagerContext.Provider value={value}>
      {children}
    </ScrewButtonManagerContext.Provider>
  )
}

export function useScrewButtonManager(): ScrewButtonManagerContextValue {
  const ctx = useContext(ScrewButtonManagerContext)
  if (!ctx) throw new Error('useScrewButtonManager must be used within ScrewButtonManagerProvider')
  return ctx
}

export function useScrewButtonManagerOptional(): ScrewButtonManagerContextValue | null {
  return useContext(ScrewButtonManagerContext)
}
