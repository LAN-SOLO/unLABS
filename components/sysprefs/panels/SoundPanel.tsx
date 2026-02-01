'use client'

import { useEffect, useState, useCallback } from 'react'
import { SectionBox } from '../controls/SectionBox'
import { Toggle } from '../controls/Toggle'
import { Slider } from '../controls/Slider'
import { Dropdown } from '../controls/Dropdown'
import { getSoundPrefs, updateSoundPrefs, getSoundProfiles } from '@/lib/api/sysprefs'
import type { DbPlayerSoundPrefs, DbSoundProfile } from '@/types/database'

interface SoundPanelProps {
  userId: string
  onDirty: (dirty: boolean) => void
  saveSignal: number
  resetSignal: number
}

export function SoundPanel({ userId, onDirty, saveSignal, resetSignal }: SoundPanelProps) {
  const [prefs, setPrefs] = useState<DbPlayerSoundPrefs | null>(null)
  const [original, setOriginal] = useState<DbPlayerSoundPrefs | null>(null)
  const [profiles, setProfiles] = useState<DbSoundProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getSoundPrefs(userId),
      getSoundProfiles(),
    ]).then(([p, pr]) => {
      setPrefs(p)
      setOriginal(p)
      setProfiles(pr)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!prefs || !original) return
    onDirty(JSON.stringify(prefs) !== JSON.stringify(original))
  }, [prefs, original, onDirty])

  useEffect(() => {
    if (saveSignal === 0 || !prefs) return
    const { id, player_id, created_at, updated_at, ...updates } = prefs
    updateSoundPrefs(userId, updates)
      .then((saved) => { setPrefs(saved); setOriginal(saved) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal])

  useEffect(() => {
    if (resetSignal === 0 || !original) return
    setPrefs(original)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  const update = useCallback(<K extends keyof DbPlayerSoundPrefs>(key: K, value: DbPlayerSoundPrefs[K]) => {
    setPrefs(prev => prev ? { ...prev, [key]: value } : prev)
  }, [])

  if (loading) return <div className="p-2">Loading sound preferences...</div>
  if (!prefs) return <div className="p-2 text-red-400">Failed to load sound preferences</div>

  const profileOptions = profiles.map(p => ({ value: p.id, label: `${p.name} — ${p.description ?? ''}` }))

  return (
    <div className="overflow-y-auto space-y-1">
      <SectionBox title="MASTER AUDIO">
        <Slider label="Master Volume" value={prefs.master_volume} min={0} max={100} onChange={(v) => update('master_volume', v)} />
        <Toggle label="Muted" value={prefs.muted} onChange={(v) => update('muted', v)} />
        <Dropdown label="Sound Profile" options={profileOptions} value={prefs.sound_profile} onChange={(v) => update('sound_profile', v)} />
      </SectionBox>

      <SectionBox title="TERMINAL SOUNDS">
        <Toggle label="Key Clicks" value={prefs.terminal_clicks} onChange={(v) => update('terminal_clicks', v)} />
        <Slider label="  Click Vol" value={prefs.terminal_clicks_volume} min={0} max={100} onChange={(v) => update('terminal_clicks_volume', v)} />
        <Toggle label="Command Beeps" value={prefs.command_beeps} onChange={(v) => update('command_beeps', v)} />
        <Slider label="  Beep Vol" value={prefs.command_beeps_volume} min={0} max={100} onChange={(v) => update('command_beeps_volume', v)} />
        <Toggle label="Error Buzzer" value={prefs.error_buzzer} onChange={(v) => update('error_buzzer', v)} />
        <Slider label="  Error Vol" value={prefs.error_buzzer_volume} min={0} max={100} onChange={(v) => update('error_buzzer_volume', v)} />
        <Toggle label="Success Chime" value={prefs.success_chime} onChange={(v) => update('success_chime', v)} />
        <Slider label="  Chime Vol" value={prefs.success_chime_volume} min={0} max={100} onChange={(v) => update('success_chime_volume', v)} />
        <Toggle label="Tab Complete" value={prefs.tab_complete_sound} onChange={(v) => update('tab_complete_sound', v)} />
        <Slider label="  Tab Vol" value={prefs.tab_complete_volume} min={0} max={100} onChange={(v) => update('tab_complete_volume', v)} />
      </SectionBox>

      <SectionBox title="AMBIENT SOUNDS">
        <Toggle label="Background Hum" value={prefs.background_hum} onChange={(v) => update('background_hum', v)} />
        <Slider label="  Hum Vol" value={prefs.background_hum_volume} min={0} max={100} onChange={(v) => update('background_hum_volume', v)} />
        <Toggle label="Idle Static" value={prefs.idle_static} onChange={(v) => update('idle_static', v)} />
        <Slider label="  Static Vol" value={prefs.idle_static_volume} min={0} max={100} onChange={(v) => update('idle_static_volume', v)} />
        <Toggle label="Device Whir" value={prefs.device_whir} onChange={(v) => update('device_whir', v)} />
        <Slider label="  Whir Vol" value={prefs.device_whir_volume} min={0} max={100} onChange={(v) => update('device_whir_volume', v)} />
        <Toggle label="Quantum Whisper" value={prefs.quantum_whisper} onChange={(v) => update('quantum_whisper', v)} />
        <Slider label="  Whisper Vol" value={prefs.quantum_whisper_volume} min={0} max={100} onChange={(v) => update('quantum_whisper_volume', v)} />
      </SectionBox>

      <SectionBox title="NOTIFICATIONS">
        <Toggle label="Research Complete" value={prefs.notification_research_complete} onChange={(v) => update('notification_research_complete', v)} />
        <Toggle label="Trade Accepted" value={prefs.notification_trade_accepted} onChange={(v) => update('notification_trade_accepted', v)} />
        <Toggle label="Volatility Alert" value={prefs.notification_volatility_alert} onChange={(v) => update('notification_volatility_alert', v)} />
        <Toggle label="Quest Complete" value={prefs.notification_quest_complete} onChange={(v) => update('notification_quest_complete', v)} />
        <Slider label="Notify Volume" value={prefs.notification_volume} min={0} max={100} onChange={(v) => update('notification_volume', v)} />
        <Toggle label="Voice Alerts" value={prefs.voice_alerts} onChange={(v) => update('voice_alerts', v)} />
      </SectionBox>
    </div>
  )
}
