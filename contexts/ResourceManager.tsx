'use client'

import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import {
  RESOURCE_CONTAINERS,
  MAX_UPGRADE_LEVEL,
  getEffectiveCapacity,
  type ContainerState,
  type ResourceContainerDef,
} from '@/types/resources'

// ── Types ──────────────────────────────────────────────────

export interface ResourceManagerActions {
  getContainer: (id: string) => ContainerState | undefined
  getAllContainers: () => Map<string, ContainerState>
  getUnlockedContainers: () => [string, ContainerState][]
  unlockContainer: (id: string) => boolean
  upgradeContainer: (id: string) => boolean
  addResource: (id: string, amount: number) => void
  removeResource: (id: string, amount: number) => boolean
  setFlowRate: (id: string, rate: number) => void
  getAggregated: (resourceType: string) => { amount: number; capacity: number }
  toSaveData: () => ResourceSaveData
  hydrate: (data: ResourceSaveData) => void
}

export type ResourceSaveData = {
  [id: string]: { amount: number; isUnlocked: boolean; upgradeLevel?: number }
}

interface ResourceState {
  containers: Map<string, ContainerState>
}

type ResourceAction =
  | { type: 'TICK' }
  | { type: 'UNLOCK'; id: string }
  | { type: 'UPGRADE'; id: string }
  | { type: 'ADD'; id: string; amount: number }
  | { type: 'REMOVE'; id: string; amount: number }
  | { type: 'SET_FLOW'; id: string; rate: number }
  | { type: 'HYDRATE'; data: ResourceSaveData }

// ── Initial state builder ──────────────────────────────────

function buildInitialState(saved?: ResourceSaveData): ResourceState {
  const containers = new Map<string, ContainerState>()

  for (const def of RESOURCE_CONTAINERS) {
    const savedEntry = saved?.[def.id]
    const upgradeLevel = savedEntry?.upgradeLevel ?? 0
    containers.set(def.id, {
      amount: savedEntry?.amount ?? 0,
      capacity: getEffectiveCapacity(def.capacity, upgradeLevel),
      flowRate: def.tier === 0 ? getDefaultFlowRate(def) : 0,
      isUnlocked: savedEntry?.isUnlocked ?? def.tier === 0,
      isActive: savedEntry?.isUnlocked ?? def.tier === 0,
      upgradeLevel,
    })
  }

  return { containers }
}

function getDefaultFlowRate(def: ResourceContainerDef): number {
  if (def.id === 'SPC-000') return 2.1
  if (def.id === 'RSC-000') return 1.5
  return 0
}

// ── Reducer ────────────────────────────────────────────────

function resourceReducer(state: ResourceState, action: ResourceAction): ResourceState {
  switch (action.type) {
    case 'TICK': {
      let changed = false
      const next = new Map(state.containers)
      for (const [id, cs] of next) {
        if (cs.isActive && cs.flowRate > 0 && cs.amount < cs.capacity) {
          changed = true
          const gain = Math.min(cs.flowRate, cs.capacity - cs.amount)
          next.set(id, { ...cs, amount: Math.min(cs.capacity, cs.amount + gain) })
        }
      }
      return changed ? { containers: next } : state
    }

    case 'UNLOCK': {
      const cs = state.containers.get(action.id)
      if (!cs || cs.isUnlocked) return state
      const next = new Map(state.containers)
      next.set(action.id, { ...cs, isUnlocked: true, isActive: true })
      return { containers: next }
    }

    case 'UPGRADE': {
      const cs = state.containers.get(action.id)
      if (!cs || cs.upgradeLevel >= MAX_UPGRADE_LEVEL) return state
      const def = RESOURCE_CONTAINERS.find(d => d.id === action.id)
      if (!def) return state
      const newLevel = cs.upgradeLevel + 1
      const newCapacity = getEffectiveCapacity(def.capacity, newLevel)
      const next = new Map(state.containers)
      next.set(action.id, { ...cs, upgradeLevel: newLevel, capacity: newCapacity })
      return { containers: next }
    }

    case 'ADD': {
      const cs = state.containers.get(action.id)
      if (!cs || !cs.isUnlocked) return state
      const next = new Map(state.containers)
      next.set(action.id, { ...cs, amount: Math.min(cs.capacity, cs.amount + action.amount) })
      return { containers: next }
    }

    case 'REMOVE': {
      const cs = state.containers.get(action.id)
      if (!cs || cs.amount < action.amount) return state
      const next = new Map(state.containers)
      next.set(action.id, { ...cs, amount: cs.amount - action.amount })
      return { containers: next }
    }

    case 'SET_FLOW': {
      const cs = state.containers.get(action.id)
      if (!cs) return state
      const next = new Map(state.containers)
      next.set(action.id, { ...cs, flowRate: action.rate })
      return { containers: next }
    }

    case 'HYDRATE': {
      return buildInitialState(action.data)
    }

    default:
      return state
  }
}

