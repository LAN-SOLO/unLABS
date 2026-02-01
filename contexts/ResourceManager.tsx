'use client'

import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { RESOURCE_CONTAINERS, type ContainerState, type ResourceContainerDef } from '@/types/resources'

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
}

export type ResourceSaveData = {
  [id: string]: { amount: number; isUnlocked: boolean }
}

interface ResourceState {
  containers: Map<string, ContainerState>
}

type ResourceAction =
  | { type: 'TICK' }
  | { type: 'UNLOCK'; id: string }
  | { type: 'UPGRADE'; id: string; newCapacity: number }
  | { type: 'ADD'; id: string; amount: number }
  | { type: 'REMOVE'; id: string; amount: number }
  | { type: 'SET_FLOW'; id: string; rate: number }

// ── Initial state builder ──────────────────────────────────

function buildInitialState(saved?: ResourceSaveData): ResourceState {
  const containers = new Map<string, ContainerState>()

  for (const def of RESOURCE_CONTAINERS) {
    const savedEntry = saved?.[def.id]
    containers.set(def.id, {
      amount: savedEntry?.amount ?? 0,
      capacity: def.capacity,
      flowRate: def.tier === 0 ? getDefaultFlowRate(def) : 0,
      isUnlocked: savedEntry?.isUnlocked ?? def.tier === 0,
      isActive: savedEntry?.isUnlocked ?? def.tier === 0,
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
      if (!cs) return state
      const next = new Map(state.containers)
      next.set(action.id, { ...cs, capacity: action.newCapacity })
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

  // Tick every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'TICK' })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

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
    return true
  }, [])

  const upgradeContainer = useCallback((id: string) => {
    const cs = stateRef.current.containers.get(id)
    if (!cs) return false
    dispatch({ type: 'UPGRADE', id, newCapacity: Math.floor(cs.capacity * 1.5) })
    return true
  }, [])

  const addResource = useCallback((id: string, amount: number) => {
    dispatch({ type: 'ADD', id, amount })
  }, [])

  const removeResource = useCallback((id: string, amount: number) => {
    const cs = stateRef.current.containers.get(id)
    if (!cs || cs.amount < amount) return false
    dispatch({ type: 'REMOVE', id, amount })
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
    const data: ResourceSaveData = {}
    for (const [id, cs] of stateRef.current.containers) {
      data[id] = { amount: cs.amount, isUnlocked: cs.isUnlocked }
    }
    return data
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
  }

  return (
    <ResourceManagerContext.Provider value={actions}>
      {children}
    </ResourceManagerContext.Provider>
  )
}
