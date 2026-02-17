'use client'

import { useEffect, useState, useCallback } from 'react'
import { SectionBox } from '../controls/SectionBox'
import { Toggle } from '../controls/Toggle'
import { Dropdown } from '../controls/Dropdown'
import { updateDatetimePrefs, logPrefChange } from '@/lib/api/sysprefs'
import { getDatetimePrefsServer, getSystemConfigServer } from '@/lib/api/sysprefs-server'
import type { DbPlayerDatetimePrefs, DbSystemConfigCache } from '@/types/database'

interface DatetimePanelProps {
  userId: string
  onDirty: (dirty: boolean) => void
  onSaveError: (msg: string) => void
  saveSignal: number
  resetSignal: number
}

// Common timezone list
const timezoneOptions = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'US Eastern (EST/EDT)' },
  { value: 'America/Chicago', label: 'US Central (CST/CDT)' },
  { value: 'America/Denver', label: 'US Mountain (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (PST/PDT)' },
  { value: 'Europe/London', label: 'UK (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Central Europe (CET/CEST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Australia Eastern (AEST)' },
]

const dateFormatOptions = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'full', label: 'Full (e.g. February 1, 2026)' },
]

const timeFormatOptions = [
  { value: '24', label: '24-hour (14:30:00)' },
  { value: '12', label: '12-hour (2:30:00 PM)' },
]

const weekStartOptions = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
]

export function DatetimePanel({ userId, onDirty, onSaveError, saveSignal, resetSignal }: DatetimePanelProps) {
  const [prefs, setPrefs] = useState<DbPlayerDatetimePrefs | null>(null)
  const [original, setOriginal] = useState<DbPlayerDatetimePrefs | null>(null)
  const [sysConfig, setSysConfig] = useState<DbSystemConfigCache | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    Promise.all([
      getDatetimePrefsServer(userId),
      getSystemConfigServer(),
    ]).then(([p, sc]) => {
      setPrefs(p)
      setOriginal(p)
      setSysConfig(sc)
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load datetime preferences')
    }).finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!prefs || !original) return
    onDirty(JSON.stringify(prefs) !== JSON.stringify(original))
  }, [prefs, original, onDirty])

  useEffect(() => {
    if (saveSignal === 0 || !prefs || !original) return
    const { id, player_id, created_at, updated_at, ...updates } = prefs
    updateDatetimePrefs(userId, updates)
      .then((saved) => {
        const changedKeys = Object.keys(updates) as (keyof typeof updates)[]
        for (const key of changedKeys) {
          const oldVal = String(original[key as keyof DbPlayerDatetimePrefs] ?? '')
          const newVal = String(prefs[key as keyof DbPlayerDatetimePrefs] ?? '')
          if (oldVal !== newVal) {
            logPrefChange(userId, 'datetime', key, oldVal, newVal, userId).catch(() => {})
          }
        }
        setPrefs(saved); setOriginal(saved)
      })
      .catch((err) => {
        onSaveError(err instanceof Error ? err.message : 'Failed to save datetime preferences')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal])

  useEffect(() => {
    if (resetSignal === 0 || !original) return
    setPrefs(original)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  const update = useCallback(<K extends keyof DbPlayerDatetimePrefs>(key: K, value: DbPlayerDatetimePrefs[K]) => {
    setPrefs(prev => prev ? { ...prev, [key]: value } : prev)
  }, [])

  if (loading) return <div className="p-2">Loading datetime preferences...</div>
  if (loadError) return <div className="p-2 text-[var(--state-error,#FF3300)]">Error: {loadError}</div>
  if (!prefs) return <div className="p-2 text-[var(--state-error,#FF3300)]">Failed to load datetime preferences</div>

  // Format current time based on preferences
  const formatTime = () => {
    try {
      const opts: Intl.DateTimeFormatOptions = {
        timeZone: prefs.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: prefs.time_format === '12',
      }
      if (prefs.show_seconds) opts.second = '2-digit'
      return now.toLocaleTimeString('en-US', opts) + (prefs.show_milliseconds ? `.${String(now.getMilliseconds()).padStart(3, '0')}` : '')
    } catch {
      return now.toISOString()
    }
  }

  const formatDate = () => {
    try {
      const opts: Intl.DateTimeFormatOptions = { timeZone: prefs.timezone }
      switch (prefs.date_format) {
        case 'full':
          return now.toLocaleDateString('en-US', { ...opts, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        case 'DD/MM/YYYY':
          return now.toLocaleDateString('en-GB', { ...opts, day: '2-digit', month: '2-digit', year: 'numeric' })
        case 'MM/DD/YYYY':
          return now.toLocaleDateString('en-US', { ...opts, day: '2-digit', month: '2-digit', year: 'numeric' })
        default:
          return now.toISOString().slice(0, 10)
      }
    } catch {
      return now.toISOString().slice(0, 10)
    }
  }

  return (
    <div className="overflow-y-auto space-y-1">
      <SectionBox title="CURRENT TIME">
        <div className="text-center py-2">
          <div className="text-2xl tracking-wider">{formatTime()}</div>
          <div className="text-sm mt-1">{formatDate()}</div>
          <div className="text-xs text-[var(--state-offline,#666)] mt-1">{prefs.timezone}</div>
        </div>
      </SectionBox>

      <SectionBox title="TIMEZONE">
        <Dropdown label="Timezone" options={timezoneOptions} value={prefs.timezone} onChange={(v) => update('timezone', v)} />
      </SectionBox>

      <SectionBox title="FORMAT">
        <Dropdown label="Time Format" options={timeFormatOptions} value={prefs.time_format} onChange={(v) => update('time_format', v)} />
        <Dropdown label="Date Format" options={dateFormatOptions} value={prefs.date_format} onChange={(v) => update('date_format', v)} />
        <Toggle label="Show Seconds" value={prefs.show_seconds} onChange={(v) => update('show_seconds', v)} />
        <Toggle label="Show Milliseconds" value={prefs.show_milliseconds} onChange={(v) => update('show_milliseconds', v)} />
        <Dropdown label="Week Starts" options={weekStartOptions} value={prefs.first_day_of_week} onChange={(v) => update('first_day_of_week', v)} />
      </SectionBox>

      {sysConfig && (
        <SectionBox title="NTP SYNC (READ-ONLY)">
          <Row label="NTP" value={sysConfig.ntp_enabled ? 'ENABLED' : 'DISABLED'} />
          <Row label="Servers" value={sysConfig.ntp_servers.join(', ')} />
          <Row label="Interval" value={`${sysConfig.ntp_interval_seconds}s`} />
          <Row label="Last Sync" value={sysConfig.last_ntp_sync ?? 'Never'} />
        </SectionBox>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="min-w-[16ch] text-[var(--state-offline,#666)]">{label}:</span>
      <span>{value}</span>
    </div>
  )
}