// ── Context ────────────────────────────────────────────────

const ResourceManagerContext = createContext<ResourceManagerActions | null>(null)

export function useResourceManager(): ResourceManagerActions {
  const ctx = useContext(ResourceManagerContext)
  if (!ctx) throw new Error('useResourceManager must be used within ResourceManagerProvider')
  return ctx
}

export function useResourceManagerOptional(): ResourceManagerActions | null {
  return useContext(ResourceManagerContext)
}

// ── Provider ───────────────────────────────────────────────

interface ResourceManagerProviderProps {
  children: React.ReactNode
  initialState?: ResourceSaveData
}

export function ResourceManagerProvider({ children, initialState }: ResourceManagerProviderProps) {
  const [state, dispatch] = useReducer(resourceReducer, initialState, buildInitialState)
  const stateRef = useRef(state)
  stateRef.current = state

  // Debounced DB sync timer
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tick every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'TICK' })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Cleanup sync timer on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [])

  // Schedule a debounced DB sync (fire-and-forget, 5s debounce)
  const scheduleSyncRef = useRef(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(async () => {
      try {
        const { syncResourceState } = await import('@/app/(game)/terminal/actions/resources')
        const data = buildSaveData(stateRef.current)
        await syncResourceState(data)
      } catch {
        // Silent fail — localStorage is the fallback
      }
    }, 5000)
  })

  const getContainer = useCallback((id: string) => stateRef.current.containers.get(id), [])

  const getAllContainers = useCallback(() => stateRef.current.containers, [])

  const getUnlockedContainers = useCallback(() => {
    const result: [string, ContainerState][] = []
    for (const [id, cs] of stateRef.current.containers) {
      if (cs.isUnlocked) result.push([id, cs])
    }
    return result
  }, [])

  const unlockContainer = useCallback((id: string) => {
    const cs = stateRef.current.containers.get(id)
    if (!cs || cs.isUnlocked) return false
    dispatch({ type: 'UNLOCK', id })
    scheduleSyncRef.current()
    return true
  }, [])

  const upgradeContainer = useCallback((id: string) => {
    const cs = stateRef.current.containers.get(id)
    if (!cs || cs.upgradeLevel >= MAX_UPGRADE_LEVEL) return false
    dispatch({ type: 'UPGRADE', id })
    scheduleSyncRef.current()
    return true
  }, [])

  const addResource = useCallback((id: string, amount: number) => {
    dispatch({ type: 'ADD', id, amount })
    scheduleSyncRef.current()
  }, [])

  const removeResource = useCallback((id: string, amount: number) => {
    const cs = stateRef.current.containers.get(id)
    if (!cs || cs.amount < amount) return false
    dispatch({ type: 'REMOVE', id, amount })
    scheduleSyncRef.current()
    return true
  }, [])

  const setFlowRate = useCallback((id: string, rate: number) => {
    dispatch({ type: 'SET_FLOW', id, rate })
  }, [])

  const getAggregated = useCallback((resourceType: string) => {
    let amount = 0
    let capacity = 0
    for (const def of RESOURCE_CONTAINERS) {
      if (def.resourceType === resourceType) {
        const cs = stateRef.current.containers.get(def.id)
        if (cs && cs.isUnlocked) {
          amount += cs.amount
          capacity += cs.capacity
        }
      }
    }
    return { amount, capacity }
  }, [])

  const toSaveData = useCallback((): ResourceSaveData => {
    return buildSaveData(stateRef.current)
  }, [])

  const hydrate = useCallback((data: ResourceSaveData) => {
    dispatch({ type: 'HYDRATE', data })
  }, [])

  // On mount: try to load from DB
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { fetchPlayerResources } = await import('@/app/(game)/terminal/actions/resources')
        const dbData = await fetchPlayerResources()
        if (!cancelled && dbData && Object.keys(dbData).length > 0) {
          dispatch({ type: 'HYDRATE', data: dbData })
        }
      } catch {
        // DB unavailable — use localStorage fallback (already loaded via initialState)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const actions: ResourceManagerActions = {
    getContainer,
    getAllContainers,
    getUnlockedContainers,
    unlockContainer,
    upgradeContainer,
    addResource,
    removeResource,
    setFlowRate,
    getAggregated,
    toSaveData,
    hydrate,
  }

  return (
    <ResourceManagerContext.Provider value={actions}>
      {children}
    </ResourceManagerContext.Provider>
  )
}

function buildSaveData(state: ResourceState): ResourceSaveData {
  const data: ResourceSaveData = {}
  for (const [id, cs] of state.containers) {
    data[id] = { amount: cs.amount, isUnlocked: cs.isUnlocked, upgradeLevel: cs.upgradeLevel }
  }
  return data
}
