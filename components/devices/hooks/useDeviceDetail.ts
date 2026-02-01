'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getDeviceById,
  getDeviceState,
  getDeviceDependencies,
  getDeviceCombinations,
  getDeviceTweaks,
  subscribeToDeviceState,
} from '@/lib/api/devices'
import type {
  Device,
  DeviceRuntimeState,
  DeviceDependency,
  DeviceCombination,
  DeviceTweak,
  PlayerDeviceState,
} from '@/types/devices'

interface UseDeviceDetailProps {
  deviceId: string
  playerState?: PlayerDeviceState | null
}

export function useDeviceDetail({ deviceId, playerState }: UseDeviceDetailProps) {
  const [device, setDevice] = useState<Device | null>(null)
  const [state, setState] = useState<DeviceRuntimeState | null>(null)
  const [dependencies, setDependencies] = useState<DeviceDependency[]>([])
  const [combinations, setCombinations] = useState<DeviceCombination[]>([])
  const [tweaks, setTweaks] = useState<DeviceTweak[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const [dev, devState, deps, combos, tw] = await Promise.all([
          getDeviceById(deviceId),
          getDeviceState(deviceId),
          getDeviceDependencies(deviceId),
          getDeviceCombinations(deviceId),
          getDeviceTweaks(deviceId),
        ])
        if (cancelled) return
        setDevice(dev)
        setState(devState)
        setDependencies(deps)
        setCombinations(combos)
        setTweaks(tw)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load device')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [deviceId])

  // Real-time state updates
  useEffect(() => {
    const channel = subscribeToDeviceState(deviceId, (updated) => {
      setState(updated)
    })
    return () => { channel.unsubscribe() }
  }, [deviceId])

  const refresh = useCallback(async () => {
    try {
      const devState = await getDeviceState(deviceId)
      setState(devState)
    } catch { /* ignore */ }
  }, [deviceId])

  return {
    device,
    state,
    dependencies,
    combinations,
    tweaks,
    playerState: playerState ?? null,
    loading,
    error,
    refresh,
  }
}
