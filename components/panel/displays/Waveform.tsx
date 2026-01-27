'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

// All supported waveform types
type WaveformType =
  // Basic
  | 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise' | 'pulse'
  // Synthesis
  | 'harmonic' | 'morph' | 'fm' | 'am' | 'pwm' | 'supersaw' | 'subsine'
  // Instruments
  | 'bell' | 'organ' | 'pluck' | 'pad' | 'bass' | 'lead' | 'arp'
  // Effects
  | 'sweep' | 'wobble' | 'glitch' | 'grain'
  // Acoustic
  | 'formant' | 'vocal' | 'breath' | 'wind' | 'string' | 'brass' | 'keys'
  // Custom
  | 'custom'

interface WaveformProps {
  type?: WaveformType
  frequency?: number
  amplitude?: number
  color?: string
  showGrid?: boolean
  gridColor?: string
  width?: number
  height?: number
  data?: number[]
  animated?: boolean
  offset?: number  // Vertical DC offset (-1 to 1)
  phase?: number   // Phase shift in radians
  className?: string
  // Interference settings
  frequency2?: number
  interferenceStrength?: number
  wavelengthFactor?: number
  is3D?: boolean
}

export function Waveform({
  type = 'sine',
  frequency = 2,
  amplitude = 0.8,
  color = '#00ff66',
  showGrid = true,
  gridColor = 'rgba(0, 255, 102, 0.15)',
  width = 300,
  height = 150,
  data,
  animated = true,
  offset = 0,
  phase = 0,
  className,
  frequency2 = 0,
  interferenceStrength = 0,
  wavelengthFactor = 1,
  is3D = false,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const phaseRef = useRef(0)

  const generateWaveform = useCallback(
    (animPhase: number): number[] => {
      const points: number[] = []
      const samples = width

      for (let i = 0; i < samples; i++) {
        // Include both animation phase and user-controlled phase shift
        // Apply wavelength factor to stretch/compress the waveform
        const x = (i / samples) * Math.PI * 2 * frequency * wavelengthFactor + animPhase + phase
        let y: number

        switch (type) {
          // Basic waveforms
          case 'sine':
            y = Math.sin(x) * amplitude
            break
          case 'square':
            y = (Math.sin(x) > 0 ? 1 : -1) * amplitude
            break
          case 'sawtooth':
            y = ((x % (Math.PI * 2)) / Math.PI - 1) * amplitude
            break
          case 'triangle':
            y = (2 / Math.PI) * Math.asin(Math.sin(x)) * amplitude
            break
          case 'noise':
            y = (Math.random() * 2 - 1) * amplitude
            break
          case 'pulse':
            y = (Math.sin(x) > 0.7 ? 1 : -1) * amplitude
            break

          // Synthesis waveforms
          case 'harmonic':
            y = (Math.sin(x) + Math.sin(x * 2) * 0.5 + Math.sin(x * 3) * 0.25) * amplitude * 0.57
            break
          case 'morph': {
            const t = (Math.sin(animPhase * 0.1) + 1) / 2
            const sine = Math.sin(x)
            const square = Math.sin(x) > 0 ? 1 : -1
            y = (sine * (1 - t) + square * t) * amplitude
            break
          }
          case 'fm':
            y = Math.sin(x + Math.sin(x * 3) * 2) * amplitude
            break
          case 'am':
            y = Math.sin(x) * (0.5 + 0.5 * Math.sin(x * 0.1)) * amplitude
            break
          case 'pwm': {
            const duty = 0.3 + 0.2 * Math.sin(animPhase * 0.2)
            y = ((x % (Math.PI * 2)) < Math.PI * 2 * duty ? 1 : -1) * amplitude
            break
          }
          case 'supersaw':
            y = (Math.sin(x) + Math.sin(x * 1.01) + Math.sin(x * 0.99) +
                 Math.sin(x * 1.02) + Math.sin(x * 0.98)) * amplitude * 0.2
            break
          case 'subsine':
            y = (Math.sin(x) + Math.sin(x * 0.5) * 0.8) * amplitude * 0.56
            break

          // Instrument waveforms
          case 'bell':
            y = Math.sin(x) * Math.exp(-((i / samples) * 3)) * amplitude +
                Math.sin(x * 2.4) * Math.exp(-((i / samples) * 5)) * amplitude * 0.5
            break
          case 'organ':
            y = (Math.sin(x) + Math.sin(x * 2) * 0.7 + Math.sin(x * 4) * 0.3 +
                 Math.sin(x * 8) * 0.1) * amplitude * 0.48
            break
          case 'pluck':
            y = Math.sin(x) * Math.exp(-((i / samples) * 4)) * amplitude *
                (1 + 0.3 * Math.sin(x * 8) * Math.exp(-((i / samples) * 8)))
            break
          case 'pad':
            y = (Math.sin(x) + Math.sin(x * 1.005) + Math.sin(x * 0.995)) * amplitude * 0.33 *
                (0.8 + 0.2 * Math.sin(animPhase * 0.05))
            break
          case 'bass':
            y = (Math.sin(x) * 0.7 + Math.sin(x * 2) * 0.2 +
                 (Math.sin(x) > 0 ? 0.1 : -0.1)) * amplitude
            break
          case 'lead':
            y = (Math.sin(x) + ((x % (Math.PI * 2)) / Math.PI - 1) * 0.3) * amplitude * 0.77
            break
          case 'arp': {
            const step = Math.floor((animPhase * 2) % 4)
            const freqMult = [1, 1.25, 1.5, 2][step]
            y = Math.sin(x * freqMult) * amplitude
            break
          }

          // Effect waveforms
          case 'sweep':
            y = Math.sin(x * (1 + (i / samples) * 2)) * amplitude
            break
          case 'wobble':
            y = Math.sin(x * (1 + Math.sin(animPhase * 0.3) * 0.5)) * amplitude
            break
          case 'glitch':
            if (Math.random() > 0.95) {
              y = (Math.random() * 2 - 1) * amplitude
            } else {
              y = Math.sin(x) * amplitude
            }
            break
          case 'grain': {
            const grainPos = (i + animPhase * 10) % 30
            const grainEnv = grainPos < 15 ? grainPos / 15 : (30 - grainPos) / 15
            y = Math.sin(x) * grainEnv * amplitude
            break
          }

          // Acoustic waveforms
          case 'formant': {
            const f1 = Math.sin(x * 1)
            const f2 = Math.sin(x * 2.5) * 0.6
            const f3 = Math.sin(x * 4) * 0.3
            y = (f1 + f2 + f3) * amplitude * 0.53
            break
          }
          case 'vocal':
            y = (Math.sin(x) * (1 + 0.3 * Math.sin(x * 5)) +
                 Math.sin(x * 1.5) * 0.3) * amplitude * 0.65
            break
          case 'breath':
            y = (Math.random() * 0.3 + Math.sin(x) * 0.7) *
                (0.7 + 0.3 * Math.sin(animPhase * 0.2)) * amplitude
            break
          case 'wind':
            y = ((Math.random() * 2 - 1) * 0.4 + Math.sin(x * 0.5) * 0.6) *
                (0.5 + 0.5 * Math.sin(animPhase * 0.1 + i * 0.01)) * amplitude
            break
          case 'string':
            y = (Math.sin(x) + Math.sin(x * 2) * 0.5 + Math.sin(x * 3) * 0.25 +
                 Math.sin(x * 4) * 0.125) * Math.exp(-((i / samples) * 0.5)) * amplitude * 0.53
            break
          case 'brass': {
            const attack = Math.min(1, (i / samples) * 10)
            y = (Math.sin(x) + Math.sin(x * 2) * 0.6 + Math.sin(x * 3) * 0.4) *
                amplitude * 0.5 * attack
            break
          }
          case 'keys':
            y = (Math.sin(x) + Math.sin(x * 2) * 0.4) *
                Math.exp(-((i / samples) * 2)) * amplitude * 0.71

            break

          case 'custom':
            y = data?.[i] ?? 0
            break
          default:
            y = 0
        }

        // Apply interference if enabled
        if (interferenceStrength > 0 && frequency2 > 0) {
          const x2 = (i / samples) * Math.PI * 2 * frequency2 * wavelengthFactor + animPhase * 0.7
          const y2 = Math.sin(x2) * amplitude * interferenceStrength
          y = y + y2
        }

        // Apply vertical offset (DC offset)
        points.push(y + offset)
      }

      return points
    },
    [type, frequency, amplitude, width, data, offset, phase, frequency2, interferenceStrength, wavelengthFactor]
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = gridColor
      ctx.lineWidth = 1

      // Vertical lines
      const gridSpacingX = width / 8
      for (let x = 0; x <= width; x += gridSpacingX) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      // Horizontal lines
      const gridSpacingY = height / 6
      for (let y = 0; y <= height; y += gridSpacingY) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Center crosshair (brighter)
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.3)'
      ctx.beginPath()
      ctx.moveTo(width / 2, 0)
      ctx.lineTo(width / 2, height)
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()
    }

    // Generate and draw waveform
    const points = data || generateWaveform(phaseRef.current)
    const centerY = height / 2

    // 3D mode - draw multiple layers with offset
    if (is3D) {
      const layers = 5
      for (let layer = layers - 1; layer >= 0; layer--) {
        const layerOffset = layer * 3
        const layerAlpha = 0.2 + (1 - layer / layers) * 0.8

        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = layer === 0 ? 2 : 1
        ctx.globalAlpha = layerAlpha
        ctx.shadowColor = color
        ctx.shadowBlur = layer === 0 ? 8 : 2

        for (let i = 0; i < points.length; i++) {
          const x = (i / points.length) * width
          const y = centerY - points[i] * (height / 2) * 0.9 - layerOffset

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
    } else {
      // Normal 2D mode
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.shadowColor = color
      ctx.shadowBlur = 8

      for (let i = 0; i < points.length; i++) {
        const x = (i / points.length) * width
        const y = centerY - points[i] * (height / 2) * 0.9

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()

      // Draw glow layer
      ctx.shadowBlur = 16
      ctx.globalAlpha = 0.5
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
    }
  }, [width, height, color, showGrid, gridColor, generateWaveform, data, is3D])

  useEffect(() => {
    if (!animated || type === 'custom') {
      draw()
      return
    }

    const animate = () => {
      phaseRef.current += 0.05
      draw()
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animated, type, draw])

  return (
    <canvas
      ref={canvasRef}
      className={cn('phosphor-flicker', className)}
      style={{ width, height }}
    />
  )
}
