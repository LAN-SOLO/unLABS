'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import type { SystemPowerState, PowerAction, PowerScope, SystemPowerContextValue } from '@/lib/power/types'

const SystemPowerContext = createContext<SystemPowerContextValue | null>(null)

export function useSystemPower(): SystemPowerContextValue {
  const ctx = useContext(SystemPowerContext)
  if (!ctx) throw new Error('useSystemPower must be used within SystemPowerManagerProvider')
  return ctx
}

interface Props {
  children: React.ReactNode
  onShutdownComplete?: () => void
  onRebootComplete?: () => void
  saveDeviceState?: () => void
}

export function SystemPowerManagerProvider({ children, onShutdownComplete, onRebootComplete, saveDeviceState }: Props) {
  const [systemState, setSystemState] = useState<SystemPowerState>('running')
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [countdownAction, setCountdownAction] = useState<PowerAction | null>(null)
  const [powerScope, setPowerScope] = useState<PowerScope | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scopeRef = useRef<PowerScope>('system')

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Flush all _unOS caches so no stale data persists across power cycles
  const flushCaches = useCallback((keepCommandHistory: boolean) => {
    try {
      if (keepCommandHistory) {
        const cmdHistory = localStorage.getItem('unlabs_cmd_history')
        localStorage.clear()
        if (cmdHistory) localStorage.setItem('unlabs_cmd_history', cmdHistory)
      } else {
        localStorage.clear()
      }
      sessionStorage.clear()
    } catch { /* ignore in SSR */ }
  }, [])

  const executeShutdown = useCallback(() => {
    clearTimer()
    setSystemState('shutting-down')
    setCountdownSeconds(null)
    setCountdownAction(null)
    setPowerScope(scopeRef.current)
    saveDeviceState?.()
    flushCaches(false)
    // Transition to 'off' after CRT animation
    setTimeout(() => {
      setSystemState('off')
    }, 1400)
  }, [clearTimer, saveDeviceState, flushCaches])

  const executeReboot = useCallback(() => {
    clearTimer()
    setSystemState('rebooting')
    setCountdownSeconds(null)
    setCountdownAction(null)
    setPowerScope(scopeRef.current)
    saveDeviceState?.()
    flushCaches(true)
    // Transition to booting after CRT animation
    setTimeout(() => {
      setSystemState('booting')
    }, 1200)
  }, [clearTimer, saveDeviceState, flushCaches])

  const startCountdown = useCallback((seconds: number, action: PowerAction) => {
    clearTimer()
    setCountdownSeconds(seconds)
    setCountdownAction(action)
    setSystemState('countdown')

    timerRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev === null || prev <= 1) {
          clearTimer()
          if (action === 'shutdown') {
            executeShutdown()
          } else {
            executeReboot()
          }
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [clearTimer, executeShutdown, executeReboot])

  const scheduleShutdown = useCallback((seconds: number, scope: PowerScope = 'system') => {
    scopeRef.current = scope
    setPowerScope(scope)
    if (seconds <= 0) {
      executeShutdown()
    } else {
      startCountdown(seconds, 'shutdown')
    }
  }, [executeShutdown, startCountdown])

  const scheduleReboot = useCallback((seconds: number, scope: PowerScope = 'system') => {
    scopeRef.current = scope
    setPowerScope(scope)
    if (seconds <= 0) {
      executeReboot()
    } else {
      startCountdown(seconds, 'reboot')
    }
  }, [executeReboot, startCountdown])

  const shutdownNow = useCallback((scope: PowerScope = 'system') => {
    scopeRef.current = scope
    setPowerScope(scope)
    executeShutdown()
  }, [executeShutdown])

  const rebootNow = useCallback((scope: PowerScope = 'system') => {
    scopeRef.current = scope
    setPowerScope(scope)
    executeReboot()
  }, [executeReboot])

  const cancelCountdown = useCallback(() => {
    clearTimer()
    setSystemState('running')
    setCountdownSeconds(null)
    setCountdownAction(null)
    setPowerScope(null)
    scopeRef.current = 'system'
  }, [clearTimer])

  const powerOn = useCallback((scope: PowerScope = 'system') => {
    scopeRef.current = scope
    setPowerScope(scope)
    setSystemState('booting')
  }, [])

  const finishBoot = useCallback(() => {
    setSystemState('running')
    setPowerScope(null)
    scopeRef.current = 'system'
    onRebootComplete?.()
  }, [onRebootComplete])

  const value: SystemPowerContextValue & { onShutdownComplete?: () => void } = {
    systemState,
    countdownSeconds,
    countdownAction,
    powerScope,
    scheduleShutdown,
    scheduleReboot,
    shutdownNow,
    rebootNow,
    cancelCountdown,
    powerOn,
    finishBoot,
    onShutdownComplete,
  }

  return (
    <SystemPowerContext.Provider value={value as SystemPowerContextValue}>
      {children}
    </SystemPowerContext.Provider>
  )
}

// Optional hook — returns null if not inside provider
export function useSystemPowerOptional() {
  return useContext(SystemPowerContext)
}

// Extended hook for internal components that need finishBoot/onShutdownComplete
export function useSystemPowerInternal() {
  const ctx = useContext(SystemPowerContext)
  if (!ctx) throw new Error('useSystemPowerInternal must be used within SystemPowerManagerProvider')
  return ctx as SystemPowerContextValue & { onShutdownComplete?: () => void }
}
