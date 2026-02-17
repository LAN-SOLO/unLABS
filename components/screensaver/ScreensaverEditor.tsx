'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Slider } from '../sysprefs/controls/Slider'
import { Dropdown } from '../sysprefs/controls/Dropdown'
import { Toggle } from '../sysprefs/controls/Toggle'
import { RadioGroup } from '../sysprefs/controls/RadioGroup'
import { ScreensaverCanvas } from './ScreensaverCanvas'
import { loadScreensaverConfig, saveScreensaverConfig, ALL_PATTERNS, PATTERN_LABELS } from './types'
import type { ScreensaverConfig, ScreensaverPattern, PatternParamsMap } from './types'

interface ScreensaverEditorProps {
  onFullScreen: () => void
}

export function ScreensaverEditor({ onFullScreen }: ScreensaverEditorProps) {
  const [config, setConfig] = useState<ScreensaverConfig>(loadScreensaverConfig)
  const resolvedColorRef = useRef('#00FF41')
  const [resolvedColor, setResolvedColor] = useState('#00FF41')

  // Resolve theme color
  useEffect(() => {
    if (config.colorSource === 'theme') {
      const el = document.documentElement
      const computed = getComputedStyle(el).getPropertyValue('--neon-amber').trim()
      const c = computed || '#00FF41'
      resolvedColorRef.current = c
      setResolvedColor(c)
    } else {
      resolvedColorRef.current = config.customColor
      setResolvedColor(config.customColor)
    }
  }, [config.colorSource, config.customColor])

  const updateConfig = useCallback((updater: (prev: ScreensaverConfig) => ScreensaverConfig) => {
    setConfig(prev => {
      const next = updater(prev)
      saveScreensaverConfig(next)
      return next
    })
  }, [])

  const setPattern = useCallback((p: string) => {
    updateConfig(c => ({ ...c, activePattern: p as ScreensaverPattern }))
  }, [updateConfig])

  const setPatternParam = useCallback((key: string, value: unknown) => {
    updateConfig(c => ({
      ...c,
      patterns: {
        ...c.patterns,
        [c.activePattern]: {
          ...c.patterns[c.activePattern],
          [key]: value,
        },
      },
    }))
  }, [updateConfig])

  const pattern = config.activePattern
  const params = config.patterns[pattern]

  const patternOptions = ALL_PATTERNS.map(p => ({ value: p, label: PATTERN_LABELS[p] }))

  return (
    <div className="space-y-2">
      {/* Pattern selector */}
      <Dropdown label="Pattern" options={patternOptions} value={pattern} onChange={setPattern} />

      {/* Live preview */}
      <div className="flex justify-center py-1">
        <div className="border border-current" style={{ lineHeight: 0 }}>
          <ScreensaverCanvas
            pattern={pattern}
            params={params}
            color={resolvedColor}
            brightness={config.globalBrightness}
            width={240}
            height={160}
            crtOverlay={config.crtOverlay}
          />
        </div>
      </div>

      {/* Pattern-specific settings */}
      <div className="border-t border-current pt-1">
        <div className="text-center text-xs opacity-60 mb-1">PATTERN SETTINGS</div>
        <PatternControls pattern={pattern} params={params} setParam={setPatternParam} />
      </div>

      {/* Appearance settings */}
      <div className="border-t border-current pt-1">
        <div className="text-center text-xs opacity-60 mb-1">APPEARANCE</div>
        <RadioGroup
          label="Color Source"
          options={[
            { value: 'theme', label: 'Theme' },
            { value: 'custom', label: 'Custom' },
          ]}
          value={config.colorSource}
          onChange={(v) => updateConfig(c => ({ ...c, colorSource: v as 'theme' | 'custom' }))}
        />
        {config.colorSource === 'custom' && (
          <div className="flex items-center gap-2 px-1 py-0.5">
            <span className="whitespace-nowrap inline-block w-[18ch] text-right">Custom Color:</span>
            <label className="relative cursor-pointer" title="Pick color">
              <span style={{ color: config.customColor }}>{'\u2588\u2588'}</span>
              <input
                type="color"
                value={config.customColor}
                onChange={(e) => updateConfig(c => ({ ...c, customColor: e.target.value.toUpperCase() }))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            <input
              type="text"
              value={config.customColor}
              onChange={(e) => {
                const v = e.target.value
                if (v.match(/^#[0-9A-Fa-f]{0,6}$/)) updateConfig(c => ({ ...c, customColor: v.toUpperCase() }))
              }}
              className="bg-transparent border border-current px-1 w-[9ch] font-mono text-inherit"
              maxLength={7}
            />
          </div>
        )}
        <Slider
          label="Brightness"
          value={config.globalBrightness}
          min={10}
          max={100}
          onChange={(v) => updateConfig(c => ({ ...c, globalBrightness: v }))}
        />
        <Toggle
          label="CRT Overlay"
          value={config.crtOverlay}
          onChange={(v) => updateConfig(c => ({ ...c, crtOverlay: v }))}
        />
      </div>

      {/* Full screen button */}
      <div className="pt-1 flex justify-center">
        <button
          className="px-4 py-1 border border-current hover:bg-[rgba(255,170,0,0.1)] cursor-pointer font-mono"
          onClick={onFullScreen}
        >
          {'▶ FULL SCREEN'}
        </button>
      </div>
    </div>
  )
}

// ─── Pattern-specific controls ─────────────────────────────────────
function PatternControls({ pattern, params, setParam }: {
  pattern: ScreensaverPattern
  params: PatternParamsMap[ScreensaverPattern]
  setParam: (key: string, value: unknown) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = params as any
  switch (pattern) {
    case 'moire':
      return (
        <>
          <Slider label="Ring Count" value={p.ringCount} min={3} max={20} onChange={(v) => setParam('ringCount', v)} showPercent={false} />
          <Slider label="Rotation Speed" value={p.rotationSpeed} min={1} max={100} onChange={(v) => setParam('rotationSpeed', v)} />
          <Slider label="Line Width" value={p.lineWidth} min={1} max={5} onChange={(v) => setParam('lineWidth', v)} showPercent={false} suffix="px" />
          <Slider label="Center Distance" value={p.centerDistance} min={10} max={100} onChange={(v) => setParam('centerDistance', v)} />
        </>
      )
    case 'lissajous':
      return (
        <>
          <Slider label="Frequency A" value={p.freqA} min={1} max={20} onChange={(v) => setParam('freqA', v)} showPercent={false} />
          <Slider label="Frequency B" value={p.freqB} min={1} max={20} onChange={(v) => setParam('freqB', v)} showPercent={false} />
          <Slider label="Phase Speed" value={p.phaseSpeed} min={1} max={100} onChange={(v) => setParam('phaseSpeed', v)} />
          <Slider label="Trail Length" value={p.trailLength} min={10} max={500} onChange={(v) => setParam('trailLength', v)} showPercent={false} />
        </>
      )
    case 'plasma':
      return (
        <>
          <Slider label="Scale" value={p.scale} min={1} max={100} onChange={(v) => setParam('scale', v)} />
          <Slider label="Speed" value={p.speed} min={1} max={100} onChange={(v) => setParam('speed', v)} />
          <Slider label="Complexity" value={p.complexity} min={1} max={5} onChange={(v) => setParam('complexity', v)} showPercent={false} />
          <Dropdown label="Palette" options={[
            { value: 'neon', label: 'Neon' },
            { value: 'fire', label: 'Fire' },
            { value: 'ocean', label: 'Ocean' },
            { value: 'acid', label: 'Acid' },
            { value: 'mono', label: 'Mono' },
          ]} value={p.palette} onChange={(v) => setParam('palette', v)} />
        </>
      )
    case 'tunnel':
      return (
        <>
          <Slider label="Ring Count" value={p.ringCount} min={5} max={30} onChange={(v) => setParam('ringCount', v)} showPercent={false} />
          <Slider label="Speed" value={p.speed} min={1} max={100} onChange={(v) => setParam('speed', v)} />
          <Slider label="Rotation Speed" value={p.rotationSpeed} min={0} max={100} onChange={(v) => setParam('rotationSpeed', v)} />
          <Dropdown label="Shape" options={[
            { value: 'circle', label: 'Circle' },
            { value: 'hex', label: 'Hexagon' },
            { value: 'square', label: 'Square' },
          ]} value={p.shape} onChange={(v) => setParam('shape', v)} />
        </>
      )
    case 'spirograph':
      return (
        <>
          <Slider label="Outer Radius" value={p.outerRadius} min={20} max={100} onChange={(v) => setParam('outerRadius', v)} />
          <Slider label="Inner Radius" value={p.innerRadius} min={5} max={60} onChange={(v) => setParam('innerRadius', v)} />
          <Slider label="Pen Offset" value={p.penOffset} min={5} max={80} onChange={(v) => setParam('penOffset', v)} />
          <Slider label="Speed" value={p.speed} min={1} max={100} onChange={(v) => setParam('speed', v)} />
          <Slider label="Fade Rate" value={p.fadeRate} min={0} max={100} onChange={(v) => setParam('fadeRate', v)} />
        </>
      )
    case 'matrix':
      return (
        <>
          <Slider label="Density" value={p.density} min={1} max={100} onChange={(v) => setParam('density', v)} />
          <Slider label="Speed" value={p.speed} min={1} max={100} onChange={(v) => setParam('speed', v)} />
          <Slider label="Font Size" value={p.fontSize} min={8} max={24} onChange={(v) => setParam('fontSize', v)} showPercent={false} suffix="px" />
          <Dropdown label="Charset" options={[
            { value: 'katakana', label: 'Katakana' },
            { value: 'latin', label: 'Latin' },
            { value: 'binary', label: 'Binary' },
            { value: 'hex', label: 'Hex' },
            { value: 'mixed', label: 'Mixed' },
          ]} value={p.charset} onChange={(v) => setParam('charset', v)} />
        </>
      )
    case 'warp':
      return (
        <>
          <Slider label="Star Count" value={p.starCount} min={50} max={500} onChange={(v) => setParam('starCount', v)} showPercent={false} />
          <Slider label="Speed" value={p.speed} min={1} max={100} onChange={(v) => setParam('speed', v)} />
          <Slider label="Trail Length" value={p.trailLength} min={0} max={100} onChange={(v) => setParam('trailLength', v)} />
          <Slider label="FOV" value={p.fov} min={30} max={120} onChange={(v) => setParam('fov', v)} showPercent={false} suffix="°" />
        </>
      )
    default:
      return null
  }
}
