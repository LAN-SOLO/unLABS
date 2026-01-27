'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
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

// Boot sequence stages
type BootStage =
  | 'off'
  | 'power_check'
  | 'memory_test'
  | 'display_init'
  | 'audio_init'
  | 'waveform_cal'
  | 'sensor_check'
  | 'network_init'
  | 'system_ready'
  | 'running'
  | 'shutting_down'

interface ComponentTest {
  name: string
  status: 'pending' | 'testing' | 'pass' | 'fail' | 'skip'
  value?: string
}

export function Oscilloscope({
  walletAddress = 'EfiL....B82M',
  balance = 0,
  frequency1: defaultFreq1 = 2.0,
  frequency2: defaultFreq2 = 3.0,
  onConnect,
  className,
}: OscilloscopeProps) {
  // Power and boot states
  const [powerState, setPowerState] = useState<'off' | 'booting' | 'on' | 'shutting_down'>('off')
  const [bootStage, setBootStage] = useState<BootStage>('off')
  const [bootProgress, setBootProgress] = useState(0)
  const [powerHoldProgress, setPowerHoldProgress] = useState(0)
  const [isPowerHeld, setIsPowerHeld] = useState(false)
  const powerHoldRef = useRef<NodeJS.Timeout | null>(null)
  const bootTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Component test results
  const [componentTests, setComponentTests] = useState<ComponentTest[]>([
    { name: 'PWR', status: 'pending', value: '' },
    { name: 'MEM', status: 'pending', value: '' },
    { name: 'DSP', status: 'pending', value: '' },
    { name: 'AUD', status: 'pending', value: '' },
    { name: 'WAV', status: 'pending', value: '' },
    { name: 'SNS', status: 'pending', value: '' },
    { name: 'NET', status: 'pending', value: '' },
    { name: 'SYS', status: 'pending', value: '' },
  ])

  const [bootLog, setBootLog] = useState<string[]>([])

  // Control states
  const [intensity, setIntensity] = useState(70)
  const [focus, setFocus] = useState(50)

  // Feature states
  type WaveType = 'sine' | 'square' | 'sawtooth' | 'noise' | 'triangle' | 'pulse' | 'harmonic' | 'morph' | 'fm' | 'am' | 'pwm' | 'supersaw' | 'subsine' | 'bell' | 'organ' | 'pluck' | 'pad' | 'bass' | 'lead' | 'arp' | 'sweep' | 'wobble' | 'glitch' | 'grain' | 'formant' | 'vocal' | 'breath' | 'wind' | 'string' | 'brass' | 'keys'
  const [waveType, setWaveType] = useState<WaveType>('sine')
  const [preset, setPreset] = useState('default')

  // Preset definitions
  interface PresetConfig {
    wave: WaveType
    freq1: number
    freq2: number
    interference: number
    interferenceEnabled: boolean
    wavelength: number
    is3D: boolean
    intensity: number
    colors: Record<string, number>
    xGain: number
    yGain: number
    phaseKnob: number
    amplKnob: number
    freqKnob: number
  }

  const presetConfigs: Record<string, PresetConfig> = {
    default: { wave: 'sine', freq1: 2.0, freq2: 3.0, interference: 60, interferenceEnabled: false, wavelength: 10, is3D: false, intensity: 70, colors: { 'G': 100 }, xGain: 0, yGain: 0, phaseKnob: 0, amplKnob: 0, freqKnob: 0 },
    calm: { wave: 'sine', freq1: 0.8, freq2: 1.2, interference: 20, interferenceEnabled: true, wavelength: 15, is3D: false, intensity: 50, colors: { 'C': 80, 'B': 40 }, xGain: 0, yGain: 10, phaseKnob: 0, amplKnob: 0, freqKnob: 0 },
    chaos: { wave: 'glitch', freq1: 8.0, freq2: 7.5, interference: 90, interferenceEnabled: true, wavelength: 5, is3D: true, intensity: 95, colors: { 'R': 100, 'oR': 80, 'M': 60 }, xGain: 80, yGain: 70, phaseKnob: 50, amplKnob: 60, freqKnob: 70 },
    pulse: { wave: 'pulse', freq1: 4.0, freq2: 4.0, interference: 0, interferenceEnabled: false, wavelength: 8, is3D: false, intensity: 85, colors: { 'R': 100 }, xGain: 20, yGain: 0, phaseKnob: 0, amplKnob: 30, freqKnob: 20 },
    ambient: { wave: 'pad', freq1: 1.0, freq2: 1.5, interference: 40, interferenceEnabled: true, wavelength: 18, is3D: true, intensity: 45, colors: { 'C': 60, 'B': 80, 'M': 30 }, xGain: 10, yGain: 20, phaseKnob: 30, amplKnob: 0, freqKnob: 0 },
    retro: { wave: 'square', freq1: 3.0, freq2: 6.0, interference: 30, interferenceEnabled: false, wavelength: 10, is3D: false, intensity: 75, colors: { 'G': 100, 'oG': 50 }, xGain: 0, yGain: 0, phaseKnob: 0, amplKnob: 20, freqKnob: 10 },
    digital: { wave: 'pwm', freq1: 5.0, freq2: 5.5, interference: 50, interferenceEnabled: true, wavelength: 7, is3D: false, intensity: 80, colors: { 'C': 100, 'B': 60 }, xGain: 40, yGain: 30, phaseKnob: 20, amplKnob: 40, freqKnob: 30 },
    analog: { wave: 'sawtooth', freq1: 2.5, freq2: 2.0, interference: 25, interferenceEnabled: false, wavelength: 12, is3D: false, intensity: 65, colors: { 'oR': 90, 'Y': 60 }, xGain: 10, yGain: 15, phaseKnob: 10, amplKnob: 10, freqKnob: 5 },
    'lo-fi': { wave: 'grain', freq1: 2.0, freq2: 3.0, interference: 70, interferenceEnabled: true, wavelength: 8, is3D: false, intensity: 55, colors: { 'oR': 70, 'K': 50 }, xGain: 30, yGain: 20, phaseKnob: 40, amplKnob: 20, freqKnob: 15 },
    'hi-fi': { wave: 'supersaw', freq1: 3.0, freq2: 3.5, interference: 15, interferenceEnabled: true, wavelength: 12, is3D: true, intensity: 90, colors: { 'C': 90, 'M': 70, 'B': 50 }, xGain: 20, yGain: 25, phaseKnob: 0, amplKnob: 50, freqKnob: 40 },
    space: { wave: 'fm', freq1: 1.5, freq2: 4.5, interference: 60, interferenceEnabled: true, wavelength: 20, is3D: true, intensity: 60, colors: { 'B': 100, 'M': 80, 'C': 40 }, xGain: 50, yGain: 40, phaseKnob: 60, amplKnob: 30, freqKnob: 25 },
    dark: { wave: 'subsine', freq1: 1.0, freq2: 0.5, interference: 30, interferenceEnabled: true, wavelength: 15, is3D: true, intensity: 40, colors: { 'M': 60, 'R': 30 }, xGain: 20, yGain: 30, phaseKnob: 20, amplKnob: 10, freqKnob: 0 },
    bright: { wave: 'harmonic', freq1: 4.0, freq2: 8.0, interference: 40, interferenceEnabled: true, wavelength: 8, is3D: false, intensity: 95, colors: { 'Y': 100, 'oG': 80, 'C': 60 }, xGain: 30, yGain: 40, phaseKnob: 10, amplKnob: 60, freqKnob: 50 },
    warm: { wave: 'organ', freq1: 2.0, freq2: 2.5, interference: 20, interferenceEnabled: false, wavelength: 14, is3D: false, intensity: 70, colors: { 'oR': 100, 'Y': 70, 'R': 40 }, xGain: 0, yGain: 10, phaseKnob: 0, amplKnob: 20, freqKnob: 10 },
    cold: { wave: 'triangle', freq1: 3.0, freq2: 4.5, interference: 35, interferenceEnabled: true, wavelength: 11, is3D: false, intensity: 65, colors: { 'C': 100, 'B': 90, 'K': 30 }, xGain: 15, yGain: 20, phaseKnob: 15, amplKnob: 15, freqKnob: 20 },
    aggressive: { wave: 'bass', freq1: 6.0, freq2: 5.0, interference: 80, interferenceEnabled: true, wavelength: 5, is3D: true, intensity: 100, colors: { 'R': 100, 'oR': 100 }, xGain: 90, yGain: 80, phaseKnob: 70, amplKnob: 80, freqKnob: 60 },
    soft: { wave: 'breath', freq1: 1.2, freq2: 1.8, interference: 15, interferenceEnabled: true, wavelength: 18, is3D: false, intensity: 40, colors: { 'C': 50, 'oG': 40, 'B': 30 }, xGain: 5, yGain: 10, phaseKnob: 5, amplKnob: 0, freqKnob: 0 },
    sharp: { wave: 'lead', freq1: 5.5, freq2: 6.0, interference: 45, interferenceEnabled: false, wavelength: 6, is3D: false, intensity: 88, colors: { 'Y': 100, 'G': 70 }, xGain: 60, yGain: 50, phaseKnob: 30, amplKnob: 55, freqKnob: 45 },
    smooth: { wave: 'string', freq1: 1.8, freq2: 2.2, interference: 25, interferenceEnabled: true, wavelength: 16, is3D: true, intensity: 55, colors: { 'oG': 80, 'C': 60, 'B': 40 }, xGain: 10, yGain: 15, phaseKnob: 20, amplKnob: 10, freqKnob: 5 },
    random: { wave: 'noise', freq1: 5.0, freq2: 7.0, interference: 100, interferenceEnabled: true, wavelength: 5, is3D: true, intensity: 75, colors: { 'R': 50, 'G': 50, 'B': 50, 'C': 50, 'M': 50, 'Y': 50 }, xGain: 50, yGain: 50, phaseKnob: 50, amplKnob: 50, freqKnob: 50 },
  }

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

  // Apply preset function
  const applyPreset = (presetName: string) => {
    const config = presetConfigs[presetName]
    if (!config) return

    setPreset(presetName)
    setWaveType(config.wave)
    setFreq1(config.freq1)
    setFreq2(config.freq2)
    setInterference(config.interference)
    setInterferenceEnabled(config.interferenceEnabled)
    setWavelength(config.wavelength)
    setIs3DEnabled(config.is3D)
    setIntensity(config.intensity)
    setSelectedColors(config.colors)
    setXGain(config.xGain)
    setYGain(config.yGain)
    setPhaseKnob(config.phaseKnob)
    setAmplKnob(config.amplKnob)
    setFreqKnob(config.freqKnob)
  }

  // Audio controls
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [volume, setVolume] = useState(100)
  const [pitch, setPitch] = useState(50)
  const [filter, setFilter] = useState(0)
  const [reverb, setReverb] = useState(0)

  // Info display mode
  const [infoMode, setInfoMode] = useState<'WAVE' | 'SIGNAL' | 'COLOR' | 'SYS' | 'PRESET' | 'TIME'>('WAVE')
  const infoModes: ('WAVE' | 'SIGNAL' | 'COLOR' | 'SYS' | 'PRESET' | 'TIME')[] = ['WAVE', 'SIGNAL', 'COLOR', 'SYS', 'PRESET', 'TIME']
  const cycleInfoMode = () => {
    const currentIndex = infoModes.indexOf(infoMode)
    setInfoMode(infoModes[(currentIndex + 1) % infoModes.length])
  }

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

  // Power button hold logic
  const handlePowerDown = () => {
    if (powerState === 'off' || powerState === 'shutting_down') {
      // Start boot sequence
      setIsPowerHeld(true)
      let progress = 0
      powerHoldRef.current = setInterval(() => {
        progress += 2
        setPowerHoldProgress(progress)
        if (progress >= 100) {
          if (powerHoldRef.current) clearInterval(powerHoldRef.current)
          setIsPowerHeld(false)
          setPowerHoldProgress(0)
          startBootSequence()
        }
      }, 30)
    } else if (powerState === 'on') {
      // Start shutdown sequence
      setIsPowerHeld(true)
      let progress = 0
      powerHoldRef.current = setInterval(() => {
        progress += 2
        setPowerHoldProgress(progress)
        if (progress >= 100) {
          if (powerHoldRef.current) clearInterval(powerHoldRef.current)
          setIsPowerHeld(false)
          setPowerHoldProgress(0)
          startShutdownSequence()
        }
      }, 30)
    }
  }

  const handlePowerUp = () => {
    if (powerHoldRef.current) {
      clearInterval(powerHoldRef.current)
    }
    setIsPowerHeld(false)
    setPowerHoldProgress(0)
  }

  // Boot sequence
  const startBootSequence = () => {
    setPowerState('booting')
    setBootProgress(0)
    setBootLog([])
    setComponentTests([
      { name: 'PWR', status: 'pending', value: '' },
      { name: 'MEM', status: 'pending', value: '' },
      { name: 'DSP', status: 'pending', value: '' },
      { name: 'AUD', status: 'pending', value: '' },
      { name: 'WAV', status: 'pending', value: '' },
      { name: 'SNS', status: 'pending', value: '' },
      { name: 'NET', status: 'pending', value: '' },
      { name: 'SYS', status: 'pending', value: '' },
    ])

    const bootStages: { stage: BootStage; delay: number; testIndex: number; log: string; value: string }[] = [
      { stage: 'power_check', delay: 300, testIndex: 0, log: 'POWER SUBSYSTEM CHECK...', value: '12.4V' },
      { stage: 'memory_test', delay: 500, testIndex: 1, log: 'MEMORY TEST 256KB...', value: '256KB OK' },
      { stage: 'display_init', delay: 400, testIndex: 2, log: 'DISPLAY INIT CRT-460...', value: '480x310' },
      { stage: 'audio_init', delay: 450, testIndex: 3, log: 'AUDIO CODEC 48KHZ/24BIT...', value: '48K/24' },
      { stage: 'waveform_cal', delay: 600, testIndex: 4, log: 'WAVEFORM CALIBRATION...', value: '31 TYPES' },
      { stage: 'sensor_check', delay: 350, testIndex: 5, log: 'SENSOR ARRAY CHECK...', value: '12 OK' },
      { stage: 'network_init', delay: 500, testIndex: 6, log: 'NETWORK INTERFACE...', value: 'READY' },
      { stage: 'system_ready', delay: 400, testIndex: 7, log: 'SYSTEM INITIALIZATION...', value: 'ONLINE' },
    ]

    let currentStage = 0
    const runStage = () => {
      if (currentStage >= bootStages.length) {
        setBootStage('running')
        setPowerState('on')
        setBootLog(prev => [...prev, '═══════════════════════════════', 'OZSC-460 OSCILLOSCOPE READY', '═══════════════════════════════'])
        return
      }

      const stage = bootStages[currentStage]
      setBootStage(stage.stage)
      setBootProgress(((currentStage + 1) / bootStages.length) * 100)
      setBootLog(prev => [...prev, stage.log])

      // Update test status to testing
      setComponentTests(prev => prev.map((t, i) =>
        i === stage.testIndex ? { ...t, status: 'testing' } : t
      ))

      bootTimeoutRef.current = setTimeout(() => {
        // Random pass/fail (95% pass rate)
        const passed = Math.random() > 0.05
        setComponentTests(prev => prev.map((t, i) =>
          i === stage.testIndex ? { ...t, status: passed ? 'pass' : 'fail', value: stage.value } : t
        ))
        setBootLog(prev => [...prev, `  └─ ${passed ? 'PASS' : 'FAIL'}: ${stage.value}`])
        currentStage++
        runStage()
      }, stage.delay)
    }

    // Initial delay before boot
    bootTimeoutRef.current = setTimeout(() => {
      setBootLog(['OZSC-460 BOOT SEQUENCE v2.4.1', '───────────────────────────────'])
      runStage()
    }, 200)
  }

  // Shutdown sequence
  const startShutdownSequence = () => {
    setPowerState('shutting_down')
    setBootStage('shutting_down')
    setBootLog(['', 'INITIATING SHUTDOWN SEQUENCE...'])

    const shutdownSteps = [
      { delay: 200, log: 'SAVING STATE...' },
      { delay: 300, log: 'STOPPING AUDIO ENGINE...' },
      { delay: 250, log: 'CLEARING BUFFERS...' },
      { delay: 200, log: 'DISCONNECTING NETWORK...' },
      { delay: 300, log: 'POWER DOWN DISPLAY...' },
      { delay: 400, log: 'SYSTEM HALTED' },
    ]

    let currentStep = 0
    const runStep = () => {
      if (currentStep >= shutdownSteps.length) {
        bootTimeoutRef.current = setTimeout(() => {
          setPowerState('off')
          setBootStage('off')
          setBootProgress(0)
          setBootLog([])
          setComponentTests([
            { name: 'PWR', status: 'pending', value: '' },
            { name: 'MEM', status: 'pending', value: '' },
            { name: 'DSP', status: 'pending', value: '' },
            { name: 'AUD', status: 'pending', value: '' },
            { name: 'WAV', status: 'pending', value: '' },
            { name: 'SNS', status: 'pending', value: '' },
            { name: 'NET', status: 'pending', value: '' },
            { name: 'SYS', status: 'pending', value: '' },
          ])
          // Reset all audio states
          setAudioEnabled(false)
          setIsPlaying(false)
          setIsRecording(false)
          setIsPaused(false)
        }, 500)
        return
      }

      const step = shutdownSteps[currentStep]
      bootTimeoutRef.current = setTimeout(() => {
        setBootLog(prev => [...prev, step.log])
        setBootProgress(100 - ((currentStep + 1) / shutdownSteps.length) * 100)
        currentStep++
        runStep()
      }, step.delay)
    }

    runStep()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (powerHoldRef.current) clearInterval(powerHoldRef.current)
      if (bootTimeoutRef.current) clearTimeout(bootTimeoutRef.current)
    }
  }, [])

  // Animate spectrum and recording when audio enabled
  useEffect(() => {
    if (powerState !== 'on' || (!audioEnabled && !isPlaying && !isRecording)) {
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

  // Wave type options - expanded
  const waveTypes = [
    // Basic waveforms
    'sine', 'square', 'sawtooth', 'triangle', 'noise', 'pulse',
    // Synthesis
    'harmonic', 'morph', 'fm', 'am', 'pwm', 'supersaw', 'subsine',
    // Instruments
    'bell', 'organ', 'pluck', 'pad', 'bass', 'lead', 'arp',
    // Effects
    'sweep', 'wobble', 'glitch', 'grain',
    // Vocal/Acoustic
    'formant', 'vocal', 'breath', 'wind', 'string', 'brass', 'keys'
  ] as const
  const presets = [
    'default', 'calm', 'chaos', 'pulse', 'ambient',
    'retro', 'digital', 'analog', 'lo-fi', 'hi-fi',
    'space', 'dark', 'bright', 'warm', 'cold',
    'aggressive', 'soft', 'sharp', 'smooth', 'random'
  ]

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

  // Calculate power button glow intensity based on state and hold progress
  const powerGlowIntensity = useMemo(() => {
    if (powerState === 'on') {
      // When on and holding to shut down, fade out
      return isPowerHeld ? 1 - (powerHoldProgress / 100) : 1
    } else if (powerState === 'off') {
      // When off and holding to turn on, fade in
      return isPowerHeld ? powerHoldProgress / 100 : 0
    } else if (powerState === 'booting') {
      return 0.7
    } else {
      // Shutting down
      return 0.3
    }
  }, [powerState, isPowerHeld, powerHoldProgress])

  // Power button component - always in same position
  const PowerButton = () => (
    <button
      onMouseDown={handlePowerDown}
      onMouseUp={handlePowerUp}
      onMouseLeave={handlePowerUp}
      onTouchStart={handlePowerDown}
      onTouchEnd={handlePowerUp}
      className="relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors duration-300"
      style={{
        backgroundColor: `rgba(26, 58, 26, ${powerGlowIntensity})`,
        borderColor: powerState === 'booting'
          ? 'var(--neon-amber)'
          : powerState === 'shutting_down'
          ? 'var(--neon-red)'
          : `rgba(0, 255, 102, ${0.3 + powerGlowIntensity * 0.7})`,
        boxShadow: powerState === 'booting'
          ? '0 0 10px var(--neon-amber)'
          : powerState === 'shutting_down'
          ? '0 0 10px var(--neon-red)'
          : `0 0 ${powerGlowIntensity * 15}px rgba(0, 255, 102, ${powerGlowIntensity}), inset 0 0 ${powerGlowIntensity * 10}px rgba(0, 255, 100, ${powerGlowIntensity * 0.3})`,
      }}
    >
      {/* Power icon */}
      <svg
        className="w-5 h-5 transition-colors duration-300"
        style={{
          color: powerState === 'booting'
            ? 'var(--neon-amber)'
            : powerState === 'shutting_down'
            ? 'var(--neon-red)'
            : `rgba(0, 255, 102, ${0.3 + powerGlowIntensity * 0.7})`,
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0" />
      </svg>
    </button>
  )

  // Check if device is powered off or in boot/shutdown state
  const isDeviceOff = powerState === 'off' || powerState === 'booting' || powerState === 'shutting_down'

  return (
    <div
      className={cn(
        'flex flex-col gap-1 p-1.5 rounded-lg w-full h-full overflow-hidden',
        'border transition-colors duration-500',
        isDeviceOff
          ? 'bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] border-[#3a3a3a]'
          : 'bg-gradient-to-b from-[#5a6a5a] to-[#4a5a4a] border-[#3a4a3a]',
        className
      )}
    >
      {/* Header Row - Always visible in same position */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className={cn('font-mono text-[8px]', isDeviceOff ? 'text-white/40' : 'text-white/80')}>INT</span>
          <Knob value={intensity} onChange={setIntensity} size="sm" accentColor={isDeviceOff ? '#3a3a3a' : '#ffffff'} disabled={isDeviceOff} />
        </div>
        <div className="flex items-center gap-2">
          <PowerButton />
          <div className="flex items-center gap-1">
            <LED on={powerState === 'on'} color="green" size="sm" />
            <LED on={powerState === 'on' && maikActive} color="amber" size="sm" />
            <LED on={powerState === 'on' && isConnected} color="cyan" size="sm" />
          </div>
          <button
            className={cn('px-2 py-1 rounded font-mono text-[8px] font-bold border transition-opacity',
              maikActive && powerState === 'on' ? 'bg-[var(--neon-green)] text-black' : 'bg-[#2a3a2a] text-[var(--neon-green)] border-[#1a2a1a]',
              isDeviceOff && 'opacity-30 cursor-not-allowed'
            )}
            onClick={() => powerState === 'on' && setMaikActive(!maikActive)}
            disabled={isDeviceOff}
          >MAIK</button>
          <button
            className={cn('px-2 py-1 rounded font-mono text-[8px] font-bold border transition-opacity',
              isConnected && powerState === 'on' ? 'bg-[#bfff00] text-black' : 'bg-[#2a2a1a] text-[var(--neon-amber)] border-[var(--neon-amber)]',
              isDeviceOff && 'opacity-30 cursor-not-allowed'
            )}
            onClick={() => { if (powerState === 'on') { setIsConnected(!isConnected); onConnect?.() } }}
            disabled={isDeviceOff}
          >WALLET</button>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn('font-mono text-[8px]', isDeviceOff ? 'text-white/40' : 'text-white/80')}>FOC</span>
          <Knob value={focus} onChange={setFocus} size="sm" accentColor={isDeviceOff ? '#3a3a3a' : '#ffffff'} disabled={isDeviceOff} />
        </div>
      </div>

      {/* Boot/Shutdown Screen - replaces main content when off */}
      {isDeviceOff ? (
        <>
          {/* Main boot display */}
          <div className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded relative overflow-hidden">
            {powerState === 'off' ? (
              // Off state - dark screen
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="font-mono text-[32px] text-[#1a1a1a] font-bold mb-2">OZSC</div>
                  <div className="font-mono text-[8px] text-white/15">HOLD POWER TO START</div>
                </div>
              </div>
            ) : (
              // Booting or shutting down
              <div className="absolute inset-0 p-2 flex flex-col">
                {/* CRT effect overlay */}
                <div className="absolute inset-0 pointer-events-none crt-scanlines" />

                {/* Component test grid */}
                <div className="grid grid-cols-8 gap-1 mb-2">
                  {componentTests.map((test) => (
                    <div
                      key={test.name}
                      className={cn(
                        'flex flex-col items-center p-1 rounded border',
                        test.status === 'pending' ? 'border-[#2a2a2a] bg-[#0a0a0a]' :
                        test.status === 'testing' ? 'border-[var(--neon-amber)] bg-[#1a1a0a] animate-pulse' :
                        test.status === 'pass' ? 'border-[var(--neon-green)] bg-[#0a1a0a]' :
                        test.status === 'fail' ? 'border-[var(--neon-red)] bg-[#1a0a0a]' :
                        'border-[#2a2a2a] bg-[#0a0a0a]'
                      )}
                    >
                      <span className="font-mono text-[7px] text-white/60">{test.name}</span>
                      <div className={cn(
                        'w-3 h-3 rounded-full mt-0.5',
                        test.status === 'pending' ? 'bg-[#2a2a2a]' :
                        test.status === 'testing' ? 'bg-[var(--neon-amber)] animate-pulse' :
                        test.status === 'pass' ? 'bg-[var(--neon-green)]' :
                        test.status === 'fail' ? 'bg-[var(--neon-red)]' :
                        'bg-[#2a2a2a]'
                      )} />
                      <span className="font-mono text-[5px] text-white/40 mt-0.5 truncate max-w-full">
                        {test.value || '---'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Boot log */}
                <div className="flex-1 bg-[#050505] border border-[#1a1a1a] rounded p-1.5 overflow-hidden font-mono text-[7px]">
                  <div className="h-full overflow-y-auto">
                    {bootLog.map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          'leading-tight',
                          line.includes('PASS') ? 'text-[var(--neon-green)]' :
                          line.includes('FAIL') ? 'text-[var(--neon-red)]' :
                          line.includes('═') || line.includes('─') ? 'text-[var(--neon-cyan)]' :
                          line.includes('READY') || line.includes('ONLINE') ? 'text-[var(--neon-green)] font-bold' :
                          line.includes('HALTED') ? 'text-[var(--neon-red)]' :
                          'text-[var(--crt-green)]'
                        )}
                      >
                        {line}
                      </div>
                    ))}
                    {powerState === 'booting' && bootStage !== 'running' && (
                      <span className="inline-block w-2 h-3 bg-[var(--crt-green)] animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-[6px] text-white/40">
                      {powerState === 'booting' ? 'BOOT PROGRESS' : 'SHUTDOWN'}
                    </span>
                    <span className="font-mono text-[6px] text-[var(--neon-cyan)]">
                      {Math.round(bootProgress)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-200',
                        powerState === 'booting'
                          ? 'bg-gradient-to-r from-[var(--neon-green)] to-[var(--neon-cyan)]'
                          : 'bg-gradient-to-r from-[var(--neon-red)] to-[var(--neon-amber)]'
                      )}
                      style={{ width: `${bootProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status bar when off */}
          <div className="flex items-center justify-between bg-[#1a1a1a] rounded px-2 py-1 border border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <LED on={powerState !== 'off'} color={powerState === 'booting' ? 'amber' : 'red'} size="sm" />
              <span className="font-mono text-[7px] text-white/50">
                {powerState === 'off' ? 'STANDBY' :
                 powerState === 'booting' ? `BOOT: ${bootStage.toUpperCase().replace('_', ' ')}` :
                 'SHUTDOWN IN PROGRESS'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[6px] text-white/30">OZSC-460 v2.4.1</span>
              <LED on={powerState === 'booting'} color="amber" size="sm" />
              <LED on={powerState === 'shutting_down'} color="red" size="sm" />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Normal operational content */}

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
          className="bg-[#1a2a1a] border border-[#0a1a0a] rounded px-1 py-0.5 font-mono text-[8px] text-white max-h-[200px]">
          <optgroup label="─── BASIC ───">
            <option value="sine">◎ sine</option>
            <option value="square">▢ square</option>
            <option value="sawtooth">◤ sawtooth</option>
            <option value="triangle">△ triangle</option>
            <option value="noise">▒ noise</option>
            <option value="pulse">▮ pulse</option>
          </optgroup>
          <optgroup label="─── SYNTHESIS ───">
            <option value="harmonic">≋ harmonic</option>
            <option value="morph">◇ morph</option>
            <option value="fm">⊛ fm</option>
            <option value="am">⊕ am</option>
            <option value="pwm">▤ pwm</option>
            <option value="supersaw">⫿ supersaw</option>
            <option value="subsine">◉ subsine</option>
          </optgroup>
          <optgroup label="─── INSTRUMENTS ───">
            <option value="bell">🔔 bell</option>
            <option value="organ">♪ organ</option>
            <option value="pluck">◊ pluck</option>
            <option value="pad">≡ pad</option>
            <option value="bass">▼ bass</option>
            <option value="lead">▲ lead</option>
            <option value="arp">⋮ arp</option>
          </optgroup>
          <optgroup label="─── EFFECTS ───">
            <option value="sweep">↝ sweep</option>
            <option value="wobble">∿ wobble</option>
            <option value="glitch">⌇ glitch</option>
            <option value="grain">⁘ grain</option>
          </optgroup>
          <optgroup label="─── ACOUSTIC ───">
            <option value="formant">◯ formant</option>
            <option value="vocal">♫ vocal</option>
            <option value="breath">○ breath</option>
            <option value="wind">≈ wind</option>
            <option value="string">⌒ string</option>
            <option value="brass">◖ brass</option>
            <option value="keys">♯ keys</option>
          </optgroup>
        </select>
        <select value={preset} onChange={(e) => applyPreset(e.target.value)}
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

        {/* Info Display */}
        <div className="ml-auto flex items-center gap-1">
          <div className="bg-[#0a1a0a] border border-[#1a2a1a] rounded px-1.5 py-0.5 min-w-[120px]">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-mono text-[5px] text-[var(--neon-cyan)]/60">{infoMode}</span>
              <span className="font-mono text-[5px] text-white/30">OZSC-460</span>
            </div>
            <div className="font-mono text-[7px] text-[var(--crt-green)] leading-tight">
              {infoMode === 'WAVE' && (
                <>
                  <div className="flex justify-between">
                    <span>TYPE:</span>
                    <span className="text-[var(--neon-amber)]">{waveType.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>F1/F2:</span>
                    <span>{freq1.toFixed(1)}/{freq2.toFixed(1)}Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>3D:</span>
                    <span className={is3DEnabled ? 'text-[var(--neon-green)]' : 'text-white/30'}>{is3DEnabled ? 'ON' : 'OFF'}</span>
                  </div>
                </>
              )}
              {infoMode === 'SIGNAL' && (
                <>
                  <div className="flex justify-between">
                    <span>AMP:</span>
                    <span>{((intensity / 100) * (1 + amplKnob / 100)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PHASE:</span>
                    <span>{((phaseKnob / 100) * 360).toFixed(0)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span>INT:</span>
                    <span className={interferenceEnabled ? 'text-[var(--neon-amber)]' : 'text-white/30'}>{interferenceEnabled ? `${interference}%` : 'OFF'}</span>
                  </div>
                </>
              )}
              {infoMode === 'COLOR' && (() => {
                const rgb = waveColor.match(/\d+/g) || ['0', '0', '0']
                const hex = `#${parseInt(rgb[0]).toString(16).padStart(2, '0')}${parseInt(rgb[1]).toString(16).padStart(2, '0')}${parseInt(rgb[2]).toString(16).padStart(2, '0')}`
                return (
                  <>
                    <div className="flex justify-between">
                      <span>RGB:</span>
                      <span>{rgb.join(',')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>HEX:</span>
                      <span style={{ color: waveColor }}>{hex.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MIX:</span>
                      <span>{Object.keys(selectedColors).filter(k => selectedColors[k] > 0).join('+') || 'NONE'}</span>
                    </div>
                  </>
                )
              })()}
              {infoMode === 'SYS' && (
                <>
                  <div className="flex justify-between">
                    <span>CPU:</span>
                    <span className={audioEnabled ? 'text-[var(--neon-amber)]' : 'text-[var(--neon-green)]'}>{audioEnabled ? '23%' : '4%'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MEM:</span>
                    <span>128KB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PWR:</span>
                    <span className="text-[var(--neon-green)]">12.4V</span>
                  </div>
                </>
              )}
              {infoMode === 'PRESET' && (
                <>
                  <div className="flex justify-between">
                    <span>NAME:</span>
                    <span className="text-[var(--neon-cyan)]">{preset.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>WAVE:</span>
                    <span>{waveType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MOD:</span>
                    <span className="text-[var(--neon-amber)]">{(xGain + yGain + freqKnob > 0) ? 'CUSTOM' : 'STD'}</span>
                  </div>
                </>
              )}
              {infoMode === 'TIME' && (() => {
                const now = new Date()
                return (
                  <>
                    <div className="flex justify-between">
                      <span>TIME:</span>
                      <span>{now.toLocaleTimeString('en-US', { hour12: false })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>BPM:</span>
                      <span className="text-[var(--neon-amber)]">{bpm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RATE:</span>
                      <span>{sampleRate}Hz</span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
          <button
            onClick={cycleInfoMode}
            className="w-5 h-10 bg-[#2a3a2a] border border-[#1a2a1a] rounded flex items-center justify-center hover:bg-[#3a4a3a] active:bg-[#1a2a1a] transition-colors"
            title="Cycle info mode"
          >
            <span className="font-mono text-[6px] text-[var(--neon-cyan)] writing-mode-vertical" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>MODE</span>
          </button>
        </div>
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
        </>
      )}
    </div>
  )
}
