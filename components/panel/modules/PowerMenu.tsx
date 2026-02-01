'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSystemPower } from '@/contexts/SystemPowerManager'
import { parseTimeArg, formatCountdown } from '@/lib/power/timeParser'

interface PowerMenuProps {
  onClose: () => void
}

export function PowerMenu({ onClose }: PowerMenuProps) {
  const {
    systemState,
    countdownSeconds,
    countdownAction,
    scheduleShutdown,
    scheduleReboot,
    shutdownNow,
    rebootNow,
    cancelCountdown,
  } = useSystemPower()

  const [scheduleMode, setScheduleMode] = useState<'shutdown' | 'reboot' | null>(null)
  const [timeInput, setTimeInput] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Focus time input when schedule mode opens
  useEffect(() => {
    if (scheduleMode && inputRef.current) {
      inputRef.current.focus()
    }
  }, [scheduleMode])

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Close on click outside
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      onClose()
    }
  }, [onClose])

  const handleScheduleSubmit = useCallback(() => {
    if (!scheduleMode || !timeInput.trim()) return

    const parsed = parseTimeArg(timeInput.trim())
    if (parsed.error) {
      setError(parsed.error)
      return
    }

    if (scheduleMode === 'shutdown') {
      scheduleShutdown(parsed.seconds)
    } else {
      scheduleReboot(parsed.seconds)
    }

    let msg = ''
    if (parsed.wasAdjusted) {
      msg = 'adjusted to minimum 10s'
    }

    onClose()
  }, [scheduleMode, timeInput, scheduleShutdown, scheduleReboot, onClose])

  const buttonStyle = (color: string) => ({
    background: 'transparent',
    border: `1px solid ${color}40`,
    color,
    cursor: 'pointer' as const,
  })

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(2px)' }}
      onClick={handleBackdropClick}
    >
      <div
        ref={menuRef}
        className="font-mono text-xs"
        style={{
          background: 'var(--panel-surface, #0d0d1a)',
          border: '1px solid var(--neon-amber, #ffb800)',
          boxShadow: '0 0 20px rgba(255, 184, 0, 0.15), inset 0 0 30px rgba(0, 0, 0, 0.5)',
          minWidth: '280px',
        }}
      >
        {/* Header */}
        <div
          className="px-3 py-2 text-center text-[10px] tracking-widest"
          style={{
            borderBottom: '1px solid rgba(255, 184, 0, 0.2)',
            color: 'var(--neon-amber, #ffb800)',
          }}
        >
          POWER OPTIONS
        </div>

        {/* Countdown active banner */}
        {systemState === 'countdown' && countdownSeconds !== null && (
          <div
            className="px-3 py-2 text-center"
            style={{
              background: 'rgba(255, 184, 0, 0.08)',
              borderBottom: '1px solid rgba(255, 184, 0, 0.15)',
              color: 'var(--neon-amber, #ffb800)',
            }}
          >
            <div className="text-[10px] opacity-60">{countdownAction?.toUpperCase()} IN</div>
            <div className="text-lg tabular-nums">{formatCountdown(countdownSeconds)}</div>
          </div>
        )}

        {/* Menu items */}
        <div className="p-2 flex flex-col gap-1">
          {/* Cancel countdown (only when countdown active) */}
          {systemState === 'countdown' && (
            <button
              className="w-full text-left px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
              style={buttonStyle('var(--neon-green, #00ff66)')}
              onClick={() => { cancelCountdown(); onClose() }}
            >
              [X] Cancel {countdownAction}
            </button>
          )}

          {/* Only show action buttons when not in countdown */}
          {systemState !== 'countdown' && (
            <>
              <button
                className="w-full text-left px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                style={buttonStyle('var(--neon-red, #ff3333)')}
                onClick={() => { shutdownNow(); onClose() }}
              >
                {'[⏻] Shutdown Now'}
              </button>

              <button
                className="w-full text-left px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                style={buttonStyle('var(--neon-amber, #ffb800)')}
                onClick={() => { rebootNow(); onClose() }}
              >
                {'[↻] Reboot Now'}
              </button>

              <div className="h-px my-1" style={{ background: 'rgba(255, 184, 0, 0.1)' }} />

              {/* Schedule shutdown */}
              {scheduleMode === 'shutdown' ? (
                <div className="px-3 py-1.5">
                  <div className="text-[9px] mb-1" style={{ color: 'rgba(255, 184, 0, 0.5)' }}>
                    Format: 4h11m18s, 45m, 90s
                  </div>
                  <div className="flex gap-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={timeInput}
                      onChange={e => { setTimeInput(e.target.value); setError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleScheduleSubmit()}
                      className="flex-1 px-2 py-1 font-mono text-xs rounded bg-black/50 outline-none"
                      style={{
                        border: '1px solid rgba(255, 184, 0, 0.3)',
                        color: 'var(--neon-amber, #ffb800)',
                      }}
                      placeholder="e.g. 30m"
                    />
                    <button
                      className="px-2 py-1 rounded text-[10px]"
                      style={buttonStyle('var(--neon-red, #ff3333)')}
                      onClick={handleScheduleSubmit}
                    >
                      SET
                    </button>
                  </div>
                  {error && (
                    <div className="text-[9px] mt-1" style={{ color: 'var(--neon-red, #ff3333)' }}>
                      {error}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="w-full text-left px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                  style={buttonStyle('var(--neon-red, #ff3333)')}
                  onClick={() => { setScheduleMode('shutdown'); setTimeInput(''); setError('') }}
                >
                  {'[⏱] Schedule Shutdown...'}
                </button>
              )}

              {/* Schedule reboot */}
              {scheduleMode === 'reboot' ? (
                <div className="px-3 py-1.5">
                  <div className="text-[9px] mb-1" style={{ color: 'rgba(255, 184, 0, 0.5)' }}>
                    Format: 4h11m18s, 45m, 90s
                  </div>
                  <div className="flex gap-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={timeInput}
                      onChange={e => { setTimeInput(e.target.value); setError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleScheduleSubmit()}
                      className="flex-1 px-2 py-1 font-mono text-xs rounded bg-black/50 outline-none"
                      style={{
                        border: '1px solid rgba(255, 184, 0, 0.3)',
                        color: 'var(--neon-amber, #ffb800)',
                      }}
                      placeholder="e.g. 2h"
                    />
                    <button
                      className="px-2 py-1 rounded text-[10px]"
                      style={buttonStyle('var(--neon-amber, #ffb800)')}
                      onClick={handleScheduleSubmit}
                    >
                      SET
                    </button>
                  </div>
                  {error && (
                    <div className="text-[9px] mt-1" style={{ color: 'var(--neon-red, #ff3333)' }}>
                      {error}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="w-full text-left px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                  style={buttonStyle('var(--neon-amber, #ffb800)')}
                  onClick={() => { setScheduleMode('reboot'); setTimeInput(''); setError('') }}
                >
                  {'[⏱] Schedule Reboot...'}
                </button>
              )}
            </>
          )}

          <div className="h-px my-1" style={{ background: 'rgba(255, 184, 0, 0.1)' }} />

          <button
            className="w-full text-left px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
            style={buttonStyle('rgba(255, 255, 255, 0.4)')}
            onClick={onClose}
          >
            {'[✕] Close'}
          </button>
        </div>

        {/* Footer hint */}
        <div
          className="px-3 py-1.5 text-[8px] text-center"
          style={{
            borderTop: '1px solid rgba(255, 184, 0, 0.1)',
            color: 'rgba(255, 255, 255, 0.25)',
          }}
        >
          Hold power button 2s for force shutdown
        </div>
      </div>
    </div>
  )
}
