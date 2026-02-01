'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getDeviceTweaks,
  getPlayerTweakSettings,
  savePlayerTweakSettings,
  resetTweaksToDefault,
} from '@/lib/api/devices'
import type { DeviceTweak, TweakType } from '@/types/devices'

export interface TweakValue {
  tweak_id: number
  setting_id: string
  setting_name: string
  setting_type: TweakType
  default_value: string | number | boolean
  current_value: string | number | boolean
  power_impact: number
  description: string
  options?: { value: string; label: string; power_delta: number }[]
}

export interface TweakPreset {
  name: string
  settings: Record<string, string | number | boolean>
  created_at: string
}

const PRESETS_KEY_PREFIX = 'unlabs_tweak_presets_'

interface UseTweakPanelProps {
  deviceId: string
  playerId: string
}

export function useTweakPanel({ deviceId, playerId }: UseTweakPanelProps) {
  const [tweaks, setTweaks] = useState<TweakValue[]>([])
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [presets, setPresets] = useState<TweakPreset[]>([])

  // Load tweaks + player overrides
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [defs, playerSettings] = await Promise.all([
          getDeviceTweaks(deviceId),
          getPlayerTweakSettings(playerId, deviceId).catch(() => ({} as Record<string, string | number | boolean>)),
        ])
        if (cancelled) return

        const merged: TweakValue[] = defs.map((t) => ({
          tweak_id: t.tweak_id,
          setting_id: t.setting_id,
          setting_name: t.setting_name,
          setting_type: t.setting_type,
          default_value: t.default_value,
          current_value: playerSettings[t.setting_id] ?? t.default_value,
          power_impact: t.power_impact,
          description: t.description,
          options: t.options,
        }))

        setTweaks(merged)
        setDirty(false)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load tweaks')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    // Load presets from localStorage
    try {
      const raw = typeof window !== 'undefined'
        ? localStorage.getItem(PRESETS_KEY_PREFIX + deviceId)
        : null
      if (raw) setPresets(JSON.parse(raw))
    } catch { /* ignore */ }

    return () => { cancelled = true }
  }, [deviceId, playerId])

  // Update a single tweak value
  const setValue = useCallback((settingId: string, value: string | number | boolean) => {
    setTweaks((prev) =>
      prev.map((t) =>
        t.setting_id === settingId ? { ...t, current_value: value } : t
      )
    )
    setDirty(true)
  }, [])

  // Reorder for priority_list tweaks
  const reorder = useCallback((settingId: string, fromIndex: number, toIndex: number) => {
    setTweaks((prev) =>
      prev.map((t) => {
        if (t.setting_id !== settingId || t.setting_type !== 'priority_list') return t
        // current_value is a comma-separated list
        const items = String(t.current_value).split(',').filter(Boolean)
        if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return t
        const [moved] = items.splice(fromIndex, 1)
        items.splice(toIndex, 0, moved)
        return { ...t, current_value: items.join(',') }
      })
    )
    setDirty(true)
  }, [])

  // Power impact calculations
  const powerImpact = useMemo(() => {
    let defaultTotal = 0
    let currentTotal = 0

    for (const t of tweaks) {
      if (t.setting_type === 'radio' && t.options) {
        const defaultOpt = t.options.find((o) => o.value === String(t.default_value))
        const currentOpt = t.options.find((o) => o.value === String(t.current_value))
        defaultTotal += defaultOpt?.power_delta ?? 0
        currentTotal += currentOpt?.power_delta ?? 0
      } else if (t.setting_type === 'toggle') {
        if (t.current_value === true || t.current_value === 'true') {
          currentTotal += t.power_impact
        }
        if (t.default_value === true || t.default_value === 'true') {
          defaultTotal += t.power_impact
        }
      } else if (t.setting_type === 'slider') {
        const defaultPct = Number(t.default_value) || 0
        const currentPct = Number(t.current_value) || 0
        defaultTotal += t.power_impact * (defaultPct / 100)
        currentTotal += t.power_impact * (currentPct / 100)
      }
    }

    return {
      default_power: defaultTotal,
      current_power: currentTotal,
      delta: currentTotal - defaultTotal,
    }
  }, [tweaks])

  // Save to server
  const save = useCallback(async () => {
    try {
      setSaving(true)
      const settings: Record<string, string | number | boolean> = {}
      for (const t of tweaks) {
        settings[t.setting_id] = t.current_value
      }
      await savePlayerTweakSettings(playerId, deviceId, settings)
      setDirty(false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save tweaks')
    } finally {
      setSaving(false)
    }
  }, [tweaks, playerId, deviceId])

  // Reset to defaults
  const reset = useCallback(async () => {
    try {
      setSaving(true)
      await resetTweaksToDefault(playerId, deviceId)
      setTweaks((prev) =>
        prev.map((t) => ({ ...t, current_value: t.default_value }))
      )
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset tweaks')
    } finally {
      setSaving(false)
    }
  }, [playerId, deviceId])

  // Preset management
  const savePreset = useCallback((name: string) => {
    const settings: Record<string, string | number | boolean> = {}
    for (const t of tweaks) {
      settings[t.setting_id] = t.current_value
    }
    const preset: TweakPreset = { name, settings, created_at: new Date().toISOString() }
    const updated = [...presets.filter((p) => p.name !== name), preset]
    setPresets(updated)
    try {
      localStorage.setItem(PRESETS_KEY_PREFIX + deviceId, JSON.stringify(updated))
    } catch { /* ignore */ }
  }, [tweaks, presets, deviceId])

  const loadPreset = useCallback((preset: TweakPreset) => {
    setTweaks((prev) =>
      prev.map((t) => ({
        ...t,
        current_value: preset.settings[t.setting_id] ?? t.current_value,
      }))
    )
    setDirty(true)
  }, [])

  const deletePreset = useCallback((name: string) => {
    const updated = presets.filter((p) => p.name !== name)
    setPresets(updated)
    try {
      localStorage.setItem(PRESETS_KEY_PREFIX + deviceId, JSON.stringify(updated))
    } catch { /* ignore */ }
  }, [presets, deviceId])

  // Group tweaks by type
  const grouped = useMemo(() => {
    const groups: Record<TweakType, TweakValue[]> = {
      radio: [],
      toggle: [],
      slider: [],
      priority_list: [],
    }
    for (const t of tweaks) {
      groups[t.setting_type].push(t)
    }
    return groups
  }, [tweaks])

  return {
    tweaks,
    grouped,
    dirty,
    loading,
    saving,
    error,
    powerImpact,
    presets,
    setValue,
    reorder,
    save,
    reset,
    savePreset,
    loadPreset,
    deletePreset,
  }
}
