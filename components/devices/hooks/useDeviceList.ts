'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getAllDevices,
  getAllDeviceStates,
  getPlayerDevices,
  getPowerSummary,
  subscribeToAllDeviceStates,
} from '@/lib/api/devices'
import type {
  Device,
  DeviceRuntimeState,
  PlayerDeviceState,
  DevicePowerSummary,
  DeviceCategory,
  DeviceState,
  DeviceListItem,
} from '@/types/devices'

export type SortField = 'device_id' | 'name' | 'tier' | 'power' | 'health' | 'load' | 'category'
export type SortDirection = 'asc' | 'desc'

export interface DeviceListFilters {
  category?: DeviceCategory
  state?: DeviceState
  tier?: number
  search?: string
}

export interface DeviceListSort {
  field: SortField
  direction: SortDirection
}

interface UseDeviceListProps {
  playerId?: string
  initialFilter?: DeviceListFilters
}

export function useDeviceList({ playerId, initialFilter }: UseDeviceListProps = {}) {
  const [devices, setDevices] = useState<Device[]>([])
  const [states, setStates] = useState<Map<string, DeviceRuntimeState>>(new Map())
  const [playerStates, setPlayerStates] = useState<Map<string, PlayerDeviceState>>(new Map())
  const [powerSummary, setPowerSummary] = useState<DevicePowerSummary | null>(null)
  const [filters, setFilters] = useState<DeviceListFilters>(initialFilter ?? {})
  const [sort, setSort] = useState<DeviceListSort>({ field: 'device_id', direction: 'asc' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all data on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const [devs, devStates] = await Promise.all([
          getAllDevices(),
          getAllDeviceStates(),
        ])

        if (cancelled) return

        setDevices(devs)
        setStates(new Map(devStates.map((s) => [s.device_id, s])))

        if (playerId) {
          const [pStates, summary] = await Promise.all([
            getPlayerDevices(playerId),
            getPowerSummary(playerId),
          ])
          if (cancelled) return
          setPlayerStates(new Map(pStates.map((p) => [p.device_id, p])))
          setPowerSummary(summary)
        }

        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load devices')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [playerId])

  // Real-time state subscription
  useEffect(() => {
    const channel = subscribeToAllDeviceStates((updated) => {
      setStates((prev) => {
        const next = new Map(prev)
        next.set(updated.device_id, updated)
        return next
      })
    })

    return () => { channel.unsubscribe() }
  }, [])

  // Build list items with merged state
  const listItems: DeviceListItem[] = useMemo(() => {
    return devices.map((d) => {
      const st = states.get(d.device_id)
      const ps = playerStates.get(d.device_id)
      return {
        device_id: d.device_id,
        name: d.name,
        category: d.category,
        tier: d.tier,
        state: ps?.current_state ?? st?.state ?? 'offline',
        health: st?.health ?? 100,
        power_current: st?.power_current ?? 0,
        unlocked: ps?.unlocked ?? false,
      }
    })
  }, [devices, states, playerStates])

  // Filter
  const filtered = useMemo(() => {
    return listItems.filter((item) => {
      if (filters.category && item.category !== filters.category) return false
      if (filters.state && item.state !== filters.state) return false
      if (filters.tier && item.tier !== filters.tier) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (
          !item.device_id.toLowerCase().includes(q) &&
          !item.name.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [listItems, filters])

  // Sort
  const sorted = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sort.field) {
        case 'device_id': return a.device_id.localeCompare(b.device_id) * dir
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'tier': return (a.tier - b.tier) * dir
        case 'power': return (a.power_current - b.power_current) * dir
        case 'health': return (a.health - b.health) * dir
        case 'load': return 0 // load not on DeviceListItem; fallback
        case 'category': return a.category.localeCompare(b.category) * dir
        default: return 0
      }
    })
  }, [filtered, sort])

  const getDeviceDetail = useCallback((id: string) => {
    return devices.find((d) => d.device_id === id) ?? null
  }, [devices])

  const getDeviceState = useCallback((id: string) => {
    return states.get(id) ?? null
  }, [states])

  return {
    items: sorted,
    devices,
    states,
    powerSummary,
    filters,
    setFilters,
    sort,
    setSort,
    loading,
    error,
    getDeviceDetail,
    getDeviceState,
    totalCount: devices.length,
    filteredCount: filtered.length,
  }
}
