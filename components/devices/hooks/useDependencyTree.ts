'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  getDeviceById,
  getDeviceDependencies,
  getDeviceUnlocks,
  getAllDevices,
} from '@/lib/api/devices'
import type { Device, DeviceDependency, DependencyStatus } from '@/types/devices'

export interface TreeNode {
  device_id: string
  name: string
  tier: number
  tech_tree: string
  status: DependencyStatus
  is_cross_tree: boolean
  children: TreeNode[]
}

export interface InvestmentTotals {
  total_cost_unsc: number
  total_time_hours: number
  completed_steps: number
  total_steps: number
}

interface UseDependencyTreeProps {
  deviceId: string
}

// Estimate cost per tier (placeholder formula)
function tierCost(tier: number): number {
  return tier * 500
}

function tierTimeHours(tier: number): number {
  return tier * 2
}

export function useDependencyTree({ deviceId }: UseDependencyTreeProps) {
  const [device, setDevice] = useState<Device | null>(null)
  const [dependencies, setDependencies] = useState<DeviceDependency[]>([])
  const [unlocks, setUnlocks] = useState<string[]>([])
  const [allDevices, setAllDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const [dev, deps, unl, devs] = await Promise.all([
          getDeviceById(deviceId),
          getDeviceDependencies(deviceId),
          getDeviceUnlocks(deviceId),
          getAllDevices(),
        ])
        if (cancelled) return
        setDevice(dev)
        setDependencies(deps)
        setUnlocks(unl)
        setAllDevices(devs)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dependency data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [deviceId])

  // Build the prerequisite tree (what this device needs)
  const prerequisiteTree = useMemo((): TreeNode | null => {
    if (!device) return null

    const deviceMap = new Map(allDevices.map((d) => [d.device_id, d]))

    // Build tree nodes from dependencies
    const children: TreeNode[] = dependencies.map((dep) => {
      // Find devices in that tree at or below the required tier
      const prereqDevices = allDevices
        .filter((d) => d.tech_tree === dep.tech_tree && d.tier <= dep.tier)
        .sort((a, b) => a.tier - b.tier)

      const buildChain = (devs: Device[]): TreeNode[] => {
        if (devs.length === 0) return []
        const [first, ...rest] = devs
        return [{
          device_id: first.device_id,
          name: first.name,
          tier: first.tier,
          tech_tree: first.tech_tree,
          status: dep.status,
          is_cross_tree: dep.is_cross_tree,
          children: buildChain(rest),
        }]
      }

      if (prereqDevices.length > 0) {
        const chain = buildChain(prereqDevices)
        return chain[0]
      }

      // Fallback: no matching device, show raw dep
      return {
        device_id: dep.item_name,
        name: dep.item_name,
        tier: dep.tier,
        tech_tree: dep.tech_tree,
        status: dep.status,
        is_cross_tree: dep.is_cross_tree,
        children: [],
      }
    })

    return {
      device_id: device.device_id,
      name: device.name,
      tier: device.tier,
      tech_tree: device.tech_tree,
      status: 'complete',
      is_cross_tree: false,
      children,
    }
  }, [device, dependencies, allDevices])

  // Build unlocks list (what this device enables)
  const unlockDevices = useMemo((): Device[] => {
    if (!device) return []
    const deviceMap = new Map(allDevices.map((d) => [d.device_id, d]))
    return unlocks
      .map((id) => deviceMap.get(id))
      .filter((d): d is Device => d !== undefined && d.device_id !== deviceId)
  }, [device, unlocks, allDevices, deviceId])

  // Investment summary
  const investment = useMemo((): InvestmentTotals => {
    if (!device) return { total_cost_unsc: 0, total_time_hours: 0, completed_steps: 0, total_steps: 0 }

    let cost = 0
    let time = 0
    let completed = 0
    const total = dependencies.length

    for (const dep of dependencies) {
      cost += tierCost(dep.tier)
      time += tierTimeHours(dep.tier)
      if (dep.status === 'complete') completed++
    }

    // Include the device's own tier
    cost += tierCost(device.tier)
    time += tierTimeHours(device.tier)

    return {
      total_cost_unsc: cost,
      total_time_hours: time,
      completed_steps: completed,
      total_steps: total + 1, // +1 for the device itself
    }
  }, [device, dependencies])

  return {
    device,
    prerequisiteTree,
    unlockDevices,
    dependencies,
    investment,
    loading,
    error,
  }
}
