'use client'

import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Knob } from '../controls/Knob'
import { LED } from '../controls/LED'
import { Slider } from '../controls/Slider'
import { CRTScreen } from './CRTScreen'
import { Waveform } from './Waveform'

interface OscilloscopeProps {
  walletAddress?: string
  balance?: number
  frequency1?: number
  frequency2?: number
  onConnect?: () => void
  className?: string
}

// Color options for waveform
const WAVEFORM_COLORS = [
  { label: 'R', value: 209, hex: '#ff0000' },
  { label: 'G', value: 7, hex: '#00ff00' },
  { label: 'B', value: 121, hex: '#0066ff' },
  { label: 'C', value: 0, hex: '#00ffff' },
  { label: 'M', value: 97, hex: '#ff00ff' },
  { label: 'Y', value: 42, hex: '#ffff00' },
  { label: 'K', value: 18, hex: '#888888' },
  { label: 'oR', value: 1, hex: '#ff6600' },
  { label: 'oG', value: 7, hex: '#66ff00' },
  { label: 'oB', value: 79, hex: '#0066ff' },
]

export function Oscilloscope({
  walletAddress = 'EfiL....B82M',
  balance = 0,
  frequency1: defaultFreq1 = 2.0,
  frequency2: defaultFreq2 = 3.0,
  onConnect,
  className,
}: OscilloscopeProps) {
  // Control states
  const [intensity, setIntensity] = useState(70)
  const [focus, setFocus] = useState(50)

  // Feature states
  const [waveType, setWaveType] = useState<'sine' | 'square' | 'sawtooth' | 'noise'>('sine')
  const [preset, setPreset] = useState('default')
  const [isConnected, setIsConnected] = useState(false)
  const [maikActive, setMaikActive] = useState(false)

  // Color mixing - track selected colors and their intensity
  const [selectedColors, setSelectedColors] = useState<Record<string, number>>({ 'G': 100 })

  // Mix selected colors to create final waveform color
  const waveColor = useMemo(() => {
    const selected = Object.entries(selectedColors).filter(([_, v]) => v > 0)
    if (selected.length === 0) return '#00ff66'

    let r = 0, g = 0, b = 0, total = 0

    selected.forEach(([label, intensity]) => {
      const color = WAVEFORM_COLORS.find(c => c.label === label)
      if (color) {
        // Parse hex to RGB
        const hex = color.hex.replace('#', '')
        const cr = parseInt(hex.substring(0, 2), 16)
        const cg = parseInt(hex.substring(2, 4), 16)
        const cb = parseInt(hex.substring(4, 6), 16)

        // Add weighted by intensity
        const weight = intensity / 100
        r += cr * weight
        g += cg * weight
        b += cb * weight
        total += weight
      }
    })

    if (total > 0) {
      r = Math.min(255, Math.round(r / total))
      g = Math.min(255, Math.round(g / total))
      b = Math.min(255, Math.round(b / total))
    }

    return `rgb(${r}, ${g}, ${b})`
  }, [selectedColors])

  // Toggle color selection
  const toggleColor = (label: string) => {
    setSelectedColors(prev => {
      const newColors = { ...prev }
      if (newColors[label]) {
        delete newColors[label]
      } else {
        newColors[label] = 100
      }
      return newColors
    })
  }

  // Adjust color intensity
  const adjustColorIntensity = (label: string, delta: number) => {
    setSelectedColors(prev => {
      if (!prev[label]) return prev
      const newIntensity = Math.max(10, Math.min(100, prev[label] + delta))
      return { ...prev, [label]: newIntensity }
    })
  }

  // Slider controls
  const [freq1, setFreq1] = useState(defaultFreq1)
  const [freq2, setFreq2] = useState(defaultFreq2)
  const [interference, setInterference] = useState(60)
  const [wavelength, setWavelength] = useState(10)

  // Checkbox states
  const [interferenceEnabled, setInterferenceEnabled] = useState(false)
  const [is3DEnabled, setIs3DEnabled] = useState(false)

  // New knob controls - Row 1
  const [xGain, setXGain] = useState(0)
  const [yGain, setYGain] = useState(0)
  const [zGain, setZGain] = useState(0)
  const [freqKnob, setFreqKnob] = useState(0)
  const [amplKnob, setAmplKnob] = useState(0)
  const [phaseKnob, setPhaseKnob] = useState(0)

  // New knob controls - Row 2
  const [xOff, setXOff] = useState(0)
  const [yOff, setYOff] = useState(0)
  const [zOff, setZOff] = useState(0)
  const [noiseKnob, setNoiseKnob] = useState(0)
  const [chaosKnob, setChaosKnob] = useState(0)
  const [speedKnob, setSpeedKnob] = useState(0)

  // Audio controls
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [volume, setVolume] = useState(100)
  const [pitch, setPitch] = useState(50)
  const [filter, setFilter] = useState(0)
  const [reverb, setReverb] = useState(0)

  // Sound Tool - Extended state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [bpm, setBpm] = useState(120)
  const [timePosition, setTimePosition] = useState('00:00:00')
  const [inputDevice, setInputDevice] = useState('System Default')
  const [outputDevice, setOutputDevice] = useState('System Default')
  const [midiDevice, setMidiDevice] = useState('None')
  const [sampleRate, setSampleRate] = useState('48000')
  const [bitDepth, setBitDepth] = useState('24')
  const [exportFormat, setExportFormat] = useState('WAV')
  const [soundViewMode, setSoundViewMode] = useState<'SPECTRUM' | 'WAVEFORM' | 'STEREO' | 'LISSAJOUS'>('SPECTRUM')

  // Mixer channels
  const [channels, setChannels] = useState([
    { id: 1, name: 'MAIN', level: 80, pan: 50, mute: false, solo: false, armed: false },
    { id: 2, name: 'AUX1', level: 60, pan: 50, mute: false, solo: false, armed: false },
    { id: 3, name: 'AUX2', level: 70, pan: 30, mute: false, solo: false, armed: false },
    { id: 4, name: 'FX', level: 50, pan: 70, mute: false, solo: false, armed: false },
  ])

  // Effects state
  const [effects, setEffects] = useState({
    eq: { low: 50, mid: 50, high: 50, enabled: false },
    comp: { threshold: 50, ratio: 50, attack: 30, release: 50, enabled: false },
    reverb: { size: 50, decay: 50, mix: 30, enabled: false },
    delay: { time: 50, feedback: 30, mix: 20, enabled: false },
    chorus: { rate: 50, depth: 50, mix: 30, enabled: false },
    distortion: { drive: 50, tone: 50, mix: 20, enabled: false },
  })

  // Recording waveform simulation
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>(Array(60).fill(0))

  // Spectrum analyzer animation state
  const [spectrumData, setSpectrumData] = useState<number[]>(Array(24).fill(5))
  const [vuLeft, setVuLeft] = useState(0)
  const [vuRight, setVuRight] = useState(0)

  // Animate spectrum and recording when audio enabled
  useEffect(() => {
    if (!audioEnabled && !isPlaying && !isRecording) {
      setSpectrumData(Array(24).fill(5))
      setVuLeft(0)
      setVuRight(0)
      return
    }

    let startTime = Date.now()
    const interval = setInterval(() => {
      // Generate random spectrum data influenced by volume
      const volumeFactor = volume / 100
      const newSpectrum = Array.from({ length: 24 }, (_, i) => {
        const baseHeight = 20 + Math.sin(Date.now() * 0.003 + i * 0.5) * 25
        const randomness = Math.random() * 30
        return Math.min(95, Math.max(5, (baseHeight + randomness) * volumeFactor))
      })
      setSpectrumData(newSpectrum)

      // VU meters
      const avgLevel = newSpectrum.reduce((a, b) => a + b, 0) / newSpectrum.length
      setVuLeft(Math.min(20, Math.floor(avgLevel / 5 + Math.random() * 3)))
      setVuRight(Math.min(20, Math.floor(avgLevel / 5 + Math.random() * 3 - 1)))

      // Update time position when playing or recording
      if ((isPlaying || isRecording) && !isPaused) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const hrs = Math.floor(elapsed / 3600).toString().padStart(2, '0')
        const mins = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
        const secs = (elapsed % 60).toString().padStart(2, '0')
        setTimePosition(`${hrs}:${mins}:${secs}`)
      }

      // Animate recording waveform
      if (isRecording && !isPaused) {
        setRecordingWaveform(prev => {
          const newWave = [...prev.slice(1)]
          newWave.push(Math.random() * 80 + 10)
          return newWave
        })
      }
    }, 50)

    return () => clearInterval(interval)
  }, [audioEnabled, isPlaying, isRecording, isPaused, volume])

  // Calculate waveform parameters from knob values and sliders
  const frequency = useMemo(() => {
    const baseFreq = freq1
    const freqMod = 1 + (freqKnob / 100) * 2
    return baseFreq * freqMod
  }, [freq1, freqKnob])

  const amplitude = useMemo(() => {
    const baseAmp = (intensity / 100) * 0.8
    const ampMod = 1 + (amplKnob / 100)
    return baseAmp * ampMod
  }, [intensity, amplKnob])

  const secondFrequency = useMemo(() => {
    return freq2 * (1 + (freqKnob / 100))
  }, [freq2, freqKnob])

  const peakVoltage = useMemo(() => {
    return amplitude * 1.0
  }, [amplitude])

  const intervalTime = useMemo(() => {
    return 1000 / frequency
  }, [frequency])

  // Wavelength affects the horizontal scale
  const wavelengthFactor = useMemo(() => {
    return wavelength / 10
  }, [wavelength])

  // Interference strength
  const interferenceStrength = useMemo(() => {
    return interferenceEnabled ? interference / 100 : 0
  }, [interference, interferenceEnabled])

  // Vertical offset from Y-OFF knob
  const verticalOffset = useMemo(() => {
    return (yOff / 100) * 0.5
  }, [yOff])

  // Phase shift from PHASE knob
  const phaseShift = useMemo(() => {
    return (phaseKnob / 100) * Math.PI * 2
  }, [phaseKnob])

  // Horizontal gain from X-GAIN knob
  const horGainValue = useMemo(() => {
    return 0.5 + (xGain / 100) * 1.5
  }, [xGain])

  // Final amplitude combining Y-GAIN
  const finalAmplitude = useMemo(() => {
    return amplitude * (1 + yGain / 100)
  }, [amplitude, yGain])

  const isAnimated = isConnected || maikActive
  const formattedBalance = balance.toLocaleString()

  // Wave type options
  const waveTypes = ['sine', 'square', 'sawtooth', 'noise'] as const
  const presets = ['default', 'calm', 'chaos', 'pulse', 'ambient']

  // Helper to format knob value
  const formatValue = (v: number) => (v / 100).toFixed(2)

  // Knob with input component
  const KnobWithInput = ({ label, value, setter }: { label: string; value: number; setter: (v: number) => void }) => (
    <div className="flex flex-col items-center">
      <span className="font-mono text-[6px] text-white/60">{label}</span>
      <Knob value={value} onChange={setter} size="sm" accentColor="var(--neon-green)" />
      <input
        type="text"
        value={formatValue(value)}
        onChange={(e) => setter(Math.round(parseFloat(e.target.value || '0') * 100))}
        className="w-8 bg-[#1a2a1a] border border-[#0a1a0a] rounded px-0.5 py-0 font-mono text-[7px] text-white text-center"
      />
    </div>
  )

  return (
    <div
      className={cn(
        'flex flex-col gap-1 p-1.5 rounded-lg w-full h-full overflow-hidden',
        'bg-gradient-to-b from-[#5a6a5a] to-[#4a5a4a]',
        'border border-[#3a4a3a]',
        className
      )}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="font-mono text-[8px] text-white/80">INT</span>
          <Knob value={intensity} onChange={setIntensity} size="sm" accentColor="#ffffff" />
        </div>
        <div className="flex items-center gap-1">
          <LED on={true} color="red" size="sm" />
          <LED on={maikActive} color="amber" size="sm" />
          <LED on={isConnected} color="green" size="sm" />
          <button
            className={cn('px-2 py-1 rounded font-mono text-[8px] font-bold border',
              maikActive ? 'bg-[var(--neon-green)] text-black' : 'bg-[#2a3a2a] text-[var(--neon-green)] border-[#1a2a1a]'
            )}
            onClick={() => setMaikActive(!maikActive)}
          >MAIK</button>
          <button
            className={cn('px-2 py-1 rounded font-mono text-[8px] font-bold border',
              isConnected ? 'bg-[#bfff00] text-black' : 'bg-[#2a2a1a] text-[var(--neon-amber)] border-[var(--neon-amber)]'
            )}
            onClick={() => { setIsConnected(!isConnected); onConnect?.() }}
          >WALLET</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[8px] text-white/80">FOC</span>
          <Knob value={focus} onChange={setFocus} size="sm" accentColor="#ffffff" />
        </div>
      </div>

      {/* CRT Display */}
      <CRTScreen className="h-[345px] w-full flex-shrink-0">
        <div className="relative w-full h-full p-1">
          <Waveform
            type={waveType}
            frequency={frequency * horGainValue}
            amplitude={finalAmplitude}
            color={waveColor}
            width={480}
            height={310}
            animated={isAnimated}
            offset={verticalOffset}
            phase={phaseShift}
            frequency2={secondFrequency}
            interferenceStrength={interferenceStrength}
            wavelengthFactor={wavelengthFactor}
            is3D={is3DEnabled}
            className="w-full h-full"
          />
          <div className="absolute top-1 right-1 font-mono text-[7px] text-[var(--crt-green)] text-right leading-tight">
            <div>F1:{frequency.toFixed(1)}Hz F2:{secondFrequency.toFixed(1)}Hz</div>
            <div className={cn('font-bold', isAnimated ? 'text-[var(--neon-amber)]' : 'text-white/40')}>
              {isAnimated ? '●LIVE' : '○IDLE'}
            </div>
          </div>
        </div>
      </CRTScreen>

      {/* Wallet + Dropdowns row */}
      <div className="flex gap-1 flex-shrink-0">
        <div className="flex-1 bg-gradient-to-r from-[#2a2a6a] to-[#3a3a8a] border border-[#4a4a9a] rounded px-2 py-1 flex items-center justify-between">
          <span className="font-mono text-[8px] text-[var(--neon-cyan)]">WALLET</span>
          <span className="font-mono text-sm text-[var(--neon-cyan)] font-bold">{formattedBalance}</span>
        </div>
        <select value={waveType} onChange={(e) => setWaveType(e.target.value as typeof waveType)}
          className="bg-[#1a2a1a] border border-[#0a1a0a] rounded px-1 py-0.5 font-mono text-[8px] text-white">
          {waveTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={preset} onChange={(e) => setPreset(e.target.value)}
          className="bg-[#1a2a1a] border border-[#0a1a0a] rounded px-1 py-0.5 font-mono text-[8px] text-white">
          {presets.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Sliders row */}
      <div className="flex items-center justify-between bg-[#3a4a3a] border border-[#1a2a1a] rounded p-1 flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="font-mono text-[7px] text-[var(--neon-blue)]">F1</span>
          <Slider value={freq1*10} min={5} max={100} onChange={(v)=>setFreq1(v/10)} orientation="horizontal" height={50} width={6} accentColor="var(--neon-blue)"/>
          <span className="font-mono text-[7px] text-[var(--neon-blue)]">{freq1.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[7px] text-[var(--neon-blue)]">F2</span>
          <Slider value={freq2*10} min={5} max={100} onChange={(v)=>setFreq2(v/10)} orientation="horizontal" height={50} width={6} accentColor="var(--neon-blue)"/>
          <span className="font-mono text-[7px] text-[var(--neon-blue)]">{freq2.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[7px] text-[var(--neon-amber)]">Int</span>
          <Slider value={interference} min={0} max={100} onChange={setInterference} orientation="horizontal" height={50} width={6} accentColor="var(--neon-amber)" disabled={!interferenceEnabled}/>
          <span className="font-mono text-[7px] text-[var(--neon-amber)]">{interference}%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[7px] text-[var(--neon-pink)]">Wv</span>
          <Slider value={wavelength*10} min={10} max={200} onChange={(v)=>setWavelength(v/10)} orientation="horizontal" height={50} width={6} accentColor="var(--neon-pink)"/>
          <span className="font-mono text-[7px] text-[var(--neon-pink)]">{wavelength.toFixed(1)}</span>
        </div>
        <label className="flex items-center gap-0.5">
          <input type="checkbox" checked={interferenceEnabled} onChange={(e)=>setInterferenceEnabled(e.target.checked)} className="w-2.5 h-2.5"/>
          <span className="font-mono text-[6px] text-white/70">INT</span>
        </label>
        <label className="flex items-center gap-0.5">
          <input type="checkbox" checked={is3DEnabled} onChange={(e)=>setIs3DEnabled(e.target.checked)} className="w-2.5 h-2.5"/>
          <span className="font-mono text-[6px] text-white/70">3D</span>
        </label>
      </div>

      {/* Combined Controls Row - 12 knobs in 2 rows */}
      <div className="bg-[#3a4a3a] border border-[#1a2a1a] rounded p-1 flex-shrink-0">
        <div className="flex justify-between mb-0.5">
          <KnobWithInput label="X-G" value={xGain} setter={setXGain} />
          <KnobWithInput label="Y-G" value={yGain} setter={setYGain} />
          <KnobWithInput label="Z-G" value={zGain} setter={setZGain} />
          <KnobWithInput label="FRQ" value={freqKnob} setter={setFreqKnob} />
          <KnobWithInput label="AMP" value={amplKnob} setter={setAmplKnob} />
          <KnobWithInput label="PHS" value={phaseKnob} setter={setPhaseKnob} />
        </div>
        <div className="flex justify-between">
          <KnobWithInput label="X-O" value={xOff} setter={setXOff} />
          <KnobWithInput label="Y-O" value={yOff} setter={setYOff} />
          <KnobWithInput label="Z-O" value={zOff} setter={setZOff} />
          <KnobWithInput label="NOS" value={noiseKnob} setter={setNoiseKnob} />
          <KnobWithInput label="CHS" value={chaosKnob} setter={setChaosKnob} />
          <KnobWithInput label="SPD" value={speedKnob} setter={setSpeedKnob} />
        </div>
      </div>

      {/* Audio controls row - compact */}
      <div className="flex items-center gap-1 bg-[#3a4a3a] border border-[#1a2a1a] rounded px-1.5 py-0.5 flex-shrink-0">
        <span className="font-mono text-[7px] text-[var(--neon-amber)] font-bold">AUD</span>
        <button onClick={() => setAudioEnabled(!audioEnabled)}
          className={cn('w-6 h-3 rounded-full relative', audioEnabled ? 'bg-[var(--neon-green)]' : 'bg-[var(--neon-red)]')}>
          <div className={cn('absolute top-0.5 w-2 h-2 rounded-full bg-white', audioEnabled ? 'left-3' : 'left-0.5')}/>
        </button>
        <KnobWithInput label="VOL" value={volume} setter={setVolume} />
        <KnobWithInput label="PIT" value={pitch} setter={setPitch} />
        <KnobWithInput label="FLT" value={filter} setter={setFilter} />
        <KnobWithInput label="REV" value={reverb} setter={setReverb} />
        <div className="ml-auto font-mono text-[6px] text-[var(--neon-cyan)]">EICO 460</div>
      </div>

      {/* Color Mixer - Compact Sliders with Inline Info */}
      <div className="flex gap-1 flex-shrink-0 bg-[#2a3a2a] rounded p-1 border border-[#1a2a1a]">
        {/* Color sliders */}
        <div className="flex gap-0.5 flex-1">
          {WAVEFORM_COLORS.map((color) => {
            const intensity = selectedColors[color.label] || 0
            const isActive = intensity > 0
            return (
              <div key={color.label} className="flex-1 flex flex-col items-center">
                <span className="font-mono text-[5px] font-bold text-white/70">{color.label}</span>
                <div
                  className="relative w-3 h-10 rounded-sm cursor-pointer"
                  style={{
                    backgroundColor: '#0a1a0a',
                    border: isActive ? `1px solid ${color.hex}` : '1px solid #333',
                  }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const y = e.clientY - rect.top
                    const percent = Math.max(0, Math.min(100, Math.round((1 - y / rect.height) * 100)))
                    setSelectedColors(prev => ({ ...prev, [color.label]: percent }))
                  }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-75"
                    style={{
                      height: `${intensity}%`,
                      background: color.hex,
                      boxShadow: isActive ? `0 0 4px ${color.hex}` : 'none'
                    }}
                  />
                </div>
                <div
                  className="w-2.5 h-2.5 rounded-full mt-0.5"
                  style={{ backgroundColor: color.hex, opacity: isActive ? 1 : 0.3 }}
                />
              </div>
            )
          })}
        </div>
        {/* Inline color info */}
        <div className="w-20 flex flex-col justify-between border-l border-[#1a2a1a] pl-1">
          <div
            className="h-8 rounded border border-white/20"
            style={{ backgroundColor: waveColor, boxShadow: `0 0 8px ${waveColor}` }}
          />
          <div className="font-mono text-[6px] text-[var(--neon-green)]">{waveColor}</div>
          <div className="font-mono text-[5px] text-white/50">
            {Object.entries(selectedColors).filter(([_, v]) => v > 0).length} ACTIVE
          </div>
        </div>
      </div>

      {/* ULTIMATE SOUND TOOL */}
      <div className="bg-gradient-to-b from-[#1a2a2a] to-[#0a1a1a] border border-[#2a4a4a] rounded p-1.5 flex-1 flex flex-col gap-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[8px] text-[var(--neon-cyan)] font-bold">SOUND STUDIO</span>
            <LED on={audioEnabled} color={audioEnabled ? 'green' : 'red'} size="sm" />
            {isRecording && <div className="w-2 h-2 rounded-full bg-[var(--neon-red)] animate-pulse" />}
          </div>
          <div className="flex items-center gap-1">
            {['SPECTRUM', 'WAVEFORM', 'STEREO', 'LISSAJOUS'].map(mode => (
              <button
                key={mode}
                onClick={() => setSoundViewMode(mode as typeof soundViewMode)}
                className={cn(
                  'px-1 py-0.5 rounded font-mono text-[5px]',
                  soundViewMode === mode ? 'bg-[var(--neon-cyan)] text-black' : 'bg-[#2a3a3a] text-white/50'
                )}
              >
                {mode.slice(0, 4)}
              </button>
            ))}
          </div>
        </div>

        {/* Main Display */}
        <div className="relative h-16 bg-[#050a0a] border border-[#1a2a2a] rounded overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'repeating-linear-gradient(0deg, rgba(0,255,255,0.02) 0px, transparent 1px, transparent 2px)'
          }} />
          {soundViewMode === 'SPECTRUM' && (
            <div className="absolute inset-0 flex items-end justify-around px-1 pb-1">
              {spectrumData.map((height, i) => (
                <div
                  key={i}
                  className="w-1 transition-all duration-75"
                  style={{
                    height: `${height}%`,
                    background: `linear-gradient(to top, var(--neon-cyan), ${height > 70 ? 'var(--neon-red)' : height > 50 ? 'var(--neon-amber)' : 'var(--neon-cyan)'})`,
                    opacity: audioEnabled || isPlaying ? 0.9 : 0.2,
                    boxShadow: height > 60 ? `0 0 4px var(--neon-cyan)` : 'none'
                  }}
                />
              ))}
            </div>
          )}
          {soundViewMode === 'WAVEFORM' && (
            <div className="absolute inset-0 flex items-center px-1">
              <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                <path
                  d={`M 0 20 ${recordingWaveform.map((v, i) => `L ${(i / 60) * 100} ${20 - (v - 50) * 0.3}`).join(' ')}`}
                  fill="none"
                  stroke="var(--neon-cyan)"
                  strokeWidth="0.5"
                  opacity={audioEnabled || isPlaying ? 0.9 : 0.3}
                />
              </svg>
            </div>
          )}
          {soundViewMode === 'STEREO' && (
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <div className="w-1/3 h-full flex flex-col justify-end p-1">
                <div className="bg-[var(--neon-green)]" style={{ height: `${vuLeft * 5}%`, opacity: 0.8 }} />
              </div>
              <div className="w-1/3 h-full flex flex-col justify-end p-1">
                <div className="bg-[var(--neon-cyan)]" style={{ height: `${vuRight * 5}%`, opacity: 0.8 }} />
              </div>
            </div>
          )}
          {soundViewMode === 'LISSAJOUS' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border border-[var(--neon-cyan)]/30 rounded-full relative">
                <div
                  className="absolute w-1 h-1 bg-[var(--neon-cyan)] rounded-full"
                  style={{
                    left: `${50 + Math.sin(Date.now() * 0.002) * 40}%`,
                    top: `${50 + Math.cos(Date.now() * 0.003) * 40}%`,
                    boxShadow: '0 0 4px var(--neon-cyan)'
                  }}
                />
              </div>
            </div>
          )}
          {/* Time display overlay */}
          <div className="absolute top-1 left-1 font-mono text-[8px] text-[var(--neon-green)]">{timePosition}</div>
          <div className="absolute top-1 right-1 font-mono text-[6px] text-[var(--neon-amber)]">{bpm} BPM</div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-1 bg-[#0a1a1a] rounded p-1 border border-[#1a2a2a]">
          <button
            onClick={() => { setIsRecording(!isRecording); if (!isRecording) setAudioEnabled(true) }}
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center',
              isRecording ? 'bg-[var(--neon-red)] shadow-[0_0_8px_var(--neon-red)]' : 'bg-[#3a2a2a] border border-[var(--neon-red)]/50'
            )}
          >
            <div className={cn('w-2 h-2 rounded-full', isRecording ? 'bg-white' : 'bg-[var(--neon-red)]')} />
          </button>
          <button
            onClick={() => { setIsPlaying(true); setIsPaused(false); setAudioEnabled(true) }}
            className={cn(
              'w-6 h-6 rounded flex items-center justify-center',
              isPlaying && !isPaused ? 'bg-[var(--neon-green)]' : 'bg-[#2a3a2a] border border-[var(--neon-green)]/50'
            )}
          >
            <div className="w-0 h-0 border-l-[6px] border-l-current border-y-[4px] border-y-transparent ml-0.5"
              style={{ color: isPlaying && !isPaused ? 'black' : 'var(--neon-green)' }} />
          </button>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              'w-6 h-6 rounded flex items-center justify-center gap-0.5',
              isPaused ? 'bg-[var(--neon-amber)]' : 'bg-[#2a3a2a] border border-[var(--neon-amber)]/50'
            )}
          >
            <div className="w-1 h-3" style={{ backgroundColor: isPaused ? 'black' : 'var(--neon-amber)' }} />
            <div className="w-1 h-3" style={{ backgroundColor: isPaused ? 'black' : 'var(--neon-amber)' }} />
          </button>
          <button
            onClick={() => { setIsPlaying(false); setIsRecording(false); setIsPaused(false); setTimePosition('00:00:00') }}
            className="w-6 h-6 rounded flex items-center justify-center bg-[#2a3a3a] border border-white/30"
          >
            <div className="w-3 h-3 bg-white/70" />
          </button>
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={cn(
              'w-6 h-6 rounded flex items-center justify-center font-mono text-[7px] font-bold',
              isLooping ? 'bg-[var(--neon-purple,#9d00ff)] text-white' : 'bg-[#2a2a3a] text-[var(--neon-purple,#9d00ff)]/50'
            )}
          >
            ↻
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <span className="font-mono text-[6px] text-white/50">BPM</span>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Math.max(20, Math.min(300, parseInt(e.target.value) || 120)))}
              className="w-10 bg-[#0a1a1a] border border-[#2a3a3a] rounded px-1 font-mono text-[7px] text-[var(--neon-amber)] text-center"
            />
          </div>
        </div>

        {/* Device Connection Panel */}
        <div className="grid grid-cols-3 gap-1">
          <div className="bg-[#0a1a1a] rounded p-1 border border-[#1a2a2a]">
            <div className="font-mono text-[5px] text-white/40 mb-0.5">INPUT</div>
            <select
              value={inputDevice}
              onChange={(e) => setInputDevice(e.target.value)}
              className="w-full bg-[#1a2a2a] border border-[#2a3a3a] rounded px-0.5 font-mono text-[6px] text-[var(--neon-green)]"
            >
              <option>System Default</option>
              <option>Microphone (USB)</option>
              <option>Line In</option>
              <option>Virtual Cable</option>
              <option>Bluetooth Input</option>
            </select>
          </div>
          <div className="bg-[#0a1a1a] rounded p-1 border border-[#1a2a2a]">
            <div className="font-mono text-[5px] text-white/40 mb-0.5">OUTPUT</div>
            <select
              value={outputDevice}
              onChange={(e) => setOutputDevice(e.target.value)}
              className="w-full bg-[#1a2a2a] border border-[#2a3a3a] rounded px-0.5 font-mono text-[6px] text-[var(--neon-cyan)]"
            >
              <option>System Default</option>
              <option>Speakers (USB)</option>
              <option>Headphones</option>
              <option>HDMI Audio</option>
              <option>Bluetooth Output</option>
            </select>
          </div>
          <div className="bg-[#0a1a1a] rounded p-1 border border-[#1a2a2a]">
            <div className="font-mono text-[5px] text-white/40 mb-0.5">MIDI</div>
            <select
              value={midiDevice}
              onChange={(e) => setMidiDevice(e.target.value)}
              className="w-full bg-[#1a2a2a] border border-[#2a3a3a] rounded px-0.5 font-mono text-[6px] text-[var(--neon-pink)]"
            >
              <option>None</option>
              <option>MIDI Controller</option>
              <option>Virtual MIDI</option>
              <option>DAW Sync</option>
            </select>
          </div>
        </div>

        {/* Sample Rate / Bit Depth */}
        <div className="flex gap-1">
          <div className="flex-1 flex items-center gap-1 bg-[#0a1a1a] rounded px-1 py-0.5 border border-[#1a2a2a]">
            <span className="font-mono text-[5px] text-white/40">RATE</span>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(e.target.value)}
              className="flex-1 bg-transparent font-mono text-[6px] text-[var(--neon-green)]"
            >
              <option value="44100">44.1kHz</option>
              <option value="48000">48kHz</option>
              <option value="96000">96kHz</option>
              <option value="192000">192kHz</option>
            </select>
          </div>
          <div className="flex-1 flex items-center gap-1 bg-[#0a1a1a] rounded px-1 py-0.5 border border-[#1a2a2a]">
            <span className="font-mono text-[5px] text-white/40">BITS</span>
            <select
              value={bitDepth}
              onChange={(e) => setBitDepth(e.target.value)}
              className="flex-1 bg-transparent font-mono text-[6px] text-[var(--neon-cyan)]"
            >
              <option value="16">16-bit</option>
              <option value="24">24-bit</option>
              <option value="32">32-bit</option>
            </select>
          </div>
          <div className="flex items-center gap-0.5">
            <LED on={inputDevice !== 'System Default'} color="green" size="sm" />
            <LED on={outputDevice !== 'System Default'} color="cyan" size="sm" />
            <LED on={midiDevice !== 'None'} color="red" size="sm" />
          </div>
        </div>

        {/* Mixer Channels */}
        <div className="flex gap-0.5 bg-[#0a1a1a] rounded p-1 border border-[#1a2a2a]">
          {channels.map((ch, idx) => (
            <div key={ch.id} className="flex-1 flex flex-col items-center gap-0.5">
              <span className="font-mono text-[5px] text-white/50">{ch.name}</span>
              <div
                className="relative w-3 h-12 bg-[#1a2a2a] rounded cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const level = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100)
                  setChannels(prev => prev.map((c, i) => i === idx ? { ...c, level: Math.max(0, Math.min(100, level)) } : c))
                }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 rounded transition-all"
                  style={{
                    height: `${ch.level}%`,
                    background: ch.mute ? '#333' : `linear-gradient(to top, var(--neon-green), ${ch.level > 80 ? 'var(--neon-red)' : 'var(--neon-green)'})`
                  }}
                />
              </div>
              <div className="flex gap-px">
                <button
                  onClick={() => setChannels(prev => prev.map((c, i) => i === idx ? { ...c, mute: !c.mute } : c))}
                  className={cn('w-3 h-3 rounded font-mono text-[5px]', ch.mute ? 'bg-[var(--neon-red)]' : 'bg-[#2a3a3a] text-white/30')}
                >M</button>
                <button
                  onClick={() => setChannels(prev => prev.map((c, i) => i === idx ? { ...c, solo: !c.solo } : c))}
                  className={cn('w-3 h-3 rounded font-mono text-[5px]', ch.solo ? 'bg-[var(--neon-amber)]' : 'bg-[#2a3a3a] text-white/30')}
                >S</button>
              </div>
            </div>
          ))}
          {/* Master */}
          <div className="flex flex-col items-center gap-0.5 border-l border-[#2a3a3a] pl-1">
            <span className="font-mono text-[5px] text-[var(--neon-amber)]">MST</span>
            <div
              className="relative w-4 h-12 bg-[#1a2a2a] rounded cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const level = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100)
                setVolume(Math.max(0, Math.min(100, level)))
              }}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded transition-all"
                style={{
                  height: `${volume}%`,
                  background: `linear-gradient(to top, var(--neon-amber), ${volume > 90 ? 'var(--neon-red)' : 'var(--neon-amber)'})`
                }}
              />
            </div>
            <span className="font-mono text-[6px] text-[var(--neon-amber)]">{volume}</span>
          </div>
        </div>

        {/* Effects Rack */}
        <div className="grid grid-cols-6 gap-0.5">
          {Object.entries(effects).map(([name, fx]) => (
            <button
              key={name}
              onClick={() => setEffects(prev => ({ ...prev, [name]: { ...prev[name as keyof typeof prev], enabled: !fx.enabled } }))}
              className={cn(
                'py-1 rounded font-mono text-[5px] uppercase transition-all',
                fx.enabled
                  ? 'bg-[var(--neon-cyan)] text-black font-bold shadow-[0_0_6px_var(--neon-cyan)]'
                  : 'bg-[#1a2a2a] text-white/40 border border-[#2a3a3a]'
              )}
            >
              {name.slice(0, 4)}
            </button>
          ))}
        </div>

        {/* VU Meters */}
        <div className="flex gap-1 items-center bg-[#0a1a1a] rounded px-1 py-0.5 border border-[#1a2a2a]">
          <span className="font-mono text-[5px] text-white/40 w-2">L</span>
          <div className="flex-1 h-2 bg-[#050a0a] rounded overflow-hidden flex">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 mx-px transition-all duration-75"
                style={{
                  backgroundColor: (audioEnabled || isPlaying) && i < vuLeft
                    ? i > 16 ? 'var(--neon-red)' : i > 12 ? 'var(--neon-amber)' : 'var(--neon-green)'
                    : '#1a2a2a',
                  opacity: (audioEnabled || isPlaying) && i < vuLeft ? 0.9 : 0.2
                }}
              />
            ))}
          </div>
          <span className="font-mono text-[5px] text-white/40 w-2">R</span>
          <div className="flex-1 h-2 bg-[#050a0a] rounded overflow-hidden flex">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 mx-px transition-all duration-75"
                style={{
                  backgroundColor: (audioEnabled || isPlaying) && i < vuRight
                    ? i > 16 ? 'var(--neon-red)' : i > 12 ? 'var(--neon-amber)' : 'var(--neon-green)'
                    : '#1a2a2a',
                  opacity: (audioEnabled || isPlaying) && i < vuRight ? 0.9 : 0.2
                }}
              />
            ))}
          </div>
        </div>

        {/* Import/Export Panel */}
        <div className="flex gap-1">
          <div className="flex-1 bg-[#0a1a1a] rounded p-1 border border-[#1a2a2a]">
            <div className="font-mono text-[5px] text-white/40 mb-0.5">FORMAT</div>
            <div className="flex gap-0.5">
              {['WAV', 'MP3', 'FLAC', 'OGG', 'AIFF'].map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={cn(
                    'flex-1 py-0.5 rounded font-mono text-[5px]',
                    exportFormat === fmt ? 'bg-[var(--neon-green)] text-black' : 'bg-[#1a2a2a] text-white/40'
                  )}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <button className="px-2 py-1 bg-[#1a3a2a] border border-[var(--neon-green)]/50 rounded font-mono text-[6px] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black transition-all">
              IMPORT
            </button>
            <button className="px-2 py-1 bg-[#1a2a3a] border border-[var(--neon-cyan)]/50 rounded font-mono text-[6px] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)] hover:text-black transition-all">
              EXPORT
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-0.5">
          {[
            { label: 'NORMALIZE', color: 'green' },
            { label: 'TRIM', color: 'cyan' },
            { label: 'FADE IN', color: 'amber' },
            { label: 'FADE OUT', color: 'amber' },
            { label: 'REVERSE', color: 'pink' },
            { label: 'RENDER', color: 'purple' },
          ].map(action => (
            <button
              key={action.label}
              className={`flex-1 py-0.5 bg-[#1a2a2a] border border-[var(--neon-${action.color})]/30 rounded font-mono text-[5px] text-[var(--neon-${action.color})]/70 hover:bg-[var(--neon-${action.color})]/20 transition-all`}
            >
              {action.label.slice(0, 6)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
