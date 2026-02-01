'use client'

import { useEffect, useState, useCallback } from 'react'
import { SectionBox } from '../controls/SectionBox'
import { Toggle } from '../controls/Toggle'
import { Slider } from '../controls/Slider'
import { RadioGroup } from '../controls/RadioGroup'
import { Dropdown } from '../controls/Dropdown'
import { getDisplayPrefs, updateDisplayPrefs, getThemes, getFonts, logPrefChange } from '@/lib/api/sysprefs'
import type { DbPlayerDisplayPrefs, DbDisplayTheme, DbDisplayFont } from '@/types/database'

interface DisplayPanelProps {
  userId: string
  onDirty: (dirty: boolean) => void
  onSaveError: (msg: string) => void
  saveSignal: number
  resetSignal: number
}

export function DisplayPanel({ userId, onDirty, onSaveError, saveSignal, resetSignal }: DisplayPanelProps) {
  const [prefs, setPrefs] = useState<DbPlayerDisplayPrefs | null>(null)
  const [original, setOriginal] = useState<DbPlayerDisplayPrefs | null>(null)
  const [themes, setThemes] = useState<DbDisplayTheme[]>([])
  const [fonts, setFonts] = useState<DbDisplayFont[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getDisplayPrefs(userId),
      getThemes(),
      getFonts(),
    ]).then(([p, t, f]) => {
      setPrefs(p)
      setOriginal(p)
      setThemes(t)
      setFonts(f)
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load display preferences')
    }).finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!prefs || !original) return
    onDirty(JSON.stringify(prefs) !== JSON.stringify(original))
  }, [prefs, original, onDirty])

  // Save with audit logging
  useEffect(() => {
    if (saveSignal === 0 || !prefs || !original) return
    const { id, player_id, created_at, updated_at, ...updates } = prefs
    updateDisplayPrefs(userId, updates)
      .then((saved) => {
        // Audit log changed fields
        const changedKeys = Object.keys(updates) as (keyof typeof updates)[]
        for (const key of changedKeys) {
          const oldVal = String(original[key as keyof DbPlayerDisplayPrefs] ?? '')
          const newVal = String(prefs[key as keyof DbPlayerDisplayPrefs] ?? '')
          if (oldVal !== newVal) {
            logPrefChange(userId, 'display', key, oldVal, newVal, userId).catch(() => {})
          }
        }
        setPrefs(saved)
        setOriginal(saved)
      })
      .catch((err) => {
        onSaveError(err instanceof Error ? err.message : 'Failed to save display preferences')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal])

  useEffect(() => {
    if (resetSignal === 0 || !original) return
    setPrefs(original)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  const update = useCallback(<K extends keyof DbPlayerDisplayPrefs>(key: K, value: DbPlayerDisplayPrefs[K]) => {
    setPrefs(prev => prev ? { ...prev, [key]: value } : prev)
  }, [])

  if (loading) return <div className="p-2">Loading display preferences...</div>
  if (loadError) return <div className="p-2 text-[var(--state-error,#FF3300)]">Error: {loadError}</div>
  if (!prefs) return <div className="p-2 text-[var(--state-error,#FF3300)]">Failed to load display preferences</div>

  const themeOptions = themes.map(t => ({
    value: t.id,
    label: t.name,
    description: t.description ?? undefined,
  }))
  themeOptions.push({ value: 'custom', label: 'Custom...', description: 'Set custom colors' })

  const fontOptions = fonts.map(f => ({ value: f.name, label: `${f.name} (${f.style})` }))

  const cursorOptions = [
    { value: 'block', label: 'Block \u2588' },
    { value: 'underline', label: 'Underline _' },
    { value: 'bar', label: 'Bar \u2502' },
  ]

  const promptOptions = [
    { value: 'standard', label: 'Standard' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'full', label: 'Full' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div className="overflow-y-auto space-y-1">
      <SectionBox title="COLOR THEME">
        <RadioGroup
          label="Theme"
          options={themeOptions}
          value={prefs.theme}
          onChange={(v) => {
            update('theme', v)
            const theme = themes.find(t => t.id === v)
            if (theme) {
              update('primary_color', theme.primary_color)
              update('secondary_color', theme.secondary_color)
              update('background_color', theme.background_color)
            }
          }}
        />
        {prefs.theme === 'custom' && (
          <div className="mt-1 pl-4 space-y-0.5">
            <ColorRow label="Primary" value={prefs.primary_color} onChange={(v) => update('primary_color', v)} />
            <ColorRow label="Secondary" value={prefs.secondary_color} onChange={(v) => update('secondary_color', v)} />
            <ColorRow label="Background" value={prefs.background_color} onChange={(v) => update('background_color', v)} />
          </div>
        )}
      </SectionBox>

      <SectionBox title="CRT EFFECTS">
        <Toggle label="Scanlines" value={prefs.effect_scanlines} onChange={(v) => update('effect_scanlines', v)} />
        <Toggle label="Screen Curve" value={prefs.effect_curvature} onChange={(v) => update('effect_curvature', v)} />
        <Toggle label="Text Flicker" value={prefs.effect_flicker} onChange={(v) => update('effect_flicker', v)} />
        <Slider label="Phosphor Glow" value={prefs.effect_glow_intensity} min={0} max={100} onChange={(v) => update('effect_glow_intensity', v)} />
        <Toggle label="Glitch Effects" value={prefs.effect_glitch} onChange={(v) => update('effect_glitch', v)} />
        <Toggle label="Matrix Rain" value={prefs.effect_matrix_rain} onChange={(v) => update('effect_matrix_rain', v)} />
      </SectionBox>

      <SectionBox title="TYPOGRAPHY">
        <Dropdown label="Font Family" options={fontOptions} value={prefs.font_family} onChange={(v) => update('font_family', v)} />
        <Slider label="Font Size" value={prefs.font_size} min={8} max={32} showPercent={false} suffix="px" onChange={(v) => update('font_size', v)} />
        <Slider label="Line Spacing" value={Math.round(Number(prefs.line_spacing) * 100)} min={100} max={250} showPercent={false} suffix="%" onChange={(v) => update('line_spacing', v / 100)} />
        <Slider label="Letter Spacing" value={Math.round(Number(prefs.letter_spacing) * 1000)} min={0} max={200} showPercent={false} suffix="" onChange={(v) => update('letter_spacing', v / 1000)} />
      </SectionBox>

      <SectionBox title="TERMINAL">
        <Slider label="Columns" value={prefs.terminal_columns} min={40} max={200} showPercent={false} onChange={(v) => update('terminal_columns', v)} />
        <Slider label="Rows" value={prefs.terminal_rows} min={15} max={60} showPercent={false} onChange={(v) => update('terminal_rows', v)} />
        <Dropdown label="Cursor Style" options={cursorOptions} value={prefs.cursor_style} onChange={(v) => update('cursor_style', v)} />
        <Dropdown label="Prompt Style" options={promptOptions} value={prefs.prompt_style} onChange={(v) => update('prompt_style', v)} />
        <Toggle label="Cursor Blink" value={prefs.cursor_blink} onChange={(v) => update('cursor_blink', v)} />
      </SectionBox>

      <SectionBox title="ACCESSIBILITY">
        <Toggle label="Plain Mode" value={prefs.plain_mode} onChange={(v) => update('plain_mode', v)} description="Disable all CRT effects" />
        <Toggle label="High Contrast" value={prefs.high_contrast} onChange={(v) => update('high_contrast', v)} />
        <Toggle label="Large Text" value={prefs.large_text} onChange={(v) => update('large_text', v)} description="150% font size" />
        <Toggle label="Reduced Motion" value={prefs.reduced_motion} onChange={(v) => update('reduced_motion', v)} />
      </SectionBox>
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-[12ch]">{label}:</span>
      <span style={{ color: value }}>{'\u2588\u2588'}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border border-current px-1 w-[9ch] font-mono text-inherit"
        maxLength={7}
      />
    </div>
  )
}
