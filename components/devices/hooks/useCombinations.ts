'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getDeviceCombinations,
  getActiveCombinations,
  getDeviceById,
  linkDevices,
  unlinkDevices,
  getPlayerDevices,
} from '@/lib/api/devices'
import type {
  DeviceCombination,
  Device,
  PlayerDeviceState,
} from '@/types/devices'

export interface CombinationWithDevice extends DeviceCombination {
  partner_id: string
  partner_name: string
  partner_version: string
}

interface UseCombinationsProps {
  deviceId: string
  playerId: string
}

export function useCombinations({ deviceId, playerId }: UseCombinationsProps) {
  const [device, setDevice] = useState<Device | null>(null)
  const [allCombos, setAllCombos] = useState<DeviceCombination[]>([])
  const [activeCombos, setActiveCombos] = useState<DeviceCombination[]>([])
  const [partnerDevices, setPartnerDevices] = useState<Map<string, Device>>(new Map())
  const [playerStates, setPlayerStates] = useState<Map<string, PlayerDeviceState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [dev, combos, active, pStates] = await Promise.all([
        getDeviceById(deviceId),
        getDeviceCombinations(deviceId),
        getActiveCombinations(playerId),
        getPlayerDevices(playerId),
      ])

      setDevice(dev)
      setAllCombos(combos)
      setActiveCombos(active)
      setPlayerStates(new Map(pStates.map((p) => [p.device_id, p])))

      // Fetch partner device details
      const partnerIds = new Set<string>()
      for (const c of combos) {
        const pid = c.primary_device === deviceId ? c.secondary_device : c.primary_device
        partnerIds.add(pid)
      }

      const partners = await Promise.all(
        Array.from(partnerIds).map((id) => getDeviceById(id).catch(() => null))
      )
      const map = new Map<string, Device>()
      for (const p of partners) {
        if (p) map.set(p.device_id, p)
      }
      setPartnerDevices(map)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load combinations')
    } finally {
      setLoading(false)
    }
  }, [deviceId, playerId])

  useEffect(() => { load() }, [load])

  // Enrich combos with partner info
  const enriched = useMemo((): CombinationWithDevice[] => {
    return allCombos.map((c) => {
      const partnerId = c.primary_device === deviceId ? c.secondary_device : c.primary_device
      const partner = partnerDevices.get(partnerId)
      // Check if this combo is currently active
      const isActive = activeCombos.some(
        (a) =>
          (a.primary_device === c.primary_device && a.secondary_device === c.secondary_device) ||
          (a.primary_device === c.secondary_device && a.secondary_device === c.primary_device)
      )
      // Check if partner is unlocked
      const partnerState = playerStates.get(partnerId)
      const isUnlocked = (partnerState?.unlocked ?? false) && (playerStates.get(deviceId)?.unlocked ?? false)

      return {
        ...c,
        partner_id: partnerId,
        partner_name: partner?.name ?? partnerId,
        partner_version: partner?.version ?? '',
        is_unlocked: isUnlocked,
        is_active: isActive,
      }
    })
  }, [allCombos, activeCombos, partnerDevices, playerStates, deviceId])

  const activeList = useMemo(() => enriched.filter((c) => c.is_active), [enriched])
  const availableList = useMemo(() => enriched.filter((c) => !c.is_active), [enriched])

  const handleLink = useCallback(async (partnerId: string) => {
    try {
      setLinking(true)
      await linkDevices(playerId, deviceId, partnerId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link devices')
    } finally {
      setLinking(false)
    }
  }, [playerId, deviceId, load])

  const handleUnlink = useCallback(async (partnerId: string) => {
    try {
      setLinking(true)
      await unlinkDevices(playerId, deviceId, partnerId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlink devices')
    } finally {
      setLinking(false)
    }
  }, [playerId, deviceId, load])

  return {
    device,
    activeList,
    availableList,
    allCombos: enriched,
    loading,
    linking,
    error,
    handleLink,
    handleUnlink,
  }
}
