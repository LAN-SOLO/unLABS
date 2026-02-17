'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { P1_KEYS, P2_KEYS, SOFT_DROP_FACTOR, DEFAULT_TETRIS_THEME, buildTetrisTheme, type KeyBindings, type TetrisTheme } from './types'
import { createGameState, updateGame, processAction, getGravityInterval } from './engine'
import { TetrisAudio } from './audio'
import { render, type TierLabel } from './renderer'
import type { GameState, GameEvent } from './types'

interface TetrisOverlayProps {
  mode: '1p' | '2p'
  onExit: () => void
  theme?: { fg: string; glow: string; screen: string; bar: string }
}

export function TetrisOverlay({ mode, onExit, theme }: TetrisOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameState>(createGameState(mode))
  const audioRef = useRef<TetrisAudio>(new TetrisAudio())
  const animFrameRef = useRef<number>(0)
  const keysDownRef = useRef<Set<string>>(new Set())
  const softDropTimerRef = useRef<Record<number, number>>({})
  const tierLabelsRef = useRef<TierLabel[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Build tetris theme from terminal theme
  const tetrisTheme: TetrisTheme = theme
    ? buildTetrisTheme(theme.fg, theme.screen, theme.glow)
    : DEFAULT_TETRIS_THEME

  // Handle audio events + tier labels
  const handleEvents = useCallback((events: GameEvent[]) => {
    const audio = audioRef.current
    for (const e of events) {
      switch (e.type) {
        case 'move': audio.playMove(); break
        case 'rotate': audio.playRotate(); break
        case 'hardDrop': audio.playHardDrop(); break
        case 'lock': audio.playLock(); break
        case 'lineClear':
          audio.playLineClear(e.linesCleared ?? 1, e.ageTier)
          // Show floating tier label for non-FRESH clears
          if (e.ageTier && e.ageTier !== 'FRESH' && e.ageMultiplier) {
            tierLabelsRef.current.push({
              text: e.ageTier,
              multiplier: e.ageMultiplier,
              spawnTime: performance.now(),
              player: e.player,
            })
          }
          break
        case 'levelUp': audio.playLevelUp(); break
        case 'gameOver': audio.playGameOver(); break
        case 'garbage': audio.playGarbage(); break
        case 'hold': audio.playHold(); break
        case 'decay': audio.playDecay(); break
      }
    }
  }, [])

  // Key action mapping
  const processKey = useCallback((key: string, bindings: KeyBindings, playerIdx: number) => {
    const game = gameRef.current
    const time = performance.now()
    let result: { game: GameState; events: GameEvent[] } | null = null

    if (key === bindings.left) {
      result = processAction(game, { type: 'move', player: playerIdx, dx: -1, time })
    } else if (key === bindings.right) {
      result = processAction(game, { type: 'move', player: playerIdx, dx: 1, time })
    } else if (key === bindings.rotateCW) {
      result = processAction(game, { type: 'rotateCW', player: playerIdx, time })
    } else if (key === bindings.rotateCCW) {
      result = processAction(game, { type: 'rotateCCW', player: playerIdx, time })
    } else if (key === bindings.hardDrop) {
      result = processAction(game, { type: 'hardDrop', player: playerIdx, time })
    } else if (key === bindings.hold) {
      result = processAction(game, { type: 'hold', player: playerIdx, time })
    }

    if (result) {
      gameRef.current = result.game
      handleEvents(result.events)
    }
  }, [handleEvents])

  // Soft drop continuous
  const processSoftDrop = useCallback((playerIdx: number) => {
    const game = gameRef.current
    const time = performance.now()
    const result = processAction(game, { type: 'softDrop', player: playerIdx, time })
    gameRef.current = result.game
  }, [])

  // Key handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key
      const game = gameRef.current

      // Prevent default for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(key)) {
        e.preventDefault()
      }

      // Global keys
      if (key === 'Escape') {
        if (game.paused) {
          onExit()
          return
        }
        if (game.gameOverFlag) {
          onExit()
          return
        }
        gameRef.current = { ...game, paused: true }
        return
      }

      if (key.toLowerCase() === 'p') {
        gameRef.current = { ...game, paused: !game.paused }
        return
      }

      if (key.toLowerCase() === 'm') {
        const muted = !game.muted
        gameRef.current = { ...game, muted }
        audioRef.current.setMuted(muted)
        return
      }

      if (key.toLowerCase() === 'r' && game.gameOverFlag) {
        gameRef.current = createGameState(mode)
        return
      }

      if (game.paused || game.gameOverFlag) return

      // Avoid key repeat
      if (keysDownRef.current.has(key)) return
      keysDownRef.current.add(key)

      // Player 1 keys
      processKey(key, P1_KEYS, 0)

      // Soft drop for P1
      if (key === P1_KEYS.softDrop) {
        const interval = getGravityInterval(game.players[0].level) / SOFT_DROP_FACTOR
        softDropTimerRef.current[0] = window.setInterval(() => processSoftDrop(0), Math.max(interval, 20))
      }

      // Player 2 keys (2p mode only)
      if (mode === '2p') {
        processKey(key, P2_KEYS, 1)

        if (key === P2_KEYS.softDrop) {
          const interval = getGravityInterval(game.players[1].level) / SOFT_DROP_FACTOR
          softDropTimerRef.current[1] = window.setInterval(() => processSoftDrop(1), Math.max(interval, 20))
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key
      keysDownRef.current.delete(key)

      // Stop soft drop timers
      if (key === P1_KEYS.softDrop && softDropTimerRef.current[0]) {
        clearInterval(softDropTimerRef.current[0])
        delete softDropTimerRef.current[0]
      }
      if (key === P2_KEYS.softDrop && softDropTimerRef.current[1]) {
        clearInterval(softDropTimerRef.current[1])
        delete softDropTimerRef.current[1]
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      // Clean up soft drop timers
      Object.values(softDropTimerRef.current).forEach(clearInterval)
    }
  }, [mode, onExit, processKey, processSoftDrop])

  // ResizeObserver to measure container instead of window
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setSize({ w: Math.floor(width), h: Math.floor(height) })
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Initialize audio on first interaction
  useEffect(() => {
    audioRef.current.init()
    return () => audioRef.current.destroy()
  }, [])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0 || size.h === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const loop = () => {
      const time = performance.now()
      const game = gameRef.current

      if (!game.paused && !game.gameOverFlag) {
        const { game: updated, events } = updateGame(game, time)
        gameRef.current = updated
        handleEvents(events)
      }

      // Prune expired tier labels (older than 1.5s)
      tierLabelsRef.current = tierLabelsRef.current.filter(l => time - l.spawnTime < 1500)

      render(ctx, size.w, size.h, gameRef.current, tetrisTheme, time, tierLabelsRef.current)
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [size, handleEvents, tetrisTheme])

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 relative"
    >
      {size.w > 0 && size.h > 0 && (
        <canvas
          ref={canvasRef}
          style={{ width: size.w, height: size.h, display: 'block' }}
        />
      )}
    </div>
  )
}
