'use client'

import { useRef, useEffect } from 'react'
import type { ScreensaverPattern, PatternParamsMap } from './types'
import { renderMoire, renderLissajous, renderPlasma, renderTunnel, renderSpirograph, renderMatrix, renderWarp } from './patterns'

interface ScreensaverCanvasProps {
  pattern: ScreensaverPattern
  params: PatternParamsMap[ScreensaverPattern]
  color: string
  brightness: number
  width: number
  height: number
  crtOverlay?: boolean
}

const RENDERERS: Record<ScreensaverPattern, (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p: never, c: string, s?: React.MutableRefObject<unknown>) => void> = {
  moire: renderMoire as never,
  lissajous: renderLissajous as never,
  plasma: renderPlasma as never,
  tunnel: renderTunnel as never,
  spirograph: renderSpirograph as never,
  matrix: renderMatrix as never,
  warp: renderWarp as never,
}

export function ScreensaverCanvas({ pattern, params, color, brightness, width, height, crtOverlay }: ScreensaverCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const stateRef = useRef<unknown>(null)
  const startTimeRef = useRef<number>(0)
  const prevPatternRef = useRef<ScreensaverPattern>(pattern)

  // Refs for latest values — animation loop reads these each frame
  const patternRef = useRef(pattern)
  const paramsRef = useRef(params)
  const colorRef = useRef(color)
  const widthRef = useRef(width)
  const heightRef = useRef(height)
  patternRef.current = pattern
  paramsRef.current = params
  colorRef.current = color
  widthRef.current = width
  heightRef.current = height

  // Reset state when pattern changes
  useEffect(() => {
    if (prevPatternRef.current !== pattern) {
      stateRef.current = null
      prevPatternRef.current = pattern
      // Clear canvas on pattern switch
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = '#000'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      }
    }
  }, [pattern])

  // Single stable animation loop — reads latest values from refs each frame
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return

    // Skip DPR scaling — screensavers don't need Retina precision
    // and rendering at 2-3x resolution kills performance at fullscreen
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    let running = true
    const loop = () => {
      if (!running) return

      if (!startTimeRef.current) startTimeRef.current = performance.now()
      const time = (performance.now() - startTimeRef.current) / 1000

      const render = RENDERERS[patternRef.current]
      if (render) {
        render(ctx, widthRef.current, heightRef.current, time, paramsRef.current as never, colorRef.current, stateRef)
      }

      animationRef.current = requestAnimationFrame(loop)
    }

    animationRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(animationRef.current)
    }
  }, [width, height])

  return (
    <div className="relative" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        style={{
          width, height,
          filter: `brightness(${brightness / 100})`,
          display: 'block',
        }}
      />
      {crtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)',
            mixBlendMode: 'multiply',
          }}
        />
      )}
    </div>
  )
}
